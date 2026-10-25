package app

import (
	"context"
	"log"

	"vetrolog/internal/discovery"
)

// Startup is called when Wails initializes the application
func (a *App) Startup(ctx context.Context) {
	a.mu.Lock()
	a.ctx = ctx
	a.broadcaster.SetContext(ctx)
	a.updater.SetContext(ctx)
	a.mu.Unlock()

	log.Printf("[VetroLog] Starting WebSocket server on port %d...", a.config.WSPort)
	if err := a.server.Start(); err != nil {
		log.Printf("[VetroLog] Error starting server: %v", err)
	}

	// Start mDNS ZeroConf discovery advertisement for local Wi-Fi mobile clients
	a.mdns = discovery.NewMDNSService(a.config.WSPort)
}

// DomReady is called after the frontend DOM has been loaded
func (a *App) DomReady(ctx context.Context) {
	// Push initial connection state so frontend updates immediately upon loading
	state := a.server.GetState()
	a.broadcaster.Emit("vetrolog:connection_state", state)
}

// BeforeClose is called prior to application exit
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	return false
}

// Shutdown is called during application teardown
func (a *App) Shutdown(ctx context.Context) {
	log.Printf("[VetroLog] Shutting down server and mDNS...")
	if a.telemetry != nil {
		a.telemetry.Close()
	}
	if a.updater != nil {
		_ = a.updater.CancelUpdate()
	}
	if a.mdns != nil {
		a.mdns.Stop()
	}
	if a.dbManager != nil {
		a.dbManager.CloseAll()
	}
	a.batcher.Stop()
	a.server.Stop()
}
