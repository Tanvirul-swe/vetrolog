package server

import (
	"encoding/json"
	"log"
	"time"

	"vetrolog/internal/broadcaster"
	"vetrolog/internal/models"
	"vetrolog/internal/parser/hive"
	"vetrolog/internal/parser/sharedprefs"
	"vetrolog/internal/parser/sqlite"
)

// Router parses inbound messages and notifies the Wails broadcaster
type Router struct {
	broadcaster *broadcaster.Broadcaster
	batcher     *broadcaster.MutationBatcher
	sqliteP     *sqlite.Parser
	hiveP       *hive.Parser
	prefsP      *sharedprefs.Parser
}

func NewRouter(b *broadcaster.Broadcaster, batcher *broadcaster.MutationBatcher) *Router {
	return &Router{
		broadcaster: b,
		batcher:     batcher,
		sqliteP:     sqlite.NewParser(),
		hiveP:       hive.NewParser(),
		prefsP:      sharedprefs.NewParser(),
	}
}

func (r *Router) Route(client *Client, raw []byte) {
	var env models.InboundWSMessage
	if err := json.Unmarshal(raw, &env); err != nil {
		log.Printf("Failed to unmarshal WS envelope: %v", err)
		return
	}

	switch env.Type {
	case "handshake":
		var dev models.DeviceInfo
		if err := json.Unmarshal(env.Payload, &dev); err == nil {
			if dev.ConnectedAt == 0 {
				dev.ConnectedAt = time.Now().UnixMilli()
			}
			client.device = &dev
			client.hub.SetActiveDevice(&dev)
			r.broadcaster.Emit(models.EventDeviceConnected, dev)
		}

	case "db_list":
		// Dispatches database inventory discovered on the device
		var list []models.DatabaseInfo
		if err := json.Unmarshal(env.Payload, &list); err == nil {
			r.broadcaster.Emit(models.EventDatabaseList, list)
		}

	case "table_data":
		var data models.TableDataPayload
		if err := json.Unmarshal(env.Payload, &data); err == nil {
			r.broadcaster.Emit(models.EventTableData, data)
		}

	case "mutation":
		var mut models.MutationEvent
		if err := json.Unmarshal(env.Payload, &mut); err == nil {
			if mut.Timestamp == 0 {
				mut.Timestamp = time.Now().UnixMilli()
			}
			r.batcher.Add(mut)
		}

	case "query_log":
		var qLog models.QueryLog
		if err := json.Unmarshal(env.Payload, &qLog); err == nil {
			if qLog.Timestamp == 0 {
				qLog.Timestamp = time.Now().UnixMilli()
			}
			r.broadcaster.Emit(models.EventQueryLog, qLog)
		}

	default:
		log.Printf("Unknown inbound message type: %s", env.Type)
	}
}
