import * as vscode from 'vscode';
import * as path from 'path';
import { ServerManager } from './serverManager';

/**
 * Custom readonly editor provider that opens SQLite database files directly in VetroLog.
 */
export class VetroLogCustomEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'vetrolog.dbEditor';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly serverManager: ServerManager
  ) {}

  public static register(
    context: vscode.ExtensionContext,
    serverManager: ServerManager
  ): vscode.Disposable {
    const provider = new VetroLogCustomEditorProvider(context, serverManager);
    return vscode.window.registerCustomEditorProvider(
      VetroLogCustomEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return {
      uri,
      dispose: () => {},
    };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [this.context.extensionUri],
    };

    const filePath = document.uri.fsPath;

    // Helper to render the editor content depending on daemon health
    const render = async () => {
      const isHealthy = await this.serverManager.checkHealth();
      const theme = this.getActiveTheme();
      if (!isHealthy) {
        webviewPanel.webview.html = this.getOfflineHtml();
      } else {
        const encodedPath = encodeURIComponent(filePath);
        const token = this.serverManager.getToken();
        const url = `${this.serverManager.getBaseUrl()}/?file=${encodedPath}${token ? `&token=${token}` : ''}`;
        webviewPanel.webview.html = this.getHtmlForWebview(url, theme, filePath);
      }
    };

    // Ensure daemon is active on first open
    const initialHealth = await this.serverManager.checkHealth();
    if (!initialHealth) {
      await this.serverManager.startServer();
    }
    await render();

    // Re-render / update theme when active color theme changes
    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({
        type: 'themeChange',
        theme: this.getActiveTheme(),
      });
    });

    // Auto-update editor when daemon status changes
    const statusListener = this.serverManager.onStatusChange((status) => {
      if (status.isRunning) {
        render();
      }
    });

    // Handle messages from offline view (e.g. Start Server, Settings)
    const messageListener = webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'startServer') {
        await this.serverManager.startServer();
        await render();
      } else if (msg.command === 'openSettings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'vetrolog');
      }
    });

    // Listen for file changes on the database file
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(dir, base)
    );
    fileWatcher.onDidChange(() => {
      webviewPanel.webview.postMessage({
        type: 'fileChanged',
        filePath,
      });
    });

    webviewPanel.onDidDispose(() => {
      themeListener.dispose();
      statusListener.dispose();
      messageListener.dispose();
      fileWatcher.dispose();
    });
  }

  private getActiveTheme(): 'dark' | 'light' {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
      ? 'light'
      : 'dark';
  }

  private getHtmlForWebview(url: string, theme: string, filePath: string): string {
    const fileName = path.basename(filePath) || 'database';
    return `<!DOCTYPE html>
<html lang="en" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} — VetroLog</title>
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
        iframe.contentWindow.postMessage(msg, '${this.serverManager.getBaseUrl()}');
      }
    });
  </script>
</body>
</html>`;
  }

  private getOfflineHtml(): string {
    const port = this.serverManager.getPort();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
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
  <div class="icon">🔌</div>
  <h2>VetroLog Daemon Offline</h2>
  <p>
    The background database engine is not running on port <strong>${port}</strong>. 
    Click below to launch the local daemon to inspect this SQLite file.
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
}
