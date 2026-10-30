import { useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { AppStatusBar } from './AppStatusBar';
import { DataGrid } from '@/features/datagrid/components/DataGrid';
import { SqlPlayground } from '@/features/playground/SqlPlayground';
import { RedisKeyViewer } from '@/features/redis/RedisKeyViewer';
import { DatabaseDiagramView } from '@/features/diagram/DatabaseDiagramView';
import { PendingChangesBar } from '@/features/datagrid/components/PendingChangesBar';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface SplitLayoutProps {
  onRefresh?: () => void;
  onRequestPage?: (page: number) => void;
  onExecuteQuery?: (query: string) => void;
  onUpdateRow?: (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => void;
  onDeleteRow?: (pkField: string, pkValue: unknown) => void;
}

export function SplitLayout({
  onRefresh,
  onRequestPage,
  onUpdateRow,
  onDeleteRow,
}: SplitLayoutProps) {
  const [isConnectionManagerOpen, setIsConnectionManagerOpen] = useState(false);

  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);
  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const activeRemoteView = useConnectionManagerStore((s) => s.activeRemoteView);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);

  const isSidebarOpen = useSettingsStore((s) => s.isSidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  useKeyboardShortcuts(onRefresh);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground relative">
      {/* Top Header */}
      <AppHeader
        onRefresh={onRefresh}
        isConnectionManagerOpen={isConnectionManagerOpen}
        setIsConnectionManagerOpen={setIsConnectionManagerOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Database Sidebar with smooth width transition */}
        <div
          className={`shrink-0 h-full overflow-hidden transition-all duration-200 ease-in-out border-r border-border/80 ${
            isSidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 border-r-0 pointer-events-none'
          }`}
        >
          <div className="w-64 h-full">
            <AppSidebar
              onRefresh={onRefresh}
              onOpenConnectionManager={() => setIsConnectionManagerOpen(true)}
              onOpenLocalFileDialog={() => selectLocalFileDialog()}
            />
          </div>
        </div>

        {/* Floating Expand Sidebar Button when collapsed */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand Sidebar (⌘B)"
            className="absolute top-2.5 left-2.5 z-20 size-7 rounded-md bg-card/90 backdrop-blur-md border border-border/80 shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
          >
            <PanelLeftOpen className="size-3.5 text-primary" />
          </button>
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeWorkspaceView === 'playground' ? (
            <SqlPlayground />
          ) : activeWorkspaceView === 'diagram' ? (
            <DatabaseDiagramView onOpenConnectionManager={() => setIsConnectionManagerOpen(true)} />
          ) : workspaceMode === 'remote' && activeRemoteView === 'redis' ? (
            <RedisKeyViewer />
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <DataGrid
                onRefresh={onRefresh}
                onRequestPage={onRequestPage}
                onUpdateRow={onUpdateRow}
                onDeleteRow={onDeleteRow}
                onOpenConnectionManager={() => setIsConnectionManagerOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <AppStatusBar />

      {/* Staged Changes Action Bar */}
      <PendingChangesBar onCommitted={onRefresh} />
    </div>
  );
}
