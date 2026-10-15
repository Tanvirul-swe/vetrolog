export type DatabaseType = 'sqlite' | 'hive' | 'shared_preferences';

export interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface TableSchema {
  name: string;
  type: 'table' | 'view' | 'box';
  columns: ColumnInfo[];
  rowCount: number;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  type: DatabaseType;
  path: string;
  tables: TableSchema[];
  sizeBytes: number;
  updatedAt: number;
}

export interface TableDataPayload {
  databaseId: string;
  tableName: string;
  totalRows: number;
  page: number;
  pageSize: number;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

export type MutationType = 'INSERT' | 'UPDATE' | 'DELETE' | 'CUSTOM';

export interface MutationEvent {
  id: string;
  databaseId: string;
  tableName: string;
  type: MutationType;
  timestamp: number;
  query?: string;
  durationMs?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  affected: number;
}

export interface QueryLog {
  id: string;
  databaseId: string;
  query: string;
  durationMs: number;
  timestamp: number;
  success: boolean;
  error?: string;
}
