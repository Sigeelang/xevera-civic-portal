import { useState, useMemo, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PW_REQS = [
  { key: 'len',   label: '8+ characters',       test: (p) => p.length >= 8 },
  { key: 'upper', label: 'uppercase',            test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'lowercase',            test: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'number',               test: (p) => /[0-9]/.test(p) },
  { key: 'spec',  label: 'special character',    test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function EyeIcon({ visible }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {visible ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M1 1l22 22" />
        </>
      )}
    </svg>
  );
}

function PasswordField({ id, label, placeholder, autoComplete, value, onChange, visible, onToggle, error }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-[#374151] mb-1 tracking-wide uppercase" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-[48px] pl-3.5 pr-12 border border-[#D1D9E6] rounded-xl text-[14px] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] placeholder:text-[#9CA3AF] transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#2563EB] hover:bg-[#EFF6FF] border border-transparent hover:border-[#BFDBFE] bg-white transition-all cursor-pointer"
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error && <div className="mt-1 text-[11px] text-[#DC2626] font-semibold">{error}</div>}
    </div>
  );
}

function maskEmail(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  return (name.length <= 2 ? name.charAt(0) + '***' : name.substring(0, 2) + '***') + '@' + parts[1];
}

/* ──────────────────────────────────────────────
   STEP 1 — Set New Password
   ────────────────────────────────────────────── */
function PasswordStep({ userName, userEmail, onDone, onLogout }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reqsOk = useMemo(() => PW_REQS.map((r) => r.test(newPassword)), [newPassword]);
  const allReqsMet = reqsOk.every(Boolean);
  const matches = confirmPassword.length > 0 && confirmPassword === newPassword;
  const canSubmit = allReqsMet && matches && !saving;

  async function handleContinue() {
    if (!newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return;
    }
    if (!allReqsMet) {
      setError('New password does not meet all requirements.');
      return;
    }
    if (!matches) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const data = await apiFetch('profile/first_login_set_password.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to update password. Please try again.');
      }
      /*
       * The password is NOT changed yet - the backend only emailed a
       * verification code. Carry the new password forward and continue
       * to the OTP step; it is applied after the code is verified.
       */
      onDone(data.email, newPassword);
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[460px] mx-auto">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] px-6 py-5 text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-white/15 backdrop-blur-sm grid place-items-center mb-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h1 className="text-[17px] font-extrabold text-white tracking-tight">Change Password</h1>
          <p className="mt-0.5 text-[12px] text-white/70">Update your password securely.</p>
        </div>

        {/* Account row */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white grid place-items-center text-[12px] font-bold">
              {(userEmail || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-[12.5px] text-[#374151] font-medium truncate max-w-[200px]">{userEmail || 'user@email.com'}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
            Connected
          </span>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="px-6 py-5 space-y-4">

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] font-medium">{error}</div>
          )}

          <PasswordField
            id="pw-new"
            label="New Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(v) => { setNewPassword(v); if (error) setError(''); }}
            visible={show.next}
            onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
          />

          {/* Compact requirement hint */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 -mt-2">
            {PW_REQS.map((r) => (
              <span key={r.key} className={`text-[10px] font-medium ${r.test(newPassword) ? 'text-[#059669]' : 'text-[#9CA3AF]'}`}>
                {r.test(newPassword) ? '\u2713' : '\u2022'} {r.label}
              </span>
            ))}
          </div>

          <PasswordField
            id="pw-confirm"
            label="Confirm New Password"
            placeholder="Re-enter new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(v) => { setConfirmPassword(v); if (error) setError(''); }}
            visible={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            error={confirmPassword && !matches ? 'Passwords do not match' : ''}
          />

          {confirmPassword && matches && (
            <div className="text-[11px] text-[#059669] font-semibold -mt-2">{'\u2713'} Passwords match</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-[48px] mt-1 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" /></svg>
                Updating...
              </span>
            ) : 'Update Password'}
          </button>

          {onLogout && (
            <button type="button" onClick={onLogout} className="w-full h-[44px] rounded-xl bg-white border border-[#D1D9E6] text-[13px] font-bold text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all cursor-pointer">
              Sign out
            </button>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E5E7EB] text-center">
          <p className="text-[11px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Your password is securely managed by XEVERA.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   STEP 2 — OTP Verification
   ────────────────────────────────────────────── */
function OtpStep({ email, onBack, onVerified, onFinished, onLogout }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(60);
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendHint, setResendHint] = useState('');
  const [success, setSuccess] = useState(false);
  const inputsRef = useRef([]);
  const code = digits.join('');

  useEffect(() => { if (inputsRef.current[0]) inputsRef.current[0].focus(); }, []);
  useEffect(() => { if (remaining <= 0) return; const t = setInterval(() => setRemaining((s) => s - 1), 1000); return () => clearInterval(t); }, [remaining]);
  useEffect(() => { if (expiresIn <= 0) return; const t = setInterval(() => setExpiresIn((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, [expiresIn]);

  function classifyError(message) {
    const m = String(message || '').toLowerCase();
    if (m.includes('expired')) return 'expired';
    if (m.includes('too many') || (m.includes('wait') && m.includes('minutes'))) return 'rate';
    if (m.includes('invalid') || m.includes('incorrect') || m.includes('wrong')) return 'invalid';
    return 'unknown';
  }

  function friendlyError(kind, original) {
    switch (kind) {
      case 'expired': return 'This verification code has expired. Please request a new code.';
      case 'rate': return 'Too many attempts. Please wait a few minutes before trying again.';
      case 'invalid': return 'Invalid verification code. Please try again.';
      default: return original || 'We could not verify the code. Please try again.';
    }
  }

  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '');
    setError('');
    if (!clean) { setDigits((d) => d.map((v, i) => (i === index ? '' : v))); return; }
    setDigits((d) => { const next = [...d]; next[index] = clean.slice(-1); return next; });
    if (clean && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function onKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      setDigits((d) => d.map((v, i) => (i === index - 1 ? '' : v)));
    }
  }

  function onPaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').substring(0, 6);
    if (!pasted) return;
    setDigits((d) => pasted.split('').map((c, i) => c || d[i]));
    setError('');
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function verify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      const data = await apiFetch('auth/verify-otp.php', {
        method: 'POST',
        body: { email, otp: code, purpose: 'password_change_first_login' },
      });
      if (data?.success) {
        try {
          /* Apply the new password now that the code is verified. */
          if (onVerified) await onVerified();
          setSuccess(true);
          setTimeout(() => { if (onFinished) onFinished(); }, 1500);
        } catch (err2) {
          setError(err2.message || 'Could not update your password. Please try again.');
          setDigits(Array(6).fill(''));
          inputsRef.current[0]?.focus();
        }
      } else {
        const kind = classifyError(data?.error);
        setError(friendlyError(kind, data?.error));
        setDigits(Array(6).fill(''));
        inputsRef.current[0]?.focus();
      }
    } catch (err) {
      const kind = classifyError(err.message);
      setError(friendlyError(kind, err.message));
      setDigits(Array(6).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (remaining > 0 || resending) return;
    setResending(true);
    setError('');
    setResendHint('');
    try {
      const data = await apiFetch('auth/resend-otp.php', {
        method: 'POST',
        body: { email, purpose: 'password_change_first_login' },
      });
      if (data?.success) {
        setDigits(Array(6).fill(''));
        setRemaining(60);
        setExpiresIn(300);
        setResendHint('New verification code sent.');
        inputsRef.current[0]?.focus();
      } else {
        setError(data?.error || 'Unable to resend code.');
      }
    } catch (err) {
      setError(err.message || 'Unable to resend code.');
    } finally {
      setResending(false);
    }
  }

  const fmt = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const expFmt = `${String(Math.floor(expiresIn / 60)).padStart(2, '0')}:${String(expiresIn % 60).padStart(2, '0')}`;
  const codeExpired = expiresIn === 0;

  if (success) {
    return (
      <div className="max-w-[460px] mx-auto">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] grid place-items-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="text-[18px] font-extrabold text-[#111827]">Email Verified</h1>
          <p className="mt-1.5 text-[13px] text-[#6B7280]">Your account has been successfully verified.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[460px] mx-auto">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] px-6 py-5 text-center">
          <div className="w-11 h-11 mx-auto rounded-xl bg-white/15 backdrop-blur-sm grid place-items-center mb-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
          </div>
          <h1 className="text-[17px] font-extrabold text-white tracking-tight">Verify Your Email</h1>
          <p className="mt-0.5 text-[12px] text-white/70">Enter the 6-digit code sent to your email.</p>
        </div>

        {/* Email row */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-center">
          <span className="text-[12.5px] text-[#374151] font-medium">
            Code sent to <span className="font-bold text-[#2563EB]">{maskEmail(email)}</span>
          </span>
        </div>

        {/* Form */}
        <div className="px-6 py-5">

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] font-medium">{error}</div>
          )}

          {/* OTP inputs */}
          <div className={`flex justify-center gap-2.5 ${codeExpired ? 'opacity-50' : ''}`} onPaste={onPaste}>
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                disabled={codeExpired}
                aria-label={`OTP digit ${i + 1}`}
                value={digits[i]}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                className={`w-12 h-[52px] rounded-xl bg-white text-center text-[20px] font-bold text-[#111827] outline-none transition-all duration-200 border-2 ${digits[i] ? 'border-[#6DA1FA] bg-[#F8FBFF]' : 'border-[#D8E3F5]'} focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]`}
              />
            ))}
          </div>

          {/* Expiration */}
          <div className="mt-2.5 text-center text-[11px] text-[#6B7280]">
            {codeExpired
              ? <span className="text-[#DC2626] font-bold">Code expired. Tap Resend below.</span>
              : <>Code expires in <strong className="text-[#2563EB]">{expFmt}</strong></>}
          </div>

          {/* Verify */}
          <button type="button" onClick={verify} disabled={code.length !== 6 || verifying || codeExpired}
            className="w-full h-[48px] mt-5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer">
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" /></svg>
                Verifying...
              </span>
            ) : 'Verify OTP'}
          </button>

          {/* Resend */}
          <div className="mt-4 text-center text-[13px] text-[#6B7280]">
            Didn&apos;t receive the code?
            <button type="button" onClick={resend} disabled={remaining > 0 || resending}
              className="ml-1 bg-transparent border-0 text-[#2563EB] font-bold text-[13px] cursor-pointer enabled:hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
              {remaining > 0 ? `Resend in ${fmt}` : resending ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>

          {resendHint && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[12px] text-center font-medium">{resendHint}</div>
          )}

          <button type="button" onClick={onBack} className="mt-4 w-full h-[40px] rounded-xl bg-white border border-[#D1D9E6] text-[13px] font-bold text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all cursor-pointer">
            {'\u2190'} Back
          </button>

          {onLogout && (
            <button type="button" onClick={onLogout} className="mt-2 w-full h-[40px] rounded-xl bg-white border border-[#D1D9E6] text-[13px] font-bold text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all cursor-pointer">
              Sign out
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E5E7EB] text-center">
          <p className="text-[11px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Your password is securely managed by XEVERA.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN — Router between steps
   ────────────────────────────────────────────── */
export default function ForcePasswordChangePage({ userName, onDone, onLogout }) {
  const { user } = useAuth();
  const [step, setStep] = useState('password');
  const [userEmail, setUserEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');

  const email = userEmail || user?.email || '';

  /* Apply the new password — runs only after the OTP has been verified. */
  async function applyFirstLoginPassword() {
    await apiFetch('profile/password_change_complete.php', {
      method: 'POST',
      body: { new_password: pendingPassword, confirm_password: pendingPassword },
    });
    try { localStorage.removeItem('xevera_force_pw_change'); } catch { /* ignore */ }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#EEF4FF 0%,#FFFFFF 50%,#EDF4FF 100%)' }}>
        <div className="max-w-[460px] w-full bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] grid place-items-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="text-[18px] font-extrabold text-[#111827]">Password Updated Successfully</h1>
          <p className="mt-1.5 text-[13px] text-[#6B7280]">A confirmation email has been sent. You can now access your dashboard.</p>
          <button onClick={onDone} className="mt-5 w-full h-[48px] rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] transition-all cursor-pointer">
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#EEF4FF 0%,#FFFFFF 50%,#EDF4FF 100%)' }}>
      {step === 'password' ? (
        <PasswordStep
          userName={userName}
          userEmail={email}
          onDone={(sentEmail, newPw) => {
            setUserEmail(sentEmail || email);
            setPendingPassword(newPw || '');
            setStep('otp');
          }}
          onLogout={onLogout}
        />
      ) : (
        <OtpStep
          email={email}
          onBack={() => setStep('password')}
          onVerified={applyFirstLoginPassword}
          onFinished={() => setStep('done')}
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
