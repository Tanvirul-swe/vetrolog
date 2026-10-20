import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePlaygroundStore, QueryTab } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

export function QueryTabStrip() {
  const tabs = usePlaygroundStore((s) => s.tabs);
  const activeTabId = usePlaygroundStore((s) => s.activeTabId);
  const databases = useDatabaseStore((s) => s.databases);
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

  // Horizontal scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  }, []);

  // Check scroll buttons on tab change and resize
  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollButtons, { passive: true });
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        el.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [tabs.length, updateScrollButtons]);

  // Auto-scroll active tab into view when activeTabId changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector<HTMLElement>(
        `[data-tab-id="${activeTabId}"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
    // Delay check to allow smooth scroll animation to finish
    const timer = setTimeout(updateScrollButtons, 300);
    return () => clearTimeout(timer);
  }, [activeTabId, updateScrollButtons]);

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

  const handleScrollBy = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="h-10 border-b border-border/70 bg-muted/20 flex items-center px-1.5 gap-1 select-none relative shrink-0">
      {/* Scroll Left Button (visible when content is scrolled) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScrollBy(-160)}
          className="h-6 w-5 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors z-20 border border-border/40 bg-card/60"
          title="Scroll tabs left"
        >
          <ChevronLeft className="size-3.5" />
        </button>
      )}

      {/* Horizontally Scrollable Tabs Container */}
      <div
        ref={scrollContainerRef}
        onWheel={(e) => {
          // Translate vertical mouse wheel scrolling into horizontal tab scrolling
          if (e.deltaY !== 0 && scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
          }
        }}
        className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto overflow-y-hidden h-full py-1 tab-strip-scroll"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          const tabDb = databases.find((d) => d.id === tab.databaseId);
          const tooltip = `${tab.title}${tabDb ? ` [${tabDb.name}]` : ''} (Double-click to rename, middle-click to close)`;

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onAuxClick={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              className={`group relative flex items-center gap-1.5 h-7 px-2.5 rounded-t-md text-xs font-mono transition-all cursor-pointer select-none max-w-[210px] min-w-[110px] shrink-0 border ${
                isActive
                  ? 'bg-card text-foreground border-border/80 shadow-xs font-medium border-b-transparent -mb-[1px] z-10'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent'
              }`}
              title={tooltip}
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

              {/* Target Database Badge if multiple databases exist */}
              {!isEditing && databases.length > 1 && tabDb && (
                <span
                  className="text-[9px] px-1 py-0 rounded bg-muted/60 text-muted-foreground/75 font-mono truncate max-w-[50px] shrink-0"
                  title={`Bound Database: ${tabDb.name}`}
                >
                  {tabDb.name}
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

      {/* Scroll Right Button (visible when content extends past right edge) */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScrollBy(160)}
          className="h-6 w-5 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors z-20 border border-border/40 bg-card/60"
          title="Scroll tabs right"
        >
          <ChevronRight className="size-3.5" />
        </button>
      )}

      {/* Pinned New Tab Button (always visible and accessible) */}
      <button
        type="button"
        onClick={() => addTab()}
        className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 border border-border/40 bg-card/40 ml-1"
        title="New Query Tab (⌘T)"
      >
        <Plus className="size-3.5" />
      </button>

      {/* Right-Side Meta / Shortcut info */}
      <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground/50 font-mono hidden sm:flex pl-2 pr-1 shrink-0">
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
