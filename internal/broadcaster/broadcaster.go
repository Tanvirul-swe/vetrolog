package broadcaster

import (
	"context"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Broadcaster emits structured Wails events to the React frontend
type Broadcaster struct {
	mu  sync.RWMutex
	ctx context.Context
}

// NewBroadcaster creates a new Broadcaster instance
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{}
}

// SetContext sets or updates the Wails runtime context
func (b *Broadcaster) SetContext(ctx context.Context) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.ctx = ctx
}

// Emit pushes an event to the frontend if Wails context is initialized
func (b *Broadcaster) Emit(eventName string, data ...interface{}) {
	b.mu.RLock()
	ctx := b.ctx
	b.mu.RUnlock()

	if ctx != nil {
		runtime.EventsEmit(ctx, eventName, data...)
	}
}
