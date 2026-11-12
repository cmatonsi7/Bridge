import { useEffect } from 'react';
import { syncDirectory } from './directoryService';

const LISTABLE = ['athlete', 'coach', 'organisation'];

/**
 * Once per browser session, quietly refreshes the signed-in person's own directory listing.
 * Fixes a switch that was turned on before the directory existed, and keeps a listing in step with
 * profile changes. Failures are ignored here: the privacy switches report problems themselves.
 */
export function useDirectoryReconcile(uid: string | undefined, role: string | undefined) {
  useEffect(() => {
    if (!uid || !role || !LISTABLE.includes(role)) return;
    const key = `sb-dir-sync:${uid}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* storage unavailable: just try */
    }
    syncDirectory()
      .then(() => {
        try {
          sessionStorage.setItem(key, '1');
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, [uid, role]);
}

/** Best-effort refresh after a profile save, so the directory doesn't show an old sport or town. */
export const refreshDirectoryQuietly = () => {
  syncDirectory().catch(() => {});
};
