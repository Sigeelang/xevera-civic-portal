import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { isRouteAllowed } from '../utils/routeGuard';
import Icon from './Icon';
import Modal from './Modal';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    ],
  },
  {
    label: 'Report Management',
    items: [
      { key: 'assigned-reports', label: 'Assigned Reports', icon: 'file' },
      { key: 'verify', label: 'Verify Reports', icon: 'verify' },
      { key: 'pending-action', label: 'Pending Action', icon: 'clock' },
      { key: 'in-progress', label: 'In Progress', icon: 'wrench' },
      { key: 'resolved-reports', label: 'Resolved Reports', icon: 'check' },
      { key: 'closed', label: 'Closed', icon: 'archive' },
      { key: 'rejected', label: 'Rejected', icon: 'trash' },
      { key: 'report-history', label: 'Report History', icon: 'clock' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { key: 'messages', label: 'Message Box', icon: 'letter' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'profile', label: 'My Profile', icon: 'user' },
    ],
  },
];

/*
 * Super Admin navigation.
 *
 * Every key maps to an existing route handled by App.jsx:
 *   - 'users/<tab>'        -> UsersMgmtPage presets
 *   - 'security/<section>' -> SecurityPage sections
 *   - 'system-settings/<section>' -> SystemSettingsPage sections
 *     ('email-otp' is the existing SMTP + OTP configuration page)
 *     ('two-factor-control' is the 2FA Control by Role page)
 *   - 'profile'            -> ProfilePage
 */
const SUPER_ADMIN_NAV = [
  {
    label: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'home' },
      { key: 'platform-analytics', label: 'Platform Analytics', icon: 'trend' },
    ],
  },
  {
    label: 'Civic Operations',
    items: [
      {
        key: 'reports-group',
        label: 'Reports',
        icon: 'clipboard',
        children: [
          { key: 'reports', label: 'All Reports' },
          { key: 'new-reports', label: 'Pending' },
          { key: 'verify', label: 'Verify Reports' },
          { key: 'ready-for-assignment', label: 'Verified' },
          { key: 'assigned-reports', label: 'Assigned' },
          { key: 'in-progress', label: 'In Progress' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'closed', label: 'Closed' },
          { key: 'rejected', label: 'Rejected' },
        ],
      },
      { key: 'residents', label: 'Residents', icon: 'users' },
      {
        key: 'violations-group',
        label: 'Violation Management',
        icon: 'shield',
        children: [
          { key: 'violation-management/all', label: 'All Violations' },
          { key: 'violation-management/under-review', label: 'Under Review' },
          { key: 'violation-management/confirmed', label: 'Confirmed' },
          { key: 'violation-management/dismissed', label: 'Dismissed' },
        ],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      { key: 'announcements', label: 'Announcements', icon: 'megaphone' },
      { key: 'messages', label: 'Message Box', icon: 'messagesquare' },
    ],
  },
  {
    label: 'User Management',
    items: [
      // Sidebar shows only the parent entry; the section pages
      // (Staff & Administrators, All Users, Roles & Permissions,
      // Account Status) remain fully functional on their existing
      // routes (e.g. users/management) — their links are just hidden.
      { key: 'users', label: 'User Management', icon: 'users' },
    ],
  },
  {
    label: 'Audit Logs',
    items: [
      { key: 'activity', label: 'User Activity', icon: 'clipboardcheck' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'backup', label: 'Backups', icon: 'box' },
      { key: 'maintenance', label: 'Maintenance', icon: 'wrench' },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        key: 'settings-group',
        label: 'Settings',
        icon: 'gear',
        children: [
          {
            key: 'security-group',
            label: 'Security',
            icon: 'shield',
            children: [
              { key: 'security/overview', label: 'Security Overview' },
              { key: 'system-settings/email-otp', label: 'Email & OTP' },
            ],
          },
          {
            key: 'system-group',
            label: 'System',
            icon: 'wrench',
            children: [
              { key: 'system-settings/general', label: 'General Settings' },
            ],
          },
          {
            key: 'account-group',
            label: 'Account',
            icon: 'user',
            children: [
              { key: 'profile', label: 'My Account' },
            ],
          },
        ],
      },
    ],
  },
];

/*
 * Admin navigation.
 * Reuses the exact same route keys / pages as the Super Admin tree;
 * attendance & time-tracking entries and Super Admin-only management,
 * security and system-configuration items are intentionally excluded.
 */
const ADMIN_NAV = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    ],
  },
  {
    label: 'Civic Operations',
    items: [
      {
        key: 'reports-group',
        label: 'Reports',
        icon: 'clipboard',
        children: [
          { key: 'reports', label: 'All Reports' },
          { key: 'new-reports', label: 'Pending' },
          { key: 'verify', label: 'Verify Reports' },
          { key: 'ready-for-assignment', label: 'Verified' },
          { key: 'assigned-reports', label: 'Assigned' },
          { key: 'in-progress', label: 'In Progress' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'closed', label: 'Closed' },
          { key: 'rejected', label: 'Rejected' },
        ],
      },
      { key: 'residents', label: 'Residents', icon: 'users' },
      { key: 'residency-verification', label: 'Residency Verification', icon: 'check' },
      {
        key: 'violations-group',
        label: 'Violation Management',
        icon: 'shield',
        children: [
          { key: 'violation-management/all', label: 'All Violations' },
          { key: 'violation-management/under-review', label: 'Under Review' },
          { key: 'violation-management/confirmed', label: 'Confirmed' },
          { key: 'violation-management/dismissed', label: 'Dismissed' },
        ],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      { key: 'announcements', label: 'Announcements', icon: 'megaphone' },
      { key: 'messages', label: 'Message Box', icon: 'messagesquare' },
      { key: 'notifications', label: 'Notifications', icon: 'bell' },
    ],
  },
  {
    label: 'Reports & Analytics',
    items: [
      { key: 'platform-analytics', label: 'Platform Analytics', icon: 'trend' },
      { key: 'exports', label: 'Export Reports', icon: 'download' },
    ],
  },
  {
    label: 'Audit',
    items: [
      { key: 'activity', label: 'Activity Logs', icon: 'clipboardcheck' },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'backup', label: 'Backups', icon: 'box' },
      { key: 'maintenance', label: 'Maintenance', icon: 'wrench' },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'profile', label: 'My Profile', icon: 'user' },
    ],
  },
];

function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#staffLogoGrad)" />
      <defs>
        <linearGradient id="staffLogoGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#2E6BF0" />
          <stop offset="100%" stopColor="#0B3AAB" />
        </linearGradient>
      </defs>
      <path d="M16 5C11 9 7 13 7 18c0 5 4 9 9 9 5 0 9-4 9-9 0-5-4-9-9-9Z" fill="#FFFFFF" opacity="0.35" />
      <path d="M16 9C13 12 11 15 11 18c0 3 2 5 5 5 3 0 5-2 5-5 0-3-2-6-5-9Z" fill="#FFFFFF" opacity="0.3" />
      <path d="M16 13c-1.5 0-2.5 1-2.5 3-.5 2 .5 2.5.5 2.5 2 0 2.5-1 2.5-2.5 0-1.5-.5-3-.5-3Z" fill="#FFFFFF" />
    </svg>
  );
}

function SectionLabel({ children, className = '' }) {
  return <div className={`text-[10px] uppercase tracking-widest font-bold text-white/45 px-3 pt-5 pb-1.5 ${className}`}>{children}</div>;
}

function NavButton({ icon, label, active, onClick, badge, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 w-full min-h-[44px] text-left bg-none border-none px-3 py-2 rounded-xl text-[13px] font-bold transition-colors duration-200 cursor-pointer ${
        collapsed ? 'lg:justify-center lg:px-0' : ''
      } ${
        active
          ? 'bg-[rgba(255,255,255,0.12)] text-white'
          : 'text-white/75 hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white" />}
      <span className="grid place-items-center w-5 h-5 flex-shrink-0"><Icon name={icon} size={20} className="block" /></span>
      <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
      {badge > 0 && (
        <span
          className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-xevera-400/90 text-white text-[10px] font-bold ${
            collapsed ? 'lg:absolute lg:top-1 lg:right-1.5 lg:min-w-0 lg:w-2 lg:h-2 lg:p-0' : ''
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function GroupButton({ icon, label, open, hasActiveChild, onToggle, collapsed, badge = 0 }) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? label : undefined}
      aria-expanded={open}
      className={`relative flex items-center gap-3 w-full min-h-[44px] text-left bg-none border-none px-3 py-2 rounded-xl text-[13px] font-bold transition-colors duration-200 cursor-pointer ${
        collapsed ? 'lg:justify-center lg:px-0' : ''
      } ${
        hasActiveChild
          ? 'text-white'
          : 'text-white/75 hover:bg-[rgba(255,255,255,0.08)] hover:text-white'
      }`}
    >
      {hasActiveChild && !open && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white" />}
      <span className="grid place-items-center w-5 h-5 flex-shrink-0"><Icon name={icon} size={20} className="block" /></span>
      <span className={`flex-1 truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
      {badge > 0 && (
        <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#F59E0B] text-white text-[10px] font-bold flex-shrink-0 ${collapsed ? 'lg:absolute lg:top-1 lg:right-1.5 lg:min-w-0 lg:w-2 lg:h-2 lg:p-0' : ''}`}>
          <span className={collapsed ? 'lg:hidden' : ''}>{badge > 99 ? '99+' : badge}</span>
        </span>
      )}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`flex-shrink-0 transition-transform duration-200 ${collapsed ? 'lg:hidden' : ''} ${open ? 'rotate-180' : ''}`}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/*
 * Second-level collapsible group (a group nested inside another
 * group's children, e.g. ACCOUNT -> Settings -> Security).
 */
function SubGroupButton({ label, open, hasActiveChild, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`relative flex items-center w-full min-h-[44px] text-left bg-none border-none pl-10 pr-3 py-2 rounded-lg text-[12px] font-bold transition-colors duration-200 cursor-pointer ${
        hasActiveChild
          ? 'text-white'
          : 'text-white/60 hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
      }`}
    >
      {hasActiveChild && !open && <span className="absolute left-3 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-xevera-400" />}
      <span className="flex-1 truncate">{label}</span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function SubNavButton({ label, active, onClick, depth = 1, badge = 0 }) {
  const pad = depth >= 2 ? 'pl-[54px]' : 'pl-10';
  const dotLeft = depth >= 2 ? 'left-[47px]' : 'left-3';
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center w-full min-h-[44px] text-left bg-none border-none ${pad} pr-3 py-2 rounded-lg text-[13px] font-semibold transition-colors duration-200 cursor-pointer ${
        active
          ? 'bg-[rgba(255,255,255,0.10)] text-white'
          : 'text-white/60 hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
      }`}
    >
      {active && <span className={`absolute ${dotLeft} top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-xevera-400`} />}
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#F59E0B] text-white text-[10px] font-bold flex-shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export default function StaffSidebar({ activePage, onNavigate, open = false, collapsed = false, onClose }) {
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [dmUnread, setDmUnread] = useState(0);
  const [contactUnread, setContactUnread] = useState(0);
  const [verifyPending, setVerifyPending] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);

  /*
   * PHASE 2 — stale-state isolation.
   * Sidebar polls (DM, contact, verifyPending) are keyed on user identity
   * and gated by an epoch so a previous user's badge counts can never
   * leak into the newly signed-in account's sidebar.
   */
  const epochRef = useRef(0);
  useEffect(() => {
    epochRef.current += 1;
    setDmUnread(0);
    setContactUnread(0);
    setVerifyPending(0);
    setNotifUnread(0);
    if (!user) return undefined;
    const myEpoch = epochRef.current;
    let mounted = true;
    const manager = user.role === 'Admin' || user.role === 'Super Admin';
    const load = () => {
      /* Badge = unread direct messages + new public contact-form submissions */
      apiFetch('direct_messages/list.php?limit=1')
        .then((d) => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return;
          setDmUnread(d?.unread || 0);
        })
        .catch(() => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return;
          setDmUnread(0);
        });
      if (manager) {
        apiFetch('contact/list.php?limit=1')
          .then((d) => {
            if (!mounted) return;
            if (myEpoch !== epochRef.current) return;
            setContactUnread(d?.unread || 0);
          })
          .catch(() => {
            if (!mounted) return;
            if (myEpoch !== epochRef.current) return;
            setContactUnread(0);
          });
      } else {
        setContactUnread(0);
      }
      /* Pending Verification count for the sidebar badge (managers only) */
      if (manager) {
        apiFetch('reports/list.php?staff=true&status=Pending&limit=1')
          .then((d) => {
            if (!mounted) return;
            if (myEpoch !== epochRef.current) return;
            setVerifyPending(d?.total || 0);
          })
          .catch(() => {
            if (!mounted) return;
            if (myEpoch !== epochRef.current) return;
            setVerifyPending(0);
          });
      }
      /* Unread notification count for the sidebar badge */
      apiFetch('notifications/list.php?limit=1&unread_only=1')
        .then((d) => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return;
          setNotifUnread(d?.unread_count ?? (Array.isArray(d) ? d.filter(n => !n.is_read).length : 0));
        })
        .catch(() => {
          if (!mounted) return;
          if (myEpoch !== epochRef.current) return;
          setNotifUnread(0);
        });
    };
    load();
    const t = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(t); };
  }, [user?.id, user?.role]);

  const messageUnread = dmUnread + contactUnread;

  function goTo(page, preset) {
    onNavigate(page, preset);
    if (onClose) onClose();
  }

  async function doLogout() {
    setConfirmLogout(false);
    try { await logout(); } catch {}
    onNavigate('home');
  }

  const userRole = user?.role || 'Staff';
  const isManager = userRole === 'Super Admin' || userRole === 'Admin';
  const isSuperAdmin = userRole === 'Super Admin';

  function isItemVisible(item) {
    if (!item.requiresRole) return true;
    const roles = Array.isArray(item.requiresRole) ? item.requiresRole : [item.requiresRole];
    if (roles.includes('Super Admin') && isSuperAdmin) return true;
    if (roles.includes('Admin') && isManager) return true;
    if (roles.includes('Staff') && userRole === 'Staff') return true;
    return false;
  }

  /*
   * Live permission filtering: hides nav entries whose route the current
   * role may not visit (Super Admin revocations). Sub-path keys
   * (users/management, violation-reports/under-review, …) are checked by
   * their base route. Empty groups are dropped by the caller.
   */
  function filterByPermission(items, role) {
    return (items || []).flatMap((item) => {
      if (item.children) {
        const kids = filterByPermission(item.children, role);
        if (kids.length === 0) return [];
        return [{ ...item, children: kids }];
      }
      const base = String(item.key || '').split('/')[0];
      return isRouteAllowed(base, role) ? [item] : [];
    });
  }

  /*
   * Super Admin: role-aware collapsible groups.
   * Groups along the active item's ancestor chain are expanded
   * automatically (including on first render / deep links) — e.g.
   * #/security/two-factor opens ACCOUNT -> Settings -> Security.
   */
  const [openGroups, setOpenGroups] = useState(() => new Set());

  const roleNavTree = isSuperAdmin ? SUPER_ADMIN_NAV : isManager ? ADMIN_NAV : null;

  useEffect(() => {
    if (!roleNavTree || !activePage) return;

    function findAncestorKeys(items, trail) {
      for (const item of items) {
        if (!item.children) continue;
        if (item.children.some((c) => c.key === activePage)) {
          return [...trail, item.key];
        }
        const deeper = findAncestorKeys(item.children, [...trail, item.key]);
        if (deeper) return deeper;
      }
      return null;
    }

    const path = findAncestorKeys(roleNavTree.flatMap((s) => s.items), []);
    if (path && path.length) {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        let changed = false;
        path.forEach((k) => {
          if (!next.has(k)) { next.add(k); changed = true; }
        });
        return changed ? next : prev;
      });
    }
  }, [activePage, roleNavTree]);

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  /* In collapsed rail mode a group icon navigates to its first entry
     (the full submenu is available once the sidebar is expanded). */
  function handleGroupActivate(item) {
    if (collapsed && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const firstLeaf = item.children.find((c) => !c.children) || item.children[0];
      if (firstLeaf) {
        goTo(firstLeaf.key);
        return;
      }
    }
    toggleGroup(item.key);
  }

  const sections = (
    roleNavTree ||
    NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter(isItemVisible) }))
  )
    .map((s) => ({ ...s, items: filterByPermission(s.items, userRole) }))
    .filter((s) => s.items.length > 0);

  const initials = user
    ? (user.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  const sidebarContent = (
    <>
      <style>{`
        .staff-nav-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.35) transparent; }
        .staff-nav-scroll::-webkit-scrollbar { width: 8px; }
        .staff-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .staff-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.28); border-radius: 8px; }
        .staff-nav-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }
      `}</style>
      <div className={`shrink-0 flex items-center gap-2.5 px-4 py-5 border-b border-white/10 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
        <Logo size={32} />
        <div className={`text-left min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
          <div className="font-head font-extrabold text-[14px] leading-tight text-white tracking-[0.08em]">XEVERA</div>
          <div className="text-[8.5px] font-bold tracking-[0.28em] uppercase text-xevera-400 mt-[3px]">
            {isSuperAdmin ? 'SUPER ADMIN' : 'CIVIC PORTAL'}
          </div>
        </div>
      </div>

      <nav className="staff-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-4" aria-label={isSuperAdmin ? 'Super Admin navigation' : 'Staff navigation'}>
        {sections.map((section) => (
          <div key={section.label}>
            <SectionLabel className={collapsed ? 'lg:hidden' : ''}>{section.label}</SectionLabel>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) =>
                item.children ? (
                  <div key={item.key}>
                    <GroupButton
                      icon={item.icon}
                      label={item.label}
                      open={openGroups.has(item.key)}
                      hasActiveChild={
                        item.children.some((c) => c.key === activePage)
                      }
                      onToggle={() => handleGroupActivate(item)}
                      collapsed={collapsed}
                      badge={item.key === 'reports-group' && isManager ? verifyPending : 0}
                    />
                    {openGroups.has(item.key) && (
                      <div className={`flex flex-col gap-0.5 mb-1 ${collapsed ? 'lg:hidden' : ''}`}>
                        {item.children.map((child) =>
                          child.children ? (
                            <div key={child.key}>
                              <SubGroupButton
                                label={child.label}
                                open={openGroups.has(child.key)}
                                hasActiveChild={child.children.some((c) => c.key === activePage)}
                                onToggle={() => toggleGroup(child.key)}
                              />
                              {openGroups.has(child.key) && (
                                <div className="flex flex-col gap-0.5">
                                  {child.children.map((gc) => (
                                    <SubNavButton
                                      key={gc.key}
                                      label={gc.label}
                                      depth={2}
                                      active={activePage === gc.key}
                                      onClick={() => goTo(gc.key)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <SubNavButton
                              key={child.key}
                              label={child.label}
                              active={activePage === child.key}
                              onClick={() => goTo(child.key)}
                              badge={child.key === 'verify' && isManager ? verifyPending : 0}
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavButton
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    active={activePage === item.key}
                    badge={item.key === 'messages' ? messageUnread : item.key === 'notifications' ? notifUnread : 0}
                    onClick={() => goTo(item.key)}
                    collapsed={collapsed}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <div className={`flex items-center gap-2.5 mb-3 px-1.5 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-xevera-500 to-xevera-700 text-white flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] border-2 border-[#062B63]" />
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="text-[12px] font-bold text-white truncate">{user?.name || 'Staff'}</div>
            <div className="text-[10.5px] text-xevera-400 truncate">{userRole}</div>
          </div>
        </div>
        <button
          onClick={() => setConfirmLogout(true)}
          aria-label="Sign out"
          title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-xl text-[13px] font-bold bg-none border-none cursor-pointer text-white/75 hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors ${
              collapsed ? 'lg:justify-center lg:px-0' : ''
            }`}
        >
          <span className="flex items-center justify-center w-[18px] flex-shrink-0"><Icon name="door" size={16} /></span>
          <span className={`flex-1 text-left ${collapsed ? 'lg:hidden' : ''}`}>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {open && <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col text-white flex-shrink-0 w-[220px] ${
          collapsed ? 'lg:w-[78px]' : 'lg:w-[220px]'
        } ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } transition-all duration-300 ease-out`}
        style={{ background: 'linear-gradient(180deg, #062B63 0%, #041F45 100%)' }}
        aria-label="Staff sidebar"
      >
        {sidebarContent}
      </aside>

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
    </>
  );
}