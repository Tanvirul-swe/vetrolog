import { useState } from 'react';
import { Play, Terminal, CheckCircle2, XCircle, Table as TableIcon, History, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp, formatDuration } from '@/lib/formatters';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { CellRenderer } from '@/features/datagrid/components/CellRenderer';

interface QueryEditorProps {
  onExecuteQuery?: (query: string) => void;
}

export function QueryEditor({ onExecuteQuery }: QueryEditorProps) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'result' | 'history'>('result');

  const queryLogs = useDatabaseStore((s) => s.queryLogs);
  const latestResult = useDatabaseStore((s) => s.latestQueryResult);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onExecuteQuery?.(query.trim());
    setViewMode('result');
  };

  const handleRerun = (pastQuery: string) => {
    setQuery(pastQuery);
    onExecuteQuery?.(pastQuery);
    setViewMode('result');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Query Input Bar */}
      <form onSubmit={handleSubmit} className="p-2 border-b border-border/60 bg-muted/20 flex items-center gap-2">
        <Terminal className="size-4 text-primary shrink-0 ml-1" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            selectedDbId ? 'Run query: SELECT * FROM users LIMIT 10;' : 'Select a database first to run queries...'
          }
          disabled={!selectedDbId}
          className="h-8 text-xs font-mono bg-card/60 border-border/60"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!selectedDbId || !query.trim()}
          className="h-8 text-xs gap-1.5 shrink-0"
        >
          <Play className="size-3" />
          <span>Execute</span>
        </Button>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-2">
          <Button
            type="button"
            variant={viewMode === 'result' ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setViewMode('result')}
            title="Show latest query result"
            className="h-7 w-7"
          >
            <TableIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={viewMode === 'history' ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setViewMode('history')}
            title="Show query history"
            className="h-7 w-7"
          >
            <History className="size-3.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (query.trim()) {
                usePlaygroundStore.getState().setQuery(query.trim());
              }
              usePlaygroundStore.getState().setActiveWorkspaceView('playground');
            }}
            title="Open Intelligent SQL Playground with Plan & Profiler"
            className="h-7 text-[11px] gap-1 px-2 border-primary/40 text-primary hover:bg-primary/10 ml-1"
          >
            <Sparkles className="size-3" />
            <span>Playground</span>
          </Button>
        </div>
      </form>

      {/* Viewport Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'result' ? (
          latestResult ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Result Meta Banner */}
              <div className="h-7 border-b border-border/40 px-3 flex items-center justify-between bg-card/60 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  {latestResult.success ? (
                    <Badge variant="success" className="text-[9px] px-1 py-0">
                      SUCCESS
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                      ERROR
                    </Badge>
                  )}
                  <span className="text-muted-foreground truncate max-w-md">{latestResult.query}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{latestResult.rows?.length || 0} rows</span>
                  {latestResult.affected > 0 && <span>{latestResult.affected} affected</span>}
                  <span>in {formatDuration(latestResult.durationMs)}</span>
                </div>
              </div>

              {/* Error banner if query failed */}
              {latestResult.error ? (
                <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{latestResult.error}</span>
                </div>
              ) : latestResult.rows && latestResult.rows.length > 0 ? (
                /* Tabular Result Grid */
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur-xs border-b border-border">
                      <tr>
                        {Object.keys(latestResult.rows[0]).map((col) => (
                          <th key={col} className="px-3 py-1.5 text-muted-foreground font-semibold border-r border-border/30">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {latestResult.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          {Object.keys(latestResult.rows[0]).map((col) => (
                            <td key={col} className="px-3 py-1.5 border-r border-border/20 max-w-xs truncate">
                              <CellRenderer value={r[col]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Query executed successfully with 0 rows returned.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs">
              <Terminal className="size-6 text-muted-foreground/40 mb-2" />
              <p>Execute an ad-hoc query above to inspect returned result sets in real-time.</p>
            </div>
          )
        ) : (
          /* History View */
          <div className="flex-1 overflow-y-auto divide-y divide-border/20 font-mono text-xs p-2">
            {queryLogs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground/60 text-xs font-sans">
                No queries executed yet.
              </div>
            ) : (
              queryLogs.map((q) => (
                <div key={q.id || q.timestamp} className="py-2 flex items-start justify-between gap-2.5 group">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {q.success ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-muted-foreground">{formatTimestamp(q.timestamp)}</span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                          {formatDuration(q.durationMs)}
                        </Badge>
                      </div>
                      <p className="text-foreground text-xs truncate max-w-xl">{q.query}</p>
                      {q.error && <p className="text-red-400 text-[11px] mt-0.5">{q.error}</p>}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRerun(q.query)}
                    className="opacity-0 group-hover:opacity-100 h-6 text-[10px] gap-1 px-2 shrink-0"
                  >
                    <Play className="size-2.5" />
                    <span>Run</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
