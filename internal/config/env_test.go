package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvFile(t *testing.T) {
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, ".env")

	content := `
# Comment line
TEST_VETRO_ENV_KEY_1=simple_value
TEST_VETRO_ENV_KEY_2="quoted_value"
TEST_VETRO_ENV_KEY_3='single_quoted'
INVALID_LINE_NO_EQUALS
`
	if err := os.WriteFile(envPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to write test .env: %v", err)
	}

	// Pre-set one key to ensure it is not overwritten
	_ = os.Setenv("TEST_VETRO_ENV_KEY_1", "original_precedence")
	defer os.Unsetenv("TEST_VETRO_ENV_KEY_1")
	defer os.Unsetenv("TEST_VETRO_ENV_KEY_2")
	defer os.Unsetenv("TEST_VETRO_ENV_KEY_3")

	if err := LoadEnvFile(envPath); err != nil {
		t.Fatalf("LoadEnvFile returned error: %v", err)
	}

	if val := os.Getenv("TEST_VETRO_ENV_KEY_1"); val != "original_precedence" {
		t.Errorf("Expected original_precedence, got %s", val)
	}

	if val := os.Getenv("TEST_VETRO_ENV_KEY_2"); val != "quoted_value" {
		t.Errorf("Expected quoted_value, got %s", val)
	}

	if val := os.Getenv("TEST_VETRO_ENV_KEY_3"); val != "single_quoted" {
		t.Errorf("Expected single_quoted, got %s", val)
	}
}

