import { useRef } from 'react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { AppStatusBar } from './AppStatusBar';
import { DataGrid } from '@/features/datagrid/components/DataGrid';
import { LogStream } from '@/features/query-console/components/LogStream';
import { QueryEditor } from '@/features/query-console/components/QueryEditor';
import { SqlPlayground } from '@/features/playground/SqlPlayground';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
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
  onExecuteQuery,
  onUpdateRow,
  onDeleteRow,
}: SplitLayoutProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isConsoleOpen = useSettingsStore((s) => s.isConsoleOpen);
  const activeTab = useSettingsStore((s) => s.activeConsoleTab);
  const setActiveTab = useSettingsStore((s) => s.setActiveConsoleTab);
  const activeWorkspaceView = usePlaygroundStore((s) => s.activeWorkspaceView);

  useKeyboardShortcuts(
    () => searchInputRef.current?.focus(),
    onRefresh
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Top Header */}
      <AppHeader searchInputRef={searchInputRef} onRefresh={onRefresh} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Database Sidebar */}
        <AppSidebar onRefresh={onRefresh} />

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeWorkspaceView === 'playground' ? (
            <SqlPlayground />
          ) : (
            <>
              {/* Top Half: Real-time DataGrid */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <DataGrid
                  onRefresh={onRefresh}
                  onRequestPage={onRequestPage}
                  onUpdateRow={onUpdateRow}
                  onDeleteRow={onDeleteRow}
                />
              </div>


          {/* Bottom Half: Console / Mutation Stream */}
          {isConsoleOpen && (
            <div className="h-56 border-t border-border/80 flex flex-col bg-card/40 shrink-0 z-10 transition-all">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'mutations' | 'queries')}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="h-8 border-b border-border/60 px-3 flex items-center justify-between bg-card/60">
                  <TabsList className="h-6">
                    <TabsTrigger value="mutations" className="h-5 text-[11px] px-2.5">
                      Live Mutations
                    </TabsTrigger>
                    <TabsTrigger value="queries" className="h-5 text-[11px] px-2.5">
                      Query Console
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="mutations" className="flex-1 overflow-hidden flex flex-col">
                  <LogStream />
                </TabsContent>

                <TabsContent value="queries" className="flex-1 overflow-hidden flex flex-col">
                  <QueryEditor onExecuteQuery={onExecuteQuery} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </>
      )}
    </div>
  </div>

      {/* Bottom Status Bar */}
      <AppStatusBar />
    </div>
  );
}
