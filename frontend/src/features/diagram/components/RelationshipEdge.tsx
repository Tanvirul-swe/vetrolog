import { useState } from 'react';
import { DiagramEdge, DiagramNode } from '../types';
import { ROW_HEIGHT, HEADER_HEIGHT } from '../services/layoutEngine';
import { useDiagramStore } from '../stores/useDiagramStore';

interface RelationshipEdgeProps {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  isHighlighted: boolean;
}

export function RelationshipEdge({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
}: RelationshipEdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const setHoveredEdgeId = useDiagramStore((s) => s.setHoveredEdgeId);

  // 1. Find vertical column offsets
  const sourceColIdx = Math.max(
    0,
    sourceNode.columns.findIndex(
      (c) => c.name.toLowerCase() === edge.sourceColumn.toLowerCase()
    )
  );

  const targetColIdx = Math.max(
    0,
    targetNode.columns.findIndex(
      (c) => c.name.toLowerCase() === edge.targetColumn.toLowerCase()
    )
  );

  const sourceY = sourceNode.y + HEADER_HEIGHT + (sourceColIdx + 0.5) * ROW_HEIGHT;
  const targetY = targetNode.y + HEADER_HEIGHT + (targetColIdx + 0.5) * ROW_HEIGHT;

  // 2. Determine best anchor sides (left vs right)
  const isSourceLeftOfTarget = sourceNode.x + sourceNode.width < targetNode.x;
  const isTargetLeftOfSource = targetNode.x + targetNode.width < sourceNode.x;

  let sourceX: number;
  let targetX: number;
  let sourceDirection: 1 | -1;
  let targetDirection: 1 | -1;

  if (isSourceLeftOfTarget) {
    // Source Right -> Target Left
    sourceX = sourceNode.x + sourceNode.width;
    targetX = targetNode.x;
    sourceDirection = 1;
    targetDirection = -1;
  } else if (isTargetLeftOfSource) {
    // Source Left -> Target Right
    sourceX = sourceNode.x;
    targetX = targetNode.x + targetNode.width;
    sourceDirection = -1;
    targetDirection = 1;
  } else {
    // Vertically stacked or overlapping: route through outer side
    if (sourceNode.x < targetNode.x) {
      sourceX = sourceNode.x + sourceNode.width;
      targetX = targetNode.x + targetNode.width;
      sourceDirection = 1;
      targetDirection = 1;
    } else {
      sourceX = sourceNode.x;
      targetX = targetNode.x;
      sourceDirection = -1;
      targetDirection = -1;
    }
  }

  // 3. Compute Cubic Bézier curve control points
  const dx = Math.abs(targetX - sourceX);
  const curvature = Math.max(40, Math.min(180, dx * 0.5));

  const c1x = sourceX + sourceDirection * curvature;
  const c1y = sourceY;
  const c2x = targetX + targetDirection * curvature;
  const c2y = targetY;

  const pathData = `M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}`;

  // Center point along the curve for badge
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const active = isHighlighted || isHovered;

  return (
    <g
      className="transition-opacity duration-150"
      onMouseEnter={() => {
        setIsHovered(true);
        setHoveredEdgeId(edge.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredEdgeId(null);
      }}
    >
      {/* Invisible wider hit-target for effortless hover detection */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth="18"
        className="cursor-pointer"
      />

      {/* Background glow when active */}
      {active && (
        <path
          d={pathData}
          fill="none"
          stroke="var(--color-primary, #3b82f6)"
          strokeOpacity="0.25"
          strokeWidth="7"
          strokeLinecap="round"
        />
      )}

      {/* Main connector path */}
      <path
        d={pathData}
        fill="none"
        stroke={
          active
            ? 'var(--color-primary, #3b82f6)'
            : edge.isInferred
            ? 'color-mix(in srgb, var(--color-primary, #3b82f6) 70%, var(--color-muted-foreground, #64748b) 30%)'
            : 'var(--color-primary, #3b82f6)'
        }
        strokeWidth={active ? '2.5' : edge.isInferred ? '1.75' : '1.5'}
        strokeDasharray={edge.isInferred ? '5 4' : undefined}
        strokeLinecap="round"
      />

      {/* Source Anchor: Small circle dot representing the foreign key end (N) */}
      <circle
        cx={sourceX}
        cy={sourceY}
        r={active ? '4.5' : '3.5'}
        fill={
          active
            ? 'var(--color-primary, #3b82f6)'
            : edge.isInferred
            ? 'var(--color-sky-500, #0ea5e9)'
            : 'var(--color-primary, #3b82f6)'
        }
        stroke="var(--color-card, #ffffff)"
        strokeWidth="1.5"
      />

      {/* Target Anchor: Circle representing primary key referenced (1) */}
      <circle
        cx={targetX}
        cy={targetY}
        r={active ? '4.5' : '3.5'}
        fill={
          active
            ? 'var(--color-primary, #3b82f6)'
            : edge.isInferred
            ? 'var(--color-amber-500, #f59e0b)'
            : 'var(--color-primary, #3b82f6)'
        }
        stroke="var(--color-card, #ffffff)"
        strokeWidth="1.5"
      />

      {/* Cardinality labels on endpoints */}
      {active && (
        <>
          <text
            x={sourceX + sourceDirection * 14}
            y={sourceY + 3.5}
            textAnchor={sourceDirection === 1 ? 'start' : 'end'}
            className="fill-primary font-mono text-[10px] font-bold select-none pointer-events-none"
          >
            N
          </text>
          <text
            x={targetX + targetDirection * 14}
            y={targetY + 3.5}
            textAnchor={targetDirection === 1 ? 'start' : 'end'}
            className="fill-primary font-mono text-[10px] font-bold select-none pointer-events-none"
          >
            1
          </text>
        </>
      )}

      {/* Hover Info Tooltip Badge */}
      {active && (
        <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none select-none">
          <rect
            x={edge.isInferred ? '-110' : '-90'}
            y="-16"
            width={edge.isInferred ? '220' : '180'}
            height="24"
            rx="6"
            className="fill-popover stroke-border"
            strokeWidth="1"
          />
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground font-mono text-[10px] font-medium"
          >
            {edge.sourceTable}.{edge.sourceColumn} → {edge.targetTable}.{edge.targetColumn}
            {edge.isInferred ? ' (inferred)' : ''}
          </text>
        </g>
      )}
    </g>
  );
}

