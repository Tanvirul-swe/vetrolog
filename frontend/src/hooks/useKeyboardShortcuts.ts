import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useKeyboardShortcuts(onRefresh?: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onRefresh?.();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        useSettingsStore.getState().toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRefresh]);
}
