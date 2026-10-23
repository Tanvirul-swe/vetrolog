import * as AppBindings from '@/../wailsjs/go/app/App';
import { isWailsApp } from '@/services/apiBridge';

export interface TelemetryStatus {
  enabled: boolean;
  clientId: string;
}

const LOCAL_STORAGE_OPT_OUT = 'vetrolog_telemetry_opt_out';
const LOCAL_STORAGE_CLIENT_ID = 'vetrolog_telemetry_client_id';

function getFallbackClientId(): string {
  try {
    let id = localStorage.getItem(LOCAL_STORAGE_CLIENT_ID);
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(LOCAL_STORAGE_CLIENT_ID, id);
    }
    return id;
  } catch {
    return 'fallback-client';
  }
}

export const telemetry = {
  /**
   * Dispatches an anonymous event to the backend telemetry engine.
   * Never transmits sensitive data, query strings, or schema definitions.
   */
  trackEvent: async (name: string, params: Record<string, unknown> = {}): Promise<void> => {
    try {
      if (isWailsApp() && typeof AppBindings.TrackTelemetryEvent === 'function') {
        await AppBindings.TrackTelemetryEvent(name, JSON.stringify(params));
        return;
      }

      // Browser fallback (checks local opt-out)
      const optOut = localStorage.getItem(LOCAL_STORAGE_OPT_OUT) === 'true';
      if (!optOut && import.meta.env.DEV) {
        // In local development, log to console for visibility
        console.debug(`[Telemetry Preview] ${name}`, params);
      }
    } catch {
      // Fail silently; analytics must never interrupt user workflows
    }
  },

  /**
   * Tracks developer feature usage (e.g. playground execution, AI queries, in-place edits).
   */
  trackFeature: (featureName: string, metadata: Record<string, unknown> = {}): void => {
    telemetry.trackEvent('feature_used', {
      feature_name: featureName,
      ...metadata,
    });
  },

  /**
   * Tracks ADB or local device connectivity.
   */
  trackDeviceConnected: (connectionType: 'adb_usb' | 'adb_wifi' | 'emulator', platform = 'android'): void => {
    telemetry.trackEvent('device_connected', {
      connection_type: connectionType,
      platform,
    });
  },

  /**
   * Tracks database inspection category without leaking table or database names.
   */
  trackDatabaseInspected: (framework: string, liveSync: boolean, tableCount: number): void => {
    let bucket = '1-5';
    if (tableCount > 20) bucket = '20+';
    else if (tableCount > 5) bucket = '6-20';

    telemetry.trackEvent('database_inspected', {
      framework,
      live_sync: liveSync,
      table_bucket: bucket,
    });
  },

  /**
   * Retrieves whether telemetry is active and the anonymous client identifier.
   */
  getStatus: async (): Promise<TelemetryStatus> => {
    try {
      if (isWailsApp() && typeof AppBindings.GetTelemetryStatus === 'function') {
        const res = await AppBindings.GetTelemetryStatus();
        return {
          enabled: Boolean(res?.enabled),
          clientId: String(res?.clientId || ''),
        };
      }
    } catch {
      // Fallback
    }

    const optOut = localStorage.getItem(LOCAL_STORAGE_OPT_OUT) === 'true';
    return {
      enabled: !optOut,
      clientId: getFallbackClientId(),
    };
  },

  /**
   * Updates user opt-in / opt-out preferences.
   */
  setEnabled: async (enabled: boolean): Promise<boolean> => {
    try {
      localStorage.setItem(LOCAL_STORAGE_OPT_OUT, String(!enabled));
      if (isWailsApp() && typeof AppBindings.SetTelemetryEnabled === 'function') {
        return await AppBindings.SetTelemetryEnabled(enabled);
      }
    } catch {
      // Fallback
    }
    return enabled;
  },
};
