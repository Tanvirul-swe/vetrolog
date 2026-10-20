import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutocompletePopup, AutocompleteItem } from './AutocompletePopup';
import { ShortcutsModal } from './ShortcutsModal';
import { predictJoins } from '../services/joinPredictor';
import { highlightSql } from '../services/sqlHighlighter';
import { formatSqlIdentifier } from '../services/sqlIdentifier';
import { parseDotContext, filterTableColumns } from '../services/sqlContextParser';
import {
  toggleComment,
  indentLines,
  duplicateLine,
  moveLines,
} from '../services/editorShortcuts';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

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

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSnippetsMenuOpen, setIsSnippetsMenuOpen] = useState(false);
  const snippetsMenuRef = useRef<HTMLDivElement>(null);

  // Close snippets menu when clicking outside
  useEffect(() => {
    if (!isSnippetsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (snippetsMenuRef.current && !snippetsMenuRef.current.contains(e.target as Node)) {
        setIsSnippetsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSnippetsMenuOpen]);

  const databases = useDatabaseStore((s) => s.databases);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const activeDb = useMemo(() => databases.find((d) => d.id === selectedDbId), [databases, selectedDbId]);

  // Combine extendedSchema with activeDb.tables to guarantee all tables are always available
  const availableTables = useMemo(() => {
    if (extendedSchema?.tables && extendedSchema.tables.length > 0) {
      return extendedSchema.tables;
    }
    return activeDb?.tables || [];
  }, [extendedSchema, activeDb]);

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

  // Undo / Redo History Stack per query tab
  const historyRef = useRef<{ text: string; cursorStart: number; cursorEnd: number }[]>([
    { text: query, cursorStart: 0, cursorEnd: 0 },
  ]);
  const historyIdxRef = useRef<number>(0);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTabIdRef = useRef<string>(activeTabId);

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
        if (newHistory.length > 100) newHistory.shift();
        historyRef.current = newHistory;
        historyIdxRef.current = newHistory.length - 1;
      }
    },
    [setQuery]
  );

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current -= 1;
      const snap = historyRef.current[historyIdxRef.current];
      isUndoRedoActionRef.current = true;
      applyTextEdit(snap.text, snap.cursorStart, snap.cursorEnd, false);
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 50);
    }
  }, [applyTextEdit]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current += 1;
      const snap = historyRef.current[historyIdxRef.current];
      isUndoRedoActionRef.current = true;
      applyTextEdit(snap.text, snap.cursorStart, snap.cursorEnd, false);
      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 50);
    }
  }, [applyTextEdit]);

  // Reset history stack when active query tab changes
  useEffect(() => {
    if (prevTabIdRef.current !== activeTabId) {
      prevTabIdRef.current = activeTabId;
      historyRef.current = [{ text: query, cursorStart: 0, cursorEnd: 0 }];
      historyIdxRef.current = 0;
    }
  }, [activeTabId, query]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    setQuery(val);
    setHasSelection(start !== end);
    setCursorPos(start);

    if (!isUndoRedoActionRef.current) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        const newHistory = historyRef.current.slice(0, historyIdxRef.current + 1);
        newHistory.push({ text: val, cursorStart: start, cursorEnd: end });
        if (newHistory.length > 100) newHistory.shift();
        historyRef.current = newHistory;
        historyIdxRef.current = newHistory.length - 1;
      }, 350);
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

  // Split lines for line numbers
  const lines = useMemo(() => query.split('\n'), [query]);

  // Real-time SQL syntax highlighting
  const highlightedTokens = useMemo(() => {
    return highlightSql(query, tableSet, columnSet);
  }, [query, tableSet, columnSet]);

  // Contextual autocomplete calculation
  const autocompleteItems = useMemo<AutocompleteItem[]>(() => {
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

    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_]+)$/);
    const currentWord = lastWordMatch ? lastWordMatch[1].toLowerCase() : '';

    // Check if typing after JOIN or FROM
    const isJoinContext = /(?:JOIN|FROM)\s+([a-zA-Z0-9_]*)$/i.test(textBefore);
    const isOnContext = /JOIN\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]*)$/i.test(textBefore);

    const items: AutocompleteItem[] = [];

    // 1. Join Predictor (Typing after JOIN table ON)
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

    // 2. Tables Suggestion (all available tables with relevance sorting)
    if (isJoinContext || currentWord.length > 0) {
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

    // 3. Columns Suggestion (Match all columns across active tables)
    if (currentWord.length > 0) {
      for (const t of availableTables) {
        for (const c of t.columns || []) {
          if (c.name.toLowerCase().includes(currentWord)) {
            items.push({
              label: `${c.name}`,
              insertText: formatSqlIdentifier(c.name),
              type: 'column',
              detail: `${t.name}.${c.name}`,
              meta: c.type,
              isPk: c.isPrimaryKey,
            });
          }
        }
      }
    }

    // 4. SQL Keywords
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

    // Return up to 100 suggestions so all tables can be scrolled and explored
    return items.slice(0, 100);
  }, [query, cursorPos, availableTables, extendedSchema]);

  // Update popup coordinates based on cursor
  useEffect(() => {
    if (autocompleteItems.length > 0 && textareaRef.current) {
      const linesBefore = query.slice(0, cursorPos).split('\n');
      const currentLine = linesBefore.length;
      const currentCol = linesBefore[linesBefore.length - 1].length;

      const top = Math.min(220, currentLine * 20 + 35);
      const left = Math.min(400, Math.max(50, currentCol * 7 + 40));

      setPopupPos({ top, left });
      setSelectedAutoIndex(0);
    } else {
      setPopupPos(null);
    }
  }, [autocompleteItems.length, cursorPos, query]);

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

    setPopupPos(null);
    applyTextEdit(newQuery, newPos, newPos, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMod = e.metaKey || e.ctrlKey;

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
        return;
      }
    }

    // 2. Undo: ⌘Z or Ctrl+Z
    if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // 3. Redo: ⌘Shift+Z, Ctrl+Shift+Z, or Ctrl+Y
    if (
      (isMod && e.shiftKey && e.key.toLowerCase() === 'z') ||
      (!e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'y')
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

    // 5. Toggle Line Comment: ⌘/ or Ctrl+/
    if (isMod && (e.key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = toggleComment(query, start, end);
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 6. Indentation (Tab) and Outdentation (Shift+Tab)
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = indentLines(query, start, end, e.shiftKey);
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 7. Format SQL: ⌘Shift+F, Ctrl+Shift+F, or Alt+Shift+F
    if (
      (isMod && e.shiftKey && e.key.toLowerCase() === 'f') ||
      (e.altKey && e.shiftKey && e.key.toLowerCase() === 'f')
    ) {
      e.preventDefault();
      formatSql();
      return;
    }

    // 8. Duplicate Line or Selection: ⌘D or Ctrl+D, or Shift+Alt+ArrowDown
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

    // 9. Move Line Up: Alt+ArrowUp / Option+ArrowUp
    if (e.altKey && !e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = moveLines(query, start, end, 'up');
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 10. Move Line Down: Alt+ArrowDown / Option+ArrowDown
    if (e.altKey && !e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const res = moveLines(query, start, end, 'down');
      applyTextEdit(res.text, res.newStart, res.newEnd);
      return;
    }

    // 11. Select All: ⌘A or Ctrl+A (explicit fallback)
    if (isMod && e.key.toLowerCase() === 'a' && !e.shiftKey && !e.altKey) {
      e.currentTarget.select();
      return;
    }

    // 12. Explain Plan: ⌘E or Ctrl+E (when Visual Plan is enabled)
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
            disabled={!selectedDbId || !query.trim() || isExecuting}
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs shrink-0"
            title="Execute query and commit changes (⌘Enter)"
          >
            <Play className="size-3 fill-white" />
            <span>{isExecuting ? 'Running...' : hasSelection ? 'Run Selection' : 'Execute'}</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-emerald-700/60 px-1 py-0.2 rounded font-mono">
              ⌘↵
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
            disabled={!selectedDbId || !query.trim() || isSimulating || isExecuting}
            className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium shrink-0"
            title="Simulate mutating query in safe rollback transaction sandbox (⌘⇧Enter)"
          >
            <ShieldAlert className="size-3 text-amber-400" />
            <span>{isSimulating ? 'Simulating...' : 'Dry Run'}</span>
          </Button>

          {SHOW_VISUAL_PLAN && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExplain}
              disabled={!selectedDbId || !query.trim() || isExplaining || isExecuting}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
              title="Inspect visual execution plan tree"
            >
              <Search className="size-3" />
              <span>Explain<span className="hidden md:inline"> Plan</span></span>
            </Button>
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

          {/* Format Query Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={formatSql}
            title="Format SQL query (⌘⇧F / Ctrl+⇧F)"
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
            title="Keyboard shortcuts reference (⌘/)"
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
      <div className="flex flex-1 min-h-[90px] overflow-hidden relative font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          className="w-10 select-none py-2 bg-muted/30 border-r border-border/40 text-muted-foreground/40 text-right pr-2 text-[11px] leading-5 shrink-0 overflow-hidden font-mono"
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea & Highlighting Stack */}
        <div className="flex-1 relative overflow-hidden h-full">
          {/* Syntax Highlighting Background Layer */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 p-2 m-0 bg-transparent pointer-events-none font-mono text-xs leading-5 whitespace-pre-wrap break-words overflow-hidden select-none"
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
            onClick={updateSelectionState}
            onKeyUp={updateSelectionState}
            onSelect={updateSelectionState}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL statement (e.g. SELECT * FROM users WHERE active = 1 ORDER BY id DESC LIMIT 50;)"
            spellCheck={false}
            className="absolute inset-0 p-2 m-0 w-full h-full bg-transparent text-transparent caret-sky-400 selection:bg-sky-500/30 selection:text-transparent placeholder:text-muted-foreground/40 resize-none outline-none font-mono text-xs leading-5 whitespace-pre-wrap break-words select-text z-10"
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
