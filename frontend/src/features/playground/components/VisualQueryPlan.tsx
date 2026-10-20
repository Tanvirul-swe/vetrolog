import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Search,
  ArrowRight,
  Database,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlanNode } from '@/types/database';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

export function VisualQueryPlan() {
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  const queryPlan = usePlaygroundStore((s) => s.queryPlan);
  const isExplaining = usePlaygroundStore((s) => s.isExplaining);
  const runExplain = usePlaygroundStore((s) => s.runExplain);
  const setActiveTab = usePlaygroundStore((s) => s.setActiveTab);

  if (isExplaining) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-muted-foreground text-xs">
        <Search className="size-6 text-primary animate-pulse mb-2" />
        <p className="font-mono">Analyzing query execution plan with SQLite EXPLAIN QUERY PLAN engine...</p>
      </div>
    );
  }

  if (!queryPlan || (!queryPlan.rawNodes.length && !queryPlan.error)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-muted-foreground text-xs">
        <Layers className="size-8 text-muted-foreground/40 mb-2" />
        <p className="font-medium text-foreground">No Query Plan Generated</p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
          Run or explain a query above to visually inspect full table scans, index seeks, and B-Tree traversals.
        </p>
        <Button size="sm" variant="outline" onClick={() => runExplain()} className="mt-3 text-xs gap-1.5">
          <Search className="size-3" />
          <span>Explain Current Query</span>
        </Button>
      </div>
    );
  }

  if (queryPlan.error) {
    return (
      <div className="p-4 bg-destructive/10 border-b border-destructive/20 text-red-400 text-xs flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>Plan Error: {queryPlan.error}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Plan Header & Summary Bar */}
      <div className="h-9 px-4 border-b border-border/60 bg-card/60 flex items-center justify-between text-xs font-mono select-none shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {queryPlan.hasFullScan ? (
            <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0.5 shrink-0">
              <AlertTriangle className="size-3" />
              <span>Full Scan Detected</span>
            </Badge>
          ) : queryPlan.hasTempBTree ? (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0.5 border-amber-500/40 text-amber-400 shrink-0">
              <Clock className="size-3" />
              <span>Temp B-Tree Sort</span>
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px] gap-1 px-1.5 py-0.5 shrink-0">
              <CheckCircle2 className="size-3" />
              <span>Optimal (Indexed)</span>
            </Badge>
          )}

          <span className="text-muted-foreground truncate max-w-xs sm:max-w-md md:max-w-lg">{queryPlan.summary}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {queryPlan.hasFullScan && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('advisor')}
              className="h-6 text-[10px] gap-1 border-primary/40 text-primary hover:bg-primary/10"
              title="Jump to Index Advisor to optimize this scan"
            >
              <Sparkles className="size-2.5" />
              <span>Index Advisor</span>
            </Button>
          )}

          <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/20">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-2 py-0.5 rounded text-[10px] font-sans transition-colors ${
                viewMode === 'graph' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Visual Flow
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-0.5 rounded text-[10px] font-sans transition-colors ${
                viewMode === 'table' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Raw Table
            </button>
          </div>
        </div>
      </div>

      {/* Full Scan Recommendation Alert */}
      {queryPlan.hasFullScan && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/25 flex items-center justify-between text-xs text-amber-300 font-sans shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>
              <strong>Performance Alert:</strong> SQLite is linearly scanning entire tables. Adding an index can accelerate this query by <strong>10x–50x</strong> on mobile devices.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab('advisor')}
            className="h-6 text-[11px] gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-medium shrink-0 ml-3"
          >
            <span>Optimize with Advisor</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      )}

      {/* Plan Viewport */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'graph' ? (
          <div className="max-w-2xl mx-auto space-y-4 font-mono text-xs">
            {queryPlan.rootNodes.map((node) => (
              <PlanNodeCard key={node.id} node={node} onOpenAdvisor={() => setActiveTab('advisor')} />
            ))}
          </div>
        ) : (
          <div className="border border-border/60 rounded-lg overflow-hidden font-mono text-xs max-w-4xl mx-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-3 py-1.5 text-muted-foreground font-semibold">ID</th>
                  <th className="px-3 py-1.5 text-muted-foreground font-semibold">Parent</th>
                  <th className="px-3 py-1.5 text-muted-foreground font-semibold">Operation</th>
                  <th className="px-3 py-1.5 text-muted-foreground font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {queryPlan.rawNodes.map((n) => (
                  <tr key={n.id} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground">{n.id}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{n.parentId}</td>
                    <td className="px-3 py-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 ${
                          n.operation === 'SCAN'
                            ? 'border-red-500/40 text-red-400 bg-red-500/10'
                            : n.operation === 'SEARCH'
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {n.operation}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-foreground">{n.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanNodeCard({ node, onOpenAdvisor }: { node: PlanNode; onOpenAdvisor: () => void }) {
  const isScan = node.operation === 'SCAN';
  const isSearch = node.operation === 'SEARCH';
  const isTemp = node.operation === 'TEMP_BTREE';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-full p-3.5 rounded-xl border backdrop-blur-md shadow-md transition-all ${
          isScan
            ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
            : isSearch
            ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
            : isTemp
            ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
            : 'bg-card/70 border-border/80'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                isScan ? 'bg-red-500 animate-pulse' : isSearch ? 'bg-emerald-400' : isTemp ? 'bg-amber-400' : 'bg-muted-foreground'
              }`}
            />
            <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
              {node.operation}
            </span>

            {node.table && (
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 gap-1">
                <Database className="size-2.5 text-primary" />
                <span>{node.table}</span>
              </Badge>
            )}

            {node.indexName && (
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 gap-1 border-emerald-500/30 text-emerald-400">
                <Zap className="size-2.5 text-emerald-400" />
                <span>{node.indexName}</span>
              </Badge>
            )}
          </div>

          <Badge
            variant="outline"
            className={`text-[9px] font-mono px-1.5 py-0 ${
              isScan
                ? 'border-red-500/40 text-red-400 bg-red-500/10'
                : isSearch
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                : 'text-muted-foreground'
            }`}
          >
            {isScan ? 'High I/O Cost' : isSearch ? 'O(log N) Indexed' : 'In-Memory Sort'}
          </Badge>
        </div>

        <p className="text-foreground text-xs font-mono">{node.detail}</p>

        {isScan && (
          <div className="mt-2.5 pt-2.5 border-t border-red-500/20 text-[11px] text-red-400/90 font-sans flex items-center justify-between">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-red-400" />
              <span>
                Linear scan through all records. As this table grows on user devices, this causes UI frame drops.
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenAdvisor}
              className="text-[10px] font-semibold text-red-300 hover:text-white underline cursor-pointer shrink-0 ml-2"
            >
              Fix in Advisor →
            </button>
          </div>
        )}

        {isSearch && node.indexName && (
          <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 text-[11px] text-emerald-400/90 font-sans flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            <span>Accelerated via B-Tree Index: <strong className="font-mono text-foreground">{node.indexName}</strong></span>
          </div>
        )}
      </div>

      {/* Render Children Hierarchically */}
      {node.children && node.children.length > 0 && (
        <div className="w-full pl-6 border-l-2 border-border/40 mt-3 space-y-3">
          {node.children.map((child) => (
            <PlanNodeCard key={child.id} node={child} onOpenAdvisor={onOpenAdvisor} />
          ))}
        </div>
      )}
    </div>
  );
}

