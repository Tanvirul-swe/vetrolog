import { useState } from 'react';
import {
  Database,
  ChevronRight,
  ChevronDown,
  Layers,
  HardDrive,
  Smartphone,
  Loader2,
  CheckCircle2,
  Circle,
  RefreshCw,
} from 'lucide-react';
import { DatabaseInfo } from '@/types/database';
import { TableItem } from './TableItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/formatters';
import { useAdbStore } from '@/stores/useAdbStore';

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

  const isInitialLoading = useAdbStore((s) => s.isInitialLoading);
  const discoveryStage = useAdbStore((s) => s.discoveryStage);
  const discoveryMessage = useAdbStore((s) => s.discoveryMessage);
  const isLoadingDevices = useAdbStore((s) => s.isLoadingDevices);
  const isLoadingApps = useAdbStore((s) => s.isLoadingApps);
  const isLoadingDatabases = useAdbStore((s) => s.isLoadingDatabases);
  const devices = useAdbStore((s) => s.devices);
  const selectedDeviceId = useAdbStore((s) => s.selectedDeviceId);
  const apps = useAdbStore((s) => s.apps);
  const selectedPackageName = useAdbStore((s) => s.selectedPackageName);
  const fetchDevices = useAdbStore((s) => s.fetchDevices);
  const selectDevice = useAdbStore((s) => s.selectDevice);
  const refreshDatabases = useAdbStore((s) => s.refreshDatabases);

  const toggleCollapse = (dbId: string) => {
    setCollapsed((prev) => ({ ...prev, [dbId]: !prev[dbId] }));
  };

  const isConnecting =
    isInitialLoading ||
    isLoadingDevices ||
    isLoadingApps ||
    isLoadingDatabases ||
    discoveryStage === 'loading_schema';

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const selectedApp = apps.find((a) => a.packageName === selectedPackageName);

  if (databases.length === 0) {
    if (isConnecting) {
      return (
        <div className="p-3 space-y-3">
          {/* Real-time Discovery Progress Checklist */}
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Loader2 className="size-3.5 animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">Discovering Databases</div>
                <div className="text-[10px] text-muted-foreground truncate font-mono">
                  {discoveryMessage || 'Probing device pipeline...'}
                </div>
              </div>
            </div>

            {/* Step-by-Step Progress Pipeline */}
            <div className="space-y-1.5 pt-2 border-t border-border/40 text-[11px]">
              {/* Step 1: Device */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {selectedDeviceId ? (
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                  ) : isLoadingDevices || discoveryStage === 'scanning_devices' ? (
                    <Loader2 className="size-3 text-sky-400 animate-spin shrink-0" />
                  ) : (
                    <Circle className="size-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={selectedDeviceId ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    Device
                  </span>
                </span>
                <span className="text-[10px] font-mono truncate max-w-[110px] text-muted-foreground/80">
                  {selectedDevice ? selectedDevice.model : isLoadingDevices ? 'Scanning...' : 'Pending'}
                </span>
              </div>

              {/* Step 2: Debug App */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {selectedPackageName ? (
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                  ) : isLoadingApps || discoveryStage === 'scanning_apps' ? (
                    <Loader2 className="size-3 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <Circle className="size-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={selectedPackageName ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    Debug App
                  </span>
                </span>
                <span className="text-[10px] font-mono truncate max-w-[110px] text-muted-foreground/80">
                  {selectedApp ? selectedApp.displayName : isLoadingApps ? 'Scanning...' : 'Pending'}
                </span>
              </div>

              {/* Step 3: Database Extraction */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {isLoadingDatabases || discoveryStage === 'discovering_databases' ? (
                    <Loader2 className="size-3 text-primary animate-spin shrink-0" />
                  ) : discoveryStage === 'loading_schema' ? (
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="size-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={
                      isLoadingDatabases || discoveryStage === 'loading_schema'
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    Extraction
                  </span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/80">
                  {isLoadingDatabases ? 'Extracting...' : discoveryStage === 'loading_schema' ? 'Extracted' : 'Pending'}
                </span>
              </div>

              {/* Step 4: Schema Sync */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {discoveryStage === 'loading_schema' ? (
                    <Loader2 className="size-3 text-sky-400 animate-spin shrink-0" />
                  ) : (
                    <Circle className="size-3 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={discoveryStage === 'loading_schema' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    Schema Sync
                  </span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/80">
                  {discoveryStage === 'loading_schema' ? 'Syncing...' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Shimmering Skeleton Database Placeholders */}
          <div className="space-y-2 opacity-75">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
              Loading Stores...
            </div>
            {/* Skeleton DB Card 1 */}
            <div className="rounded-lg border border-border/40 bg-card/30 p-2.5 space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-muted/80" />
                  <div className="h-3 w-24 rounded bg-muted/80" />
                </div>
                <div className="h-4 w-12 rounded bg-muted/60" />
              </div>
              <div className="pl-6 space-y-1.5 pt-0.5">
                <div className="h-2.5 w-32 rounded bg-muted/50" />
                <div className="h-2.5 w-20 rounded bg-muted/40" />
              </div>
            </div>
            {/* Skeleton DB Card 2 */}
            <div className="rounded-lg border border-border/30 bg-card/20 p-2.5 space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-4 rounded bg-muted/60" />
                  <div className="h-3 w-20 rounded bg-muted/60" />
                </div>
                <div className="h-4 w-10 rounded bg-muted/40" />
              </div>
              <div className="pl-6 space-y-1.5 pt-0.5">
                <div className="h-2.5 w-28 rounded bg-muted/40" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (discoveryStage === 'no_devices' || (!selectedDeviceId && devices.length === 0)) {
      return (
        <div className="p-3 text-center text-xs flex flex-col items-center justify-center h-56 border border-dashed border-border/70 rounded-lg m-2 bg-card/20 space-y-2.5">
          <div className="size-9 rounded-lg bg-muted/80 border border-border flex items-center justify-center text-muted-foreground">
            <Smartphone className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">No Device Connected</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px] leading-relaxed">
              Connect an Android device via USB or start an emulator with USB debugging enabled.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDevices()}
            className="h-7 text-xs gap-1.5 border-border/80 hover:bg-muted"
          >
            <RefreshCw className="size-3" />
            <span>Scan Devices</span>
          </Button>
        </div>
      );
    }

    if (discoveryStage === 'no_apps' || (selectedDeviceId && apps.length === 0)) {
      return (
        <div className="p-3 text-center text-xs flex flex-col items-center justify-center h-56 border border-dashed border-border/70 rounded-lg m-2 bg-card/20 space-y-2.5">
          <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Layers className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">No Debug App Running</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px] leading-relaxed">
              Launch your debuggable Android or Flutter app on {selectedDevice?.model || 'the device'}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedDeviceId && selectDevice(selectedDeviceId)}
            className="h-7 text-xs gap-1.5 border-border/80 hover:bg-muted"
          >
            <RefreshCw className="size-3" />
            <span>Rescan Apps</span>
          </Button>
        </div>
      );
    }

    return (
      <div className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-48 border border-dashed border-border/60 rounded-lg m-2 space-y-2">
        <Database className="size-6 text-muted-foreground/40 animate-pulse" />
        <div>
          <p className="font-medium text-foreground/80">No Databases Detected</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            No SQLite, Hive, or SharedPreferences found in this app sandbox.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshDatabases()}
          className="h-7 text-xs gap-1.5 border-border/80 hover:bg-muted mt-1"
        >
          <RefreshCw className="size-3" />
          <span>Refresh Stores</span>
        </Button>
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
