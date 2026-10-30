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
  Network,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
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

  const isSidebarOpen = useSettingsStore((s) => s.isSidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

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
      <header className="wails-drag h-12 border-b border-border/80 bg-card/75 backdrop-blur-md px-3 flex items-center justify-between select-none shrink-0 z-30">
        {/* Left Section: Traffic Lights Offset & Sidebar Toggle & Brand & Source Mode Toggle */}
        <div className={`flex items-center gap-2.5 ${isMac ? 'pl-[76px]' : 'pl-1'}`}>
          {/* Sidebar Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarOpen ? 'Collapse sidebar (⌘B)' : 'Expand sidebar (⌘B)'}
            className={`wails-no-drag size-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
              isSidebarOpen
                ? 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                : 'text-primary bg-primary/10 border border-primary/30 shadow-2xs'
            }`}
          >
            <PanelLeft className="size-4" />
          </button>

          {/* Logo & Brand */}
          <div className="flex items-center gap-2 mr-1">
            <div className="size-7 rounded-lg overflow-hidden border border-border/80 shadow-2xs bg-background/80 flex items-center justify-center shrink-0 p-0.5">
              <img src={logoIcon} alt="VetroLog" className="size-full object-cover rounded-md" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs tracking-tight text-foreground">VetroLog</span>
              <UpdateBadge />
            </div>
          </div>

          {/* Source Mode Switcher: Mobile vs Remote (Sleek Compact Segmented Pill) */}
          <div className="wails-no-drag flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => handleModeSwitch('mobile')}
              className={`h-6 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                workspaceMode === 'mobile'
                  ? 'bg-background text-foreground font-semibold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Switch to Mobile ADB (Android SQLite, Hive, SharedPreferences)"
            >
              <Smartphone className={`size-3 ${workspaceMode === 'mobile' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('remote')}
              className={`h-6 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                workspaceMode === 'remote'
                  ? 'bg-background text-foreground font-semibold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Switch to Remote / Local DB (PostgreSQL, MySQL, MSSQL, Redis, SQLite file)"
            >
              <Globe className={`size-3 ${workspaceMode === 'remote' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span>Remote</span>
            </button>
          </div>
        </div>

        {/* Center Workspace Switcher (Inspector, ER Diagram, SQL Studio) */}
        <div className="wails-no-drag flex items-center justify-center">
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('grid')}
              className={`h-6.5 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                activeWorkspaceView === 'grid'
                  ? 'bg-background text-foreground font-semibold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
              title="Inspector: Browse table data, schema structure, and row inspector"
            >
              <Table className={`size-3.5 ${activeWorkspaceView === 'grid' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('diagram')}
              className={`h-6.5 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                activeWorkspaceView === 'diagram'
                  ? 'bg-background text-foreground font-semibold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
              title="ER Diagram: Interactive schema visualizer, relationships, and foreign keys"
            >
              <Network className={`size-3.5 ${activeWorkspaceView === 'diagram' ? 'text-purple-400' : 'text-muted-foreground'}`} />
              <span>ER Diagram</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceView('playground')}
              className={`h-6.5 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                activeWorkspaceView === 'playground'
                  ? 'bg-background text-foreground font-semibold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
              title="SQL Studio: Multi-tab SQL query editor, autocomplete, and dry run"
            >
              <Terminal className={`size-3.5 ${activeWorkspaceView === 'playground' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>SQL Studio</span>
            </button>
          </div>
        </div>

        {/* Right Section: Connection Status & Grouped Action Utilities */}
        <div className="wails-no-drag flex items-center gap-2">
          {workspaceMode === 'mobile' ? (
            <AdbDeviceSelector />
          ) : (
            /* Remote Controls */
            <div className="flex items-center gap-1.5">
              {activeSession ? (
                <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <Server className="size-3" />
                  <span className="font-medium max-w-[110px] truncate">{activeSession.config.name}</span>
                  <button
                    type="button"
                    onClick={disconnect}
                    className="p-0.5 hover:text-rose-400 rounded transition-colors ml-0.5"
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
                  className="h-7 text-xs gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-medium"
                >
                  <Server className="size-3" />
                  <span>Connect DB</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => selectLocalFileDialog()}
                className="h-7 text-xs gap-1.5 border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Open local SQLite file from disk"
              >
                <FolderOpen className="size-3 text-amber-500" />
                <span className="hidden sm:inline">Open .db</span>
              </Button>
            </div>
          )}

          {/* Clean Grouped Action Utilities */}
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5 gap-0.5">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onRefresh}
                title="Refresh table data (⌘R)"
                className="size-6 text-muted-foreground hover:text-foreground hover:bg-background/80"
              >
                <RefreshCw className="size-3" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearLogs}
              title="Clear mutation & query logs"
              className="size-6 text-muted-foreground hover:text-foreground hover:bg-background/80"
            >
              <Trash2 className="size-3" />
            </Button>

            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsProfileOpen(true)}
              title="User Profile & Preferences"
              className="size-6 text-muted-foreground hover:text-foreground hover:bg-background/80"
            >
              <User className="size-3.5 text-primary" />
            </Button>
          </div>
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
