import { useState } from 'react';
import {
  Search,
  Terminal,
  Trash2,
  Smartphone,
  RefreshCw,
  QrCode,
  Table,
  Shield,
  Server,
  FolderOpen,
  Power,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { QRPairingModal } from '@/features/connection/components/QRPairingModal';
import { AdbDeviceSelector } from '@/features/adb/components/AdbDeviceSelector';
import { ConnectionManagerModal } from '@/features/connections/components/ConnectionManagerModal';
import { UpdateBadge } from '@/features/updater/UpdateBadge';
import { UpdateProgressModal } from '@/features/updater/UpdateProgressModal';
import { TelemetrySettingsModal } from '@/features/telemetry/components/TelemetrySettingsModal';
import { isWailsApp } from '@/services/apiBridge';
import logoIcon from '@/assets/images/vetrolog-icon.png';

interface AppHeaderProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onRefresh?: () => void;
  isConnectionManagerOpen?: boolean;
  setIsConnectionManagerOpen?: (open: boolean) => void;
}

export function AppHeader({
  searchInputRef,
  onRefresh,
  isConnectionManagerOpen: propIsOpen,
  setIsConnectionManagerOpen: propSetIsOpen,
}: AppHeaderProps) {
  const SHOW_QR_PAIR = false;
  const isWails = isWailsApp();

  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isConnectionManagerOpen = propIsOpen !== undefined ? propIsOpen : localIsOpen;
  const setIsConnectionManagerOpen = propSetIsOpen || setLocalIsOpen;

  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  const isConnected = useConnectionStore((s) => s.isConnected);
  const currentDevice = useConnectionStore((s) => s.currentDevice);
  const port = useConnectionStore((s) => s.port);

  const filterTerm = useDatabaseStore((s) => s.filterTerm);
  const setFilterTerm = useDatabaseStore((s) => s.setFilterTerm);
  const clearLogs = useDatabaseStore((s) => s.clearLogs);

  const isConsoleOpen = useSettingsStore((s) => s.isConsoleOpen);
  const toggleConsole = useSettingsStore((s) => s.toggleConsole);

  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = usePlaygroundStore((s) => s.setActiveWorkspaceView);

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const setWorkspaceMode = useConnectionManagerStore((s) => s.setWorkspaceMode);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const disconnect = useConnectionManagerStore((s) => s.disconnect);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);

  const handleModeSwitch = (mode: 'mobile' | 'remote') => {
    setWorkspaceMode(mode);
    if (mode === 'remote' && !activeSession) {
      setIsConnectionManagerOpen(true);
    }
  };

  return (
    <>
      <header className="wails-drag h-13 border-b border-border/80 bg-card/60 backdrop-blur-md px-4 flex items-center justify-between select-none shrink-0 z-30">
        {/* Brand & Window Traffic Lights Offset (on macOS desktop) */}
        <div className={`flex items-center gap-3 ${isWails ? 'pl-16' : 'pl-2'}`}>
          <div className="size-8 rounded-lg overflow-hidden border border-primary/40 shadow-xs shadow-primary/30 bg-background/80 flex items-center justify-center shrink-0 p-0.5">
            <img src={logoIcon} alt="VetroLog" className="size-full object-cover rounded-md" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-foreground">VetroLog</span>
              <UpdateBadge />
            </div>
            <p className="text-[11px] text-muted-foreground leading-none">Database & Storage Studio</p>
          </div>

          {/* Source Mode Switcher: Mobile ADB vs Remote / Local DB */}
          <div className="wails-no-drag ml-2 flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => handleModeSwitch('mobile')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                workspaceMode === 'mobile'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Mobile ADB SQLite & Key-Value Inspection"
            >
              <Smartphone className="size-3 text-sky-400" />
              <span>Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('remote')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                workspaceMode === 'remote'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Remote Databases (Postgres, MySQL, Redis, SQLite files)"
            >
              <Globe className="size-3 text-emerald-400" />
              <span>Remote / Files</span>
            </button>
          </div>
        </div>

        {/* Center Workspace Switcher & Search Bar */}
        <div className="wails-no-drag flex items-center gap-3 max-w-xl w-full mx-4">
          {/* Segmented Workspace Pill */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                activeWorkspaceView === 'grid'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table className="size-3.5 text-sky-400" />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('playground')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-colors ${
                activeWorkspaceView === 'playground'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal className="size-3.5 text-primary" />
              <span>SQL Playground</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              placeholder="Search rows or keys... (⌘K)"
              className="pl-8 pr-12 h-8 text-xs bg-muted/40 border-border/60 focus:bg-background"
            />
            <kbd className="absolute right-2 top-2 pointer-events-none text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded border border-border">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right Controls */}
        <div className="wails-no-drag flex items-center gap-2">
          {workspaceMode === 'mobile' ? (
            <AdbDeviceSelector />
          ) : (
            /* Remote Controls */
            <div className="flex items-center gap-1.5">
              {activeSession ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Server className="size-3.5" />
                  <span className="font-medium max-w-[120px] truncate">{activeSession.config.name}</span>
                  <button
                    type="button"
                    onClick={disconnect}
                    className="p-0.5 hover:text-rose-400 rounded transition-colors"
                    title="Disconnect"
                  >
                    <Power className="size-3" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConnectionManagerOpen(true)}
                  className="h-8 text-xs gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-medium"
                >
                  <Server className="size-3.5" />
                  <span>Connect DB</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => selectLocalFileDialog()}
                className="h-8 text-xs gap-1.5 border-border/70 hover:bg-muted"
                title="Open local SQLite file from disk"
              >
                <FolderOpen className="size-3.5 text-amber-400" />
                <span>Open .db</span>
              </Button>
            </div>
          )}

          {/* QR Pairing Feature - Hidden for this version (code preserved) */}
          {SHOW_QR_PAIR && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPairingOpen(true)}
                className="h-8 text-xs gap-1.5 border-primary/30 hover:bg-primary/10 text-primary"
              >
                <QrCode className="size-3.5" />
                <span>QR Pair</span>
              </Button>

              {isConnected && currentDevice ? (
                <button
                  type="button"
                  onClick={() => setIsPairingOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors"
                  title="Click to view device details"
                >
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Smartphone className="size-3.5" />
                  <span className="font-medium max-w-[120px] truncate">{currentDevice.name}</span>
                  <span className="text-[10px] text-emerald-400/70 capitalize">({currentDevice.platform})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPairingOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/60 border border-border text-muted-foreground text-xs hover:bg-muted transition-colors"
                  title="Click to pair mobile device"
                >
                  <span className="size-2 rounded-full bg-amber-400/80 animate-ping" />
                  <span>Listening on :{port}</span>
                </button>
              )}
            </>
          )}

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              title="Refresh table data (⌘R)"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearLogs}
            title="Clear mutation & query logs"
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </Button>

          <Button
            variant={isConsoleOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleConsole}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Toggle live mutation console (⌘J)"
          >
            <Terminal className="size-3.5" />
            <span>Console</span>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsTelemetryOpen(true)}
            title="Privacy & Analytics Settings"
            className="text-muted-foreground hover:text-foreground"
          >
            <Shield className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Connection Manager Modal */}
      <ConnectionManagerModal
        isOpen={isConnectionManagerOpen}
        onClose={() => setIsConnectionManagerOpen(false)}
      />

      {SHOW_QR_PAIR && (
        <QRPairingModal
          isOpen={isPairingOpen}
          onClose={() => setIsPairingOpen(false)}
        />
      )}

      <UpdateProgressModal />

      <TelemetrySettingsModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />
    </>
  );
}
