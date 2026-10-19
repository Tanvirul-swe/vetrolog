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

export interface QueryResult {
  requestId: string;
  databaseId: string;
  query: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  affected: number;
  durationMs: number;
  success: boolean;
  error?: string;
  defaultLimitApplied?: boolean;
}

export type OperationType = 'SCAN' | 'SEARCH' | 'TEMP_BTREE' | 'COMPOUND' | 'OTHER';
export type CostAlert = 'high' | 'warning' | 'optimal' | 'info';

export interface PlanNode {
  id: number;
  parentId: number;
  detail: string;
  operation: OperationType;
  table?: string;
  indexName?: string;
  costAlert: CostAlert;
  children?: PlanNode[];
}

export interface QueryPlanResult {
  rawNodes: PlanNode[];
  rootNodes: PlanNode[];
  hasFullScan: boolean;
  hasTempBTree: boolean;
  summary: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SimulationResult {
  query: string;
  isMutation: boolean;
  affectedRows: number;
  previewRows?: Record<string, unknown>[];
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ForeignKeyInfo {
  id: number;
  seq: number;
  toTable: string;
  fromCol: string;
  toCol: string;
  onUpdate: string;
  onDelete: string;
}

export interface IndexInfo {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
  columns: string[];
}

export interface ExtendedTableSchema {
  name: string;
  type: string;
  rowCount: number;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface ExtendedSchemaResult {
  databaseId: string;
  tables: ExtendedTableSchema[];
}

export type AIProvider = 'offline' | 'gemini' | 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  geminiApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  modelName?: string;
}


