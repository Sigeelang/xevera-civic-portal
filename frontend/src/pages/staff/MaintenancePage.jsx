import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';

const card = 'bg-white rounded-[14px] border border-[#E1EAF5] shadow-[0_8px_25px_rgba(25,73,130,0.06)]';
const inputCls = 'w-full h-[49px] px-3 border border-[#D3DFED] rounded-[9px] bg-white text-[14px] font-semibold text-[#101D3A] focus:border-[#1261f5] focus:outline-none';

const SERVICES = [
  { name: 'Resident Portal', icon: '♙' },
  { name: 'Staff Portal', icon: '♙' },
  { name: 'Admin Portal', icon: '◈' },
  { name: 'Mobile App', icon: '▯' },
];

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatRange(start, end) {
  if (!start) return 'No schedule set';
  const s = new Date(String(start).replace(' ', 'T'));
  const e = end ? new Date(String(end).replace(' ', 'T')) : null;
  if (isNaN(s.getTime())) return 'No schedule set';
  const dateStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ts = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const te = e && !isNaN(e.getTime()) ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return dateStr + ' · ' + ts + (te ? ' – ' + te : '');
}

function statusBadge(status) {
  if (status === 'completed') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#EAF8EF] text-[#16A05A] text-[9px] font-bold">Completed</span>;
  if (status === 'running') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#FFF7E7] text-[#F59E0B] text-[9px] font-bold">Running</span>;
  if (status === 'scheduled') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#EEF6FF] text-[#1769ED] text-[9px] font-bold">Scheduled</span>;
  if (status === 'cancelled') return <span className="inline-block px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#DC3C3C] text-[9px] font-bold">Cancelled</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full bg-[#F1F3F6] text-[#718096] text-[9px] font-bold">{status}</span>;
}

const emptyForm = {
  startDate: '', startTime: '', endDate: '', endTime: '', reason: '',
  repeat: 'Does not repeat', showNotice: true, notifyAdmins: true,
  notifyTime: '30 minutes before', timezone: 'Asia/Manila (UTC+08:00)',
  services: ['Resident Portal', 'Staff Portal', 'Admin Portal'],
};

export default function MaintenancePage() {
  const showToast = useToast();
  const { user } = useAuth();
  const { maintenanceHeadline } = useSettings();
  const previewHeadline = maintenanceHeadline || "We'll Be Back Soon!";

  const [status, setStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
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

  const start = form.startDate && form.startTime ? `${form.startDate}T${form.startTime}` : '';
  const end = form.endDate && form.endTime ? `${form.endDate}T${form.endTime}` : '';

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleService(name) {
    setForm(f => ({
      ...f,
      services: f.services.includes(name)
        ? f.services.filter(s => s !== name)
        : [...f.services, name],
    }));
  }

  function validateSchedule() {
    if (!start) { showToast('Please set the start date and time.'); return false; }
    if (!end) { showToast('Please set the end date and time.'); return false; }
    if (new Date(end) <= new Date(start)) { showToast('End time must be later than the start time.'); return false; }
    return true;
  }

  function nextStep() {
    if (step === 1 && !validateSchedule()) return;
    if (step === 2 && !form.reason.trim()) { showToast('Please enter a maintenance reason.'); return; }
    setStep(s => Math.min(3, s + 1));
  }

  function saveDraft() {
    try { localStorage.setItem('maintenanceDraft', JSON.stringify(form)); } catch { /* ignore */ }
    showToast('Maintenance schedule saved as draft.');
  }

  function cancelSchedule() {
    setForm(emptyForm);
    setStep(1);
    showToast('Maintenance schedule cleared.');
  }

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
    if (!validateSchedule()) return;
    if (!form.reason.trim()) { showToast('Please enter a maintenance reason.'); return; }
    setScheduling(true);
    try {
      await apiFetch('maintenance/events.php', {
        method: 'POST',
        body: { action: 'create', start_at: start, end_at: end, reason: form.reason.trim() },
      });
      showToast('Maintenance schedule created successfully.');
      setForm(emptyForm);
      setStep(1);
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

  if (loading) {
    return (
      <div className="space-y-5 max-w-7xl">
        <StaffPageHeader eyebrow="System Management" title="Schedule Maintenance" description="Set the date and time for system maintenance and notify users." />
        <div className={`${card} p-4`}><SkeletonRows rows={6} height="h-10" /></div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-5 max-w-7xl">
        <StaffErrorState message="Unable to load maintenance status." onRetry={load} />
      </div>
    );
  }

  const modeOn = !!status.maintenance_mode;
  const activeEvent = events.find(e => e.status === 'scheduled' || e.status === 'running') || null;
  const isManager = user?.role === 'Admin' || user?.role === 'Super Admin';

  return (
    <div className="max-w-7xl space-y-5">
      <StaffPageHeader
        eyebrow="System Management"
        title="Schedule Maintenance"
        description="Set the date and time for system maintenance and notify users."
        actions={
          <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border text-[10px] font-bold ${modeOn ? 'bg-[#EAF8EF] text-[#16A05A] border-[#BCE6CA]' : 'bg-[#F1F3F6] text-[#718096] border-[#DFE6EF]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${modeOn ? 'bg-[#16A05A] animate-pulse' : 'bg-[#9AA6B6]'}`} />
            {modeOn ? `Maintenance mode enabled${countdown ? ' · ' + countdown : ''}` : 'Maintenance mode disabled'}
          </span>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_425px] gap-5 items-start">

        {/* ============ LEFT: WIZARD ============ */}
        <div className="space-y-5">
          <section className={`${card} p-6 sm:p-[25px_28px]`}>
            {step === 1 && (
              <>
                <div className="flex items-center gap-[13px] mb-6">
                  <span className="w-[49px] h-[49px] rounded-[11px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[23px]">▣</span>
                  <div>
                    <h2 className="text-[19px] font-extrabold text-[#101D3A] m-0">Select Maintenance Schedule</h2>
                    <p className="text-[13px] text-[#65758F] mt-1">Choose the start and end date and time for the maintenance.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 xl:col-span-2">
                    <label className="block text-[14px] font-bold mb-2 text-[#101D3A]">Start Date &amp; Time <span className="text-[#EF2424]">*</span></label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                      <input type="time" className={`${inputCls} max-w-[140px]`} value={form.startTime} onChange={e => set('startTime', e.target.value)} />
                    </div>
                  </div>
                  <div className="sm:col-span-2 xl:col-span-2">
                    <label className="block text-[14px] font-bold mb-2 text-[#101D3A]">End Date &amp; Time <span className="text-[#EF2424]">*</span></label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} />
                      <input type="time" className={`${inputCls} max-w-[140px]`} value={form.endTime} onChange={e => set('endTime', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[#E4EBF4] my-7" />

                <div className="flex items-center gap-[13px] mb-4">
                  <span className="w-[48px] h-[48px] rounded-[10px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[23px]">◈</span>
                  <div>
                    <h3 className="text-[17px] font-extrabold text-[#101D3A] m-0">Affected Services</h3>
                    <p className="text-[12px] text-[#65758F] mt-1">Select which parts of the system will be affected.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {SERVICES.map(svc => {
                    const on = form.services.includes(svc.name);
                    return (
                      <button key={svc.name} type="button" onClick={() => toggleService(svc.name)}
                        className={`min-h-[57px] px-[14px] rounded-[9px] border flex items-center gap-[11px] cursor-pointer transition-colors text-left ${
                          on ? 'border-[#84B8FF] bg-[#F0F7FF]' : 'border-[#D3DFED] bg-white hover:border-[#83B5FA] hover:bg-[#F7FBFF]'
                        }`}>
                        <span className={`w-[20px] h-[20px] rounded-[4px] border-2 grid place-items-center text-[13px] text-white flex-shrink-0 ${
                          on ? 'bg-[#1261f5] border-[#1261f5]' : 'border-[#C8D4E3]'
                        }`}>{on ? '✓' : ''}</span>
                        <span className="text-[19px] text-[#092F62]">{svc.icon}</span>
                        <span className="text-[13px] font-semibold text-[#101D3A]">{svc.name}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="block mt-5">
                  <span className="block text-[14px] font-bold mb-2 text-[#101D3A]">Reason <span className="text-[#EF2424]">*</span></span>
                  <input type="text" className={inputCls} placeholder="e.g. Database update, security patch, system optimization"
                    value={form.reason} onChange={e => set('reason', e.target.value)} />
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center gap-[13px] mb-6">
                  <span className="w-[49px] h-[49px] rounded-[11px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[23px]">♧</span>
                  <div>
                    <h2 className="text-[19px] font-extrabold text-[#101D3A] m-0">Notification Settings</h2>
                    <p className="text-[13px] text-[#65758F] mt-1">Configure how and when users are alerted about this maintenance.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 text-[13px] text-[#334A66]">
                    <input type="checkbox" className="accent-[#1261f5] w-4 h-4" checked={form.showNotice} onChange={e => set('showNotice', e.target.checked)} />
                    Show upcoming maintenance notice to users
                  </label>
                  <label className="flex items-center gap-2.5 text-[13px] text-[#334A66]">
                    <input type="checkbox" className="accent-[#1261f5] w-4 h-4" checked={form.notifyAdmins} onChange={e => set('notifyAdmins', e.target.checked)} />
                    Send notification to administrators before maintenance starts
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                  <label className="block">
                    <span className="block text-[13px] font-bold mb-2 text-[#101D3A]">Repeat</span>
                    <select className={`${inputCls} cursor-pointer`} value={form.repeat} onChange={e => set('repeat', e.target.value)}>
                      <option>Does not repeat</option><option>Daily</option><option>Weekly</option><option>Monthly</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[13px] font-bold mb-2 text-[#101D3A]">Notify</span>
                    <select className={`${inputCls} cursor-pointer`} value={form.notifyTime} onChange={e => set('notifyTime', e.target.value)}>
                      <option>30 minutes before</option><option>1 hour before</option><option>2 hours before</option><option>1 day before</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[13px] font-bold mb-2 text-[#101D3A]">Time Zone</span>
                    <select className={`${inputCls} cursor-pointer`} value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                      <option>Asia/Manila (UTC+08:00)</option><option>Asia/Singapore (UTC+08:00)</option><option>UTC</option>
                    </select>
                  </label>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-center gap-[13px] mb-6">
                  <span className="w-[49px] h-[49px] rounded-[11px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[23px]">✓</span>
                  <div>
                    <h2 className="text-[19px] font-extrabold text-[#101D3A] m-0">Review &amp; Publish</h2>
                    <p className="text-[13px] text-[#65758F] mt-1">Confirm the details below before publishing the schedule.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    ['Start', formatRange(start, null)],
                    ['End', formatRange(end, null)],
                    ['Reason', form.reason || '—'],
                    ['Repeat', form.repeat],
                    ['Notify', form.notifyTime],
                    ['Affected Services', form.services.length ? form.services.join(', ') : 'None selected'],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-[#D3DFED] rounded-[9px] p-3.5">
                      <div className="text-[10px] uppercase font-extrabold tracking-wider text-[#8A97A8] mb-1">{label}</div>
                      <div className="text-[13px] font-bold text-[#101D3A]">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ACTIONS */}
            <div className="mt-7 pt-5 border-t border-[#E2EAF3] flex flex-wrap items-center gap-3">
              <button onClick={cancelSchedule} className="h-[52px] px-[22px] rounded-[9px] border border-[#D1DDEC] bg-white text-[14px] font-bold text-[#334A66] hover:-translate-y-px transition-transform cursor-pointer">Cancel</button>
              <button onClick={saveDraft} className="h-[52px] px-[22px] rounded-[9px] border border-[#BDD7FA] bg-[#F5F9FF] text-[#1261f5] text-[14px] font-bold hover:-translate-y-px transition-transform cursor-pointer">▣ &nbsp; Save as Draft</button>
              <div className="ml-auto flex items-center gap-3">
                {step > 1 && (
                  <button onClick={() => setStep(s => Math.max(1, s - 1))} className="h-[52px] px-[22px] rounded-[9px] border border-[#D1DDEC] bg-white text-[14px] font-bold text-[#334A66] hover:-translate-y-px transition-transform cursor-pointer">‹ &nbsp; Back</button>
                )}
                {step < 3 ? (
                  <button onClick={nextStep} className="h-[52px] min-w-[245px] px-[22px] rounded-[9px] border-0 bg-gradient-to-br from-[#0871FA] to-[#1261F5] text-white text-[14px] font-bold shadow-[0_7px_18px_rgba(18,97,245,0.18)] hover:bg-[#075BDC] transition-colors cursor-pointer">
                    Next: {step === 1 ? 'Notifications' : 'Review'} &nbsp; →
                  </button>
                ) : (
                  <button onClick={scheduleMaintenance} disabled={scheduling} className="h-[52px] min-w-[245px] px-[22px] rounded-[9px] border-0 bg-gradient-to-br from-[#0871FA] to-[#1261F5] text-white text-[14px] font-bold shadow-[0_7px_18px_rgba(18,97,245,0.18)] hover:bg-[#075BDC] disabled:opacity-50 transition-colors cursor-pointer">
                    {scheduling ? 'Publishing...' : '✓ Publish Schedule'}
                  </button>
                )}
              </div>
            </div>

            {!isManager && (
              <p className="mt-3 text-[11px] text-[#8A97A8]">Scheduling is managed by administrators. You can view the schedule and history below.</p>
            )}
          </section>

          {/* HISTORY */}
          <div className={`${card} p-5`}>
            <div className="font-extrabold text-[13px] text-[#101D3A]">Maintenance History</div>
            <div className="text-[11px] text-[#8290A3] mt-1">View past maintenance activities.</div>
            <div className="overflow-x-auto mt-3">
              {events.length === 0 ? (
                <p className="text-[11px] text-[#9CA3AF] py-4 text-center">No maintenance history recorded.</p>
              ) : (
                <table className={`w-full text-left ${isManager ? 'min-w-[720px]' : 'min-w-[520px]'}`}>
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-[#7E8C9F] bg-[#F8FAFC]">
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
                        {isManager && <td className="py-2 px-2 text-[11px] text-[#101D3A]">#{e.id}</td>}
                        <td className="py-2 px-2 text-[11px] text-[#26384F]">{e.reason || '—'}</td>
                        <td className="py-2 px-2 text-[11px] text-[#64758B] whitespace-nowrap">{formatDateTime(e.start_at)}</td>
                        {isManager && <td className="py-2 px-2 text-[11px] text-[#64758B] whitespace-nowrap">{e.end_at ? formatDateTime(e.end_at) : '—'}</td>}
                        <td className="py-2 px-2 text-[11px] text-[#64758B]">{e.duration_display || '—'}</td>
                        <td className="py-2 px-2">{statusBadge(e.status)}</td>
                        {isManager && (
                          <td className="py-2 px-2">
                            {(e.status === 'scheduled' || e.status === 'running') ? (
                              <button onClick={() => setConfirm({ type: 'cancel', title: 'Cancel Maintenance Schedule', message: 'Are you sure you want to cancel this maintenance schedule?', buttonText: 'Cancel Schedule' })} className="text-[11px] text-[#DC3C3C] font-bold hover:underline cursor-pointer">Cancel</button>
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
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <aside className="space-y-[18px]">

          {/* MAINTENANCE MODE */}
          <div className={`${card} p-5`}>
            <div className="flex items-start gap-3">
              <span className="w-[46px] h-[46px] rounded-[10px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[22px] flex-shrink-0">⏻</span>
              <div>
                <h3 className="text-[15px] font-extrabold text-[#101D3A] m-0">Maintenance Mode</h3>
                <p className="text-[12px] text-[#65758F] leading-relaxed mt-1 m-0">Temporarily disable public access while administrators continue working.</p>
              </div>
            </div>
            <div className="mt-[18px] min-h-[61px] bg-[#F2F5F9] rounded-[10px] px-[14px] py-3 flex items-center gap-[13px]">
              <button type="button" role="switch" aria-checked={modeOn} aria-label="Maintenance mode"
                disabled={!isManager || toggling} onClick={() => toggleMaintenance(!modeOn)}
                className={`relative w-[62px] h-[35px] rounded-full transition-colors flex-shrink-0 ${modeOn ? 'bg-[#1261f5]' : 'bg-[#AAB6C6]'} ${(!isManager || toggling) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <span className={`absolute top-[4px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.15)] transition-all ${modeOn ? 'left-[31px]' : 'left-[4px]'}`} />
              </button>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#101D3A]">{modeOn ? 'Enabled' : 'Disabled'}</div>
                <div className="text-[12px] text-[#65758F] mt-[3px]">{modeOn ? 'Public access will be temporarily disabled.' : 'Public access is currently available.'}</div>
              </div>
            </div>
          </div>

          {/* PREVIEW */}
          <div className={`${card} p-[18px_14px_14px]`}>
            <div className="flex items-start gap-3 px-[5px] pb-3">
              <span className="w-[46px] h-[46px] rounded-[10px] bg-[#EAF3FF] text-[#1261f5] grid place-items-center text-[22px] flex-shrink-0">◉</span>
              <div>
                <h3 className="text-[15px] font-extrabold text-[#101D3A] m-0">Maintenance Page Preview</h3>
                <p className="text-[12px] text-[#65758F] leading-relaxed mt-1 m-0">This is what residents and staff will see during the maintenance period.</p>
              </div>
            </div>

            <div className="rounded-[11px] p-5 text-center text-white" style={{ background: 'linear-gradient(180deg,#031B3C,#082E61)' }}>
              <div className="flex items-center justify-center gap-2 font-bold mb-6">
                <span className="text-[27px]">◒</span>
                <div className="text-left text-[15px]">Xevera Civic
                  <small className="block text-[10px] text-[#C6D6EB] font-normal">Community Portal</small>
                </div>
              </div>
              <div className="w-[59px] h-[59px] rounded-full bg-white/20 grid place-items-center text-[29px] mx-auto">⚙</div>
              <h2 className="text-[23px] font-extrabold mt-[17px] mb-2.5">{previewHeadline}</h2>
              <p className="text-[12px] leading-[1.55] text-[#E0E9F5]">
                Xevera Portal is currently undergoing scheduled maintenance.<br />
                We're working hard to improve your experience.<br />
                Please check back soon.
              </p>
              <div className="bg-white text-[#101D3A] rounded-[9px] p-3 mt-[17px] flex items-center gap-2.5 text-left">
                <span className="text-[22px] text-[#092F62]">◷</span>
                <div>
                  <small className="block text-[#65758F] text-[10px]">Scheduled Time</small>
                  <strong className="text-[12px]">{formatRange(start || activeEvent?.start_at, end || activeEvent?.end_at)}</strong>
                </div>
              </div>
            </div>

            {/* REMINDER */}
            <div className="mt-3.5 p-3.5 rounded-[10px] bg-[#FFF7DF] flex gap-3">
              <span className="w-8 h-8 flex-shrink-0 bg-[#FFAE00] text-white rounded-full grid place-items-center font-extrabold">!</span>
              <div>
                <h4 className="text-[13px] font-extrabold text-[#101D3A] m-0">Important Reminder</h4>
                <p className="text-[#66748B] text-[11px] leading-[1.5] mt-1 m-0">
                  Make sure to inform users in advance. Scheduled maintenance will be displayed on the announcement section.
                </p>
              </div>
            </div>
          </div>

          {/* EMERGENCY */}
          {isManager && (
            <button onClick={() => setConfirm({ type: 'emergency', title: 'Start Emergency Maintenance?', message: 'This will immediately place the Xevera Portal into maintenance mode. Public users may temporarily lose access.', buttonText: 'Start Maintenance' })}
              className="w-full h-[52px] rounded-[9px] border border-[#FFBABA] bg-white text-[#DC3C3C] text-[13px] font-bold hover:bg-[#FFF0F0] transition-colors cursor-pointer">
              ⚠ Start Emergency Maintenance
            </button>
          )}
        </aside>
      </div>

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
