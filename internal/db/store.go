package db

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"vetrolog/internal/db/types"
)

// Store handles encrypted persistent storage of database connection profiles
type Store struct {
	mu       sync.RWMutex
	filePath string
	key      []byte
}

// NewStoreWithPath initializes connection store at a specified file path
func NewStoreWithPath(filePath string) (*Store, error) {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	h := sha256.New()
	h.Write([]byte(filePath + "-vetrolog-secrets-salt-v1"))
	key := h.Sum(nil)

	return &Store{
		filePath: filePath,
		key:      key,
	}, nil
}

// NewStore initializes connection store at ~/.vetrolog/connections.json
func NewStore() (*Store, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	return NewStoreWithPath(filepath.Join(home, ".vetrolog", "connections.json"))
}

// ListSummaries returns sanitized profiles for UI presentation
func (s *Store) ListSummaries() ([]types.ConnectionSummary, error) {
	configs, err := s.LoadAll()
	if err != nil {
		return nil, err
	}

	summaries := make([]types.ConnectionSummary, len(configs))
	for i, c := range configs {
		hasSSH := c.SSH != nil && c.SSH.Enabled
		summaries[i] = types.ConnectionSummary{
			ID:          c.ID,
			Name:        c.Name,
			Engine:      c.Engine,
			Host:        c.Host,
			Port:        c.Port,
			Database:    c.Database,
			ColorTag:    c.ColorTag,
			Environment: c.Environment,
			SafeMode:    c.SafeMode,
			FilePath:    c.FilePath,
			HasSSH:      hasSSH,
			UpdatedAt:   c.UpdatedAt,
		}
	}
	return summaries, nil
}

// LoadAll reads and decrypts all saved connections
func (s *Store) LoadAll() ([]types.ConnectionConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return []types.ConnectionConfig{}, nil
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}

	var rawList []types.ConnectionConfig
	if err := json.Unmarshal(data, &rawList); err != nil {
		return nil, err
	}

	// Decrypt sensitive fields
	for i := range rawList {
		if rawList[i].Password != "" {
			decrypted, err := s.decrypt(rawList[i].Password)
			if err == nil {
				rawList[i].Password = decrypted
			}
		}
		if rawList[i].SSH != nil {
			if rawList[i].SSH.Password != "" {
				decrypted, err := s.decrypt(rawList[i].SSH.Password)
				if err == nil {
					rawList[i].SSH.Password = decrypted
				}
			}
			if rawList[i].SSH.Passphrase != "" {
				decrypted, err := s.decrypt(rawList[i].SSH.Passphrase)
				if err == nil {
					rawList[i].SSH.Passphrase = decrypted
				}
			}
		}
	}

	return rawList, nil
}

// Get finds a single connection profile by ID
func (s *Store) Get(id string) (*types.ConnectionConfig, error) {
	all, err := s.LoadAll()
	if err != nil {
		return nil, err
	}
	for _, c := range all {
		if c.ID == id {
			return &c, nil
		}
	}
	return nil, fmt.Errorf("connection not found with id: %s", id)
}

// Save inserts or updates a connection configuration
func (s *Store) Save(cfg *types.ConnectionConfig) (*types.ConnectionSummary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	all, _ := s.loadAllLocked()

	now := time.Now().UnixMilli()
	if cfg.ID == "" {
		cfg.ID = uuid.New().String()
		cfg.CreatedAt = now
	}
	cfg.UpdatedAt = now

	// Encrypt sensitive fields for disk writing
	toSave := *cfg
	if toSave.Password != "" {
		enc, err := s.encrypt(toSave.Password)
		if err == nil {
			toSave.Password = enc
		}
	}
	if toSave.SSH != nil {
		sshCopy := *toSave.SSH
		if sshCopy.Password != "" {
			enc, err := s.encrypt(sshCopy.Password)
			if err == nil {
				sshCopy.Password = enc
			}
		}
		if sshCopy.Passphrase != "" {
			enc, err := s.encrypt(sshCopy.Passphrase)
			if err == nil {
				sshCopy.Passphrase = enc
			}
		}
		toSave.SSH = &sshCopy
	}

	found := false
	for i := range all {
		if all[i].ID == cfg.ID {
			// If incoming password is empty, preserve already saved encrypted password
			if toSave.Password == "" && all[i].Password != "" {
				toSave.Password = all[i].Password
			}
			if toSave.SSH != nil && all[i].SSH != nil {
				if toSave.SSH.Password == "" && all[i].SSH.Password != "" {
					toSave.SSH.Password = all[i].SSH.Password
				}
				if toSave.SSH.Passphrase == "" && all[i].SSH.Passphrase != "" {
					toSave.SSH.Passphrase = all[i].SSH.Passphrase
				}
			}
			if toSave.CreatedAt == 0 && all[i].CreatedAt != 0 {
				toSave.CreatedAt = all[i].CreatedAt
			}
			all[i] = toSave
			found = true
			break
		}
	}
	if !found {
		all = append(all, toSave)
	}

	data, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(s.filePath, data, 0600); err != nil {
		return nil, err
	}

	return &types.ConnectionSummary{
		ID:          cfg.ID,
		Name:        cfg.Name,
		Engine:      cfg.Engine,
		Host:        cfg.Host,
		Port:        cfg.Port,
		Database:    cfg.Database,
		ColorTag:    cfg.ColorTag,
		Environment: cfg.Environment,
		SafeMode:    cfg.SafeMode,
		FilePath:    cfg.FilePath,
		HasSSH:      cfg.SSH != nil && cfg.SSH.Enabled,
		UpdatedAt:   cfg.UpdatedAt,
	}, nil
}

// Delete removes a connection by ID
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	all, err := s.loadAllLocked()
	if err != nil {
		return err
	}

	filtered := make([]types.ConnectionConfig, 0, len(all))
	for _, c := range all {
		if c.ID != id {
			filtered = append(filtered, c)
		}
	}

	data, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0600)
}

func (s *Store) loadAllLocked() ([]types.ConnectionConfig, error) {
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return []types.ConnectionConfig{}, nil
	}
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	var list []types.ConnectionConfig
	_ = json.Unmarshal(data, &list)
	return list, nil
}

func (s *Store) encrypt(text string) (string, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(text), nil)
	return hex.EncodeToString(ciphertext), nil
}

func (s *Store) decrypt(encoded string) (string, error) {
	data, err := hex.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
