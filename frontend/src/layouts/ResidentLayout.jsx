import { useState, useEffect, useLayoutEffect, useRef, createContext, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/Toast';
import { apiFetch } from '../services/api';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { useResidentNotifications } from '../context/ResidentNotificationsContext';
import Avatar from '../components/Avatar';

const ResidentLayoutContext = createContext(null);

export function useResidentLayout() {
  const ctx = useContext(ResidentLayoutContext);
  if (!ctx) throw new Error('useResidentLayout must be used within ResidentLayout');
  return ctx;
}

const NAV_MAIN = [
  { key: 'resident-dashboard', label: 'Dashboard', icon: 'home', action: 'resident-dashboard' },
];

const NAV_REPORTING = [
  { key: 'submit',        label: 'Report an Issue',  icon: 'clipboard', action: 'submit' },
  { key: 'my-reports',    label: 'My Reports',       icon: 'file',     action: 'my-reports' },
  { key: 'community-reports', label: 'Community Reports', icon: 'users', action: 'community-reports' },
];

const NAV_VIOLATIONS = [
  { key: 'my-violations', label: 'My Violations', icon: 'alert', action: 'my-violations' },
];

const NAV_COMMUNICATION = [
  { key: 'messages',      label: 'Message Box',      icon: 'letter',   action: 'messages' },
  { key: 'notifications', label: 'Notifications',    icon: 'bell',     action: 'notifications' },
  { key: 'announcements', label: 'Announcements',    icon: 'megaphone', action: 'announcements' },
];

const NAV_COMMUNITY = [
  { key: 'maintenance',   label: 'Maintenance',        icon: 'wrench',    action: 'maintenance' },
  { key: 'emergency',     label: 'Emergency Contact',  icon: 'phone',     action: 'emergency' },
];

const NAV_SUPPORT = [
  { key: 'help',    label: 'Help Center',     icon: 'book',  action: 'help' },
  { key: 'contact', label: 'Contact Support', icon: 'phone', action: 'contact' },
];

const NAV_ACCOUNT = [
  { key: 'my-account',      label: 'My Account', icon: 'user',  action: 'my-account' },
];

/*
 * Sidebar scroll positions, kept at module scope (NOT in a ref) so they
 * survive unmount/remount: most resident pages render their own
 * <ResidentLayout>, so a per-instance ref resets to 0 on every page
 * navigation. Desktop and mobile drawer have SEPARATE <nav> elements,
 * so each keeps its own position. Never read during render — only in
 * event/effect handlers.
 */
let residentSidebarScroll = { desktop: 0, mobile: 0 };

function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#residentLogoGrad)" />
      <defs>
        <linearGradient id="residentLogoGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#2E6BF0" />
          <stop offset="100%" stopColor="#0B3AAB" />
        </linearGradient>
      </defs>
      <path d="M16 5C11 5 7 9 7 16c0 7 4 11 9 11 5 0 11-4 11-11 0-7-6-11-11-11Z" fill="#FFFFFF" opacity="0.55" />
      <path d="M16 9C13 9 11 12 11 16c0 4 3 6 5 6 4 0 7-2 7-6 0-4-2-7-7-7Z" fill="#FFFFFF" opacity="0.25" />
      <path d="M16 13c-1.5 0-2.5.9-2.5 3-.5 2 .5 2.5.5 2.5 2 0 2.5-1 2.5-2.5 0-1.5-.5-3-.5-3Z" fill="#FFFFFF" />
    </svg>
  );
}

/* Notification visual metadata - subtle, blue-dominant. */
function notifMeta(type, reportId) {
  const t = String(type || '');
  if (t === 'announcement') return { name: 'megaphone', cls: 'bg-[#E8F7EF] text-[#12864B]' };
  if (/message|reply|contact/.test(t)) return { name: 'letter', cls: 'bg-[#EAF2FF] text-[#1769FF]' };
  if (/report|status|assign/.test(t) || reportId) return { name: 'file', cls: 'bg-[#EAF2FF] text-[#1769FF]' };
  return { name: 'bell', cls: 'bg-[#F1F5F9] text-[#64748B]' };
}

/* "New reply from Super Admin: Your contact message" -> title + preview. */
function notifText(message) {
  const raw = String(message || '').trim();
  const idx = raw.indexOf(': ');
  if (idx > 0 && idx < 80) {
    return { title: raw.slice(0, idx), preview: raw.slice(idx + 2) };
  }
  return { title: raw, preview: '' };
}

/* Does a notification belong to the Reports tab? */
function isReportNotif(n) {
  return Boolean(n.report_id) || /report|status|assign/.test(String(n.type || ''));
}

export default function ResidentLayout({ activePage, eyebrow = 'Resident Portal', onNavigate, children, fullWidth }) {
  const { user, logout } = useAuth();
  const { siteName } = useSettings();
  const showToast = useToast();
  const { notifs, notifUnread, markAllRead, openNotif } = useResidentNotifications();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCat, setNotifCat] = useState('all');
  const [notifRead, setNotifRead] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;

  /*
   * Breakpoint split for the notification panel:
   *   - mobile  (<640px): centered sheet-style modal with a backdrop.
   *   - desktop (>=640px): popover anchored under the bell.
   * Only the notification LIST scrolls; header/tabs/footer stay put.
   */
  const [isMobileNotif, setIsMobileNotif] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e) => setIsMobileNotif(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Lock the page behind the mobile sheet so nothing else scrolls. */
  useEffect(() => {
    if (!(notifOpen && isMobileNotif)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [notifOpen, isMobileNotif]);

  /*
   * Viewing = reading: once the bell dropdown has been open for a
   * moment, clear the unread badge automatically so a stale
   * "1 new" count can never stick on the top bar.
   */
  useEffect(() => {
    if (!notifOpen) return undefined;
    const t = setTimeout(() => { try { markAllReadRef.current(); } catch {} }, 2000);
    return () => clearTimeout(t);
  }, [notifOpen]);
  const desktopNavRef = useRef(null);
  const mobileNavRef = useRef(null);

  /* Restore both saved sidebar scrolls once on mount (before paint). */
  useLayoutEffect(() => {
    try {
      if (desktopNavRef.current) desktopNavRef.current.scrollTop = residentSidebarScroll.desktop || 0;
      if (mobileNavRef.current) mobileNavRef.current.scrollTop = residentSidebarScroll.mobile || 0;
    } catch {}
  }, []);

  function saveSidebarScroll() {
    try {
      if (desktopNavRef.current) residentSidebarScroll.desktop = desktopNavRef.current.scrollTop;
      if (mobileNavRef.current) residentSidebarScroll.mobile = mobileNavRef.current.scrollTop;
    } catch {}
  }

  /* Live unread badge for the Message Box nav item */
  const [msgUnread, setMsgUnread] = useState(0);
  /* Active (currently enforced) violation count for the sidebar badge */
  const [violationActive, setViolationActive] = useState(0);
  /*
   * PHASE 2 — stale-state isolation.
   * The DM-unread poll is keyed on user identity, not on the `user` object
   * reference (which may swap on every login without .id changing). Any
   * in-flight response captured before an identity change is discarded via
   * an epoch guard, so a previous user's "Message Box 8" can never bleed
   * into the newly signed-in account's UI.
   */
  const epochRef = useRef(0);
  useEffect(() => {
    // Bump epoch on every identity change (including logout) and reset
    // the badge so a stale value from the prior user cannot flash.
    epochRef.current += 1;
    setMsgUnread(0);
    if (!user) return undefined;
    const myEpoch = epochRef.current;
    let mounted = true;
    const load = () => {
      apiFetch('direct_messages/list.php?limit=1')
        .then((d) => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return; // identity changed mid-flight
          setMsgUnread(d?.unread || 0);
        })
        .catch(() => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return;
          setMsgUnread(0);
        });
    };
    load();
    const t = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [user?.id, user?.role]);

  /* Active-violation badge: enforced penalties only (not warnings). */
  const violationEpochRef = useRef(0);
  useEffect(() => {
    violationEpochRef.current += 1;
    setViolationActive(0);
    if (!user || user.role !== 'Resident') return undefined;
    const myEpoch = violationEpochRef.current;
    let mounted = true;
    const enforcing = ['Reporting Restriction', 'Short Suspension', 'Long Suspension', 'Permanent Restriction', 'Indefinite Suspension', 'Fine'];
    const loadViolations = () => {
      apiFetch('violations/my.php')
        .then((d) => {
          if (!mounted) return;
          if (myEpoch !== violationEpochRef.current) return;
          const list = Array.isArray(d?.violations) ? d.violations : [];
          const now = Date.now();
          const active = list.filter((v) => {
            if (v.status !== 'Confirmed' && v.status !== 'Appealed') return false;
            if (v.penalty_type === 'Permanent Restriction' || v.penalty_type === 'Indefinite Suspension') return true;
            if (!enforcing.includes(v.penalty_type)) return false;
            const raw = v.penalty_end_at || v.restriction_until;
            if (!raw) return true;
            const end = new Date(String(raw).replace(' ', 'T')).getTime();
            return Number.isNaN(end) || end > now;
          }).length;
          setViolationActive(active);
        })
        .catch(() => {
          if (!mounted) return;
          if (myEpoch !== violationEpochRef.current) return;
          setViolationActive(0);
        });
    };
    loadViolations();
    const t = setInterval(loadViolations, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [user?.id, user?.role]);

  const firstName = (user?.name || 'Neighbor').trim().split(' ')[0];
  const residentId = 'XR-RES-' + String(user?.id || '').padStart(6, '0');

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onDown = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [profileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {}
    setLoggingOut(false);
    setLogoutOpen(false);
    showToast('You have been signed out.');
    if (onNavigate) onNavigate('home');
  }

  /*
   * NOTE: Sidebar/NavItem/NavSection/NavDivider are declared inside this
   * component, so each render creates NEW component types. They must be
   * invoked as PLAIN FUNCTIONS ({Sidebar({...})}), never as JSX tags
   * (<Sidebar />) — a fresh type every render would make React unmount
   * and remount the whole sidebar (wiping <nav> scroll) on every render,
   * including background badge polls.
   */
  function goTo(action) {
    saveSidebarScroll();
    setSidebarOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    if (onNavigate) onNavigate(action);
  }

  function NavItem({ icon, label, active, onClick, badge }) {
    return (
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`relative flex items-center gap-3 w-full min-h-[42px] text-left bg-none border-none px-3.5 rounded-[10px] text-[14px] font-bold transition-all duration-150 cursor-pointer group ${
          active
            ? 'bg-xevera-50 text-xevera-700'
            : 'text-[#374151] hover:bg-[#F4F7FC] hover:text-navy-950'
        }`}
      >
        {active && <span className="absolute left-0 top-[9px] bottom-[9px] w-[4px] rounded-r-full bg-xevera-600" />}
        <span className={`grid place-items-center w-5 h-5 flex-shrink-0 self-center transition-transform duration-150 group-hover:scale-110 ${active ? 'text-xevera-600' : 'text-[#6B7280]'}`}>
          <Icon name={icon} size={20} className="block" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        {badge > 0 && (
          <span className="min-w-[21px] h-[21px] px-1.5 rounded-full bg-xevera-600 text-white grid place-items-center text-[10px] font-extrabold flex-shrink-0">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  }

  function NavSection({ children, label }) {
    return (
      <div>
        {label && (
          <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-[#9CA3AF] px-3.5 mb-2">{label}</div>
        )}
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    );
  }

  function NavDivider() {
    return <div className="mt-2 mx-3.5 mb-4 border-t border-[#DFE6EF]" />;
  }

  function Sidebar({ extra, navRef, kind }) {
    return (
      <aside {...extra} className={`${extra?.className || ''} pt-4`}>
        <div className="flex items-center gap-2.5 px-[18px] h-[64px] border-b border-[#DFE6EF] bg-white">
          <Logo size={28} />
          <div className="text-left min-w-0">
            <div className="font-head font-extrabold text-[14px] leading-tight text-navy-950 tracking-[0.08em]">XEVERA</div>
            <div className="text-[8.5px] font-bold tracking-[0.28em] uppercase text-xevera-600 mt-[3px]">CIVIC PORTAL</div>
          </div>
        </div>

        <nav ref={navRef} data-nav-kind={kind} onScroll={(e) => { try { residentSidebarScroll[kind] = e.currentTarget.scrollTop; } catch {} }} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pb-4 pt-5 bg-white" style={{ scrollbarWidth: 'thin' }} aria-label="Resident navigation">
          <NavSection label="Main">
            {NAV_MAIN.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Reporting">
            {NAV_REPORTING.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Violations">
            {NAV_VIOLATIONS.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
                badge={item.key === 'my-violations' ? violationActive : 0}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Communication">
            {NAV_COMMUNICATION.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
                badge={item.key === 'messages' ? msgUnread : 0}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Community">
            {NAV_COMMUNITY.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Support">
            {NAV_SUPPORT.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
              />
            ))}
          </NavSection>

          <NavDivider />

          <NavSection label="Account">
            {NAV_ACCOUNT.map((item) => (
              <NavItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                active={activePage === item.key}
                onClick={() => goTo(item.action)}
              />
            ))}
          </NavSection>

          <button
            onClick={() => { setSidebarOpen(false); setLogoutOpen(true); }}
            aria-label="Sign out"
            className="mt-1 w-full flex items-center gap-3 px-3.5 min-h-[42px] rounded-[10px] text-[14px] font-bold bg-none border-none cursor-pointer text-[#DC2626] hover:bg-red-50 transition-colors"
          >
            <span className="grid place-items-center w-5 h-5 flex-shrink-0 self-center">
              <Icon name="door" size={20} className="block" />
            </span>
            <span className="flex-1 text-left">Logout</span>
          </button>
        </nav>

        <div className="flex-shrink-0 border-t border-[#DFE6EF] px-3 py-3 bg-white">
          <div className="flex items-center gap-2.5 px-1.5">
            <Avatar name={user?.name} photo={user?.photo} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-navy-950 truncate">{user?.name || 'Resident'}</div>
              <div className="text-[10.5px] text-xevera-600 font-semibold truncate">{residentId}</div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  /* Counts + segments for the notification panel (recommended design:
     separate category segment and read-status segment rows). */
  const notifCats = [
    { key: 'all', label: 'All', count: notifs.length },
    { key: 'report', label: 'Reports', count: notifs.filter(isReportNotif).length },
    { key: 'violation', label: 'Violations', count: notifs.filter((n) => /violation/.test(String(n.type || ''))).length },
    { key: 'announcement', label: 'Announcements', count: notifs.filter((n) => String(n.type) === 'announcement').length },
  ];

  const notifList = notifs.filter((n) => {
    const catOk = notifCat === 'all'
      || (notifCat === 'report' && isReportNotif(n))
      || (notifCat === 'violation' && /violation/.test(String(n.type || '')))
      || (notifCat === 'announcement' && String(n.type) === 'announcement');
    const readOk = notifRead === 'all'
      || (notifRead === 'read' && n.read)
      || (notifRead === 'unread' && !n.read);
    return catOk && readOk;
  });

  /* Shared panel body used by both the mobile sheet and the desktop popover. */
  function notifPanelBody(mobile) {
    return (
      <>
        <style>{'.xevera-no-scrollbar::-webkit-scrollbar{display:none}'}</style>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-[#EDF1F6] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="m-0 text-[15px] font-extrabold text-[#102957]">Notifications</h2>
            <p className="mt-0.5 text-[11.5px] text-[#64748B]">Stay updated with the latest activities.</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!mobile && notifUnread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center px-2 h-9 rounded-lg text-[11px] font-bold text-[#1769FF] hover:bg-[#EDF4FF] transition-colors cursor-pointer bg-transparent border-none"
              >
                Mark all as read
              </button>
            )}
            {mobile && (
              <button
                onClick={() => setNotifOpen(false)}
                aria-label="Close notifications"
                className="w-9 h-9 grid place-items-center rounded-lg bg-[#F1F5FA] hover:bg-[#E7EEF8] text-[#102957] text-[19px] leading-none cursor-pointer border-none"
              >
                {'\u00D7'}
              </button>
            )}
          </div>
        </div>

        {/* Category segment */}
        <div className="px-3 pt-2.5 flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#E2EAF3] bg-[#F7FAFD] p-1 xevera-no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} role="tablist" aria-label="Notification category">
            {notifCats.map((t) => (
              <button
                key={t.key}
                onClick={() => setNotifCat(t.key)}
                role="tab"
                aria-selected={notifCat === t.key}
                className={`h-[34px] px-3 flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  notifCat === t.key
                    ? 'bg-[#1769FF] text-white shadow-[0_3px_10px_rgba(23,105,255,0.3)]'
                    : 'text-[#526582] hover:bg-white'
                }`}
              >
                {t.label}
                <span className={notifCat === t.key ? 'text-white/80' : 'text-[#94A3B8]'}>({t.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Read-status segment */}
        <div className="px-3 pt-1.5 pb-2 flex-shrink-0">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#E2EAF3] bg-[#F7FAFD] p-1 xevera-no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} role="tablist" aria-label="Read status">
            {[['all', 'All'], ['unread', `Unread (${notifUnread})`], ['read', 'Read']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setNotifRead(key)}
                role="tab"
                aria-selected={notifRead === key}
                className={`h-[34px] px-3 flex-shrink-0 inline-flex items-center rounded-lg text-[12px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  notifRead === key
                    ? 'bg-[#102957] text-white shadow-[0_3px_10px_rgba(16,41,87,0.3)]'
                    : 'text-[#526582] hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List - the ONLY scrollable region */}
        <div
          className={mobile ? 'flex-1 min-h-0 overflow-y-auto' : 'max-h-[300px] sm:max-h-[360px] overflow-y-auto'}
          style={{ scrollbarWidth: 'thin' }}
        >
          {notifList.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <span className="w-10 h-10 mx-auto rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mb-2">
                <Icon name="bell" size={17} />
              </span>
              <p className="text-[12.5px] font-bold text-[#374151]">
                {notifs.length === 0 ? "You're all caught up" : 'No notifications match these filters'}
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">You'll be notified when there is progress.</p>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {notifList.slice(0, 12).map((n) => {
                const meta = notifMeta(n.type, n.report_id);
                const { title, preview } = notifText(n.message);
                return (
                  <li key={n.id} className="border-b border-[#E8EEF7] last:border-b-0">
                    <button
                      onClick={() => { openNotif(n); setNotifOpen(false); }}
                      aria-label={`${n.read ? '' : 'Unread: '}${title}`}
                      className="w-full min-h-[56px] flex items-start gap-3 px-3.5 py-3 text-left bg-transparent border-none transition-colors cursor-pointer hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:bg-[#F1F6FF]"
                    >
                      <span className={`w-9 h-9 rounded-full grid place-items-center flex-shrink-0 ${meta.cls}`} aria-hidden="true">
                        <Icon name={meta.name} size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className={`min-w-0 flex-1 text-[13px] leading-snug ${n.read ? 'text-[#334155] font-semibold' : 'text-[#102957] font-extrabold'}`}>
                            {title}
                          </span>
                          {/* Unread is shown with a dot AND heavier text - never colour alone. */}
                          {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#1769FF] flex-shrink-0" aria-hidden="true" />}
                        </span>
                        {preview && <span className="block text-[11.5px] text-[#64748B] mt-0.5 truncate">{preview}</span>}
                        <span className="block text-[11px] text-[#94A3B8] mt-1">{n.date}</span>
                      </span>
                      <span className="self-center flex-shrink-0 text-[16px] text-[#94A3B8]" aria-hidden="true">{'\u203A'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-[#EDF1F6] bg-white flex-shrink-0">
          <button
            onClick={() => { setNotifOpen(false); goTo('notifications'); }}
            className="w-full h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EDF4FF] text-[#1769FF] text-[13px] font-extrabold hover:bg-[#DCE9FD] transition-colors cursor-pointer border-none"
          >
            View all notifications <span aria-hidden="true">{'\u2192'}</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <ResidentLayoutContext.Provider value={{ openLogout: () => setLogoutOpen(true) }}>
      <div
        className="min-h-screen"
        style={{ background: 'radial-gradient(1200px 400px at 70% -100px, rgba(23,105,255,0.05), transparent), var(--xevera-bg)' }}
      >
        {/* Desktop sidebar */}
        <div className="hidden lg:block fixed inset-y-0 left-0 w-[var(--xevera-sidebar-width)] z-30 border-r border-[#DFE6EF] bg-white">
          {Sidebar({ extra: { className: 'flex h-full min-h-0 flex-col' }, navRef: desktopNavRef, kind: 'desktop' })}
        </div>

        {/* Mobile drawer */}
        {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
        <div
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[var(--xevera-sidebar-mobile)] flex flex-col h-full border-r border-[#DFE6EF] bg-white transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {Sidebar({ extra: { className: 'flex h-full min-h-0 flex-col' }, navRef: mobileNavRef, kind: 'mobile' })}
        </div>

        {/*
          Mobile notifications: centered sheet rendered at the layout root so it
          is always positioned against the viewport (never clipped, never
          causing horizontal overflow). Only the list scrolls.
        */}
        {notifOpen && isMobileNotif && (
          <div className="lg:hidden fixed inset-0 z-[1000] flex items-center justify-center px-3" role="dialog" aria-modal="true" aria-label="Notifications">
            <div className="absolute inset-0 bg-[rgba(12,27,54,0.45)]" onClick={() => setNotifOpen(false)} />
            <div
              className="relative flex w-[93vw] max-w-[420px] max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-[#DCE6F3] bg-white"
              style={{ boxShadow: '0 18px 45px rgba(15,42,80,0.22)' }}
            >
              {notifPanelBody(true)}
            </div>
          </div>
        )}

        <div className="lg:pl-[var(--xevera-sidebar-width)]">
          {/* Top bar */}
          <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#DFE6EF]">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-[28px] h-[var(--xevera-header-height)]">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  className="lg:hidden w-[42px] h-[42px] rounded-lg border border-[#DFE6EF] text-[#374151] flex items-center justify-center cursor-pointer hover:bg-[#F3F4F6] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-xevera-600">{eyebrow}</p>
                  <h1 className="text-[15px] font-head font-extrabold text-navy-950 leading-tight truncate">Welcome, {firstName}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen((v) => !v)}
                    aria-label="Notifications"
                    aria-expanded={notifOpen}
                    className={`relative w-[42px] h-[42px] rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      notifOpen ? 'bg-xevera-50 text-xevera-700 border-xevera-100' : 'text-[#243657] border-[#DFE6EF] hover:bg-[#F5F8FD] hover:text-xevera-600'
                    }`}
                  >
                    <Icon name="bell" size={18} />
                    {notifUnread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-xevera-600 text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white">
                        {notifUnread > 9 ? '9+' : notifUnread}
                      </span>
                    )}
                  </button>

                  {/*
                    Desktop only: popover anchored under the bell.
                    (Mobile renders a viewport-level sheet at the layout root -
                    the sticky header uses backdrop-blur, which would trap a
                    position:fixed child and cause horizontal overflow.)
                  */}
                  {notifOpen && !isMobileNotif && (
                    <div
                      className="absolute right-0 w-[420px] max-w-[calc(100vw-32px)] bg-white rounded-2xl border border-[#DCE6F3] overflow-hidden z-[1000] flex flex-col"
                      style={{ top: 'calc(100% + 10px)', boxShadow: '0 12px 35px rgba(15,42,80,0.12)' }}
                    >
                      {notifPanelBody(false)}
                    </div>
                  )}
                </div>

                {/* Profile */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen((v) => !v)}
                    aria-label="Account menu"
                    aria-haspopup="menu"
                    aria-expanded={profileOpen}
                    className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border transition-all cursor-pointer ${profileOpen ? 'border-[#DFE6EF] bg-[#F5F8FD]' : 'border-transparent hover:border-[#DFE6EF] hover:bg-[#F3F4F6]'}`}
                  >
                    <Avatar name={user?.name} photo={user?.photo} size={42} />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71829E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`hidden sm:block flex-shrink-0 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-2 w-[190px] bg-white border border-[#DFE6EF] rounded-[14px] shadow-[0_8px_28px_rgba(31,59,100,0.14)] z-50 p-2">
                        <button
                          onClick={() => { setProfileOpen(false); goTo('my-account'); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-[10px] text-[13px] font-semibold text-navy-950 hover:bg-[#F4F7FC] rounded-[9px] cursor-pointer bg-transparent border-none"
                        >
                          <Icon name="user" size={14} />
                          My Account
                        </button>
                        <button
                          onClick={() => { setProfileOpen(false); goTo('account-security'); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-[10px] text-[13px] font-semibold text-navy-950 hover:bg-[#F4F7FC] rounded-[9px] cursor-pointer bg-transparent border-none"
                        >
                          <Icon name="shield" size={14} />
                          Security
                        </button>
                        <div className="border-t border-[#F1F2F5] my-1" />
                        <button
                          onClick={() => { setProfileOpen(false); setLogoutOpen(true); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-[10px] text-[13px] font-semibold text-red-600 hover:bg-red-50 rounded-[9px] cursor-pointer bg-transparent border-none"
                        >
                          <Icon name="door" size={14} />
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="relative overflow-x-clip">
<div
              className="relative overflow-x-clip"
              style={{
                width: '100%',
                maxWidth: fullWidth ? 'none' : 'var(--xevera-page-max)',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {children}
            </div>
          </main>
        </div>

        {/* Logout modal */}
        <Modal
          open={logoutOpen}
          title="Logout"
          description="Are you sure you want to sign out of your account?"
          danger
          confirmLabel={loggingOut ? 'Signing out...' : 'Yes, Logout'}
          cancelLabel="Cancel"
          onCancel={() => !loggingOut && setLogoutOpen(false)}
          onConfirm={handleLogout}
        >
          <p className="text-sm text-[#4B5876]">You will need to sign in again to access your reports and account.</p>
        </Modal>
      </div>
    </ResidentLayoutContext.Provider>
  );
}