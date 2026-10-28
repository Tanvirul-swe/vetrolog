import React, { useState, useEffect, useMemo } from 'react';
import { X, Keyboard, Command, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
}

// Feature flag: Visual Plan temporarily hidden per user request
const SHOW_VISUAL_PLAN = false;

const SHORTCUTS: ShortcutItem[] = [
  // Execution
  { keys: ['⌘', '↵'], description: 'Execute query or selection (Mac)', category: 'Execution' },
  { keys: ['Ctrl', '↵'], description: 'Execute query or selection (Win/Linux)', category: 'Execution' },
  { keys: ['⌘', '⇧', '↵'], description: 'Dry Run rollback transaction (Mac)', category: 'Execution' },
  { keys: ['Ctrl', '⇧', '↵'], description: 'Dry Run rollback transaction (Win/Linux)', category: 'Execution' },
  ...(SHOW_VISUAL_PLAN
    ? [{ keys: ['⌘', 'E'], description: 'Explain visual query plan', category: 'Execution' }]
    : []),

  // Editing
  { keys: ['↵'], description: 'Smart auto-indent new line', category: 'Editing' },
  { keys: ['(', "'", '"', '`'], description: 'Auto-pair quotes & brackets (or wrap selection)', category: 'Editing' },
  { keys: ['⌘', '/'], description: 'Toggle line or block comment (Mac)', category: 'Editing' },
  { keys: ['Ctrl', '/'], description: 'Toggle line or block comment (Win/Linux)', category: 'Editing' },
  { keys: ['Tab'], description: 'Indent line or block by 2 spaces', category: 'Editing' },
  { keys: ['⇧', 'Tab'], description: 'Outdent line or block by 2 spaces', category: 'Editing' },
  { keys: ['⌥', '↑ / ↓'], description: 'Move line or selection up / down (Mac)', category: 'Editing' },
  { keys: ['Alt', '↑ / ↓'], description: 'Move line up / down (Win/Linux)', category: 'Editing' },
  { keys: ['⌘', 'D'], description: 'Duplicate line or selection (Mac)', category: 'Editing' },
  { keys: ['Ctrl', 'D'], description: 'Duplicate line or selection (Win/Linux)', category: 'Editing' },
  { keys: ['⌘', '⇧', 'F'], description: 'Auto-format SQL query (Mac)', category: 'Editing' },
  { keys: ['Ctrl', '⇧', 'F'], description: 'Auto-format SQL query (Win/Linux)', category: 'Editing' },
  { keys: ['Alt', '⇧', 'F'], description: 'Format SQL (VS Code style on Win/Linux)', category: 'Editing' },

  // History & Undo / Redo
  { keys: ['⌘', 'Z'], description: 'Undo last edit or format (Mac)', category: 'History & Select' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last edit or format (Win/Linux)', category: 'History & Select' },
  { keys: ['Ctrl', 'Y'], description: 'Redo change (Windows/Linux standard)', category: 'History & Select' },
  { keys: ['Ctrl', '⇧', 'Z'], description: 'Redo change (Linux & Windows / VS Code)', category: 'History & Select' },
  { keys: ['⌘', '⇧', 'Z'], description: 'Redo change (Mac)', category: 'History & Select' },
  { keys: ['⌘', 'A'], description: 'Select all SQL text (Ctrl+A on Win/Linux)', category: 'History & Select' },

  // Navigation & Tabs
  { keys: ['⌘', 'T'], description: 'New Query Tab (Ctrl+T on Win/Linux)', category: 'Tabs & Navigation' },
  { keys: ['⌘', 'W'], description: 'Close active query tab (Ctrl+W on Win/Linux)', category: 'Tabs & Navigation' },
  { keys: ['Ctrl', 'Tab'], description: 'Cycle next / previous query tab', category: 'Tabs & Navigation' },
  { keys: ['⌘', '1-9'], description: 'Jump directly to tab index (Alt+1-9 on Win/Linux)', category: 'Tabs & Navigation' },

  // Autocomplete
  { keys: ['Ctrl', 'Space'], description: 'Trigger autocomplete suggestions', category: 'Smart Autocomplete' },
  { keys: ['.'], description: 'Dot after table/alias: auto-suggest columns', category: 'Smart Autocomplete' },
  { keys: ['↑', '↓'], description: 'Navigate suggestion list', category: 'Smart Autocomplete' },
  { keys: ['Tab', '↵'], description: 'Accept active suggestion', category: 'Smart Autocomplete' },
  { keys: ['Esc'], description: 'Dismiss autocomplete popup', category: 'Smart Autocomplete' },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const [search, setSearch] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter shortcuts based on user search
  const filteredShortcuts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q))
    );
  }, [search]);

  const categories = useMemo(() => {
    return Array.from(new Set(filteredShortcuts.map((s) => s.category)));
  }, [filteredShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl sm:max-w-3xl bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
              <Keyboard className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground">Keyboard Shortcuts</h3>
                <span className="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded font-mono shrink-0 border border-border/40">
                  Mac · Windows · Linux
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            title="Close (Esc)"
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border/40 bg-muted/10 shrink-0">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts (e.g. comment, run, indent, tab, undo)..."
              className="w-full h-8 pl-9 pr-3 text-xs rounded-md bg-background border border-border/60 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30"
              autoFocus
            />
          </div>
        </div>

        {/* Content list by category with responsive grid */}
        <div className="p-4 overflow-y-auto space-y-4 font-mono text-xs flex-1 min-h-0">
          {categories.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-sans text-xs">
              No shortcuts found matching &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {categories.map((category) => (
                <div key={category} className="space-y-1.5 flex flex-col">
                  <h4 className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider font-sans">
                    {category}
                  </h4>
                  <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden flex-1">
                    {filteredShortcuts
                      .filter((s) => s.category === category)
                      .map((shortcut, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/40 transition-colors"
                        >
                          <span
                            className="text-foreground/90 font-sans text-xs min-w-0"
                            title={shortcut.description}
                          >
                            {shortcut.description}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {shortcut.keys.map((k, kIdx) => (
                              <kbd
                                key={kIdx}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-muted/90 border border-border/80 shadow-2xs text-muted-foreground font-mono font-medium"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-3 text-xs text-muted-foreground shrink-0 font-sans">
          <div className="flex items-center gap-1.5 text-[11px] min-w-0">
            <Command className="size-3 text-sky-400 shrink-0" />
            <span className="truncate">
              On Windows & Linux, use <b className="text-foreground">Ctrl</b> instead of <b className="text-foreground">⌘</b>
            </span>
          </div>
          <Button
            size="sm"
            variant="default"
            onClick={onClose}
            className="h-7 text-xs px-3.5 bg-sky-600 hover:bg-sky-500 text-white shrink-0 font-medium"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
