import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';
import OtpVerificationPage from '../../pages/auth/OtpVerificationPage';

const REQS = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'num', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function strengthInfo(p) {
  const score = REQS.filter((r) => r.test(p)).length;
  if (!p) return { score, label: 'Weak', color: '#e53935', bars: [] };
  let label = 'Weak';
  let color = '#e53935';
  if (score <= 2) { label = 'Weak'; color = '#e53935'; }
  else if (score <= 4) { label = 'Good'; color = '#f59e0b'; }
  else { label = 'Strong'; color = '#159c59'; }
  return { score, label, color };
}

function ReqItem({ ok, label }) {
  return (
    <div className={`flex items-center gap-1.5 text-[9px] ${ok ? 'text-[#159c59]' : 'text-[#8995A7]'}`}>
      <span className={`w-3.5 h-3.5 rounded-full grid place-items-center text-[8px] flex-shrink-0 ${ok ? 'bg-[#eaf9f1]' : 'bg-[#e9eef5]'}`}>✓</span>
      {label}
    </div>
  );
}

export default function ResidentChangePasswordModal({ open, email, onClose, onChanged }) {
  const toast = useToast();
  // Step 1: current + new + confirm | Step 2: OTP | Step 3: applied
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [msg, setMsg] = useState({ current: '', confirm: '' });
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [completing, setCompleting] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      setShow({ current: false, new: false, confirm: false });
      setMsg({ current: '', confirm: '' });
      setSuccess(false);
      setOtpStep(false);
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

  if (!open) return null;

  const { new_password, current_password } = form;
  const st = strengthInfo(new_password);
  const validPassword = REQS.every((r) => r.test(new_password));
  const validNew = validPassword && new_password === confirm_password && new_password.length > 0;

  function toggleField(field) {
    setShow((s) => ({ ...s, [field]: !s[field] }));
  }

  function onConfirmChange(v) {
    setForm((f) => ({ ...f, confirm_password: v }));
    if (!v) { setMsg((m) => ({ ...m, confirm: '' })); return; }
    setMsg((m) => ({ ...m, confirm: v === form.new_password ? '✓ Passwords match.' : 'Passwords do not match.' }));
  }

  /*
   * Step 1 -> Step 2: validate the passwords and email a `password_change`
   * OTP to the resident's verified Gmail. The DB row is never touched
   * here - the password is only updated after the OTP has been
   * verified AND apply() is called.
   */
  async function submit(e) {
    e.preventDefault();
    setSuccess(false);
    if (!current_password) {
      setMsg((m) => ({ ...m, current: 'Please enter your current password.' }));
      return;
    }
    if (!validNew) {
      toast('Please create a password that meets all requirements and matches the confirmation.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch('profile/password_change_init.php', {
        method: 'POST',
        body: {
          current_password: form.current_password,
          new_password: form.new_password,
          confirm_password: form.confirm_password,
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

  /*
   * Step 2 -> Step 3: OTP verified -> apply new password server-side.
   */
  async function completeChange() {
    if (completing) return;
    setCompleting(true);
    try {
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: form.new_password, confirm_password: form.confirm_password },
      });
      setSuccess(true);
      toast('Password changed successfully.');
      onChanged && onChanged();
      setTimeout(() => { onClose && onClose(); }, 1800);
    } catch (err) {
      toast(err.message || 'Could not change password.', 'error');
    } finally {
      setCompleting(false);
    }
  }

  /*
   * After "Continue" succeeds, show the EXISTING full-screen OTP
   * verification page (same one used for registration and password
   * reset). Resend reuses resend-otp.php; verification reuses
   * verify-otp.php with purpose=password_change.
   */
  if (otpStep) {
    return (
      <OtpVerificationPage
        email={email}
        purpose="password_change"
        onVerified={completeChange}
        onLogin={() => setOtpStep(false)}
      />
    );
  }

  const inputCls = 'w-full h-[48px] border border-[#D7E0EC] rounded-[11px] px-3.5 text-[12px] text-[#102044] bg-white outline-none transition-colors focus:border-[#145BEA] focus:shadow-[0_0_0_3px_rgba(20,91,234,0.09)] placeholder:text-[#A1ACBC]';
  const toggleBtn = 'absolute right-2.5 top-1/2 -translate-y-1/2 w-[34px] h-[34px] border-none bg-transparent text-[#7B899F] rounded-[8px] cursor-pointer hover:bg-[#F2F5F9] hover:text-[#145BEA] text-[16px]';

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px] overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) onClose && onClose(); }}>
      <div className="w-full max-w-[620px] bg-white rounded-[22px] shadow-[0_25px_70px_rgba(18,35,65,0.22)] overflow-hidden my-2 animate-[modalRise_220ms_ease]">
        {/* Header */}
        <div className="relative pt-7 pb-5 px-8 sm:px-9 text-center">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-5 w-9 h-9 rounded-[10px] bg-[#F3F6FA] text-[#69778D] text-[22px] leading-none hover:bg-[#E8EDF4] hover:text-[#102044] transition-colors cursor-pointer">×</button>
          <div className="w-[62px] h-[62px] mx-auto mb-3.5 rounded-full bg-[#EDF4FF] text-[#145BEA] grid place-items-center text-[28px] shadow-[0_5px_15px_rgba(20,91,234,0.08)]">🔐</div>
          <h2 className="text-[24px] font-head font-extrabold text-[#102044] tracking-[-0.3px]">Change Password</h2>
          <p className="max-w-[430px] mx-auto mt-1.5 text-[13px] text-[#7B889D] leading-relaxed">Your password is securely managed by XEVERA. Set a new one below.</p>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-9 pb-8">
          {/* Account box */}
          <div className="flex items-center gap-3.5 p-3.5 border border-[#DFE6F0] rounded-[13px] mb-4 bg-white">
            <div className="w-[44px] h-[44px] rounded-[12px] bg-[#EDF4FF] text-[#145BEA] grid place-items-center font-black text-[19px] flex-shrink-0">◆</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-extrabold text-[#102044]">Signed in with XEVERA</div>
              <div className="text-[11px] text-[#7B889D] mt-1 truncate">{email || '—'}</div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[20px] bg-[#EAF9F1] text-[#159C59] text-[9px] font-extrabold whitespace-nowrap flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />Connected
            </span>
          </div>

          {/* Security notice */}
          <div className="flex gap-3 p-4 mb-4 rounded-[13px] bg-[#F2F7FF] border border-[#D5E4FF]">
            <span className="w-9 h-9 rounded-[10px] bg-white text-[#159C59] grid place-items-center text-[17px] flex-shrink-0">✓</span>
            <div className="flex-1">
              <div className="text-[12px] font-extrabold text-[#154A98] mb-1">Password managed by XEVERA</div>
              <div className="text-[10px] text-[#637695] leading-relaxed">XEVERA stores your password as a secure hash and never displays it. Use the form below to update it.</div>
            </div>
          </div>

          {/* Account status */}
          <div className="border border-[#DFE6F0] rounded-[13px] overflow-hidden mb-6 text-[10px]">
            {[
              ['Account', email || '—', ''],
              ['Password', 'Securely hashed', ''],
              ['Security', '✓ Protected', 'text-[#159C59]'],
            ].map(([label, value, extra]) => (
              <div key={label} className="min-h-[45px] px-4 flex items-center justify-between border-b border-[#EDF0F5] last:border-b-0">
                <span className="text-[#8490A4]">{label}</span>
                <strong className={`text-[#263653] font-extrabold truncate ml-4 ${extra || ''}`}>{value}</strong>
              </div>
            ))}
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            {/* Current */}
            <div>
              <label className="block text-[11px] font-extrabold text-[#102044] mb-1.5">Current Password</label>
              <div className="relative">
                <input type={show.current ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your current password" value={form.current_password}
                  onChange={(e) => { setForm((f) => ({ ...f, current_password: e.target.value })); setMsg((m) => ({ ...m, current: '' })); }} className={inputCls} />
                <button type="button" onClick={() => toggleField('current')} aria-label="Show current password" className={toggleBtn}>◉</button>
              </div>
              {msg.current && <div className="mt-1.5 text-[9px] text-[#E53935]">{msg.current}</div>}
            </div>

            {/* New */}
            <div>
              <label className="block text-[11px] font-extrabold text-[#102044] mb-1.5">New Password</label>
              <div className="relative">
                <input type={show.new ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter your new password" value={form.new_password}
                  onChange={(e) => { setForm((f) => ({ ...f, new_password: e.target.value })); if (form.confirm_password) onConfirmChange(form.confirm_password); }} className={inputCls} />
                <button type="button" onClick={() => toggleField('new')} aria-label="Show new password" className={toggleBtn}>◉</button>
              </div>

              {/* Strength */}
              {new_password && (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-[#7B889D]">Password strength</span>
                    <span className="text-[9px] font-extrabold" style={{ color: st.color }}>{st.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-1 rounded-[10px]" style={{ background: i <= Math.min(st.score, 4) ? st.color : '#E3E8EF' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements */}
              <div className="mt-2.5 p-3 bg-[#F8FAFC] border border-[#E8EDF3] rounded-[10px]">
                <div className="text-[9px] font-extrabold text-[#69778D] mb-1.5">Password must contain:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {REQS.map((r) => <ReqItem key={r.id} ok={r.test(new_password)} label={r.label} />)}
                </div>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-[11px] font-extrabold text-[#102044] mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input type={show.confirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your new password" value={form.confirm_password}
                  onChange={(e) => onConfirmChange(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => toggleField('confirm')} aria-label="Show confirm password" className={toggleBtn}>◉</button>
              </div>
              {msg.confirm && <div className={`mt-1.5 text-[9px] ${msg.confirm.includes('✓') ? 'text-[#159C59]' : 'text-[#E53935]'}`}>{msg.confirm}</div>}
            </div>

            {/* Success */}
            {success && (
              <div className="p-3.5 rounded-[11px] bg-[#EAF9F1] border border-[#C8ECD9] text-[#167C4B] text-[10px] leading-relaxed">
                ✓ Password updated successfully. You can now use your new password the next time you sign in.
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.45fr] gap-2.5 pt-2">
              <button type="button" onClick={onClose} className="h-[46px] rounded-[10px] bg-white text-[#526077] text-[11px] font-extrabold border border-[#DCE3ED] hover:bg-[#F5F7FA] transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving} className="h-[46px] rounded-[10px] bg-[#145BEA] text-white text-[11px] font-extrabold border border-[#145BEA] hover:bg-[#0B48C9] disabled:opacity-55 disabled:cursor-not-allowed transition-colors cursor-pointer">
                {saving ? 'Sending code...' : (<><span>Continue</span> <span className="ml-2">→</span></>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}