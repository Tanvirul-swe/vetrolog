package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// LoadEnv attempts to load environment variables from local .env files.
// It checks the current working directory first, followed by ~/.vetrolog/.env.
// Variables already present in the process environment are NOT overwritten.
func LoadEnv() {
	// 1. Try current working directory
	if err := LoadEnvFile(".env"); err == nil {
		return
	}

	// 2. Try ~/.vetrolog/.env
	home, err := os.UserHomeDir()
	if err == nil {
		userEnv := filepath.Join(home, ".vetrolog", ".env")
		_ = LoadEnvFile(userEnv)
	}
}

// LoadEnvFile parses a single .env formatted file and sets missing env vars
func LoadEnvFile(filePath string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Strip surrounding single or double quotes
		if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
			(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
			if len(val) >= 2 {
				val = val[1 : len(val)-1]
			}
		}

		// Only set if not already defined in the OS environment
		if _, exists := os.LookupEnv(key); !exists && key != "" {
			_ = os.Setenv(key, val)
		}
	}

	return scanner.Err()
}

