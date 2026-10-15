import { Database, Search, Terminal, Trash2, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useDatabaseStore } from '@/stores/useDatabaseStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface AppHeaderProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onRefresh?: () => void;
}

export function AppHeader({ searchInputRef, onRefresh }: AppHeaderProps) {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const currentDevice = useConnectionStore((s) => s.currentDevice);
  const port = useConnectionStore((s) => s.port);

  const filterTerm = useDatabaseStore((s) => s.filterTerm);
  const setFilterTerm = useDatabaseStore((s) => s.setFilterTerm);
  const clearLogs = useDatabaseStore((s) => s.clearLogs);

  const isConsoleOpen = useSettingsStore((s) => s.isConsoleOpen);
  const toggleConsole = useSettingsStore((s) => s.toggleConsole);

  return (
    <header className="wails-drag h-13 border-b border-border/80 bg-card/60 backdrop-blur-md px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* Brand & Window Traffic Lights Offset (on macOS) */}
      <div className="flex items-center gap-3 pl-16">
        <div className="size-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
          <Database className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">VetroLog</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary font-mono">
              v1.0
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-none">Mobile DB Inspector</p>
        </div>
      </div>

      {/* Center Search Input */}
      <div className="wails-no-drag max-w-md w-full mx-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            placeholder="Search rows, keys, or queries... (⌘K)"
            className="pl-8 pr-12 h-8 text-xs bg-muted/40 border-border/60 focus:bg-background"
          />
          <kbd className="absolute right-2 top-2 pointer-events-none text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded border border-border">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls & Device Pill */}
      <div className="wails-no-drag flex items-center gap-2">
        {isConnected && currentDevice ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <Smartphone className="size-3.5" />
            <span className="font-medium max-w-[120px] truncate">{currentDevice.name}</span>
            <span className="text-[10px] text-emerald-400/70 capitalize">({currentDevice.platform})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/60 border border-border text-muted-foreground text-xs">
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span>Listening on :{port}</span>
          </div>
        )}

        {onRefresh && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            title="Refresh table data (⌘R)"
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearLogs}
          title="Clear mutation & query logs"
          className="text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
        </Button>

        <Button
          variant={isConsoleOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={toggleConsole}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Toggle live mutation console (⌘J)"
        >
          <Terminal className="size-3.5" />
          <span>Console</span>
        </Button>
      </div>
    </header>
  );
}
