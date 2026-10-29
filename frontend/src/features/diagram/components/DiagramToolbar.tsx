import { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  Search,
  X,
  Download,
  Share2,
  RefreshCw,
  Link,
  ChevronDown,
  Code2,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '../stores/useDiagramStore';

interface DiagramToolbarProps {
  onExport: (format: 'dbml' | 'mermaid' | 'sql' | 'svg') => void;
  onRefresh: () => void;
  onFitToScreen: () => void;
}

export function DiagramToolbar({
  onExport,
  onRefresh,
  onFitToScreen,
}: DiagramToolbarProps) {
  const transform = useDiagramStore((s) => s.transform);
  const zoomIn = useDiagramStore((s) => s.zoomIn);
  const zoomOut = useDiagramStore((s) => s.zoomOut);
  const resetZoom = useDiagramStore((s) => s.resetZoom);
  const autoArrange = useDiagramStore((s) => s.autoArrange);
  const searchQuery = useDiagramStore((s) => s.searchQuery);
  const setSearchQuery = useDiagramStore((s) => s.setSearchQuery);
  const showInferred = useDiagramStore((s) => s.showInferredRelationships);
  const toggleInferred = useDiagramStore((s) => s.toggleInferredRelationships);
  const showTypes = useDiagramStore((s) => s.showColumnTypes);
  const toggleTypes = useDiagramStore((s) => s.toggleColumnTypes);
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const isLoading = useDiagramStore((s) => s.isLoading);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on click outside
  useEffect(() => {
    if (!isExportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isExportOpen]);

  // Compute search matches
  const matchCount = searchQuery.trim()
    ? nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.columns.some((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).length
    : nodes.length;

  return (
    <div className="h-11 border-b border-border/80 bg-card/75 backdrop-blur-md px-3 flex items-center justify-between select-none shrink-0 z-30 font-mono text-xs">
      {/* Left: Search & Filter */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-56 sm:w-64">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tables or columns..."
            className="w-full h-7 pl-8 pr-7 text-xs rounded-lg bg-background border border-border/70 text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans">
          <span className="font-semibold text-foreground">{matchCount}</span>
          <span>of</span>
          <span>{nodes.length} tables</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="font-semibold text-foreground">{edges.length}</span>
          <span>relations</span>
        </div>
      </div>

      {/* Center: Layout & Display Options */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={autoArrange}
          title="Auto-arrange tables into clean hierarchical layers"
          className="h-7 text-xs gap-1.5 border-border/70 hover:bg-muted font-sans"
        >
          <LayoutGrid className="size-3 text-sky-400" />
          <span className="hidden sm:inline">Auto Arrange</span>
        </Button>

        <button
          type="button"
          onClick={toggleInferred}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
            showInferred
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle inferred relations detected by naming convention (e.g. user_id)"
        >
          <Link className="size-3" />
          <span className="hidden sm:inline">Inferred FKs</span>
        </button>

        <button
          type="button"
          onClick={toggleTypes}
          className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
            showTypes
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
          }`}
          title="Toggle data types display on column rows"
        >
          <FileCode className="size-3" />
          <span className="hidden sm:inline">Types</span>
        </button>
      </div>

      {/* Right: Zoom & Export Controls */}
      <div className="flex items-center gap-1">
        {/* Zoom controls */}
        <div className="flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            title="Zoom Out (Ctrl -)"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomOut className="size-3" />
          </Button>

          <button
            type="button"
            onClick={resetZoom}
            title="Reset Zoom to 100%"
            className="px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {Math.round(transform.zoom * 100)}%
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            title="Zoom In (Ctrl +)"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <ZoomIn className="size-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onFitToScreen}
            title="Fit All Tables to Screen"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="size-3" />
          </Button>
        </div>

        <div className="h-4 w-px bg-border/60 mx-1" />

        {/* Refresh Schema */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={isLoading}
          title="Reload schema from database (⌘R)"
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
        </Button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(!isExportOpen)}
            className="h-7 text-xs gap-1.5 border-border/80 font-sans"
            title="Export ER Diagram"
          >
            <Share2 className="size-3 text-sky-400" />
            <span>Export</span>
            <ChevronDown className="size-2.5 opacity-60" />
          </Button>

          {isExportOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-xs font-sans select-none">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                Diagram Export
              </div>

              <button
                type="button"
                onClick={() => {
                  onExport('dbml');
                  setIsExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 text-foreground transition-colors cursor-pointer text-left"
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <div className="min-w-0">
                  <div className="font-medium text-xs">dbdiagram.io (DBML)</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Export .dbml file</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExport('mermaid');
                  setIsExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 text-foreground transition-colors cursor-pointer text-left"
              >
                <Code2 className="size-3.5 text-sky-400" />
                <div className="min-w-0">
                  <div className="font-medium text-xs">Mermaid ER Diagram</div>
                  <div className="text-[10px] text-muted-foreground font-mono">For Markdown / GitHub</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExport('sql');
                  setIsExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 text-foreground transition-colors cursor-pointer text-left"
              >
                <FileCode className="size-3.5 text-emerald-400" />
                <div className="min-w-0">
                  <div className="font-medium text-xs">SQL DDL Statements</div>
                  <div className="text-[10px] text-muted-foreground font-mono">CREATE TABLE + FKs</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExport('svg');
                  setIsExportOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 text-foreground transition-colors cursor-pointer text-left"
              >
                <Download className="size-3.5 text-purple-400" />
                <div className="min-w-0">
                  <div className="font-medium text-xs">Download SVG Map</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Vector graphic snapshot</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
