import { Platform } from 'react-native';

/**
 * VetroLog Mobile Database Inspector Client for React Native
 *
 * Compatible with Expo, Bare React Native, MMKV, AsyncStorage, and SQLite.
 * Uses the built-in global WebSocket (zero external dependencies).
 */

export interface DatabaseSchema {
  id: string;
  name: string;
  type: 'sqlite' | 'async_storage' | 'mmkv' | 'realm';
  path: string;
  tables: Array<{
    name: string;
    rowCount?: number;
    columns: Array<{
      name: string;
      type: string;
      isPrimaryKey?: boolean;
    }>;
  }>;
}

export interface MutationEvent {
  databaseId: string;
  tableName: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  query?: string;
  durationMs?: number;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  affected?: number;
}

export class VetroLog {
  private static instance: VetroLog;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  private host: string = 'localhost';
  private port: number = 9222;
  private appName: string = 'React Native App';
  private deviceId: string = `rn_${Platform.OS}_${Date.now()}`;

  private databases: Map<string, DatabaseSchema> = new Map();
  private tableDataProviders: Map<
    string,
    (table: string, page: number, size: number) => Promise<Record<string, any>[]>
  > = new Map();
  private queryExecutors: Map<
    string,
    (query: string) => Promise<Record<string, any>[]>
  > = new Map();

  private constructor() {}

  public static getInstance(): VetroLog {
    if (!VetroLog.instance) {
      VetroLog.instance = new VetroLog();
    }
    return VetroLog.instance;
  }

  /**
   * Initialize and connect to the VetroLog desktop app
   */
  public static init(options?: {
    host?: string;
    port?: number;
    appName?: string;
    deviceId?: string;
  }) {
    const client = VetroLog.getInstance();
    if (options?.host) client.host = options.host;
    if (options?.port) client.port = options.port;
    if (options?.appName) client.appName = options.appName;
    if (options?.deviceId) client.deviceId = options.deviceId;

    client.connect();
  }

  public connect() {
    this.disconnect();

    const uri = `ws://${this.host}:${this.port}/ws`;
    try {
      this.ws = new WebSocket(uri);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.sendHandshake();
        this.sendDatabaseList();
      };

      this.ws.onmessage = (e) => {
        this.handleIncomingMessage(e.data);
      };

      this.ws.onerror = () => {
        this.handleDisconnect();
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };
    } catch {
      this.handleDisconnect();
    }
  }

  public disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleDisconnect() {
    this.isConnected = false;
    this.ws = null;
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  private sendEnvelope(type: string, payload: any) {
    if (!this.isConnected || !this.ws) return;

    try {
      this.ws.send(
        JSON.stringify({
          type,
          timestamp: Date.now(),
          payload,
        })
      );
    } catch {}
  }

  private sendHandshake() {
    const payload = {
      id: this.deviceId,
      name: `${Platform.OS.toUpperCase()} App (${Platform.Version})`,
      platform: Platform.OS,
      osVersion: `${Platform.OS} ${Platform.Version}`,
      appId: this.appName,
      connectedAt: Date.now(),
    };
    this.sendEnvelope('handshake', payload);
  }

  private sendDatabaseList() {
    const list = Array.from(this.databases.values()).map((db) => ({
      ...db,
      sizeBytes: 0,
      updatedAt: Date.now(),
    }));
    this.sendEnvelope('db_list', list);
  }

  /**
   * Register an SQLite / Realm / custom database
   */
  public registerDatabase(
    schema: DatabaseSchema,
    handlers?: {
      onFetchTableData?: (
        table: string,
        page: number,
        size: number
      ) => Promise<Record<string, any>[]>;
      onExecuteQuery?: (query: string) => Promise<Record<string, any>[]>;
    }
  ) {
    this.databases.set(schema.id, schema);
    if (handlers?.onFetchTableData) {
      this.tableDataProviders.set(schema.id, handlers.onFetchTableData);
    }
    if (handlers?.onExecuteQuery) {
      this.queryExecutors.set(schema.id, handlers.onExecuteQuery);
    }
    this.sendDatabaseList();
  }

  /**
   * Inspect AsyncStorage effortlessly
   */
  public registerAsyncStorage(asyncStorageModule: {
    getAllKeys: () => Promise<readonly string[]>;
    multiGet: (
      keys: readonly string[]
    ) => Promise<readonly [string, string | null][]>;
  }) {
    const id = 'async_storage';
    this.registerDatabase(
      {
        id,
        name: 'AsyncStorage',
        type: 'async_storage',
        path: '@react-native-async-storage/async-storage',
        tables: [
          {
            name: 'storage',
            columns: [
              { name: 'key', type: 'TEXT', isPrimaryKey: true },
              { name: 'value', type: 'TEXT' },
            ],
          },
        ],
      },
      {
        onFetchTableData: async () => {
          const keys = await asyncStorageModule.getAllKeys();
          const pairs = await asyncStorageModule.multiGet(keys);
          return pairs.map(([key, value]) => ({
            key,
            value: value ?? 'null',
          }));
        },
      }
    );
  }

  /**
   * Inspect MMKV Storage
   */
  public registerMMKV(
    storageId: string,
    mmkvInstance: {
      getAllKeys: () => string[];
      getString: (key: string) => string | undefined;
    }
  ) {
    const id = `mmkv_${storageId}`;
    this.registerDatabase(
      {
        id,
        name: `MMKV (${storageId})`,
        type: 'mmkv',
        path: `mmkv/${storageId}`,
        tables: [
          {
            name: 'key_value',
            columns: [
              { name: 'key', type: 'TEXT', isPrimaryKey: true },
              { name: 'value', type: 'TEXT' },
            ],
          },
        ],
      },
      {
        onFetchTableData: async () => {
          const keys = mmkvInstance.getAllKeys();
          return keys.map((key) => ({
            key,
            value: mmkvInstance.getString(key) ?? 'null',
          }));
        },
      }
    );
  }

  /**
   * Emit a real-time mutation event to the desktop inspector
   */
  public notifyMutation(mutation: MutationEvent) {
    const payload = {
      id: `mut_${Date.now()}`,
      databaseId: mutation.databaseId,
      tableName: mutation.tableName,
      type: mutation.type.toUpperCase(),
      timestamp: Date.now(),
      query: mutation.query,
      durationMs: mutation.durationMs,
      oldValues: mutation.oldValues,
      newValues: mutation.newValues,
      affected: mutation.affected ?? 1,
    };

    this.sendEnvelope('mutation', payload);
  }

  private async handleIncomingMessage(raw: string) {
    try {
      const envelope = JSON.parse(raw);
      const action = envelope.action;
      const reqId = envelope.requestId;
      const payload = envelope.payload;

      if (!action || !payload) return;

      if (action === 'fetch_table_data') {
        const provider = this.tableDataProviders.get(payload.databaseId);
        if (provider) {
          const rows = await provider(
            payload.tableName,
            payload.page || 1,
            payload.pageSize || 50
          );
          this.sendEnvelope('table_data', {
            databaseId: payload.databaseId,
            tableName: payload.tableName,
            totalRows: rows.length,
            page: payload.page || 1,
            pageSize: payload.pageSize || 50,
            columns: [],
            rows,
          });
        }
      } else if (action === 'execute_query') {
        const executor = this.queryExecutors.get(payload.databaseId);
        const start = Date.now();
        if (executor) {
          try {
            const rows = await executor(payload.query);
            this.sendEnvelope('query_result', {
              requestId: reqId || `q_${Date.now()}`,
              databaseId: payload.databaseId,
              query: payload.query,
              rows,
              affected: rows.length,
              durationMs: Date.now() - start,
              success: true,
            });
          } catch (err: any) {
            this.sendEnvelope('query_result', {
              requestId: reqId || `q_${Date.now()}`,
              databaseId: payload.databaseId,
              query: payload.query,
              rows: [],
              affected: 0,
              durationMs: Date.now() - start,
              success: false,
              error: err?.message || String(err),
            });
          }
        }
      }
    } catch {}
  }
}
export default VetroLog;
