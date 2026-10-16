import React from 'react';
import {
  Gauge,
  Zap,
  Activity,
  HardDrive,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/formatters';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';

export function PerformanceProfiler() {
  const profilerHistory = usePlaygroundStore((s) => s.profilerHistory);
  const lastSelectivity = usePlaygroundStore((s) => s.lastSelectivity);
  const latestResult = useDatabaseStore((s) => s.latestQueryResult);
  const totalRows = useDatabaseStore((s) => s.totalRows);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const databases = useDatabaseStore((s) => s.databases);

  const currentDb = databases.find((d) => d.id === selectedDbId);
  const currentDuration = latestResult?.durationMs || 0;

  // Mobile Frame Rate Safety Classification
  // 60 FPS frame budget = 16.6ms, 120 FPS frame budget = 8.3ms
  let frameSafety: { label: string; color: string; badge: string; desc: string } = {
    label: 'Ultra Fast (< 2ms)',
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Safe for 60/120 FPS UI threads without frame drop.',
  };

  if (currentDuration > 15) {
    frameSafety = {
      label: 'Mobile Lag Warning (> 15ms)',
      color: 'text-red-400',
      badge: 'bg-red-500/10 text-red-400 border-red-500/30',
      desc: 'Will drop frames if executed on the main UI thread. Run in an isolate or add indexes.',
    };
  } else if (currentDuration > 3) {
    frameSafety = {
      label: 'Noticeable (3ms - 15ms)',
      color: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      desc: 'Noticeable impact on lower-end Android chips. Recommended for background thread.',
    };
  }

  const maxHistory = Math.max(...profilerHistory, 1);

  return (
    <div className="flex-1 flex flex-col overflow-auto p-4 bg-background select-none">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Card 1: Microsecond Execution Time */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-mono">
              <span>Execution Time</span>
              <Clock className="size-3.5 text-primary" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {formatDuration(currentDuration)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
              {(currentDuration * 1000).toFixed(0)} μs (microseconds)
            </p>
          </div>

          {/* Card 2: Mobile UI Thread Safety */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-mono">
              <span>Mobile Thread Safety</span>
              <Zap className="size-3.5 text-amber-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${frameSafety.badge}`}>
                {frameSafety.label}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{frameSafety.desc}</p>
          </div>

          {/* Card 3: Query Selectivity Ratio */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-mono">
              <span>Selectivity Ratio</span>
              <Activity className="size-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {lastSelectivity !== null ? `${lastSelectivity}%` : 'N/A'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {latestResult?.rows?.length || 0} returned of ~{totalRows} scanned
            </p>
          </div>

          {/* Card 4: Database Disk Footprint */}
          <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5 font-mono">
              <span>Database Size</span>
              <HardDrive className="size-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold font-mono text-foreground">
              {currentDb?.sizeBytes
                ? `${(currentDb.sizeBytes / 1024).toFixed(1)} KB`
                : 'Dynamic'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
              {currentDb?.tables?.length || 0} tables in sandbox
            </p>
          </div>
        </div>

        {/* Execution Benchmark Sparkline / History Bar */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              <span className="font-semibold text-foreground">Recent Query Latency Trend</span>
            </div>
            <span className="text-muted-foreground text-[11px]">
              Last {profilerHistory.length} execution runs
            </span>
          </div>

          {profilerHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-4 text-center font-sans">
              Execute queries to visualize real-time latency variations and benchmarking.
            </p>
          ) : (
            <div className="h-28 flex items-end gap-2 pt-4 px-2 border-b border-border/40">
              {profilerHistory.map((val, idx) => {
                const heightPercent = Math.max(12, Math.round((val / maxHistory) * 100));
                const isSlow = val > 15;
                const isFast = val < 2;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[10px] font-mono px-1.5 py-0.5 rounded shadow border border-border pointer-events-none whitespace-nowrap z-20">
                      {val.toFixed(2)} ms
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t transition-all ${
                        isSlow
                          ? 'bg-red-500/70 group-hover:bg-red-500'
                          : isFast
                          ? 'bg-emerald-500/70 group-hover:bg-emerald-500'
                          : 'bg-amber-500/70 group-hover:bg-amber-500'
                      }`}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground">
                      #{idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
