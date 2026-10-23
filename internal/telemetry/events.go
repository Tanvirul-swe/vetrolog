package telemetry

import (
	"runtime"
)

// GA4Payload is the Measurement Protocol JSON payload format
type GA4Payload struct {
	ClientID string     `json:"client_id"`
	UserID   string     `json:"user_id,omitempty"` // Reserved for future authenticated user link
	Events   []GA4Event `json:"events"`
}

// GA4Event is a single event inside a GA4 payload
type GA4Event struct {
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// BuildAppInstalledEvent creates an event for fresh installations
func BuildAppInstalledEvent(version string, appMode string) GA4Event {
	return GA4Event{
		Name: "app_installed",
		Params: map[string]interface{}{
			"app_version": version,
			"os":          runtime.GOOS,
			"arch":        runtime.GOARCH,
			"app_mode":    appMode,
		},
	}
}

// BuildAppOpenedEvent creates a session start event
func BuildAppOpenedEvent(version string, sessionID string, sessionNum int, appMode string) GA4Event {
	return GA4Event{
		Name: "app_opened",
		Params: map[string]interface{}{
			"app_version": version,
			"session_id":  sessionID,
			"session_num": sessionNum,
			"os":          runtime.GOOS,
			"arch":        runtime.GOARCH,
			"app_mode":    appMode,
		},
	}
}

// BuildDeviceConnectedEvent records device connectivity without leaking serials or identifiers
func BuildDeviceConnectedEvent(connectionType string, platform string) GA4Event {
	return GA4Event{
		Name: "device_connected",
		Params: map[string]interface{}{
			"connection_type": connectionType, // "adb_usb", "adb_wifi", "emulator"
			"platform":        platform,       // "android"
		},
	}
}

// BuildDatabaseInspectedEvent aggregates database inspection without leaking names or schemas
func BuildDatabaseInspectedEvent(framework string, liveSync bool, tableCount int) GA4Event {
	var countBracket string
	switch {
	case tableCount <= 5:
		countBracket = "1-5"
	case tableCount <= 20:
		countBracket = "6-20"
	default:
		countBracket = "20+"
	}

	return GA4Event{
		Name: "database_inspected",
		Params: map[string]interface{}{
			"framework":    framework,    // "flutter", "room", "react_native", "custom"
			"live_sync":    liveSync,
			"table_bucket": countBracket,
		},
	}
}

// BuildFeatureUsedEvent tracks high-level developer action adoption
func BuildFeatureUsedEvent(featureName string, metadata map[string]interface{}) GA4Event {
	params := map[string]interface{}{
		"feature_name": featureName,
		"os":           runtime.GOOS,
	}
	for k, v := range metadata {
		// Only allow safe, non-PII primitives
		switch val := v.(type) {
		case string:
			if len(val) <= 100 {
				params[k] = val
			}
		case int, int64, float64, bool:
			params[k] = val
		}
	}

	return GA4Event{
		Name:   "feature_used",
		Params: params,
	}
}
