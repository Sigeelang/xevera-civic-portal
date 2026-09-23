import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';

/*
 * Resident "Change Password" modal — prototype-matched design with the
 * real backend flow (no demo code):
 *   Step 1 (password): new + confirm fields, live requirements, Continue
 *     -> profile/password_change_request_otp.php (sends the email code)
 *   Step 2 (otp):      6-box code entry, resend + expiry timers, back
 *     -> auth/verify-otp.php (purpose password_change), then
 *        profile/password_change_complete.php applies the new password
 *   Step 3 (done):     success panel, Done closes the modal.
 */

const REQS = [
  { id: 'len', label: '8+ characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: '1 uppercase', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: '1 lowercase', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: '1 number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: '1 special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const MAX_LEN = 128;
const RESEND_SECS = 60;
const EXPIRY_SECS = 300;

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function PasswordField({ id, label, placeholder, autoComplete = 'new-password', count, value, onChange, visible, onToggle, maxLength = MAX_LEN }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-[7px]">
        <label className="text-[#253650] text-[12px] font-bold" htmlFor={id}>{label}</label>
        {typeof count === 'number' && (
          <span className="text-[#7d8ba1] text-[10px]">{count}/{MAX_LEN}</span>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-[14px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#52637c] pointer-events-none" aria-hidden="true">
          <LockIcon />
        </span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-[48px] pl-[45px] pr-[45px] border border-[#d5dfed] rounded-[9px] bg-white outline-none text-[#273852] text-[12px] transition-all focus:border-[#1769ff] focus:shadow-[0_0_0_3px_rgba(23,105,255,0.08)] placeholder:text-[#98a5b7]"
          style={{ WebkitTextFillColor: '#273852' }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-[10px] top-1/2 -translate-y-1/2 w-8 h-8 border-0 rounded-[7px] bg-transparent text-[#53647d] cursor-pointer flex items-center justify-center transition-all hover:bg-[#edf4ff] hover:text-[#1769ff] [&>svg]:w-[18px] [&>svg]:h-[18px]"
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

export default function ResidentChangePasswordModal({ open, email, onClose, onChanged }) {
  const toast = useToast();
  const overlayRef = useRef(null);
  const otpRefs = useRef([]);

  // Flow: 'password' -> 'otp' -> 'done'
  const [step, setStep] = useState('password');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [currentError, setCurrentError] = useState('');

  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendSecs, setResendSecs] = useState(RESEND_SECS);
  const [expirySecs, setExpirySecs] = useState(EXPIRY_SECS);
  const timersRef = useRef({ resend: null, expiry: null });

  const validPassword = REQS.every((r) => r.test(newPassword));
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === newPassword;
  const validNew = validPassword && passwordsMatch && currentPassword.length > 0;
  const code = digits.join('');
  const codeExpired = expirySecs <= 0;

  function clearTimers() {
    if (timersRef.current.resend) { clearInterval(timersRef.current.resend); timersRef.current.resend = null; }
    if (timersRef.current.expiry) { clearInterval(timersRef.current.expiry); timersRef.current.expiry = null; }
  }

  function startTimers() {
    clearTimers();
    setResendSecs(RESEND_SECS);
    setExpirySecs(EXPIRY_SECS);
    timersRef.current.resend = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) { clearInterval(timersRef.current.resend); timersRef.current.resend = null; return 0; }
        return s - 1;
      });
    }, 1000);
    timersRef.current.expiry = setInterval(() => {
      setExpirySecs((s) => {
        if (s <= 1) {
          clearInterval(timersRef.current.expiry); timersRef.current.expiry = null;
          setOtpError('This verification code has expired. Please request a new code.');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function resetAll() {
    clearTimers();
    setStep('password');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPw({ current: false, new: false, confirm: false });
    setSaving(false);
    setCurrentError('');
    setDigits(Array(6).fill(''));
    setVerifying(false);
    setResending(false);
    setOtpError('');
    setResendSecs(RESEND_SECS);
    setExpirySecs(EXPIRY_SECS);
  }

  useEffect(() => {
    if (open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimers();
    };
  }, [open, onClose]);

  function closeAll() {
    clearTimers();
    onClose && onClose();
  }

  /* Step 1 — verify current password + request the OTP (no change yet). */
  async function submitPassword() {
    if (!validNew || saving) return;
    setSaving(true);
    setCurrentError('');
    try {
      const data = await apiFetch('profile/password_change_init.php', {
        method: 'POST',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      toast(data.message || 'Verification code sent to your email.');
      setDigits(Array(6).fill(''));
      setOtpError('');
      setStep('otp');
      startTimers();
      setTimeout(() => { try { otpRefs.current[0]?.focus(); } catch {} }, 150);
    } catch (err) {
      const msg = err.message || 'Could not send the verification code.';
      if (/current password/i.test(msg)) setCurrentError(msg);
      else toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function resendOtp() {
    if (resendSecs > 0 || resending) return;
    setResending(true);
    setOtpError('');
    try {
      const data = await apiFetch('auth/resend-otp.php', { method: 'POST', body: { email, purpose: 'password_change' } });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Could not resend the verification code.');
      }
      setDigits(Array(6).fill(''));
      startTimers();
      toast('A new verification code has been sent. Your previous code is no longer valid.');
      setTimeout(() => { try { otpRefs.current[0]?.focus(); } catch {} }, 100);
    } catch (err) {
      setOtpError(err.message || 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  }

  function backToPassword() {
    clearTimers();
    setOtpError('');
    setDigits(Array(6).fill(''));
    setStep('password');
  }

  /* Step 2 — verify the code AND apply the new password. */
  async function verifyOtp() {
    if (code.length !== 6 || verifying || codeExpired) {
      if (code.length !== 6) setOtpError('Please enter the complete 6-digit verification code.');
      return;
    }
    setVerifying(true);
    setOtpError('');
    try {
      const v = await apiFetch('auth/verify-otp.php', {
        method: 'POST',
        body: { email, otp: code, purpose: 'password_change' },
      });
      if (!v || v.success !== true) {
        throw new Error(v?.error || 'Invalid verification code. Please try again.');
      }
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      clearTimers();
      setStep('done');
    } catch (err) {
      setOtpError(err.message || 'Incorrect verification code. Please try again.');
      setDigits(Array(6).fill(''));
      try { otpRefs.current[0]?.focus(); } catch {}
    } finally {
      setVerifying(false);
    }
  }

  function finishDone() {
    const close = () => { resetAll(); onClose && onClose(); };
    close();
    onChanged && onChanged();
    toast('Password changed successfully.');
  }

  /* ---- OTP digit handlers ---- */
  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '');
    setOtpError('');
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? '' : v)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[index] = clean.slice(-1);
      return next;
    });
    if (index < 5) {
      try { otpRefs.current[index + 1]?.focus(); } catch {}
    }
  }

  function onDigitKey(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      try { otpRefs.current[index - 1]?.focus(); } catch {}
      setDigits((d) => d.map((v, i) => (i === index - 1 ? '' : v)));
    }
  }

  function onDigitPaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').substring(0, 6);
    if (!pasted) return;
    setDigits((d) => pasted.split('').map((c, i) => c || d[i]));
    setOtpError('');
    try { otpRefs.current[Math.min(pasted.length, 5)]?.focus(); } catch {}
  }

  if (!open) return null;

  const expFmt = `${Math.floor(expirySecs / 60)}:${String(expirySecs % 60).padStart(2, '0')}`;
  const initial = (email || 'U').charAt(0).toUpperCase();

  /* ──── STEP 3: SUCCESS ──── */
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[3000] bg-[rgba(31,45,66,0.66)] backdrop-blur-[7px] flex items-center justify-center p-5" onClick={(e) => { if (e.target === overlayRef.current) finishDone(); }}>
        <div ref={overlayRef} className="w-full max-w-[470px] relative bg-white rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.22)] animate-[modalRise_220ms_ease]">
          <button type="button" onClick={finishDone} aria-label="Close" className="absolute right-[18px] top-[18px] w-9 h-9 border-0 rounded-lg bg-[#f0f4fa] text-[#35445c] text-[18px] cursor-pointer flex items-center justify-center transition-all hover:bg-[#e4eaf3]">×</button>
          <div className="px-[35px] pt-[42px] pb-[35px] text-center">
            <div className="w-[82px] h-[82px] mx-auto mb-[22px] rounded-full bg-[#dff8ec] text-[#18a875] flex items-center justify-center shadow-[0_0_0_10px_#effbf5]">
              <svg className="w-[43px] h-[43px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
            </div>
            <h2 className="text-[21px] font-extrabold text-[#172642]">Password Changed Successfully</h2>
            <p className="max-w-[330px] mx-auto mt-[9px] mb-[25px] text-[#65758f] text-[11px] leading-[1.65]">
              Your account password has been updated.<br />You can now use your new password to log in to <strong className="text-[#344660]">XEVERA</strong>.
            </p>
            <button type="button" onClick={finishDone} className="w-full h-[47px] rounded-[9px] border border-[#1769ff] bg-[#1769ff] text-white text-[12px] font-bold cursor-pointer transition-all shadow-[0_4px_12px_rgba(23,105,255,0.18)] hover:bg-[#1058d8]">Done</button>
          </div>
          <div className="min-h-[50px] border-t border-[#e9eef5] bg-[#fafbfd] flex items-center justify-center text-[#8491a5] text-[10px] rounded-b-2xl">🛡 Your password is securely managed by XEVERA.</div>
        </div>
      </div>
    );
  }

  /* ──── STEP 2: OTP ──── */
  if (step === 'otp') {
    return (
      <div className="fixed inset-0 z-[3000] bg-[rgba(31,45,66,0.66)] backdrop-blur-[7px] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) closeAll(); }}>
        <div ref={overlayRef} className="w-full max-w-[480px] bg-white rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.22)] overflow-hidden my-4 animate-[modalRise_220ms_ease]">
          <div className="h-[55px] relative border-b border-[#e9eef5]">
            <button type="button" onClick={backToPassword} aria-label="Back" className="absolute left-[18px] top-[10px] w-9 h-9 border-0 rounded-lg bg-[#f0f4fa] text-[#34445d] text-[18px] cursor-pointer hover:bg-[#e4eaf3]">←</button>
            <button type="button" onClick={closeAll} aria-label="Close" className="absolute right-[18px] top-[10px] w-9 h-9 border-0 rounded-lg bg-[#f0f4fa] text-[#34445d] text-[18px] cursor-pointer hover:bg-[#e4eaf3]">×</button>
          </div>
          <div className="px-[35px] pt-[30px] pb-7 text-center">
            <div className="w-[62px] h-[62px] mx-auto mb-[15px] rounded-[14px] bg-[#edf4ff] text-[#1769ff] flex items-center justify-center">
              <svg className="w-[29px] h-[29px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </div>
            <h2 className="text-[21px] font-extrabold text-[#172642]">Verify Your Email</h2>
            <p className="max-w-[330px] mx-auto mt-2 mb-[22px] text-[#65758f] text-[11px] leading-[1.6]">
              We sent a 6-digit verification code to<br /><span className="text-[#233957] font-bold">{email}</span>
            </p>
            <div className="flex justify-center gap-[9px] mb-4" onPaste={onDigitPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onDigitKey(i, e)}
                  onFocus={(e) => e.target.select()}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`OTP digit ${i + 1}`}
                  disabled={codeExpired}
                  className="w-[50px] h-[54px] border border-[#d2ddeb] rounded-[9px] bg-white outline-none text-center text-[#1d3150] text-[20px] font-bold transition-all focus:border-[#1769ff] focus:shadow-[0_0_0_3px_rgba(23,105,255,0.08)] disabled:opacity-55"
                />
              ))}
            </div>
            {otpError && <div className="text-[#d84d4d] text-[10px] mb-[10px]">{otpError}</div>}
            <div className="min-h-[48px] mb-[15px] border border-[#e5ebf3] rounded-[9px] bg-[#f8fafd] flex items-center justify-center text-[#64738b] text-[10px]">
              <span className="w-4 h-4 mr-[7px] rounded-full bg-[#1769ff] text-white inline-flex items-center justify-center text-[9px] font-bold flex-shrink-0">i</span>
              The code will expire in <strong className="ml-1">{codeExpired ? 'expired' : expFmt}</strong>
            </div>
            <button
              type="button"
              onClick={verifyOtp}
              disabled={code.length !== 6 || verifying || codeExpired}
              className="w-full h-[47px] rounded-[9px] border border-[#1769ff] bg-[#1769ff] text-white text-[12px] font-bold cursor-pointer transition-all shadow-[0_4px_12px_rgba(23,105,255,0.18)] hover:bg-[#1058d8] disabled:bg-[#b7cdf5] disabled:border-[#b7cdf5] disabled:shadow-none disabled:cursor-not-allowed"
            >
              {verifying ? 'Verifying...' : 'Verify & Change Password'}
            </button>
            <div className="mt-[14px] text-[#7e8ca1] text-[10px]">
              Didn&apos;t receive the code?{' '}
              <button
                type="button"
                onClick={resendOtp}
                disabled={resendSecs > 0 || resending}
                className="border-0 bg-transparent text-[#1769ff] text-[10px] font-bold cursor-pointer disabled:text-[#a3afbf] disabled:cursor-default"
              >
                {resendSecs > 0 ? <>Resend in <span>{resendSecs}</span>s</> : resending ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </div>
          <div className="min-h-[50px] border-t border-[#e9eef5] bg-[#fafbfd] flex items-center justify-center text-[#8491a5] text-[10px]">🛡 Your password is securely managed by XEVERA.</div>
        </div>
      </div>
    );
  }

  /* ──── STEP 1: NEW PASSWORD ──── */
  return (
    <div className="fixed inset-0 z-[3000] bg-[rgba(31,45,66,0.66)] backdrop-blur-[7px] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) closeAll(); }}>
      <div ref={overlayRef} className="w-full max-w-[620px] bg-white rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.22)] overflow-hidden my-4 animate-[modalRise_220ms_ease]">
        <div className="min-h-[122px] px-7 py-[25px] border-b border-[#e9eef5] flex items-center relative">
          <div className="w-[62px] h-[62px] rounded-[13px] bg-[#edf4ff] text-[#1769ff] flex items-center justify-center mr-[18px] flex-shrink-0 [&>svg]:w-[29px] [&>svg]:h-[29px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          </div>
          <div>
            <h2 className="text-[22px] font-extrabold text-[#172642] mb-[6px]">Change Password</h2>
            <p className="text-[#65758f] text-[12px]">Create a new and secure password for your account.</p>
          </div>
          <button type="button" onClick={closeAll} aria-label="Close" className="absolute right-[18px] top-[18px] w-9 h-9 border-0 rounded-lg bg-[#f0f4fa] text-[#35445c] cursor-pointer flex items-center justify-center text-[18px] transition-all hover:bg-[#e4eaf3]">×</button>
        </div>

        <div className="min-h-[70px] px-7 py-3 border-b border-[#e9eef5] flex items-center">
          <div className="w-10 h-10 rounded-full bg-[#1769ff] text-white flex items-center justify-center mr-3 text-[14px] font-bold flex-shrink-0">{initial}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[#23344f] text-[12px] font-bold truncate">{email}</div>
            <div className="text-[#8a98ab] mt-[3px] text-[10px]">Resident Account</div>
          </div>
          <div className="px-[11px] py-[7px] rounded-[20px] bg-[#e7f8f0] text-[#18a875] text-[10px] font-bold flex-shrink-0">
            <span className="inline-block w-[6px] h-[6px] mr-[5px] rounded-full bg-[#18a875]" />Connected
          </div>
        </div>

        <div className="px-7 py-6">
          <div className="mb-[17px]">
            <PasswordField
              id="modal-pw-current"
              label="Current Password"
              placeholder="Enter current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(v) => { setCurrentPassword(v); if (currentError) setCurrentError(''); }}
              visible={showPw.current}
              onToggle={() => setShowPw((s) => ({ ...s, current: !s.current }))}
            />
            {currentError && (
              <div className="mt-[6px] text-[#d84d4d] text-[10px]">{currentError}</div>
            )}
          </div>

          <div className="mb-[17px]">
            <PasswordField
              id="modal-pw-new"
              label="New Password"
              placeholder="Create a strong password"
              count={newPassword.length}
              value={newPassword}
              onChange={setNewPassword}
              visible={showPw.new}
              onToggle={() => setShowPw((s) => ({ ...s, new: !s.new }))}
            />
            <div className="mt-2 px-[14px] py-3 border border-[#e3eaf3] rounded-[9px] bg-[#f8fafd]">
              <div className="text-[#34445d] text-[10px] font-bold mb-[9px]">Password must contain:</div>
              <div className="flex flex-wrap gap-x-[17px] gap-y-[7px]">
                {REQS.map((r) => {
                  const ok = r.test(newPassword);
                  return (
                    <span key={r.id} className={`text-[9px] flex items-center gap-1 ${ok ? 'text-[#18a875]' : 'text-[#8795aa]'}`}>
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: ok ? '#18a875' : '#c8d2df' }} />{r.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-[17px]">
            <PasswordField
              id="modal-pw-confirm"
              label="Confirm New Password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showPw.confirm}
              onToggle={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
            />
            {confirmPassword && !passwordsMatch && (
              <div className="mt-[6px] text-[#d84d4d] text-[10px]">Passwords do not match.</div>
            )}
          </div>

          <div className="flex gap-[10px] mt-[23px]">
            <button type="button" onClick={closeAll} className="w-[40%] h-[47px] rounded-[9px] border border-[#c7d2e1] bg-white text-[#263750] text-[12px] font-bold cursor-pointer transition-all hover:bg-[#f6f8fb]">Cancel</button>
            <button
              type="button"
              onClick={submitPassword}
              disabled={!validNew || saving}
              className="flex-1 h-[47px] rounded-[9px] border border-[#1769ff] bg-[#1769ff] text-white text-[12px] font-bold cursor-pointer transition-all shadow-[0_4px_12px_rgba(23,105,255,0.18)] hover:bg-[#1058d8] disabled:bg-[#b7cdf5] disabled:border-[#b7cdf5] disabled:shadow-none disabled:cursor-not-allowed"
            >
              {saving ? 'Sending code...' : 'Continue'}
            </button>
          </div>
        </div>

        <div className="min-h-[50px] border-t border-[#e9eef5] bg-[#fafbfd] flex items-center justify-center text-[#8491a5] text-[10px]">🛡 Your password is securely managed by XEVERA.</div>
      </div>
    </div>
  );
}
