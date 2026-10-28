import { useState } from 'react';
import { Download, ChevronLeft, ChevronRight, RefreshCw, Layers, Table as TableIcon, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useAdbStore } from '@/stores/useAdbStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { DataExporterModal } from '@/features/playground/components/DataExporterModal';
import { cn } from '@/lib/utils';

interface GridToolbarProps {
  onRefresh?: () => void;
  onRequestPage?: (page: number) => void;
}

export function GridToolbar({ onRefresh, onRequestPage }: GridToolbarProps) {
  const mobileSelectedTable = useDatabaseStore((s) => s.selectedTableName);
  const remoteSelectedTable = useConnectionManagerStore((s) => s.selectedTable);
  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const selectedTable = workspaceMode === 'remote' ? (remoteSelectedTable || mobileSelectedTable) : mobileSelectedTable;

  const dbTotalRows = useDatabaseStore((s) => s.totalRows);
  const remoteTableData = useConnectionManagerStore((s) => s.tableData);
  const totalRows = workspaceMode === 'remote' && remoteTableData?.totalRows !== undefined
    ? remoteTableData.totalRows
    : dbTotalRows;

  const rows = useDatabaseStore((s) => s.rows);

  const dbPage = useDatabaseStore((s) => s.page);
  const page = workspaceMode === 'remote' && remoteTableData?.page !== undefined
    ? remoteTableData.page
    : dbPage;

  const dbPageSize = useDatabaseStore((s) => s.pageSize);
  const pageSize = (workspaceMode === 'remote' && remoteTableData?.pageSize)
    ? remoteTableData.pageSize
    : (dbPageSize || 50);

  const isDbLoading = useDatabaseStore((s) => s.isLoadingTable);
  const isRemoteLoading = useConnectionManagerStore((s) => s.isLoadingTable);
  const isLoading = workspaceMode === 'remote' ? isRemoteLoading : isDbLoading;

  const isLiveSync = useAdbStore((s) => s.isLiveSync);
  const toggleLiveSync = useAdbStore((s) => s.toggleLiveSync);

  const activeRemoteView = useConnectionManagerStore((s) => s.activeRemoteView);
  const setActiveRemoteView = useConnectionManagerStore((s) => s.setActiveRemoteView);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  if (!selectedTable) return null;

  return (
    <div className="h-10 border-b border-border/80 bg-card/40 px-3 flex items-center justify-between select-none shrink-0 z-10">
      {/* Left Table Badge, Structure Toggle & Realtime Toggle */}
      <div className="flex items-center gap-2.5">
        <Layers className="size-4 text-primary" />
        <span className="font-semibold text-xs text-foreground">{selectedTable}</span>
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
          {totalRows.toLocaleString()} rows
        </Badge>

        {/* Remote Mode: Data Grid vs Structure View Tabs */}
        {workspaceMode === 'remote' && (
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/60 p-0.5 ml-2 gap-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveRemoteView('data')}
              className={cn(
                'h-6 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98]',
                activeRemoteView === 'data'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent'
              )}
            >
              <TableIcon className={`size-3 ${activeRemoteView === 'data' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Data</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRemoteView('structure')}
              className={cn(
                'h-6 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98]',
                activeRemoteView === 'structure'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent'
              )}
            >
              <Columns className={`size-3 ${activeRemoteView === 'structure' ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <span>Structure</span>
            </button>
          </div>
        )}

        {/* Real-time Live Updates Toggle Button (in Mobile Mode) */}
        {workspaceMode === 'mobile' && (
          <button
            type="button"
            onClick={toggleLiveSync}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer border shadow-2xs',
              isLiveSync
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-muted/50 text-muted-foreground border-border/80 hover:text-foreground'
            )}
            title={
              isLiveSync
                ? 'Live continuous WAL sync is active'
                : 'Click to enable real-time continuous WAL streaming'
            }
          >
            <span
              className={cn(
                'size-2 rounded-full',
                isLiveSync ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'
              )}
            />
            <span>{isLiveSync ? 'Live Sync' : 'Static Snapshot'}</span>
          </button>
        )}
        {isLoading && <span className="text-[11px] text-muted-foreground animate-pulse ml-2">Syncing...</span>}
      </div>

      {/* Right Controls: Pagination & Export */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground h-7 w-7"
            title="Refresh table"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExportModalOpen(true)}
          disabled={rows.length === 0}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          title="Export table data (JSON, CSV, SQL, Markdown)"
        >
          <Download className="size-3" />
          <span>Export</span>
        </Button>

        {/* Pagination (visible on Data tab) */}
        {activeRemoteView !== 'structure' && (
          <div className="flex items-center gap-1 border-l border-border/60 pl-2 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRequestPage?.(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoading}
              className="h-7 w-7"
              title="Previous Page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="font-mono text-[11px] px-1 select-none">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRequestPage?.(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="h-7 w-7"
              title="Next Page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Data Exporter Modal */}
      {isExportModalOpen && (
        <DataExporterModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          rows={rows}
          tableName={selectedTable || 'table_export'}
        />
      )}
    </div>
  );
}
