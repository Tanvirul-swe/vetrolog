import { useState } from 'react';
import { Database, ChevronRight, ChevronDown, Layers, HardDrive } from 'lucide-react';
import { DatabaseInfo } from '@/types/database';
import { TableItem } from './TableItem';
import { Badge } from '@/components/ui/badge';
import { formatBytes } from '@/lib/formatters';

interface DatabaseTreeProps {
  databases: DatabaseInfo[];
  selectedDatabaseId: string | null;
  selectedTableName: string | null;
  onSelectDatabase: (dbId: string) => void;
  onSelectTable: (tableName: string) => void;
}

export function DatabaseTree({
  databases,
  selectedDatabaseId,
  selectedTableName,
  onSelectDatabase,
  onSelectTable,
}: DatabaseTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (dbId: string) => {
    setCollapsed((prev) => ({ ...prev, [dbId]: !prev[dbId] }));
  };

  if (databases.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-48 border border-dashed border-border/60 rounded-lg m-2">
        <Database className="size-6 mb-2 text-muted-foreground/40 animate-pulse" />
        <p className="font-medium text-foreground/80">No Databases Detected</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Connect your mobile app to automatically discover SQLite, Hive, & SharedPreferences.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2">
      {databases.map((db) => {
        const isSelectedDb = db.id === selectedDatabaseId;
        const isCollapsed = !!collapsed[db.id];

        const getBadgeColor = () => {
          switch (db.type) {
            case 'sqlite':
              return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
            case 'hive':
              return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'shared_preferences':
              return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            default:
              return 'bg-muted text-muted-foreground';
          }
        };

        return (
          <div key={db.id} className="rounded-lg border border-border/40 bg-card/40 overflow-hidden">
            {/* Database header */}
            <div
              onClick={() => {
                onSelectDatabase(db.id);
                toggleCollapse(db.id);
              }}
              className={`flex items-center justify-between p-2 cursor-pointer transition-colors ${
                isSelectedDb ? 'bg-primary/10 border-b border-border/60' : 'hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                )}
                <HardDrive className={`size-4 ${isSelectedDb ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="truncate">
                  <div className="text-xs font-semibold text-foreground truncate">{db.name}</div>
                  {db.sizeBytes > 0 && (
                    <div className="text-[10px] text-muted-foreground font-mono">{formatBytes(db.sizeBytes)}</div>
                  )}
                </div>
              </div>

              <Badge variant="outline" className={`text-[10px] uppercase font-mono px-1.5 py-0 ${getBadgeColor()}`}>
                {db.type === 'shared_preferences' ? 'Prefs' : db.type}
              </Badge>
            </div>

            {/* Tables list */}
            {!isCollapsed && (
              <div className="p-1.5 space-y-0.5">
                {db.tables.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground/60 px-3 py-2 italic flex items-center gap-1.5">
                    <Layers className="size-3" /> No tables or boxes
                  </div>
                ) : (
                  db.tables.map((t) => (
                    <TableItem
                      key={t.name}
                      table={t}
                      isSelected={isSelectedDb && selectedTableName === t.name}
                      onSelect={() => {
                        if (selectedDatabaseId !== db.id) {
                          onSelectDatabase(db.id);
                        }
                        onSelectTable(t.name);
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
