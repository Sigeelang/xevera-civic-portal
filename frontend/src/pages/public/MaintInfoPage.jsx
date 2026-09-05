import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import Icon from '../../components/Icon';
import CivicIllustration from '../../components/public/CivicIllustration';
import ServiceBanner from '../../components/public/ServiceBanner';

const WEEK_HOURS = [
  { icon: 'wrench', label: 'Monday – Friday', value: '8:00 AM - 5:00 PM' },
  { icon: 'wrench', label: 'Saturday', value: '8:00 AM - 12:00 PM' },
  { icon: 'wrench', label: 'Sunday / Holidays', value: 'On-call for emergencies only' },
];

function fmtWindow(startRaw, endRaw) {
  const start = startRaw ? new Date(startRaw.replace(' ', 'T')) : null;
  const end = endRaw ? new Date(endRaw.replace(' ', 'T')) : null;
  const opts = { month: 'long', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: 'numeric', minute: '2-digit' };
  return {
    date: start ? start.toLocaleDateString('en-US', opts) : '',
    startTime: start ? start.toLocaleTimeString('en-US', timeOpts) : '',
    endTime: end ? end.toLocaleTimeString('en-US', timeOpts) : '',
    full: start ? `${start.toLocaleString('en-US', { ...opts, ...timeOpts })} – ${end ? end.toLocaleString('en-US', timeOpts) : ''}` : '',
  };
}

function StatusPill({ status }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-xevera-50 border border-[rgba(18,88,232,0.22)] text-xevera-700 text-[11px] font-bold">
        <span className="w-1.5 h-1.5 rounded-full bg-xevera-600 animate-pulse" /> IN PROGRESS
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E4F6EC] border border-[rgba(30,168,91,0.25)] text-success-dark text-[11px] font-bold">
        <Icon name="check" size={11} strokeWidth={3} /> COMPLETED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-xevera-600 text-xevera-600 text-[11px] font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-xevera-600" /> SCHEDULED
    </span>
  );
}

function MaintCard({ w }) {
  const win = fmtWindow(w.start_at, w.end_at);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4">
      <span className="w-10 h-10 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
        <Icon name="wrench" size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={w.status} />
          {w.duration_display && (
            <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[11px] font-semibold">
              <Icon name="clock" size={11} strokeWidth={2.2} className="inline mr-0.5" />
              {w.duration_display}
            </span>
          )}
        </div>
        <div className="text-sm font-bold text-[#111827] mt-1.5">{w.reason || 'Scheduled System Maintenance'}</div>
        <div className="text-[13px] font-semibold text-xevera-600 mt-0.5">
          {win.date && <span className="mr-2">{win.date}</span>}
          {win.startTime && <span>{win.startTime}{win.endTime ? ' \u2013 ' + win.endTime : ''}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MaintInfoPage({ onNavigate }) {
  const [windows, setWindows] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch('maintenance/public.php')
      .then((d) => {
        setWindows(Array.isArray(d.items) ? d.items : []);
        setCompleted(Array.isArray(d.completed) ? d.completed : []);
      })
      .catch(() => setWindows([]))
      .finally(() => setLoaded(true));
  }, []);

  const upcoming = windows.filter((w) => w.status === 'scheduled');
  const current = windows.filter((w) => w.status === 'running');

  return (
    <>
      <ServiceBanner
        eyebrow="SERVICE STATUS & UPDATES"
        title="Maintenance"
        description="Stay informed about scheduled maintenance, service interruptions, and community updates."
        badgeText="SERVICE STATUS & UPDATES"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 mt-8 sm:mt-10">
      {/* Current / Upcoming */}
      <section className="bg-white rounded-[22px] border border-[#E5E7EB] p-6 sm:p-7 shadow-[0_8px_24px_rgba(16,24,40,0.05)] mb-5">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-[17px] font-extrabold text-[#0B1220] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center">
              <Icon name="wrench" size={18} strokeWidth={2} />
            </span>
            Scheduled System Maintenance
          </h2>
          <span className="px-3 py-1 rounded-full bg-xevera-50 border border-[rgba(18,88,232,0.18)] text-[11px] font-bold uppercase tracking-widest text-xevera-600">
            {windows.length} {windows.length === 1 ? 'window' : 'windows'}
          </span>
        </div>

        {current.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[13px] font-extrabold text-[#111827] mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-xevera-600 animate-pulse" /> Currently In Progress
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {current.map((w) => <MaintCard key={w.id} w={w} />)}
            </div>
          </div>
        )}

        {windows.length === 0 ? (
          <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-[13px] text-[#64748B]">
            No maintenance windows are currently scheduled. The portal will stay live for everyone.
          </div>
        ) : (
          <>
            {current.length > 0 && (
              <h3 className="text-[13px] font-extrabold text-[#111827] mb-3">Upcoming Windows</h3>
            )}
            {upcoming.length === 0 && current.length === 0 ? null : (
              <div className="grid grid-cols-1 gap-3">
                {upcoming.map((w) => <MaintCard key={w.id} w={w} />)}
              </div>
            )}
            {upcoming.length === 0 && current.length > 0 && (
              <p className="text-[12px] text-[#9CA3AF] mt-3">No further maintenance windows are scheduled.</p>
            )}
          </>
        )}
      </section>

      {/* Completed */}
      {completed.length > 0 && (
        <section className="bg-white rounded-[22px] border border-[#E5E7EB] p-6 sm:p-7 shadow-[0_8px_24px_rgba(16,24,40,0.05)] mb-5">
          <h2 className="text-[17px] font-extrabold text-[#0B1220] flex items-center gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-xl bg-[#E4F6EC] text-success-dark flex items-center justify-center">
              <Icon name="check" size={18} strokeWidth={2.5} />
            </span>
            Completed Maintenance
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {completed.slice(0, 5).map((w) => <MaintCard key={w.id} w={w} />)}
          </div>
        </section>
      )}

      {/* Facility hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <section className="bg-white rounded-[22px] border border-[#E5E7EB] p-6 shadow-[0_8px_24px_rgba(16,24,40,0.05)]">
          <h2 className="text-[17px] font-extrabold text-[#0B1220] flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center">
              <Icon name="calendar" size={18} strokeWidth={2} />
            </span>
            Facility Hours
          </h2>
          <p className="text-[14px] text-[#64748B] mt-1.5 leading-relaxed">The maintenance office is open during the hours below for service requests and inquiries.</p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            {WEEK_HOURS.map((it) => (
              <div key={it.label} className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4">
                <span className="w-9 h-9 rounded-lg bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
                  <Icon name={it.icon} size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#111827]">{it.label}</div>
                  {it.value && <div className="text-[13px] font-semibold text-xevera-600">{it.value}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-[rgba(18,88,232,0.12)] bg-[linear-gradient(150deg,#F8FBFF_0%,#EEF4FE_100%)] p-6 flex flex-col justify-center">
          <h2 className="text-[17px] font-extrabold text-[#0B1220] flex items-center gap-2.5 mb-2">
            <span className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] text-xevera-600 flex items-center justify-center">
              <Icon name="bell" size={18} strokeWidth={2} />
            </span>
            Stay Notified
          </h2>
          <p className="text-[14px] text-[#64748B] leading-relaxed">
            We post scheduled maintenance in advance so you always know when the portal may be temporarily unavailable.
          </p>
          <button
            onClick={() => onNavigate && onNavigate('announcements')}
            className="mt-4 inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full bg-xevera-600 text-white text-[13px] font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            View Announcements
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </section>
</div>
    </div>
    </>
  );
}
