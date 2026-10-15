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
      if (typeof runtime.EventsOn === 'function') {
        const cancel = runtime.EventsOn(eventName, (data: VetroLogEventMap[K]) => {
          callback(data);
        });

        return () => {
          if (typeof cancel === 'function') {
            cancel();
          } else if (typeof runtime.EventsOff === 'function') {
            runtime.EventsOff(eventName);
          }
        };
      }
    } catch (err) {
      console.warn(`[VetroLog] Failed to register Wails event "${eventName}":`, err);
    }
  }, [eventName, ...deps]);
}
