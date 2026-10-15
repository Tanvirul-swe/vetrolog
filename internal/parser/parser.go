package parser

import (
	"encoding/json"
	"vetrolog/internal/models"
)

// DBParser defines the interface for database-specific payload decoders
type DBParser interface {
	DatabaseType() models.DatabaseType
	ParseDatabaseList(raw json.RawMessage) ([]models.DatabaseInfo, error)
	ParseTableData(raw json.RawMessage) (*models.TableDataPayload, error)
	ParseMutation(raw json.RawMessage) (*models.MutationEvent, error)
}
