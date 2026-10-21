package app

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"vetrolog/internal/adb"
	"vetrolog/internal/discovery"
	"vetrolog/internal/models"
	"vetrolog/internal/updater"
)

// GetConnectionState returns current desktop server and mobile connection status
func (a *App) GetConnectionState() models.ConnectionState {
	return a.server.GetState()
}

// GetLocalIPAddresses returns available LAN IPv4 addresses for pairing QR code
func (a *App) GetLocalIPAddresses() []string {
	return discovery.GetLocalIPv4Addresses()
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

// AdbListDevices returns all connected physical/emulator ADB devices
func (a *App) AdbListDevices() []adb.Device {
	devs, err := adb.GetService().ListDevices()
	if err != nil {
		return []adb.Device{}
	}
	return devs
}

// AdbListApps returns all debuggable apps installed on the specified device
func (a *App) AdbListApps(deviceID string) []adb.App {
	apps, err := adb.GetService().ListDebuggableApps(deviceID)
	if err != nil {
		return []adb.App{}
	}
	return apps
}

// AdbIsAppRunning checks if the app process is currently active on the device (ultra-fast check ~50ms)
func (a *App) AdbIsAppRunning(deviceID string, packageName string) bool {
	return adb.GetService().IsAppRunning(deviceID, packageName)
}

// AdbDiscoverDatabases finds all SQLite and SharedPreferences databases for the specified app
func (a *App) AdbDiscoverDatabases(deviceID string, packageName string) []adb.DiscoveredDB {
	dbs, err := adb.GetService().DiscoverDatabases(deviceID, packageName)
	if err != nil {
		return []adb.DiscoveredDB{}
	}
	return dbs
}

// AdbGetTableData fetches table rows directly from device SQLite or SharedPreferences
func (a *App) AdbGetTableData(deviceID, packageName, remotePath, tableName string, page, pageSize int) (*adb.TableDataResult, error) {
	return adb.GetService().GetTableData(deviceID, packageName, remotePath, tableName, page, pageSize)
}

// AdbExecuteQuery runs a SQL query on the device database and syncs back mutations
func (a *App) AdbExecuteQuery(deviceID, packageName, remotePath, sqlQuery string) (*adb.QueryExecResult, error) {
	return adb.GetService().ExecuteQuery(deviceID, packageName, remotePath, sqlQuery)
}

// AdbUpdateRow updates a row in the device SQLite database
func (a *App) AdbUpdateRow(deviceID, packageName, remotePath, tableName, primaryKeyJSON, newValuesJSON string) bool {
	var pk map[string]interface{}
	var values map[string]interface{}
	if err := json.Unmarshal([]byte(primaryKeyJSON), &pk); err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(newValuesJSON), &values); err != nil {
		return false
	}
	return adb.GetService().UpdateRow(deviceID, packageName, remotePath, tableName, pk, values) == nil
}

// AdbDeleteRow removes a row from the device SQLite database
func (a *App) AdbDeleteRow(deviceID, packageName, remotePath, tableName, primaryKeyJSON string) bool {
	var pk map[string]interface{}
	if err := json.Unmarshal([]byte(primaryKeyJSON), &pk); err != nil {
		return false
	}
	return adb.GetService().DeleteRow(deviceID, packageName, remotePath, tableName, pk) == nil
}

// AdbExplainQuery analyzes a query using SQLite's EXPLAIN QUERY PLAN and builds an operation tree
func (a *App) AdbExplainQuery(deviceID, packageName, remotePath, sqlQuery string) (*adb.QueryPlanResult, error) {
	return adb.GetService().ExplainQuery(deviceID, packageName, remotePath, sqlQuery)
}

// AdbSimulateQuery runs mutating queries in a safe rollback transaction sandbox
func (a *App) AdbSimulateQuery(deviceID, packageName, remotePath, sqlQuery string) (*adb.SimulationResult, error) {
	return adb.GetService().SimulateQuery(deviceID, packageName, remotePath, sqlQuery)
}

// AdbGetDatabaseSchemaExtended returns extended metadata including foreign keys and indexes
func (a *App) AdbGetDatabaseSchemaExtended(deviceID, packageName, remotePath string) (*adb.ExtendedSchemaResult, error) {
	return adb.GetService().GetDatabaseSchemaExtended(deviceID, packageName, remotePath)
}

// AdbCreateIndex executes a CREATE INDEX DDL statement and syncs back to device
func (a *App) AdbCreateIndex(deviceID, packageName, remotePath, indexSql string) error {
	return adb.GetService().CreateIndex(deviceID, packageName, remotePath, indexSql)
}

// SaveExportFile opens a native desktop Save File dialog and writes exported content to disk safely
func (a *App) SaveExportFile(defaultFilename string, filePattern string, content string) (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("application context not initialized")
	}

	dialogOptions := runtime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "Save Exported Data",
	}

	if filePattern != "" {
		dialogOptions.Filters = []runtime.FileFilter{
			{
				DisplayName: "Export File",
				Pattern:     filePattern,
			},
			{
				DisplayName: "All Files (*.*)",
				Pattern:     "*.*",
			},
		}
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, dialogOptions)
	if err != nil {
		return "", err
	}
	if savePath == "" {
		// User cancelled dialog
		return "", nil
	}

	if err := os.WriteFile(savePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write export file: %w", err)
	}

	return savePath, nil
}

// CheckForUpdate checks GitHub Releases API for any newer version than current
func (a *App) CheckForUpdate() (*updater.UpdateInfo, error) {
	return a.updater.CheckForUpdate()
}

// StartDownloadUpdate begins downloading the update artifact in the background
func (a *App) StartDownloadUpdate(assetURL, version string) error {
	return a.updater.StartDownloadUpdate(assetURL, version)
}

// ApplyUpdateAndRestart applies the downloaded update and restarts VetroLog
func (a *App) ApplyUpdateAndRestart(version string) error {
	return a.updater.ApplyUpdateAndRestart(version)
}

// CancelUpdate stops any active update download
func (a *App) CancelUpdate() error {
	return a.updater.CancelUpdate()
}

