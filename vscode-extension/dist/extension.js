"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode5 = __toESM(require("vscode"));

// src/serverManager.ts
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
var http = __toESM(require("http"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var ServerManager = class {
  process = null;
  outputChannel;
  currentPort = 8787;
  isStarting = false;
  onStatusChangeEmitter = new vscode.EventEmitter();
  onStatusChange = this.onStatusChangeEmitter.event;
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("VetroLog Daemon");
    const config = vscode.workspace.getConfiguration("vetrolog");
    this.currentPort = config.get("serverPort", 8787);
  }
  getPort() {
    return this.currentPort;
  }
  getBaseUrl() {
    return `http://localhost:${this.currentPort}`;
  }
  /**
   * Pings the server status endpoint to see if it's already running.
   */
  async checkHealth(port = this.currentPort) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/api/status`, { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }
  /**
   * Locates the VetroLog executable on the system.
   */
  findBinary() {
    const config = vscode.workspace.getConfiguration("vetrolog");
    const customPath = config.get("customBinaryPath", "").trim();
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }
    const isWindows = process.platform === "win32";
    const binaryName = isWindows ? "vetrolog.exe" : "vetrolog";
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    for (const folder of workspaceFolders) {
      const candidates = [
        path.join(folder.uri.fsPath, "build", "bin", binaryName),
        path.join(folder.uri.fsPath, "build", "bin", "vetrolog.app", "Contents", "MacOS", "vetrolog"),
        path.join(folder.uri.fsPath, binaryName)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
    const homeDir = os.homedir();
    const standardLocations = isWindows ? [
      path.join(homeDir, "go", "bin", binaryName),
      `C:\\Program Files\\VetroLog\\${binaryName}`,
      `C:\\Program Files (x86)\\VetroLog\\${binaryName}`,
      path.join(process.env.LOCALAPPDATA || "", "Programs", "VetroLog", binaryName)
    ] : [
      "/usr/local/bin/vetrolog",
      "/opt/homebrew/bin/vetrolog",
      "/usr/bin/vetrolog",
      path.join(homeDir, "go", "bin", "vetrolog"),
      "/Applications/VetroLog.app/Contents/MacOS/vetrolog",
      path.join(homeDir, "Applications/VetroLog.app/Contents/MacOS/vetrolog")
    ];
    for (const loc of standardLocations) {
      if (fs.existsSync(loc)) {
        return loc;
      }
    }
    const pathDirs = (process.env.PATH || "").split(path.delimiter);
    for (const p of pathDirs) {
      const fullPath = path.join(p, binaryName);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }
  /**
   * Starts the VetroLog daemon in headless web server mode.
   */
  async startServer() {
    if (this.isStarting) return false;
    this.isStarting = true;
    const alreadyRunning = await this.checkHealth(this.currentPort);
    if (alreadyRunning) {
      this.outputChannel.appendLine(`[Daemon] Existing VetroLog instance detected on port ${this.currentPort}`);
      this.isStarting = false;
      this.notifyStatus(true);
      return true;
    }
    const binary = this.findBinary();
    if (!binary) {
      this.outputChannel.appendLine("[Daemon Error] Could not find vetrolog executable binary.");
      this.outputChannel.appendLine('Please install VetroLog or specify "vetrolog.customBinaryPath" in settings.');
      this.isStarting = false;
      this.notifyStatus(false, "Binary not found. Please install VetroLog.");
      return false;
    }
    this.outputChannel.appendLine(`[Daemon] Launching ${binary} on port ${this.currentPort}...`);
    try {
      this.process = (0, import_child_process.spawn)(binary, ["--web", `--port=${this.currentPort}`, "--no-browser"], {
        detached: false,
        env: {
          ...process.env
        }
      });
      this.process.stdout?.on("data", (data) => {
        this.outputChannel.append(`[VetroLog] ${data.toString()}`);
      });
      this.process.stderr?.on("data", (data) => {
        this.outputChannel.append(`[VetroLog Error] ${data.toString()}`);
      });
      this.process.on("close", (code) => {
        this.outputChannel.appendLine(`[Daemon] Process exited with code ${code}`);
        this.process = null;
        this.notifyStatus(false);
      });
      const startTime = Date.now();
      while (Date.now() - startTime < 1e4) {
        await new Promise((r) => setTimeout(r, 400));
        const ok = await this.checkHealth(this.currentPort);
        if (ok) {
          this.outputChannel.appendLine(`[Daemon] Verified running at ${this.getBaseUrl()}`);
          this.isStarting = false;
          this.notifyStatus(true);
          return true;
        }
      }
      this.outputChannel.appendLine("[Daemon Warning] Server health check timed out.");
      this.isStarting = false;
      return false;
    } catch (err) {
      this.outputChannel.appendLine(`[Daemon Error] Failed to spawn process: ${err.message}`);
      this.isStarting = false;
      this.notifyStatus(false, err.message);
      return false;
    }
  }
  /**
   * Stops the running server daemon.
   */
  stopServer() {
    if (this.process) {
      this.outputChannel.appendLine("[Daemon] Terminating process...");
      this.process.kill("SIGTERM");
      this.process = null;
      this.notifyStatus(false);
    }
  }
  /**
   * Restarts the server daemon.
   */
  async restartServer() {
    this.stopServer();
    await new Promise((r) => setTimeout(r, 600));
    return this.startServer();
  }
  notifyStatus(isRunning, error) {
    this.onStatusChangeEmitter.fire({
      isRunning,
      port: this.currentPort,
      url: this.getBaseUrl(),
      error
    });
  }
  dispose() {
    this.stopServer();
    this.outputChannel.dispose();
    this.onStatusChangeEmitter.dispose();
  }
};

// src/webviewPanel.ts
var vscode2 = __toESM(require("vscode"));
var VetroLogWebviewPanel = class _VetroLogWebviewPanel {
  static currentPanel;
  panel;
  extensionUri;
  serverManager;
  disposables = [];
  static async createOrShow(extensionUri, serverManager, viewColumn = vscode2.ViewColumn.One, initialPath = "/") {
    if (_VetroLogWebviewPanel.currentPanel) {
      _VetroLogWebviewPanel.currentPanel.panel.reveal(viewColumn);
      if (initialPath !== "/") {
        _VetroLogWebviewPanel.currentPanel.navigate(initialPath);
      }
      return _VetroLogWebviewPanel.currentPanel;
    }
    const panel = vscode2.window.createWebviewPanel(
      "vetrologStudio",
      "VetroLog Database Studio",
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );
    _VetroLogWebviewPanel.currentPanel = new _VetroLogWebviewPanel(
      panel,
      extensionUri,
      serverManager,
      initialPath
    );
    return _VetroLogWebviewPanel.currentPanel;
  }
  constructor(panel, extensionUri, serverManager, initialPath = "/") {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.serverManager = serverManager;
    this.updateContent(initialPath);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    vscode2.window.onDidChangeActiveColorTheme(
      () => {
        this.updateTheme();
      },
      null,
      this.disposables
    );
    this.serverManager.onStatusChange(
      () => {
        this.updateContent(initialPath);
      },
      null,
      this.disposables
    );
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "startServer":
            await this.serverManager.startServer();
            this.updateContent();
            break;
          case "openSettings":
            vscode2.commands.executeCommand("workbench.action.openSettings", "vetrolog");
            break;
          case "showInfo":
            vscode2.window.showInformationMessage(message.text);
            break;
          case "showError":
            vscode2.window.showErrorMessage(message.text);
            break;
        }
      },
      null,
      this.disposables
    );
  }
  navigate(subPath) {
    this.panel.webview.postMessage({
      type: "navigate",
      path: subPath
    });
  }
  getActiveTheme() {
    const kind = vscode2.window.activeColorTheme.kind;
    return kind === vscode2.ColorThemeKind.Light || kind === vscode2.ColorThemeKind.HighContrastLight ? "light" : "dark";
  }
  updateTheme() {
    this.panel.webview.postMessage({
      type: "themeChange",
      theme: this.getActiveTheme()
    });
  }
  async updateContent(subPath = "/") {
    const isRunning = await this.serverManager.checkHealth();
    const theme = this.getActiveTheme();
    const serverUrl = `${this.serverManager.getBaseUrl()}${subPath}`;
    if (!isRunning) {
      this.panel.webview.html = this.getOfflineHtml();
    } else {
      this.panel.webview.html = this.getIframeHtml(serverUrl, theme);
    }
  }
  getIframeHtml(url, theme) {
    return `<!DOCTYPE html>
<html lang="en" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VetroLog Studio</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #0B0F19);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe 
    src="${url}" 
    allow="clipboard-read; clipboard-write;"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads">
  </iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const msg = event.data;
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(msg, '*');
      }
    });
  </script>
</body>
</html>`;
  }
  getOfflineHtml() {
    const port = this.serverManager.getPort();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VetroLog Offline</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      padding: 2.5rem;
      background-color: var(--vscode-editor-background, #0B0F19);
      color: var(--vscode-editor-foreground, #E2E8F0);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vh;
      text-align: center;
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin-top: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    p {
      max-width: 480px;
      color: var(--vscode-descriptionForeground, #94A3B8);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .btn {
      background-color: var(--vscode-button-background, #0284C7);
      color: var(--vscode-button-foreground, #FFFFFF);
      border: none;
      padding: 0.6rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background-color: transparent;
      color: var(--vscode-textLink-foreground, #38BDF8);
      border: 1px solid var(--vscode-button-secondaryBorder, #334155);
      margin-left: 0.5rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="icon">\u{1F50C}</div>
  <h2>VetroLog Daemon Offline</h2>
  <p>
    The background database engine is not running on port <strong>${port}</strong>. 
    Click below to launch the local daemon or configure your custom binary path.
  </p>
  <div class="actions">
    <button class="btn" onclick="startServer()">Launch VetroLog Daemon</button>
    <button class="btn btn-secondary" onclick="openSettings()">Configure Settings</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function startServer() {
      const btn = document.querySelector('.btn');
      btn.innerText = 'Starting daemon...';
      btn.disabled = true;
      vscode.postMessage({ command: 'startServer' });
    }
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }
  </script>
</body>
</html>`;
  }
  dispose() {
    _VetroLogWebviewPanel.currentPanel = void 0;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
};

// src/customEditor.ts
var vscode3 = __toESM(require("vscode"));
var VetroLogCustomEditorProvider = class _VetroLogCustomEditorProvider {
  constructor(context, serverManager) {
    this.context = context;
    this.serverManager = serverManager;
  }
  static viewType = "vetrolog.dbEditor";
  static register(context, serverManager) {
    const provider = new _VetroLogCustomEditorProvider(context, serverManager);
    return vscode3.window.registerCustomEditorProvider(
      _VetroLogCustomEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }
  async openCustomDocument(uri, _openContext, _token) {
    return {
      uri,
      dispose: () => {
      }
    };
  }
  async resolveCustomEditor(document, webviewPanel, _token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [this.context.extensionUri]
    };
    const filePath = document.uri.fsPath;
    const isHealthy = await this.serverManager.checkHealth();
    if (!isHealthy) {
      await this.serverManager.startServer();
    }
    const render = () => {
      const theme = this.getActiveTheme();
      const encodedPath = encodeURIComponent(filePath);
      const url = `${this.serverManager.getBaseUrl()}/?file=${encodedPath}`;
      webviewPanel.webview.html = this.getHtmlForWebview(url, theme, filePath);
    };
    render();
    const themeListener = vscode3.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({
        type: "themeChange",
        theme: this.getActiveTheme()
      });
    });
    const fileWatcher = vscode3.workspace.createFileSystemWatcher(
      new vscode3.RelativePattern(vscode3.Uri.file(filePath), "*")
    );
    fileWatcher.onDidChange(() => {
      webviewPanel.webview.postMessage({
        type: "fileChanged",
        filePath
      });
    });
    webviewPanel.onDidDispose(() => {
      themeListener.dispose();
      fileWatcher.dispose();
    });
  }
  getActiveTheme() {
    const kind = vscode3.window.activeColorTheme.kind;
    return kind === vscode3.ColorThemeKind.Light || kind === vscode3.ColorThemeKind.HighContrastLight ? "light" : "dark";
  }
  getHtmlForWebview(url, theme, filePath) {
    const fileName = filePath.split(/[/\\]/).pop() || "database";
    return `<!DOCTYPE html>
<html lang="en" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} \u2014 VetroLog</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #0B0F19);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe 
    src="${url}" 
    allow="clipboard-read; clipboard-write;"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads">
  </iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const msg = event.data;
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(msg, '*');
      }
    });
  </script>
</body>
</html>`;
  }
};

// src/treeProvider.ts
var vscode4 = __toESM(require("vscode"));
var QuickActionItem = class extends vscode4.TreeItem {
  constructor(label, commandId, iconName, description, tooltip) {
    super(label, vscode4.TreeItemCollapsibleState.None);
    this.label = label;
    this.commandId = commandId;
    this.iconName = iconName;
    this.description = description;
    this.tooltip = tooltip;
    this.iconPath = new vscode4.ThemeIcon(iconName);
    this.tooltip = tooltip || label;
    this.description = description;
    this.command = {
      command: commandId,
      title: label
    };
  }
};
var QuickActionsProvider = class {
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  getChildren() {
    return Promise.resolve([
      new QuickActionItem(
        "Open Database Studio",
        "vetrolog.open",
        "database",
        "Full Studio",
        "Launch VetroLog Database Studio webview"
      ),
      new QuickActionItem(
        "Scan ADB Devices & Apps",
        "vetrolog.connectADB",
        "device-mobile",
        "Mobile Inspector",
        "Inspect live SQLite databases on Android / Flutter / React Native"
      ),
      new QuickActionItem(
        "Interactive ER Diagram",
        "vetrolog.openERDiagram",
        "type-hierarchy",
        "Visual Schema",
        "Open visual schema map with interactive foreign key flows"
      ),
      new QuickActionItem(
        "New SQL Query",
        "vetrolog.newQuery",
        "terminal",
        "SQL Playground",
        "Execute ad-hoc queries with auto-complete and safety simulation"
      ),
      new QuickActionItem(
        "Open SQLite File...",
        "vetrolog.openFile",
        "file-submodule",
        "Local File",
        "Select a SQLite file (.db, .sqlite, .db3) from your filesystem"
      )
    ]);
  }
};
var ServerStatusItem = class extends vscode4.TreeItem {
  constructor(label, iconName, description, tooltip, command) {
    super(label, vscode4.TreeItemCollapsibleState.None);
    this.label = label;
    this.iconName = iconName;
    this.description = description;
    this.tooltip = tooltip;
    this.command = command;
    this.iconPath = new vscode4.ThemeIcon(iconName);
    this.description = description;
    this.tooltip = tooltip || label;
  }
};
var ServerStatusProvider = class {
  constructor(serverManager) {
    this.serverManager = serverManager;
    this.currentPort = serverManager.getPort();
    serverManager.onStatusChange((status) => {
      this.isRunning = status.isRunning;
      this.currentPort = status.port;
      this.refresh();
    });
    this.serverManager.checkHealth().then((running) => {
      this.isRunning = running;
      this.refresh();
    });
  }
  _onDidChangeTreeData = new vscode4.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  isRunning = false;
  currentPort = 8787;
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren() {
    const running = await this.serverManager.checkHealth();
    this.isRunning = running;
    const binary = this.serverManager.findBinary();
    const items = [];
    if (this.isRunning) {
      items.push(
        new ServerStatusItem(
          "Status: Active",
          "check",
          `Port ${this.currentPort}`,
          `VetroLog daemon is running at ${this.serverManager.getBaseUrl()}`
        )
      );
      items.push(
        new ServerStatusItem(
          "URL",
          "globe",
          this.serverManager.getBaseUrl(),
          "Click to open in browser",
          {
            command: "vscode.open",
            title: "Open in Browser",
            arguments: [vscode4.Uri.parse(this.serverManager.getBaseUrl())]
          }
        )
      );
    } else {
      items.push(
        new ServerStatusItem(
          "Status: Stopped",
          "circle-slash",
          "Offline",
          "VetroLog daemon is not currently running"
        )
      );
    }
    if (binary) {
      const displayBinary = binary.length > 35 ? "..." + binary.slice(-32) : binary;
      items.push(
        new ServerStatusItem(
          "CLI Binary",
          "file-binary",
          displayBinary,
          `Binary: ${binary}`
        )
      );
    } else {
      items.push(
        new ServerStatusItem(
          "CLI Binary: Not Found",
          "warning",
          "Install VetroLog",
          "VetroLog binary was not detected on system PATH. Click to open settings.",
          {
            command: "workbench.action.openSettings",
            title: "Open Settings",
            arguments: ["vetrolog.customBinaryPath"]
          }
        )
      );
    }
    items.push(
      new ServerStatusItem(
        this.isRunning ? "Restart Local Daemon" : "Start Local Daemon",
        "refresh",
        "",
        "Start or restart background database daemon",
        {
          command: this.isRunning ? "vetrolog.restartServer" : "vetrolog.startServer",
          title: "Restart Daemon"
        }
      )
    );
    return items;
  }
};

// src/extension.ts
async function activate(context) {
  const serverManager = new ServerManager();
  context.subscriptions.push(serverManager);
  const statusBarItem = vscode5.window.createStatusBarItem(
    vscode5.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "vetrolog.open";
  statusBarItem.text = "$(database) VetroLog";
  statusBarItem.tooltip = "Click to open VetroLog Database Studio";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  serverManager.onStatusChange((status) => {
    if (status.isRunning) {
      statusBarItem.text = "$(database) VetroLog: Active";
      statusBarItem.tooltip = `VetroLog Studio connected on port ${status.port}`;
    } else {
      statusBarItem.text = "$(database) VetroLog: Offline";
      statusBarItem.tooltip = "VetroLog daemon is stopped. Click to launch.";
    }
  });
  const config = vscode5.workspace.getConfiguration("vetrolog");
  const autoStart = config.get("autoStartServer", true);
  if (autoStart) {
    serverManager.startServer().catch((err) => {
      console.warn("[VetroLog] Auto-start daemon encountered an issue:", err);
    });
  }
  context.subscriptions.push(
    VetroLogCustomEditorProvider.register(context, serverManager)
  );
  const quickActionsProvider = new QuickActionsProvider();
  const serverStatusProvider = new ServerStatusProvider(serverManager);
  context.subscriptions.push(
    vscode5.window.registerTreeDataProvider("vetrolog.quickActions", quickActionsProvider)
  );
  context.subscriptions.push(
    vscode5.window.registerTreeDataProvider("vetrolog.serverStatus", serverStatusProvider)
  );
  const ensureServerRunning = async () => {
    const isRunning = await serverManager.checkHealth();
    if (!isRunning) {
      return await serverManager.startServer();
    }
    return true;
  };
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.open", async () => {
      await ensureServerRunning();
      await VetroLogWebviewPanel.createOrShow(context.extensionUri, serverManager);
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.connectADB", async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode5.ViewColumn.One,
        "/?mode=adb"
      );
      panel.navigate("/?mode=adb");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.openERDiagram", async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode5.ViewColumn.One,
        "/?view=diagram"
      );
      panel.navigate("/?view=diagram");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.newQuery", async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode5.ViewColumn.One,
        "/?view=playground"
      );
      panel.navigate("/?view=playground");
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.openFile", async (uri) => {
      let targetPath;
      if (uri && uri.fsPath) {
        targetPath = uri.fsPath;
      } else {
        const files = await vscode5.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: "Inspect Database",
          filters: {
            "SQLite Databases": ["db", "sqlite", "sqlite3", "db3", "wal"],
            "All Files": ["*"]
          }
        });
        if (files && files.length > 0) {
          targetPath = files[0].fsPath;
        }
      }
      if (!targetPath) return;
      await ensureServerRunning();
      const encoded = encodeURIComponent(targetPath);
      const initialPath = `/?file=${encoded}`;
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode5.ViewColumn.One,
        initialPath
      );
      panel.navigate(initialPath);
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.startServer", async () => {
      const ok = await serverManager.startServer();
      if (ok) {
        vscode5.window.showInformationMessage(
          `VetroLog daemon active at ${serverManager.getBaseUrl()}`
        );
      } else {
        vscode5.window.showErrorMessage(
          "Failed to start VetroLog daemon. Check VetroLog Daemon output channel."
        );
      }
      serverStatusProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.stopServer", () => {
      serverManager.stopServer();
      vscode5.window.showInformationMessage("VetroLog daemon stopped.");
      serverStatusProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode5.commands.registerCommand("vetrolog.restartServer", async () => {
      vscode5.window.showInformationMessage("Restarting VetroLog daemon...");
      const ok = await serverManager.restartServer();
      if (ok) {
        vscode5.window.showInformationMessage(
          `VetroLog daemon restarted at ${serverManager.getBaseUrl()}`
        );
      } else {
        vscode5.window.showErrorMessage("Failed to restart VetroLog daemon.");
      }
      serverStatusProvider.refresh();
    })
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
