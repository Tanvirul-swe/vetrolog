import { useState } from 'react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { AppStatusBar } from './AppStatusBar';
import { DataGrid } from '@/features/datagrid/components/DataGrid';
import { SqlPlayground } from '@/features/playground/SqlPlayground';
import { RedisKeyViewer } from '@/features/redis/RedisKeyViewer';
import { PendingChangesBar } from '@/features/datagrid/components/PendingChangesBar';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left Database Sidebar */}
        <AppSidebar
          onRefresh={onRefresh}
          onOpenConnectionManager={() => setIsConnectionManagerOpen(true)}
          onOpenLocalFileDialog={() => selectLocalFileDialog()}
        />

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeWorkspaceView === 'playground' ? (
            <SqlPlayground />
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
