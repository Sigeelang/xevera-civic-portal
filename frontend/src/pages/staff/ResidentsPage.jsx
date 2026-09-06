import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const AVATAR_COLORS = ['bg-[#1769E8]', 'bg-[#3D9A70]', 'bg-[#7255CF]', 'bg-[#E77900]', 'bg-[#0E98AC]', 'bg-[#D93588]', 'bg-[#6285AE]'];

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ICONS = {
  users: (
    <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z" /><path d="m9 12 2 2 4-4" /></svg>
  ),
  search: (
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
  ),
  filter: (
    <svg viewBox="0 0 24 24"><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
  ),
};

export default function ResidentsPage() {
  const showToast = useToast();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', address: '', status: 'Active' });
  const [saving, setSaving] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load(q = serverSearch) {
    setLoading(true);
    setError(false);
    const params = q ? '?search=' + encodeURIComponent(q) : '';
    apiFetch('residents/list.php' + params)
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== serverSearch) { setServerSearch(search); setPage(1); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (serverSearch !== undefined) load(serverSearch); }, [serverSearch]);

  async function changeStatus(r) {
    setBusyId(r.id);
    try {
      await apiFetch('residents/toggle.php', { method: 'POST', body: { id: r.id } });
      showToast('Resident status updated.');
      load();
      setEditing(null);
    } catch {
      showToast('Failed to update status.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function submitCreate(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const data = await apiFetch('residents/create.php', { method: 'POST', body: { name: form.name, email: form.email, password: form.password, address: form.address } });
      showToast('Account created for ' + form.name + ' (username: ' + data.username + ')');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', address: '', status: 'Active' });
      load();
    } catch (err) {
      showToast(err.message || 'Failed to create account.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiFetch('residents/delete.php', { method: 'POST', body: { id: deleteTarget.id } });
      setDeleteTarget(null);
      load();
      showToast('Resident removed.');
    } catch {
      showToast('Failed to delete resident.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  /* Client-side status filtering + pagination */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(r => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesQ = !q
        || String(r.name || '').toLowerCase().includes(q)
        || String(r.email || '').toLowerCase().includes(q)
        || String(r.address || '').toLowerCase().includes(q);
      return matchesStatus && matchesQ;
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(r => r.status === 'Active').length,
    inactive: items.filter(r => r.status === 'Inactive').length,
    suspended: items.filter(r => r.status === 'Suspended').length,
  }), [items]);

  const statCards = [
    { iconTint: 'bg-[#EDF5FF] text-[#1769E8]', icon: ICONS.users, value: stats.total, title: 'Total Residents', desc: 'All registered accounts' },
    { iconTint: 'bg-[#E8F8F0] text-[#159C62]', icon: ICONS.check, value: stats.active, title: 'Active Residents', desc: 'Currently active' },
    { iconTint: 'bg-[#FFF6DF] text-[#F59E0B]', icon: ICONS.clock, value: stats.inactive, title: 'Inactive Residents', desc: 'No longer active' },
    { iconTint: 'bg-[#F2EFFF] text-[#7357D8]', icon: ICONS.shield, value: stats.suspended, title: 'Suspended', desc: 'Temporarily suspended' },
  ];

  function statusPill(status) {
    const map = {
      Active: 'bg-[#E8F8F0] text-[#108250]',
      Inactive: 'bg-[#FFF6DF] text-[#D27B00]',
      Suspended: 'bg-[#F2EFFF] text-[#7357D8]',
    };
    return (
      <span className={`inline-flex items-center gap-[7px] px-[13px] py-[7px] rounded-lg text-[11px] font-bold whitespace-nowrap ${map[status] || map.Inactive}`}>
        <span className="w-[7px] h-[7px] rounded-full bg-current"></span>
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(135deg,#F7FAFF 0%,#F3F7FC 100%)' }}>
      <div className="max-w-[1500px] mx-auto px-[30px] lg:px-[40px] py-[30px] max-sm:px-[18px] max-sm:py-[18px]">

        {/* HEADER */}
        <header className="flex justify-between items-start gap-5 mb-[28px] max-sm:flex-col">
          <div className="min-w-0">
            <div className="flex items-center gap-[9px] mb-2.5 text-[#1769E8] text-xs font-extrabold tracking-[1.7px]">
              <span className="w-4 h-4 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{ICONS.users}</span>
              MANAGEMENT
            </div>
            <h1 className="text-[38px] leading-[1.15] font-bold tracking-[-1px] text-[#17294A] max-sm:text-[30px]">Residents Management</h1>
            <p className="mt-3 text-[15px] text-[#61728F]">Manage and monitor all registered resident accounts.</p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="h-12 px-[21px] flex items-center justify-center gap-[9px] rounded-[13px] border-none text-white text-sm font-bold shadow-[0_7px_16px_rgba(23,105,232,0.18)] hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(23,105,232,0.25)] transition-all cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#1976ED,#1262DC)' }}>
            <span className="w-[19px] h-[19px] [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6" /><path d="M16 11h6" /></svg>
            </span>
            Create Account
          </button>
        </header>

        {/* STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[18px] mb-6">
          {statCards.map(s => (
            <div key={s.title} className="min-h-[124px] p-[22px] flex items-center gap-[18px] rounded-[15px] border border-[#E2E9F2] bg-white/95 shadow-[0_5px_18px_rgba(20,47,86,0.045)]">
              <span className={`w-16 h-16 flex-shrink-0 grid place-items-center rounded-[17px] [&>svg]:w-8 [&>svg]:h-8 [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${s.iconTint}`}>
                {s.icon}
              </span>
              <div>
                <div className="mb-[5px] text-[25px] leading-none font-bold text-[#17294A]">{s.value}</div>
                <div className="mb-[7px] text-sm text-[#536784]">{s.title}</div>
                <div className="text-xs text-[#73839D]">{s.desc}</div>
              </div>
            </div>
          ))}
        </section>

        {/* MAIN CARD */}
        <main className="p-5 rounded-[17px] border border-[#E2E9F2] bg-white/95 shadow-[0_7px_25px_rgba(20,47,86,0.05)] max-sm:p-3">

          {/* FILTER BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] md:grid-cols-[minmax(300px,1fr)_160px_120px] gap-3 mb-[18px]">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#637591] w-5 h-5 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{ICONS.search}</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search residents by name, email, or address..."
                className="w-full h-[50px] pl-[47px] pr-[17px] rounded-[11px] border border-[#DBE4EF] bg-white outline-none text-sm text-[#17294A] focus:border-[#1769E8] focus:shadow-[0_0_0_3px_rgba(23,105,232,0.08)] placeholder:text-[#8796AC]" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full h-[50px] pl-[15px] pr-[35px] rounded-[11px] border border-[#DBE4EF] bg-white outline-none appearance-none text-[13px] cursor-pointer">
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
              <span className="absolute right-[14px] top-1/2 -translate-y-1/2 pointer-events-none text-[#536784]">▾</span>
            </div>
            <button onClick={() => { setSearch(''); setStatusFilter('all'); setPage(1); }}
              className="h-[50px] flex items-center justify-center gap-2 rounded-[11px] border border-[#DBE4EF] bg-white text-[13px] font-semibold hover:border-[#1769E8] hover:text-[#1769E8] cursor-pointer max-md:col-span-full">
              <span className="w-[17px] h-[17px] [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{ICONS.filter}</span>
              Filter
            </button>
          </div>

          {/* TABLE */}
          <div className="w-full overflow-x-auto rounded-[14px] border border-[#E3EAF3]">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead className="bg-[#FBFCFE]">
                <tr>
                  {['RESIDENT ↕', 'EMAIL', 'ADDRESS', 'STATUS', 'REGISTERED ON', 'ACTIONS'].map(h => (
                    <th key={h} className="h-[54px] px-5 border-b border-[#E2E9F2] text-left text-[11px] font-extrabold tracking-[0.5px] text-[#617492] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-5"><SkeletonRows rows={5} height="h-12" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={6}><StaffErrorState message="Unable to load residents." onRetry={() => load()} /></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={6}><StaffEmptyState title="No residents found." description="Create an account or adjust your filters." /></td></tr>
                ) : paged.map((r, idx) => (
                  <tr key={r.id} className="transition-colors hover:bg-[#FBFDFF]">
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0">
                      <div className="flex items-center gap-3.5">
                        <span className={`w-9 h-9 flex-shrink-0 grid place-items-center rounded-full text-white text-xs font-extrabold ${AVATAR_COLORS[r.id % AVATAR_COLORS.length]}`}>{initials(r.name)}</span>
                        <span className="text-[15px] font-bold text-[#17294A]">{r.name}</span>
                      </div>
                    </td>
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0 text-[13px] text-[#5C6F8D]">{r.email}</td>
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0">
                      <div className="flex items-center gap-[7px] text-[13px] text-[#536784] whitespace-nowrap">
                        <span className="w-[15px] h-[15px] flex-shrink-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-[#526987] [&>svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{ICONS.pin}</span>
                        {r.address || '—'}
                      </div>
                    </td>
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0">{statusPill(r.status)}</td>
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0">
                      <div className="flex items-center gap-2 text-[13px] text-[#536784] whitespace-nowrap">
                        <span className="w-4 h-4 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-[#5C708F] [&>svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">{ICONS.calendar}</span>
                        {formatDate(r.created_at)}
                      </div>
                    </td>
                    <td className="h-[67px] px-5 border-b border-[#EDF1F6] last:border-b-0">
                      <div className="flex items-center gap-[9px]">
                        <button title="View" onClick={() => setViewTarget(r)}
                          className="w-[42px] h-[42px] grid place-items-center rounded-[9px] border border-[#DBE4EF] bg-white text-[#54708F] hover:border-[#1769E8] hover:text-[#1769E8] hover:bg-[#EDF5FF] transition-colors cursor-pointer [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                          {ICONS.eye}
                        </button>
                        <button title="Edit / Toggle Status" disabled={busyId === r.id} onClick={() => setEditing(r)}
                          className="w-[42px] h-[42px] grid place-items-center rounded-[9px] border border-[#DBE4EF] bg-white text-[#54708F] hover:border-[#1769E8] hover:text-[#1769E8] hover:bg-[#EDF5FF] transition-colors disabled:opacity-50 cursor-pointer [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                          {ICONS.edit}
                        </button>
                        <button title="Delete" disabled={busyId === r.id} onClick={() => setDeleteTarget(r)}
                          className="w-[42px] h-[42px] grid place-items-center rounded-[9px] border border-[#F1CACA] bg-white text-[#DC2626] hover:bg-[#FFF0F0] hover:border-[#EFAAAA] transition-colors disabled:opacity-50 cursor-pointer [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                          {ICONS.trash}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="min-h-[58px] pt-[13px] flex flex-wrap items-center justify-between gap-[15px] max-sm:flex-col max-sm:items-start">
            <div className="text-xs text-[#647692]">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} residents
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="w-[38px] h-[38px] grid place-items-center rounded-[9px] border border-[#DBE4EF] bg-white text-[13px] text-[#4D6483] hover:border-[#1769E8] hover:text-[#1769E8] disabled:opacity-50 cursor-pointer">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-[38px] h-[38px] grid place-items-center rounded-[9px] border text-[13px] cursor-pointer ${n === safePage ? 'border-[#1769E8] bg-[#1769E8] text-white' : 'border-[#DBE4EF] bg-white text-[#4D6483] hover:border-[#1769E8] hover:text-[#1769E8]'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="w-[38px] h-[38px] grid place-items-center rounded-[9px] border border-[#DBE4EF] bg-white text-[13px] text-[#4D6483] hover:border-[#1769E8] hover:text-[#1769E8] disabled:opacity-50 cursor-pointer">›</button>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-[38px] ml-[30px] px-[14px] rounded-[9px] border border-[#DBE4EF] bg-white text-xs cursor-pointer max-sm:ml-0">
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>
          </div>
        </main>

        {/* CREATE MODAL */}
        <Modal
          open={showForm}
          title="Create Resident Account"
          description="Create a resident login so they can submit reports through the portal."
          hideActions
          onCancel={() => setShowForm(false)}
        >
          <form onSubmit={submitCreate} className="flex flex-col gap-[17px]">
            <div>
              <label className="block mb-[7px] text-xs font-bold text-[#526784]">Full Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Enter resident name"
                className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] text-[13px] outline-none focus:border-[#1769E8] focus:shadow-[0_0_0_3px_rgba(23,105,232,0.08)] placeholder:text-[#9AA8BC]" />
            </div>
            <div>
              <label className="block mb-[7px] text-xs font-bold text-[#526784]">Email Address *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="resident@gmail.com"
                className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] text-[13px] outline-none focus:border-[#1769E8] focus:shadow-[0_0_0_3px_rgba(23,105,232,0.08)] placeholder:text-[#9AA8BC]" />
            </div>
            <div>
              <label className="block mb-[7px] text-xs font-bold text-[#526784]">Password *</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] text-[13px] outline-none focus:border-[#1769E8] focus:shadow-[0_0_0_3px_rgba(23,105,232,0.08)]" />
            </div>
            <div>
              <label className="block mb-[7px] text-xs font-bold text-[#526784]">Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Block, Phase, Xevera"
                className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] text-[13px] outline-none focus:border-[#1769E8] focus:shadow-[0_0_0_3px_rgba(23,105,232,0.08)] placeholder:text-[#9AA8BC]" />
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="h-[42px] px-[17px] rounded-[9px] border border-[#D8E2EE] bg-white text-[13px] font-bold hover:bg-[#F1F5F9] cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving}
                className="h-[42px] px-[17px] rounded-[9px] border-none bg-[#1769E8] text-white text-[13px] font-bold hover:bg-[#1256C4] disabled:opacity-60 cursor-pointer">
                {saving ? 'Creating...' : 'Save Account'}
              </button>
            </div>
          </form>
        </Modal>

        {/* EDIT (STATUS) MODAL */}
        {editing && (
          <Modal
            open={editing !== null}
            title="Edit Resident Account"
            description="Account details are managed by the resident. You can switch the account between Active and Inactive."
            hideActions
            onCancel={() => setEditing(null)}
          >
            <div className="flex flex-col gap-[17px]">
              {[['Full Name', editing.name], ['Email Address', editing.email], ['Address', editing.address || '—']].map(([label, value]) => (
                <div key={label}>
                  <label className="block mb-[7px] text-xs font-bold text-[#526784]">{label}</label>
                  <input type="text" value={value} readOnly
                    className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] bg-[#FBFCFE] text-[13px] text-[#61728F] outline-none cursor-not-allowed" />
                </div>
              ))}
              <div>
                <label className="block mb-[7px] text-xs font-bold text-[#526784]">Account Status</label>
                <select value={editing.status === 'Active' ? 'Active' : 'Inactive'} disabled
                  className="w-full h-[45px] px-[13px] rounded-[9px] border border-[#D8E2EE] bg-[#FBFCFE] text-[13px] text-[#61728F] outline-none cursor-not-allowed">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button onClick={() => setEditing(null)}
                  className="h-[42px] px-[17px] rounded-[9px] border border-[#D8E2EE] bg-white text-[13px] font-bold hover:bg-[#F1F5F9] cursor-pointer">Cancel</button>
                <button onClick={() => changeStatus(editing)} disabled={busyId === editing.id}
                  className="h-[42px] px-[17px] rounded-[9px] border-none bg-[#1769E8] text-white text-[13px] font-bold hover:bg-[#1256C4] disabled:opacity-60 cursor-pointer">
                  {busyId === editing.id ? 'Saving...' : (editing.status === 'Active' ? 'Set Inactive' : 'Set Active')}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* DETAILS MODAL */}
        {viewTarget && (
          <Modal
            open={viewTarget !== null}
            title="Resident Details"
            hideActions
            onCancel={() => setViewTarget(null)}
          >
            <div className="grid gap-[15px]">
              {[['FULL NAME', viewTarget.name], ['USERNAME', viewTarget.username || '—'], ['EMAIL ADDRESS', viewTarget.email], ['ADDRESS', viewTarget.address || '—'], ['STATUS', viewTarget.status], ['REGISTERED ON', formatDate(viewTarget.created_at)]].map(([label, value]) => (
                <div key={label} className="p-[13px] rounded-[10px] border border-[#E3EAF3] bg-[#FBFCFE]">
                  <div className="mb-[5px] text-[10px] font-bold uppercase tracking-wide text-[#71819A]">{label}</div>
                  <div className="text-sm text-[#17294A]">{value}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-[18px]">
              <button onClick={() => setViewTarget(null)}
                className="h-[42px] px-[17px] rounded-[9px] border border-[#D8E2EE] bg-white text-[13px] font-bold hover:bg-[#F1F5F9] cursor-pointer">Close</button>
            </div>
          </Modal>
        )}

        {/* DELETE CONFIRM */}
        <Modal
          open={deleteTarget !== null}
          title="Remove Resident"
          description={`Remove ${deleteTarget?.name || 'this resident'}'s account? They will no longer be able to sign in.`}
          confirmLabel={busyId === deleteTarget?.id ? 'Removing...' : 'Remove Resident'}
          cancelLabel="Cancel"
          danger
          onConfirm={submitDelete}
          onCancel={() => setDeleteTarget(null)}
        />

      </div>
    </div>
  );
}
