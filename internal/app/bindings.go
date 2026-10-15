package app

import (
	"encoding/json"
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

// UpdateRow requests the mobile client to update a row in the specified database table
func (a *App) UpdateRow(databaseID string, tableName string, primaryKeyJSON string, newValuesJSON string) bool {
	reqID := fmt.Sprintf("update_%d", time.Now().UnixNano())

	var pk map[string]interface{}
	var values map[string]interface{}

	if err := json.Unmarshal([]byte(primaryKeyJSON), &pk); err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(newValuesJSON), &values); err != nil {
		return false
	}

	payload := models.RowUpdatePayload{
		DatabaseID: databaseID,
		TableName:  tableName,
		PrimaryKey: pk,
		NewValues:  values,
	}

	return a.server.Hub().SendToActive("update_row", reqID, payload)
}

// DeleteRow requests the mobile client to remove a row in the specified database table
func (a *App) DeleteRow(databaseID string, tableName string, primaryKeyJSON string) bool {
	reqID := fmt.Sprintf("delete_%d", time.Now().UnixNano())

	var pk map[string]interface{}
	if err := json.Unmarshal([]byte(primaryKeyJSON), &pk); err != nil {
		return false
	}

	payload := models.RowDeletePayload{
		DatabaseID: databaseID,
		TableName:  tableName,
		PrimaryKey: pk,
	}

	return a.server.Hub().SendToActive("delete_row", reqID, payload)
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
