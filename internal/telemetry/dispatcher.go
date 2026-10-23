package telemetry

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"vetrolog/internal/version"
)

// Default Google Analytics 4 Measurement Protocol endpoint
const defaultGA4Endpoint = "https://www.google-analytics.com/mp/collect"

// Default GA4 credentials (can be overridden via environment variables or build flags)
var (
	// DefaultMeasurementID is the fallback Google Analytics 4 Property Measurement ID (e.g. G-XXXXXXXXXX)
	DefaultMeasurementID = "G-VETROLOG01"
	// DefaultAPISecret is the Measurement Protocol API secret created in GA4 Data Stream settings
	DefaultAPISecret = "vetrolog_mp_secret"
)

// Service manages anonymous telemetry collection and asynchronous dispatching
type Service struct {
	cfg           *Config
	measurementID string
	apiSecret     string
	endpoint      string
	sessionID     string
	appMode       string // "desktop" or "web"
	client        *http.Client
	eventQueue    chan GA4Event
	stopCh        chan struct{}
	wg            sync.WaitGroup
	mu            sync.RWMutex
}

// NewService initializes a background telemetry service
func NewService(appMode string) *Service {
	cfg := LoadConfig()

	mID := os.Getenv("VETROLOG_GA_MEASUREMENT_ID")
	if mID == "" {
		mID = DefaultMeasurementID
	}

	secret := os.Getenv("VETROLOG_GA_API_SECRET")
	if secret == "" {
		secret = DefaultAPISecret
	}

	s := &Service{
		cfg:           cfg,
		measurementID: mID,
		apiSecret:     secret,
		endpoint:      defaultGA4Endpoint,
		sessionID:     GenerateUUIDv4(),
		appMode:       appMode,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		eventQueue: make(chan GA4Event, 100),
		stopCh:     make(chan struct{}),
	}

	// Start background dispatcher worker
	s.wg.Add(1)
	go s.worker()

	// Dispatch initial lifecycle events if enabled
	if s.IsEnabled() {
		if cfg.IsNewInstall {
			s.Track(BuildAppInstalledEvent(version.CurrentVersion, appMode))
		}
		s.Track(BuildAppOpenedEvent(version.CurrentVersion, s.sessionID, cfg.SessionCount, appMode))
	}

	return s
}

// IsEnabled returns whether telemetry collection is currently active
func (s *Service) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg != nil && s.cfg.Enabled
}

// SetEnabled toggles telemetry and saves preference to disk
func (s *Service) SetEnabled(enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cfg == nil {
		s.cfg = &Config{ClientID: GenerateUUIDv4()}
	}
	s.cfg.Enabled = enabled
	return SaveConfig(s.cfg)
}

// GetStatus returns the current anonymous client ID and enablement status
func (s *Service) GetStatus() (enabled bool, clientID string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.cfg == nil {
		return false, ""
	}
	return s.cfg.Enabled, s.cfg.ClientID
}

// Track enqueues an event for non-blocking asynchronous transmission
func (s *Service) Track(event GA4Event) {
	if !s.IsEnabled() {
		return
	}

	select {
	case s.eventQueue <- event:
	default:
		// Queue full; drop silently to guarantee zero performance impact
	}
}

// TrackFeature is a convenience wrapper for feature engagement tracking
func (s *Service) TrackFeature(name string, metadata map[string]interface{}) {
	s.Track(BuildFeatureUsedEvent(name, metadata))
}

// worker batches and sends events in the background
func (s *Service) worker() {
	defer s.wg.Done()

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	var batch []GA4Event

	for {
		select {
		case <-s.stopCh:
			// Drain remaining events on shutdown
			for len(s.eventQueue) > 0 {
				batch = append(batch, <-s.eventQueue)
			}
			if len(batch) > 0 {
				s.sendBatch(batch)
			}
			return

		case ev := <-s.eventQueue:
			batch = append(batch, ev)
			if len(batch) >= 10 {
				s.sendBatch(batch)
				batch = nil
			}

		case <-ticker.C:
			if len(batch) > 0 {
				s.sendBatch(batch)
				batch = nil
			}
		}
	}
}

// sendBatch transmits events to GA4 Measurement Protocol
func (s *Service) sendBatch(events []GA4Event) {
	if len(events) == 0 || !s.IsEnabled() {
		return
	}

	s.mu.RLock()
	clientID := s.cfg.ClientID
	mID := s.measurementID
	secret := s.apiSecret
	s.mu.RUnlock()

	// Skip network dispatch if placeholder credentials are unchanged in local development
	if mID == "" || secret == "" {
		return
	}

	payload := GA4Payload{
		ClientID: clientID,
		Events:   events,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	url := fmt.Sprintf("%s?measurement_id=%s&api_secret=%s", s.endpoint, mID, secret)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("VetroLog/%s (%s; %s)", version.CurrentVersion, s.appMode, s.cfg.ClientID))

	resp, err := s.client.Do(req)
	if err != nil {
		// Log debug only, avoid spamming terminal
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[VetroLog Telemetry] Notice: Event ingest status %d", resp.StatusCode)
	}
}

// Close gracefully flushes pending events and stops the background worker
func (s *Service) Close() {
	close(s.stopCh)
	s.wg.Wait()
}
