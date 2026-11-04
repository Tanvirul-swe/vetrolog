import * as vscode from 'vscode';
import { ServerManager } from './serverManager';

export class VetroLogWebviewPanel {
  public static currentPanel: VetroLogWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly serverManager: ServerManager;
  private disposables: vscode.Disposable[] = [];

  public static async createOrShow(
    extensionUri: vscode.Uri,
    serverManager: ServerManager,
    viewColumn = vscode.ViewColumn.One,
    initialPath = '/'
  ) {
    // If we already have a panel, show it.
    if (VetroLogWebviewPanel.currentPanel) {
      VetroLogWebviewPanel.currentPanel.panel.reveal(viewColumn);
      if (initialPath !== '/') {
        VetroLogWebviewPanel.currentPanel.navigate(initialPath);
      }
      return VetroLogWebviewPanel.currentPanel;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'vetrologStudio',
      'VetroLog Database Studio',
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    VetroLogWebviewPanel.currentPanel = new VetroLogWebviewPanel(
      panel,
      extensionUri,
      serverManager,
      initialPath
    );
    return VetroLogWebviewPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    serverManager: ServerManager,
    initialPath = '/'
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.serverManager = serverManager;

    // Set the webview's initial html content
    this.updateContent(initialPath);

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update theme when VS Code theme changes
    vscode.window.onDidChangeActiveColorTheme(
      () => {
        this.updateTheme();
      },
      null,
      this.disposables
    );

    // Listen for status changes from server manager
    this.serverManager.onStatusChange(
      () => {
        this.updateContent(initialPath);
      },
      null,
      this.disposables
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'startServer':
            await this.serverManager.startServer();
            this.updateContent();
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'vetrolog');
            break;
          case 'showInfo':
            vscode.window.showInformationMessage(message.text);
            break;
          case 'showError':
            vscode.window.showErrorMessage(message.text);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public navigate(subPath: string) {
    let action = subPath;
    if (subPath.includes('mode=adb')) {
      action = 'adb';
    } else if (subPath.includes('view=diagram')) {
      action = 'diagram';
    } else if (subPath.includes('view=playground')) {
      action = 'playground';
    } else if (subPath.includes('view=grid')) {
      action = 'grid';
    }

    this.panel.webview.postMessage({
      type: 'navigate',
      action,
      path: subPath,
    });

    if (subPath.includes('file=')) {
      try {
        const urlParams = new URLSearchParams(subPath.replace(/^\/?\?/, ''));
        const file = urlParams.get('file');
        if (file) {
          this.openFile(file);
        }
      } catch {
        // Fallback
      }
    }
  }

  public openFile(filePath: string) {
    this.panel.webview.postMessage({
      type: 'openFile',
      filePath,
    });
  }

  private getActiveTheme(): 'dark' | 'light' {
    const kind = vscode.window.activeColorTheme.kind;
    return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight
      ? 'light'
      : 'dark';
  }

  private updateTheme() {
    this.panel.webview.postMessage({
      type: 'themeChange',
      theme: this.getActiveTheme(),
    });
  }

  public async updateContent(subPath = '/') {
    const isRunning = await this.serverManager.checkHealth();
    const theme = this.getActiveTheme();
    const serverUrl = `${this.serverManager.getBaseUrl()}${subPath}`;

    if (!isRunning) {
      this.panel.webview.html = this.getOfflineHtml();
    } else {
      this.panel.webview.html = this.getIframeHtml(serverUrl, theme);
    }
  }

  private getIframeHtml(url: string, theme: string): string {
    return `<!DOCTYPE html>
<html lang="en" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
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

  public dispose() {
    VetroLogWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
}

