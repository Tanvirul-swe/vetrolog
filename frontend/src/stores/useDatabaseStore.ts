import { create } from 'zustand';
import { ColumnInfo, DatabaseInfo, MutationEvent, QueryLog, QueryResult, TableDataPayload } from '../types/database';

interface DatabaseStoreState {
  databases: DatabaseInfo[];
  selectedDatabaseId: string | null;
  selectedTableName: string | null;
  selectedRow: Record<string, unknown> | null;

  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  isLoadingTable: boolean;

  filterTerm: string;
  mutations: MutationEvent[];
  queryLogs: QueryLog[];
  latestQueryResult: QueryResult | null;

  // Actions
  setDatabases: (databases: DatabaseInfo[]) => void;
  selectDatabase: (id: string) => void;
  selectTable: (tableName: string) => void;
  setSelectedRow: (row: Record<string, unknown> | null) => void;
  setTableData: (payload: TableDataPayload) => void;
  setFilterTerm: (term: string) => void;
  setPage: (page: number) => void;
  addMutation: (mutation: MutationEvent) => void;
  addMutationsBatch: (batch: MutationEvent[]) => void;
  addQueryLog: (log: QueryLog) => void;
  setLatestQueryResult: (result: QueryResult | null) => void;
  updateRowLocally: (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => void;
  deleteRowLocally: (pkField: string, pkValue: unknown) => void;
  clearLogs: () => void;
  resetState: () => void;
  updateTableCounts: (databaseId: string, counts: Record<string, number>) => void;
}

function applyMutationToRows(
  rows: Record<string, unknown>[],
  totalRows: number,
  mutation: MutationEvent
): { rows: Record<string, unknown>[]; totalRows: number } {
  if (mutation.type === 'INSERT' && mutation.newValues) {
    return {
      rows: [mutation.newValues, ...rows],
      totalRows: totalRows + 1,
    };
  }

  if (mutation.type === 'UPDATE' && mutation.newValues) {
    const pkKey = Object.keys(mutation.newValues).find(
      (k) => k.toLowerCase() === 'id' || k.toLowerCase().endsWith('_id') || k.toLowerCase() === 'key'
    );
    if (pkKey) {
      const pkVal = mutation.newValues[pkKey];
      return {
        rows: rows.map((r) => (r[pkKey] === pkVal ? { ...r, ...mutation.newValues } : r)),
        totalRows,
      };
    }
  }

  if (mutation.type === 'DELETE') {
    const target = mutation.oldValues || mutation.newValues;
    if (target) {
      const pkKey = Object.keys(target).find(
        (k) => k.toLowerCase() === 'id' || k.toLowerCase().endsWith('_id') || k.toLowerCase() === 'key'
      );
      if (pkKey) {
        const pkVal = target[pkKey];
        return {
          rows: rows.filter((r) => r[pkKey] !== pkVal),
          totalRows: Math.max(0, totalRows - 1),
        };
      }
    }
  }

  return { rows, totalRows };
}

export const useDatabaseStore = create<DatabaseStoreState>((set) => ({
  databases: [],
  selectedDatabaseId: null,
  selectedTableName: null,
  selectedRow: null,

  columns: [],
  rows: [],
  totalRows: 0,
  page: 1,
  pageSize: 50,
  isLoadingTable: false,

  filterTerm: '',
  mutations: [],
  queryLogs: [],
  latestQueryResult: null,

  setDatabases: (databases) =>
    set((state) => {
      const dbExists = databases.some((d) => d.id === state.selectedDatabaseId);
      let activeDb = state.selectedDatabaseId;
      let activeTable = state.selectedTableName;

      if ((!activeDb || !dbExists) && databases.length > 0) {
        activeDb = databases[0].id;
        activeTable = databases[0].tables.length > 0 ? databases[0].tables[0].name : null;
      }
      return { databases, selectedDatabaseId: activeDb, selectedTableName: activeTable };
    }),

  selectDatabase: (id) =>
    set((state) => {
      if (state.selectedDatabaseId === id) {
        return state;
      }
      const db = state.databases.find((d) => d.id === id);
      const firstTable = db && db.tables.length > 0 ? db.tables[0].name : null;
      return {
        selectedDatabaseId: id,
        selectedTableName: firstTable,
        columns: [],
        rows: [],
        totalRows: 0,
        page: 1,
        selectedRow: null,
      };
    }),

  selectTable: (tableName) =>
    set({
      selectedTableName: tableName,
      page: 1,
      selectedRow: null,
      isLoadingTable: true,
    }),

  setSelectedRow: (row) => set({ selectedRow: row }),

  setTableData: (payload) =>
    set((state) => {
      // If tableColumns were empty, infer from payload.columns
      return {
        selectedDatabaseId: payload.databaseId || state.selectedDatabaseId,
        selectedTableName: payload.tableName || state.selectedTableName,
        columns: payload.columns && payload.columns.length > 0 ? payload.columns : state.columns,
        rows: payload.rows || [],
        totalRows: payload.totalRows !== undefined ? payload.totalRows : payload.rows?.length || 0,
        page: payload.page || 1,
        pageSize: payload.pageSize || 50,
        isLoadingTable: false,
      };
    }),

  setFilterTerm: (term) => set({ filterTerm: term }),
  setPage: (page) => set({ page }),

  addMutation: (mutation) =>
    set((state) => {
      if (state.mutations.some((m) => m.id === mutation.id)) {
        return state;
      }

      const isCurrentTable =
        state.selectedDatabaseId === mutation.databaseId &&
        state.selectedTableName === mutation.tableName;

      let nextRows = state.rows;
      let nextTotal = state.totalRows;

      if (isCurrentTable) {
        const res = applyMutationToRows(state.rows, state.totalRows, mutation);
        nextRows = res.rows;
        nextTotal = res.totalRows;
      }

      return {
        mutations: [mutation, ...state.mutations.slice(0, 499)], // keep last 500
        rows: nextRows,
        totalRows: nextTotal,
      };
    }),

  addMutationsBatch: (batch) =>
    set((state) => {
      let nextRows = state.rows;
      let nextTotal = state.totalRows;

      batch.forEach((mutation) => {
        if (
          state.selectedDatabaseId === mutation.databaseId &&
          state.selectedTableName === mutation.tableName
        ) {
          const res = applyMutationToRows(nextRows, nextTotal, mutation);
          nextRows = res.rows;
          nextTotal = res.totalRows;
        }
      });

      return {
        mutations: [...batch.slice().reverse(), ...state.mutations].slice(0, 500),
        rows: nextRows,
        totalRows: nextTotal,
      };
    }),

  addQueryLog: (log) =>
    set((state) => ({
      queryLogs: [log, ...state.queryLogs.slice(0, 499)],
    })),

  setLatestQueryResult: (result) => set({ latestQueryResult: result }),

  updateRowLocally: (pkField, pkValue, newValues) =>
    set((state) => {
      const updatedRows = state.rows.map((r) => {
        if (r[pkField] === pkValue) {
          return { ...r, ...newValues };
        }
        return r;
      });

      const updatedSelected =
        state.selectedRow && state.selectedRow[pkField] === pkValue
          ? { ...state.selectedRow, ...newValues }
          : state.selectedRow;

      return { rows: updatedRows, selectedRow: updatedSelected };
    }),

  deleteRowLocally: (pkField, pkValue) =>
    set((state) => {
      const updatedRows = state.rows.filter((r) => r[pkField] !== pkValue);
      return {
        rows: updatedRows,
        totalRows: Math.max(0, state.totalRows - 1),
        selectedRow: state.selectedRow && state.selectedRow[pkField] === pkValue ? null : state.selectedRow,
      };
    }),

  clearLogs: () => set({ mutations: [], queryLogs: [], latestQueryResult: null }),

  resetState: () =>
    set({
      databases: [],
      selectedDatabaseId: null,
      selectedTableName: null,
      selectedRow: null,
      columns: [],
      rows: [],
      totalRows: 0,
      page: 1,
      isLoadingTable: false,
      filterTerm: '',
      mutations: [],
      queryLogs: [],
      latestQueryResult: null,
    }),

  updateTableCounts: (databaseId, counts) =>
    set((state) => {
      const nextDatabases = state.databases.map((db) => {
        if (db.id !== databaseId && !db.id.includes(databaseId) && !databaseId.includes(db.id)) {
          return db;
        }
        const nextTables = db.tables.map((t) => {
          if (counts[t.name] !== undefined) {
            return { ...t, rowCount: counts[t.name] };
          }
          return t;
        });
        return { ...db, tables: nextTables };
      });

      let nextTotal = state.totalRows;
      if (state.selectedTableName && counts[state.selectedTableName] !== undefined) {
        nextTotal = counts[state.selectedTableName];
      }

      return { databases: nextDatabases, totalRows: nextTotal };
    }),
}));
