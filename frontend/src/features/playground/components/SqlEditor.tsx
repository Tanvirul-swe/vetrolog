import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  ShieldAlert,
  Search,
  Eraser,
  XCircle,
  Wand2,
  Keyboard,
  ChevronDown,
  Code2,
  Database,
  Check,
  Loader2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBytes } from '@/lib/formatters';
import { AutocompletePopup, AutocompleteItem } from './AutocompletePopup';
import { ShortcutsModal } from './ShortcutsModal';
import { predictJoins } from '../services/joinPredictor';
import { highlightSql } from '../services/sqlHighlighter';
import { formatSqlIdentifier } from '../services/sqlIdentifier';
import {
  parseDotContext,
  filterTableColumns,
  extractReferencedTables,
  detectSqlClauseContext,
} from '../services/sqlContextParser';
import {
  toggleComment,
  indentLines,
  duplicateLine,
  moveLines,
} from '../services/editorShortcuts';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useAdbStore } from '@/stores/useAdbStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
  'ON',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE FROM',
  'CREATE TABLE',
  'CREATE INDEX',
  'DROP TABLE',
  'ALTER TABLE',
  'PRAGMA',
  'EXPLAIN QUERY PLAN',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS NULL',
  'IS NOT NULL',
  'LIKE',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
];

// Feature flag: Visual Plan temporarily hidden per user request
const SHOW_VISUAL_PLAN = false;

// Platform detection for keyboard shortcut labels
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);

interface SqlEditorProps {
  onRunExecute: (overrideSql?: string) => void;
  onRunDryRun: (overrideSql?: string) => void;
  onRunExplain: (overrideSql?: string) => void;
}

export function SqlEditor({
  onRunExecute,
  onRunDryRun,
  onRunExplain,
}: SqlEditorProps) {
  const query = usePlaygroundStore((s) => s.query);
  const setQuery = usePlaygroundStore((s) => s.setQuery);
  const activeTabId = usePlaygroundStore((s) => s.activeTabId);
  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const isExecuting = usePlaygroundStore((s) => s.isExecuting);
  const isSimulating = usePlaygroundStore((s) => s.isSimulating);
  const isExplaining = usePlaygroundStore((s) => s.isExplaining);
  const cancelExecution = usePlaygroundStore((s) => s.cancelExecution);
  const formatSql = usePlaygroundStore((s) => s.formatSql);
  const updateActiveTabState = usePlaygroundStore((s) => s.updateActiveTabState);
  const loadExtendedSchema = usePlaygroundStore((s) => s.loadExtendedSchema);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSnippetsMenuOpen, setIsSnippetsMenuOpen] = useState(false);
  const snippetsMenuRef = useRef<HTMLDivElement>(null);

  const [isDbMenuOpen, setIsDbMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const dbButtonRef = useRef<HTMLButtonElement>(null);
  const dbMenuRef = useRef<HTMLDivElement>(null);

  const databases = useDatabaseStore((s) => s.databases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const selectDatabase = useDatabaseStore((s) => s.selectDatabase);
  const setSelectedDbRemotePath = useAdbStore((s) => s.setSelectedDbRemotePath);
  const isLoadingDatabases = useAdbStore((s) => s.isLoadingDatabases);
  const isLoadingApps = useAdbStore((s) => s.isLoadingApps);
  const isInitialLoading = useAdbStore((s) => s.isInitialLoading);
  const workspaceMode = useConnectionManagerStore((s) => s.workspaceMode);
  const activeSession = useConnectionManagerStore((s) => s.activeSession);

  const hasValidTarget =
    (workspaceMode === 'remote' ? Boolean(activeSession) : Boolean(selectedDbId)) &&
    Boolean(query.trim());

  const handleToggleDbMenu = () => {
    if (isDbMenuOpen) {
      setIsDbMenuOpen(false);
    } else if (dbButtonRef.current) {
      const rect = dbButtonRef.current.getBoundingClientRect();
      const menuWidth = 320;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - menuWidth - 16);
      }

      const menuHeight = Math.min(420, Math.max(140, databases.length * 64 + 52));
      let top = rect.bottom + 6;
      if (top + menuHeight > window.innerHeight - 16 && rect.top > menuHeight) {
        top = rect.top - menuHeight - 6;
      }

      setMenuCoords({ top, left, width: Math.max(rect.width, menuWidth) });
      setIsDbMenuOpen(true);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    if (!isDbMenuOpen && !isSnippetsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (snippetsMenuRef.current && !snippetsMenuRef.current.contains(e.target as Node)) {
        setIsSnippetsMenuOpen(false);
      }
      if (
        isDbMenuOpen &&
        dbMenuRef.current &&
        !dbMenuRef.current.contains(e.target as Node) &&
        dbButtonRef.current &&
        !dbButtonRef.current.contains(e.target as Node)
      ) {
        setIsDbMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isDbMenuOpen, isSnippetsMenuOpen]);

  // Close floating dropdown on window resize or outer scroll (ignoring scrolls inside the dropdown itself)
  useEffect(() => {
    if (!isDbMenuOpen) return;

    const handleScroll = (e: Event) => {
      // If the scroll happened inside the dropdown menu itself, allow smooth scrolling!
      if (dbMenuRef.current && e.target instanceof Node && dbMenuRef.current.contains(e.target)) {
        return;
      }
      setIsDbMenuOpen(false);
    };

    const handleResize = () => {
      setIsDbMenuOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isDbMenuOpen]);

  const handleSelectDatabase = (dbId: string) => {
    setIsDbMenuOpen(false);
    if (dbId === selectedDbId) return;

    const targetDb = databases.find((d) => d.id === dbId);
    if (!targetDb) return;

    // 1. Switch active database in database store
    selectDatabase(dbId);

    // 2. Sync ADB remote path
    if (targetDb.path) {
      setSelectedDbRemotePath(targetDb.path);
    }

    // 3. Bind active tab to this database
    updateActiveTabState({ databaseId: dbId });

    // 4. Reload extended schema for autocomplete and highlighter
    loadExtendedSchema();
  };

  const activeDb = useMemo(() => databases.find((d) => d.id === selectedDbId), [databases, selectedDbId]);
  const remoteTables = useConnectionManagerStore((s) => s.remoteTables);
  const tableSchema = useConnectionManagerStore((s) => s.tableSchema);
  const loadTableSchema = useConnectionManagerStore((s) => s.loadTableSchema);

  // Combine extendedSchema with activeDb.tables, remoteTables, and tableSchema to guarantee all tables and columns are always available
  const availableTables = useMemo(() => {
    const tableMap = new Map<string, any>();

    // 1. From database store
    if (activeDb?.tables) {
      for (const t of activeDb.tables) {
        tableMap.set(t.name.toLowerCase(), t);
      }
    }

    // 2. From remoteTables
    if (remoteTables) {
      for (const t of remoteTables) {
        const existing = tableMap.get(t.name.toLowerCase());
        if (!existing || (!existing.columns?.length && t.columns?.length)) {
          tableMap.set(t.name.toLowerCase(), {
            name: t.name,
            tableName: t.name,
            schema: t.schema || 'public',
            type: t.type || 'table',
            rowCount: t.rowCount || 0,
            columns: (t.columns || []).map((c: any) => ({
              name: c.name,
              type: c.type || 'TEXT',
              isPrimaryKey: !!c.isPrimaryKey,
              isNullable: !!c.isNullable,
            })),
          });
        }
      }
    }

    // 3. From currently inspected tableSchema
    if (tableSchema) {
      tableMap.set(tableSchema.name.toLowerCase(), tableSchema);
    }

    // 4. From extendedSchema (Mobile ADB)
    if (extendedSchema?.tables && extendedSchema.tables.length > 0) {
      for (const t of extendedSchema.tables) {
        tableMap.set(t.name.toLowerCase(), t);
      }
    }

    return Array.from(tableMap.values());
  }, [extendedSchema, activeDb, remoteTables, tableSchema]);

  // Proactively fetch columns for referenced tables in remote mode if missing
  useEffect(() => {
    if (!activeSession) return;
    const refTableNames = extractReferencedTables(query);
    for (const tbl of refTableNames) {
      const match = availableTables.find((t) => t.name.toLowerCase() === tbl);
      if (!match || !match.columns || match.columns.length === 0) {
        loadTableSchema(tbl);
      }
    }
  }, [query, activeSession, availableTables, loadTableSchema]);

  // Pre-index known table and column names for instant syntax highlighting
  const { tableSet, columnSet } = useMemo(() => {
    const tSet = new Set<string>();
    const cSet = new Set<string>();
    for (const t of availableTables) {
      tSet.add(t.name.toLowerCase());
      for (const c of t.columns || []) {
        cSet.add(c.name.toLowerCase());
      }
    }
    return { tableSet: tSet, columnSet: cSet };
  }, [availableTables]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState<number>(0);
  const [hasSelection, setHasSelection] = useState<boolean>(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedAutoIndex, setSelectedAutoIndex] = useState(0);
  const [isTypingTriggered, setIsTypingTriggered] = useState<boolean>(false);

  // Undo / Redo History Stack per query tab
  const historyRef = useRef<{ text: string; cursorStart: number; cursorEnd: number }[]>([
    { text: query, cursorStart: 0, cursorEnd: 0 },
  ]);
  const historyIdxRef = useRef<number>(0);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTabIdRef = useRef<string>(activeTabId);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateUndoRedoState = useCallback(() => {
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  // Flush any pending debounced typing snapshot before performing an undo/redo
  const flushPendingHistory = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
      if (textareaRef.current) {
        const val = textareaRef.current.value;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const currentSnap = historyRef.current[historyIdxRef.current];
        if (!currentSnap || currentSnap.text !== val) {
          const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
          newHistory.push({ text: val, cursorStart: start, cursorEnd: end });
          if (newHistory.length > 200) newHistory.shift();
          historyRef.current = newHistory;
          historyIdxRef.current = newHistory.length - 1;
          updateUndoRedoState();
        }
      }
    }
  }, [updateUndoRedoState]);

  // Synchronize scrolling across textarea, pre-highlighting layer, and line number gutter
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = scrollTop;
      }
    }
  };

  const applyTextEdit = useCallback(
    (newText: string, newStart: number, newEnd: number, recordHistory = true) => {
      setQuery(newText);
      setCursorPos(newStart);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newStart, newEnd);
          handleScroll();
        }
      }, 0);

      if (recordHistory) {
        const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
        newHistory.push({ text: newText, cursorStart: newStart, cursorEnd: newEnd });
        if (newHistory.length > 200) newHistory.shift();
        historyRef.current = newHistory;
        historyIdxRef.current = newHistory.length - 1;
        updateUndoRedoState();
      }
    },
    [setQuery, updateUndoRedoState]
  );

  const handleUndo = useCallback(() => {
    flushPendingHistory();
    if (historyIdxRef.current > 0) {
      historyIdxRef.current -= 1;
      const snap = historyRef.current[historyIdxRef.current];
      isUndoRedoActionRef.current = true;
      applyTextEdit(snap.text, snap.cursorStart, snap.cursorEnd, false);
      updateUndoRedoState();
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 50);
    }
  }, [applyTextEdit, flushPendingHistory, updateUndoRedoState]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current += 1;
      const snap = historyRef.current[historyIdxRef.current];
      isUndoRedoActionRef.current = true;
      applyTextEdit(snap.text, snap.cursorStart, snap.cursorEnd, false);
      updateUndoRedoState();
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 50);
    }
  }, [applyTextEdit, flushPendingHistory, updateUndoRedoState]);

  // Reset history stack when active query tab changes
  useEffect(() => {
    if (prevTabIdRef.current !== activeTabId) {
      prevTabIdRef.current = activeTabId;
      historyRef.current = [{ text: query, cursorStart: 0, cursorEnd: 0 }];
      historyIdxRef.current = 0;
      updateUndoRedoState();
      setIsTypingTriggered(false);
      setPopupPos(null);
    }
  }, [activeTabId, query, updateUndoRedoState]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    setQuery(val);
    setHasSelection(start !== end);
    setCursorPos(start);
    setIsTypingTriggered(true);

    if (!isUndoRedoActionRef.current) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      const isBoundary = val.endsWith(' ') || val.endsWith('\n') || val.length === 0;
      if (isBoundary) {
        const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
        newHistory.push({ text: val, cursorStart: start, cursorEnd: end });
        if (newHistory.length > 200) newHistory.shift();
        historyRef.current = newHistory;
        historyIdxRef.current = newHistory.length - 1;
        updateUndoRedoState();
      } else {
        typingTimerRef.current = setTimeout(() => {
          const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
          newHistory.push({ text: val, cursorStart: start, cursorEnd: end });
          if (newHistory.length > 200) newHistory.shift();
          historyRef.current = newHistory;
          historyIdxRef.current = newHistory.length - 1;
          updateUndoRedoState();
        }, 180);
      }
    }
  };

  const getExecutableQuery = (): string => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
        const selected = value.substring(selectionStart, selectionEnd).trim();
        if (selected) return selected;
      }
    }
    return query;
  };

  const updateSelectionState = () => {
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      setHasSelection(selectionStart !== selectionEnd);
      setCursorPos(selectionStart);
    }
  };

  const handleTextareaMouseDown = () => {
    // When clicking or dragging, immediately dismiss autocomplete suggestions
    setIsTypingTriggered(false);
    setPopupPos(null);
  };

  const handleTextareaClick = () => {
    setIsTypingTriggered(false);
    setPopupPos(null);
    updateSelectionState();
  };

  // Split lines for line numbers
  const lines = useMemo(() => query.split('\n'), [query]);

  // Active line index for line highlight and gutter highlight (VS Code style)
  const currentLineIndex = useMemo(() => {
    return query.slice(0, cursorPos).split('\n').length - 1;
  }, [query, cursorPos]);

  // Real-time SQL syntax highlighting
  const highlightedTokens = useMemo(() => {
    return highlightSql(query, tableSet, columnSet);
  }, [query, tableSet, columnSet]);

  // Contextual autocomplete calculation
  const autocompleteItems = useMemo<AutocompleteItem[]>(() => {
    // Only calculate if user is actively typing (never on mouse click)
    if (!isTypingTriggered) return [];

    const textBefore = query.slice(0, cursorPos);

    // 0. Dot Context Autocomplete (e.g. table.col or alias.col)
    const dotContext = parseDotContext(textBefore, query, availableTables);
    if (dotContext && dotContext.table) {
      const filteredCols = filterTableColumns(dotContext.table.columns || [], dotContext.columnPrefix);
      return filteredCols.map((c) => ({
        label: c.name,
        insertText: formatSqlIdentifier(c.name),
        type: 'column',
        detail: `${dotContext.tableName}.${c.name}`,
        meta: c.isPrimaryKey ? 'PK' : c.type || 'COLUMN',
        isPk: c.isPrimaryKey,
      }));
    }

    // 1. Parse active SQL clause context and word at cursor
    const clauseContext = detectSqlClauseContext(textBefore);
    const { isFromOrJoin, isColumnClause, clauseType, currentWord } = clauseContext;

    const isOnContext = /JOIN\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]*)$/i.test(textBefore);
    const isDotContext = /\.\s*([a-zA-Z0-9_]*)$/.test(textBefore);

    // If not typing a word, dot, or in an active SQL clause context, do NOT pop up suggestions
    if (!currentWord && !isFromOrJoin && !isOnContext && !isDotContext && !isColumnClause) {
      return [];
    }

    const items: AutocompleteItem[] = [];

    // 2. Identify tables referenced in the query (e.g. FROM dns_query_logs)
    const refTableNames = extractReferencedTables(query);
    const referencedTables = availableTables.filter((t) =>
      refTableNames.includes(t.name.toLowerCase())
    );

    // Fallback: if no tables found in query yet, use active database/selected table
    const activeSelectedTable =
      useDatabaseStore.getState().selectedTableName ||
      useConnectionManagerStore.getState().selectedTable;
    const fallbackTable = activeSelectedTable
      ? availableTables.find((t) => t.name.toLowerCase() === activeSelectedTable.toLowerCase())
      : availableTables[0];

    const primaryTables =
      referencedTables.length > 0 ? referencedTables : fallbackTable ? [fallbackTable] : [];

    // 3. Join Predictor (Typing after JOIN table ON)
    if (isOnContext) {
      const match = textBefore.match(/FROM\s+([a-zA-Z0-9_]+)[\s\S]*?JOIN\s+([a-zA-Z0-9_]+)\s+ON/i);
      if (match) {
        const fromTable = match[1];
        const joinTable = match[2];
        const predictions = predictJoins(fromTable, joinTable, extendedSchema?.tables || []);
        for (const p of predictions) {
          items.push({
            label: `ON ${p.onClause}`,
            insertText: `${p.onClause} `,
            type: 'join',
            detail: p.isForeignKey ? 'Foreign Key Match' : 'Smart Relation',
            meta: `${Math.round(p.confidence * 100)}%`,
          });
        }
      }
    }

    // 4. Intelligent Column Suggestions:
    // If user is in WHERE, SELECT, ORDER BY, GROUP BY, SET, HAVING, or ON, or typing a word outside FROM/JOIN:
    if (isColumnClause || (currentWord.length > 0 && !isFromOrJoin)) {
      // Prioritize columns of the referenced table(s) (e.g. dns_query_logs)
      for (const t of primaryTables) {
        const filteredCols = filterTableColumns(t.columns || [], currentWord);
        for (const c of filteredCols) {
          items.push({
            label: c.name,
            insertText: formatSqlIdentifier(c.name),
            type: 'column',
            detail: `${t.name}.${c.name}`,
            meta: c.isPrimaryKey ? 'PK' : c.type || 'COLUMN',
            isPk: c.isPrimaryKey,
          });
        }
      }

      // If in WHERE, ON, or HAVING, suggest operators matching currentWord
      if (['WHERE', 'ON', 'HAVING'].includes(clauseType) && currentWord.length > 0) {
        const operators = ['IS NULL', 'IS NOT NULL', 'LIKE', 'IN', 'BETWEEN', 'AND', 'OR', 'NOT'];
        for (const op of operators) {
          if (op.toLowerCase().startsWith(currentWord) && op.toLowerCase() !== currentWord) {
            items.push({
              label: op,
              insertText: `${op} `,
              type: 'keyword',
              meta: 'OPERATOR',
            });
          }
        }
      }

      // If in SELECT list, suggest aggregate functions if typing
      if (clauseType === 'SELECT' && currentWord.length > 0) {
        const aggFuncs = ['COUNT(*)', 'COUNT()', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'DISTINCT '];
        for (const fn of aggFuncs) {
          if (fn.toLowerCase().startsWith(currentWord)) {
            items.push({
              label: fn,
              insertText: fn.includes('()') ? fn.replace(')', '') : `${fn} `,
              type: 'keyword',
              meta: 'FUNCTION',
            });
          }
        }
      }

      // If few results, also add columns from other available tables matching currentWord
      if (items.length < 50 && currentWord.length > 0) {
        for (const t of availableTables) {
          if (primaryTables.some((pt) => pt.name.toLowerCase() === t.name.toLowerCase())) {
            continue;
          }
          const filteredCols = filterTableColumns(t.columns || [], currentWord);
          for (const c of filteredCols) {
            items.push({
              label: c.name,
              insertText: formatSqlIdentifier(c.name),
              type: 'column',
              detail: `${t.name}.${c.name}`,
              meta: c.isPrimaryKey ? 'PK' : c.type || 'COLUMN',
              isPk: c.isPrimaryKey,
            });
          }
        }
      }
    }

    // 5. Tables Suggestion (typing after FROM/JOIN, or searching for tables)
    if (isFromOrJoin || (!isColumnClause && currentWord.length > 0)) {
      const matchingTables = availableTables.filter(
        (t) => !currentWord || t.name.toLowerCase().includes(currentWord)
      );

      // Smart sorting: exact matches first, startsWith second, then alphabetical
      matchingTables.sort((a, b) => {
        const aLow = a.name.toLowerCase();
        const bLow = b.name.toLowerCase();
        if (aLow === currentWord) return -1;
        if (bLow === currentWord) return 1;
        const aStarts = aLow.startsWith(currentWord);
        const bStarts = bLow.startsWith(currentWord);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aLow.localeCompare(bLow);
      });

      for (const t of matchingTables) {
        items.push({
          label: t.name,
          insertText: `${formatSqlIdentifier(t.name)} `,
          type: 'table',
          detail: `${t.rowCount || 0} rows`,
          meta: t.type || 'table',
        });
      }
    }

    // 6. SQL Keywords (matching currentWord)
    if (currentWord.length > 0) {
      for (const kw of SQL_KEYWORDS) {
        if (kw.toLowerCase().startsWith(currentWord) && kw.toLowerCase() !== currentWord) {
          items.push({
            label: kw,
            insertText: `${kw} `,
            type: 'keyword',
            meta: 'SQL',
          });
        }
      }
    }

    // Return up to 100 suggestions so all tables and columns can be scrolled and explored
    return items.slice(0, 100);
  }, [isTypingTriggered, query, cursorPos, availableTables, extendedSchema]);

  // Update popup coordinates based on cursor
  useEffect(() => {
    if (isTypingTriggered && autocompleteItems.length > 0 && textareaRef.current) {
      const linesBefore = query.slice(0, cursorPos).split('\n');
      const currentLine = linesBefore.length;
      const currentCol = linesBefore[linesBefore.length - 1].length;

      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;

      const top = Math.max(10, currentLine * 22 + 10 - scrollTop);
      const left = Math.max(50, currentCol * 7.8 + 48 - scrollLeft);

      setPopupPos({ top, left });
      setSelectedAutoIndex(0);
    } else {
      setPopupPos(null);
    }
  }, [isTypingTriggered, autocompleteItems.length, cursorPos, query]);

  const handleSelectAutocomplete = (item: AutocompleteItem) => {
    if (!textareaRef.current) return;
    const textBefore = query.slice(0, cursorPos);
    const dotContext = parseDotContext(textBefore, query, availableTables);

    const replaceLen = dotContext
      ? dotContext.replaceLength
      : (textBefore.match(/([a-zA-Z0-9_]+)$/)?.[1].length ?? 0);

    const start = cursorPos - replaceLen;
    const newQuery = query.slice(0, start) + item.insertText + query.slice(cursorPos);
    const newPos = start + item.insertText.length;

    setIsTypingTriggered(false);
    setPopupPos(null);
    applyTextEdit(newQuery, newPos, newPos, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMod = e.metaKey || e.ctrlKey;

    // 0. Manual Autocomplete Trigger: Ctrl+Space (VS Code standard)
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      setIsTypingTriggered(true);
      return;
    }

    // 1. Autocomplete Navigation
    if (popupPos && autocompleteItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAutoIndex((prev) => (prev + 1) % autocompleteItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAutoIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectAutocomplete(autocompleteItems[selectedAutoIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPopupPos(null);
        setIsTypingTriggered(false);
        return;
      }
    }

    // 2. Undo: ⌘Z (Mac) or Ctrl+Z (Windows/Linux)
    if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // 3. Redo: ⌘Shift+Z (Mac), Ctrl+Shift+Z (Linux/Win), or Ctrl+Y / ⌘Y (Win/Linux/Mac)
    if (
      (isMod && e.shiftKey && e.key.toLowerCase() === 'z') ||
      (isMod && !e.shiftKey && e.key.toLowerCase() === 'y')
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // 4. ⌘+Enter or Ctrl+Enter -> Execute Query (Shift for Dry Run)
    if (isMod && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onRunDryRun(getExecutableQuery());
      } else {
        onRunExecute(getExecutableQuery());
      }
      return;
    }

    // 5. Smart Enter with Auto-Indentation (VS Code style)
    if (e.key === 'Enter') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const linesBefore = query.slice(0, start).split('\n');
      const currentLine = linesBefore[linesBefore.length - 1];
      const match = currentLine.match(/^(\s+)/);
      const indent = match ? match[1] : '';

      // Check if cursor is between brackets e.g. ( | )
      const prevChar = query[start - 1];
      const nextChar = query[start];
      let extraIndent = '';
      let closingNewline = '';
      if (
        (prevChar === '(' && nextChar === ')') ||
        (prevChar === '[' && nextChar === ']') ||
        (prevChar === '{' && nextChar === '}')
      ) {
        extraIndent = '  ';
        closingNewline = `\n${indent}`;
      }

      const insertion = `\n${indent}${extraIndent}${closingNewline}`;
      const newQuery = query.slice(0, start) + insertion + query.slice(end);
      const newPos = start + 1 + indent.length + extraIndent.length;

      applyTextEdit(newQuery, newPos, newPos, true);
      setIsTypingTriggered(false);
      return;
    }

    // 6. Smart Bracket & Quote Auto-Closing (VS Code style)
    const PAIR_MAP: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      "'": "'",
      '"': '"',
      '`': '`',
    };

    if (PAIR_MAP[e.key]) {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const closeChar = PAIR_MAP[e.key];

      // If text is selected, wrap the selection!
      if (start !== end) {
        e.preventDefault();
        const selectedText = query.slice(start, end);
        const wrapped = `${e.key}${selectedText}${closeChar}`;
        const newQuery = query.slice(0, start) + wrapped + query.slice(end);
        applyTextEdit(newQuery, start + 1, end + 1, true);
        return;
      }

      // If typing quote when cursor is immediately before the same quote, just step over it
      if (start === end && (e.key === "'" || e.key === '"' || e.key === '`') && query[start] === e.key) {
        e.preventDefault();
        const nextPos = start + 1;
        setCursorPos(nextPos);
        if (textareaRef.current) textareaRef.current.setSelectionRange(nextPos, nextPos);
        return;
      }

      // Auto-insert closing pair
      e.preventDefault();
      const newQuery = query.slice(0, start) + e.key + closeChar + query.slice(end);
      applyTextEdit(newQuery, start + 1, start + 1, true);
      setIsTypingTriggered(true);
      return;
    }

    // Step over closing bracket if typed
    if ((e.key === ')' || e.key === ']' || e.key === '}') && query[e.currentTarget.selectionStart] === e.key) {
      e.preventDefault();
      const nextPos = e.currentTarget.selectionStart + 1;
      setCursorPos(nextPos);
      if (textareaRef.current) textareaRef.current.setSelectionRange(nextPos, nextPos);
      return;
    }

    // 7. Smart Backspace: delete closing pair together
    if (e.key === 'Backspace') {
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      if (start === end && start > 0) {
        const prev = query[start - 1];
        const next = query[start];
        if (
          (prev === '(' && next === ')') ||
          (prev === '[' && next === ']') ||
          (prev === '{' && next === '}') ||
          (prev === "'" && next === "'") ||
          (prev === '"' && next === '"') ||
          (prev === '`' && next === '`')
        ) {
          e.preventDefault();
          const newQuery = query.slice(0, start - 1) + query.slice(start + 1);
          applyTextEdit(newQuery, start - 1, start - 1, true);
          return;
        }
      }
    }

    // 8. Toggle Line Comment: ⌘/ or Ctrl+/
    if (isMod && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = toggleComment(query, start, end);
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 9. Indentation (Tab: 2 spaces or Indent) / Shift+Tab (Outdent)
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      if (start === end && !e.shiftKey) {
        const newQuery = query.slice(0, start) + '  ' + query.slice(end);
        applyTextEdit(newQuery, start + 2, start + 2, true);
      } else {
        const res = indentLines(query, start, end, e.shiftKey);
        applyTextEdit(res.text, res.newStart, res.newEnd, true);
      }
      return;
    }

    // 10. Format SQL: ⌘Shift+F, Ctrl+Shift+F, or Alt+Shift+F
    if (
      (isMod && e.shiftKey && e.key.toLowerCase() === 'f') ||
      (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f')
    ) {
      e.preventDefault();
      formatSql();
      return;
    }

    // 11. Duplicate Line or Selection: ⌘D or Ctrl+D, or Shift+Alt+ArrowDown
    if (
      (isMod && e.key.toLowerCase() === 'd' && !e.shiftKey) ||
      (e.shiftKey && e.altKey && e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = duplicateLine(query, start, end);
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 12. Move Line Up: Alt+ArrowUp / Option+ArrowUp
    if (e.altKey && !e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = moveLines(query, start, end, 'up');
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 13. Move Line Down: Alt+ArrowDown / Option+ArrowDown
    if (e.altKey && !e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = moveLines(query, start, end, 'down');
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 14. Select All: ⌘A or Ctrl+A (explicit fallback)
    if (isMod && e.key.toLowerCase() === 'a' && !e.shiftKey && !e.altKey) {
      e.currentTarget.select();
      return;
    }

    // 15. Explain Plan: ⌘E or Ctrl+E (when Visual Plan is enabled)
    if (SHOW_VISUAL_PLAN && isMod && e.key.toLowerCase() === 'e' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onRunExplain(getExecutableQuery());
      return;
    }
  };

  const handleExecute = () => {
    onRunExecute(getExecutableQuery());
  };

  const handleDryRun = () => {
    onRunDryRun(getExecutableQuery());
  };

  const handleExplain = () => {
    onRunExplain(getExecutableQuery());
  };

  const insertSnippet = (snippet: string) => {
    if (!textareaRef.current) {
      const nextQuery = query ? `${query} ${snippet}` : snippet;
      applyTextEdit(nextQuery, nextQuery.length, nextQuery.length, true);
      return;
    }
    const { selectionStart, selectionEnd } = textareaRef.current;
    const newQuery = query.slice(0, selectionStart) + snippet + query.slice(selectionEnd);
    const nextPos = selectionStart + snippet.length;
    applyTextEdit(newQuery, nextPos, nextPos, true);
  };

  return (
    <div className="flex flex-col border-b border-border/70 bg-card/40 backdrop-blur-xs relative flex-1 min-h-0 h-full">
      {/* Editor Action Toolbar */}
      <div className="h-10 px-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 select-none shrink-0 overflow-x-auto no-scrollbar flex-nowrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={!hasValidTarget || isExecuting}
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs shrink-0"
            title={isMac ? "Execute query and commit changes (⌘Enter)" : "Execute query and commit changes (Ctrl+Enter)"}
          >
            <Play className="size-3 fill-white" />
            <span>{isExecuting ? 'Running...' : hasSelection ? 'Run Selection' : 'Execute'}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-emerald-700/60 px-1 py-0.2 rounded font-mono">
              {isMac ? '⌘↵' : 'Ctrl+↵'}
            </kbd>
          </Button>

          {isExecuting && (
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelExecution}
              className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-500 text-white font-medium shadow-xs animate-pulse shrink-0"
              title="Cancel execution"
            >
              <XCircle className="size-3" />
              <span>Cancel</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleDryRun}
            disabled={!hasValidTarget || isSimulating || isExecuting}
            className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium shrink-0"
            title={
              isMac
                ? "Simulate mutating query in safe rollback transaction sandbox (⌘⇧Enter)"
                : "Simulate mutating query in safe rollback transaction sandbox (Ctrl+Shift+Enter)"
            }
          >
            <ShieldAlert className="size-3 text-amber-400" />
            <span>{isSimulating ? 'Simulating...' : 'Dry Run'}</span>
          </Button>

          {SHOW_VISUAL_PLAN && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExplain}
              disabled={!hasValidTarget || isExplaining || isExecuting}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              title="Inspect visual execution plan tree"
            >
              <Search className="size-3" />
              <span>Explain<span className="hidden md:inline"> Plan</span></span>
            </Button>
          )}

          {/* Divider */}
          <div className="h-4 w-[1px] bg-border/60 mx-1 shrink-0" />

          {/* Target Database Selector Button */}
          <div className="shrink-0">
            <button
              ref={dbButtonRef}
              type="button"
              onClick={handleToggleDbMenu}
              className={`h-7 px-2.5 rounded-md border text-xs font-mono flex items-center gap-1.5 transition-all text-foreground shrink-0 cursor-pointer ${
                isDbMenuOpen
                  ? 'border-primary/60 bg-primary/10 shadow-xs'
                  : 'border-border/60 bg-muted/30 hover:bg-muted/60'
              }`}
              title={
                activeDb
                  ? `Active Database: ${activeDb.name} (${activeDb.type}) - Click to switch target database`
                  : 'No database selected - Click to select a target database'
              }
            >
              <Database className={`size-3 shrink-0 ${activeDb ? 'text-sky-400' : 'text-amber-400'}`} />
              <span className="font-semibold max-w-[130px] truncate">
                {activeDb?.name || 'Select Database'}
              </span>
              {activeDb ? (
                <Badge
                  variant="outline"
                  className="text-[9px] font-sans px-1 py-0 h-4 border-sky-500/30 text-sky-400 bg-sky-500/10 uppercase"
                >
                  {activeDb.type === 'shared_preferences' ? 'Prefs' : activeDb.type}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[9px] font-sans px-1 py-0 h-4 border-amber-500/30 text-amber-400 bg-amber-500/10"
                >
                  None
                </Badge>
              )}
              <ChevronDown
                className={`size-3 text-muted-foreground ml-0.5 transition-transform duration-150 ${
                  isDbMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {/* Floating Dropdown Over the Entire Screen (Portal) */}
          {isDbMenuOpen && menuCoords && typeof document !== 'undefined' && createPortal(
            <div
              ref={dbMenuRef}
              style={{
                position: 'fixed',
                top: `${menuCoords.top}px`,
                left: `${menuCoords.left}px`,
                width: `${menuCoords.width}px`,
                maxHeight: 'min(440px, calc(100vh - 70px))',
              }}
              className="z-[9999] rounded-xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/60 py-1.5 text-xs select-none flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/40 flex items-center justify-between shrink-0 bg-muted/20">
                <span className="flex items-center gap-1.5">
                  <Database className="size-3 text-sky-400" />
                  <span>Select Target Database</span>
                </span>
                <span className="text-muted-foreground/70 font-mono text-[9px] bg-muted/60 px-1.5 py-0.2 rounded">
                  {databases.length} {databases.length === 1 ? 'database' : 'databases'}
                </span>
              </div>

              <div
                onWheel={(e) => e.stopPropagation()}
                className="overflow-y-auto flex-1 p-1.5 space-y-1 overscroll-contain"
              >
                {isLoadingDatabases || isLoadingApps || isInitialLoading ? (
                  <div className="px-3 py-6 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-4 text-primary animate-spin" />
                    <span>Discovering databases...</span>
                  </div>
                ) : databases.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-muted-foreground italic text-center">
                    No databases discovered in this app
                  </div>
                ) : (
                  databases.map((db) => {
                    const isSelected = db.id === selectedDbId;
                    return (
                      <button
                        key={db.id}
                        type="button"
                        onClick={() => handleSelectDatabase(db.id)}
                        className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-medium border border-primary/30 shadow-xs'
                            : 'hover:bg-muted/60 text-foreground border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`p-1.5 rounded-md shrink-0 ${
                              isSelected ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'
                            }`}
                          >
                            <Database className="size-3.5" />
                          </div>
                          <div className="min-w-0 truncate flex-1">
                            <div className="text-xs truncate font-mono font-medium">{db.name}</div>
                            <div className="text-[10px] text-muted-foreground font-sans flex items-center gap-1.5 mt-0.5">
                              <span className="uppercase font-semibold text-[9px] px-1 py-0 rounded bg-muted/80 text-muted-foreground/90">
                                {db.type === 'shared_preferences' ? 'Prefs' : db.type}
                              </span>
                              <span>•</span>
                              <span>{db.tables.length} tables</span>
                              {db.sizeBytes > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{formatBytes(db.sizeBytes)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="size-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <Check className="size-3 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Quick SQL Snippets & Tools */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick SQL Snippets on Wide Screens (xl+) */}
          <div className="hidden xl:flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertSnippet('SELECT * FROM ')}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              SELECT *
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('COUNT(*) ')}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              COUNT(*)
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('WHERE ')}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              WHERE
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('ORDER BY id DESC ')}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              ORDER BY
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('LIMIT 50;')}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              LIMIT 50
            </button>
          </div>

          {/* Snippets Dropdown on Narrower Screens (< xl) */}
          <div className="relative xl:hidden" ref={snippetsMenuRef}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsSnippetsMenuOpen((v) => !v)}
              title="Insert SQL snippets"
              className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground hover:text-foreground font-mono shrink-0"
            >
              <Code2 className="size-3 text-sky-400" />
              <span>Snippets</span>
              <ChevronDown className="size-2.5 opacity-60" />
            </Button>

            {isSnippetsMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-border/80 bg-popover/95 backdrop-blur-md p-1 shadow-lg z-50 text-xs font-mono animate-in fade-in zoom-in-95">
                {[
                  { label: 'SELECT * FROM ...', snippet: 'SELECT * FROM ' },
                  { label: 'COUNT(*)', snippet: 'COUNT(*) ' },
                  { label: 'WHERE ...', snippet: 'WHERE ' },
                  { label: 'ORDER BY id DESC', snippet: 'ORDER BY id DESC ' },
                  { label: 'LIMIT 50;', snippet: 'LIMIT 50;' },
                ].map((s) => (
                  <button
                    key={s.snippet}
                    type="button"
                    onClick={() => {
                      insertSnippet(s.snippet);
                      setIsSnippetsMenuOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-[11px] transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-3.5 bg-border/60 mx-1 shrink-0" />

          {/* Undo Button */}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleUndo}
            disabled={!canUndo}
            title={isMac ? "Undo edit (⌘Z)" : "Undo edit (Ctrl+Z)"}
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none shrink-0"
          >
            <Undo2 className="size-3.5" />
          </Button>

          {/* Redo Button */}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleRedo}
            disabled={!canRedo}
            title={isMac ? "Redo edit (⌘⇧Z)" : "Redo edit (Ctrl+Y or Ctrl+Shift+Z)"}
            className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none shrink-0"
          >
            <Redo2 className="size-3.5" />
          </Button>

          {/* Format Query Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={formatSql}
            title={isMac ? "Format SQL query (⌘⇧F)" : "Format SQL query (Ctrl+Shift+F)"}
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground font-mono shrink-0"
          >
            <Wand2 className="size-3 text-sky-400" />
            <span className="hidden sm:inline">Format</span>
          </Button>

          {/* Shortcuts Reference Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard shortcuts reference (⌘/ or Ctrl+/)"
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground font-mono shrink-0"
          >
            <Keyboard className="size-3 text-sky-400" />
            <span className="hidden sm:inline">Shortcuts</span>
          </Button>

          {/* Clear Editor Button */}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => applyTextEdit('', 0, 0, true)}
            title="Clear Editor"
            className="size-6 text-muted-foreground hover:text-foreground shrink-0"
          >
            <Eraser className="size-3" />
          </Button>
        </div>
      </div>

      {/* Code Textarea & Gutter with Overlaid Real-Time Syntax Highlighting */}
      <div className="flex flex-1 min-h-[140px] overflow-hidden relative font-mono text-[13px] bg-background">
        {/* Line Numbers Gutter (VS Code style) */}
        <div
          ref={gutterRef}
          className="w-11 select-none py-2 bg-muted/20 border-r border-border/50 text-right pr-2.5 text-[12px] shrink-0 overflow-hidden font-mono"
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={`h-[22px] leading-[22px] transition-colors ${
                i === currentLineIndex ? 'text-foreground font-bold' : 'text-muted-foreground/35'
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea & Highlighting Stack */}
        <div className="flex-1 relative overflow-hidden h-full">
          {/* Active Line Background Highlight (VS Code style) */}
          <div
            className="absolute left-0 right-0 pointer-events-none bg-primary/[0.04] border-y border-primary/10 transition-all duration-75"
            style={{
              top: `${currentLineIndex * 22 + 8}px`,
              height: '22px',
            }}
          />

          {/* Syntax Highlighting Background Layer */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 p-[8px_12px] m-0 bg-transparent pointer-events-none font-mono text-[13px] leading-[22px] whitespace-pre overflow-hidden select-none"
            style={{ tabSize: 2 }}
          >
            <code>
              {highlightedTokens}
              {query.endsWith('\n') ? ' ' : ''}
            </code>
          </pre>

          {/* Interactive Foreground Textarea */}
          <textarea
            ref={textareaRef}
            value={query}
            onChange={handleTextareaChange}
            onScroll={handleScroll}
            onMouseDown={handleTextareaMouseDown}
            onClick={handleTextareaClick}
            onKeyUp={updateSelectionState}
            onSelect={updateSelectionState}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL statement (e.g. SELECT * FROM users WHERE active = 1 ORDER BY id DESC LIMIT 50;)"
            spellCheck={false}
            className="absolute inset-0 p-[8px_12px] m-0 w-full h-full bg-transparent text-transparent caret-sky-600 dark:caret-sky-400 selection:bg-sky-500/25 selection:text-transparent placeholder:text-muted-foreground/40 resize-none outline-none font-mono text-[13px] leading-[22px] whitespace-pre select-text z-10"
            style={{ tabSize: 2 }}
          />

          {/* Autocomplete Popup */}
          {popupPos && (
            <AutocompletePopup
              items={autocompleteItems}
              selectedIndex={selectedAutoIndex}
              onSelect={handleSelectAutocomplete}
              position={popupPos}
            />
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
