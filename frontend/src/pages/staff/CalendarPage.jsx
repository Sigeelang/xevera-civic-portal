import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

/*
 * Calendar (Super Admin / Staff) — design per prototype.
 * Real data sources:
 *   community/events.php  -> community events
 *   maintenance/public.php -> maintenance windows
 *   attendance/history.php -> attendance-recorded days
 * Add Event persists via community/create_event.php.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function toKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return localKey(d);
}

function formatTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const TYPE_META = {
  community: { chip: 'bg-[#EAF2FF] text-[#1264E8]', dot: 'bg-[#1264E8]', dateBox: 'text-xevera-600', label: 'Community event' },
  maintenance: { chip: 'bg-[#FFF3DF] text-[#D97706]', dot: 'bg-[#F59E0B]', dateBox: 'text-[#E88900]', label: 'Maintenance' },
  attendance: { chip: 'bg-[#E6F8EE] text-[#12945A]', dot: 'bg-[#18A765]', dateBox: 'text-[#18A765]', label: 'Attendance recorded' },
};

export default function CalendarPage({ onNavigate }) {
  const showToast = useToast();
  const [viewDate, setViewDate] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [events, setEvents] = useState([]);
  const [attendanceDays, setAttendanceDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Add-event form
  const [form, setForm] = useState({ title: '', date: '', time: '08:00', location: '', type: 'community' });

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.allSettled([
      apiFetch('community/events.php?limit=50'),
      apiFetch('maintenance/public.php'),
      apiFetch('attendance/history.php?limit=90'),
    ]).then(([ev, maint, att]) => {
      const evItems = ev.status === 'fulfilled' ? (ev.value.items || []) : [];
      const maintItems = maint.status === 'fulfilled' ? (maint.value.items || []) : [];
      const attItems = att.status === 'fulfilled' ? (att.value.items || []) : [];

      setEvents([
        ...evItems.map((e) => ({ ...e, _type: 'community' })),
        ...maintItems.map((m) => ({ ...m, title: m.title || m.name || m.reason || 'Maintenance window', starts_at: m.start_at, _type: 'maintenance' })),
      ]);
      setAttendanceDays(attItems.map((a) => a.date).filter(Boolean));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const year = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const monthTitle = `${MONTHS[m]} ${year}`;
  const todayKey = localKey(new Date());
  const selectedKey = selectedDay ? localKey(selectedDay) : null;

  function changeMonth(delta) { setViewDate(new Date(year, m + delta, 1)); }

  /* Normalize events into day-keyed structures */
  const normalized = useMemo(() => events.map((e) => {
    const k = toKey(e.starts_at || e.start_at || e.date || e.end_at);
    return { ...e, key: k };
  }).filter((e) => e.key), [events]);

  const eventByDay = useMemo(() => {
    const map = {};
    normalized.forEach((e) => { if (!map[e.key]) map[e.key] = []; map[e.key].push(e); });
    return map;
  }, [normalized]);

  const visibleEventByDay = useMemo(() => {
    if (activeFilter === 'all') return eventByDay;
    if (activeFilter === 'attendance') return {};
    const map = {};
    Object.entries(eventByDay).forEach(([k, list]) => {
      const filtered = list.filter((e) => e._type === activeFilter);
      if (filtered.length) map[k] = filtered;
    });
    return map;
  }, [eventByDay, activeFilter]);

  const visibleAttendanceDays = useMemo(() => (
    activeFilter === 'community' ? [] : attendanceDays
  ), [activeFilter, attendanceDays]);

  /* Month stats */
  const stats = useMemo(() => {
    const prefix = year + '-' + String(m + 1).padStart(2, '0');
    const monthEvents = normalized.filter((e) => e.key.startsWith(prefix));
    return {
      upcoming: monthEvents.length,
      maintenance: monthEvents.filter((e) => e._type === 'maintenance').length,
      attendance: attendanceDays.filter((d) => String(d).startsWith(prefix)).length,
    };
  }, [normalized, attendanceDays, year, m]);

  /* Upcoming (sorted by date, next ones first) */
  const upcoming = useMemo(() => {
    let list = normalized.filter((e) => e.key >= localKey(new Date()));
    if (activeFilter !== 'all') list = list.filter((e) => e._type === activeFilter);
    return list.sort((a, b) => (a.key < b.key ? -1 : 1)).slice(0, 3);
  }, [normalized, activeFilter]);

  /* Grid cells */
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function openEvent(e) {
    setDetails({
      title: e.title,
      type: TYPE_META[e._type]?.label || 'Event',
      date: new Date(e.key + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      time: formatTime(e.starts_at || e.start_at || e.date),
      location: e.location || e.venue || 'No location specified',
    });
  }

  async function submitEvent(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSavingEvent(true);
    try {
      await apiFetch('community/create_event.php', { method: 'POST', body: form });
      showToast('Event added successfully.');
      setAddOpen(false);
      setForm({ title: '', date: '', time: '08:00', location: '', type: 'community' });
      const d = new Date(form.date + 'T00:00:00');
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      load();
    } catch (err) {
      alert(err.message || 'Could not add the event.');
    } finally {
      setSavingEvent(false);
    }
  }

  const filterOptions = [['all', 'All Events'], ['community', 'Community Events'], ['maintenance', 'Maintenance'], ['attendance', 'Attendance']];

  return (
    <div className="w-full max-w-[1500px] mx-auto">
      <StaffPageHeader
        eyebrow="Reports"
        title="Calendar"
        description="Staff schedules, milestones, and community events."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => changeMonth(-1)} aria-label="Previous month"
              className="w-11 h-11 rounded-[10px] border border-[#DFE7F2] bg-white text-xl text-[#102348] hover:bg-[#F5F9FF] transition-colors cursor-pointer">‹</button>
            <button onClick={() => { const n = new Date(); setViewDate(new Date(n.getFullYear(), n.getMonth(), 1)); setSelectedDay(null); }}
              className="h-11 px-5 inline-flex items-center rounded-[10px] border border-[#D4E4FF] bg-[#EDF4FF] text-xevera-600 text-sm font-bold hover:bg-[#F5F9FF] transition-colors cursor-pointer">
              Today
            </button>
            <button onClick={() => changeMonth(1)} aria-label="Next month"
              className="w-11 h-11 rounded-[10px] border border-[#DFE7F2] bg-white text-xl text-[#102348] hover:bg-[#F5F9FF] transition-colors cursor-pointer">›</button>
            <span className="w-px h-[30px] bg-[#DFE7F2] mx-2.5" />

            {/* Filter dropdown */}
            <div className="relative">
              <button onClick={() => setFilterOpen((o) => !o)}
                className="h-11 px-[18px] inline-flex items-center gap-2 rounded-[10px] border border-[#DFE7F2] bg-white text-sm font-bold text-[#102348] hover:bg-[#F5F9FF] transition-colors cursor-pointer">
                ⚱ Filter
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-[52px] w-[190px] bg-white border border-[#DFE7F2] rounded-[12px] shadow-[0_15px_35px_rgba(15,35,70,0.15)] p-[7px] z-50">
                  {filterOptions.map(([key, label]) => (
                    <button key={key} onClick={() => { setActiveFilter(key); setFilterOpen(false); }}
                      className={`w-full text-left px-2.5 py-2.5 rounded-[8px] border-none text-[13px] cursor-pointer transition-colors ${activeFilter === key ? 'bg-[#EEF5FF] text-xevera-600 font-bold' : 'bg-white text-[#102348] hover:bg-[#F2F6FC]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setAddOpen(true)}
              className="h-11 px-5 inline-flex items-center gap-2 rounded-[10px] border border-xevera-600 bg-xevera-600 text-white text-sm font-bold shadow-[0_5px_14px_rgba(18,100,232,0.18)] hover:bg-[#0755D5] hover:-translate-y-px transition-all cursor-pointer">
              ＋ Add Event
            </button>
          </div>
        }
      />

      <main className="grid grid-cols-1 lg:grid-cols-[minmax(650px,1fr)_390px] gap-[18px] items-start mt-[26px]">

        {/* CALENDAR CARD */}
        <section className="bg-white border border-[#DFE7F2] rounded-[17px] shadow-[0_4px_18px_rgba(15,35,70,0.07)] py-[18px] px-[22px] pb-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-[22px] min-w-[650px]">
            <div className="flex items-center gap-3">
              <span className="w-[43px] h-[43px] grid place-items-center rounded-full bg-[#EDF4FF] text-xevera-600 text-[21px]">▣</span>
              <span className="text-[25px] font-extrabold text-[#102348]">{monthTitle}</span>
              <select value={m} onChange={(e) => setViewDate(new Date(year, Number(e.target.value), 1))}
                className="border-0 bg-transparent text-base text-[#64748B] outline-none cursor-pointer">
                {MONTHS.map((mo, idx) => <option key={mo} value={idx}>{mo}</option>)}
              </select>
            </div>
          </div>

          <div className="min-w-[650px]">
            <div className="grid grid-cols-7 gap-[5px] mb-1">
              {DOW.map((d, i) => (
                <div key={d} className={`h-[30px] flex items-center justify-center text-xs font-extrabold uppercase ${i === 0 ? 'text-[#EF4444]' : i === 6 ? 'text-xevera-600' : 'text-[#536684]'}`}>{d}</div>
              ))}
            </div>

            {loading ? (
              <SkeletonRows rows={5} height="h-[88px]" />
            ) : error ? (
              <StaffErrorState message="Unable to load calendar data." onRetry={load} />
            ) : (
              <div className="grid grid-cols-7 gap-[5px]">
                {cells.map((day, i) => {
                  if (day === null) return <div key={'x' + i} className="min-h-[88px] rounded-[10px] bg-[#FBFCFE]" />;
                  const k = localKey(new Date(year, m, day));
                  const isToday = k === todayKey;
                  const isSelected = selectedKey === k;
                  const dayEvents = visibleEventByDay[k] || [];
                  const hasAttendance = visibleAttendanceDays.includes(k);
                  return (
                    <div key={day} onClick={() => setSelectedDay(new Date(year, m, day))}
                      className={`min-h-[88px] rounded-[10px] p-2 relative overflow-hidden transition-all cursor-pointer ${
                        isSelected ? 'bg-xevera-600 !border-xevera-600'
                        : isToday ? 'bg-[#F5F9FF] border-[1.5px] border-xevera-600 hover:bg-[#F5F9FF]'
                        : 'bg-white border border-[#E3EAF3] hover:border-[#9CC2FF] hover:bg-[#FBFDFF]'
                      }`}>
                      <div className={`text-[13px] font-extrabold ${isSelected ? 'text-white' : isToday ? 'w-[30px] h-[30px] grid place-items-center rounded-full bg-xevera-600 text-white' : 'text-[#17294A]'}`}>{day}</div>
                      <div className="mt-3 space-y-1">
                        {dayEvents.slice(0, 2).map((e, ei) => (
                          <div key={ei} onClick={(ev) => { ev.stopPropagation(); openEvent(e); }}
                            className={`px-[7px] py-[5px] rounded-[7px] text-[10px] font-bold leading-tight truncate cursor-pointer ${isSelected ? 'bg-white/25 text-white' : TYPE_META[e._type]?.chip || 'bg-[#EAF2FF] text-[#1264E8]'}`}>
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className={`px-[7px] py-0.5 rounded-[7px] text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-[#78869C]'}`}>+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                      {hasAttendance && (
                        <span className={`absolute left-2 bottom-1.5 w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-[#18A765]'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`flex flex-wrap items-center gap-[30px] mt-[19px] text-xs text-[#64748B] min-w-[650px] ${loading ? 'invisible' : ''}`}>
              {[['bg-[#1264E8]', 'Community event'], ['bg-[#F59E0B]', 'Maintenance'], ['bg-[#18A765]', 'Attendance recorded']].map(([dot, label]) => (
                <span key={label} className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside className="flex flex-col gap-[18px]">

          {/* Overview */}
          <section className="bg-white border border-[#DFE7F2] rounded-[17px] shadow-[0_4px_18px_rgba(15,35,70,0.07)] p-5">
            <div className="flex items-center gap-3 text-lg font-extrabold text-[#102348] mb-5">
              <span className="w-[39px] h-[39px] grid place-items-center rounded-[11px] bg-[#EDF4FF] text-xevera-600 text-[19px]">▣</span>
              Calendar Overview
            </div>
            {[
              ['▣', 'bg-[#EDF4FF] text-xevera-600', stats.upcoming, 'Upcoming Events', 'This month'],
              ['🔧', 'bg-[#FFF4E4] text-[#F59E0B]', stats.maintenance, 'Maintenance', 'Scheduled'],
              ['✓', 'bg-[#EAF8F0] text-[#18A765]', stats.attendance, 'Attendance Recorded', 'This month'],
            ].map(([icon, tint, n, t, sub]) => (
              <div key={t} className={`flex items-center gap-3.5 py-[13px] ${t !== 'Upcoming Events' ? '' : ''} [&+&]:border-t [&+&]:border-[#EDF1F6]`}>
                <span className={`w-[45px] h-[45px] flex-shrink-0 grid place-items-center rounded-[12px] text-xl ${tint}`}>{icon}</span>
                <div>
                  <span className="text-[27px] font-extrabold text-[#102348] leading-none mr-1.5">{n}</span>
                  <span className="text-[15px] font-semibold text-[#102348]">{t}</span>
                  <div className="text-xs text-[#64748B] mt-1">{sub}</div>
                </div>
              </div>
            ))}
          </section>

          {/* Upcoming */}
          <section className="bg-white border border-[#DFE7F2] rounded-[17px] shadow-[0_4px_18px_rgba(15,35,70,0.07)] p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 text-lg font-extrabold text-[#102348]">
                <span className="w-[39px] h-[39px] grid place-items-center rounded-[11px] bg-[#EDF4FF] text-xevera-600 text-[19px]">▣</span>
                Upcoming Events
              </div>
              <button onClick={() => setActiveFilter('all')} className="border-none bg-transparent text-xevera-600 text-[13px] font-bold hover:underline cursor-pointer">View all</button>
            </div>

            {loading ? (
              <SkeletonRows rows={3} />
            ) : upcoming.length === 0 ? (
              <StaffEmptyState title="No upcoming events." description="Scheduled events will appear here." />
            ) : (
              <>
                {upcoming.map((e, i) => {
                  const d = new Date(e.key + 'T00:00:00');
                  const meta = TYPE_META[e._type] || TYPE_META.community;
                  return (
                    <div key={i} onClick={() => openEvent(e)}
                      className="flex items-center gap-3 py-[17px] border-t border-[#EDF1F6] cursor-pointer hover:bg-[#FBFDFF] transition-colors -mx-1 px-1 rounded-[9px]">
                      <div className={`w-[61px] min-w-[61px] h-[62px] rounded-[12px] bg-[#F7F9FC] flex flex-col items-center justify-center ${meta.dateBox}`}>
                        <small className="text-[11px] font-extrabold">{MONTH_ABBR_SHORT[d.getMonth()]}</small>
                        <strong className="text-2xl leading-none mt-0.5">{d.getDate()}</strong>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-extrabold text-[#14213A] truncate mb-1.5">
                          <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${meta.dot}`} />{e.title}
                        </div>
                        <div className="flex flex-wrap gap-x-2.5 text-[11px] text-[#64748B] mb-1.5">
                          {formatTime(e.starts_at || e.date) && <span>◷ {formatTime(e.starts_at || e.date)}</span>}
                          {(e.location || e.venue) && <span>⌖ {e.location || e.venue}</span>}
                        </div>
                        <span className="inline-flex px-[9px] py-1 rounded-full bg-[#EDF4FF] text-xevera-600 text-[10px] font-bold">{meta.label}</span>
                      </div>
                      <span className="text-[22px] text-[#7B8CA7]">›</span>
                    </div>
                  );
                })}
                <div className="border-t border-[#EDF1F6] pt-[17px] text-center">
                  <button onClick={() => setActiveFilter('all')} className="border-none bg-transparent text-xevera-600 text-sm font-extrabold hover:underline cursor-pointer">
                    View all events ›
                  </button>
                </div>
              </>
            )}
          </section>
        </aside>
      </main>

      {/* INFO CARD */}
      <section className="mt-[18px] p-[15px_22px] rounded-[15px] bg-[#F1F6FF] border border-[#D8E7FF] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="w-[43px] h-[43px] grid place-items-center rounded-full bg-xevera-600 text-white text-xl">💡</span>
          <div>
            <div className="font-extrabold text-[#14213A] mb-1">Stay informed and involved</div>
            <div className="text-[13px] text-[#64748B]">Add events, track attendance, and never miss important community activities.</div>
          </div>
        </div>
        <button onClick={() => onNavigate && onNavigate('announcements')}
          className="px-[18px] py-[11px] rounded-[9px] border border-[#C9DCFB] bg-white text-xevera-600 text-[13px] font-bold hover:bg-[#EDF5FF] transition-colors cursor-pointer whitespace-nowrap">
          Learn more ↗
        </button>
      </section>

      {/* ADD EVENT MODAL */}
      <Modal
        open={addOpen}
        title="Add Event"
        description="Create a new calendar entry."
        confirmLabel={savingEvent ? 'Adding...' : 'Add Event'}
        cancelLabel="Cancel"
        onConfirm={submitEvent}
        onCancel={() => setAddOpen(false)}
        hideActions
      >
        <form onSubmit={submitEvent} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold mb-2 text-[#14213A]">Event Name</label>
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Barangay Meeting" required autoFocus
              className="w-full px-3 py-[11px] rounded-[9px] border border-[#D9E2EE] text-sm outline-none focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(18,100,232,0.1)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-bold mb-2 text-[#14213A]">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required
                className="w-full px-3 py-[11px] rounded-[9px] border border-[#D9E2EE] text-sm outline-none focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(18,100,232,0.1)]" />
            </div>
            <div>
              <label className="block text-[13px] font-bold mb-2 text-[#14213A]">Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} required
                className="w-full px-3 py-[11px] rounded-[9px] border border-[#D9E2EE] text-sm outline-none focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(18,100,232,0.1)]" />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-bold mb-2 text-[#14213A]">Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Xevera Commons"
              className="w-full px-3 py-[11px] rounded-[9px] border border-[#D9E2EE] text-sm outline-none focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(18,100,232,0.1)]" />
          </div>
          <div>
            <label className="block text-[13px] font-bold mb-2 text-[#14213A]">Event Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-[11px] rounded-[9px] border border-[#D9E2EE] text-sm outline-none focus:border-xevera-600 cursor-pointer">
              <option value="community">Community Event</option>
              <option value="maintenance">Maintenance</option>
              <option value="attendance">Attendance</option>
            </select>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setAddOpen(false)}
              className="px-[18px] py-2.5 rounded-[8px] border border-[#DFE7F2] bg-white text-sm font-bold text-[#14213A] hover:bg-[#F5F8FC] cursor-pointer">Cancel</button>
            <button type="submit" disabled={savingEvent}
              className="px-5 py-2.5 rounded-[8px] border-none bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-60 cursor-pointer">
              {savingEvent ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EVENT DETAILS MODAL */}
      <Modal
        open={details !== null}
        title="Event Details"
        description=""
        confirmLabel="Close"
        cancelLabel=""
        onConfirm={() => setDetails(null)}
        onCancel={() => setDetails(null)}
      >
        {details && (
          <div>
            <span className="inline-flex px-2.5 py-[5px] rounded-full bg-[#EDF4FF] text-xevera-600 text-[11px] font-extrabold mb-3">{details.type}</span>
            <h2 className="text-xl font-extrabold text-[#14213A] mb-[18px]">{details.title}</h2>
            {[['📅', details.date], ['🕐', details.time], ['📍', details.location]].map(([icon, v]) => (
              <div key={v} className="flex items-center gap-3 py-3 border-b border-[#EDF1F6] last:border-b-0 text-sm text-[#64748B]">
                <span>{icon}</span><strong className="text-[#102348]">{v}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

const MONTH_ABBR_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
