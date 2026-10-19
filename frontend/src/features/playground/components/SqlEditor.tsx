import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  ShieldAlert,
  Search,
  Eraser,
  XCircle,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutocompletePopup, AutocompleteItem } from './AutocompletePopup';
import { predictJoins } from '../services/joinPredictor';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
  'ON',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'CREATE INDEX',
  'DROP TABLE',
  'ALTER TABLE',
  'PRAGMA',
  'EXPLAIN QUERY PLAN',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS NULL',
  'IS NOT NULL',
  'LIKE',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
];

interface SqlEditorProps {
  onRunExecute: (overrideSql?: string) => void;
  onRunDryRun: (overrideSql?: string) => void;
  onRunExplain: (overrideSql?: string) => void;
}

export function SqlEditor({
  onRunExecute,
  onRunDryRun,
  onRunExplain,
}: SqlEditorProps) {
  const query = usePlaygroundStore((s) => s.query);
  const setQuery = usePlaygroundStore((s) => s.setQuery);
  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const isExecuting = usePlaygroundStore((s) => s.isExecuting);
  const isSimulating = usePlaygroundStore((s) => s.isSimulating);
  const isExplaining = usePlaygroundStore((s) => s.isExplaining);
  const cancelExecution = usePlaygroundStore((s) => s.cancelExecution);
  const formatSql = usePlaygroundStore((s) => s.formatSql);

  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedAutoIndex, setSelectedAutoIndex] = useState(0);

  const getExecutableQuery = (): string => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
        const selected = value.substring(selectionStart, selectionEnd).trim();
        if (selected) return selected;
      }
    }
    return query;
  };

  const updateSelectionState = () => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      setHasSelection(selectionStart !== selectionEnd);
      setCursorPos(selectionStart);
    }
  };

  // Split lines for line numbers
  const lines = useMemo(() => query.split('\n'), [query]);

  // Contextual autocomplete calculation
  const autocompleteItems = useMemo<AutocompleteItem[]>(() => {
    const textBefore = query.slice(0, cursorPos);
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/);
    const currentWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';

    const tables = extendedSchema?.tables || [];

    // Check if typing after JOIN or FROM
    const isJoinContext = /(?:JOIN|FROM)\s+([a-zA-Z0-9_]*)$/i.test(textBefore);
    const isOnContext = /JOIN\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]*)$/i.test(textBefore);

    const items: AutocompleteItem[] = [];

    // 1. Join Predictor (Typing after JOIN table ON)
    if (isOnContext) {
      const match = textBefore.match(/FROM\s+([a-zA-Z0-9_]+)[\s\S]*?JOIN\s+([a-zA-Z0-9_]+)\s+ON/i);
      if (match) {
        const fromTable = match[1];
        const joinTable = match[2];
        const predictions = predictJoins(fromTable, joinTable, tables);
        for (const p of predictions) {
          items.push({
            label: `ON ${p.onClause}`,
            insertText: `${p.onClause} `,
            type: 'join',
            detail: p.isForeignKey ? 'Foreign Key Match' : 'Smart Relation',
            meta: `${Math.round(p.confidence * 100)}%`,
          });
        }
      }
    }

    // 2. Tables Suggestion
    if (isJoinContext || currentWord.length > 0) {
      for (const t of tables) {
        if (!currentWord || t.name.toLowerCase().includes(currentWord)) {
          items.push({
            label: t.name,
            insertText: `"${t.name}" `,
            type: 'table',
            detail: `${t.rowCount} rows`,
            meta: t.type,
          });
        }
      }
    }

    // 3. Columns Suggestion (Match all columns across active tables)
    if (currentWord.length > 0) {
      for (const t of tables) {
        for (const c of t.columns) {
          if (c.name.toLowerCase().includes(currentWord)) {
            items.push({
              label: `${c.name}`,
              insertText: `"${c.name}"`,
              type: 'column',
              detail: `${t.name}.${c.name}`,
              meta: c.type,
              isPk: c.isPrimaryKey,
            });
          }
        }
      }
    }

    // 4. SQL Keywords
    if (currentWord.length > 0) {
      for (const kw of SQL_KEYWORDS) {
        if (kw.toLowerCase().startsWith(currentWord) && kw.toLowerCase() !== currentWord) {
          items.push({
            label: kw,
            insertText: `${kw} `,
            type: 'keyword',
            meta: 'SQL',
          });
        }
      }
    }

    return items.slice(0, 10);
  }, [query, cursorPos, extendedSchema]);

  // Update popup coordinates based on cursor
  useEffect(() => {
    if (autocompleteItems.length > 0 && textareaRef.current) {
      const linesBefore = query.slice(0, cursorPos).split('\n');
      const currentLine = linesBefore.length;
      const currentCol = linesBefore[linesBefore.length - 1].length;

      const top = Math.min(220, currentLine * 20 + 35);
      const left = Math.min(400, Math.max(50, currentCol * 7 + 40));

      setPopupPos({ top, left });
      setSelectedAutoIndex(0);
    } else {
      setPopupPos(null);
    }
  }, [autocompleteItems.length, cursorPos, query]);

  const handleSelectAutocomplete = (item: AutocompleteItem) => {
    if (!textareaRef.current) return;
    const textBefore = query.slice(0, cursorPos);
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/);
    const replaceLen = lastWordMatch ? lastWordMatch[1].length : 0;

    const start = cursorPos - replaceLen;
    const newQuery = query.slice(0, start) + item.insertText + query.slice(cursorPos);
    setQuery(newQuery);

    const newPos = start + item.insertText.length;
    setCursorPos(newPos);
    setPopupPos(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (popupPos && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutoIndex((prev) => (prev + 1) % autocompleteItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutoIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectAutocomplete(autocompleteItems[selectedAutoIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPopupPos(null);
        return;
      }
    }

    // Keyboard Shortcuts: ⌘Enter / Ctrl+Enter = Run
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const targetSql = getExecutableQuery();
      if (e.shiftKey) {
        onRunDryRun(targetSql);
      } else {
        onRunExecute(targetSql);
      }
      return;
    }

    // Tab key indent
    if (e.key === 'Tab' && !popupPos) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newQuery = query.substring(0, start) + '  ' + query.substring(end);
      setQuery(newQuery);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleExecute = () => {
    onRunExecute(getExecutableQuery());
  };

  const handleDryRun = () => {
    onRunDryRun(getExecutableQuery());
  };

  const handleExplain = () => {
    onRunExplain(getExecutableQuery());
  };

  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) {
      setQuery(query ? `${query} ${snippet}` : snippet);
      return;
    }
    const { selectionStart, selectionEnd } = textareaRef.current;
    const newQuery = query.slice(0, selectionStart) + snippet + query.slice(selectionEnd);
    setQuery(newQuery);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = selectionStart + snippet.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
        setCursorPos(nextPos);
      }
    }, 10);
  };

  return (
    <div className="flex flex-col border-b border-border/70 bg-card/40 backdrop-blur-xs relative flex-1 min-h-0 h-full">
      {/* Editor Action Toolbar */}
      <div className="h-10 px-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={!selectedDbId || !query.trim() || isExecuting}
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
            title="Execute query and commit changes (⌘Enter)"
          >
            <Play className="size-3 fill-white" />
            <span>{isExecuting ? 'Running...' : hasSelection ? 'Run Selection' : 'Execute'}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-emerald-700/60 px-1 py-0.2 rounded font-mono">
              ⌘↵
            </kbd>
          </Button>

          {isExecuting && (
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelExecution}
              className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-500 text-white font-medium shadow-xs animate-pulse"
              title="Cancel execution"
            >
              <XCircle className="size-3" />
              <span>Cancel</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleDryRun}
            disabled={!selectedDbId || !query.trim() || isSimulating || isExecuting}
            className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium"
            title="Simulate mutating query in safe rollback transaction sandbox (⌘⇧Enter)"
          >
            <ShieldAlert className="size-3 text-amber-400" />
            <span>{isSimulating ? 'Simulating...' : 'Dry Run'}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-muted px-1 py-0.2 rounded font-mono text-muted-foreground">
              ⌘⇧↵
            </kbd>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExplain}
            disabled={!selectedDbId || !query.trim() || isExplaining || isExecuting}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Analyze query with EXPLAIN QUERY PLAN"
          >
            <Search className="size-3" />
            <span>{isExplaining ? 'Analyzing...' : 'Explain Plan'}</span>
          </Button>

          {hasSelection && (
            <span className="hidden md:inline-flex items-center text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Selection Mode
            </span>
          )}
        </div>

        {/* Quick Snippet Pills & Tools */}
        <div className="hidden lg:flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertSnippet('SELECT * FROM ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            SELECT *
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('COUNT(*) ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            COUNT(*)
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('WHERE ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            WHERE
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('ORDER BY id DESC ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            ORDER BY
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('LIMIT 50;')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            LIMIT 50
          </button>

          <div className="w-px h-3.5 bg-border/60 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={formatSql}
            title="Format SQL query"
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground font-mono"
          >
            <Wand2 className="size-3 text-sky-400" />
            <span>Format</span>
          </Button>

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setQuery('')}
            title="Clear Editor"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <Eraser className="size-3" />
          </Button>
        </div>
      </div>

      {/* Code Textarea & Gutter */}
      <div className="flex flex-1 min-h-[90px] overflow-hidden relative font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div className="w-10 select-none py-2 bg-muted/30 border-r border-border/40 text-muted-foreground/40 text-right pr-2 text-[11px] leading-5 shrink-0 overflow-hidden font-mono">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea Input */}
        <div className="flex-1 relative overflow-auto">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              updateSelectionState();
            }}
            onClick={updateSelectionState}
            onKeyUp={updateSelectionState}
            onSelect={updateSelectionState}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL statement (e.g. SELECT * FROM users WHERE active = 1 ORDER BY id DESC LIMIT 50;)"
            spellCheck={false}
            className="w-full h-full p-2 bg-transparent text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-5 font-mono text-xs select-text"
          />

          {/* Autocomplete Popup */}
          {popupPos && (
            <AutocompletePopup
              items={autocompleteItems}
              selectedIndex={selectedAutoIndex}
              onSelect={handleSelectAutocomplete}
              position={popupPos}
            />
          )}
        </div>
      </div>
    </div>
  );
}
