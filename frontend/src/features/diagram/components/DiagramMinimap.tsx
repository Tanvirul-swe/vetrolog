import { useRef } from 'react';
import { useDiagramStore } from '../stores/useDiagramStore';

interface DiagramMinimapProps {
  containerWidth: number;
  containerHeight: number;
}

export function DiagramMinimap({ containerWidth, containerHeight }: DiagramMinimapProps) {
  const nodes = useDiagramStore((s) => s.nodes);
  const transform = useDiagramStore((s) => s.transform);
  const setPan = useDiagramStore((s) => s.setPan);
  const minimapRef = useRef<HTMLDivElement>(null);

  if (nodes.length === 0) return null;

  // Calculate bounding box of all nodes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  const padding = 100;
  const worldWidth = Math.max(800, maxX - minX + padding * 2);
  const worldHeight = Math.max(600, maxY - minY + padding * 2);
  const worldX = minX - padding;
  const worldY = minY - padding;

  const MAP_WIDTH = 160;
  const MAP_HEIGHT = 100;
  const scaleX = MAP_WIDTH / worldWidth;
  const scaleY = MAP_HEIGHT / worldHeight;
  const mapScale = Math.min(scaleX, scaleY);

  // Viewport box in world coords
  const viewWorldX = -transform.x / transform.zoom;
  const viewWorldY = -transform.y / transform.zoom;
  const viewWorldW = containerWidth / transform.zoom;
  const viewWorldH = containerHeight / transform.zoom;

  // Map coords for viewport box
  const boxX = (viewWorldX - worldX) * mapScale;
  const boxY = (viewWorldY - worldY) * mapScale;
  const boxW = viewWorldW * mapScale;
  const boxH = viewWorldH * mapScale;

  const handleMinimapClick = (e: React.MouseEvent) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const clickMapX = e.clientX - rect.left;
    const clickMapY = e.clientY - rect.top;

    const targetWorldX = worldX + clickMapX / mapScale;
    const targetWorldY = worldY + clickMapY / mapScale;

    const newPanX = -(targetWorldX * transform.zoom) + containerWidth / 2;
    const newPanY = -(targetWorldY * transform.zoom) + containerHeight / 2;

    setPan(newPanX, newPanY);
  };

  return (
    <div
      ref={minimapRef}
      onClick={handleMinimapClick}
      style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px` }}
      className="absolute bottom-4 right-4 rounded-xl border border-border/80 bg-card/85 backdrop-blur-md shadow-xl overflow-hidden cursor-crosshair z-20 select-none group"
      title="Mini-map (Click anywhere to jump)"
    >
      <svg className="w-full h-full pointer-events-none">
        {/* Render scaled node thumbnails */}
        {nodes.map((node) => {
          const nx = (node.x - worldX) * mapScale;
          const ny = (node.y - worldY) * mapScale;
          const nw = node.width * mapScale;
          const nh = node.height * mapScale;

          return (
            <rect
              key={node.id}
              x={nx}
              y={ny}
              width={Math.max(4, nw)}
              height={Math.max(3, nh)}
              rx="2"
              className="fill-muted-foreground/35 group-hover:fill-muted-foreground/50 transition-colors"
            />
          );
        })}

        {/* Viewport Camera Indicator Box */}
        <rect
          x={Math.max(0, boxX)}
          y={Math.max(0, boxY)}
          width={Math.min(MAP_WIDTH, Math.max(12, boxW))}
          height={Math.min(MAP_HEIGHT, Math.max(10, boxH))}
          rx="3"
          className="fill-primary/20 stroke-primary"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
