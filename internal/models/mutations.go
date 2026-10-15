package models

// MutationType represents database write operations
type MutationType string

const (
	MutationInsert MutationType = "INSERT"
	MutationUpdate MutationType = "UPDATE"
	MutationDelete MutationType = "DELETE"
	MutationCustom MutationType = "CUSTOM"
)

// MutationEvent represents a single real-time data modification from mobile
type MutationEvent struct {
	ID         string                 `json:"id"`
	DatabaseID string                 `json:"databaseId"`
	TableName  string                 `json:"tableName"`
	Type       MutationType           `json:"type"`
	Timestamp  int64                  `json:"timestamp"`
	Query      string                 `json:"query,omitempty"`
	DurationMs float64                `json:"durationMs,omitempty"`
	OldValues  map[string]interface{} `json:"oldValues,omitempty"`
	NewValues  map[string]interface{} `json:"newValues,omitempty"`
	Affected   int64                  `json:"affected"`
}

// QueryLog represents a raw executed query record
type QueryLog struct {
	ID         string  `json:"id"`
	DatabaseID string  `json:"databaseId"`
	Query      string  `json:"query"`
	DurationMs float64 `json:"durationMs"`
	Timestamp  int64   `json:"timestamp"`
	Success    bool    `json:"success"`
	Error      string  `json:"error,omitempty"`
}
