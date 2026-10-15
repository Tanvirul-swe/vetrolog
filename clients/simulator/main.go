package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

type WSMessage struct {
	Type      string      `json:"type"`
	Timestamp int64       `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

type InboundCommand struct {
	Action    string                 `json:"action"`
	RequestID string                 `json:"requestId"`
	Payload   map[string]interface{} `json:"payload"`
}

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	u := url.URL{Scheme: "ws", Host: "localhost:9222", Path: "/ws"}
	log.Printf("[Simulator] Connecting to VetroLog desktop at %s...", u.String())

	c, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		log.Fatalf("[Simulator] Dial error: %v. Make sure VetroLog desktop is running!", err)
	}
	defer c.Close()

	log.Printf("[Simulator] Connected successfully! Sending handshake...")

	// 1. Send Handshake
	handshake := WSMessage{
		Type:      "handshake",
		Timestamp: time.Now().UnixMilli(),
		Payload: map[string]interface{}{
			"id":          "sim_pixel9_pro",
			"name":        "Pixel 9 Pro (Simulator)",
			"platform":    "android",
			"osVersion":   "Android 15 (API 35)",
			"appId":       "com.vetrolog.sampleapp",
			"connectedAt": time.Now().UnixMilli(),
		},
	}
	_ = c.WriteJSON(handshake)

	// 2. Send Discovered Databases
	dbList := WSMessage{
		Type:      "db_list",
		Timestamp: time.Now().UnixMilli(),
		Payload: []map[string]interface{}{
			{
				"id":        "db_store_sqlite",
				"name":      "store_prod.db",
				"type":      "sqlite",
				"path":      "/data/data/com.vetrolog.sampleapp/databases/store_prod.db",
				"sizeBytes": 4194304,
				"updatedAt": time.Now().UnixMilli(),
				"tables": []map[string]interface{}{
					{
						"name":     "products",
						"type":     "table",
						"rowCount": 6,
						"columns": []map[string]interface{}{
							{"name": "id", "type": "INTEGER", "isPrimaryKey": true, "isNullable": false},
							{"name": "title", "type": "TEXT", "isPrimaryKey": false, "isNullable": false},
							{"name": "price", "type": "REAL", "isPrimaryKey": false, "isNullable": false},
							{"name": "in_stock", "type": "BOOLEAN", "isPrimaryKey": false, "isNullable": false},
							{"name": "tags", "type": "JSON", "isPrimaryKey": false, "isNullable": true},
						},
					},
					{
						"name":     "audit_logs",
						"type":     "table",
						"rowCount": 24,
						"columns": []map[string]interface{}{
							{"name": "log_id", "type": "INTEGER", "isPrimaryKey": true, "isNullable": false},
							{"name": "action", "type": "TEXT", "isPrimaryKey": false, "isNullable": false},
							{"name": "user", "type": "TEXT", "isPrimaryKey": false, "isNullable": false},
							{"name": "created_at", "type": "DATETIME", "isPrimaryKey": false, "isNullable": false},
						},
					},
				},
			},
			{
				"id":        "hive_local_box",
				"name":      "auth_cache.hive",
				"type":      "hive",
				"path":      "/data/data/com.vetrolog.sampleapp/app_flutter/auth_cache.hive",
				"sizeBytes": 204800,
				"updatedAt": time.Now().UnixMilli(),
				"tables": []map[string]interface{}{
					{
						"name":     "tokens",
						"type":     "box",
						"rowCount": 3,
						"columns": []map[string]interface{}{
							{"name": "key", "type": "STRING", "isPrimaryKey": true, "isNullable": false},
							{"name": "value", "type": "OBJECT", "isPrimaryKey": false, "isNullable": true},
						},
					},
				},
			},
		},
	}
	_ = c.WriteJSON(dbList)

	// 3. Send initial products rows
	productsRows := []map[string]interface{}{
		{"id": 101, "title": "MacBook Pro 16 M4 Max", "price": 3499.00, "in_stock": true, "tags": []string{"apple", "laptop", "m4"}},
		{"id": 102, "title": "Sony WH-1000XM5", "price": 399.99, "in_stock": true, "tags": []string{"audio", "noise-canceling"}},
		{"id": 103, "title": "Dell UltraSharp 32 4K", "price": 899.50, "in_stock": false, "tags": []string{"monitor", "usb-c"}},
		{"id": 104, "title": "Keychron Q1 Pro Wireless", "price": 199.00, "in_stock": true, "tags": []string{"keyboard", "mechanical"}},
		{"id": 105, "title": "Logitech MX Master 3S", "price": 99.99, "in_stock": true, "tags": []string{"mouse", "ergonomic"}},
		{"id": 106, "title": "iPad Pro 13 OLED", "price": 1299.00, "in_stock": true, "tags": []string{"apple", "tablet"}},
	}

	tableData := WSMessage{
		Type:      "table_data",
		Timestamp: time.Now().UnixMilli(),
		Payload: map[string]interface{}{
			"databaseId": "db_store_sqlite",
			"tableName":  "products",
			"totalRows":  len(productsRows),
			"page":       1,
			"pageSize":   50,
			"columns": []map[string]interface{}{
				{"name": "id", "type": "INTEGER", "isPrimaryKey": true, "isNullable": false},
				{"name": "title", "type": "TEXT", "isPrimaryKey": false, "isNullable": false},
				{"name": "price", "type": "REAL", "isPrimaryKey": false, "isNullable": false},
				{"name": "in_stock", "type": "BOOLEAN", "isPrimaryKey": false, "isNullable": false},
				{"name": "tags", "type": "JSON", "isPrimaryKey": false, "isNullable": true},
			},
			"rows": productsRows,
		},
	}
	_ = c.WriteJSON(tableData)

	log.Printf("[Simulator] Database schema & initial rows sent! Listening for desktop commands...")

	// Goroutine to listen for commands from desktop (execute_query, update_row, delete_row)
	go func() {
		for {
			_, msgBytes, err := c.ReadMessage()
			if err != nil {
				log.Printf("[Simulator] Disconnected: %v", err)
				return
			}

			var cmd InboundCommand
			if err := json.Unmarshal(msgBytes, &cmd); err != nil {
				continue
			}

			log.Printf("[Simulator] 📩 Received action '%s' from desktop (req: %s)", cmd.Action, cmd.RequestID)

			switch cmd.Action {
			case "execute_query":
				query, _ := cmd.Payload["query"].(string)
				dbID, _ := cmd.Payload["databaseId"].(string)

				// Respond with simulated query result
				qResult := WSMessage{
					Type:      "query_result",
					Timestamp: time.Now().UnixMilli(),
					Payload: map[string]interface{}{
						"requestId":  cmd.RequestID,
						"databaseId": dbID,
						"query":      query,
						"rows":       productsRows[:3],
						"affected":   0,
						"durationMs": 1.25,
						"success":    true,
					},
				}
				_ = c.WriteJSON(qResult)
				log.Printf("[Simulator] ✅ Query executed and results sent back to desktop!")

			case "update_row":
				tableName, _ := cmd.Payload["tableName"].(string)
				dbID, _ := cmd.Payload["databaseId"].(string)
				newValues, _ := cmd.Payload["newValues"].(map[string]interface{})

				log.Printf("[Simulator] ✏️ Updated row in '%s': %v", tableName, newValues)

				// Emit mutation acknowledgment
				mut := WSMessage{
					Type:      "mutation",
					Timestamp: time.Now().UnixMilli(),
					Payload: map[string]interface{}{
						"id":         fmt.Sprintf("mut_%d", time.Now().UnixMilli()),
						"databaseId": dbID,
						"tableName":  tableName,
						"type":       "UPDATE",
						"timestamp":  time.Now().UnixMilli(),
						"durationMs": 1.1,
						"newValues":  newValues,
						"affected":   1,
					},
				}
				_ = c.WriteJSON(mut)

			case "delete_row":
				tableName, _ := cmd.Payload["tableName"].(string)
				dbID, _ := cmd.Payload["databaseId"].(string)
				pk, _ := cmd.Payload["primaryKey"].(map[string]interface{})

				log.Printf("[Simulator] 🗑️ Deleted row in '%s': %v", tableName, pk)

				mut := WSMessage{
					Type:      "mutation",
					Timestamp: time.Now().UnixMilli(),
					Payload: map[string]interface{}{
						"id":         fmt.Sprintf("mut_%d", time.Now().UnixMilli()),
						"databaseId": dbID,
						"tableName":  tableName,
						"type":       "DELETE",
						"timestamp":  time.Now().UnixMilli(),
						"durationMs": 0.8,
						"oldValues":  pk,
						"affected":   1,
					},
				}
				_ = c.WriteJSON(mut)
			}
		}
	}()

	// Periodic ticker sending live database writes every 3 seconds
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	sampleTitles := []string{"AirPods Pro 2", "iPad Mini 7", "Apple Watch Ultra 2", "Magic Trackpad", "HomePod Mini"}

	for {
		select {
		case <-interrupt:
			log.Println("[Simulator] Interrupted, exiting...")
			return

		case t := <-ticker.C:
			title := sampleTitles[rand.Intn(len(sampleTitles))]
			price := 99.0 + float64(rand.Intn(400)) + 0.99
			newProd := map[string]interface{}{
				"id":       200 + rand.Intn(800),
				"title":    title,
				"price":    price,
				"in_stock": true,
				"tags":     []string{"live-sync", "mobile"},
			}

			mut := WSMessage{
				Type:      "mutation",
				Timestamp: t.UnixMilli(),
				Payload: map[string]interface{}{
					"id":         fmt.Sprintf("mut_%d", t.UnixMilli()),
					"databaseId": "db_store_sqlite",
					"tableName":  "products",
					"type":       "INSERT",
					"timestamp":  t.UnixMilli(),
					"query":      fmt.Sprintf("INSERT INTO products (title, price, in_stock) VALUES ('%s', %.2f, 1);", title, price),
					"durationMs": 1.8,
					"newValues":  newProd,
					"affected":   1,
				},
			}
			_ = c.WriteJSON(mut)
			log.Printf("[Simulator] ⚡ Pushed live INSERT mutation to desktop: %s ($%.2f)", title, price)
		}
	}
}
