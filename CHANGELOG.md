# Changelog

All notable changes to the **VetroLog** desktop application will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.5.0] - 2026-10-30

### 🚀 Overview
**VetroLog v1.5.0** introduces the **Interactive Real-Time Database Schema Visualizer (ER Diagram)** inspired by dbdiagram.io, **Animated Relationship Data Flow** with directional traveling arrows and particles, smart **Inferred Foreign Key detection**, a full **2026 Light & Dark Theme** system with zero-flicker boot, a **Collapsible Left Sidebar (⌘B)** for 100% full-width canvas workspace, streamlined UI toolbars, and formal **Open-Source Governance & CI Quality Gates**.

---

### 🌟 New Features & Highlights

#### 1. Interactive Real-Time ER Diagram (`/features/diagram`)
* **Auto-Generated Visual Maps**: Automatically maps database tables, columns, data types, primary keys, and foreign keys into draggable interactive cards upon connecting to an Android debug app or remote database.
* **Interactive Infinite Canvas**: Fluid panning, focal-point mouse wheel zooming, fit-to-screen (`⛶`), and an interactive mini-map navigation camera.
* **Hierarchical Layered Auto-Layout**: Sugiyama-style layered DAG layout algorithm (`layoutEngine.ts`) calculating optimal tier positioning without table overlap.
* **Live Schema Sync**: Automatically updates visual diagrams upon emulator/device migrations or remote catalog changes.
* **Multi-Format Export**:
  - **dbdiagram.io (DBML)**: Direct importable syntax with table definitions and `Ref:` declarations.
  - **Mermaid ER Diagram**: Markdown-ready `erDiagram` syntax for documentation and GitHub previews.
  - **SQL DDL**: Standard `CREATE TABLE` and `ALTER TABLE ... ADD CONSTRAINT` statements.
  - **Scalable Vector Graphics (SVG)**: Clean standalone vector graphics snapshot.

#### 2. Animated Relationship Data Flow
* **Directional Traveling Arrow Chevrons**: GPU-accelerated SVG chevrons (`<animateMotion rotate="auto">`) dynamically glide along the exact curvature from child Foreign Keys into parent Primary Keys.
* **Flowing Pulse Particles**: Moving particles follow the connector path visualizing active reference/data flow between associated tables.
* **Target Anchor Ping**: Emits an `animate-ping` highlight on referenced primary keys when hovered or selected.
* **Toolbar Control**: Dedicated `Flow Anim` toggle button to enable/disable animations at will.

#### 3. Smart Inferred Foreign Keys & Robust Schema Parsing
* **Safe FK Extraction**: Resolved `undefined is not an object (evaluating 'fk.toTable.toLowerCase')` by providing safe fallbacks for both Go backend (`refTable`/`column`/`refColumn`) and frontend schema representations.
* **Expanded Heuristics**: Added plural-to-singular transformations (e.g., `categories` → `category_id`), camelCase conventions (`userId`, `orderId`), and UUID patterns (`user_uuid`).
* **Visual Distinction**: Solid Bézier lines for formal foreign keys; dashed Bézier lines for inferred relations.

#### 4. UI Streamlining & Collapsible Left Sidebar
* **Collapsible Sidebar (⌘B / Ctrl+B)**: Left database sidebar collapses smoothly (`w-64` to `w-0`) to give 100% canvas width to the ER Diagram, DataGrid, and SQL Studio. Remembers preference in `localStorage`.
* **Streamlined Top Bar**: Replaced bulky controls with compact segmented controls for source modes (`[ Mobile | Remote ]`) and workspace views (`[ Inspector | ER Diagram | SQL Studio ]`). Unified utility cluster for refresh, logs, theme, and user preferences.
* **Clean ER Diagram Toolbar**: Logical functional zones for search, Auto Arrange, segmented layer toggles (`Inferred FKs`, `Types`, `Flow Anim`), and zoom controls. Removed distracting counter badges.

#### 5. Modern Dark & Light Theme System
* Complete high-contrast Light Theme alongside Deep Obsidian Navy Dark Theme.
* Inline zero-flicker boot script, OS `prefers-color-scheme` listener, and persistent theme storage.

#### 6. Open-Source Governance & Automated CI
* Added `SECURITY.md` for responsible disclosure via GitHub Private Vulnerability Reporting.
* Added `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
* Added `.github/pull_request_template.md` and `.github/CODEOWNERS`.
* Added interactive GitHub Issue Forms for bug reports and feature requests.
* Upgraded `.github/workflows/check.yml` to run automated frontend lint/build and backend Go race tests (`go test -race`, `go vet`).

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

