package types

import (
	"context"
	"time"
)

// DatabaseEngine defines the contract implemented by all database drivers
type DatabaseEngine interface {
	Type() EngineType
	Connect(ctx context.Context, cfg ConnectionConfig) error
	Close() error
	Ping(ctx context.Context) (time.Duration, error)
	ServerVersion(ctx context.Context) string

	// Schema & Metadata inspection
	ListDatabases(ctx context.Context) ([]string, error)
	ListSchemas(ctx context.Context, dbName string) ([]string, error)
	ListTables(ctx context.Context, dbName, schema string) ([]TableSummary, error)
	GetTableSchema(ctx context.Context, dbName, schema, table string) (*ExtendedTableSchema, error)

	// Data operations
	GetTableData(ctx context.Context, req TableDataRequest) (*TableDataResult, error)
	ExecuteQuery(ctx context.Context, query string, maxRows int) (*QueryResult, error)

	// Atomic Staged Changes
	ApplyPendingChanges(ctx context.Context, changes PendingChanges) (*ChangeResult, error)

	// Performance analysis & Dry Run simulation
	ExplainQuery(ctx context.Context, query string) (*QueryPlanResult, error)
	SimulateQuery(ctx context.Context, query string) (*SimulationResult, error)
}

// RedisEngineExtension provides optional key-value methods for Redis
type RedisEngineExtension interface {
	RedisScan(ctx context.Context, pattern string, cursor uint64, count int64) (*RedisScanResult, error)
	RedisGet(ctx context.Context, key string) (*RedisValueResult, error)
	RedisSet(ctx context.Context, key string, valType string, value string, ttlSec int64) error
	RedisDel(ctx context.Context, key string) error
}
