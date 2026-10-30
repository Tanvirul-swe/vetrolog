import { DiagramNode, DiagramEdge } from '../types';

export const NODE_WIDTH = 260;
export const HEADER_HEIGHT = 44;
export const ROW_HEIGHT = 28;
export const PADDING_BOTTOM = 12;

export function estimateNodeHeight(columnCount: number): number {
  return HEADER_HEIGHT + Math.max(1, columnCount) * ROW_HEIGHT + PADDING_BOTTOM;
}

/**
 * Computes an organized, layered hierarchical layout (Sugiyama-style DAG)
 * preventing overlapping cards and orienting dependencies left-to-right.
 */
export function computeAutoLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const nodeMap = new Map<string, DiagramNode>();
  nodes.forEach((n) => nodeMap.set(n.name.toLowerCase(), n));

  // Build dependency graph: Parent -> Children (Parent is referenced by Child via FK)
  // i.e., in "orders.user_id -> users.id", "users" is the parent (layer 0), "orders" is child (layer 1)
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();

  nodes.forEach((n) => {
    parents.set(n.name.toLowerCase(), new Set());
    children.set(n.name.toLowerCase(), new Set());
  });

  edges.forEach((edge) => {
    const src = edge.sourceTable.toLowerCase(); // Child table having the FK
    const tgt = edge.targetTable.toLowerCase(); // Parent table being referenced
    if (src !== tgt && nodeMap.has(src) && nodeMap.has(tgt)) {
      parents.get(src)?.add(tgt);
      children.get(tgt)?.add(src);
    }
  });

  // Calculate layer/depth for each table using longest path from root
  const layers = new Map<string, number>();

  // Tables with no outgoing FKs to other tables are root parents (depth 0)
  const getDepth = (name: string, visited: Set<string> = new Set()): number => {
    if (layers.has(name)) return layers.get(name)!;
    if (visited.has(name)) return 0; // prevent cycle recursion

    visited.add(name);
    const parentSet = parents.get(name);
    if (!parentSet || parentSet.size === 0) {
      layers.set(name, 0);
      return 0;
    }

    let maxParentDepth = 0;
    parentSet.forEach((p) => {
      maxParentDepth = Math.max(maxParentDepth, getDepth(p, new Set(visited)));
    });

    const depth = maxParentDepth + 1;
    layers.set(name, depth);
    return depth;
  };

  nodes.forEach((n) => {
    getDepth(n.name.toLowerCase());
  });

  // Group nodes by layer
  const layerBuckets = new Map<number, DiagramNode[]>();
  nodes.forEach((n) => {
    const layer = layers.get(n.name.toLowerCase()) || 0;
    if (!layerBuckets.has(layer)) {
      layerBuckets.set(layer, []);
    }
    layerBuckets.get(layer)!.push(n);
  });

  // Separate independent nodes (0 connections) to place in neat trailing columns
  const connectedNodes: DiagramNode[] = [];
  const isolatedNodes: DiagramNode[] = [];

  nodes.forEach((n) => {
    const name = n.name.toLowerCase();
    const hasEdges = (parents.get(name)?.size || 0) > 0 || (children.get(name)?.size || 0) > 0;
    if (hasEdges) {
      connectedNodes.push(n);
    } else {
      isolatedNodes.push(n);
    }
  });

  const HORIZONTAL_GAP = 140;
  const VERTICAL_GAP = 40;
  const START_X = 80;
  const START_Y = 80;

  let currentX = START_X;

  // Layout connected layers
  const sortedLayers = Array.from(layerBuckets.keys()).sort((a, b) => a - b);
  sortedLayers.forEach((layerIdx) => {
    const layerNodes = layerBuckets.get(layerIdx)!.filter((n) => {
      const name = n.name.toLowerCase();
      return (parents.get(name)?.size || 0) > 0 || (children.get(name)?.size || 0) > 0;
    });

    if (layerNodes.length === 0) return;

    let currentY = START_Y;
    layerNodes.forEach((node) => {
      const h = estimateNodeHeight(node.columns.length);
      positions.set(node.id, { x: currentX, y: currentY });
      currentY += h + VERTICAL_GAP;
    });

    currentX += NODE_WIDTH + HORIZONTAL_GAP;
  });

  // Layout isolated/standalone tables (in a balanced grid)
  if (isolatedNodes.length > 0) {
    if (connectedNodes.length > 0) {
      currentX += 40; // extra separation
    }

    const maxItemsPerCol = Math.max(3, Math.ceil(Math.sqrt(isolatedNodes.length * 2)));
    let colX = currentX;
    let colY = START_Y;
    let countInCol = 0;

    isolatedNodes.forEach((node) => {
      const h = estimateNodeHeight(node.columns.length);
      positions.set(node.id, { x: colX, y: colY });
      colY += h + VERTICAL_GAP;
      countInCol++;

      if (countInCol >= maxItemsPerCol) {
        colX += NODE_WIDTH + HORIZONTAL_GAP;
        colY = START_Y;
        countInCol = 0;
      }
    });
  }

  return positions;
}

