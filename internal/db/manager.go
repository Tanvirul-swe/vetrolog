package db

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"vetrolog/internal/db/engines/mysql"
	"vetrolog/internal/db/engines/postgres"
	"vetrolog/internal/db/engines/redis"
	"vetrolog/internal/db/engines/sqlite"
	"vetrolog/internal/db/ssh"
	"vetrolog/internal/db/types"
)

// ActiveSession wraps an ongoing database connection, optional SSH tunnel, and state
type ActiveSession struct {
	SessionID       string
	Config          types.ConnectionConfig
	Engine          types.DatabaseEngine
	Tunnel          *ssh.Tunnel
	ConnectedAt     int64
	CurrentDatabase string
	CurrentSchema   string
}

// ConnectionManager manages saved profiles, connection pools, and live sessions
type ConnectionManager struct {
	mu       sync.RWMutex
	store    *Store
	sessions map[string]*ActiveSession
}

// NewConnectionManager initializes the manager and encrypted profile store
func NewConnectionManager() (*ConnectionManager, error) {
	store, err := NewStore()
	if err != nil {
		return nil, err
	}

	return &ConnectionManager{
		store:    store,
		sessions: make(map[string]*ActiveSession),
	}, nil
}

// Store returns the backing encrypted store
func (m *ConnectionManager) Store() *Store {
	return m.store
}

// CreateEngine factory instantiates the appropriate driver
func (m *ConnectionManager) CreateEngine(engineType types.EngineType) (types.DatabaseEngine, error) {
	switch strings.ToLower(string(engineType)) {
	case string(types.EnginePostgres):
		return postgres.NewEngine(), nil
	case string(types.EngineMySQL), string(types.EngineMariaDB):
		return mysql.NewEngine(), nil
	case string(types.EngineSQLite):
		return sqlite.NewEngine(), nil
	case string(types.EngineRedis):
		return redis.NewEngine(), nil
	default:
		return nil, fmt.Errorf("unsupported database engine: %s", engineType)
	}
}

// TestConnection attempts connection and reports latency and version info
func (m *ConnectionManager) TestConnection(ctx context.Context, cfg types.ConnectionConfig) (*types.ConnectionTestResult, error) {
	engine, err := m.CreateEngine(cfg.Engine)
	if err != nil {
		return &types.ConnectionTestResult{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	testCfg := cfg
	var tunnel *ssh.Tunnel

	// Start temporary SSH tunnel if enabled
	if cfg.SSH != nil && cfg.SSH.Enabled && cfg.Engine != types.EngineSQLite {
		targetPort := cfg.Port
		if targetPort <= 0 {
			targetPort = defaultPortForEngine(cfg.Engine)
		}
		t, err := ssh.StartTunnel(ctx, cfg.SSH, cfg.Host, targetPort)
		if err != nil {
			return &types.ConnectionTestResult{
				Success: false,
				Error:   fmt.Sprintf("SSH tunnel failed: %v", err),
			}, nil
		}
		tunnel = t
		defer tunnel.Close()

		testCfg.Host = "127.0.0.1"
		testCfg.Port = tunnel.LocalPort()
	}

	start := time.Now()
	connectCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	if err := engine.Connect(connectCtx, testCfg); err != nil {
		return &types.ConnectionTestResult{
			Success:   false,
			LatencyMs: float64(time.Since(start).Microseconds()) / 1000.0,
			Error:     err.Error(),
		}, nil
	}
	defer engine.Close()

	pingDuration, err := engine.Ping(connectCtx)
	latency := float64(pingDuration.Microseconds()) / 1000.0
	if latency <= 0 {
		latency = float64(time.Since(start).Microseconds()) / 1000.0
	}

	if err != nil {
		return &types.ConnectionTestResult{
			Success:   false,
			LatencyMs: latency,
			Error:     fmt.Sprintf("Ping failed: %v", err),
		}, nil
	}

	version := engine.ServerVersion(connectCtx)

	return &types.ConnectionTestResult{
		Success:       true,
		LatencyMs:     latency,
		ServerVersion: version,
		Message:       fmt.Sprintf("Connected to %s in %.1fms", version, latency),
	}, nil
}

// OpenConnection activates a saved connection profile and returns a session
func (m *ConnectionManager) OpenConnection(ctx context.Context, id string) (*types.ConnectionSession, error) {
	cfg, err := m.store.Get(id)
	if err != nil {
		return nil, err
	}

	return m.OpenSession(ctx, *cfg)
}

// OpenSession establishes connection and registers active session
func (m *ConnectionManager) OpenSession(ctx context.Context, cfg types.ConnectionConfig) (*types.ConnectionSession, error) {
	engine, err := m.CreateEngine(cfg.Engine)
	if err != nil {
		return nil, err
	}

	targetCfg := cfg
	var tunnel *ssh.Tunnel

	if cfg.SSH != nil && cfg.SSH.Enabled && cfg.Engine != types.EngineSQLite {
		targetPort := cfg.Port
		if targetPort <= 0 {
			targetPort = defaultPortForEngine(cfg.Engine)
		}
		t, err := ssh.StartTunnel(ctx, cfg.SSH, cfg.Host, targetPort)
		if err != nil {
			return nil, fmt.Errorf("ssh tunnel error: %w", err)
		}
		tunnel = t
		targetCfg.Host = "127.0.0.1"
		targetCfg.Port = tunnel.LocalPort()
	}

	connectCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	if err := engine.Connect(connectCtx, targetCfg); err != nil {
		if tunnel != nil {
			_ = tunnel.Close()
		}
		return nil, fmt.Errorf("connect failed: %w", err)
	}

	pingDur, _ := engine.Ping(connectCtx)
	sessionID := uuid.New().String()

	initialDb := cfg.Database
	if initialDb == "" {
		if cfg.Engine == types.EnginePostgres {
			initialDb = "postgres"
		} else if cfg.Engine == types.EngineSQLite {
			initialDb = filepath.Base(cfg.FilePath)
		} else if cfg.Engine == types.EngineRedis {
			initialDb = "db0"
		}
	}

	initialSchema := cfg.Schema
	if initialSchema == "" {
		if cfg.Engine == types.EnginePostgres {
			initialSchema = "public"
		} else if cfg.Engine == types.EngineMySQL {
			initialSchema = initialDb
		} else {
			initialSchema = "main"
		}
	}

	active := &ActiveSession{
		SessionID:       sessionID,
		Config:          cfg,
		Engine:          engine,
		Tunnel:          tunnel,
		ConnectedAt:     time.Now().UnixMilli(),
		CurrentDatabase: initialDb,
		CurrentSchema:   initialSchema,
	}

	m.mu.Lock()
	m.sessions[sessionID] = active
	m.mu.Unlock()

	return &types.ConnectionSession{
		SessionID: sessionID,
		Config: types.ConnectionSummary{
			ID:          cfg.ID,
			Name:        cfg.Name,
			Engine:      cfg.Engine,
			Host:        cfg.Host,
			Port:        cfg.Port,
			Database:    initialDb,
			ColorTag:    cfg.ColorTag,
			Environment: cfg.Environment,
			SafeMode:    cfg.SafeMode,
			FilePath:    cfg.FilePath,
			HasSSH:      tunnel != nil,
			UpdatedAt:   cfg.UpdatedAt,
		},
		ConnectedAt:     active.ConnectedAt,
		CurrentDatabase: initialDb,
		CurrentSchema:   initialSchema,
		PingDurationMs:  float64(pingDur.Microseconds()) / 1000.0,
	}, nil
}

// OpenLocalSQLite opens a direct desktop .sqlite file
func (m *ConnectionManager) OpenLocalSQLite(ctx context.Context, filePath string) (*types.ConnectionSession, error) {
	name := filepath.Base(filePath)
	cfg := types.ConnectionConfig{
		ID:          "local_" + uuid.New().String()[:8],
		Name:        name,
		Engine:      types.EngineSQLite,
		FilePath:    filePath,
		Database:    name,
		Environment: "local",
		ColorTag:    "green",
		CreatedAt:   time.Now().UnixMilli(),
		UpdatedAt:   time.Now().UnixMilli(),
	}

	return m.OpenSession(ctx, cfg)
}

// GetSession returns the active session pointer
func (m *ConnectionManager) GetSession(sessionID string) (*ActiveSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	s, ok := m.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	return s, nil
}

// CloseConnection shuts down an active session
func (m *ConnectionManager) CloseConnection(sessionID string) error {
	m.mu.Lock()
	session, ok := m.sessions[sessionID]
	if ok {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if !ok {
		return nil
	}

	var errEngine, errTunnel error
	if session.Engine != nil {
		errEngine = session.Engine.Close()
	}
	if session.Tunnel != nil {
		errTunnel = session.Tunnel.Close()
	}

	if errEngine != nil {
		return errEngine
	}
	return errTunnel
}

// CloseAll terminates all active sessions (called during application shutdown)
func (m *ConnectionManager) CloseAll() {
	m.mu.Lock()
	sessions := make([]*ActiveSession, 0, len(m.sessions))
	for _, s := range m.sessions {
		sessions = append(sessions, s)
	}
	m.sessions = make(map[string]*ActiveSession)
	m.mu.Unlock()

	for _, s := range sessions {
		if s.Engine != nil {
			_ = s.Engine.Close()
		}
		if s.Tunnel != nil {
			_ = s.Tunnel.Close()
		}
	}
}

func defaultPortForEngine(t types.EngineType) int {
	switch t {
	case types.EnginePostgres:
		return 5432
	case types.EngineMySQL, types.EngineMariaDB:
		return 3306
	case types.EngineRedis:
		return 6379
	default:
		return 0
	}
}
