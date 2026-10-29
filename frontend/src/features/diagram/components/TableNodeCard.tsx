import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Key, Link2, Table as TableIcon, Eye, Terminal } from 'lucide-react';
import { DiagramNode } from '../types';
import { ROW_HEIGHT, HEADER_HEIGHT } from '../services/layoutEngine';
import { useDiagramStore } from '../stores/useDiagramStore';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface TableNodeCardProps {
  node: DiagramNode;
  zoom: number;
  isSelected: boolean;
  isRelated: boolean;
  isDimmed: boolean;
  searchQuery: string;
}

export function TableNodeCard({
  node,
  zoom,
  isSelected,
  isRelated,
  isDimmed,
  searchQuery,
}: TableNodeCardProps) {
  const setNodePosition = useDiagramStore((s) => s.setNodePosition);
  const setSelectedTable = useDiagramStore((s) => s.setSelectedTable);
  const setHoveredTable = useDiagramStore((s) => s.setHoveredTable);
  const setHoveredColumn = useDiagramStore((s) => s.setHoveredColumn);
  const hoveredColumn = useDiagramStore((s) => s.hoveredColumn);
  const showColumnTypes = useDiagramStore((s) => s.showColumnTypes);

  const setActiveWorkspaceView = usePlaygroundStore((s) => s.setActiveWorkspaceView);
  const openTableInPlayground = usePlaygroundStore((s) => s.openTableInPlayground);
  const selectDatabaseTable = useDatabaseStore((s) => s.selectTable);
  const selectRemoteTable = useConnectionManagerStore((s) => s.selectTable);
  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; nodeX: number; nodeY: number }>({
    mouseX: 0,
    mouseY: 0,
    nodeX: node.x,
    nodeY: node.y,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Left-click only for drag
    if (e.button !== 0) return;
    e.stopPropagation();

    setSelectedTable(node.id);
    setIsDragging(true);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
      const newX = Math.round(dragStartRef.current.nodeX + dx);
      const newY = Math.round(dragStartRef.current.nodeY + dy);
      setNodePosition(node.id, newX, newY);
    },
    [isDragging, node.id, setNodePosition, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleInspectTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (workspaceMode === 'remote') {
      selectRemoteTable(node.name);
    } else {
      selectDatabaseTable(node.name);
    }
    setActiveWorkspaceView('grid');
  };

  const handleQueryTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    openTableInPlayground(node.name);
    setActiveWorkspaceView('playground');
  };

  // Check if search matches table name or any column
  const queryLower = searchQuery.trim().toLowerCase();
  const isNameMatch = queryLower && node.name.toLowerCase().includes(queryLower);

  return (
    <div
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        width: `${node.width}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedTable(node.id);
      }}
      onMouseEnter={() => setHoveredTable(node.id)}
      onMouseLeave={() => setHoveredTable(null)}
      className={`absolute top-0 left-0 rounded-xl border bg-card/95 backdrop-blur-md select-none transition-shadow duration-150 font-mono text-xs z-10 ${
        isDragging ? 'shadow-2xl ring-2 ring-primary cursor-grabbing z-30' : 'cursor-grab'
      } ${
        isSelected
          ? 'border-primary ring-2 ring-primary/50 shadow-xl shadow-primary/10 z-20'
          : isRelated
          ? 'border-sky-500/70 ring-1 ring-sky-500/30 shadow-md z-15'
          : 'border-border/80 shadow-md hover:border-border hover:shadow-lg'
      } ${isDimmed ? 'opacity-30 grayscale-[50%]' : 'opacity-100'}`}
    >
      {/* Table Card Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{ height: `${HEADER_HEIGHT}px` }}
        className={`px-3 flex items-center justify-between border-b border-border/80 rounded-t-xl transition-colors ${
          isSelected
            ? 'bg-primary/15 text-foreground'
            : isRelated
            ? 'bg-sky-500/10 text-foreground'
            : 'bg-muted/40 text-foreground hover:bg-muted/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <TableIcon className="size-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`font-semibold tracking-tight truncate text-xs ${
                  isNameMatch ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300 px-0.5 rounded' : 'text-foreground'
                }`}
                title={node.name}
              >
                {node.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
              {node.rowCount !== undefined && (
                <span>{node.rowCount.toLocaleString()} rows</span>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            type="button"
            onClick={handleInspectTable}
            title="Inspect rows in DataGrid"
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Eye className="size-3" />
          </button>
          <button
            type="button"
            onClick={handleQueryTable}
            title="Open in SQL Studio"
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Terminal className="size-3" />
          </button>
        </div>
      </div>

      {/* Columns List */}
      <div className="divide-y divide-border/30">
        {node.columns.map((col, idx) => {
          const isPk = col.isPrimaryKey;
          const isColHovered =
            hoveredColumn?.table.toLowerCase() === node.name.toLowerCase() &&
            hoveredColumn?.column.toLowerCase() === col.name.toLowerCase();
          const isColMatch = queryLower && col.name.toLowerCase().includes(queryLower);

          return (
            <div
              key={col.name || idx}
              style={{ height: `${ROW_HEIGHT}px` }}
              onMouseEnter={() => setHoveredColumn({ table: node.name, column: col.name })}
              onMouseLeave={() => setHoveredColumn(null)}
              className={`relative px-3 flex items-center justify-between gap-2 text-[11px] transition-colors ${
                isColHovered
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted/40 text-foreground/90'
              }`}
            >
              {/* Left Column Port (Anchor dot for incoming connectors) */}
              <div
                data-port={`${node.name}.${col.name}.left`}
                className="absolute -left-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-border border-2 border-card ring-1 ring-black/10 dark:ring-white/10 opacity-70 group-hover:opacity-100"
              />

              {/* Column Name & Key Badges */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                {isPk && (
                  <span title="Primary Key" className="shrink-0 flex items-center">
                    <Key className="size-3 text-amber-500 dark:text-amber-400 shrink-0" />
                  </span>
                )}
                {!isPk && col.name.toLowerCase().endsWith('_id') && (
                  <span title="Reference Column" className="shrink-0 flex items-center">
                    <Link2 className="size-2.5 text-sky-500 dark:text-sky-400 shrink-0 opacity-70" />
                  </span>
                )}
                <span
                  className={`truncate ${
                    isPk ? 'font-semibold text-foreground' : 'font-normal'
                  } ${
                    isColMatch ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 px-0.5 rounded font-semibold' : ''
                  }`}
                  title={col.name}
                >
                  {col.name}
                </span>
              </div>

              {/* Data Type & Nullable Status */}
              {showColumnTypes && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 font-normal">
                  <span className="uppercase text-[9px] text-muted-foreground/75 truncate max-w-[80px]" title={col.type}>
                    {col.type}
                  </span>
                  {!col.isNullable && !isPk && (
                    <span className="text-muted-foreground/40 text-[9px]" title="Not Null">
                      •
                    </span>
                  )}
                </div>
              )}

              {/* Right Column Port (Anchor dot for outgoing connectors) */}
              <div
                data-port={`${node.name}.${col.name}.right`}
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 size-2.5 rounded-full bg-border border-2 border-card ring-1 ring-black/10 dark:ring-white/10 opacity-70 group-hover:opacity-100"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
