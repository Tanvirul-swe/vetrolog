import { create } from 'zustand';
import {
  ExtendedSchemaResult,
  QueryPlanResult,
  SimulationResult,
  AIConfig,
} from '@/types/database';
import { apiBridge } from '@/services/apiBridge';
import { useAdbStore } from './useAdbStore';
import { useDatabaseStore } from './useDatabaseStore';

export type PlaygroundTab = 'results' | 'plan' | 'profiler' | 'advisor' | 'codegen' | 'history';
export type WorkspaceView = 'grid' | 'playground';

export interface HistoryItem {
  id: string;
  query: string;
  durationMs: number;
  timestamp: number;
  success: boolean;
  rowsCount: number;
  error?: string;
}

interface PlaygroundState {
  // Navigation & Workspace
  activeWorkspaceView: WorkspaceView;
  setActiveWorkspaceView: (view: WorkspaceView) => void;

  // Editor
  query: string;
  setQuery: (query: string) => void;
  activeTab: PlaygroundTab;
  setActiveTab: (tab: PlaygroundTab) => void;

  // Operations State
  isExecuting: boolean;
  isExplaining: boolean;
  isSimulating: boolean;
  queryPlan: QueryPlanResult | null;
  simulation: SimulationResult | null;
  extendedSchema: ExtendedSchemaResult | null;
  isLoadingSchema: boolean;

  // Profiler Metrics
  profilerHistory: number[]; // recent execution durations
  lastSelectivity: number | null;

  // History & Bookmarks
  executionHistory: HistoryItem[];

  // AI BYOK Settings
  aiConfig: AIConfig;
  isAiSettingsOpen: boolean;
  setIsAiSettingsOpen: (open: boolean) => void;
  setAiConfig: (config: Partial<AIConfig>) => void;

  // Actions
  loadExtendedSchema: () => Promise<void>;
  runExecute: (overrideSql?: string) => Promise<void>;
  cancelExecution: () => void;
  formatSql: () => void;
  runExplain: (overrideSql?: string) => Promise<void>;
  runDryRun: (overrideSql?: string) => Promise<void>;
  applyIndex: (indexSql: string) => Promise<boolean>;
  updateResultCell: (
    tableName: string,
    pkField: string,
    pkValue: unknown,
    colName: string,
    newVal: unknown
  ) => Promise<boolean>;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'offline',
  modelName: 'gemini-1.5-flash',
  ollamaBaseUrl: 'http://localhost:11434',
};

function loadStoredAiConfig(): AIConfig {
  try {
    const raw = localStorage.getItem('vetrolog_ai_config');
    if (raw) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch {
    // Ignore storage parse issues
  }
  return DEFAULT_AI_CONFIG;
}

function formatSqlQuery(sql: string): string {
  if (!sql.trim()) return sql;
  const keywords = [
    'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
    'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'CROSS JOIN', 'JOIN', 'ON',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'PRAGMA',
    'ASC', 'DESC', 'NULL', 'IS NOT NULL', 'IS NULL', 'IN', 'LIKE', 'BETWEEN', 'UNION', 'ALL'
  ];

  let formatted = sql.trim();
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    formatted = formatted.replace(regex, kw);
  });

  const majorClauses = [
    'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT',
    'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'CROSS JOIN', 'JOIN',
    'SET', 'VALUES'
  ];
  majorClauses.forEach((clause) => {
    const regex = new RegExp(`\\s+(${clause})\\b`, 'g');
    formatted = formatted.replace(regex, '\n$1');
  });

  return formatted;
}

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  activeWorkspaceView: 'grid',
  setActiveWorkspaceView: (view) => set({ activeWorkspaceView: view }),

  query: 'SELECT * FROM sqlite_master WHERE type="table";',
  setQuery: (query) => set({ query }),
  activeTab: 'results',
  setActiveTab: (activeTab) => {
    set({ activeTab });
    if ((activeTab === 'plan' || activeTab === 'advisor') && get().query.trim()) {
      get().runExplain();
    }
  },

  isExecuting: false,
  isExplaining: false,
  isSimulating: false,
  queryPlan: null,
  simulation: null,
  extendedSchema: null,
  isLoadingSchema: false,

  profilerHistory: [],
  lastSelectivity: null,
  executionHistory: [],

  aiConfig: loadStoredAiConfig(),
  isAiSettingsOpen: false,
  setIsAiSettingsOpen: (open) => set({ isAiSettingsOpen: open }),
  setAiConfig: (update) =>
    set((state) => {
      const merged = { ...state.aiConfig, ...update };
      try {
        localStorage.setItem('vetrolog_ai_config', JSON.stringify(merged));
      } catch {
        // Safe fallback
      }
      return { aiConfig: merged };
    }),

  cancelExecution: () => {
    set({ isExecuting: false, isExplaining: false, isSimulating: false });
  },

  formatSql: () => {
    const current = get().query;
    set({ query: formatSqlQuery(current) });
  },

  loadExtendedSchema: async () => {
    const deviceId = useAdbStore.getState().selectedDeviceId;
    const packageName = useAdbStore.getState().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || useAdbStore.getState().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return;

    set({ isLoadingSchema: true });
    try {
      const schema = await apiBridge.getExtendedSchema(deviceId, packageName, remotePath);
      set({ extendedSchema: schema });
    } catch {
      // Ignore schema load error
    } finally {
      set({ isLoadingSchema: false });
    }
  },

  runExecute: async (overrideSql) => {
    const sql = overrideSql || get().query;
    if (!sql.trim()) return;

    set({ isExecuting: true });
    const startTime = performance.now();

    try {
      const result = await useAdbStore.getState().executeQuery(sql);
      const elapsed = performance.now() - startTime;

      if (result) {
        // Calculate selectivity
        const rowsReturned = result.rows ? result.rows.length : 0;
        const totalRowsEstimate = useDatabaseStore.getState().totalRows || rowsReturned || 1;
        const selectivity = Math.min(100, Math.round((rowsReturned / totalRowsEstimate) * 100));

        set((state) => ({
          activeTab: 'results',
          lastSelectivity: selectivity,
          profilerHistory: [...state.profilerHistory.slice(-9), result.durationMs || elapsed],
          executionHistory: [
            {
              id: `run_${Date.now()}`,
              query: sql,
              durationMs: result.durationMs || elapsed,
              timestamp: Date.now(),
              success: result.success,
              rowsCount: rowsReturned,
              error: result.error,
            },
            ...state.executionHistory.slice(0, 49),
          ],
        }));

        // Trigger Explain on demand only if user is actively inspecting Plan or Advisor
        if (get().activeTab === 'plan' || get().activeTab === 'advisor') {
          get().runExplain(sql);
        }
      }
    } catch (err) {
      console.error('Playground executeQuery error:', err);
    } finally {
      set({ isExecuting: false });
    }
  },

  runExplain: async (overrideSql) => {
    const sql = overrideSql || get().query;
    if (!sql.trim()) return;

    const deviceId = useAdbStore.getState().selectedDeviceId;
    const packageName = useAdbStore.getState().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || useAdbStore.getState().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return;

    set({ isExplaining: true });
    try {
      const plan = await apiBridge.explainQuery(deviceId, packageName, remotePath, sql);
      set({ queryPlan: plan });
    } catch (e: any) {
      set({
        queryPlan: {
          rawNodes: [],
          rootNodes: [],
          hasFullScan: false,
          hasTempBTree: false,
          summary: 'Failed to explain query',
          durationMs: 0,
          success: false,
          error: e.message || 'Explain failed',
        },
      });
    } finally {
      set({ isExplaining: false });
    }
  },

  runDryRun: async (overrideSql) => {
    const sql = overrideSql || get().query;
    if (!sql.trim()) return;

    const deviceId = useAdbStore.getState().selectedDeviceId;
    const packageName = useAdbStore.getState().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || useAdbStore.getState().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return;

    set({ isSimulating: true });
    try {
      const sim = await apiBridge.simulateQuery(deviceId, packageName, remotePath, sql);
      set({ simulation: sim });
    } catch (e: any) {
      set({
        simulation: {
          query: sql,
          isMutation: true,
          affectedRows: 0,
          durationMs: 0,
          success: false,
          error: e.message || 'Dry-run simulation failed',
        },
      });
    } finally {
      set({ isSimulating: false });
    }
  },

  applyIndex: async (indexSql: string) => {
    const deviceId = useAdbStore.getState().selectedDeviceId;
    const packageName = useAdbStore.getState().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || useAdbStore.getState().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return false;

    try {
      const ok = await apiBridge.createIndex(deviceId, packageName, remotePath, indexSql);
      if (ok) {
        // Re-load schema and re-explain current query to show updated index in tree
        await get().loadExtendedSchema();
        await get().runExplain();
      }
      return ok;
    } catch (e) {
      console.error('Failed to apply index:', e);
      return false;
    }
  },

  updateResultCell: async (tableName, pkField, pkValue, colName, newVal) => {
    const deviceId = useAdbStore.getState().selectedDeviceId;
    const packageName = useAdbStore.getState().selectedPackageName;
    const selectedDbId = useDatabaseStore.getState().selectedDatabaseId;
    const databases = useDatabaseStore.getState().databases;

    const currentDb = databases.find((d) => d.id === selectedDbId);
    const remotePath = currentDb?.path || useAdbStore.getState().selectedDbRemotePath;

    if (!deviceId || !packageName || !remotePath) return false;

    try {
      const success = await apiBridge.updateRow(
        deviceId,
        packageName,
        remotePath,
        tableName,
        { [pkField]: pkValue },
        { [colName]: newVal }
      );

      if (success) {
        // Update latestQueryResult in database store
        const currentResult = useDatabaseStore.getState().latestQueryResult;
        if (currentResult && currentResult.rows) {
          const updatedRows = currentResult.rows.map((r) =>
            r[pkField] === pkValue ? { ...r, [colName]: newVal } : r
          );
          useDatabaseStore.getState().setLatestQueryResult({
            ...currentResult,
            rows: updatedRows,
          });
        }
      }
      return success;
    } catch {
      return false;
    }
  },
}));
