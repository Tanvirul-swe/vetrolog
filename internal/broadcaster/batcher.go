package broadcaster

import (
	"sync"
	"time"

	"vetrolog/internal/models"
)

// MutationBatcher aggregates high-frequency mutation events to protect the UI IPC channel
type MutationBatcher struct {
	broadcaster *Broadcaster
	window      time.Duration
	maxBatch    int

	mu      sync.Mutex
	buffer  []models.MutationEvent
	timer   *time.Timer
	stopCh  chan struct{}
	stopped bool
}

// NewMutationBatcher creates a new batcher
func NewMutationBatcher(b *Broadcaster, window time.Duration, maxBatch int) *MutationBatcher {
	mb := &MutationBatcher{
		broadcaster: b,
		window:      window,
		maxBatch:    maxBatch,
		buffer:      make([]models.MutationEvent, 0, maxBatch),
		stopCh:      make(chan struct{}),
	}
	return mb
}

// Add appends a mutation event to the buffer and schedules a flush
func (mb *MutationBatcher) Add(event models.MutationEvent) {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	if mb.stopped {
		return
	}

	mb.buffer = append(mb.buffer, event)

	if len(mb.buffer) >= mb.maxBatch {
		mb.flushLocked()
		return
	}

	if mb.timer == nil {
		mb.timer = time.AfterFunc(mb.window, func() {
			mb.mu.Lock()
			defer mb.mu.Unlock()
			mb.flushLocked()
		})
	}
}

// flushLocked must be called with mb.mu held
func (mb *MutationBatcher) flushLocked() {
	if mb.timer != nil {
		mb.timer.Stop()
		mb.timer = nil
	}

	if len(mb.buffer) == 0 {
		return
	}

	batch := make([]models.MutationEvent, len(mb.buffer))
	copy(batch, mb.buffer)
	mb.buffer = mb.buffer[:0]

	go func(b []models.MutationEvent) {
		mb.broadcaster.Emit(models.EventBatchMutations, b)
	}(batch)
}

// Stop flushes remaining items and halts the batcher
func (mb *MutationBatcher) Stop() {
	mb.mu.Lock()
	defer mb.mu.Unlock()

	if mb.stopped {
		return
	}
	mb.stopped = true
	mb.flushLocked()
	close(mb.stopCh)
}
