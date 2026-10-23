package telemetry

import (
	"strings"
	"testing"
)

func TestGenerateUUIDv4(t *testing.T) {
	uuid1 := GenerateUUIDv4()
	uuid2 := GenerateUUIDv4()

	if uuid1 == "" || uuid2 == "" {
		t.Fatal("GenerateUUIDv4 returned empty string")
	}

	if uuid1 == uuid2 {
		t.Fatalf("GenerateUUIDv4 generated duplicate IDs: %s", uuid1)
	}

	parts := strings.Split(uuid1, "-")
	if len(parts) != 5 {
		t.Fatalf("Expected 5 segments in UUID, got %d for %s", len(parts), uuid1)
	}
}

func TestBuildEvents(t *testing.T) {
	installedEv := BuildAppInstalledEvent("v1.3.1", "desktop")
	if installedEv.Name != "app_installed" {
		t.Errorf("Expected event name app_installed, got %s", installedEv.Name)
	}
	if installedEv.Params["app_version"] != "v1.3.1" {
		t.Errorf("Expected version v1.3.1, got %v", installedEv.Params["app_version"])
	}

	openedEv := BuildAppOpenedEvent("v1.3.1", "sess-123", 2, "desktop")
	if openedEv.Name != "app_opened" {
		t.Errorf("Expected event name app_opened, got %s", openedEv.Name)
	}
	if openedEv.Params["session_id"] != "sess-123" {
		t.Errorf("Expected session_id sess-123, got %v", openedEv.Params["session_id"])
	}

	devEv := BuildDeviceConnectedEvent("adb_usb", "android")
	if devEv.Name != "device_connected" {
		t.Errorf("Expected device_connected, got %s", devEv.Name)
	}

	dbEv := BuildDatabaseInspectedEvent("flutter", true, 12)
	if dbEv.Params["table_bucket"] != "6-20" {
		t.Errorf("Expected bucket 6-20, got %v", dbEv.Params["table_bucket"])
	}

	featEv := BuildFeatureUsedEvent("sql_playground_run", map[string]interface{}{
		"tab_count": 3,
		"dialect":   "sqlite",
	})
	if featEv.Params["feature_name"] != "sql_playground_run" {
		t.Errorf("Expected feature sql_playground_run, got %v", featEv.Params["feature_name"])
	}
}

func TestServiceOptOut(t *testing.T) {
	svc := NewService("desktop")
	defer svc.Close()

	initialEnabled, clientID := svc.GetStatus()
	if clientID == "" {
		t.Fatal("Expected non-empty ClientID")
	}

	// Toggle opt-out
	err := svc.SetEnabled(false)
	if err != nil {
		t.Fatalf("SetEnabled failed: %v", err)
	}

	if svc.IsEnabled() {
		t.Error("Expected service to be disabled after SetEnabled(false)")
	}

	// Restore initial state
	_ = svc.SetEnabled(initialEnabled)
}
