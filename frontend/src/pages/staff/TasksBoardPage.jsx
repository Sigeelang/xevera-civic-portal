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

const COLUMNS = [
  { key: 'To Do', color: '#B45309', bg: '#FEF3C7' },
  { key: 'In Progress', color: '#2563EB', bg: '#DBEAFE' },
  { key: 'Done', color: '#15803D', bg: '#DCFCE7' },
];

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const PRIORITY_CLS = {
  Low: 'bg-[#F3F4F6] text-[#6B7280]',
  Normal: 'bg-[#E5E7EB] text-[#374151]',
  High: 'bg-[#FEF3C7] text-[#B45309]',
  Urgent: 'bg-[#FEE2E2] text-[#DC2626]',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TasksBoardPage({ preset }) {
  const { user } = useAuth();
  const showToast = useToast();
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [assignables, setAssignables] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', column: 'To Do', priority: 'Normal', assigned_to: '', due_date: '' });

  const PRESETS = {
    my: { title: 'My Tasks', description: 'Tasks currently assigned to you.' },
    upcoming: { title: 'Upcoming Tasks', description: 'Open tasks that still need attention.' },
    completed: { title: 'Completed Tasks', description: 'Tasks that have been marked as done.' },
  };
  const presetMeta = PRESETS[preset] || null;

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const data = await apiFetch('tasks/list.php?limit=100');
      setItems(data.items || []);
    } catch {
      setItems([]);
      setError(true);
    }
    apiFetch('tasks/stats.php').then(setStats).catch(() => setStats(null));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('users/assignable.php')
      .then((d) => setAssignables(Array.isArray(d) ? d : []))
      .catch(() => setAssignables([]));
  }, []);

  async function act(id, payload, msg) {
    setBusyId(id);
    try {
      await apiFetch('tasks/update.php', { method: 'POST', body: { id, ...payload } });
      showToast(msg);
      load();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function move(t, nextColumn) {
    const label = { 'To Do': 'moved to To Do', 'In Progress': 'started', Done: 'completed' }[nextColumn] || `moved to ${nextColumn}`;
    act(t.id, { column: nextColumn }, `Task "${t.title}" ${label}.`);
  }

  function openCreate() {
    setEditing('new');
    setForm({ title: '', description: '', column: 'To Do', priority: 'Normal', assigned_to: user?.id ? String(user.id) : '', due_date: '' });
  }

  function openEdit(t) {
    setEditing(t.id);
    setForm({
      title: t.title,
      description: t.description || '',
      column: t.column,
      priority: t.priority,
      assigned_to: t.assigned_to ? String(t.assigned_to) : '',
      due_date: t.due_date || '',
    });
  }

  async function save() {
    if (!form.title.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      column: form.column,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
    };
    try {
      if (editing === 'new') {
        await apiFetch('tasks/create.php', { method: 'POST', body: payload });
        showToast('Task created.');
      } else {
        await apiFetch('tasks/update.php', { method: 'POST', body: { id: editing, ...payload } });
        showToast('Task updated.');
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
      await apiFetch('tasks/delete.php', { method: 'POST', body: { id: deleting.id } });
      showToast('Task deleted.');
      setDeleting(null);
      load();
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const weekStart = startOfWeek();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = dayKey(new Date());

  const visible = (items || []).filter((t) => {
    if (preset === 'my') return String(t.assigned_to) === String(user?.id);
    if (preset === 'upcoming') return t.column !== 'Done' && (!t.due_date || t.due_date >= todayKey);
    if (preset === 'completed') return t.column === 'Done';
    return true;
  });
  const byColumn = (key) => visible.filter((t) => t.column === key);

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Work"
        title={presetMeta ? presetMeta.title : 'Tasks Board'}
        description={presetMeta ? presetMeta.description : "Track your team's work, assign owners, and keep due dates on target."}
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            <Icon name="plus" size={14} /> New Task
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={stats?.counts?.total ?? '—'} icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
        <StatCard label="In Progress" value={stats?.counts?.['In Progress'] ?? '—'} color="text-xevera-700" tone="#2563EB" icon="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        <StatCard label="Done" value={stats?.counts?.Done ?? '—'} color="text-success-dark" tone="#15803D" icon="M20 6 9 17l-5-5" />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} color={stats?.overdue ? 'text-[#DC2626]' : 'text-[#111827]'} tone={stats?.overdue ? '#DC2626' : '#6B7280'} icon="M12 3 2 20h20L12 3Z" />
      </div>

      {/* Weekly calendar strip */}
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5">
        <h4 className="text-sm font-head font-extrabold mb-3">This Week</h4>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d) => {
            const k = dayKey(d);
            const dayTasks = visible.filter((t) => t.due_date === k);
            const isToday = k === todayKey;
            return (
              <div key={k} className={`min-h-[70px] rounded-lg border p-1.5 ${isToday ? 'bg-xevera-600 border-xevera-600 text-white' : 'bg-[#F9FAFB] border-[#F1F5F9]'}`}>
                <div className="text-[10px] font-bold flex items-center justify-between">
                  <span>{DOW[d.getDay()]}</span>
                  <span>{d.getDate()}</span>
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div key={t.id} title={t.title}
                      className={`h-1.5 rounded-full ${isToday ? 'bg-white/80' : t.column === 'Done' ? 'bg-success' : t.priority === 'Urgent' ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`} />
                  ))}
                  {dayTasks.length > 3 && (
                    <div className={`text-[9px] font-bold ${isToday ? 'text-white/80' : 'text-[#6B7280]'}`}>+{dayTasks.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban board */}
      {!items ? (
        <SkeletonRows rows={6} height="h-16" />
      ) : error ? (
        <StaffErrorState message="Unable to load tasks." onRetry={load} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map((col) => {
            const tasks = byColumn(col.key);
            return (
              <div key={col.key} className="bg-[#F8FAFC] rounded-xl border border-[#E5E7EB] p-3">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                  <span className="text-xs font-extrabold text-[#172033]">{col.key}</span>
                  <span className="ml-auto text-[10px] font-bold bg-white border border-[#E5E7EB] rounded-full px-2 py-0.5 text-[#6B7280]">{tasks.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {tasks.length === 0 ? (
                    <div className="bg-white rounded-lg border border-dashed border-[#D1D5DB]">
                      <StaffEmptyState title="No tasks here yet." />
                    </div>
                  ) : (
                    tasks.map((t) => (
                      <div key={t.id} className="bg-white rounded-lg border border-[#E5E7EB] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-bold text-[#172033] leading-snug">{t.title}</div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_CLS[t.priority] || PRIORITY_CLS.Normal}`}>{t.priority}</span>
                              {t.overdue && <span className="text-[9px] font-bold text-[#DC2626]">Overdue</span>}
                            </div>
                            {t.description && <p className="mt-1.5 text-[11px] text-[#6B7280] leading-snug line-clamp-2">{t.description}</p>}
                            <div className="mt-2 text-[10px] text-[#718096] flex items-center gap-1 flex-wrap">
                              <Icon name="user" size={11} />
                              <span>{t.assigned_name}</span>
                              {t.due_date && (
                                <span className="ml-auto flex items-center gap-1">
                                  <Icon name="calendar" size={11} />
                                  {t.due_display}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          {col.key !== 'To Do' && (
                            <button onClick={() => move(t, 'To Do')} disabled={busyId === t.id}
                              className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors cursor-pointer">
                              ←
                            </button>
                          )}
                          {col.key !== 'Done' && (
                            <button onClick={() => move(t, col.key === 'To Do' ? 'In Progress' : 'Done')} disabled={busyId === t.id}
                              className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#E5E7EB] text-[#2563EB] hover:bg-[#DBEAFE] disabled:opacity-50 transition-colors cursor-pointer">
                              {col.key === 'To Do' ? 'Start' : 'Complete'} →
                            </button>
                          )}
                          <button onClick={() => openEdit(t)} aria-label="Edit task"
                            className="ml-auto px-2 py-1 rounded-md text-[10px] font-bold border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
                            Edit
                          </button>
                          <button onClick={() => setDeleting(t)} aria-label="Delete task"
                            className="px-2 py-1 rounded-md text-[10px] font-bold border border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer">
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New Task' : 'Edit Task'}
        description="Fill in the task details."
        confirmLabel={editing === 'new' ? 'Create Task' : 'Save Changes'}
        onConfirm={save}
        onCancel={() => setEditing(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="Optional details"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Column</label>
              <select value={form.column} onChange={(e) => setForm({ ...form, column: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
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
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Assign to</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                <option value="">Unassigned</option>
                {assignables.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] mb-1">Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleting !== null}
        title="Delete Task"
        description={`Delete "${deleting?.title || ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}