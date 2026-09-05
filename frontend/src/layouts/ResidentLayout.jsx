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

const NAV_COMMUNICATION = [
  { key: 'messages',      label: 'Message Box',      icon: 'letter',   action: 'messages' },
  { key: 'notifications', label: 'Notifications',    icon: 'bell',     action: 'notifications' },
  { key: 'announcements', label: 'Announcements',    icon: 'megaphone', action: 'announcements' },
];

const NAV_COMMUNITY = [
  { key: 'maintenance',   label: 'Maintenance',        icon: 'wrench',    action: 'maintenance' },
  { key: 'emergency',     label: 'Emergency Contacts', icon: 'phone',     action: 'emergency' },
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

export default function ResidentLayout({ activePage, eyebrow = 'Resident Portal', onNavigate, children, fullWidth }) {
  const { user, logout } = useAuth();
  const { siteName } = useSettings();
  const showToast = useToast();
  const { notifs, notifUnread, markAllRead, openNotif } = useResidentNotifications();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;

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

        <div className="lg:pl-[var(--xevera-sidebar-width)]">
          {/* Top bar */}
          <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#DFE6EF]">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-[28px] h-[var(--xevera-header-height)]">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                  className="lg:hidden w-9 h-9 rounded-lg border border-[#DFE6EF] text-[#374151] flex items-center justify-center cursor-pointer hover:bg-[#F3F4F6] transition-colors"
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
                    className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
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

                  {notifOpen && (
                    <div className="absolute right-0 w-[calc(100vw-88px)] max-w-[300px] sm:w-[calc(100vw-24px)] sm:max-w-[420px] bg-white rounded-2xl border border-[#DCE6F3] overflow-hidden z-[1000]" style={{ top: 'calc(100% + 10px)', boxShadow: '0 12px 35px rgba(15,42,80,0.12)' }}>
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-[13px] font-extrabold text-[#102957]">Notifications</span>
                        {notifUnread > 0 && (
                          <button
                            onClick={markAllRead}
                            className="inline-flex items-center gap-1 px-2 min-h-[40px] rounded-md text-[11px] font-bold text-[#1769FF] hover:bg-[#EDF4FF] transition-colors cursor-pointer bg-transparent border-none"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>

                      <div className="px-3 pb-2 flex gap-1.5">
                        {[
                          { key: 'all', label: `All (${notifs.length})` },
                          { key: 'unread', label: `Unread (${notifUnread})` },
                          { key: 'read', label: `Read (${Math.max(notifs.length - notifUnread, 0)})` },
                        ].map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setNotifTab(t.key)}
                            className={`flex-1 min-h-[36px] px-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                              notifTab === t.key
                                ? 'bg-[#EDF4FF] text-[#1769FF] border-[#C9DEF7]'
                                : 'bg-white text-[#526582] border-[#E2EAF3] hover:border-[#C9DEF7]'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="max-h-[300px] sm:max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        {(() => {
                          const list = notifTab === 'unread' ? notifs.filter((n) => !n.read) : notifTab === 'read' ? notifs.filter((n) => n.read) : notifs;
                          if (list.length === 0) {
                            return (
                              <div className="px-3 py-8 text-center">
                                <span className="w-9 h-9 mx-auto rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mb-2"><Icon name="bell" size={16} /></span>
                                <p className="text-xs font-bold text-[#374151]">{notifTab === 'all' ? "You're all caught up" : `No ${notifTab} notifications`}</p>
                                <p className="text-[11px] text-[#9CA3AF] mt-0.5">{notifTab === 'all' ? 'No notifications yet.' : 'Try another filter.'}</p>
                              </div>
                            );
                          }
                          return (
                            <ul>
                              {list.slice(0, 12).map((n) => {
                                const iconName =
                                  n.type === 'announcement' ? 'megaphone'
                                  : n.type === 'direct_message' ? 'letter'
                                  : n.type === 'contact' || n.type === 'contact_message' || n.type === 'contact_reply' ? 'phone'
                                  : n.type === 'report' || n.report_id ? 'file'
                                  : 'bell';
                                return (
                                  <li key={n.id} className="border-b border-[#E8EEF7] last:border-b-0">
                                    <button
                                      onClick={() => { openNotif(n); setNotifOpen(false); }}
                                      className="w-full flex items-start gap-2.5 px-3 py-3 text-left hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-transparent border-none"
                                    >
                                      <span className={`w-8 h-8 rounded-full ${n.read ? 'bg-[#F3F4F6] text-[#9CA3AF]' : 'bg-[#EDF4FF] text-[#1769FF]'} flex items-center justify-center flex-shrink-0`}>
                                        <Icon name={iconName} size={14} />
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        <span className={`block text-[13px] leading-snug ${n.read ? 'text-[#334155]' : 'text-[#102957] font-bold'}`}>{n.message}</span>
                                        <span className="block text-[11px] text-[#94A3B8] mt-0.5">{n.date}</span>
                                      </span>
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${n.read ? 'bg-[#D5DDE8]' : 'bg-[#1769FF]'}`} />
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()}
                      </div>

                      <div className="p-2.5 border-t border-[#EDF1F6] bg-white">
                        <button
                          onClick={() => { setNotifOpen(false); goTo('notifications'); }}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-[#EDF4FF] text-[#1769FF] text-[12px] font-bold hover:bg-[#DCE9FD] transition-colors cursor-pointer border-none"
                        >
                          View all notifications <span aria-hidden>→</span>
                        </button>
                      </div>
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
                    <Avatar name={user?.name} photo={user?.photo} size={34} />
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