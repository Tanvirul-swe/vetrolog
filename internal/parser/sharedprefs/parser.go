package sharedprefs

import (
	"encoding/json"
	"fmt"
	"time"

	"vetrolog/internal/models"
)

// Parser handles SharedPreferences and NSUserDefaults key-value pairs
type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) DatabaseType() models.DatabaseType {
	return models.DatabaseTypeSharedPrefs
}

func (p *Parser) ParseDatabaseList(raw json.RawMessage) ([]models.DatabaseInfo, error) {
	var list []models.DatabaseInfo
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("sharedprefs parse list error: %w", err)
	}
	for i := range list {
		list[i].Type = models.DatabaseTypeSharedPrefs
		if list[i].UpdatedAt == 0 {
			list[i].UpdatedAt = time.Now().UnixMilli()
		}
	}
	return list, nil
}

func (p *Parser) ParseTableData(raw json.RawMessage) (*models.TableDataPayload, error) {
	var payload models.TableDataPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("sharedprefs parse entries error: %w", err)
	}
	return &payload, nil
}

func (p *Parser) ParseMutation(raw json.RawMessage) (*models.MutationEvent, error) {
	var event models.MutationEvent
	if err := json.Unmarshal(raw, &event); err != nil {
		return nil, fmt.Errorf("sharedprefs parse mutation error: %w", err)
	}
	if event.Timestamp == 0 {
		event.Timestamp = time.Now().UnixMilli()
	}
	return &event, nil
}
