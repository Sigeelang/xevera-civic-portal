import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import CivicIllustration from '../../components/public/CivicIllustration';
import ServiceBanner from '../../components/public/ServiceBanner';
import ResidentPageHeader from '../../components/public/ResidentPageHeader';

const CONTACT_GROUPS = [
  {
    title: 'Emergency & Safety',
    icon: 'alerttriangle',
    iconBg: '#FFF0F1',
    iconColor: '#EF3E3E',
    titleColor: '#EF3E3E',
    phoneColor: '#EF3E3E',
    phoneBg: '#FFFAFA',
    phoneBorder: '#FFD0D0',
    items: [
      { name: 'PNP Bacolor', phones: ['0998-595-5452 / 0917-805-4164 / 0998-598-5451', '09985955452'] },
      { name: 'BFP Bacolor', phones: ['0923-103-8363 / (045) 436-1828', '09231038363'] },
      { name: 'Bacolor Municipal Health Office', phones: ['(045) 436-1418', '0454361418'] },
      { name: 'Rescue Ambulance', phones: ['0920-912-3456 / (045) 436-1991', '09209123456'] },
      { name: 'Disaster Risk Reduction Office', phones: ['(045) 436-2579', '0454362579'] },
    ],
  },
  {
    title: 'Xevera Community',
    icon: 'users',
    iconBg: '#EDF5FF',
    iconColor: '#1769FF',
    titleColor: '#1769FF',
    phoneColor: '#1769FF',
    phoneBg: '#F8FBFF',
    phoneBorder: '#CDDDF8',
    items: [
      { name: 'HOA Office', phones: ['0951-595-2696', '09515952696'] },
      { name: 'HOA Command Center', phones: ['0939-108-2760', '09391082760'] },
      { name: 'Xevera Guard House', phones: ['0927-123-4567', '09271234567'] },
      { name: 'Clubhouse', phones: ['(045) 436-2001', '0454362001'] },
      { name: 'Property Management Office', phones: ['(045) 436-2100', '0454362100'] },
    ],
  },
  {
    title: 'Utilities',
    icon: 'drop',
    iconBg: '#EDF9F3',
    iconColor: '#159957',
    titleColor: '#159957',
    phoneColor: '#159957',
    phoneBg: '#F7FDF9',
    phoneBorder: '#C5E9D8',
    items: [
      { name: 'Xevera Water', phones: ['0932-190-2508', '09321902508'] },
      { name: 'A.E.C', phones: ['(045) 888-2888', '0458882888'] },
      { name: 'Meralco', phones: ['0917-551-6211', '09175516211'] },
      { name: 'PLDT', phones: ['171', '171'] },
      { name: 'Garbage Collection', phones: ['(045) 436-2555', '0454362555'] },
    ],
  },
];

function telHref(num) {
  return `tel:${String(num || '').replace(/[^0-9+]/g, '')}`;
}

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
  const { user } = useAuth();
  const isResident = user?.role === 'Resident';
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
      {isResident ? (
        <ResidentPageHeader
          title="Maintenance"
          description="Stay informed about scheduled maintenance, service interruptions, and community updates."
        />
      ) : (
        <ServiceBanner
          eyebrow="SERVICE STATUS & UPDATES"
          title="Maintenance"
          description="Stay informed about scheduled maintenance, service interruptions, and community updates."
          badgeText="SERVICE STATUS & UPDATES"
          badgeIcon
          image="/images/xevera-hero.jpeg"
          height={{ desktop: 360, tablet: 320, mobile: 240 }}
        />
      )}
      <div className={isResident ? 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-0 pb-8 sm:pb-10' : 'max-w-[1280px] mx-auto px-5 sm:px-8 mt-8 sm:mt-10'}>
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

      {/* EMERGENCY & IMPORTANT CONTACTS */}
      <section className="mt-5">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-[38px] h-[38px] rounded-[10px] bg-[#EEF5FF] text-[#1769FF] grid place-items-center">
            <Icon name="phone" size={18} />
          </span>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0F2F63]">Emergency & Important Contacts</h2>
            <p className="text-[12px] text-[#7183A1] mt-0.5">Save these numbers for quick access when you need help.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {CONTACT_GROUPS.map((group) => (
            <article
              key={group.title}
              className="bg-white border border-[#DCE5F1] rounded-[18px] overflow-hidden shadow-[0_6px_18px_rgba(20,60,110,0.04)] hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(25,55,100,0.08)] transition-all"
            >
              <header
                className="px-6 py-5 flex items-center gap-4"
                style={{ borderBottom: '1px solid #EDF1F6' }}
              >
                <span
                  className="w-[52px] h-[52px] rounded-[14px] grid place-items-center flex-shrink-0"
                  style={{ background: group.iconBg, color: group.iconColor }}
                >
                  <Icon name={group.icon} size={25} />
                </span>
                <h3
                  className="text-[18px] font-extrabold tracking-[-0.01em]"
                  style={{ color: group.titleColor }}
                >
                  {group.title}
                </h3>
              </header>

              <div className="px-6 pb-3">
                {group.items.map((item) => (
                  <a
                    key={item.name}
                    href={telHref(item.phones[1])}
                    className="min-h-[73px] py-4 flex items-center gap-3.5 border-b border-[#EDF1F6] last:border-b-0 group"
                  >
                    <span
                      className="w-10 h-10 flex-shrink-0 rounded-full grid place-items-center border"
                      style={{
                        color: group.phoneColor,
                        borderColor: group.phoneBorder,
                        background: group.phoneBg,
                      }}
                    >
                      <Icon name="phonecall" size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-[#142F59] mb-1">
                        {item.name}
                      </div>
                      <div className="text-[12px] leading-[1.45] text-[#687B99] group-hover:text-[#1769FF] transition-colors break-words">
                        {item.phones[0]}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>

        {/* 911 Notice */}
        <div className="mt-6 min-h-[90px] px-6 py-5 flex items-center gap-5 bg-white border border-[#DCE5F1] rounded-[18px] shadow-[0_6px_18px_rgba(20,60,110,0.04)]">
          <span className="w-12 h-12 flex-shrink-0 rounded-[14px] grid place-items-center bg-[#EDF5FF] text-[#1769FF] text-[22px] font-extrabold">
            <Icon name="shield" size={22} />
          </span>
          <p className="text-[14px] leading-[1.65] text-[#344C70]">
            For life-threatening emergencies, please call{' '}
            <a href="tel:911" className="text-[#1769FF] font-extrabold hover:underline">
              911
            </a>{' '}
            immediately. Your safety is our priority.
          </p>
        </div>
      </section>
    </div>
    </>
  );
}
