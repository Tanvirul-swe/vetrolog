package auth

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestAuthService_SessionAndSignOut(t *testing.T) {
	svc := NewService(8787)
	tmpFile := filepath.Join(t.TempDir(), "session.json")
	svc.SetCustomSessionFileForTest(tmpFile)

	// 1. Initial State should be unauthenticated
	status := svc.GetStatus()
	if status.IsAuthenticated {
		t.Fatal("Expected initially unauthenticated")
	}

	// 2. Simulate saving authenticated session
	testProfile := &UserProfile{
		ID:         "test_user_123",
		Email:      "test.developer@gmail.com",
		Name:       "Test Developer",
		Provider:   "google",
		LoggedInAt: "2026-11-13T12:00:00Z",
	}
	svc.mu.Lock()
	svc.currentUser = testProfile
	_ = svc.saveSession(&SessionData{
		User:        testProfile,
		AccessToken: "mock-token",
		SavedAt:     "2026-11-13T12:00:00Z",
	})
	svc.mu.Unlock()

	status = svc.GetStatus()
	if !status.IsAuthenticated {
		t.Fatal("Expected authenticated after saving session")
	}
	if status.User == nil || status.User.Name != "Test Developer" {
		t.Fatalf("Expected Test Developer user, got: %+v", status.User)
	}

	// 3. New service instance should reload saved session from disk
	svc2 := NewService(8787)
	svc2.SetCustomSessionFileForTest(tmpFile)
	svc2.loadStoredSession()
	status2 := svc2.GetStatus()
	if !status2.IsAuthenticated || status2.User == nil || status2.User.Email != "test.developer@gmail.com" {
		t.Fatalf("Expected reloaded session, got: %+v", status2)
	}

	// 4. Sign Out
	if err := svc2.SignOut(); err != nil {
		t.Fatalf("SignOut failed: %v", err)
	}

	statusAfterLogout := svc2.GetStatus()
	if statusAfterLogout.IsAuthenticated {
		t.Fatal("Expected unauthenticated after SignOut")
	}
}

func TestAuthService_GenerateAuthURL(t *testing.T) {
	svc := NewService(8787)

	// Without credentials, should fail gracefully
	_, _, err := svc.GenerateAuthURL()
	if err == nil || !strings.Contains(err.Error(), "credentials not configured") {
		t.Fatalf("Expected credentials error, got: %v", err)
	}

	// Simulate configured credentials
	svc.mu.Lock()
	svc.clientID = "mock_client_id.apps.googleusercontent.com"
	svc.clientSecret = "mock_client_secret"
	svc.mu.Unlock()

	authURL, state, err := svc.GenerateAuthURL()
	if err != nil {
		t.Fatalf("GenerateAuthURL failed: %v", err)
	}
	if state == "" {
		t.Fatal("Expected non-empty state")
	}
	if !strings.Contains(authURL, "accounts.google.com/o/oauth2/v2/auth") {
		t.Errorf("Unexpected authURL: %s", authURL)
	}
	if !strings.Contains(authURL, "mock_client_id.apps.googleusercontent.com") {
		t.Errorf("Expected client_id in authURL: %s", authURL)
	}
	if !strings.Contains(authURL, state) {
		t.Errorf("Expected state in authURL: %s", authURL)
	}
}

func TestAuthService_CallbackServerLifecycle(t *testing.T) {
	// Pick an ephemeral port for testing
	testPort := 18787
	svc := NewService(testPort)
	if err := svc.StartCallbackServer(); err != nil {
		t.Fatalf("StartCallbackServer failed: %v", err)
	}
	defer svc.StopCallbackServer()

	// Calling Start again should be idempotent
	if err := svc.StartCallbackServer(); err != nil {
		t.Fatalf("Subsequent StartCallbackServer failed: %v", err)
	}
}

func TestAuthService_DefaultCredentialsFallback(t *testing.T) {
	oldClientID := DefaultClientID
	oldClientSecret := DefaultClientSecret
	DefaultClientID = "fallback-client-id"
	DefaultClientSecret = "fallback-client-secret"
	defer func() {
		DefaultClientID = oldClientID
		DefaultClientSecret = oldClientSecret
	}()

	t.Setenv("VETROLOG_GOOGLE_CLIENT_ID", "")
	t.Setenv("VETROLOG_GOOGLE_CLIENT_SECRET", "")

	svc := NewService(8787)
	if svc.clientID != "fallback-client-id" {
		t.Fatalf("expected fallback-client-id, got %s", svc.clientID)
	}
	if svc.clientSecret != "fallback-client-secret" {
		t.Fatalf("expected fallback-client-secret, got %s", svc.clientSecret)
	}

	// Environment variable should take precedence over default
	t.Setenv("VETROLOG_GOOGLE_CLIENT_ID", "env-client-id")
	svcEnv := NewService(8787)
	if svcEnv.clientID != "env-client-id" {
		t.Fatalf("expected env-client-id, got %s", svcEnv.clientID)
	}
}

