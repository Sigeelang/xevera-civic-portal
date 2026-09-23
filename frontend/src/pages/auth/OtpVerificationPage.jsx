import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import AuthPageLayout, { AUTH_CARD } from '../../components/auth/AuthPageLayout';

function maskEmail(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  return (name.length <= 2 ? name.charAt(0) + '***' : name.substring(0, 2) + '***') + '@' + parts[1];
}

const DIGITS = Array.from({ length: 6 });

function SecureBadge() {
  return (
    <div className="inline-flex items-center gap-[9px] px-[22px] py-3 rounded-[30px] bg-[#EAF2FF] text-[#1263F4] text-base font-bold mb-[26px] max-sm:text-[14px] max-sm:px-[17px] max-sm:py-2.5">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L19 6V11.5C19 16.5 16.1 20.3 12 22C7.9 20.3 5 16.5 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth={2} />
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      SECURE PORTAL
    </div>
  );
}

export { SecureBadge };

export default function OtpVerificationPage({
  email,
  purpose = 'resident_password_reset',
  onVerified,
  onLogin,
  onVerify,
  backLabel = 'Back to Login',
  bare = false,
}) {
  const toast = useToast();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState('');
  const [remaining, setRemaining] = useState(60);
  /* Must match the server-side OTP TTL (300s / 5 minutes). */
  const [expiresIn, setExpiresIn] = useState(300);
  const [resendHint, setResendHint] = useState('');
  const inputsRef = useRef([]);
  const code = digits.join('');

  useEffect(() => {
    if (inputsRef.current[0]) inputsRef.current[0].focus();
  }, []);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  useEffect(() => {
    if (expiresIn <= 0) return undefined;
    const t = setInterval(() => setExpiresIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expiresIn]);

  /*
   * Translate any error from the API into one of the four user-facing
   * categories the rest of the UI consumes. Never show a raw "Something
   * went wrong" - the spec for this page demands specific copy per case.
   */
  function classifyError(message) {
    const m = String(message || '').toLowerCase();
    if (m.includes('expired')) return 'expired';
    if (m.includes('too many') || m.includes('wait') && m.includes('minutes')) return 'rate';
    if (m.includes('invalid') || m.includes('incorrect') || m.includes('wrong') || m.includes('please check')) return 'invalid';
    if (m.includes('unable to send') || m.includes('send') || m.includes('mail')) return 'send';
    return 'unknown';
  }

  function friendlyError(kind, original) {
    switch (kind) {
      case 'expired':
        return 'Your verification code has expired. Please request a new code.';
      case 'rate':
        return 'Too many verification codes were requested. Please wait a few minutes before requesting another code.';
      case 'invalid':
        return 'Invalid verification code. Please check the latest email and try again.';
      case 'send':
        return 'We could not deliver the verification email just now. Please tap Resend in a moment, or check Spam / Promotions / All Mail.';
      default:
        return original || 'We could not verify the code. Please try again.';
    }
  }

  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '');
    setError('');
    setErrorKind('');
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? '' : v)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[index] = clean.slice(-1);
      return next;
    });
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
    setErrorKind('');
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function verify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError('');
    setErrorKind('');
    try {
      /* onVerify: custom handler (e.g. login 2FA -> creates the session) */
      const data = onVerify
        ? await onVerify(code)
        : await apiFetch('auth/verify-otp.php', { method: 'POST', body: { email, otp: code, purpose } });
      if (data?.success || data?.token) {
        onVerified && onVerified(data);
      } else {
        const kind = classifyError(data?.error || data?.message);
        setErrorKind(kind);
        setError(friendlyError(kind, data?.error || data?.message));
        setDigits(Array(6).fill(''));
        inputsRef.current[0]?.focus();
      }
    } catch (err) {
      const kind = classifyError(err.message);
      setErrorKind(kind);
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
    setErrorKind('');
    setResendHint('');
    try {
      const data = await apiFetch('auth/resend-otp.php', { method: 'POST', body: { email, purpose } });
      if (data?.success) {
        // Clear any prior code the user might have been typing
        setDigits(Array(6).fill(''));
        setRemaining(60);
        // Resent codes live 600s server-side (resend-otp.php).
        setExpiresIn(600);
        setResendHint('A new verification code has been sent. Your previous code is no longer valid.');
        toast('A new verification code has been sent. Your previous code is no longer valid.');
        inputsRef.current[0]?.focus();
      } else {
        const kind = classifyError(data?.error || data?.message);
        setErrorKind(kind);
        setError(friendlyError(kind, data?.error || data?.message));
      }
    } catch (err) {
      const kind = classifyError(err.message);
      setErrorKind(kind);
      setError(friendlyError(kind, err.message));
    } finally {
      setResending(false);
    }
  }

  const fmt = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const expFmt = `${String(Math.floor(expiresIn / 60)).padStart(2, '0')}:${String(expiresIn % 60).padStart(2, '0')}`;
  const codeExpired = expiresIn === 0;
  const isRegisterFlow = purpose === 'resident_register';

  const card = (
    <section className={AUTH_CARD}>
        <SecureBadge />

        <h1 className="text-[34px] max-sm:text-[25px] leading-[1.2] font-bold text-[#09285F] mb-[15px]">Enter Verification Code</h1>

        <p className="text-[#64789D] text-[17px] max-sm:text-[15px] leading-[1.6]">
          We sent a 6-digit verification code to
          <span className="block mt-0.5 text-[#0562F4] text-[20px] max-sm:text-[17px] font-bold">{maskEmail(email)}</span>
          <span className="block mt-1 text-[#4A607A] text-[12.5px] max-sm:text-[12px]">
            Check your Inbox — and Spam, Promotions, or All Mail if you don&apos;t see it.
          </span>
        </p>

        <div className="mt-[34px] mb-3 text-lg font-semibold text-[#09285F] max-sm:text-base">Enter the 6-digit code</div>

        {/* OTP inputs */}
        <div className={`flex justify-center gap-[18px] max-md:gap-2.5 max-sm:gap-[7px] ${codeExpired ? 'opacity-55' : ''}`} onPaste={onPaste}>
          {DIGITS.map((_, i) => (
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
              className={`w-16 h-[70px] max-md:w-[54px] max-md:h-[62px] max-sm:w-[45px] max-sm:h-[55px] max-sm:text-[23px] rounded-[10px] bg-white text-center text-[28px] font-bold text-[#09285F] outline-none transition-all duration-200 hover:border-[#9EBDF5] focus:border-[#1163F3] focus:shadow-[0_0_0_3px_rgba(20,101,245,0.08)] ${digits[i] ? 'border-[#6DA1FA] bg-[#F8FBFF]' : 'border-2 border-[#D8E3F5]'}`}
            />
          ))}
        </div>

        {/* Code expiration countdown */}
        <div className="mt-3 text-center text-[12.5px] max-sm:text-[12px] text-[#6B7C95]">
          {codeExpired
            ? <span className="text-[#B91C1C] font-bold">This code has expired. Tap Resend code below.</span>
            : <>Code expires in <strong className="text-[#1263F4]">{expFmt}</strong></>}
        </div>

        {/* Inline error state */}
        {error && (
          <div className="mt-[27px] px-5 py-[15px] flex items-start gap-3 text-left rounded-[11px] bg-[#FDECEC] border border-[#F5C7C7] text-[#B91C1C] text-base max-sm:text-[14px] max-sm:p-3">
            <span className="min-w-[22px] mt-0.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              {error}
              {errorKind === 'invalid' && (
                <span className="block mt-1 text-[12.5px] text-[#8B1F1F]">
                  Use the <strong>most recent</strong> code in your inbox — older codes are no longer valid.
                </span>
              )}
              {errorKind === 'send' && (
                <span className="block mt-1 text-[12.5px] text-[#8B1F1F]">
                  Tap Resend code below, or check Spam / Promotions / All Mail.
                </span>
              )}
            </span>
          </div>
        )}

        {/* Resend */}
        <div className="mt-[27px] text-base text-[#64789D] max-sm:text-[14px]">
          Didn&apos;t receive the code?
          <button type="button" onClick={resend} disabled={remaining > 0 || resending}
            className="ml-1 border-none bg-transparent text-[#0562F4] font-bold text-base cursor-pointer max-sm:text-[14px] enabled:hover:underline disabled:opacity-55 disabled:cursor-not-allowed">
            {remaining > 0 ? `Resend in ${fmt}` : resending ? 'Sending...' : 'Resend code'}
          </button>
        </div>

        {/* Friendly notice on a successful resend (tells the user the old code is now dead) */}
        {resendHint && (
          <div className="mt-3 px-4 py-3 text-left rounded-[10px] bg-[#ECFDF3] border border-[#BBE5C5] text-[#126C3D] text-[13px] max-sm:text-[12.5px]">
            {resendHint}
          </div>
        )}

        {/* "Didn't receive the email?" guidance panel */}
        <div className="mt-[22px] min-h-[61px] px-5 py-[15px] flex items-start gap-4 text-left rounded-[11px] bg-[#EAF2FF] text-[#536B93] text-base max-sm:text-[14px] max-sm:p-3">
          <span className="min-w-[25px] mt-0.5 text-[#1263F4]">
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3L19 6V11.5C19 16.5 16.1 20.3 12 22C7.9 20.3 5 16.5 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth={2} />
              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[#3F5478] text-[13.5px] max-sm:text-[12.5px] leading-[1.55]">
            <strong className="block text-[#0E2C5C] mb-1 text-[14px] max-sm:text-[13px]">Didn&apos;t receive the email?</strong>
            Check <strong>Spam</strong>, <strong>Promotions</strong>, and <strong>All Mail</strong>.
            Confirm the email above matches the inbox you&apos;re checking.
            Wait a few minutes for delivery, then use <strong>Resend code</strong> after the cooldown.
          </span>
        </div>

        {/* Verify */}
        <button type="button" onClick={verify} disabled={code.length !== 6 || verifying || codeExpired}
          className="w-full h-16 max-sm:h-[58px] mt-[27px] rounded-[11px] border-none text-white text-[19px] max-sm:text-[17px] font-bold cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(20,101,245,0.28)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:translate-y-0"
          style={{ background: 'linear-gradient(135deg,#1163F3,#0C5BEA)', boxShadow: '0 12px 25px rgba(20,101,245,0.22)' }}>
          {verifying ? 'Verifying...' : isRegisterFlow ? 'Continue' : (<>Verify Code <span className="text-[25px] -mb-0.5">→</span></>)}
        </button>

        {/* Back / Cancel */}
        <button type="button" onClick={() => onLogin && onLogin()}
          className="mt-[25px] bg-transparent border-none text-[#0562F4] text-[17px] max-sm:text-[15px] font-bold cursor-pointer hover:underline">
          {backLabel}
        </button>
      </section>
  );

  return bare ? card : <AuthPageLayout>{card}</AuthPageLayout>;
}
