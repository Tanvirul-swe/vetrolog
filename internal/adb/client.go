package adb

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Client coordinates low-level ADB command execution.
type Client struct {
	adbPath string
	mu      sync.Mutex
}

var (
	defaultClient *Client
	clientOnce    sync.Once
)

// GetClient returns a singleton ADB client.
func GetClient() *Client {
	clientOnce.Do(func() {
		defaultClient = &Client{
			adbPath: resolveAdbPath(),
		}
	})
	return defaultClient
}

func resolveAdbPath() string {
	// 1. Try PATH
	if p, err := exec.LookPath("adb"); err == nil {
		return p
	}

	// 2. Try ANDROID_HOME / ANDROID_SDK_ROOT
	home := os.Getenv("HOME")
	candidatePaths := []string{
		filepath.Join(home, "Library/Android/sdk/platform-tools/adb"),
		filepath.Join(os.Getenv("ANDROID_HOME"), "platform-tools/adb"),
		filepath.Join(os.Getenv("ANDROID_SDK_ROOT"), "platform-tools/adb"),
		"/opt/homebrew/bin/adb",
		"/usr/local/bin/adb",
	}

	for _, cp := range candidatePaths {
		if cp != "" {
			if _, err := os.Stat(cp); err == nil {
				return cp
			}
		}
	}

	return "adb"
}

// AdbPath returns the resolved adb binary path.
func (c *Client) AdbPath() string {
	return c.adbPath
}

// Run executes an adb command with arguments.
func (c *Client) Run(args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.adbPath, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("adb command timed out after 8s: %v", args)
		}
		return "", fmt.Errorf("adb error: %v, stderr: %s", err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}

// RunDevice executes an adb command directed to a specific device ID.
func (c *Client) RunDevice(deviceID string, args ...string) (string, error) {
	fullArgs := append([]string{"-s", deviceID}, args...)
	return c.Run(fullArgs...)
}

// RunAs executes a command inside the debuggable application sandbox via run-as.
func (c *Client) RunAs(deviceID, packageName, command string) (string, error) {
	return c.RunDevice(deviceID, "shell", "run-as", packageName, command)
}

// ExecOutCat streams a file directly from the application sandbox onto the local filesystem.
func (c *Client) ExecOutCat(deviceID, packageName, remotePath, localDestPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Ensure destination directory exists
	if err := os.MkdirAll(filepath.Dir(localDestPath), 0755); err != nil {
		return err
	}

	destFile, err := os.Create(localDestPath)
	if err != nil {
		return err
	}
	defer destFile.Close()

	cmd := exec.Command(c.adbPath, "-s", deviceID, "exec-out", "run-as", packageName, "cat", remotePath)
	cmd.Stdout = destFile
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("exec-out failed: %v, stderr: %s", err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

// PushToSandbox writes a local file into the app sandbox.
func (c *Client) PushToSandbox(deviceID, packageName, localSourcePath, remoteDestPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	srcFile, err := os.Open(localSourcePath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Pipe local file content into adb shell run-as <pkg> sh -c 'cat > <dest>'
	shellCmd := fmt.Sprintf("cat > '%s'", remoteDestPath)
	cmd := exec.Command(c.adbPath, "-s", deviceID, "shell", "run-as", packageName, "sh", "-c", shellCmd)
	cmd.Stdin = srcFile
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed pushing to sandbox: %v, stderr: %s", err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

// CopyFile helper for caching
func CopyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
