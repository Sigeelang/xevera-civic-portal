import { useState, useMemo, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PW_REQS = [
  { key: 'len', label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { key: 'upper', label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'At least one number', test: (p) => /[0-9]/.test(p) },
  { key: 'spec', label: 'At least one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const inputCls = 'w-full h-[46px] px-3.5 border border-[#D3DEEF] rounded-[10px] text-[14px] bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1769ED]/25 focus:border-[#1769ED] placeholder:text-[#9CA3AF] pr-11';

function CheckIcon({ on }) {
  return on ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1EA85B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg>
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
function PasswordStep({ userName, onDone, onLogout }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const reqsOk = useMemo(() => PW_REQS.map((r) => r.test(newPassword)), [newPassword]);
  const allReqsMet = reqsOk.every(Boolean);
  const matches = confirmPassword.length > 0 && confirmPassword === newPassword;
  const canSubmit = allReqsMet && matches && !saving;

  function validate() {
    if (!newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return false;
    }
    if (!allReqsMet) {
      setError('New password does not meet all requirements.');
      return false;
    }
    if (!matches) {
      setError('Passwords do not match.');
      return false;
    }
    setError('');
    return true;
  }

  async function handleContinue() {
    setAttempted(true);
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch('profile/first_login_set_password.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to update password. Please try again.');
      }
      // Password updated + OTP sent — hand off to OTP step
      onDone(data.email);
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1769ED]">🔒 First Login</span>
      <h1 className="mt-2 text-[22px] sm:text-[24px] font-extrabold text-[#11275A]">Set Your New Password</h1>
      <p className="mt-1.5 text-[13px] text-[#61769B]">For your security, you must create a new password before continuing.{userName ? ` Signed in as ${userName}.` : ''}</p>

      {error && <div className="mt-4 px-3 py-2.5 rounded-[10px] text-[13px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); handleContinue(); }} className="mt-5 space-y-4" noValidate>
        <div>
          <label className="block text-xs font-bold mb-1.5 text-[#111827]">New Password *</label>
          <div className="relative">
            <input
              type={show.next ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); if (attempted) setError(''); }}
              placeholder="Create a strong password"
              autoComplete="new-password"
              className={inputCls}
            />
            <button type="button" onClick={() => setShow((s) => ({ ...s, next: !s.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#63799F] hover:text-[#1769ED] cursor-pointer text-sm">
              {show.next ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-[#111827]">Confirm New Password *</label>
          <div className="relative">
            <input
              type={show.confirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (attempted) setError(''); }}
              placeholder="Confirm your new password"
              autoComplete="new-password"
              className={inputCls}
            />
            <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#63799F] hover:text-[#1769ED] cursor-pointer text-sm">
              {show.confirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {confirmPassword.length > 0 && (
            <div className={`mt-1.5 text-[11px] font-semibold ${matches ? 'text-[#128A4C]' : 'text-[#E53935]'}`}>
              {matches ? '✓ Passwords match' : 'Passwords do not match'}
            </div>
          )}
        </div>

        <button type="submit" disabled={!canSubmit} className="w-full h-[48px] rounded-xl bg-[#1769ED] text-white text-sm font-bold hover:bg-[#0F57DC] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {saving ? 'Updating password...' : 'Continue'}
        </button>

        {onLogout && (
          <button type="button" onClick={onLogout} className="w-full h-[44px] rounded-xl bg-white border border-[#DBE4F2] text-[13px] font-bold text-[#5B6B85] hover:bg-[#F5F8FC] cursor-pointer">
            Sign out
          </button>
        )}
      </form>
    </>
  );
}

/* ──────────────────────────────────────────────
   STEP 2 — OTP Verification
   ────────────────────────────────────────────── */
function OtpStep({ email, onBack, onVerified, onLogout }) {
  const { user } = useAuth();
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
        setSuccess(true);
        setTimeout(() => onVerified && onVerified(), 2000);
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

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <span className="w-[56px] h-[56px] mx-auto grid place-items-center rounded-full bg-[#E9F8EF] text-[#16A35A] text-[26px]">✓</span>
        <h1 className="mt-4 text-[22px] sm:text-[24px] font-extrabold text-[#11275A]">Email Verified</h1>
        <p className="mt-2 text-[13px] text-[#61769B]">Your account has been successfully verified.</p>
      </div>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1769ED]">✉ Verify Your Email</span>
      <h1 className="mt-2 text-[22px] sm:text-[24px] font-extrabold text-[#11275A]">Verify Your Email</h1>
      <p className="mt-1.5 text-[13px] text-[#61769B]">
        We sent a 6-digit verification code to<br />
        <span className="font-bold text-[#1769ED]">{maskEmail(email)}</span>
      </p>

      {error && <div className="mt-4 px-3 py-2.5 rounded-[10px] text-[13px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]">{error}</div>}

      {/* OTP inputs */}
      <div className={`mt-5 flex justify-center gap-3 ${codeExpired ? 'opacity-50' : ''}`} onPaste={onPaste}>
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
            className={`w-12 h-[52px] rounded-[10px] bg-white text-center text-[22px] font-bold text-[#111827] outline-none transition-all duration-200 border-2 ${digits[i] ? 'border-[#6DA1FA] bg-[#F8FBFF]' : 'border-[#D8E3F5]'} focus:border-[#1769ED] focus:shadow-[0_0_0_3px_rgba(23,105,237,0.1)]`}
          />
        ))}
      </div>

      {/* Expiration */}
      <div className="mt-2.5 text-center text-[11px] text-[#6B7C95]">
        {codeExpired
          ? <span className="text-[#DC2626] font-bold">Code expired. Tap Resend below.</span>
          : <>Code expires in <strong className="text-[#1769ED]">{expFmt}</strong></>}
      </div>

      <button type="button" onClick={verify} disabled={code.length !== 6 || verifying || codeExpired}
        className="w-full h-[48px] mt-5 rounded-xl bg-[#1769ED] text-white text-sm font-bold hover:bg-[#0F57DC] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
        {verifying ? 'Verifying...' : 'Verify OTP'}
      </button>

      {/* Resend */}
      <div className="mt-4 text-center text-[13px] text-[#61769B]">
        Didn&apos;t receive the code?
        <button type="button" onClick={resend} disabled={remaining > 0 || resending}
          className="ml-1 bg-transparent border-0 text-[#1769ED] font-bold text-[13px] cursor-pointer enabled:hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
          {remaining > 0 ? `Resend in ${fmt}` : resending ? 'Sending...' : 'Resend OTP'}
        </button>
      </div>

      {resendHint && (
        <div className="mt-3 px-3 py-2 rounded-[10px] bg-[#ECFDF3] border border-[#BBE5C5] text-[#126C3D] text-[12px] text-center">{resendHint}</div>
      )}

      <button type="button" onClick={onBack} className="mt-4 w-full text-center bg-transparent border-0 text-[#1769ED] text-[13px] font-bold cursor-pointer hover:underline">
        ← Back
      </button>

      {onLogout && (
        <button type="button" onClick={onLogout} className="mt-2 w-full h-[44px] rounded-xl bg-white border border-[#DBE4F2] text-[13px] font-bold text-[#5B6B85] hover:bg-[#F5F8FC] cursor-pointer">
          Sign out
        </button>
      )}
    </>
  );
}

/* ──────────────────────────────────────────────
   MAIN — Router between steps
   ────────────────────────────────────────────── */
export default function ForcePasswordChangePage({ userName, onDone, onLogout }) {
  const [step, setStep] = useState('password'); // 'password' | 'otp' | 'done'
  const [userEmail, setUserEmail] = useState('');

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#EEF4FF 0%,#FFFFFF 50%,#EDF4FF 100%)' }}>
        <div className="w-full bg-white rounded-[18px] border border-[#E5E7EB] p-6 sm:p-8 text-center" style={{ maxWidth: 520 }}>
          <span className="w-[56px] h-[56px] mx-auto grid place-items-center rounded-full bg-[#E9F8EF] text-[#16A35A] text-[26px]">✓</span>
          <h1 className="mt-4 text-[20px] sm:text-[22px] font-extrabold text-[#11275A]">Password Updated Successfully</h1>
          <p className="mt-2 text-[13px] text-[#61769B]">A confirmation email has been sent to your registered address. You can now access your dashboard.</p>
          <button onClick={onDone} className="mt-5 w-full h-[46px] rounded-xl bg-[#1769ED] text-white text-sm font-bold hover:bg-[#0F57DC] cursor-pointer">Continue to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'linear-gradient(135deg,#EEF4FF 0%,#FFFFFF 50%,#EDF4FF 100%)' }}>
      <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start" style={{ maxWidth: 860 }}>
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-6 sm:p-8" style={{ boxShadow: '0 24px 70px rgba(36,75,137,.13)' }}>
          {step === 'password' ? (
            <PasswordStep
              userName={userName}
              onDone={(email) => { setUserEmail(email); setStep('otp'); }}
              onLogout={onLogout}
            />
          ) : (
            <OtpStep
              email={userEmail}
              onBack={() => setStep('password')}
              onVerified={() => setStep('done')}
              onLogout={onLogout}
            />
          )}
        </div>

        <aside className="bg-white rounded-[18px] border border-[#E5E7EB] p-6">
          <h2 className="text-[14px] font-extrabold text-[#11275A]">Password Requirements</h2>
          <ul className="mt-3 space-y-2">
            {PW_REQS.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-[12px] text-[#4C638B]">
                <CheckIcon on={false} />{r.label}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
            <p className="text-[11px] text-[#8A9AB5] leading-relaxed">
              After setting your password, you&apos;ll receive a verification code via email to confirm your identity.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
