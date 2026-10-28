import { FolderTree, Database, Loader2, Globe } from 'lucide-react';
import { DatabaseTree } from '@/features/databases/components/DatabaseTree';
import { RemoteDatabaseTree } from '@/features/databases/components/RemoteDatabaseTree';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useAdbStore } from '@/stores/useAdbStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface AppSidebarProps {
  onRefresh?: () => void;
  onOpenConnectionManager: () => void;
  onOpenLocalFileDialog: () => void;
}

export function AppSidebar({
  onOpenConnectionManager,
  onOpenLocalFileDialog,
}: AppSidebarProps) {
  const databases = useDatabaseStore((s) => s.databases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTableName = useDatabaseStore((s) => s.selectedTableName);
  const selectDatabase = useDatabaseStore((s) => s.selectDatabase);
  const selectTable = useDatabaseStore((s) => s.selectTable);
  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);
  const openTableInPlayground = usePlaygroundStore((s) => s.openTableInPlayground);

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);

  const isInitialLoading = useAdbStore((s) => s.isInitialLoading);
  const isLoadingDevices = useAdbStore((s) => s.isLoadingDevices);
  const isLoadingApps = useAdbStore((s) => s.isLoadingApps);
  const isLoadingDatabases = useAdbStore((s) => s.isLoadingDatabases);
  const isBusy = isInitialLoading || isLoadingDevices || isLoadingApps || isLoadingDatabases;

  const handleSelectTable = (tableName: string) => {
    selectTable(tableName);
    if (activeWorkspaceView === 'playground') {
      openTableInPlayground(tableName);
    }
  };

  return (
    <aside className="w-64 border-r border-border/80 bg-sidebar/50 flex flex-col shrink-0 select-none overflow-hidden h-full">
      {/* Sidebar Section Title */}
      <div className="h-10 border-b border-border/60 px-3 flex items-center justify-between text-xs font-semibold text-muted-foreground bg-card/20 shrink-0">
        <div className="flex items-center gap-2">
          {workspaceMode === 'remote' ? (
            <Globe className="size-3.5 text-primary" />
          ) : (
            <FolderTree className="size-3.5 text-primary" />
          )}
          <span className="uppercase tracking-wider text-[11px] font-bold text-foreground/80">
            {workspaceMode === 'remote' ? 'Remote & Files' : 'Mobile Databases'}
          </span>
        </div>

        {workspaceMode === 'mobile' ? (
          isBusy && databases.length === 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1 border border-primary/20">
              <Loader2 className="size-2.5 animate-spin" />
              <span>scanning</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
              {databases.length} {databases.length === 1 ? 'store' : 'stores'}
            </span>
          )
        ) : (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Remote
          </span>
        )}
      </div>

      {/* Main tree content depending on workspace mode */}
      {workspaceMode === 'remote' ? (
        <RemoteDatabaseTree
          onOpenConnectionManager={onOpenConnectionManager}
          onOpenLocalFileDialog={onOpenLocalFileDialog}
        />
      ) : (
        <>
          {/* Database Tree with scrollable list */}
          <div className="flex-1 overflow-y-auto">
            <DatabaseTree
              databases={databases}
              selectedDatabaseId={selectedDbId}
              selectedTableName={selectedTableName}
              onSelectDatabase={selectDatabase}
              onSelectTable={handleSelectTable}
            />
          </div>

          {/* Bottom device helper */}
          <div className="p-3 border-t border-border/60 bg-card/30 text-[11px] text-muted-foreground flex items-center gap-2 shrink-0">
            <Database className="size-3.5 text-primary shrink-0" />
            <span className="truncate">Auto-detects SQLite & Hive</span>
          </div>
        </>
      )}
    </aside>
  );
}
