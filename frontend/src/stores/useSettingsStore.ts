import { create } from 'zustand';

interface SettingsState {
  theme: 'dark' | 'system';
  isConsoleOpen: boolean;
  activeConsoleTab: 'mutations' | 'queries';
  liveStreamPaused: boolean;
  isSidebarOpen: boolean;

  setTheme: (theme: 'dark' | 'system') => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setActiveConsoleTab: (tab: 'mutations' | 'queries') => void;
  toggleLiveStreamPause: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const getInitialSidebarState = (): boolean => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vetrolog_sidebar_open');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return true;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  isConsoleOpen: true,
  activeConsoleTab: 'mutations',
  liveStreamPaused: false,
  isSidebarOpen: getInitialSidebarState(),

  setTheme: (theme) => set({ theme }),
  toggleConsole: () => set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
  setConsoleOpen: (open) => set({ isConsoleOpen: open }),
  setActiveConsoleTab: (tab) => set({ activeConsoleTab: tab }),
  toggleLiveStreamPause: () => set((state) => ({ liveStreamPaused: !state.liveStreamPaused })),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.isSidebarOpen;
      if (typeof window !== 'undefined') {
        localStorage.setItem('vetrolog_sidebar_open', String(next));
      }
      return { isSidebarOpen: next };
    }),
  setSidebarOpen: (open) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vetrolog_sidebar_open', String(open));
    }
    set({ isSidebarOpen: open });
  },
}));
