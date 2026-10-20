import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Table as TableIcon,
  Layers,
  Gauge,
  Sparkles,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDuration } from '@/lib/formatters';
import { CellRenderer } from '@/features/datagrid/components/CellRenderer';
import { SqlEditor } from './components/SqlEditor';
import { NaturalLanguageBar } from './components/NaturalLanguageBar';
import { QueryTabStrip } from './components/QueryTabStrip';
import { VisualQueryPlan } from './components/VisualQueryPlan';
import { PerformanceProfiler } from './components/PerformanceProfiler';
import { IndexAdvisor } from './components/IndexAdvisor';
import { DataExporterModal } from './components/DataExporterModal';
import { DryRunModal } from './components/DryRunModal';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { usePlaygroundStore, PlaygroundTab } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

// Feature flags: Visual Plan and Index Advisor temporarily hidden per user request
const SHOW_VISUAL_PLAN = false;
const SHOW_INDEX_ADVISOR = false;

export function SqlPlayground() {
  const activeTab = usePlaygroundStore((s) => s.activeTab);
  const setActiveTab = usePlaygroundStore((s) => s.setActiveTab);
  const runExecute = usePlaygroundStore((s) => s.runExecute);
  const runExplain = usePlaygroundStore((s) => s.runExplain);
  const runDryRun = usePlaygroundStore((s) => s.runDryRun);
  const simulation = usePlaygroundStore((s) => s.simulation);
  const loadExtendedSchema = usePlaygroundStore((s) => s.loadExtendedSchema);
  const updateResultCell = usePlaygroundStore((s) => s.updateResultCell);
  const setQuery = usePlaygroundStore((s) => s.setQuery);

  const tabs = usePlaygroundStore((s) => s.tabs);
  const activeTabId = usePlaygroundStore((s) => s.activeTabId);
  const addTab = usePlaygroundStore((s) => s.addTab);
  const closeTab = usePlaygroundStore((s) => s.closeTab);
  const setActiveTabId = usePlaygroundStore((s) => s.setActiveTabId);
  const updateActiveTabState = usePlaygroundStore((s) => s.updateActiveTabState);

  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectedTable = useDatabaseStore((s) => s.selectedTableName);

  // Fallback to 'results' if current active tab is one of the hidden tabs
  useEffect(() => {
    if ((!SHOW_VISUAL_PLAN && activeTab === 'plan') || (!SHOW_INDEX_ADVISOR && activeTab === 'advisor')) {
      setActiveTab('results');
    }
  }, [activeTab, setActiveTab]);

  const activeQueryTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  // Tab-isolated query result (null if active tab has not run yet)
  const currentResult = activeQueryTab?.result || null;

  // Height adjustable layout state
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number>(() => {
    const saved = localStorage.getItem('vetrolog_playground_editor_height');
    return saved ? Math.max(180, Math.min(800, Number(saved))) : 260;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Keep editorHeight within safe bounds on window/container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerH = containerRef.current.clientHeight;
        if (containerH > 320) {
          const maxAllowed = Math.max(180, containerH - 160);
          setEditorHeight((current) => Math.min(current, maxAllowed));
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);

  // Per-tab filter & sort state
  const filterText = activeQueryTab?.filterText || '';
  const setFilterText = (text: string) => {
    updateActiveTabState({ filterText: text, currentPage: 1 });
  };

  const sortCol = activeQueryTab?.sortCol ?? null;
  const sortAsc = activeQueryTab?.sortAsc ?? true;

  const pageSize = activeQueryTab?.pageSize || 50;
  const setPageSize = useCallback((sz: number) => {
    updateActiveTabState({ pageSize: sz, currentPage: 1 });
  }, [updateActiveTabState]);

  const currentPage = activeQueryTab?.currentPage || 1;
  const setCurrentPage = useCallback((pageOrFn: number | ((prev: number) => number)) => {
    const currentTab = usePlaygroundStore.getState().tabs.find(
      (t) => t.id === usePlaygroundStore.getState().activeTabId
    );
    const prevPage = currentTab?.currentPage || 1;
    const nextVal = typeof pageOrFn === 'function' ? pageOrFn(prevPage) : pageOrFn;
    updateActiveTabState({ currentPage: nextVal });
  }, [updateActiveTabState]);

  // Inline editing state: rowId + colName
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [justEditedCell, setJustEditedCell] = useState<string | null>(null);

  // Global Keyboard Shortcuts (⌘T, ⌘W, Ctrl+Tab, ⌘1-9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // ⌘T or Ctrl+T -> New Query Tab
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        addTab();
        return;
      }

      // ⌘W or Ctrl+W -> Close Active Tab
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        closeTab(activeTabId);
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab -> Cycle tabs
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIdx = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIdx !== -1) {
          const nextIdx = e.shiftKey
            ? (currentIdx - 1 + tabs.length) % tabs.length
            : (currentIdx + 1) % tabs.length;
          setActiveTabId(tabs[nextIdx].id);
        }
        return;
      }

      // ⌘1 - ⌘9 -> Jump to tab index (when not typing inside inputs)
      if ((e.metaKey || e.ctrlKey) && !isInput && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const targetTab = tabs[num - 1];
          if (targetTab) {
            e.preventDefault();
            setActiveTabId(targetTab.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, addTab, closeTab, setActiveTabId]);

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

  const rows = useMemo(() => currentResult?.rows || [], [currentResult?.rows]);
  const colNames = useMemo<string[]>(() => {
    if (currentResult?.columns && currentResult.columns.length > 0) {
      return currentResult.columns.map((c: any) => (typeof c === 'string' ? c : c.name));
    }
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }, [currentResult, rows]);

  const isMutation = useMemo(() => {
    if (!currentResult) return false;
    const q = (currentResult.query || '').trim().toUpperCase();
    return /^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA)\b/i.test(q);
  }, [currentResult]);

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

  // Total pages calculation
  const totalPages = useMemo(() => {
    if (pageSize === -1) return 1;
    return Math.max(1, Math.ceil(displayRows.length / pageSize));
  }, [displayRows.length, pageSize]);

  // Adjust page if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  // Paginated rows slice for DOM rendering
  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return displayRows;
    const startIdx = (currentPage - 1) * pageSize;
    return displayRows.slice(startIdx, startIdx + pageSize);
  }, [displayRows, currentPage, pageSize]);

  // Determine Primary Key column
  const pkCol = colNames.find(
    (c) => c.toLowerCase() === 'id' || c.toLowerCase().endsWith('_id') || c.toLowerCase() === 'key'
  ) || colNames[0];

  const handleCellClick = (globalRowIndex: number, colName: string, currentVal: unknown) => {
    setEditingCell({ rowIndex: globalRowIndex, colName });
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
        updateActiveTabState({ sortAsc: false });
      } else {
        updateActiveTabState({ sortCol: null, sortAsc: true });
      }
    } else {
      updateActiveTabState({ sortCol: col, sortAsc: true });
    }
  };

  // Drag resizer mouse handlers
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = editorHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const containerHeight = containerRef.current?.clientHeight || 800;
      const maxAllowed = Math.max(200, containerHeight - 160);
      const newHeight = Math.max(180, Math.min(maxAllowed, startHeight + deltaY));
      setEditorHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setEditorHeight((current) => {
        localStorage.setItem('vetrolog_playground_editor_height', String(current));
        return current;
      });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden bg-background text-foreground select-none relative">
      {/* Top Deck: Query Tabs + Natural Language + SQL Code Editor */}
      <div
        style={{ height: editorHeight }}
        className="flex flex-col shrink-0 overflow-hidden min-h-[180px] max-h-[calc(100%-140px)]"
      >
        <QueryTabStrip />
        <NaturalLanguageBar />
        <SqlEditor
          onRunExecute={(sql) => runExecute(sql)}
          onRunDryRun={(sql) => runDryRun(sql)}
          onRunExplain={(sql) => {
            runExplain(sql);
            if (SHOW_VISUAL_PLAN) {
              setActiveTab('plan');
            }
          }}
        />
      </div>

      {/* Resizable Divider Splitter Handle */}
      <div
        onMouseDown={handleSplitterMouseDown}
        className={`h-2 -my-1 z-20 cursor-row-resize flex items-center justify-center transition-colors group select-none ${
          isResizing ? 'bg-primary/20' : 'hover:bg-primary/10'
        }`}
        title="Drag up or down to resize query editor and results"
      >
        <div
          className={`h-[2px] w-full transition-colors flex items-center justify-center ${
            isResizing ? 'bg-primary' : 'bg-border/60 group-hover:bg-primary/70'
          }`}
        >
          <div
            className={`h-1.5 w-12 rounded-full flex items-center justify-center transition-colors ${
              isResizing ? 'bg-primary' : 'bg-muted-foreground/40 group-hover:bg-primary/70'
            }`}
          >
            <GripHorizontal className="size-3 text-background opacity-80" />
          </div>
        </div>
      </div>

      {/* Bottom Deck: Intelligence & Results Tabs */}
      <div className="flex-1 min-h-[140px] flex flex-col overflow-hidden bg-card/20">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as PlaygroundTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Deck Navigation Bar */}
          <div className="h-9 border-b border-border/70 px-3 flex items-center justify-between gap-2 bg-card/60 backdrop-blur-xs shrink-0 select-none">
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
              <TabsList className="h-7 bg-muted/40 p-0.5 inline-flex flex-nowrap">
                <TabsTrigger value="results" className="h-6 text-[11px] px-2.5 gap-1.5 shrink-0">
                  <TableIcon className="size-3 text-sky-400" />
                  <span>Results</span>
                  {rows.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {rows.length}
                    </Badge>
                  )}
                </TabsTrigger>

                {SHOW_VISUAL_PLAN && (
                  <TabsTrigger value="plan" className="h-6 text-[11px] px-2.5 gap-1.5 shrink-0">
                    <Layers className="size-3 text-emerald-400" />
                    <span><span className="hidden sm:inline">Visual </span>Plan</span>
                  </TabsTrigger>
                )}

                <TabsTrigger value="profiler" className="h-6 text-[11px] px-2.5 gap-1.5 shrink-0">
                  <Gauge className="size-3 text-amber-400" />
                  <span>Profiler<span className="hidden md:inline"> & FPS</span></span>
                </TabsTrigger>

                {SHOW_INDEX_ADVISOR && (
                  <TabsTrigger value="advisor" className="h-6 text-[11px] px-2.5 gap-1.5 shrink-0">
                    <Sparkles className="size-3 text-primary" />
                    <span><span className="hidden sm:inline">Index </span>Advisor</span>
                  </TabsTrigger>
                )}

                <TabsTrigger value="history" className="h-6 text-[11px] px-2.5 gap-1.5 shrink-0">
                  <History className="size-3 text-muted-foreground" />
                  <span>History</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Quick Actions (Export) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                disabled={rows.length === 0}
                onClick={() => setIsExportOpen(true)}
                className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground shrink-0 border border-transparent hover:border-border/40"
                title="Export results to JSON, CSV, SQL, Markdown"
              >
                <Download className="size-3 text-sky-400" />
                <span>Export</span>
              </Button>
            </div>
          </div>

          {/* Tab 1: Tabular Results Grid with Sorting, Quick Filter, Pagination, and Cell Editing */}
          <TabsContent value="results" className="flex-1 min-h-0 overflow-hidden flex flex-col m-0 p-0">
            {currentResult ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Meta Summary Ribbon */}
                <div className="h-8 border-b border-border/40 px-3 flex items-center justify-between bg-card/40 text-[11px] font-mono select-none shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {currentResult.success ? (
                      <Badge variant="success" className="text-[9px] px-1 py-0 shrink-0">
                        SUCCESS
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                        ERROR
                      </Badge>
                    )}

                    {currentResult.defaultLimitApplied && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] shrink-0 font-sans">
                        <span>⚡ 100 rows default limit</span>
                        <button
                          type="button"
                          onClick={() => {
                            const cleanQuery = currentResult.query.trim().replace(/;$/, '');
                            const unlimitedQuery = `${cleanQuery} LIMIT 10000;`;
                            setQuery(unlimitedQuery);
                            runExecute(unlimitedQuery);
                          }}
                          className="underline hover:text-amber-300 font-semibold cursor-pointer ml-1"
                          title="Run query with higher limit"
                        >
                          Fetch 10k
                        </button>
                      </div>
                    )}

                    <span className="text-muted-foreground truncate max-w-xs sm:max-w-md md:max-w-lg">
                      {currentResult.query}
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
                    {currentResult.affected > 0 && (
                      <span className="text-amber-400 font-medium">
                        {currentResult.affected} affected
                      </span>
                    )}
                    <span>in {formatDuration(currentResult.durationMs)}</span>
                  </div>
                </div>

                {/* Error Banner */}
                {currentResult.error && (
                  <div className="p-3 bg-destructive/10 border-b border-destructive/20 text-red-400 text-xs flex items-center gap-2 font-mono shrink-0">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{currentResult.error}</span>
                  </div>
                )}

                {/* Data Grid with Sortable Columns */}
                {colNames.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-auto">
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
                        {paginatedRows.length > 0 ? (
                          paginatedRows.map((row, pIdx) => {
                            const globalRowIdx = pageSize === -1 ? pIdx : (currentPage - 1) * pageSize + pIdx;
                            return (
                              <tr key={globalRowIdx} className="hover:bg-muted/30 group">
                                <td className="px-3 py-1.5 text-muted-foreground/60 text-center border-r border-border/20 select-none">
                                  {globalRowIdx + 1}
                                </td>
                                {colNames.map((col) => {
                                  const cellKey = `${globalRowIdx}_${col}`;
                                  const isEditing =
                                    editingCell?.rowIndex === globalRowIdx && editingCell?.colName === col;
                                  const isJustEdited = justEditedCell === cellKey;

                                  return (
                                    <td
                                      key={col}
                                      onDoubleClick={() => handleCellClick(globalRowIdx, col, row[col])}
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
                                            onClick={() => handleCellClick(globalRowIdx, col, row[col])}
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
                            );
                          })
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

                {/* Pagination Toolbar */}
                {colNames.length > 0 && rows.length > 0 && (
                  <div className="h-9 border-t border-border/50 px-3 flex items-center justify-between bg-card/40 text-[11px] font-mono select-none shrink-0">
                    {/* Left: Row counter */}
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <span>
                        Showing{' '}
                        <strong className="text-foreground">
                          {displayRows.length === 0
                            ? '0'
                            : `${(currentPage - 1) * (pageSize === -1 ? displayRows.length : pageSize) + 1}–${Math.min(
                                currentPage * (pageSize === -1 ? displayRows.length : pageSize),
                                displayRows.length
                              )}`}
                        </strong>{' '}
                        of <strong className="text-foreground">{displayRows.length}</strong>{' '}
                        {filterText ? `filtered rows (from ${rows.length})` : 'rows'}
                      </span>
                    </div>

                    {/* Center: Page controls */}
                    {pageSize !== -1 && totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage(1)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="First page"
                        >
                          <ChevronsLeft className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Previous page"
                        >
                          <ChevronLeft className="size-3.5" />
                        </Button>

                        <span className="px-2 text-xs text-muted-foreground font-sans">
                          Page <strong className="text-foreground">{currentPage}</strong> of{' '}
                          <strong className="text-foreground">{totalPages}</strong>
                        </span>

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Next page"
                        >
                          <ChevronRight className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Last page"
                        >
                          <ChevronsRight className="size-3.5" />
                        </Button>
                      </div>
                    )}

                    {/* Right: Rows per page selector */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-[10px]">Per page:</span>
                      <div className="flex items-center rounded border border-border/50 bg-muted/30 p-0.5">
                        {[25, 50, 100, -1].map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => {
                              setPageSize(sz);
                              setCurrentPage(1);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                              pageSize === sz
                                ? 'bg-primary text-primary-foreground font-bold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {sz === -1 ? 'All' : sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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

          {/* Tab 2: Visual Query Plan (hidden for now) */}
          {SHOW_VISUAL_PLAN && (
            <TabsContent value="plan" className="flex-1 min-h-0 overflow-hidden flex flex-col m-0 p-0">
              <VisualQueryPlan />
            </TabsContent>
          )}

          {/* Tab 3: Performance Profiler & FPS Gauge */}
          <TabsContent value="profiler" className="flex-1 min-h-0 overflow-hidden flex flex-col m-0 p-0">
            <PerformanceProfiler />
          </TabsContent>

          {/* Tab 4: Smart Index Advisor (hidden for now) */}
          {SHOW_INDEX_ADVISOR && (
            <TabsContent value="advisor" className="flex-1 min-h-0 overflow-hidden flex flex-col m-0 p-0">
              <IndexAdvisor />
            </TabsContent>
          )}

          {/* Tab 5: Execution History */}
          <TabsContent value="history" className="flex-1 min-h-0 overflow-hidden flex flex-col m-0 p-0">
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {usePlaygroundStore.getState().executionHistory.length === 0 ? (
                <div className="text-center py-12 text-xs text-muted-foreground font-mono">
                  No query history yet.
                </div>
              ) : (
                usePlaygroundStore.getState().executionHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setQuery(item.query);
                      setActiveTab('results');
                    }}
                    className="p-3 rounded-lg border border-border/50 bg-card/40 hover:bg-muted/40 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs font-mono group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.success ? (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 text-red-400 shrink-0" />
                      )}
                      <span className="truncate text-foreground group-hover:text-primary transition-colors">
                        {item.query}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-muted-foreground shrink-0 text-[11px]">
                      <span>{item.rowsCount} rows</span>
                      <span>{formatDuration(item.durationMs)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals & Dialogs */}
      <DataExporterModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        rows={displayRows}
        tableName={selectedTable || 'result_set'}
      />

      <DryRunModal
        isOpen={isDryRunModalOpen}
        onClose={() => setIsDryRunModalOpen(false)}
        simulation={simulation}
        onCommit={() => {
          setIsDryRunModalOpen(false);
          runExecute(simulation?.query);
        }}
      />

      <AiSettingsDialog />
    </div>
  );
}
