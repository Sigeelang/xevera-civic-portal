import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getToken } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState } from '../../components/staff/StaffStates';

const cardBase = 'rounded-[12px] border border-[#DCE5F0] bg-white shadow-[0_1px_2px_rgba(7,27,54,0.05)]';

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDay(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeAge(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v);
  if (isNaN(d.getTime())) return '—';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

function typeLabel(type) {
  const t = String(type || 'manual').toLowerCase();
  if (t === 'scheduled') return 'Scheduled';
  if (t === 'auto') return 'Automatic';
  return 'Manual';
}

function formatSize(mb) {
  const n = Number(mb) || 0;
  if (n <= 0) return '0 B';
  if (n < 1) return (n * 1024).toFixed(0) + ' KB';
  return n.toFixed(2) + ' MB';
}

export default function BackupPage() {
  const showToast = useToast();
  const { user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const isSuperAdmin = user?.role === 'Super Admin';

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch('maintenance/backups.php')
      .then(d => setBackups(d.items || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runBackup() {
    setBackingUp(true);
    try {
      const data = await apiFetch('maintenance/backup.php', { method: 'POST', body: { description } });
      showToast('Backup created: ' + data.file);
      setCreateOpen(false);
      setDescription('');
      await load();
    } catch {
      showToast('Backup failed.', 'error');
    } finally {
      setBackingUp(false);
    }
  }

  async function downloadBackup(name) {
    try {
      const res = await fetch('/api/maintenance/download.php?name=' + encodeURIComponent(name), {
        headers: { Authorization: 'Bearer ' + (getToken() || '') },
      });
      if (!res.ok) throw new Error('Download failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not download backup.', 'error');
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    const name = restoreTarget.name;
    setRestoring(true);
    try {
      const clean = name.replace(/\.sql$/i, '');
      await apiFetch('maintenance/restore.php', { method: 'POST', body: { name: clean } });
      showToast('Database restored from ' + name);
      setRestoreTarget(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Restore failed.', 'error');
    } finally {
      setRestoring(false);
    }
  }

  async function deleteBackup(b) {
    if (deleting) return;
    if (!window.confirm('Delete this backup?\n\n' + b.name)) return;
    setDeleting(b.name);
    try {
      await apiFetch('maintenance/delete.php', { method: 'POST', body: { name: b.name } });
      showToast('Backup deleted.');
      await load();
    } catch (e) {
      showToast(e.message || 'Could not delete backup.', 'error');
    } finally {
      setDeleting(null);
    }
  }

  const latest = backups[0] || null;
  const oldest = backups.length ? backups[backups.length - 1] : null;
  const totalSize = backups.reduce((sum, b) => sum + (b.size_mb || 0), 0);

  const filtered = backups.filter(b => {
    if (filter === 'manual' && b.type !== 'manual') return false;
    if (filter === 'scheduled' && b.type !== 'scheduled') return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isFiltered = Boolean(search) || filter !== 'all';

  const stats = [
    {
      label: 'Total Backups',
      value: String(backups.length),
      sub: 'Snapshots stored',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
      ),
      iconCls: 'bg-[#EAF2FF] text-[#1261F5]',
    },
    {
      label: 'Latest Backup',
      value: latest ? formatDay(latest.modified) : '—',
      sub: latest ? relativeAge(latest.modified) : 'No backups yet',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      ),
      iconCls: 'bg-[#EAF7EF] text-[#0F9B5A]',
    },
    {
      label: 'Total Size',
      value: formatSize(totalSize),
      sub: 'Across all backups',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18" /><path d="M5 8h14" /><path d="M5 16h14" /></svg>
      ),
      iconCls: 'bg-[#FFF6E6] text-[#C77A08]',
    },
    {
      label: 'Oldest Backup',
      value: oldest ? formatDay(oldest.modified) : '—',
      sub: oldest ? relativeAge(oldest.modified) : 'No backups yet',
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V4h6v3" /></svg>
      ),
      iconCls: 'bg-[#EEF1FF] text-[#3D56C7]',
    },
  ];

  return (
    <div className="max-w-[1400px] space-y-5">

      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12px] text-[#64789A]">
            <span>Management</span>
            <span className="text-[#B3C1D4]" aria-hidden="true">/</span>
            <span className="font-semibold text-[#0B2A52]">Database Backup</span>
          </nav>
          <h1 className="mt-2 text-[26px] leading-tight font-extrabold tracking-[-0.4px] text-[#071B36]">Database Backup</h1>
          <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#5C718C]">
            Create, download, or restore full database snapshots to keep your data safe.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-[42px] items-center justify-center gap-2 self-start whitespace-nowrap rounded-[8px] border border-[#1261F5] bg-[#1261F5] px-4 text-[13px] font-bold text-white shadow-[0_1px_2px_rgba(7,27,54,0.16)] transition-colors cursor-pointer hover:bg-[#0B4FC4] hover:border-[#0B4FC4] active:bg-[#0A46AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1261F5]/35 focus-visible:ring-offset-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Create New Backup
          </button>
        )}
      </div>

      {/* ================= STATISTICS ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${cardBase} flex items-center gap-3.5 p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(7,27,54,0.08)]`}>
            <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px] ${s.iconCls}`}>{s.icon}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.2px] text-[#64789A]">{s.label}</div>
              <div className="mt-0.5 truncate text-[20px] font-extrabold leading-tight text-[#071B36]">{s.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-[#8298B5]">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= INFORMATION NOTICE ================= */}
      {noticeOpen && (
        <div className="flex items-start gap-3 rounded-[12px] border border-[#CBDEFF] bg-[#F2F7FF] px-4 py-3.5">
          <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#1261F5] text-[12px] font-extrabold text-white" aria-hidden="true">i</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-[#0B2A52]">Full Database Backup</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#5C718C]">
              Full database dumps are stored outside the web root and are only accessible through this page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoticeOpen(false)}
            aria-label="Dismiss notice"
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] border-0 bg-transparent text-[#7C93B3] transition-colors cursor-pointer hover:bg-[#E2EDFF] hover:text-[#0B2A52]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}

      {/* ================= BACKUP HISTORY ================= */}
      <section className={cardBase}>
        <header className="flex flex-col gap-3 border-b border-[#E4EBF4] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-extrabold text-[#071B36]">Backup History</h2>
            <p className="mt-1 text-[12.5px] text-[#64789A]">View and manage all database backups.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label="Filter backups"
              className="h-[38px] min-w-[130px] cursor-pointer rounded-[8px] border border-[#DCE5F0] bg-white px-3 text-[12.5px] font-medium text-[#2B4568] transition-colors focus:border-[#1261F5] focus:outline-none focus:ring-2 focus:ring-[#1261F5]/15"
            >
              <option value="all">All Backups</option>
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <div className="flex h-[38px] min-w-[180px] flex-1 items-center gap-2 rounded-[8px] border border-[#DCE5F0] bg-white px-3 transition-colors focus-within:border-[#1261F5] focus-within:ring-2 focus-within:ring-[#1261F5]/15">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C93B3" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search backups..."
                aria-label="Search backups"
                className="h-full w-full border-0 bg-transparent text-[12.5px] text-[#2B4568] placeholder:text-[#98AAC2] focus:outline-none"
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="p-5"><SkeletonRows rows={6} height="h-10" /></div>
        ) : error ? (
          <div className="p-5">
            <StaffEmptyState title="Unable to load backups." description="Please retry in a moment." />
            <div className="mt-2 flex justify-center">
              <button onClick={load} className="h-[38px] rounded-[8px] border border-[#DCE5F0] bg-white px-4 text-[12.5px] font-bold text-[#2B4568] transition-colors cursor-pointer hover:border-[#1261F5] hover:text-[#1261F5]">Retry</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          /* ---- Empty state (compact, table-like) ---- */
          <div className="px-5 py-12 text-center">
            <span className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-[12px] border border-[#DCE5F0] bg-[#F5F8FC] text-[#7C93B3]" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
            </span>
            <h3 className="m-0 text-[14px] font-bold text-[#071B36]">
              {isFiltered ? 'No backups match your filters.' : 'No backups yet.'}
            </h3>
            <p className="mx-auto mt-1.5 max-w-[380px] text-[12.5px] leading-relaxed text-[#64789A]">
              {isFiltered ? 'Adjust your search or filter to find a backup.' : 'Create a backup to get started and keep your data safe.'}
            </p>
            {isSuperAdmin && !isFiltered && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 inline-flex h-[40px] items-center justify-center gap-2 rounded-[8px] border border-[#1261F5] bg-[#1261F5] px-4 text-[12.5px] font-bold text-white shadow-[0_1px_2px_rgba(7,27,54,0.16)] transition-colors cursor-pointer hover:bg-[#0B4FC4] hover:border-[#0B4FC4]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Create New Backup
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E4EBF4] bg-[#F8FAFD] text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#6B809B]">
                  <th className="w-[52px] px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">Filename</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Size</th>
                  <th className="px-4 py-3 font-bold">Created At</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, i) => (
                  <tr key={b.name} className="border-b border-[#EDF2F8] transition-colors last:border-b-0 hover:bg-[#F8FAFD]">
                    <td className="px-4 py-3.5 text-[12.5px] tabular-nums text-[#7C93B3]">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[7px] bg-[#F1F5FA] text-[#7C93B3]" aria-hidden="true">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M6 3h8l5 5v13H6z" /></svg>
                        </span>
                        <span className="truncate text-[12.5px] font-bold text-[#0B2A52]">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block rounded-[6px] px-2 py-[3px] text-[10.5px] font-bold ${
                        b.type === 'scheduled' ? 'bg-[#FFF6E6] text-[#A96A05]' : 'bg-[#EAF2FF] text-[#1261F5]'
                      }`}>{typeLabel(b.type)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[12.5px] tabular-nums text-[#2B4568]">{formatSize(b.size_mb)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-[#64789A]">{formatDateTime(b.modified)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#EAF7EF] px-2 py-[3px] text-[10.5px] font-bold text-[#0F9B5A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0F9B5A]" aria-hidden="true" />
                        Stored
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadBackup(b.name)}
                          className="h-[32px] rounded-[7px] border border-[#DCE5F0] bg-white px-3 text-[11.5px] font-bold text-[#2B4568] transition-colors cursor-pointer hover:border-[#1261F5] hover:text-[#1261F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1261F5]/25"
                        >
                          Download
                        </button>
                        {isSuperAdmin && (
                          <>
                            <button
                              onClick={() => setRestoreTarget(b)}
                              disabled={restoring}
                              className="h-[32px] rounded-[7px] border border-[#DCE5F0] bg-white px-3 text-[11.5px] font-bold text-[#2B4568] transition-colors cursor-pointer hover:border-[#0F9B5A] hover:text-[#0F9B5A] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => deleteBackup(b)}
                              disabled={deleting === b.name}
                              aria-label={`Delete ${b.name}`}
                              className="inline-flex h-[32px] items-center gap-1.5 rounded-[7px] border border-[#F2D2D2] bg-white px-3 text-[11.5px] font-bold text-[#D93B3B] transition-colors cursor-pointer hover:bg-[#FFF4F4] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                              {deleting === b.name ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================= DATA SECURITY ================= */}
      <div className="flex flex-col gap-3 rounded-[12px] border border-[#CDEBD8] bg-[#F1FBF5] px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[#D9F2E3] text-[#0F9B5A]" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5.5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[#0B3D28]">Data Security</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#3F6B58]">
              All backups are stored securely and are not accessible directly from the public web server. Please keep your backups in a safe place.
            </p>
          </div>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-full border border-[#A9DFC0] bg-[#E2F6EA] px-3 py-1 text-[11px] font-bold text-[#0F7C49] sm:self-center">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F9B5A]" aria-hidden="true" />
          Secure Storage
        </span>
      </div>

      {/* ================= CREATE MODAL ================= */}
      <Modal
        open={createOpen}
        title="Create New Backup"
        description="Create a complete snapshot of the Xevera database."
        confirmLabel={backingUp ? 'Creating...' : 'Create Backup'}
        onConfirm={runBackup}
        onCancel={() => { setCreateOpen(false); setDescription(''); }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold text-[#617188]">Backup Type</span>
          <select className="w-full cursor-pointer rounded-[8px] border border-[#DFE5EC] bg-white px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-xevera-600/20">
            <option value="full">Full Database Backup</option>
          </select>
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-bold text-[#617188]">Description</span>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Example: Before system update"
            className="w-full rounded-[8px] border border-[#DFE5EC] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-xevera-600/20"
          />
        </label>
      </Modal>

      {/* ================= RESTORE MODAL ================= */}
      <Modal
        open={restoreTarget !== null}
        title="Restore Database"
        description={`Restore the database from ${restoreTarget?.name || 'this backup'}? This replaces the current database data.`}
        confirmLabel={restoring ? 'Restoring...' : 'Restore Database'}
        danger
        onConfirm={confirmRestore}
        onCancel={() => setRestoreTarget(null)}
      >
        <div className="rounded-[9px] border border-[#F0CCCC] bg-[#FFF5F5] p-3.5 text-[11px] leading-relaxed text-[#A33131]">
          This action overwrites live data and should only be performed by an authorized administrator. Create a fresh backup first if you are unsure.
        </div>
      </Modal>
    </div>
  );
}
