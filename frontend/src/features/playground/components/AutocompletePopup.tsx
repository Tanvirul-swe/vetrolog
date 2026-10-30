import React, { useEffect, useRef } from 'react';
import { Table as TableIcon, Columns, Key, Sparkles, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AutocompleteItem {
  label: string;
  insertText: string;
  type: 'table' | 'column' | 'keyword' | 'join' | 'snippet';
  detail?: string;
  meta?: string;
  isPk?: boolean;
}

interface AutocompletePopupProps {
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  position: { top: number; left: number };
}

export function AutocompletePopup({
  items,
  selectedIndex,
  onSelect,
  position,
}: AutocompletePopupProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="absolute z-50 min-w-[360px] max-w-[560px] w-auto max-h-72 overflow-y-auto rounded-lg border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/10 dark:shadow-black/50 text-xs font-mono p-1 select-none animate-in fade-in duration-100"
    >
      <div ref={listRef} className="space-y-0.5">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={`${item.type}_${item.label}_${idx}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'hover:bg-muted/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.type === 'table' && <TableIcon className="size-3.5 text-sky-400 shrink-0" />}
                {item.type === 'column' && (
                  item.isPk ? (
                    <Key className="size-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Columns className="size-3.5 text-indigo-400 shrink-0" />
                  )
                )}
                {item.type === 'keyword' && <Terminal className="size-3.5 text-emerald-400 shrink-0" />}
                {item.type === 'join' && <Sparkles className="size-3.5 text-amber-400 shrink-0" />}

                <span className="font-medium whitespace-nowrap text-left">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {item.detail && (
                  <span
                    className={`text-[10px] whitespace-nowrap ${
                      isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {item.detail}
                  </span>
                )}
                {item.meta && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 uppercase ${
                      isSelected
                        ? 'border-primary-foreground/40 text-primary-foreground'
                        : 'border-border/60 text-muted-foreground'
                    }`}
                  >
                    {item.meta}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
