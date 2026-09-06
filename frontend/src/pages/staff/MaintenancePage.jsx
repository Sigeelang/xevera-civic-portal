import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';

const card = 'bg-[#FFFFFF] rounded-[14px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(20,40,70,0.04)] p-3.5';
const inputCls = 'w-full h-[40px] px-3 border border-[#D6E0EB] rounded-[8px] bg-white text-xs text-[#26384F] focus:border-xevera-600 focus:outline-none';

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-[31px] h-[18px] rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-[#16A05A]' : 'bg-[#CBD4DF]'}`}>
      <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${checked ? 'left-[15px]' : 'left-[2px]'}`} />
    </button>
  );
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatRange(start, end) {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'No schedule set';
  const dateStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ts = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const te = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return dateStr + ' · ' + ts + ' - ' + te;
}

function statusBadge(status) {
  if (status === 'completed') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#EAF8EF] text-[#16A05A] text-[9px] font-bold">Completed</span>;
  if (status === 'running') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#FFF7E7] text-[#F59E0B] text-[9px] font-bold">Running</span>;
  if (status === 'scheduled') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#EEF6FF] text-[#1769ED] text-[9px] font-bold">Scheduled</span>;
  if (status === 'cancelled') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#DC3C3C] text-[9px] font-bold">Cancelled</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full bg-[#F1F3F6] text-[#718096] text-[9px] font-bold">{status}</span>;
}

export default function MaintenancePage() {
  const showToast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({ start: '', end: '', reason: '', repeat: 'Does not repeat', showNotice: true, notifyAdmins: true, notifyTime: '30 minutes before', timezone: 'Asia/Manila (UTC+08:00)' });
  const scheduleRef = useRef(null);
  const [countdown, setCountdown] = useState('');

  const activeEventEarly = events.find(e => e.status === 'scheduled' || e.status === 'running') || null;

  useEffect(() => {
    if (!activeEventEarly?.end_at) { setCountdown(''); return; }
    const tick = () => {
      const diff = new Date(activeEventEarly.end_at) - new Date();
      if (diff <= 0) { setCountdown('Ending now'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [activeEventEarly?.end_at]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      apiFetch('maintenance/status.php').catch(() => null),
      apiFetch('maintenance/events.php').catch(() => ({ items: [] })),
    ]).then(([s, e]) => {
      setStatus(s);
      setEvents(Array.isArray(e?.items) ? e.items : []);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleMaintenance(value) {
    if (toggling) return;
    setToggling(true);
    try {
      await apiFetch('maintenance/toggle.php', { method: 'POST', body: { enabled: value, reason: value ? 'Manual maintenance' : '' } });
      showToast(value ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.');
      await load();
    } catch (err) {
      showToast(err.message || 'Unable to update maintenance mode.', 'error');
    } finally {
      setToggling(false);
    }
  }

  async function scheduleMaintenance() {
    if (scheduling) return;
    if (!form.start) { showToast('Please select a start date and time.'); return; }
    if (!form.end) { showToast('Please select an end date and time.'); return; }
    if (new Date(form.end) <= new Date(form.start)) { showToast('End time must be after start time.'); return; }
    if (!form.reason.trim()) { showToast('Please enter a maintenance reason.'); return; }
    setScheduling(true);
    try {
      await apiFetch('maintenance/events.php', {
        method: 'POST',
        body: { action: 'create', start_at: form.start, end_at: form.end, reason: form.reason.trim() },
      });
      showToast('Maintenance schedule created successfully.');
      setForm(f => ({ ...f, start: '', end: '', reason: '' }));
      await load();
    } catch (err) {
      showToast(err.message || 'Failed to schedule maintenance.', 'error');
    } finally {
      setScheduling(false);
    }
  }

  async function runCancelSchedule() {
    const active = events.find(e => e.status === 'scheduled' || e.status === 'running');
    if (!active) { showToast('No active schedule to cancel.'); return; }
    setCancelling(true);
    try {
      await apiFetch('maintenance/events.php', { method: 'POST', body: { action: 'cancel', id: active.id } });
      showToast('Maintenance schedule cancelled.');
      setConfirm(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Failed to cancel schedule.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  async function runEmergency() {
    setToggling(true);
    try {
      await apiFetch('maintenance/toggle.php', { method: 'POST', body: { enabled: true, reason: 'Emergency maintenance' } });
      showToast('Emergency maintenance started.');
      setConfirm(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Failed to start emergency maintenance.', 'error');
    } finally {
      setToggling(false);
    }
  }

  function confirmAction() {
    if (confirm?.type === 'cancel') runCancelSchedule();
    else if (confirm?.type === 'emergency') runEmergency();
  }

  function scrollToSchedule() {
    scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-6xl">
        <StaffPageHeader eyebrow="System Management" title="Maintenance" description="Manage website availability, maintenance schedules, and monitor system health." />
        <div className={card}><SkeletonRows rows={6} height="h-10" /></div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-5 max-w-6xl">
        <StaffErrorState message="Unable to load maintenance status." onRetry={load} />
      </div>
    );
  }

  const modeOn = !!status.maintenance_mode;
  const activeEvent = events.find(e => e.status === 'scheduled' || e.status === 'running') || null;
  const latestEvent = events[0] || null;
  const isManager = user?.role === 'Admin' || user?.role === 'Super Admin';

  const adminName = user?.name || 'Administrator';
  const enabledAt = latestEvent?.start_at ? formatDateTime(latestEvent.start_at) : (status.updated_at ? formatDateTime(status.updated_at) : '—');

  return (
    <div className="max-w-7xl space-y-5">
      <StaffPageHeader
        eyebrow="System Management"
        title="Maintenance"
        description="Manage website availability, maintenance schedules, and monitor system health."
        actions={
          <span className={`inline-block px-3 py-2 rounded-[8px] border text-[10px] font-bold ${modeOn ? 'bg-[#EAF8EF] text-[#16A05A] border-[#BCE6CA]' : 'bg-[#F1F3F6] text-[#718096] border-[#DFE6EF]'}`}>
            {modeOn ? `✓ Maintenance mode enabled${countdown ? ' · ' + countdown : ''}` : 'Maintenance mode disabled'}
          </span>
        }
      />

      {/* NOTICE */}
      {(modeOn || activeEvent) && (
        <div className="flex items-center gap-2.5 rounded-[8px] bg-[#EEF6FF] border border-[#BDD6FA] px-3 py-2.5">
          <span className="w-[27px] h-[27px] rounded-full bg-xevera-600 text-white grid place-items-center text-[11px] flex-shrink-0">⚒</span>
          <div className="flex-1">
            <div className="text-[11px] font-extrabold text-[#135ED2]">{modeOn ? 'Maintenance mode is active' : 'Scheduled maintenance'}</div>
            <div className="text-[9px] text-[#6B7F99] mt-0.5">The Xevera Portal is currently {modeOn ? 'in maintenance' : 'scheduled for maintenance'}. Some services may be temporarily unavailable.</div>
          </div>
          <button onClick={scrollToSchedule} className="px-3 py-1.5 rounded-[6px] border border-[#A9C8F5] bg-white text-xevera-600 text-[9px] font-bold hover:bg-xevera-50 transition-colors cursor-pointer">Manage Maintenance</button>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_2fr_280px] gap-3">
        {/* MAINTENANCE MODE */}
        <div className={card}>
          <div className="text-[11px] font-extrabold text-[#17263D]">Maintenance Mode</div>
          <div className="text-[8px] text-[#8290A3] mt-1">Temporarily disable public access while administrators continue working.</div>

          <div className={`mt-3 flex items-center gap-2 rounded-[7px] border p-2 ${modeOn ? 'bg-[#EAF8EF] border-[#BDE8CA]' : 'bg-[#F1F3F6] border-[#DFE6EF]'}`}>
            <span className={`w-[29px] h-[29px] rounded-[7px] grid place-items-center text-[15px] text-white flex-shrink-0 ${modeOn ? 'bg-[#16A05A]' : 'bg-[#9AA6B6]'}`}>{modeOn ? '✓' : '○'}</span>
            <div className="flex-1">
              <strong className={`block text-[10px] ${modeOn ? 'text-[#16A05A]' : 'text-[#718096]'}`}>{modeOn ? 'MAINTENANCE ENABLED' : 'MAINTENANCE DISABLED'}</strong>
              <span className={`block text-[9px] mt-0.5 ${modeOn ? 'text-[#56836A]' : 'text-[#8A97A8]'}`}>{modeOn ? `Visitors will see the maintenance page.${countdown ? ' ' + countdown + '.' : ''}` : 'Public access is available normally.'}</span>
            </div>
            {isManager ? <Switch checked={modeOn} onChange={toggleMaintenance} label="Maintenance mode" /> : <span className="text-[9px] font-bold text-[#8A97A8]">View only</span>}
          </div>

          <div className="grid grid-cols-2 border border-[#DFE6EF] rounded-[6px] mt-2.5">
            <div className="p-2 border-r border-[#DFE6EF]">
              <span className="block text-[8px] uppercase tracking-wider text-[#8A97A8]">Enabled At</span>
              <strong className="block text-[10px] text-[#17263D] mt-1">{enabledAt}</strong>
            </div>
            <div className="p-2">
              <span className="block text-[8px] uppercase tracking-wider text-[#8A97A8]">Enabled By</span>
              <strong className="block text-[10px] text-[#17263D] mt-1">{adminName}</strong>
            </div>
          </div>
        </div>

        {/* SCHEDULE MAINTENANCE */}
        <div ref={scheduleRef} className={`${card} scroll-mt-24`}>
          <div className="text-[11px] font-extrabold text-[#17263D]">Schedule Maintenance</div>
          <div className="text-[8px] text-[#8290A3] mt-1">Automatically turn maintenance mode on and off at a set time.</div>

          {!isManager ? (
            <div className="mt-3 p-3 rounded-[7px] bg-[#F8FAFC] border border-[#DFE6EF] text-[10px] text-[#64758B] leading-relaxed">
              Scheduling is managed by administrators. Contact your admin to schedule or cancel maintenance. You can view the current schedule and history below.
            </div>
          ) : (
            <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            <label className="block">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">Start Date & Time</span>
              <input type="datetime-local" className={inputCls} value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">End Date & Time</span>
              <input type="datetime-local" className={inputCls} value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">Repeat (Optional)</span>
              <select className={`${inputCls} cursor-pointer`} value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })}>
                <option>Does not repeat</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">Reason</span>
              <textarea className={`${inputCls} h-[45px] pt-2 resize-none`} placeholder="e.g. Database update, system optimization, security patch, etc." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            </label>
            <label className="flex items-center gap-1.5 text-[9px] text-[#66778D] sm:col-span-2">
              <input type="checkbox" className="accent-xevera-600" checked={form.showNotice} onChange={e => setForm({ ...form, showNotice: e.target.checked })} /> Show upcoming maintenance notice to users
            </label>
            <label className="flex items-center gap-1.5 text-[9px] text-[#66778D] sm:col-span-2">
              <input type="checkbox" className="accent-xevera-600" checked={form.notifyAdmins} onChange={e => setForm({ ...form, notifyAdmins: e.target.checked })} /> Send notification to administrators before maintenance starts
            </label>
            <label className="block">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">Notification Time</span>
              <select className={`${inputCls} cursor-pointer`} value={form.notifyTime} onChange={e => setForm({ ...form, notifyTime: e.target.value })}>
                <option>30 minutes before</option>
                <option>1 hour before</option>
                <option>2 hours before</option>
                <option>1 day before</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[9px] font-bold text-[#63748A] mb-1">Time Zone</span>
              <select className={`${inputCls} cursor-pointer`} value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                <option>Asia/Manila (UTC+08:00)</option>
                <option>Asia/Singapore (UTC+08:00)</option>
                <option>UTC</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#DFE6EF] rounded-[6px] mt-2.5">
            <div className="p-2.5 border-b sm:border-b-0 sm:border-r border-[#DFE6EF]">
              <span className="block text-[10px] text-[#8A97A8]">Last Changed</span>
              <strong className="block text-[11px] text-[#17263D] mt-1">{latestEvent ? formatDateTime(latestEvent.start_at) : '—'}</strong>
            </div>
            <div className="p-2.5 border-b sm:border-b-0 sm:border-r border-[#DFE6EF]">
              <span className="block text-[10px] text-[#8A97A8]">Changed By</span>
              <strong className="block text-[11px] text-[#17263D] mt-1">{adminName}</strong>
            </div>
            <div className="p-2.5">
              <span className="block text-[10px] text-[#8A97A8]">Schedule Status</span>
              <strong className={`block text-[11px] mt-1 ${activeEvent ? 'text-[#16A05A]' : 'text-[#718096]'}`}>{activeEvent ? 'Active' : 'No schedule'}</strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-2.5">
            <button onClick={() => setConfirm({ type: 'cancel', title: 'Cancel Maintenance Schedule', message: 'Are you sure you want to cancel the current scheduled maintenance?', buttonText: 'Cancel Schedule' })} disabled={!activeEvent} className="px-2.5 py-1.5 min-h-[40px] rounded-[6px] border border-[#BCD2F4] bg-white text-xevera-600 text-[11px] font-bold hover:bg-xevera-50 disabled:opacity-40 cursor-pointer">
              Cancel Schedule
            </button>
            <div className="flex gap-2">
              <button onClick={() => { showToast('Schedule is ready to edit.'); scheduleRef.current?.querySelector('input')?.focus(); }} className="flex-1 sm:flex-none px-2.5 py-1.5 min-h-[40px] rounded-[6px] border border-[#BCD2F4] bg-white text-xevera-600 text-[11px] font-bold hover:bg-xevera-50 cursor-pointer">Edit Schedule</button>
              <button onClick={scheduleMaintenance} disabled={scheduling} className="flex-1 sm:flex-none px-3 py-1.5 min-h-[40px] rounded-[6px] bg-xevera-600 text-white text-[11px] font-bold hover:bg-xevera-700 disabled:opacity-50 cursor-pointer">
                {scheduling ? 'Scheduling...' : '✓ Schedule Maintenance'}
              </button>
            </div>
          </div>
            </>
          )}
        </div>

        {/* PREVIEW */}
        <div className={`${card}`}>
          <div className="text-[11px] font-extrabold text-[#17263D]">Maintenance Page Preview</div>
          <div className="text-[8px] text-[#8290A3] mt-1">This is what visitors will see.</div>
          <div className="mt-2.5 rounded-[7px] bg-[#061D45] text-white flex flex-col items-center justify-center p-4 text-center min-h-[195px]">
            <div className="text-[27px] mb-2">⚙</div>
            <h2 className="text-[14px] font-extrabold mb-2">We'll be right back!</h2>
            <p className="text-[9px] text-[#C8D5E8] leading-relaxed max-w-[200px]">Xevera Portal is currently undergoing scheduled maintenance.</p>
            <p className="text-[9px] text-[#C8D5E8] leading-relaxed mt-1.5 max-w-[200px]">We're working hard to improve your experience. Please check back soon.</p>
            <div className="w-full bg-white text-[#26384F] rounded-[6px] p-2 mt-2.5 text-left text-[8px]">
              ◷ &nbsp; Scheduled Time
              <strong className="block text-[9px] mt-0.5">{formatRange(form.start || activeEvent?.start_at, form.end || activeEvent?.end_at)}</strong>
            </div>
            <button onClick={() => showToast('Opening maintenance page preview...')} className="w-full h-6 bg-white border-0 text-[#142E54] text-[9px] font-bold mt-2.5 rounded-[6px] cursor-pointer">View Full Page →</button>
          </div>
        </div>
      </div>

      {/* HISTORY */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold text-[#17263D]">Maintenance History</div>
            <div className="text-[8px] text-[#8290A3] mt-1">View past maintenance activities.</div>
          </div>
          <button onClick={() => showToast('Opening complete maintenance history...')} className="px-2.5 py-1.5 rounded-[6px] border border-[#BCD2F4] bg-white text-xevera-600 text-[9px] font-bold hover:bg-xevera-50 cursor-pointer">View All History →</button>
        </div>

        <div className="overflow-x-auto mt-2.5">
          {events.length === 0 ? (
            <p className="text-[10px] text-[#9CA3AF] py-4 text-center">No maintenance history recorded.</p>
          ) : (
            <table className={`w-full text-left ${isManager ? 'min-w-[760px]' : 'min-w-[520px]'}`}>
              <thead>
                <tr className="text-[8px] uppercase tracking-wider text-[#7E8C9F] bg-[#F8FAFC]">
                  {isManager && <th className="py-2 px-2 font-bold">ID</th>}
                  <th className="py-2 px-2 font-bold">Reason</th>
                  <th className="py-2 px-2 font-bold">Started At</th>
                  {isManager && <th className="py-2 px-2 font-bold">Ended At</th>}
                  <th className="py-2 px-2 font-bold">Duration</th>
                  <th className="py-2 px-2 font-bold">Status</th>
                  {isManager && <th className="py-2 px-2 font-bold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map(e => (
                  <tr key={e.id} className="border-t border-[#EDF1F5]">
                    {isManager && <td className="py-2 px-2 text-[10px] text-[#17263D]">#{e.id}</td>}
                    <td className="py-2 px-2 text-[10px] text-[#26384F]">{e.reason || '—'}</td>
                    <td className="py-2 px-2 text-[10px] text-[#64758B] whitespace-nowrap">{formatDateTime(e.start_at)}</td>
                    {isManager && <td className="py-2 px-2 text-[10px] text-[#64758B] whitespace-nowrap">{e.end_at ? formatDateTime(e.end_at) : '—'}</td>}
                    <td className="py-2 px-2 text-[10px] text-[#64758B]">{e.duration_display || '—'}</td>
                    <td className="py-2 px-2">{statusBadge(e.status)}</td>
                    {isManager && (
                      <td className="py-2 px-2">
                        {(e.status === 'scheduled' || e.status === 'running') ? (
                          <button onClick={() => setConfirm({ type: 'cancel', title: 'Cancel Maintenance Schedule', message: 'Are you sure you want to cancel this maintenance schedule?', buttonText: 'Cancel Schedule' })} className="text-[10px] text-[#DC3C3C] font-bold hover:underline cursor-pointer">Cancel</button>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* EMERGENCY - manager only */}
      {isManager && (
        <div className="flex justify-end">
          <button onClick={() => setConfirm({ type: 'emergency', title: 'Start Emergency Maintenance?', message: 'This will immediately place the Xevera Portal into maintenance mode. Public users may temporarily lose access.', buttonText: 'Start Maintenance' })} className="px-3 py-2 rounded-[6px] border border-[#FFBABA] bg-white text-[#DC3C3C] text-[9px] font-bold hover:bg-[#FFF0F0] transition-colors cursor-pointer">
            ⚠ Start Emergency Maintenance
          </button>
        </div>
      )}

      {/* CONFIRM MODAL */}
      <Modal
        open={confirm !== null}
        title={confirm?.title || 'Confirm Action'}
        description={confirm?.message}
        confirmLabel={cancelling ? 'Cancelling...' : (confirm?.buttonText || 'Confirm')}
        danger
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}