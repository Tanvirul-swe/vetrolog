import { useState } from 'react';
import {
  User,
  Sparkles,
  Shield,
  Cloud,
  Laptop,
  CheckCircle2,
  X,
  Sun,
  Moon,
  LogOut,
  Loader2,
  Lock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { TelemetrySettingsModal } from '@/features/telemetry/components/TelemetrySettingsModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'upcoming'>('profile');
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);

  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isAuthenticating = useAuthStore((s) => s.isAuthenticating);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0 duration-150">
        <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col text-foreground max-h-[90vh]">
          {/* Header with Cover Accent */}
          <div className="relative bg-gradient-to-r from-primary/20 via-sky-500/10 to-primary/5 p-6 border-b border-border/60">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors bg-background/50 hover:bg-background/80 cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="size-14 rounded-2xl bg-gradient-to-tr from-primary to-sky-400 p-0.5 shadow-lg shadow-primary/25">
                  <div className="size-full bg-card rounded-[14px] flex items-center justify-center text-primary font-bold text-xl select-none overflow-hidden">
                    {isAuthenticated && user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || 'User'}
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : isAuthenticated && user?.name ? (
                      <span className="text-lg font-bold text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <User className="size-7 text-primary" />
                    )}
                  </div>
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-card ${
                    isAuthenticated ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                  }`}
                  title={isAuthenticated ? 'Online & Authenticated' : 'Local Offline Mode'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-foreground tracking-tight truncate">
                    {isAuthenticated ? user?.name || 'Developer' : 'Local Developer'}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      isAuthenticated
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-primary/10 text-primary border-primary/30'
                    }`}
                  >
                    {isAuthenticated ? 'Google Account' : 'Local'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  {isAuthenticated ? user?.email : 'vetrolog-dev@local'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center border-b border-border/60 px-6 bg-muted/20">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`py-2.5 text-xs font-medium border-b-2 transition-all mr-4 cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Account Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`py-2.5 text-xs font-medium border-b-2 transition-all mr-4 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'privacy'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="size-3 text-sky-400" />
              <span>Privacy & Telemetry</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
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
          <div className="p-6 space-y-4 overflow-y-auto">
            {activeTab === 'profile' && (
              <div className="space-y-4">
                {/* Auth Error Banner */}
                {authError && (
                  <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 flex items-center justify-between text-xs text-destructive">
                    <span>{authError}</span>
                    <button onClick={clearError} className="underline text-[11px] cursor-pointer">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Authentication Status Section */}
                {!isAuthenticated ? (
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/25 space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lock className="size-3.5 text-primary" />
                        <span>Sign In (Optional)</span>
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sign in with Google to personalize your developer profile and prepare for cross-device cloud sync.
                        All core database management and ADB debugging features remain <strong className="text-foreground">100% free and offline</strong>.
                      </p>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        onClick={loginWithGoogle}
                        disabled={isAuthenticating || isLoading}
                        className="w-full h-9 text-xs gap-2 bg-foreground text-background hover:bg-foreground/90 font-medium"
                      >
                        {isAuthenticating ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <svg className="size-3.5" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                            />
                          </svg>
                        )}
                        <span>{isAuthenticating ? 'Waiting for browser...' : 'Sign in with Google'}</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Authenticated User Details Card */
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-foreground">
                          Google Account Connected
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        Authenticated
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Name</span>
                        <span className="font-medium text-foreground">{user?.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Email</span>
                        <span className="font-mono text-foreground truncate block">{user?.email}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        disabled={isLoading}
                        className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        {isLoading ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
                        <span>Sign Out</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* System & Workspace Info */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/25 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Workspace Tier</span>
                    <span className="font-semibold text-foreground">VetroLog Professional (Desktop)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Local Engine</span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      Offline Native Storage
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">App Version</span>
                    <span className="font-mono text-foreground font-semibold">v1.5.1</span>
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
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-3.5">
                <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                    <ShieldCheck className="size-4" />
                    <span>Privacy-First Open Source Telemetry</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    VetroLog collects anonymous, privacy-preserving usage metrics solely to understand which database engines
                    and features need optimization. We strictly uphold our open-source privacy contract:
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-lg border border-border/70 bg-muted/20 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground">Zero Personally Identifiable Information (PII)</span>
                      <p className="text-[11px] text-muted-foreground">
                        Emails, names, and IP addresses are never transmitted to analytics servers.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-border/70 bg-muted/20 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground">Zero Database Data Leaks</span>
                      <p className="text-[11px] text-muted-foreground">
                        Your SQL queries, table names, connection strings, credentials, and row contents never leave your machine.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-border/70 bg-muted/20 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground">Irreversible Pseudonymous User ID</span>
                      <p className="text-[11px] text-muted-foreground">
                        When signed in, telemetry uses a one-way irreversible SHA-256 hash (<code className="font-mono text-primary">sha256(sub)</code>) for cross-session retention tracking.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center border-t border-border/60">
                  <span className="text-xs text-muted-foreground">Manage opt-out and audit telemetry:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTelemetryModalOpen(true)}
                    className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <span>Open Telemetry Settings</span>
                    <ExternalLink className="size-3" />
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'upcoming' && (
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

      <TelemetrySettingsModal
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
      />
    </>
  );
}
