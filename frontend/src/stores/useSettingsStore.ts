import { create } from 'zustand';

interface SettingsState {
  theme: 'dark' | 'system';
  isConsoleOpen: boolean;
  activeConsoleTab: 'mutations' | 'queries';
  liveStreamPaused: boolean;

  setTheme: (theme: 'dark' | 'system') => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
  setActiveConsoleTab: (tab: 'mutations' | 'queries') => void;
  toggleLiveStreamPause: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  isConsoleOpen: true,
  activeConsoleTab: 'mutations',
  liveStreamPaused: false,

  setTheme: (theme) => set({ theme }),
  toggleConsole: () => set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
  setConsoleOpen: (open) => set({ isConsoleOpen: open }),
  setActiveConsoleTab: (tab) => set({ activeConsoleTab: tab }),
  toggleLiveStreamPause: () => set((state) => ({ liveStreamPaused: !state.liveStreamPaused })),
}));
