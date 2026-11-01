# VetroLog: Mobile & Remote Database Studio for VS Code

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/tanvirul-swe.vetrolog?label=Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=tanvirul-swe.vetrolog)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/v/release/Tanvirul-swe/vetrolog?label=Engine%20Version)](https://github.com/Tanvirul-swe/vetrolog/releases)

**VetroLog** brings high-performance database inspection, real-time live synchronization, and interactive schema modeling directly into Visual Studio Code.

Inspect mobile SQLite databases (Flutter, React Native, Android) over ADB in real time, connect to production SQL & NoSQL engines (PostgreSQL, MySQL, MariaDB, MSSQL, Redis), double-click workspace SQLite files, and visualize relationships with auto-generated ER diagrams—without leaving your editor.

---

## ✨ Features

- **📱 Mobile App SQLite over ADB**:
  - Auto-discovers connected Android devices and emulators.
  - Live inspection for Flutter (sqflite, drift), React Native, and native Android Room/SQLite databases.
  - Real-time SQLite WAL (Write-Ahead Logging) change tracking with zero mobile app restart.

- **🌐 Full Remote Database Suite**:
  - Connect to **PostgreSQL**, **MySQL**, **MariaDB**, **MSSQL**, and **Redis**.
  - SSL/TLS support, encrypted connection profiles, and test latency checks.
  - Schema browser (Databases, Schemas, Tables, Columns, Constraints, Indexes).

- **📂 Workspace SQLite Inspector**:
  - Directly double-click `*.db`, `*.sqlite`, `*.sqlite3`, `*.db3`, or `*.wal` files in your VS Code Explorer.
  - Instant high-speed data grid with sorting, pagination, and multi-column filtering.

- **🗺️ Interactive ER Diagram Visualizer**:
  - Auto-generated visual entity-relationship diagrams for any connected database or SQLite file.
  - Interactive pan/zoom, auto-layout engine, mini-map navigation, and search filter.
  - Foreign key and inferred relation flows with directional traveling pulses.
  - Schema exports to **dbdiagram.io (DBML)**, **Mermaid ER**, **SQL DDL**, and **SVG**.

- **⚡ SQL Studio & Safety Simulator**:
  - Multi-tab query editor with syntax highlighting and auto-completion.
  - Ad-hoc execution with timing metrics and query history.
  - Non-destructive query dry-run simulation before committing changes.

- **🎨 Modern Dark & High-Contrast Light Themes**:
  - Automatically synchronizes with your active VS Code color theme.
  - Zero-flicker boot with seamless embedded webview integration.

---

## 🚀 Getting Started

### 1. Install Extension
Install **VetroLog** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=tanvirul-swe.vetrolog) or via the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).

### 2. Launching Database Studio
- Click the **VetroLog** icon in the Activity Bar.
- Run `VetroLog: Open Database Studio` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
- Click the **$(database) VetroLog** item on the status bar.

### 3. Opening Workspace SQLite Files
Simply double-click any `.db`, `.sqlite`, or `.sqlite3` file in your workspace file tree, or right-click and choose **Open in VetroLog**.

---

## ⚙️ Configuration Settings

Customize VetroLog's behavior via **Settings** (`Ctrl+,` or `Cmd+,` > search for `vetrolog`):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `vetrolog.serverPort` | `number` | `8787` | Port used by the local background daemon. |
| `vetrolog.autoStartServer` | `boolean` | `true` | Automatically spawn the daemon when VS Code starts. |
| `vetrolog.customBinaryPath` | `string` | `""` | Optional path to custom `vetrolog` CLI executable. |
| `vetrolog.themeSync` | `boolean` | `true` | Synchronize webview appearance with VS Code theme. |

---

## 🛠️ CLI Engine Setup (Optional)

The extension includes automated background daemon management. If you want to use the standalone desktop application or standalone CLI, install VetroLog via:

```bash
# macOS (Homebrew)
brew install Tanvirul-swe/tap/vetrolog

# Linux (Snap)
sudo snap install vetrolog

# Or download prebuilt binaries from GitHub Releases:
# https://github.com/Tanvirul-swe/vetrolog/releases
```

---

## 🤝 Contributing & Feedback

- Found a bug or feature request? Open an issue on [GitHub Issues](https://github.com/Tanvirul-swe/vetrolog/issues).
- Website & Documentation: [vetro.hifzio.com](https://vetro.hifzio.com)
- Source Code: [github.com/Tanvirul-swe/vetrolog](https://github.com/Tanvirul-swe/vetrolog)

---

## 📄 License

VetroLog is licensed under the [MIT License](https://opensource.org/licenses/MIT).
