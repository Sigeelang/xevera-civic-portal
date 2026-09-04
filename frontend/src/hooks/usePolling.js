import { useEffect, useRef } from 'react';

/*
 * Runs `callback` every `intervalMs` while the tab is visible.
 *
 * - Pauses automatically when the tab is hidden.
 * - Fires immediately when the tab becomes visible again or the
 *   window regains focus, so data is fresh without waiting a cycle.
 * - Cleans up all listeners and timers on unmount.
 */
export default function usePolling(callback, intervalMs = 10000) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let timer = null;

    const start = () => {
      if (timer || document.hidden) return;
      timer = setInterval(() => cbRef.current(), intervalMs);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else { cbRef.current(); start(); }
    };

    const onFocus = () => {
      if (!document.hidden) cbRef.current();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs]);
}
