import { create } from 'zustand';
import { PendingChange, ChangeResult } from '../types/database';

interface StagedChangesState {
  pendingChanges: PendingChange[];
  isPreviewModalOpen: boolean;
  isCommitting: boolean;
  commitError: string | null;

  // Actions
  stageCellUpdate: (
    schema: string,
    table: string,
    pkField: string,
    pkValue: unknown,
    colName: string,
    oldValue: unknown,
    newValue: unknown
  ) => void;
  stageRowDelete: (
    schema: string,
    table: string,
    pkField: string,
    pkValue: unknown,
    rowValues?: Record<string, unknown>
  ) => void;
  stageRowInsert: (
    schema: string,
    table: string,
    rowValues: Record<string, unknown>
  ) => void;
  discardChange: (index: number) => void;
  discardAll: () => void;
  setIsPreviewModalOpen: (open: boolean) => void;
  generatePreviewSQL: (engineType?: string) => string;
  commitChanges: (
    applyFn: (json: string) => Promise<ChangeResult | null>
  ) => Promise<{ success: boolean; affectedRows?: number; error?: string }>;
}

function escapeSqlIdentifier(name: string, engine?: string): string {
  if (engine === 'mysql' || engine === 'mariadb') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function formatSqlValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

export const useStagedChangesStore = create<StagedChangesState>((set, get) => ({
  pendingChanges: [],
  isPreviewModalOpen: false,
  isCommitting: false,
  commitError: null,

  stageCellUpdate: (schema, table, pkField, pkValue, colName, oldValue, newValue) => {
    // If new value is identical to old value, ignore
    if (oldValue === newValue) return;

    const list = [...get().pendingChanges];
    const existingIdx = list.findIndex(
      (c) =>
        c.type === 'UPDATE' &&
        c.schema === schema &&
        c.table === table &&
        c.primaryKey[pkField] === pkValue
    );

    if (existingIdx >= 0) {
      const existing = list[existingIdx];
      const updatedNewValues = { ...existing.newValues, [colName]: newValue };
      const updatedOldValues = { ...existing.oldValues, [colName]: oldValue };
      list[existingIdx] = {
        ...existing,
        newValues: updatedNewValues,
        oldValues: updatedOldValues,
      };
    } else {
      list.push({
        type: 'UPDATE',
        schema,
        table,
        primaryKey: { [pkField]: pkValue },
        oldValues: { [colName]: oldValue },
        newValues: { [colName]: newValue },
      });
    }

    set({ pendingChanges: list, commitError: null });
  },

  stageRowDelete: (schema, table, pkField, pkValue, rowValues) => {
    const list = [...get().pendingChanges];
    // Filter out any pending updates for this row since it's being deleted
    const filtered = list.filter(
      (c) =>
        !(
          c.schema === schema &&
          c.table === table &&
          c.primaryKey[pkField] === pkValue
        )
    );
    filtered.push({
      type: 'DELETE',
      schema,
      table,
      primaryKey: { [pkField]: pkValue },
      oldValues: rowValues || {},
    });
    set({ pendingChanges: filtered, commitError: null });
  },

  stageRowInsert: (schema, table, rowValues) => {
    const list = [...get().pendingChanges];
    list.push({
      type: 'INSERT',
      schema,
      table,
      primaryKey: {},
      newValues: rowValues,
    });
    set({ pendingChanges: list, commitError: null });
  },

  discardChange: (index: number) => {
    const list = [...get().pendingChanges];
    list.splice(index, 1);
    set({ pendingChanges: list });
  },

  discardAll: () => {
    set({ pendingChanges: [], commitError: null, isPreviewModalOpen: false });
  },

  setIsPreviewModalOpen: (open: boolean) => set({ isPreviewModalOpen: open }),

  generatePreviewSQL: (engineType = 'postgres') => {
    const changes = get().pendingChanges;
    if (changes.length === 0) return '-- No pending changes to preview.';

    const lines: string[] = [];
    if (engineType === 'mysql' || engineType === 'mariadb') {
      lines.push('START TRANSACTION;');
    } else {
      lines.push('BEGIN;');
    }
    lines.push('');

    for (const change of changes) {
      const qTable = change.schema && change.schema !== 'public' && change.schema !== 'main'
        ? `${escapeSqlIdentifier(change.schema, engineType)}.${escapeSqlIdentifier(change.table, engineType)}`
        : escapeSqlIdentifier(change.table, engineType);

      if (change.type === 'UPDATE' && change.newValues) {
        const setClauses = Object.entries(change.newValues).map(
          ([col, val]) => `${escapeSqlIdentifier(col, engineType)} = ${formatSqlValue(val)}`
        );
        const whereClauses = Object.entries(change.primaryKey).map(
          ([col, val]) => `${escapeSqlIdentifier(col, engineType)} = ${formatSqlValue(val)}`
        );
        lines.push(`-- Update in ${change.table}`);
        lines.push(`UPDATE ${qTable}`);
        lines.push(`SET ${setClauses.join(', ')}`);
        lines.push(`WHERE ${whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=0'};`);
        lines.push('');
      } else if (change.type === 'DELETE') {
        const whereClauses = Object.entries(change.primaryKey).map(
          ([col, val]) => `${escapeSqlIdentifier(col, engineType)} = ${formatSqlValue(val)}`
        );
        lines.push(`-- Delete from ${change.table}`);
        lines.push(`DELETE FROM ${qTable}`);
        lines.push(`WHERE ${whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=0'};`);
        lines.push('');
      } else if (change.type === 'INSERT' && change.newValues) {
        const cols = Object.keys(change.newValues);
        const colList = cols.map((c) => escapeSqlIdentifier(c, engineType)).join(', ');
        const valList = cols.map((c) => formatSqlValue(change.newValues![c])).join(', ');
        lines.push(`-- Insert into ${change.table}`);
        lines.push(`INSERT INTO ${qTable} (${colList})`);
        lines.push(`VALUES (${valList});`);
        lines.push('');
      }
    }

    lines.push('COMMIT;');
    return lines.join('\n');
  },

  commitChanges: async (applyFn) => {
    const changes = get().pendingChanges;
    if (changes.length === 0) {
      return { success: true, affectedRows: 0 };
    }

    set({ isCommitting: true, commitError: null });
    try {
      const payload = JSON.stringify({ changes });
      const res = await applyFn(payload);
      if (!res || !res.success) {
        const errMsg = res?.error || 'Failed to commit staged changes';
        set({ isCommitting: false, commitError: errMsg });
        return { success: false, error: errMsg };
      }

      set({
        pendingChanges: [],
        isCommitting: false,
        commitError: null,
        isPreviewModalOpen: false,
      });
      return { success: true, affectedRows: res.affectedRows };
    } catch (err) {
      const errMsg = String(err);
      set({ isCommitting: false, commitError: errMsg });
      return { success: false, error: errMsg };
    }
  },
}));
