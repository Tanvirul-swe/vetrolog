import { useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';

export function useKeyboardShortcuts(onSearchFocus?: () => void, onRefresh?: () => void) {
  const toggleConsole = useSettingsStore((s) => s.toggleConsole);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onSearchFocus?.();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleConsole();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onRefresh?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleConsole, onSearchFocus, onRefresh]);
}
