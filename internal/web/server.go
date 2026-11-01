package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"vetrolog/internal/adb"
	"vetrolog/internal/db"
	"vetrolog/internal/db/types"
	"vetrolog/internal/version"
)

// Server handles the HTTP REST API and serves the embedded React frontend
type Server struct {
	port      int
	assets    embed.FS
	adbServer *adb.Service
	dbManager *db.ConnectionManager
}

// NewServer initializes a web server instance
func NewServer(assets embed.FS, port int) *Server {
	dbMgr, _ := db.NewConnectionManager()
	return &Server{
		port:      port,
		assets:    assets,
		adbServer: adb.GetService(),
		dbManager: dbMgr,
	}
}

// NewAPIHandler creates an http.Handler with all VetroLog API routes and CORS support
func NewAPIHandler() http.Handler {
	dbMgr, _ := db.NewConnectionManager()
	srv := &Server{
		adbServer: adb.GetService(),
		dbManager: dbMgr,
	}
	mux := http.NewServeMux()
	srv.registerAPIRoutes(mux)
	srv.registerRemoteRoutes(mux)
	return enableCORS(mux)
}

// StartServer launches the HTTP server and optionally launches the browser
func StartServer(assets embed.FS, port int, openBrowser bool) error {
	srv := NewServer(assets, port)
	mux := http.NewServeMux()

	// Register API routes
	srv.registerAPIRoutes(mux)
	srv.registerRemoteRoutes(mux)

	// Register static asset server with SPA fallback
	srv.registerStaticRoutes(mux)

	// Wrap mux with CORS middleware
	handler := enableCORS(mux)

	addr := fmt.Sprintf(":%d", port)
	url := fmt.Sprintf("http://localhost:%d", port)

	fmt.Printf("\n🚀 VetroLog Web Server started at %s\n", url)
	fmt.Printf("📱 Connecting to ADB bridge...\n")
	fmt.Printf("Press Ctrl+C to stop the server\n\n")

	if openBrowser {
		go func() {
			time.Sleep(500 * time.Millisecond)
			_ = OpenBrowser(url)
		}()
	}

	return http.ListenAndServe(addr, handler)
}

func (s *Server) registerAPIRoutes(mux *http.ServeMux) {
	// Status & Health
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"version": version.CurrentVersion,
			"time":    time.Now().Unix(),
		})
	})

	// List connected ADB devices
	mux.HandleFunc("/api/adb/devices", func(w http.ResponseWriter, r *http.Request) {
		devices, err := s.adbServer.ListDevices()
		if err != nil {
			writeJSON(w, http.StatusOK, []adb.Device{})
			return
		}
		writeJSON(w, http.StatusOK, devices)
	})

	// List debuggable apps for a device
	mux.HandleFunc("/api/adb/apps", func(w http.ResponseWriter, r *http.Request) {
		deviceID := r.URL.Query().Get("deviceId")
		if deviceID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId is required"})
			return
		}
		apps, err := s.adbServer.ListDebuggableApps(deviceID)
		if err != nil {
			writeJSON(w, http.StatusOK, []adb.App{})
			return
		}
		writeJSON(w, http.StatusOK, apps)
	})

	// Check if app is actively running (fast process check)
	mux.HandleFunc("/api/adb/is-running", func(w http.ResponseWriter, r *http.Request) {
		deviceID := r.URL.Query().Get("deviceId")
		packageName := r.URL.Query().Get("packageName")
		if deviceID == "" || packageName == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId and packageName are required"})
			return
		}
		isRunning := s.adbServer.IsAppRunning(deviceID, packageName)
		writeJSON(w, http.StatusOK, map[string]bool{"isRunning": isRunning})
	})

	// Discover databases for an app
	mux.HandleFunc("/api/adb/databases", func(w http.ResponseWriter, r *http.Request) {
		deviceID := r.URL.Query().Get("deviceId")
		packageName := r.URL.Query().Get("packageName")
		if deviceID == "" || packageName == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId and packageName are required"})
			return
		}
		dbs, err := s.adbServer.DiscoverDatabases(deviceID, packageName)
		if err != nil {
			writeJSON(w, http.StatusOK, []adb.DiscoveredDB{})
			return
		}
		writeJSON(w, http.StatusOK, dbs)
	})

	// Get table data
	mux.HandleFunc("/api/adb/table-data", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		deviceID := q.Get("deviceId")
		packageName := q.Get("packageName")
		remotePath := q.Get("remotePath")
		tableName := q.Get("table")
		page, _ := strconv.Atoi(q.Get("page"))
		if page < 1 {
			page = 1
		}
		pageSize, _ := strconv.Atoi(q.Get("pageSize"))
		if pageSize < 1 {
			pageSize = 50
		}

		if deviceID == "" || packageName == "" || tableName == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing required parameters"})
			return
		}

		result, err := s.adbServer.GetTableData(deviceID, packageName, remotePath, tableName, page, pageSize)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Execute custom SQL query
	mux.HandleFunc("/api/adb/query", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string `json:"deviceId"`
			PackageName string `json:"packageName"`
			RemotePath  string `json:"remotePath"`
			Query       string `json:"query"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		result, err := s.adbServer.ExecuteQuery(req.DeviceID, req.PackageName, req.RemotePath, req.Query)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Update row
	mux.HandleFunc("/api/adb/update-row", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string                 `json:"deviceId"`
			PackageName string                 `json:"packageName"`
			RemotePath  string                 `json:"remotePath"`
			Table       string                 `json:"table"`
			PrimaryKey  map[string]interface{} `json:"pk"`
			NewValues   map[string]interface{} `json:"values"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		err := s.adbServer.UpdateRow(req.DeviceID, req.PackageName, req.RemotePath, req.Table, req.PrimaryKey, req.NewValues)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})

	// Delete row
	mux.HandleFunc("/api/adb/delete-row", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string                 `json:"deviceId"`
			PackageName string                 `json:"packageName"`
			RemotePath  string                 `json:"remotePath"`
			Table       string                 `json:"table"`
			PrimaryKey  map[string]interface{} `json:"pk"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		err := s.adbServer.DeleteRow(req.DeviceID, req.PackageName, req.RemotePath, req.Table, req.PrimaryKey)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})

	// Explain custom SQL query (EXPLAIN QUERY PLAN)
	mux.HandleFunc("/api/adb/explain", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string `json:"deviceId"`
			PackageName string `json:"packageName"`
			RemotePath  string `json:"remotePath"`
			Query       string `json:"query"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		result, err := s.adbServer.ExplainQuery(req.DeviceID, req.PackageName, req.RemotePath, req.Query)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Simulate mutating query in safe rollback transaction sandbox
	mux.HandleFunc("/api/adb/simulate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string `json:"deviceId"`
			PackageName string `json:"packageName"`
			RemotePath  string `json:"remotePath"`
			Query       string `json:"query"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		result, err := s.adbServer.SimulateQuery(req.DeviceID, req.PackageName, req.RemotePath, req.Query)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Get extended database schema (foreign keys, indexes, columns)
	mux.HandleFunc("/api/adb/schema-extended", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		deviceID := q.Get("deviceId")
		packageName := q.Get("packageName")
		remotePath := q.Get("remotePath")

		if deviceID == "" || packageName == "" || remotePath == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "deviceId, packageName, and remotePath are required"})
			return
		}

		result, err := s.adbServer.GetDatabaseSchemaExtended(deviceID, packageName, remotePath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Create index on database and sync back to device
	mux.HandleFunc("/api/adb/create-index", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID    string `json:"deviceId"`
			PackageName string `json:"packageName"`
			RemotePath  string `json:"remotePath"`
			IndexSQL    string `json:"indexSql"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}

		err := s.adbServer.CreateIndex(req.DeviceID, req.PackageName, req.RemotePath, req.IndexSQL)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	})
}

func (s *Server) registerRemoteRoutes(mux *http.ServeMux) {
	if s.dbManager == nil {
		return
	}

	// List saved connection profiles
	mux.HandleFunc("/api/remote/connections", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			summaries, err := s.dbManager.Store().ListSummaries()
			if err != nil {
				writeJSON(w, http.StatusOK, []types.ConnectionSummary{})
				return
			}
			writeJSON(w, http.StatusOK, summaries)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	// Get saved connection details by ID
	mux.HandleFunc("/api/remote/connections/get", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		if id == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id is required"})
			return
		}
		cfg, err := s.dbManager.Store().Get(id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, cfg)
	})

	// Save or update connection
	mux.HandleFunc("/api/remote/connections/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var cfg types.ConnectionConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		summary, err := s.dbManager.Store().Save(&cfg)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, summary)
	})

	// Delete connection
	mux.HandleFunc("/api/remote/connections/delete", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			req.ID = r.URL.Query().Get("id")
		}
		if req.ID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id is required"})
			return
		}
		err := s.dbManager.Store().Delete(req.ID)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})

	// Test connection
	mux.HandleFunc("/api/remote/connections/test", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var cfg types.ConnectionConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		result, err := s.dbManager.TestConnection(r.Context(), cfg)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Open connection by ID
	mux.HandleFunc("/api/remote/connect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id is required"})
			return
		}
		session, err := s.dbManager.OpenConnection(r.Context(), req.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, session)
	})

	// Open local SQLite file
	mux.HandleFunc("/api/remote/open-file", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			FilePath string `json:"filePath"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.FilePath == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "filePath is required"})
			return
		}
		session, err := s.dbManager.OpenLocalSQLite(r.Context(), req.FilePath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, session)
	})

	// Close / disconnect session
	mux.HandleFunc("/api/remote/disconnect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.SessionID == "" {
			req.SessionID = r.URL.Query().Get("sessionId")
		}
		err := s.dbManager.CloseConnection(req.SessionID)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})

	// List databases
	mux.HandleFunc("/api/remote/databases", func(w http.ResponseWriter, r *http.Request) {
		sessionID := r.URL.Query().Get("sessionId")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		dbs, err := session.Engine.ListDatabases(r.Context())
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, dbs)
	})

	// List schemas
	mux.HandleFunc("/api/remote/schemas", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		dbName := q.Get("db")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		schemas, err := session.Engine.ListSchemas(r.Context(), dbName)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, schemas)
	})

	// List tables
	mux.HandleFunc("/api/remote/tables", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		dbName := q.Get("db")
		schema := q.Get("schema")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		tables, err := session.Engine.ListTables(r.Context(), dbName, schema)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, tables)
	})

	// Extended schema for single table
	mux.HandleFunc("/api/remote/table-schema", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		dbName := q.Get("db")
		schema := q.Get("schema")
		table := q.Get("table")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		res, err := session.Engine.GetTableSchema(r.Context(), dbName, schema, table)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Extended schema for all tables (ER Diagram)
	mux.HandleFunc("/api/remote/schema-extended", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		dbName := q.Get("db")
		schema := q.Get("schema")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		tables, err := session.Engine.ListTables(r.Context(), dbName, schema)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		result := make([]types.ExtendedTableSchema, 0, len(tables))
		for _, t := range tables {
			schemaInfo, err := session.Engine.GetTableSchema(r.Context(), dbName, schema, t.Name)
			if err == nil && schemaInfo != nil {
				result = append(result, *schemaInfo)
			} else {
				result = append(result, types.ExtendedTableSchema{
					Name:     t.Name,
					Schema:   t.Schema,
					Type:     t.Type,
					Columns:  t.Columns,
					RowCount: t.RowCount,
				})
			}
		}
		writeJSON(w, http.StatusOK, result)
	})

	// Get paginated table rows
	mux.HandleFunc("/api/remote/table-data", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		schema := q.Get("schema")
		table := q.Get("table")
		page, _ := strconv.Atoi(q.Get("page"))
		if page < 1 {
			page = 1
		}
		pageSize, _ := strconv.Atoi(q.Get("pageSize"))
		if pageSize < 1 {
			pageSize = 50
		}
		sortCol := q.Get("sortCol")
		sortDir := q.Get("sortDir")
		filter := q.Get("filter")

		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		res, err := session.Engine.GetTableData(r.Context(), types.TableDataRequest{
			Schema:        schema,
			Table:         table,
			Page:          page,
			PageSize:      pageSize,
			SortColumn:    sortCol,
			SortDirection: sortDir,
			Filter:        filter,
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Execute ad-hoc query
	mux.HandleFunc("/api/remote/query", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Query     string `json:"query"`
			MaxRows   int    `json:"maxRows"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		if req.MaxRows <= 0 {
			req.MaxRows = 100
		}
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		res, err := session.Engine.ExecuteQuery(r.Context(), req.Query, req.MaxRows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Apply pending changes
	mux.HandleFunc("/api/remote/apply-changes", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Payload   string `json:"payload"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		var changes types.PendingChanges
		if err := json.Unmarshal([]byte(req.Payload), &changes); err != nil {
			var changeList []types.PendingChange
			if err2 := json.Unmarshal([]byte(req.Payload), &changeList); err2 == nil {
				changes = types.PendingChanges{Changes: changeList}
			} else {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid payload JSON"})
				return
			}
		}
		res, err := session.Engine.ApplyPendingChanges(r.Context(), changes)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Explain query
	mux.HandleFunc("/api/remote/explain", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Query     string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		res, err := session.Engine.ExplainQuery(r.Context(), req.Query)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Simulate query
	mux.HandleFunc("/api/remote/simulate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Query     string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
			return
		}
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		res, err := session.Engine.SimulateQuery(r.Context(), req.Query)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	// Redis endpoints
	mux.HandleFunc("/api/remote/redis/scan", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		pattern := q.Get("pattern")
		if pattern == "" {
			pattern = "*"
		}
		cursor, _ := strconv.ParseUint(q.Get("cursor"), 10, 64)
		count, _ := strconv.ParseInt(q.Get("count"), 10, 64)
		if count <= 0 {
			count = 100
		}
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		redisEng, ok := session.Engine.(types.RedisEngineExtension)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "engine is not Redis"})
			return
		}
		res, err := redisEng.RedisScan(r.Context(), pattern, cursor, count)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("/api/remote/redis/inspect", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		sessionID := q.Get("sessionId")
		key := q.Get("key")
		session, err := s.dbManager.GetSession(sessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		redisEng, ok := session.Engine.(types.RedisEngineExtension)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "engine is not Redis"})
			return
		}
		res, err := redisEng.RedisGet(r.Context(), key)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("/api/remote/redis/delete", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Key       string `json:"key"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		redisEng, ok := session.Engine.(types.RedisEngineExtension)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "engine is not Redis"})
			return
		}
		err = redisEng.RedisDel(r.Context(), req.Key)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})

	mux.HandleFunc("/api/remote/redis/set", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SessionID string `json:"sessionId"`
			Key       string `json:"key"`
			ValType   string `json:"valType"`
			Value     string `json:"value"`
			TTLSec    int64  `json:"ttlSec"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		session, err := s.dbManager.GetSession(req.SessionID)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		redisEng, ok := session.Engine.(types.RedisEngineExtension)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "engine is not Redis"})
			return
		}
		err = redisEng.RedisSet(r.Context(), req.Key, req.ValType, req.Value, req.TTLSec)
		writeJSON(w, http.StatusOK, map[string]bool{"success": err == nil})
	})
}

func (s *Server) registerStaticRoutes(mux *http.ServeMux) {
	// Sub-FS pointing to "frontend/dist"
	distFS, err := fs.Sub(s.assets, "frontend/dist")
	if err != nil {
		log.Printf("Warning: failed to mount embedded frontend dist: %v", err)
		return
	}

	fileServer := http.FileServer(http.FS(distFS))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Do not interfere with API calls
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Check if requested file exists in dist
		filePath := strings.TrimPrefix(r.URL.Path, "/")
		if filePath == "" {
			filePath = "index.html"
		}

		f, err := distFS.Open(filePath)
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA Fallback: serve index.html for client-side routes
		indexFile, err := distFS.Open("index.html")
		if err != nil {
			http.Error(w, "VetroLog web assets not found. Run 'npm run build' inside frontend directory.", http.StatusNotFound)
			return
		}
		defer indexFile.Close()

		stat, _ := indexFile.Stat()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		http.ServeContent(w, r, "index.html", stat.ModTime(), indexFile.(io.ReadSeeker))
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// OpenBrowser opens the given URL in the user's default browser
func OpenBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default: // Linux / BSD
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
