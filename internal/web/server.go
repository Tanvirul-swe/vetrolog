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
)

// Server handles the HTTP REST API and serves the embedded React frontend
type Server struct {
	port      int
	assets    embed.FS
	adbServer *adb.Service
}

// NewServer initializes a web server instance
func NewServer(assets embed.FS, port int) *Server {
	return &Server{
		port:      port,
		assets:    assets,
		adbServer: adb.GetService(),
	}
}

// StartServer launches the HTTP server and optionally launches the browser
func StartServer(assets embed.FS, port int, openBrowser bool) error {
	srv := NewServer(assets, port)
	mux := http.NewServeMux()

	// Register API routes
	srv.registerAPIRoutes(mux)

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
			"version": "1.0.0",
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
