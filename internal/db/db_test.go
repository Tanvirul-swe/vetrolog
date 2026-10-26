package db

import (
	"context"
	"database/sql"
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

	mgr, err := NewConnectionManager()
	if err != nil {
		t.Fatal(err)
	}
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

func TestNeonLiveConnection(t *testing.T) {
	if os.Getenv("TEST_LIVE_NEON") == "" {
		t.Skip("Skipping live external Neon DB test. Run with TEST_LIVE_NEON=1 to enable.")
	}

	mgr, err := NewConnectionManager()
	if err != nil {
		t.Fatal(err)
	}
	defer mgr.CloseAll()

	ctx := context.Background()

	cfg := &types.ConnectionConfig{
		Name:        "Neon Testing DB",
		Engine:      types.EnginePostgres,
		Host:        "ep-jolly-sound-atuql2pp-pooler.c-9.us-east-1.aws.neon.tech",
		Port:        5432,
		User:        "neondb_owner",
		Password:    "npg_r3SVs6YLtPvE",
		Database:    "neondb",
		SSLMode:     "require",
		ColorTag:    "green",
		Environment: "development",
	}

	testRes, _ := mgr.TestConnection(ctx, *cfg)
	t.Logf("TestConnection result: Success=%v, Latency=%.1fms, Version=%s, Error=%s",
		testRes.Success, testRes.LatencyMs, testRes.ServerVersion, testRes.Error)

	if !testRes.Success {
		t.Fatalf("Connection to Neon DB failed: %s", testRes.Error)
	}

	session, err := mgr.OpenSession(ctx, *cfg)
	if err != nil {
		t.Fatalf("OpenSession failed: %v", err)
	}
	defer mgr.CloseConnection(session.SessionID)

	active, err := mgr.GetSession(session.SessionID)
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	schemas, err := active.Engine.ListSchemas(ctx, "neondb")
	if err != nil {
		t.Fatalf("ListSchemas failed: %v", err)
	}
	t.Logf("Discovered schemas in Neon DB: %v", schemas)

	tables, err := active.Engine.ListTables(ctx, "neondb", "public")
	if err != nil {
		t.Fatalf("ListTables failed: %v", err)
	}
	t.Logf("Discovered tables in Neon DB (public schema): %d tables", len(tables))
	for _, tbl := range tables {
		t.Logf("  - Table: %s (Type: %s, Rows: %d)", tbl.Name, tbl.Type, tbl.RowCount)
	}

	// Test a simple query
	qRes, err := active.Engine.ExecuteQuery(ctx, "SELECT current_database(), current_user, version();", 10)
	if err != nil || !qRes.Success {
		t.Fatalf("Query execution failed: %v, error: %s", err, qRes.Error)
	}
	t.Logf("Query executed in %.1fms. Returned %d rows: %v", qRes.DurationMs, len(qRes.Rows), qRes.Rows)
}

func TestSaveNeonProfile(t *testing.T) {
	if os.Getenv("TEST_LIVE_NEON") == "" {
		t.Skip("Skipping live external Neon profile save test.")
	}

	store, err := NewStore()
	if err != nil {
		t.Fatal(err)
	}

	cfg := &types.ConnectionConfig{
		Name:        "Neon Postgres (Testing)",
		Engine:      types.EnginePostgres,
		Host:        "ep-jolly-sound-atuql2pp-pooler.c-9.us-east-1.aws.neon.tech",
		Port:        5432,
		User:        "neondb_owner",
		Password:    "npg_r3SVs6YLtPvE",
		Database:    "neondb",
		SSLMode:     "require",
		ColorTag:    "green",
		Environment: "development",
		SafeMode:    false,
	}

	saved, err := store.Save(cfg)
	if err != nil {
		t.Fatalf("Failed to save connection: %v", err)
	}

	t.Logf("Successfully saved Neon connection profile with ID: %s", saved.ID)
}
