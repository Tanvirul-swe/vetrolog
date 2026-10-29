import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => () => void;
}

const STORAGE_KEY = 'vetrolog_theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

function applyThemeToDOM(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }
  root.style.colorScheme = resolved;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Fallback if localStorage is inaccessible
  }
  return 'system';
}

const initialMode = getInitialTheme();
const initialResolved = resolveEffectiveTheme(initialMode);
// Apply immediately during module evaluation
applyThemeToDOM(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialMode,
  resolvedTheme: initialResolved,

  setTheme: (newTheme: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage write error
    }
    const resolved = resolveEffectiveTheme(newTheme);
    applyThemeToDOM(resolved);
    set({ theme: newTheme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const currentResolved = get().resolvedTheme;
    const nextTheme: ThemeMode = currentResolved === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  initTheme: () => {
    if (typeof window === 'undefined') return () => {};

    // Initial sync
    const currentMode = get().theme;
    const resolved = resolveEffectiveTheme(currentMode);
    applyThemeToDOM(resolved);
    set({ resolvedTheme: resolved });

    // Listen to OS color scheme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const mode = get().theme;
      if (mode === 'system') {
        const nextResolved = e.matches ? 'dark' : 'light';
        applyThemeToDOM(nextResolved);
        set({ resolvedTheme: nextResolved });
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  },
}));

