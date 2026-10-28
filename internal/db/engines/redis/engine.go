package redis

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"vetrolog/internal/db/types"
)

// Engine implements types.DatabaseEngine and types.RedisEngineExtension for Redis
type Engine struct {
	client     *redis.Client
	config     types.ConnectionConfig
	versionStr string
}

// NewEngine creates an uninitialized Redis engine
func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Type() types.EngineType {
	return types.EngineRedis
}

func (e *Engine) Connect(ctx context.Context, cfg types.ConnectionConfig) error {
	e.config = cfg

	host := cfg.Host
	port := cfg.Port
	if port <= 0 {
		port = 6379
	}

	dbNum := 0
	if cfg.Database != "" {
		if n, err := strconv.Atoi(strings.TrimPrefix(cfg.Database, "db")); err == nil {
			dbNum = n
		}
	}

	opt := &redis.Options{
		Addr:         fmt.Sprintf("%s:%d", host, port),
		Username:     cfg.User,
		Password:     cfg.Password,
		DB:           dbNum,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	client := redis.NewClient(opt)

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return fmt.Errorf("redis connection failed: %w", err)
	}

	e.client = client

	// Obtain Redis version
	if info, err := client.Info(ctx, "server").Result(); err == nil {
		for _, line := range strings.Split(info, "\r\n") {
			if strings.HasPrefix(line, "redis_version:") {
				e.versionStr = "Redis " + strings.TrimPrefix(line, "redis_version:")
				break
			}
		}
	}

	return nil
}

func (e *Engine) Close() error {
	if e.client != nil {
		err := e.client.Close()
		e.client = nil
		return err
	}
	return nil
}

func (e *Engine) Ping(ctx context.Context) (time.Duration, error) {
	if e.client == nil {
		return 0, fmt.Errorf("engine not connected")
	}
	start := time.Now()
	err := e.client.Ping(ctx).Err()
	return time.Since(start), err
}

func (e *Engine) ServerVersion(ctx context.Context) string {
	if e.versionStr != "" {
		return e.versionStr
	}
	if e.client != nil {
		if info, err := e.client.Info(ctx, "server").Result(); err == nil {
			for _, line := range strings.Split(info, "\r\n") {
				if strings.HasPrefix(line, "redis_version:") {
					e.versionStr = "Redis " + strings.TrimPrefix(line, "redis_version:")
					break
				}
			}
		}
	}
	return e.versionStr
}

func (e *Engine) ListDatabases(_ context.Context) ([]string, error) {
	dbs := make([]string, 16)
	for i := 0; i < 16; i++ {
		dbs[i] = fmt.Sprintf("db%d", i)
	}
	return dbs, nil
}

func (e *Engine) ListSchemas(_ context.Context, _ string) ([]string, error) {
	return []string{"default"}, nil
}

func (e *Engine) ListTables(ctx context.Context, _ string, _ string) ([]types.TableSummary, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	// In Redis, we list key namespaces or a primary "All Keys" collection
	dbsize, _ := e.client.DBSize(ctx).Result()

	return []types.TableSummary{
		{
			Name:     "KEYS",
			Schema:   "default",
			Type:     "collection",
			RowCount: dbsize,
		},
	}, nil
}

func (e *Engine) GetTableSchema(ctx context.Context, _ string, _ string, _ string) (*types.ExtendedTableSchema, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	dbsize, _ := e.client.DBSize(ctx).Result()

	return &types.ExtendedTableSchema{
		TableName: "KEYS",
		Name:      "KEYS",
		Schema:    "default",
		Type:      "KEY_SPACE",
		Columns: []types.ColumnInfo{
			{Name: "key", Type: "string", IsPrimaryKey: true},
			{Name: "type", Type: "string"},
			{Name: "ttl", Type: "integer"},
			{Name: "size", Type: "integer"},
		},
		PrimaryKeys: []string{"key"},
		RowCount:    dbsize,
	}, nil
}

func (e *Engine) GetTableData(ctx context.Context, req types.TableDataRequest) (*types.TableDataResult, error) {
	scanRes, err := e.RedisScan(ctx, req.Filter, 0, int64(req.PageSize))
	if err != nil {
		return nil, err
	}

	rows := make([]map[string]interface{}, len(scanRes.Keys))
	for i, k := range scanRes.Keys {
		rows[i] = map[string]interface{}{
			"key":  k.Key,
			"type": k.Type,
			"ttl":  k.TTLSec,
			"size": k.SizeBytes,
		}
	}

	return &types.TableDataResult{
		TableName: "KEYS",
		Schema:    "default",
		Columns: []types.ColumnInfo{
			{Name: "key", Type: "string", IsPrimaryKey: true},
			{Name: "type", Type: "string"},
			{Name: "ttl", Type: "integer"},
			{Name: "size", Type: "integer"},
		},
		Rows:       rows,
		TotalRows:  scanRes.TotalEstimate,
		Page:       req.Page,
		PageSize:   req.PageSize,
		DurationMs: scanRes.DurationMs,
	}, nil
}

func (e *Engine) ExecuteQuery(ctx context.Context, query string, maxRows int) (*types.QueryResult, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	tokens := strings.Fields(strings.TrimSpace(query))
	if len(tokens) == 0 {
		return &types.QueryResult{Query: query, Success: true}, nil
	}

	// Convert tokens to interface{} slice for client.Do
	args := make([]interface{}, len(tokens))
	for i, t := range tokens {
		args[i] = t
	}

	val, err := e.client.Do(ctx, args...).Result()
	duration := float64(time.Since(start).Microseconds()) / 1000.0

	if err != nil {
		return &types.QueryResult{
			Query:      query,
			Success:    false,
			Error:      err.Error(),
			DurationMs: duration,
		}, nil
	}

	// Format Redis result into rows or scalar
	var rows []map[string]interface{}
	switch v := val.(type) {
	case []interface{}:
		for i, item := range v {
			rows = append(rows, map[string]interface{}{
				"index": i,
				"value": fmt.Sprintf("%v", item),
			})
		}
	case map[interface{}]interface{}:
		for k, item := range v {
			rows = append(rows, map[string]interface{}{
				"key":   fmt.Sprintf("%v", k),
				"value": fmt.Sprintf("%v", item),
			})
		}
	default:
		rows = append(rows, map[string]interface{}{
			"result": fmt.Sprintf("%v", v),
		})
	}

	var cols []types.ColumnInfo
	if len(rows) > 0 {
		for k := range rows[0] {
			cols = append(cols, types.ColumnInfo{Name: k, Type: "string"})
		}
	}

	return &types.QueryResult{
		Query:      query,
		Columns:    cols,
		Rows:       rows,
		Affected:   int64(len(rows)),
		DurationMs: duration,
		Success:    true,
	}, nil
}

func (e *Engine) ApplyPendingChanges(ctx context.Context, changes types.PendingChanges) (*types.ChangeResult, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	var totalAffected int64

	for _, ch := range changes.Changes {
		if ch.Type == types.ChangeDelete {
			if keyVal, ok := ch.PrimaryKey["key"]; ok {
				e.client.Del(ctx, fmt.Sprintf("%v", keyVal))
				totalAffected++
			}
		} else if ch.Type == types.ChangeUpdate || ch.Type == types.ChangeInsert {
			key := fmt.Sprintf("%v", ch.PrimaryKey["key"])
			if key == "" {
				key = fmt.Sprintf("%v", ch.NewValues["key"])
			}
			val := fmt.Sprintf("%v", ch.NewValues["value"])
			if key != "" && val != "" {
				e.client.Set(ctx, key, val, 0)
				totalAffected++
			}
		}
	}

	return &types.ChangeResult{
		Success:      true,
		AffectedRows: totalAffected,
		DurationMs:   float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

func (e *Engine) ExplainQuery(_ context.Context, _ string) (*types.QueryPlanResult, error) {
	return &types.QueryPlanResult{
		RawPlan: "Redis in-memory key-value lookups are direct O(1) operations.",
		Success: true,
	}, nil
}

// RedisScan lists keys with pattern and cursor
func (e *Engine) RedisScan(ctx context.Context, pattern string, cursor uint64, count int64) (*types.RedisScanResult, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	if pattern == "" {
		pattern = "*"
	}
	if count <= 0 {
		count = 50
	}

	start := time.Now()
	keys, nextCursor, err := e.client.Scan(ctx, cursor, pattern, count).Result()
	if err != nil {
		return nil, err
	}

	var keyInfos []types.RedisKeyInfo
	for _, k := range keys {
		kType, _ := e.client.Type(ctx, k).Result()
		ttl, _ := e.client.TTL(ctx, k).Result()

		keyInfos = append(keyInfos, types.RedisKeyInfo{
			Key:    k,
			Type:   kType,
			TTL:    ttl,
			TTLSec: int64(ttl.Seconds()),
		})
	}

	dbsize, _ := e.client.DBSize(ctx).Result()

	return &types.RedisScanResult{
		Keys:          keyInfos,
		Cursor:        nextCursor,
		TotalEstimate: dbsize,
		DurationMs:    float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

// RedisGet retrieves detailed key contents
func (e *Engine) RedisGet(ctx context.Context, key string) (*types.RedisValueResult, error) {
	if e.client == nil {
		return nil, fmt.Errorf("engine not connected")
	}

	start := time.Now()
	kType, err := e.client.Type(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	ttl, _ := e.client.TTL(ctx, key).Result()

	var value interface{}

	switch kType {
	case "string":
		value, err = e.client.Get(ctx, key).Result()
	case "hash":
		value, err = e.client.HGetAll(ctx, key).Result()
	case "list":
		value, err = e.client.LRange(ctx, key, 0, 100).Result()
	case "set":
		value, err = e.client.SMembers(ctx, key).Result()
	case "zset":
		value, err = e.client.ZRangeWithScores(ctx, key, 0, 100).Result()
	default:
		value, err = e.client.Get(ctx, key).Result()
	}

	if err != nil && err != redis.Nil {
		return nil, err
	}

	return &types.RedisValueResult{
		Key:        key,
		Type:       kType,
		TTLSec:     int64(ttl.Seconds()),
		Value:      value,
		Success:    true,
		DurationMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}, nil
}

// RedisSet writes a key value
func (e *Engine) RedisSet(ctx context.Context, key string, valType string, value string, ttlSec int64) error {
	if e.client == nil {
		return fmt.Errorf("engine not connected")
	}

	var expiration time.Duration
	if ttlSec > 0 {
		expiration = time.Duration(ttlSec) * time.Second
	}

	return e.client.Set(ctx, key, value, expiration).Err()
}

// RedisDel deletes a key
func (e *Engine) RedisDel(ctx context.Context, key string) error {
	if e.client == nil {
		return fmt.Errorf("engine not connected")
	}
	return e.client.Del(ctx, key).Err()
}
