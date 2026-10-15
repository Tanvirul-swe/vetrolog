import { X, Copy, Check, FileJson, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RowDetailSheetProps {
  row: Record<string, unknown> | null;
  onClose: () => void;
}

export function RowDetailSheet({ row, onClose }: RowDetailSheetProps) {
  const [copied, setCopied] = useState(false);

  if (!row) return null;

  const copyFullJson = () => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-96 border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col shrink-0 select-text h-full z-20 shadow-2xl">
      {/* Drawer Header */}
      <div className="h-11 border-b border-border/80 px-4 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileJson className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Row Inspector</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" onClick={copyFullJson} title="Copy row as JSON">
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close inspector">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Field-by-Field Breakdown */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {Object.entries(row).map(([key, val]) => (
          <div key={key} className="p-2.5 rounded-md bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-primary font-semibold text-[11px]">{key}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal text-muted-foreground uppercase">
                {typeof val === 'object' && val !== null ? 'object' : typeof val}
              </Badge>
            </div>
            <div className="text-foreground/90 break-all text-xs max-h-48 overflow-y-auto">
              {typeof val === 'object' && val !== null ? (
                <pre className="bg-background/80 p-2 rounded text-[11px] text-amber-300 overflow-x-auto">
                  {JSON.stringify(val, null, 2)}
                </pre>
              ) : val === null || val === undefined ? (
                <span className="text-muted-foreground/40 italic">NULL</span>
              ) : (
                String(val)
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{Object.keys(row).length} attributes</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs gap-1">
          <span>Done</span> <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
