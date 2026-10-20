# Installation Guide

Pre-compiled official binaries for macOS, Windows, and Linux are available from the official **[GitHub Releases](https://github.com/Tanvirul-swe/vetrolog/releases/latest)** page.

---

## 🍎 macOS (Apple Silicon M1/M2/M3/M4 & Intel)

VetroLog delivers a **Universal Binary** supporting both ARM64 (Apple Silicon) and x86_64 (Intel) Macs.

### Drag-and-Drop DMG Installation
1. Download **`VetroLog-macOS-Universal.dmg`** from GitHub Releases.
2. Double-click the DMG and drag **VetroLog.app** into your **Applications** folder.
3. Launch VetroLog from Launchpad or Spotlight.

{% hint style="warning" %}
**macOS Gatekeeper Warning ("App cannot be opened because developer cannot be verified")**:
Because VetroLog is open-source and not notarized through Apple's paid Developer program, macOS may display a Gatekeeper prompt on the first launch.

**To bypass:**
- Right-click (or Control-click) `VetroLog.app` in `Applications` and select **Open**.
- Or run this command in your terminal:
  ```bash
  xattr -d com.apple.quarantine /Applications/VetroLog.app
  ```
{% endhint %}

---

## 🪟 Windows (Windows 10 / 11 64-bit)

### Option A: Guided Setup Wizard (Recommended)
1. Download **`vetrolog-amd64-installer.exe`**.
2. Run the installer and follow the on-screen prompts.
3. The wizard creates Desktop shortcuts, Start Menu entries, and uninstaller support.

### Option B: Standalone Portable ZIP
1. Download **`VetroLog-Windows-x64-Portable.zip`**.
2. Extract the archive into any folder (e.g. `C:\Tools\VetroLog`).
3. Double-click `vetrolog.exe` to launch immediately without installation.

---

## 🐧 Linux (Ubuntu, Debian, Fedora, Arch)

### Option A: Debian / Ubuntu Package (`.deb`)
1. Download **`VetroLog-Linux-amd64.deb`**.
2. Install via terminal:
   ```bash
   sudo dpkg -i VetroLog-Linux-amd64.deb
   sudo apt-get install -f # Resolves any missing GTK or WebKit dependencies
   ```
3. Launch VetroLog from your desktop application launcher or type `vetrolog` in the terminal.

### Option B: Portable Tarball (All Distros)
1. Download **`VetroLog-Linux-x64.tar.gz`**.
2. Extract and run:
   ```bash
   tar -xvf VetroLog-Linux-x64.tar.gz
   ./vetrolog
   ```

*Required dependencies on Linux:* `libgtk-3-dev`, `libwebkit2gtk-4.0-37` or `libwebkit2gtk-4.1-0`.

---

## 🌐 Local Web Server Mode (Browser Access)

If you are developing inside a headless Linux VM, Docker container, or remote server, VetroLog can run without a desktop window:

```bash
# Start VetroLog in web server mode (defaults to http://localhost:8787)
./vetrolog --web

# Or customize the listening port
./vetrolog --web --port 9090

# Or prevent auto-opening the browser
./vetrolog --web --no-browser
```

Open **`http://localhost:8787`** in Google Chrome, Safari, Edge, or Firefox.

---

## 🛠️ Building from Source

If you prefer building VetroLog locally:

### Prerequisites
- **Go 1.22+**
- **Node.js 20+** & **npm**
- **Wails CLI v2**:
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Build Steps
```bash
# Clone the repository
git clone https://github.com/Tanvirul-swe/vetrolog.git
cd vetrolog

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run in development mode (live hot-reload)
wails dev

# Or build production binary
wails build
```
The compiled binary will be placed inside `build/bin/`.
