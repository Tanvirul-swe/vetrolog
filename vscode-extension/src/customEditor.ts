import * as vscode from 'vscode';
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

    // Ensure daemon is active
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

    // Re-render / update theme when active color theme changes
    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({
        type: 'themeChange',
        theme: this.getActiveTheme(),
      });
    });

    // Listen for file changes on the database
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(filePath), '*')
    );
    fileWatcher.onDidChange(() => {
      webviewPanel.webview.postMessage({
        type: 'fileChanged',
        filePath,
      });
    });

    webviewPanel.onDidDispose(() => {
      themeListener.dispose();
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
    const fileName = filePath.split(/[/\\]/).pop() || 'database';
    return `<!DOCTYPE html>
<html lang="en" class="${theme}">
<head>
  <meta charset="UTF-8">
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
        iframe.contentWindow.postMessage(msg, '*');
      }
    });
  </script>
</body>
</html>`;
  }
}
