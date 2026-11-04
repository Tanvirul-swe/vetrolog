import * as AppBindings from '../../wailsjs/go/app/App';

/**
 * Detects whether the application is running inside the native Wails desktop container
 * or inside a standard web browser / VS Code Webview.
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

/**
 * Returns dynamic base URL for API requests.
 * Allows VS Code Webview or custom web ports to route calls accurately.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const win = window as any;
  if (win.__VETROLOG_API_URL__) {
    return win.__VETROLOG_API_URL__.replace(/\/$/, '');
  }
  if (win.__VETROLOG_PORT__) {
    return `http://localhost:${win.__VETROLOG_PORT__}`;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('port');
    if (p) return `http://localhost:${p}`;
    const api = params.get('apiUrl');
    if (api) return api.replace(/\/$/, '');
  } catch {
    // Fallback if window.location is inaccessible
  }
  return '';
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
      const res = await fetch(`${getApiBaseUrl()}/api/adb/devices`, { signal: AbortSignal.timeout(5000) });
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
      const res = await fetch(`${getApiBaseUrl()}/api/adb/apps?deviceId=${encodeURIComponent(deviceId)}`, {
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
        `${getApiBaseUrl()}/api/adb/is-running?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
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
        `${getApiBaseUrl()}/api/adb/databases?deviceId=${encodeURIComponent(deviceId)}&packageName=${encodeURIComponent(packageName)}`,
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
      const res = await fetch(`${getApiBaseUrl()}/api/adb/table-data?${params.toString()}`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/query`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/update-row`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/delete-row`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/explain`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/simulate`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/schema-extended?${params.toString()}`, {
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
    const res = await fetch(`${getApiBaseUrl()}/api/adb/create-index`, {
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
        currentVersion: 'v1.5.0',
        latestVersion: data.tag_name,
        releaseName: data.name,
        releaseNotes: data.body,
        releaseUrl: data.html_url,
        assetUrl: data.assets?.[0]?.browser_download_url || '',
        assetName: data.assets?.[0]?.name || '',
        assetSize: data.assets?.[0]?.size || 0,
        publishedAt: data.published_at,
        hasUpdate: Boolean(data.tag_name && data.tag_name !== 'v1.5.0'),
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

  /**
   * Remote & Local File Database Management APIs (for Web / VS Code mode)
   */
  remote: {
    listConnections: async (): Promise<any[]> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/connections`, { signal: AbortSignal.timeout(5000) });
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    },
    getConnection: async (id: string): Promise<any> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/connections/get?id=${encodeURIComponent(id)}`);
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
    saveConnection: async (cfg: any): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/connections/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      return res.ok ? await res.json() : null;
    },
    deleteConnection: async (id: string): Promise<boolean> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/connections/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      return res.ok;
    },
    testConnection: async (cfg: any): Promise<any> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/connections/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        });
        return res.ok ? await res.json() : { success: false, error: 'Request failed' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Request failed' };
      }
    },
    connect: async (id: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Connection failed' }));
        throw new Error(err.error || 'Connection failed');
      }
      return await res.json();
    },
    openLocalFile: async (filePath: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/open-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to open file' }));
        throw new Error(err.error || 'Failed to open file');
      }
      return await res.json();
    },
    disconnect: async (sessionId: string): Promise<boolean> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      return res.ok;
    },
    listDatabases: async (sessionId: string): Promise<string[]> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/databases?sessionId=${encodeURIComponent(sessionId)}`);
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    },
    listSchemas: async (sessionId: string, dbName: string): Promise<string[]> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/schemas?sessionId=${encodeURIComponent(sessionId)}&db=${encodeURIComponent(dbName)}`);
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    },
    listTables: async (sessionId: string, dbName: string, schema: string): Promise<any[]> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/tables?sessionId=${encodeURIComponent(sessionId)}&db=${encodeURIComponent(dbName)}&schema=${encodeURIComponent(schema)}`);
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    },
    getTableSchema: async (sessionId: string, dbName: string, schema: string, table: string): Promise<any> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/table-schema?sessionId=${encodeURIComponent(sessionId)}&db=${encodeURIComponent(dbName)}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`);
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    },
    getDatabaseSchemaExtended: async (sessionId: string, dbName: string, schema: string): Promise<any[]> => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/remote/schema-extended?sessionId=${encodeURIComponent(sessionId)}&db=${encodeURIComponent(dbName)}&schema=${encodeURIComponent(schema)}`);
        return res.ok ? await res.json() : [];
      } catch {
        return [];
      }
    },
    getTableData: async (
      sessionId: string,
      schema: string,
      table: string,
      page = 1,
      pageSize = 50,
      sortCol = '',
      sortDir = '',
      filter = ''
    ): Promise<any> => {
      const params = new URLSearchParams({
        sessionId,
        schema,
        table,
        page: String(page),
        pageSize: String(pageSize),
        sortCol,
        sortDir,
        filter,
      });
      const res = await fetch(`${getApiBaseUrl()}/api/remote/table-data?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch table data');
      return await res.json();
    },
    executeQuery: async (sessionId: string, query: string, maxRows = 100): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, query, maxRows }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Query failed' }));
        throw new Error(err.error || 'Query failed');
      }
      return await res.json();
    },
    applyPendingChanges: async (sessionId: string, payload: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/apply-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to apply changes' }));
        throw new Error(err.error || 'Failed to apply changes');
      }
      return await res.json();
    },
    explainQuery: async (sessionId: string, query: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, query }),
      });
      if (!res.ok) throw new Error('Explain query failed');
      return await res.json();
    },
    simulateQuery: async (sessionId: string, query: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, query }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      return await res.json();
    },
    redisScan: async (sessionId: string, pattern = '*', cursor = 0, count = 100): Promise<any> => {
      const params = new URLSearchParams({ sessionId, pattern, cursor: String(cursor), count: String(count) });
      const res = await fetch(`${getApiBaseUrl()}/api/remote/redis/scan?${params.toString()}`);
      if (!res.ok) throw new Error('Redis scan failed');
      return await res.json();
    },
    redisGet: async (sessionId: string, key: string): Promise<any> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/redis/inspect?sessionId=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error('Redis get failed');
      return await res.json();
    },
    redisSet: async (sessionId: string, key: string, valType: string, value: string, ttlSec = 0): Promise<boolean> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/redis/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, key, valType, value, ttlSec }),
      });
      return res.ok;
    },
    redisDel: async (sessionId: string, key: string): Promise<boolean> => {
      const res = await fetch(`${getApiBaseUrl()}/api/remote/redis/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, key }),
      });
      return res.ok;
    },
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

