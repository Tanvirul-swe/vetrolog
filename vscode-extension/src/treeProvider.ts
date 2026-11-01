import * as vscode from 'vscode';
import { ServerManager, ServerStatus } from './serverManager';

export class QuickActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly commandId: string,
    public readonly iconName: string,
    public readonly description?: string,
    public readonly tooltip?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.tooltip = tooltip || label;
    this.description = description;
    this.command = {
      command: commandId,
      title: label,
    };
  }
}

export class QuickActionsProvider implements vscode.TreeDataProvider<QuickActionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<QuickActionItem | undefined | null | void> =
    new vscode.EventEmitter<QuickActionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<QuickActionItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: QuickActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<QuickActionItem[]> {
    return Promise.resolve([
      new QuickActionItem(
        'Open Database Studio',
        'vetrolog.open',
        'database',
        'Full Studio',
        'Launch VetroLog Database Studio webview'
      ),
      new QuickActionItem(
        'Scan ADB Devices & Apps',
        'vetrolog.connectADB',
        'device-mobile',
        'Mobile Inspector',
        'Inspect live SQLite databases on Android / Flutter / React Native'
      ),
      new QuickActionItem(
        'Interactive ER Diagram',
        'vetrolog.openERDiagram',
        'type-hierarchy',
        'Visual Schema',
        'Open visual schema map with interactive foreign key flows'
      ),
      new QuickActionItem(
        'New SQL Query',
        'vetrolog.newQuery',
        'terminal',
        'SQL Playground',
        'Execute ad-hoc queries with auto-complete and safety simulation'
      ),
      new QuickActionItem(
        'Open SQLite File...',
        'vetrolog.openFile',
        'file-submodule',
        'Local File',
        'Select a SQLite file (.db, .sqlite, .db3) from your filesystem'
      ),
    ]);
  }
}

export class ServerStatusItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly iconName: string,
    public readonly description?: string,
    public readonly tooltip?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.description = description;
    this.tooltip = tooltip || label;
  }
}

export class ServerStatusProvider implements vscode.TreeDataProvider<ServerStatusItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ServerStatusItem | undefined | null | void> =
    new vscode.EventEmitter<ServerStatusItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ServerStatusItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private isRunning = false;
  private currentPort = 8787;

  constructor(private readonly serverManager: ServerManager) {
    this.currentPort = serverManager.getPort();
    serverManager.onStatusChange((status: ServerStatus) => {
      this.isRunning = status.isRunning;
      this.currentPort = status.port;
      this.refresh();
    });

    // Check status on startup
    this.serverManager.checkHealth().then((running) => {
      this.isRunning = running;
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ServerStatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ServerStatusItem[]> {
    const running = await this.serverManager.checkHealth();
    this.isRunning = running;
    const binary = this.serverManager.findBinary();

    const items: ServerStatusItem[] = [];

    // Status item
    if (this.isRunning) {
      items.push(
        new ServerStatusItem(
          'Status: Active',
          'check',
          `Port ${this.currentPort}`,
          `VetroLog daemon is running at ${this.serverManager.getBaseUrl()}`
        )
      );
      items.push(
        new ServerStatusItem(
          'URL',
          'globe',
          this.serverManager.getBaseUrl(),
          'Click to open in browser',
          {
            command: 'vscode.open',
            title: 'Open in Browser',
            arguments: [vscode.Uri.parse(this.serverManager.getBaseUrl())],
          }
        )
      );
    } else {
      items.push(
        new ServerStatusItem(
          'Status: Stopped',
          'circle-slash',
          'Offline',
          'VetroLog daemon is not currently running'
        )
      );
    }

    // Binary item
    if (binary) {
      const displayBinary = binary.length > 35 ? '...' + binary.slice(-32) : binary;
      items.push(
        new ServerStatusItem(
          'CLI Binary',
          'file-binary',
          displayBinary,
          `Binary: ${binary}`
        )
      );
    } else {
      items.push(
        new ServerStatusItem(
          'CLI Binary: Not Found',
          'warning',
          'Install VetroLog',
          'VetroLog binary was not detected on system PATH. Click to open settings.',
          {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['vetrolog.customBinaryPath'],
          }
        )
      );
    }

    // Action items
    items.push(
      new ServerStatusItem(
        this.isRunning ? 'Restart Local Daemon' : 'Start Local Daemon',
        'refresh',
        '',
        'Start or restart background database daemon',
        {
          command: this.isRunning ? 'vetrolog.restartServer' : 'vetrolog.startServer',
          title: 'Restart Daemon',
        }
      )
    );

    return items;
  }
}
