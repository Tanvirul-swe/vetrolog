package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"

	"vetrolog/internal/auth"
	"vetrolog/internal/broadcaster"
	"vetrolog/internal/config"
	"vetrolog/internal/db"
	"vetrolog/internal/discovery"
	"vetrolog/internal/server"
	"vetrolog/internal/telemetry"
	"vetrolog/internal/updater"
)

// App manages the backend subsystems, Wails runtime context, and exported methods
type App struct {
	mu          sync.RWMutex
	ctx         context.Context
	config      *config.Config
	broadcaster *broadcaster.Broadcaster
	batcher     *broadcaster.MutationBatcher
	server      *server.Server
	mdns        *discovery.MDNSService
	updater     *updater.Service
	telemetry   *telemetry.Service
	dbManager   *db.ConnectionManager
	authService *auth.Service
}

// NewApp creates a new App struct with initialized subsystems
func NewApp() *App {
	cfg := config.DefaultConfig()
	b := broadcaster.NewBroadcaster()
	batcher := broadcaster.NewMutationBatcher(b, cfg.BatchFlushWindow, cfg.MaxBatchSize)
	srv := server.NewServer(cfg, b, batcher)
	upd := updater.NewService()
	tel := telemetry.NewService("desktop")
	dbMgr, _ := db.NewConnectionManager()
	authSvc := auth.NewService(8787)

	if u := authSvc.GetCurrentUser(); u != nil {
		h := sha256.Sum256([]byte(u.ID))
		tel.SetUserID(hex.EncodeToString(h[:]))
	}

	return &App{
		config:      cfg,
		broadcaster: b,
		batcher:     batcher,
		server:      srv,
		updater:     upd,
		telemetry:   tel,
		dbManager:   dbMgr,
		authService: authSvc,
	}
}
