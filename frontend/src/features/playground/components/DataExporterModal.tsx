import React, { useState, useMemo } from 'react';
import { Download, Copy, Check, X, FileJson, FileSpreadsheet, FileCode, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatSqlIdentifier } from '../services/sqlIdentifier';
import * as AppBindings from '../../../../wailsjs/go/app/App';

interface DataExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: Record<string, unknown>[];
  tableName?: string;
}

export function DataExporterModal({ isOpen, onClose, rows, tableName = 'result_set' }: DataExporterModalProps) {
  const [format, setFormat] = useState<'json' | 'csv' | 'sql' | 'markdown'>('json');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const formattedContent = useMemo(() => {
    if (!rows || rows.length === 0) return '';

    // 1. JSON
    if (format === 'json') {
      return JSON.stringify(rows, null, 2);
    }

    // 2. CSV
    if (format === 'csv') {
      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(',')];
      for (const row of rows) {
        const values = headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        });
        csvRows.push(values.join(','));
      }
      return csvRows.join('\n');
    }

    // 3. SQL Inserts
    if (format === 'sql') {
      const headers = Object.keys(rows[0]);
      const sqlRows: string[] = [];
      const tbl = formatSqlIdentifier(tableName);
      for (const row of rows) {
        const colList = headers.map(formatSqlIdentifier).join(', ');
        const valList = headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 1 : 0;
            return `'${String(val).replace(/'/g, "''")}'`;
          })
          .join(', ');
        sqlRows.push(`INSERT INTO ${tbl} (${colList}) VALUES (${valList});`);
      }
      return sqlRows.join('\n');
    }

    // 4. Markdown Table
    if (format === 'markdown') {
      const headers = Object.keys(rows[0]);
      const headerRow = `| ${headers.join(' | ')} |`;
      const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;
      const mdRows = [headerRow, sepRow];
      for (const row of rows.slice(0, 50)) {
        const line = headers.map((h) => String(row[h] ?? 'NULL')).join(' | ');
        mdRows.push(`| ${line} |`);
      }
      return mdRows.join('\n');
    }

    return '';
  }, [rows, format, tableName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    const extMap: Record<string, string> = {
      json: 'json',
      csv: 'csv',
      sql: 'sql',
      markdown: 'md',
    };
    const filterMap: Record<string, string> = {
      json: '*.json',
      csv: '*.csv',
      sql: '*.sql',
      markdown: '*.md',
    };

    const ext = extMap[format];
    const defaultFilename = `${tableName}_export.${ext}`;

    setIsSaving(true);
    try {
      // 1. Try native desktop save dialog via Wails AppBindings (eliminates macOS WebKit sandbox error)
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        typeof window?.go?.app?.App?.SaveExportFile === 'function'
      ) {
        const savedPath = await AppBindings.SaveExportFile(
          defaultFilename,
          filterMap[format] || '*.*',
          formattedContent
        );
        if (savedPath) {
          setSaveSuccess(true);
          setTimeout(() => {
            setSaveSuccess(false);
            onClose();
          }, 800);
        }
        return;
      }
    } catch (err) {
      console.warn('[VetroLog] Native save dialog failed, using fallback:', err);
    } finally {
      setIsSaving(false);
    }

    // 2. Browser fallback for web mode
    try {
      const mimeMap: Record<string, string> = {
        json: 'application/json',
        csv: 'text/csv',
        sql: 'text/plain',
        markdown: 'text/markdown',
      };
      const mime = mimeMap[format];
      const blob = new Blob([formattedContent], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (e) {
      console.error('[VetroLog] Browser export fallback failed:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-2xl bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Export Result Set</h3>
            <Badge variant="outline" className="text-[10px] font-mono">
              {rows.length} rows
            </Badge>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Format Selector Pills */}
        <div className="p-3 border-b border-border/40 bg-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={format === 'json' ? 'secondary' : 'ghost'}
              onClick={() => setFormat('json')}
              className="h-7 text-xs gap-1.5"
            >
              <FileJson className="size-3.5 text-amber-400" />
              <span>JSON</span>
            </Button>
            <Button
              size="sm"
              variant={format === 'csv' ? 'secondary' : 'ghost'}
              onClick={() => setFormat('csv')}
              className="h-7 text-xs gap-1.5"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-400" />
              <span>CSV</span>
            </Button>
            <Button
              size="sm"
              variant={format === 'sql' ? 'secondary' : 'ghost'}
              onClick={() => setFormat('sql')}
              className="h-7 text-xs gap-1.5"
            >
              <FileCode className="size-3.5 text-sky-400" />
              <span>SQL Inserts</span>
            </Button>
            <Button
              size="sm"
              variant={format === 'markdown' ? 'secondary' : 'ghost'}
              onClick={() => setFormat('markdown')}
              className="h-7 text-xs gap-1.5"
            >
              <FileText className="size-3.5 text-indigo-400" />
              <span>Markdown</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 text-xs gap-1.5">
              {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isSaving}
              className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="size-3 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Download className="size-3" />
                  <span>Download File</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Code Preview */}
        <div className="h-64 p-3 overflow-auto bg-black/50 font-mono text-xs select-text leading-5">
          <pre className="text-muted-foreground whitespace-pre-wrap">{formattedContent}</pre>
        </div>
      </div>
    </div>
  );
}
