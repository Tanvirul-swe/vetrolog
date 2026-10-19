import { useEffect } from 'react';
import { VetroLogEventMap } from '../types/events';
import * as runtime from '../../wailsjs/runtime/runtime';

/**
 * Custom React hook to subscribe to typed Wails IPC events with automatic cleanup.
 */
export function useWailsEvent<K extends keyof VetroLogEventMap>(
  eventName: K,
  callback: (data: VetroLogEventMap[K]) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        // @ts-expect-error window.runtime is injected by Wails webview
        typeof window?.runtime?.EventsOnMultiple === 'function'
      ) {
        const cancel = runtime.EventsOn(eventName, (data: VetroLogEventMap[K]) => {
          callback(data);
        });

        return () => {
          try {
            if (typeof cancel === 'function') {
              cancel();
            } else if (typeof runtime.EventsOff === 'function') {
              runtime.EventsOff(eventName);
            }
          } catch {
            // Safe cleanup
          }
        };
      }
    } catch (err) {
      console.warn(`[VetroLog] Failed to register Wails event "${eventName}":`, err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}
