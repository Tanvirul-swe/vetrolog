import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  ShieldAlert,
  Search,
  Eraser,
  XCircle,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutocompletePopup, AutocompleteItem } from './AutocompletePopup';
import { predictJoins } from '../services/joinPredictor';
import { highlightSql } from '../services/sqlHighlighter';
import { formatSqlIdentifier } from '../services/sqlIdentifier';
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
  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const isExecuting = usePlaygroundStore((s) => s.isExecuting);
  const isSimulating = usePlaygroundStore((s) => s.isSimulating);
  const isExplaining = usePlaygroundStore((s) => s.isExplaining);
  const cancelExecution = usePlaygroundStore((s) => s.cancelExecution);
  const formatSql = usePlaygroundStore((s) => s.formatSql);

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
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/);
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
  }, [query, cursorPos, availableTables]);

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
    const lastWordMatch = textBefore.match(/([a-zA-Z0-9_.]+)$/);
    const replaceLen = lastWordMatch ? lastWordMatch[1].length : 0;

    const start = cursorPos - replaceLen;
    const newQuery = query.slice(0, start) + item.insertText + query.slice(cursorPos);
    setQuery(newQuery);

    const newPos = start + item.insertText.length;
    setCursorPos(newPos);
    setPopupPos(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
        handleScroll();
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete Navigation
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

    // ⌘+Enter or Ctrl+Enter -> Execute Query
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onRunDryRun(getExecutableQuery());
      } else {
        onRunExecute(getExecutableQuery());
      }
      return;
    }

    // Tab key -> Insert 2 spaces
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newQuery = query.substring(0, start) + '  ' + query.substring(end);
      setQuery(newQuery);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          handleScroll();
        }
      }, 0);
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
      setQuery(query ? `${query} ${snippet}` : snippet);
      return;
    }
    const { selectionStart, selectionEnd } = textareaRef.current;
    const newQuery = query.slice(0, selectionStart) + snippet + query.slice(selectionEnd);
    setQuery(newQuery);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = selectionStart + snippet.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
        setCursorPos(nextPos);
        handleScroll();
      }
    }, 10);
  };

  return (
    <div className="flex flex-col border-b border-border/70 bg-card/40 backdrop-blur-xs relative flex-1 min-h-0 h-full">
      {/* Editor Action Toolbar */}
      <div className="h-10 px-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 select-none shrink-0">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={!selectedDbId || !query.trim() || isExecuting}
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
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
              className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-500 text-white font-medium shadow-xs animate-pulse"
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
            className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-medium"
            title="Simulate mutating query in safe rollback transaction sandbox (⌘⇧Enter)"
          >
            <ShieldAlert className="size-3 text-amber-400" />
            <span>{isSimulating ? 'Simulating...' : 'Dry Run'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExplain}
            disabled={!selectedDbId || !query.trim() || isExplaining || isExecuting}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            title="Inspect visual execution plan tree"
          >
            <Search className="size-3" />
            <span>Explain Plan</span>
          </Button>
        </div>

        {/* Quick SQL Snippets */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => insertSnippet('SELECT * FROM ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            SELECT *
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('COUNT(*) ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            COUNT(*)
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('WHERE ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            WHERE
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('ORDER BY id DESC ')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            ORDER BY
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('LIMIT 50;')}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            LIMIT 50
          </button>

          <div className="w-px h-3.5 bg-border/60 mx-1" />

          <Button
            size="sm"
            variant="ghost"
            onClick={formatSql}
            title="Format SQL query"
            className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground font-mono"
          >
            <Wand2 className="size-3 text-sky-400" />
            <span>Format</span>
          </Button>

          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setQuery('')}
            title="Clear Editor"
            className="size-6 text-muted-foreground hover:text-foreground"
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
            onChange={(e) => {
              setQuery(e.target.value);
              updateSelectionState();
            }}
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
    </div>
  );
}
