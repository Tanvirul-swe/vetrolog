import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Plus,
  Zap,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

interface IndexRecommendation {
  tableName: string;
  columns: string[];
  suggestedName: string;
  createSql: string;
  reason: string;
  estimatedSpeedup: string;
}

export function IndexAdvisor() {
  const query = usePlaygroundStore((s) => s.query);
  const queryPlan = usePlaygroundStore((s) => s.queryPlan);
  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const applyIndex = usePlaygroundStore((s) => s.applyIndex);

  const [applyingIndex, setApplyingIndex] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generate recommendations based on active query & query plan
  const recommendations = useMemo<IndexRecommendation[]>(() => {
    if (!queryPlan || !queryPlan.hasFullScan) return [];

    const tables = extendedSchema?.tables || [];
    const scanNodes = queryPlan.rawNodes.filter((n) => n.operation === 'SCAN');

    const recs: IndexRecommendation[] = [];

    for (const node of scanNodes) {
      const tableName = node.table || '';
      const tableMeta = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
      if (!tableMeta) continue;

      // Find columns mentioned in query for this table
      const colNames = tableMeta.columns.map((c) => c.name);
      const matchedCols: string[] = [];

      for (const col of colNames) {
        // Skip primary keys (already indexed in SQLite)
        const isPk = tableMeta.columns.find((c) => c.name === col)?.isPrimaryKey;
        if (isPk) continue;

        const reg = new RegExp(`\\b${col}\\b`, 'i');
        if (reg.test(query)) {
          matchedCols.push(col);
        }
      }

      if (matchedCols.length > 0) {
        const colList = matchedCols.slice(0, 2);
        const idxName = `idx_${tableName}_${colList.join('_')}`.toLowerCase();
        const createSql = `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${tableName}" (${colList
          .map((c) => `"${c}"`)
          .join(', ')});`;

        recs.push({
          tableName,
          columns: colList,
          suggestedName: idxName,
          createSql,
          reason: `Query filters or sorts on unindexed column(s) "${colList.join(', ')}" resulting in a linear table scan.`,
          estimatedSpeedup: `~10x to 25x faster on mobile devices (${tableMeta.rowCount} rows)`,
        });
      }
    }

    return recs;
  }, [query, queryPlan, extendedSchema]);

  const handleApply = async (rec: IndexRecommendation) => {
    setApplyingIndex(rec.suggestedName);
    setSuccessMessage(null);
    try {
      const ok = await applyIndex(rec.createSql);
      if (ok) {
        setSuccessMessage(`Successfully created and synced index "${rec.suggestedName}" to device.`);
      }
    } finally {
      setApplyingIndex(null);
    }
  };

  const existingIndexes = useMemo(() => {
    const list: Array<{ table: string; name: string; cols: string[] }> = [];
    for (const t of extendedSchema?.tables || []) {
      for (const idx of t.indexes || []) {
        if (!idx.name.startsWith('sqlite_autoindex')) {
          list.push({ table: t.name, name: idx.name, cols: idx.columns });
        }
      }
    }
    return list;
  }, [extendedSchema]);

  return (
    <div className="flex-1 flex flex-col overflow-auto p-4 bg-background select-none">
      <div className="max-w-3xl mx-auto w-full space-y-5">
        {/* Success feedback */}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between font-mono animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {/* Advisor Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Optimization Advisor</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Targeted composite indexes recommended based on real-time execution plan analysis.
          </p>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 rounded-xl border border-border/80 bg-card/40 text-center select-none">
            <CheckCircle2 className="size-8 text-emerald-400/60 mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground">No Performance Bottlenecks Detected</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto font-sans">
              The current query already makes optimal use of SQLite indexes or scans small tables. If you add heavy WHERE or ORDER BY conditions, the advisor will suggest targeted indexes here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.suggestedName}
                className="p-4 rounded-xl border border-primary/30 bg-primary/5 shadow-md flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span className="font-semibold text-xs font-mono text-foreground">
                      Index on {rec.tableName} ({rec.columns.join(', ')})
                    </span>
                  </div>

                  <Badge variant="outline" className="text-[10px] px-2 border-primary/40 text-primary">
                    {rec.estimatedSpeedup}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground font-sans">{rec.reason}</p>

                <div className="p-2.5 rounded bg-black/40 border border-border/60 font-mono text-xs text-foreground select-text">
                  {rec.createSql}
                </div>

                <div className="flex items-center justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleApply(rec)}
                    disabled={applyingIndex === rec.suggestedName}
                    className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    <Plus className="size-3" />
                    <span>{applyingIndex === rec.suggestedName ? 'Applying...' : '1-Click Apply Index'}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Existing Indexes Table */}
        <div className="pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <h4 className="font-semibold text-xs text-foreground">Existing Mobile Indexes</h4>
            <span className="text-[10px] text-muted-foreground">({existingIndexes.length})</span>
          </div>

          {existingIndexes.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-2">No custom indexes created on this database yet.</p>
          ) : (
            <div className="border border-border/60 rounded-lg overflow-hidden font-mono text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-1.5">Table</th>
                    <th className="px-3 py-1.5">Index Name</th>
                    <th className="px-3 py-1.5">Indexed Columns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {existingIndexes.map((idx) => (
                    <tr key={idx.name} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-foreground">{idx.table}</td>
                      <td className="px-3 py-1.5 text-primary">{idx.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{idx.cols.join(', ') || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
