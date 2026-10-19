import React, { useState, useRef, useEffect } from 'react';
import {
  Code2,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Edit3,
  XCircle,
  ArrowRightToLine,
} from 'lucide-react';
import { usePlaygroundStore, QueryTab } from '@/stores/usePlaygroundStore';

export function QueryTabStrip() {
  const tabs = usePlaygroundStore((s) => s.tabs);
  const activeTabId = usePlaygroundStore((s) => s.activeTabId);
  const addTab = usePlaygroundStore((s) => s.addTab);
  const closeTab = usePlaygroundStore((s) => s.closeTab);
  const closeOtherTabs = usePlaygroundStore((s) => s.closeOtherTabs);
  const closeTabsToTheRight = usePlaygroundStore((s) => s.closeTabsToTheRight);
  const duplicateTab = usePlaygroundStore((s) => s.duplicateTab);
  const renameTab = usePlaygroundStore((s) => s.renameTab);
  const setActiveTabId = usePlaygroundStore((s) => s.setActiveTabId);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Focus rename input on start
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Close context menu on outside click
  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const handleStartRename = (tab: QueryTab) => {
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
    setContextMenu(null);
  };

  const handleFinishRename = (tabId: string) => {
    if (editingTabId === tabId) {
      renameTab(tabId, editingTitle);
      setEditingTabId(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      tabId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div
      ref={containerRef}
      className="h-9 border-b border-border/70 bg-muted/20 flex items-center px-2 gap-1 overflow-x-auto no-scrollbar select-none relative shrink-0"
    >
      {/* Scrollable Tabs List */}
      <div className="flex items-center gap-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onAuxClick={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              className={`group relative flex items-center gap-1.5 h-7 px-2.5 rounded-t-md text-xs font-mono transition-all cursor-pointer select-none max-w-[200px] min-w-[100px] border ${
                isActive
                  ? 'bg-card text-foreground border-border/80 shadow-xs font-medium border-b-transparent -mb-[1px] z-10'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent'
              }`}
              title={`${tab.title} (Double-click to rename, middle-click to close)`}
            >
              {/* Tab Status Icon */}
              {tab.isExecuting ? (
                <Loader2 className="size-3 text-sky-400 animate-spin shrink-0" />
              ) : tab.result?.error ? (
                <AlertCircle className="size-3 text-red-400 shrink-0" />
              ) : tab.result?.success ? (
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
              ) : (
                <Code2 className="size-3 text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground" />
              )}

              {/* Title or Inline Edit Input */}
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleFinishRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFinishRename(tab.id);
                    } else if (e.key === 'Escape') {
                      setEditingTabId(null);
                    }
                  }}
                  className="bg-background text-foreground px-1 py-0.5 rounded text-xs outline-none border border-primary/50 w-full font-mono"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleStartRename(tab);
                  }}
                  className="truncate text-[11px] flex-1"
                >
                  {tab.title}
                </span>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`size-4 rounded-sm flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0 ${
                  isActive ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Close Tab (⌘W)"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* New Tab Button */}
      <button
        type="button"
        onClick={() => addTab()}
        className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-0.5 shrink-0"
        title="New Query Tab (⌘T)"
      >
        <Plus className="size-3.5" />
      </button>

      {/* Right-Side Meta / Shortcut info */}
      <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground/50 font-mono hidden sm:flex pr-1">
        <span>⌘T new</span>
        <span>⌘W close</span>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[160px] bg-popover/95 backdrop-blur-md border border-border/80 shadow-md rounded-md p-1 text-xs font-sans text-popover-foreground animate-in fade-in-0 zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const target = tabs.find((t) => t.id === contextMenu.tabId);
              if (target) handleStartRename(target);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left text-xs transition-colors"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Rename Tab</span>
          </button>

          <button
            type="button"
            onClick={() => {
              duplicateTab(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left text-xs transition-colors"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Duplicate Tab</span>
          </button>

          <div className="h-px bg-border/60 my-1" />

          <button
            type="button"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left text-xs transition-colors"
          >
            <X className="size-3.5 text-muted-foreground" />
            <span>Close Tab</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">⌘W</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }}
            disabled={tabs.length <= 1}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left text-xs transition-colors disabled:opacity-50"
          >
            <XCircle className="size-3.5 text-muted-foreground" />
            <span>Close Other Tabs</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeTabsToTheRight(contextMenu.tabId);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left text-xs transition-colors"
          >
            <ArrowRightToLine className="size-3.5 text-muted-foreground" />
            <span>Close Tabs to the Right</span>
          </button>
        </div>
      )}
    </div>
  );
}
