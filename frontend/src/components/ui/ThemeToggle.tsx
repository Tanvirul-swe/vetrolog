import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check, ChevronDown } from 'lucide-react';
import { useThemeStore, ThemeMode } from '@/stores/useThemeStore';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    setIsOpen(false);
  };

  const getTooltip = () => {
    if (theme === 'system') {
      return `Theme: System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'}) — Click to toggle, right-click for menu`;
    }
    return `Theme: ${theme === 'dark' ? 'Dark' : 'Light'} — Click to toggle, right-click for menu`;
  };

  return (
    <div className="relative inline-flex items-center" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
        className="size-8 text-muted-foreground hover:text-foreground relative group transition-colors"
        title={getTooltip()}
        aria-label="Toggle theme appearance"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="size-3.5 text-sky-400 transition-transform duration-200 group-hover:-rotate-12" />
        ) : (
          <Sun className="size-3.5 text-amber-500 transition-transform duration-200 group-hover:rotate-45" />
        )}

        {/* Small subtle badge indicator when in 'system' mode */}
        {theme === 'system' && (
          <span
            className="absolute bottom-1 right-1 size-1.5 rounded-full bg-primary ring-1 ring-background"
            title="Following System Appearance"
          />
        )}
      </Button>

      {/* Small Chevron to open dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-8 -ml-1.5 px-0.5 text-muted-foreground/60 hover:text-foreground cursor-pointer rounded-r-md transition-colors"
        title="Theme options"
        aria-expanded={isOpen}
      >
        <ChevronDown className="size-2.5 opacity-60 hover:opacity-100" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 text-xs select-none">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </div>

          <button
            type="button"
            onClick={() => handleSelect('light')}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="size-3.5 text-amber-500" />
              <span>Light</span>
            </div>
            {theme === 'light' && <Check className="size-3 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelect('dark')}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="size-3.5 text-sky-400" />
              <span>Dark</span>
            </div>
            {theme === 'dark' && <Check className="size-3 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => handleSelect('system')}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              theme === 'system'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Laptop className="size-3.5 text-muted-foreground" />
              <span>System</span>
            </div>
            {theme === 'system' && <Check className="size-3 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}

