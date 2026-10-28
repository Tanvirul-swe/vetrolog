import { useState } from 'react';
import {
  Terminal,
  Trash2,
  Smartphone,
  RefreshCw,
  QrCode,
  Table,
  User,
  Server,
  FolderOpen,
  Power,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { QRPairingModal } from '@/features/connection/components/QRPairingModal';
import { AdbDeviceSelector } from '@/features/adb/components/AdbDeviceSelector';
import { ConnectionManagerModal } from '@/features/connections/components/ConnectionManagerModal';
import { UpdateBadge } from '@/features/updater/UpdateBadge';
import { UpdateProgressModal } from '@/features/updater/UpdateProgressModal';
import { UserProfileModal } from '@/features/profile/components/UserProfileModal';
import logoIcon from '@/assets/images/vetrolog-icon.png';

interface AppHeaderProps {
  onRefresh?: () => void;
  isConnectionManagerOpen?: boolean;
  setIsConnectionManagerOpen?: (open: boolean) => void;
}

export function AppHeader({
  onRefresh,
  isConnectionManagerOpen: propIsOpen,
  setIsConnectionManagerOpen: propSetIsOpen,
}: AppHeaderProps) {
  const SHOW_QR_PAIR = false;

  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isConnectionManagerOpen = propIsOpen !== undefined ? propIsOpen : localIsOpen;
  const setIsConnectionManagerOpen = propSetIsOpen || setLocalIsOpen;

  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);

  const isConnected = useConnectionStore((s) => s.isConnected);
  const currentDevice = useConnectionStore((s) => s.currentDevice);
  const port = useConnectionStore((s) => s.port);

  const clearLogs = useDatabaseStore((s) => s.clearLogs);

  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = usePlaygroundStore((s) => s.setActiveWorkspaceView);

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const setWorkspaceMode = useConnectionManagerStore((s) => s.setWorkspaceMode);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const disconnect = useConnectionManagerStore((s) => s.disconnect);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);

  const handleModeSwitch = async (mode: 'mobile' | 'remote') => {
    setWorkspaceMode(mode);
    if (mode === 'remote' && !activeSession) {
      await useConnectionManagerStore.getState().loadSavedConnections();
      const saved = useConnectionManagerStore.getState().savedConnections;
      if (saved.length === 0) {
        setIsConnectionManagerOpen(true);
      }
    }
  };

  return (
    <>
      <header className="wails-drag h-13 border-b border-border/80 bg-card/60 backdrop-blur-md px-3 flex items-center justify-between select-none shrink-0 z-30">
        {/* Left Section: Brand & Traffic Lights Offset & Source Mode Toggle */}
        <div className={`flex items-center gap-3 ${isMac ? 'pl-[76px]' : 'pl-1'}`}>
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
          <div className="wails-no-drag ml-2 flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 shadow-2xs">
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
              <span>Mobile ADB</span>
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

        {/* Center Workspace Switcher (Inspector vs SQL Playground) */}
        <div className="wails-no-drag flex items-center justify-center">
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('grid')}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-md text-xs transition-all ${
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
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-md text-xs transition-all ${
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
        </div>

        {/* Right Section: Connection Status & Quick Action Controls */}
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
                    title="Disconnect session"
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

          <div className="h-4 w-px bg-border/60 mx-1" />

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              title="Refresh table data (⌘R)"
              className="text-muted-foreground hover:text-foreground size-8"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearLogs}
            title="Clear mutation & query logs"
            className="text-muted-foreground hover:text-foreground size-8"
          >
            <Trash2 className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsProfileOpen(true)}
            title="User Profile & Preferences"
            className="text-muted-foreground hover:text-foreground size-8 rounded-full border border-border/70 hover:border-primary/50 hover:bg-primary/10 transition-colors ml-0.5"
          >
            <User className="size-4 text-primary" />
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

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
}
