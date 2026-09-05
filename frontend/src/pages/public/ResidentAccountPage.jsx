import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentChangePasswordModal from '../../components/resident/ResidentChangePasswordModal';
import ResidentChangeEmailModal from '../../components/resident/ResidentChangeEmailModal';
import { formatPhoneLive, normalizePhMobile } from '../../utils/phone';

function initials(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

const NOTIF_ROWS = [
  { key: 'email_enabled', label: 'Email Notifications', desc: 'Receive important updates and announcements', icon: 'letter', tint: 'bg-[#EEF5FF] text-[#1769ED]' },
  { key: 'notify_status', label: 'Report Status Updates', desc: 'Alerts when your report status changes', icon: 'bell', tint: 'bg-[#EAF8F0] text-[#16A35A]' },
  /* Service Announcements removed on resident My Account - D:\GAMES\backup (9)\frontend */
  { key: 'notify_comments', label: 'Community Announcements', desc: 'News and events in the community', icon: 'chat', tint: 'bg-[#FFF4E4] text-[#F59E0B]' },
];

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange}
      className={`w-[43px] h-[25px] rounded-[30px] relative transition-colors cursor-pointer flex-shrink-0 ${on ? 'bg-[#1769ED]' : 'bg-[#D7E0EB]'}`}>
      <span className={`absolute top-[3px] left-[3px] w-[19px] h-[19px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.15)] transition-transform ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  );
}

function Inner({ onNavigate }) {
  const { user, updateUser, logout } = useAuth();
  const showToast = useToast();
  const [profile, setProfile] = useState(null);
  const [prefs, setPrefs] = useState({});
  const [twoFA, setTwoFA] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const photoRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const residentId = 'XR-RES-' + String(user?.id || '').padStart(6, '0');
  const profilePhoto = profile?.profile_photo || user?.photo || null;

  const loadProfile = useCallback(() => { apiFetch('profile/get.php').then(setProfile).catch(() => {}); }, []);
  const loadPrefs = useCallback(() => { apiFetch('notifications/prefs-get.php').then(setPrefs).catch(() => setPrefs({})); }, []);
  const loadSessions = useCallback(() => { apiFetch('profile/history.php').then((d) => setSessions(Array.isArray(d?.items) ? d.items : [])).catch(() => setSessions([])); }, []);

  useEffect(() => { loadProfile(); loadPrefs(); loadSessions(); }, [loadProfile, loadPrefs, loadSessions]);

  function openEdit() {
    setEditForm({
      name: profile?.name || user?.name || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
      middle_name: profile?.middle_name || '',
      phase: profile?.phase || '',
      block: profile?.block || '',
      lot: profile?.lot || '',
      address: profile?.address || '',
      gender: profile?.gender || '',
      date_of_birth: profile?.date_of_birth || '',
    });
    setEditErrors({});
    setEditOpen(true);
  }

  function validateEdit() {
    const errs = {};
    if (!String(editForm?.name || '').trim()) errs.name = 'Please enter your full name.';
    if (editForm?.phone && !/^09\d{9}$/.test(String(editForm.phone).trim())) errs.phone = 'Contact number must be 11 digits starting with 09.';
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!validateEdit()) return;
    setSavingEdit(true);
    try {
      await apiFetch('profile/update.php', { method: 'POST', body: editForm });
      showToast('Profile updated successfully.');
      setEditOpen(false);
      setEditErrors({});
      loadProfile();
      updateUser({ name: editForm.name, email: editForm.email, address: editForm.address });
    } catch (err) {
      showToast(err.message || 'Could not update your profile.', 'error');
    } finally { setSavingEdit(false); }
  }

  async function savePhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    setUploadingPhoto(true);
    try {
      const d = await apiFetch('profile/photo.php', { method: 'POST', body: fd });
      setProfile((p) => (p ? { ...p, profile_photo: d.profile_photo } : p));
      updateUser({ photo: d.profile_photo });
      showToast('Profile photo updated.');
    } catch (err) { showToast(err.message || 'Could not upload photo.', 'error'); }
    finally { setUploadingPhoto(false); if (photoRef.current) photoRef.current.value = ''; }
  }

  // Escape closes the edit modal (keyboard accessibility).
  useEffect(() => {
    if (!editOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !savingEdit) { setEditOpen(false); setEditErrors({}); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editOpen, savingEdit]);

  async function removePhoto() {
    try {
      const fd = new FormData();
      fd.append('action', 'remove');
      await apiFetch('profile/photo.php', { method: 'POST', body: fd });
      setProfile((p) => (p ? { ...p, profile_photo: null } : p));
      updateUser({ photo: null });
      showToast('Profile photo removed.');
    } catch (err) { showToast(err.message || 'Could not remove photo.', 'error'); }
  }

  async function togglePref(key, value) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { await apiFetch('notifications/prefs-save.php', { method: 'POST', body: next }); }
    catch (err) { setPrefs(prefs); showToast(err.message || 'Could not save preference.', 'error'); }
  }

  async function saveNotifPrefs() {
    try { await apiFetch('notifications/prefs-save.php', { method: 'POST', body: prefs }); showToast('Notification preferences saved.'); }
    catch (err) { showToast(err.message || 'Could not save preferences.', 'error'); }
  }

  function toggle2FA() {
    const next = !twoFA;
    setTwoFA(next);
    showToast(next ? 'Two-factor authentication enabled for your account.' : 'Two-factor authentication disabled.', 'info');
  }

  const inputBase = 'w-full h-[46px] px-3.5 border rounded-[10px] text-[14px] bg-white text-[#0D1D42] focus:outline-none focus:border-[#1769ED] focus:shadow-[0_0_0_3px_rgba(23,105,237,0.12)] transition-shadow';
  const inputCls = `${inputBase} border-[#DFE6EF]`;
  const inputErrCls = `${inputBase} border-[#E5484D] focus:border-[#E5484D] focus:shadow-[0_0_0_3px_rgba(229,72,77,0.12)]`;
  const fieldErr = 'mt-1.5 text-[11px] font-semibold text-[#C81E1E]';

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
      {/* Profile summary card */}
      <section className="flex flex-col sm:flex-row sm:items-center gap-5 bg-white border border-[#DFE6EF] rounded-[17px] shadow-[0_6px_22px_rgba(35,76,130,0.045)] p-6 sm:px-7 mb-[22px]">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-gradient-to-br from-[#DCEAFF] to-[#BCD7FF] flex items-center justify-center text-[38px] font-extrabold text-[#1769ED] border-[5px] border-[#EDF5FF]">
              {profilePhoto ? <img src={uploadUrl(profilePhoto)} alt={profile?.name || 'avatar'} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : initials(profile?.name || user?.name)}
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-[24px] font-extrabold text-[#0E2854] leading-tight truncate">{profile?.name || user?.name}</h2>
            <span className="mt-2 inline-flex items-center gap-[7px] px-[11px] py-1.5 rounded-full bg-[#E9F9EF] text-[#16A35A] text-[11px] font-extrabold"><span className="w-1.5 h-1.5 rounded-full bg-[#16A35A]" />Active Resident</span>
          </div>
        </div>
        <button onClick={openEdit}
          className="h-[44px] px-5 rounded-[10px] bg-white border border-[#9BC0FA] text-[#1769ED] font-bold text-[13px] hover:bg-[#EEF5FF] transition-all cursor-pointer inline-flex items-center justify-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <span aria-hidden className="text-[15px] leading-none">✎</span> Edit Profile
        </button>
      </section>

      {/* Personal Information card */}
      <section className="bg-white border border-[#DFE6EF] rounded-[17px] shadow-[0_6px_22px_rgba(35,76,130,0.045)] p-6 sm:px-7 mb-[22px]">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-[42px] h-[42px] grid place-items-center rounded-[12px] bg-[#EDF5FF] text-[#1769ED] flex-shrink-0">
            <Icon name="user" size={18} />
          </span>
          <div>
            <h3 className="text-[16px] font-extrabold text-[#112B56]">Personal Information</h3>
            <p className="text-[11px] text-[#8191AA] mt-0.5">View your basic account details.</p>
          </div>
        </div>
        <div>
          {[
            { label: 'Full Name', value: profile?.name || user?.name || '—' },
            { label: 'Email Address', value: profile?.email || user?.email || '—', verified: true },
            { label: 'Resident ID', value: residentId },
            { label: 'Member Since', value: profile?.created_at ? fmtDate(profile.created_at) : '—' },
          ].map((row, i, arr) => (
            <div key={row.label} className={`flex flex-wrap items-center justify-between gap-2 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#EDF1F6]' : ''}`}>
              <span className="text-[12px] font-bold text-[#58709A]">{row.label}</span>
              <span className="text-[13px] font-extrabold text-[#112D5A] text-right break-all">
                {row.value}
                {row.verified && <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E9F8EF] text-[#16A35A] text-[10px] font-extrabold align-middle">✓ Verified</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px] mb-[22px]">

        {/* Account actions */}
        <section className="bg-white border border-[#DFE6EF] rounded-[16px] shadow-[0_6px_22px_rgba(35,76,130,0.045)] p-[17px]">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="w-[42px] h-[42px] grid place-items-center rounded-[12px] bg-[#EDF5FF] text-[#1769ED] flex-shrink-0">
              <Icon name="gear" size={18} />
            </span>
            <div>
              <h3 className="text-[16px] font-extrabold text-[#112B56]">Account Actions</h3>
              <p className="text-[10px] text-[#8191AA] mt-1">Manage your account quickly.</p>
            </div>
          </div>

          <div className="border border-[#DFE6EF] rounded-[13px] overflow-hidden">
            {[
              { key: 'email', icon: 'letter', tint: 'bg-[#EDF5FF] text-[#1769ED]', title: 'Change Email', desc: 'Update your email address', onClick: () => setEmailOpen(true) },
              { key: 'password', icon: 'lock', tint: 'bg-[#FFF4E4] text-[#E88300]', title: 'Change Password', desc: 'Keep your account secure', onClick: () => setPwOpen(true) },
              { key: 'sessions', icon: 'shield', tint: 'bg-[#EAF8F0] text-[#16A35A]', title: 'Manage Sessions', desc: 'View and manage active sessions', onClick: () => { loadSessions(); setSessionsOpen(true); } },
              { key: 'notif', icon: 'bell', tint: 'bg-[#F1EBFF] text-[#7A4CE0]', title: 'Notification Settings', desc: 'Control what you hear from Xevera', onClick: () => { document.getElementById('resident-notif-prefs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
            ].map((a, i, arr) => (
              <button key={a.key} type="button" onClick={a.onClick}
                className={`w-full min-h-[70px] flex items-center gap-[13px] px-3.5 py-3 bg-white hover:bg-[#F7FAFF] transition-colors cursor-pointer text-left border-none ${i < arr.length - 1 ? 'border-b border-[#DFE6EF]' : ''}`}>
                <span className={`w-[38px] h-[38px] grid place-items-center rounded-[10px] flex-shrink-0 ${a.tint}`}>
                  <Icon name={a.icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold text-[#112B56] mb-1">{a.title}</span>
                  <span className="block text-[10px] text-[#8191AA]">{a.desc}</span>
                </span>
                <span aria-hidden className="text-[#9AA8BF] text-[16px] flex-shrink-0">›</span>
              </button>
            ))}
          </div>
        </section>

        {/* Notifications & preferences */}
        <section id="resident-notif-prefs" className="bg-white border border-[#DFE6EF] rounded-[16px] shadow-[0_6px_22px_rgba(35,76,130,0.045)] p-[17px] scroll-mt-24">
          <div className="min-h-[48px] flex items-start justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-3">
              <span className="w-[42px] h-[42px] grid place-items-center rounded-[12px] bg-[#EDF5FF] text-[#1769ED] text-[18px]">♧</span>
              <div>
                <h3 className="text-[16px] font-extrabold text-[#112B56]">Notifications &amp; Preferences</h3>
                <p className="text-[10px] text-[#8191AA] mt-1">Control what you hear from Xevera.</p>
              </div>
            </div>
            <button onClick={saveNotifPrefs}
              className="h-[40px] px-[17px] rounded-[9px] border-none text-white text-[11px] font-bold transition-shadow cursor-pointer hover:shadow-[0_8px_18px_rgba(23,105,255,0.22)] whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg,#287CFF,#075BE5)' }}>
              Save Changes
            </button>
          </div>

          <div className="border border-[#DFE6EF] rounded-[13px] overflow-hidden">
            {NOTIF_ROWS.map((row) => (
              <div key={row.key} className="min-h-[70px] flex items-center justify-between gap-2.5 px-3.5 py-3 border-b border-[#DFE6EF] last:border-b-0">
                <div className="flex items-center gap-[13px]">
                  <span className={`w-[39px] h-[39px] rounded-[11px] grid place-items-center ${row.tint}`}><Icon name={row.icon} size={17} /></span>
                  <div>
                    <div className="text-[12px] font-extrabold text-[#112B56] mb-[5px]">{row.label}</div>
                    <div className="text-[9px] text-[#8191AA]">{row.desc}</div>
                  </div>
                </div>
                <Toggle on={!!prefs[row.key]} onChange={() => togglePref(row.key, !prefs[row.key])} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent login activity */}
      <section className="bg-white border border-[#DFE6EF] rounded-[16px] shadow-[0_6px_22px_rgba(35,76,130,0.045)] p-[17px]">
        <div className="flex items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-3">
            <span className="w-[42px] h-[42px] grid place-items-center rounded-[12px] bg-[#EDF5FF] text-[#1769ED] text-[17px]">▣</span>
            <div>
            <h3 className="text-[16px] font-extrabold text-[#112B56]">Recent Login Activity</h3>
            <p className="text-[10px] text-[#8191AA] mt-1">Review your latest account activity.</p>
            </div>
          </div>
          <button onClick={() => { loadSessions(); setSessionsOpen(true); }} className="bg-transparent border-none text-[#1769ED] text-[10px] font-bold cursor-pointer hover:underline whitespace-nowrap">
            View All Sessions →
          </button>
        </div>

        {/* Mobile stacked login cards - no horizontal overflow below 768px */}
        <div className="md:hidden space-y-2.5">
          {sessions.length === 0 ? (
            <p className="text-[11px] text-[#8191AA] text-center py-6 border border-[#DFE6EF] rounded-[12px]">No login history yet.</p>
          ) : sessions.slice(0, 5).map((s, i) => (
            <div key={s.id || i} className="border border-[#DFE6EF] rounded-[12px] p-3.5 bg-white" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold text-[#112B56]">{i === 0 ? '💻' : '📱'} {s.os || 'Unknown'} • {s.device_type || s.device || 'Desktop'}</span>
                {i === 0 ? <span className="px-2.5 py-1 rounded-full bg-[#E7F8EE] text-[#1AA565] text-[9px] font-extrabold flex-shrink-0">This device</span> : <span className="text-[#71839E] text-[9px] flex-shrink-0">Previous</span>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div><div className="text-[#8191AA] font-bold">Browser</div><div className="text-[#1D3A66] font-bold mt-0.5">{s.browser || '—'}</div></div>
                <div><div className="text-[#8191AA] font-bold">Location</div><div className="text-[#1D3A66] font-bold mt-0.5">⌖ {s.location || 'Local'}</div></div>
                <div className="col-span-2"><div className="text-[#8191AA] font-bold">Date &amp; Time</div><div className="text-[#1D3A66] font-bold mt-0.5">{fmtDateTime(s.created_at)}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto border border-[#DFE6EF] rounded-[12px]">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F8FAFF]">
                {[['', 'w-[50px]'], ['Device', ''], ['Browser', ''], ['Location', ''], ['Date & Time', ''], ['Status', '']].map(([label, width], i) => (
                  <th key={i} className={`${width} px-3.5 py-3 text-left text-[9px] font-bold text-[#7083A1]`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3.5 py-6 text-center text-[11px] text-[#8191AA] border-t border-[#DFE6EF]">No login history yet.</td>
                </tr>
              ) : sessions.slice(0, 5).map((s, i) => (
                <tr key={s.id || i}>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px] text-[#1D3A66]">{i === 0 ? '💻' : '📱'}</td>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px] text-[#1D3A66] font-extrabold">{s.os || 'Unknown'} • {s.device_type || 'Desktop'}</td>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px] text-[#1D3A66]">{s.browser || '—'}</td>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px] text-[#1D3A66]">⌖ {s.location || 'Local'}</td>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px] text-[#1D3A66]">{fmtDateTime(s.created_at)}</td>
                  <td className="px-3.5 py-3.5 border-t border-[#DFE6EF] text-[10px]">
                    {i === 0 ? (
                      <span className="inline-flex px-2.5 py-[7px] rounded-full bg-[#E7F8EE] text-[#1AA565] text-[9px] font-extrabold">This device</span>
                    ) : (
                      <span className="text-[#71839E] text-[9px]">Previous</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit profile modal - compact modern redesign */}
      {editOpen && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(9,25,52,0.55)] backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget && !savingEdit) { setEditOpen(false); setEditErrors({}); } }}>
          <div className="w-full sm:max-w-[760px] bg-white rounded-[18px] shadow-[0_24px_70px_rgba(10,30,65,0.28)] overflow-hidden flex flex-col" style={{ width: 'min(760px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 32px)' }}>
            <div className="px-5 sm:px-6 py-4 border-b border-[#E5EBF3] flex items-start justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <h2 className="text-[19px] sm:text-[20px] font-extrabold text-[#0D1D42] leading-tight">Edit Profile</h2>
                <p className="text-[12px] text-[#7B8BA6] mt-1">Update your personal information and account profile.</p>
              </div>
              <button onClick={() => { if (!savingEdit) { setEditOpen(false); setEditErrors({}); } }} aria-label="Close edit profile" className="w-9 h-9 rounded-[10px] bg-[#F1F5FA] border-none text-[#0D1D42] text-[20px] leading-none cursor-pointer hover:bg-[#E5EBF3] focus:outline-none focus:ring-2 focus:ring-[#1769ED]/40 flex-shrink-0">×</button>
            </div>
            <form onSubmit={saveEdit} noValidate className="px-5 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 overflow-y-auto" style={{ minWidth: 0 }}>
              <div className="md:col-span-2 flex items-center gap-4" style={{ minWidth: 0 }}>
                <div className="w-[64px] h-[64px] rounded-full overflow-hidden bg-gradient-to-br from-[#DCEAFF] to-[#BCD7FF] flex items-center justify-center text-[26px] font-extrabold text-[#1769ED] border-4 border-[#EDF5FF] flex-shrink-0">
                  {profilePhoto ? <img src={uploadUrl(profilePhoto)} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : initials(editForm?.name || user?.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-[#0D1D42]">Profile photo</div>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <label htmlFor="edit-photo-input" className="h-[36px] px-4 rounded-[9px] bg-white border border-[#9BC0FA] text-[#1769ED] text-[12px] font-bold hover:bg-[#EEF5FF] transition-colors cursor-pointer inline-flex items-center">
                      {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                    </label>
                    {profilePhoto && (
                      <button type="button" onClick={removePhoto} disabled={uploadingPhoto} className="h-[36px] px-4 rounded-[9px] bg-white border border-[#F3B4B4] text-[#DC2626] text-[12px] font-bold hover:bg-[#FEF2F2] transition-colors cursor-pointer disabled:opacity-55">Remove</button>
                    )}
                  </div>
                  <input ref={photoRef} id="edit-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingPhoto} onChange={(e) => { const f = e.target.files?.[0]; if (f) savePhoto(f); }} />
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="edit-fullname" className="block text-[12px] font-bold text-[#0D1D42] mb-2">Full Name *</label>
                <input id="edit-fullname" className={editErrors.name ? inputErrCls : inputCls} value={editForm?.name || ''} onChange={(e) => { setEditForm((f) => ({ ...f, name: e.target.value })); if (editErrors.name) setEditErrors((p) => ({ ...p, name: undefined })); }} placeholder="Hanz Bulanadi" autoComplete="name" />
                {editErrors.name && <p className={fieldErr}>{editErrors.name}</p>}
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="edit-phone" className="block text-[12px] font-bold text-[#0D1D42] mb-2">Contact Number</label>
                <input id="edit-phone" className={editErrors.phone ? inputErrCls : inputCls} value={editForm?.phone || ''} onChange={(e) => { const v = formatPhoneLive(e.target.value); setEditForm((f) => ({ ...f, phone: v })); if (editErrors.phone) setEditErrors((p) => ({ ...p, phone: undefined })); }} onBlur={(e) => setEditForm((f) => ({ ...f, phone: normalizePhMobile(e.target.value) }))} placeholder="09XX XXX XXXX" autoComplete="tel" inputMode="numeric" maxLength={11} />
                {editErrors.phone && <p className={fieldErr}>{editErrors.phone}</p>}
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="edit-dob" className="block text-[12px] font-bold text-[#0D1D42] mb-2">Date of Birth</label>
                <input id="edit-dob" className={inputCls} type="date" value={editForm?.date_of_birth || ''} onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value }))} style={{ colorScheme: 'light' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <label htmlFor="edit-gender" className="block text-[12px] font-bold text-[#0D1D42] mb-2">Gender</label>
                <select id="edit-gender" className={inputCls} value={editForm?.gender || ''} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select>
              </div>
              <div className="md:col-span-2" style={{ minWidth: 0 }}>
                <label htmlFor="edit-address" className="block text-[12px] font-bold text-[#0D1D42] mb-2">Address *</label>
                <input id="edit-address" className={editErrors.address ? inputErrCls : inputCls} value={editForm?.address || ''} onChange={(e) => { setEditForm((f) => ({ ...f, address: e.target.value })); if (editErrors.address) setEditErrors((p) => ({ ...p, address: undefined })); }} placeholder="Street, Barangay, City" autoComplete="street-address" />
                {editErrors.address && <p className={fieldErr}>{editErrors.address}</p>}
              </div>
              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => { setEditOpen(false); setEditErrors({}); }} disabled={savingEdit} className="h-[44px] w-full sm:w-[140px] rounded-[10px] bg-white border border-[#D4DFEC] text-[#0D1D42] text-[13px] font-bold hover:bg-[#F5F8FC] focus:outline-none focus:ring-2 focus:ring-[#1769ED]/30 disabled:opacity-55 cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingEdit} className="h-[44px] w-full sm:w-[180px] rounded-[10px] border-none text-white text-[13px] font-bold bg-[#1769ED] hover:bg-[#0F57DC] focus:outline-none focus:ring-2 focus:ring-[#1769ED]/40 disabled:opacity-60 disabled:cursor-wait cursor-pointer inline-flex items-center justify-center gap-2">{savingEdit && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Sessions small box */}
      {sessionsOpen && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(9,25,52,0.48)] backdrop-blur-[4px] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSessionsOpen(false); }}>
          <div className="w-full max-w-[420px] bg-white rounded-[16px] shadow-[0_30px_90px_rgba(10,30,65,0.25)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DFE6EF] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-extrabold text-[#0D1D42]">Active Sessions</h2>
                <p className="text-[11px] text-[#7B8BA6] mt-0.5">{Math.max(sessions.length, 1)} active session{sessions.length === 1 ? '' : 's'} · Tap a device to log it out</p>
              </div>
              <button onClick={() => setSessionsOpen(false)} className="w-9 h-9 rounded-[10px] bg-[#F1F5FA] border-none text-[#0D1D42] text-[20px] cursor-pointer hover:bg-[#E5EBF3]">×</button>
            </div>
            <div className="p-4 max-h-[320px] overflow-y-auto space-y-2.5">
              {sessions.length === 0 ? (
                <p className="text-[12px] text-[#8191AA] text-center py-6">No login history yet.</p>
              ) : sessions.slice(0, 7).map((s, i) => (
                <button
                  key={s.id || i}
                  onClick={async () => { setSessionsOpen(false); showToast(`Signing out ${s.browser || 'device'}...`, 'info'); try { await logout(); } catch {} if (onNavigate) onNavigate('home'); }}
                  title={`Log out ${s.browser || 'this device'}`}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-3 border border-[#DFE6EF] rounded-[12px] bg-white hover:bg-[#FEF2F2] hover:border-[#F3B4B4] transition-colors cursor-pointer"
                >
                  <span className="w-[38px] h-[38px] grid place-items-center rounded-[10px] bg-[#EAF8F0] text-[#16A35A] text-[16px] flex-shrink-0">▣</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold text-[#112B56]">{s.browser || 'Unknown'} • {s.os || s.device || 'Desktop'}</div>
                    <div className="text-[10px] text-[#8191AA] mt-0.5">{s.ip || ''} · {fmtDateTime(s.created_at)}</div>
                  </div>
                  {i === 0 ? <span className="px-2.5 py-1.5 rounded-full bg-[#E7F8EE] text-[#1AA565] text-[9px] font-extrabold flex-shrink-0">This device</span> : <span className="px-2.5 py-1.5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[9px] font-extrabold flex-shrink-0">Logout</span>}
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-[#DFE6EF] flex items-center justify-between gap-2.5">
              <button onClick={async () => { setSessionsOpen(false); try { await logout(); } catch {} if (onNavigate) onNavigate('home'); }} className="h-[38px] px-5 rounded-[10px] bg-white border border-[#F3B4B4] text-[#DC2626] text-[11px] font-extrabold cursor-pointer hover:bg-[#FEF2F2]">Logout</button>
              <button onClick={() => setSessionsOpen(false)} className="h-[38px] px-5 rounded-[10px] bg-[#1769ED] text-white text-[11px] font-extrabold border-none cursor-pointer hover:bg-[#0D55D9]">Done</button>
            </div>
          </div>
        </div>
      )}

      <ResidentChangePasswordModal open={pwOpen} email={profile?.email || user?.email} onClose={() => setPwOpen(false)} onChanged={() => { loadProfile(); }} />

      <ResidentChangeEmailModal
        open={emailOpen}
        email={profile?.email || user?.email}
        onClose={() => setEmailOpen(false)}
        onChanged={(newEmail) => {
          loadProfile();
          updateUser({ email: newEmail });
        }}
      />
    </div>
  );
}

export default function ResidentAccountPage({ onNavigate, onViewReport }) {
  return (
    <ResidentLayout activePage="my-account" pageTitle="My Account" onNavigate={onNavigate}>
      <Inner onNavigate={onNavigate} />
    </ResidentLayout>
  );
}
