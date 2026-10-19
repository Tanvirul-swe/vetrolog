import { useState } from 'react';
import { Copy, Check, Binary } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CellRendererProps {
  value: unknown;
  columnType?: string;
}

export function CellRenderer({ value }: CellRendererProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40 italic font-mono text-[11px]">NULL</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <Badge
        variant="outline"
        className={`text-[10px] font-mono px-1.5 py-0 ${
          value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}
      >
        {value ? 'TRUE' : 'FALSE'}
      </Badge>
    );
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-sky-400 font-medium">{value.toLocaleString()}</span>;
  }

  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    return (
      <div className="flex items-center gap-1.5 max-w-xs group">
        <span className="font-mono text-[11px] text-amber-300 truncate bg-amber-500/10 px-1 rounded border border-amber-500/20">
          {jsonStr}
        </span>
        <button
          type="button"
          onClick={(e) => copyToClipboard(jsonStr, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
          title="Copy JSON"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      </div>
    );
  }

  const str = String(value);

  // Check if string represents a binary BLOB preview from backend
  if (str.startsWith('[BLOB - ') && str.endsWith(']')) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-mono px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1 inline-flex items-center select-none"
      >
        <Binary className="size-2.5 text-purple-400" />
        <span>{str.slice(1, -1)}</span>
      </Badge>
    );
  }

  // Check if string is a valid JSON string
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    return (
      <div className="flex items-center gap-1.5 max-w-xs group">
        <span className="font-mono text-[11px] text-amber-300 truncate bg-amber-500/10 px-1 rounded border border-amber-500/20">
          {str.length > 300 ? str.slice(0, 300) + '...' : str}
        </span>
        <button
          type="button"
          onClick={(e) => copyToClipboard(str, e)}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground"
          title="Copy JSON"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      </div>
    );
  }

  // Display truncated preview for very long strings to protect DOM rendering
  const displayStr = str.length > 500 ? str.slice(0, 500) + '...' : str;

  return (
    <span className="truncate max-w-sm block text-foreground/90 font-mono text-xs" title={str.length > 500 ? `${str.slice(0, 200)}...` : str}>
      {displayStr}
    </span>
  );
}
