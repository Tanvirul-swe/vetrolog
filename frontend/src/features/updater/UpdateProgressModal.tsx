import React, { useEffect } from 'react';
import {
  Sparkles,
  Download,
  RefreshCw,
  Clock,
  ArrowRight,
  AlertCircle,
  X,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdaterStore, CURRENT_APP_VERSION } from './useUpdaterStore';

export function UpdateProgressModal() {
  const isModalOpen = useUpdaterStore((s) => s.isModalOpen);
  const status = useUpdaterStore((s) => s.status);
  const updateInfo = useUpdaterStore((s) => s.updateInfo);
  const progress = useUpdaterStore((s) => s.progress);
  const countdown = useUpdaterStore((s) => s.countdown);
  const isCountdownActive = useUpdaterStore((s) => s.isCountdownActive);
  const errorMessage = useUpdaterStore((s) => s.errorMessage);

  const applyAndRestart = useUpdaterStore((s) => s.applyAndRestart);
  const postpone = useUpdaterStore((s) => s.postpone);
  const closeModal = useUpdaterStore((s) => s.closeModal);
  const tickCountdown = useUpdaterStore((s) => s.tickCountdown);
  const startDownload = useUpdaterStore((s) => s.startDownload);

  // Countdown timer effect
  useEffect(() => {
    if (!isModalOpen || !isCountdownActive) return;

    const timer = setInterval(() => {
      tickCountdown();
    }, 1000);

    return () => clearInterval(timer);
  }, [isModalOpen, isCountdownActive, tickCountdown]);

  if (!isModalOpen) return null;

  const isDownloading = status === 'downloading';
  const isExtracting = status === 'extracting';
  const isReady = status === 'ready' || status === 'postponed';
  const isApplying = status === 'applying';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg rounded-xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col text-foreground animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-primary to-emerald-400" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-xs">
              {isReady ? (
                <CheckCircle2 className="size-5 text-emerald-400 animate-pulse" />
              ) : isDownloading ? (
                <Download className="size-5 text-sky-400 animate-bounce" />
              ) : isError ? (
                <AlertCircle className="size-5 text-destructive" />
              ) : (
                <Sparkles className="size-5 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span>
                  {isReady
                    ? 'Update Ready to Install'
                    : isDownloading
                    ? 'Downloading VetroLog Update'
                    : isExtracting
                    ? 'Verifying Package'
                    : isApplying
                    ? 'Restarting VetroLog...'
                    : 'Software Update'}
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono text-muted-foreground/80">{CURRENT_APP_VERSION}</span>
                <ArrowRight className="size-3 text-primary" />
                <span className="font-mono font-semibold text-emerald-400">
                  {updateInfo?.latestVersion || 'Latest'}
                </span>
                {updateInfo?.assetSize ? (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span>{(updateInfo.assetSize / (1024 * 1024)).toFixed(1)} MB</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Live Progress Bar for Downloading / Extracting */}
          {(isDownloading || isExtracting) && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <Download className="size-3.5 text-sky-400" />
                  <span>{isExtracting ? 'Extracting & Verifying App Bundle...' : 'Downloading update...'}</span>
                </span>
                <span className="font-mono font-semibold text-primary">{progress.percent}%</span>
              </div>

              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-primary transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(progress.percent, 3)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>{progress.downloaded} of {progress.total}</span>
                {progress.speed && <span>{progress.speed}</span>}
              </div>
            </div>
          )}

          {/* Countdown & Ready Notice */}
          {isReady && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <div className="size-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-sm">
                {isCountdownActive ? countdown : '✓'}
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-emerald-300">
                  {isCountdownActive
                    ? `Auto-restarting in ${countdown} second${countdown === 1 ? '' : 's'}...`
                    : 'Ready to restart & update'}
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The update was safely verified. Click <strong>Restart & Install</strong> to switch to the latest version, or <strong>Postpone</strong> to continue your debugging session uninterrupted.
                </p>
              </div>
            </div>
          )}

          {/* Applying State */}
          {isApplying && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
              <RefreshCw className="size-5 text-primary animate-spin" />
              <div className="text-xs">
                <p className="font-medium text-foreground">Applying update and relaunching...</p>
                <p className="text-muted-foreground text-[11px]">VetroLog will restart in a moment.</p>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {isError && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
              <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-medium text-destructive">Update Download Encountered an Issue</p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {errorMessage || 'Unable to complete update package download.'}
                </p>
              </div>
            </div>
          )}

          {/* Release Notes Highlights */}
          {updateInfo?.releaseNotes && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" />
                <span>What's New in {updateInfo.latestVersion}</span>
              </div>
              <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-background/60 border border-border/60 text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap select-text">
                {updateInfo.releaseNotes}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
          <div>
            {isReady && isCountdownActive && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-3 text-amber-400" />
                <span>Timer active</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isError ? (
              <>
                <Button variant="ghost" size="sm" onClick={closeModal} className="h-8 text-xs">
                  Dismiss
                </Button>
                <Button variant="default" size="sm" onClick={startDownload} className="h-8 text-xs gap-1.5">
                  <RefreshCw className="size-3.5" />
                  <span>Retry Download</span>
                </Button>
              </>
            ) : isReady ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={postpone}
                  className="h-8 text-xs border-border/80 hover:bg-muted/50"
                >
                  Postpone
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={applyAndRestart}
                  disabled={isApplying}
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs font-semibold"
                >
                  <RefreshCw className={`size-3.5 ${isApplying ? 'animate-spin' : ''}`} />
                  <span>{isApplying ? 'Restarting...' : 'Restart & Install Now'}</span>
                </Button>
              </>
            ) : isDownloading || isExtracting ? (
              <Button variant="outline" size="sm" onClick={closeModal} className="h-8 text-xs">
                Run in Background
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={closeModal} className="h-8 text-xs">
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
