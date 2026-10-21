import { useEffect } from 'react';
import { ArrowUpRight, Sparkles, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { useUpdaterStore, CURRENT_APP_VERSION } from './useUpdaterStore';
import { BrowserOpenURL } from '@/../wailsjs/runtime/runtime';

export function UpdateBadge() {
  const status = useUpdaterStore((s) => s.status);
  const updateInfo = useUpdaterStore((s) => s.updateInfo);
  const progress = useUpdaterStore((s) => s.progress);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const initEventListeners = useUpdaterStore((s) => s.initEventListeners);
  const openModal = useUpdaterStore((s) => s.openModal);

  useEffect(() => {
    // Register Wails IPC event listeners
    const cleanup = initEventListeners();
    // Run update check on initial app mount
    checkForUpdates();

    return () => {
      cleanup();
    };
  }, [initEventListeners, checkForUpdates]);

  const handleManualCheckOrOpen = (e: React.MouseEvent) => {
    // Shift+Click or Alt/Option+Click triggers interactive test flow
    if (e.shiftKey || e.altKey) {
      useUpdaterStore.getState().simulateUpdateFlow();
      return;
    }

    if (status === 'ready' || status === 'postponed' || status === 'downloading' || status === 'extracting') {
      openModal();
    } else if (updateInfo?.hasUpdate) {
      openModal();
    } else {
      // In idle state, user clicking the badge triggers a fresh check
      checkForUpdates();
    }
  };

  // State: Downloading
  if (status === 'downloading') {
    return (
      <button
        type="button"
        onClick={openModal}
        title={`Downloading update: ${progress.percent}% (${progress.downloaded} / ${progress.total})`}
        className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 bg-sky-500/15 border border-sky-500/40 text-sky-300 font-mono rounded hover:bg-sky-500/25 transition-all cursor-pointer shadow-xs"
      >
        <Download className="size-2.5 text-sky-400 animate-bounce" />
        <span>{progress.percent}%</span>
        {progress.speed && <span className="text-[9px] text-sky-300/70 hidden sm:inline">({progress.speed})</span>}
      </button>
    );
  }

  // State: Extracting / Verifying
  if (status === 'extracting') {
    return (
      <button
        type="button"
        onClick={openModal}
        title="Verifying downloaded app package..."
        className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 bg-primary/15 border border-primary/40 text-primary font-mono rounded hover:bg-primary/25 transition-all cursor-pointer"
      >
        <RefreshCw className="size-2.5 text-primary animate-spin" />
        <span>Verifying...</span>
      </button>
    );
  }

  // State: Ready to Restart / Postponed
  if (status === 'ready' || status === 'postponed') {
    return (
      <button
        type="button"
        onClick={openModal}
        title={`Update ${updateInfo?.latestVersion} downloaded! Click to restart & apply`}
        className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono rounded hover:bg-emerald-500/25 transition-all cursor-pointer shadow-xs animate-pulse"
      >
        <Sparkles className="size-2.5 text-emerald-400" />
        <span className="font-semibold">Restart to apply ({updateInfo?.latestVersion})</span>
      </button>
    );
  }

  // State: Error
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={openModal}
        title="Update download failed. Click to view details and retry"
        className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-destructive/15 border border-destructive/40 text-destructive font-mono rounded hover:bg-destructive/25 transition-colors cursor-pointer"
      >
        <AlertCircle className="size-2.5" />
        <span>Update failed</span>
      </button>
    );
  }

  // State: Checking
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0 border border-primary/30 text-primary font-mono rounded">
        <RefreshCw className="size-2 animate-spin text-primary/70" />
        <span>{CURRENT_APP_VERSION}</span>
      </span>
    );
  }

  // State: Default Idle (Up-to-date)
  return (
    <button
      type="button"
      onClick={handleManualCheckOrOpen}
      title={`VetroLog ${CURRENT_APP_VERSION} (Up to date). Click to check for updates`}
      className="text-[10px] px-1.5 py-0 border border-primary/30 text-primary font-mono rounded hover:border-primary/60 hover:bg-primary/10 transition-colors cursor-pointer"
    >
      {CURRENT_APP_VERSION}
    </button>
  );
}
