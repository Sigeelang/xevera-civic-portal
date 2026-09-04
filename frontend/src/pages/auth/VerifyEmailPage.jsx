import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';

function FieldIcon({ path, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const inputBase =
  'w-full pl-11 pr-11 py-3 rounded-xl border border-line bg-[#F8FAFC] text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition-all duration-300';

export default function VerifyEmailPage({ token, email, onLogin, onDone }) {
  const showToast = useToast();
  const [state, setState] = useState('loading'); // loading | verified | error
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState(email || '');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Missing verification token.');
      return;
    }
    apiFetch('auth/verify_email.php', { method: 'POST', body: { token } })
      .then((d) => {
        setState('verified');
        showToast(d.message || 'Email verified!');
        if (onDone) onDone();
      })
      .catch((err) => {
        setState('error');
        setError(err.message || 'Could not verify your email.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    const value = resendEmail.trim();
    if (!value) return;
    setResending(true);
    setError('');
    try {
      const data = await apiFetch('auth/resend_verification.php', { method: 'POST', body: { email: value } });
      showToast(data.message || 'Verification link sent.');
    } catch (err) {
      setError(err.message || 'Could not resend the link.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-mint">
      <div className="relative hidden md:flex flex-col justify-center px-10 lg:px-16 py-14 overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1E40AF 0%,#2563EB 70%,#3B82F6 100%)' }}>
        <svg className="absolute bottom-0 left-0 w-full h-40 text-white/10" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0,80 C240,140 480,30 720,70 C960,110 1200,20 1440,90 L1440,160 L0,160 Z" />
        </svg>

        <div className="relative z-10 max-w-[460px] animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm16 4-8 5-8-5" />
            </svg>
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/90">Email Verification</span>
          </span>

          <h1 className="text-4xl lg:text-[44px] font-head font-extrabold leading-[1.15] text-white">
            Confirm your
            <span className="block text-[#FBBF24] mt-1">email address</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80 max-w-[400px]">
            Verifying your email keeps the community secure and makes sure important updates reach you.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 lg:py-0 relative">
        <div className="w-full max-w-[480px] animate-rise" style={{ animationDelay: '120ms' }}>
          <div className="bg-white rounded-[24px] shadow-[0_24px_60px_rgba(16,24,40,0.12)] border border-line p-8 sm:p-10">
            {state === 'loading' && (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-[#DBEAFE] flex items-center justify-center mx-auto mb-5">
                  <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                  </svg>
                </div>
                <h2 className="text-[20px] font-head font-extrabold text-[#111827]">Verifying your email...</h2>
              </div>
            )}

            {state === 'verified' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-xevera-50 flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1258E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="text-[22px] font-head font-extrabold text-[#111827]">Email verified!</h2>
                <p className="text-[13px] text-[#6B7280] mt-2 mb-6">
                  Your email address has been confirmed. You can now access the full portal.
                </p>
                <button
                  type="button"
                  onClick={() => onLogin && onLogin()}
                  className="w-full py-3.5 rounded-[12px] bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white font-bold text-sm transition-all duration-300 hover:from-[#1D4ED8] hover:to-[#1E3A8A] hover:shadow-lg hover:shadow-[#2563EB]/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  Back to Log In
                </button>
              </div>
            )}

            {state === 'error' && (
              <>
                <div className="w-14 h-14 rounded-full bg-[#FEE2E2] flex items-center justify-center text-white shadow-lg mb-5">
                  <FieldIcon path="M12 9v4M12 17h.01" size={22} />
                </div>
                <h2 className="text-[22px] font-head font-extrabold text-[#111827]">Couldn't verify</h2>
                <p className="text-[13px] text-[#6B7280] mt-1 mb-6">{error || 'The verification link is invalid or has expired.'}</p>

                {error && (
                  <div className="bg-[#FEE2E2] text-[#DC2626] text-xs font-bold px-4 py-3 rounded-xl mb-4 border border-[#FECACA]">{error}</div>
                )}

                <form onSubmit={handleResend}>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-[#111827] mb-1.5">Email Address</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                        <FieldIcon path="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm16 4-8 5-8-5" />
                      </span>
                      <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" className={inputBase} />
                    </div>
                  </div>

                  <button type="submit" disabled={resending}
                    className="w-full py-3.5 rounded-[12px] bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white font-bold text-sm transition-all duration-300 hover:from-[#1D4ED8] hover:to-[#1E3A8A] hover:shadow-lg hover:shadow-[#2563EB]/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
                    {resending ? 'Sending...' : 'Resend Verification Link'}
                  </button>
                </form>

                <div className="text-[13px] text-[#6B7280] text-center mt-6">
                  <button onClick={() => onLogin && onLogin()} className="font-bold text-[#2563EB] hover:text-[#1E40AF] transition-colors bg-none border-none cursor-pointer">
                    Back to Log In
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-[11px] text-[#9CA3AF] mt-5">
            &copy; {new Date().getFullYear()} Xevera Portal. Authorized access only.
          </p>
        </div>
      </div>
    </div>
  );
}
