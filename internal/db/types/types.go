package types

import "time"

// EngineType represents the database engine
type EngineType string

const (
	EnginePostgres EngineType = "postgres"
	EngineMySQL    EngineType = "mysql"
	EngineMariaDB  EngineType = "mariadb"
	EngineSQLite   EngineType = "sqlite"
	EngineRedis    EngineType = "redis"
)

// SSHTunnelConfig holds bastion / jump host parameters
type SSHTunnelConfig struct {
	Enabled    bool   `json:"enabled"`
	Host       string `json:"host"`
	Port       int    `json:"port"`
	User       string `json:"user"`
	AuthMethod string `json:"authMethod"` // "password" | "private_key"
	Password   string `json:"password,omitempty"`
	PrivateKey string `json:"privateKey,omitempty"` // Path or raw PEM key
	Passphrase string `json:"passphrase,omitempty"`
}

// ConnectionConfig defines a saved or active database connection profile
type ConnectionConfig struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Engine      EngineType       `json:"engine"`
	Host        string           `json:"host"`
	Port        int              `json:"port"`
	User        string           `json:"user"`
	Password    string           `json:"password"`
	Database    string           `json:"database"`
	Schema      string           `json:"schema,omitempty"` // For Postgres default schema (e.g. "public")
	SSLMode     string           `json:"sslMode"`          // "disable" | "require" | "verify-ca" | "verify-full"
	SSLCert     string           `json:"sslCert,omitempty"`
	SSLKey      string           `json:"sslKey,omitempty"`
	SSLRootCert string           `json:"sslRootCert,omitempty"`
	ColorTag    string           `json:"colorTag"`    // "red" | "amber" | "blue" | "green" | "purple"
	Environment string           `json:"environment"` // "production" | "staging" | "development" | "local"
	SafeMode    bool             `json:"safeMode"`    // Prompts before executing destructive statements
	FilePath    string           `json:"filePath,omitempty"`
	SSH         *SSHTunnelConfig `json:"ssh,omitempty"`
	CreatedAt   int64            `json:"createdAt"`
	UpdatedAt   int64            `json:"updatedAt"`
}

// ConnectionSummary is the sanitized profile presented in the UI list
type ConnectionSummary struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Engine      EngineType `json:"engine"`
	Host        string     `json:"host"`
	Port        int        `json:"port"`
	Database    string     `json:"database"`
	ColorTag    string     `json:"colorTag"`
	Environment string     `json:"environment"`
	SafeMode    bool       `json:"safeMode"`
	FilePath    string     `json:"filePath,omitempty"`
	HasSSH      bool       `json:"hasSSH"`
	UpdatedAt   int64      `json:"updatedAt"`
}

// ConnectionTestResult reports latency and server info upon testing
type ConnectionTestResult struct {
	Success       bool    `json:"success"`
	LatencyMs     float64 `json:"latencyMs"`
	ServerVersion string  `json:"serverVersion,omitempty"`
	Message       string  `json:"message,omitempty"`
	Error         string  `json:"error,omitempty"`
}

// ConnectionSession represents an active connected database session
type ConnectionSession struct {
	SessionID       string            `json:"sessionId"`
	Config          ConnectionSummary `json:"config"`
	ConnectedAt     int64             `json:"connectedAt"`
	CurrentDatabase string            `json:"currentDatabase"`
	CurrentSchema   string            `json:"currentSchema"`
	PingDurationMs  float64           `json:"pingDurationMs"`
}

// TableSummary describes a table, view, or collection
type TableSummary struct {
	Name      string `json:"name"`
	Schema    string `json:"schema"`
	Type      string `json:"type"` // "table" | "view" | "materialized_view" | "key"
	RowCount  int64  `json:"rowCount"`
	SizeBytes int64  `json:"sizeBytes,omitempty"`
}

// ColumnInfo holds details about a specific table column
type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	IsPrimaryKey bool   `json:"isPrimaryKey"`
	IsNullable   bool   `json:"isNullable"`
	DefaultValue string `json:"defaultValue,omitempty"`
	Extra        string `json:"extra,omitempty"` // e.g. "auto_increment", "generated"
	Comment      string `json:"comment,omitempty"`
}

// IndexInfo describes an index on a table
type IndexInfo struct {
	Name      string   `json:"name"`
	Columns   []string `json:"columns"`
	IsUnique  bool     `json:"isUnique"`
	IsPrimary bool     `json:"isPrimary"`
	Type      string   `json:"type"` // e.g. "BTREE", "HASH", "GIN"
}

// ForeignKeyInfo describes a foreign key constraint
type ForeignKeyInfo struct {
	ConstraintName string `json:"constraintName"`
	Column         string `json:"column"`
	RefTable       string `json:"refTable"`
	RefColumn      string `json:"refColumn"`
	OnUpdate       string `json:"onUpdate"`
	OnDelete       string `json:"onDelete"`
}

// ExtendedTableSchema details structure, constraints, and indexes
type ExtendedTableSchema struct {
	TableName   string           `json:"tableName"`
	Name        string           `json:"name,omitempty"`
	Schema      string           `json:"schema"`
	Type        string           `json:"type"` // "TABLE" | "VIEW"
	Columns     []ColumnInfo     `json:"columns"`
	PrimaryKeys []string         `json:"primaryKeys"`
	Indexes     []IndexInfo      `json:"indexes"`
	ForeignKeys []ForeignKeyInfo `json:"foreignKeys"`
	RowCount    int64            `json:"rowCount"`
}

// TableDataRequest contains query filters and pagination
type TableDataRequest struct {
	Schema        string `json:"schema"`
	Table         string `json:"table"`
	Page          int    `json:"page"`
	PageSize      int    `json:"pageSize"`
	SortColumn    string `json:"sortColumn,omitempty"`
	SortDirection string `json:"sortDirection,omitempty"` // "ASC" | "DESC"
	Filter        string `json:"filter,omitempty"`
}

// TableDataResult holds paginated rows
type TableDataResult struct {
	TableName  string                   `json:"tableName"`
	Schema     string                   `json:"schema"`
	Columns    []ColumnInfo             `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
	TotalRows  int64                    `json:"totalRows"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	DurationMs float64                  `json:"durationMs"`
}

// QueryResult represents executed SQL outcome
type QueryResult struct {
	RequestID  string                   `json:"requestId"`
	Query      string                   `json:"query"`
	Columns    []ColumnInfo             `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
	Affected   int64                    `json:"affected"`
	DurationMs float64                  `json:"durationMs"`
	Success    bool                     `json:"success"`
	Error      string                   `json:"error,omitempty"`
}

// PendingChangeType signifies the kind of mutation
type PendingChangeType string

const (
	ChangeUpdate PendingChangeType = "UPDATE"
	ChangeInsert PendingChangeType = "INSERT"
	ChangeDelete PendingChangeType = "DELETE"
)

// PendingChange is an uncommitted staged modification
type PendingChange struct {
	Type       PendingChangeType      `json:"type"`
	Schema     string                 `json:"schema"`
	Table      string                 `json:"table"`
	PrimaryKey map[string]interface{} `json:"primaryKey"`
	OldValues  map[string]interface{} `json:"oldValues,omitempty"`
	NewValues  map[string]interface{} `json:"newValues,omitempty"`
}

// PendingChanges payload for atomic transaction commit
type PendingChanges struct {
	Changes []PendingChange `json:"changes"`
}

// ChangeResult returns results of committed batch
type ChangeResult struct {
	Success      bool    `json:"success"`
	AffectedRows int64   `json:"affectedRows"`
	GeneratedSQL string  `json:"generatedSql,omitempty"`
	DurationMs   float64 `json:"durationMs"`
	Error        string  `json:"error,omitempty"`
}

// QueryPlanResult holds visual plan / EXPLAIN output
type QueryPlanResult struct {
	RawPlan    string      `json:"rawPlan"`
	Nodes      interface{} `json:"nodes,omitempty"`
	DurationMs float64     `json:"durationMs"`
	Success    bool        `json:"success"`
	Error      string      `json:"error,omitempty"`
}

// RedisKeyInfo represents an inspected key in Redis
type RedisKeyInfo struct {
	Key       string        `json:"key"`
	Type      string        `json:"type"` // "string" | "hash" | "list" | "set" | "zset"
	TTL       time.Duration `json:"ttl"`
	TTLSec    int64         `json:"ttlSec"`
	SizeBytes int64         `json:"sizeBytes"`
}

// RedisScanResult holds discovered keys with cursor pagination
type RedisScanResult struct {
	Keys          []RedisKeyInfo `json:"keys"`
	Cursor        uint64         `json:"cursor"`
	TotalEstimate int64          `json:"totalEstimate"`
	DurationMs    float64        `json:"durationMs"`
}

// RedisValueResult holds key contents and metadata
type RedisValueResult struct {
	Key        string      `json:"key"`
	Type       string      `json:"type"`
	TTLSec     int64       `json:"ttlSec"`
	Value      interface{} `json:"value"`
	Success    bool        `json:"success"`
	DurationMs float64     `json:"durationMs"`
	Error      string      `json:"error,omitempty"`
}
