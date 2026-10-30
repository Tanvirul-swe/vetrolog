package telemetry

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Config holds local telemetry preferences and anonymous client identification
type Config struct {
	ClientID        string    `json:"clientId"`
	Enabled         bool      `json:"enabled"`
	FirstInstalledAt time.Time `json:"firstInstalledAt"`
	LastSeenAt      time.Time `json:"lastSeenAt"`
	SessionCount    int       `json:"sessionCount"`
	IsNewInstall    bool      `json:"-"`
}

var (
	configMu sync.RWMutex
	customConfigFile string
)

// SetCustomConfigFileForTest overrides config file location for isolated unit testing
func SetCustomConfigFileForTest(path string) {
	configMu.Lock()
	defer configMu.Unlock()
	customConfigFile = path
}

// GenerateUUIDv4 creates an anonymous cryptographically secure random UUID
func GenerateUUIDv4() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("fallback-%d", time.Now().UnixNano())
	}
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant RFC 4122
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}

func getTelemetryConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	dir := filepath.Join(home, ".vetrolog")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func getTelemetryConfigFile() string {
	if customConfigFile != "" {
		return customConfigFile
	}
	return filepath.Join(getTelemetryConfigDir(), "telemetry.json")
}

// LoadConfig loads or initializes local anonymous telemetry configuration
func LoadConfig() *Config {
	configMu.Lock()
	defer configMu.Unlock()

	// Respect system-wide developer opt-out environment flags
	envDoNotTrack := os.Getenv("DO_NOT_TRACK") == "1" || os.Getenv("VETROLOG_TELEMETRY") == "0"

	file := getTelemetryConfigFile()
	data, err := os.ReadFile(file)
	if err == nil {
		var cfg Config
		if json.Unmarshal(data, &cfg) == nil && cfg.ClientID != "" {
			cfg.SessionCount++
			cfg.LastSeenAt = time.Now()
			if envDoNotTrack {
				cfg.Enabled = false
			}
			saveConfigToFile(&cfg, file)
			return &cfg
		}
	}

	// First-time fresh install
	now := time.Now()
	cfg := &Config{
		ClientID:         GenerateUUIDv4(),
		Enabled:          !envDoNotTrack,
		FirstInstalledAt: now,
		LastSeenAt:       now,
		SessionCount:     1,
		IsNewInstall:     true,
	}

	saveConfigToFile(cfg, file)
	return cfg
}

// SaveConfig writes updated configuration to disk safely
func SaveConfig(cfg *Config) error {
	configMu.Lock()
	defer configMu.Unlock()
	return saveConfigToFile(cfg, getTelemetryConfigFile())
}

func saveConfigToFile(cfg *Config, path string) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
