package adb

import (
	"database/sql"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Service provides high-level device, app, database inspection and SQL execution.
type Service struct {
	client   *Client
	cacheDir string
}

var defaultService *Service

// GetService returns the singleton ADB service.
func GetService() *Service {
	if defaultService == nil {
		home, _ := os.UserHomeDir()
		cacheDir := filepath.Join(home, ".vetrolog", "cache")
		_ = os.MkdirAll(cacheDir, 0755)
		defaultService = &Service{
			client:   GetClient(),
			cacheDir: cacheDir,
		}
	}
	return defaultService
}

// ListDevices discovers all USB and Wi-Fi ADB devices attached to the host.
func (s *Service) ListDevices() ([]Device, error) {
	out, err := s.client.Run("devices", "-l")
	if err != nil {
		return nil, err
	}

	var devices []Device
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "List of devices") || strings.HasPrefix(line, "*") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		id := parts[0]
		state := parts[1]

		dev := Device{
			ID:         id,
			State:      state,
			IsEmulator: strings.HasPrefix(id, "emulator-"),
		}

		for _, p := range parts[2:] {
			if strings.HasPrefix(p, "model:") {
				dev.Model = strings.TrimPrefix(p, "model:")
			} else if strings.HasPrefix(p, "product:") {
				dev.Product = strings.TrimPrefix(p, "product:")
			} else if strings.HasPrefix(p, "device:") {
				dev.Device = strings.TrimPrefix(p, "device:")
			} else if strings.HasPrefix(p, "transport_id:") {
				dev.TransportID = strings.TrimPrefix(p, "transport_id:")
			}
		}

		if dev.Model == "" {
			dev.Model = dev.Device
		}
		if dev.Model == "" {
			dev.Model = id
		}

		devices = append(devices, dev)
	}

	return devices, nil
}

// IsAppRunning checks if the specified package currently has an active PID on the device.
func (s *Service) IsAppRunning(deviceID, packageName string) bool {
	if deviceID == "" || packageName == "" {
		return false
	}
	out, err := s.client.RunDevice(deviceID, "shell", fmt.Sprintf("pidof %s", packageName))
	if err != nil {
		return false
	}
	return strings.TrimSpace(out) != ""
}

// ListDebuggableApps scans third-party packages installed on the device that allow run-as and are currently running.
func (s *Service) ListDebuggableApps(deviceID string) ([]App, error) {
	var runningApps []App
	seen := make(map[string]bool)

	// 1. Instant check: inspect currently focused/foreground app in <100ms
	if focusOut, err := s.client.RunDevice(deviceID, "shell", "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"); err == nil {
		for _, token := range strings.Fields(focusOut) {
			if strings.Contains(token, "/") {
				pkg := strings.Split(token, "/")[0]
				pkg = strings.TrimLeft(pkg, "{")
				if pkg != "" && !seen[pkg] && strings.Contains(pkg, ".") {
					if testOut, err := s.client.RunAs(deviceID, pkg, "id"); err == nil && strings.Contains(testOut, "uid=") {
						seen[pkg] = true
						runningApps = append(runningApps, App{
							PackageName:  pkg,
							IsDebuggable: true,
							DisplayName:  getDisplayName(pkg) + " (Active)",
							IsRunning:    true,
						})
						break
					}
				}
			}
		}
	}

	// 2. Fast batch check on device in a single subshell (~0.5s for all 3rd-party packages)
	// Only return apps that currently have an active running PID
	batchCmd := "for p in $(pm list packages -3 | cut -d: -f2); do if run-as $p id >/dev/null 2>&1; then pid=$(pidof $p 2>/dev/null); if [ -n \"$pid\" ]; then echo \"RUNNING:$p:$pid\"; fi; fi; done"
	if out, err := s.client.RunDevice(deviceID, "shell", batchCmd); err == nil {
		lines := strings.Split(out, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "RUNNING:") {
				parts := strings.Split(strings.TrimPrefix(line, "RUNNING:"), ":")
				pkg := parts[0]
				pid := ""
				if len(parts) > 1 {
					pid = parts[1]
				}
				if pkg != "" && !seen[pkg] {
					seen[pkg] = true
					runningApps = append(runningApps, App{
						PackageName:  pkg,
						IsDebuggable: true,
						DisplayName:  getDisplayName(pkg) + " (Running)",
						IsRunning:    true,
						PID:          pid,
					})
				}
			}
		}
	}

	return runningApps, nil
}

func getDisplayName(pkg string) string {
	parts := strings.Split(pkg, ".")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return pkg
}

// DiscoverDatabases finds SQLite databases and SharedPreferences XML files in the app sandbox.
func (s *Service) DiscoverDatabases(deviceID, packageName string) ([]DiscoveredDB, error) {
	var result []DiscoveredDB

	// Potential locations where SQLite databases live
	dirsToSearch := []struct {
		remoteDir string
		dbType    string
	}{
		{"databases", "sqlite"},
		{"app_flutter", "sqlite"}, // Standard location for Flutter sqflite
		{"shared_prefs", "shared_preferences"},
	}

	for _, d := range dirsToSearch {
		out, err := s.client.RunAs(deviceID, packageName, fmt.Sprintf("ls -la '%s'", d.remoteDir))
		if err != nil || strings.Contains(out, "No such file") {
			continue
		}

		files := parseLsOutput(out)
		for _, f := range files {
			if strings.HasSuffix(f.name, "-journal") || strings.HasSuffix(f.name, "-wal") || strings.HasSuffix(f.name, "-shm") {
				continue // Skip SQLite auxiliary files
			}

			remoteFullPath := filepath.Join(d.remoteDir, f.name)

			if d.dbType == "sqlite" && (strings.HasSuffix(f.name, ".db") || strings.HasSuffix(f.name, ".sqlite") || strings.HasSuffix(f.name, ".sqlite3") || !strings.Contains(f.name, ".")) {
				localPath := s.getLocalCachePath(deviceID, packageName, f.name)

				// Pull only if not already cached with same size
				localInfo, err := os.Stat(localPath)
				if err != nil || localInfo.Size() != f.size {
					_ = s.client.ExecOutCat(deviceID, packageName, remoteFullPath, localPath)
				}

				tables, _ := s.inspectSqliteTables(localPath)
				result = append(result, DiscoveredDB{
					ID:        fmt.Sprintf("%s_%s", packageName, f.name),
					Name:      f.name,
					Type:      "sqlite",
					Path:      remoteFullPath,
					SizeBytes: f.size,
					UpdatedAt: time.Now().UnixMilli(),
					Tables:    tables,
				})
			} else if d.dbType == "shared_preferences" && strings.HasSuffix(f.name, ".xml") {
				localPath := s.getLocalCachePath(deviceID, packageName, f.name)

				localInfo, err := os.Stat(localPath)
				if err != nil || localInfo.Size() != f.size {
					_ = s.client.ExecOutCat(deviceID, packageName, remoteFullPath, localPath)
				}

				rowCount, _ := countSharedPrefsEntries(localPath)
				tableMeta := TableMeta{
					Name:     "preferences",
					Type:     "table",
					RowCount: rowCount,
					Columns: []ColumnMeta{
						{Name: "key", Type: "TEXT", IsPrimaryKey: true},
						{Name: "type", Type: "TEXT"},
						{Name: "value", Type: "TEXT"},
					},
				}
				result = append(result, DiscoveredDB{
					ID:        fmt.Sprintf("%s_%s", packageName, f.name),
					Name:      f.name,
					Type:      "shared_preferences",
					Path:      remoteFullPath,
					SizeBytes: f.size,
					UpdatedAt: time.Now().UnixMilli(),
					Tables:    []TableMeta{tableMeta},
				})
			}
		}
	}

	return result, nil
}

// GetTableData reads rows from the target SQLite or SharedPreferences database.
func (s *Service) GetTableData(deviceID, packageName, remotePath, tableName string, page, pageSize int) (*TableDataResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}

	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	// Refresh copy from device
	_ = s.client.ExecOutCat(deviceID, packageName, remotePath, localPath)
	s.syncAuxiliarySqliteFiles(deviceID, packageName, remotePath, localPath)

	// SharedPreferences XML handler
	if strings.HasSuffix(fileName, ".xml") {
		rows, total, err := parseSharedPrefsRows(localPath, page, pageSize)
		if err != nil {
			return nil, err
		}
		return &TableDataResult{
			DatabaseID:  fmt.Sprintf("%s_%s", packageName, fileName),
			TableName:   tableName,
			TotalRows:   total,
			Page:        page,
			PageSize:    pageSize,
			Columns: []ColumnMeta{
				{Name: "key", Type: "TEXT", IsPrimaryKey: true},
				{Name: "type", Type: "TEXT"},
				{Name: "value", Type: "TEXT"},
			},
			Rows:        rows,
			TableCounts: map[string]int64{"preferences": total},
		}, nil
	}

	// SQLite handler
	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return nil, fmt.Errorf("failed opening sqlite: %v", err)
	}
	defer db.Close()

	// Get total row count for the requested table
	var totalRows int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", tableName)
	_ = db.QueryRow(countQuery).Scan(&totalRows)

	// Fetch counts for all tables in this database to keep the left sidebar updated in real-time
	tableCounts := make(map[string]int64)
	tableRows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
	if err == nil {
		defer tableRows.Close()
		for tableRows.Next() {
			var tName string
			if err := tableRows.Scan(&tName); err == nil {
				if tName == tableName {
					tableCounts[tName] = totalRows
				} else {
					var count int64
					_ = db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", tName)).Scan(&count)
					tableCounts[tName] = count
				}
			}
		}
	}

	// Get columns
	columns, err := s.getTableColumns(db, tableName)
	if err != nil {
		return nil, err
	}

	// Query paginated rows
	offset := (page - 1) * pageSize
	dataQuery := fmt.Sprintf("SELECT * FROM \"%s\" LIMIT %d OFFSET %d", tableName, pageSize, offset)
	rows, err := db.Query(dataQuery)
	if err != nil {
		return nil, fmt.Errorf("failed querying table data: %v", err)
	}
	defer rows.Close()

	colNames, _ := rows.Columns()
	var resultRows []map[string]interface{}

	for rows.Next() {
		colPointers := make([]interface{}, len(colNames))
		colValues := make([]interface{}, len(colNames))
		for i := range colValues {
			colPointers[i] = &colValues[i]
		}

		if err := rows.Scan(colPointers...); err != nil {
			continue
		}

		rowMap := make(map[string]interface{})
		for i, colName := range colNames {
			val := colValues[i]
			if b, ok := val.([]byte); ok {
				rowMap[colName] = string(b)
			} else {
				rowMap[colName] = val
			}
		}
		resultRows = append(resultRows, rowMap)
	}

	return &TableDataResult{
		DatabaseID:  fmt.Sprintf("%s_%s", packageName, fileName),
		TableName:   tableName,
		TotalRows:   totalRows,
		Page:        page,
		PageSize:    pageSize,
		Columns:     columns,
		Rows:        resultRows,
		TableCounts: tableCounts,
	}, nil
}

func (s *Service) syncAuxiliarySqliteFiles(deviceID, packageName, remotePath, localPath string) {
	if !strings.HasSuffix(remotePath, ".db") && !strings.HasSuffix(remotePath, ".sqlite") && !strings.HasSuffix(remotePath, ".sqlite3") {
		return
	}

	cmd := fmt.Sprintf("for ext in -wal -shm -journal; do if [ -f '%s'$ext ]; then echo HAS:$ext; fi; done", remotePath)
	out, err := s.client.RunAs(deviceID, packageName, cmd)
	if err != nil {
		return
	}

	foundExts := make(map[string]bool)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "HAS:") {
			ext := strings.TrimPrefix(line, "HAS:")
			foundExts[ext] = true
			_ = s.client.ExecOutCat(deviceID, packageName, remotePath+ext, localPath+ext)
		}
	}

	for _, ext := range []string{"-wal", "-shm", "-journal"} {
		if !foundExts[ext] {
			_ = os.Remove(localPath + ext)
		}
	}
}

// ExecuteQuery runs a custom SQL query directly on the SQLite database and syncs mutations back.
func (s *Service) ExecuteQuery(deviceID, packageName, remotePath, sqlQuery string) (*QueryExecResult, error) {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	// Refresh latest copy
	_ = s.client.ExecOutCat(deviceID, packageName, remotePath, localPath)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	start := time.Now()
	trimmed := strings.TrimSpace(sqlQuery)
	isSelect := strings.HasPrefix(strings.ToUpper(trimmed), "SELECT") || strings.HasPrefix(strings.ToUpper(trimmed), "PRAGMA")

	if isSelect {
		rows, err := db.Query(sqlQuery)
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		if err != nil {
			return &QueryExecResult{
				Query:      sqlQuery,
				DurationMs: elapsed,
				Success:    false,
				Error:      err.Error(),
			}, nil
		}
		defer rows.Close()

		colNames, _ := rows.Columns()
		var resultRows []map[string]interface{}

		for rows.Next() {
			colPointers := make([]interface{}, len(colNames))
			colValues := make([]interface{}, len(colNames))
			for i := range colValues {
				colPointers[i] = &colValues[i]
			}
			if err := rows.Scan(colPointers...); err == nil {
				rowMap := make(map[string]interface{})
				for i, colName := range colNames {
					val := colValues[i]
					if b, ok := val.([]byte); ok {
						rowMap[colName] = string(b)
					} else {
						rowMap[colName] = val
					}
				}
				resultRows = append(resultRows, rowMap)
			}
		}

		return &QueryExecResult{
			Query:      sqlQuery,
			Rows:       resultRows,
			Affected:   int64(len(resultRows)),
			DurationMs: elapsed,
			Success:    true,
		}, nil
	}

	// Mutation query (INSERT, UPDATE, DELETE, etc.)
	res, err := db.Exec(sqlQuery)
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &QueryExecResult{
			Query:      sqlQuery,
			DurationMs: elapsed,
			Success:    false,
			Error:      err.Error(),
		}, nil
	}

	affected, _ := res.RowsAffected()

	// Push updated SQLite database back to the device sandbox
	_ = s.client.PushToSandbox(deviceID, packageName, localPath, remotePath)

	return &QueryExecResult{
		Query:      sqlQuery,
		Affected:   affected,
		DurationMs: elapsed,
		Success:    true,
	}, nil
}

// UpdateRow updates a row in the SQLite database and syncs back to device.
func (s *Service) UpdateRow(deviceID, packageName, remotePath, tableName string, pk map[string]interface{}, values map[string]interface{}) error {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return err
	}
	defer db.Close()

	var setClauses []string
	var args []interface{}
	for k, v := range values {
		setClauses = append(setClauses, fmt.Sprintf("\"%s\" = ?", k))
		args = append(args, v)
	}

	var whereClauses []string
	for k, v := range pk {
		whereClauses = append(whereClauses, fmt.Sprintf("\"%s\" = ?", k))
		args = append(args, v)
	}

	query := fmt.Sprintf("UPDATE \"%s\" SET %s WHERE %s", tableName, strings.Join(setClauses, ", "), strings.Join(whereClauses, " AND "))
	_, err = db.Exec(query, args...)
	if err != nil {
		return err
	}

	return s.client.PushToSandbox(deviceID, packageName, localPath, remotePath)
}

// DeleteRow deletes a row in the SQLite database and syncs back to device.
func (s *Service) DeleteRow(deviceID, packageName, remotePath, tableName string, pk map[string]interface{}) error {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return err
	}
	defer db.Close()

	var whereClauses []string
	var args []interface{}
	for k, v := range pk {
		whereClauses = append(whereClauses, fmt.Sprintf("\"%s\" = ?", k))
		args = append(args, v)
	}

	query := fmt.Sprintf("DELETE FROM \"%s\" WHERE %s", tableName, strings.Join(whereClauses, " AND "))
	_, err = db.Exec(query, args...)
	if err != nil {
		return err
	}

	return s.client.PushToSandbox(deviceID, packageName, localPath, remotePath)
}

func (s *Service) getLocalCachePath(deviceID, packageName, fileName string) string {
	dir := filepath.Join(s.cacheDir, sanitize(deviceID), sanitize(packageName))
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, sanitize(fileName))
}

func sanitize(in string) string {
	replacer := strings.NewReplacer(":", "_", "/", "_", "\\", "_")
	return replacer.Replace(in)
}

func (s *Service) inspectSqliteTables(dbPath string) ([]TableMeta, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableMeta
	for rows.Next() {
		var name, tType string
		if err := rows.Scan(&name, &tType); err == nil {
			var rowCount int64
			_ = db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", name)).Scan(&rowCount)

			cols, _ := s.getTableColumns(db, name)
			tables = append(tables, TableMeta{
				Name:     name,
				Type:     tType,
				RowCount: rowCount,
				Columns:  cols,
			})
		}
	}

	return tables, nil
}

func (s *Service) getTableColumns(db *sql.DB, tableName string) ([]ColumnMeta, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(\"%s\")", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []ColumnMeta
	for rows.Next() {
		var cid int
		var name, cType string
		var notNull, pk int
		var dfltValue interface{}

		if err := rows.Scan(&cid, &name, &cType, &notNull, &dfltValue, &pk); err == nil {
			cols = append(cols, ColumnMeta{
				Name:         name,
				Type:         cType,
				IsPrimaryKey: pk > 0,
				IsNullable:   notNull == 0,
			})
		}
	}
	return cols, nil
}

type fileInfo struct {
	name string
	size int64
}

func parseLsOutput(out string) []fileInfo {
	var files []fileInfo
	lines := strings.Split(out, "\n")
	for _, l := range lines {
		fields := strings.Fields(l)
		if len(fields) >= 8 {
			name := fields[len(fields)-1]
			if name == "." || name == ".." {
				continue
			}
			size, _ := strconv.ParseInt(fields[4], 10, 64)
			files = append(files, fileInfo{name: name, size: size})
		}
	}
	return files
}

func countSharedPrefsEntries(xmlPath string) (int64, error) {
	data, err := os.ReadFile(xmlPath)
	if err != nil {
		return 0, err
	}

	var parsed map[string]interface{}
	// Simple count of XML tags
	decoder := xml.NewDecoder(strings.NewReader(string(data)))
	var count int64
	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}
		if se, ok := t.(xml.StartElement); ok {
			if se.Name.Local != "map" {
				count++
			}
		}
	}
	_ = parsed
	return count, nil
}

func parseSharedPrefsRows(xmlPath string, page, pageSize int) ([]map[string]interface{}, int64, error) {
	data, err := os.ReadFile(xmlPath)
	if err != nil {
		return nil, 0, err
	}

	decoder := xml.NewDecoder(strings.NewReader(string(data)))
	var allRows []map[string]interface{}

	for {
		t, err := decoder.Token()
		if err != nil {
			break
		}
		if se, ok := t.(xml.StartElement); ok {
			if se.Name.Local == "map" {
				continue
			}

			key := ""
			for _, attr := range se.Attr {
				if attr.Name.Local == "name" {
					key = attr.Value
					break
				}
			}

			val := ""
			if se.Name.Local == "string" {
				var content string
				_ = decoder.DecodeElement(&content, &se)
				val = content
			} else {
				for _, attr := range se.Attr {
					if attr.Name.Local == "value" {
						val = attr.Value
						break
					}
				}
			}

			allRows = append(allRows, map[string]interface{}{
				"key":   key,
				"type":  se.Name.Local,
				"value": val,
			})
		}
	}

	total := int64(len(allRows))
	start := (page - 1) * pageSize
	if start >= len(allRows) {
		return []map[string]interface{}{}, total, nil
	}
	end := start + pageSize
	if end > len(allRows) {
		end = len(allRows)
	}

	return allRows[start:end], total, nil
}

// ExplainQuery executes SQLite's EXPLAIN QUERY PLAN and builds an interactive operation tree.
func (s *Service) ExplainQuery(deviceID, packageName, remotePath, sqlQuery string) (*QueryPlanResult, error) {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	// Ensure latest copy
	_ = s.client.ExecOutCat(deviceID, packageName, remotePath, localPath)
	s.syncAuxiliarySqliteFiles(deviceID, packageName, remotePath, localPath)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	start := time.Now()
	explainSQL := fmt.Sprintf("EXPLAIN QUERY PLAN %s", strings.TrimRight(strings.TrimSpace(sqlQuery), ";"))
	rows, err := db.Query(explainSQL)
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &QueryPlanResult{
			Success:    false,
			Error:      err.Error(),
			DurationMs: elapsed,
		}, nil
	}
	defer rows.Close()

	var rawNodes []PlanNode
	nodeMap := make(map[int]*PlanNode)
	hasFullScan := false
	hasTempBTree := false

	for rows.Next() {
		var id, parent, notused int
		var detail string
		if err := rows.Scan(&id, &parent, &notused, &detail); err != nil {
			continue
		}

		op := "OTHER"
		cost := "info"
		tbl := ""
		idx := ""

		upper := strings.ToUpper(detail)
		if strings.HasPrefix(upper, "SCAN") {
			op = "SCAN"
			cost = "high"
			hasFullScan = true
			tbl = extractTableNameFromDetail(detail)
		} else if strings.HasPrefix(upper, "SEARCH") {
			op = "SEARCH"
			cost = "optimal"
			tbl = extractTableNameFromDetail(detail)
			idx = extractIndexNameFromDetail(detail)
		} else if strings.Contains(upper, "TEMP B-TREE") {
			op = "TEMP_BTREE"
			cost = "warning"
			hasTempBTree = true
		} else if strings.HasPrefix(upper, "COMPOUND") {
			op = "COMPOUND"
			cost = "info"
		}

		node := PlanNode{
			ID:        id,
			ParentID:  parent,
			Detail:    detail,
			Operation: op,
			Table:     tbl,
			IndexName: idx,
			CostAlert: cost,
			Children:  []PlanNode{},
		}
		rawNodes = append(rawNodes, node)
		nodeMap[id] = &node
	}

	// Build tree hierarchy
	var rootNodes []PlanNode
	for _, n := range rawNodes {
		if n.ParentID == 0 || nodeMap[n.ParentID] == nil {
			rootNodes = append(rootNodes, n)
		} else {
			p := nodeMap[n.ParentID]
			p.Children = append(p.Children, n)
		}
	}

	summary := "Query executed using existing indexes."
	if hasFullScan {
		summary = "Full table scan detected! Query traverses all rows linearly without an index."
	} else if hasTempBTree {
		summary = "Temporary B-Tree created for sorting or grouping. An index may improve performance."
	}

	return &QueryPlanResult{
		RawNodes:     rawNodes,
		RootNodes:    rootNodes,
		HasFullScan:  hasFullScan,
		HasTempBTree: hasTempBTree,
		Summary:      summary,
		DurationMs:   elapsed,
		Success:      true,
	}, nil
}

// SimulateQuery runs mutating queries in an isolated rollback transaction sandbox.
func (s *Service) SimulateQuery(deviceID, packageName, remotePath, sqlQuery string) (*SimulationResult, error) {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	// Ensure latest copy
	_ = s.client.ExecOutCat(deviceID, packageName, remotePath, localPath)
	s.syncAuxiliarySqliteFiles(deviceID, packageName, remotePath, localPath)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	start := time.Now()
	trimmed := strings.TrimSpace(sqlQuery)
	upper := strings.ToUpper(trimmed)

	isMutation := strings.HasPrefix(upper, "UPDATE") ||
		strings.HasPrefix(upper, "DELETE") ||
		strings.HasPrefix(upper, "INSERT") ||
		strings.HasPrefix(upper, "DROP") ||
		strings.HasPrefix(upper, "ALTER")

	if !isMutation {
		// Read-only query simulation
		rows, err := db.Query(sqlQuery)
		elapsed := float64(time.Since(start).Microseconds()) / 1000.0
		if err != nil {
			return &SimulationResult{
				Query:      sqlQuery,
				IsMutation: false,
				DurationMs: elapsed,
				Success:    false,
				Error:      err.Error(),
			}, nil
		}
		defer rows.Close()

		var count int64
		for rows.Next() {
			count++
		}
		return &SimulationResult{
			Query:        sqlQuery,
			IsMutation:   false,
			AffectedRows: count,
			DurationMs:   elapsed,
			Success:      true,
		}, nil
	}

	// For UPDATE or DELETE, attempt to capture preview of affected rows before executing
	var previewRows []map[string]interface{}
	if strings.HasPrefix(upper, "UPDATE") || strings.HasPrefix(upper, "DELETE") {
		tableName := extractTableNameFromMutation(trimmed)
		whereClause := extractWhereClause(trimmed)
		if tableName != "" {
			previewSQL := fmt.Sprintf("SELECT * FROM \"%s\"", tableName)
			if whereClause != "" {
				previewSQL += " " + whereClause
			}
			previewSQL += " LIMIT 20"

			pRows, err := db.Query(previewSQL)
			if err == nil {
				defer pRows.Close()
				colNames, _ := pRows.Columns()
				for pRows.Next() {
					colPointers := make([]interface{}, len(colNames))
					colValues := make([]interface{}, len(colNames))
					for i := range colValues {
						colPointers[i] = &colValues[i]
					}
					if err := pRows.Scan(colPointers...); err == nil {
						rowMap := make(map[string]interface{})
						for i, colName := range colNames {
							val := colValues[i]
							if b, ok := val.([]byte); ok {
								rowMap[colName] = string(b)
							} else {
								rowMap[colName] = val
							}
						}
						previewRows = append(previewRows, rowMap)
					}
				}
			}
		}
	}

	// Begin explicit transaction
	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to open sandbox transaction: %v", err)
	}
	defer tx.Rollback() // Always rollback so no changes persist

	res, err := tx.Exec(sqlQuery)
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		return &SimulationResult{
			Query:        sqlQuery,
			IsMutation:   true,
			AffectedRows: 0,
			DurationMs:   elapsed,
			Success:      false,
			Error:        err.Error(),
		}, nil
	}

	affected, _ := res.RowsAffected()

	// Rollback explicitly
	_ = tx.Rollback()

	return &SimulationResult{
		Query:        sqlQuery,
		IsMutation:   true,
		AffectedRows: affected,
		PreviewRows:  previewRows,
		DurationMs:   elapsed,
		Success:      true,
	}, nil
}

// GetDatabaseSchemaExtended fetches full metadata including columns, foreign keys, and indexes for all tables.
func (s *Service) GetDatabaseSchemaExtended(deviceID, packageName, remotePath string) (*ExtendedSchemaResult, error) {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	// Ensure latest copy
	_ = s.client.ExecOutCat(deviceID, packageName, remotePath, localPath)
	s.syncAuxiliarySqliteFiles(deviceID, packageName, remotePath, localPath)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	tableRows, err := db.Query("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer tableRows.Close()

	var extendedTables []ExtendedTableSchema
	for tableRows.Next() {
		var name, tType string
		if err := tableRows.Scan(&name, &tType); err != nil {
			continue
		}

		var rowCount int64
		_ = db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM \"%s\"", name)).Scan(&rowCount)

		cols, _ := s.getTableColumns(db, name)
		fks, _ := s.getTableForeignKeys(db, name)
		idxs, _ := s.getTableIndexes(db, name)

		extendedTables = append(extendedTables, ExtendedTableSchema{
			Name:        name,
			Type:        tType,
			RowCount:    rowCount,
			Columns:     cols,
			ForeignKeys: fks,
			Indexes:     idxs,
		})
	}

	return &ExtendedSchemaResult{
		DatabaseID: fmt.Sprintf("%s_%s", packageName, fileName),
		Tables:     extendedTables,
	}, nil
}

// CreateIndex executes a CREATE INDEX DDL statement and syncs back to the mobile device.
func (s *Service) CreateIndex(deviceID, packageName, remotePath, indexSql string) error {
	fileName := filepath.Base(remotePath)
	localPath := s.getLocalCachePath(deviceID, packageName, fileName)

	db, err := sql.Open("sqlite", localPath)
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.Exec(indexSql)
	if err != nil {
		return err
	}

	return s.client.PushToSandbox(deviceID, packageName, localPath, remotePath)
}

func (s *Service) getTableForeignKeys(db *sql.DB, tableName string) ([]ForeignKeyMeta, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA foreign_key_list(\"%s\")", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fks []ForeignKeyMeta
	for rows.Next() {
		var id, seq int
		var toTable, fromCol, toCol, onUpdate, onDelete, match string
		if err := rows.Scan(&id, &seq, &toTable, &fromCol, &toCol, &onUpdate, &onDelete, &match); err == nil {
			fks = append(fks, ForeignKeyMeta{
				ID:       id,
				Seq:      seq,
				ToTable:  toTable,
				FromCol:  fromCol,
				ToCol:    toCol,
				OnUpdate: onUpdate,
				OnDelete: onDelete,
			})
		}
	}
	return fks, nil
}

func (s *Service) getTableIndexes(db *sql.DB, tableName string) ([]IndexMeta, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA index_list(\"%s\")", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indexes []IndexMeta
	for rows.Next() {
		var seq int
		var name, origin string
		var unique, partial int
		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err == nil {
			// Query columns in this index
			cols := []string{}
			infoRows, err := db.Query(fmt.Sprintf("PRAGMA index_info(\"%s\")", name))
			if err == nil {
				for infoRows.Next() {
					var seqno, cid int
					var cName string
					if err := infoRows.Scan(&seqno, &cid, &cName); err == nil {
						cols = append(cols, cName)
					}
				}
				infoRows.Close()
			}

			indexes = append(indexes, IndexMeta{
				Seq:     seq,
				Name:    name,
				Unique:  unique > 0,
				Origin:  origin,
				Partial: partial > 0,
				Columns: cols,
			})
		}
	}
	return indexes, nil
}

func extractTableNameFromDetail(detail string) string {
	parts := strings.Fields(detail)
	for i, p := range parts {
		if strings.EqualFold(p, "TABLE") && i+1 < len(parts) {
			tbl := parts[i+1]
			tbl = strings.Trim(tbl, "\"';,")
			return tbl
		}
	}
	return ""
}

func extractIndexNameFromDetail(detail string) string {
	parts := strings.Fields(detail)
	for i, p := range parts {
		if strings.EqualFold(p, "INDEX") && i+1 < len(parts) {
			idx := parts[i+1]
			idx = strings.Trim(idx, "\"';,()")
			return idx
		}
	}
	return ""
}

func extractTableNameFromMutation(sql string) string {
	parts := strings.Fields(sql)
	if len(parts) < 2 {
		return ""
	}
	upper := strings.ToUpper(parts[0])
	if upper == "UPDATE" {
		return strings.Trim(parts[1], "\"`';")
	}
	if upper == "DELETE" && len(parts) >= 3 && strings.ToUpper(parts[1]) == "FROM" {
		return strings.Trim(parts[2], "\"`';")
	}
	return ""
}

func extractWhereClause(sql string) string {
	upper := strings.ToUpper(sql)
	idx := strings.Index(upper, "WHERE")
	if idx != -1 {
		return strings.TrimSpace(sql[idx:])
	}
	return ""
}

