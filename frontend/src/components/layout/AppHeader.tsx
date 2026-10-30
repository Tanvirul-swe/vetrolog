import { useState } from 'react';
import {
  Terminal,
  Trash2,
  Smartphone,
  RefreshCw,
  Table,
  User,
  Server,
  FolderOpen,
  Power,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { QRPairingModal } from '@/features/connection/components/QRPairingModal';
import { AdbDeviceSelector } from '@/features/adb/components/AdbDeviceSelector';
import { ConnectionManagerModal } from '@/features/connections/components/ConnectionManagerModal';
import { UpdateBadge } from '@/features/updater/UpdateBadge';
import { UpdateProgressModal } from '@/features/updater/UpdateProgressModal';
import { UserProfileModal } from '@/features/profile/components/UserProfileModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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
          <div className="wails-no-drag ml-2 flex items-center rounded-lg border border-border/80 bg-muted/60 p-1 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => handleModeSwitch('mobile')}
              className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                workspaceMode === 'mobile'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80 ring-1 ring-black/5 dark:ring-white/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 hover:shadow-2xs border border-transparent hover:border-border/50'
              }`}
              title="Switch source to Mobile ADB (Android SQLite & SharedPreferences)"
            >
              <Smartphone className={`size-3.5 ${workspaceMode === 'mobile' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Mobile ADB</span>
              {workspaceMode === 'mobile' && (
                <span className="size-1.5 rounded-full bg-sky-400 shadow-xs shadow-sky-400/50" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('remote')}
              className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                workspaceMode === 'remote'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80 ring-1 ring-black/5 dark:ring-white/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 hover:shadow-2xs border border-transparent hover:border-border/50'
              }`}
              title="Switch source to Remote Databases (PostgreSQL, MySQL, MariaDB, Redis, Local SQLite files)"
            >
              <Globe className={`size-3.5 ${workspaceMode === 'remote' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span>Remote / Files</span>
              {workspaceMode === 'remote' && (
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50" />
              )}
            </button>
          </div>
        </div>

        {/* Center Workspace Switcher (Inspector vs SQL Playground) */}
        <div className="wails-no-drag flex items-center justify-center">
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/60 p-1 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('grid')}
              className={`h-7 px-3.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                activeWorkspaceView === 'grid'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80 ring-1 ring-black/5 dark:ring-white/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 hover:shadow-2xs border border-transparent hover:border-border/50'
              }`}
              title="Inspector: Browse table data, schema structure, and row inspector"
            >
              <Table className={`size-3.5 ${activeWorkspaceView === 'grid' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Inspector</span>
              {activeWorkspaceView === 'grid' && (
                <span className="size-1.5 rounded-full bg-sky-400 shadow-xs shadow-sky-400/50" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('playground')}
              className={`h-7 px-3.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                activeWorkspaceView === 'playground'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80 ring-1 ring-black/5 dark:ring-white/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 hover:shadow-2xs border border-transparent hover:border-border/50'
              }`}
              title="SQL Playground: Multi-tab SQL query editor, autocomplete, and dry run"
            >
              <Terminal className={`size-3.5 ${activeWorkspaceView === 'playground' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>SQL Playground</span>
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5 shadow-xs shadow-emerald-400/50" />
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

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Theme Mode Toggle */}
          <ThemeToggle />

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
