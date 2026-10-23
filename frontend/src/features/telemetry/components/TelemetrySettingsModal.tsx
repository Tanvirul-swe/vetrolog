import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Copy, Check, EyeOff, BarChart3, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { telemetry, TelemetryStatus } from '../telemetryService';

interface TelemetrySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelemetrySettingsModal({ isOpen, onClose }: TelemetrySettingsModalProps) {
  const [status, setStatus] = useState<TelemetryStatus>({ enabled: true, clientId: '' });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      telemetry.getStatus().then(setStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = async () => {
    setLoading(true);
    const newStatus = !status.enabled;
    const ok = await telemetry.setEnabled(newStatus);
    setStatus((prev) => ({ ...prev, enabled: ok }));
    setLoading(false);
  };

  const handleCopyId = () => {
    if (!status.clientId) return;
    navigator.clipboard.writeText(status.clientId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col text-foreground">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Privacy & Product Analytics</h2>
              <p className="text-[11px] text-muted-foreground">Anonymous usage and developer insights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Main Toggle Card */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {status.enabled ? (
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="size-3.5 text-amber-400" />
                )}
                <span>Share Anonymous Analytics</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Helps the VetroLog maintainers measure active users, identify crashes, and prioritize new features.
              </p>
            </div>

            <button
              onClick={handleToggle}
              disabled={loading}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                status.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  status.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Privacy Guarantee List */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <EyeOff className="size-3" />
              <span>Developer Privacy Guarantee</span>
            </h3>

            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold shrink-0">✓</span>
                <span>
                  <strong>What is collected:</strong> App opens, session duration, OS version, and feature adoption counts.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold shrink-0">✕</span>
                <span>
                  <strong>What is NEVER collected:</strong> Database file names, paths, tables, row contents, cell values, or SQL queries.
                </span>
              </div>
            </div>
          </div>

          {/* Anonymous Client ID */}
          {status.clientId && (
            <div className="rounded-md border border-border/50 bg-background/50 p-2.5 flex items-center justify-between gap-2">
              <div className="truncate">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                  Anonymous Device ID
                </div>
                <div className="font-mono text-[11px] text-foreground truncate">{status.clientId}</div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyId}
                className="h-7 px-2 text-xs shrink-0 hover:bg-muted"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/70 bg-muted/20 flex justify-end">
          <Button size="sm" onClick={onClose} className="h-8 text-xs font-medium">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
