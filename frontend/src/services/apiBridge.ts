import * as AppBindings from '../../wailsjs/go/app/App';

/**
 * Detects whether the application is running inside the native Wails desktop container
 * or inside a standard web browser (Chrome, Safari, Edge, Firefox).
 */
export const isWailsApp = (): boolean => {
  return typeof window !== 'undefined' && 'go' in window && Boolean((window as any).go?.app?.App);
};

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

/**
 * Universal API Bridge that transparently calls Wails IPC bindings in desktop mode,
 * or standard HTTP REST endpoints in web browser mode.
 */
export const apiBridge = {
  isWails: isWailsApp,

  listDevices: async (): Promise<AdbDevice[]> => {
    if (isWailsApp()) {
      return (await AppBindings.AdbListDevices()) as AdbDevice[];
    }
    const res = await fetch('/api/adb/devices');
    if (!res.ok) return [];
    return (await res.json()) as AdbDevice[];
  },

  listApps: async (deviceId: string): Promise<AdbApp[]> => {
    if (isWailsApp()) {
      return (await AppBindings.AdbListApps(deviceId)) as AdbApp[];
    }
    const res = await fetch(`/api/adb/apps?deviceId=${encodeURIComponent(deviceId)}`);
    if (!res.ok) return [];
    return (await res.json()) as AdbApp[];
  },

  isAppRunning: async (deviceId: string, packageName: string): Promise<boolean> => {
    if (isWailsApp()) {
      return await AppBindings.AdbIsAppRunning(deviceId, packageName);
    }
    const res = await fetch(
      `/api/adb/is-running?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.isRunning);
  },

  discoverDatabases: async (deviceId: string, packageName: string): Promise<any[]> => {
    if (isWailsApp()) {
      return await AppBindings.AdbDiscoverDatabases(deviceId, packageName);
    }
    const res = await fetch(
      `/api/adb/databases?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`
    );
    if (!res.ok) return [];
    return await res.json();
  },

  getTableData: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    tableName: string,
    page = 1,
    pageSize = 50
  ): Promise<any> => {
    if (isWailsApp()) {
      return await AppBindings.AdbGetTableData(deviceId, packageName, remotePath, tableName, page, pageSize);
    }
    const params = new URLSearchParams({
      deviceId,
      packageName,
      remotePath,
      table: tableName,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/adb/table-data?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch table data' }));
      throw new Error(err.error || 'Failed to fetch table data');
    }
    return await res.json();
  },

  executeQuery: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    query: string
  ): Promise<any> => {
    if (isWailsApp()) {
      return await AppBindings.AdbExecuteQuery(deviceId, packageName, remotePath, query);
    }
    const res = await fetch('/api/adb/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Query execution failed' }));
      throw new Error(err.error || 'Query execution failed');
    }
    return await res.json();
  },

  updateRow: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    tableName: string,
    primaryKey: Record<string, any>,
    newValues: Record<string, any>
  ): Promise<boolean> => {
    if (isWailsApp()) {
      return await AppBindings.AdbUpdateRow(
        deviceId,
        packageName,
        remotePath,
        tableName,
        JSON.stringify(primaryKey),
        JSON.stringify(newValues)
      );
    }
    const res = await fetch('/api/adb/update-row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        packageName,
        remotePath,
        table: tableName,
        pk: primaryKey,
        values: newValues,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  },

  deleteRow: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    tableName: string,
    primaryKey: Record<string, any>
  ): Promise<boolean> => {
    if (isWailsApp()) {
      return await AppBindings.AdbDeleteRow(
        deviceId,
        packageName,
        remotePath,
        tableName,
        JSON.stringify(primaryKey)
      );
    }
    const res = await fetch('/api/adb/delete-row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        packageName,
        remotePath,
        table: tableName,
        pk: primaryKey,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  },
};
