import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import AuthPageLayout, { AUTH_CARD } from '../../components/auth/AuthPageLayout';
import OtpVerificationPage, { SecureBadge } from './OtpVerificationPage';

function StepIcon({ type = 'default', children }) {
  const cls = type === 'success' ? 'bg-[#EAF8F0] text-[#159447]' : type === 'error' ? 'bg-[#FFF0F0] text-[#E53935]' : 'bg-[#EAF2FF] text-[#1465F5]';
  return (
    <div className={`w-16 h-16 grid place-items-center mx-auto mb-[22px] text-[30px] font-extrabold rounded-full ${cls}`}>{children}</div>
  );
}

export default function ForgotPasswordPage({ onBack, onLogin }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ new: false, confirm: false });
  const [resetting, setResetting] = useState(false);
  const newRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  // Step 1: Enter email - send either reset link or OTP
  async function sendCode(e) {
    if (e && e.preventDefault) e.preventDefault();
    const value = email.trim();
    if (!value) { toast('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { toast('Please enter a valid email address.'); return; }
    setSending(true);
    setError('');
    try {
      await apiFetch('auth/forgot.php', { method: 'POST', body: { email: value, purpose: 'resident_password_reset' } });
      /* The backend only responds on success - an emailed OTP is assumed. */
      setOtpSent(true);
      toast('A 6-digit verification code has been sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Could not send the reset request.');
    } finally {
      setSending(false);
    }
  }

  // Step 3: new password
  const validPassword = newPw.length >= 8 && /[A-Z]/.test(newPw) && /[a-z]/.test(newPw) && /[0-9]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw);
  const canReset = validPassword && confirm === newPw && confirm.length > 0;

  async function resetPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!canReset) {
      if (!validPassword) {
        toast('Your new password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.');
      } else {
        toast('The two passwords do not match.');
      }
      return;
    }
    setResetting(true);
    setError('');
    try {
      await apiFetch('auth/reset.php', { method: 'POST', body: { email, new_password: newPw, confirm_password: confirm, purpose: 'resident_password_reset' } });
      toast('Password updated successfully.');
      setStep(4);
    } catch (err) {
      const msg = err.message || 'Could not reset your password.';
      if (/invalid|expired/i.test(msg)) {
        setError(msg);
        setStep(5);
      } else {
        setError(msg);
      }
    } finally {
      setResetting(false);
    }
  }

  function backToLogin() {
    setStep(1);
    setEmail('');
    setError('');
    onLogin && onLogin();
  }

  /*
   * OTP verification screen.
   * When a 6-digit code was emailed, show the dedicated
   * verification page before the new-password step.
   */
  if (step === 2 && otpSent) {
    return (
      <OtpVerificationPage
        email={email}
        purpose="resident_password_reset"
        onVerified={() => { setError(''); setStep(3); }}
        onLogin={backToLogin}
      />
    );
  }

  const inputBase = 'w-full h-[52px] border border-[#D8E3F5] rounded-[10px] bg-white px-4 text-[14px] text-[#09285F] outline-none transition-colors hover:border-[#9EBDF5] focus:border-[#1163F3] focus:shadow-[0_0_0_3px_rgba(20,101,245,0.08)] placeholder:text-[#A2ADBD]';
  const primaryBtn = 'w-full h-16 max-sm:h-[58px] rounded-[11px] border-none text-white text-[19px] max-sm:text-[17px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(20,101,245,0.28)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:translate-y-0';
  const backLink = 'mt-[25px] bg-transparent border-none text-[#0562F4] text-[17px] max-sm:text-[15px] font-bold cursor-pointer hover:underline';

  return (
    <AuthPageLayout>

      {/* Step 1 - email */}
      {step === 1 && (
        <section className={`${AUTH_CARD} animate-[fadeIn_250ms_ease]`}>
          <SecureBadge />
          <StepIcon>?</StepIcon>
          <h1 className="text-[36px] max-sm:text-[28px] leading-[1.2] font-bold text-[#09285F] mb-3.5">Forgot Password?</h1>
          <p className="max-w-[500px] mx-auto text-[#667DA4] text-[17px] max-sm:text-[15px] leading-[1.65]">
            No worries! Enter your registered email and we'll send you a verification code to reset your password.
          </p>
          {error && <div className="mt-4 bg-[#FFF0F0] border border-[#FECACA] text-[#E53935] text-[13px] font-semibold px-4 py-3 rounded-[10px] text-center">{error}</div>}
          <form onSubmit={sendCode} className="text-left mt-8">
            <label className="block mb-2.5 text-base font-bold text-[#09285F]">Email Address</label>
            <div className="relative">
              <svg className="absolute left-[18px] top-1/2 -translate-y-1/2 w-[21px] h-[21px] text-[#7D91B4]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth={2} />
                <path d="M3 7L12 13L21 7" stroke="currentColor" strokeWidth={2} />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full h-[58px] border-[1.5px] border-[#D7E3F7] rounded-[11px] bg-white outline-none pl-[50px] pr-[18px] text-[16px] text-[#09285F] transition-colors duration-200 placeholder:text-[#9AABC5] focus:border-[#1465F5] focus:shadow-[0_0_0_4px_rgba(20,101,245,0.08)]"
              />
            </div>
            <button type="submit" disabled={sending}
              className="w-full h-[58px] mt-5 rounded-[11px] border-none text-white text-[17px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(20,101,245,0.28)] disabled:opacity-65 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#1465F5,#075BEA)', boxShadow: '0 12px 25px rgba(20,101,245,0.22)' }}>
              {sending ? 'Sending verification code...' : (<>Send Verification Code <span>→</span></>)}
            </button>
          </form>
          <button type="button" onClick={backToLogin} className={backLink}>Back to Login</button>
        </section>
      )}

      {/* Step 3 - new password */}
      {step === 3 && (
        <section className={`${AUTH_CARD} animate-[fadeIn_250ms_ease]`}>
          <SecureBadge />
          <div className="w-[72px] h-[72px] mx-auto mb-5 rounded-full bg-[#EAF2FF] grid place-items-center">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1465F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="11" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              <circle cx="12" cy="16" r="1" fill="#1465F5" />
            </svg>
          </div>
          <h1 className="text-[34px] max-sm:text-[26px] leading-[1.2] font-bold text-[#09285F] mb-3">Change Password</h1>
          <p className="text-[#64789D] text-[17px] max-sm:text-[15px] leading-[1.6]">
            Create a new password for your account.
          </p>
          {error && <div className="mt-5 bg-[#FFF0F0] border border-[#FECACA] text-[#E53935] text-[12px] font-bold px-4 py-2.5 rounded-[10px]">{error}</div>}

          <form onSubmit={resetPassword} className="text-left">
            <label className="block mt-[30px] mb-2.5 text-[15px] font-bold text-[#09285F]">New Password</label>
            <div className="relative">
              <svg className="absolute left-[16px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#7D91B4] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                ref={newRef}
                type={show.new ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                className={`${inputBase} pl-[48px] pr-12`}
              />
              <button type="button" onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-[7px] bg-transparent border-none text-[#8290A4] hover:bg-[#F2F5F9] hover:text-[#1263F4] cursor-pointer grid place-items-center">
                {show.new ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.3"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.3"/><path d="M4 4l16 16"/></svg>
                )}
              </button>
            </div>

            <label className="block mt-5 mb-2.5 text-[15px] font-bold text-[#09285F]">Confirm Password</label>
            <div className="relative">
              <svg className="absolute left-[16px] top-1/2 -translate-y-1/2 w-5 h-5 text-[#7D91B4] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type={show.confirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                className={`${inputBase} pl-[48px] pr-12`}
              />
              <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-[7px] bg-transparent border-none text-[#8290A4] hover:bg-[#F2F5F9] hover:text-[#1263F4] cursor-pointer grid place-items-center">
                {show.confirm ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.3"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.3"/><path d="M4 4l16 16"/></svg>
                )}
              </button>
            </div>
            <p className="mt-3 text-[13px] text-[#7D91B4]">Your new password must meet all of the following:</p>
            <ul className="mt-2 mb-0 list-none p-0 grid gap-1.5">
              {[
                { key: 'len',     label: 'At least 8 characters',   ok: newPw.length >= 8 },
                { key: 'upper',   label: 'One uppercase letter',    ok: /[A-Z]/.test(newPw) },
                { key: 'lower',   label: 'One lowercase letter',    ok: /[a-z]/.test(newPw) },
                { key: 'number',  label: 'One number',              ok: /[0-9]/.test(newPw) },
                { key: 'special', label: 'One special character (!@#$...)', ok: /[^A-Za-z0-9]/.test(newPw) },
              ].map((r) => (
                <li key={r.key} className={`flex items-center gap-2 text-[13px] font-semibold ${r.ok ? 'text-[#15803D]' : 'text-[#7D91B4]'}`}>
                  <span className={`inline-grid place-items-center w-[16px] h-[16px] rounded-full text-[10px] text-white ${r.ok ? 'bg-[#16A34A]' : 'bg-[#C7D2E3]'}`}>{r.ok ? '✓' : ''}</span>
                  {r.label}
                </li>
              ))}
            </ul>
            {newPw.length > 0 && confirm.length > 0 && confirm !== newPw && (
              <p className="mt-2 text-[13px] font-semibold text-[#E53935]">Passwords do not match.</p>
            )}

            <button type="submit" disabled={!canReset || resetting}
              className="w-full h-[58px] mt-6 rounded-[11px] border-none text-white text-[17px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(20,101,245,0.28)] disabled:opacity-65 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#1465F5,#075BEA)', boxShadow: '0 12px 25px rgba(20,101,245,0.22)' }}>
              {resetting ? 'Updating...' : (<>Update Password <span className="text-[22px] -mb-0.5">→</span></>)}
            </button>
          </form>
          <button type="button" onClick={backToLogin} className={backLink}>Back to Login</button>
        </section>
      )}

      {/* Step 4 - success */}
      {step === 4 && (
        <section className={`${AUTH_CARD} animate-[fadeIn_250ms_ease]`}>
          <StepIcon type="success">✓</StepIcon>
          <h1 className="text-[34px] max-sm:text-[25px] leading-[1.2] font-bold text-[#09285F] mb-[15px]">Password Reset!</h1>
          <p className="text-[#64789D] text-[17px] max-sm:text-[15px] leading-[1.6] mb-7">
            Your password has been updated successfully. You can now sign in using your new password.
          </p>
          <button onClick={() => onLogin && onLogin()} className={primaryBtn}
            style={{ background: 'linear-gradient(135deg,#1465F5,#075BEA)', boxShadow: '0 12px 25px rgba(20,101,245,0.22)' }}>
            <span className="text-black font-bold">Go to Login</span> <span className="text-black text-[25px] -mb-0.5">→</span>
          </button>
        </section>
      )}

      {/* Step 5 - invalid/expired */}
      {step === 5 && (
        <section className={`${AUTH_CARD} animate-[fadeIn_250ms_ease]`}>
          <StepIcon type="error">×</StepIcon>
          <h1 className="text-[34px] max-sm:text-[25px] leading-[1.2] font-bold text-[#09285F] mb-[15px]">Invalid or Expired</h1>
          <p className="text-[#64789D] text-[17px] max-sm:text-[15px] leading-[1.6] mb-7">
            {error || 'The reset link is invalid or has expired. Please request a new one.'}
          </p>
          <button onClick={() => { setStep(1); setError(''); }} className={primaryBtn}
            style={{ background: 'linear-gradient(135deg,#1465F5,#075BEA)', boxShadow: '0 12px 25px rgba(20,101,245,0.22)' }}>
            Request New Code <span className="text-[25px] -mb-0.5">→</span>
          </button>
          <button type="button" onClick={() => onLogin && onLogin()} className={backLink}>Back to Login</button>
        </section>
      )}

      <style>{'@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'}</style>
    </AuthPageLayout>
  );
}
