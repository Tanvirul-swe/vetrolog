import * as AppBindings from '../../wailsjs/go/app/App';

/**
 * Detects whether the application is running inside the native Wails desktop container
 * or inside a standard web browser (Chrome, Safari, Edge, Firefox).
 */
export const isWailsApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(
    win?.runtime ||
    (win?.go && (win?.go?.app?.App || win?.go?.app)) ||
    win?.wails
  );
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
      try {
        return (await AppBindings.AdbListDevices()) as AdbDevice[];
      } catch {
        return [];
      }
    }
    try {
      const res = await fetch('/api/adb/devices', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return [];
      return (await res.json()) as AdbDevice[];
    } catch {
      return [];
    }
  },

  listApps: async (deviceId: string): Promise<AdbApp[]> => {
    if (isWailsApp()) {
      try {
        return (await AppBindings.AdbListApps(deviceId)) as AdbApp[];
      } catch {
        return [];
      }
    }
    try {
      const res = await fetch(`/api/adb/apps?deviceId=${encodeURIComponent(deviceId)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      return (await res.json()) as AdbApp[];
    } catch {
      return [];
    }
  },

  isAppRunning: async (deviceId: string, packageName: string): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        return await AppBindings.AdbIsAppRunning(deviceId, packageName);
      } catch {
        return false;
      }
    }
    try {
      const res = await fetch(
        `/api/adb/is-running?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.isRunning);
    } catch {
      return false;
    }
  },

  discoverDatabases: async (deviceId: string, packageName: string): Promise<any[]> => {
    if (isWailsApp()) {
      try {
        return await AppBindings.AdbDiscoverDatabases(deviceId, packageName);
      } catch {
        return [];
      }
    }
    try {
      const res = await fetch(
        `/api/adb/databases?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
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
        return await AppBindings.AdbGetTableData(
          deviceId,
          packageName,
          remotePath,
          tableName,
          page,
          pageSize
        );
      } catch {
        return null;
      }
    }
    try {
      const params = new URLSearchParams({
        deviceId,
        packageName,
        remotePath,
        table: tableName,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/adb/table-data?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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
      signal: AbortSignal.timeout(60000),
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
      signal: AbortSignal.timeout(30000),
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
      signal: AbortSignal.timeout(30000),
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
      return await AppBindings.AdbExplainQuery(deviceId, packageName, remotePath, query);
    }
    const res = await fetch('/api/adb/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
      signal: AbortSignal.timeout(30000),
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
      return await AppBindings.AdbSimulateQuery(deviceId, packageName, remotePath, query);
    }
    const res = await fetch('/api/adb/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, query }),
      signal: AbortSignal.timeout(30000),
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
      return await AppBindings.AdbGetDatabaseSchemaExtended(deviceId, packageName, remotePath);
    }
    const params = new URLSearchParams({ deviceId, packageName, remotePath });
    const res = await fetch(`/api/adb/schema-extended?${params.toString()}`, {
      signal: AbortSignal.timeout(30000),
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
      await AppBindings.AdbCreateIndex(deviceId, packageName, remotePath, indexSql);
      return true;
    }
    const res = await fetch('/api/adb/create-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, packageName, remotePath, indexSql }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create index' }));
      throw new Error(err.error || 'Failed to create index');
    }
    const data = await res.json();
    return Boolean(data.success);
  },

  checkForUpdate: async (): Promise<UpdateInfoBridge | null> => {
    if (isWailsApp()) {
      try {
        return (await AppBindings.CheckForUpdate()) as UpdateInfoBridge;
      } catch (err) {
        console.error('CheckForUpdate failed:', err);
        return null;
      }
    }
    try {
      const res = await fetch('https://api.github.com/repos/Tanvirul-swe/vetrolog/releases/latest');
      if (!res.ok) return null;
      const data = await res.json();
      return {
        currentVersion: 'v1.3.2',
        latestVersion: data.tag_name,
        releaseName: data.name,
        releaseNotes: data.body,
        releaseUrl: data.html_url,
        assetUrl: data.assets?.[0]?.browser_download_url || '',
        assetName: data.assets?.[0]?.name || '',
        assetSize: data.assets?.[0]?.size || 0,
        publishedAt: data.published_at,
        hasUpdate: Boolean(data.tag_name && data.tag_name !== 'v1.3.2'),
      };
    } catch {
      return null;
    }
  },

  startDownloadUpdate: async (assetUrl: string, version: string): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        await AppBindings.StartDownloadUpdate(assetUrl, version);
        return true;
      } catch (err) {
        console.error('StartDownloadUpdate failed:', err);
        return false;
      }
    }
    return false;
  },

  applyUpdateAndRestart: async (version: string): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        await AppBindings.ApplyUpdateAndRestart(version);
        return true;
      } catch (err) {
        console.error('ApplyUpdateAndRestart failed:', err);
        return false;
      }
    }
    return false;
  },

  cancelUpdate: async (): Promise<boolean> => {
    if (isWailsApp()) {
      try {
        await AppBindings.CancelUpdate();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
};

export interface UpdateInfoBridge {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  assetUrl: string;
  assetName: string;
  assetSize: number;
  publishedAt: string;
  hasUpdate: boolean;
}

