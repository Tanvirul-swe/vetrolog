import { useEffect } from 'react';
import { Smartphone, RefreshCw, Cpu, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdbStore } from '@/stores/useAdbStore';

export function AdbDeviceSelector() {
  const devices = useAdbStore((s) => s.devices);
  const selectedDeviceId = useAdbStore((s) => s.selectedDeviceId);
  const apps = useAdbStore((s) => s.apps);
  const selectedPackageName = useAdbStore((s) => s.selectedPackageName);
  const isLoadingDevices = useAdbStore((s) => s.isLoadingDevices);
  const isLoadingApps = useAdbStore((s) => s.isLoadingApps);
  const fetchDevices = useAdbStore((s) => s.fetchDevices);
  const selectDevice = useAdbStore((s) => s.selectDevice);
  const selectApp = useAdbStore((s) => s.selectApp);
  const refreshDatabases = useAdbStore((s) => s.refreshDatabases);

  const startPolling = useAdbStore((s) => s.startPolling);
  const stopPolling = useAdbStore((s) => s.stopPolling);

  // Continuously monitor ADB devices and running apps in real-time
  useEffect(() => {
    startPolling();
    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const hasDevice = devices.length > 0 && selectedDeviceId;

  return (
    <div className="flex items-center gap-2 bg-card/80 border border-border/80 px-2 py-1 rounded-lg shadow-xs text-xs">
      {/* Device Selector */}
      <div className="flex items-center gap-1.5">
        <Smartphone className={`size-3.5 ${hasDevice ? 'text-emerald-400' : 'text-muted-foreground'}`} />
        {devices.length === 0 ? (
          <button
            type="button"
            onClick={() => fetchDevices()}
            disabled={isLoadingDevices}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Click to scan for connected Android USB devices"
          >
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
            <span>{isLoadingDevices ? 'Scanning USB...' : 'No ADB Device'}</span>
          </button>
        ) : (
          <select
            value={selectedDeviceId || ''}
            onChange={(e) => selectDevice(e.target.value)}
            disabled={isLoadingDevices}
            className="bg-transparent font-medium text-[11px] text-foreground focus:outline-none cursor-pointer max-w-[140px] truncate"
            title="Select connected Android device"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id} className="bg-popover text-popover-foreground">
                {d.model} {d.isEmulator ? '(Emu)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="w-[1px] h-4 bg-border/60" />

      {/* App Package Selector */}
      <div className="flex items-center gap-1.5">
        <Layers className={`size-3.5 ${selectedPackageName ? 'text-primary' : 'text-muted-foreground'}`} />
        {!hasDevice ? (
          <span className="text-[11px] text-muted-foreground">Plug USB</span>
        ) : apps.length === 0 ? (
          <span className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-400 animate-ping inline-block mr-0.5" />
            {isLoadingApps ? 'Scanning apps...' : 'No debug apps'}
          </span>
        ) : (
          <select
            value={selectedPackageName || ''}
            onChange={(e) => selectApp(e.target.value)}
            disabled={isLoadingApps}
            className="bg-transparent font-mono text-[11px] text-primary focus:outline-none cursor-pointer max-w-[160px] truncate"
            title="Select debuggable app package"
          >
            {!selectedPackageName && (
              <option value="" disabled className="bg-popover text-muted-foreground">
                Select app
              </option>
            )}
            {apps.map((a) => (
              <option key={a.packageName} value={a.packageName} className="bg-popover text-popover-foreground">
                {a.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sync / Refresh Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => refreshDatabases()}
        disabled={isLoadingDevices || isLoadingApps}
        title="Sync / refresh device databases"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={`size-3 ${isLoadingDevices || isLoadingApps ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
