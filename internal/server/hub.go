package server

import (
	"encoding/json"
	"sync"

	"vetrolog/internal/broadcaster"
	"vetrolog/internal/models"
)

type inboundItem struct {
	client  *Client
	message []byte
}

// Hub maintains the set of active mobile clients
type Hub struct {
	clients     map[*Client]bool
	register    chan *Client
	unregister  chan *Client
	inbound     chan *inboundItem
	broadcaster *broadcaster.Broadcaster
	router      *Router

	mu           sync.RWMutex
	activeDevice *models.DeviceInfo
	stopCh       chan struct{}
}

func NewHub(b *broadcaster.Broadcaster, batcher *broadcaster.MutationBatcher) *Hub {
	h := &Hub{
		clients:     make(map[*Client]bool),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		inbound:     make(chan *inboundItem, 1024),
		broadcaster: b,
		stopCh:      make(chan struct{}),
	}
	h.router = NewRouter(b, batcher)
	return h
}

func (h *Hub) Run() {
	for {
		select {
		case <-h.stopCh:
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				if client.device != nil && h.activeDevice != nil && client.device.ID == h.activeDevice.ID {
					h.activeDevice = nil
					h.broadcaster.Emit(models.EventDeviceDisconnected, client.device)
				}
			}
			h.mu.Unlock()

		case item := <-h.inbound:
			h.router.Route(item.client, item.message)
		}
	}
}

func (h *Hub) Stop() {
	close(h.stopCh)
	h.mu.Lock()
	defer h.mu.Unlock()
	for client := range h.clients {
		delete(h.clients, client)
		close(client.send)
	}
}

func (h *Hub) SetActiveDevice(dev *models.DeviceInfo) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.activeDevice = dev
}

func (h *Hub) GetActiveDevice() *models.DeviceInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.activeDevice
}

// SendToActive sends a command to the currently paired mobile client
func (h *Hub) SendToActive(action string, reqID string, payload interface{}) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	msg := models.OutboundWSMessage{
		Action:    action,
		RequestID: reqID,
		Payload:   payload,
	}
	raw, err := json.Marshal(msg)
	if err != nil {
		return false
	}

	for client := range h.clients {
		select {
		case client.send <- raw:
			return true
		default:
			return false
		}
	}
	return false
}
