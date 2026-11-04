import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { VetroLogWebviewPanel } from './webviewPanel';
import { VetroLogCustomEditorProvider } from './customEditor';
import { QuickActionsProvider, ServerStatusProvider } from './treeProvider';

export async function activate(context: vscode.ExtensionContext) {
  const serverManager = new ServerManager();
  context.subscriptions.push(serverManager);

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'vetrolog.open';
  statusBarItem.text = '$(database) VetroLog';
  statusBarItem.tooltip = 'Click to open VetroLog Database Studio';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar when server state changes
  serverManager.onStatusChange((status) => {
    if (status.isRunning) {
      statusBarItem.text = '$(database) VetroLog: Active';
      statusBarItem.tooltip = `VetroLog Studio connected on port ${status.port}`;
    } else {
      statusBarItem.text = '$(database) VetroLog: Offline';
      statusBarItem.tooltip = 'VetroLog daemon is stopped. Click to launch.';
    }
  });

  // Auto-start server if configured
  const config = vscode.workspace.getConfiguration('vetrolog');
  const autoStart = config.get<boolean>('autoStartServer', true);
  if (autoStart) {
    serverManager.startServer().catch((err) => {
      console.warn('[VetroLog] Auto-start daemon encountered an issue:', err);
    });
  }

  // Register Custom Editor Provider for .db / .sqlite files
  context.subscriptions.push(
    VetroLogCustomEditorProvider.register(context, serverManager)
  );

  // Register Activity Bar Tree Views
  const quickActionsProvider = new QuickActionsProvider();
  const serverStatusProvider = new ServerStatusProvider(serverManager);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vetrolog.quickActions', quickActionsProvider)
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vetrolog.serverStatus', serverStatusProvider)
  );

  // Helper to ensure server is running before opening UI
  const ensureServerRunning = async (): Promise<boolean> => {
    const isRunning = await serverManager.checkHealth();
    if (!isRunning) {
      return await serverManager.startServer();
    }
    return true;
  };

  // Commands Registration
  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.open', async () => {
      await ensureServerRunning();
      await VetroLogWebviewPanel.createOrShow(context.extensionUri, serverManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.connectADB', async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode.ViewColumn.One,
        '/?mode=adb'
      );
      panel.navigate('/?mode=adb');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.openERDiagram', async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode.ViewColumn.One,
        '/?view=diagram'
      );
      panel.navigate('/?view=diagram');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.newQuery', async () => {
      await ensureServerRunning();
      const panel = await VetroLogWebviewPanel.createOrShow(
        context.extensionUri,
        serverManager,
        vscode.ViewColumn.One,
        '/?view=playground'
      );
      panel.navigate('/?view=playground');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.openFile', async (uri?: vscode.Uri) => {
      let targetPath: string | undefined;

      if (uri && uri.fsPath) {
        targetPath = uri.fsPath;
      } else {
        const files = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: 'Inspect Database',
          filters: {
            'SQLite Databases': ['db', 'sqlite', 'sqlite3', 'db3', 'wal'],
            'All Files': ['*'],
          },
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
        vscode.ViewColumn.One,
        initialPath
      );
      panel.navigate(initialPath);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.startServer', async () => {
      const ok = await serverManager.startServer();
      if (ok) {
        vscode.window.showInformationMessage(
          `VetroLog daemon active at ${serverManager.getBaseUrl()}`
        );
      } else {
        vscode.window.showErrorMessage(
          'Failed to start VetroLog daemon. Check VetroLog Daemon output channel.'
        );
      }
      serverStatusProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.stopServer', () => {
      serverManager.stopServer();
      vscode.window.showInformationMessage('VetroLog daemon stopped.');
      serverStatusProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vetrolog.restartServer', async () => {
      vscode.window.showInformationMessage('Restarting VetroLog daemon...');
      const ok = await serverManager.restartServer();
      if (ok) {
        vscode.window.showInformationMessage(
          `VetroLog daemon restarted at ${serverManager.getBaseUrl()}`
        );
      } else {
        vscode.window.showErrorMessage('Failed to restart VetroLog daemon.');
      }
      serverStatusProvider.refresh();
    })
  );
}

export function deactivate() {
  // Handled by extension subscriptions disposal
}

