import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';

/*
 * Staff 2FA verification screen (prototype-matched) shown after the
 * management login password step when the backend requires an OTP.
 *
 * Real flow only (no demo code):
 *   verify -> onVerify(code) [auth/verify-login-otp.php + session]
 *   resend -> auth/resend-otp.php { email, purpose: 'login_2fa' }
 */

function ShieldLogo() {
  return (
    <svg className="w-[62px] h-[70px] max-sm:scale-[0.8]" viewBox="0 0 62 70" fill="none" aria-hidden="true">
      <path d="M31 3 56 12v22c0 14-8 24-25 33C14 58 6 48 6 34V12L31 3Z" stroke="#1769ed" strokeWidth="5" strokeLinejoin="round" />
      <path d="m22 35 7 7 14-15" stroke="#1769ed" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StaffOtpPage({ email, onVerify, onVerified, onBack }) {
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(null); // {type:'error'|'success', text}
  const [remaining, setRemaining] = useState(60);
  const inputsRef = useRef([]);
  const code = digits.join('');

  useEffect(() => {
    try { inputsRef.current[0]?.focus(); } catch {}
  }, []);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '');
    setMessage(null);
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
      try { inputsRef.current[index + 1]?.focus(); } catch {}
    }
  }

  function onKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      try { inputsRef.current[index - 1]?.focus(); } catch {}
      setDigits((d) => d.map((v, i) => (i === index - 1 ? '' : v)));
    }
  }

  function onPaste(e) {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').substring(0, 6);
    if (!pasted) return;
    setDigits((d) => pasted.split('').map((c, i) => c || d[i]));
    setMessage(null);
    try { inputsRef.current[Math.min(pasted.length, 5)]?.focus(); } catch {}
  }

  async function verify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setMessage(null);
    try {
      const data = onVerify
        ? await onVerify(code)
        : await apiFetch('auth/verify-login-otp.php', { method: 'POST', body: { otp: code } });
      if (data?.success || data?.token) {
        setMessage({ type: 'success', text: 'Verification successful. Redirecting...' });
        onVerified && onVerified(data);
      } else {
        throw new Error(data?.error || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Invalid verification code. Please try again.' });
      setDigits(Array(6).fill(''));
      try { inputsRef.current[0]?.focus(); } catch {}
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (remaining > 0 || resending) return;
    setResending(true);
    setMessage(null);
    try {
      const data = await apiFetch('auth/resend-otp.php', { method: 'POST', body: { email, purpose: 'login_2fa' } });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Could not resend the verification code.');
      }
      setDigits(Array(6).fill(''));
      setRemaining(60);
      setMessage({ type: 'success', text: 'A new verification code has been sent to your email.' });
      try { inputsRef.current[0]?.focus(); } catch {}
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not resend the verification code.' });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex justify-center items-center overflow-x-hidden relative px-[25px] py-7"
      style={{ background: 'radial-gradient(circle at -5% 10%, rgba(37,112,242,0.08) 0, transparent 22%), radial-gradient(circle at 105% 90%, rgba(37,112,242,0.08) 0, transparent 25%), #f8fbff' }}>
      <div className="w-full max-w-[760px] relative z-[2]">
        <div className="text-center mb-7">
          <div className="flex items-center justify-center gap-4">
            <ShieldLogo />
            <div className="text-left">
              <h1 className="text-[#183c68] text-[48px] max-sm:text-[34px] font-extrabold tracking-[4px] leading-none">XEVERA</h1>
              <p className="text-[#1769ed] text-[17px] max-sm:text-[11px] font-extrabold tracking-[5px] max-sm:tracking-[3px] mt-[9px]">CIVIC REPORTING SYSTEM</p>
            </div>
          </div>
        </div>

        <div className="bg-[rgba(255,255,255,0.97)] border border-[#d2e0f2] rounded-[25px] px-[50px] max-sm:px-[22px] py-9 max-sm:py-[30px] shadow-[0_15px_45px_rgba(38,91,150,0.08)]">
          <div className="w-[74px] h-[74px] rounded-full bg-[#1769ed] mx-auto mb-[23px] flex items-center justify-center shadow-[0_12px_25px_rgba(23,105,237,0.18)]">
            <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <div className="text-center text-[#1769ed] text-[16px] font-extrabold mb-[22px]">🛡 SECURE VERIFICATION</div>
          <h2 className="text-center text-[36px] max-sm:text-[29px] font-normal text-[#183c68] mb-[10px]">Verify Your Identity</h2>
          <p className="text-center text-[#7890b2] text-[17px] max-sm:text-[14px] leading-[1.6] mb-[25px]">
            Enter the 6-digit verification code sent to your registered staff email address.
          </p>

          <div className="flex items-center gap-[10px] mb-7">
            <span className="h-px flex-1 bg-[#d1ddeb]" />
            <span className="w-[10px] h-[10px] rounded-full bg-[#1769ed]" />
            <span className="h-px flex-1 bg-[#d1ddeb]" />
          </div>

          <div className="bg-[#f5f9ff] border border-[#dbe7f5] rounded-[12px] p-[15px_18px] flex items-center gap-[13px] mb-[25px]">
            <span className="w-10 h-10 rounded-[10px] bg-[#e5efff] text-[#1769ed] grid place-items-center text-[19px] flex-shrink-0">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </span>
            <span className="min-w-0">
              <small className="block text-[#8195b1] text-[12px] mb-1">Verification code sent to</small>
              <strong className="block text-[#183c68] text-[14px] break-all">{email}</strong>
            </span>
          </div>

          <label className="block text-[#183c68] font-bold text-[15px] mb-3">Verification Code</label>
          <div className="flex justify-center gap-3 max-sm:gap-[7px] mb-[22px]" onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1}`}
                className={`w-[58px] h-[65px] max-sm:w-[47px] max-sm:h-[56px] border rounded-[12px] bg-white text-center text-[25px] font-bold text-[#183c68] outline-none transition-all focus:border-[#1769ed] focus:shadow-[0_0_0_3px_rgba(23,105,237,0.10)] ${d ? 'border-[#1769ed] bg-[#f8fbff]' : 'border-[#cbdced]'}`}
                style={{ WebkitTextFillColor: '#183c68' }}
              />
            ))}
          </div>

          <div className="text-center text-[#8195b1] text-[14px] mb-[25px]">
            {remaining > 0 ? (
              <span>You can request a new code in <strong className="text-[#1769ed]">{remaining}</strong>s</span>
            ) : (
              <button type="button" onClick={resend} disabled={resending}
                className="border-none bg-transparent text-[#1769ed] text-[14px] font-bold cursor-pointer hover:underline disabled:opacity-55">
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>

          <button type="button" onClick={verify} disabled={code.length !== 6 || verifying}
            className="w-full h-16 rounded-[12px] border-0 bg-[#1769ed] text-white text-[18px] font-extrabold cursor-pointer shadow-[0_10px_25px_rgba(23,105,237,0.20)] transition-all hover:bg-[#0e5dd8] hover:-translate-y-[1px] disabled:bg-[#a9c7f5] disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
            {verifying ? 'Verifying...' : 'Verify & Continue →'}
          </button>

          {message && (
            <div className={`mt-[18px] p-3 rounded-[10px] text-center text-[14px] font-semibold ${message.type === 'error' ? 'bg-[#fff0f0] text-[#d93025] border border-[#ffd2d2]' : 'bg-[#eefbf3] text-[#198754] border border-[#c9efd7]'}`}>
              {message.text}
            </div>
          )}

          <div className="text-center mt-[23px]">
            <button type="button" onClick={() => onBack && onBack()}
              className="border-none bg-transparent text-[#7087a7] cursor-pointer text-[14px] hover:text-[#1769ed]">
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
