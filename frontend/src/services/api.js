const API_BASE = '/api';
const UPLOADS_BASE = '';
const TOKEN_KEY = 'xevera_auth_token';
const ACTIVITY_KEY = 'xevera_last_activity';

/*
 * Role-differentiated session persistence:
 * - Resident tokens live in localStorage (survive tab close -> resume dashboard).
 * - Staff/Admin/Super Admin tokens live in sessionStorage (die with the tab
 *   -> always return to the login page after close).
 * Role is read from the token payload itself, so no caller changes needed.
 */
function storageForRole(role) {
  try {
    if (isPrivilegedRole(role)) return sessionStorage;
  } catch { /* storage unavailable */ }
  try { return localStorage; } catch { return null; }
}

function isPrivilegedRole(role) {
  return role === 'Staff' || role === 'Admin' || role === 'Super Admin';
}

function readStoredToken() {
  try {
    const sess = sessionStorage.getItem(TOKEN_KEY);
    if (sess) return { token: sess, store: 'session' };
  } catch {}
  try {
    const loc = localStorage.getItem(TOKEN_KEY);
    if (loc) return { token: loc, store: 'local' };
  } catch {}
  return { token: null, store: null };
}

// Resolve a backend-relative path (e.g. "uploads/photo_x.jpg" or "profile_8_x.jpg")
// into a URL that goes through the Vite proxy (/uploads/...).
export function uploadUrl(path) {
  if (!path || typeof path !== 'string') return null;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('uploads/')) return `${UPLOADS_BASE}/${clean}`;
  return `${UPLOADS_BASE}/uploads/${clean}`;
}

let authToken = null;
let authTokenStore = null; // 'session' | 'local' | null — where authToken was read from

try {
  const stored = readStoredToken();
  if (stored.token && !(stored.store === 'local' && isPrivilegedRole(decodeToken(stored.token)?.role))) {
    authToken = stored.token;
    authTokenStore = stored.store;
  } else if (stored.token) {
    // One-time migration: privileged token left in localStorage is dropped.
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }
} catch {
  authToken = null;
  authTokenStore = null;
}

function decodeBase64Url(s) {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function decodeToken(token) {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  const b64 = dot === -1 ? token : token.slice(0, dot);
  try {
    return JSON.parse(decodeBase64Url(b64));
  } catch {
    return null;
  }
}

export function setToken(token) {
  /*
   * Per-account isolation: always wipe the previous token (both the
   * in-memory `authToken` and the persisted localStorage entry) before
   * storing a new one. The next API call must use the freshly stored
   * token - never a stale one from the previous user.
   */
  authToken = null;
  authTokenStore = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  if (!token) return;
  authToken = token;
  const role = decodeToken(token)?.role;
  const store = storageForRole(role);
  authTokenStore = store === null ? null : (isPrivilegedRole(role) ? 'session' : 'local');
  try {
    store && store.setItem(TOKEN_KEY, token);
  } catch {}
  touchActivity();
}

export function getToken() {
  if (authToken) {
    // Privileged tokens are only honored from session storage; anything
    // else in memory is a stale pre-policy leftover.
    if (isPrivilegedRole(decodeToken(authToken)?.role) && authTokenStore !== 'session') {
      authToken = null;
      authTokenStore = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      return null;
    }
    return authToken;
  }
  const { token, store } = readStoredToken();
  if (!token) return null;
  /*
   * One-time migration to role-differentiated persistence: a privileged
   * token left over in localStorage from before this policy is dropped
   * (forces re-login -> sessionStorage), never silently honored.
   */
  const role = decodeToken(token)?.role;
  if (store === 'local' && isPrivilegedRole(role)) {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    return null;
  }
  authToken = token;
  authTokenStore = store;
  return authToken;
}

export function clearToken() {
  authToken = null;
  authTokenStore = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/*
 * Last-activity timestamp (localStorage so it survives tab close).
 * Stamped on every authenticated API response and on explicit UI
 * activity; read on boot and by the idle watchdog. Missing value means
 * "session just started" - callers treat it as now.
 */
export function touchActivity(now) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now || Date.now()));
  } catch {}
}

export function getLastActivity() {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearActivity() {
  try { localStorage.removeItem(ACTIVITY_KEY); } catch {}
}

// OTP Verification Endpoints

export async function sendOtp(email, purpose) {
  return apiFetch('auth/forgot.php', {
    method: 'POST',
    body: { email, purpose },
  });
}

export async function verifyOtp(email, otp, purpose) {
  return apiFetch('auth/verify-otp.php', {
    method: 'POST',
    body: { email, otp, purpose },
  });
}

export async function resetPassword(email, newPassword, purpose) {
  return apiFetch('auth/reset.php', {
    method: 'POST',
    body: { email, newPassword, purpose },
  });
}

export async function resendOtp(email, purpose) {
  return apiFetch('auth/resend-otp.php', {
    method: 'POST',
    body: { email, purpose },
  });
}

export async function apiFetch(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  if (authToken) {
    config.headers['Authorization'] = 'Bearer ' + authToken;
  }

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const res = await fetch(API_BASE + '/' + endpoint, config);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /*
     * Non-JSON body (PHP fatal, proxy failure, etc.). Surface the HTTP
     * status plus a short snippet of the body so the real backend
     * failure is visible instead of a generic "Invalid server response".
     */
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    const err = new Error(`Server error (${res.status}): ${snippet || 'empty response'}`);
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }

  // Session liveness: an authenticated response proves the user is active.
  if (config.headers['Authorization']) touchActivity();

  return data;
}
