import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Network,
  RefreshCw,
  FolderOpen,
  Server,
} from 'lucide-react';
import { useDiagramStore } from './stores/useDiagramStore';
import { TableNodeCard } from './components/TableNodeCard';
import { RelationshipEdge } from './components/RelationshipEdge';
import { DiagramToolbar } from './components/DiagramToolbar';
import { DiagramMinimap } from './components/DiagramMinimap';
import { DiagramExportModal } from './components/DiagramExportModal';
import { generateDBML, generateMermaid, generateSQL } from './services/dbmlGenerator';
import { Button } from '@/components/ui/button';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import { useAdbStore } from '@/stores/useAdbStore';

interface DatabaseDiagramViewProps {
  onOpenConnectionManager?: () => void;
}

export function DatabaseDiagramView({ onOpenConnectionManager }: DatabaseDiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const transform = useDiagramStore((s) => s.transform);
  const setPan = useDiagramStore((s) => s.setPan);
  const setZoom = useDiagramStore((s) => s.setZoom);
  const fitToScreen = useDiagramStore((s) => s.fitToScreen);
  const selectedTable = useDiagramStore((s) => s.selectedTable);
  const setSelectedTable = useDiagramStore((s) => s.setSelectedTable);
  const hoveredEdgeId = useDiagramStore((s) => s.hoveredEdgeId);
  const hoveredTable = useDiagramStore((s) => s.hoveredTable);
  const searchQuery = useDiagramStore((s) => s.searchQuery);
  const showInferred = useDiagramStore((s) => s.showInferredRelationships);
  const isLoading = useDiagramStore((s) => s.isLoading);
  const error = useDiagramStore((s) => s.error);
  const loadCurrentDatabaseSchema = useDiagramStore((s) => s.loadCurrentDatabaseSchema);

  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const databases = useDatabaseStore((s) => s.databases);
  const databasesCount = useDatabaseStore((s) => s.databases?.length || 0);
  const currentDbTablesCount = useDatabaseStore(
    (s) =>
      s.databases.find((d) => d.id === s.selectedDatabaseId)?.tables?.length ||
      s.databases[0]?.tables?.length ||
      0
  );

  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const selectedRemoteDb = useConnectionManagerStore((s) => s.selectedDatabase);
  const selectedRemoteSchema = useConnectionManagerStore((s) => s.selectedSchema);
  const remoteTablesCount = useConnectionManagerStore((s) => s.remoteTables?.length || 0);
  const selectLocalFileDialog = useConnectionManagerStore((s) => s.selectLocalFileDialog);
  const setActiveRemoteView = useConnectionManagerStore((s) => s.setActiveRemoteView);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number }>({
    mouseX: 0,
    mouseY: 0,
    panX: transform.x,
    panY: transform.y,
  });

  // Export Modal state
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    format: 'dbml' | 'mermaid' | 'sql' | 'svg';
    content: string;
  }>({
    isOpen: false,
    format: 'dbml',
    content: '',
  });

  const handleRefresh = useCallback(async () => {
    if (workspaceMode === 'mobile') {
      await useAdbStore.getState().refreshDatabases();
    }
    await loadCurrentDatabaseSchema();
  }, [workspaceMode, loadCurrentDatabaseSchema]);

  // 1. Initial Load and Auto-Sync on Database / Connection / Schema switch
  useEffect(() => {
    loadCurrentDatabaseSchema();
  }, [
    selectedDbId,
    databasesCount,
    currentDbTablesCount,
    activeSession?.sessionId,
    selectedRemoteDb,
    selectedRemoteSchema,
    remoteTablesCount,
    workspaceMode,
    loadCurrentDatabaseSchema,
  ]);

  // 2. Track Container Dimensions for Fit-to-screen & Minimap
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 3. Canvas Panning Handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left click only
    setIsPanning(true);
    setSelectedTable(null); // Click on empty canvas clears selection
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: transform.x,
      panY: transform.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
    },
    [isPanning, setPan]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // 4. Smooth Focal-Point Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const focalPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Calculate zoom factor: gentle for trackpad, responsive for wheel
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(transform.zoom * zoomFactor, focalPoint);
  };

  // 5. Fit to screen handler
  const handleFitToScreen = useCallback(() => {
    if (containerRef.current) {
      fitToScreen(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
  }, [fitToScreen]);

  // 6. Export Action
  const handleExport = (format: 'dbml' | 'mermaid' | 'sql' | 'svg') => {
    let content = '';
    if (format === 'dbml') {
      content = generateDBML(nodes, edges);
    } else if (format === 'mermaid') {
      content = generateMermaid(nodes, edges);
    } else if (format === 'sql') {
      content = generateSQL(nodes, edges);
    } else if (format === 'svg') {
      // Export current SVG canvas
      const svgEl = containerRef.current?.querySelector('svg.diagram-canvas-svg');
      content = svgEl ? svgEl.outerHTML : '<svg></svg>';
    }

    setExportModal({
      isOpen: true,
      format,
      content,
    });
  };

  // Determine connected relationship targets for highlight propagation
  const relatedTables = new Set<string>();
  const activeEdges = showInferred ? edges : edges.filter((e) => !e.isInferred);

  if (selectedTable) {
    relatedTables.add(selectedTable.toLowerCase());
    activeEdges.forEach((e) => {
      if (e.sourceTable.toLowerCase() === selectedTable.toLowerCase()) {
        relatedTables.add(e.targetTable.toLowerCase());
      }
      if (e.targetTable.toLowerCase() === selectedTable.toLowerCase()) {
        relatedTables.add(e.sourceTable.toLowerCase());
      }
    });
  }

  if (hoveredTable) {
    relatedTables.add(hoveredTable.toLowerCase());
    activeEdges.forEach((e) => {
      if (e.sourceTable.toLowerCase() === hoveredTable.toLowerCase()) {
        relatedTables.add(e.targetTable.toLowerCase());
      }
      if (e.targetTable.toLowerCase() === hoveredTable.toLowerCase()) {
        relatedTables.add(e.sourceTable.toLowerCase());
      }
    });
  }

  // Check search query matches
  const queryLower = searchQuery.trim().toLowerCase();

  // If no tables or empty database
  if (nodes.length === 0 && !isLoading) {
    const isRedis = workspaceMode === 'remote' && activeSession?.config.engine === 'redis';

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <DiagramToolbar
          onExport={handleExport}
          onRefresh={handleRefresh}
          onFitToScreen={handleFitToScreen}
        />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-background relative">
          <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-md shadow-primary/10">
            <Network className="size-6" />
          </div>
          <h3 className="font-semibold text-foreground text-sm sm:text-base">
            {isRedis ? 'Redis Key-Value Store' : 'No Database Tables Found'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
            {isRedis
              ? 'Redis is an in-memory key-value data structure store and does not contain relational schemas or foreign key relations. Use the Redis Key Browser to inspect keys and values.'
              : workspaceMode === 'remote'
                ? 'Connect to a remote PostgreSQL, MySQL, MSSQL, or open a local .sqlite database to visualize real-time relationships.'
                : 'Connect an Android device with a debug app running SQLite or Hive to map table schemas automatically.'}
          </p>

          <div className="flex items-center gap-2 mt-4">
            {isRedis ? (
              <Button
                size="sm"
                onClick={() => setActiveRemoteView('redis')}
                className="h-8 text-xs gap-1.5"
              >
                <Server className="size-3.5" />
                <span>Open Redis Key Browser</span>
              </Button>
            ) : workspaceMode === 'remote' ? (
              <>
                {onOpenConnectionManager && (
                  <Button
                    size="sm"
                    onClick={onOpenConnectionManager}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Server className="size-3.5" />
                    <span>Connect Database</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectLocalFileDialog()}
                  className="h-8 text-xs gap-1.5"
                >
                  <FolderOpen className="size-3.5 text-amber-500" />
                  <span>Open Local .sqlite</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleRefresh}
                className="h-8 text-xs gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                <span>Rescan Databases</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background select-none relative">
      {/* Top Toolbar */}
      <DiagramToolbar
        onExport={handleExport}
        onRefresh={handleRefresh}
        onFitToScreen={handleFitToScreen}
      />

      {/* Infinite Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        className={`flex-1 relative overflow-hidden select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          // Infinite dot grid background
          backgroundImage:
            'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: `${24 * transform.zoom}px ${24 * transform.zoom}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      >
        {/* World Layer: Scaled and Panned */}
        <div
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute top-0 left-0 w-full h-full pointer-events-auto"
        >
          {/* SVG Connectors Layer */}
          <svg
            className="diagram-canvas-svg absolute top-0 left-0 overflow-visible pointer-events-none"
            style={{ width: '1px', height: '1px' }}
          >
            {activeEdges.map((edge) => {
              const srcNode = nodes.find(
                (n) => n.name.toLowerCase() === edge.sourceTable.toLowerCase()
              );
              const tgtNode = nodes.find(
                (n) => n.name.toLowerCase() === edge.targetTable.toLowerCase()
              );

              if (!srcNode || !tgtNode) return null;

              const isEdgeHighlighted =
                hoveredEdgeId === edge.id ||
                (selectedTable !== null &&
                  (edge.sourceTable.toLowerCase() === selectedTable.toLowerCase() ||
                    edge.targetTable.toLowerCase() === selectedTable.toLowerCase())) ||
                (hoveredTable !== null &&
                  (edge.sourceTable.toLowerCase() === hoveredTable.toLowerCase() ||
                    edge.targetTable.toLowerCase() === hoveredTable.toLowerCase()));

              return (
                <RelationshipEdge
                  key={edge.id}
                  edge={edge}
                  sourceNode={srcNode}
                  targetNode={tgtNode}
                  isHighlighted={isEdgeHighlighted}
                />
              );
            })}
          </svg>

          {/* Table Cards Layer */}
          {nodes.map((node) => {
            const isSelected = selectedTable?.toLowerCase() === node.id.toLowerCase();
            const isRelated = relatedTables.has(node.name.toLowerCase());

            const isDimmed = Boolean(
              queryLower &&
                !node.name.toLowerCase().includes(queryLower) &&
                !node.columns.some((c) => c.name.toLowerCase().includes(queryLower))
            );

            return (
              <TableNodeCard
                key={node.id}
                node={node}
                zoom={transform.zoom}
                isSelected={isSelected}
                isRelated={isRelated}
                isDimmed={isDimmed}
                searchQuery={searchQuery}
              />
            );
          })}
        </div>

        {/* Mini-map */}
        <DiagramMinimap
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-card/90 border border-primary/40 shadow-lg backdrop-blur-md flex items-center gap-2 text-xs font-mono text-primary animate-pulse">
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Syncing database schema map...</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg bg-destructive/15 border border-destructive/40 shadow-lg backdrop-blur-md text-xs font-sans text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Export Modal */}
      <DiagramExportModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal((s) => ({ ...s, isOpen: false }))}
        format={exportModal.format}
        content={exportModal.content}
        databaseName={
          workspaceMode === 'remote'
            ? activeSession?.config.database || 'remote'
            : databases.find((d) => d.id === selectedDbId)?.name || 'mobile'
        }
      />
    </div>
  );
}
