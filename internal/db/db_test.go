package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
	"vetrolog/internal/db/types"
)

func TestStoreEncryptionAndPersistence(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "vetrolog-db-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	store := &Store{
		filePath: filepath.Join(tmpDir, "connections.json"),
		key:      []byte("12345678901234567890123456789012"), // 32 bytes AES-256
	}

	cfg := &types.ConnectionConfig{
		Name:        "Test PostgreSQL",
		Engine:      types.EnginePostgres,
		Host:        "localhost",
		Port:        5432,
		User:        "postgres",
		Password:    "super_secret_password_123!",
		Database:    "production_db",
		Environment: "production",
		ColorTag:    "red",
		SafeMode:    true,
	}

	saved, err := store.Save(cfg)
	if err != nil {
		t.Fatalf("Failed to save connection: %v", err)
	}

	if saved.ID == "" {
		t.Fatal("Expected non-empty generated ID")
	}

	// Read raw file to verify encryption (password must NOT be in plaintext)
	rawBytes, err := os.ReadFile(store.filePath)
	if err != nil {
		t.Fatalf("Failed to read raw file: %v", err)
	}
	if string(rawBytes) == "" || string(rawBytes) == "null" {
		t.Fatal("Expected saved JSON content")
	}
	if containsSubstring(string(rawBytes), "super_secret_password_123!") {
		t.Fatal("Password was stored in plaintext! Encryption failed.")
	}

	// Retrieve via Get() and ensure it decrypts accurately
	retrieved, err := store.Get(saved.ID)
	if err != nil {
		t.Fatalf("Failed to get connection: %v", err)
	}

	if retrieved.Password != "super_secret_password_123!" {
		t.Fatalf("Decrypted password mismatch. Got %s", retrieved.Password)
	}

	// Test ListSummaries
	summaries, err := store.ListSummaries()
	if err != nil {
		t.Fatalf("ListSummaries failed: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("Expected 1 summary, got %d", len(summaries))
	}
	if summaries[0].Name != "Test PostgreSQL" {
		t.Fatalf("Summary name mismatch: %s", summaries[0].Name)
	}

	// Test Delete
	if err := store.Delete(saved.ID); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	summariesAfter, _ := store.ListSummaries()
	if len(summariesAfter) != 0 {
		t.Fatalf("Expected 0 summaries after deletion, got %d", len(summariesAfter))
	}
}

func TestLocalSQLiteEngineOperations(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "vetrolog-sqlite-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "sample.sqlite")

	// Create test SQLite DB with tables and records
	dbConn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = dbConn.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL,
			email TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com');
		INSERT INTO users (username, email) VALUES ('bob', 'bob@example.com');
		INSERT INTO users (username, email) VALUES ('charlie', 'charlie@example.com');
	`)
	if err != nil {
		t.Fatal(err)
	}
	_ = dbConn.Close()

	store, err := NewStoreWithPath(filepath.Join(tmpDir, "connections.json"))
	if err != nil {
		t.Fatal(err)
	}
	mgr := NewConnectionManagerWithStore(store)
	defer mgr.CloseAll()

	ctx := context.Background()

	// Test OpenLocalSQLite
	session, err := mgr.OpenLocalSQLite(ctx, dbPath)
	if err != nil {
		t.Fatalf("OpenLocalSQLite failed: %v", err)
	}

	active, err := mgr.GetSession(session.SessionID)
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	// 1. Test ListTables
	tables, err := active.Engine.ListTables(ctx, "", "")
	if err != nil {
		t.Fatalf("ListTables failed: %v", err)
	}
	if len(tables) != 1 || tables[0].Name != "users" {
		t.Fatalf("Expected table 'users', got %+v", tables)
	}
	if tables[0].RowCount != 3 {
		t.Fatalf("Expected 3 rows, got %d", tables[0].RowCount)
	}
	if len(tables[0].Columns) == 0 {
		t.Fatalf("Expected table 'users' to have columns populated, got 0")
	}

	// 2. Test GetTableData
	data, err := active.Engine.GetTableData(ctx, types.TableDataRequest{
		Table:    "users",
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("GetTableData failed: %v", err)
	}
	if len(data.Rows) != 3 {
		t.Fatalf("Expected 3 rows, got %d", len(data.Rows))
	}
	if data.Rows[0]["username"] != "alice" {
		t.Fatalf("Expected first row to be alice, got %v", data.Rows[0]["username"])
	}

	// 3. Test ApplyPendingChanges (Staged Update)
	changeRes, err := active.Engine.ApplyPendingChanges(ctx, types.PendingChanges{
		Changes: []types.PendingChange{
			{
				Type:       types.ChangeUpdate,
				Table:      "users",
				PrimaryKey: map[string]interface{}{"id": 1},
				NewValues:  map[string]interface{}{"username": "alice_updated"},
			},
		},
	})
	if err != nil || !changeRes.Success {
		t.Fatalf("ApplyPendingChanges failed: %v", err)
	}
	if changeRes.AffectedRows != 1 {
		t.Fatalf("Expected 1 affected row, got %d", changeRes.AffectedRows)
	}

	// 4. Test ExecuteQuery
	queryRes, err := active.Engine.ExecuteQuery(ctx, "SELECT username FROM users WHERE id = 1;", 10)
	if err != nil || !queryRes.Success {
		t.Fatalf("ExecuteQuery failed: %v", err)
	}
	if len(queryRes.Rows) != 1 || queryRes.Rows[0]["username"] != "alice_updated" {
		t.Fatalf("Expected alice_updated, got %v", queryRes.Rows[0]["username"])
	}
	if !queryRes.DefaultLimitApplied {
		t.Fatalf("Expected DefaultLimitApplied to be true for query without explicit limit")
	}

	queryWithLimit, err := active.Engine.ExecuteQuery(ctx, "SELECT username FROM users LIMIT 10;", 10)
	if err != nil || !queryWithLimit.Success {
		t.Fatalf("ExecuteQuery with limit failed: %v", err)
	}
	if queryWithLimit.DefaultLimitApplied {
		t.Fatalf("Expected DefaultLimitApplied to be false for query with explicit LIMIT")
	}

	// 5. Test SimulateQuery (Dry-Run with guaranteed rollback)
	simRes, err := active.Engine.SimulateQuery(ctx, "UPDATE users SET username = 'temp_simulation' WHERE id = 1;")
	if err != nil || !simRes.Success {
		t.Fatalf("SimulateQuery failed: %v", err)
	}
	if !simRes.IsMutation {
		t.Fatalf("Expected IsMutation to be true")
	}
	if simRes.AffectedRows != 1 {
		t.Fatalf("Expected 1 affected row in simulation, got %d", simRes.AffectedRows)
	}
	if len(simRes.PreviewRows) != 1 {
		t.Fatalf("Expected 1 preview row, got %d", len(simRes.PreviewRows))
	}

	// Verify database is completely untouched after simulation rollback
	verifyRes, err := active.Engine.ExecuteQuery(ctx, "SELECT username FROM users WHERE id = 1;", 1)
	if err != nil || len(verifyRes.Rows) == 0 {
		t.Fatalf("Verify query failed: %v", err)
	}
	if verifyRes.Rows[0]["username"] != "alice_updated" {
		t.Fatalf("Expected database to be untouched (alice_updated), but got %v", verifyRes.Rows[0]["username"])
	}

	// Close session
	if err := mgr.CloseConnection(session.SessionID); err != nil {
		t.Fatalf("CloseConnection failed: %v", err)
	}
}

func containsSubstring(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || (len(s) > 0 && len(sub) > 0 && searchSub(s, sub)))
}

func searchSub(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestPendingChangesUnmarshal(t *testing.T) {
	// 1. Test unmarshaling from object format
	objectJSON := `{"changes":[{"type":"UPDATE","table":"users","primaryKey":{"id":1},"newValues":{"username":"bob"}}]}`
	var changesObj types.PendingChanges
	if err := json.Unmarshal([]byte(objectJSON), &changesObj); err != nil {
		t.Fatalf("Failed to unmarshal object format: %v", err)
	}
	if len(changesObj.Changes) != 1 || changesObj.Changes[0].Table != "users" {
		t.Fatalf("Unexpected unmarshaled object: %+v", changesObj)
	}

	// 2. Test unmarshaling from direct array format
	arrayJSON := `[{"type":"UPDATE","table":"users","primaryKey":{"id":1},"newValues":{"username":"bob"}}]`
	var changesArr types.PendingChanges
	if err := json.Unmarshal([]byte(arrayJSON), &changesArr); err != nil {
		t.Fatalf("Failed to unmarshal array format: %v", err)
	}
	if len(changesArr.Changes) != 1 || changesArr.Changes[0].Table != "users" {
		t.Fatalf("Unexpected unmarshaled array: %+v", changesArr)
	}
}

func TestCreateEngineMSSQL(t *testing.T) {
	mgr := &ConnectionManager{}
	eng, err := mgr.CreateEngine(types.EngineMSSQL)
	if err != nil {
		t.Fatalf("Failed to create MSSQL engine: %v", err)
	}
	if eng.Type() != types.EngineMSSQL {
		t.Fatalf("Expected engine type mssql, got %s", eng.Type())
	}
	if port := defaultPortForEngine(types.EngineMSSQL); port != 1433 {
		t.Fatalf("Expected port 1433 for MSSQL, got %d", port)
	}
}
