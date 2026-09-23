import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import Pager from '../../components/Pager';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import { getRoutePermissions, applyDenials } from '../../utils/routeGuard';
import { formatPhoneLive, normalizePhMobile } from '../../utils/phone';
import ResidentsPage from './ResidentsPage';

/*
 * preset values (driven by #/users/<section> deep links):
 *   all | staff | administrators | residents | roles | status
 */
const TABS = [
  { key: 'management', label: 'Staff & Admins', icon: 'shield' },
  { key: 'all', label: 'All Users', icon: 'users' },
  { key: 'staff', label: 'Staff', icon: 'wrench' },
  { key: 'administrators', label: 'Administrators', icon: 'shield' },
  { key: 'residents', label: 'Residents', icon: 'heart' },
  { key: 'roles', label: 'Roles & Permissions', icon: 'lock' },
  { key: 'status', label: 'Account Status', icon: 'verify' },
];

const PRESET_ROLE_PARAMS = {
  all: '',
  staff: 'Staff',
  administrators: 'Admin',
  residents: 'Resident',
};

const PRESET_TITLES = {
  all: 'All Users',
  management: 'Staff & Administrators',
  staff: 'Staff Accounts',
  administrators: 'Administrator Accounts',
  residents: 'Resident Accounts',
};

const AVATAR_CLASSES = [
  'bg-[#1162E8]', 'bg-[#0F9A58]', 'bg-[#7437D4]', 'bg-[#F39209]', 'bg-[#0798AC]',
];

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function avatarClass(id) {
  return AVATAR_CLASSES[Math.abs(Number(id) || 0) % AVATAR_CLASSES.length];
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Strong initial password generator (14 chars, guaranteed character mix). */
function generateStrongPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const special = '!@#$%^&*';
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  let out = pick(upper) + pick(upper) + pick(lower) + pick(lower) + pick(nums) + pick(nums) + pick(special);
  const all = upper + lower + nums + special;
  while (out.length < 14) out += pick(all);
  return out.split('').sort(() => Math.random() - 0.5).join('');
}

function usernameFromName(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).join('.');
}

const PASSWORD_REQS = [
  { label: 'At least 12 characters', test: (p) => p.length >= 12 },
  { label: 'Uppercase and lowercase letters', test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { label: 'At least one number', test: (p) => /[0-9]/.test(p) },
  { label: 'At least one special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/* RBAC matrix: code baselines (routeGuard.js) overlaid with live Super
   Admin denials. Module keys must match backend PERM_MODULES. */
const MATRIX_MODULES = [
  ['Dashboard', 'dashboard', ['dashboard']],
  ['Reports', 'reports', ['reports', 'all-reports', 'verify']],
  ['Residents Directory', 'residents', ['residents']],
  ['Announcements', 'announcements', ['announcements']],
  ['Maintenance Mode', 'maintenance', ['maintenance']],
  ['Messages', 'messages', ['messages', 'concerns']],
  ['Reports & Analytics', 'analytics', ['analytics', 'platform-analytics']],
  ['Platform Analytics', 'platform-analytics', ['platform-analytics']],
  ['Export Reports', 'exports', ['exports']],
  ['Tasks', 'tasks', ['tasks-board', 'my-tasks', 'schedules']],
  ['Attendance', 'attendance', ['attendance']],
  ['My Performance', 'performance', ['performance']],
  ['Audit Logs', 'activity', ['activity']],
  ['Backups', 'backup', ['backup']],
  ['User Management', 'users', ['users']],
  ['Security Center', 'security', ['security']],
  ['System Settings', 'system-settings', ['system-settings']],
  ['Violation Management', 'violations', ['violations', 'violation-reports', 'violation-management']],
];

const EDITABLE_ROLES = ['Admin', 'Staff'];

function RolesMatrix() {
  const showToast = useToast();
  const perms = getRoutePermissions();
  const roles = ['Super Admin', 'Admin', 'Staff', 'Resident'];
  const [denials, setDenials] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('xevera_role_denials_v1') || 'null');
      return Array.isArray(cached?.denials) ? cached.denials : [];
    } catch {
      return [];
    }
  });
  const [busyKey, setBusyKey] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch('admin/permissions.php')
      .then((d) => {
        if (!mounted) return;
        const list = Array.isArray(d?.denials) ? d.denials : [];
        setDenials(list);
        applyDenials(list);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const deniedSet = useMemo(
    () => new Set(denials.map((d) => `${d.role}/${d.module}`)),
    [denials]
  );

  function codeAllowed(role, pages) {
    const set = perms[role];
    return set ? pages.some((p) => set.has(p)) : false;
  }

  function effectiveAllowed(role, moduleKey, pages) {
    if (!codeAllowed(role, pages)) return false;
    if ((role === 'Admin' || role === 'Staff') && deniedSet.has(`${role}/${moduleKey}`)) return false;
    return true;
  }

  async function toggleCell(role, moduleKey, currentlyAllowed) {
    if (busyKey) return;
    const key = `${role}/${moduleKey}`;
    setBusyKey(key);
    try {
      const data = await apiFetch('admin/permissions.php', {
        method: 'PUT',
        body: { role, module: moduleKey, allowed: !currentlyAllowed },
      });
      const list = Array.isArray(data?.denials) ? data.denials : [];
      setDenials(list);
      applyDenials(list);
      showToast(currentlyAllowed ? `${role} access to ${moduleKey} revoked.` : `${role} access to ${moduleKey} restored.`, 'success');
    } catch (e) {
      showToast(e?.message || 'Could not save permission.', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  async function resetAll() {
    if (resetting) return;
    setResetting(true);
    try {
      const data = await apiFetch('admin/permissions.php', {
        method: 'PUT',
        body: { reset: true },
      });
      const list = Array.isArray(data?.denials) ? data.denials : [];
      setDenials(list);
      applyDenials(list);
      showToast('Permissions reset to defaults.', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not reset permissions.', 'error');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5">
      <div className="flex items-start gap-3 p-3.5 mb-4 rounded-[12px] bg-[#F0F6FF] border border-[#D5E4FF]">
        <Icon name="alert" size={17} />
        <div className="flex-1">
          <h4 className="text-[13px] font-extrabold text-[#154A98]">Super Admin control</h4>
          <p className="text-[11px] text-[#536B93] leading-relaxed mt-0.5">
            Toggle a switch to revoke a module for Admin or Staff, or restore it.
            Revokes apply to the sidebar, page guard, and API immediately.
            Super Admin always keeps full access and Resident keeps its baseline — those columns are locked.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          disabled={resetting}
          className="flex-shrink-0 h-9 px-3.5 rounded-lg border border-[#C9DEF7] bg-white text-[#154A98] text-[11px] font-extrabold hover:bg-[#EAF2FF] transition-colors cursor-pointer disabled:opacity-50"
        >
          {resetting ? 'Resetting…' : 'Reset to defaults'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[520px]">
          <thead>
            <tr>
              <th className="text-left text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB]">Module</th>
              {roles.map((r) => (
                <th key={r} className="text-center text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB]">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_MODULES.map(([label, moduleKey, pages]) => (
              <tr key={label} className="hover:bg-[#F9FAFB]">
                <td className="px-3 py-2.5 border-b border-[#F1F5F9] text-[#374151] font-semibold">{label}</td>
                {roles.map((role) => {
                  const code = codeAllowed(role, pages);
                  const allowed = effectiveAllowed(role, moduleKey, pages);
                  const editable = EDITABLE_ROLES.includes(role) && code;
                  const key = `${role}/${moduleKey}`;
                  return (
                    <td key={role} className="px-3 py-2.5 border-b border-[#F1F5F9] text-center">
                      {editable ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={allowed}
                          aria-label={`${allowed ? 'Revoke' : 'Restore'} ${label} for ${role}`}
                          disabled={busyKey === key}
                          onClick={() => toggleCell(role, moduleKey, allowed)}
                          title={allowed ? `Revoke ${label} for ${role}` : `Restore ${label} for ${role}`}
                          className={`relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-colors cursor-pointer border-none disabled:opacity-50 ${allowed ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}
                        >
                          <span
                            className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow transition-transform ${allowed ? 'translate-x-[21px]' : 'translate-x-[3px]'}`}
                          />
                        </button>
                      ) : allowed ? (
                        <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-success-bg text-success-dark" title="Locked — baseline access">
                          <Icon name="check" size={13} />
                        </span>
                      ) : (
                        <span className="text-[#CBD5E1]" title={code ? 'Revoked' : 'Not granted by default'}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3.5 text-[10px] text-[#8B98AA]">
        Backend authorization (<code>requirePermission()</code> in every migrated API endpoint) enforces the same matrix server-side — revoking here also blocks direct API calls, not just pages.
      </p>
    </div>
  );
}

const PAGE_SIZE = 8;

export default function UsersMgmtPage({ preset = 'all', onNavigate }) {
  const showToast = useToast();
  const [users, setUsers] = useState([]);
  const [allUsersCount, setAllUsersCount] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Edit modal state (wires the existing users/update.php endpoint).
  const [editTarget, setEditTarget] = useState(null);
  const [showEditPw, setShowEditPw] = useState(false);  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  /*
   * Full-page "Create Staff Account" view (replaces the old small modal):
   * name -> auto username, email, phone, role, Active/Inactive toggle,
   * generated initial password + requirements box, first-login change flag,
   * and a review modal before hitting users/create.php.
   */
  const [showCreateView, setShowCreateView] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createRole, setCreateRole] = useState('Staff');
  const [createStatus, setCreateStatus] = useState('Active');
  const [createPassword, setCreatePassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [mustChangePw, setMustChangePw] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  const isRolesTab = preset === 'roles';
  const roleParam = PRESET_ROLE_PARAMS[preset] ?? '';

  const load = useCallback(async () => {
    if (isRolesTab) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (roleParam) params.set('role', roleParam);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const data = await apiFetch('users/list.php' + (qs ? `?${qs}` : ''));
      /* Combined preset: staff + administrators only (no residents). */
      setUsers(preset === 'management' ? data.filter((u) => u.role !== 'Resident') : data);
    } catch {
      setUsers([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isRolesTab, roleParam, statusFilter, preset]);

  useEffect(() => { if (preset !== 'residents') load(); else setLoading(false); }, [load, preset]);
  useEffect(() => { setPage(1); }, [search, statusFilter, preset]);

  // Total users across the system (for the stat card).
  useEffect(() => {
    if (isRolesTab || showCreateView || preset === 'residents') return undefined;
    let alive = true;
    apiFetch('users/list.php').then((d) => { if (alive) setAllUsersCount(Array.isArray(d) ? d.length : null); }).catch(() => {});
    return () => { alive = false; };
  }, [isRolesTab, showCreateView, users.length]);

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Stats for the staff tab.
  const activeCount = users.filter((u) => u.status === 'Active').length;
  const inactiveCount = users.length - activeCount;
  const newThisMonth = useMemo(() => {
    const now = new Date();
    return users.filter((u) => {
      if (!u.created_at) return false;
      const d = new Date(u.created_at);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [users]);

  async function toggleStatus(id) {
    setBusyId(id);
    try {
      await apiFetch('users/toggle.php', { method: 'POST', body: { id } });
      load();
      showToast('User status updated.');
    } catch {
      showToast('Failed to update user status.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(u) {
    if (!u || u.role !== 'Super Admin') return;
    setEditTarget(u);
    setEditForm({ name: u.name, email: u.email || '', role: u.role, password: '' });
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editForm) return;
    setSavingEdit(true);
    try {
      const body = { id: editTarget.id, name: editForm.name.trim(), email: editForm.email.trim(), role: editForm.role };
      if (editForm.password) body.password = editForm.password;
      await apiFetch('users/update.php', { method: 'POST', body });
      showToast('User updated.');
      setEditTarget(null);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to update user.', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  function openCreate() {
    setCreatedUser(null);
    setCreateName('');
    setCreateUsername('');
    setCreateEmail('');
    setCreatePhone('');
    setCreateRole(preset === 'administrators' ? 'Admin' : 'Staff');
    setCreateStatus('Active');
    setCreatePassword(generateStrongPassword());
    setShowPw(false);
    setMustChangePw(true);
    setShowCreateView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToList() {
    setShowCreateView(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitCreateForm(e) {
    e.preventDefault();
    if (!createName.trim()) { showToast('Please enter the full name.', 'error'); return; }
    if (!createUsername.trim()) { showToast('Please enter a username.', 'error'); return; }
    const email = createEmail.trim();
    if (!email) { showToast('Please enter an email address.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }
    if (createPhone.trim() && !/^09\d{9}$/.test(createPhone.trim())) { showToast('Phone number must be 11 digits starting with 09.', 'error'); return; }
    if (!PASSWORD_REQS.every((r) => r.test(createPassword))) {
      showToast('Initial password does not meet all requirements.', 'error');
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmCreate() {
    setCreating(true);
    try {
      await apiFetch('users/create.php', {
        method: 'POST',
        body: {
          name: createName.trim(),
          username: createUsername.trim(),
          email: createEmail.trim(),
          phone: createPhone.trim(),
          role: createRole,
          status: createStatus,
          password: createPassword,
          must_change_password: mustChangePw,
        },
      });
      setCreatedUser({
        name: createName.trim(),
        username: createUsername.trim(),
        email: createEmail.trim(),
        phone: createPhone.trim(),
        role: createRole,
        status: createStatus,
        mustChangePw,
      });
      setConfirmOpen(false);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to create user.', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiFetch('users/delete.php', { method: 'POST', body: { id: deleteTarget.id } });
      setDeleteTarget(null);
      load();
      showToast('User removed.');
    } catch (err) {
      showToast(err.message || 'Failed to delete user.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const inactiveTotal = users.length - activeCount;
  const title = preset === 'status' ? 'Account Status' : (PRESET_TITLES[preset] || 'Users Management');
  /*
   * The create-account form adapts to the tab it was opened from:
   * Administrators tab -> creates Admin accounts with matching labels;
   * everywhere else -> Staff wording (role can still be changed).
   */
  const entityLabel = preset === 'administrators' ? 'Administrator' : 'Staff';
  const inputCls = 'w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]';

  /* ================= CREATE ADMINISTRATOR VIEW ================= */
  if (showCreateView) {
    const reqsOk = PASSWORD_REQS.map((r) => r.test(createPassword));
    if (createdUser) {
      return (
        <div className="space-y-5" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6 sm:p-8 text-center max-w-[560px] mx-auto" style={{ width: '100%', maxWidth: 560 }}>
            <span className="w-[56px] h-[56px] mx-auto grid place-items-center rounded-full bg-[#E9F8EF] text-[#16A35A] text-[26px]">✓</span>
            <h2 className="mt-4 text-[20px] sm:text-[22px] font-extrabold text-[#11275A]">Administrator Created Successfully</h2>
            <p className="mt-2 text-[13px] text-[#61769B]">An administrator account has been created successfully.</p>
            <div className="mt-5 text-left bg-[#F7FAFF] border border-[#DCE7F8] rounded-[12px] p-4">
              {[['Full Name', createdUser.name], ['Username', createdUser.username], ['Email', createdUser.email], ['Role', createdUser.role], ['Account Status', createdUser.status], ['First Login Requirement', createdUser.mustChangePw ? 'Password change required' : 'Keeps initial password']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-1.5 text-[13px]">
                  <span className="text-[#667B9E] flex-shrink-0">{k}</span>
                  <span className="text-[#193360] font-bold text-right break-all">{v || '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={async () => { try { await navigator.clipboard.writeText(createPassword); } catch {} }} className="mt-3 w-full h-[44px] rounded-xl bg-white border border-[#D3DEEF] text-[13px] font-bold text-[#273B65] hover:bg-[#F8FAFC] cursor-pointer">⧉ Copy Temporary Password</button>
            <p className="mt-3 text-[11px] text-[#667A9F]">Login instructions can be provided to the administrator securely.</p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <button onClick={() => { setCreatedUser(null); backToList(); }} className="flex-1 h-[46px] rounded-xl bg-white border border-[#DBE4F2] text-sm font-bold text-[#20355F] hover:bg-[#F5F8FC] cursor-pointer">Done</button>
              <button onClick={() => { const u = createdUser; setCreatedUser(null); setShowCreateView(false); if (onNavigate) onNavigate('users/all'); }} className="flex-1 h-[46px] rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 cursor-pointer">View User</button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <button onClick={backToList}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
          ← Back to {entityLabel} List
        </button>

        <StaffPageHeader
          eyebrow="XEVERA / User Management / Create Administrator"
          title="Create Administrator"
          description="Add a staff or administrator account to the Xevera Civic Reporting System."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          {/* FORM */}
          <form onSubmit={submitCreateForm} className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6">
            <div className="flex items-center gap-3.5 pb-5 mb-6 border-b border-[#EEF1F6]">
              <span className="w-[52px] h-[52px] shrink-0 grid place-items-center rounded-[13px] bg-xevera-50 text-xevera-600"><Icon name="users" size={24} /></span>
              <div>
                <h2 className="text-lg font-extrabold text-[#11275A]">{entityLabel} Information</h2>
                <p className="text-[13px] text-[#61769B] mt-1">Fill in the details to create a new {entityLabel.toLowerCase()} account.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-5">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Full Name *</label>
                <input type="text" value={createName} required autoFocus onChange={(e) => {
                  setCreateName(e.target.value);
                  if (!createUsername || createUsername === usernameFromName(createName)) {
                    setCreateUsername(usernameFromName(e.target.value));
                  }
                }} placeholder="e.g. Maria Santos" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Username *</label>
                <input type="text" value={createUsername} required onChange={(e) => setCreateUsername(e.target.value)} placeholder="e.g. maria.santos" className={inputCls} />
                <p className="mt-1.5 text-[11px] text-[#60769B]">Username is generated from the administrator&apos;s name but can be edited.</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Email Address *</label>
                <input type="email" value={createEmail} required onChange={(e) => setCreateEmail(e.target.value)} placeholder="name@xevera.gov.ph" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Phone Number <span className="font-medium text-[#687DA1]">(Optional)</span></label>
                <input type="tel" inputMode="numeric" maxLength={11} value={createPhone} onChange={(e) => setCreatePhone(formatPhoneLive(e.target.value))} onBlur={(e) => setCreatePhone(normalizePhMobile(e.target.value))} placeholder="09XX XXX XXXX" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Role *</label>
                <select value={createRole} onChange={(e) => setCreateRole(e.target.value)} className={inputCls + ' cursor-pointer'}>
                  {['Staff', 'Admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <p className="mt-1.5 text-[11px] text-[#60769B]">{entityLabel === 'Administrator'
                  ? 'Administrator access: full report oversight, staff management tools, announcements, and analytics.'
                  : 'Staff access: report management, verification, assignment, status updates, and resident communication.'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Account Status *</label>
                <div className="grid grid-cols-2 rounded-xl overflow-hidden border border-[#D3DEEF] h-[46px]">
                  {[['Active', true], ['Inactive', false]].map(([label, isActive]) => (
                    <button key={label} type="button"
                      onClick={() => setCreateStatus(label)}
                      className={`flex items-center justify-center gap-2 text-sm font-bold transition-colors cursor-pointer ${createStatus === label ? 'bg-[#F3F8FF] text-xevera-600 shadow-[inset_0_0_0_1.5px_#1769ED]' : 'bg-white text-[#273B65] hover:bg-[#F8FAFC]'} ${!isActive ? 'border-l border-[#D3DEEF]' : ''}`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#19A463]' : 'bg-[#8793A9]'}`} />
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-[#60769B]">Inactive accounts cannot sign in until activated.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1.5 text-[#111827]">Initial Password *</label>
                <div className="flex gap-2.5 flex-col sm:flex-row">
                  <div className="relative flex-1">
                    <input type={showPw ? 'text' : 'password'} value={createPassword} required
                      onChange={(e) => setCreatePassword(e.target.value)}
                      autoComplete="new-password" className={inputCls + ' pr-11 font-mono'} />
                    <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-[#63799F] hover:text-xevera-600 cursor-pointer">
                      <Icon name={showPw ? 'lock' : 'verify'} size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setCreatePassword(generateStrongPassword())}
                    className="h-[46px] px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-xevera-600 text-xevera-600 bg-white text-sm font-bold hover:bg-[#F3F7FF] transition-colors cursor-pointer whitespace-nowrap">
                    ↻ Generate
                  </button>
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(createPassword); } catch {} }}
                    className="h-[46px] px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-[#D3DEEF] text-[#273B65] bg-white text-sm font-bold hover:bg-[#F8FAFC] transition-colors cursor-pointer whitespace-nowrap"
                    title="Copy temporary password">
                    ⧉ Copy
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#60769B]">A secure temporary password will be generated automatically. The user must change this password after their first login.</p>

                <div className="mt-3">
                  <div className="flex gap-1.5 mb-2.5">
                    {reqsOk.map((ok, i) => (
                      <span key={i} className={`flex-1 h-[5px] rounded-full ${ok ? 'bg-[#16A34A]' : 'bg-[#E2E8F0]'}`} />
                    ))}
                  </div>
                </div>

                <div className="mt-1 bg-[#F7FAFF] border border-[#D9E6FC] rounded-xl p-4">
                  <h3 className="text-[13px] font-extrabold text-[#11275A] mb-2.5">🔒 Password Requirements</h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {PASSWORD_REQS.map((r, i) => (
                      <li key={r.label} className={`flex items-center gap-2 text-[11px] ${reqsOk[i] ? 'text-[#128A4C]' : 'text-[#4C638B]'}`}>
                        <span className={`font-black text-[14px] ${reqsOk[i] ? '' : 'opacity-35'}`}>✓</span>{r.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-2.5 text-[11px] text-[#667A9F] leading-relaxed">The temporary password is only for first-time access. The user will be required to create a new password after signing in.</p>
              </div>

              <label className="sm:col-span-2 flex items-center gap-3 bg-[#F7FAFF] border border-[#D9E6FC] rounded-xl px-4 py-3.5 cursor-pointer select-none">
                <input type="checkbox" checked={mustChangePw} onChange={(e) => setMustChangePw(e.target.checked)} className="w-[18px] h-[18px] accent-xevera-600 cursor-pointer" />
                <span>
                  <strong className="block text-[13px] text-[#1A315E]">Require password change on first login</strong>
                  <span className="block text-[11px] text-[#687DA1] mt-0.5">The new member will be prompted to replace this initial password for security.</span>
                </span>
              </label>
            </div>

            <div className="mt-6 pt-5 border-t border-[#EEF1F6] flex flex-col sm:flex-row sm:justify-end gap-2.5">
              <button type="button" onClick={backToList}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-[#DBE4F2] text-sm font-bold text-[#20355F] hover:bg-[#F5F8FC] transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
                <Icon name="users" size={15} /> Review &amp; Create
              </button>
            </div>
          </form>

          {/* SIDE PANEL - single Access Summary (no duplicate password requirements) */}
          <aside className="space-y-4">
            <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-[34px] h-[34px] rounded-lg bg-xevera-50 text-xevera-600 grid place-items-center font-extrabold">i</span>
                <h3 className="text-[15px] font-extrabold text-[#11275A]">Access Summary</h3>
              </div>
              <ul className="grid gap-3 text-[12px] text-[#40577E]">
                <li className="flex items-center justify-between gap-3"><span className="text-[#667B9E]">Role</span><strong className="text-[#152D5D]">{createRole}</strong></li>
                <li className="flex items-center justify-between gap-3"><span className="text-[#667B9E]">Account</span><strong className="text-[#152D5D]">{createStatus}</strong></li>
                <li className="flex items-center justify-between gap-3"><span className="text-[#667B9E]">Login</span><strong className="text-[#152D5D]">{createStatus === 'Active' ? 'Enabled immediately' : 'Blocked until activated'}</strong></li>
                <li className="flex items-center justify-between gap-3"><span className="text-[#667B9E]">First Login</span><strong className="text-[#152D5D]">{mustChangePw ? 'Password change required' : 'Keeps initial password'}</strong></li>
                <li className="flex items-center justify-between gap-3"><span className="text-[#667B9E]">Permissions</span><strong className="text-[#152D5D]">Based on assigned role</strong></li>
              </ul>
              <p className="mt-4 pt-4 border-t border-[#EEF1F6] text-[11px] text-[#667A9F] leading-relaxed">Access is controlled by role-based permissions.</p>
            </div>
          </aside>
        </div>

        {/* Confirm modal */}
        <Modal
          open={confirmOpen}
          title="Review Administrator"
          description="Please verify the information before creating this account."
          confirmLabel={creating ? 'Creating...' : 'Create Administrator'}
          cancelLabel="Back to Edit"
          onConfirm={confirmCreate}
          onCancel={() => setConfirmOpen(false)}
        >
          <div className="bg-[#F7FAFF] border border-[#DCE7F8] rounded-[10px] p-4 my-3">
            {[
              ['Full Name', createName],
              ['Username', createUsername],
              ['Email', createEmail || '—'],
              ['Phone', createPhone || '—'],
              ['Role', createRole],
              ['Account Status', createStatus],
              ['Password Policy', mustChangePw ? 'Change password required on first login' : 'Keeps initial password'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1.5 text-xs">
                <span className="text-[#667B9E] flex-shrink-0">{k}</span>
                <span className="text-[#193360] font-bold text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    );
  }

  /* ================= RESIDENTS TAB =================
   * The Residents tab renders the dedicated prototype-matched page
   * (slide-in proof drawer, confirm modal, image viewer) instead of
   * the generic users table. It manages its own data + creation flow.
   */
  if (preset === 'residents' && !showCreateView) {
    return <ResidentsPage onNavigate={onNavigate} />;
  }

  /* ================= LIST VIEW ================= */
  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="User Management"
        title={title}
        description={
          isRolesTab
            ? 'Who can access what — generated from the existing role configuration.'
            : preset === 'status'
              ? 'Overview of account states across the portal.'
              : 'Add, edit, suspend, or remove user accounts.'
        }
        actions={
          !isRolesTab && (
            <button className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors bg-xevera-600 text-white hover:bg-xevera-700" onClick={openCreate}>+ Add User</button>
          )
        }
      />

      {/* Tabs */}
      {onNavigate && (
        <div className="flex gap-1.5 flex-wrap bg-white border border-[#E5E7EB] rounded-[14px] p-1.5">
          {TABS.map((t) => (
            <button key={t.key}
              onClick={() => onNavigate(`users/${t.key}`)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-bold transition-colors cursor-pointer ${
                preset === t.key ? 'bg-xevera-600 text-white shadow-[0_4px_12px_rgba(18,100,232,0.25)]' : 'text-[#58677E] hover:bg-[#F0F4FA] hover:text-xevera-600'
              }`}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isRolesTab ? <RolesMatrix /> : (
        <>
          {/* Stats row */}
          {(preset === 'management' || preset === 'staff' || preset === 'administrators') && !loading && !error && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {[
                ['Total', users.length, 'bg-xevera-50 text-xevera-600', 'users'],
                ['Active', activeCount, 'bg-[#E7F7EC] text-[#16A05B]', 'verify'],
                ['Inactive', inactiveCount, 'bg-[#FFF3DA] text-[#EAA11A]', 'lock'],
                ['New This Month', newThisMonth, 'bg-[#F3EAFF] text-[#8751E8]', 'filetext'],
                ...(allUsersCount !== null ? [['Total Users', allUsersCount, 'bg-[#E8F0FF] text-[#1662E8]', 'heart']] : []),
              ].map(([label, value, tint, icon]) => (
                <div key={label} className="bg-white border border-[#E3EAF5] rounded-[14px] min-h-[104px] p-4 flex items-center gap-3.5 shadow-[0_4px_18px_rgba(30,70,130,0.03)]">
                  <span className={`w-[54px] h-[54px] shrink-0 rounded-full grid place-items-center ${tint}`}><Icon name={icon} size={24} /></span>
                  <div className="min-w-0">
                    <small className="text-[11px] font-bold text-[#52688E]">{label}</small>
                    <strong className="block text-[24px] font-extrabold text-[#13295C] leading-tight">{value}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          {preset === 'status' && !loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Total Accounts', users.length, 'bg-xevera-50 text-xevera-600'],
                ['Active', activeCount, 'bg-success-bg text-success-dark'],
                ['Inactive / Suspended', inactiveTotal, 'bg-[#FFF5E4] text-[#B45309]'],
                ...(users.some((u) => u.role === 'Super Admin') ? [['Super Admins', users.filter((u) => u.role === 'Super Admin').length, 'bg-[#F3EDFF] text-[#7C3AED]']] : []),
              ].map(([label, value, tint]) => (
                <div key={label} className="bg-white border border-[#E5E7EB] rounded-[16px] p-4">
                  <span className={`w-9 h-9 rounded-[10px] grid place-items-center mb-2 ${tint}`}><Icon name={label.includes('Inactive') ? 'lock' : 'verify'} size={17} /></span>
                  <strong className="block text-[22px] font-extrabold text-[#111827]">{value}</strong>
                  <span className="text-[11px] text-[#64748B]">{label}</span>
                </div>
              ))}
            </div>
          )}

          {preset === 'status' && (
            <div className="p-3.5 rounded-[12px] bg-[#F8FAFC] border border-[#E5E7EB] text-[11px] text-[#64748B] leading-relaxed">
              Note: accounts are stored as <b>Active</b> or <b>Inactive</b>. Inactive accounts cannot sign in.
              Separate &quot;Suspended&quot; and &quot;Pending&quot; states are not part of the current database schema and are therefore not shown as editable options.
            </div>
          )}

          <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5 overflow-x-auto">
            <div className="flex gap-2.5 items-center mb-3.5 flex-wrap">
              <input type="search" placeholder="Search by name, username, or email..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[180px] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 cursor-pointer">
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {loading ? (
              <SkeletonRows rows={5} height="h-12" />
            ) : error ? (
              <StaffErrorState message="Unable to load users." onRetry={load} />
            ) : filtered.length === 0 ? (
              <StaffEmptyState title="No users found." description="Add a user or adjust your search." />
            ) : (
              <>
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Name', 'Username / Email', 'Role', 'Status', 'Created', 'Last Login', 'Actions'].map((h) => (
                        <th key={h} className="text-left text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(u => (
                      <tr key={u.id} className="hover:bg-[#FBFDFF]">
                        <td className="px-3 py-3 border-b border-[#F1F5F9] whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-9 rounded-full grid place-items-center text-white text-[11px] font-extrabold shrink-0 ${avatarClass(u.id)}`}>
                              {initialsOf(u.name)}
                            </span>
                            <strong className="text-[#1D3464] font-semibold">{u.name}</strong>
                          </div>
                        </td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9]">
                          <div className="text-[#1E3564] font-medium">{u.username || '—'}</div>
                          <div className="text-[11px] text-[#667B9F]">{u.email || ''}</div>
                        </td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9]">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                            u.role === 'Super Admin' ? 'bg-[#F3EDFF] text-[#7C3AED]'
                            : u.role === 'Admin' ? 'bg-[#EEF5FF] text-[#125CE2]'
                            : u.role === 'Staff' ? 'bg-[#EAF8F0] text-[#087F43]'
                            : 'bg-[#F1F5F9] text-[#64748B]'}`}>{u.role}</span>
                        </td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9]">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold ${u.status === 'Active' ? 'bg-[#E5F6EC] text-[#087F43]' : 'bg-[#EEF0F3] text-[#5F6D86]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Active' ? 'bg-[#16A25B]' : 'bg-[#68758C]'}`} />
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#64748B] whitespace-nowrap">{fmtDate(u.created_at)}</td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#64748B] whitespace-nowrap">{fmtDate(u.last_login_at)}</td>
                        <td className="px-3 py-3 border-b border-[#F1F5F9]">
                          <div className="flex gap-1.5 items-center">
                            {u.role !== 'Resident' && u.role !== 'Staff' && u.role !== 'Admin' && (
                              <button
                                title="View / Edit"
                                disabled={busyId === u.id}
                                className="w-10 h-10 rounded-lg border border-[#E5E7EB] bg-white text-[#1769ED] hover:bg-[#EEF5FF] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
                                onClick={() => openEdit(u)}
                              >
                                <Icon name="filetext" size={15} />
                              </button>
                            )}
                            <button
                              title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                              disabled={busyId === u.id}
                              className={`w-10 h-10 rounded-lg border bg-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center ${u.status === 'Active' ? 'border-[#E5E7EB] text-[#64748B] hover:bg-xevera-50 hover:text-xevera-600' : 'border-[#CBEAD9] text-[#12A45D] hover:bg-[#EFFAF4]'}`}
                              onClick={() => toggleStatus(u.id)}
                            >
                              <Icon name={u.status === 'Active' ? 'lock' : 'check'} size={15} />
                            </button>
                            <button
                              title="Delete"
                              disabled={busyId === u.id}
                              className="w-10 h-10 rounded-lg border border-[#E5E7EB] bg-white text-[#EF3030] hover:bg-[#FEF2F2] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between items-center mt-4 gap-3 flex-wrap">
                  <span className="text-xs text-[#60759A]">
                    Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} results
                  </span>
                  <Pager currentPage={safePage} totalPages={totalPages} onChange={setPage} />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3.5 p-4 rounded-[12px] border border-[#CFE0FF] bg-[#F8FBFF]">
            <span className="w-[30px] h-[30px] rounded-full bg-xevera-600 text-white grid place-items-center font-extrabold text-[13px] shrink-0">i</span>
            <div>
              <strong className="text-[12px] text-[#193360] block">Only Super Admin can create, edit, suspend, or delete accounts.</strong>
              <p className="text-[11px] text-[#667A9F] mt-1">New accounts are asked to change their initial password on first login.</p>
            </div>
          </div>
        </>
      )}

      {/* Edit modal — uses the existing users/update.php endpoint */}
      <Modal
        open={editTarget !== null}
        title="Edit User"
        description={`Update account details for ${editTarget?.name || 'this user'}.`}
        confirmLabel={savingEdit ? 'Saving...' : 'Save Changes'}
        cancelLabel="Cancel"
        onConfirm={submitEdit}
        onCancel={() => setEditTarget(null)}
        hideActions
      >
        <form onSubmit={submitEdit} className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Full Name</label>
            <input type="text" value={editForm?.name || ''} onChange={e => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls} required />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Email</label>
            <input type="email" value={editForm?.email || ''} onChange={e => setEditForm((f) => ({ ...f, email: e.target.value }))}
              className={inputCls} placeholder="user@xevera.gov.ph" required />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Role</label>
            <select value={editForm?.role || 'Staff'} onChange={e => setEditForm((f) => ({ ...f, role: e.target.value }))}
              className={inputCls}>
              {['Super Admin', 'Admin', 'Staff'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {editTarget?.role === 'Super Admin' && editForm?.role !== 'Super Admin' && (
              <p className="mt-1.5 text-[10px] text-[#B45309]">Demoting this account may be blocked if they are the last active Super Admin.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Reset Password</label>
            <div className="relative">
              <input type={showEditPw ? 'text' : 'password'} value={editForm?.password || ''} onChange={e => setEditForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} className={inputCls + ' pr-11'} placeholder="Leave blank to keep current password" minLength={8} />
              <button type="button" tabIndex={-1} aria-label={showEditPw ? 'Hide password' : 'Show password'} aria-pressed={showEditPw}
                onMouseDown={(e) => e.preventDefault()} onClick={() => setShowEditPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-lg bg-transparent border-0 text-[#7184a3] hover:text-xevera-600 hover:bg-[#F0F4FA] cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" />
                  <circle cx="12" cy="12" r="2.3" />
                  {!showEditPw && <path d="M4 4l16 16" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[#8B98AA]">Minimum 8 characters. Only fill this in to force a password change.</p>
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => setEditTarget(null)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={savingEdit}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-xevera-600 hover:bg-xevera-700 disabled:opacity-50 transition-colors cursor-pointer">
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={deleteTarget !== null}
        title="Remove User"
        description={`Remove ${deleteTarget?.name || 'this user'}? They will lose access to the system.`}
        confirmLabel="Remove User"
        cancelLabel="Cancel"
        danger
        onConfirm={submitDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
