import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Database,
  Key,
  Smartphone,
  Layers,
  HardDrive,
  Activity,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Server,
  FolderOpen,
} from 'lucide-react';
import { CellRenderer } from './CellRenderer';
import { GridToolbar } from './GridToolbar';
import { RowDetailSheet } from './RowDetailSheet';
import { TableStructureView } from '@/features/structure/TableStructureView';
import { Button } from '@/components/ui/button';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useAdbStore } from '@/stores/useAdbStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { useStagedChangesStore } from '@/stores/useStagedChangesStore';

interface DataGridProps {
  onRefresh?: () => void;
  onRequestPage?: (page: number) => void;
  onUpdateRow?: (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => void;
  onDeleteRow?: (pkField: string, pkValue: unknown) => void;
  onOpenConnectionManager?: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataGrid({
  onRefresh,
  onRequestPage,
  onUpdateRow,
  onDeleteRow,
  onOpenConnectionManager,
}: DataGridProps) {
  const mobileSelectedTable = useDatabaseStore((s) => s.selectedTableName);
  const databases = useDatabaseStore((s) => s.databases);
  const columns = useDatabaseStore((s) => s.columns);
  const rows = useDatabaseStore((s) => s.rows);
  const filterTerm = useDatabaseStore((s) => s.filterTerm);
  const selectedRow = useDatabaseStore((s) => s.selectedRow);
  const setSelectedRow = useDatabaseStore((s) => s.setSelectedRow);
  const isLoadingTable = useDatabaseStore((s) => s.isLoadingTable);
  const page = useDatabaseStore((s) => s.page);
  const pageSize = useDatabaseStore((s) => s.pageSize);

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const remoteSelectedTable = useConnectionManagerStore((s) => s.selectedTable);
  const selectedTable = workspaceMode === 'remote' ? (remoteSelectedTable || mobileSelectedTable) : mobileSelectedTable;
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const activeRemoteView = useConnectionManagerStore((s) => s.activeRemoteView);
  const tableSchema = useConnectionManagerStore((s) => s.tableSchema);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);

  const pendingChanges = useStagedChangesStore((s) => s.pendingChanges);

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

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (colName: string) => {
    if (sortColumn !== colName) {
      setSortColumn(colName);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortColumn(null);
      setSortDir(null);
    }
  };

  // Filter and sort rows
  const displayRows = useMemo(() => {
    let result = [...rows];

    // Filter by search term
    if (filterTerm.trim()) {
      const query = filterTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(query);
          return String(val).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortColumn && sortDir) {
      result.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rows, filterTerm, sortColumn, sortDir]);

  // Derive column list from payload or rows
  const tableColumns = useMemo(() => {
    if (columns.length > 0) return columns;
    if (rows.length > 0) {
      return Object.keys(rows[0]).map((key) => ({
        name: key,
        type: typeof rows[0][key],
        isPrimaryKey: key.toLowerCase() === 'id' || key.toLowerCase().endsWith('_id'),
        isNullable: true,
      }));
    }
    return [];
  }, [columns, rows]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const selectedApp = apps.find((a) => a.packageName === selectedPackageName);

  const isConnecting =
    isInitialLoading ||
    isLoadingDevices ||
    isLoadingApps ||
    isLoadingDatabases ||
    isLoadingTable ||
    discoveryStage === 'loading_schema';

  const progressPercent = useMemo(() => {
    switch (discoveryStage) {
      case 'scanning_devices':
        return 25;
      case 'scanning_apps':
        return 50;
      case 'discovering_databases':
        return 75;
      case 'loading_schema':
        return 90;
      case 'ready':
        return 100;
      default:
        return isInitialLoading ? 35 : 10;
    }
  }, [discoveryStage, isInitialLoading]);

  if (workspaceMode === 'remote') {
    if (!activeSession) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-background">
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
            <Server className="size-6" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Remote Database Studio</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mb-4">
            Connect to PostgreSQL, MySQL, Redis, or open a local .sqlite file with professional-grade inspection.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onOpenConnectionManager}
              className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Server className="size-3.5" />
              <span>Connect to Database</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectLocalFileDialog()}
              className="h-8 text-xs gap-1.5 border-dashed border-border/80 hover:bg-muted"
            >
              <FolderOpen className="size-3.5 text-amber-400" />
              <span>Open Local .sqlite</span>
            </Button>
          </div>
        </div>
      );
    }

    if (!selectedTable) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-background">
          <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2.5">
            <Database className="size-5" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">No Table Selected</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Select a table or view from the left sidebar to inspect records or visual schema.
          </p>
        </div>
      );
    }

    if (activeRemoteView === 'structure') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <GridToolbar onRefresh={onRefresh} onRequestPage={onRequestPage} />
          <TableStructureView schema={tableSchema} tableName={selectedTable} />
        </div>
      );
    }
  }

  if (!selectedTable) {
    if (isConnecting) {
      return (
        <div className="flex-1 flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 select-none bg-background/50 relative overflow-y-auto">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Connection Progress Dashboard Card */}
          <div className="relative max-w-lg w-full bg-card/75 backdrop-blur-md border border-border/80 rounded-2xl p-5 shadow-xl space-y-4 text-center my-auto">
            {/* Pulsing Concentric Rings Icon */}
            <div className="relative inline-flex items-center justify-center">
              <span className="absolute size-16 rounded-full bg-primary/15 animate-ping duration-1000" />
              <span className="absolute size-12 rounded-full bg-primary/20" />
              <div className="relative size-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
                <Database className="size-5 animate-pulse" />
              </div>
            </div>

            {/* Main Stage Heading & Live Message */}
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                {discoveryStage === 'scanning_devices' && 'Detecting Android Device...'}
                {discoveryStage === 'scanning_apps' && 'Scanning Running Debug Apps...'}
                {discoveryStage === 'discovering_databases' && 'Extracting Mobile Databases...'}
                {(discoveryStage === 'loading_schema' || isLoadingTable) && 'Loading Tables & Schema...'}
                {!['scanning_devices', 'scanning_apps', 'discovering_databases', 'loading_schema'].includes(
                  discoveryStage
                ) && 'Connecting to Mobile Database...'}
              </h2>
              <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-mono text-[11px] truncate max-w-sm">
                  {discoveryMessage || 'Probing device ADB pipeline...'}
                </span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                <span className="flex items-center gap-1">
                  <Loader2 className="size-2.5 animate-spin text-primary" />
                  <span>Pipeline Auto-Discovery</span>
                </span>
                <span className="text-foreground font-semibold">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-primary to-emerald-400 transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4 Connected Pipeline Step Cards */}
            <div className="grid grid-cols-2 gap-2 text-left">
              {/* Step 1: Device */}
              <div className="p-2 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-2">
                <Smartphone className="size-3.5 text-sky-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-foreground truncate flex items-center gap-1">
                    <span>1. Device</span>
                    {selectedDeviceId && <CheckCircle2 className="size-2.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate font-mono">
                    {selectedDevice ? selectedDevice.model : isLoadingDevices ? 'Scanning...' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Step 2: Debug App */}
              <div className="p-2 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-2">
                <Layers className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-foreground truncate flex items-center gap-1">
                    <span>2. Debug App</span>
                    {selectedPackageName && <CheckCircle2 className="size-2.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate font-mono">
                    {selectedApp ? selectedApp.displayName : isLoadingApps ? 'Scanning...' : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Step 3: Databases */}
              <div className="p-2 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-2">
                <HardDrive className="size-3.5 text-purple-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-foreground truncate flex items-center gap-1">
                    <span>3. Databases</span>
                    {databases.length > 0 && <CheckCircle2 className="size-2.5 text-emerald-400 shrink-0" />}
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate font-mono">
                    {isLoadingDatabases
                      ? 'Extracting...'
                      : databases.length > 0
                        ? `${databases.length} store${databases.length > 1 ? 's' : ''}`
                        : 'Pending'}
                  </div>
                </div>
              </div>

              {/* Step 4: Tables & Schema */}
              <div className="p-2 rounded-lg border border-border/60 bg-muted/20 flex items-start gap-2">
                <Activity className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-foreground truncate">4. Schema</div>
                  <div className="text-[9px] text-muted-foreground truncate font-mono">
                    {discoveryStage === 'loading_schema' || isLoadingTable ? 'Syncing...' : 'Ready'}
                  </div>
                </div>
              </div>
            </div>

            {/* Contextual Info */}
            <div className="pt-1.5 border-t border-border/40 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
              <Sparkles className="size-3 text-primary shrink-0" />
              <span>VetroLog discovers SQLite, Hive, & SharedPreferences directly via ADB without SDK code.</span>
            </div>
          </div>
        </div>
      );
    }

    if (discoveryStage === 'no_devices' || (!selectedDeviceId && devices.length === 0)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-3 select-none bg-background/50 relative overflow-y-auto">
          <div className="max-w-sm w-full bg-card/75 backdrop-blur-md border border-border/80 rounded-xl p-4 shadow-xl space-y-3 text-center">
            <div className="size-8 rounded-lg bg-muted/80 border border-border flex items-center justify-center text-muted-foreground mx-auto">
              <Smartphone className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">No Android Device Detected</h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                Connect an Android device via USB or start an emulator to begin inspecting.
              </p>
            </div>
            <div className="space-y-1 text-left bg-muted/20 rounded-md p-2 text-[10.5px] text-muted-foreground border border-border/60">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-foreground">1.</span>
                <span>Plug phone via USB cable or launch an Android emulator.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-foreground">2.</span>
                <span>Ensure <strong>Developer Options</strong> & <strong>USB Debugging</strong> are on.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-foreground">3.</span>
                <span>Accept <strong>&quot;Allow USB debugging&quot;</strong> prompt on screen.</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDevices()}
              className="w-full gap-1.5 border-border/80 hover:bg-muted h-7 text-xs"
            >
              <RefreshCw className="size-3" />
              <span>Scan for Connected Devices</span>
            </Button>
          </div>
        </div>
      );
    }

    if (discoveryStage === 'no_apps' || (selectedDeviceId && apps.length === 0)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-3 select-none bg-background/50 relative overflow-y-auto">
          <div className="max-w-sm w-full bg-card/75 backdrop-blur-md border border-border/80 rounded-xl p-4 shadow-xl space-y-3 text-center">
            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Layers className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">Waiting for Debuggable App</h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                Connected to {selectedDevice?.model || 'device'}. No debuggable apps found running.
              </p>
            </div>
            <div className="space-y-1 text-left bg-muted/20 rounded-md p-2 text-[10.5px] text-muted-foreground border border-border/60">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-foreground">1.</span>
                <span>Launch your Flutter or Android app in <strong>debug</strong> mode on the device.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-foreground">2.</span>
                <span>VetroLog will automatically detect running packages and extract database files.</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedDeviceId && selectDevice(selectedDeviceId)}
              className="w-full gap-1.5 border-border/80 hover:bg-muted h-7 text-xs"
            >
              <RefreshCw className="size-3" />
              <span>Rescan Running Apps</span>
            </Button>
          </div>
        </div>
      );
    }

    if (databases.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-3 select-none bg-background/50 relative overflow-y-auto">
          <div className="max-w-sm w-full bg-card/75 backdrop-blur-md border border-border/80 rounded-xl p-4 shadow-xl space-y-3 text-center">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
              <Database className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-xs sm:text-sm">No Databases Found</h3>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                No SQLite (*.db), Hive (*.hive), or SharedPreferences files found in app sandbox yet.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshDatabases()}
              className="w-full gap-1.5 border-border/80 hover:bg-muted h-7 text-xs"
            >
              <RefreshCw className="size-3" />
              <span>Refresh App Databases</span>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-background">
        <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2.5">
          <Database className="size-5" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No Table Selected</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Select a table or box from the left sidebar to inspect rows in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
      <GridToolbar onRefresh={onRefresh} onRequestPage={onRequestPage} />

      <div className="flex-1 flex overflow-hidden">
        {/* Table Viewport */}
        <div className="flex-1 overflow-auto">
          {tableColumns.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <p>No rows or schema found in table &quot;{selectedTable}&quot;.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-mono select-text">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-xs z-10 border-b border-border shadow-xs">
                <tr>
                  <th className="w-12 px-3 py-2 text-muted-foreground/60 text-[10px] uppercase font-bold tracking-wider text-center border-r border-border/40 select-none">
                    #
                  </th>
                  {tableColumns.map((col) => {
                    const isSorted = sortColumn === col.name;
                    return (
                      <th
                        key={col.name}
                        onClick={() => handleSort(col.name)}
                        className="px-3 py-2 font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors border-r border-border/40 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {col.isPrimaryKey && <Key className="size-3 text-amber-400 shrink-0" />}
                            <span className="truncate text-foreground font-semibold">{col.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 shrink-0 font-normal">
                            <span className="uppercase text-[9px] text-muted-foreground/50">{col.type}</span>
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="size-3 text-primary" />
                              ) : (
                                <ArrowDown className="size-3 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="size-2.5 opacity-30 hover:opacity-100" />
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="p-8 text-center text-muted-foreground text-xs font-sans">
                      {filterTerm ? `No rows matching "${filterTerm}"` : 'Table is empty.'}
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, idx) => {
                    const isSelected = selectedRow === row;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedRow(isSelected ? null : row)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-foreground'
                            : idx % 2 === 0
                            ? 'bg-background hover:bg-muted/40'
                            : 'bg-card/25 hover:bg-muted/40'
                        }`}
                      >
                        <td className="px-3 py-1.5 text-center text-muted-foreground/40 text-[10px] border-r border-border/30 select-none">
                          {(page - 1) * (pageSize || 50) + idx + 1}
                        </td>
                        {tableColumns.map((col) => {
                          const isStaged = pendingChanges.some(
                            (c) =>
                              c.type === 'UPDATE' &&
                              c.table === selectedTable &&
                              c.newValues &&
                              col.name in c.newValues &&
                              (row.id !== undefined
                                ? c.primaryKey.id === row.id
                                : c.primaryKey[col.name] === row[col.name])
                          );

                          return (
                            <td
                              key={col.name}
                              className={`px-3 py-1.5 border-r border-border/30 max-w-sm truncate relative ${
                                isStaged ? 'bg-amber-500/10' : ''
                              }`}
                            >
                              {isStaged && (
                                <span
                                  className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-400"
                                  title="Uncommitted staged change"
                                />
                              )}
                              <CellRenderer value={row[col.name]} columnType={col.type} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Slide-out Row Inspector Drawer */}
        <RowDetailSheet
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onUpdateRow={onUpdateRow}
          onDeleteRow={onDeleteRow}
        />
      </div>
    </div>
  );
}
