import { Download, ChevronLeft, ChevronRight, RefreshCw, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

interface GridToolbarProps {
  onRefresh?: () => void;
  onRequestPage?: (page: number) => void;
}

export function GridToolbar({ onRefresh, onRequestPage }: GridToolbarProps) {
  const selectedTable = useDatabaseStore((s) => s.selectedTableName);
  const totalRows = useDatabaseStore((s) => s.totalRows);
  const rows = useDatabaseStore((s) => s.rows);
  const page = useDatabaseStore((s) => s.page);
  const pageSize = useDatabaseStore((s) => s.pageSize);
  const isLoading = useDatabaseStore((s) => s.isLoadingTable);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const exportToJson = () => {
    if (rows.length === 0) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable || 'vetrolog_export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedTable) return null;

  return (
    <div className="h-10 border-b border-border/80 bg-card/40 px-3 flex items-center justify-between select-none shrink-0 z-10">
      {/* Left Table Badge & Info */}
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-primary" />
        <span className="font-semibold text-xs text-foreground">{selectedTable}</span>
        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
          {totalRows.toLocaleString()} rows
        </Badge>
        {isLoading && <span className="text-[11px] text-muted-foreground animate-pulse">Syncing...</span>}
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
          onClick={exportToJson}
          disabled={rows.length === 0}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          title="Export current page as JSON"
        >
          <Download className="size-3" />
          <span>Export</span>
        </Button>

        {/* Pagination */}
        <div className="flex items-center gap-1 border-l border-border/60 pl-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRequestPage?.(Math.max(1, page - 1))}
            disabled={page <= 1 || isLoading}
            className="h-7 w-7"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="font-mono text-[11px] px-1">
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onRequestPage?.(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="h-7 w-7"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
