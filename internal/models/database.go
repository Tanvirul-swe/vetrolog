package models

// DatabaseType defines the category of the inspected database
type DatabaseType string

const (
	DatabaseTypeSQLite      DatabaseType = "sqlite"
	DatabaseTypeHive        DatabaseType = "hive"
	DatabaseTypeSharedPrefs DatabaseType = "shared_preferences"
)

// ColumnInfo describes a single table or box attribute
type ColumnInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"` // e.g. "INTEGER", "TEXT", "BLOB", "BOOLEAN", "STRING"
	IsPrimaryKey bool   `json:"isPrimaryKey"`
	IsNullable   bool   `json:"isNullable"`
	DefaultValue string `json:"defaultValue,omitempty"`
}

// TableSchema describes a table or box in the database
type TableSchema struct {
	Name     string       `json:"name"`
	Type     string       `json:"type"` // "table", "view", "box"
	Columns  []ColumnInfo `json:"columns"`
	RowCount int64        `json:"rowCount"`
}

// DatabaseInfo represents an individual database discovered on the mobile device
type DatabaseInfo struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Type      DatabaseType  `json:"type"`
	Path      string        `json:"path"`
	Tables    []TableSchema `json:"tables"`
	SizeBytes int64         `json:"sizeBytes"`
	UpdatedAt int64         `json:"updatedAt"`
}

// TableDataPayload represents a paginated or filtered snapshot of rows
type TableDataPayload struct {
	DatabaseID string                   `json:"databaseId"`
	TableName  string                   `json:"tableName"`
	TotalRows  int64                    `json:"totalRows"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	Columns    []ColumnInfo             `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
}

// QueryResult represents the outcome of an executed ad-hoc query
type QueryResult struct {
	RequestID  string                   `json:"requestId"`
	DatabaseID string                   `json:"databaseId"`
	Query      string                   `json:"query"`
	Columns    []ColumnInfo             `json:"columns"`
	Rows       []map[string]interface{} `json:"rows"`
	Affected   int64                    `json:"affected"`
	DurationMs float64                  `json:"durationMs"`
	Success    bool                     `json:"success"`
	Error      string                   `json:"error,omitempty"`
}

// RowUpdatePayload is sent from desktop to mobile to mutate a row
type RowUpdatePayload struct {
	DatabaseID string                 `json:"databaseId"`
	TableName  string                 `json:"tableName"`
	PrimaryKey map[string]interface{} `json:"primaryKey"`
	NewValues  map[string]interface{} `json:"newValues"`
}

// RowDeletePayload is sent from desktop to mobile to remove a row
type RowDeletePayload struct {
	DatabaseID string                 `json:"databaseId"`
	TableName  string                 `json:"tableName"`
	PrimaryKey map[string]interface{} `json:"primaryKey"`
}
