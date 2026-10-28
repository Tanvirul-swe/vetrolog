package app

import (
	"context"
	"sync"

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

	return &App{
		config:      cfg,
		broadcaster: b,
		batcher:     batcher,
		server:      srv,
		updater:     upd,
		telemetry:   tel,
		dbManager:   dbMgr,
	}
}
