import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Database, Key } from 'lucide-react';
import { CellRenderer } from './CellRenderer';
import { GridToolbar } from './GridToolbar';
import { RowDetailSheet } from './RowDetailSheet';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

interface DataGridProps {
  onRefresh?: () => void;
  onRequestPage?: (page: number) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataGrid({ onRefresh, onRequestPage }: DataGridProps) {
  const selectedTable = useDatabaseStore((s) => s.selectedTableName);
  const columns = useDatabaseStore((s) => s.columns);
  const rows = useDatabaseStore((s) => s.rows);
  const filterTerm = useDatabaseStore((s) => s.filterTerm);
  const selectedRow = useDatabaseStore((s) => s.selectedRow);
  const setSelectedRow = useDatabaseStore((s) => s.setSelectedRow);

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (colName: string) => {
    if (sortColumn !== colName) {
      setSortColumn(colName);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortColumn(null);
      setSortDir(null);
    }
  };

  // Filter and sort rows
  const displayRows = useMemo(() => {
    let result = [...rows];

    // Filter by search term
    if (filterTerm.trim()) {
      const query = filterTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(query);
          return String(val).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortColumn && sortDir) {
      result.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rows, filterTerm, sortColumn, sortDir]);

  if (!selectedTable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-background">
        <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
          <Database className="size-6" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">No Table Selected</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Select a table or box from the left sidebar to inspect rows in real-time.
        </p>
      </div>
    );
  }

  // Derive column list from payload or rows
  const tableColumns = useMemo(() => {
    if (columns.length > 0) return columns;
    if (rows.length > 0) {
      return Object.keys(rows[0]).map((key) => ({
        name: key,
        type: typeof rows[0][key],
        isPrimaryKey: key.toLowerCase() === 'id' || key.toLowerCase().endsWith('_id'),
        isNullable: true,
      }));
    }
    return [];
  }, [columns, rows]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
      <GridToolbar onRefresh={onRefresh} onRequestPage={onRequestPage} />

      <div className="flex-1 flex overflow-hidden">
        {/* Table Viewport */}
        <div className="flex-1 overflow-auto">
          {tableColumns.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <p>No rows or schema found in table &quot;{selectedTable}&quot;.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-mono select-text">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-xs z-10 border-b border-border shadow-xs">
                <tr>
                  <th className="w-12 px-3 py-2 text-muted-foreground/60 text-[10px] uppercase font-bold tracking-wider text-center border-r border-border/40 select-none">
                    #
                  </th>
                  {tableColumns.map((col) => {
                    const isSorted = sortColumn === col.name;
                    return (
                      <th
                        key={col.name}
                        onClick={() => handleSort(col.name)}
                        className="px-3 py-2 font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors border-r border-border/40 select-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {col.isPrimaryKey && <Key className="size-3 text-amber-400 shrink-0" />}
                            <span className="truncate text-foreground font-semibold">{col.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 shrink-0 font-normal">
                            <span className="uppercase text-[9px] text-muted-foreground/50">{col.type}</span>
                            {isSorted ? (
                              sortDir === 'asc' ? (
                                <ArrowUp className="size-3 text-primary" />
                              ) : (
                                <ArrowDown className="size-3 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="size-2.5 opacity-30 hover:opacity-100" />
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="p-8 text-center text-muted-foreground text-xs font-sans">
                      {filterTerm ? `No rows matching "${filterTerm}"` : 'Table is empty.'}
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, idx) => {
                    const isSelected = selectedRow === row;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedRow(isSelected ? null : row)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/20 text-foreground'
                            : idx % 2 === 0
                            ? 'bg-background hover:bg-muted/40'
                            : 'bg-card/25 hover:bg-muted/40'
                        }`}
                      >
                        <td className="px-3 py-1.5 text-center text-muted-foreground/40 text-[10px] border-r border-border/30 select-none">
                          {idx + 1}
                        </td>
                        {tableColumns.map((col) => (
                          <td key={col.name} className="px-3 py-1.5 border-r border-border/30 max-w-sm truncate">
                            <CellRenderer value={row[col.name]} columnType={col.type} />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Slide-out Row Inspector Drawer */}
        <RowDetailSheet row={selectedRow} onClose={() => setSelectedRow(null)} />
      </div>
    </div>
  );
}
