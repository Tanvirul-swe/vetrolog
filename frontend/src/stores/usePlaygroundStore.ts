import { create } from 'zustand';
import {
  ExtendedSchemaResult,
  QueryPlanResult,
  SimulationResult,
  AIConfig,
} from '@/types/database';
import { apiBridge } from '@/services/apiBridge';
import { formatSqlIdentifier } from '@/features/playground/services/sqlIdentifier';
import { useAdbStore } from './useAdbStore';
import { useDatabaseStore } from './useDatabaseStore';

export type PlaygroundTab = 'results' | 'plan' | 'profiler' | 'advisor' | 'history';
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

export interface QueryResultData {
  requestId: string;
  databaseId: string;
  query: string;
  columns: { name: string; type: string }[];
  rows: Record<string, unknown>[];
  affected: number;
  durationMs: number;
  success: boolean;
  error?: string;
  defaultLimitApplied?: boolean;
}

export interface QueryTab {
  id: string;
  title: string;
  query: string;
  createdAt: number;
  databaseId?: string;
  isExecuting?: boolean;
  result?: QueryResultData | null;
  queryPlan?: QueryPlanResult | null;
  filterText?: string;
  sortCol?: string | null;
  sortAsc?: boolean;
  currentPage?: number;
  pageSize?: number;
}

interface PlaygroundState {
  // Navigation & Workspace
  activeWorkspaceView: WorkspaceView;
  setActiveWorkspaceView: (view: WorkspaceView) => void;

  // Tabs State
  tabs: QueryTab[];
  activeTabId: string;
  addTab: (initialQuery?: string, title?: string, databaseId?: string) => string;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToTheRight: (tabId: string) => void;
  duplicateTab: (tabId: string) => string;
  renameTab: (tabId: string, newTitle: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateActiveTabState: (updates: Partial<QueryTab>) => void;
  openTableInPlayground: (tableName: string) => Promise<void>;

  // Editor (bound to activeTab)
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
  profilerHistory: number[];
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

const TABS_STORAGE_KEY = 'vetrolog_query_tabs';
const DEFAULT_INITIAL_QUERY = "SELECT * FROM sqlite_master WHERE type = 'table';";

function loadStoredAiConfig(): AIConfig {
  try {
    const raw = localStorage.getItem('vetrolog_ai_config');
    if (raw) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch {
    // Ignore storage parse issues
  }
  return DEFAULT_AI_CONFIG;
}

function loadStoredTabs(): { tabs: QueryTab[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const tabs: QueryTab[] = parsed.tabs.map((t: any, idx: number) => ({
          id: t.id || `tab_${Date.now()}_${idx}`,
          title: t.title || `Query ${idx + 1}`,
          query: typeof t.query === 'string' ? t.query : DEFAULT_INITIAL_QUERY,
          createdAt: t.createdAt || Date.now(),
          databaseId: t.databaseId || undefined,
          result: null,
          queryPlan: null,
          filterText: '',
          sortCol: null,
          sortAsc: true,
          currentPage: 1,
          pageSize: 50,
        }));
        const activeTabId = tabs.some((t) => t.id === parsed.activeTabId)
          ? parsed.activeTabId
          : tabs[0].id;
        return { tabs, activeTabId };
      }
    }
  } catch {
    // Ignore parse issues
  }

  const defaultTab: QueryTab = {
    id: `tab_${Date.now()}`,
    title: 'Query 1',
    query: DEFAULT_INITIAL_QUERY,
    createdAt: Date.now(),
    filterText: '',
    sortCol: null,
    sortAsc: true,
    currentPage: 1,
    pageSize: 50,
  };
  return { tabs: [defaultTab], activeTabId: defaultTab.id };
}

function saveTabsToStorage(tabs: QueryTab[], activeTabId: string) {
  try {
    const serialized = tabs.map((t) => ({
      id: t.id,
      title: t.title,
      query: t.query,
      createdAt: t.createdAt,
      databaseId: t.databaseId,
    }));
    localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ tabs: serialized, activeTabId })
    );
  } catch {
    // Ignore storage write issues
  }
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

const initialTabsState = loadStoredTabs();
const initialActiveTab = initialTabsState.tabs.find((t) => t.id === initialTabsState.activeTabId) || initialTabsState.tabs[0];

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  activeWorkspaceView: 'grid',
  setActiveWorkspaceView: (view) => set({ activeWorkspaceView: view }),

  tabs: initialTabsState.tabs,
  activeTabId: initialTabsState.activeTabId,

  addTab: (initialQuery, title, databaseId) => {
    const state = get();
    const newId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nextNumber = state.tabs.length + 1;
    const currentDbId = databaseId || useDatabaseStore.getState().selectedDatabaseId || undefined;
    const newTab: QueryTab = {
      id: newId,
      title: title || `Query ${nextNumber}`,
      query: initialQuery !== undefined ? initialQuery : DEFAULT_INITIAL_QUERY,
      createdAt: Date.now(),
      databaseId: currentDbId,
      filterText: '',
      sortCol: null,
      sortAsc: true,
      currentPage: 1,
      pageSize: 50,
      result: null,
      queryPlan: null,
    };
    const updatedTabs = [...state.tabs, newTab];
    set({
      tabs: updatedTabs,
      activeTabId: newId,
      query: newTab.query,
      queryPlan: null,
    });
    saveTabsToStorage(updatedTabs, newId);
    return newId;
  },

  closeTab: (tabId) => {
    const state = get();
    // If only one tab left, reset it rather than leaving empty workspace
    if (state.tabs.length <= 1) {
      const resetTab: QueryTab = {
        id: `tab_${Date.now()}`,
        title: 'Query 1',
        query: DEFAULT_INITIAL_QUERY,
        createdAt: Date.now(),
        filterText: '',
        sortCol: null,
        sortAsc: true,
        currentPage: 1,
        pageSize: 50,
        result: null,
        queryPlan: null,
      };
      set({
        tabs: [resetTab],
        activeTabId: resetTab.id,
        query: resetTab.query,
        queryPlan: null,
      });
      saveTabsToStorage([resetTab], resetTab.id);
      return;
    }

    const closeIndex = state.tabs.findIndex((t) => t.id === tabId);
    const updatedTabs = state.tabs.filter((t) => t.id !== tabId);

    let nextActiveId = state.activeTabId;
    if (state.activeTabId === tabId) {
      const nextIndex = Math.max(0, closeIndex - 1);
      nextActiveId = updatedTabs[nextIndex]?.id || updatedTabs[0].id;
    }

    const nextTab = updatedTabs.find((t) => t.id === nextActiveId) || updatedTabs[0];
    set({
      tabs: updatedTabs,
      activeTabId: nextActiveId,
      query: nextTab.query,
      queryPlan: nextTab.queryPlan || null,
    });
    saveTabsToStorage(updatedTabs, nextActiveId);
  },

  closeOtherTabs: (tabId) => {
    const state = get();
    const keptTab = state.tabs.find((t) => t.id === tabId) || state.tabs[0];
    const updatedTabs = [keptTab];
    set({
      tabs: updatedTabs,
      activeTabId: keptTab.id,
      query: keptTab.query,
      queryPlan: keptTab.queryPlan || null,
    });
    saveTabsToStorage(updatedTabs, keptTab.id);
  },

  closeTabsToTheRight: (tabId) => {
    const state = get();
    const targetIdx = state.tabs.findIndex((t) => t.id === tabId);
    if (targetIdx === -1) return;

    const updatedTabs = state.tabs.slice(0, targetIdx + 1);
    let nextActiveId = state.activeTabId;
    if (!updatedTabs.some((t) => t.id === nextActiveId)) {
      nextActiveId = tabId;
    }
    const nextTab = updatedTabs.find((t) => t.id === nextActiveId) || updatedTabs[0];
    set({
      tabs: updatedTabs,
      activeTabId: nextActiveId,
      query: nextTab.query,
      queryPlan: nextTab.queryPlan || null,
    });
    saveTabsToStorage(updatedTabs, nextActiveId);
  },

  duplicateTab: (tabId) => {
    const state = get();
    const sourceTab = state.tabs.find((t) => t.id === tabId);
    if (!sourceTab) return state.activeTabId;

    const newId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTab: QueryTab = {
      ...sourceTab,
      id: newId,
      title: `${sourceTab.title} (Copy)`,
      createdAt: Date.now(),
    };

    const targetIdx = state.tabs.findIndex((t) => t.id === tabId);
    const updatedTabs = [
      ...state.tabs.slice(0, targetIdx + 1),
      newTab,
      ...state.tabs.slice(targetIdx + 1),
    ];

    set({
      tabs: updatedTabs,
      activeTabId: newId,
      query: newTab.query,
      queryPlan: newTab.queryPlan || null,
    });
    saveTabsToStorage(updatedTabs, newId);
    return newId;
  },

  renameTab: (tabId, newTitle) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    set((state) => {
      const updatedTabs = state.tabs.map((t) =>
        t.id === tabId ? { ...t, title: trimmed } : t
      );
      saveTabsToStorage(updatedTabs, state.activeTabId);
      return { tabs: updatedTabs };
    });
  },

  setActiveTabId: (tabId) => {
    const state = get();
    const targetTab = state.tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    // If tab has a bound database, sync selectedDatabaseId to it
    if (targetTab.databaseId) {
      const currentSelected = useDatabaseStore.getState().selectedDatabaseId;
      if (currentSelected !== targetTab.databaseId) {
        useDatabaseStore.getState().selectDatabase(targetTab.databaseId);
        const db = useDatabaseStore.getState().databases.find((d) => d.id === targetTab.databaseId);
        if (db?.path) {
          useAdbStore.getState().setSelectedDbRemotePath(db.path);
        }
      }
    }

    set({
      activeTabId: tabId,
      query: targetTab.query,
      queryPlan: targetTab.queryPlan || null,
    });
    saveTabsToStorage(state.tabs, tabId);
    get().loadExtendedSchema();
  },

  updateActiveTabState: (updates) => {
    set((state) => {
      const updatedTabs = state.tabs.map((t) =>
        t.id === state.activeTabId ? { ...t, ...updates } : t
      );
      return { tabs: updatedTabs };
    });
  },

  openTableInPlayground: async (tableName) => {
    const state = get();
    const formattedTable = formatSqlIdentifier(tableName);
    const targetSql = `SELECT * FROM ${formattedTable} LIMIT 50;`;
    const currentDbId = useDatabaseStore.getState().selectedDatabaseId || undefined;

    // 1. Check if a tab is already open for this specific table
    const existingTab = state.tabs.find(
      (t) => t.title.toLowerCase() === tableName.toLowerCase()
    );

    if (existingTab) {
      set({
        activeTabId: existingTab.id,
        query: existingTab.query,
        queryPlan: existingTab.queryPlan || null,
        activeTab: 'results',
      });
      saveTabsToStorage(state.tabs, existingTab.id);
      if (!existingTab.result || !existingTab.result.success) {
        await get().runExecute(existingTab.query);
      }
      return;
    }

    // 2. Check if current active tab is pristine/default and can be repurposed
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    const isPristine =
      activeTab &&
      activeTab.title.startsWith('Query ') &&
      !activeTab.result &&
      (activeTab.query === DEFAULT_INITIAL_QUERY || !activeTab.query.trim());

    if (isPristine) {
      const updatedTabs = state.tabs.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              title: tableName,
              query: targetSql,
              databaseId: currentDbId,
            }
          : t
      );
      set({
        tabs: updatedTabs,
        query: targetSql,
        activeTab: 'results',
      });
      saveTabsToStorage(updatedTabs, activeTab.id);
      await get().runExecute(targetSql);
      return;
    }

    // 3. Otherwise, open a new tab for this table
    const newId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTab: QueryTab = {
      id: newId,
      title: tableName,
      query: targetSql,
      createdAt: Date.now(),
      databaseId: currentDbId,
      filterText: '',
      sortCol: null,
      sortAsc: true,
      currentPage: 1,
      pageSize: 50,
      result: null,
      queryPlan: null,
    };
    const updatedTabs = [...state.tabs, newTab];
    set({
      tabs: updatedTabs,
      activeTabId: newId,
      query: targetSql,
      queryPlan: null,
      activeTab: 'results',
    });
    saveTabsToStorage(updatedTabs, newId);
    await get().runExecute(targetSql);
  },

  query: initialActiveTab.query,
  setQuery: (query) => {
    set((state) => {
      const updatedTabs = state.tabs.map((t) =>
        t.id === state.activeTabId ? { ...t, query } : t
      );
      saveTabsToStorage(updatedTabs, state.activeTabId);
      return { query, tabs: updatedTabs };
    });
  },

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
    set((state) => ({
      isExecuting: false,
      isExplaining: false,
      isSimulating: false,
      tabs: state.tabs.map((t) =>
        t.id === state.activeTabId ? { ...t, isExecuting: false } : t
      ),
    }));
  },

  formatSql: () => {
    const current = get().query;
    get().setQuery(formatSqlQuery(current));
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

    const targetTabId = get().activeTabId;

    set((state) => ({
      isExecuting: true,
      tabs: state.tabs.map((t) =>
        t.id === targetTabId ? { ...t, isExecuting: true } : t
      ),
    }));

    const startTime = performance.now();

    try {
      const result = await useAdbStore.getState().executeQuery(sql);
      const elapsed = performance.now() - startTime;

      if (result) {
        const rowsReturned = result.rows ? result.rows.length : 0;
        const totalRowsEstimate = useDatabaseStore.getState().totalRows || rowsReturned || 1;
        const selectivity = Math.min(100, Math.round((rowsReturned / totalRowsEstimate) * 100));

        const tabResult: QueryResultData = {
          requestId: `adb_${Date.now()}`,
          databaseId: useDatabaseStore.getState().selectedDatabaseId || '',
          query: sql,
          columns: (result.columns || []).map((col: string) => ({
            name: col,
            type: 'TEXT',
          })),
          rows: result.rows || [],
          affected: result.affected || 0,
          durationMs: result.durationMs || elapsed,
          success: result.success,
          error: result.error,
          defaultLimitApplied: Boolean(result.defaultLimitApplied),
        };

        set((state) => ({
          activeTab: 'results',
          lastSelectivity: selectivity,
          profilerHistory: [...state.profilerHistory.slice(-9), result.durationMs || elapsed],
          tabs: state.tabs.map((t) =>
            t.id === targetTabId
              ? {
                  ...t,
                  isExecuting: false,
                  result: tabResult,
                }
              : t
          ),
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
      set((state) => ({
        isExecuting: false,
        tabs: state.tabs.map((t) =>
          t.id === targetTabId ? { ...t, isExecuting: false } : t
        ),
      }));
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

    const targetTabId = get().activeTabId;
    set({ isExplaining: true });

    try {
      const plan = await apiBridge.explainQuery(deviceId, packageName, remotePath, sql);
      set((state) => ({
        queryPlan: plan,
        tabs: state.tabs.map((t) =>
          t.id === targetTabId ? { ...t, queryPlan: plan } : t
        ),
      }));
    } catch (e: any) {
      const fallbackPlan: QueryPlanResult = {
        rawNodes: [],
        rootNodes: [],
        hasFullScan: false,
        hasTempBTree: false,
        summary: 'Failed to explain query',
        durationMs: 0,
        success: false,
        error: e.message || 'Explain failed',
      };
      set((state) => ({
        queryPlan: fallbackPlan,
        tabs: state.tabs.map((t) =>
          t.id === targetTabId ? { ...t, queryPlan: fallbackPlan } : t
        ),
      }));
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
        const targetTabId = get().activeTabId;
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

        // Also update tab's local result state
        set((state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id === targetTabId && t.result && t.result.rows) {
              const updatedRows = t.result.rows.map((r) =>
                r[pkField] === pkValue ? { ...r, [colName]: newVal } : r
              );
              return {
                ...t,
                result: { ...t.result, rows: updatedRows },
              };
            }
            return t;
          }),
        }));
      }
      return success;
    } catch {
      return false;
    }
  },
}));
