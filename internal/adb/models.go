package adb

// Device represents an attached Android physical device or emulator detected by ADB.
type Device struct {
	ID          string `json:"id"`
	Model       string `json:"model"`
	Product     string `json:"product"`
	Device      string `json:"device"`
	TransportID string `json:"transportId"`
	State       string `json:"state"` // "device", "unauthorized", "offline"
	IsEmulator  bool   `json:"isEmulator"`
}

// App represents an installed package on the device that can be debugged.
type App struct {
	PackageName  string `json:"packageName"`
	IsDebuggable bool   `json:"isDebuggable"`
	DisplayName  string `json:"displayName"`
	IsRunning    bool   `json:"isRunning"`
	PID          string `json:"pid"`
}

// ColumnMeta describes a table column schema in an SQLite database.
type ColumnMeta struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	IsPrimaryKey bool   `json:"isPrimaryKey"`
	IsNullable   bool   `json:"isNullable"`
}

// TableMeta describes an SQLite table or view found on the device.
type TableMeta struct {
	Name     string       `json:"name"`
	Type     string       `json:"type"` // "table", "view"
	RowCount int64        `json:"rowCount"`
	Columns  []ColumnMeta `json:"columns"`
}

// DiscoveredDB represents a database file found inside the app sandbox.
type DiscoveredDB struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	Type      string      `json:"type"` // "sqlite", "shared_preferences"
	Path      string      `json:"path"`
	SizeBytes int64       `json:"sizeBytes"`
	UpdatedAt int64       `json:"updatedAt"`
	Tables    []TableMeta `json:"tables"`
}

// TableDataResult represents paginated rows returned from a table.
type TableDataResult struct {
	DatabaseID  string                   `json:"databaseId"`
	TableName   string                   `json:"tableName"`
	TotalRows   int64                    `json:"totalRows"`
	Page        int                      `json:"page"`
	PageSize    int                      `json:"pageSize"`
	Columns     []ColumnMeta             `json:"columns"`
	Rows        []map[string]interface{} `json:"rows"`
	TableCounts map[string]int64         `json:"tableCounts,omitempty"`
}

// QueryExecResult represents the output of a custom SQL execution.
type QueryExecResult struct {
	Query      string                   `json:"query"`
	Columns    []string                 `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
	Affected   int64                    `json:"affected"`
	DurationMs float64                  `json:"durationMs"`
	Success    bool                     `json:"success"`
	Error      string                   `json:"error,omitempty"`
}

// PlanNode represents a single operation in SQLite's EXPLAIN QUERY PLAN tree.
type PlanNode struct {
	ID        int        `json:"id"`
	ParentID  int        `json:"parentId"`
	Detail    string     `json:"detail"`
	Operation string     `json:"operation"` // "SCAN", "SEARCH", "TEMP_BTREE", "COMPOUND", "OTHER"
	Table     string     `json:"table,omitempty"`
	IndexName string     `json:"indexName,omitempty"`
	CostAlert string     `json:"costAlert"` // "high" (full scan), "warning" (temp b-tree), "optimal" (indexed search), "info"
	Children  []PlanNode `json:"children,omitempty"`
}

// QueryPlanResult encapsulates the visual query plan hierarchy and metrics.
type QueryPlanResult struct {
	RawNodes     []PlanNode `json:"rawNodes"`
	RootNodes    []PlanNode `json:"rootNodes"`
	HasFullScan  bool       `json:"hasFullScan"`
	HasTempBTree bool       `json:"hasTempBTree"`
	Summary      string     `json:"summary"`
	DurationMs   float64    `json:"durationMs"`
	Success      bool       `json:"success"`
	Error        string     `json:"error,omitempty"`
}

// SimulationResult represents the safe dry-run preview of mutating queries.
type SimulationResult struct {
	Query        string                   `json:"query"`
	IsMutation   bool                     `json:"isMutation"`
	AffectedRows int64                    `json:"affectedRows"`
	PreviewRows  []map[string]interface{} `json:"previewRows,omitempty"`
	DurationMs   float64                  `json:"durationMs"`
	Success      bool                     `json:"success"`
	Error        string                   `json:"error,omitempty"`
}

// ForeignKeyMeta describes a foreign key constraint between tables.
type ForeignKeyMeta struct {
	ID       int    `json:"id"`
	Seq      int    `json:"seq"`
	ToTable  string `json:"toTable"`
	FromCol  string `json:"fromCol"`
	ToCol    string `json:"toCol"`
	OnUpdate string `json:"onUpdate"`
	OnDelete string `json:"onDelete"`
}

// IndexMeta describes an index defined on a table.
type IndexMeta struct {
	Seq     int      `json:"seq"`
	Name    string   `json:"name"`
	Unique  bool     `json:"unique"`
	Origin  string   `json:"origin"`
	Partial bool     `json:"partial"`
	Columns []string `json:"columns"`
}

// ExtendedTableSchema includes columns, foreign keys, and indexes for autocomplete and join prediction.
type ExtendedTableSchema struct {
	Name        string           `json:"name"`
	Type        string           `json:"type"`
	RowCount    int64            `json:"rowCount"`
	Columns     []ColumnMeta     `json:"columns"`
	ForeignKeys []ForeignKeyMeta `json:"foreignKeys"`
	Indexes     []IndexMeta      `json:"indexes"`
}

// ExtendedSchemaResult wraps all tables' extended schemas for a database.
type ExtendedSchemaResult struct {
	DatabaseID string                `json:"databaseId"`
	Tables     []ExtendedTableSchema `json:"tables"`
}
