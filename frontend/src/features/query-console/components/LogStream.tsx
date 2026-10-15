import { Play, Pause, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatTimestamp, formatDuration } from '@/lib/formatters';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function LogStream() {
  const mutations = useDatabaseStore((s) => s.mutations);
  const clearLogs = useDatabaseStore((s) => s.clearLogs);
  const livePaused = useSettingsStore((s) => s.liveStreamPaused);
  const togglePause = useSettingsStore((s) => s.toggleLiveStreamPause);

  const getMutationBadge = (type: string) => {
    switch (type) {
      case 'INSERT':
        return <Badge variant="success" className="text-[10px] font-mono px-1.5 py-0">INSERT</Badge>;
      case 'UPDATE':
        return <Badge variant="info" className="text-[10px] font-mono px-1.5 py-0">UPDATE</Badge>;
      case 'DELETE':
        return <Badge variant="destructive" className="text-[10px] font-mono px-1.5 py-0">DELETE</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{type}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Console Subheader */}
      <div className="h-8 border-b border-border/60 px-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/20 select-none">
        <div className="flex items-center gap-2">
          <span>Live Mutation Stream</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
            {mutations.length} events
          </span>
          {livePaused && (
            <Badge variant="warning" className="text-[9px] px-1 py-0">PAUSED</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePause}
            className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            {livePaused ? <Play className="size-3 text-emerald-400" /> : <Pause className="size-3 text-amber-400" />}
            <span>{livePaused ? 'Resume' : 'Pause'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearLogs}
            className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Stream list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20 font-mono text-xs p-1">
        {mutations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground/60 text-xs font-sans">
            No database mutations observed yet. Mutations from your mobile app appear here in real-time.
          </div>
        ) : (
          mutations.map((m) => (
            <div key={m.id || m.timestamp} className="p-2 hover:bg-muted/30 transition-colors flex items-start gap-3">
              <span className="text-muted-foreground/50 text-[10px] shrink-0 pt-0.5">
                {formatTimestamp(m.timestamp)}
              </span>

              {getMutationBadge(m.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-foreground font-semibold text-xs">{m.tableName}</span>
                  {m.durationMs !== undefined && m.durationMs > 0 && (
                    <span className="text-[10px] text-muted-foreground/70">
                      in {formatDuration(m.durationMs)}
                    </span>
                  )}
                  {m.affected > 0 && (
                    <span className="text-[10px] text-muted-foreground/70">
                      ({m.affected} {m.affected === 1 ? 'row' : 'rows'} affected)
                    </span>
                  )}
                </div>

                {/* Query string if present */}
                {m.query && (
                  <p className="text-[11px] text-muted-foreground truncate mb-1">
                    {m.query}
                  </p>
                )}

                {/* Values diff */}
                {m.newValues && (
                  <div className="text-[11px] text-amber-300/90 truncate flex items-center gap-1.5 bg-card/60 p-1 rounded border border-border/40">
                    <ArrowRight className="size-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{JSON.stringify(m.newValues)}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
