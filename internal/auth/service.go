package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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
	port              int
	clientID          string
	clientSecret      string
	redirectURI       string
	currentUser       *UserProfile
	states            map[string]time.Time
	customSessionFile string
	httpClient        *http.Client
	callbackServer    *http.Server
	onLoginSuccess    func(profile *UserProfile)
	mu                sync.RWMutex
}

// NewService initializes the authentication service
func NewService(port int) *Service {
	clientID := os.Getenv("VETROLOG_GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("VETROLOG_GOOGLE_CLIENT_SECRET")
	redirectURI := fmt.Sprintf("http://localhost:%d/api/auth/google/callback", port)

	s := &Service{
		port:         port,
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

// SetOnLoginSuccess sets a hook called after successful OAuth login
func (s *Service) SetOnLoginSuccess(fn func(profile *UserProfile)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onLoginSuccess = fn
}

// StartCallbackServer starts a background HTTP listener on 127.0.0.1:port to receive the Google OAuth callback
func (s *Service) StartCallbackServer() error {
	s.mu.Lock()
	if s.callbackServer != nil {
		s.mu.Unlock()
		return nil
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/google/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")
		if code == "" || state == "" {
			http.Error(w, "Missing authorization code or state parameter", http.StatusBadRequest)
			return
		}

		profile, err := s.HandleCallback(code, state)
		if err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintf(w, `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0B0F19;color:#F87171;text-align:center;padding:50px;"><h2>Authentication Failed</h2><p>%s</p></body></html>`, html.EscapeString(err.Error()))
			return
		}

		s.mu.RLock()
		onSuccess := s.onLoginSuccess
		s.mu.RUnlock()
		if onSuccess != nil {
			onSuccess(profile)
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VetroLog — Authentication Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B0F19; color: #F1F5F9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #131B2E; border: 1px solid #1E293B; border-radius: 16px; padding: 36px; text-align: center; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #38BDF8; }
    p { font-size: 13px; color: #94A3B8; margin: 0 0 20px 0; line-height: 1.5; }
    .btn { display: inline-block; background: #0284C7; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✨</div>
    <h1>Signed In Successfully</h1>
    <p>Your Google account has been connected to VetroLog. You can now close this tab and return to the application.</p>
    <a href="javascript:window.close()" class="btn">Close Window</a>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'vetrolog:auth_success' }, '*');
    }
    setTimeout(() => { try { window.close(); } catch(e){} }, 2000);
  </script>
</body>
</html>`))
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf("127.0.0.1:%d", s.port),
		Handler: mux,
	}
	s.callbackServer = srv
	s.mu.Unlock()

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[Auth] Callback server error: %v", err)
		}
	}()

	return nil
}

// StopCallbackServer gracefully shuts down the callback HTTP listener
func (s *Service) StopCallbackServer() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.callbackServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.callbackServer.Shutdown(ctx)
		s.callbackServer = nil
	}
}

// SaveSessionForTest forces saving a user profile for isolated testing
func (s *Service) SaveSessionForTest(user *UserProfile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentUser = user
	return s.saveSession(&SessionData{
		User:        user,
		AccessToken: "mock-test-token",
		SavedAt:     time.Now().Format(time.RFC3339),
	})
}

// SetCustomSessionFileForTest overrides session file path for isolated tests
func (s *Service) SetCustomSessionFileForTest(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.customSessionFile = path
}

// IsConfigured returns true if Google OAuth credentials are set
func (s *Service) IsConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clientID != "" && s.clientSecret != ""
}

// GetStatus returns the active authentication state
func (s *Service) GetStatus() AuthStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return AuthStatus{
		IsAuthenticated: s.currentUser != nil,
		User:            s.currentUser,
	}
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

	if s.clientID == "" || s.clientSecret == "" {
		return "", "", errors.New("google oauth credentials not configured")
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
		LoggedInAt: time.Now().Format(time.RFC3339),
	}

	s.mu.Lock()
	s.currentUser = profile
	s.mu.Unlock()

	_ = s.saveSession(&SessionData{
		User:        profile,
		AccessToken: tokenRes.AccessToken,
		SavedAt:     time.Now().Format(time.RFC3339),
	})

	return profile, nil
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

