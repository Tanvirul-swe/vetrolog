import React from 'react';
import { ShieldCheck, AlertTriangle, Play, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimulationResult } from '@/types/database';
import { formatDuration } from '@/lib/formatters';
import { CellRenderer } from '@/features/datagrid/components/CellRenderer';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface DryRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: SimulationResult | null;
  onCommit: () => void;
}

export function DryRunModal({ isOpen, onClose, simulation, onCommit }: DryRunModalProps) {
  const isRemote = useConnectionManagerStore((s) => s.workspaceMode === 'remote');

  if (!isOpen || !simulation) return null;

  const isDestructive =
    simulation.isMutation &&
    (simulation.query.toUpperCase().includes('DELETE') ||
      simulation.query.toUpperCase().includes('DROP') ||
      simulation.query.toUpperCase().includes('UPDATE'));

  const noWhereClause =
    isDestructive &&
    !simulation.query.toUpperCase().includes('WHERE') &&
    (simulation.query.toUpperCase().startsWith('UPDATE') ||
      simulation.query.toUpperCase().startsWith('DELETE'));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-3xl bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber-500 dark:text-amber-400" />
            <h3 className="font-semibold text-sm text-foreground">Safe Dry-Run Transaction Simulation</h3>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-700 dark:text-amber-400">
              0 Disk Writes
            </Badge>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Safety Information Banner */}
        <div className="p-3 border-b border-border/60 bg-amber-500/5 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <ShieldCheck className="size-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>Sandbox Rollback Simulation Complete</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            This statement was executed inside an isolated transaction sandbox. Changes were inspected and immediately rolled back. {isRemote ? 'Your remote database' : 'Your mobile device database'} remains untouched.
          </p>

          {noWhereClause && (
            <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 mt-1">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>CRITICAL WARNING:</strong> No WHERE clause detected. Executing this will modify or delete <strong>ALL {simulation.affectedRows} rows</strong> in the table!
              </span>
            </div>
          )}
        </div>

        {/* Query Summary & Metrics */}
        <div className="p-3 border-b border-border/40 bg-card/40 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Affected Rows:</span>
            <span className="font-bold text-foreground text-sm">{simulation.affectedRows}</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>Simulation time: {formatDuration(simulation.durationMs)}</span>
          </div>
        </div>

        {/* Preview of Affected Rows */}
        <div className="flex-1 overflow-auto p-3">
          {simulation.previewRows && simulation.previewRows.length > 0 ? (
            <div className="border border-border/60 rounded-lg overflow-hidden font-mono text-xs">
              <div className="px-3 py-1.5 bg-muted/40 border-b border-border text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Eye className="size-3" />
                <span>Preview of Affected Records (First {simulation.previewRows.length} rows)</span>
              </div>
              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-card/90 sticky top-0 border-b border-border">
                    <tr>
                      {Object.keys(simulation.previewRows[0]).map((col) => (
                        <th key={col} className="px-3 py-1.5 text-muted-foreground font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {simulation.previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        {Object.keys(simulation.previewRows![0]).map((col) => (
                          <td key={col} className="px-3 py-1.5 border-r border-border/20 max-w-xs truncate">
                            <CellRenderer value={row[col]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {simulation.affectedRows === 0
                ? 'Simulation executed successfully. 0 rows match the given filter criteria.'
                : 'Schema alteration or non-tabular mutation simulated successfully.'}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-3 border-t border-border flex items-center justify-between bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onClose();
              onCommit();
            }}
            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
          >
            <Play className="size-3 fill-white" />
            <span>{isRemote ? 'Commit & Apply to Remote DB' : 'Commit & Apply to Device'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
