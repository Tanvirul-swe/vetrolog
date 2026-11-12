package auth

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestAuthService_DemoModeAndLogin(t *testing.T) {
	svc := NewService(8787)
	tmpFile := filepath.Join(t.TempDir(), "session.json")
	svc.SetCustomSessionFileForTest(tmpFile)

	// 1. Initial State should be unauthenticated and demo mode
	status := svc.GetStatus()
	if status.IsAuthenticated {
		t.Fatal("Expected initially unauthenticated")
	}
	if !status.IsDemoMode {
		t.Fatal("Expected demo mode when no Google credentials are set")
	}

	// 2. Login with Demo
	user := svc.LoginWithDemo()
	if user == nil || user.Email != "demo.developer@gmail.com" {
		t.Fatalf("Unexpected demo user: %+v", user)
	}

	status = svc.GetStatus()
	if !status.IsAuthenticated {
		t.Fatal("Expected authenticated after LoginWithDemo")
	}
	if status.User == nil || status.User.Name != "Demo Developer" {
		t.Fatalf("Expected Demo Developer user, got: %+v", status.User)
	}

	// 3. New service instance should reload saved session from disk
	svc2 := NewService(8787)
	svc2.SetCustomSessionFileForTest(tmpFile)
	svc2.loadStoredSession()
	status2 := svc2.GetStatus()
	if !status2.IsAuthenticated || status2.User == nil || status2.User.Email != "demo.developer@gmail.com" {
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

	// Without credentials, should fail gracefully with demo mode warning
	_, _, err := svc.GenerateAuthURL()
	if err == nil || !strings.Contains(err.Error(), "demo mode") {
		t.Fatalf("Expected demo mode error, got: %v", err)
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

