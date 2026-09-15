import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../services/api';

/**
 * Sends a heartbeat to the server every 30 seconds.
 * Call this once at the top level of any authenticated page.
 */
export function useHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const beat = () => {
      if (cancelled) return;
      apiFetch('presence/heartbeat.php', { method: 'POST' }).catch(() => {});
    };

    // Send immediately on mount
    beat();
    const id = setInterval(beat, 30000); // every 30s

    // Also beat on visibility change (user comes back to tab)
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

/**
 * Returns a Set of online user IDs, refreshed every 15 seconds.
 */
export function useOnlineUsers() {
  const [onlineIds, setOnlineIds] = useState(new Set());
  const mountedRef = useRef(true);

  const fetchOnline = useCallback(() => {
    apiFetch('presence/online.php')
      .then((data) => {
        if (mountedRef.current && data?.online_user_ids) {
          setOnlineIds(new Set(data.online_user_ids));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchOnline();
    const id = setInterval(fetchOnline, 15000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetchOnline]);

  return onlineIds;
}
