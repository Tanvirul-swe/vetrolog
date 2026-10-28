import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, ArrowRight, Settings, CheckCircle2, AlertCircle, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { ExtendedTableSchema } from '@/types/database';
import { parseNaturalLanguageToSql } from '../services/offlineNlParser';
import { generateSqlWithAI, getDialectName } from '../services/aiService';
import { telemetry } from '@/features/telemetry/telemetryService';

export function NaturalLanguageBar() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const setQuery = usePlaygroundStore((s) => s.setQuery);
  const runExecute = usePlaygroundStore((s) => s.runExecute);
  const aiConfig = usePlaygroundStore((s) => s.aiConfig);
  const setIsAiSettingsOpen = usePlaygroundStore((s) => s.setIsAiSettingsOpen);

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const remoteTables = useConnectionManagerStore((s) => s.remoteTables);
  const remoteSelectedTable = useConnectionManagerStore((s) => s.selectedTable);
  const tableSchema = useConnectionManagerStore((s) => s.tableSchema);
  const mobileSelectedTable = useDatabaseStore((s) => s.selectedTableName);
  const activeDb = useDatabaseStore((s) => s.databases.find((d) => d.id === s.selectedDatabaseId));

  const selectedTable = workspaceMode === 'remote' ? (remoteSelectedTable || mobileSelectedTable) : mobileSelectedTable;
  const currentEngine = workspaceMode === 'remote' ? activeSession?.config.engine || 'postgres' : 'sqlite';
  const dialectName = getDialectName(currentEngine);

  // Combine tables across active workspace mode so AI always has accurate table and column schema
  const tables = useMemo<ExtendedTableSchema[]>(() => {
    const tableMap = new Map<string, ExtendedTableSchema>();

    // 1. From remoteTables if in remote mode
    if (workspaceMode === 'remote' && remoteTables) {
      for (const t of remoteTables) {
        tableMap.set(t.name.toLowerCase(), {
          name: t.name,
          tableName: t.name,
          schema: t.schema || 'public',
          type: t.type || 'table',
          rowCount: t.rowCount || 0,
          columns: (t.columns || []).map((c) => ({
            name: c.name,
            type: c.type || 'TEXT',
            isPrimaryKey: !!c.isPrimaryKey,
            isNullable: !!c.isNullable,
          })),
          foreignKeys: [],
          indexes: [],
        });
      }
    }

    // 2. From inspected tableSchema
    if (tableSchema) {
      tableMap.set(tableSchema.name.toLowerCase(), tableSchema);
    }

    // 3. From extendedSchema (Mobile ADB)
    if (extendedSchema?.tables && extendedSchema.tables.length > 0) {
      for (const t of extendedSchema.tables) {
        tableMap.set(t.name.toLowerCase(), t);
      }
    }

    // 4. From activeDb (Mobile or Local)
    if (activeDb?.tables) {
      for (const t of activeDb.tables) {
        const existing = tableMap.get(t.name.toLowerCase());
        if (!existing) {
          tableMap.set(t.name.toLowerCase(), {
            name: t.name,
            tableName: t.name,
            type: t.type || 'table',
            rowCount: t.rowCount || 0,
            columns: (t.columns || []).map((c) => ({
              name: c.name,
              type: c.type || 'TEXT',
              isPrimaryKey: !!c.isPrimaryKey,
              isNullable: !!c.isNullable,
            })),
            foreignKeys: [],
            indexes: [],
          });
        }
      }
    }

    return Array.from(tableMap.values());
  }, [workspaceMode, remoteTables, tableSchema, extendedSchema, activeDb]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setFeedback({ message: 'Generation stopped by user', isError: false });
  };

  // Clean up in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setFeedback(null);

    try {
      if (aiConfig.provider === 'offline') {
        const result = parseNaturalLanguageToSql(prompt, tables);
        if (!controller.signal.aborted) {
          setQuery(result.sql);
          setFeedback({ message: `Offline engine: ${result.explanation}` });
        }
      } else {
        const setAiConfig = usePlaygroundStore.getState().setAiConfig;
        const result = await generateSqlWithAI(
          prompt,
          tables,
          aiConfig,
          currentEngine,
          (migratedModel) => {
            setAiConfig({ modelName: migratedModel });
          },
          controller.signal,
          selectedTable || undefined
        );

        if (controller.signal.aborted) {
          setFeedback({ message: 'Generation stopped by user', isError: false });
          return;
        }

        if (result.error) {
          if (
            result.error.toLowerCase().includes('stopped') ||
            result.error.toLowerCase().includes('aborted') ||
            result.error.toLowerCase().includes('cancelled')
          ) {
            setFeedback({ message: 'Generation stopped by user', isError: false });
          } else {
            setFeedback({ message: result.error, isError: true });
          }
        } else if (result.sql) {
          setQuery(result.sql);
          const prefix = result.explanation ? `${result.explanation} • ` : '';
          setFeedback({ message: `${prefix}${dialectName} SQL: ${result.sql}` });
          telemetry.trackFeature('ai_sql_generated', { provider: aiConfig.provider, dialect: dialectName });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setFeedback({ message: 'Generation stopped by user', isError: false });
      } else {
        setFeedback({ message: err.message || 'Failed to parse natural language', isError: true });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-2 border-b border-border/60 bg-muted/10 flex flex-col gap-1.5 select-none">
      <form onSubmit={handleGenerate} className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Sparkles className="absolute left-2.5 top-2.5 size-3.5 text-primary shrink-0" />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && isGenerating) {
                e.preventDefault();
                handleStop();
              }
            }}
            placeholder={`Ask in plain English: (e.g. 'Show ${dialectName === 'PostgreSQL' ? 'records from last 15 days' : 'top 10 users'}')`}
            className="pl-8 pr-4 sm:pr-36 h-8 text-xs bg-card/60 border-border/60 focus:bg-background"
          />
          <Badge
            variant="outline"
            className="hidden sm:inline-flex absolute right-2 top-1.5 text-[9px] px-1 py-0 capitalize text-muted-foreground border-border/60"
          >
            {aiConfig.provider === 'offline' ? 'Offline Rule Engine' : `${aiConfig.provider} • ${dialectName}`}
          </Badge>
        </div>

        {!isGenerating ? (
          <Button
            type="submit"
            size="sm"
            disabled={!prompt.trim()}
            className="h-8 text-xs gap-1.5 shrink-0 bg-primary/90 hover:bg-primary font-medium cursor-pointer shadow-xs"
          >
            <Sparkles className="size-3" />
            <span>Generate SQL</span>
            <ArrowRight className="size-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              disabled
              className="h-8 text-xs gap-1.5 shrink-0 bg-muted/80 text-muted-foreground font-medium border border-border/60"
            >
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>Thinking...</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleStop}
              className="h-8 text-xs gap-1.5 shrink-0 bg-red-600 hover:bg-red-500 text-white font-medium shadow-xs animate-pulse cursor-pointer"
              title="Stop generating SQL query (Esc)"
            >
              <Square className="size-2.5 fill-white" />
              <span>Stop</span>
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAiSettingsOpen(true)}
          title="Configure AI Provider (Gemini / OpenAI / Ollama)"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
        >
          <Settings className="size-3.5" />
        </Button>
      </form>

      {/* Result & Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between text-[11px] px-2.5 py-1 rounded-md border font-mono animate-in fade-in duration-150 ${
            feedback.isError
              ? 'bg-destructive/10 border-destructive/30 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {feedback.isError ? (
              <AlertCircle className="size-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            )}
            <span className="truncate">{feedback.message}</span>
          </div>

          {!feedback.isError && (
            <button
              type="button"
              onClick={() => runExecute()}
              className="text-[10px] font-sans font-medium px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 ml-2 shrink-0 transition-colors cursor-pointer"
            >
              Run Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
