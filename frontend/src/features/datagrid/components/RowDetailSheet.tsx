import { useState, useEffect } from 'react';
import { X, Copy, Check, FileJson, ArrowRight, Edit3, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface RowDetailSheetProps {
  row: Record<string, unknown> | null;
  onClose: () => void;
  onUpdateRow?: (pkField: string, pkValue: unknown, newValues: Record<string, unknown>) => void;
  onDeleteRow?: (pkField: string, pkValue: unknown) => void;
}

export function RowDetailSheet({ row, onClose, onUpdateRow, onDeleteRow }: RowDetailSheetProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (row) {
      const initial: Record<string, string> = {};
      Object.entries(row).forEach(([k, v]) => {
        initial[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
      });
      setEditValues(initial);
      setIsEditing(false);
      setConfirmDelete(false);
    }
  }, [row]);

  if (!row) return null;

  // Determine primary key field (e.g. 'id', 'key', or field ending with '_id')
  const pkField =
    Object.keys(row).find((k) => k.toLowerCase() === 'id' || k.toLowerCase() === 'key') ||
    Object.keys(row).find((k) => k.toLowerCase().endsWith('_id')) ||
    Object.keys(row)[0];
  const pkValue = row[pkField];

  const copyFullJson = () => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    const updated: Record<string, unknown> = {};
    Object.entries(editValues).forEach(([k, v]) => {
      const original = row[k];
      if (typeof original === 'number') {
        updated[k] = Number(v);
      } else if (typeof original === 'boolean') {
        updated[k] = v.toLowerCase() === 'true';
      } else if (typeof original === 'object' && original !== null) {
        try {
          updated[k] = JSON.parse(v);
        } catch {
          updated[k] = v;
        }
      } else {
        updated[k] = v;
      }
    });

    onUpdateRow?.(pkField, pkValue, updated);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleteRow?.(pkField, pkValue);
    onClose();
  };

  return (
    <div className="w-96 border-l border-border/80 bg-card/95 backdrop-blur-md flex flex-col shrink-0 select-text h-full z-20 shadow-2xl">
      {/* Drawer Header */}
      <div className="h-11 border-b border-border/80 px-4 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileJson className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {isEditing ? 'Edit Record' : 'Row Inspector'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={isEditing ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? 'Cancel edit' : 'Edit row values'}
          >
            <Edit3 className="size-3.5" />
          </Button>

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
        {Object.entries(row).map(([key, val]) => {
          const isPk = key === pkField;
          return (
            <div key={key} className="p-2.5 rounded-md bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-primary font-semibold text-[11px]">{key}</span>
                  {isPk && (
                    <Badge variant="warning" className="text-[9px] px-1 py-0">
                      PK
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal text-muted-foreground uppercase">
                  {typeof val === 'object' && val !== null ? 'object' : typeof val}
                </Badge>
              </div>

              {isEditing && !isPk ? (
                <Input
                  value={editValues[key] ?? ''}
                  onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                  className="h-8 text-xs font-mono bg-background border-border/80"
                />
              ) : (
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
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with Save / Delete Actions */}
      <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-[11px]">
        {isEditing ? (
          <div className="flex items-center gap-2 w-full justify-between">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground">
              <Save className="size-3" />
              <span>Save Changes</span>
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant={confirmDelete ? 'destructive' : 'ghost'}
              size="sm"
              onClick={handleDelete}
              className={`h-7 text-xs gap-1.5 ${
                confirmDelete ? 'bg-destructive text-white' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              }`}
            >
              <Trash2 className="size-3" />
              <span>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs gap-1">
              <span>Close</span> <ArrowRight className="size-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
