import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { useToast } from './Toast';
import usePolling from '../hooks/usePolling';
import { NOTIF_CATEGORIES, notifCategory } from '../utils/notificationCategory';
import Icon from './Icon';
import Modal from './Modal';

const PAGE_TITLES = {
  dashboard: 'Staff Dashboard',
  'assigned-reports': 'Assigned Reports',
  reports: 'All Reports',
  'all-reports': 'All Reports',
  'new-reports': 'Needs Verification',
  'ready-for-assignment': 'Ready for Assignment',
  verify: 'Verify Reports',
  'in-progress': 'In Progress',
  'pending-action': 'Pending Action',
  resolved: 'Awaiting Closure',
  'resolved-reports': 'Resolved Reports',
  'report-history': 'Report History',
  closed: 'Closed / Archived',
  rejected: 'Rejected',
  concerns: 'Resident Concerns',
  'service-requests': 'Service Requests',
  followups: 'Follow-ups',
  schedules: 'Schedules / Tasks',
  'tasks-board': 'Tasks Board',
  'my-tasks': 'My Tasks',
  'upcoming-tasks': 'Upcoming Tasks',
  'completed-tasks': 'Completed Tasks',
  performance: 'My Performance',
  exports: 'Export Reports',
  messages: 'Message Box',
  'time-in-out': 'Time In / Out',
  'time-requests': 'My Time Requests',
  calendar: 'Calendar',
  announcements: 'Announcements',
  profile: 'My Profile',
  settings: 'Settings',
  analytics: 'Reports & Analytics',
  'platform-analytics': 'Platform Analytics',
  residents: 'Residents',
  activity: 'Activity Logs',
  users: 'User Management',
  security: 'Security',
  'system-settings': 'System Settings',
  backup: 'Backups',
  maintenance: 'Maintenance',
  attendance: 'Attendance Console',
  'attendance-logs': 'Attendance Logs',
  'violation-management': 'Violation Management',
};

function initialsOf(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

export default function TopBar({ page, titleOverride, onNavigate, onViewReport, onOpenAnnouncement, onToggleSidebar }) {
  const { user, logout } = useAuth();
  const showToast = useToast();

  // Notifications
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // category segment
  const [notifRead, setNotifRead] = useState('all');     // all | unread | read
  const notifRef = useRef(null);
  // Tracks seen notification ids so polling can detect fresh arrivals.
  const seenNotifIds = useRef(null);

  // Direct messages unread
  const [msgUnread, setMsgUnread] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  // Profile menu
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const closeAll = useCallback(() => {
    setNotifOpen(false);
    setSearchOpen(false);
    setProfileOpen(false);
  }, []);

  // Notifications: realtime polling (pauses when tab is hidden)
  const epochRef = useRef(0);
  const loadNotifs = useCallback(() => {
    if (!user) return;
    const myEpoch = epochRef.current;
    apiFetch('notifications/list.php?limit=30')
      .then((d) => {
        if (myEpoch !== epochRef.current) return; // identity changed mid-flight
        const items = Array.isArray(d?.items) ? d.items : [];
        setNotifs(items);
        setUnread(d?.unread || 0);

        // Toast for brand-new unread notifications.
        const ids = new Set(items.map((n) => String(n.id)));
        if (seenNotifIds.current === null) {
          seenNotifIds.current = ids;
        } else {
          const fresh = items.filter((n) => !n.read && !seenNotifIds.current.has(String(n.id)));
          seenNotifIds.current = ids;
          if (fresh.length > 0) {
            showToast(
              fresh.length === 1
                ? `🔔 ${String(fresh[0].message || 'New notification').slice(0, 80)}`
                : `🔔 You have ${fresh.length} new notifications`,
              'success',
              { priority: 0 }
            );
          }
        }
      })
      .catch(() => {
        if (myEpoch !== epochRef.current) return;
        setNotifs([]);
        setUnread(0);
      });
  }, [user, showToast]);
  usePolling(loadNotifs, 10000);
  // Initial fetch on mount / login.
  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  // Direct messages unread: realtime polling
  const loadMessages = useCallback(() => {
    if (!user) return;
    const myEpoch = epochRef.current;
    apiFetch('direct_messages/list.php?limit=1')
      .then((d) => {
        if (myEpoch !== epochRef.current) return;
        setMsgUnread(d?.unread || 0);
      })
      .catch(() => {
        if (myEpoch !== epochRef.current) return;
        setMsgUnread(0);
      });
  }, [user]);
  usePolling(loadMessages, 10000);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  /*
   * PHASE 2 — stale-state isolation.
   * On every identity change (login, logout, role switch) we bump the
   * epoch, clear every per-user cache (notifs, unread, msgUnread, search)
   * and reset the "seen" set so the previous user's badge counts and
   * search results cannot surface on the newly signed-in account.
   */
  useEffect(() => {
    epochRef.current += 1;
    setNotifs([]);
    setUnread(0);
    setMsgUnread(0);
    setSearchQ('');
    setSearchResults(null);
    setSearching(false);
    seenNotifIds.current = null;
  }, [user?.id, user?.role]);

  // Close popovers on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen, searchOpen, profileOpen]);

  // Cmd/Ctrl+K focuses search, Escape closes popovers
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        closeAll();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeAll]);

  // Debounced search
  useEffect(() => {
    const q = searchQ.trim();
    if (!q) { setSearchResults(null); return undefined; }
    setSearching(true);
    const t = setTimeout(() => {
      apiFetch('search.php?q=' + encodeURIComponent(q))
        .then((d) => setSearchResults(d || { reports: [], residents: [], announcements: [] }))
        .catch(() => setSearchResults({ reports: [], residents: [], announcements: [] }))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function handleNotifClick(n) {
    setNotifOpen(false);
    try {
      await apiFetch('notifications/mark-read.php', { method: 'POST', body: { id: n.id } });
    } catch {}
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));

    const t = String(n?.type || '');

    // 1) Announcements — open the announcement (or fall back to the list).
    if (/announcement/.test(t)) {
      if (n.announcement_id && onOpenAnnouncement) onOpenAnnouncement(n.announcement_id);
      else if (onNavigate) onNavigate('announcements');
      return;
    }

    // 2) Any report-tied event — open the report directly.
    if (n.report_id && onViewReport) {
      onViewReport(n.report_id);
      return;
    }

    // 3) Direct messages — Message Box.
    if (/^direct_message$/.test(t)) {
      if (onNavigate) onNavigate('messages');
      return;
    }

    // 4) Contact support submissions/replies — Contact page (resident),
    //    Message Box (managers), notifications list (staff has no Contact tab).
    if (/^contact(_|$)|contact_message|contact_reply/.test(t)) {
      if (onNavigate) {
        onNavigate(user?.role === 'Resident' ? 'contact' : user?.role === 'Staff' ? 'notifications' : 'messages');
      }
      return;
    }

    // 5) Attendance events — Time In / Out page.
    if (/^attendance_/.test(t)) {
      if (onNavigate) onNavigate('time-in-out');
      return;
    }

    // 6) Anything else — open the full notifications list.
    if (onNavigate) onNavigate('notifications');
  }

  async function handleMarkAll() {
    try {
      await apiFetch('notifications/mark-read.php', { method: 'POST', body: { id: 'all' } });
    } catch {}
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  function pickResult(item) {
    closeAll();
    setSearchQ('');
    setSearchResults(null);
    if (item.type === 'report') {
      if (onViewReport) onViewReport(item.id);
      else if (onNavigate) onNavigate('reports');
    } else if (item.type === 'resident') {
      onNavigate?.('residents');
    } else if (item.type === 'announcement') {
      onNavigate?.('announcements');
    }
  }

  async function handleSignOut() {
    setProfileOpen(false);
    setConfirmLogout(true);
  }

  async function doLogout() {
    setConfirmLogout(false);
    try { await logout('/dashboard'); } catch {}
  }

  const displayName = user?.name || user?.username || user?.email || 'User';
  const initials = initialsOf(displayName);
  const userRole = user?.role || 'Staff';

  // Bell-dropdown segments: same taxonomy as the Notifications page.
  const notifCounts = useMemo(() => {
    const c = { all: notifs.length, report: 0, resident: 0, staff: 0, system: 0, unread: 0 };
    notifs.forEach((n) => { c[notifCategory(n.type)]++; if (!n.read) c.unread++; });
    return c;
  }, [notifs]);

  const filteredNotifs = useMemo(() => notifs.filter((n) => {
    const catMatch = notifFilter === 'all' || notifCategory(n.type) === notifFilter;
    const readMatch = notifRead === 'all'
      || (notifRead === 'read' && n.read)
      || (notifRead === 'unread' && !n.read);
    return catMatch && readMatch;
  }), [notifs, notifFilter, notifRead]);
  const totalResults = (searchResults?.reports?.length || 0) + (searchResults?.residents?.length || 0) + (searchResults?.announcements?.length || 0);
  const pageTitle = titleOverride || PAGE_TITLES[page] || 'Dashboard';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 h-16 flex items-center gap-3 flex-shrink-0">
      <button
        className="lg:hidden w-11 h-11 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] flex items-center justify-center hover:bg-[#F3F4F6] transition-colors cursor-pointer flex-shrink-0"
        onClick={onToggleSidebar}
        aria-label="Toggle menu"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2 mr-auto min-w-0">
        <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-[#9CA3AF] font-bold">Xevera</span>
        <span className="hidden sm:inline text-[#D1D5DB]">/</span>
        <span className="text-[13px] font-bold text-[#111827] truncate">{pageTitle}</span>
      </div>

      {/* === Global search (A: live + B: search dropdown) === */}
      <div className="hidden lg:block relative ml-4 w-full max-w-[320px]" ref={searchRef}>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#E5E7EB] bg-[#F5F7FA] focus-within:border-xevera-600 focus-within:bg-white transition-colors">
          <Icon name="search" size={15} strokeWidth={2} className="text-[#6B7280] flex-shrink-0" />
          <input
            ref={searchInputRef}
            id="topbar-search-input"
            type="search"
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search reports, residents, announcements..."
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF]"
            aria-label="Global search"
          />
          {/* Ctrl K hint removed - staff/admin/super admin - D:\GAMES\backup (9)\frontend */}
          {searching && <span className="text-[10px] text-[#9CA3AF] animate-pulse">…</span>}
        </div>

        {searchOpen && searchQ.trim() && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_12px_40px_rgba(16,24,40,0.12)] z-50 overflow-hidden max-h-[420px] overflow-y-auto">
            {searching && !searchResults && (
              <div className="px-4 py-6 text-center text-xs text-[#6B7280]">Searching…</div>
            )}
            {!searching && searchResults && totalResults === 0 && (
              <div className="px-4 py-6 text-center text-xs text-[#6B7280]">No results for &ldquo;{searchQ}&rdquo;</div>
            )}
            {searchResults?.reports?.length > 0 && (
              <SearchGroup label="Reports">
                {searchResults.reports.map((r) => (
                  <button key={'r' + r.id} onClick={() => pickResult({ type: 'report', id: r.id })} className="w-full text-left px-4 py-2.5 hover:bg-xevera-50 transition-colors cursor-pointer flex items-start gap-2.5 bg-transparent border-none">
                    <span className="w-7 h-7 rounded-md bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
                      <Icon name="file" size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#111827] flex items-center gap-2">
                        <span className="text-xevera-700 text-xs font-extrabold">#{r.id}</span>
                        <span className="truncate">{r.title}</span>
                        {r.priority === 'Urgent' && <span className="text-[9px] font-bold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">URGENT</span>}
                      </div>
                      <div className="text-xs text-[#6B7280] truncate">{r.category} · {r.location} · {r.status}</div>
                    </div>
                  </button>
                ))}
              </SearchGroup>
            )}
            {searchResults?.residents?.length > 0 && (
              <SearchGroup label="Residents">
                {searchResults.residents.map((w) => (
                  <button key={'s' + w.id} onClick={() => pickResult({ type: 'resident', id: w.id })} className="w-full text-left px-4 py-2.5 hover:bg-xevera-50 transition-colors cursor-pointer flex items-start gap-2.5 bg-transparent border-none">
                    <span className="w-7 h-7 rounded-md bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center flex-shrink-0 font-bold text-[10px]">{initialsOf(w.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#111827] truncate">{w.name}</div>
                      <div className="text-xs text-[#6B7280] truncate">@{w.username} · {w.address || w.email}</div>
                    </div>
                  </button>
                ))}
              </SearchGroup>
            )}
            {searchResults?.announcements?.length > 0 && (
              <SearchGroup label="Announcements">
                {searchResults.announcements.map((a) => (
                  <button key={'a' + a.id} onClick={() => pickResult({ type: 'announcement', id: a.id })} className="w-full text-left px-4 py-2.5 hover:bg-xevera-50 transition-colors cursor-pointer flex items-start gap-2.5 bg-transparent border-none">
                    <span className="w-7 h-7 rounded-md bg-[#FEE8E2] text-[#F86038] flex items-center justify-center flex-shrink-0">
                      <Icon name="megaphone" size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#111827] truncate">{a.title}</div>
                      <div className="text-xs text-[#6B7280] truncate">{a.category} · {a.status} · {a.date}</div>
                    </div>
                  </button>
                ))}
              </SearchGroup>
            )}
          </div>
        )}
      </div>

      {/* === Notifications bell (A: live + mark-read) === */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          aria-label="Notifications"
          aria-expanded={notifOpen}
          title="Notifications"
          className={`relative w-11 h-11 rounded-full border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
            notifOpen ? 'bg-xevera-50 text-xevera-700 border-xevera-100' : 'bg-[#F9FAFB] text-[#4B5563] border-[#E5E7EB] hover:bg-xevera-50 hover:text-xevera-600'
          }`}
        >
          <Icon name="bell" size={16} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-88px)] max-w-[300px] sm:w-96 sm:max-w-[calc(100vw-2rem)] bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_12px_40px_rgba(16,24,40,0.12)] z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[13px] font-extrabold text-[#111827]">Notifications</span>
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-[11px] font-bold text-xevera-600 hover:text-xevera-700 bg-transparent border-none cursor-pointer min-h-[40px] px-2">
                  Mark all read
                </button>
              )}
            </div>
            {/* Category segment */}
            <div className="mx-2.5 flex gap-1 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-1" role="tablist" aria-label="Notification category">
              {NOTIF_CATEGORIES.map(([key, label]) => (
                <button key={key} role="tab" aria-selected={notifFilter === key}
                  onClick={() => setNotifFilter(key)}
                  className={`inline-flex h-8 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-bold transition-colors cursor-pointer ${notifFilter === key ? 'bg-xevera-600 text-white shadow-[0_3px_10px_rgba(20,104,243,0.3)]' : 'text-[#58677E] hover:bg-white hover:text-xevera-600'}`}>
                  {label}
                  <span className={`inline-grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold ${notifFilter === key ? 'bg-white/25 text-white' : 'bg-[#E8EEF6] text-[#58677E]'}`}>{notifCounts[key] ?? 0}</span>
                </button>
              ))}
            </div>
            {/* Read-status segment */}
            <div className="mx-2.5 mt-1.5 flex gap-1 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-1" role="tablist" aria-label="Read status">
              {[['all', 'All'], ['unread', `Unread ${notifCounts.unread}`], ['read', 'Read']].map(([key, label]) => (
                <button key={key} role="tab" aria-selected={notifRead === key}
                  onClick={() => setNotifRead(key)}
                  className={`inline-flex h-8 flex-shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-[11px] font-bold transition-colors cursor-pointer ${notifRead === key ? 'bg-[#142544] text-white shadow-[0_3px_10px_rgba(20,37,68,0.3)]' : 'text-[#58677E] hover:bg-white hover:text-[#142544]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-[300px] sm:max-h-[380px] overflow-y-auto mt-1.5">
              {notifs.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mb-2">
                    <Icon name="bell" size={18} />
                  </div>
                  <p className="text-xs font-bold text-[#374151]">You&rsquo;re all caught up</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">No notifications yet.</p>
                </div>
              ) : filteredNotifs.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-xs font-bold text-[#374151]">No notifications match</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">Try another category or read status.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[#F1F5F9]">
                  {filteredNotifs.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-3 py-3 flex items-start gap-2.5 hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-transparent border-none ${n.read ? '' : 'bg-xevera-50/40'}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-[#D1D5DB]' : 'bg-xevera-600'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] leading-snug ${n.read ? 'text-[#374151]' : 'text-[#111827] font-bold'}`}>{n.message}</p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{n.date}{n.report_id ? ` · ${n.report_id}` : ''}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-[#F1F5F9] px-2.5 py-2.5">
              <button
                onClick={() => { setNotifOpen(false); onNavigate?.('notifications'); }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-xevera-50 text-xevera-700 text-[12px] font-bold hover:bg-xevera-100 transition-colors cursor-pointer bg-transparent border-none"
              >
                View all notifications →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === Profile menu === */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((v) => !v)}
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-[#F3F4F6] transition-colors border border-transparent cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-xevera-600 to-xevera-800 text-white flex items-center justify-center text-[12px] font-extrabold flex-shrink-0">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[13px] font-bold text-[#111827] leading-tight">{user?.name || 'User'}</div>
            <div className="text-[11px] text-xevera-600 font-semibold leading-tight">{userRole}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`hidden sm:block transition-transform ${profileOpen ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full pt-1.5 w-52 z-50">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_12px_40px_rgba(16,24,40,0.12)] py-1.5">
              <button
                onClick={() => { setProfileOpen(false); onNavigate?.('profile'); }}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F3F4F6] cursor-pointer bg-transparent border-none"
              >
                <Icon name="shield" size={14} />
                My Profile
              </button>
              <button
                onClick={() => { setProfileOpen(false); onNavigate?.('notifications'); }}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-[#F3F4F6] cursor-pointer bg-transparent border-none"
              >
                <Icon name="bell" size={14} />
                Notifications
              </button>
              <div className="border-t border-[#F3F4F6] my-1"></div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer bg-transparent border-none"
              >
                <Icon name="door" size={14} />
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={confirmLogout}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmLabel="Yes, Logout"
        cancelLabel="Cancel"
        danger
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </header>
  );
}

function SearchGroup({ label, children }) {
  return (
    <div>
      <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold sticky top-0 bg-white/95 backdrop-blur-sm">{label}</div>
      {children}
    </div>
  );
}