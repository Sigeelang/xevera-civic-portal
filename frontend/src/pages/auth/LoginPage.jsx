import { useState, useRef } from 'react';
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

  const isStaffPortal = portalType === 'staff';

  const title = isStaffPortal
    ? 'Portal Login'
    : 'Resident Login';

  const subtitle = isStaffPortal
    ? 'Sign in to access your Xevera management dashboard.'
    : 'Sign in to access your Xevera resident account.';

  const displayError = error || localError || initialError || '';
  const isLoading = loading || internalLoading;

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

      /* 2FA required - skip OTP for Staff/Admin/Super Admin accounts
   (e.g. when verification code cannot be sent due to Gmail quota, etc.). */
      if (data.otp_required) {
        const role = data.role || '';
        // Privileged accounts bypass OTP entirely - complete login with password
        if (isStaffPortal && ['Staff','Admin','Super Admin'].includes(role)) {
          if (onAuth) onAuth(data.must_change_password ? { ...data.user, must_change_password: true } : data.user);
          setInternalLoading(false);
          if (onLoadingChange) onLoadingChange(false);
          return;
        }
        // Resident / non-staff with OTP required: hold at the OTP step
        if (!['Staff','Admin','Super Admin'].includes(role)) {
          setPending2fa({ email: data.email || em, pendingToken: data.pending_token });
          setInternalLoading(false);
          if (onLoadingChange) onLoadingChange(false);
          return;
        }
        // Fallthrough: any other role with otp_required
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
      setLocalError(err.message || 'Login failed.');
      setInternalLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  }

  // Staff/Admin/Super Admin Management Portal - new design from provided HTML
  if (isStaffPortal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflowX: 'hidden', color: '#10284d', background: 'radial-gradient(circle at 15% 18%,#dceaff,transparent 22%),radial-gradient(circle at 87% 82%,#dceaff,transparent 25%),linear-gradient(135deg,#eff5ff,#fff 50%,#edf4ff)', position: 'relative' }}>
        <style>{`
:root{--b:#1264f5;--n:#10284d;--m:#637695}
.mgmt-bg{position:fixed;z-index:0;pointer-events:none}
.mgmt-c1{width:420px;height:420px;left:-285px;top:-125px;border:1px solid #b8cef1;border-radius:50%;box-shadow:0 0 0 34px #eaf2ff,0 0 0 72px #f1f6ff;position:fixed}
.mgmt-c2{width:500px;height:500px;right:-300px;bottom:-260px;border:1px solid #c2d5f2;border-radius:50%;box-shadow:0 0 0 38px #edf4ff,0 0 0 82px #f5f8ff;position:fixed}
.mgmt-diag{width:520px;height:190px;left:-185px;top:55px;transform:rotate(-43deg);border-radius:120px;background:linear-gradient(90deg,#d9e8fc,transparent);position:fixed}
.mgmt-dots{width:145px;height:110px;background-image:radial-gradient(#9ebef1 1.5px,transparent 1.5px);background-size:18px 18px;opacity:.55;position:fixed}
.mgmt-dt{right:72px;top:18px}
.mgmt-db{left:82px;bottom:57px}
.mgmt-curves{width:180px;height:305px;left:-52px;top:108px;border-left:2px solid #fff;border-radius:50%;transform:rotate(-18deg);position:fixed}
.mgmt-curves:before,.mgmt-curves:after{content:"";position:absolute;inset:0;border-left:2px solid #fff;border-radius:50%}
.mgmt-curves:before{left:18px}
.mgmt-curves:after{left:36px}
.mgmt-page{width:min(1080px,calc(100% - 40px));min-height:760px;padding:30px 0 22px;position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mgmt-brand{display:flex;align-items:center;gap:15px;margin-bottom:24px}
.mgmt-logo{width:67px;height:73px}
.mgmt-brand h1{margin:0;font-size:42px;letter-spacing:5px;line-height:1;font-weight:800;color:#10284d}
.mgmt-brand p{margin:9px 0 0;color:var(--b);font-size:14px;letter-spacing:4px;font-weight:800}
.mgmt-card{width:min(630px,100%);padding:32px 43px 28px;background:#fffffff5;border:1px solid #ccd8ea;border-radius:21px;box-shadow:0 24px 70px #244b8921;backdrop-filter:blur(14px)}
.mgmt-top{text-align:center}
.mgmt-shield{width:64px;height:64px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#1670ff,#1259dd);box-shadow:0 12px 25px #1264f533}
.mgmt-shield svg{width:34px;height:34px}
.mgmt-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:13px;color:var(--b);font-size:14px;font-weight:800}
.mgmt-secure svg{width:19px;height:19px}
.mgmt-title{margin:0;font-size:30px;line-height:1.2;color:#10284d}
.mgmt-sub{margin:10px 0 25px;color:var(--m);font-size:15px}
.mgmt-divider{height:1px;margin-bottom:26px;background:#e3eaf4;position:relative}
.mgmt-divider i{position:absolute;left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border-radius:50%;background:var(--b);box-shadow:0 0 0 7px #fff}
.mgmt-group{margin-bottom:20px}
.mgmt-label{display:block;margin-bottom:8px;font-size:14px;font-weight:750;color:#10284d}
.mgmt-wrap{position:relative}
.mgmt-icon{position:absolute;left:16px;top:50%;width:20px;height:20px;transform:translateY(-50%);color:#7184a3;pointer-events:none;z-index:2}
.mgmt-input{width:100%;height:55px;padding:0 48px;border:1px solid #cdd9e9;border-radius:10px;outline:0;background:#fff;color:var(--n);font:inherit;font-size:15px}
.mgmt-input:focus{border-color:var(--b);box-shadow:0 0 0 4px #1264f51a}
.mgmt-input::placeholder{color:#7b8da8}
.mgmt-eye{position:absolute;right:9px;top:50%;width:38px;height:38px;transform:translateY(-50%);border:0;background:transparent;color:#7184a3;display:grid;place-items:center;cursor:pointer}
.mgmt-eye svg{width:20px;height:20px}
.mgmt-options{margin:1px 0 22px;display:flex;justify-content:space-between;align-items:center}
.mgmt-remember{display:flex;align-items:center;gap:9px;color:#637493;font-size:14px}
.mgmt-remember input{appearance:none;width:18px;height:18px;margin:0;border:1.5px solid #9eb0ca;border-radius:4px}
.mgmt-remember input:checked{background:var(--b);border-color:var(--b)}
.mgmt-forgot{color:var(--b);font-size:14px;font-weight:700;text-decoration:none;background:none;border:0;cursor:pointer}
.mgmt-login{width:100%;height:55px;border:0;border-radius:10px;background:linear-gradient(135deg,#1268f8,#1458d7);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 12px 25px #1264f533}
.mgmt-login:disabled{opacity:.75;cursor:wait}
.mgmt-auth{margin-top:18px;padding:12px 14px;border-radius:10px;background:#edf5ff;color:#587099;display:flex;justify-content:center;align-items:center;gap:9px;font-size:14px;text-align:center}
.mgmt-auth svg{width:20px;height:20px;color:var(--b);flex:none}
.mgmt-msg{display:block;margin-top:13px;padding:11px;border-radius:9px;background:#fff4f4;border:1px solid #ffd5d2;color:#b42318;text-align:center;font-size:13px}
.mgmt-security{margin-top:27px;display:flex;align-items:center;justify-content:center;gap:8px;color:#637795;font-size:14px;text-align:center}
.mgmt-security svg{width:21px;height:21px;color:var(--b)}
.mgmt-footer{margin-top:12px;color:#7485a0;font-size:12px}
.mgmt-footer strong{color:var(--b)}
.mgmt-back{align-self:flex-start;display:none;align-items:center;gap:6px;background:rgba(255,255,255,.95);border:1px solid #cdd9e9;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;color:#10284d;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,77,.08);margin-bottom:14px;font-family:inherit}
.mgmt-back.show{display:inline-flex}
.mgmt-back:hover{background:#fff;border-color:#b8cef1}
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
            <svg className="mgmt-logo" viewBox="0 0 70 78" fill="none"><path d="M35 3 60 13v23c0 17-10.8 30.1-25 38C20.8 66.1 10 53 10 36V13L35 3Z" stroke="#1264f5" strokeWidth="5"/><path d="m22 38 8 8 18-20" stroke="#1264f5" strokeWidth="5" strokeLinecap="round"/></svg>
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
                  <svg className="mgmt-icon" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8"/></svg>
                  <input className="mgmt-input" id="mgmt-email" type="email" autoComplete="username" placeholder="Enter your email address" required value={email} onChange={(e)=>{setEmail(e.target.value); clearError();}} disabled={isLoading} />
                </div>
              </div>
              <div className="mgmt-group">
                <label className="mgmt-label" htmlFor="mgmt-password">Password</label>
                <div className="mgmt-wrap">
                  <svg className="mgmt-icon" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>
                  <input className="mgmt-input" id="mgmt-password" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e)=>{setPassword(e.target.value); clearError();}} disabled={isLoading} />
                  <button className="mgmt-eye" type="button" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onMouseDown={(e)=>e.preventDefault()} onClick={togglePwVisibility} disabled={isLoading}>
                    {showPw ? (
                      <svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/><path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="mgmt-options">
                <label className="mgmt-remember"><input type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} disabled={isLoading} /><span>Remember me</span></label>
                {onForgot && (<button className="mgmt-forgot" type="button" onClick={onForgot} disabled={isLoading}>Forgot password?</button>)}
              </div>
              <button className="mgmt-login" type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : <>Log In&nbsp; →</>}</button>
              {displayError && (<div className="mgmt-msg">{displayError}</div>)}
            </form>
            <div className="mgmt-auth">🛡️ Authorized Staff, Admin, and Super Admin accounts only.</div>
          </section>
          <div className="mgmt-security">🛡️ Your data is protected with enterprise-grade security.</div>
          <footer className="mgmt-footer">© {new Date().getFullYear()} <strong>Xevera Portal</strong>. All rights reserved.</footer>
        </main>
      </div>
    );
  }

  // Resident Login - new XVR Resident ID design from provided HTML - D:\GAMES\backup (9)\frontend
  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', overflowX: 'hidden', color: '#10284d', background: 'radial-gradient(circle at 15% 18%, rgba(65,135,245,.15), transparent 22%),radial-gradient(circle at 87% 82%, rgba(65,135,245,.14), transparent 25%),linear-gradient(135deg,#eef5ff 0%,#ffffff 49%,#edf4ff 100%)', position: 'relative' }}>
      <style>{`
:root{--blue:#1264f5;--blue-dark:#0d55d7;--navy:#10284d;--muted:#637695;--border:#cdd9e9}
.resident-bg{position:fixed;pointer-events:none;z-index:0}
.resident-circle-left{width:420px;height:420px;left:-285px;top:-125px;border:1px solid rgba(64,123,224,.18);border-radius:50%;box-shadow:0 0 0 34px rgba(64,123,224,.035),0 0 0 72px rgba(64,123,224,.025);position:fixed}
.resident-circle-right{width:500px;height:500px;right:-300px;bottom:-260px;border:1px solid rgba(64,123,224,.16);border-radius:50%;box-shadow:0 0 0 38px rgba(64,123,224,.035),0 0 0 82px rgba(64,123,224,.025);position:fixed}
.resident-diagonal{width:520px;height:190px;left:-185px;top:55px;transform:rotate(-43deg);border-radius:120px;background:linear-gradient(90deg, rgba(130,174,239,.15), transparent);position:fixed}
.resident-dots{width:145px;height:110px;opacity:.55;background-image:radial-gradient(#9ebef1 1.5px, transparent 1.5px);background-size:18px 18px;position:fixed}
.resident-dots-top{right:72px;top:18px}
.resident-dots-bottom{left:82px;bottom:57px}
.resident-curves{width:180px;height:305px;left:-52px;top:108px;border-left:2px solid rgba(255,255,255,.9);border-radius:50%;transform:rotate(-18deg);position:fixed}
.resident-curves::before,.resident-curves::after{content:"";position:absolute;inset:0;border-left:2px solid rgba(255,255,255,.7);border-radius:50%}
.resident-curves::before{left:18px}
.resident-curves::after{left:36px}
.resident-page{width:min(1080px,calc(100% - 40px));min-height:760px;padding:30px 0 22px;position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.resident-brand{display:flex;align-items:center;gap:15px;margin-bottom:24px}
.resident-brand-logo{width:67px;height:73px;display:block}
.resident-brand-name{margin:0;color:var(--navy);font-size:42px;line-height:1;letter-spacing:5px;font-weight:800}
.resident-brand-subtitle{margin:9px 0 0;color:var(--blue);font-size:14px;line-height:1;letter-spacing:4px;font-weight:800}
.resident-login-card{width:min(630px,100%);padding:32px 43px 28px;background:rgba(255,255,255,.96);border:1px solid rgba(204,216,234,.9);border-radius:21px;box-shadow:0 24px 70px rgba(36,75,137,.13);backdrop-filter:blur(14px)}
.resident-card-header{text-align:center}
.resident-main-shield{width:64px;height:64px;margin:0 auto 17px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#1670ff,#1259dd);box-shadow:0 12px 25px rgba(18,100,245,.20)}
.resident-main-shield svg{width:34px;height:34px}
.resident-secure-label{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:13px;color:var(--blue);font-size:14px;font-weight:800}
.resident-secure-label svg{width:19px;height:19px}
.resident-login-title{margin:0;color:var(--navy);font-size:32px;line-height:1.2;letter-spacing:-.6px}
.resident-login-subtitle{margin:10px 0 25px;color:var(--muted);font-size:15px}
.resident-divider{position:relative;height:1px;margin-bottom:27px;background:#e3eaf4}
.resident-divider-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border-radius:50%;background:var(--blue);box-shadow:0 0 0 7px #ffffff}
.resident-form-group{margin-bottom:20px}
.resident-form-label{display:block;margin-bottom:8px;color:#172b4d;font-size:14px;font-weight:750}
.resident-input-wrap{position:relative}
.resident-input-icon{position:absolute;left:16px;top:50%;width:20px;height:20px;transform:translateY(-50%);color:#7184a3;pointer-events:none}
.resident-login-input{width:100%;height:56px;padding:0 48px;border:1px solid var(--border);border-radius:10px;outline:none;background:#fff;color:var(--navy);font-family:inherit;font-size:16px;transition:.2s ease}
.resident-login-input::placeholder{color:#7b8da8}
.resident-login-input:focus{border-color:var(--blue);box-shadow:0 0 0 4px rgba(18,100,245,.10)}
.resident-password-toggle{position:absolute;right:7px;top:50%;width:40px;height:40px;transform:translateY(-50%);border:0;border-radius:8px;background:transparent;color:#7184a3;display:grid;place-items:center;cursor:pointer}
.resident-password-toggle:hover{background:#f1f6ff;color:var(--blue)}
.resident-password-toggle svg{width:20px;height:20px}
.resident-login-button{width:100%;height:56px;border:0;border-radius:10px;background:linear-gradient(135deg,#1268f8,#1458d7);color:#fff;font-family:inherit;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 12px 25px rgba(18,100,245,.20);transition:.15s ease}
.resident-login-button:hover{transform:translateY(-1px);box-shadow:0 15px 30px rgba(18,100,245,.25)}
.resident-login-button:disabled{opacity:.75;cursor:wait}
.resident-register{margin-top:21px;text-align:center;color:#637493;font-size:14px}
.resident-register a,.resident-register button{color:var(--blue);font-weight:700;text-decoration:underline;text-underline-offset:2px;background:none;border:0;cursor:pointer;font-size:14px;font-family:inherit;padding:0}
.resident-register a:hover,.resident-register button:hover{color:var(--blue-dark)}
.resident-register a:focus-visible,.resident-register button:focus-visible{outline:2px solid var(--blue);outline-offset:2px;border-radius:4px}
.resident-form-message{display:block;margin-top:14px;padding:11px 13px;border-radius:9px;background:#fff4f4;border:1px solid #ffd5d2;color:#b42318;text-align:center;font-size:13px}
.resident-security-note{margin-top:27px;display:flex;align-items:center;justify-content:center;gap:8px;color:#637795;font-size:14px;text-align:center}
.resident-security-note svg{width:21px;height:21px;color:var(--blue);flex:none}
.resident-footer{margin-top:12px;color:#7485a0;font-size:12px;text-align:center}
.resident-footer strong{color:var(--blue)}
@media(max-width:700px){.resident-page{width:100%;min-height:100vh;padding:27px 18px 22px}.resident-brand{gap:10px;margin-bottom:21px}.resident-brand-logo{width:49px;height:55px}.resident-brand-name{font-size:30px;letter-spacing:3px}.resident-brand-subtitle{margin-top:7px;font-size:10px;letter-spacing:2.4px}.resident-login-card{padding:27px 21px 25px;border-radius:18px}.resident-login-title{font-size:28px}.resident-login-subtitle{font-size:14px;line-height:1.5}.resident-security-note{font-size:12px}}
@media(max-width:420px){.resident-login-card{padding:24px 17px}.resident-brand-name{font-size:27px}.resident-brand-subtitle{font-size:9px}.resident-login-title{font-size:26px}.resident-dots{display:none}}
.resident-back{position:absolute;top:18px;left:18px;z-index:10;display:none;align-items:center;gap:6px;background:rgba(255,255,255,0.95);border:1px solid #cdd9e9;border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;color:#10284d;cursor:pointer;box-shadow:0 4px 12px rgba(16,40,77,0.08)}
.resident-back.show{display:inline-flex}
.resident-back:hover{background:#fff;border-color:#b8cef1}
.resident-back:focus-visible{outline:2px solid #1264f5;outline-offset:2px}
      `}</style>
      <div className="resident-bg resident-circle-left"></div><div className="resident-bg resident-circle-right"></div><div className="resident-bg resident-diagonal"></div><div className="resident-bg resident-dots resident-dots-top"></div><div className="resident-bg resident-dots resident-dots-bottom"></div><div className="resident-bg resident-curves"></div>
      <main className="resident-page" style={{ position: 'relative' }}>
        {onBack && (
          <button type="button" onClick={onBack} className="resident-back show" aria-label="Back to public home">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Back to Home
          </button>
        )}
        <header className="resident-brand">
          <svg className="resident-brand-logo" viewBox="0 0 70 78" fill="none" aria-hidden="true"><path d="M35 3 60 13 v23 c0 17-10.8 30.1-25 38 C20.8 66.1 10 53 10 36V13L35 3Z" stroke="#1264f5" strokeWidth="5" strokeLinejoin="round"/><path d="m22 38 8 8 18-20" stroke="#1264f5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div><h1 className="resident-brand-name">XEVERA</h1><p className="resident-brand-subtitle">CIVIC REPORTING SYSTEM</p></div>
        </header>
        <section className="resident-login-card">
          <div className="resident-card-header">
            <div className="resident-main-shield"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 20 6 v6.7 c0 5.2-3.3 8.2-8 10.3 -4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/><path d="m8.4 12 2.2 2.2 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div className="resident-secure-label"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6 v6.7 c0 5.2-3.3 8.2-8 10.3 -4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="currentColor" strokeWidth="1.8"/><path d="m8.4 12 2.2 2.2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>SECURE PORTAL</div>
            <h2 className="resident-login-title">Resident Login</h2>
            <p className="resident-login-subtitle">Sign in to access your Xevera resident account.</p>
          </div>
          <div className="resident-divider"><span className="resident-divider-dot"></span></div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="resident-form-group">
              <label className="resident-form-label" htmlFor="residentId">Email Address</label>
              <div className="resident-input-wrap">
                <svg className="resident-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8"/></svg>
                <input className="resident-login-input" id="residentId" name="email" type="email" autoComplete="username" placeholder="Enter your email address" maxLength={254} required value={residentId} onChange={(e)=>{setResidentId(e.target.value); clearError();}} disabled={isLoading} />
              </div>
            </div>
            <div className="resident-form-group">
              <label className="resident-form-label" htmlFor="resident-password">Password</label>
              <div className="resident-input-wrap">
                <svg className="resident-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="15" r="1.2" fill="currentColor"/></svg>
                <input className="resident-login-input" id="resident-password" name="password" ref={pwRef} type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e)=>{setPassword(e.target.value); clearError();}} disabled={isLoading} />
                <button className="resident-password-toggle" type="button" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onMouseDown={(e)=>e.preventDefault()} onClick={togglePwVisibility} disabled={isLoading}>
                  {showPw ? (
                    <svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12 s3.4-5 9.5-5 9.5 5 9.5 5 -3.4 5-9.5 5 -9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12 s3.4-5 9.5-5 9.5 5 9.5 5 -3.4 5-9.5 5 -9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.8"/><path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  )}
                </button>
              </div>
            </div>
            {onForgot && (<div className="resident-forgot"><button type="button" onClick={onForgot} disabled={isLoading} style={{background:'none',border:0,color:'#1264f5',fontWeight:600,cursor:'pointer',padding:0,fontSize:'0.875rem'}}>Forgot password?</button></div>)}
            <button className="resident-login-button" type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : <><span>Log In&nbsp; →</span></>}</button>
            {onRegister && (<div className="resident-register">Don&apos;t have an account? <button type="button" onClick={onRegister} disabled={isLoading} style={{background:'none',border:0,color:'#1264f5',fontWeight:700,cursor:'pointer'}}>Register here</button></div>)}
            {displayError && (<div className="resident-form-message" role="alert">{displayError}</div>)}
          </form>
        </section>
        <div className="resident-security-note"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 20 6 v6.7 c0 5.2-3.3 8.2-8 10.3 -4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="currentColor" strokeWidth="1.8"/><path d="m8.4 12 2.2 2.2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><span>Your data is protected with enterprise-grade security.</span></div>
        <footer className="resident-footer">© {new Date().getFullYear()} <strong>Xevera Portal</strong>. All rights reserved.</footer>
      </main>
    </div>
  );
}