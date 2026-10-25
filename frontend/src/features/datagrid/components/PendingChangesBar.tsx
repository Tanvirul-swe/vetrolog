import { useState, useEffect } from 'react';
import { Play, RotateCcw, Code2, AlertTriangle, Check, Copy, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStagedChangesStore } from '@/stores/useStagedChangesStore';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface PendingChangesBarProps {
  onCommitted?: () => void;
}

export function PendingChangesBar({ onCommitted }: PendingChangesBarProps) {
  const pendingChanges = useStagedChangesStore((s) => s.pendingChanges);
  const isPreviewModalOpen = useStagedChangesStore((s) => s.isPreviewModalOpen);
  const setIsPreviewModalOpen = useStagedChangesStore((s) => s.setIsPreviewModalOpen);
  const isCommitting = useStagedChangesStore((s) => s.isCommitting);
  const commitError = useStagedChangesStore((s) => s.commitError);
  const discardAll = useStagedChangesStore((s) => s.discardAll);
  const commitChanges = useStagedChangesStore((s) => s.commitChanges);
  const generatePreviewSQL = useStagedChangesStore((s) => s.generatePreviewSQL);

  const activeSession = useConnectionManagerStore((s) => s.activeSession);
  const applyPendingChanges = useConnectionManagerStore((s) => s.applyPendingChanges);
  const [copied, setCopied] = useState(false);

  const engineType = activeSession?.config.engine || 'postgres';
  const sqlPreview = generatePreviewSQL(engineType);

  const handleCommit = async () => {
    const res = await commitChanges(applyPendingChanges);
    if (res.success && onCommitted) {
      onCommitted();
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcut listener for ⌘S and ⌘P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 's') {
        if (pendingChanges.length > 0 && !isCommitting) {
          e.preventDefault();
          handleCommit();
        }
      } else if (cmdKey && e.key.toLowerCase() === 'p') {
        if (pendingChanges.length > 0) {
          e.preventDefault();
          setIsPreviewModalOpen(!isPreviewModalOpen);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingChanges.length, isCommitting, isPreviewModalOpen]);

  if (pendingChanges.length === 0) return null;

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-500/40 bg-card/95 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-2 pr-2 border-r border-border/80">
          <span className="size-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-semibold text-amber-400">
            {pendingChanges.length} {pendingChanges.length === 1 ? 'change' : 'changes'} pending
          </span>
        </div>

        {commitError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 max-w-xs truncate" title={commitError}>
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">{commitError}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewModalOpen(true)}
            className="h-7 text-xs gap-1.5 border-border/70 hover:bg-muted"
            title="Preview SQL statements (⌘P)"
          >
            <Code2 className="size-3.5 text-sky-400" />
            <span>Preview SQL</span>
            <kbd className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">⌘P</kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={discardAll}
            disabled={isCommitting}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
            title="Discard all pending changes"
          >
            <RotateCcw className="size-3.5" />
            <span>Discard</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleCommit}
            disabled={isCommitting}
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm shadow-emerald-700/30"
            title="Apply changes to database (⌘S)"
          >
            {isCommitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Committing...</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Commit</span>
                <kbd className="text-[10px] opacity-80 font-mono bg-emerald-700/60 px-1 rounded">⌘S</kbd>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview SQL Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-muted/40">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-primary" />
                <span className="font-semibold text-sm">Preview SQL Transaction</span>
                <span className="text-xs text-muted-foreground">({engineType.toUpperCase()})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySql}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* SQL Content */}
            <div className="flex-1 overflow-auto p-4 bg-muted/20 font-mono text-xs leading-relaxed selection:bg-primary/30">
              <pre className="text-foreground/90 whitespace-pre-wrap">{sqlPreview}</pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/80 bg-muted/40">
              <span className="text-xs text-muted-foreground">
                All changes will be executed within a single transaction.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="h-8 text-xs"
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    await handleCommit();
                  }}
                  disabled={isCommitting}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isCommitting ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 fill-current" />}
                  <span>Commit Now</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
