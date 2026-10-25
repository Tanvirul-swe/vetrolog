export type DatabaseType = 'sqlite' | 'hive' | 'shared_preferences' | 'postgres' | 'mysql' | 'mariadb' | 'redis' | 'sqlite_file';

export type EngineType = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | 'redis';
export type EnvironmentType = 'production' | 'staging' | 'development' | 'local';
export type ColorTag = 'red' | 'amber' | 'blue' | 'green' | 'purple';

export interface SSHTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  authMethod: 'password' | 'private_key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ConnectionConfig {
  id?: string;
  name: string;
  engine: EngineType;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  schema?: string;
  sslMode: string;
  sslCert?: string;
  sslKey?: string;
  sslRootCert?: string;
  colorTag: ColorTag;
  environment: EnvironmentType;
  safeMode: boolean;
  filePath?: string;
  ssh?: SSHTunnelConfig;
  createdAt?: number;
  updatedAt?: number;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  engine: EngineType;
  host: string;
  port: number;
  database: string;
  colorTag: ColorTag;
  environment: EnvironmentType;
  safeMode: boolean;
  filePath?: string;
  hasSSH: boolean;
  updatedAt: number;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  serverVersion?: string;
  message?: string;
  error?: string;
}

export interface ConnectionSession {
  sessionId: string;
  config: ConnectionSummary;
  connectedAt: number;
  currentDatabase: string;
  currentSchema: string;
  pingDurationMs: number;
}

export interface TableSummary {
  name: string;
  schema: string;
  type: string;
  rowCount: number;
  sizeBytes?: number;
}

export interface TableDataResult {
  tableName: string;
  schema: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  durationMs: number;
}

export interface PendingChange {
  type: 'UPDATE' | 'INSERT' | 'DELETE';
  schema: string;
  table: string;
  primaryKey: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface ChangeResult {
  success: boolean;
  affectedRows: number;
  generatedSql?: string;
  durationMs: number;
  error?: string;
}

export interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number;
  ttlSec: number;
  sizeBytes: number;
}

export interface RedisScanResult {
  keys: RedisKeyInfo[];
  cursor: number;
  totalEstimate: number;
  durationMs: number;
}

export interface RedisValueResult {
  key: string;
  type: string;
  ttlSec: number;
  value: unknown;
  success: boolean;
  durationMs: number;
  error?: string;
}

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


