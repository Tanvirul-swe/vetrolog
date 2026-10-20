import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Plus,
  Zap,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatSqlIdentifier } from '../services/sqlIdentifier';
import { usePlaygroundStore } from '@/stores/usePlaygroundStore';

interface IndexRecommendation {
  tableName: string;
  columns: string[];
  suggestedName: string;
  createSql: string;
  reason: string;
  estimatedSpeedup: string;
  beforeEstimate: string;
  afterEstimate: string;
}

export function IndexAdvisor() {
  const query = usePlaygroundStore((s) => s.query);
  const queryPlan = usePlaygroundStore((s) => s.queryPlan);
  const extendedSchema = usePlaygroundStore((s) => s.extendedSchema);
  const applyIndex = usePlaygroundStore((s) => s.applyIndex);
  const runExplain = usePlaygroundStore((s) => s.runExplain);
  const loadExtendedSchema = usePlaygroundStore((s) => s.loadExtendedSchema);

  const [applyingIndex, setApplyingIndex] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Generate intelligent recommendations based on active query & query plan
  const recommendations = useMemo<IndexRecommendation[]>(() => {
    if (!queryPlan || !queryPlan.hasFullScan) return [];

    const tables = extendedSchema?.tables || [];
    const scanNodes = queryPlan.rawNodes.filter((n) => n.operation === 'SCAN');

    const recs: IndexRecommendation[] = [];

    for (const node of scanNodes) {
      const tableName = node.table || '';
      const tableMeta = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
      if (!tableMeta) continue;

      const colNames = tableMeta.columns.map((c) => c.name);
      const equalityCols: string[] = [];
      const rangeCols: string[] = [];
      const orderCols: string[] = [];

      // Parse WHERE clause & ORDER BY clause from query
      const whereMatch = query.match(/WHERE\s+([\s\S]*?)(?:GROUP\s+BY|ORDER\s+BY|LIMIT|;|$)/i);
      const whereClause = whereMatch ? whereMatch[1] : '';

      const orderMatch = query.match(/ORDER\s+BY\s+([\s\S]*?)(?:LIMIT|;|$)/i);
      const orderClause = orderMatch ? orderMatch[1] : '';

      for (const col of colNames) {
        // Skip primary keys (already indexed in SQLite)
        const isPk = tableMeta.columns.find((c) => c.name === col)?.isPrimaryKey;
        if (isPk) continue;

        const colRegex = new RegExp(`\\b${col}\\b`, 'i');

        // 1. Check Equality in WHERE (e.g. col = 'x' or col IS 'x')
        const eqRegex = new RegExp(`\\b${col}\\s*(=|IS)\\s*`, 'i');
        if (whereClause && eqRegex.test(whereClause)) {
          equalityCols.push(col);
          continue;
        }

        // 2. Check Range/Inequality in WHERE (e.g. col > x, BETWEEN, LIKE)
        const rangeRegex = new RegExp(`\\b${col}\\s*(>|<|>=|<=|BETWEEN|LIKE|IN)\\s*`, 'i');
        if (whereClause && rangeRegex.test(whereClause)) {
          rangeCols.push(col);
          continue;
        }

        // 3. Check Order By clause
        if (orderClause && colRegex.test(orderClause)) {
          orderCols.push(col);
          continue;
        }

        // 4. Fallback: mentioned anywhere in query
        if (colRegex.test(query)) {
          rangeCols.push(col);
        }
      }

      // Order according to SQLite B-Tree best practices:
      // Equality columns FIRST -> Range columns SECOND -> Sort columns THIRD
      const orderedCols = Array.from(new Set([...equalityCols, ...rangeCols, ...orderCols])).slice(0, 3);

      if (orderedCols.length > 0) {
        const idxName = `idx_${tableName}_${orderedCols.join('_')}`.toLowerCase();
        const formattedCols = orderedCols.map(formatSqlIdentifier).join(', ');
        const createSql = `CREATE INDEX IF NOT EXISTS ${formatSqlIdentifier(idxName)} ON ${formatSqlIdentifier(tableName)} (${formattedCols});`;

        const rowCount = tableMeta.rowCount || 1000;
        const estScanMs = Math.max(12, Math.round(rowCount * 0.04));

        recs.push({
          tableName,
          columns: orderedCols,
          suggestedName: idxName,
          createSql,
          reason: `SQLite executes a linear full scan over ~${rowCount.toLocaleString()} rows. Indexing (${orderedCols.join(', ')}) converts this into a direct O(log N) B-Tree seek.`,
          estimatedSpeedup: `~15x–50x speedup`,
          beforeEstimate: `~${estScanMs}ms (Linear Scan)`,
          afterEstimate: `< 1.5ms (B-Tree Seek)`,
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
        setSuccessMessage(`Successfully applied index "${rec.suggestedName}" to device database.`);
        // Reload schema and re-run explain to update query plan
        await loadExtendedSchema();
        await runExplain(query);
      }
    } finally {
      setApplyingIndex(null);
    }
  };

  const handleCopy = (sql: string, idxName: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedIndex(idxName);
    setTimeout(() => setCopiedIndex(null), 1800);
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

        {/* Advisor Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Mobile Index Advisor</h3>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              Heuristic Engine
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Targeted composite index recommendations calculated from real-time SQLite planner bottlenecks.
          </p>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 rounded-xl border border-border/80 bg-card/40 text-center select-none">
            <CheckCircle2 className="size-8 text-emerald-400/60 mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground">No Index Bottlenecks Detected</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md mx-auto font-sans">
              The active query already makes optimal use of existing SQLite indexes or scans small tables. If you compose complex WHERE or ORDER BY filters that trigger linear table scans, recommended composite indexes will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.suggestedName}
                className="p-4 rounded-xl border border-primary/40 bg-primary/5 shadow-md flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span className="font-semibold text-xs font-mono text-foreground">
                      Index on {rec.tableName} ({rec.columns.join(', ')})
                    </span>
                  </div>

                  <Badge variant="outline" className="text-[10px] px-2 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-medium">
                    {rec.estimatedSpeedup}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground font-sans">{rec.reason}</p>

                {/* Before vs After Performance Impact */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Before Index:</span>
                    <span className="text-red-400 font-semibold">{rec.beforeEstimate}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">After Index:</span>
                    <span className="text-emerald-400 font-semibold">{rec.afterEstimate}</span>
                  </div>
                </div>

                {/* Generated DDL Statement */}
                <div className="p-2.5 rounded-lg bg-black/50 border border-border/70 font-mono text-xs text-foreground select-text overflow-x-auto">
                  {rec.createSql}
                </div>

                {/* Actions: Copy & Apply */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(rec.createSql, rec.suggestedName)}
                    className="h-7 text-xs gap-1.5"
                    title="Copy CREATE INDEX SQL to clipboard for migrations"
                  >
                    {copiedIndex === rec.suggestedName ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy Migration DDL</span>
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleApply(rec)}
                    disabled={applyingIndex === rec.suggestedName}
                    className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    title="Execute CREATE INDEX on device and refresh database metadata"
                  >
                    <Plus className="size-3" />
                    <span>{applyingIndex === rec.suggestedName ? 'Applying to Device...' : '1-Click Apply Index'}</span>
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
            <h4 className="font-semibold text-xs text-foreground">Existing Device Indexes</h4>
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

