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
import { formatPhoneLive, normalizePhMobile } from '../../utils/phone';

const STATUSES = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const CATEGORIES = ['Document Request', 'Streetlight', 'Waste', 'Water', 'Maintenance', 'Facility', 'Other'];

const STATUS_CLS = {
  Pending: 'bg-[#FEF3C7] text-[#B45309]',
  Assigned: 'bg-[#DBEAFE] text-[#2563EB]',
  'In Progress': 'bg-[#EDE9FE] text-[#7C3AED]',
  Completed: 'bg-success-bg text-success-dark',
  Cancelled: 'bg-[#F3F4F6] text-[#6B7280]',
};

const PRIORITY_CLS = {
  Low: 'bg-[#F3F4F6] text-[#6B7280]',
  Normal: 'bg-[#E5E7EB] text-[#374151]',
  High: 'bg-[#FEF3C7] text-[#B45309]',
  Urgent: 'bg-[#FEE2E2] text-[#DC2626]',
};

const NEXT_STATUS = {
  Pending: 'Assigned',
  Assigned: 'In Progress',
  'In Progress': 'Completed',
};

export default function ServiceRequestsPage() {
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
  const [form, setForm] = useState({ title: '', category: '', location: '', resident_name: '', resident_email: '', resident_phone: '', priority: 'Normal', status: 'Pending', assigned_to: '', notes: '' });

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const data = await apiFetch('service_requests/list.php?' + params.toString());
      setItems(data.items || []);
    } catch {
      setItems([]);
      setError(true);
    }
    apiFetch('service_requests/stats.php').then(setStats).catch(() => setStats(null));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('users/assignable.php')
      .then((d) => setAssignables(Array.isArray(d) ? d : []))
      .catch(() => setAssignables([]));
  }, []);

  const visible = search.trim()
    ? (items || []).filter((r) => (r.ref_id + ' ' + r.title + ' ' + (r.resident_name || '') + ' ' + (r.location || '')).toLowerCase().includes(search.toLowerCase()))
    : items || [];

  async function act(id, payload, msg) {
    setBusyId(id);
    try {
      await apiFetch('service_requests/update.php', { method: 'POST', body: { id, ...payload } });
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
    setForm({ title: '', category: '', location: '', resident_name: '', resident_email: '', resident_phone: '', priority: 'Normal', status: 'Pending', assigned_to: user?.id ? String(user.id) : '', notes: '' });
  }

  function openEdit(r) {
    setEditing(r.id);
    setForm({
      title: r.title,
      category: r.category || '',
      location: r.location || '',
      resident_name: r.resident_name || '',
      resident_email: r.resident_email || '',
      resident_phone: r.resident_phone || '',
      priority: r.priority,
      status: r.status,
      assigned_to: r.assigned_to ? String(r.assigned_to) : '',
      notes: r.notes || '',
    });
  }

  async function save() {
    if (!form.title.trim()) {
      showToast('Service request title is required.', 'error');
      return;
    }
    if (!form.resident_name.trim()) {
      showToast('Resident name is required.', 'error');
      return;
    }
    if (String(form.resident_phone || '').trim() && !/^09\d{9}$/.test(String(form.resident_phone).trim())) {
      showToast('Phone number must be 11 digits starting with 09.', 'error');
      return;
    }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      location: form.location.trim(),
      resident_name: form.resident_name.trim(),
      resident_email: form.resident_email.trim(),
      resident_phone: form.resident_phone.trim(),
      priority: form.priority,
      status: form.status,
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim(),
    };
    try {
      if (editing === 'new') {
        await apiFetch('service_requests/create.php', { method: 'POST', body: payload });
        showToast('Service request created.');
      } else {
        await apiFetch('service_requests/update.php', { method: 'POST', body: { id: editing, ...payload } });
        showToast('Service request updated.');
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
      await apiFetch('service_requests/delete.php', { method: 'POST', body: { id: deleting.id } });
      showToast('Service request deleted.');
      setDeleting(null);
      load();
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const c = stats?.counts || {};
  const demoCount = (items || []).filter((r) => r.is_demo).length;

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Requests & Concerns"
        title="Service Requests"
        description="Track resident service requests from intake to completion."
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            <Icon name="plus" size={14} /> New Service Request
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Requests" value={c.total ?? '—'} icon="M22 12h-6l-2 3h-4l-2-3H2" />
        <StatCard label="Pending" value={c.Pending ?? 0} color="text-[#B45309]" tone="#B45309" icon="M12 3 2 20h20L12 3Z" />
        <StatCard label="In Progress" value={(c.Assigned ?? 0) + (c['In Progress'] ?? 0)} color="text-xevera-700" tone="#2563EB" icon="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        <StatCard label="Completed" value={c.Completed ?? 0} color="text-success-dark" tone="#15803D" icon="M20 6 9 17l-5-5" />
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex flex-col md:flex-row md:items-center gap-3">
          <input type="search" placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)}
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
          <div className="p-6"><StaffErrorState message="Unable to load service requests." onRetry={load} /></div>
        ) : visible.length === 0 ? (
          <div className="p-6"><StaffEmptyState title="No service requests found." description="Create one or adjust your filters." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-[#6B7280]">
                  <th className="px-4 py-3 font-bold">Request</th>
                  <th className="px-4 py-3 font-bold">Resident</th>
                  <th className="px-4 py-3 font-bold">Location</th>
                  <th className="px-4 py-3 font-bold">Priority</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Assigned</th>
                  <th className="px-4 py-3 font-bold">Submitted</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F5]">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-bold text-[#172033]">{r.title}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-bold">{r.ref_id}{r.is_demo ? ' · demo' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4B5563]">
                      {r.resident_name || '—'}
                      {r.resident_phone && <div className="text-[10px] text-[#9CA3AF]">{r.resident_phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4B5563]">{r.location || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_CLS[r.priority] || PRIORITY_CLS.Normal}`}>{r.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[r.status] || STATUS_CLS.Pending}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#4B5563]">{r.assigned_name}</td>
                    <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {NEXT_STATUS[r.status] && (
                          <button onClick={() => act(r.id, { status: NEXT_STATUS[r.status] }, `Service request marked ${NEXT_STATUS[r.status]}.`)} disabled={busyId === r.id}
                            className="px-2.5 py-1 min-h-[40px] rounded-md text-[11px] font-bold border border-[#E5E7EB] text-[#2563EB] hover:bg-[#DBEAFE] disabled:opacity-50 transition-colors cursor-pointer">
                            {NEXT_STATUS[r.status] === 'Completed' ? 'Complete' : NEXT_STATUS[r.status]} →
                          </button>
                        )}
                        {r.status !== 'Cancelled' && r.status !== 'Completed' && (
                          <button onClick={() => act(r.id, { status: 'Cancelled' }, 'Service request cancelled.')} disabled={busyId === r.id}
                            className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors cursor-pointer">
                            Cancel
                          </button>
                        )}
                        <button onClick={() => openEdit(r)} aria-label="Edit request"
                          className="px-2 py-1 min-h-[40px] rounded-md text-[11px] font-bold border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
                          Edit
                        </button>
                        <button onClick={() => setDeleting(r)} aria-label="Delete request"
                          className="px-2 py-1 min-h-[40px] rounded-md text-[11px] font-bold border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer">
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
        title={editing === 'new' ? 'New Service Request' : 'Edit Service Request'}
        description="Fill in the service request details."
        confirmLabel={editing === 'new' ? 'Create Request' : 'Save Changes'}
        onConfirm={save}
        onCancel={() => setEditing(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Service Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Streetlight repair"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="">Select category</option>
                {CATEGORIES.map((c2) => <option key={c2} value={c2}>{c2}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Location</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Phase 2, Block 4"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Resident Name *</label>
              <input value={form.resident_name} onChange={(e) => setForm({ ...form, resident_name: e.target.value })}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Resident Phone</label>
                      <input type="tel" inputMode="numeric" maxLength={11} value={form.resident_phone} onChange={(e) => setForm({ ...form, resident_phone: formatPhoneLive(e.target.value) })} onBlur={(e) => setForm({ ...form, resident_phone: normalizePhMobile(e.target.value) })}
                placeholder="09XX XXX XXXX"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Resident Email</label>
              <input value={form.resident_email} onChange={(e) => setForm({ ...form, resident_email: e.target.value })}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
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
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Assign to</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="">Unassigned</option>
                {assignables.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="Optional internal notes"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        title="Delete Service Request"
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