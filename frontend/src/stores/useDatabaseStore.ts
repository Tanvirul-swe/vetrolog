import { create } from 'zustand';
import { ColumnInfo, DatabaseInfo, MutationEvent, QueryLog, TableDataPayload } from '../types/database';

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
  clearLogs: () => void;
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

  setDatabases: (databases) =>
    set((state) => {
      let activeDb = state.selectedDatabaseId;
      let activeTable = state.selectedTableName;

      if (!activeDb && databases.length > 0) {
        activeDb = databases[0].id;
        if (databases[0].tables.length > 0) {
          activeTable = databases[0].tables[0].name;
        }
      }
      return { databases, selectedDatabaseId: activeDb, selectedTableName: activeTable };
    }),

  selectDatabase: (id) =>
    set((state) => {
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
    set({
      columns: payload.columns,
      rows: payload.rows,
      totalRows: payload.totalRows,
      page: payload.page,
      pageSize: payload.pageSize,
      isLoadingTable: false,
    }),

  setFilterTerm: (term) => set({ filterTerm: term }),
  setPage: (page) => set({ page }),

  addMutation: (mutation) =>
    set((state) => ({
      mutations: [mutation, ...state.mutations.slice(0, 499)], // keep last 500
    })),

  addMutationsBatch: (batch) =>
    set((state) => ({
      mutations: [...batch.reverse(), ...state.mutations].slice(0, 500),
    })),

  addQueryLog: (log) =>
    set((state) => ({
      queryLogs: [log, ...state.queryLogs.slice(0, 499)],
    })),

  clearLogs: () => set({ mutations: [], queryLogs: [] }),
}));
