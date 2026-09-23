import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';
import { formatPhoneLive, normalizePhMobile } from '../../utils/phone';

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'SA';
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const PW_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const RESEND_SECS = 60;
const EXPIRY_SECS = 300;

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

function PwField({ id, label, value, onChange, visible, onToggle, placeholder }) {
  return (
    <div className="mb-[14px]">
      <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={id === 'staff-pw-current' ? 'current-password' : 'new-password'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          className="w-full h-10 border border-[#d5dfec] rounded-lg pl-3 pr-[45px] outline-none text-[12px] text-[#10213f] bg-white transition-all focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)] placeholder:text-[#98a5b7]"
          style={{ WebkitTextFillColor: '#10213f' }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-[9px] top-1/2 -translate-y-1/2 w-[34px] h-[34px] border-0 bg-transparent cursor-pointer text-[#71809a] flex items-center justify-center rounded-[7px] transition-all hover:text-[#1264e8] hover:bg-[#eef5ff] [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:stroke-current [&>svg]:fill-none"
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage({ onNavigate }) {
  const { user, updateUser, logout } = useAuth();
  const showToast = useToast();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', dob: '', gender: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  /* Edit profile modal */
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  /* Change password modal: 'closed' | 'password' | 'otp' */
  const [pwStep, setPwStep] = useState('closed');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwLenError, setPwLenError] = useState(false);
  const [pwMatchError, setPwMatchError] = useState(false);

  /* OTP state */
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendSecs, setResendSecs] = useState(RESEND_SECS);
  const [expirySecs, setExpirySecs] = useState(EXPIRY_SECS);
  const otpRefs = useRef([]);
  const timersRef = useRef({ resend: null, expiry: null });

  /* Sessions modal */
  const [sessionsOpen, setSessionsOpen] = useState(false);

  const loadProfile = useCallback(() => {
    setProfileError(false);
    setProfile(null);
    apiFetch('profile/get.php').then(d => {
      setProfile(d);
      setForm({
        name: d.name || '',
        email: d.email || '',
        phone: d.phone || '',
        dob: d.date_of_birth || '',
        gender: d.gender || '',
        address: d.address || '',
      });
    }).catch(() => setProfileError(true));
  }, []);

  const loadSessions = useCallback(() => {
    apiFetch('profile/history.php?limit=8').then(d => setSessions(Array.isArray(d?.items) ? d.items : [])).catch(() => setSessions([]));
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const anyModalOpen = editOpen || pwStep !== 'closed' || sessionsOpen;
  useEffect(() => {
    if (!anyModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { closePw(); setEditOpen(false); setSessionsOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModalOpen]);

  /* ---------- edit profile ---------- */
  function openEdit() {
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      dob: profile.date_of_birth || '',
      gender: profile.gender || '',
      address: profile.address || '',
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Please enter your full name.', 'error'); return; }
    if (!form.email.trim()) { showToast('Please enter your email address.', 'error'); return; }
    if (String(form.phone || '').trim() && !/^09\d{9}$/.test(String(form.phone).trim())) { showToast('Phone number must be 11 digits starting with 09.', 'error'); return; }
    setSaving(true);
    try {
      await apiFetch('profile/update.php', {
        method: 'POST',
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone, date_of_birth: form.dob, gender: form.gender, address: form.address },
      });
      showToast('Profile updated successfully.');
      if (updateUser) updateUser({ name: form.name.trim(), email: form.email.trim() });
      setProfile(p => ({ ...p, name: form.name.trim(), email: form.email.trim(), phone: form.phone, date_of_birth: form.dob, gender: form.gender, address: form.address }));
      setEditOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to update.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Please enter your full name.', 'error'); return; }
    if (!form.email.trim()) { showToast('Please enter your email address.', 'error'); return; }
    if (String(form.phone || '').trim() && !/^09\d{9}$/.test(String(form.phone).trim())) { showToast('Phone number must be 11 digits starting with 09.', 'error'); return; }
    setSavingEdit(true);
    try {
      await apiFetch('profile/update.php', {
        method: 'POST',
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone, date_of_birth: form.dob, gender: form.gender, address: form.address },
      });
      showToast('Profile updated successfully.');
      if (updateUser) updateUser({ name: form.name.trim(), email: form.email.trim() });
      setProfile(p => ({ ...p, name: form.name.trim(), email: form.email.trim(), phone: form.phone, date_of_birth: form.dob, gender: form.gender, address: form.address }));
      setEditOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to update.', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const d = await apiFetch('profile/photo.php', { method: 'POST', body: fd });
      showToast('Photo updated.');
      if (updateUser && d.profile_photo) updateUser({ profile_photo: d.profile_photo });
      setProfile(p => ({ ...p, profile_photo: d.profile_photo }));
    } catch (err) {
      showToast(err.message || 'Could not upload photo.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ---------- change password ---------- */
  function openPw() {
    setPw({ current: '', next: '', confirm: '' });
    setPwShow({ current: false, next: false, confirm: false });
    setPwLenError(false);
    setPwMatchError(false);
    setDigits(Array(6).fill(''));
    setOtpError('');
    setPwStep('password');
  }

  function closePw() {
    if (pwSaving || verifying) return;
    clearTimers();
    setPwStep('closed');
  }

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

  async function submitPw(e) {
    e.preventDefault();
    if (!pw.current) { showToast('Please enter your current password.', 'error'); return; }
    const lenOk = pw.next.length >= 8;
    const matchOk = pw.next === pw.confirm;
    setPwLenError(!lenOk);
    setPwMatchError(!matchOk);
    if (!lenOk || !matchOk) return;
    if (PW_RULES.some(r => !r.test(pw.next))) { showToast('New password does not meet all requirements.', 'error'); return; }
    setPwSaving(true);
    try {
      const data = await apiFetch('profile/password_change_init.php', {
        method: 'POST',
        body: { current_password: pw.current, new_password: pw.next, confirm_password: pw.confirm },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      showToast(data.message || 'Verification code sent to your email.');
      setDigits(Array(6).fill(''));
      setOtpError('');
      setPwStep('otp');
      startTimers();
      setTimeout(() => { try { otpRefs.current[0]?.focus(); } catch {} }, 150);
    } catch (err) {
      showToast(err.message || 'Could not send the verification code.', 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function resendOtp() {
    if (resendSecs > 0 || resending) return;
    setResending(true);
    setOtpError('');
    try {
      const data = await apiFetch('auth/resend-otp.php', { method: 'POST', body: { email: profile.email || user?.email, purpose: 'password_change' } });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Could not resend the verification code.');
      }
      setDigits(Array(6).fill(''));
      startTimers();
      toast2('A new verification code has been sent.');
      setTimeout(() => { try { otpRefs.current[0]?.focus(); } catch {} }, 100);
    } catch (err) {
      setOtpError(err.message || 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  }

  function toast2(m) { showToast(m); }

  function backToPw() {
    clearTimers();
    setOtpError('');
    setDigits(Array(6).fill(''));
    setPwStep('password');
  }

  async function submitPwInit() {
    if (!pw.current) { showToast('Please enter your current password.', 'error'); return; }
    if (pw.next.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
    if (pw.next !== pw.confirm) { showToast('New passwords do not match.', 'error'); return; }
    if (pw.next === pw.current) { showToast('New password must be different from your current password.', 'error'); return; }
    if (PW_RULES.some(r => !r.test(pw.next))) { showToast('New password does not meet all requirements.', 'error'); return; }
    setPwSaving(true);
    try {
      const data = await apiFetch('profile/password_change_init.php', {
        method: 'POST',
        body: { current_password: pw.current, new_password: pw.next, confirm_password: pw.confirm },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      showToast(data.message || 'Verification code sent to your email.');
      setDigits(Array(6).fill(''));
      setOtpError('');
      setPwStep('otp');
      startTimers();
      setTimeout(() => { try { otpRefs.current[0]?.focus(); } catch {} }, 150);
    } catch (err) {
      showToast(err.message || 'Could not send the verification code.', 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function verifyOtp() {
    const code = digits.join('');
    if (code.length !== 6) { setOtpError('Please enter the complete 6-digit verification code.'); return; }
    if (expirySecs <= 0) { setOtpError('This verification code has expired. Please request a new code.'); return; }
    setVerifying(true);
    setOtpError('');
    try {
      const v = await apiFetch('auth/verify-otp.php', {
        method: 'POST',
        body: { email: profile.email || user?.email, otp: code, purpose: 'password_change' },
      });
      if (!v || v.success !== true) {
        throw new Error(v?.error || 'Invalid verification code. Please try again.');
      }
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: pw.next, confirm_password: pw.confirm },
      });
      clearTimers();
      closePwSilent();
      showToast('Password changed successfully.');
    } catch (err) {
      setOtpError(err.message || 'Incorrect verification code. Please try again.');
      setDigits(Array(6).fill(''));
      try { otpRefs.current[0]?.focus(); } catch {}
    } finally {
      setVerifying(false);
    }
  }

  function closePwSilent() {
    clearTimers();
    setPwStep('closed');
    setPw({ current: '', next: '', confirm: '' });
  }

  /* ---------- OTP digit handlers ---------- */
  function setDigit(index, value) {
    const clean = String(value || '').replace(/\D/g, '').slice(0, 1);
    setOtpError('');
    setDigits((d) => d.map((v, i) => (i === index ? clean : v)));
    if (clean && index < 5) {
      try { otpRefs.current[index + 1]?.focus(); } catch {}
    }
  }

  function onDigitKey(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      try { otpRefs.current[index - 1]?.focus(); } catch {}
      setDigits((d) => d.map((v, i) => (i === index - 1 ? '' : v)));
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      try { otpRefs.current[index - 1]?.focus(); } catch {}
    }
    if (e.key === 'ArrowRight' && index < 5) {
      try { otpRefs.current[index + 1]?.focus(); } catch {}
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

  /* ---------- 2FA / sessions ---------- */
  const twoFaEnabled = !!((profile && profile.security_settings || {}).two_factor_enabled);
  function handle2FA() {
    if (twoFaEnabled) { showToast('Two-factor authentication is already enabled.', 'info'); return; }
    if (onNavigate) { onNavigate('settings'); return; }
    showToast('Two-factor authentication is not active for normal login.', 'info');
  }

  async function logoutEverywhere() {
    setSessionsOpen(false);
    showToast('Signing out on all devices...', 'info');
    try { await logout(); } catch {}
    if (onNavigate) onNavigate('home');
  }

  if (profileError) {
    return (
      <div className="space-y-5 max-w-6xl">
        <StaffErrorState message="Unable to load your profile." onRetry={loadProfile} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-5 max-w-6xl">
        <SkeletonRows rows={5} height="h-12" />
      </div>
    );
  }

  const initials = initialsOf(profile.name);
  const photoSrc = profile.profile_photo ? uploadUrl(profile.profile_photo) : null;
  const roleName = profile.role || user?.role || 'Staff';
  const code = digits.join('');
  const codeExpired = expirySecs <= 0;
  const expFmt = `${Math.floor(expirySecs / 60)}:${String(expirySecs % 60).padStart(2, '0')}`;

  return (
    <div className="max-w-7xl space-y-5" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <StaffPageHeader
        eyebrow="Account"
        title="My Profile"
        description="Manage your personal information and account settings."
      />

      {/* PROFILE HEADER */}
      <section className="bg-white border border-[#dfe7f2] rounded-[13px] shadow-[0_2px_10px_rgba(25,55,95,0.05)] p-[22px_28px] flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <div className="w-24 h-24 rounded-full bg-[#edf4fd] text-[#1264e8] grid place-items-center text-[32px] font-extrabold border border-[#dce7f5] overflow-hidden flex-shrink-0">
            {photoSrc ? <img src={photoSrc} alt={profile.name} className="w-full h-full object-cover" /> : initials}
          </div>
          <div className="min-w-0">
            <div className="text-[22px] font-extrabold text-[#10213f]">
              {profile.name || 'Staff'}
              <span className="inline-flex items-center bg-[#edf4ff] text-[#1264e8] rounded-[20px] px-3 py-[6px] text-[11px] font-bold ml-[7px] align-middle">{roleName}</span>
            </div>
            <div className="text-[12px] text-[#586983] mt-[9px]">✉ &nbsp; {profile.email || '—'}</div>
            <div className="flex gap-[7px] mt-[9px] flex-wrap">
              <span className="text-[10px] font-bold px-[10px] py-[5px] rounded-[20px] text-[#12a866] bg-[#eafaf2]">● Verified</span>
              <span className="text-[10px] font-bold px-[10px] py-[5px] rounded-[20px] text-[#1264e8] bg-[#eef5ff]">● Active Account</span>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-2.5 text-[11px] font-bold text-[#1264e8] hover:underline cursor-pointer bg-transparent border-none disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Change Photo'}
            </button>
          </div>
        </div>
        <div className="w-full sm:w-[420px] sm:border-l border-[#dfe7f2] sm:pl-[30px] max-sm:border-t max-sm:pt-3">
          {[
            ['Member Since', formatDate(profile.created_at)],
            ['Last Login', formatDateTime(profile.last_login_at)],
            ['Account Type', roleName],
          ].map(([k, v]) => (
            <div key={k} className="h-[38px] flex justify-between items-center border-b border-[#edf1f6] last:border-b-0 text-[11px]">
              <span className="text-[#71809a]">{k}</span>
              <span className="font-bold text-[#10213f]">{v}</span>
            </div>
          ))}
          <div className="h-[38px] flex justify-between items-center text-[11px]">
            <span className="text-[#71809a]">Account Status</span>
            <span className="text-[10px] font-bold px-[10px] py-[5px] rounded-[20px] text-[#12a866] bg-[#eafaf2]">● Active</span>
          </div>
        </div>
      </section>

      {/* GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-[18px]">

        {/* PERSONAL INFORMATION */}
        <section className="bg-white border border-[#dfe7f2] rounded-[13px] shadow-[0_2px_10px_rgba(25,55,95,0.05)] p-[22px]">
          <div className="flex items-center justify-between mb-[18px]">
            <div className="flex items-center gap-3">
              <span className="w-[42px] h-[42px] bg-[#eef5ff] text-[#1264e8] rounded-[11px] grid place-items-center text-[19px] flex-shrink-0">♙</span>
              <div>
                <div className="text-[16px] font-extrabold text-[#10213f]">Personal Information</div>
                <div className="text-[11px] text-[#71809a] mt-1">View and update your basic account details.</div>
              </div>
            </div>
            <button onClick={openEdit} className="h-[38px] px-[17px] rounded-lg border border-[#1264e8] bg-white text-[#1264e8] text-[11px] font-bold cursor-pointer hover:bg-[#eef5ff] flex-shrink-0">✎ &nbsp; Edit Profile</button>
          </div>
          {[
            ['Full Name', profile.name || '—'],
            ['Username', profile.username || '—'],
            ['Email Address', (<span key="e">{profile.email || '—'}{!!profile.email_verified && <span className="float-right text-[#12a866] bg-[#eafaf2] px-2 py-1 rounded-[15px] text-[9px] ml-2">✓ Verified</span>}</span>)],
            ['Contact Number', profile.phone || 'Not specified'],
            ['Date of Birth', profile.date_of_birth ? formatDate(profile.date_of_birth) : 'Not specified'],
            ['Gender', profile.gender || 'Not specified'],
            ['Address', profile.address || 'Not specified'],
          ].map(([k, v]) => (
            <div key={k} className="min-h-[53px] grid grid-cols-[175px_1fr] max-sm:grid-cols-[110px_1fr] items-center border-b border-[#edf1f6] last:border-b-0 text-[12px]">
              <span className="text-[#62718a] font-semibold">{k}</span>
              <span className="text-[#10213f] font-semibold min-w-0 break-words">{v}</span>
            </div>
          ))}
        </section>

        {/* ACCOUNT ACTIONS */}
        <section className="bg-white border border-[#dfe7f2] rounded-[13px] shadow-[0_2px_10px_rgba(25,55,95,0.05)] p-[22px] self-start">
          <div className="flex items-center gap-3 mb-[18px]">
            <span className="w-[42px] h-[42px] bg-[#eef5ff] text-[#1264e8] rounded-[11px] grid place-items-center text-[19px] flex-shrink-0">⚙</span>
            <div>
              <div className="text-[16px] font-extrabold text-[#10213f]">Account Actions</div>
              <div className="text-[11px] text-[#71809a] mt-1">Manage your account quickly.</div>
            </div>
          </div>
          <div className="border border-[#dfe7f2] rounded-[11px] overflow-hidden">
            <button type="button" onClick={openPw} className="w-full min-h-[78px] flex items-center justify-between p-[14px_16px] border-b border-[#dfe7f2] cursor-pointer transition-all bg-white hover:bg-[#f8fbff] text-left">
              <span className="flex items-center gap-[14px] min-w-0">
                <span className="w-[38px] h-[38px] rounded-[10px] grid place-items-center text-[17px] flex-shrink-0 bg-[#fff6e5] text-[#f59e0b]">🔒</span>
                <span>
                  <span className="block text-[13px] font-extrabold text-[#10213f]">Change Password</span>
                  <span className="block text-[10px] text-[#71809a] mt-1">Keep your account secure</span>
                </span>
              </span>
              <span className="text-[18px] text-[#7b8ba4] flex-shrink-0">›</span>
            </button>
            <button type="button" onClick={() => { loadSessions(); setSessionsOpen(true); }} className="w-full min-h-[78px] flex items-center justify-between p-[14px_16px] border-b border-[#dfe7f2] cursor-pointer transition-all bg-white hover:bg-[#f8fbff] text-left">
              <span className="flex items-center gap-[14px] min-w-0">
                <span className="w-[38px] h-[38px] rounded-[10px] grid place-items-center text-[17px] flex-shrink-0 bg-[#eafaf2] text-[#12a866]">🛡</span>
                <span>
                  <span className="block text-[13px] font-extrabold text-[#10213f]">Manage Sessions</span>
                  <span className="block text-[10px] text-[#71809a] mt-1">View and manage active sessions</span>
                </span>
              </span>
              <span className="text-[18px] text-[#7b8ba4] flex-shrink-0">›</span>
            </button>
            <button type="button" onClick={handle2FA} className="w-full min-h-[78px] flex items-center justify-between p-[14px_16px] cursor-pointer transition-all bg-white hover:bg-[#f8fbff] text-left">
              <span className="flex items-center gap-[14px] min-w-0">
                <span className="w-[38px] h-[38px] rounded-[10px] grid place-items-center text-[17px] flex-shrink-0 bg-[#eef5ff] text-[#1264e8]">🔑</span>
                <span>
                  <span className="block text-[13px] font-extrabold text-[#10213f]">Two-Factor Authentication</span>
                  <span className="block text-[10px] text-[#71809a] mt-1">Status: {twoFaEnabled ? 'Enabled' : 'Not Enabled'}</span>
                </span>
              </span>
              <span className="text-[18px] text-[#7b8ba4] flex-shrink-0">›</span>
            </button>
          </div>
        </section>
      </div>

      {/* RECENT LOGIN ACTIVITY */}
      <section className="bg-white border border-[#dfe7f2] rounded-[13px] shadow-[0_2px_10px_rgba(25,55,95,0.05)] p-[18px]">
        <div className="flex items-start justify-between gap-[15px] mb-[14px]">
          <div>
            <div className="text-[14px] font-extrabold text-[#10213f]">Recent Login Activity</div>
            <div className="text-[10px] text-[#71809a] mt-1">Review your recent account activity.</div>
          </div>
          <button onClick={() => onNavigate && onNavigate('activity')} className="border-none bg-transparent text-[#1264e8] text-[10px] font-extrabold cursor-pointer whitespace-nowrap hover:underline">View All Sessions →</button>
        </div>
        <div className="w-full overflow-x-auto border border-[#dfe7f2] rounded-[11px]">
          <table className="w-full min-w-[760px] border-collapse table-fixed">
            <thead>
              <tr>
                {['Device', 'Browser', 'Location', 'Date & Time', 'Status'].map((h) => (
                  <th key={h} className="h-[34px] px-[15px] bg-[#f8fafc] border-b border-[#dfe7f2] text-[#65758e] text-[8px] tracking-[0.7px] font-extrabold text-left uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} className="h-[42px] px-[15px] text-center text-[11px] text-[#9CA3AF]">No recent activity recorded.</td></tr>
              ) : sessions.slice(0, 5).map((s, i) => (
                <tr key={s.id || i}>
                  <td className="h-[42px] px-[15px] border-b border-[#edf1f6] text-[9px] text-[#405270]"><span className="text-[#10213f] font-extrabold">{s.os || 'Unknown'} • {s.device || s.device_type || 'Desktop'}</span></td>
                  <td className="h-[42px] px-[15px] border-b border-[#edf1f6] text-[9px] text-[#405270]">{s.browser || '—'}</td>
                  <td className="h-[42px] px-[15px] border-b border-[#edf1f6] text-[9px] text-[#405270]">{s.location || 'Local'}</td>
                  <td className="h-[42px] px-[15px] border-b border-[#edf1f6] text-[9px] text-[#405270]">{formatDateTime(s.created_at)}</td>
                  <td className="h-[42px] px-[15px] border-b border-[#edf1f6] text-[9px]">
                    {i === 0
                      ? <span className="inline-flex items-center justify-center min-w-[54px] h-[22px] px-[9px] rounded-[20px] text-[8px] font-bold text-[#14945c] bg-[#eafaf2]">This device</span>
                      : <span className="text-[#71809a]">Previous</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* EDIT PROFILE MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(7,27,55,0.45)] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget && !saving) setEditOpen(false); }}>
          <div className="w-full max-w-[540px] max-h-[90vh] overflow-y-auto bg-white rounded-[15px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] animate-[modalRise_180ms_ease] my-4">
            <div className="px-[22px] py-5 border-b border-[#dfe7f2] flex justify-between items-center">
              <div className="text-[17px] font-extrabold text-[#10213f]">Edit Profile</div>
              <button onClick={() => !saving && setEditOpen(false)} aria-label="Close" className="border-none bg-transparent text-[22px] text-[#7b8ba4] cursor-pointer">×</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="p-[22px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-name">Full Name</label>
                    <input id="ep-name" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]">Username</label>
                    <input className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-[#f6f8fb]" value={profile.username || ''} disabled />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-email">Email Address</label>
                    <input id="ep-email" type="email" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-contact">Contact Number</label>
                    <input id="ep-contact" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneLive(e.target.value) })} onBlur={(e) => setForm({ ...form, phone: normalizePhMobile(e.target.value) })} placeholder="09XX XXX XXXX" inputMode="numeric" maxLength={11} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-dob">Date of Birth</label>
                    <input id="ep-dob" type="date" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} style={{ colorScheme: 'light' }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-gender">Gender</label>
                    <select id="ep-gender" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8]" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option value="">Select gender</option><option>Male</option><option>Female</option><option>Prefer not to say</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor="ep-address">Address</label>
                    <input id="ep-address" className="w-full h-10 border border-[#d5dfec] rounded-lg px-3 outline-none text-[12px] text-[#10213f] bg-white focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, Barangay, City" />
                  </div>
                </div>
              </div>
              <div className="px-[22px] py-[15px] border-t border-[#dfe7f2] flex justify-end gap-[9px]">
                <button type="button" onClick={() => setEditOpen(false)} disabled={saving} className="h-[38px] px-[17px] rounded-lg border border-[#1264e8] bg-white text-[#1264e8] text-[11px] font-bold cursor-pointer hover:bg-[#eef5ff] disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="h-[38px] px-[17px] rounded-lg border-none bg-[#1264e8] text-white text-[11px] font-bold cursor-pointer hover:bg-[#0e56ca] disabled:opacity-55">{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {pwStep === 'password' && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(7,27,55,0.45)] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget && !pwSaving) setPwStep('closed'); }}>
          <div className="w-full max-w-[540px] max-h-[90vh] overflow-y-auto bg-white rounded-[15px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] animate-[modalRise_180ms_ease] my-4">
            <div className="px-[22px] py-5 border-b border-[#dfe7f2] flex justify-between items-center">
              <div>
                <div className="text-[17px] font-extrabold text-[#10213f]">Change Password</div>
                <div className="text-[#71809a] text-[10px] mt-1">Update your account password.</div>
              </div>
              <button onClick={() => !pwSaving && setPwStep('closed')} aria-label="Close" className="border-none bg-transparent text-[22px] text-[#7b8ba4] cursor-pointer">×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitPwInit(); }}>
              <div className="p-[22px]">
                {[
                  { key: 'current', label: 'Current Password', ac: 'current-password' },
                  { key: 'next', label: 'New Password', ac: 'new-password' },
                  { key: 'confirm', label: 'Confirm New Password', ac: 'new-password' },
                ].map((f) => (
                  <div key={f.key} className="mb-[14px]">
                    <label className="block text-[11px] font-bold mb-[6px] text-[#4f607b]" htmlFor={`staff-pw-${f.key}`}>{f.label}</label>
                    <div className="relative">
                      <input
                        id={`staff-pw-${f.key}`}
                        type={pwShow[f.key] ? 'text' : 'password'}
                        value={pw[f.key]}
                        onChange={(e) => setPw({ ...pw, [f.key]: e.target.value })}
                        autoComplete={f.ac}
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        className="w-full h-10 border border-[#d5dfec] rounded-lg pl-3 pr-[45px] outline-none text-[12px] text-[#10213f] bg-white transition-all focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)]"
                        style={{ WebkitTextFillColor: '#10213f' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPwShow({ ...pwShow, [f.key]: !pwShow[f.key] })}
                        aria-label={pwShow[f.key] ? 'Hide password' : 'Show password'}
                        aria-pressed={pwShow[f.key]}
                        className="absolute right-[9px] top-1/2 -translate-y-1/2 w-[34px] h-[34px] border-0 bg-transparent cursor-pointer text-[#71809a] flex items-center justify-center rounded-[7px] transition-all hover:text-[#1264e8] hover:bg-[#eef5ff] [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:stroke-current [&>svg]:fill-none"
                      >
                        <EyeIcon visible={pwShow[f.key]} />
                      </button>
                    </div>
                  </div>
                ))}
                {pw.next && !PW_RULES.every((r) => r.test(pw.next)) && (
                  <div className="text-[10px] text-[#dc3545] font-bold mb-[5px]">Password must be at least 8 characters.</div>
                )}
                {pw.confirm && pw.next !== pw.confirm && (
                  <div className="text-[10px] text-[#dc3545] font-bold mb-[5px]">Passwords do not match.</div>
                )}
              </div>
              <div className="px-[22px] py-[15px] border-t border-[#dfe7f2] flex justify-end gap-[9px]">
                <button type="button" onClick={() => !pwSaving && setPwStep('closed')} className="h-[38px] px-[17px] rounded-lg border border-[#1264e8] bg-white text-[#1264e8] text-[11px] font-bold cursor-pointer hover:bg-[#eef5ff]">Cancel</button>
                <button type="submit" disabled={pwSaving} className="h-[38px] px-[17px] rounded-lg border-none bg-[#1264e8] text-white text-[11px] font-bold cursor-pointer hover:bg-[#0e56ca] disabled:opacity-55">
                  {pwSaving ? 'Sending code...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD OTP MODAL */}
      {pwStep === 'otp' && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(7,27,55,0.45)] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget && !verifying) backToPw(); }}>
          <div className="w-full max-w-[620px] max-h-[90vh] overflow-y-auto bg-white rounded-[15px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] animate-[modalRise_180ms_ease] my-4">
            <div className="flex items-start justify-between px-6 pt-[22px]">
              <button type="button" onClick={backToPw} aria-label="Back to change password" className="w-[38px] h-[38px] border border-[#e3ebf6] rounded-[10px] bg-[#f3f7fd] text-[#18335f] grid place-items-center cursor-pointer transition-all hover:bg-[#e8f1ff] hover:border-[#cfe0fa] hover:text-[#1264e8] [&>svg]:w-[19px] [&>svg]:h-[19px] [&>svg]:stroke-current [&>svg]:fill-none">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
              </button>
              <button type="button" onClick={() => !verifying && backToPw()} aria-label="Close verification" className="w-[38px] h-[38px] border border-[#e3ebf6] rounded-[10px] bg-[#f3f7fd] text-[#18335f] grid place-items-center cursor-pointer transition-all hover:bg-[#e8f1ff] hover:border-[#cfe0fa] hover:text-[#1264e8] [&>svg]:w-[19px] [&>svg]:h-[19px] [&>svg]:stroke-current [&>svg]:fill-none">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="text-center px-[52px] max-sm:px-5 pb-7">
              <div className="w-16 h-16 -mt-0.5 mx-auto mb-[17px] rounded-2xl bg-[#eaf2ff] text-[#1264e8] grid place-items-center [&>svg]:w-[31px] [&>svg]:h-[31px] [&>svg]:stroke-current [&>svg]:fill-none">
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
              </div>
              <div className="text-[#0b2148] text-[25px] max-sm:text-[21px] leading-[1.15] font-extrabold mb-[11px]">Verify Your Email</div>
              <div className="text-[#667792] text-[12px] leading-[1.6] mx-auto max-w-[430px]">
                We sent a 6-digit verification code to
                <span className="block text-[#102a56] text-[13px] font-extrabold mt-[2px]">{profile.email || user?.email}</span>
              </div>
              <div className="flex justify-center gap-[10px] max-sm:gap-[6px] mt-[25px] mb-[10px]" onPaste={onDigitPaste}>
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
                    aria-label={`Digit ${i + 1}`}
                    disabled={codeExpired}
                    className={`w-[55px] h-[58px] max-sm:w-[45px] max-sm:h-[52px] border-[1.5px] rounded-[9px] outline-none bg-white text-center text-[#10213f] text-[22px] font-extrabold transition-all disabled:opacity-55 ${d ? 'border-[#9abcf0] bg-[#f8fbff]' : 'border-[#ccd8e8]'} focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.10)] focus:-translate-y-[1px]`}
                    style={{ WebkitTextFillColor: '#10213f' }}
                  />
                ))}
              </div>
              <div className="text-[#71809a] text-[10px] mb-[17px]">Enter the 6-digit code sent to your email.</div>
              {otpError && <div className="text-[#dc3545] text-[10px] font-bold -mt-[2px] mb-[10px]">{otpError}</div>}
              <div className="min-h-[40px] px-[13px] py-[10px] border border-[#dce9fb] bg-[#f4f8ff] rounded-lg flex items-center justify-center gap-2 text-[#536b91] text-[10px] mb-[13px]">
                <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] flex-shrink-0 stroke-[#1264e8] fill-none" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 1.5" /></svg>
                <span>{codeExpired ? 'The verification code has expired. Please request a new code.' : <>The code will expire in <strong>{expFmt}</strong>.</>}</span>
              </div>
              <div className="text-[#71809a] text-[10px] mb-[18px]">
                Didn&apos;t receive the code?
                <button type="button" onClick={resendOtp} disabled={resendSecs > 0 || resending} className="border-none p-0 ml-[3px] bg-transparent text-[#1264e8] text-[10px] font-extrabold cursor-pointer hover:underline disabled:text-[#9aa7ba] disabled:cursor-not-allowed disabled:no-underline">
                  {resendSecs > 0 ? <>Resend in {resendSecs}s</> : resending ? 'Sending...' : 'Resend code'}
                </button>
              </div>
              <button
                type="button"
                onClick={verifyOtp}
                disabled={code.length !== 6 || verifying || codeExpired}
                className="w-full h-[44px] border-none rounded-[7px] text-white text-[12px] font-extrabold cursor-pointer transition-all shadow-[0_5px_13px_rgba(18,100,232,0.18)] hover:-translate-y-[1px] disabled:opacity-55 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                style={{ background: 'linear-gradient(135deg, #1264e8, #176ff2)' }}
              >
                {verifying ? 'Verifying...' : 'Verify & Change Password'}
              </button>
            </div>
            <div className="border-t border-[#e7edf5] bg-[#f8fafc] min-h-[55px] px-6 flex items-center justify-center gap-[9px] text-[#64758f] text-[9px] rounded-b-[15px]">
              <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] stroke-[#29456f] fill-none" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-2.9 8.4-7 10-4.1-1.6-7-5.3-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
              <span>Your password is securely managed by XEVERA.</span>
            </div>
          </div>
        </div>
      )}

      {/* SESSIONS MODAL */}
      {sessionsOpen && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(7,27,55,0.45)] flex items-center justify-center p-5 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setSessionsOpen(false); }}>
          <div className="w-full max-w-[540px] max-h-[90vh] overflow-y-auto bg-white rounded-[15px] shadow-[0_20px_60px_rgba(0,0,0,0.18)] animate-[modalRise_180ms_ease] my-4">
            <div className="px-[22px] py-5 border-b border-[#dfe7f2] flex justify-between items-center">
              <div>
                <div className="text-[17px] font-extrabold text-[#10213f]">Active Sessions</div>
                <div className="text-[#71809a] text-[10px] mt-1">Devices currently signed in to your account.</div>
              </div>
              <button onClick={() => setSessionsOpen(false)} aria-label="Close" className="border-none bg-transparent text-[22px] text-[#7b8ba4] cursor-pointer">×</button>
            </div>
            <div className="p-[22px]">
              <div id="sessionList">
                {sessions.length === 0 ? (
                  <div className="text-center py-[30px] text-[#71809a] text-[12px]">No active sessions found.</div>
                ) : sessions.slice(0, 7).map((s, i) => (
                  <div key={s.id || i} className="border border-[#dfe7f2] rounded-[10px] p-[15px] mb-[10px] last:mb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="w-9 h-9 rounded-[9px] bg-[#eef5ff] text-[#1264e8] grid place-items-center flex-shrink-0 text-[16px]">▣</span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-extrabold text-[#10213f] truncate">{s.os || 'Unknown'} • {s.device || s.device_type || 'Desktop'}</div>
                          <div className="text-[#71809a] text-[10px] mt-[3px]">{s.browser || '—'} · {s.location || 'Local'}</div>
                        </div>
                      </div>
                      {i === 0
                        ? <span className="text-[#12a866] bg-[#eafaf2] px-2 py-1 rounded-[20px] text-[9px] font-bold flex-shrink-0">Current Session</span>
                        : <button onClick={logoutEverywhere} className="h-[30px] px-[10px] rounded-lg border border-[#f0a0a7] text-[#dc3545] bg-white text-[10px] font-bold cursor-pointer hover:bg-[#fff3f4] flex-shrink-0">Log Out</button>}
                    </div>
                    <div className="text-[10px] text-[#71809a] mt-[9px]">{formatDateTime(s.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-[22px] py-[15px] border-t border-[#dfe7f2] flex justify-end gap-[9px]">
              <button onClick={logoutEverywhere} className="h-[38px] px-[17px] rounded-lg border border-[#f0a0a7] text-[#dc3545] bg-white text-[11px] font-bold cursor-pointer hover:bg-[#fff3f4]">Log Out Other Sessions</button>
              <button onClick={() => setSessionsOpen(false)} className="h-[38px] px-[17px] rounded-lg border border-[#1264e8] bg-white text-[#1264e8] text-[11px] font-bold cursor-pointer hover:bg-[#eef5ff]">Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
