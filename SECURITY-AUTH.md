# Xevera Civic Portal — Authentication & Session Security

**Scope:** backend API authentication on the production deployment
(Amazon Linux 2023 + Apache httpd, `https://xevera-portal.duckdns.org`).
**Purpose:** document how this system satisfies session-security controls, and
why a *PHP session-based* authentication check does not apply to it.

---

## 1. Summary

The portal does **not** use PHP sessions (`session_start()` / `$_SESSION` /
session cookies). Authentication is a **stateless, HMAC-signed bearer token**
that is validated from scratch on every request.

A "PHP Session-Based Authentication" control targets applications that keep
identity in a server-side session referenced by a cookie. This system uses a
different, and for an API generally stronger, model: the credential is a
signed token presented in the `Authorization` header, so there is no session
cookie to steal, fix, or replay cross-site.

Nothing needs to be added for that checklist item. Section 3 maps each
expected session control to the mechanism that provides the equivalent
guarantee here.

---

## 2. How authentication actually works

1. **Login** — `backend/api/auth/login.php`
   Verifies the password with `password_verify()` against a stored hash, under
   a progressive brute-force throttle keyed on both account and IP.
2. **Two-factor (when required)** — login returns a short-lived token with
   `scope = '2fa_pending'` (`exp = now + 300s`). This token is explicitly
   **not a session**: `requireAuth()` rejects it on every protected endpoint
   (`backend/api/middleware/auth.php`). Only `auth/verify-login-otp.php`,
   after a valid OTP, may consume it.
3. **Session issuance** — `backend/api/auth/login_common.php:92`
   `xevera_issue_session()` runs **only after** full verification and issues a
   token with `exp = now + 86400 * 7` (7 days) and a random `jti`.
4. **Token format** — `backend/api/middleware/token.php`
   `base64url(payload) . '.' . hmac_sha256(b64, APP_KEY)`. Verification
   recomputes the HMAC and compares with `hash_equals()` (constant time),
   then checks `exp`, then the revocation list.
5. **Every request** — `backend/api/middleware/auth.php: requireAuth()`
   - no / malformed / badly-signed / expired token → `401`
   - `scope == '2fa_pending'` → `401` (cannot be used as a session)
   - account `status` is re-read from the database **on every request**; any
     lookup failure denies the request (fail closed)
   - if the token's `jti` is in `token_blacklist` → `401`
6. **Logout / revocation** — `auth/logout.php` inserts the token's `jti` into
   `token_blacklist`; `requireAuth()` rejects it from then on even though the
   signature is still valid.
7. **Client-side idle timeout** — the browser app logs the user out after
   **15 minutes** of inactivity, and stores tokens in `sessionStorage` for
   Staff/Admin/Super Admin and `localStorage` for Residents.

---

## 3. Control mapping (session control → equivalent here)

| Expected session control | How this system provides it | Where |
|---|---|---|
| Credential verification | `password_verify()` against a hash, with progressive lockout | `auth/login.php` |
| Session identifier | 256-bit HMAC-signed token + random 128-bit `jti` | `middleware/token.php:67` |
| Validated on every request | `requireAuth()` on all protected endpoints | `middleware/auth.php` |
| **Session fixation** | Structurally impossible — the token is minted at authentication and never adopted from client input | `auth/login_common.php:91` |
| Pre-auth artifact cannot be a session | `2fa_pending` scope rejected by `requireAuth()` at every endpoint | `middleware/auth.php`, `auth/login.php:214` |
| **Session hijack mitigation** | Token is header-only (never in a URL), TLS-only + HSTS; no cookie to auto-attach cross-site | `middleware/token.php:81`, `config/headers.php` |
| Idle timeout | 15-minute client inactivity logout; token `exp` ≤ 7 days | frontend auth context, `login_common.php:92` |
| Logout / revocation | `jti` → `token_blacklist`, checked per request | `auth/logout.php`, `middleware/token.php:110` |
| Account disable | Live `users.status` lookup each request, **fail closed** | `middleware/auth.php` |
| **CSRF** | Structurally immune — credentials are not cookies; additionally, state-changing requests from a non-allow-listed `Origin` are rejected `403` | `config/cors.php:50` |
| Sensitive response caching | `Cache-Control: no-store, private, max-age=0` + `Pragma: no-cache` on every API response | `config/headers.php` |
| Cookie flags (defense in depth) | Not applicable (no cookies); `php.ini` is hardened anyway — see §5 | `php.ini` |

---

## 4. Proof (reproducible)

```bash
# 1. No PHP session usage anywhere in the API (excluding vendor):
grep -rIn 'session_start|session_regenerate_id|\$_SESSION|setcookie' \
     /var/www/xevera/backend/api --include=*.php | grep -v vendor
#    → (no output)

# 2. middleware/sessions.php is a dormant Phase-0 stub: every function
#    returns null and no caller requires the file.
grep -rIn "require.*middleware/sessions" /var/www/xevera/backend/api --include=*.php
#    → (no output)

# 3. The token is header-only; a token in the query string is not accepted:
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://xevera-portal.duckdns.org/api/direct_messages/list.php?token=abc'
#    → 401

# 4. Security headers on an API response:
curl -s -D - -o /dev/null \
  https://xevera-portal.duckdns.org/api/announcements/list.php | grep -iE \
  'HTTP/|cache-control|pragma|strict-transport|x-content-type|x-frame|referrer|permissions-policy'
#    → 200, Cache-Control: no-store, private, max-age=0 / Pragma: no-cache
#      X-Content-Type-Options: nosniff / X-Frame-Options: DENY /
#      Referrer-Policy: strict-origin-when-cross-origin /
#      Permissions-Policy: … / Strict-Transport-Security: max-age=31536000
```

Observed results at time of writing matched all four.

---

## 5. Defense in depth: php.ini session settings

Even though no code opens a PHP session, the interpreter is configured so
that if one were ever introduced it would already be safe:

```
session.cookie_httponly = On
session.cookie_secure   = On
session.use_strict_mode = On
session.use_only_cookies = On
```

---

## 6. Verification tooling

Two systemd timers run on the production host (there is no `cron` daemon
installed):

| Unit | Schedule | Purpose |
|---|---|---|
| `xevera-security-smoke.timer` | weekly (Mon 06:00 UTC) | asserts path protections still return `403`, that guest responses no longer leak staff/resident identities, and that the portal is still reachable |
| `xevera-maintenance-sync.timer` | every 60 s | drives `maintenance/sync.php`, which activates/completes scheduled maintenance windows (the browser app never calls it, and it requires the `XEVERA_MAINTENANCE_CRON_SECRET` shared secret) |

The smoke test logs to `/var/log/xevera-security-smoke.log`; the maintenance
scheduler logs only on state change or error to
`/var/log/xevera-maintenance-sync.log`.

---

## 7. Known limitations / follow-ups

- **Token in browser storage.** Residents' tokens live in `localStorage`, so a
  successful XSS could read them. This is mitigated by a restrictive CSP and
  by input escaping, but it is a real residual risk of any browser-stored
  bearer credential. A future hardening step is the dormant
  `middleware/sessions.php` Phase-1 work (HttpOnly cookies + server-side
  session store), which would remove `localStorage` from the threat model.
- **No server-side idle expiry.** The 15-minute idle logout is client-side; a
  token remains valid server-side until its 7-day `exp` unless revoked by
  logout. Shortening the token TTL or adding a `last_activity_at` check in
  `requireAuth()` would close this.
- **Token rotation.** Tokens are not refreshed; users re-authenticate at the
  7-day boundary.

---

*This document describes control *equivalence*, not a claim that PHP sessions
are in use. No PHP session code exists in this codebase by design.*
