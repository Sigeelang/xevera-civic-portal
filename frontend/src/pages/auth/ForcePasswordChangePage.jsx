import { useState, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import OtpVerificationPage from './OtpVerificationPage';

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

export default function ForcePasswordChangePage({ userName, onDone, onLogout }) {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('form');
  const [attempted, setAttempted] = useState(false);

  const reqsOk = useMemo(() => PW_REQS.map((r) => r.test(newPassword)), [newPassword]);
  const allReqsMet = reqsOk.every(Boolean);
  const matches = confirmPassword.length > 0 && confirmPassword === newPassword;
  const canSubmit = allReqsMet && matches && !saving && step === 'form';

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

  async function sendOtp() {
    setAttempted(true);
    if (!validate()) return;
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch('profile/password_change_init.php', {
        method: 'POST',
        body: {
          current_password: '',
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Could not send the verification code.');
    } finally {
      setSaving(false);
    }
  }

  async function applyChange() {
    setSaving(true);
    try {
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      setStep('done');
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'otp') {
    return (
      <OtpVerificationPage
        email={user?.email}
        purpose="password_change_first_login"
        onVerified={() => applyChange()}
        onLogin={() => setStep('form')}
      />
    );
  }

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
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1769ED]">🔒 First Login</span>
          <h1 className="mt-2 text-[22px] sm:text-[24px] font-extrabold text-[#11275A]">Set Your New Password</h1>
          <p className="mt-1.5 text-[13px] text-[#61769B]">For your security, you must create a new password before continuing. A verification code will be sent to your registered email.{userName ? ` Signed in as ${userName}.` : ''}</p>

          {error && <div className="mt-4 px-3 py-2.5 rounded-[10px] text-[13px] bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]">{error}</div>}

          <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="mt-5 space-y-4" noValidate>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#111827]">New Password *</label>
              <div className="relative">
                <input
                  type={show.next ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (attempted) setError('');
                  }}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className={inputCls}
                />
                <button type="button" onClick={() => setShow((s) => ({ ...s, next: !s.next }))} aria-label={show.next ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#63799F] hover:text-[#1769ED] cursor-pointer text-sm">
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
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (attempted) setError('');
                  }}
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  className={inputCls}
                />
                <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} aria-label={show.confirm ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#63799F] hover:text-[#1769ED] cursor-pointer text-sm">
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
              {saving ? 'Sending code...' : 'Send Verification Code'}
            </button>

            {onLogout && (
              <button type="button" onClick={onLogout} className="w-full h-[44px] rounded-xl bg-white border border-[#DBE4F2] text-[13px] font-bold text-[#5B6B85] hover:bg-[#F5F8FC] cursor-pointer">
                Sign out
              </button>
            )}
          </form>
        </div>

        <aside className="bg-white rounded-[18px] border border-[#E5E7EB] p-6">
          <h2 className="text-[14px] font-extrabold text-[#11275A]">Password Requirements</h2>
          <ul className="mt-3 space-y-2">
            {PW_REQS.map((r, i) => (
              <li key={r.key} className={`flex items-center gap-2 text-[12px] ${reqsOk[i] ? 'text-[#128A4C]' : 'text-[#4C638B]'}`}>
                <CheckIcon on={reqsOk[i]} />{r.label}
              </li>
            ))}
            <li className={`flex items-center gap-2 text-[12px] ${matches ? 'text-[#128A4C]' : 'text-[#4C638B]'}`}>
              <CheckIcon on={matches} />Passwords match
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
