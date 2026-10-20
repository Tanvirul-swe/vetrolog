import React, { useState } from 'react';
import {
  Gauge,
  Zap,
  Activity,
  HardDrive,
  Clock,
  Play,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/formatters';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useAdbStore } from '@/stores/useAdbStore';

export function PerformanceProfiler() {
  const profilerHistory = usePlaygroundStore((s) => s.profilerHistory);
  const lastSelectivity = usePlaygroundStore((s) => s.lastSelectivity);
  const activeTabId = usePlaygroundStore((s) => s.activeTabId);
  const tabs = usePlaygroundStore((s) => s.tabs);
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const query = activeTab?.query || '';
  const currentResult = activeTab?.result || null;

  const totalRows = useDatabaseStore((s) => s.totalRows);
  const selectedDbId = useDatabaseStore((s) => s.selectedDatabaseId);
  const databases = useDatabaseStore((s) => s.databases);

  const currentDb = databases.find((d) => d.id === selectedDbId);
  const currentDuration = currentResult?.durationMs || 0;

  // Benchmark Runner state
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    runs: number;
    min: number;
    avg: number;
    max: number;
    p50: number;
    p95: number;
    stdDev: number;
  } | null>(null);

  const runBenchmark = async () => {
    if (!query.trim() || isBenchmarking) return;
    setIsBenchmarking(true);
    setBenchmarkProgress(0);

    const latencies: number[] = [];
    const totalRuns = 20;

    for (let i = 0; i < totalRuns; i++) {
      setBenchmarkProgress(i + 1);
      const start = performance.now();
      try {
        const res = await useAdbStore.getState().executeQuery(query);
        const elapsed = res?.durationMs || performance.now() - start;
        latencies.push(elapsed);
      } catch {
        latencies.push(performance.now() - start);
      }
      await new Promise((r) => setTimeout(r, 12));
    }

    latencies.sort((a, b) => a - b);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = sum / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const variance =
      latencies.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    setBenchmarkResult({
      runs: totalRuns,
      min,
      avg,
      max,
      p50,
      p95,
      stdDev,
    });
    setIsBenchmarking(false);
  };

  // Mobile Frame Rate Safety Classification
  // 60 FPS frame budget = 16.6ms, 120 FPS frame budget = 8.3ms
  let frameSafety = {
    label: 'Ultra Fast (< 2ms)',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Safe for 60/120 FPS UI threads without frame drop.',
  };

  if (currentDuration > 16.6) {
    frameSafety = {
      label: 'Frame Drop Hazard (> 16.6ms)',
      badge: 'bg-red-500/10 text-red-400 border-red-500/30',
      desc: 'Exceeds 60 FPS frame budget. Will drop frames on main UI thread; use an isolate or background thread.',
    };
  } else if (currentDuration > 8.3) {
    frameSafety = {
      label: '60 FPS Budget Notice (8.3–16.6ms)',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      desc: 'Within 60 FPS limit, but will stutter on 120 Hz ProMotion displays. Consider adding indexes.',
    };
  }

  // Calculate position on the 0–33ms frame timeline
  const maxMeterMs = 33.3; // 2 frames at 60 FPS
  const markerPercent = Math.min(100, Math.max(1, (currentDuration / maxMeterMs) * 100));

  const maxHistory = Math.max(...profilerHistory, 1);

  return (
    <div className="flex-1 flex flex-col overflow-auto p-4 bg-background select-none">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
              {lastSelectivity !== null ? `${lastSelectivity}%` : 'Optimal'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-sans">
              {currentResult?.rows?.length || 0} returned of ~{totalRows} scanned
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
                : 'Sandbox'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">
              {currentDb?.tables?.length || 0} tables in sandbox
            </p>
          </div>
        </div>

        {/* Mobile UI Frame Budget Meter (60 FPS & 120 FPS Target Zones) */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-emerald-400" />
              <span className="font-semibold text-foreground">Mobile Frame Budget Gauge (16.6ms Target)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-emerald-400">● 120 FPS (&lt;8.3ms)</span>
              <span className="text-amber-400">● 60 FPS (&lt;16.6ms)</span>
              <span className="text-red-400">● Jank (&gt;16.6ms)</span>
            </div>
          </div>

          {/* Progress Timeline Meter */}
          <div className="relative pt-6 pb-2">
            {/* Current Latency Needle */}
            <div
              style={{ left: `${markerPercent}%` }}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300 z-10"
            >
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground text-background font-bold shadow-xs whitespace-nowrap">
                {currentDuration.toFixed(2)} ms
              </span>
              <div className="w-0.5 h-3 bg-foreground" />
            </div>

            {/* Frame Target Zones Multi-Segment Bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-muted/40 border border-border/50">
              <div
                style={{ width: '25%' }}
                className="bg-emerald-500/50 hover:bg-emerald-500/70 transition-colors"
                title="120 FPS Budget (0 - 8.3ms)"
              />
              <div
                style={{ width: '25%' }}
                className="bg-amber-500/50 hover:bg-amber-500/70 transition-colors border-l border-border/40"
                title="60 FPS Budget (8.3ms - 16.6ms)"
              />
              <div
                style={{ width: '50%' }}
                className="bg-red-500/40 hover:bg-red-500/60 transition-colors border-l border-border/40"
                title="Frame Drop Hazard (> 16.6ms)"
              />
            </div>

            {/* Threshold Labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1.5 px-0.5">
              <span>0 ms</span>
              <span className="text-emerald-400 font-semibold">8.3 ms (120 Hz)</span>
              <span className="text-amber-400 font-semibold">16.6 ms (60 Hz)</span>
              <span>33.3 ms (30 Hz)</span>
            </div>
          </div>
        </div>

        {/* Multi-Run Statistical Benchmark Runner */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Zap className="size-4 text-primary" />
              <div>
                <span className="font-semibold text-foreground">Stress Benchmark (20x Execution Cycles)</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Executes 20 rapid cycles on device to calculate p50, p95 tail latency and cache stability.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={runBenchmark}
              disabled={isBenchmarking || !query.trim()}
              className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0"
            >
              {isBenchmarking ? (
                <>
                  <RotateCw className="size-3 animate-spin" />
                  <span>Cycle {benchmarkProgress}/20...</span>
                </>
              ) : (
                <>
                  <Play className="size-3 fill-current" />
                  <span>Run 20x Benchmark</span>
                </>
              )}
            </Button>
          </div>

          {/* Benchmark Statistical Results Grid */}
          {benchmarkResult && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/40 font-mono text-xs animate-in fade-in">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground block">Minimum</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {benchmarkResult.min.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground block">Median (p50)</span>
                <span className="font-bold text-sky-400 text-sm">
                  {benchmarkResult.p50.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground block">Tail (p95)</span>
                <span className="font-bold text-amber-400 text-sm">
                  {benchmarkResult.p95.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground block">Maximum</span>
                <span className="font-bold text-red-400 text-sm">
                  {benchmarkResult.max.toFixed(2)} ms
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground block">Variance (σ)</span>
                <span className="font-bold text-foreground text-sm">
                  ±{benchmarkResult.stdDev.toFixed(2)} ms
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Execution Benchmark Sparkline / History Bar */}
        <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-xs">
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
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
                const isSlow = val > 16.6;
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

