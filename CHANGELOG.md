# Changelog

All notable changes to the **VetroLog** desktop application will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.4.0] - 2026-10-29

### 🚀 Overview
**VetroLog v1.4.0** transforms VetroLog from a mobile SQLite inspector into a comprehensive, multi-engine desktop database studio. It introduces full remote database connectivity, enterprise-scale performance safeguards for million-row tables, native Microsoft SQL Server support, dialect-aware AI SQL generation with schema pruning, and an isolated dual-workspace flow between Mobile ADB and Remote databases.

---

### 🌟 New Features & Engine Support

#### 1. Remote Database Connectivity & Multi-Engine Architecture
* **PostgreSQL Engine**: Pure Go `pgx/v5` connection pool with SSL/TLS support, schema selection, and visual query explain plans.
* **MySQL & MariaDB Engine**: Pure Go driver integration with character set negotiation, collation support, and multi-schema browsing.
* **Microsoft SQL Server (MSSQL / Azure SQL)**:
  - Official pure-Go `go-mssqldb` driver integration with zero CGO dependencies.
  - Native T-SQL pagination (`ORDER BY ... OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`).
  - Catalog inspection across `sys.databases`, `sys.schemas`, `information_schema.tables`, and `sys.partitions`.
  - Automatic `TOP 100` playground safeguard for ad-hoc queries.
* **Redis Studio**:
  - Interactive key-value browser with TTL tracking, real-time value editor, and data type inspection (`string`, `hash`, `list`, `set`, `zset`).
* **Desktop SQLite File Inspection**:
  - Direct local `.db` file opener with in-memory journaling and atomic change previews.
* **Connection Manager & Credential Vault**:
  - AES-256 encrypted local credential storage (`connections.json`).
  - **Import from Connection URL**: 1-click parsing for `postgresql://`, `mysql://`, `sqlserver://`, and `redis://` connection strings.
  - Built-in **SSH Tunnel Manager** (Bastion / Jump Host forwarding with password or PEM private key authentication).
  - Environment badges (`PROD`, `STAGE`, `DEV`, `LOCAL`) with production safe-mode confirmation dialogs.

---

### ⚡ Enterprise Scale & Performance Safeguards

* **Statistical Row Count Estimation ($O(1)$ sub-millisecond table loading)**:
  - **PostgreSQL**: Queries `pg_class.reltuples` statistics catalog. Tables $>50,000$ rows load instantaneously in $<50$ms without triggering multi-second MVCC sequential scans.
  - **MySQL**: Queries `information_schema.TABLES.TABLE_ROWS` InnoDB partition statistics.
  - **Microsoft SQL Server**: Queries `sys.partitions` heap/clustered index row counts.
  - **Safety Timeout Guard**: For smaller or unanalyzed tables, exact `COUNT(*)` executes with an automatic 500ms timeout guard, falling back gracefully to catalog statistics if disk I/O stalls.
  - **UI Indicators**: Table row badges display `~{count} rows (est.)` with clear tooltip explanations.
* **Offscreen DOM Virtualization**:
  - Applied CSS `content-visibility: auto` and `contain-intrinsic-size` on table listings in `RemoteDatabaseTree`, enabling 60fps buttery-smooth scrolling even when browsing databases with 600+ to 1,000+ tables.
* **Server-Side Pagination & Automatic LIMIT Interception**:
  - All tabular grids operate via strict `LIMIT 50 OFFSET X` server-side paging. Browser memory consumption remains minimal regardless of table size.
  - Ad-hoc queries executed in the SQL Playground lacking explicit `LIMIT` or `TOP` are automatically wrapped with safe 100-row caps to prevent browser memory exhaustion.

---

### 🤖 AI-Powered SQL Assistant Upgrades

* **Dialect-Aware Generation**:
  - Dynamically detects the active database engine (`PostgreSQL`, `MySQL`, `T-SQL`, `SQLite`) and instructs AI models with dialect-specific functions (e.g., `NOW() - INTERVAL '15 days'` for Postgres, `DATEADD(day, -15, GETDATE())` for SQL Server, `datetime('now', '-15 days')` for SQLite).
* **Smart Schema Pruning (`pruneTablesForPrompt`)**:
  - When connected to large-scale enterprise databases with 50 to 600+ tables, VetroLog automatically prunes schema context down to the top 30 most relevant tables using relationship heuristics:
    1. Active table (+1000 pts)
    2. Foreign-key linked parent/child tables (+500 pts)
    3. Keyword / prompt matches against table and column names (+60 to +300 pts)
  - Reduces prompt size by **95%** (from ~50k tokens down to ~2.5k tokens), speeds up generation by **80%**, and prevents `context_length_exceeded` errors on local Ollama models.
* **Active Stop & Cancellation Controls**:
  - Real-time **Stop** (<kbd>■ Stop</kbd>) button and <kbd>Esc</kbd> key handler utilizing `AbortController` and `AbortSignal` across Gemini, OpenAI, and Ollama APIs.

---

### 🛠️ Developer Experience & UI Polish

* **Dual Workspace Flow (Mobile ADB vs Remote DB)**:
  - Clean state isolation: switching between **Mobile ADB** and **Remote / Files** resets sidebar table pollution and prevents cross-mode table freezes.
  - When in Remote mode, background ADB USB polling is automatically paused to conserve CPU cycles and battery.
* **Undo & Redo with Platform-Aware Shortcuts**:
  - Visual <kbd>↶ Undo</kbd> and <kbd>↷ Redo</kbd> buttons in the SQL Playground editor toolbar.
  - Dynamic tooltips rendering native OS keystrokes (`⌘Z` / `⌘⇧Z` on macOS; `Ctrl+Z` / `Ctrl+Y` or `Ctrl+Shift+Z` on Windows & Linux).
  - Keystroke buffer flushing guarantees undo/redo stack state precision without skipped characters.
* **Modern Tactile Segmented Controls**:
  - Redesigned header action switchers (`[ Mobile ADB ] [ Remote / Files ]` and `[ Inspector ] [ SQL Playground ]`) into recessed segmented controls with interactive hover pills, active glow dots, and crisp micro-interactions.
* **Query Dry-Run Simulation**:
  - Remote database mutation queries can be simulated safely inside an auto-rollback transaction before committing changes.

---

### 🐛 Bug Fixes & Stability

* Fixed React Rules of Hooks violation in `RemoteDatabaseTree` caused by conditional `useMemo` execution after early returns.
* Fixed table selection contamination where remote tables were erroneously queried through the ADB Android bridge.
* Fixed pending changes JSON unmarshaling bug when receiving array-formatted mutation payloads.
* Fixed trailing semicolon extraction issue in query simulation WHERE clauses.

---

### 📦 Platform & Distribution Updates
* Updated desktop release version to `v1.4.0` across:
  - Core Go runtime: `internal/version/version.go`
  - Frontend SPA: `frontend/package.json` & `useUpdaterStore.ts`
  - Package Managers: Scoop (`vetrolog.json`), Arch Linux AUR (`PKGBUILD`, `.SRCINFO`), and Snapcraft (`snapcraft.yaml`).

