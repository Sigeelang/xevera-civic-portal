import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getToken } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const card = 'bg-[#FFFFFF] rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)]';

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v + 'T00:00:00');
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v.includes(' ') ? v.replace(' ', 'T') : v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
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
  const totalSize = backups.reduce((sum, b) => sum + (b.size_mb || 0), 0);

  const filtered = backups.filter(b => {
    if (filter === 'manual' && b.type !== 'manual') return false;
    if (filter === 'scheduled' && b.type !== 'scheduled') return false;
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = [
    { label: 'Total Backups', value: String(backups.length), sub: 'All time backups', icon: '▤', iconCls: 'bg-[#EAF2FF] text-xevera-600' },
    { label: 'Latest Backup', value: latest ? formatDate(latest.modified) : '—', sub: latest ? formatTime(latest.modified) : 'No backups yet', icon: '✓', iconCls: 'bg-[#E9F9EF] text-[#15904B]' },
    { label: 'Size (All)', value: totalSize > 0 ? totalSize.toFixed(1) + ' MB' : '—', sub: 'Total across backups', icon: '◷', iconCls: 'bg-[#FFF3DF] text-[#E78A00]' },
    { label: 'Status', value: 'Healthy', sub: 'All systems normal', icon: '♢', iconCls: 'bg-[#F1EAFF] text-[#7142E8]' },
  ];

  return (
    <div className="max-w-7xl space-y-5">
      <StaffPageHeader
        eyebrow="Management"
        title="Database Backup"
        description="Create, download, or restore full database snapshots to keep your data safe."
        actions={
          isSuperAdmin ? (
            <button onClick={() => setCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[8px] font-bold text-xs bg-xevera-600 text-white hover:bg-xevera-700 shadow-[0_4px_10px_rgba(23,105,237,0.18)] transition-colors cursor-pointer">
              + Create New Backup
            </button>
          ) : undefined
        }
      />

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-3 bg-white border border-[#E2E7EE] rounded-[12px] p-4">
            <div className={`w-11 h-11 rounded-full grid place-items-center text-lg flex-shrink-0 ${s.iconCls}`}>{s.icon}</div>
            <div className="min-w-0">
              <div className="text-[10px] text-[#68788F]">{s.label}</div>
              <div className="text-[19px] font-bold mt-0.5 text-[#10233F] truncate">{s.value}</div>
              <div className="text-[9px] text-[#8491A4] mt-0.5">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* SECURITY INFO */}
      <div className="flex items-start gap-3 bg-[#F5F9FF] border border-[#BDD5FF] rounded-[11px] p-4">
        <div className="w-8 h-8 rounded-full bg-xevera-600 text-white grid place-items-center font-bold text-xs flex-shrink-0 mt-0.5">i</div>
        <div>
          <strong className="text-xs text-[#15233B]">Full Database Backup</strong>
          <p className="text-[10px] text-[#65758D] mt-1">Full database dumps are stored outside the web root and are only reachable through this page.</p>
        </div>
      </div>

      {/* BACKUP HISTORY */}
      <div className={`${card} overflow-hidden`}>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB]">
          <h2 className="text-base font-head font-extrabold text-[#15233B]">Backup History</h2>
          <div className="flex flex-wrap items-center gap-2.5">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 min-h-[40px] border border-[#DFE5EC] bg-white rounded-[8px] text-[12px] text-[#374151] focus:outline-none focus:ring-2 focus:ring-xevera-600/20 cursor-pointer">
              <option value="all">All Backups</option>
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="⌕ Search backups..." className="w-[210px] max-w-full flex-1 min-w-[160px] px-3 py-2 min-h-[40px] border border-[#DFE5EC] bg-white rounded-[8px] text-[12px] text-[#374151] focus:outline-none focus:ring-2 focus:ring-xevera-600/20" />
          </div>
        </div>

        {loading ? (
          <div className="p-5"><SkeletonRows rows={6} height="h-10" /></div>
        ) : error ? (
          <StaffErrorState message="Unable to load backups." onRetry={load} />
        ) : filtered.length === 0 ? (
          <StaffEmptyState title={search || filter !== 'all' ? 'No backups match your filters.' : 'No backups yet.'} description={search || filter !== 'all' ? 'Adjust your search or filter.' : 'Create one to get started.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#728198] bg-[#F8FAFC] border-b border-[#E5E7EB]">
                  <th className="py-3 px-4 font-bold">Filename</th>
                  <th className="py-3 px-4 font-bold">Date & Time</th>
                  <th className="py-3 px-4 font-bold">Size</th>
                  <th className="py-3 px-4 font-bold">Type</th>
                  <th className="py-3 px-4 font-bold">Description</th>
                  <th className="py-3 px-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.name} className="border-t border-[#EDF0F4] first:border-t-0 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[#182942]">
                        <span className="w-7 h-7 rounded-full bg-[#F3F6FA] text-[#71839B] inline-grid place-items-center text-xs mr-2">▤</span>
                        {b.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#374151] whitespace-nowrap">{formatDateTime(b.modified)}</td>
                    <td className="py-3.5 px-4 text-[#374151] whitespace-nowrap">{b.size_mb} MB</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-1 rounded-md bg-[#EAF2FF] text-xevera-600 text-[9px] font-bold">Full Backup</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7280]">Manual backup</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => downloadBackup(b.name)} className="px-3 py-1.5 rounded-[7px] border border-[#DCE3EB] bg-white text-[#374151] text-[10px] font-bold hover:border-xevera-600 hover:text-xevera-600 transition-colors cursor-pointer">↓ Download</button>
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => setRestoreTarget(b)} disabled={restoring} className="px-3 py-1.5 rounded-[7px] border border-[#DCE3EB] bg-white text-[#374151] text-[10px] font-bold hover:border-[#16A05A] hover:text-[#168343] transition-colors disabled:opacity-50 cursor-pointer">◯ Restore</button>
                            <button onClick={() => deleteBackup(b)} disabled={deleting === b.name} className="px-3 py-1.5 rounded-[7px] border border-[#F0CACA] bg-white text-[#E33E3E] text-[10px] font-bold hover:bg-[#FFF1F1] hover:text-[#C82222] transition-colors disabled:opacity-50 cursor-pointer">♲</button>
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
      </div>

      {/* DATA SECURITY */}
      <div className="flex items-start gap-3 bg-[#F4FCF7] border border-[#C8E8D2] rounded-[11px] p-4">
        <div className="w-9 h-9 rounded-full bg-[#E0F5E7] text-[#15904B] grid place-items-center text-base flex-shrink-0">🔒</div>
        <div>
          <strong className="text-xs text-[#15233B]">Data Security</strong>
          <p className="text-[10px] text-[#66788B] mt-1">All backups are stored securely and are not accessible directly from the server. Please keep your backups in a safe place.</p>
        </div>
      </div>

      {/* CREATE MODAL */}
      <Modal
        open={createOpen}
        title="Create New Backup"
        description="Create a complete snapshot of the XEVERA database."
        confirmLabel={backingUp ? 'Creating...' : 'Create Backup'}
        onConfirm={runBackup}
        onCancel={() => { setCreateOpen(false); setDescription(''); }}
      >
        <label className="block">
          <span className="block text-[10px] font-bold mb-1.5 text-[#617188]">Backup Type</span>
          <select className="w-full px-3 py-2.5 border border-[#DFE5EC] rounded-[8px] text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-xevera-600/20 cursor-pointer">
            <option value="full">Full Database Backup</option>
          </select>
        </label>
        <label className="block mt-4">
          <span className="block text-[10px] font-bold mb-1.5 text-[#617188]">Description</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Example: Before system update" className="w-full px-3 py-2.5 border border-[#DFE5EC] rounded-[8px] text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-xevera-600/20 placeholder:text-[#9CA3AF]" />
        </label>
      </Modal>

      {/* RESTORE MODAL */}
      <Modal
        open={restoreTarget !== null}
        title="Restore Database"
        description={`Restore database from ${restoreTarget?.name || 'this backup'}? Restoring can replace current database data.`}
        confirmLabel={restoring ? 'Restoring...' : 'Restore Database'}
        danger
        onConfirm={confirmRestore}
        onCancel={() => setRestoreTarget(null)}
      >
        <div className="rounded-[9px] bg-[#FFF5F5] border border-[#F0CCCC] text-[#A33131] text-[11px] p-3.5">
          ⚠ This action should only be performed by an authorized administrator.
        </div>
      </Modal>
    </div>
  );
}