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
	Rows       []map[string]interface{} `json:"rows"`
	Affected   int64                    `json:"affected"`
	DurationMs float64                  `json:"durationMs"`
	Success    bool                     `json:"success"`
	Error      string                   `json:"error,omitempty"`
}
