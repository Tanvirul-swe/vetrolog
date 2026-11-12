package web

import (
	"embed"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityAndAuthMiddleware(t *testing.T) {
	var emptyAssets embed.FS
	srv := NewServer(emptyAssets, "127.0.0.1", 8787, "test-secret-token-12345")
	mux := http.NewServeMux()
	srv.registerAPIRoutes(mux)
	srv.registerRemoteRoutes(mux)

	handler := enableCORS(srv.authMiddleware(mux))

	// 1. /api/status is a public health check and should succeed with 200 without token
	reqStatus := httptest.NewRequest("GET", "/api/status", nil)
	wStatus := httptest.NewRecorder()
	handler.ServeHTTP(wStatus, reqStatus)
	if wStatus.Code != http.StatusOK {
		t.Fatalf("Expected /api/status to return 200 OK without token, got %d", wStatus.Code)
	}

	// 2. Sensitive endpoint /api/adb/devices should fail with 401 Unauthorized without token
	reqNoToken := httptest.NewRequest("GET", "/api/adb/devices", nil)
	wNoToken := httptest.NewRecorder()
	handler.ServeHTTP(wNoToken, reqNoToken)
	if wNoToken.Code != http.StatusUnauthorized {
		t.Fatalf("Expected /api/adb/devices without token to return 401 Unauthorized, got %d", wNoToken.Code)
	}

	// 3. /api/adb/devices with wrong token should fail with 401 Unauthorized
	reqBadToken := httptest.NewRequest("GET", "/api/adb/devices", nil)
	reqBadToken.Header.Set("X-Vetro-Token", "wrong-token")
	wBadToken := httptest.NewRecorder()
	handler.ServeHTTP(wBadToken, reqBadToken)
	if wBadToken.Code != http.StatusUnauthorized {
		t.Fatalf("Expected wrong token to return 401, got %d", wBadToken.Code)
	}

	// 4. /api/adb/devices with valid X-Vetro-Token should succeed
	reqValidHeader := httptest.NewRequest("GET", "/api/adb/devices", nil)
	reqValidHeader.Header.Set("X-Vetro-Token", "test-secret-token-12345")
	wValidHeader := httptest.NewRecorder()
	handler.ServeHTTP(wValidHeader, reqValidHeader)
	if wValidHeader.Code != http.StatusOK {
		t.Fatalf("Expected valid X-Vetro-Token to return 200 OK, got %d", wValidHeader.Code)
	}

	// 5. /api/adb/devices with valid Authorization Bearer header should succeed
	reqBearer := httptest.NewRequest("GET", "/api/adb/devices", nil)
	reqBearer.Header.Set("Authorization", "Bearer test-secret-token-12345")
	wBearer := httptest.NewRecorder()
	handler.ServeHTTP(wBearer, reqBearer)
	if wBearer.Code != http.StatusOK {
		t.Fatalf("Expected valid Bearer token to return 200 OK, got %d", wBearer.Code)
	}

	// 6. /api/adb/devices with valid cookie should succeed
	reqCookie := httptest.NewRequest("GET", "/api/adb/devices", nil)
	reqCookie.AddCookie(&http.Cookie{Name: "vetro_token", Value: "test-secret-token-12345"})
	wCookie := httptest.NewRecorder()
	handler.ServeHTTP(wCookie, reqCookie)
	if wCookie.Code != http.StatusOK {
		t.Fatalf("Expected valid cookie to return 200 OK, got %d", wCookie.Code)
	}
}

func TestCORSOriginValidation(t *testing.T) {
	var emptyAssets embed.FS
	srv := NewServer(emptyAssets, "127.0.0.1", 8787, "cors-token")
	mux := http.NewServeMux()
	srv.registerAPIRoutes(mux)

	handler := enableCORS(srv.authMiddleware(mux))

	// 1. Untrusted origin (e.g. malicious site)
	reqUntrusted := httptest.NewRequest("OPTIONS", "/api/status", nil)
	reqUntrusted.Header.Set("Origin", "https://evil-attacker.com")
	wUntrusted := httptest.NewRecorder()
	handler.ServeHTTP(wUntrusted, reqUntrusted)

	if wUntrusted.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("Expected NO Access-Control-Allow-Origin for untrusted origin, got: %s", wUntrusted.Header().Get("Access-Control-Allow-Origin"))
	}

	// 2. Trusted localhost origin
	reqLocalhost := httptest.NewRequest("OPTIONS", "/api/status", nil)
	reqLocalhost.Header.Set("Origin", "http://localhost:5173")
	wLocalhost := httptest.NewRecorder()
	handler.ServeHTTP(wLocalhost, reqLocalhost)

	if wLocalhost.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("Expected reflected localhost origin, got: %s", wLocalhost.Header().Get("Access-Control-Allow-Origin"))
	}

	// 3. Trusted VS Code webview origin
	reqVSCode := httptest.NewRequest("OPTIONS", "/api/status", nil)
	reqVSCode.Header.Set("Origin", "vscode-webview://12345")
	wVSCode := httptest.NewRecorder()
	handler.ServeHTTP(wVSCode, reqVSCode)

	if wVSCode.Header().Get("Access-Control-Allow-Origin") != "vscode-webview://12345" {
		t.Fatalf("Expected reflected vscode-webview origin, got: %s", wVSCode.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestAuthAndTelemetryEndpoints(t *testing.T) {
	var emptyAssets embed.FS
	srv := NewServer(emptyAssets, "127.0.0.1", 8787, "auth-token-xyz")
	tmpSessionFile := t.TempDir() + "/session.json"
	srv.authService.SetCustomSessionFileForTest(tmpSessionFile)

	mux := http.NewServeMux()
	srv.registerAPIRoutes(mux)
	handler := enableCORS(srv.authMiddleware(mux))

	// 1. /api/auth/status should be accessible publicly without token
	reqAuthStatus := httptest.NewRequest("GET", "/api/auth/status", nil)
	wAuthStatus := httptest.NewRecorder()
	handler.ServeHTTP(wAuthStatus, reqAuthStatus)
	if wAuthStatus.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /api/auth/status, got %d", wAuthStatus.Code)
	}

	// 2. /api/auth/demo-login with valid token
	reqDemoLogin := httptest.NewRequest("POST", "/api/auth/demo-login", nil)
	reqDemoLogin.Header.Set("X-Vetro-Token", "auth-token-xyz")
	wDemoLogin := httptest.NewRecorder()
	handler.ServeHTTP(wDemoLogin, reqDemoLogin)
	if wDemoLogin.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from demo login, got %d: %s", wDemoLogin.Code, wDemoLogin.Body.String())
	}

	// Verify status is now authenticated
	reqStatusAfter := httptest.NewRequest("GET", "/api/auth/status", nil)
	wStatusAfter := httptest.NewRecorder()
	handler.ServeHTTP(wStatusAfter, reqStatusAfter)
	if !strings.Contains(wStatusAfter.Body.String(), "demo.developer@gmail.com") {
		t.Fatalf("Expected demo user profile in status: %s", wStatusAfter.Body.String())
	}

	// 3. /api/auth/logout with valid token
	reqLogout := httptest.NewRequest("POST", "/api/auth/logout", nil)
	reqLogout.Header.Set("X-Vetro-Token", "auth-token-xyz")
	wLogout := httptest.NewRecorder()
	handler.ServeHTTP(wLogout, reqLogout)
	if wLogout.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from logout, got %d", wLogout.Code)
	}

	// 4. /api/telemetry/status
	reqTelStatus := httptest.NewRequest("GET", "/api/telemetry/status", nil)
	reqTelStatus.Header.Set("X-Vetro-Token", "auth-token-xyz")
	wTelStatus := httptest.NewRecorder()
	handler.ServeHTTP(wTelStatus, reqTelStatus)
	if wTelStatus.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from /api/telemetry/status, got %d", wTelStatus.Code)
	}
}

