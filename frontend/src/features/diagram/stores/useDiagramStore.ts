import { create } from 'zustand';
import { DiagramNode, DiagramEdge, ViewportTransform } from '../types';
import { computeAutoLayout, estimateNodeHeight, NODE_WIDTH } from '../services/layoutEngine';
import { ExtendedTableSchema } from '@/types/database';
import { predictJoins } from '@/features/playground/services/joinPredictor';
import { apiBridge } from '@/services/apiBridge';
import { useAdbStore } from '@/stores/useAdbStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';
import * as AppBindings from '../../../../wailsjs/go/app/App';

interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  transform: ViewportTransform;
  selectedTable: string | null;
  hoveredEdgeId: string | null;
  hoveredTable: string | null;
  hoveredColumn: { table: string; column: string } | null;
  searchQuery: string;
  showInferredRelationships: boolean;
  showColumnTypes: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number, focalPoint?: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: (containerWidth: number, containerHeight: number) => void;
  setNodePosition: (id: string, x: number, y: number) => void;
  setSelectedTable: (tableId: string | null) => void;
  setHoveredEdgeId: (edgeId: string | null) => void;
  setHoveredTable: (tableId: string | null) => void;
  setHoveredColumn: (col: { table: string; column: string } | null) => void;
  setSearchQuery: (query: string) => void;
  toggleInferredRelationships: () => void;
  toggleColumnTypes: () => void;
  autoArrange: () => void;
  syncSchema: (databaseId: string, schemas: ExtendedTableSchema[]) => void;
  loadCurrentDatabaseSchema: () => Promise<void>;
}

// Memory cache for user card positions across re-renders
const positionsCache = new Map<string, { x: number; y: number }>();

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],
  transform: { x: 80, y: 80, zoom: 1.0 },
  selectedTable: null,
  hoveredEdgeId: null,
  hoveredTable: null,
  hoveredColumn: null,
  searchQuery: '',
  showInferredRelationships: true,
  showColumnTypes: true,
  isLoading: false,
  error: null,

  setPan: (x, y) => {
    set((state) => ({
      transform: { ...state.transform, x, y },
    }));
  },

  setZoom: (newZoom, focalPoint) => {
    const clampedZoom = Math.max(0.15, Math.min(2.5, newZoom));
    const current = get().transform;

    if (!focalPoint) {
      set({ transform: { ...current, zoom: clampedZoom } });
      return;
    }

    // Zoom centered around mouse focal point
    const zoomRatio = clampedZoom / current.zoom;
    const newX = focalPoint.x - (focalPoint.x - current.x) * zoomRatio;
    const newY = focalPoint.y - (focalPoint.y - current.y) * zoomRatio;

    set({ transform: { x: newX, y: newY, zoom: clampedZoom } });
  },

  zoomIn: () => {
    const { zoom } = get().transform;
    get().setZoom(zoom * 1.25);
  },

  zoomOut: () => {
    const { zoom } = get().transform;
    get().setZoom(zoom * 0.8);
  },

  resetZoom: () => {
    set((state) => ({
      transform: { ...state.transform, zoom: 1.0 },
    }));
  },

  fitToScreen: (containerWidth: number, containerHeight: number) => {
    const nodes = get().nodes;
    if (nodes.length === 0 || containerWidth <= 0 || containerHeight <= 0) return;

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

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    if (graphWidth <= 0 || graphHeight <= 0) return;

    const padding = 80;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;

    const scaleX = availableWidth / graphWidth;
    const scaleY = availableHeight / graphHeight;
    const fitZoom = Math.max(0.2, Math.min(1.2, Math.min(scaleX, scaleY)));

    const centerX = (containerWidth - graphWidth * fitZoom) / 2 - minX * fitZoom;
    const centerY = (containerHeight - graphHeight * fitZoom) / 2 - minY * fitZoom;

    set({ transform: { x: centerX, y: centerY, zoom: fitZoom } });
  },

  setNodePosition: (id, x, y) => {
    positionsCache.set(id.toLowerCase(), { x, y });
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  },

  setSelectedTable: (tableId) => set({ selectedTable: tableId }),
  setHoveredEdgeId: (edgeId) => set({ hoveredEdgeId: edgeId }),
  setHoveredTable: (tableId) => set({ hoveredTable: tableId }),
  setHoveredColumn: (col) => set({ hoveredColumn: col }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleInferredRelationships: () =>
    set((s) => ({ showInferredRelationships: !s.showInferredRelationships })),
  toggleColumnTypes: () => set((s) => ({ showColumnTypes: !s.showColumnTypes })),

  autoArrange: () => {
    const { nodes, edges } = get();
    const newPositions = computeAutoLayout(nodes, edges);

    const updatedNodes = nodes.map((node) => {
      const pos = newPositions.get(node.id);
      if (pos) {
        positionsCache.set(node.id.toLowerCase(), pos);
        return { ...node, x: pos.x, y: pos.y };
      }
      return node;
    });

    set({ nodes: updatedNodes });
  },

  syncSchema: (_databaseId, rawTables) => {
    if (!rawTables || rawTables.length === 0) {
      // If we already have nodes rendered, don't wipe them out with empty response
      if (get().nodes.length === 0) {
        set({ nodes: [], edges: [], isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return;
    }

    // 1. Build Nodes
    const nodes: DiagramNode[] = rawTables.map((t) => {
      const colList = (t.columns || []).map((c: any) => ({
        name: c.name,
        type: c.type || 'TEXT',
        isPrimaryKey: !!c.isPrimaryKey,
        isNullable: !!c.isNullable,
        defaultValue: c.defaultValue || '',
        extra: c.extra || '',
      }));

      const pks = colList.filter((c) => c.isPrimaryKey).map((c) => c.name);
      const cached = positionsCache.get(t.name.toLowerCase());
      const height = estimateNodeHeight(colList.length);

      return {
        id: t.name,
        name: t.name,
        schema: t.schema || '',
        type: t.type || 'table',
        rowCount: t.rowCount || 0,
        columns: colList,
        primaryKeys: pks,
        x: cached ? cached.x : 0,
        y: cached ? cached.y : 0,
        width: NODE_WIDTH,
        height,
      };
    });

    // 2. Build Edges (Explicit FKs + Heuristic Inferred Relations)
    const edges: DiagramEdge[] = [];
    const seenEdges = new Set<string>();

    // Explicit foreign keys from table schemas
    rawTables.forEach((table) => {
      const srcName = table.name;
      (table.foreignKeys || []).forEach((fk) => {
        const tgtName = fk.toTable || fk.refTable;
        const fromCol = fk.fromCol || fk.column;
        const toCol = fk.toCol || fk.refColumn || 'id';

        if (tgtName && fromCol) {
          const edgeId = `${srcName}.${fromCol}->${tgtName}.${toCol}`.toLowerCase();
          if (!seenEdges.has(edgeId)) {
            seenEdges.add(edgeId);
            edges.push({
              id: edgeId,
              sourceTable: srcName,
              sourceColumn: fromCol,
              targetTable: tgtName,
              targetColumn: toCol,
              isInferred: false,
              constraintName: fk.constraintName,
              onUpdate: fk.onUpdate,
              onDelete: fk.onDelete,
            });
          }
        }
      });
    });

    // Inferred relationships (naming conventions e.g. <table_singular>_id)
    rawTables.forEach((curTable) => {
      rawTables.forEach((tgtTable) => {
        if (curTable.name !== tgtTable.name) {
          const predicted = predictJoins(curTable.name, tgtTable.name, rawTables);
          predicted.forEach((p) => {
            const edgeId = `${p.sourceTable}.${p.sourceCol}->${p.targetTable}.${p.targetCol}`.toLowerCase();
            const reverseId = `${p.targetTable}.${p.targetCol}->${p.sourceTable}.${p.sourceCol}`.toLowerCase();
            if (!seenEdges.has(edgeId) && !seenEdges.has(reverseId)) {
              seenEdges.add(edgeId);
              edges.push({
                id: edgeId,
                sourceTable: p.sourceTable,
                sourceColumn: p.sourceCol,
                targetTable: p.targetTable,
                targetColumn: p.targetCol,
                isInferred: !p.isForeignKey,
              });
            }
          });
        }
      });
    });

    // 3. Layout: If nodes lack cached positions, run auto-layout
    const hasUnpositioned = nodes.some((n) => n.x === 0 && n.y === 0);
    if (hasUnpositioned) {
      const layoutPositions = computeAutoLayout(nodes, edges);
      nodes.forEach((n) => {
        const pos = layoutPositions.get(n.id);
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
          positionsCache.set(n.id.toLowerCase(), pos);
        }
      });
    }

    set({ nodes, edges, isLoading: false, error: null });
  },

  loadCurrentDatabaseSchema: async () => {
    set({ isLoading: true, error: null });

    const isRemote = useConnectionManagerStore.getState().workspaceMode === 'remote';

    try {
      if (isRemote) {
        const connState = useConnectionManagerStore.getState();
        const session = connState.activeSession;

        if (!session) {
          // Check if databases exist in useDatabaseStore (e.g. from local file opened or fallback)
          const dbs = useDatabaseStore.getState().databases;
          if (dbs && dbs.length > 0 && dbs[0].tables && dbs[0].tables.length > 0) {
            const fallbackSchemas: ExtendedTableSchema[] = dbs[0].tables.map((t) => ({
              name: t.name,
              type: t.type,
              rowCount: t.rowCount || 0,
              columns: (t.columns || []).map((c) => ({
                name: c.name,
                type: c.type || 'TEXT',
                isPrimaryKey: Boolean(c.isPrimaryKey),
                isNullable: Boolean(c.isNullable),
              })),
              foreignKeys: [],
              indexes: [],
            }));
            get().syncSchema(dbs[0].id, fallbackSchemas);
            return;
          }
          set({ isLoading: false, nodes: [], edges: [] });
          return;
        }

        const selectedDb =
          connState.selectedDatabase ||
          session.currentDatabase ||
          session.config.database ||
          '';
        const selectedSchema =
          connState.selectedSchema ||
          session.currentSchema ||
          (session.config.engine === 'postgres' ? 'public' : '') ||
          '';

        // 1. Instant optimistic sync if remoteTables already exist in memory
        const existingRemoteTables = connState.remoteTables;
        if (existingRemoteTables && existingRemoteTables.length > 0) {
          const initialSchemas: ExtendedTableSchema[] = existingRemoteTables.map((t) => ({
            name: t.name,
            schema: t.schema || selectedSchema,
            type: t.type,
            rowCount: t.rowCount || 0,
            columns: (t.columns || []).map((col) => ({
              name: col.name,
              type: col.type || 'TEXT',
              isPrimaryKey: Boolean(col.isPrimaryKey),
              isNullable: Boolean(col.isNullable),
            })),
            foreignKeys: [],
            indexes: [],
          }));
          get().syncSchema(selectedDb || 'remote', initialSchemas);
        }

        // 2. Try single batch fetch from Go backend
        try {
          if (
            typeof window !== 'undefined' &&
            // @ts-expect-error window.go may be undefined
            window?.go?.app?.App?.RemoteGetDatabaseSchemaExtended
          ) {
            const fullSchemas = await AppBindings.RemoteGetDatabaseSchemaExtended(
              session.sessionId,
              selectedDb,
              selectedSchema
            );
            if (fullSchemas && fullSchemas.length > 0) {
              get().syncSchema(selectedDb || 'remote', fullSchemas as any);
              return;
            }
          }
        } catch {
          // Fallback to table-by-table fetching below
        }

        // 3. Fallback: iterate remoteTables and load each schema
        let tablesToFetch = connState.remoteTables || [];
        if (tablesToFetch.length === 0) {
          try {
            // @ts-expect-error window.go may be undefined
            if (window?.go?.app?.App?.RemoteListTables) {
              const res = await AppBindings.RemoteListTables(
                session.sessionId,
                selectedDb,
                selectedSchema
              );
              tablesToFetch = (res as any) || [];
            }
          } catch {
            // Safe fallback
          }
        }

        if (tablesToFetch.length > 0) {
          const schemaPromises = tablesToFetch.map(async (t) => {
            try {
              // @ts-expect-error window.go may be undefined
              if (window?.go?.app?.App?.RemoteGetTableSchema) {
                const res = await AppBindings.RemoteGetTableSchema(
                  session.sessionId,
                  selectedDb,
                  t.schema || selectedSchema,
                  t.name
                );
                if (res) return res as any;
              }
            } catch {
              // Ignore individual table fail
            }
            return {
              name: t.name,
              schema: t.schema || selectedSchema,
              type: t.type,
              rowCount: t.rowCount || 0,
              columns: (t.columns || []).map((col) => ({
                name: col.name,
                type: col.type || 'TEXT',
                isPrimaryKey: Boolean(col.isPrimaryKey),
                isNullable: Boolean(col.isNullable),
              })),
              foreignKeys: [],
              indexes: [],
            };
          });

          const fetchedSchemas = await Promise.all(schemaPromises);
          get().syncSchema(selectedDb || 'remote', fetchedSchemas);
          return;
        }

        set({ isLoading: false });
        return;
      }

      // Mobile Mode (Android SQLite / Mobile databases)
      const dbState = useDatabaseStore.getState();
      const adbState = useAdbStore.getState();

      const selectedDbId = dbState.selectedDatabaseId;
      const databases = dbState.databases;

      // Find current db, or fallback to first database in list
      const currentDb =
        (selectedDbId ? databases.find((d) => d.id === selectedDbId) : null) ||
        (databases.length > 0 ? databases[0] : null);

      // Instant optimistic sync from currentDb tables in memory (0ms delay!)
      if (currentDb && currentDb.tables && currentDb.tables.length > 0) {
        const initialSchemas: ExtendedTableSchema[] = currentDb.tables.map((t) => ({
          name: t.name,
          type: t.type,
          rowCount: t.rowCount || 0,
          columns: (t.columns || []).map((c) => ({
            name: c.name,
            type: c.type || 'TEXT',
            isPrimaryKey: Boolean(c.isPrimaryKey),
            isNullable: Boolean(c.isNullable),
          })),
          foreignKeys: [],
          indexes: [],
        }));
        get().syncSchema(currentDb.id, initialSchemas);
      }

      const deviceId = adbState.selectedDeviceId;
      const packageName = adbState.selectedPackageName;
      const remotePath = currentDb?.path || adbState.selectedDbRemotePath;

      if (!deviceId || !packageName || !remotePath) {
        set({ isLoading: false });
        return;
      }

      try {
        const res = await apiBridge.getExtendedSchema(deviceId, packageName, remotePath);
        if (res && res.tables && res.tables.length > 0) {
          get().syncSchema(res.databaseId || currentDb?.id || remotePath, res.tables);
          return;
        }
      } catch (err) {
        console.warn('apiBridge.getExtendedSchema failed, keeping optimistic schema:', err);
      }

      set({ isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Failed to extract database visual schema map',
      });
    }
  },
}));
