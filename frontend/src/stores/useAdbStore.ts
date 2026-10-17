import { create } from 'zustand';
import { apiBridge } from '@/services/apiBridge';
import { useDatabaseStore } from './useDatabaseStore';
import { DatabaseInfo } from '../types/database';

export interface AdbDevice {
  id: string;
  model: string;
  product: string;
  device: string;
  transportId: string;
  state: string;
  isEmulator: boolean;
}

export interface AdbApp {
  packageName: string;
  displayName: string;
  isDebuggable: boolean;
  isRunning?: boolean;
  pid?: string;
}

interface AdbState {
  devices: AdbDevice[];
  selectedDeviceId: string | null;
  apps: AdbApp[];
  selectedPackageName: string | null;
  selectedDbRemotePath: string | null;

  isLoadingDevices: boolean;
  isLoadingApps: boolean;
  isLoadingDatabases: boolean;
  isAdbMode: boolean;
  isLiveSync: boolean;

  fetchDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
  selectApp: (packageName: string) => Promise<void>;
  refreshDatabases: () => Promise<void>;
  pollState: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  toggleLiveSync: () => void;
  setLiveSync: (enabled: boolean) => void;
  loadTableData: (tableName: string, page?: number, pageSize?: number, isSilent?: boolean) => Promise<void>;
  executeQuery: (query: string) => Promise<any>;
  updateRow: (tableName: string, pk: Record<string, any>, newValues: Record<string, any>) => Promise<boolean>;
  deleteRow: (tableName: string, pk: Record<string, any>) => Promise<boolean>;
}

let isPollingInProgress = false;
let pollIntervalId: any = null;
let consecutiveDeadChecks = 0;

export const useAdbStore = create<AdbState>((set, get) => ({
  devices: [],
  selectedDeviceId: null,
  apps: [],
  selectedPackageName: null,
  selectedDbRemotePath: null,

  isLoadingDevices: false,
  isLoadingApps: false,
  isLoadingDatabases: false,
  isAdbMode: false,
  isLiveSync: true,

  toggleLiveSync: () => {
    const next = !get().isLiveSync;
    set({ isLiveSync: next });
    if (next) {
      const activeTable = useDatabaseStore.getState().selectedTableName;
      if (activeTable && !useDatabaseStore.getState().isLoadingTable) {
        const page = useDatabaseStore.getState().page;
        const pageSize = useDatabaseStore.getState().pageSize;
        get().loadTableData(activeTable, page, pageSize, true);
      }
    }
  },

  setLiveSync: (enabled: boolean) => {
    set({ isLiveSync: enabled });
    if (enabled) {
      const activeTable = useDatabaseStore.getState().selectedTableName;
      if (activeTable && !useDatabaseStore.getState().isLoadingTable) {
        const page = useDatabaseStore.getState().page;
        const pageSize = useDatabaseStore.getState().pageSize;
        get().loadTableData(activeTable, page, pageSize, true);
      }
    }
  },

  startPolling: () => {
    if (pollIntervalId) return;
    get().pollState();
    pollIntervalId = setInterval(() => {
      get().pollState();
    }, 3000);
  },

  stopPolling: () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  },

  pollState: async () => {
    // Avoid concurrent polls or interfering with active user-initiated table loading
    if (isPollingInProgress || useDatabaseStore.getState().isLoadingTable) return;
    isPollingInProgress = true;

    try {
      // 1. Fetch current devices attached
      const devs = await apiBridge.listDevices();
      const currentSelectedDevId = get().selectedDeviceId;

      // Case A: No ADB devices attached
      if (!devs || devs.length === 0) {
        consecutiveDeadChecks = 0;
        if (get().devices.length > 0 || currentSelectedDevId !== null) {
          set({
            devices: [],
            selectedDeviceId: null,
            apps: [],
            selectedPackageName: null,
            selectedDbRemotePath: null,
            isAdbMode: false,
          });
          useDatabaseStore.getState().resetState();
        }
        return;
      }

      // Update devices list if changed
      const devIds = devs.map((d) => d.id).join(',');
      const prevDevIds = get().devices.map((d) => d.id).join(',');
      if (devIds !== prevDevIds) {
        set({ devices: devs });
      }

      // Ensure active device is valid
      let activeDevId = currentSelectedDevId;
      if (!activeDevId || !devs.some((d) => d.id === activeDevId)) {
        activeDevId = devs[0].id;
        set({ selectedDeviceId: activeDevId });
        await get().selectDevice(activeDevId);
        return;
      }

      // Case B: Device is active, verify current app running status
      const currentPkg = get().selectedPackageName;

      // 2. Check if selected app is still running (requires 3 consecutive failures to avoid transient false positives)
      if (currentPkg) {
        const isStillRunning = await apiBridge.isAppRunning(activeDevId, currentPkg);
        if (!isStillRunning) {
          consecutiveDeadChecks++;
          if (consecutiveDeadChecks >= 3) {
            // Confirmed that debug app was closed or detached
            set({
              selectedPackageName: null,
              selectedDbRemotePath: null,
              apps: [],
            });
            useDatabaseStore.getState().resetState();
            consecutiveDeadChecks = 0;
            return;
          }
        } else {
          consecutiveDeadChecks = 0;
        }
      }

      // 3. If no app is selected yet, scan for running debug apps to connect
      if (!get().selectedPackageName) {
        const latestApps = await apiBridge.listApps(activeDevId);
        const appsList = latestApps || [];
        set({ apps: appsList });

        if (appsList.length > 0) {
          const targetApp = appsList.find((a) => a.displayName?.includes('(Active)')) || appsList.find((a) => a.isRunning) || appsList[0];
          if (targetApp && targetApp.isRunning !== false) {
            await get().selectApp(targetApp.packageName);
          }
        }
        return;
      }

      // 4. Real-time live table records update and left sidebar row counts
      if (get().isLiveSync && get().selectedPackageName && !useDatabaseStore.getState().isLoadingTable) {
        const activeTable = useDatabaseStore.getState().selectedTableName;
        if (activeTable) {
          const currentPage = useDatabaseStore.getState().page;
          const currentPageSize = useDatabaseStore.getState().pageSize;
          await get().loadTableData(activeTable, currentPage, currentPageSize, true);
        }
      }
    } catch {
      // Silently handle transient ADB errors during poll
    } finally {
      isPollingInProgress = false;
    }
  },

  fetchDevices: async () => {
    set({ isLoadingDevices: true });
    try {
      const devices = await apiBridge.listDevices();
      set({ devices: devices || [], isLoadingDevices: false });

      const currentSelected = get().selectedDeviceId;
      if (!currentSelected && devices && devices.length > 0) {
        // Auto-select first device
        get().selectDevice(devices[0].id);
      }
    } catch {
      set({ isLoadingDevices: false });
    }
  },

  selectDevice: async (deviceId: string) => {
    set({
      selectedDeviceId: deviceId,
      apps: [],
      selectedPackageName: null,
      isLoadingApps: true,
      isAdbMode: true,
    });

    try {
      const apps = await apiBridge.listApps(deviceId);
      set({ apps: apps || [], isLoadingApps: false });

      if (apps && apps.length > 0) {
        get().selectApp(apps[0].packageName);
      }
    } catch {
      set({ isLoadingApps: false });
    }
  },

  selectApp: async (packageName: string) => {
    set({
      selectedPackageName: packageName,
      isLoadingDatabases: true,
      isAdbMode: true,
    });

    const deviceId = get().selectedDeviceId;
    if (!deviceId) {
      set({ isLoadingDatabases: false });
      return;
    }

    try {
      const dbs = await apiBridge.discoverDatabases(deviceId, packageName);
      set({ isLoadingDatabases: false });

      if (dbs && dbs.length > 0) {
        // Convert to DatabaseInfo structure
        const formattedDbs: DatabaseInfo[] = dbs.map((db: any) => ({
          id: db.id,
          name: db.name,
          type: db.type as any,
          path: db.path,
            sizeBytes: db.sizeBytes || 0,
            updatedAt: db.updatedAt || Date.now(),
            tables: (db.tables || []).map((t: any) => ({
              name: t.name,
              type: t.type || 'table',
              rowCount: t.rowCount || 0,
              columns: (t.columns || []).map((c: any) => ({
                name: c.name,
                type: c.type || 'TEXT',
                isPrimaryKey: c.isPrimaryKey,
                isNullable: c.isNullable,
              })),
            })),
          }));

          useDatabaseStore.getState().setDatabases(formattedDbs);

          // Select first DB and table (preserving active table selection if it exists)
          const firstDb = formattedDbs[0];
          set({ selectedDbRemotePath: firstDb.path });

          const currentTable = useDatabaseStore.getState().selectedTableName;
          const tableToLoad =
            currentTable && firstDb.tables.some((t: any) => t.name === currentTable)
              ? currentTable
              : firstDb.tables.length > 0
                ? firstDb.tables[0].name
                : null;

          if (tableToLoad) {
            get().loadTableData(tableToLoad, 1, 50);
          }
        } else {
          useDatabaseStore.getState().setDatabases([]);
        }
      } catch {
        set({ isLoadingDatabases: false });
      }
    },

  refreshDatabases: async () => {
    const pkg = get().selectedPackageName;
    if (pkg) {
      await get().selectApp(pkg);
    } else {
      await get().fetchDevices();
    }
  },

  loadTableData: async (tableName: string, page = 1, pageSize = 50, isSilent = false) => {
    const deviceId = get().selectedDeviceId;
    const packageName = get().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    let currentDb = databases.find((d) => d.id === selectedDbId);
    if (!currentDb || !currentDb.tables.some((t: any) => t.name === tableName)) {
      const dbWithTable = databases.find((d) => d.tables.some((t: any) => t.name === tableName));
      if (dbWithTable) {
        currentDb = dbWithTable;
        set({ selectedDbRemotePath: dbWithTable.path });
      }
    }
    const remotePath = currentDb?.path || get().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return;

    if (!isSilent) {
      useDatabaseStore.getState().selectTable(tableName);
    }

    try {
      const result = await apiBridge.getTableData(
        deviceId,
        packageName,
        remotePath,
        tableName,
        page,
        pageSize
      );

      if (result) {
        // Guard: if user selected a different table while this request was in flight, do not overwrite
        const activeTable = useDatabaseStore.getState().selectedTableName;
        if (activeTable && activeTable !== tableName) {
          return;
        }

        useDatabaseStore.getState().setTableData({
          databaseId: result.databaseId,
          tableName: result.tableName,
          totalRows: result.totalRows,
          page: result.page,
          pageSize: result.pageSize,
          columns: result.columns,
          rows: result.rows || [],
        });

        // Keep left sidebar table counts updated in real-time
        if ((result as any).tableCounts) {
          useDatabaseStore.getState().updateTableCounts(result.databaseId, (result as any).tableCounts);
        }
      }
    } catch (e) {
      console.error('Error fetching ADB table data:', e);
    }
  },

  executeQuery: async (query: string) => {
    const deviceId = get().selectedDeviceId;
    const packageName = get().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || get().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return null;

    try {
      const result = await apiBridge.executeQuery(
        deviceId,
        packageName,
        remotePath,
        query
      );

      if (result) {
        useDatabaseStore.getState().setLatestQueryResult({
          requestId: `adb_${Date.now()}`,
          databaseId: selectedDbId || packageName,
          query,
          columns: [],
          rows: result.rows || [],
          affected: result.affected || 0,
          durationMs: result.durationMs || 0,
          success: result.success,
          error: result.error,
        });

        useDatabaseStore.getState().addQueryLog({
          id: `q_${Date.now()}`,
          databaseId: selectedDbId || packageName,
          query,
          durationMs: result.durationMs || 0,
          timestamp: Date.now(),
          success: result.success,
          error: result.error,
        });

        // If it was a mutation, refresh table data
        const upper = query.trim().toUpperCase();
        if (
          upper.startsWith('INSERT') ||
          upper.startsWith('UPDATE') ||
          upper.startsWith('DELETE')
        ) {
          const currentTable = useDatabaseStore.getState().selectedTableName;
          if (currentTable) {
            get().loadTableData(currentTable);
          }
        }
      }
      return result;
    } catch (e) {
      console.error('Error executing ADB query:', e);
    }
    return null;
  },

  updateRow: async (tableName: string, pk: Record<string, any>, newValues: Record<string, any>) => {
    const deviceId = get().selectedDeviceId;
    const packageName = get().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || get().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return false;

    try {
      const success = await apiBridge.updateRow(
        deviceId,
        packageName,
        remotePath,
        tableName,
        pk,
        newValues
      );

      if (success) {
        get().loadTableData(tableName);
      }
      return success;
    } catch (e) {
      console.error('Error updating ADB row:', e);
    }
    return false;
  },

  deleteRow: async (tableName: string, pk: Record<string, any>) => {
    const deviceId = get().selectedDeviceId;
    const packageName = get().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || get().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return false;

    try {
      const success = await apiBridge.deleteRow(
        deviceId,
        packageName,
        remotePath,
        tableName,
        pk
      );

      if (success) {
        get().loadTableData(tableName);
      }
      return success;
    } catch (e) {
      console.error('Error deleting ADB row:', e);
    }
    return false;
  },
}));
