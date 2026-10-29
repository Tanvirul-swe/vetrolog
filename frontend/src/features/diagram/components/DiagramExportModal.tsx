import { useState } from 'react';
import { X, Copy, Check, Download, FileCode, Sparkles, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import * as AppBindings from '../../../../wailsjs/go/app/App';

interface DiagramExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  format: 'dbml' | 'mermaid' | 'sql' | 'svg';
  content: string;
  databaseName: string;
}

export function DiagramExportModal({
  isOpen,
  onClose,
  format,
  content,
  databaseName,
}: DiagramExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const titleMap = {
    dbml: 'dbdiagram.io (DBML) Schema Format',
    mermaid: 'Mermaid ER Diagram (Markdown / GitHub)',
    sql: 'Standard SQL DDL (CREATE TABLE & FKs)',
    svg: 'Vector Graphics (SVG) Map',
  };

  const extMap = {
    dbml: 'dbml',
    mermaid: 'mmd',
    sql: 'sql',
    svg: 'svg',
  };

  const defaultFilename = `${databaseName || 'database'}_schema.${extMap[format]}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    // 1. Native desktop Save dialog if inside Wails
    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.go may be undefined
        typeof window?.go?.app?.App?.SaveExportFile === 'function'
      ) {
        const saved = await AppBindings.SaveExportFile(
          defaultFilename,
          `*.${extMap[format]}`,
          content
        );
        if (saved) {
          setDownloadSuccess(true);
          setTimeout(() => {
            setDownloadSuccess(false);
            onClose();
          }, 800);
          return;
        }
      }
    } catch {
      // Fallback to browser blob download
    }

    // 2. Browser blob fallback
    const mimeMap = {
      dbml: 'text/plain',
      mermaid: 'text/plain',
      sql: 'text/plain',
      svg: 'image/svg+xml',
    };

    const blob = new Blob([content], { type: mimeMap[format] || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col text-foreground max-h-[85vh]">
        {/* Header */}
        <div className="h-12 border-b border-border/80 px-4 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            {format === 'dbml' && <Sparkles className="size-4 text-amber-500" />}
            {format === 'mermaid' && <Code2 className="size-4 text-sky-400" />}
            {format === 'sql' && <FileCode className="size-4 text-emerald-400" />}
            {format === 'svg' && <Download className="size-4 text-purple-400" />}
            <h3 className="font-semibold text-sm text-foreground">{titleMap[format]}</h3>
            <Badge variant="outline" className="text-[10px] font-mono uppercase">
              {extMap[format]}
            </Badge>
          </div>

          <Button size="icon-sm" variant="ghost" onClick={onClose} className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Action bar */}
        <div className="h-10 px-4 border-b border-border/60 bg-card/60 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono text-[11px] truncate max-w-sm">
            {defaultFilename}
          </span>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 text-xs gap-1.5">
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownload}
              className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {downloadSuccess ? (
                <>
                  <Check className="size-3 text-primary-foreground" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Download className="size-3" />
                  <span>Save File</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Code Content Viewport */}
        <div className="flex-1 overflow-auto p-4 bg-muted/20 font-mono text-xs select-text">
          <pre className="text-foreground/90 whitespace-pre leading-5">{content}</pre>
        </div>
      </div>
    </div>
  );
}
