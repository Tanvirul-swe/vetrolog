import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface ServerStatus {
  isRunning: boolean;
  port: number;
  url: string;
  version?: string;
  error?: string;
}

export class ServerManager {
  private process: ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;
  private currentPort = 8787;
  private isStarting = false;
  private onStatusChangeEmitter = new vscode.EventEmitter<ServerStatus>();
  public readonly onStatusChange = this.onStatusChangeEmitter.event;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('VetroLog Daemon');
    const config = vscode.workspace.getConfiguration('vetrolog');
    this.currentPort = config.get<number>('serverPort', 8787);
  }

  public getPort(): number {
    return this.currentPort;
  }

  public getBaseUrl(): string {
    return `http://localhost:${this.currentPort}`;
  }

  /**
   * Pings the server status endpoint to see if it's already running.
   */
  public async checkHealth(port = this.currentPort): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/api/status`, { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Locates the VetroLog executable on the system.
   */
  public findBinary(): string | null {
    const config = vscode.workspace.getConfiguration('vetrolog');
    const customPath = config.get<string>('customBinaryPath', '').trim();
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'vetrolog.exe' : 'vetrolog';

    // 1. Check workspace project build if working directly in vetrolog repo
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    for (const folder of workspaceFolders) {
      const candidates = [
        path.join(folder.uri.fsPath, 'build', 'bin', binaryName),
        path.join(folder.uri.fsPath, 'build', 'bin', 'vetrolog.app', 'Contents', 'MacOS', 'vetrolog'),
        path.join(folder.uri.fsPath, binaryName),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }

    // 2. Standard system install locations
    const homeDir = os.homedir();
    const standardLocations: string[] = isWindows
      ? [
          path.join(homeDir, 'go', 'bin', binaryName),
          `C:\\Program Files\\VetroLog\\${binaryName}`,
          `C:\\Program Files (x86)\\VetroLog\\${binaryName}`,
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'VetroLog', binaryName),
        ]
      : [
          '/usr/local/bin/vetrolog',
          '/opt/homebrew/bin/vetrolog',
          '/usr/bin/vetrolog',
          path.join(homeDir, 'go', 'bin', 'vetrolog'),
          '/Applications/VetroLog.app/Contents/MacOS/vetrolog',
          path.join(homeDir, 'Applications/VetroLog.app/Contents/MacOS/vetrolog'),
        ];

    for (const loc of standardLocations) {
      if (fs.existsSync(loc)) {
        return loc;
      }
    }

    // 3. System PATH check
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
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
  public async startServer(): Promise<boolean> {
    if (this.isStarting) return false;
    this.isStarting = true;

    // Check if server is already running on the port
    const alreadyRunning = await this.checkHealth(this.currentPort);
    if (alreadyRunning) {
      this.outputChannel.appendLine(`[Daemon] Existing VetroLog instance detected on port ${this.currentPort}`);
      this.isStarting = false;
      this.notifyStatus(true);
      return true;
    }

    const binary = this.findBinary();
    if (!binary) {
      this.outputChannel.appendLine('[Daemon Error] Could not find vetrolog executable binary.');
      this.outputChannel.appendLine('Please install VetroLog or specify "vetrolog.customBinaryPath" in settings.');
      this.isStarting = false;
      this.notifyStatus(false, 'Binary not found. Please install VetroLog.');
      return false;
    }

    this.outputChannel.appendLine(`[Daemon] Launching ${binary} on port ${this.currentPort}...`);

    try {
      this.process = spawn(binary, ['--web', `--port=${this.currentPort}`, '--no-browser'], {
        detached: false,
        env: {
          ...process.env,
        },
      });

      this.process.stdout?.on('data', (data) => {
        this.outputChannel.append(`[VetroLog] ${data.toString()}`);
      });

      this.process.stderr?.on('data', (data) => {
        this.outputChannel.append(`[VetroLog Error] ${data.toString()}`);
      });

      this.process.on('close', (code) => {
        this.outputChannel.appendLine(`[Daemon] Process exited with code ${code}`);
        this.process = null;
        this.notifyStatus(false);
      });

      // Poll until healthy (max 10 seconds)
      const startTime = Date.now();
      while (Date.now() - startTime < 10000) {
        await new Promise((r) => setTimeout(r, 400));
        const ok = await this.checkHealth(this.currentPort);
        if (ok) {
          this.outputChannel.appendLine(`[Daemon] Verified running at ${this.getBaseUrl()}`);
          this.isStarting = false;
          this.notifyStatus(true);
          return true;
        }
      }

      this.outputChannel.appendLine('[Daemon Warning] Server health check timed out.');
      this.isStarting = false;
      return false;
    } catch (err: any) {
      this.outputChannel.appendLine(`[Daemon Error] Failed to spawn process: ${err.message}`);
      this.isStarting = false;
      this.notifyStatus(false, err.message);
      return false;
    }
  }

  /**
   * Stops the running server daemon.
   */
  public stopServer() {
    if (this.process) {
      this.outputChannel.appendLine('[Daemon] Terminating process...');
      this.process.kill('SIGTERM');
      this.process = null;
      this.notifyStatus(false);
    }
  }

  /**
   * Restarts the server daemon.
   */
  public async restartServer(): Promise<boolean> {
    this.stopServer();
    await new Promise((r) => setTimeout(r, 600));
    return this.startServer();
  }

  private notifyStatus(isRunning: boolean, error?: string) {
    this.onStatusChangeEmitter.fire({
      isRunning,
      port: this.currentPort,
      url: this.getBaseUrl(),
      error,
    });
  }

  public dispose() {
    this.stopServer();
    this.outputChannel.dispose();
    this.onStatusChangeEmitter.dispose();
  }
}

