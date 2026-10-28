import { create } from 'zustand';
import {
  ConnectionSummary,
  ConnectionSession,
  ConnectionConfig,
  TableSummary,
  TableDataResult,
  ExtendedTableSchema,
  QueryResult,
  SimulationResult,
  ChangeResult,
  RedisScanResult,
  RedisValueResult,
} from '../types/database';
import * as AppBindings from '../../wailsjs/go/app/App';
import { useDatabaseStore } from './useDatabaseStore';
import { useAdbStore } from './useAdbStore';

export type WorkspaceMode = 'mobile' | 'remote';

interface ConnectionManagerState {
  workspaceMode: WorkspaceMode;
  savedConnections: ConnectionSummary[];
  activeSession: ConnectionSession | null;
  isConnecting: boolean;
  isLoadingConnections: boolean;
  connectionError: string | null;

  // Remote Database Catalog
  remoteDatabases: string[];
  selectedDatabase: string;
  remoteSchemas: string[];
  selectedSchema: string;
  remoteTables: TableSummary[];
  selectedTable: string | null;
  tableData: TableDataResult | null;
  tableSchema: ExtendedTableSchema | null;
  isLoadingTable: boolean;
  tableError: string | null;

  // Active View in Remote Mode: 'data' (rows), 'structure' (schema/constraints), 'redis' (key-value browser)
  activeRemoteView: 'data' | 'structure' | 'redis';

  // Redis State
  redisScanResult: RedisScanResult | null;
  selectedRedisKey: string | null;
  redisKeyValue: RedisValueResult | null;
  isLoadingRedis: boolean;

  // Actions
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  syncRemoteCatalogToDbStore: () => void;
  setActiveRemoteView: (view: 'data' | 'structure' | 'redis') => void;
  loadSavedConnections: () => Promise<void>;
  getSavedConnection: (id: string) => Promise<ConnectionConfig | null>;
  saveConnection: (cfg: ConnectionConfig) => Promise<ConnectionSummary | null>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (cfg: ConnectionConfig) => Promise<{ success: boolean; latencyMs: number; message?: string; error?: string }>;
  connect: (id: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  openLocalFile: (filePath: string) => Promise<boolean>;
  selectLocalFileDialog: () => Promise<string | null>;

  selectDatabase: (dbName: string) => Promise<void>;
  selectSchema: (schemaName: string) => Promise<void>;
  selectTable: (tableName: string) => Promise<void>;
  loadTableData: (table: string, page?: number, pageSize?: number, sortCol?: string, sortDir?: string, filter?: string) => Promise<void>;
  loadTableSchema: (table: string) => Promise<void>;
  executeRemoteQuery: (query: string, maxRows?: number) => Promise<QueryResult | null>;
  simulateRemoteQuery: (query: string) => Promise<SimulationResult | null>;
  applyPendingChanges: (changesJSON: string) => Promise<ChangeResult | null>;

  // Redis Actions
  scanRedisKeys: (pattern?: string, cursor?: number, count?: number) => Promise<void>;
  inspectRedisKey: (key: string) => Promise<void>;
  deleteRedisKey: (key: string) => Promise<boolean>;
  setRedisKey: (key: string, valType: string, value: string, ttlSec?: number) => Promise<boolean>;
}

export const useConnectionManagerStore = create<ConnectionManagerState>((set, get) => ({
  workspaceMode: 'mobile',
  savedConnections: [],
  activeSession: null,
  isConnecting: false,
  isLoadingConnections: false,
  connectionError: null,

  remoteDatabases: [],
  selectedDatabase: '',
  remoteSchemas: [],
  selectedSchema: '',
  remoteTables: [],
  selectedTable: null,
  tableData: null,
  tableSchema: null,
  isLoadingTable: false,
  tableError: null,

  activeRemoteView: 'data',

  redisScanResult: null,
  selectedRedisKey: null,
  redisKeyValue: null,
  isLoadingRedis: false,

  syncRemoteCatalogToDbStore: () => {
    const session = get().activeSession;
    if (!session) return;
    const rawTables = get().remoteTables || [];
    useDatabaseStore.getState().setDatabases([
      {
        id: session.currentDatabase || 'remote',
        name: session.config.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: session.config.engine === 'sqlite' ? 'sqlite' : (session.config.engine as any),
        path: session.config.filePath || `${session.config.host}:${session.config.port}`,
        tables: rawTables.map((t) => ({
          name: t.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: (t.type === 'VIEW' ? 'view' : 'table') as any,
          columns: (t.columns || []).map((col) => ({
            name: col.name,
            type: col.type || 'TEXT',
            isPrimaryKey: !!col.isPrimaryKey,
            isNullable: !!col.isNullable,
          })),
          rowCount: t.rowCount,
        })),
        sizeBytes: 0,
        updatedAt: Date.now(),
      },
    ]);
  },

  setWorkspaceMode: (mode) => {
    set({ workspaceMode: mode });
    if (mode === 'mobile') {
      // 1. Wipe remote database and table selections from useDatabaseStore
      useDatabaseStore.getState().resetState();
      // 2. Reset ADB state and initiate device scan
      useAdbStore.getState().resetAdbState();
      useAdbStore.getState().fetchDevices();
    } else if (mode === 'remote') {
      const activeSession = get().activeSession;
      if (activeSession) {
        get().syncRemoteCatalogToDbStore();
        const selectedTable = get().selectedTable;
        if (selectedTable) {
          get().loadTableData(selectedTable);
        }
      } else {
        useDatabaseStore.getState().resetState();
        get().loadSavedConnections();
      }
    }
  },
  setActiveRemoteView: (view) => set({ activeRemoteView: view }),

  loadSavedConnections: async () => {
    set({ isLoadingConnections: true });
    try {
      if (typeof window !== 'undefined' && AppBindings?.ListSavedConnections) {
        const list = await AppBindings.ListSavedConnections();
        set({ savedConnections: (list as unknown as ConnectionSummary[]) || [], isLoadingConnections: false });
      } else {
        set({ isLoadingConnections: false });
      }
    } catch (err) {
      set({ isLoadingConnections: false, connectionError: String(err) });
    }
  },

  getSavedConnection: async (id: string): Promise<ConnectionConfig | null> => {
    try {
      if (typeof window !== 'undefined' && (AppBindings as any)?.GetSavedConnection) {
        const raw = await (AppBindings as any).GetSavedConnection(id);
        if (raw) {
          return JSON.parse(raw) as ConnectionConfig;
        }
      }
      return null;
    } catch (err) {
      console.error('Failed to get saved connection:', err);
      return null;
    }
  },

  saveConnection: async (cfg: ConnectionConfig) => {
    try {
      if (typeof window !== 'undefined' && AppBindings?.SaveConnection) {
        const saved = await AppBindings.SaveConnection(JSON.stringify(cfg));
        await get().loadSavedConnections();
        return saved as unknown as ConnectionSummary;
      }
      return null;
    } catch (err) {
      set({ connectionError: String(err) });
      return null;
    }
  },

  deleteConnection: async (id: string) => {
    try {
      if (typeof window !== 'undefined' && AppBindings?.DeleteConnection) {
        await AppBindings.DeleteConnection(id);
        await get().loadSavedConnections();
        return true;
      }
      return false;
    } catch (err) {
      set({ connectionError: String(err) });
      return false;
    }
  },

  testConnection: async (cfg: ConnectionConfig) => {
    try {
      if (typeof window !== 'undefined' && AppBindings?.TestConnection) {
        const res = await AppBindings.TestConnection(JSON.stringify(cfg));
        return res;
      }
      return { success: false, latencyMs: 0, error: 'Wails bridge not available in browser' };
    } catch (err) {
      return { success: false, latencyMs: 0, error: String(err) };
    }
  },

  connect: async (id: string) => {
    set({ isConnecting: true, connectionError: null });
    try {
      if (typeof window !== 'undefined' && AppBindings?.OpenConnection) {
        const session = await AppBindings.OpenConnection(id);
        const typedSession = session as unknown as ConnectionSession;

        set({
          activeSession: typedSession,
          workspaceMode: 'remote',
          isConnecting: false,
          selectedDatabase: typedSession.currentDatabase,
          selectedSchema: typedSession.currentSchema,
          activeRemoteView: typedSession.config.engine === 'redis' ? 'redis' : 'data',
        });

        // Auto-discover remote databases, schemas, and tables
        if (typedSession.config.engine === 'redis') {
          await get().scanRedisKeys();
        } else {
          const dbs = await AppBindings.RemoteListDatabases(typedSession.sessionId);
          const schemas = await AppBindings.RemoteListSchemas(typedSession.sessionId, typedSession.currentDatabase);
          const tables = await AppBindings.RemoteListTables(typedSession.sessionId, typedSession.currentDatabase, typedSession.currentSchema);

          const rawTables = (tables as unknown as TableSummary[]) || [];
          set({
            remoteDatabases: dbs || [typedSession.currentDatabase],
            remoteSchemas: schemas || [typedSession.currentSchema],
            remoteTables: rawTables,
          });

          // Sync database catalog to useDatabaseStore for unified Playground and Inspector access
          get().syncRemoteCatalogToDbStore();

          if (tables && tables.length > 0) {
            await get().selectTable(tables[0].name);
          }
        }
        return true;
      }
      set({ isConnecting: false });
      return false;
    } catch (err) {
      set({ isConnecting: false, connectionError: String(err) });
      return false;
    }
  },

  disconnect: async () => {
    const session = get().activeSession;
    if (session && typeof window !== 'undefined' && AppBindings?.CloseConnection) {
      try {
        await AppBindings.CloseConnection(session.sessionId);
      } catch {
        // Ignored
      }
    }
    set({
      activeSession: null,
      workspaceMode: 'remote',
      remoteDatabases: [],
      selectedDatabase: '',
      remoteSchemas: [],
      selectedSchema: '',
      remoteTables: [],
      selectedTable: null,
      tableData: null,
      tableSchema: null,
      redisScanResult: null,
      selectedRedisKey: null,
      redisKeyValue: null,
    });
    await get().loadSavedConnections();

    // Reset database store so inspector/grid is cleanly reset
    useDatabaseStore.getState().resetState();
  },

  openLocalFile: async (filePath: string) => {
    set({ isConnecting: true, connectionError: null });
    try {
      if (typeof window !== 'undefined' && AppBindings?.OpenLocalSQLiteFile) {
        const session = await AppBindings.OpenLocalSQLiteFile(filePath);
        const typedSession = session as unknown as ConnectionSession;

        set({
          activeSession: typedSession,
          workspaceMode: 'remote',
          isConnecting: false,
          selectedDatabase: typedSession.currentDatabase,
          selectedSchema: 'main',
          activeRemoteView: 'data',
        });

        const tables = await AppBindings.RemoteListTables(typedSession.sessionId, typedSession.currentDatabase, 'main');
        const rawTables = (tables as unknown as TableSummary[]) || [];
        set({
          remoteDatabases: [typedSession.currentDatabase],
          remoteSchemas: ['main'],
          remoteTables: rawTables,
        });

        get().syncRemoteCatalogToDbStore();

        if (tables && tables.length > 0) {
          await get().selectTable(tables[0].name);
        }
        return true;
      }
      return false;
    } catch (err) {
      set({ isConnecting: false, connectionError: String(err) });
      return false;
    }
  },

  selectLocalFileDialog: async () => {
    try {
      if (typeof window !== 'undefined' && AppBindings?.SelectLocalSQLiteDialog) {
        const path = await AppBindings.SelectLocalSQLiteDialog();
        if (path) {
          await get().openLocalFile(path);
          return path;
        }
      }
      return null;
    } catch (err) {
      set({ connectionError: String(err) });
      return null;
    }
  },

  selectDatabase: async (dbName: string) => {
    const session = get().activeSession;
    if (!session) return;
    set({ selectedDatabase: dbName });

    try {
      const schemas = await AppBindings.RemoteListSchemas(session.sessionId, dbName);
      const defaultSchema = schemas && schemas.length > 0 ? schemas[0] : 'public';
      set({ remoteSchemas: schemas || [defaultSchema], selectedSchema: defaultSchema });

      const tables = await AppBindings.RemoteListTables(session.sessionId, dbName, defaultSchema);
      const rawTables = (tables as unknown as TableSummary[]) || [];
      set({ remoteTables: rawTables });

      get().syncRemoteCatalogToDbStore();

      if (tables && tables.length > 0) {
        await get().selectTable(tables[0].name);
      } else {
        set({ selectedTable: null, tableData: null, tableSchema: null });
      }
    } catch (err) {
      set({ tableError: String(err) });
    }
  },

  selectSchema: async (schemaName: string) => {
    const session = get().activeSession;
    if (!session) return;
    set({ selectedSchema: schemaName });

    try {
      const tables = await AppBindings.RemoteListTables(session.sessionId, get().selectedDatabase, schemaName);
      const rawTables = (tables as unknown as TableSummary[]) || [];
      set({ remoteTables: rawTables });

      get().syncRemoteCatalogToDbStore();

      if (tables && tables.length > 0) {
        await get().selectTable(tables[0].name);
      } else {
        set({ selectedTable: null, tableData: null, tableSchema: null });
      }
    } catch (err) {
      set({ tableError: String(err) });
    }
  },

  selectTable: async (tableName: string) => {
    set({ selectedTable: tableName });
    await Promise.all([
      get().loadTableData(tableName, 1, 50),
      get().loadTableSchema(tableName),
    ]);
  },

  loadTableData: async (tableName: string, page = 1, pageSize = 50, sortCol = '', sortDir = '', filter = '') => {
    const session = get().activeSession;
    if (!session) return;

    set({ isLoadingTable: true, tableError: null });
    try {
      const res = await AppBindings.RemoteGetTableData(
        session.sessionId,
        get().selectedSchema,
        tableName,
        page,
        pageSize,
        sortCol,
        sortDir,
        filter
      );
      const typedRes = res as unknown as TableDataResult;
      set({ tableData: typedRes, isLoadingTable: false });

      // Sync to useDatabaseStore for unified DataGrid display and Playground
      const dbStore = useDatabaseStore.getState();
      if (dbStore.selectedTableName !== tableName) {
        dbStore.selectTable(tableName);
      }
      dbStore.setTableData({
        databaseId: session.config.database || 'remote',
        tableName: typedRes.tableName,
        totalRows: typedRes.totalRows,
        page: typedRes.page || page,
        pageSize: typedRes.pageSize || pageSize,
        columns: typedRes.columns,
        rows: typedRes.rows,
      });
      dbStore.setPage(typedRes.page || page);
    } catch (err) {
      set({ isLoadingTable: false, tableError: String(err) });
    }
  },

  loadTableSchema: async (tableName: string) => {
    const session = get().activeSession;
    if (!session) return;

    try {
      const res = await AppBindings.RemoteGetTableSchema(
        session.sessionId,
        get().selectedDatabase,
        get().selectedSchema,
        tableName
      );
      if (res) {
        const raw = res as any;
        const normalized: ExtendedTableSchema = {
          name: raw.name || raw.tableName || tableName,
          tableName: raw.tableName || raw.name || tableName,
          schema: raw.schema || get().selectedSchema || '',
          type: raw.type || 'table',
          rowCount: raw.rowCount ?? 0,
          columns: (raw.columns || []).map((col: any) => ({
            name: col.name,
            type: col.type,
            isPrimaryKey: !!col.isPrimaryKey,
            isNullable: !!col.isNullable,
            defaultValue: col.defaultValue || '',
            extra: col.extra || '',
            comment: col.comment || '',
          })),
          primaryKeys: raw.primaryKeys || [],
          indexes: (raw.indexes || []).map((idx: any, i: number) => ({
            seq: i,
            name: idx.name || `idx_${i}`,
            unique: idx.isUnique ?? idx.unique ?? false,
            isUnique: idx.isUnique ?? idx.unique ?? false,
            isPrimary: idx.isPrimary ?? false,
            origin: idx.origin || idx.type || 'BTREE',
            type: idx.type || idx.origin || 'BTREE',
            partial: false,
            columns: idx.columns || [],
          })),
          foreignKeys: (raw.foreignKeys || []).map((fk: any, i: number) => ({
            id: i,
            seq: i,
            constraintName: fk.constraintName || '',
            column: fk.column || fk.fromCol || '',
            refTable: fk.refTable || fk.toTable || '',
            refColumn: fk.refColumn || fk.toCol || '',
            fromCol: fk.column || fk.fromCol || '',
            toTable: fk.refTable || fk.toTable || '',
            toCol: fk.refColumn || fk.toCol || '',
            onUpdate: fk.onUpdate || 'NO ACTION',
            onDelete: fk.onDelete || 'NO ACTION',
          })),
        };
        set({ tableSchema: normalized });

        // Sync columns to useDatabaseStore for this specific table if in remote mode
        if (get().workspaceMode === 'remote') {
          const currentDbs = useDatabaseStore.getState().databases;
          if (currentDbs && currentDbs.length > 0) {
            const updatedDbs = currentDbs.map((db) => ({
              ...db,
              tables: db.tables.map((t) =>
                t.name.toLowerCase() === tableName.toLowerCase()
                  ? {
                      ...t,
                      columns: normalized.columns.map((c) => ({
                        name: c.name,
                        type: c.type || 'TEXT',
                        isPrimaryKey: c.isPrimaryKey,
                        isNullable: c.isNullable,
                      })),
                    }
                  : t
              ),
            }));
            useDatabaseStore.getState().setDatabases(updatedDbs);
          }
        }
      }
    } catch {
      // Ignored
    }
  },

  executeRemoteQuery: async (query: string, maxRows = 100) => {
    const session = get().activeSession;
    if (!session) return null;

    try {
      const res = await AppBindings.RemoteExecuteQuery(session.sessionId, query, maxRows);
      const typed = res as unknown as QueryResult;
      if (typed) {
        useDatabaseStore.getState().setLatestQueryResult(typed);
      }
      return typed;
    } catch (err) {
      const errRes: QueryResult = {
        requestId: `req_${Date.now()}`,
        databaseId: session.config.database || 'remote',
        query,
        columns: [],
        rows: [],
        affected: 0,
        durationMs: 0,
        success: false,
        error: String(err),
      };
      useDatabaseStore.getState().setLatestQueryResult(errRes);
      return errRes;
    }
  },

  simulateRemoteQuery: async (query: string): Promise<SimulationResult | null> => {
    const session = get().activeSession;
    if (!session) return null;

    try {
      const res = await AppBindings.RemoteSimulateQuery(session.sessionId, query);
      return res as unknown as SimulationResult;
    } catch (err) {
      return {
        query,
        isMutation: true,
        affectedRows: 0,
        durationMs: 0,
        success: false,
        error: String(err),
      };
    }
  },

  applyPendingChanges: async (changesJSON: string) => {
    const session = get().activeSession;
    if (!session) return null;

    try {
      let payload = changesJSON;
      try {
        const parsed = JSON.parse(changesJSON);
        if (Array.isArray(parsed)) {
          payload = JSON.stringify({ changes: parsed });
        }
      } catch {
        // use raw changesJSON
      }

      const res = await AppBindings.RemoteApplyPendingChanges(session.sessionId, payload);
      return res as unknown as ChangeResult;
    } catch (err) {
      return {
        success: false,
        affectedRows: 0,
        durationMs: 0,
        error: String(err),
      };
    }
  },

  scanRedisKeys: async (pattern = '*', cursor = 0, count = 100) => {
    const session = get().activeSession;
    if (!session || session.config.engine !== 'redis') return;

    set({ isLoadingRedis: true });
    try {
      const res = await AppBindings.RedisScan(session.sessionId, pattern, cursor, count);
      set({ redisScanResult: res as unknown as RedisScanResult, isLoadingRedis: false });
    } catch (err) {
      set({ isLoadingRedis: false, tableError: String(err) });
    }
  },

  inspectRedisKey: async (key: string) => {
    const session = get().activeSession;
    if (!session) return;

    set({ selectedRedisKey: key, isLoadingRedis: true });
    try {
      const res = await AppBindings.RedisGet(session.sessionId, key);
      set({ redisKeyValue: res as unknown as RedisValueResult, isLoadingRedis: false });
    } catch (err) {
      set({ isLoadingRedis: false, tableError: String(err) });
    }
  },

  deleteRedisKey: async (key: string) => {
    const session = get().activeSession;
    if (!session) return false;

    try {
      await AppBindings.RedisDel(session.sessionId, key);
      await get().scanRedisKeys();
      set({ selectedRedisKey: null, redisKeyValue: null });
      return true;
    } catch {
      return false;
    }
  },

  setRedisKey: async (key: string, valType: string, value: string, ttlSec = 0) => {
    const session = get().activeSession;
    if (!session) return false;

    try {
      await AppBindings.RedisSet(session.sessionId, key, valType, value, ttlSec);
      await get().scanRedisKeys();
      await get().inspectRedisKey(key);
      return true;
    } catch {
      return false;
    }
  },
}));
