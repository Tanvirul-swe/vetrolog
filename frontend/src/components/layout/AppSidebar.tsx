import { Database, FolderTree } from 'lucide-react';
import { DatabaseTree } from '@/features/databases/components/DatabaseTree';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

interface AppSidebarProps {
  onRefresh?: () => void;
}

export function AppSidebar({}: AppSidebarProps) {
  const databases = useDatabaseStore((s) => s.databases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTableName = useDatabaseStore((s) => s.selectedTableName);
  const selectDatabase = useDatabaseStore((s) => s.selectDatabase);
  const selectTable = useDatabaseStore((s) => s.selectTable);

  return (
    <aside className="w-64 border-r border-border/80 bg-sidebar/50 flex flex-col shrink-0 select-none overflow-hidden h-full">
      {/* Sidebar Section Title */}
      <div className="h-10 border-b border-border/60 px-3 flex items-center justify-between text-xs font-semibold text-muted-foreground bg-card/20">
        <div className="flex items-center gap-2">
          <FolderTree className="size-3.5 text-primary" />
          <span className="uppercase tracking-wider text-[11px] font-bold text-foreground/80">Databases</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
          {databases.length} {databases.length === 1 ? 'store' : 'stores'}
        </span>
      </div>

      {/* Database Tree with scrollable list */}
      <div className="flex-1 overflow-y-auto">
        <DatabaseTree
          databases={databases}
          selectedDatabaseId={selectedDbId}
          selectedTableName={selectedTableName}
          onSelectDatabase={selectDatabase}
          onSelectTable={selectTable}
        />
      </div>

      {/* Bottom device helper */}
      <div className="p-3 border-t border-border/60 bg-card/30 text-[11px] text-muted-foreground flex items-center gap-2">
        <Database className="size-3.5 text-primary shrink-0" />
        <span className="truncate">Auto-detects SQLite & Hive</span>
      </div>
    </aside>
  );
}
