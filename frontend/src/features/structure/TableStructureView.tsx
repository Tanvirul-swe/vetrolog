import { useState, useEffect } from 'react';
import {
  Columns,
  Key,
  Link,
  Layers,
  Search,
  Hash,
  CheckCircle2,
  XCircle,
  Database,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ExtendedTableSchema } from '@/types/database';
import { Input } from '@/components/ui/input';
import { useConnectionManagerStore } from '@/stores/useConnectionManagerStore';

interface TableStructureViewProps {
  schema: ExtendedTableSchema | null;
  tableName: string;
}

export function TableStructureView({ schema, tableName }: TableStructureViewProps) {
  const [activeTab, setActiveTab] = useState<'columns' | 'indexes' | 'foreign_keys'>('columns');
  const [searchTerm, setSearchTerm] = useState('');
  const loadTableSchema = useConnectionManagerStore((s) => s.loadTableSchema);

  // Proactively fetch table schema if not already loaded
  useEffect(() => {
    if (!schema && tableName) {
      loadTableSchema(tableName);
    }
  }, [schema, tableName, loadTableSchema]);

  if (!schema) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground select-none">
        <Loader2 className="size-8 text-primary/60 mb-2 animate-spin" />
        <p className="text-sm font-medium text-foreground">Loading structure for table "{tableName}"...</p>
        <p className="text-xs text-muted-foreground mt-1">Inspecting column types, constraints, and indexes</p>
      </div>
    );
  }

  const displayTableName = schema.tableName || schema.name || tableName;
  const displayType = (schema.type || (schema.schema ? `${schema.schema}.table` : 'table')).toUpperCase();
  const columnsList = schema.columns || [];
  const indexesList = schema.indexes || [];
  const fksList = schema.foreignKeys || [];
  const primaryKeysList = schema.primaryKeys || [];

  const filteredColumns = columnsList.filter((c) =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIndexes = indexesList.filter((idx) =>
    (idx.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (idx.columns || []).some((col) => (col || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredFks = fksList.filter((fk) => {
    const fromCol = fk.column || fk.fromCol || '';
    const toTable = fk.refTable || fk.toTable || '';
    const toCol = fk.refColumn || fk.toCol || '';
    return (
      fromCol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      toTable.toLowerCase().includes(searchTerm.toLowerCase()) ||
      toCol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <div className="h-11 border-b border-border/80 px-4 flex items-center justify-between bg-card/40 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <Layers className="size-3.5 text-primary" />
            <span>Structure:</span>
            <span className="font-mono text-primary">{displayTableName}</span>
            <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted border border-border">
              {displayType}
            </span>
            {schema.rowCount !== undefined && (
              <span
                className="text-[10px] text-muted-foreground font-mono ml-1"
                title={schema.isRowCountEstimated ? 'Estimated count from catalog statistics' : undefined}
              >
                ({schema.isRowCountEstimated ? '~' : ''}{schema.rowCount.toLocaleString()} rows{schema.isRowCountEstimated ? ' est.' : ''})
              </span>
            )}
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/60 p-0.5 gap-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`h-6 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                activeTab === 'columns'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent'
              }`}
            >
              <Columns className={`size-3 ${activeTab === 'columns' ? 'text-sky-400' : 'text-muted-foreground'}`} />
              <span>Columns</span>
              <span className="text-[10px] opacity-70 font-mono">({columnsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('indexes')}
              className={`h-6 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                activeTab === 'indexes'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent'
              }`}
            >
              <Hash className={`size-3 ${activeTab === 'indexes' ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <span>Indexes</span>
              <span className="text-[10px] opacity-70 font-mono">({indexesList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('foreign_keys')}
              className={`h-6 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                activeTab === 'foreign_keys'
                  ? 'bg-background text-foreground font-semibold shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent'
              }`}
            >
              <Link className={`size-3 ${activeTab === 'foreign_keys' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              <span>Foreign Keys</span>
              <span className="text-[10px] opacity-70 font-mono">({fksList.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter fields..."
            className="pl-7 h-7 text-xs bg-muted/30 border-border/60"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'columns' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-md border-b border-border/80 text-[11px] font-semibold text-muted-foreground z-10">
              <tr>
                <th className="py-2 px-4 w-12 text-center">#</th>
                <th className="py-2 px-4">Column Name</th>
                <th className="py-2 px-4">Data Type</th>
                <th className="py-2 px-4 w-32">Attributes</th>
                <th className="py-2 px-4 w-32">Nullable</th>
                <th className="py-2 px-4">Default Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filteredColumns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No columns match your filter.
                  </td>
                </tr>
              ) : (
                filteredColumns.map((col, idx) => {
                  const isPk = col.isPrimaryKey || primaryKeysList.includes(col.name);

                  return (
                    <tr key={col.name || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-4 font-semibold text-foreground flex items-center gap-1.5">
                        {isPk && <Key className="size-3 text-amber-400 shrink-0" />}
                        <span>{col.name}</span>
                      </td>
                      <td className="py-2 px-4 text-sky-400">{col.type}</td>
                      <td className="py-2 px-4">
                        {isPk && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            PRIMARY KEY
                          </span>
                        )}
                        {col.extra && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                            {col.extra}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {col.isNullable ? (
                          <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-emerald-400" />
                            <span>NULL</span>
                          </span>
                        ) : (
                          <span className="text-foreground text-[11px] font-semibold flex items-center gap-1">
                            <XCircle className="size-3 text-rose-400" />
                            <span>NOT NULL</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground truncate max-w-xs">
                        {col.defaultValue || <span className="opacity-40 italic">null</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'indexes' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-md border-b border-border/80 text-[11px] font-semibold text-muted-foreground z-10">
              <tr>
                <th className="py-2 px-4 w-12 text-center">#</th>
                <th className="py-2 px-4">Index Name</th>
                <th className="py-2 px-4">Indexed Columns</th>
                <th className="py-2 px-4 w-28">Unique</th>
                <th className="py-2 px-4 w-28">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filteredIndexes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No indexes defined for this table.
                  </td>
                </tr>
              ) : (
                filteredIndexes.map((idx, i) => {
                  const cols = idx.columns && idx.columns.length > 0 ? idx.columns.join(', ') : 'All / Primary';
                  const isUnique = idx.isUnique ?? idx.unique ?? false;
                  const idxType = idx.type || idx.origin || 'BTREE';

                  return (
                    <tr key={idx.name || i} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{i + 1}</td>
                      <td className="py-2 px-4 font-semibold text-foreground">{idx.name}</td>
                      <td className="py-2 px-4 text-primary">{cols}</td>
                      <td className="py-2 px-4">
                        {isUnique ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            UNIQUE
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">No</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground uppercase">{idxType}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'foreign_keys' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-md border-b border-border/80 text-[11px] font-semibold text-muted-foreground z-10">
              <tr>
                <th className="py-2 px-4 w-12 text-center">#</th>
                <th className="py-2 px-4">From Column</th>
                <th className="py-2 px-4">Target Relation</th>
                <th className="py-2 px-4">On Update</th>
                <th className="py-2 px-4">On Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filteredFks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No foreign key constraints defined for this table.
                  </td>
                </tr>
              ) : (
                filteredFks.map((fk, i) => {
                  const fromCol = fk.column || fk.fromCol || '—';
                  const toTable = fk.refTable || fk.toTable || '—';
                  const toCol = fk.refColumn || fk.toCol || '';
                  const targetLabel = toCol ? `${toTable} (${toCol})` : toTable;

                  return (
                    <tr key={`${fromCol}-${i}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{i + 1}</td>
                      <td className="py-2 px-4 font-semibold text-foreground flex items-center gap-1.5">
                        <Link className="size-3 text-emerald-400 shrink-0" />
                        <span>{fromCol}</span>
                      </td>
                      <td className="py-2 px-4 text-sky-400 flex items-center gap-1.5">
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                        <span>{targetLabel}</span>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{fk.onUpdate || 'NO ACTION'}</td>
                      <td className="py-2 px-4 text-muted-foreground">{fk.onDelete || 'NO ACTION'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
