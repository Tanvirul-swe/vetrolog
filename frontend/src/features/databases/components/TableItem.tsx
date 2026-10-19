import { Table as TableIcon, Box, FileText } from 'lucide-react';
import { TableSchema } from '@/types/database';
import { cn } from '@/lib/utils';

interface TableItemProps {
  table: TableSchema;
  isSelected: boolean;
  onSelect: () => void;
}

export function TableItem({ table, isSelected, onSelect }: TableItemProps) {
  const getIcon = () => {
    switch (table.type) {
      case 'box':
        return <Box className="size-3.5 text-amber-400/80 shrink-0" />;
      case 'view':
        return <FileText className="size-3.5 text-sky-400/80 shrink-0" />;
      default:
        return <TableIcon className="size-3.5 text-primary/80 shrink-0" />;
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`Open ${table.name} with data`}
      className={cn(
        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors group text-left',
        isSelected
          ? 'bg-primary/15 text-primary font-medium border border-primary/25'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-2 truncate">
        {getIcon()}
        <span className="truncate">{table.name}</span>
      </div>
      {table.rowCount >= 0 && (
        <span
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0',
            isSelected ? 'bg-primary/20 text-primary' : 'bg-muted/70 text-muted-foreground'
          )}
        >
          {table.rowCount.toLocaleString()}
        </span>
      )}
    </button>
  );
}
