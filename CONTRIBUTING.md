# Contributing to VetroLog

First off, thank you for considering contributing to VetroLog! 🚀

VetroLog is an open-source tool designed to make mobile database debugging painless, fast, and delightful. Whether you are fixing a bug, adding support for new database formats, improving UI ergonomics, or refining documentation, your contributions are welcome.

---

## 1. Prerequisites & Tooling

To build and contribute to VetroLog, ensure your development environment has the following installed:

1. **[Go](https://go.dev)**: Version 1.23 or higher.
   ```bash
   go version
   ```
2. **[Node.js](https://nodejs.org)**: Version 20 or higher, with `npm`.
   ```bash
   node -v && npm -v
   ```
3. **[Wails CLI v2](https://wails.io)**: The desktop application framework.
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   wails doctor
   ```
4. **Android SDK & ADB**:
   Ensure `adb` is available in your system `$PATH`:
   ```bash
   adb version
   ```

---

## 2. Codebase Map

Here is an overview of how the VetroLog repository is organized:

```
vetrolog/
├── main.go                     # Entry point (handles CLI flags: Desktop vs --web mode)
├── wails.json                  # Wails application configuration
├── go.mod / go.sum             # Go module dependencies
│
├── internal/                   # Backend Go packages (Not directly imported by external apps)
│   ├── adb/                    # ADB Bridge & SQLite engine
│   │   ├── client.go           # Low-level ADB exec-out & run-as process execution
│   │   ├── service.go          # Database discovery, WAL sync, schema parsing, table paging
│   │   └── models.go           # Data structures (Device, App, TableMeta, ColumnMeta)
│   ├── web/                    # Local Web Server mode
│   │   └── server.go           # HTTP REST endpoints & embedded React SPA file server
│   ├── app/                    # Wails application lifecycle & exported IPC bindings
│   │   ├── app.go              # Subsystem orchestrator
│   │   └── bindings.go         # Exported methods callable from React (AdbListDevices, etc.)
│   └── broadcaster/            # Event dispatching and mutation batching
│
├── frontend/                   # Frontend React application (React 19 + TypeScript + Vite)
│   ├── src/
│   │   ├── components/         # Reusable UI primitives (Buttons, Badges, Layout)
│   │   ├── features/           # Feature-specific modules
│   │   │   ├── adb/            # Device and package selector components
│   │   │   ├── databases/      # Sidebar database tree & table lists
│   │   │   ├── datagrid/       # Sortable paginated table viewer & cell editors
│   │   │   ├── query/          # Interactive SQL runner & execution benchmarks
│   │   │   └── updater/        # In-app GitHub release version checking
│   │   ├── services/
│   │   │   └── apiBridge.ts    # Unified API bridge (Desktop Wails IPC vs Web HTTP REST)
│   │   └── stores/             # Zustand state stores
│   │       ├── useAdbStore.ts  # ADB device polling & real-time live sync
│   │       └── useDatabaseStore.ts # Table records, columns, query history
│   └── vite.config.ts          # Vite build config with /api proxy
│
├── docs/                       # Detailed documentation suite
│   ├── ARCHITECTURE.md         # Internal mechanisms & WAL sync in plain English
│   ├── INSTALLATION.md         # Multi-platform installation guides
│   ├── USER_GUIDE.md           # End-user manual & ADB setup
│   └── DEPLOYMENT.md           # Release tagging & GitHub Actions CI/CD
│
└── .github/workflows/          # Automated GitHub Actions
    ├── check.yml               # Frontend linting & validation
    └── release.yml             # Multi-platform binary compilation (macOS, Windows, Linux)
```

---

## 3. Local Development Workflows

### Workflow A: Desktop Mode Development (With Live Reload)
This runs the native desktop window using Wails:
```bash
# In the project root:
wails dev
```
- Wails starts the Go backend and Vite frontend watcher.
- The desktop window automatically launches.
- Changes to Go files trigger auto-recompilation.
- Changes to React files trigger instant Hot Module Replacement (HMR).

---

### Workflow B: Web Server Mode Development
If you are developing or testing in a browser tab (Chrome/Safari/Firefox):
```bash
# Terminal 1: Start Go web server
./vetrolog --web --no-browser

# Terminal 2: Start Vite frontend
cd frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser. Vite proxies all `/api` calls directly to the Go server on `:8787`.

---

## 4. Verification & Quality Checklist

Before submitting a Pull Request, please ensure all three checks pass cleanly with **zero errors**:

```bash
# 1. Check frontend TypeScript and lint rules
cd frontend
npm run lint

# 2. Verify frontend production bundle compiles
npm run build

# 3. Verify backend Go compiles cleanly
cd ..
go build -v .
```

---

## 5. Git & Pull Request Guidelines

1. **Branch Naming**:
   - `feat/feature-name` for new capabilities
   - `fix/bug-description` for bug fixes
   - `docs/topic-name` for documentation updates
   - `refactor/clean-up` for architectural refactoring
2. **Conventional Commits**:
   Please follow standard commit prefixes:
   - `feat: add support for encrypted SQLite databases`
   - `fix: resolve table selection bounce on rapid clicking`
   - `docs: update installation instructions for macOS Sequoia`
   - `perf: optimize ADB PID polling batch command`
3. **Submitting a PR**:
   - Push your branch to your fork.
   - Open a Pull Request targeting `main`.
   - Provide a concise summary of the problem, the solution, and verification steps.
