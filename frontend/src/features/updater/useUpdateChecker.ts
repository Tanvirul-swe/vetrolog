import { useUpdaterStore, CURRENT_APP_VERSION } from './useUpdaterStore';

export const CURRENT_VERSION = CURRENT_APP_VERSION;

export function useUpdateChecker() {
  const updateInfo = useUpdaterStore((s) => s.updateInfo);

  return {
    hasUpdate: Boolean(updateInfo?.hasUpdate),
    latestVersion: updateInfo?.latestVersion || CURRENT_VERSION,
    releaseUrl: updateInfo?.releaseUrl || 'https://github.com/Tanvirul-swe/vetrolog/releases/latest',
    releaseNotes: updateInfo?.releaseNotes || '',
  };
}
