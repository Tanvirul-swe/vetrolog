import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useUpdateChecker, CURRENT_VERSION } from './useUpdateChecker';
import { BrowserOpenURL } from '@/../wailsjs/runtime/runtime';

export function UpdateBadge() {
  const { hasUpdate, latestVersion, releaseUrl } = useUpdateChecker();

  const handleOpenRelease = () => {
    try {
      BrowserOpenURL(releaseUrl);
    } catch {
      window.open(releaseUrl, '_blank');
    }
  };

  if (!hasUpdate) {
    return (
      <span className="text-[10px] px-1.5 py-0 border border-primary/30 text-primary font-mono rounded">
        {CURRENT_VERSION}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenRelease}
      title={`New version ${latestVersion} available! Click to download`}
      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono rounded hover:bg-amber-500/25 transition-colors cursor-pointer animate-pulse"
    >
      <Sparkles className="size-2.5 text-amber-400" />
      <span>Update {latestVersion}</span>
      <ArrowUpRight className="size-2.5 text-amber-400" />
    </button>
  );
}
