package updater

import (
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		v1, v2   string
		expected int
	}{
		{"v1.2.0", "v1.2.0", 0},
		{"v1.2.1", "v1.2.0", 1},
		{"v1.2.0", "v1.2.1", -1},
		{"v2.0.0", "v1.9.9", 1},
		{"1.3.0", "v1.2.5", 1},
		{"v1.10.0", "v1.2.0", 1},
		{"v1.2.0-beta", "v1.2.0", 0},
		{"v1.2.0.1", "v1.2.0", 1},
	}

	for _, tt := range tests {
		res := CompareVersions(tt.v1, tt.v2)
		if res != tt.expected {
			t.Errorf("CompareVersions(%s, %s) = %d, expected %d", tt.v1, tt.v2, res, tt.expected)
		}
	}
}

func TestFindBestAsset(t *testing.T) {
	assets := []GitHubAsset{
		{Name: "VetroLog-Linux-amd64.deb", BrowserDownloadURL: "https://example.com/deb"},
		{Name: "VetroLog-Linux-x64.tar.gz", BrowserDownloadURL: "https://example.com/tar"},
		{Name: "VetroLog-macOS-Universal.dmg", BrowserDownloadURL: "https://example.com/dmg"},
		{Name: "VetroLog-macOS-Universal.zip", BrowserDownloadURL: "https://example.com/zip"},
		{Name: "VetroLog-Windows-x64-Portable.zip", BrowserDownloadURL: "https://example.com/winzip"},
		{Name: "VetroLog-amd64-installer.exe", BrowserDownloadURL: "https://example.com/exe"},
	}

	// macOS should prefer .zip over .dmg
	macAsset := FindBestAsset(assets, "darwin", "arm64")
	if macAsset == nil || macAsset.Name != "VetroLog-macOS-Universal.zip" {
		t.Fatalf("expected VetroLog-macOS-Universal.zip for darwin, got %+v", macAsset)
	}

	// Windows should prefer .exe over .zip
	winAsset := FindBestAsset(assets, "windows", "amd64")
	if winAsset == nil || winAsset.Name != "VetroLog-amd64-installer.exe" {
		t.Fatalf("expected VetroLog-amd64-installer.exe for windows, got %+v", winAsset)
	}

	// Linux should prefer .deb over .tar.gz
	linuxAsset := FindBestAsset(assets, "linux", "amd64")
	if linuxAsset == nil || linuxAsset.Name != "VetroLog-Linux-amd64.deb" {
		t.Fatalf("expected VetroLog-Linux-amd64.deb for linux, got %+v", linuxAsset)
	}
}

func TestFormatBytes(t *testing.T) {
	if s := FormatBytes(500); s != "500 B" {
		t.Errorf("FormatBytes(500) = %s, expected 500 B", s)
	}
	if s := FormatBytes(1024 * 1024 * 12); s != "12.0 MB" {
		t.Errorf("FormatBytes(12MB) = %s, expected 12.0 MB", s)
	}
}
