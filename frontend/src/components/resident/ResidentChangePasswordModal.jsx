import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';

const REQS = [
  { id: 'len', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'uppercase', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'lowercase', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
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

function strengthInfo(p) {
  const score = REQS.filter((r) => r.test(p)).length;
  if (!p) return { score: 0, label: '', color: '#D1D9E6' };
  if (score <= 2) return { score, label: 'Weak', color: '#EF4444' };
  if (score <= 4) return { score, label: 'Medium', color: '#F59E0B' };
  return { score, label: 'Strong', color: '#059669' };
}

export default function ResidentChangePasswordModal({ open, email, onClose, onChanged }) {
  const toast = useToast();
  const overlayRef = useRef(null);

  // Flow: 'password' -> 'otp' -> 'otp-success' -> 'done'
  const [step, setStep] = useState('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState({ new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [otpDigits, setOtpDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [remaining, setRemaining] = useState(60);
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendHint, setResendHint] = useState('');
  const otpInputsRef = useRef([]);

  const code = otpDigits.join('');
  const validPassword = REQS.every((r) => r.test(newPassword));
  const confirmMatch = confirmPassword.length > 0 && confirmPassword === newPassword;
  const validNew = validPassword && confirmMatch;
  const st = strengthInfo(newPassword);

  useEffect(() => {
    if (open) {
      setStep('password');
      setNewPassword('');
      setConfirmPassword('');
      setOtpDigits(Array(6).fill(''));
      setOtpError('');
      setRemaining(60);
      setExpiresIn(300);
      setResendHint('');
      setDone(false);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => { if (step === 'otp' && otpInputsRef.current[0]) otpInputsRef.current[0].focus(); }, [step]);
  useEffect(() => { if (remaining <= 0) return; const t = setInterval(() => setRemaining((s) => s - 1), 1000); return () => clearInterval(t); }, [remaining]);
  useEffect(() => { if (expiresIn <= 0) return; const t = setInterval(() => setExpiresIn((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, [expiresIn]);

  const fmt = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const expFmt = `${String(Math.floor(expiresIn / 60)).padStart(2, '0')}:${String(expiresIn % 60).padStart(2, '0')}`;
  const codeExpired = expiresIn === 0;

  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '');
    setOtpError('');
    if (!clean) { setOtpDigits((d) => d.map((v, i) => (i === index ? '' : v))); return; }
    setOtpDigits((d) => { const next = [...d]; next[index] = clean.slice(-1); return next; });
    if (clean && index < 5) otpInputsRef.current[index + 1]?.focus();
  }

  function onOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
      setOtpDigits((d) => d.map((v, i) => (i === index - 1 ? '' : v)));
    }
  }

  function onOtpPaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').substring(0, 6);
    if (!pasted) return;
    setOtpDigits((d) => pasted.split('').map((c, i) => c || d[i]));
    setOtpError('');
    otpInputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function submitPassword() {
    if (!validNew || saving) return;
    setSaving(true);
    setOtpError('');
    try {
      const data = await apiFetch('profile/password_change_request_otp.php', { method: 'POST' });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      toast(data.message || 'Verification code sent to your email.');
      setStep('otp');
      setOtpDigits(Array(6).fill(''));
      setRemaining(60);
      setExpiresIn(300);
    } catch (err) {
      toast(err.message || 'Could not send the verification code.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function requestOtp() {
    setResending(true);
    setOtpError('');
    setResendHint('');
    try {
      const data = await apiFetch('profile/password_change_request_otp.php', { method: 'POST' });
      if (data?.success) {
        setOtpDigits(Array(6).fill(''));
        setRemaining(60);
        setExpiresIn(300);
        setResendHint('New verification code sent.');
        otpInputsRef.current[0]?.focus();
      } else {
        setOtpError(data?.error || 'Unable to send code.');
      }
    } catch (err) {
      setOtpError(err.message || 'Unable to send code.');
    } finally {
      setResending(false);
    }
  }

  async function verifyOtp() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setOtpError('');
    try {
      const data = await apiFetch('auth/verify-otp.php', {
        method: 'POST',
        body: { email, otp: code, purpose: 'password_change' },
      });
      if (data?.success) {
        setStep('otp-success');
        setTimeout(() => {
          applyPassword();
        }, 1200);
      } else {
        const msg = String(data?.error || '').toLowerCase();
        let friendly = 'Invalid verification code. Please try again.';
        if (msg.includes('expired')) friendly = 'Code expired. Please request a new code.';
        if (msg.includes('too many')) friendly = 'Too many attempts. Please wait before trying again.';
        setOtpError(friendly);
        setOtpDigits(Array(6).fill(''));
        otpInputsRef.current[0]?.focus();
      }
    } catch (err) {
      const msg = String(err.message || '').toLowerCase();
      let friendly = 'Invalid verification code. Please try again.';
      if (msg.includes('expired')) friendly = 'Code expired. Please request a new code.';
      if (msg.includes('too many')) friendly = 'Too many attempts. Please wait before trying again.';
      setOtpError(friendly);
      setOtpDigits(Array(6).fill(''));
      otpInputsRef.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function applyPassword() {
    try {
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      setDone(true);
      toast('Password changed successfully.');
      onChanged && onChanged();
      setTimeout(() => { onClose && onClose(); }, 1800);
    } catch (err) {
      toast(err.message || 'Could not change password.', 'error');
      setStep('password');
    }
  }

  if (!open) return null;

  /* ──── DONE ──── */
  if (done) {
    return (
      <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px]">
        <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_25px_70px_rgba(18,35,65,0.22)] p-8 text-center animate-[modalRise_220ms_ease]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] grid place-items-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="text-[18px] font-extrabold text-[#111827]">Password Updated</h2>
          <p className="mt-1.5 text-[13px] text-[#6B7280]">Redirecting you to sign in with your new password...</p>
        </div>
      </div>
    );
  }

  /* ──── OTP SUCCESS FLASH ──── */
  if (step === 'otp-success') {
    return (
      <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px]">
        <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-[0_25px_70px_rgba(18,35,65,0.22)] p-8 text-center animate-[modalRise_220ms_ease]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] grid place-items-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="text-[18px] font-extrabold text-[#111827]">Code Verified Successfully!</h2>
          <p className="mt-1.5 text-[13px] text-[#6B7280]">Updating your password now...</p>
        </div>
      </div>
    );
  }

  /* ──── STEP 1: SET NEW PASSWORD ──── */
  if (step === 'password') {
    return (
      <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px] overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) onClose && onClose(); }}>
        <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_25px_70px_rgba(18,35,65,0.22)] overflow-hidden my-2 animate-[modalRise_220ms_ease]">

          {/* Header */}
          <div className="relative bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] px-6 py-5 text-center">
            <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm text-white text-[18px] leading-none hover:bg-white/25 transition-colors cursor-pointer flex items-center justify-center">×</button>
            <div className="w-11 h-11 mx-auto rounded-xl bg-white/15 backdrop-blur-sm grid place-items-center mb-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <h2 className="text-[17px] font-extrabold text-white tracking-tight">Change Password</h2>
            <p className="mt-0.5 text-[12px] text-white/70">Create a strong password for your account.</p>
          </div>

          {/* Account row */}
          <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white grid place-items-center text-[12px] font-bold">
                {(email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-[12.5px] text-[#374151] font-medium truncate max-w-[180px]">{email || 'user@email.com'}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
              Connected
            </span>
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4">

            <PasswordField
              id="modal-pw-new"
              label="New Password"
              placeholder="Create a strong password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(v) => { setNewPassword(v); }}
              visible={showPw.new}
              onToggle={() => setShowPw((s) => ({ ...s, new: !s.new }))}
            />

            {/* Strength bar */}
            {newPassword && (
              <div className="-mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#6B7280]">Strength</span>
                  <span className="text-[10px] font-bold" style={{ color: st.color }}>{st.label}</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="h-1 rounded-full" style={{ background: i <= st.score ? st.color : '#E5E7EB' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Compact requirement hint */}
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 -mt-1">
              {REQS.map((r) => (
                <span key={r.id} className={`text-[10px] font-medium ${r.test(newPassword) ? 'text-[#059669]' : 'text-[#9CA3AF]'}`}>
                  {r.test(newPassword) ? '\u2713' : '\u2022'} {r.label}
                </span>
              ))}
            </div>

            <PasswordField
              id="modal-pw-confirm"
              label="Confirm New Password"
              placeholder="Re-enter new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(v) => setConfirmPassword(v)}
              visible={showPw.confirm}
              onToggle={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
              error={confirmPassword && !confirmMatch ? 'Passwords do not match' : ''}
            />

            {confirmPassword && confirmMatch && (
              <div className="text-[11px] text-[#059669] font-semibold -mt-2">{'\u2713'} Passwords match</div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-[48px] rounded-xl bg-white text-[#6B7280] text-[13px] font-bold border border-[#D1D9E6] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={submitPassword} disabled={saving || !validNew} className="flex-[1.45] h-[48px] rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[13px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" /></svg>
                    Sending code...
                  </span>
                ) : 'Continue'}
              </button>
            </div>
          </div>

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

  /* ──── STEP 2: OTP VERIFICATION ──── */
  return (
    <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px] overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) onClose && onClose(); }}>
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_25px_70px_rgba(18,35,65,0.22)] overflow-hidden my-2 animate-[modalRise_220ms_ease]">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#1E3A5F] to-[#2563EB] px-6 py-5 text-center">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm text-white text-[18px] leading-none hover:bg-white/25 transition-colors cursor-pointer flex items-center justify-center">×</button>
          <div className="w-11 h-11 mx-auto rounded-xl bg-white/15 backdrop-blur-sm grid place-items-center mb-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 className="text-[17px] font-extrabold text-white tracking-tight">Verify It&apos;s You</h2>
          <p className="mt-0.5 text-[12px] text-white/70">We&apos;ve sent a 6-digit code to your email.</p>
        </div>

        {/* Email row */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-center">
          <span className="text-[12.5px] text-[#374151] font-medium">
            Code sent to <span className="font-bold text-[#2563EB]">{maskEmail(email)}</span>
          </span>
        </div>

        <div className="px-6 py-5">
          {otpError && (
            <div className="mb-4 px-3 py-2.5 rounded-xl text-[12px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] font-medium">{otpError}</div>
          )}

          {/* OTP inputs */}
          <div className={`flex justify-center gap-2.5 ${codeExpired ? 'opacity-50' : ''}`} onPaste={onOtpPaste}>
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => { otpInputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                disabled={codeExpired}
                aria-label={`OTP digit ${i + 1}`}
                value={otpDigits[i]}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onOtpKeyDown(i, e)}
                className={`w-12 h-[52px] rounded-xl bg-white text-center text-[20px] font-bold text-[#111827] outline-none transition-all duration-200 border-2 ${otpDigits[i] ? 'border-[#6DA1FA] bg-[#F8FBFF]' : 'border-[#D8E3F5]'} focus:border-[#2563EB] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]`}
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
          <button type="button" onClick={verifyOtp} disabled={code.length !== 6 || verifying || codeExpired}
            className="w-full h-[48px] mt-5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer">
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" /></svg>
                Verifying...
              </span>
            ) : 'Verify Code'}
          </button>

          {/* Resend */}
          <div className="mt-4 text-center text-[13px] text-[#6B7280]">
            Didn&apos;t receive the code?
            <button type="button" onClick={requestOtp} disabled={remaining > 0 || resending}
              className="ml-1 bg-transparent border-0 text-[#2563EB] font-bold text-[13px] cursor-pointer enabled:hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
              {remaining > 0 ? `Resend in ${fmt}` : resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>

          {resendHint && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-[12px] text-center font-medium">{resendHint}</div>
          )}

          {/* Check spam note */}
          <p className="mt-3 text-center text-[11px] text-[#9CA3AF]">
            Check your Inbox or Spam folder if you don&apos;t see the code.
          </p>

          <button type="button" onClick={onClose} className="mt-4 w-full h-[40px] rounded-xl bg-white border border-[#D1D9E6] text-[13px] font-bold text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-all cursor-pointer">
            Cancel
          </button>
        </div>

        <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E5E7EB] text-center">
          <p className="text-[11px] text-[#9CA3AF] flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Your identity is being verified securely.
          </p>
        </div>
      </div>
    </div>
  );
}