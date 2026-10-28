import { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Table as TableIcon,
  Eye,
  Server,
  FolderOpen,
  Search,
  Power,
  ChevronDown,
  Layers,
  Activity,
  Plus,
  Play,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

interface RemoteDatabaseTreeProps {
  onOpenConnectionManager: () => void;
  onOpenLocalFileDialog: () => void;
}

const ENGINE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  redis: 'Redis',
  sqlite: 'SQLite',
  mssql: 'SQL Server',
};

export function RemoteDatabaseTree({
  onOpenConnectionManager,
  onOpenLocalFileDialog,
}: RemoteDatabaseTreeProps) {
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const disconnect = useConnectionManagerStore((s) => s.disconnect);
  const remoteDatabases = useConnectionManagerStore((s) => s.remoteDatabases);
  const selectedDatabase = useConnectionManagerStore((s) => s.selectedDatabase);
  const selectDatabase = useConnectionManagerStore((s) => s.selectDatabase);
  const remoteSchemas = useConnectionManagerStore((s) => s.remoteSchemas);
  const selectedSchema = useConnectionManagerStore((s) => s.selectedSchema);
  const selectSchema = useConnectionManagerStore((s) => s.selectSchema);
  const remoteTables = useConnectionManagerStore((s) => s.remoteTables);
  const selectedTable = useConnectionManagerStore((s) => s.selectedTable);
  const selectTable = useConnectionManagerStore((s) => s.selectTable);
  const activeRemoteView = useConnectionManagerStore((s) => s.activeRemoteView);
  const setActiveRemoteView = useConnectionManagerStore((s) => s.setActiveRemoteView);
  const savedConnections = useConnectionManagerStore((s) => s.savedConnections);
  const loadSavedConnections = useConnectionManagerStore((s) => s.loadSavedConnections);
  const connect = useConnectionManagerStore((s) => s.connect);
  const openLocalFile = useConnectionManagerStore((s) => s.openLocalFile);
  const isConnecting = useConnectionManagerStore((s) => s.isConnecting);

  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);
  const openTableInPlayground = usePlaygroundStore((s) => s.openTableInPlayground);

  const [tableFilter, setTableFilter] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  const filteredTables = useMemo(() => {
    if (!remoteTables) return [];
    if (!tableFilter.trim()) return remoteTables;
    const q = tableFilter.toLowerCase().trim();
    return remoteTables.filter((t) => t.name.toLowerCase().includes(q));
  }, [remoteTables, tableFilter]);

  const handleTableClick = (tableName: string) => {
    selectTable(tableName);
    if (activeWorkspaceView === 'playground') {
      openTableInPlayground(tableName);
    }
  };

  if (!activeSession) {
    if (savedConnections.length > 0) {
      return (
        <div className="flex-1 flex flex-col overflow-hidden bg-card/20 select-none">
          <div className="p-3 border-b border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Server className="size-3.5 text-primary" />
              <span>Saved Connections</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpenConnectionManager}
              className="size-6 text-muted-foreground hover:text-foreground"
              title="New Connection / Manage"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {savedConnections.map((conn) => {
              const isThisConnecting = isConnecting && connectingId === conn.id;

              return (
                <div
                  key={conn.id}
                  className="group p-2 rounded-lg border border-border/60 hover:border-primary/50 bg-background/50 hover:bg-muted/40 transition-all flex items-center justify-between gap-2"
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={async () => {
                      setConnectingId(conn.id);
                      try {
                        if (conn.engine === 'sqlite' && conn.filePath) {
                          await openLocalFile(conn.filePath);
                        } else {
                          await connect(conn.id);
                        }
                      } finally {
                        setConnectingId(null);
                      }
                    }}
                    title="Click to connect"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate">
                        {conn.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                      {conn.engine.toUpperCase()} · {conn.engine === 'sqlite' ? conn.filePath || conn.database : `${conn.host}:${conn.port}`}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isConnecting}
                    onClick={async () => {
                      setConnectingId(conn.id);
                      try {
                        if (conn.engine === 'sqlite' && conn.filePath) {
                          await openLocalFile(conn.filePath);
                        } else {
                          await connect(conn.id);
                        }
                      } finally {
                        setConnectingId(null);
                      }
                    }}
                    className="h-6 text-[10px] px-2 gap-1 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 shrink-0 font-medium"
                  >
                    {isThisConnecting ? (
                      <Loader2 className="size-2.5 animate-spin" />
                    ) : (
                      <Play className="size-2.5 fill-current" />
                    )}
                    <span>Connect</span>
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-border/70 space-y-1.5 bg-background/40">
            <Button
              variant="default"
              size="sm"
              onClick={onOpenConnectionManager}
              className="w-full h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Server className="size-3" />
              <span>Manage Connections...</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenLocalFileDialog}
              className="w-full h-7 text-xs gap-1.5 border-dashed border-border/80 hover:bg-muted"
            >
              <FolderOpen className="size-3 text-amber-400" />
              <span>Open .sqlite File</span>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center select-none space-y-3">
        <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Server className="size-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-foreground">No Remote Session</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Connect to PostgreSQL, MySQL, Redis, or open a local .sqlite file.
          </p>
        </div>
        <div className="w-full space-y-1.5 pt-1">
          <Button
            variant="default"
            size="sm"
            onClick={onOpenConnectionManager}
            className="w-full h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <Server className="size-3" />
            <span>Connect to DB...</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLocalFileDialog}
            className="w-full h-7 text-xs gap-1.5 border-dashed border-border/80 hover:bg-muted"
          >
            <FolderOpen className="size-3 text-amber-400" />
            <span>Open .sqlite File</span>
          </Button>
        </div>
      </div>
    );
  }

  const isRedis = activeSession.config.engine === 'redis';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Session Header Card */}
      <div className="p-2.5 border-b border-border/70 bg-card/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold text-xs text-foreground truncate">
              {activeSession.config.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={disconnect}
            className="text-muted-foreground hover:text-rose-400 size-6"
            title="Disconnect session"
          >
            <Power className="size-3" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span className="uppercase font-semibold text-primary">
            {ENGINE_LABELS[activeSession.config.engine] || activeSession.config.engine}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-muted border border-border">
            {activeSession.pingDurationMs ? `${activeSession.pingDurationMs}ms` : 'Ready'}
          </span>
        </div>

        {/* Database & Schema Selectors (for SQL engines) */}
        {!isRedis && (
          <div className="space-y-1.5 pt-1">
            {remoteDatabases.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">DB:</span>
                <select
                  value={selectedDatabase}
                  onChange={(e) => selectDatabase(e.target.value)}
                  className="w-full h-6 text-[11px] font-mono rounded border border-border bg-background px-1.5 text-foreground"
                >
                  {remoteDatabases.map((db) => (
                    <option key={db} value={db}>
                      {db}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {remoteSchemas.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">Schema:</span>
                <select
                  value={selectedSchema}
                  onChange={(e) => selectSchema(e.target.value)}
                  className="w-full h-6 text-[11px] font-mono rounded border border-border bg-background px-1.5 text-foreground"
                >
                  {remoteSchemas.map((sch) => (
                    <option key={sch} value={sch}>
                      {sch}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Redis Special Navigation */}
      {isRedis ? (
        <div className="flex-1 p-3 space-y-2">
          <div
            onClick={() => setActiveRemoteView('redis')}
            className="flex items-center gap-2 p-2 rounded-lg border border-primary/40 bg-primary/10 text-primary cursor-pointer text-xs font-semibold"
          >
            <Activity className="size-3.5" />
            <span>Redis Studio Browser</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Search keys, inspect TTLs, view data types (String, Hash, List, Set), and edit payloads in real-time.
          </p>
        </div>
      ) : (
        /* SQL Tables & Views List */
        <>
          {/* Table Search */}
          <div className="p-2 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2 top-2 size-3 text-muted-foreground" />
              <Input
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter tables..."
                className="pl-6 h-7 text-xs bg-muted/20"
              />
            </div>
          </div>

          {/* Table items */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-xs">
            {filteredTables.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No tables found in {selectedSchema || 'database'}.
              </div>
            ) : (
              filteredTables.map((tbl) => {
                const isSelected = selectedTable === tbl.name;
                const isView = tbl.type === 'VIEW';

                return (
                  <button
                    key={tbl.name}
                    type="button"
                    onClick={() => handleTableClick(tbl.name)}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '30px' }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/20 text-foreground font-semibold border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {isView ? (
                        <Eye className="size-3 text-sky-400 shrink-0" />
                      ) : (
                        <TableIcon className="size-3 text-primary shrink-0" />
                      )}
                      <span className="truncate">{tbl.name}</span>
                    </div>

                    <span
                      className="text-[10px] text-muted-foreground font-sans shrink-0 ml-1"
                      title={tbl.isRowCountEstimated ? 'Estimated count from catalog statistics' : undefined}
                    >
                      {tbl.rowCount >= 0 ? `${tbl.isRowCountEstimated ? '~' : ''}${tbl.rowCount.toLocaleString()}` : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border/70 bg-card/30 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenConnectionManager}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground w-full justify-center"
        >
          <Server className="size-3" />
          <span>Switch Connection...</span>
        </Button>
      </div>
    </div>
  );
}
