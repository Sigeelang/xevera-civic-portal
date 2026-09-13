import { useState, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import OtpVerificationPage from '../auth/OtpVerificationPage';
import { useAuth } from '../../context/AuthContext';

const RULES = [
  { key: 'len',   label: '8+ characters',       test: (p) => p.length >= 8 },
  { key: 'upper', label: 'uppercase',            test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'lowercase',            test: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'number',               test: (p) => /[0-9]/.test(p) },
  { key: 'spec',  label: 'special character',    test: (p) => /[^A-Za-z0-9]/.test(p) },
  { key: 'match', label: 'passwords match',      test: (p, c) => p.length > 0 && p === c },
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

function Inner() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [msg, setMsg] = useState({ current: '' });
  const [saving, setSaving] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [done, setDone] = useState(false);

  const confirmMatch = confirmPassword.length > 0 && confirmPassword === newPassword;
  const checks = useMemo(() => RULES.map((r) => ({
    ...r,
    on: r.key === 'match' ? confirmMatch : r.test(newPassword, confirmPassword)
  })), [newPassword, confirmPassword, confirmMatch]);
  const allPass = checks.every((c) => c.on);

  async function sendOtp() {
    if (!currentPassword) { setMsg({ current: 'Please enter your current password.' }); return; }
    if (!allPass) { toast('Please satisfy all password requirements.', 'error'); return; }
    setSaving(true);
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
      setOtpStep(true);
    } catch (err) {
      toast(err.message || 'Could not send the verification code.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function applyChange() {
    try {
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: newPassword, confirm_password: confirmPassword },
      });
      setDone(true);
      toast('Password updated successfully.');
      setTimeout(() => { if (logout) logout('/login'); }, 1200);
    } catch (err) {
      toast(err.message || 'Could not change password.', 'error');
    }
  }

  if (otpStep) {
    return (
      <OtpVerificationPage
        email={user?.email}
        purpose="password_change"
        onVerified={applyChange}
        onLogin={() => setOtpStep(false)}
      />
    );
  }

  if (done) {
    return (
      <div className="max-w-[420px] mx-auto bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#ECFDF5] grid place-items-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h2 className="text-[18px] font-extrabold text-[#111827]">Password Updated</h2>
        <p className="mt-1.5 text-[13px] text-[#6B7280]">Redirecting you to sign in with your new password...</p>
      </div>
    );
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
              {(user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-[12.5px] text-[#374151] font-medium truncate max-w-[200px]">{user?.email || 'user@email.com'}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
            Connected
          </span>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="px-6 py-5 space-y-4">

          <PasswordField
            id="pw-current"
            label="Current Password"
            placeholder="Enter current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(v) => { setCurrentPassword(v); if (msg.current) setMsg({ current: '' }); }}
            visible={show.current}
            onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
            error={msg.current}
          />

          <PasswordField
            id="pw-new"
            label="New Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
            visible={show.next}
            onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
          />

          {/* Compact requirement hint */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 -mt-2">
            {RULES.filter(r => r.key !== 'match').map((r) => (
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
            onChange={setConfirmPassword}
            visible={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            error={confirmPassword && !confirmMatch ? 'Passwords do not match' : ''}
          />

          {confirmPassword && confirmMatch && (
            <div className="text-[11px] text-[#059669] font-semibold -mt-2">{'\u2713'} Passwords match</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !allPass || !currentPassword}
            className="w-full h-[48px] mt-1 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white text-[14px] font-bold shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:from-[#1D4ED8] hover:to-[#1E40AF] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" /></svg>
                Sending code...
              </span>
            ) : 'Update Password'}
          </button>
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

export default function ResidentChangePasswordPage({ onNavigate }) {
  return (
    <ResidentLayout activePage="change-password" pageTitle="Change Password" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Change Password"
        subtitle="Keep your account secure by rotating your password regularly."
      />
      <Inner />
    </ResidentLayout>
  );
}
