import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import AuthPageLayout, { AUTH_CARD } from '../../components/auth/AuthPageLayout';
import OtpVerificationPage, { SecureBadge } from './OtpVerificationPage';

const REQS = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function StepIcon({ type = 'default', children }) {
  const cls = type === 'success' ? 'bg-[#EAF8F0] text-[#159447]' : type === 'error' ? 'bg-[#FFF0F0] text-[#E53935]' : 'bg-[#EAF2FF] text-[#1465F5]';
  return (
    <div className={`w-16 h-16 grid place-items-center mx-auto mb-[22px] text-[30px] font-extrabold rounded-full ${cls}`}>{children}</div>
  );
}

function ReqItem({ ok, label }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${ok ? 'text-[#18A663]' : 'text-[#8793A4]'}`}>
      <span className={`w-3.5 h-3.5 rounded-full grid place-items-center text-[8px] flex-shrink-0 ${ok ? 'bg-[#EAF9F1]' : 'bg-[#E6EBF2]'}`}>✓</span>
      {label}
    </div>
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
  const validPassword = REQS.every((r) => r.test(newPw));
  const canReset = validPassword && confirm === newPw && confirm.length > 0;

  async function resetPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!canReset) { toast('Please meet all password requirements and confirm your password.'); return; }
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
          <StepIcon>🔑</StepIcon>
          <h1 className="text-[34px] max-sm:text-[25px] leading-[1.2] font-bold text-[#09285F] mb-[15px]">Create New Password</h1>
          <p className="text-[#64789D] text-[17px] max-sm:text-[15px] leading-[1.6]">
            Your new password must be different from your previous password.
          </p>
          {error && <div className="mt-5 bg-[#FFF0F0] border border-[#FECACA] text-[#E53935] text-[12px] font-bold px-4 py-2.5 rounded-[10px]">{error}</div>}

          <form onSubmit={resetPassword} className="text-left">
            <label className="block mt-[34px] mb-3 text-lg font-semibold text-[#09285F] max-sm:text-base">New Password</label>
            <div className="relative">
              <input
                ref={newRef}
                type={show.new ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                className={`${inputBase} pr-12`}
              />
              <button type="button" onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-[7px] bg-transparent border-none text-[#8290A4] hover:bg-[#F2F5F9] hover:text-[#1263F4] cursor-pointer">
                ◉
              </button>
            </div>
            <div className="mt-3 p-3.5 border border-[#E6EBF2] bg-[#F8FAFC] rounded-[10px]">
              <div className="text-[10px] font-extrabold text-[#69778C] mb-2">Password requirements:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {REQS.map((r) => <ReqItem key={r.id} ok={r.test(newPw)} label={r.label} />)}
              </div>
            </div>

            <label className="block mt-5 mb-3 text-lg font-semibold text-[#09285F] max-sm:text-base">Confirm New Password</label>
            <div className="relative">
              <input
                type={show.confirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className={`${inputBase} pr-12`}
              />
              <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-[7px] bg-transparent border-none text-[#8290A4] hover:bg-[#F2F5F9] hover:text-[#1263F4] cursor-pointer">
                ◉
              </button>
            </div>
            {confirm.length > 0 && (
              <div className={`mt-2 text-[11px] font-bold ${confirm === newPw ? 'text-[#18A663]' : 'text-[#E53935]'}`}>
                {confirm === newPw ? '✓ Passwords match.' : 'Passwords do not match.'}
              </div>
            )}

            <button type="submit" disabled={!canReset || resetting} className={`${primaryBtn} mt-[27px] !w-full`}>
              {resetting ? 'Resetting...' : (<>Reset Password <span className="text-[25px] -mb-0.5">→</span></>)}
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
          <button onClick={() => onLogin && onLogin()} className={primaryBtn}>
            Go to Login <span className="text-[25px] -mb-0.5">→</span>
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
          <button onClick={() => { setStep(1); setError(''); }} className={primaryBtn}>
            Request New Code <span className="text-[25px] -mb-0.5">→</span>
          </button>
          <button type="button" onClick={() => onLogin && onLogin()} className={backLink}>Back to Login</button>
        </section>
      )}

      <style>{'@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'}</style>
    </AuthPageLayout>
  );
}
