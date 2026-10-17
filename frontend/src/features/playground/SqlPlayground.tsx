import React, { useState, useEffect, useMemo } from 'react';
import {
  Table as TableIcon,
  Layers,
  Gauge,
  Sparkles,
  Code2,
  History,
  Download,
  CheckCircle2,
  AlertCircle,
  Play,
  Edit2,
  Check,
  Search as SearchIcon,
  X,
  ArrowUp,
  ArrowDown,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDuration, formatTimestamp } from '@/lib/formatters';
import { CellRenderer } from '@/features/datagrid/components/CellRenderer';
import { SqlEditor } from './components/SqlEditor';
import { NaturalLanguageBar } from './components/NaturalLanguageBar';
import { VisualQueryPlan } from './components/VisualQueryPlan';
import { PerformanceProfiler } from './components/PerformanceProfiler';
import { IndexAdvisor } from './components/IndexAdvisor';
import { DataExporterModal } from './components/DataExporterModal';
import { CodeGeneratorModal } from './components/CodeGeneratorModal';
import { DryRunModal } from './components/DryRunModal';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { usePlaygroundStore, PlaygroundTab } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

export function SqlPlayground() {
  const activeTab = usePlaygroundStore((s) => s.activeTab);
  const setActiveTab = usePlaygroundStore((s) => s.setActiveTab);
  const runExecute = usePlaygroundStore((s) => s.runExecute);
  const runExplain = usePlaygroundStore((s) => s.runExplain);
  const runDryRun = usePlaygroundStore((s) => s.runDryRun);
  const simulation = usePlaygroundStore((s) => s.simulation);
  const loadExtendedSchema = usePlaygroundStore((s) => s.loadExtendedSchema);
  const updateResultCell = usePlaygroundStore((s) => s.updateResultCell);
  const executionHistory = usePlaygroundStore((s) => s.executionHistory);
  const setQuery = usePlaygroundStore((s) => s.setQuery);

  const latestResult = useDatabaseStore((s) => s.latestQueryResult);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTable = useDatabaseStore((s) => s.selectedTableName);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCodeGenOpen, setIsCodeGenOpen] = useState(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);

  // Results search & sorting state
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Inline editing state: rowId + colName
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [justEditedCell, setJustEditedCell] = useState<string | null>(null);

  // Load schema metadata when database changes
  useEffect(() => {
    if (selectedDbId) {
      loadExtendedSchema();
    }
  }, [selectedDbId, loadExtendedSchema]);

  // When a simulation completes, open DryRunModal
  useEffect(() => {
    if (simulation) {
      setIsDryRunModalOpen(true);
    }
  }, [simulation]);

  const rows = latestResult?.rows || [];
  const colNames = useMemo<string[]>(() => {
    if (latestResult?.columns && latestResult.columns.length > 0) {
      return latestResult.columns.map((c: any) => (typeof c === 'string' ? c : c.name));
    }
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }, [latestResult, rows]);

  const isMutation = useMemo(() => {
    if (!latestResult) return false;
    const q = (latestResult.query || '').trim().toUpperCase();
    return /^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA)\b/i.test(q);
  }, [latestResult]);

  // Filtered and sorted rows for instantaneous client-side exploration
  const displayRows = useMemo(() => {
    let list = [...rows];
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter((r) =>
        colNames.some((c) => {
          const val = r[c];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }
    if (sortCol) {
      list.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return sortAsc ? 1 : -1;
        if (valB === null || valB === undefined) return sortAsc ? -1 : 1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [rows, filterText, sortCol, sortAsc, colNames]);

  // Determine Primary Key column
  const pkCol = colNames.find(
    (c) => c.toLowerCase() === 'id' || c.toLowerCase().endsWith('_id') || c.toLowerCase() === 'key'
  ) || colNames[0];

  const handleCellClick = (rowIndex: number, colName: string, currentVal: unknown) => {
    setEditingCell({ rowIndex, colName });
    setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
  };

  const handleCellSave = async () => {
    if (!editingCell || !displayRows) return;
    const { rowIndex, colName } = editingCell;
    const row = displayRows[rowIndex];
    if (!row || !pkCol) return;

    const pkVal = row[pkCol];
    const targetTable = selectedTable || 'users';

    let typedVal: any = editValue;
    if (editValue.toLowerCase() === 'null') typedVal = null;
    else if (!isNaN(Number(editValue)) && editValue.trim() !== '') typedVal = Number(editValue);
    else if (editValue.toLowerCase() === 'true') typedVal = 1;
    else if (editValue.toLowerCase() === 'false') typedVal = 0;

    const ok = await updateResultCell(targetTable, pkCol, pkVal, colName, typedVal);
    if (ok) {
      setJustEditedCell(`${rowIndex}_${colName}`);
      setTimeout(() => setJustEditedCell(null), 1500);
    }
    setEditingCell(null);
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortCol(null);
        setSortAsc(true);
      }
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Top Deck: Natural Language + SQL Code Editor */}
      <NaturalLanguageBar />
      <SqlEditor
        onRunExecute={(sql) => runExecute(sql)}
        onRunDryRun={(sql) => runDryRun(sql)}
        onRunExplain={(sql) => {
          runExplain(sql);
          setActiveTab('plan');
        }}
      />

      {/* Bottom Deck: Intelligence & Results Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card/20">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as PlaygroundTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Deck Navigation Bar */}
          <div className="h-9 border-b border-border/70 px-3 flex items-center justify-between bg-card/60 backdrop-blur-xs shrink-0 select-none">
            <TabsList className="h-7 bg-muted/40 p-0.5">
              <TabsTrigger value="results" className="h-6 text-[11px] px-2.5 gap-1.5">
                <TableIcon className="size-3 text-sky-400" />
                <span>Results</span>
                {rows.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                    {rows.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="plan" className="h-6 text-[11px] px-2.5 gap-1.5">
                <Layers className="size-3 text-emerald-400" />
                <span>Visual Query Plan</span>
              </TabsTrigger>

              <TabsTrigger value="profiler" className="h-6 text-[11px] px-2.5 gap-1.5">
                <Gauge className="size-3 text-amber-400" />
                <span>Profiler & FPS</span>
              </TabsTrigger>

              <TabsTrigger value="advisor" className="h-6 text-[11px] px-2.5 gap-1.5">
                <Sparkles className="size-3 text-primary" />
                <span>Index Advisor</span>
              </TabsTrigger>

              <TabsTrigger value="history" className="h-6 text-[11px] px-2.5 gap-1.5">
                <History className="size-3 text-muted-foreground" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>

            {/* Quick Actions (Export & CodeGen) */}
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                disabled={rows.length === 0}
                onClick={() => setIsExportOpen(true)}
                className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                title="Export results to JSON, CSV, SQL, Markdown"
              >
                <Download className="size-3" />
                <span>Export</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCodeGenOpen(true)}
                className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                title="Generate Flutter, Room, GRDB, Go query code"
              >
                <Code2 className="size-3" />
                <span>Code Gen</span>
              </Button>
            </div>
          </div>

          {/* Tab 1: Tabular Results Grid with Sorting, Quick Filter, and Cell Editing */}
          <TabsContent value="results" className="flex-1 overflow-hidden flex flex-col m-0 p-0">
            {latestResult ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Meta Summary Ribbon */}
                <div className="h-8 border-b border-border/40 px-3 flex items-center justify-between bg-card/40 text-[11px] font-mono select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    {latestResult.success ? (
                      <Badge variant="success" className="text-[9px] px-1 py-0 shrink-0">
                        SUCCESS
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                        ERROR
                      </Badge>
                    )}
                    <span className="text-muted-foreground truncate max-w-xs sm:max-w-md md:max-w-lg">
                      {latestResult.query}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                    {/* Quick Search within Results */}
                    {rows.length > 0 && (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={filterText}
                          onChange={(e) => setFilterText(e.target.value)}
                          placeholder="Filter rows..."
                          className="h-5.5 w-28 focus:w-44 transition-all px-2 pl-6 bg-muted/40 border border-border/50 rounded text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none"
                        />
                        <SearchIcon className="size-3 absolute left-1.5 text-muted-foreground pointer-events-none" />
                        {filterText && (
                          <button
                            type="button"
                            onClick={() => setFilterText('')}
                            className="absolute right-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-2.5" />
                          </button>
                        )}
                      </div>
                    )}

                    <span>
                      {filterText ? `${displayRows.length} / ${rows.length} rows` : `${rows.length} rows`}
                    </span>
                    {latestResult.affected > 0 && (
                      <span className="text-amber-400 font-medium">
                        {latestResult.affected} affected
                      </span>
                    )}
                    <span>in {formatDuration(latestResult.durationMs)}</span>
                  </div>
                </div>

                {/* Error Banner */}
                {latestResult.error && (
                  <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-red-400 text-xs flex items-center gap-2 font-mono">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{latestResult.error}</span>
                  </div>
                )}

                {/* Mutation Feedback Card */}
                {latestResult.success && (isMutation || latestResult.affected > 0) && (
                  <div className="m-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold text-emerald-300">
                        {latestResult.affected > 0
                          ? `Mutation applied: ${latestResult.affected} row${latestResult.affected > 1 ? 's' : ''} affected`
                          : 'Statement executed successfully'}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        Operation committed to device database in {formatDuration(latestResult.durationMs)}.
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Grid with Sortable Columns */}
                {colNames.length > 0 ? (
                  <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse text-left text-xs font-mono">
                      <thead className="sticky top-0 bg-card/95 backdrop-blur-xs border-b border-border z-10 select-none">
                        <tr>
                          <th className="px-3 py-1.5 w-12 text-muted-foreground font-semibold border-r border-border/30 text-center">
                            #
                          </th>
                          {colNames.map((col) => (
                            <th
                              key={col}
                              onClick={() => handleSort(col)}
                              className="px-3 py-1.5 text-muted-foreground hover:text-foreground font-semibold border-r border-border/30 whitespace-nowrap cursor-pointer hover:bg-muted/30 transition-colors"
                              title="Click to sort by this column"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{col}</span>
                                {col === pkCol && (
                                  <Badge
                                    variant="outline"
                                    className="text-[8px] font-sans px-1 py-0 text-amber-400 border-amber-500/30"
                                  >
                                    PK
                                  </Badge>
                                )}
                                {sortCol === col && (
                                  sortAsc ? (
                                    <ArrowUp className="size-2.5 text-primary" />
                                  ) : (
                                    <ArrowDown className="size-2.5 text-primary" />
                                  )
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {displayRows.length > 0 ? (
                          displayRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-muted/30 group">
                              <td className="px-3 py-1.5 text-muted-foreground/60 text-center border-r border-border/20 select-none">
                                {rIdx + 1}
                              </td>
                              {colNames.map((col) => {
                                const cellKey = `${rIdx}_${col}`;
                                const isEditing =
                                  editingCell?.rowIndex === rIdx && editingCell?.colName === col;
                                const isJustEdited = justEditedCell === cellKey;

                                return (
                                  <td
                                    key={col}
                                    onDoubleClick={() => handleCellClick(rIdx, col, row[col])}
                                    className={`px-3 py-1.5 border-r border-border/20 max-w-xs truncate transition-colors ${
                                      isJustEdited ? 'bg-emerald-500/20' : ''
                                    }`}
                                    title="Double click to edit cell"
                                  >
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          autoFocus
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCellSave();
                                            if (e.key === 'Escape') setEditingCell(null);
                                          }}
                                          onBlur={handleCellSave}
                                          className="h-6 w-full px-1.5 bg-background border border-primary text-foreground rounded text-xs font-mono outline-none"
                                        />
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          onClick={handleCellSave}
                                          className="size-5 shrink-0 text-emerald-400"
                                        >
                                          <Check className="size-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between group/cell">
                                        <CellRenderer value={row[col]} />
                                        <button
                                          type="button"
                                          onClick={() => handleCellClick(rIdx, col, row[col])}
                                          className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity"
                                        >
                                          <Edit2 className="size-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={colNames.length + 1}
                              className="py-12 text-center text-xs text-muted-foreground font-mono"
                            >
                              {filterText ? 'No rows match filter criteria.' : 'Query returned 0 rows.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : !isMutation ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground font-mono">
                    Query completed successfully with 0 rows returned.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-muted-foreground text-xs">
                <Play className="size-8 text-muted-foreground/30 mb-2" />
                <p className="font-medium text-foreground">Playground Ready</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                  Compose your query or prompt above and click <strong>Execute (⌘Enter)</strong> or <strong>Dry Run</strong> to inspect live device results.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Visual Query Plan */}
          <TabsContent value="plan" className="flex-1 overflow-hidden flex flex-col m-0 p-0">
            <VisualQueryPlan />
          </TabsContent>

          {/* Tab 3: Performance Profiler & FPS Gauge */}
          <TabsContent value="profiler" className="flex-1 overflow-hidden flex flex-col m-0 p-0">
            <PerformanceProfiler />
          </TabsContent>

          {/* Tab 4: Smart Index Advisor */}
          <TabsContent value="advisor" className="flex-1 overflow-hidden flex flex-col m-0 p-0">
            <IndexAdvisor />
          </TabsContent>

          {/* Tab 5: History */}
          <TabsContent value="history" className="flex-1 overflow-auto p-3 m-0">
            {executionHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No queries executed yet in this session.</div>
            ) : (
              <div className="divide-y divide-border/20 font-mono text-xs max-w-4xl mx-auto">
                {executionHistory.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.success ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-muted-foreground">{formatTimestamp(item.timestamp)}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {formatDuration(item.durationMs)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{item.rowsCount} rows</span>
                        </div>
                        <p className="text-foreground text-xs truncate max-w-2xl">{item.query}</p>
                        {item.error && <p className="text-red-400 text-[11px] mt-0.5">{item.error}</p>}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setQuery(item.query);
                        runExecute(item.query);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-6 text-[10px] gap-1 px-2 shrink-0"
                    >
                      <Play className="size-2.5" />
                      <span>Run</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals & Dialogs */}
      <DataExporterModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        rows={rows}
        tableName={selectedTable || 'vetrolog_results'}
      />

      <CodeGeneratorModal isOpen={isCodeGenOpen} onClose={() => setIsCodeGenOpen(false)} />

      <DryRunModal
        isOpen={isDryRunModalOpen}
        onClose={() => setIsDryRunModalOpen(false)}
        simulation={simulation}
        onCommit={() => runExecute()}
      />

      <AiSettingsDialog />
    </div>
  );
}
