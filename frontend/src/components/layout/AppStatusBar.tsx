import { Activity, Wifi, Database, Layers, Loader2 } from 'lucide-react';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useAdbStore } from '@/stores/useAdbStore';

export function AppStatusBar() {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const port = useConnectionStore((s) => s.port);
  const host = useConnectionStore((s) => s.host);

  const databases = useDatabaseStore((s) => s.databases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTable = useDatabaseStore((s) => s.selectedTableName);
  const totalRows = useDatabaseStore((s) => s.totalRows);
  const mutations = useDatabaseStore((s) => s.mutations);

  const isInitialLoading = useAdbStore((s) => s.isInitialLoading);
  const isLoadingDevices = useAdbStore((s) => s.isLoadingDevices);
  const isLoadingApps = useAdbStore((s) => s.isLoadingApps);
  const isLoadingDatabases = useAdbStore((s) => s.isLoadingDatabases);
  const discoveryStage = useAdbStore((s) => s.discoveryStage);
  const discoveryMessage = useAdbStore((s) => s.discoveryMessage);

  const isConnecting =
    isInitialLoading ||
    isLoadingDevices ||
    isLoadingApps ||
    isLoadingDatabases ||
    discoveryStage === 'loading_schema';

  const activeDb = databases.find((d) => d.id === selectedDbId);

  return (
    <footer className="h-7 border-t border-border/80 bg-card/80 px-3 flex items-center justify-between text-[11px] text-muted-foreground select-none shrink-0 z-20 font-mono">
      {/* Left items: Server and DB context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Wifi className={`size-3 ${isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`} />
          <span>ws://{host}:{port}/ws</span>
        </div>

        {activeDb && (
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <Database className="size-3 text-primary" />
            <span className="text-foreground font-medium">{activeDb.name}</span>
            <span className="text-[10px] text-muted-foreground">({activeDb.type})</span>
          </div>
        )}

        {selectedTable && (
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <Layers className="size-3 text-sky-400" />
            <span>table: <span className="text-foreground font-medium">{selectedTable}</span></span>
            <span>({totalRows.toLocaleString()} rows)</span>
          </div>
        )}
      </div>

      {/* Right items: Stats & stream health */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Activity className="size-3 text-sky-400" />
          <span>mutations: <strong className="text-foreground">{mutations.length}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
          {isConnecting ? (
            <>
              <Loader2 className="size-3 text-sky-400 animate-spin" />
              <span className="text-sky-400 font-sans text-[10px] truncate max-w-[200px]">
                {discoveryMessage || 'Discovering...'}
              </span>
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 font-sans text-[10px]">Ready</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
