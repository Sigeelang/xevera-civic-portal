import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import OtpVerificationPage from '../auth/OtpVerificationPage';
import { useAuth } from '../../context/AuthContext';

const RULES = [
  { key: 'len',   label: 'At least 8 characters',  test: (p) => p.length >= 8 },
  { key: 'upper', label: 'Uppercase letter',       test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Lowercase letter',       test: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: 'Number',                  test: (p) => /[0-9]/.test(p) },
  { key: 'spec',  label: 'Special character',      test: (p) => /[^A-Za-z0-9]/.test(p) },
  { key: 'match', label: 'New passwords match',    test: (p, c) => p.length > 0 && p === c },
];

function Check({ on }) {
  return on ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1EA85B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg>
  );
}

function Step1Form({ user, form, setForm, show, setShow, checks, allPass, msg, setMsg, saving, sendOtp, otp, currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, confirmMatch, setConfirmMatch }) {
  return (
    <div className="space-y-4">
      <Field
        name="current"
        label="Current Password"
        placeholder="Enter your current password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        show={show.current}
        onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
        err={msg.current}
      />
      <Field
        name="next"
        label="New Password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        show={show.next}
        onToggle={() => setShow((s) => ({ ...s, next: !s.next }))}
      />
      <Field
        name="confirm"
        label="Confirm New Password"
        placeholder="Re-enter the new password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        show={show.confirm}
        onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
        ok={confirmMatch && confirmPassword.length > 0}
        hint={confirmPassword ? (confirmMatch ? '✓ Passwords match' : 'Passwords do not match') : ''}
      />
      <button
        type="button"
        onClick={sendOtp}
        disabled={saving || !allPass}
        className="mt-5 w-full px-4 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {saving ? 'Sending code...' : 'Continue'}
      </button>
    </div>
  );
}

function Field({ name, label, placeholder, autoComplete, value, onChange, show, onToggle, err, ok, hint }) {
  return (
    <div>
      <label className="block text-xs font-bold text-navy-950 mb-1.5" htmlFor={`pw-${name}`}>{label}</label>
      <div className="relative">
        <input
          id={`pw-${name}`}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-3.5 pr-10 py-2.5 border border-[#DFE6EF] rounded-xl text-sm bg-white text-navy-950 focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-[#6B7280] hover:text-xevera-600 hover:bg-xevera-50 transition-colors cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {show ? (
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
        </button>
      </div>
      {err && <div className="mt-1.5 text-[10px] text-[#E53935] font-semibold">{err}</div>}
      {hint && !err && <div className={`mt-1.5 text-[10px] font-semibold ${ok ? 'text-[#159C59]' : 'text-[#E53935]'}`}>{hint}</div>}
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

  const form = {
    current: currentPassword,
    next: newPassword,
    confirm: confirmPassword,
  };
  const setForm = (next) => {
    setCurrentPassword(next.current);
    setNewPassword(next.next);
    setConfirmPassword(next.confirm);
  };

  // OTP step -> full-screen OTP page (resend-otp / verify-otp, purpose=password_change)
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
      <div className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6 sm:p-8 text-center max-w-[460px] mx-auto">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#EAF9EF] text-[#159C59] grid place-items-center text-[28px] mb-3">✓</div>
        <h2 className="text-[20px] font-head font-extrabold text-navy-950">Password updated</h2>
        <p className="mt-1.5 text-[12px] text-[#6B7280]">Redirecting you to sign in again with your new password.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
      <form
        onSubmit={(e) => { e.preventDefault(); sendOtp(); }}
        className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6"
      >
        <h2 className="text-[16px] font-head font-extrabold text-navy-950 mb-1.5">Change Password</h2>
        <p className="text-[12.5px] text-[#6B7280] mb-5">Enter your current password. We'll email a verification code to confirm the change.</p>
        <Step1Form
          user={user}
          form={form}
          setForm={setForm}
          show={show}
          setShow={setShow}
          checks={checks}
          allPass={allPass}
          msg={msg}
          setMsg={setMsg}
          saving={saving}
          sendOtp={sendOtp}
          otp={otpStep}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          confirmMatch={confirmMatch}
          setConfirmMatch={() => {}}
        />
      </form>

      <aside className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6">
        <h2 className="text-[16px] font-head font-extrabold text-navy-950 mb-1.5">Password Requirements</h2>
        <p className="text-[12.5px] text-[#6B7280] mb-4">Your new password must satisfy all of the following.</p>
        <ul className="space-y-2.5">
          {checks.map((c) => (
            <li key={c.key} className={`flex items-center gap-2.5 text-[13px] ${c.on ? 'text-navy-950' : 'text-[#6B7280]'}`}>
              <Check on={c.on} />
              <span className={c.on ? 'font-bold' : 'font-semibold'}>{c.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 px-4 py-3 rounded-xl bg-xevera-50 border border-xevera-100 flex items-start gap-2.5">
          <Icon name="shield" size={15} className="text-xevera-700 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-xevera-700 leading-relaxed">
            After the code is verified, your password is updated and a confirmation email is sent to your registered address. The new password is never sent over email.
          </p>
        </div>
      </aside>
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
