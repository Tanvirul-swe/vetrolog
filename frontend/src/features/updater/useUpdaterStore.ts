import { create } from 'zustand';
import { apiBridge, UpdateInfoBridge } from '@/services/apiBridge';
import { EventsOn } from '@/../wailsjs/runtime/runtime';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'extracting'
  | 'ready'
  | 'applying'
  | 'error'
  | 'postponed';

export interface ProgressData {
  percent: number;
  speed: string;
  downloaded: string;
  total: string;
  bytesRead: number;
  totalBytes: number;
}

interface UpdaterStoreState {
  status: UpdaterStatus;
  updateInfo: UpdateInfoBridge | null;
  progress: ProgressData;
  isModalOpen: boolean;
  countdown: number;
  isCountdownActive: boolean;
  errorMessage: string | null;

  checkForUpdates: () => Promise<void>;
  startDownload: () => Promise<void>;
  applyAndRestart: () => Promise<void>;
  postpone: () => void;
  openModal: () => void;
  closeModal: () => void;
  tickCountdown: () => void;
  simulateUpdateFlow: () => void;
  initEventListeners: () => () => void;
}

export const CURRENT_APP_VERSION = 'v1.3.2';

export const useUpdaterStore = create<UpdaterStoreState>((set, get) => ({
  status: 'idle',
  updateInfo: null,
  progress: {
    percent: 0,
    speed: '',
    downloaded: '0 MB',
    total: '0 MB',
    bytesRead: 0,
    totalBytes: 0,
  },
  isModalOpen: false,
  countdown: 5,
  isCountdownActive: false,
  errorMessage: null,

  checkForUpdates: async () => {
    const currentStatus = get().status;
    if (currentStatus === 'downloading' || currentStatus === 'extracting' || currentStatus === 'applying') {
      return;
    }

    set({ status: 'checking', errorMessage: null });
    try {
      const info = await apiBridge.checkForUpdate();
      if (!info || !info.hasUpdate) {
        set({ status: 'idle', updateInfo: info });
        return;
      }

      set({ status: 'idle', updateInfo: info });

      // If update is available and assetUrl is found, automatically trigger background download
      if (info.assetUrl) {
        await get().startDownload();
      }
    } catch (err: any) {
      console.warn('[VetroLog Updater] Check failed:', err);
      set({ status: 'idle', errorMessage: err?.message || 'Check failed' });
    }
  },

  startDownload: async () => {
    const { updateInfo } = get();
    if (!updateInfo || !updateInfo.assetUrl) return;

    set({
      status: 'downloading',
      progress: {
        percent: 0,
        speed: '',
        downloaded: '0 MB',
        total: updateInfo.assetSize ? `${(updateInfo.assetSize / (1024 * 1024)).toFixed(1)} MB` : 'Calculating...',
        bytesRead: 0,
        totalBytes: updateInfo.assetSize || 0,
      },
      errorMessage: null,
    });

    const success = await apiBridge.startDownloadUpdate(updateInfo.assetUrl, updateInfo.latestVersion);
    if (!success) {
      set({ status: 'error', errorMessage: 'Could not start background download' });
    }
  },

  applyAndRestart: async () => {
    const { updateInfo } = get();
    if (!updateInfo) return;

    set({ status: 'applying', isCountdownActive: false });
    await apiBridge.applyUpdateAndRestart(updateInfo.latestVersion);
  },

  postpone: () => {
    set({
      status: 'postponed',
      isModalOpen: false,
      isCountdownActive: false,
    });
  },

  openModal: () => {
    set({ isModalOpen: true });
  },

  closeModal: () => {
    set({
      isModalOpen: false,
      isCountdownActive: false,
      status: get().status === 'ready' ? 'postponed' : get().status,
    });
  },

  tickCountdown: () => {
    const { countdown, isCountdownActive, applyAndRestart } = get();
    if (!isCountdownActive) return;

    if (countdown <= 1) {
      set({ countdown: 0, isCountdownActive: false });
      applyAndRestart();
    } else {
      set({ countdown: countdown - 1 });
    }
  },

  simulateUpdateFlow: () => {
    const mockInfo: UpdateInfoBridge = {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: 'v1.3.2',
      releaseName: 'v1.3.2 — Serverless Product Analytics & Privacy Controls',
      releaseNotes: '### What is New in v1.3.2:\n• Anonymous serverless telemetry via GA4 Measurement Protocol\n• Privacy & Analytics Settings Modal with 1-click opt-out\n• Real-time feature usage and active user tracking\n• Continuous stability and performance enhancements',
      releaseUrl: 'https://github.com/Tanvirul-swe/vetrolog/releases',
      assetUrl: 'https://github.com/Tanvirul-swe/vetrolog/releases/download/v1.2.0/VetroLog-macOS-Universal.zip',
      assetName: 'VetroLog-macOS-Universal.zip',
      assetSize: 46 * 1024 * 1024,
      publishedAt: new Date().toISOString(),
      hasUpdate: true,
    };

    set({
      status: 'downloading',
      updateInfo: mockInfo,
      progress: {
        percent: 5,
        speed: '4.8 MB/s',
        downloaded: '2.3 MB',
        total: '46.0 MB',
        bytesRead: 2300000,
        totalBytes: 46000000,
      },
      isModalOpen: false,
      errorMessage: null,
    });

    let current = 5;
    const interval = setInterval(() => {
      current += 20;
      if (current >= 100) {
        clearInterval(interval);
        set({
          status: 'extracting',
          progress: {
            percent: 100,
            speed: '',
            downloaded: 'Verifying package...',
            total: '46.0 MB',
            bytesRead: 46000000,
            totalBytes: 46000000,
          },
        });

        setTimeout(() => {
          set({
            status: 'ready',
            isModalOpen: true,
            countdown: 5,
            isCountdownActive: true,
            progress: {
              percent: 100,
              speed: '',
              downloaded: 'Complete',
              total: 'Complete',
              bytesRead: 46000000,
              totalBytes: 46000000,
            },
          });
        }, 800);
      } else {
        set({
          progress: {
            percent: current,
            speed: `${(4.5 + Math.random()).toFixed(1)} MB/s`,
            downloaded: `${((46 * current) / 100).toFixed(1)} MB`,
            total: '46.0 MB',
            bytesRead: Math.floor((46000000 * current) / 100),
            totalBytes: 46000000,
          },
        });
      }
    }, 450);
  },

  initEventListeners: () => {
    if (!apiBridge.isWails()) return () => {};

    // 1. Listen for download/extract progress
    const unsubProgress = EventsOn('updater:progress', (data: any) => {
      if (!data) return;

      if (data.status === 'downloading') {
        set({
          status: 'downloading',
          progress: {
            percent: data.percent ?? 0,
            speed: data.speed ?? '',
            downloaded: data.downloaded ?? '',
            total: data.total ?? '',
            bytesRead: data.bytesRead ?? 0,
            totalBytes: data.totalBytes ?? 0,
          },
        });
      } else if (data.status === 'extracting') {
        set({
          status: 'extracting',
          progress: {
            percent: 100,
            speed: '',
            downloaded: data.downloaded || 'Verifying package...',
            total: data.total || '',
            bytesRead: data.bytesRead ?? 0,
            totalBytes: data.totalBytes ?? 0,
          },
        });
      } else if (data.status === 'error') {
        set({
          status: 'error',
          errorMessage: data.error || 'Update download failed',
        });
      }
    });

    // 2. Listen for update ready event
    const unsubReady = EventsOn('updater:ready', () => {
      set({
        status: 'ready',
        isModalOpen: true,
        countdown: 5,
        isCountdownActive: true,
        progress: {
          percent: 100,
          speed: '',
          downloaded: 'Complete',
          total: 'Complete',
          bytesRead: 0,
          totalBytes: 0,
        },
      });
    });

    return () => {
      try {
        unsubProgress();
        unsubReady();
      } catch {
        /* ignore listener cleanup errors */
      }
    };
  },
}));

if (typeof window !== 'undefined') {
  (window as any).testUpdate = () => useUpdaterStore.getState().simulateUpdateFlow();
  (window as any).checkUpdate = () => useUpdaterStore.getState().checkForUpdates();

  if (window.location.search.includes('testUpdate') || window.location.hash.includes('testUpdate')) {
    setTimeout(() => {
      useUpdaterStore.getState().simulateUpdateFlow();
    }, 600);
  }
}
