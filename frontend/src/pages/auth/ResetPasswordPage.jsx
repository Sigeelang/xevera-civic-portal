import { useState } from 'react';
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

export default function ResetPasswordPage({ token, onLogin }) {
  const showToast = useToast();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [pw, setPw] = useState({ new: '', confirm: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (pw.new.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (pw.new !== pw.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch('auth/reset.php', {
        method: 'POST',
        body: { token, new_password: pw.new, confirm_password: pw.confirm },
      });
      setDone(true);
      showToast('Password reset successfully!');
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
      setLoading(false);
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
              <path d="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/90">Secure Reset</span>
          </span>

          <h1 className="text-4xl lg:text-[44px] font-head font-extrabold leading-[1.15] text-white">
            Choose a new
            <span className="block text-[#FBBF24] mt-1">password</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/80 max-w-[400px]">
            Create a strong password you haven't used before to secure your account.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 lg:py-0 relative">
        <div className="w-full max-w-[480px] animate-rise" style={{ animationDelay: '120ms' }}>
          <div className="bg-white rounded-[24px] shadow-[0_24px_60px_rgba(16,24,40,0.12)] border border-line p-8 sm:p-10">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1E40AF] flex items-center justify-center text-white shadow-lg shadow-[#2563EB]/30 mb-5">
              <FieldIcon path="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 11V7a4 4 0 0 1 8 0v4" size={22} />
            </div>

            {done ? (
              <div>
                <h2 className="text-[22px] font-head font-extrabold text-[#111827]">Password updated!</h2>
                <p className="text-[13px] text-[#6B7280] mt-1 mb-6">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
                <button
                  type="button"
                  onClick={() => onLogin && onLogin()}
                  className="w-full py-3.5 rounded-[12px] bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white font-bold text-sm transition-all duration-300 hover:from-[#1D4ED8] hover:to-[#1E3A8A] hover:shadow-lg hover:shadow-[#2563EB]/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  Back to Log In
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[22px] font-head font-extrabold text-[#111827]">Set New Password</h2>
                <p className="text-[13px] text-[#6B7280] mt-1 mb-6">Your reset link is valid. Choose a new password.</p>

                {error && (
                  <div className="bg-[#FEE2E2] text-[#DC2626] text-xs font-bold px-4 py-3 rounded-xl mb-4 border border-[#FECACA]">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-1">
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-[#111827] mb-1.5">New Password</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                        <FieldIcon path="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 11V7a4 4 0 0 1 8 0v4" />
                      </span>
                      <input type={showPw ? 'text' : 'password'} value={pw.new} onChange={(e) => setPw(p => ({ ...p, new: e.target.value }))} required autoComplete="new-password" className={inputBase} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-[#111827] mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                        <FieldIcon path="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 11V7a4 4 0 0 1 8 0v4" />
                      </span>
                      <input type={showPw ? 'text' : 'password'} value={pw.confirm} onChange={(e) => setPw(p => ({ ...p, confirm: e.target.value }))} required autoComplete="new-password" className={inputBase} />
                    </div>
                  </div>

                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="text-[11px] font-bold text-[#2563EB] hover:text-[#1E40AF] bg-none border-none cursor-pointer mb-4">
                    {showPw ? 'Hide' : 'Show'} password
                  </button>

                  <div className="rounded-xl bg-[#F5F7FA] border border-line px-4 py-3 text-[11px] text-[#6B7280] mb-5">
                    Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-3.5 rounded-[12px] bg-gradient-to-r from-[#2563EB] to-[#1E40AF] text-white font-bold text-sm transition-all duration-300 hover:from-[#1D4ED8] hover:to-[#1E3A8A] hover:shadow-lg hover:shadow-[#2563EB]/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
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
