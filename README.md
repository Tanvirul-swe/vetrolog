<div align="center">
  <img src="frontend/src/assets/images/vetrolog-full.png" alt="VetroLog Banner" width="700" />
  
  <p><strong>High-Performance Desktop Database Inspector for Mobile Apps (Flutter, Android, iOS, React Native)</strong></p>
  
  <p>
    <a href="https://github.com/Tanvirul-swe/vetrolog/releases"><img src="https://img.shields.io/github/v/release/Tanvirul-swe/vetrolog?include_prereleases&color=emerald&label=Release" alt="Release" /></a>
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
    <img src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go" alt="Go" />
    <img src="https://img.shields.io/badge/Wails-v2-DF1A29?logo=wails" alt="Wails" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/License-MIT-purple" alt="License" />
  </p>
</div>

---

## 🌟 Highlights & Features

- **⚡ Zero-Config ADB Mobile Inspector**: Plug in your Android device via USB and inspect SQLite databases (`.db`) without modifying a single line of code in your Flutter or Android project!
- **🧠 Intelligent SQL Playground**: Live visual query plan analyzer (`EXPLAIN QUERY PLAN`), schema-aware autocomplete & FK join predictor, safe transaction dry-run simulation, natural language to SQL engine (Offline + BYOK Gemini/OpenAI/Ollama), bidirectional inline cell editing, mobile UI thread FPS profiler, 1-click index advisor, and multi-platform code generator (Flutter, Android Room, iOS GRDB, Go).
- **🔄 Real-Time Live Sync & WAL Support**: Automatically detects insertions, updates, and deletions on the fly with SQLite Write-Ahead Logging (`-wal`) and Shared Memory (`-shm`) sync.
- **📊 Real-Time Table Badges**: Dynamic record counts updated automatically in the sidebar database tree.
- **✏️ Bidirectional Record Editing**: Double-click cells to update values with automatic write-back sync to the phone sandbox.
- **🖥️ Dual Mode (Desktop & Web)**: Run as a native desktop application on macOS, Windows, and Linux, or pass `--web` to launch in your browser (`http://localhost:8787`).
- **🔔 In-App Update Notifications**: Seamless version checks directly against GitHub Releases.

---

## 📚 Documentation Portal

Visit our complete documentation site: **[https://vetro.hifzio.com/](https://vetro.hifzio.com/)**

| Document | Description |
| :--- | :--- |
| **[📖 Official Documentation](https://vetro.hifzio.com/)** | Full documentation site with live search, guides, and tutorials. |
| **[⚡ 3-Minute Quick Start](https://vetro.hifzio.com/getting-started/quickstart/)** | Step-by-step tutorial on connecting USB debugging and inspecting tables. |
| **[🧠 Intelligent SQL Playground](https://vetro.hifzio.com/sql-playground/overview/)** | Multi-tab console, visual explain plans, Gemini 2.5 AI, and 1-click index advisor. |
| **[💻 Multi-Platform Installation](https://vetro.hifzio.com/getting-started/installation/)** | Direct download & setup guides for macOS (Universal DMG), Windows, and Linux. |
| **[📱 Framework Guides](https://vetro.hifzio.com/framework-guides/flutter/)** | Integration guides for Flutter (Drift/sqflite), Android (Room), and React Native. |
| **[🤝 Contributing Guidelines](CONTRIBUTING.md)** | Codebase directory map, local dev setup, quality checks, and PR standards. |
| **[🚀 Deployment & CI/CD](https://vetro.hifzio.com/deployment-and-modes/ci-cd-releases/)** | Release tagging workflow, GitHub Actions matrix packaging, and in-app updater mechanics. |

---

## 📥 Download & Installation

Get the latest installer for your operating system from **[GitHub Releases](https://github.com/Tanvirul-swe/vetrolog/releases/latest)**:

### 🍎 macOS (Apple Silicon M1/M2/M3/M4 & Intel)
1. Download **`VetroLog-macOS-Universal.dmg`** (or `.zip`).
2. Open the DMG and drag **VetroLog** into your `Applications` folder.
3. *First time opening:* If macOS Gatekeeper shows an untrusted developer prompt, right-click `VetroLog.app` and choose **Open**, or run:
   ```bash
   xattr -d com.apple.quarantine /Applications/VetroLog.app
   ```

### 🪟 Windows (Windows 10 / 11 64-bit)
- **Setup Wizard**: Download and run **`vetrolog-amd64-installer.exe`** for a full guided installation with Desktop & Start Menu shortcuts.
- **Portable**: Download **`VetroLog-Windows-x64-Portable.zip`**, extract anywhere, and launch `vetrolog.exe`.

### 🐧 Linux (Ubuntu, Debian, Fedora, Arch)
- **Debian / Ubuntu**: Download and install **`VetroLog-Linux-amd64.deb`**:
  ```bash
  sudo dpkg -i VetroLog-Linux-amd64.deb
  ```
- **Tarball (All Distros)**: Download **`VetroLog-Linux-x64.tar.gz`**, extract, and run `./vetrolog`.

---

## 🚀 How to Use

### Inspect Any Android App (Zero Code Required)

1. Connect your Android phone or start an emulator with **USB Debugging** enabled.
2. Launch your mobile app in debug mode (`flutter run` or Android Studio Run).
3. Open **VetroLog**. In the top header bar:
   - Your connected phone model is auto-detected in the device selector.
   - Choose your debuggable application package from the app dropdown.
4. Select any database from the left sidebar to browse tables, inspect records, run queries, or edit data in real time!

---

### 🌐 Local Web Server Mode (Browser Access)

If you prefer to inspect your databases in **Chrome, Safari, Firefox**, or run VetroLog on a remote machine, headless workstation, or Docker container:

```bash
# Start VetroLog in Local Web Server mode (auto-opens http://localhost:8787)
./vetrolog --web

# Or specify a custom port
./vetrolog --web --port 8080

# Or run headless without auto-opening the browser
./vetrolog --web --no-browser
```

---

## 🛠️ Build from Source

### Prerequisites
- [Go](https://golang.org) (v1.23+)
- [Node.js](https://nodejs.org) (v20+) & npm
- [Wails CLI v2](https://wails.io):
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### Development Mode
```bash
# Clone the repository
git clone https://github.com/Tanvirul-swe/vetrolog.git
cd vetrolog

# Start development server with live reload
wails dev
```

### Production Build
```bash
# macOS (Universal binary for Apple Silicon & Intel)
wails build -platform darwin/universal

# Windows (Installer + Executable)
wails build -platform windows/amd64 -nsis

# Linux (Binary)
wails build -platform linux/amd64
```

---

## 📄 License

VetroLog is open source under the [MIT License](LICENSE).
