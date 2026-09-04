import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import StatCard from '../../components/dashboard/StatCard';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const STATUSES = ['Pending', 'Waiting', 'Completed'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const STATUS_CLS = {
  Pending: 'bg-[#FEF3C7] text-[#B45309]',
  Waiting: 'bg-[#DBEAFE] text-[#2563EB]',
  Completed: 'bg-success-bg text-success-dark',
};

const PRIORITY_CLS = {
  Low: 'bg-[#F3F4F6] text-[#6B7280]',
  Normal: 'bg-[#E5E7EB] text-[#374151]',
  High: 'bg-[#FEF3C7] text-[#B45309]',
  Urgent: 'bg-[#FEE2E2] text-[#DC2626]',
};

export default function FollowUpsPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [assignables, setAssignables] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ title: '', related_type: 'report', related_id: '', due_date: '', owner_id: '', priority: 'Normal', status: 'Pending', notes: '' });

  const [reports, setReports] = useState([]);
  const [concerns, setConcerns] = useState([]);

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const data = await apiFetch('followups/list.php?' + params.toString());
      setItems(data.items || []);
    } catch {
      setItems([]);
      setError(true);
    }
    apiFetch('followups/stats.php').then(setStats).catch(() => setStats(null));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('users/assignable.php')
      .then((d) => setAssignables(Array.isArray(d) ? d : []))
      .catch(() => setAssignables([]));
  }, []);
  useEffect(() => {
    apiFetch('reports/list.php?limit=100').then((d) => setReports(d.items || [])).catch(() => setReports([]));
    apiFetch('contact/list.php?limit=100').then((d) => setConcerns(d.items || [])).catch(() => setConcerns([]));
  }, []);

  const visible = search.trim()
    ? (items || []).filter((f) => (f.ref_id + ' ' + f.title + ' ' + (f.related_ref || '') + ' ' + (f.owner_name || '')).toLowerCase().includes(search.toLowerCase()))
    : items || [];

  async function act(id, payload, msg) {
    setBusyId(id);
    try {
      await apiFetch('followups/update.php', { method: 'POST', body: { id, ...payload } });
      showToast(msg);
      load();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditing('new');
    setForm({ title: '', related_type: 'report', related_id: '', due_date: '', owner_id: user?.id ? String(user.id) : '', priority: 'Normal', status: 'Pending', notes: '' });
  }

  function openEdit(f) {
    setEditing(f.id);
    setForm({
      title: f.title,
      related_type: f.related_type,
      related_id: String(f.related_id),
      due_date: f.due_date || '',
      owner_id: f.owner_id ? String(f.owner_id) : '',
      priority: f.priority,
      status: f.status,
      notes: f.notes || '',
    });
  }

  async function save() {
    if (!form.title.trim()) {
      showToast('Follow-up title is required.', 'error');
      return;
    }
    if (!form.related_id) {
      showToast('Select a linked report or concern.', 'error');
      return;
    }
    const payload = {
      title: form.title.trim(),
      related_type: form.related_type,
      related_id: Number(form.related_id),
      due_date: form.due_date || null,
      owner_id: form.owner_id || null,
      priority: form.priority,
      status: form.status,
      notes: form.notes.trim(),
    };
    try {
      if (editing === 'new') {
        await apiFetch('followups/create.php', { method: 'POST', body: payload });
        showToast('Follow-up created.');
      } else {
        await apiFetch('followups/update.php', { method: 'POST', body: { id: editing, ...payload } });
        showToast('Follow-up updated.');
      }
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message || 'Save failed.', 'error');
    }
  }

  async function confirmDelete() {
    setBusyId(deleting.id);
    try {
      await apiFetch('followups/delete.php', { method: 'POST', body: { id: deleting.id } });
      showToast('Follow-up deleted.');
      setDeleting(null);
      load();
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const c = stats?.counts || {};
  const demoCount = (items || []).filter((f) => f.is_demo).length;
  const relatedOptions = form.related_type === 'report'
    ? reports.map((r) => ({ value: r.id, label: `${r.ref_id} — ${r.title}` }))
    : concerns.map((m) => ({ value: m.id, label: `Concern #${m.id} — ${m.subject || m.name}` }));

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Requests & Concerns"
        title="Follow-ups"
        description="Track callbacks and next steps linked to existing reports and concerns."
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            <Icon name="plus" size={14} /> Add Follow-up
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Follow-ups" value={c.total ?? '—'} icon="M11 20H4" />
        <StatCard label="Due Today" value={stats?.due_today ?? 0} color="text-xevera-700" tone="#2563EB" icon="M3 10.5 12 3l9 7.5" />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} color={stats?.overdue ? 'text-[#DC2626]' : 'text-[#111827]'} tone={stats?.overdue ? '#DC2626' : '#6B7280'} icon="M12 3 2 20h20L12 3Z" />
        <StatCard label="Completed" value={c.Completed ?? 0} color="text-success-dark" tone="#15803D" icon="M20 6 9 17l-5-5" />
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex flex-col md:flex-row md:items-center gap-3">
          <input type="search" placeholder="Search follow-ups..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-72 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
          <div className="flex gap-1.5 flex-wrap">
            {['All', ...STATUSES].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${statusFilter === f ? 'bg-xevera-600 text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F1F5F9]'}`}>
                {f}
              </button>
            ))}
          </div>
          {demoCount > 0 && (
            <span className="md:ml-auto text-[10px] font-bold text-[#9CA3AF]">{demoCount} demo {demoCount === 1 ? 'record' : 'records'} (safe to delete)</span>
          )}
        </div>

        {!items ? (
          <SkeletonRows rows={8} height="h-14" />
        ) : error ? (
          <div className="p-6"><StaffErrorState message="Unable to load follow-ups." onRetry={load} /></div>
        ) : visible.length === 0 ? (
          <div className="p-6"><StaffEmptyState title="No follow-ups found." description="Create one or adjust your filters." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#6B7280]">
                  <th className="px-4 py-3 font-bold">Follow-up</th>
                  <th className="px-4 py-3 font-bold">Linked To</th>
                  <th className="px-4 py-3 font-bold">Due</th>
                  <th className="px-4 py-3 font-bold">Owner</th>
                  <th className="px-4 py-3 font-bold">Priority</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F5]">
                {visible.map((f) => (
                  <tr key={f.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-bold text-[#172033]">{f.title}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-bold">{f.ref_id}{f.is_demo ? ' · demo' : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-bold text-[#2563EB]">{f.related_ref}</div>
                      <div className="text-[10px] text-[#9CA3AF] max-w-[200px] truncate">{f.related_title || f.related_type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] text-[#4B5563]">{f.due_display || '—'}</div>
                      {f.overdue && <div className="text-[9px] font-bold text-[#DC2626]">Overdue</div>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4B5563]">{f.owner_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_CLS[f.priority] || PRIORITY_CLS.Normal}`}>{f.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[f.status] || STATUS_CLS.Pending}`}>{f.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {f.status !== 'Completed' && (
                          <button onClick={() => act(f.id, { status: 'Completed' }, 'Follow-up completed.')} disabled={busyId === f.id}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-[#E5E7EB] text-[#2563EB] hover:bg-[#DBEAFE] disabled:opacity-50 transition-colors cursor-pointer">
                            Complete →
                          </button>
                        )}
                        <button onClick={() => openEdit(f)} aria-label="Edit follow-up"
                          className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
                          Edit
                        </button>
                        <button onClick={() => setDeleting(f)} aria-label="Delete follow-up"
                          className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer">
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Add Follow-up' : 'Edit Follow-up'}
        description="Follow-ups must link to an existing report or concern."
        confirmLabel={editing === 'new' ? 'Create Follow-up' : 'Save Changes'}
        onConfirm={save}
        onCancel={() => setEditing(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Call resident to confirm resolution"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Link Type</label>
              <select value={form.related_type} onChange={(e) => { setForm({ ...form, related_type: e.target.value, related_id: '' }); }}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="report">Report</option>
                <option value="concern">Concern</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Linked {form.related_type === 'report' ? 'Report' : 'Concern'} *</label>
              <select value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="">Select {form.related_type === 'report' ? 'report' : 'concern'}</option>
                {relatedOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Owner</label>
              <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="">Unassigned</option>
                {assignables.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="Optional notes about the next step"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete Follow-up"
        description={`Delete "${deleting?.title || ''}" (${deleting?.ref_id || ''})? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}