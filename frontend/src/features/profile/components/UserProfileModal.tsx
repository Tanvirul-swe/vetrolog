import { useState } from 'react';
import { User, Sparkles, Shield, Cloud, Laptop, CheckCircle2, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useThemeStore } from '@/stores/useThemeStore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'upcoming'>('profile');
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col text-foreground">
        {/* Header with Cover Accent */}
        <div className="relative bg-gradient-to-r from-primary/20 via-sky-500/10 to-primary/5 p-6 border-b border-border/60">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors bg-background/50 hover:bg-background/80"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="size-14 rounded-2xl bg-gradient-to-tr from-primary to-sky-400 p-0.5 shadow-lg shadow-primary/25">
                <div className="size-full bg-card rounded-[14px] flex items-center justify-center text-primary font-bold text-xl select-none">
                  <User className="size-7 text-primary" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-card" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground tracking-tight">Developer Profile</h2>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  Local
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">vetrolog-dev@local</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-border/60 px-6 bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-all mr-4 ${
              activeTab === 'profile'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Account Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3 text-amber-400" />
            <span>Upcoming Features</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'profile' ? (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/25 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Workspace Tier</span>
                  <span className="font-semibold text-foreground">VetroLog Professional (Desktop)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Session Type</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Offline Native Storage
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">App Version</span>
                  <span className="font-mono text-foreground font-semibold">v1.4.0</span>
                </div>
              </div>

              {/* Theme & Appearance Preference */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-muted/25 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sun className="size-3.5 text-amber-500" />
                    <span>Appearance & Theme</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono capitalize">
                    {theme} {theme === 'system' ? `(${resolvedTheme})` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'bg-background border-primary text-foreground shadow-xs ring-1 ring-primary/40 font-semibold'
                        : 'bg-card/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Sun className="size-4 text-amber-500" />
                    <span>Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-background border-primary text-foreground shadow-xs ring-1 ring-primary/40 font-semibold'
                        : 'bg-card/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Moon className="size-4 text-sky-400" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-2 rounded-lg border text-xs flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      theme === 'system'
                        ? 'bg-background border-primary text-foreground shadow-xs ring-1 ring-primary/40 font-semibold'
                        : 'bg-card/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Laptop className="size-4 text-primary" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              {/* Upcoming Feature Notice Banner */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <Sparkles className="size-4" />
                  <span>Cloud User Profiles & Sync (Upcoming)</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In upcoming releases, you'll be able to sign in to sync encrypted database connection profiles, query snippets, and custom queries across all your workstations.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-border/70 bg-muted/20 flex items-start gap-3">
                <Cloud className="size-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Cloud Sync & Backup</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    End-to-end encrypted backup of your database connection catalogs across multiple development laptops.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-muted/20 flex items-start gap-3">
                <Laptop className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Multi-Device Workspaces</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Seamlessly switch between office and home setups while maintaining active saved queries and SSH profiles.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-muted/20 flex items-start gap-3">
                <Shield className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-foreground">Team Collaboration & Secrets Sharing</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Share staging and testing database configurations securely with your engineering team.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">
            VetroLog Studio © 2026
          </span>
          <Button variant="default" size="sm" onClick={onClose} className="h-8 text-xs px-4">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

