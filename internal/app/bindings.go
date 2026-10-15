package app

import (
	"fmt"
	"time"

	"vetrolog/internal/models"
)

// GetConnectionState returns current desktop server and mobile connection status
func (a *App) GetConnectionState() models.ConnectionState {
	return a.server.GetState()
}

// RequestTableData requests the mobile client to send a table data page
func (a *App) RequestTableData(databaseID string, tableName string, page int, pageSize int) bool {
	reqID := fmt.Sprintf("req_%d", time.Now().UnixNano())
	payload := map[string]interface{}{
		"databaseId": databaseID,
		"tableName":  tableName,
		"page":       page,
		"pageSize":   pageSize,
	}
	return a.server.Hub().SendToActive("fetch_table_data", reqID, payload)
}

// ExecuteQuery asks the connected mobile app to execute an arbitrary SQL or key query
func (a *App) ExecuteQuery(databaseID string, query string) bool {
	reqID := fmt.Sprintf("query_%d", time.Now().UnixNano())
	payload := map[string]interface{}{
		"databaseId": databaseID,
		"query":      query,
	}
	return a.server.Hub().SendToActive("execute_query", reqID, payload)
}

// DisconnectActiveDevice gracefully disconnects the connected mobile client
func (a *App) DisconnectActiveDevice() bool {
	dev := a.server.Hub().GetActiveDevice()
	if dev != nil {
		a.server.Hub().Stop()
		a.broadcaster.Emit(models.EventDeviceDisconnected, dev)
		return true
	}
	return false
}
