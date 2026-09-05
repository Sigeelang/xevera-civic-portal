import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import OtpVerificationPage from '../auth/OtpVerificationPage';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';
import { normalizePhMobile } from '../../utils/phone';

const card = 'bg-[#FFFFFF] rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_7px_rgba(20,40,70,0.03)] p-4 sm:p-5';
const inputCls = 'w-full h-[42px] px-3 border border-[#D8E1EB] rounded-[10px] text-[13px] bg-white text-[#24364E] focus:outline-none focus:ring-2 focus:ring-xevera-600/15 focus:border-xevera-600';
const labelCls = 'block text-[11px] font-bold text-[#617187] mb-1.5';

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

export default function ProfilePage({ onNavigate }) {
  const { user, updateUser } = useAuth();
  const showToast = useToast();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', dob: '', gender: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwShow, setPwShow] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwStep, setPwStep] = useState('form'); // 'form' | 'otp' | 'done'
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutText, setAboutText] = useState('');
  const [aboutDraft, setAboutDraft] = useState('');
  const fileRef = useRef(null);

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

  useEffect(() => { loadProfile(); }, [loadProfile]);
  useEffect(() => {
    apiFetch('profile/history.php?limit=8').then(d => setSessions(Array.isArray(d?.items) ? d.items : [])).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    try {
      const saved = localStorage.getItem(`xevera_about_${profile.id || user?.id || 'sa'}`);
      if (saved) setAboutText(saved);
    } catch {}
  }, [profile, user?.id]);

  async function handleSave(e) {
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
      showToast('Profile information saved successfully.');
      if (updateUser) updateUser({ name: form.name.trim(), email: form.email.trim() });
      setProfile(p => ({ ...p, name: form.name.trim(), email: form.email.trim(), phone: form.phone, date_of_birth: form.dob, gender: form.gender, address: form.address }));
    } catch (err) {
      showToast(err.message || 'Failed to update.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendOtp() {
    setPwError('');
    if (!pw.current) { setPwError('Please enter your current password.'); return; }
    if (PW_RULES.some(r => !r.test(pw.next))) { setPwError('New password does not meet all requirements.'); return; }
    if (pw.next !== pw.confirm) { setPwError('New passwords do not match.'); return; }
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
      setPwStep('otp');
    } catch (err) {
      showToast(err.message || 'Could not send the verification code.', 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleApplyOtp() {
    setPwSaving(true);
    try {
      await apiFetch('profile/password_change_complete.php', {
        method: 'POST',
        body: { new_password: pw.next, confirm_password: pw.confirm },
      });
      setPwStep('done');
      showToast('Password updated successfully.');
    } catch (err) {
      showToast(err.message || 'Could not change password.', 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleClosePw() {
    if (pwSaving) return;
    setPwOpen(false);
    setPwStep('form');
    setPwError('');
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

  function saveAbout() {
    setAboutText(aboutDraft);
    try { localStorage.setItem(`xevera_about_${profile.id || user?.id || 'sa'}`, aboutDraft); } catch {}
    setAboutOpen(false);
    showToast('About updated.');
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
        <SkeletonRows rows={5} height="h-16" />
      </div>
    );
  }

  const initials = initialsOf(profile.name);
  const photoSrc = profile.profile_photo ? uploadUrl(profile.profile_photo) : null;
  const twoFaEnabled = !!((profile.security_settings || {}).two_factor_enabled);
  const roleName = profile.role || user?.role || 'Staff';
  const defaultAbout = `${profile.name || roleName}\n${roleName === 'Super Admin' ? 'Administrator of the Xevera Civic Reporting System responsible for managing reports, residents, users, announcements, and system operations.' : roleName === 'Admin' ? 'Administrator of the Xevera Civic Reporting System responsible for verifying reports, managing assignments, and coordinating community operations.' : 'Member of the Xevera Civic Reporting team responsible for handling assigned reports and community requests.'}`;
  const aboutShown = aboutText || defaultAbout;
  function handle2FA() {
    if (twoFaEnabled) { showToast('Two-factor authentication is already enabled.', 'info'); return; }
    if (onNavigate) { onNavigate('settings'); return; }
    showToast('Two-factor authentication is not active for normal login.', 'info');
  }

  return (
    <div className="max-w-7xl space-y-5" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <StaffPageHeader
        eyebrow="Account"
        title="My Profile"
        description="Manage your personal information and account security."
      />

      {/* PROFILE HEADER CARD */}
      <section className={`${card} grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-5 items-center`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-[88px] h-[88px] rounded-full bg-[#EDF3FA] border border-[#DCE5EF] overflow-hidden grid place-items-center">
              {photoSrc ? (
                <img src={photoSrc} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[30px] font-bold text-[#1769ED]">{initials}</span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold text-[#17263D] leading-tight truncate">{profile.name || 'Super Admin'}</h2>
            <div className="mt-1 text-[12px] text-[#64758B]">Username: <strong className="text-[#24364D]">{profile.username || '—'}</strong></div>
            <div className="mt-0.5 text-[12px] text-[#64758B] truncate">Email: <strong className="text-[#24364D]">{profile.email || '—'}</strong></div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E9F8EF] text-[#168D4D] text-[10px] font-bold"><span className="w-[5px] h-[5px] rounded-full bg-[#19A35B]" /> Verified</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#EDF3FF] text-[#1769ED] text-[10px] font-bold">Role: {profile.role || 'Super Admin'}</span>
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 px-3 py-1.5 rounded-[8px] border border-[#BCD2F5] bg-white text-xevera-600 text-[11px] font-bold hover:bg-xevera-50 disabled:opacity-50 cursor-pointer">
              {uploading ? 'Uploading...' : 'Change Photo'}
            </button>
          </div>
        </div>
        <div className="md:justify-self-end w-full md:w-auto">
          <div className="rounded-[12px] border border-[#DCEBE3] px-5 py-4 text-center md:text-left md:min-w-[220px]" style={{ background: '#FCFFFD' }}>
            <div className="text-[11px] font-bold text-[#7B8CA6]">Account Status</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E9F8EF] text-[#168D4D] text-[11px] font-bold"><span className="w-[6px] h-[6px] rounded-full bg-[#19A35B]" /> Active</div>
            <div className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-4"><span className="text-[#718096]">Member Since</span><strong className="text-[#293A52]">{formatDate(profile.created_at)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-[#718096]">Last Login</span><strong className="text-[#293A52]">{formatDateTime(profile.last_login_at)}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-[#718096]">Account ID</span><strong className="text-[#293A52]">#{profile.id}</strong></div>
            </div>
          </div>
        </div>
      </section>

      {/* PERSONAL INFO + SECURITY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={card}>
          <div className="text-[14px] font-extrabold text-[#17263D]">Personal Information</div>
          <div className="text-[11px] text-[#8390A3] mt-0.5 mb-4">Manage your personal profile information.</div>
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Full Name</span>
                <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className={labelCls}>Email Address</span>
                <div className="relative">
                  <input className={`${inputCls} pr-20`} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  {!!profile.email_verified && <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-[#E8F8EE] text-[#15904B] text-[9px] font-bold">✓ Verified</span>}
                </div>
              </label>
              <label className="block">
                <span className={labelCls}>Username</span>
                <input className={`${inputCls} bg-[#F6F8FB]`} value={profile.username || ''} readOnly />
              </label>
              <label className="block">
                <span className={labelCls}>Contact Number</span>
                <input className={inputCls} type="tel" inputMode="numeric" maxLength={11} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })} onBlur={e => setForm({ ...form, phone: normalizePhMobile(e.target.value) })} placeholder="09XX XXX XXXX" />
              </label>
              <label className="block">
                <span className={labelCls}>Date of Birth</span>
                <input className={inputCls} type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
              </label>
              <label className="block">
                <span className={labelCls}>Gender</span>
                <select className={`${inputCls} cursor-pointer`} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Address</span>
                <input className={inputCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, Barangay, City" />
              </label>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 h-[42px] rounded-[10px] bg-xevera-600 text-white text-[13px] font-bold hover:bg-xevera-700 disabled:opacity-50 transition-colors cursor-pointer">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>

        <section className={card}>
          <div className="text-[14px] font-extrabold text-[#17263D]">Security</div>
          <div className="text-[11px] text-[#8390A3] mt-0.5 mb-4">Manage your password and account security.</div>
          <div className="divide-y divide-[#EDF1F5] border border-[#E5EAF2] rounded-[12px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-[#17263D]">Password</div>
                <div className="text-[11px] text-[#8390A3] mt-0.5">Last changed: —</div>
              </div>
              <button onClick={() => { setPwError(''); setPw({ current: '', next: '', confirm: '' }); setPwOpen(true); }} className="w-full sm:w-auto px-4 h-[40px] rounded-[10px] border border-[#BCD2F5] bg-white text-xevera-600 text-[12px] font-bold hover:bg-xevera-50 cursor-pointer">Change Password</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-[#17263D]">Two-Factor Authentication</div>
                <div className="text-[11px] text-[#8390A3] mt-0.5">Status: {twoFaEnabled ? 'Enabled' : 'Not Enabled'}</div>
              </div>
              <button onClick={handle2FA} className={`w-full sm:w-auto px-4 h-[40px] rounded-[10px] text-[12px] font-bold cursor-pointer border ${twoFaEnabled ? 'border-[#BFE7CB] bg-[#EAF8EF] text-[#168D4D]' : 'border-[#BCD2F5] bg-white text-xevera-600 hover:bg-xevera-50'}`}>{twoFaEnabled ? '✓ Enabled' : 'Enable 2FA'}</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-[#17263D]">Active Sessions</div>
                <div className="text-[11px] text-[#8390A3] mt-0.5">{sessions.length} active session{sessions.length === 1 ? '' : 's'}</div>
              </div>
              <button onClick={() => onNavigate && onNavigate('security/active-sessions')} className="w-full sm:w-auto px-4 h-[40px] rounded-[10px] border border-[#BCD2F5] bg-white text-xevera-600 text-[12px] font-bold hover:bg-xevera-50 cursor-pointer">Manage Sessions</button>
            </div>
          </div>
          <div className="mt-3 rounded-[10px] bg-[#F2F7FF] border border-[#CBDCFF] text-[#3D5A86] text-[11px] px-3.5 py-2.5">Your account is protected with security controls.</div>
        </section>
      </div>

      {/* ABOUT */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-extrabold text-[#17263D]">About</div>
          <button onClick={() => { setAboutDraft(aboutShown); setAboutOpen(true); }} className="px-3 py-1.5 rounded-[8px] border border-[#BDD2F5] bg-white text-xevera-600 text-[11px] font-bold hover:bg-xevera-50 cursor-pointer">Edit About</button>
        </div>
        <p className="mt-2 text-[12px] text-[#4B5B74] leading-relaxed whitespace-pre-line">{aboutShown}</p>
      </section>

      {/* RECENT LOGIN ACTIVITY */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-extrabold text-[#17263D]">Recent Login Activity</div>
            <div className="text-[11px] text-[#8390A3] mt-0.5">Review your recent account activity.</div>
          </div>
          <button onClick={() => onNavigate && onNavigate('security/login-activity')} className="text-[11px] font-bold text-xevera-600 hover:underline cursor-pointer bg-transparent border-none">View All Sessions →</button>
        </div>
        <div className="hidden md:block overflow-x-auto mt-3 border border-[#E5EAF2] rounded-[12px]">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#7B899C] bg-[#F8FAFC]">
                <th className="py-2.5 px-4 font-bold">Device</th>
                <th className="py-2.5 px-4 font-bold">Browser</th>
                <th className="py-2.5 px-4 font-bold">Location</th>
                <th className="py-2.5 px-4 font-bold">Date &amp; Time</th>
                <th className="py-2.5 px-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-[11px] text-[#9CA3AF]">No recent activity recorded.</td></tr>
              ) : sessions.slice(0, 5).map((s, i) => (
                <tr key={s.id || i} className="border-t border-[#EDF1F5]">
                  <td className="py-2.5 px-4 text-[11px] font-bold text-[#24364D]">{s.os || 'Unknown'} • {s.device || 'Desktop'}</td>
                  <td className="py-2.5 px-4 text-[11px] text-[#4B5B74]">{s.browser || '—'}</td>
                  <td className="py-2.5 px-4 text-[11px] text-[#4B5B74]">{s.location || 'Local'}</td>
                  <td className="py-2.5 px-4 text-[11px] text-[#4B5B74] whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                  <td className="py-2.5 px-4 text-[11px]">{i === 0 ? <span className="inline-flex px-2.5 py-1 rounded-full bg-[#E9F8EF] text-[#168D4D] text-[10px] font-bold">This device</span> : <span className="text-[#71839E] text-[10px]">Previous</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden mt-3 space-y-2.5">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-[#9CA3AF] py-4 text-center border border-[#E5EAF2] rounded-[12px]">No recent activity recorded.</p>
          ) : sessions.slice(0, 5).map((s, i) => (
            <div key={s.id || i} className="border border-[#E5EAF2] rounded-[12px] p-3.5 bg-white" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold text-[#17263D]">{s.os || 'Unknown'} • {s.device || 'Desktop'}</span>
                {i === 0 ? <span className="px-2 py-1 rounded-full bg-[#E9F8EF] text-[#168D4D] text-[10px] font-bold flex-shrink-0">This device</span> : <span className="text-[#71839E] text-[10px] flex-shrink-0">Previous</span>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div><div className="text-[#8191AA] font-bold">Browser</div><div className="text-[#24364D] font-bold mt-0.5">{s.browser || '—'}</div></div>
                <div><div className="text-[#8191AA] font-bold">Location</div><div className="text-[#24364D] font-bold mt-0.5">{s.location || 'Local'}</div></div>
                <div className="col-span-2"><div className="text-[#8191AA] font-bold">Date &amp; Time</div><div className="text-[#24364D] font-bold mt-0.5">{formatDateTime(s.created_at)}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CHANGE PASSWORD - step 1 modal: current + new + confirm + Send code */}
      <Modal
        open={pwOpen && pwStep === 'form'}
        title="Change Password"
        description="Enter your current password. We'll email a verification code to confirm the change."
        confirmLabel={pwSaving ? 'Sending code...' : 'Send Verification Code'}
        cancelLabel="Cancel"
        onCancel={handleClosePw}
        onConfirm={handleSendOtp}
      >
        <div className="space-y-3">
          {[
            { key: 'current', label: 'Current Password', ph: 'Enter your current password' },
            { key: 'next', label: 'New Password', ph: 'Enter your new password' },
            { key: 'confirm', label: 'Confirm New Password', ph: 'Confirm your new password' },
          ].map(f => (
            <label key={f.key} className="block">
              <span className={labelCls}>{f.label}</span>
              <div className="relative">
                <input
                  type={pwShow[f.key] ? 'text' : 'password'}
                  value={pw[f.key]}
                  onChange={e => setPw({ ...pw, [f.key]: e.target.value })}
                  placeholder={f.ph}
                  className={`${inputCls} pr-11`}
                />
                <button type="button" onClick={() => setPwShow({ ...pwShow, [f.key]: !pwShow[f.key] })} aria-label={pwShow[f.key] ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#738196] text-[12px] cursor-pointer">◉</button>
              </div>
            </label>
          ))}
          <div className="rounded-[10px] bg-[#F1F6FF] border border-[#CBDCFF] px-3 py-2.5">
            <div className="text-[11px] font-extrabold text-[#24364D] mb-1.5">Password must include:</div>
            <ul className="space-y-1">
              {PW_RULES.map(r => {
                const ok = r.test(pw.next);
                return <li key={r.key} className={`text-[11px] ${ok ? 'text-[#168D4D]' : 'text-[#6B7B91]'}`}>{ok ? '✓' : '○'} {r.label}</li>;
              })}
            </ul>
          </div>
          {pwError && <p className="text-[11px] font-bold text-[#C81E1E]">{pwError}</p>}
        </div>
      </Modal>

      {/* CHANGE PASSWORD - step 2 modal: full-screen OTP entry, then completes in the page */}
      {pwOpen && pwStep === 'otp' && (
        <OtpVerificationPage
          email={user?.email}
          purpose="password_change"
          onVerified={handleApplyOtp}
          onLogin={() => setPwStep('form')}
        />
      )}

      {/* CHANGE PASSWORD - step 3 modal: success notice */}
      <Modal
        open={pwOpen && pwStep === 'done'}
        title="Password updated"
        description="Your new password is active. We've also sent a confirmation to your registered email."
        confirmLabel="Done"
        cancelLabel="Close"
        onCancel={handleClosePw}
        onConfirm={handleClosePw}
      >
        <div className="p-3.5 rounded-[11px] bg-[#EAF9F1] border border-[#C8ECD9] text-[#167C4B] text-[11px] leading-relaxed text-center">
          ✓ You can use your new password the next time you sign in. A confirmation email has been sent to <strong>{user?.email}</strong>.
        </div>
      </Modal>

      {/* ABOUT MODAL */}
      <Modal
        open={aboutOpen}
        title="Edit About"
        description="A short professional description shown on your profile."
        confirmLabel="Save"
        cancelLabel="Cancel"
        onCancel={() => setAboutOpen(false)}
        onConfirm={saveAbout}
      >
        <textarea value={aboutDraft} onChange={e => setAboutDraft(e.target.value)} rows={4} maxLength={500} className="w-full min-h-[110px] p-3 rounded-[10px] border border-[#D8E1EB] text-[13px] resize-y focus:outline-none focus:border-xevera-600" />
      </Modal>
    </div>
  );
}
