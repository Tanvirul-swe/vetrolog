package sqlite

import (
	"encoding/json"
	"fmt"
	"time"

	"vetrolog/internal/models"
)

// Parser handles SQLite schema, table rows, and mutation parsing
type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) DatabaseType() models.DatabaseType {
	return models.DatabaseTypeSQLite
}

func (p *Parser) ParseDatabaseList(raw json.RawMessage) ([]models.DatabaseInfo, error) {
	var list []models.DatabaseInfo
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("sqlite parse database list error: %w", err)
	}
	for i := range list {
		list[i].Type = models.DatabaseTypeSQLite
		if list[i].UpdatedAt == 0 {
			list[i].UpdatedAt = time.Now().UnixMilli()
		}
	}
	return list, nil
}

func (p *Parser) ParseTableData(raw json.RawMessage) (*models.TableDataPayload, error) {
	var payload models.TableDataPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("sqlite parse table data error: %w", err)
	}
	return &payload, nil
}

func (p *Parser) ParseMutation(raw json.RawMessage) (*models.MutationEvent, error) {
	var event models.MutationEvent
	if err := json.Unmarshal(raw, &event); err != nil {
		return nil, fmt.Errorf("sqlite parse mutation error: %w", err)
	}
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}
	return &event, nil
}
