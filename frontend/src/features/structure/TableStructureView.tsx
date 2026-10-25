import { useState } from 'react';
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
} from 'lucide-react';
import { ExtendedTableSchema } from '@/types/database';
import { Input } from '@/components/ui/input';

interface TableStructureViewProps {
  schema: ExtendedTableSchema | null;
  tableName: string;
}

export function TableStructureView({ schema, tableName }: TableStructureViewProps) {
  const [activeTab, setActiveTab] = useState<'columns' | 'indexes' | 'foreign_keys'>('columns');
  const [searchTerm, setSearchTerm] = useState('');

  if (!schema) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Database className="size-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm">Loading structure for table "{tableName}"...</p>
      </div>
    );
  }

  const filteredColumns = schema.columns.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIndexes = (schema.indexes || []).filter((idx) =>
    idx.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idx.columns.some((col) => col.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredFks = (schema.foreignKeys || []).filter((fk) =>
    fk.fromCol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fk.toTable.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fk.toCol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Top Bar */}
      <div className="h-11 border-b border-border/80 px-4 flex items-center justify-between bg-card/40 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <Layers className="size-3.5 text-primary" />
            <span>Structure:</span>
            <span className="font-mono text-primary">{schema.name}</span>
            <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted border border-border">
              {schema.type.toUpperCase()}
            </span>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('columns')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs transition-colors ${
                activeTab === 'columns'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Columns className="size-3 text-sky-400" />
              <span>Columns</span>
              <span className="text-[10px] opacity-70 font-mono">({schema.columns.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('indexes')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs transition-colors ${
                activeTab === 'indexes'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Hash className="size-3 text-amber-400" />
              <span>Indexes</span>
              <span className="text-[10px] opacity-70 font-mono">({schema.indexes?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('foreign_keys')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs transition-colors ${
                activeTab === 'foreign_keys'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Link className="size-3 text-emerald-400" />
              <span>Foreign Keys</span>
              <span className="text-[10px] opacity-70 font-mono">({schema.foreignKeys?.length || 0})</span>
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
              {filteredColumns.map((col, idx) => (
                <tr key={col.name} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{idx + 1}</td>
                  <td className="py-2 px-4 font-semibold text-foreground flex items-center gap-1.5">
                    {col.isPrimaryKey && <Key className="size-3 text-amber-400 shrink-0" />}
                    <span>{col.name}</span>
                  </td>
                  <td className="py-2 px-4 text-sky-400">{col.type}</td>
                  <td className="py-2 px-4">
                    {col.isPrimaryKey && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        PRIMARY KEY
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
              ))}
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
                <th className="py-2 px-4 w-28">Origin</th>
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
                filteredIndexes.map((idx, i) => (
                  <tr key={idx.name || i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{i + 1}</td>
                    <td className="py-2 px-4 font-semibold text-foreground">{idx.name}</td>
                    <td className="py-2 px-4 text-primary">{idx.columns.join(', ')}</td>
                    <td className="py-2 px-4">
                      {idx.unique ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          UNIQUE
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">No</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">{idx.origin || 'c'}</td>
                  </tr>
                ))
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
                filteredFks.map((fk, i) => (
                  <tr key={`${fk.fromCol}-${i}`} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-4 text-center text-muted-foreground text-[10px]">{i + 1}</td>
                    <td className="py-2 px-4 font-semibold text-foreground flex items-center gap-1.5">
                      <Link className="size-3 text-emerald-400 shrink-0" />
                      <span>{fk.fromCol}</span>
                    </td>
                    <td className="py-2 px-4 text-sky-400 flex items-center gap-1.5">
                      <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                      <span>{fk.toTable} ({fk.toCol})</span>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">{fk.onUpdate || 'NO ACTION'}</td>
                    <td className="py-2 px-4 text-muted-foreground">{fk.onDelete || 'NO ACTION'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
