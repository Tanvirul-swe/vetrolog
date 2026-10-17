import { useState, useEffect } from 'react';

export const CURRENT_VERSION = 'v1.1.0';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

function compareVersions(v1: string, v2: string): number {
  // Strip 'v' prefix
  const clean1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const clean2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(clean1.length, clean2.length);
  for (let i = 0; i < len; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function useUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    hasUpdate: false,
    latestVersion: CURRENT_VERSION,
    releaseUrl: 'https://github.com/Tanvirul-swe/vetrolog/releases',
    releaseNotes: '',
  });

  useEffect(() => {
    let isMounted = true;

    async function checkForUpdates() {
      try {
        const response = await fetch('https://api.github.com/repos/Tanvirul-swe/vetrolog/releases/latest', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const latestTag = data.tag_name;

        if (latestTag && compareVersions(latestTag, CURRENT_VERSION) > 0) {
          if (isMounted) {
            setUpdateInfo({
              hasUpdate: true,
              latestVersion: latestTag,
              releaseUrl: data.html_url || 'https://github.com/Tanvirul-swe/vetrolog/releases/latest',
              releaseNotes: data.body || '',
            });
          }
        }
      } catch {
        // Silently ignore network or offline errors
      }
    }

    // Check on startup
    checkForUpdates();

    return () => {
      isMounted = false;
    };
  }, []);

  return updateInfo;
}
