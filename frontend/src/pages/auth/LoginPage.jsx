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
    const els = document.querySelectorAll('.rlogin-page input, .rlogin-page button, .mp-page input, .mp-page button');
    const noop = () => {};
    els.forEach((el) => el.addEventListener('touchstart', noop, { passive: true }));
    return () => els.forEach((el) => el.removeEventListener('touchstart', noop));
  }, []);

  /* Remember-me: persist only the email address (session lifetime stays
     role-based). Loads once, keeps in sync while checked. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xevera_remember_email');
      if (saved) { setEmail(saved); setRememberMe(true); }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (rememberMe && email.trim()) localStorage.setItem('xevera_remember_email', email.trim());
      else if (!rememberMe) localStorage.removeItem('xevera_remember_email');
    } catch {}
  }, [rememberMe, email]);

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
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflowX: 'hidden', color: '#10284d', background: 'radial-gradient(circle at 15% 18%,#dceaff,transparent 22%),radial-gradient(circle at 87% 82%,#dceaff,transparent 25%),linear-gradient(135deg,#eff5ff,#fff 50%,#edf4ff)', position: 'relative' }}>
        <style>{`
.mp-page{min-height:100vh;min-height:100dvh;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:35px 20px max(30px,env(safe-area-inset-bottom));overflow:hidden;background:radial-gradient(circle at 0% 0%,rgba(194,218,255,.62),transparent 24%),radial-gradient(circle at 100% 100%,rgba(194,218,255,.55),transparent 28%),linear-gradient(135deg,#f0f6ff 0%,#fff 50%,#edf5ff 100%);color:#102d55;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.mp-page::before{content:"";position:absolute;width:430px;height:430px;left:-315px;top:-180px;border:1px solid rgba(44,112,235,.18);border-radius:50%;box-shadow:0 0 0 35px rgba(44,112,235,.035),0 0 0 70px rgba(44,112,235,.025),0 0 0 105px rgba(44,112,235,.018);pointer-events:none}
.mp-page::after{content:"";position:absolute;width:450px;height:450px;right:-325px;bottom:-285px;border:1px solid rgba(44,112,235,.18);border-radius:50%;box-shadow:0 0 0 35px rgba(44,112,235,.035),0 0 0 70px rgba(44,112,235,.025);pointer-events:none}
.mp-dots{position:absolute;width:95px;height:95px;background-image:radial-gradient(circle,rgba(23,105,245,.30) 1.2px,transparent 1.2px);background-size:15px 15px;pointer-events:none}
.mp-dots-top{top:20px;right:70px}
.mp-dots-bottom{bottom:35px;left:65px}
.mp-brand{position:relative;z-index:5;display:flex;align-items:center;justify-content:center;gap:14px;width:100%;max-width:550px;margin:0 auto 24px}
.mp-brand-shield{width:58px;height:58px;flex-shrink:0;color:#1769f5}
.mp-brand-info{display:flex;flex-direction:column}
.mp-brand-name{color:#102d55;font-size:29px;line-height:1;font-weight:900;letter-spacing:4px}
.mp-brand-sub{margin-top:7px;color:#1769f5;font-size:11px;line-height:1;font-weight:800;letter-spacing:3px}
.mp-card{position:relative;z-index:10;width:100%;max-width:550px;margin:0 auto;padding:28px 38px 25px;background:rgba(255,255,255,.97);border:1px solid #cbdced;border-radius:18px;box-shadow:0 25px 60px rgba(37,82,138,.12),0 5px 20px rgba(37,82,138,.05)}
.mp-back-home{border:1px solid #cbdcf0;background:#f3f8ff;color:#17365e;border-radius:13px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:.2s ease;font-family:inherit}
.mp-back-home:hover{background:#e8f1ff;border-color:#a9c7ed}
button.mp-back-home:focus-visible{outline:3px solid rgba(23,105,245,.25);outline-offset:2px}
.mp-security-icon{width:58px;height:58px;margin:0 auto 11px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#1769f5;color:#fff;box-shadow:0 10px 25px rgba(23,105,245,.20)}
.mp-security-icon svg{width:30px;height:30px}
.mp-secure-label{display:flex;align-items:center;justify-content:center;gap:5px;color:#1769f5;font-size:12px;font-weight:800;margin-bottom:12px}
.mp-secure-label svg{width:14px;height:14px}
.mp-title{text-align:center;color:#102d55;font-size:27px;line-height:1.2;font-weight:500;margin:0 0 7px}
.mp-desc{text-align:center;color:#7186a5;font-size:12px;line-height:1.5;margin:0}
.mp-divider{display:flex;align-items:center;gap:8px;margin:22px 0 22px}
.mp-divider::before,.mp-divider::after{content:"";height:1px;flex:1;background:#dce5f1}
.mp-divider-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#1769f5;box-shadow:0 0 0 4px #edf4ff}
.mp-group{margin-bottom:17px}
.mp-label{display:block;margin-bottom:7px;color:#102d55;font-size:13px;font-weight:700}
.mp-wrap{position:relative;width:100%}
.mp-icon{position:absolute;z-index:3;left:15px;top:50%;width:18px;height:18px;color:#617b9f;transform:translateY(-50%);pointer-events:none}
.mp-input{width:100%;height:49px;padding:0 48px 0 43px;border:1px solid #cad9eb;border-radius:9px;background:#fff;color:#19365d;font-family:inherit;font-size:14px;outline:none;-webkit-appearance:none;appearance:none;transition:border-color .2s ease,box-shadow .2s ease;box-sizing:border-box;margin:0;position:relative;z-index:1;-webkit-user-select:text;user-select:text;touch-action:manipulation}
.mp-input::placeholder{color:#879bb7}
.mp-input:hover{border-color:#abc3e2}
.mp-input:focus{border-color:#1769f5;box-shadow:0 0 0 3px rgba(23,105,245,.09)}
.mp-eye{position:absolute;z-index:10;right:6px;top:50%;width:38px;height:38px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;border:none;border-radius:7px;background:transparent;color:#617b9f;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0}
.mp-eye:hover{background:#f1f6fc}
.mp-eye:active{background:#eaf2fc}
.mp-eye svg{width:18px;height:18px}
.mp-eye:disabled{opacity:.6;cursor:not-allowed}
.mp-remember-row{display:flex;align-items:center;gap:7px;margin-top:2px;margin-bottom:18px}
.mp-remember-row input{width:16px;height:16px;accent-color:#1769f5;cursor:pointer;margin:0}
.mp-remember-row label{color:#617b9f;font-size:12px;cursor:pointer}
.mp-remember-row .mp-forgot-link{margin-left:auto;color:#1769f5;font-size:12px;font-weight:700;background:none;border:0;cursor:pointer;font-family:inherit;padding:0}
.mp-remember-row .mp-forgot-link:hover{text-decoration:underline}
.mp-remember-row .mp-forgot-link:disabled{opacity:.6;cursor:not-allowed}
.mp-submit{width:100%;height:49px;border:none;border-radius:8px;background:linear-gradient(100deg,#176cf5,#155edc);color:#fff;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 9px 18px rgba(23,105,245,.18);transition:transform .15s ease,box-shadow .15s ease}
.mp-submit:hover{transform:translateY(-1px);box-shadow:0 12px 23px rgba(23,105,245,.23)}
.mp-submit:active{transform:translateY(0)}
.mp-submit:disabled{opacity:.65;cursor:not-allowed;transform:none}
.mp-notice{margin-top:12px;min-height:38px;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px 12px;border-radius:7px;background:#edf5ff;color:#5e7698;font-size:11px;text-align:center}
.mp-notice svg{width:14px;height:14px;flex:0 0 auto;color:#1769f5}
.mp-footer{position:relative;z-index:2;margin-top:22px;text-align:center;color:#7186a5;font-size:11px;line-height:1.7}
.mp-footer strong{color:#1769f5}
.mp-error{display:block;margin-top:12px;padding:9px 12px;border-radius:7px;background:#fff0f0;border:1px solid #ffd0d0;color:#c62828;font-size:12px;text-align:center}
.mp-error.locked{background:#FFF7ED;border-color:#FDBA74;color:#9A3412}
button.mp-back-home:focus-visible,.mp-eye:focus-visible,.mp-submit:focus-visible,.mp-input:focus-visible{outline:3px solid rgba(23,105,245,.25);outline-offset:2px}
.mp-back-home{border:1px solid #cbdcf0;background:#f3f8ff;color:#17365e;border-radius:13px;padding:13px 20px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:9px;transition:.2s ease;font-family:inherit}
.mp-back-home:hover{background:#e8f1ff;border-color:#a9c7ed}
@media(max-width:700px){
.mp-page{padding:25px 14px max(25px,env(safe-area-inset-bottom))}
.mp-brand{margin-bottom:18px}
.mp-brand-shield{width:47px;height:47px}
.mp-brand-name{font-size:24px;letter-spacing:3px}
.mp-brand-sub{font-size:9px;letter-spacing:2px}
.mp-card{max-width:100%;padding:24px 21px 21px;border-radius:16px}
.mp-security-icon{width:54px;height:54px}
.mp-security-icon svg{width:29px;height:29px}
.mp-title{font-size:25px}
.mp-desc{font-size:13px}
.mp-input{height:52px;font-size:16px}
.mp-submit{height:52px;font-size:15px}
.mp-dots-top{right:5px;top:10px;opacity:.45}
.mp-dots-bottom{left:5px;bottom:10px;opacity:.45}
}
@media(max-width:600px){
.mp-page{justify-content:flex-start;padding:25px 12px max(25px,env(safe-area-inset-bottom))}
.mp-brand{gap:10px;margin-bottom:18px}
.mp-brand-shield{width:45px;height:45px}
.mp-brand-name{font-size:23px;letter-spacing:3px}
.mp-brand-sub{font-size:8px;letter-spacing:2px}
.mp-card{padding:24px 20px 21px;border-radius:16px}
.mp-security-icon{width:54px;height:54px}
.mp-title{font-size:24px}
.mp-desc{font-size:12px}
.mp-dots-top{right:0;opacity:.4}
.mp-dots-bottom{left:0;opacity:.4}
}
@media(max-width:390px){
.mp-page{padding-left:9px;padding-right:9px}
.mp-brand{gap:9px}
.mp-brand-shield{width:42px;height:42px}
.mp-brand-name{font-size:21px;letter-spacing:2.5px}
.mp-brand-sub{font-size:8px}
.mp-card{padding:21px 16px 19px}
.mp-title{font-size:23px}
}
        `}</style>
        <div className="mp-dots mp-dots-top"></div>
        <div className="mp-dots mp-dots-bottom"></div>
        <div className="mp-brand">
          <svg className="mp-brand-shield" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M32 5L52 13V28C52 41.5 43.5 53.5 32 58C20.5 53.5 12 41.5 12 28V13L32 5Z" stroke="currentColor" strokeWidth="4" />
            <path d="M22 31L28 37L42 22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mp-brand-text">
            <div className="mp-brand-name">XEVERA</div>
            <div className="mp-brand-sub">CIVIC REPORTING SYSTEM</div>
          </div>        </div>
        <main className="mp-card">
          {onBack && (
            <button type="button" onClick={onBack} className="mp-back-home" aria-label="Back to public home" style={{ alignSelf: 'flex-start', marginBottom: '14px' }}>
              ← Back to Home
            </button>
          )}
          <div className="mp-security-icon">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M32 6L51 14V29C51 42 43 53 32 58C21 53 13 42 13 29V14L32 6Z" stroke="white" strokeWidth="4" />
              <path d="M23 32L29 38L42 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mp-secure-label">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 3L19 6V11.5C19 16.3 16.2 20 12 21C7.8 20 5 16.3 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="2" />
              <path d="M9 12L11 14L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SECURE PORTAL
          </div>
          <h1 className="mp-title">Management Portal</h1>
          <p className="mp-desc">Sign in to access the Xevera management dashboard.</p>
          <div className="mp-divider"><span className="mp-divider-dot"></span></div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="mp-group">
                <label className="mp-label" htmlFor="mgmt-email">Email Address</label>
                <div className="mp-wrap">
                  <svg className="mp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M4 7L12 13L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input className="mp-input" id="mgmt-email" type="email" inputMode="email" autoComplete="username" enterKeyHint="next" placeholder="Enter your email address" required value={email} onChange={(e)=>{setEmail(e.target.value); clearError();}} onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); try { pwRef.current && pwRef.current.focus(); } catch {} } }} disabled={isLoading} />
                </div>
              </div>
              <div className="mp-group">
                <label className="mp-label" htmlFor="mgmt-password">Password</label>
                <div className="mp-wrap">
                  <svg className="mp-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
                  </svg>
                  <input className="mp-input" id="mgmt-password" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go" placeholder="Enter your password" required value={password} onChange={(e)=>{setPassword(e.target.value); clearError();}} disabled={isLoading} />
                  <button className="mp-eye" type="button" tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onMouseDown={(e)=>e.preventDefault()} onClick={togglePwVisibility} disabled={isLoading}>
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M2.5 12C4.2 7.8 7.7 5.5 12 5.5C16.3 5.5 19.8 7.8 21.5 12C19.8 16.2 16.3 18.5 12 18.5C7.7 18.5 4.2 16.2 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M6.7 6.7C4.8 8 3.5 9.8 3 12C4.6 16.2 8 18.5 12 18.5C13.6 18.5 15.1 18.1 16.4 17.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M9.4 5.8C10.2 5.5 11.1 5.5 12 5.5C16 5.5 19.4 7.8 21 12C20.6 13.2 20 14.2 19.3 15.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mp-remember-row">
                <input type="checkbox" id="mp-remember" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} disabled={isLoading} />
                <label htmlFor="mp-remember">Remember me</label>
                {onForgot && (<button type="button" className="mp-forgot-link" onClick={onForgot} disabled={isLoading}>Forgot password?</button>)}
              </div>
              <button className="mp-submit" type="submit" disabled={isLoading}>{isLocked ? `Locked — ${formatCountdown(lockoutRemaining)}` : isLoading ? 'Signing in...' : <>Log In&nbsp; →</>}</button>
              {displayError && (<div className={`mp-error${isLocked ? ' locked' : ''}`} role="alert">{displayError}</div>)}
            </form>
            <div className="mp-notice">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3L19 6V11.5C19 16.3 16.2 20 12 21C7.8 20 5 16.3 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="2" /></svg>
              Authorized Staff, Admin, and Super Admin accounts only.
            </div>
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
.rlogin-input{width:100%;height:65px;border:1.5px solid #cad9eb;border-radius:12px;background:#fff;color:#19365d;font-size:17px;padding:0 58px 0 55px;outline:none;transition:border-color .2s ease,box-shadow .2s ease;box-sizing:border-box;margin:0;position:relative;z-index:1;-webkit-user-select:text;user-select:text;-webkit-appearance:none;appearance:none;touch-action:manipulation;font-family:inherit}
.rlogin-input::placeholder{color:#8a9db8}
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
.rlogin-submit:active{transform:translateY(0)}
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
