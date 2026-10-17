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
 * Helper to race a promise against a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg = 'Operation timed out'): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Universal API Bridge that transparently calls Wails IPC bindings in desktop mode,
 * or standard HTTP REST endpoints in web browser mode.
 */
export const apiBridge = {
  isWails: isWailsApp,

  listDevices: async (): Promise<AdbDevice[]> => {
    if (isWailsApp()) {
      try {
        return (await withTimeout(AppBindings.AdbListDevices(), 4000)) as AdbDevice[];
      } catch (e) {
        console.warn('Wails AdbListDevices failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch('/api/adb/devices', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    return (await res.json()) as AdbDevice[];
  },

  listApps: async (deviceId: string): Promise<AdbApp[]> => {
    if (isWailsApp()) {
      try {
        return (await withTimeout(AppBindings.AdbListApps(deviceId), 5000)) as AdbApp[];
      } catch (e) {
        console.warn('Wails AdbListApps failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch(`/api/adb/apps?deviceId=${encodeURIComponent(deviceId)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    return (await res.json()) as AdbApp[];
  },

  isAppRunning: async (deviceId: string, packageName: string): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        return await withTimeout(AppBindings.AdbIsAppRunning(deviceId, packageName), 3000);
      } catch (e) {
        console.warn('Wails AdbIsAppRunning failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch(
      `/api/adb/is-running?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.isRunning);
  },

  discoverDatabases: async (deviceId: string, packageName: string): Promise<any[]> => {
    if (isWailsApp()) {
      try {
        return await withTimeout(AppBindings.AdbDiscoverDatabases(deviceId, packageName), 6000);
      } catch (e) {
        console.warn('Wails AdbDiscoverDatabases failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch(
      `/api/adb/databases?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
      { signal: AbortSignal.timeout(8000) }
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
      try {
        return await withTimeout(
          AppBindings.AdbGetTableData(deviceId, packageName, remotePath, tableName, page, pageSize),
          6000
        );
      } catch (e) {
        console.warn('Wails AdbGetTableData failed or timed out, falling back to HTTP:', e);
      }
    }
    const params = new URLSearchParams({
      deviceId,
      packageName,
      remotePath,
      table: tableName,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await fetch(`/api/adb/table-data?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
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
      try {
        return await withTimeout(
          AppBindings.AdbExecuteQuery(deviceId, packageName, remotePath, query),
          4000,
          'Wails IPC AdbExecuteQuery timed out'
        );
      } catch (e) {
        console.warn('Wails AdbExecuteQuery failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch('/api/adb/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
      signal: AbortSignal.timeout(8000),
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
      try {
        return await withTimeout(
          AppBindings.AdbUpdateRow(
            deviceId,
            packageName,
            remotePath,
            tableName,
            JSON.stringify(primaryKey),
            JSON.stringify(newValues)
          ),
          5000
        );
      } catch (e) {
        console.warn('Wails AdbUpdateRow failed or timed out, falling back to HTTP:', e);
      }
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
      signal: AbortSignal.timeout(6000),
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
      try {
        return await withTimeout(
          AppBindings.AdbDeleteRow(
            deviceId,
            packageName,
            remotePath,
            tableName,
            JSON.stringify(primaryKey)
          ),
          5000
        );
      } catch (e) {
        console.warn('Wails AdbDeleteRow failed or timed out, falling back to HTTP:', e);
      }
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
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  },

  explainQuery: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    query: string
  ): Promise<any> => {
    if (isWailsApp()) {
      try {
        return await withTimeout(
          AppBindings.AdbExplainQuery(deviceId, packageName, remotePath, query),
          5000
        );
      } catch (e) {
        console.warn('Wails AdbExplainQuery failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch('/api/adb/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Explain query failed' }));
      throw new Error(err.error || 'Explain query failed');
    }
    return await res.json();
  },

  simulateQuery: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    query: string
  ): Promise<any> => {
    if (isWailsApp()) {
      try {
        return await withTimeout(
          AppBindings.AdbSimulateQuery(deviceId, packageName, remotePath, query),
          5000
        );
      } catch (e) {
        console.warn('Wails AdbSimulateQuery failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch('/api/adb/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Simulate query failed' }));
      throw new Error(err.error || 'Simulate query failed');
    }
    return await res.json();
  },

  getExtendedSchema: async (
    deviceId: string,
    packageName: string,
    remotePath: string
  ): Promise<any> => {
    if (isWailsApp()) {
      try {
        return await withTimeout(
          AppBindings.AdbGetDatabaseSchemaExtended(deviceId, packageName, remotePath),
          6000
        );
      } catch (e) {
        console.warn('Wails AdbGetDatabaseSchemaExtended failed or timed out, falling back to HTTP:', e);
      }
    }
    const params = new URLSearchParams({ deviceId, packageName, remotePath });
    const res = await fetch(`/api/adb/schema-extended?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch extended schema' }));
      throw new Error(err.error || 'Failed to fetch extended schema');
    }
    return await res.json();
  },

  createIndex: async (
    deviceId: string,
    packageName: string,
    remotePath: string,
    indexSql: string
  ): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        await withTimeout(
          AppBindings.AdbCreateIndex(deviceId, packageName, remotePath, indexSql),
          5000
        );
        return true;
      } catch (e) {
        console.warn('Wails AdbCreateIndex failed or timed out, falling back to HTTP:', e);
      }
    }
    const res = await fetch('/api/adb/create-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, indexSql }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create index' }));
      throw new Error(err.error || 'Failed to create index');
    }
    const data = await res.json();
    return Boolean(data.success);
  },
};

