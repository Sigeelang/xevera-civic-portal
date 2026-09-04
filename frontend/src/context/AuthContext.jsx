import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, setToken, getToken, clearToken, clearActivity, decodeToken, touchActivity, getLastActivity } from '../services/api';
import { useSettings } from './SettingsContext';

const AuthContext = createContext(null);

/*
 * User-epoch marker. Every per-user polling effect (sidebar, topbar,
 * notifications) captures the current epoch and the current user id at
 * fetch time, and bails on the response if either has changed in the
 * meantime. Together with the `xevera:user` window event, this is
 * what prevents the previous user's "Message Box: 8" badge from
 * flashing on the next account's screen.
 */
function nextUserEpoch() {
  if (typeof window === 'undefined') return 1;
  const current = Number(window.__XEVERA_USER_EPOCH) || 0;
  const next = current + 1;
  window.__XEVERA_USER_EPOCH = next;
  return next;
}

function notifyUserChange(payload) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('xevera:user', { detail: { id: payload?.id ?? null, role: payload?.role ?? null, ts: Number(window.__XEVERA_USER_EPOCH) || 0 } }));
  } catch { /* ignore - event is a hint, not a contract */ }
}

export function getUserEpoch() {
  if (typeof window === 'undefined') return 0;
  return Number(window.__XEVERA_USER_EPOCH) || 0;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const settings = useSettings();
  const idleMs = (settings?.idleTimeoutMinutes || 15) * 60 * 1000;
  const idleMsRef = useRef(idleMs);
  idleMsRef.current = idleMs;
  const userRef = useRef(null);
  userRef.current = user;

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = decodeToken(token);
        if (payload && payload.exp > Math.floor(Date.now() / 1000)) {
          // Closed-tab gap check: a token older than the inactivity window
          // (no API/UI activity recorded) is treated as expired.
          const last = getLastActivity();
          if (last !== null && Date.now() - last > idleMsRef.current) {
            clearToken();
            clearActivity();
          } else {
            setUser(payload);
            if (last === null) touchActivity();
          }
        } else {
          clearToken();
        }
      } catch (e) {
        // Malformed or invalid token - clear it
        clearToken();
      }
    }
    setLoading(false);
  }, []);

  /*
   * Idle watchdog + close tracking (15 min default, live from System Settings):
   * - UI activity (pointer/keyboard/scroll) refreshes the timestamp.
   * - visibilitychange/beforeunload stamp it so a closed tab leaves a
   *   close-time marker for the gap check above on next visit.
   * - A 60 s interval signs out tabs left open but idle: backend logout
   *   first (revokes the token jti), then local wipe + login redirect.
   * Staff/Admin/Super Admin tokens live in sessionStorage, so closing the
   * tab already ends their session; residents persist and resume.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let lastWrite = 0;
    const stamp = () => {
      const now = Date.now();
      if (now - lastWrite < 30000) return;
      lastWrite = now;
      touchActivity(now);
    };
    const stampAlways = () => {
      lastWrite = Date.now();
      touchActivity(lastWrite);
    };
    const onVisible = () => {
      if (document.visibilityState === 'hidden') stampAlways();
    };
    const idleLogout = async () => {
      try { await apiFetch('auth/logout.php', { method: 'POST' }); } catch {}
      if (typeof window !== 'undefined') nextUserEpoch();
      clearToken();
      clearActivity();
      try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
      setUser(null);
      notifyUserChange(null);
      try { window.location.href = '/login'; } catch {}
    };
    const tick = () => {
      if (!userRef.current) return;
      const last = getLastActivity();
      if (last !== null && Date.now() - last > idleMsRef.current) {
        idleLogout();
      }
    };
    window.addEventListener('pointerdown', stamp, { passive: true });
    window.addEventListener('keydown', stamp);
    window.addEventListener('scroll', stamp, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeunload', stampAlways);
    const timer = setInterval(tick, 60000);
    return () => {
      window.removeEventListener('pointerdown', stamp);
      window.removeEventListener('keydown', stamp);
      window.removeEventListener('scroll', stamp);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeunload', stampAlways);
      clearInterval(timer);
    };
  }, []);

  /*
   * setUser is the only place where the authenticated identity
   * changes. Bump the user-epoch and broadcast the change to every
   * per-user consumer so stale React state never survives the switch.
   */
  function applyUserChange(payload) {
    if (typeof window !== 'undefined') {
      nextUserEpoch();
    }
    setUser(payload);
    notifyUserChange(payload);
  }

  async function login(email, password, scope = 'public') {
    /*
     * Per-account isolation: clear any token from a previous session
     * before initiating the new login flow. The stale token is removed
     * from localStorage AND from the in-memory api.js cache so that any
     * concurrent in-flight request no longer carries it.
     */
    clearToken();
    setUser(null);
    const data = await apiFetch('auth/login.php', {
      method: 'POST',
      body: { email, password, scope },
    });
    /*
     * When 2FA is required the backend returns otp_required + a
     * short-lived pending token - NOT a session. The session is only
     * stored after OTP verification via completeLogin().
     */
    if (data.otp_required) {
      return data;
    }
    setToken(data.token);
    applyUserChange(data.user);
    return data;
  }

  /* Stores the full session after login 2FA has been verified. */
  function completeLogin(data) {
    if (!data?.token) throw new Error('Missing session token.');
    // Same isolation rule - replace the existing session first.
    clearToken();
    setUser(null);
    setToken(data.token);
    applyUserChange(data.user);
    return data;
  }

  async function register(name, email, password, address) {
    const data = await apiFetch('auth/register.php', {
      method: 'POST',
      body: { name, email, password, address },
    });
    setToken(data.token);
    applyUserChange(data.user);
    return data;
  }

  async function logout(redirectTo = '/') {
    try {
      await apiFetch('auth/logout.php', { method: 'POST' });
    } catch {}
    // Hard-clear any user-specific state so the next visitor cannot
    // inherit the previous account's data. The epoch bump + dispatch
    // tells every per-user consumer to drop its cached badges/lists.
    if (typeof window !== 'undefined') {
      nextUserEpoch();
    }
    clearToken();
    clearActivity();
    try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
    setUser(null);
    notifyUserChange(null);
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  }

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeLogin, register, logout, updateUser, getUserEpoch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
