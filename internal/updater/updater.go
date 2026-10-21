package updater

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"vetrolog/internal/version"
)

// UpdateInfo holds details about an available update
type UpdateInfo struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	ReleaseNotes   string `json:"releaseNotes"`
	ReleaseURL     string `json:"releaseUrl"`
	AssetURL       string `json:"assetUrl"`
	AssetName      string `json:"assetName"`
	AssetSize      int64  `json:"assetSize"`
	PublishedAt    string `json:"publishedAt"`
	HasUpdate      bool   `json:"hasUpdate"`
}

// ProgressEvent is emitted via Wails runtime events during download/extraction
type ProgressEvent struct {
	Percent    int    `json:"percent"`
	Speed      string `json:"speed"`
	Downloaded string `json:"downloaded"`
	Total      string `json:"total"`
	BytesRead  int64  `json:"bytesRead"`
	TotalBytes int64  `json:"totalBytes"`
	Status     string `json:"status"` // "downloading", "extracting", "ready", "error", "cancelled"
	Error      string `json:"error,omitempty"`
}

// GitHubRelease represents GitHub Releases API payload
type GitHubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Body        string        `json:"body"`
	HTMLURL     string        `json:"html_url"`
	PublishedAt string        `json:"published_at"`
	Draft       bool          `json:"draft"`
	Prerelease  bool          `json:"prerelease"`
	Assets      []GitHubAsset `json:"assets"`
}

// GitHubAsset represents a single downloadable artifact on GitHub
type GitHubAsset struct {
	Name               string `json:"name"`
	Size               int64  `json:"size"`
	BrowserDownloadURL string `json:"browser_download_url"`
	ContentType        string `json:"content_type"`
}

// Service manages update checks, streaming downloads, extraction, and platform restarts
type Service struct {
	mu           sync.Mutex
	ctx          context.Context
	cancelFunc   context.CancelFunc
	httpClient   *http.Client
	isChecking   bool
	isDownloading bool
	isReady      bool
	lastUpdate   *UpdateInfo
	readyVersion string
	downloadPath string
	extractedApp string
}

// NewService creates a new updater service
func NewService() *Service {
	return &Service{
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

// SetContext sets the Wails runtime context for event emissions
func (s *Service) SetContext(ctx context.Context) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ctx = ctx
}

// CompareVersions compares two semver strings (e.g. "v1.2.1" vs "v1.2.0").
// Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
func CompareVersions(v1, v2 string) int {
	clean1 := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(v1, "v"), "V"))
	clean2 := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(v2, "v"), "V"))

	parts1 := strings.Split(clean1, ".")
	parts2 := strings.Split(clean2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			// strip any pre-release suffixes like -beta
			seg := strings.Split(parts1[i], "-")[0]
			n1, _ = strconv.Atoi(seg)
		}
		if i < len(parts2) {
			seg := strings.Split(parts2[i], "-")[0]
			n2, _ = strconv.Atoi(seg)
		}

		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return 0
}

// FindBestAsset resolves the most suitable release artifact for current OS & architecture
func FindBestAsset(assets []GitHubAsset, targetOS, targetArch string) *GitHubAsset {
	var candidates []GitHubAsset

	for _, a := range assets {
		name := strings.ToLower(a.Name)
		switch targetOS {
		case "darwin":
			// macOS assets: VetroLog-macOS-Universal.zip or .dmg
			if strings.Contains(name, "macos") || strings.Contains(name, "darwin") {
				candidates = append(candidates, a)
			}
		case "windows":
			// Windows assets: VetroLog-amd64-installer.exe or VetroLog-Windows-x64-Portable.zip
			if strings.Contains(name, "windows") || strings.HasSuffix(name, ".exe") || strings.HasSuffix(name, ".msi") {
				candidates = append(candidates, a)
			}
		case "linux":
			// Linux assets: VetroLog-Linux-amd64.deb or VetroLog-Linux-x64.tar.gz
			if strings.Contains(name, "linux") || strings.HasSuffix(name, ".deb") || strings.HasSuffix(name, ".tar.gz") {
				candidates = append(candidates, a)
			}
		}
	}

	if len(candidates) == 0 {
		return nil
	}

	// Priority heuristics:
	// For macOS: Prefer .zip (contains .app bundle for frictionless in-place restart) over .dmg
	// For Windows: Prefer .exe (installer) over portable .zip
	// For Linux: Prefer .deb over .tar.gz
	for _, c := range candidates {
		name := strings.ToLower(c.Name)
		if targetOS == "darwin" && strings.HasSuffix(name, ".zip") {
			return &c
		}
		if targetOS == "windows" && strings.HasSuffix(name, ".exe") {
			return &c
		}
		if targetOS == "linux" && strings.HasSuffix(name, ".deb") {
			return &c
		}
	}

	// Fallback to first matched candidate
	return &candidates[0]
}

// FormatBytes formats byte count into human-readable representation
func FormatBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// FormatSpeed formats bytes/sec transfer speed
func FormatSpeed(bytesPerSec float64) string {
	if bytesPerSec < 1024 {
		return fmt.Sprintf("%.0f B/s", bytesPerSec)
	} else if bytesPerSec < 1024*1024 {
		return fmt.Sprintf("%.1f KB/s", bytesPerSec/1024)
	}
	return fmt.Sprintf("%.1f MB/s", bytesPerSec/(1024*1024))
}

// CheckForUpdate queries GitHub Releases API for newer version
func (s *Service) CheckForUpdate() (*UpdateInfo, error) {
	s.mu.Lock()
	if s.isChecking {
		info := s.lastUpdate
		s.mu.Unlock()
		return info, nil
	}
	s.isChecking = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isChecking = false
		s.mu.Unlock()
	}()

	req, err := http.NewRequestWithContext(context.Background(), "GET", "https://api.github.com/repos/Tanvirul-swe/vetrolog/releases/latest", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create update request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", fmt.Sprintf("VetroLog-Desktop/%s (%s; %s)", version.CurrentVersion, runtime.GOOS, runtime.GOARCH))

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to contact GitHub release server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned HTTP %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to decode release metadata: %w", err)
	}

	hasUpdate := CompareVersions(release.TagName, version.CurrentVersion) > 0

	bestAsset := FindBestAsset(release.Assets, runtime.GOOS, runtime.GOARCH)

	info := &UpdateInfo{
		CurrentVersion: version.CurrentVersion,
		LatestVersion:  release.TagName,
		ReleaseName:    release.Name,
		ReleaseNotes:   release.Body,
		ReleaseURL:     release.HTMLURL,
		PublishedAt:    release.PublishedAt,
		HasUpdate:      hasUpdate,
	}

	if bestAsset != nil {
		info.AssetURL = bestAsset.BrowserDownloadURL
		info.AssetName = bestAsset.Name
		info.AssetSize = bestAsset.Size
	}

	s.mu.Lock()
	s.lastUpdate = info
	s.mu.Unlock()

	return info, nil
}

// StartDownloadUpdate initiates streaming download and background unpack
func (s *Service) StartDownloadUpdate(assetURL, targetVersion string) error {
	s.mu.Lock()
	if s.isDownloading {
		s.mu.Unlock()
		return fmt.Errorf("download already in progress")
	}

	// Cancel previous download context if any
	if s.cancelFunc != nil {
		s.cancelFunc()
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFunc = cancel
	s.isDownloading = true
	s.isReady = false
	wCtx := s.ctx
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			s.isDownloading = false
			s.mu.Unlock()
		}()

		homeDir, err := os.UserHomeDir()
		if err != nil {
			s.emitError(wCtx, "Failed to resolve user home directory: "+err.Error())
			return
		}

		updateDir := filepath.Join(homeDir, ".vetrolog", "updates", targetVersion)
		if err := os.MkdirAll(updateDir, 0755); err != nil {
			s.emitError(wCtx, "Failed to create updates directory: "+err.Error())
			return
		}

		// Extract filename from URL or default
		filename := filepath.Base(assetURL)
		if filename == "" || filename == "." || filename == "/" {
			filename = fmt.Sprintf("vetrolog-%s-%s.pkg", runtime.GOOS, targetVersion)
		}
		targetFilePath := filepath.Join(updateDir, filename)

		req, err := http.NewRequestWithContext(ctx, "GET", assetURL, nil)
		if err != nil {
			s.emitError(wCtx, "Failed to create download request: "+err.Error())
			return
		}
		req.Header.Set("User-Agent", "VetroLog-AutoUpdater/1.0")

		client := &http.Client{Timeout: 30 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			if ctx.Err() == context.Canceled {
				s.emitEvent(wCtx, ProgressEvent{Status: "cancelled"})
				return
			}
			s.emitError(wCtx, "Download failed: "+err.Error())
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			s.emitError(wCtx, fmt.Sprintf("Download server returned status HTTP %d", resp.StatusCode))
			return
		}

		out, err := os.Create(targetFilePath)
		if err != nil {
			s.emitError(wCtx, "Failed to create destination file: "+err.Error())
			return
		}
		defer out.Close()

		totalBytes := resp.ContentLength
		totalStr := FormatBytes(totalBytes)
		var bytesRead int64
		startTime := time.Now()
		lastEmit := time.Now()

		buf := make([]byte, 32*1024)
		for {
			select {
			case <-ctx.Done():
				out.Close()
				os.Remove(targetFilePath)
				s.emitEvent(wCtx, ProgressEvent{Status: "cancelled"})
				return
			default:
			}

			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				_, writeErr := out.Write(buf[:n])
				if writeErr != nil {
					s.emitError(wCtx, "Failed to write download chunk: "+writeErr.Error())
					return
				}
				bytesRead += int64(n)

				now := time.Now()
				// Throttle progress events to every 100ms
				if now.Sub(lastEmit) > 100*time.Millisecond || (totalBytes > 0 && bytesRead == totalBytes) {
					elapsedSec := now.Sub(startTime).Seconds()
					var speedStr string
					if elapsedSec > 0 {
						speed := float64(bytesRead) / elapsedSec
						speedStr = FormatSpeed(speed)
					}

					var percent int
					if totalBytes > 0 {
						percent = int((bytesRead * 100) / totalBytes)
					}

					s.emitEvent(wCtx, ProgressEvent{
						Percent:    percent,
						Speed:      speedStr,
						Downloaded: FormatBytes(bytesRead),
						Total:      totalStr,
						BytesRead:  bytesRead,
						TotalBytes: totalBytes,
						Status:     "downloading",
					})
					lastEmit = now
				}
			}

			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				s.emitError(wCtx, "Download stream interrupted: "+readErr.Error())
				return
			}
		}

		out.Close()

		var extractedAppPath string
		// If on macOS and downloaded a .zip archive, extract the .app bundle
		if runtime.GOOS == "darwin" && strings.HasSuffix(strings.ToLower(filename), ".zip") {
			s.emitEvent(wCtx, ProgressEvent{
				Percent: 100,
				Status:  "extracting",
				Total:   totalStr,
			})

			appDir, extractErr := extractZipApp(targetFilePath, updateDir)
			if extractErr != nil {
				s.emitError(wCtx, "Failed to extract macOS app bundle: "+extractErr.Error())
				return
			}
			extractedAppPath = appDir
		}

		s.mu.Lock()
		s.isReady = true
		s.readyVersion = targetVersion
		s.downloadPath = targetFilePath
		s.extractedApp = extractedAppPath
		s.mu.Unlock()

		// Final ready notification
		s.emitEvent(wCtx, ProgressEvent{
			Percent:    100,
			Downloaded: totalStr,
			Total:      totalStr,
			Status:     "ready",
		})

		if wCtx != nil {
			wailsRuntime.EventsEmit(wCtx, "updater:ready", map[string]interface{}{
				"version":   targetVersion,
				"assetPath": targetFilePath,
				"appPath":   extractedAppPath,
				"fileName":  filename,
			})
		}
	}()

	return nil
}

// CancelUpdate stops any ongoing download
func (s *Service) CancelUpdate() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cancelFunc != nil {
		s.cancelFunc()
		s.cancelFunc = nil
	}
	s.isDownloading = false
	if s.ctx != nil {
		wailsRuntime.EventsEmit(s.ctx, "updater:cancelled", true)
	}
	return nil
}

// ApplyUpdateAndRestart applies the update and restarts VetroLog
func (s *Service) ApplyUpdateAndRestart(targetVersion string) error {
	s.mu.Lock()
	ready := s.isReady
	extractedApp := s.extractedApp
	downloadPath := s.downloadPath
	s.mu.Unlock()

	if !ready && downloadPath == "" {
		return fmt.Errorf("no update is downloaded and ready to apply")
	}

	log.Printf("[VetroLog Updater] Applying update for %s (OS: %s)...", targetVersion, runtime.GOOS)

	switch runtime.GOOS {
	case "darwin":
		return s.applyMacOSUpdate(extractedApp, downloadPath)
	case "windows":
		return s.applyWindowsUpdate(downloadPath)
	case "linux":
		return s.applyLinuxUpdate(downloadPath)
	default:
		return fmt.Errorf("automatic upgrade is not supported on OS: %s", runtime.GOOS)
	}
}

// applyMacOSUpdate replaces the current VetroLog.app bundle and launches the new version
func (s *Service) applyMacOSUpdate(newAppPath, zipPath string) error {
	if newAppPath == "" {
		// Attempt to locate VetroLog.app inside update folder
		dir := filepath.Dir(zipPath)
		candidate := filepath.Join(dir, "VetroLog.app")
		if _, err := os.Stat(candidate); err == nil {
			newAppPath = candidate
		}
	}

	if newAppPath == "" {
		return fmt.Errorf("could not find extracted VetroLog.app to apply")
	}

	// Detect currently running app bundle
	currentAppPath := ""
	execPath, err := os.Executable()
	if err == nil {
		if idx := strings.Index(execPath, ".app/Contents/MacOS/"); idx != -1 {
			currentAppPath = execPath[:idx+4]
		}
	}

	// Fallback to /Applications/VetroLog.app if running loose in dev mode
	if currentAppPath == "" {
		if _, err := os.Stat("/Applications/VetroLog.app"); err == nil {
			currentAppPath = "/Applications/VetroLog.app"
		}
	}

	if currentAppPath == "" {
		// If running from dev directory, launch the new app bundle directly
		cmd := exec.Command("open", newAppPath)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to open updated app: %w", err)
		}
		go func() {
			time.Sleep(500 * time.Millisecond)
			os.Exit(0)
		}()
		return nil
	}

	// Helper script: wait for current process to cleanly exit, replace .app, clear quarantine, and open
	script := fmt.Sprintf(`sleep 1.2 && rm -rf "%s" && cp -R "%s" "%s" && xattr -dr com.apple.quarantine "%s" 2>/dev/null && open "%s"`,
		currentAppPath, newAppPath, currentAppPath, currentAppPath, currentAppPath)

	cmd := exec.Command("sh", "-c", script)
	detachProcess(cmd)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to initiate macOS app replacement helper: %w", err)
	}

	go func() {
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}()

	return nil
}

// applyWindowsUpdate runs installer silently or swaps portable binary
func (s *Service) applyWindowsUpdate(downloadPath string) error {
	if strings.HasSuffix(strings.ToLower(downloadPath), ".exe") {
		// Silent installer execution
		cmd := exec.Command("cmd.exe", "/C", "start", "", downloadPath, "/SILENT")
		detachProcess(cmd)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to launch installer: %w", err)
		}
		go func() {
			time.Sleep(300 * time.Millisecond)
			os.Exit(0)
		}()
		return nil
	}

	// Fallback: open directory containing downloaded update
	exec.Command("explorer.exe", "/select,", downloadPath).Start()
	return nil
}

// applyLinuxUpdate applies debian package or restarts binary
func (s *Service) applyLinuxUpdate(downloadPath string) error {
	if strings.HasSuffix(strings.ToLower(downloadPath), ".deb") {
		// Use pkexec or gdebi to install
		script := fmt.Sprintf(`pkexec dpkg -i '%s' && /usr/bin/vetrolog &`, downloadPath)
		cmd := exec.Command("sh", "-c", script)
		detachProcess(cmd)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to launch deb package installer: %w", err)
		}
		go func() {
			time.Sleep(300 * time.Millisecond)
			os.Exit(0)
		}()
		return nil
	}

	return fmt.Errorf("please install the downloaded update manually from: %s", downloadPath)
}

func (s *Service) emitEvent(ctx context.Context, ev ProgressEvent) {
	if ctx != nil {
		wailsRuntime.EventsEmit(ctx, "updater:progress", ev)
	}
}

func (s *Service) emitError(ctx context.Context, msg string) {
	log.Printf("[VetroLog Updater Error] %s", msg)
	if ctx != nil {
		wailsRuntime.EventsEmit(ctx, "updater:progress", ProgressEvent{
			Status: "error",
			Error:  msg,
		})
	}
}

// extractZipApp extracts a zip archive containing a macOS .app bundle
func extractZipApp(zipPath, targetDir string) (string, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	var appBundlePath string

	for _, f := range r.File {
		cleanName := filepath.Clean(f.Name)
		if strings.HasPrefix(cleanName, "..") {
			continue // prevent zip slip
		}

		destPath := filepath.Join(targetDir, cleanName)

		if strings.HasSuffix(cleanName, ".app") || strings.Contains(cleanName, ".app/") {
			if appBundlePath == "" {
				idx := strings.Index(destPath, ".app")
				if idx != -1 {
					appBundlePath = destPath[:idx+4]
				}
			}
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0755); err != nil {
				return "", err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return "", err
		}

		rc, err := f.Open()
		if err != nil {
			return "", err
		}

		// Ensure executable mode for binary files
		mode := f.Mode()
		if strings.Contains(destPath, "Contents/MacOS/") {
			mode = 0755
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
		if err != nil {
			rc.Close()
			return "", err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			return "", err
		}
	}

	if appBundlePath == "" {
		appBundlePath = filepath.Join(targetDir, "VetroLog.app")
	}

	return appBundlePath, nil
}
