import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import OtpVerificationPage from './OtpVerificationPage';
import '../../styles/LoginPage.css';

function Shield({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M12 3l7 4v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V7l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ShieldIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M24 5L38 11V22C38 31.5 32.2 39.3 24 43C15.8 39.3 10 31.5 10 22V11L24 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M18 24L22 28L30 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldLogo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M32 7L49 15V29C49 41 42 50 32 57C22 50 15 41 15 29V15L32 7Z"
        fill="none"
        stroke="white"
        strokeWidth="4"
      />
      <path
        d="M25 31L30 36L40 25"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="xevera-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="xevera-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function LoginPage({
  onAuth,
  onForgot,
  onRegister,
  onBack,
  portalType = 'resident',
  allowResident = true,
  initialError,
  error,
  loading = false,
  onLoadingChange,
}) {
  const { login, completeLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [localError, setLocalError] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [residentId, setResidentId] = useState('');
  /* 2FA step: set after password check when the backend requires an OTP */
  const [pending2fa, setPending2fa] = useState(null);
  /* Brute-force lockout countdown */
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutRef = useRef(null);

  /* Countdown timer for lockout — uses lockoutRemaining as dependency.
     The interval decrements the counter; a separate useEffect derives
     the error message from the current value. */
  useEffect(() => {
    if (lockoutRemaining <= 0) {
      if (lockoutRef.current) { clearInterval(lockoutRef.current); lockoutRef.current = null; }
      return;
    }
    lockoutRef.current = setInterval(() => {
      setLockoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => { if (lockoutRef.current) { clearInterval(lockoutRef.current); lockoutRef.current = null; } };
  }, [lockoutRemaining]);

  /* Derive the lockout error message from the countdown value */
  useEffect(() => {
    if (lockoutRemaining > 0) {
      const m = Math.floor(lockoutRemaining / 60);
      const s = lockoutRemaining % 60;
      setLocalError(`Too many failed attempts. Try again in ${m}:${String(s).padStart(2, '0')}`);
    } else {
      setLocalError('');
    }
  }, [lockoutRemaining]);

  /* Keeps focus + caret in the password field across eye toggles. */
  const pwRef = useRef(null);

  function togglePwVisibility() {
    setShowPw((v) => !v);
    requestAnimationFrame(() => {
      const el = pwRef.current;
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
      try {
        const len = el.value ? el.value.length : 0;
        el.setSelectionRange(len, len);
      } catch {}
    });
  }

  /* iOS Safari input safety: passive touchstart on form controls prevents
     double-tap-zoom gesture handling from swallowing the first tap. */
  useEffect(() => {
    const els = document.querySelectorAll('.rlogin-page input, .rlogin-page button');
    const noop = () => {};
    els.forEach((el) => el.addEventListener('touchstart', noop, { passive: true }));
    return () => els.forEach((el) => el.removeEventListener('touchstart', noop));
  }, []);

  const isStaffPortal = portalType === 'staff';

  const title = isStaffPortal
    ? 'Portal Login'
    : 'Resident Login';

  const subtitle = isStaffPortal
    ? 'Sign in to access your Xevera management dashboard.'
    : 'Sign in to access your Xevera resident account.';

  const displayError = error || localError || initialError || '';
  const isLocked = lockoutRemaining > 0;
  const isLoading = loading || internalLoading || isLocked;

  function formatCountdown(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function clearError() {
    setLocalError('');
  }

  /* ============ 2FA step: session is created only after OTP ============ */
  if (pending2fa) {
    return (
      <OtpVerificationPage
        email={pending2fa.email}
        purpose="login_2fa"
        onVerify={async (code) => {
          const data = await apiFetch('auth/verify-login-otp.php', {
            method: 'POST',
            body: { pending_token: pending2fa.pendingToken, otp: code },
          });
          completeLogin(data);
          return data;
        }}
        onVerified={(data) => {
          setPending2fa(null);
          if (onAuth) onAuth(data.must_change_password ? { ...data.user, must_change_password: true } : data.user);
        }}
        onLogin={() => setPending2fa(null)}
      />
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLocked) return;
    clearError();

    const isResident = !isStaffPortal;
    const em = isResident ? residentId.trim() : email.trim();
    const pw = password;

    if (!em) {
      setLocalError(isResident ? 'Please enter your email address.' : 'Please enter your email address.');
      return;
    }
    if (isResident && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (isStaffPortal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!pw) {
      setLocalError('Please enter your password.');
      return;
    }

    setInternalLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      const scope = isStaffPortal ? 'portal' : 'public';
      const data = await login(em, pw, scope);

      /* 2FA required - hold at the OTP step; the session is created
         only after verify-login-otp succeeds (see pending2fa flow). */
      if (data.otp_required) {
        setPending2fa({ email: data.email || em, pendingToken: data.pending_token });
        setInternalLoading(false);
        if (onLoadingChange) onLoadingChange(false);
        return;
      }

      if (isStaffPortal) {
        const role = data.user?.role;
        if (role !== 'Staff' && role !== 'Admin' && role !== 'Super Admin') {
          setLocalError('Access denied. Staff, Admin, or Super Admin accounts only.');
          setInternalLoading(false);
          if (onLoadingChange) onLoadingChange(false);
          return;
        }
      } else {
        // Resident portal - reject staff/admin/super admin accounts
        const role = data.user?.role;
        if (role === 'Staff' || role === 'Admin' || role === 'Super Admin') {
          setLocalError('Access denied. This portal is for residents only. Please use the staff portal at /dashboard');
          setInternalLoading(false);
          if (onLoadingChange) onLoadingChange(false);
          return;
        }
      }

      if (onAuth) onAuth(data.must_change_password ? { ...data.user, must_change_password: true } : data.user);
    } catch (err) {
      /* Detect 429 lockout from the backend progressive throttle */
      if (err?.status === 429) {
        const retryAfter = err?.data?.retry_after || 900;
        setLockoutRemaining(retryAfter);
        const m = Math.floor(retryAfter / 60);
        const s = retryAfter % 60;
        setLocalError(`Too many failed attempts. Try again in ${m}:${String(s).padStart(2, '0')}`);
      } else {
        setLocalError(err.message || 'Login failed.');
      }
      setInternalLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  }

  // Staff/Admin/Super Admin Management Portal - new design from provided HTML
  if (isStaffPortal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflowX: 'hidden', color: '#102d55', background: 'radial-gradient(circle at 0% 0%,rgba(190,215,255,.55),transparent 24%),radial-gradient(circle at 100% 100%,rgba(194,217,255,.5),transparent 25%),linear-gradient(135deg,#f2f7ff 0%,#fff 48%,#edf5ff 100%)', position: 'relative' }}>
        <style>{`
:root{--b:#1769f5;--n:#17365e;--m:#7186a5}
.mgmt-bg{position:fixed;z-index:0;pointer-events:none}
.mgmt-c1{width:420px;height:420px;left:-285px;top:-125px;border:1px solid rgba(72,137,239,.25);border-radius:50%;box-shadow:0 0 0 34px rgba(72,137,239,.035),0 0 0 72px rgba(72,137,239,.025);position:fixed}
.mgmt-c2{width:500px;height:500px;right:-300px;bottom:-260px;border:1px solid rgba(72,137,239,.25);border-radius:50%;box-shadow:0 0 0 38px rgba(72,137,239,.035),0 0 0 82px rgba(72,137,239,.025);position:fixed}
.mgmt-diag{width:520px;height:190px;left:-185px;top:55px;transform:rotate(-43deg);border-radius:120px;background:linear-gradient(90deg,#e8f1ff,transparent);position:fixed}
.mgmt-dots{width:145px;height:110px;background-image:radial-gradient(rgba(38,112,236,.3) 1.5px,transparent 1.5px);background-size:18px 18px;opacity:.55;position:fixed}
.mgmt-dt{right:72px;top:18px}
.mgmt-db{left:82px;bottom:57px}
.mgmt-curves{width:180px;height:305px;left:-52px;top:108px;border-left:2px solid #fff;border-radius:50%;transform:rotate(-18deg);position:fixed}
.mgmt-curves:before,.mgmt-curves:after{content:"";position:absolute;inset:0;border-left:2px solid #fff;border-radius:50%}
.mgmt-curves:before{left:18px}
.mgmt-curves:after{left:36px}
.mgmt-page{width:min(1080px,calc(100% - 40px));min-height:760px;padding:30px 0 22px;position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mgmt-brand{display:flex;align-items:center;gap:15px;margin-bottom:24px}
.mgmt-logo{width:67px;height:73px}
.mgmt-brand h1{margin:0;font-size:42px;letter-spacing:5px;line-height:1;font-weight:800;color:#17365e}
.mgmt-brand p{margin:9px 0 0;color:var(--b);font-size:14px;letter-spacing:4px;font-weight:800}
.mgmt-card{width:min(630px,100%);padding:32px 43px 28px;background:#fff;border:1px solid #cbdcf0;border-radius:21px;box-shadow:0 24px 70px rgba(34,84,145,.12)}
.mgmt-top{text-align:center}
.mgmt-shield{width:64px;height:64px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#2175fa,#1260e9);box-shadow:0 12px 25px rgba(23,105,245,.2)}
.mgmt-shield svg{width:34px;height:34px}
.mgmt-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:13px;color:var(--b);font-size:14px;font-weight:800}
.mgmt-secure svg{width:19px;height:19px}
.mgmt-title{margin:0;font-size:30px;line-height:1.2;color:#17365e}
.mgmt-sub{margin:10px 0 25px;color:var(--m);font-size:15px}
.mgmt-divider{height:1px;margin-bottom:26px;background:#d9e4f2;position:relative}
.mgmt-divider i{position:absolute;left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border-radius:50%;background:var(--b);box-shadow:0 0 0 7px #fff}
.mgmt-group{margin-bottom:20px}
.mgmt-label{display:block;margin-bottom:8px;font-size:14px;font-weight:750;color:#112e55}
.mgmt-wrap{position:relative}
.mgmt-icon{position:absolute;left:16px;top:50%;width:20px;height:20px;transform:translateY(-50%);color:#5f7697;pointer-events:none;z-index:2}
.mgmt-input{position:relative;z-index:1;width:100%;height:55px;padding:0 48px;border:1px solid #cad9eb;border-radius:10px;outline:0;background:#fff;color:var(--n);font:inherit;font-size:16px;-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none;touch-action:manipulation}
.mgmt-input:focus{border-color:var(--b);box-shadow:0 0 0 4px rgba(23,105,245,.1)}
.mgmt-input::placeholder{color:#8a9db8}
.mgmt-eye{position:absolute;right:9px;top:50%;width:38px;height:38px;transform:translateY(-50%);border:0;background:transparent;color:#5f7697;display:grid;place-items:center;cursor:pointer;touch-action:manipulation;z-index:2}
.mgmt-eye svg{width:20px;height:20px}
.mgmt-options{margin:1px 0 22px;display:flex;justify-content:space-between;align-items:center}
.mgmt-remember{display:flex;align-items:center;gap:9px;color:#7186a5;font-size:14px}
.mgmt-remember input{appearance:none;width:18px;height:18px;margin:0;border:1.5px solid #aec6e4;border-radius:4px}
.mgmt-remember input:checked{background:var(--b);border-color:var(--b)}
.mgmt-forgot{color:var(--b);font-size:14px;font-weight:700;text-decoration:none;background:none;border:0;cursor:pointer}
.mgmt-login{width:100%;height:55px;border:0;border-radius:10px;background:linear-gradient(135deg,#176cf5,#1762df);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 12px 25px rgba(23,105,245,.18)}
.mgmt-login:disabled{opacity:.75;cursor:wait}
.mgmt-auth{margin-top:18px;padding:12px 14px;border-radius:10px;background:#edf5ff;color:#7186a5;display:flex;justify-content:center;align-items:center;gap:9px;font-size:14px;text-align:center}
.mgmt-auth svg{width:20px;height:20px;color:var(--b);flex:none}
.mgmt-msg{display:block;margin-top:13px;padding:11px;border-radius:9px;background:#fff4f4;border:1px solid #ffd5d2;color:#b42318;text-align:center;font-size:13px}
.mgmt-security{margin-top:27px;display:flex;align-items:center;justify-content:center;gap:8px;color:#7186a5;font-size:14px;text-align:center}
.mgmt-security svg{width:21px;height:21px;color:var(--b)}
.mgmt-footer{margin-top:12px;color:#7186a5;font-size:12px}
.mgmt-footer strong{color:var(--b)}
.mgmt-back{align-self:flex-start;display:none;align-items:center;gap:6px;background:rgba(255,255,255,.95);border:1px solid #cad9eb;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;color:#17365e;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,77,.08);margin-bottom:14px;font-family:inherit}
.mgmt-back.show{display:inline-flex}
.mgmt-back:hover{background:#fff;border-color:#a9c7ed}
.mgmt-back:focus-visible{outline:2px solid var(--b);outline-offset:2px}
@media(max-width:700px){.mgmt-page{width:100%;min-height:100vh;padding:27px 18px 22px}.mgmt-brand{gap:10px}.mgmt-logo{width:49px;height:55px}.mgmt-brand h1{font-size:30px;letter-spacing:3px}.mgmt-brand p{font-size:10px;letter-spacing:2.4px}.mgmt-card{padding:27px 21px 25px;border-radius:18px}.mgmt-title{font-size:27px}.mgmt-sub{font-size:14px;line-height:1.5}.mgmt-security{font-size:12px}}
@media(max-width:420px){.mgmt-card{padding:24px 17px}.mgmt-brand h1{font-size:27px}.mgmt-brand p{font-size:9px}.mgmt-title{font-size:25px}.mgmt-options{gap:12px}.mgmt-dots{display:none}}
        `}</style>
        <div className="mgmt-bg mgmt-c1"></div><div className="mgmt-bg mgmt-c2"></div><div className="mgmt-bg mgmt-diag"></div><div className="mgmt-bg mgmt-dots mgmt-dt"></div><div className="mgmt-bg mgmt-dots mgmt-db"></div><div className="mgmt-bg mgmt-curves"></div>
        <main className="mgmt-page">
          {onBack && (
            <button type="button" onClick={onBack} className="mgmt-back show" aria-label="Back to public home">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
              Back to Home
            </button>
          )}
          <header className="mgmt-brand">
            <svg className="mgmt-logo" viewBox="0 0 70 78" fill="none"><path d="M35 3 60 13v23c0 17-10.8 30.1-25 38C20.8 66.1 10 53 10 36V13L35 3Z" stroke="#1769f5" strokeWidth="5"/><path d="m22 38 8 8 18-20" stroke="#1769f5" strokeWidth="5" strokeLinecap="round"/></svg>
            <div><h1>XEVERA</h1><p>CIVIC REPORTING SYSTEM</p></div>
          </header>
          <section className="mgmt-card">
            <div className="mgmt-top">
              <div className="mgmt-shield"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6v6.7c0 5.2-3.3 8.2-8 10.3-4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="#fff" strokeWidth="1.8"/><path d="m8.4 12 2.2 2.2 5-5" stroke="#fff" strokeWidth="1.8"/></svg></div>
              <div className="mgmt-secure">🛡 SECURE PORTAL</div>
              <h2 className="mgmt-title">Management Portal</h2>
              <p className="mgmt-sub">Sign in to access the Xevera management dashboard.</p>
            </div>
            <div className="mgmt-divider"><i></i></div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="mgmt-group">
                <label className="mgmt-label" htmlFor="mgmt-email">Email Address</label>
                <div className="mgmt-wrap">
                  <svg className="mgmt-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8"/></svg>
                  <input className="mgmt-input" id="mgmt-email" type="email" autoComplete="username" enterKeyHint="next" placeholder="Enter your email address" required value={email} onChange={(e)=>{setEmail(e.target.value); clearError();}} onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); try { pwRef.current && pwRef.current.focus(); } catch {} } }} disabled={isLoading} />
                </div>
              </div>
              <div className="mgmt-group">
                <label className="mgmt-label" htmlFor="mgmt-password">Password</label>
                <div className="mgmt-wrap">
                  <svg className="mgmt-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>
                  <input className="mgmt-input" id="mgmt-password" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" placeholder="Enter your password" required value={password} onChange={(e)=>{setPassword(e.target.value); clearError();}} disabled={isLoading} />
                  <button className="mgmt-eye" type="button" tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onMouseDown={(e)=>e.preventDefault()} onClick={togglePwVisibility} disabled={isLoading}>
                    {showPw ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/><path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mgmt-options">
                <label className="mgmt-remember"><input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} disabled={isLoading} /><span>Remember me</span></label>
                {onForgot && (<button className="mgmt-forgot" type="button" onClick={onForgot} disabled={isLoading}>Forgot password?</button>)}
              </div>
              <button className="mgmt-login" type="submit" disabled={isLoading}>{isLocked ? `Locked — ${formatCountdown(lockoutRemaining)}` : isLoading ? 'Signing in...' : <>Log In&nbsp; →</>}</button>
              {displayError && (<div className="mgmt-msg" style={isLocked ? { background: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' } : undefined}>{displayError}</div>)}
            </form>
            <div className="mgmt-auth">🛡️ Authorized Staff, Admin, and Super Admin accounts only.</div>
          </section>
          <div className="mgmt-security">🛡️ Your data is protected with enterprise-grade security.</div>
          <footer className="mgmt-footer">© {new Date().getFullYear()} <strong>Xevera Portal</strong>. All rights reserved.</footer>
        </main>
      </div>
    );
  }

  // Resident Login - prototype-matched standalone card (logic + iOS fixes preserved)
  return (
    <div className="rlogin-page">
      <style>{`
.rlogin-page{min-height:100dvh;position:relative;overflow:hidden;display:flex;justify-content:center;align-items:center;padding:28px;background:radial-gradient(circle at 0% 0%,rgba(190,215,255,.55),transparent 24%),radial-gradient(circle at 100% 100%,rgba(194,217,255,.5),transparent 25%),linear-gradient(135deg,#f2f7ff 0%,#fff 48%,#edf5ff 100%);color:#102d55;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.rlogin-page::before{content:"";position:absolute;width:420px;height:420px;left:-260px;top:-170px;border:1px solid rgba(72,137,239,.25);border-radius:50%;box-shadow:0 0 0 35px rgba(72,137,239,.035),0 0 0 70px rgba(72,137,239,.025),0 0 0 105px rgba(72,137,239,.02);pointer-events:none}
.rlogin-page::after{content:"";position:absolute;width:430px;height:430px;right:-270px;bottom:-250px;border:1px solid rgba(72,137,239,.25);border-radius:50%;box-shadow:0 0 0 35px rgba(72,137,239,.035),0 0 0 70px rgba(72,137,239,.025);pointer-events:none}
.rlogin-dots{position:absolute;width:100px;height:100px;background-image:radial-gradient(circle,rgba(38,112,236,.3) 1.5px,transparent 1.5px);background-size:16px 16px;pointer-events:none}
.rlogin-dots-top{top:28px;right:55px}
.rlogin-dots-bottom{bottom:35px;left:65px}
.rlogin-card{position:relative;z-index:2;width:100%;max-width:770px;background:rgba(255,255,255,.96);border:1px solid #cbdcf0;border-radius:22px;padding:36px 48px 30px;box-shadow:0 25px 70px rgba(34,84,145,.12),0 5px 20px rgba(34,84,145,.06)}
.rlogin-card-top{display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:1px solid #dce6f2}
.rlogin-brand{display:flex;align-items:center;gap:15px}
.rlogin-brand-logo{width:48px;height:48px;color:#1769f5;flex-shrink:0}
.rlogin-brand-name{font-size:25px;font-weight:800;letter-spacing:4px;color:#102c50}
.rlogin-brand-sub{font-size:11px;font-weight:800;letter-spacing:3px;color:#1769f5;margin-top:2px}
.rlogin-back{border:1px solid #cbdcf0;background:#f3f8ff;color:#17365e;border-radius:13px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px;transition:.2s ease;font-family:inherit}
.rlogin-back:hover{background:#e8f1ff;border-color:#a9c7ed}
.rlogin-intro{text-align:center;padding-top:28px}
.rlogin-security-icon{width:76px;height:76px;margin:0 auto 17px;border-radius:50%;background:linear-gradient(145deg,#2175fa,#1260e9);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 12px 25px rgba(23,105,245,.2)}
.rlogin-security-icon svg{width:39px;height:39px}
.rlogin-secure-label{display:inline-flex;align-items:center;gap:7px;color:#1769f5;font-size:15px;font-weight:800;margin-bottom:17px}
.rlogin-secure-label svg{width:18px;height:18px}
.rlogin-title{font-size:34px;font-weight:500;color:#17365e;margin:0 0 10px}
.rlogin-desc{color:#7186a5;font-size:16px;margin:0}
.rlogin-divider{display:flex;align-items:center;gap:12px;margin:30px 0 31px}
.rlogin-divider::before,.rlogin-divider::after{content:"";height:1px;flex:1;background:#d9e4f2}
.rlogin-divider-dot{width:9px;height:9px;border-radius:50%;background:#1769f5;box-shadow:0 0 0 4px #edf5ff}
.rlogin-group{margin-bottom:24px}
.rlogin-label{display:block;font-size:16px;font-weight:700;margin-bottom:10px;color:#112e55}
.rlogin-wrap{position:relative;width:100%}
.rlogin-icon{position:absolute;left:18px;top:50%;width:21px;height:21px;transform:translateY(-50%);color:#5f7697;pointer-events:none;z-index:2}
.rlogin-input{width:100%;height:65px;border:1.5px solid #cad9eb;border-radius:12px;background:#fff;color:#19365d;font-size:17px;line-height:1.25;padding:0 58px 0 55px;outline:none;transition:border-color .2s ease,box-shadow .2s ease;box-sizing:border-box;margin:0;position:relative;z-index:1;-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none;touch-action:manipulation;font-family:inherit}
.rlogin-input::placeholder{color:#8a9db8;opacity:1;line-height:1.25}
.rlogin-input::-webkit-input-placeholder{color:#8a9db8;opacity:1;line-height:1.25}
.rlogin-input:hover{border-color:#aec6e4}
.rlogin-input:focus{border-color:#1769f5;box-shadow:0 0 0 4px rgba(23,105,245,.1)}
.rlogin-eye{position:absolute;right:15px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:none;background:transparent;color:#5f7697;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;z-index:5;touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0}
.rlogin-eye:hover{background:#f1f6fd}
.rlogin-eye svg{width:21px;height:21px}
.rlogin-forgot{display:flex;justify-content:flex-end;margin-top:-8px;margin-bottom:22px}
.rlogin-forgot button{color:#1769f5;font-size:15px;font-weight:700;background:none;border:0;cursor:pointer;font-family:inherit;padding:0}
.rlogin-forgot button:hover{text-decoration:underline}
.rlogin-forgot button:disabled{opacity:.6;cursor:not-allowed}
.rlogin-submit{width:100%;height:65px;border:none;border-radius:11px;background:linear-gradient(100deg,#176cf5,#1762df);color:#fff;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 12px 22px rgba(23,105,245,.18);transition:transform .15s ease,box-shadow .15s ease;font-family:inherit}
.rlogin-submit:hover{transform:translateY(-1px);box-shadow:0 15px 27px rgba(23,105,245,.25)}
.rlogin-submit:active{transform:translateY(0) scale(.99);background:linear-gradient(100deg,#4d94ff,#3d83f5);box-shadow:0 6px 14px rgba(23,105,245,.15)}
.rlogin-submit:disabled{opacity:.65;cursor:not-allowed;transform:none}
.rlogin-register{text-align:center;margin-top:30px;color:#7186a5;font-size:16px}
.rlogin-register button{color:#1769f5;font-weight:800;background:none;border:0;cursor:pointer;font-size:16px;font-family:inherit;padding:0}
.rlogin-register button:hover{text-decoration:underline}
.rlogin-register button:disabled{opacity:.6;cursor:not-allowed}
.rlogin-error{display:block;margin-top:0;margin-bottom:18px;padding:11px 13px;border-radius:9px;background:#fff4f4;border:1px solid #ffd5d2;color:#b42318;text-align:center;font-size:13px}
.rlogin-error.locked{background:#FFF7ED;border-color:#FDBA74;color:#9A3412}
button.rlogin-back:focus-visible,.rlogin-eye:focus-visible,.rlogin-forgot button:focus-visible,.rlogin-register button:focus-visible,.rlogin-submit:focus-visible,.rlogin-input:focus-visible{outline:3px solid rgba(23,105,245,.3);outline-offset:2px}
@media(max-width:700px){
.rlogin-page{min-height:100dvh;padding:max(18px,env(safe-area-inset-top)) 16px max(25px,env(safe-area-inset-bottom))}
.rlogin-card{max-width:100%;padding:24px 20px 25px;border-radius:18px}
.rlogin-card-top{padding-bottom:18px}
.rlogin-brand{gap:10px}
.rlogin-brand-logo{width:39px;height:39px}
.rlogin-brand-name{font-size:20px;letter-spacing:3px}
.rlogin-brand-sub{font-size:9px;letter-spacing:2px}
.rlogin-back{padding:10px 13px;font-size:13px}
.rlogin-intro{padding-top:23px}
.rlogin-security-icon{width:65px;height:65px}
.rlogin-security-icon svg{width:33px;height:33px}
.rlogin-secure-label{font-size:13px;margin-bottom:12px}
.rlogin-title{font-size:28px}
.rlogin-desc{font-size:14px;line-height:1.5}
.rlogin-divider{margin:23px 0 24px}
.rlogin-label{font-size:14px}
.rlogin-input{height:58px;font-size:16px;padding-left:51px;padding-right:54px}
.rlogin-icon{left:16px}
.rlogin-eye{right:9px}
.rlogin-submit{height:58px;font-size:17px}
.rlogin-register{font-size:14px;margin-top:23px}
.rlogin-register button{font-size:14px}
.rlogin-dots-top{right:12px;top:15px;opacity:.5}
.rlogin-dots-bottom{left:10px;bottom:15px;opacity:.5}
}
@media(max-width:420px){
.rlogin-page{padding-left:10px;padding-right:10px}
.rlogin-card{padding-left:17px;padding-right:17px}
.rlogin-card-top{gap:10px}
.rlogin-brand-name{font-size:18px}
.rlogin-brand-sub{font-size:8px}
.rlogin-back{padding:9px 10px;font-size:12px}
.rlogin-title{font-size:25px}
}

      `}</style>
      <div className="rlogin-dots rlogin-dots-top"></div>
      <div className="rlogin-dots rlogin-dots-bottom"></div>
      <main className="rlogin-card">
        <div className="rlogin-card-top">
          <div className="rlogin-brand">
            <svg className="rlogin-brand-logo" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M32 5L52 13V28C52 41.5 43.5 53.5 32 58C20.5 53.5 12 41.5 12 28V13L32 5Z" stroke="currentColor" strokeWidth="4" />
              <path d="M22 31L28 37L42 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="rlogin-brand-text">
              <div className="rlogin-brand-name">XEVERA</div>
              <div className="rlogin-brand-sub">CIVIC PORTAL</div>
            </div>
          </div>
          {onBack && (
            <button className="rlogin-back" type="button" onClick={onBack} aria-label="Back to public home">
              <span aria-hidden="true">←</span>
              <span>Back to Home</span>
            </button>
          )}
        </div>

        <section className="rlogin-intro">
          <div className="rlogin-security-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M32 6L51 14V29C51 42 43 53 32 58C21 53 13 42 13 29V14L32 6Z" stroke="white" strokeWidth="4" />
              <path d="M23 32L29 38L42 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rlogin-secure-label">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 3L19 6V11.5C19 16.3 16.2 20 12 21C7.8 20 5 16.3 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="2" />
              <path d="M9 12L11 14L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SECURE PORTAL
          </div>
          <h1 className="rlogin-title">Resident Login</h1>
          <p className="rlogin-desc">Sign in to access your Xevera resident account.</p>
        </section>

        <div className="rlogin-divider"><span className="rlogin-divider-dot"></span></div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="rlogin-group">
              <label className="rlogin-label" htmlFor="residentId">Email Address</label>
              <div className="rlogin-wrap">
                <svg className="rlogin-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 7L12 13L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input className="rlogin-input" id="residentId" name="email" type="email" inputMode="email" autoComplete="username" enterKeyHint="next" placeholder="Enter your email address" maxLength={254} required value={residentId} onChange={(e)=>{setResidentId(e.target.value); clearError();}} onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); try { pwRef.current && pwRef.current.focus(); } catch {} } }} disabled={isLoading} />
              </div>
            </div>
            <div className="rlogin-group">
              <label className="rlogin-label" htmlFor="resident-password">Password</label>
              <div className="rlogin-wrap">
                <svg className="rlogin-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
                </svg>
                <input className="rlogin-input" id="resident-password" name="password" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" placeholder="Enter your password" required value={password} onChange={(e)=>{setPassword(e.target.value); clearError();}} disabled={isLoading} />
                <button className="rlogin-eye" type="button" tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onMouseDown={(e)=>e.preventDefault()} onClick={togglePwVisibility} disabled={isLoading}>
                  {showPw ? (
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M2.5 12C4.2 7.8 7.7 5.5 12 5.5C16.3 5.5 19.8 7.8 21.5 12C19.8 16.2 16.3 18.5 12 18.5C7.7 18.5 4.2 16.2 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6.7 6.7C4.8 8 3.5 9.7 3 12C4.6 16.2 8 18.5 12 18.5C13.6 18.5 15.1 18.1 16.4 17.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M9.4 5.8C10.2 5.5 11.1 5.5 12 5.5C16 5.5 19.4 7.8 21 12C20.6 13.2 20 14.2 19.3 15.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {displayError && (<div className={`rlogin-error${isLocked ? ' locked' : ''}`} role="alert">{displayError}</div>)}
            {onForgot && (<div className="rlogin-forgot"><button type="button" onClick={onForgot} disabled={isLoading}>Forgot password?</button></div>)}
            <button className="rlogin-submit" type="submit" disabled={isLoading}>{isLocked ? `Locked — ${formatCountdown(lockoutRemaining)}` : isLoading ? 'Signing in...' : <>Log In&nbsp; →</>}</button>
            {onRegister && (<div className="rlogin-register">Don&apos;t have an account? <button type="button" onClick={onRegister} disabled={isLoading}>Register here</button></div>)}
          </form>
        </main>
      </div>
  );
}
