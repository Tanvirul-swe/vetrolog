package config

import "time"

// Config holds runtime configuration parameters
type Config struct {
	WSHost            string        `json:"wsHost"`
	WSPort            int           `json:"wsPort"`
	BatchFlushWindow  time.Duration `json:"batchFlushWindow"`
	MaxBatchSize      int           `json:"maxBatchSize"`
	MaxMessageSize    int64         `json:"maxMessageSize"`
	PingInterval      time.Duration `json:"pingInterval"`
	PongTimeout       time.Duration `json:"pongTimeout"`
}

// DefaultConfig returns safe production defaults
func DefaultConfig() *Config {
	return &Config{
		WSHost:           "0.0.0.0",
		WSPort:           9222,
		BatchFlushWindow: 50 * time.Millisecond,
		MaxBatchSize:     250,
		MaxMessageSize:   10 * 1024 * 1024, // 10MB per payload (e.g. large table snapshots)
		PingInterval:     15 * time.Second,
		PongTimeout:      30 * time.Second,
	}
}
