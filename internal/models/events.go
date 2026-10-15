package models

import "encoding/json"

// InboundWSMessage is the raw envelope sent over the WebSocket from the mobile device
type InboundWSMessage struct {
	Type      string          `json:"type"`      // e.g. "handshake", "db_list", "table_data", "mutation", "query_log"
	Timestamp int64           `json:"timestamp"` // epoch ms
	Payload   json.RawMessage `json:"payload"`
}

// OutboundWSMessage is a command sent from desktop to mobile
type OutboundWSMessage struct {
	Action    string      `json:"action"` // e.g. "fetch_tables", "fetch_rows", "execute_query"
	RequestID string      `json:"requestId"`
	Payload   interface{} `json:"payload"`
}

// Wails Event constant names emitted to the frontend
const (
	EventDeviceConnected    = "vetrolog:device_connected"
	EventDeviceDisconnected = "vetrolog:device_disconnected"
	EventDatabaseList       = "vetrolog:database_list"
	EventTableData          = "vetrolog:table_data"
	EventLiveMutation       = "vetrolog:live_mutation"
	EventBatchMutations     = "vetrolog:batch_mutations"
	EventQueryLog           = "vetrolog:query_log"
	EventQueryResult        = "vetrolog:query_result"
	EventConnectionState    = "vetrolog:connection_state"
)
