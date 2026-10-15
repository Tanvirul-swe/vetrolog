import { useState } from 'react';
import { Play, Terminal, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp, formatDuration } from '@/lib/formatters';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

interface QueryEditorProps {
  onExecuteQuery?: (query: string) => void;
}

export function QueryEditor({ onExecuteQuery }: QueryEditorProps) {
  const [query, setQuery] = useState('');
  const queryLogs = useDatabaseStore((s) => s.queryLogs);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onExecuteQuery?.(query.trim());
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
      </form>

      {/* Query History Log */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20 font-mono text-xs p-2">
        {queryLogs.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground/60 text-xs font-sans">
            Query history and execution metrics will appear here.
          </div>
        ) : (
          queryLogs.map((q) => (
            <div key={q.id || q.timestamp} className="py-2 flex items-start gap-2.5">
              {q.success ? (
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatTimestamp(q.timestamp)}</span>
                  <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                    {formatDuration(q.durationMs)}
                  </Badge>
                </div>
                <p className="text-foreground text-xs">{q.query}</p>
                {q.error && <p className="text-red-400 text-[11px] mt-0.5">{q.error}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
