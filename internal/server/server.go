package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"vetrolog/internal/broadcaster"
	"vetrolog/internal/config"
	"vetrolog/internal/models"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024 * 64,
	WriteBufferSize: 1024 * 64,
	// Allow all origins since mobile devices connect from local LAN / USB adb reverse
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Server encapsulates the HTTP and WebSocket listeners
type Server struct {
	cfg         *config.Config
	broadcaster *broadcaster.Broadcaster
	batcher     *broadcaster.MutationBatcher
	hub         *Hub
	httpServer  *http.Server
	mu          sync.Mutex
	running     bool
}

func NewServer(cfg *config.Config, b *broadcaster.Broadcaster, batcher *broadcaster.MutationBatcher) *Server {
	hub := NewHub(b, batcher)
	return &Server{
		cfg:         cfg,
		broadcaster: b,
		batcher:     batcher,
		hub:         hub,
	}
}

func (s *Server) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return nil
	}
	s.running = true
	s.mu.Unlock()

	go s.hub.Run()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleWebSocket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	addr := fmt.Sprintf("%s:%d", s.cfg.WSHost, s.cfg.WSPort)
	s.httpServer = &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[VetroLog] WebSocket server listening on ws://%s/ws", addr)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[VetroLog] Server Listen error: %v", err)
		}
	}()

	return nil
}

func (s *Server) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.running {
		return
	}
	s.running = false

	if s.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.httpServer.Shutdown(ctx)
	}
	s.hub.Stop()
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	client := NewClient(s.hub, conn, s.cfg)
	s.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (s *Server) Hub() *Hub {
	return s.hub
}

func (s *Server) GetState() models.ConnectionState {
	return models.ConnectionState{
		IsConnected:   s.hub.GetActiveDevice() != nil,
		Port:          s.cfg.WSPort,
		Host:          s.cfg.WSHost,
		CurrentDevice: s.hub.GetActiveDevice(),
	}
}
