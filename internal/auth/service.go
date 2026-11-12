package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	googleAuthEndpoint     = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenEndpoint    = "https://oauth2.googleapis.com/token"
	googleUserInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo"
)

// Service coordinates Google OAuth 2.0 flow and local user session persistence
type Service struct {
	clientID          string
	clientSecret      string
	redirectURI       string
	currentUser       *UserProfile
	states            map[string]time.Time
	customSessionFile string
	httpClient        *http.Client
	mu                sync.RWMutex
}

// NewService initializes the authentication service
func NewService(port int) *Service {
	clientID := os.Getenv("VETROLOG_GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("VETROLOG_GOOGLE_CLIENT_SECRET")
	redirectURI := fmt.Sprintf("http://localhost:%d/api/auth/google/callback", port)

	s := &Service{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURI:  redirectURI,
		states:       make(map[string]time.Time),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	// Auto-load existing saved session on startup
	s.loadStoredSession()
	return s
}

// SetCustomSessionFileForTest overrides session file path for isolated tests
func (s *Service) SetCustomSessionFileForTest(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.customSessionFile = path
}

// IsDemoMode returns true if Google OAuth credentials are not configured or are placeholders
func (s *Service) IsDemoMode() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clientID == "" ||
		s.clientSecret == "" ||
		strings.HasPrefix(s.clientID, "DEMO_") ||
		strings.HasPrefix(s.clientID, "demo_")
}

// GetStatus returns the active authentication state
func (s *Service) GetStatus() AuthStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return AuthStatus{
		IsAuthenticated: s.currentUser != nil,
		IsDemoMode:      s.isDemoModeLocked(),
		User:            s.currentUser,
	}
}

func (s *Service) isDemoModeLocked() bool {
	return s.clientID == "" ||
		s.clientSecret == "" ||
		strings.HasPrefix(s.clientID, "DEMO_") ||
		strings.HasPrefix(s.clientID, "demo_")
}

// GetCurrentUser returns the active user profile or nil
func (s *Service) GetCurrentUser() *UserProfile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentUser
}

// GenerateAuthURL creates a Google OAuth 2.0 authorization URL with a unique state
func (s *Service) GenerateAuthURL() (string, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isDemoModeLocked() {
		return "", "", errors.New("google oauth credentials not configured (running in demo mode)")
	}

	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return "", "", fmt.Errorf("failed to generate state: %w", err)
	}
	state := hex.EncodeToString(stateBytes)

	// Clean up stale states (> 10 minutes)
	now := time.Now()
	for k, t := range s.states {
		if now.Sub(t) > 10*time.Minute {
			delete(s.states, k)
		}
	}
	s.states[state] = now

	params := url.Values{}
	params.Set("client_id", s.clientID)
	params.Set("redirect_uri", s.redirectURI)
	params.Set("response_type", "code")
	params.Set("scope", "openid email profile")
	params.Set("state", state)
	params.Set("access_type", "offline")
	params.Set("prompt", "select_account")

	authURL := fmt.Sprintf("%s?%s", googleAuthEndpoint, params.Encode())
	return authURL, state, nil
}

// HandleCallback processes the redirect from Google OAuth
func (s *Service) HandleCallback(code string, state string) (*UserProfile, error) {
	s.mu.Lock()
	// Validate and delete state token
	createdAt, exists := s.states[state]
	if !exists || time.Since(createdAt) > 10*time.Minute {
		s.mu.Unlock()
		return nil, errors.New("invalid or expired oauth state token")
	}
	delete(s.states, state)
	clientID := s.clientID
	clientSecret := s.clientSecret
	redirectURI := s.redirectURI
	s.mu.Unlock()

	// 1. Exchange code for access token
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("redirect_uri", redirectURI)
	form.Set("grant_type", "authorization_code")

	resp, err := s.httpClient.PostForm(googleTokenEndpoint, form)
	if err != nil {
		return nil, fmt.Errorf("token exchange request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("token exchange failed (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tokenRes); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	// 2. Fetch user profile with access token
	req, err := http.NewRequest("GET", googleUserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)

	userResp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch userinfo: %w", err)
	}
	defer userResp.Body.Close()

	userBody, _ := io.ReadAll(userResp.Body)
	if userResp.StatusCode >= 400 {
		return nil, fmt.Errorf("userinfo request failed: %s", string(userBody))
	}

	var rawUser struct {
		Sub        string `json:"sub"`
		Email      string `json:"email"`
		Name       string `json:"name"`
		Picture    string `json:"picture"`
		GivenName  string `json:"given_name"`
		FamilyName string `json:"family_name"`
	}
	if err := json.Unmarshal(userBody, &rawUser); err != nil {
		return nil, fmt.Errorf("failed to parse user profile: %w", err)
	}

	profile := &UserProfile{
		ID:         rawUser.Sub,
		Email:      rawUser.Email,
		Name:       rawUser.Name,
		Picture:    rawUser.Picture,
		GivenName:  rawUser.GivenName,
		FamilyName: rawUser.FamilyName,
		Provider:   "google",
		LoggedInAt: time.Now(),
	}

	s.mu.Lock()
	s.currentUser = profile
	s.mu.Unlock()

	_ = s.saveSession(&SessionData{
		User:        profile,
		AccessToken: tokenRes.AccessToken,
		SavedAt:     time.Now(),
	})

	return profile, nil
}

// LoginWithDemo logs in with a mock developer profile for local development without Google Cloud setup
func (s *Service) LoginWithDemo() *UserProfile {
	s.mu.Lock()
	defer s.mu.Unlock()

	profile := &UserProfile{
		ID:         "demo_dev_user_001",
		Email:      "demo.developer@gmail.com",
		Name:       "Demo Developer",
		Picture:    "https://api.dicebear.com/7.x/identicon/svg?seed=vetrolog-demo",
		GivenName:  "Demo",
		FamilyName: "Developer",
		Provider:   "demo",
		LoggedInAt: time.Now(),
	}

	s.currentUser = profile
	_ = s.saveSession(&SessionData{
		User:    profile,
		SavedAt: time.Now(),
	})

	return profile
}

// SignOut clears the active session both in memory and on disk
func (s *Service) SignOut() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.currentUser = nil
	file := s.getSessionFilePath()
	if _, err := os.Stat(file); err == nil {
		return os.Remove(file)
	}
	return nil
}

func (s *Service) getSessionFilePath() string {
	if s.customSessionFile != "" {
		return s.customSessionFile
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ".vetrolog_session.json"
	}
	dir := filepath.Join(home, ".vetrolog")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "session.json")
}

func (s *Service) saveSession(sess *SessionData) error {
	data, err := json.MarshalIndent(sess, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.getSessionFilePath(), data, 0600)
}

func (s *Service) loadStoredSession() {
	s.mu.Lock()
	defer s.mu.Unlock()

	file := s.getSessionFilePath()
	data, err := os.ReadFile(file)
	if err != nil {
		return
	}

	var sess SessionData
	if err := json.Unmarshal(data, &sess); err == nil && sess.User != nil && sess.User.ID != "" {
		s.currentUser = sess.User
	}
}

