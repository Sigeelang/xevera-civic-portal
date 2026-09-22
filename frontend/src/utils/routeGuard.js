const STAFF_ROLES = ['super_admin', 'admin', 'staff'];

import { apiFetch } from '../services/api';

function normalizeRole(role) {
  if (!role) return '';
  return String(role).toLowerCase().trim().replace(/\s+/g, '_');
}

const ROUTE_PERMISSIONS = {
  Guest: new Set([
    'home',
    'report-detail',
    'announcements',
    'maintenance',
    'contact',
    'emergency',
    'documents',
    'garbage',
    'about',
    'notifications',
    'how-it-works',
    'faq',
    'guidelines',
    'privacy',
    'terms',
    'report-success',
    'submit',
    // Standalone Super Admin recovery portal (code + email OTP enforced server-side).
    'system-aut',
  ]),

  Resident: new Set([
    'home',
    'resident-dashboard',
    'submit',
    'my-reports',
    'my-violations',
    'community-reports',
    'messages',
    'notifications',
    'help',
    'contact',
    'my-account',
    'change-password',
    'account-security',
    'system-aut',
    'report-detail',
    'report-success',
    'reports',
    'announcements',
    'maintenance',
    'emergency',
    'track',
  ]),

  /*
   * Staff: strictly their own work queue. All Reports is a management
   * view (Admin / Super Admin) - Staff can only see assigned reports.
   */
  Staff: new Set([
    'dashboard',
    'assigned-reports',
    'verify',
    'in-progress',
    'pending-action',
    'resolved',
    'resolved-reports',
    'report-history',
    'closed',
    'rejected',
    'concerns',
    'performance',
    'ready-for-assignment',
    'new-reports',
    'notifications',
    'messages',
    'profile',
    'settings',
    'time-in-out',
    'report-detail',
    'home',
    'report-success',
    'system-aut',
  ]),

  Admin: new Set([
    'dashboard',
    'reports',
    'assigned-reports',
    'verify',
    'in-progress',
    'pending-action',
    'resolved',
    'closed',
    'rejected',
    'concerns',
    'service-requests',
    'followups',
    'performance',
    'all-reports',
    'ready-for-assignment',
    'new-reports',
    'notifications',
    'messages',
    'profile',
    'settings',
    'time-in-out',
    'calendar',
    'report-detail',
    'home',
    'report-success',
    'analytics',
    'platform-analytics',
    'exports',
    'residents',
    'residency-verification',
    'activity',
    'backup',
    'maintenance',
    'attendance',
    'attendance-logs',
    'announcements',
    'violations',
    'violation-reports',
    'violation-reports/under-review',
    'violation-reports/confirmed',
    'violation-reports/dismissed',
    'violation-management',
    'violation-management/all',
    'violation-management/under-review',
    'violation-management/confirmed',
    'violation-management/dismissed',
    'system-aut',
  ]),

  /*
   * Super Admin: everything Admin has, PLUS Super-Admin-only pages.
   * Backend requireRole(['Super Admin']) remains the real security
   * boundary — this set only keeps the frontend guard consistent.
   */
  'Super Admin': new Set([
    'dashboard',
    'reports',
    'assigned-reports',
    'verify',
    'in-progress',
    'pending-action',
    'resolved',
    'closed',
    'rejected',
    'concerns',
    'service-requests',
    'followups',
    'performance',
    'all-reports',
    'ready-for-assignment',
    'new-reports',
    'notifications',
    'messages',
    'profile',
    'settings',
    'time-in-out',
    'calendar',
    'report-detail',
    'home',
    'report-success',
    'analytics',
    'exports',
    'residents',
    'residency-verification',
    'activity',
    'backup',
    'maintenance',
    'attendance',
    'attendance-logs',
    'announcements',
    // Super Admin only:
    'users',
    'security',
    'system-settings',
    'platform-analytics',
    'violations',
    'violation-reports',
    'violation-reports/under-review',
    'violation-reports/confirmed',
    'violation-reports/dismissed',
    'violation-management',
    'violation-management/all',
    'violation-management/under-review',
    'violation-management/confirmed',
    'violation-management/dismissed',
    'system-aut',
  ]),
};

const LOGIN_REDIRECT = {
  Guest: 'home',
  Resident: 'resident-dashboard',
  Staff: 'dashboard',
  Admin: 'dashboard',
  'Super Admin': 'dashboard',
};

const DEFAULT_PAGES = {
  Guest: 'home',
  Resident: 'resident-dashboard',
  Staff: 'dashboard',
  Admin: 'dashboard',
  'Super Admin': 'dashboard',
};

/**
 * Convert any supported role into the application's canonical role name.
 */
export function getRoleKey(role) {
  const normalized = normalizeRole(role);

  if (!normalized) {
    return 'Guest';
  }

  if (normalized === 'super_admin') {
    return 'Super Admin';
  }

  if (normalized === 'admin') {
    return 'Admin';
  }

  if (normalized === 'staff') {
    return 'Staff';
  }

  if (normalized === 'resident') {
    return 'Resident';
  }

  return 'Guest';
}

/**
 * Check whether a page is allowed for a role.
 *
 * Code Sets are the baseline. For Admin/Staff, Super Admin revocations
 * (role_permission_denials, loaded live and cached) additionally deny
 * every route of the revoked module. Super Admin and Resident always
 * use code behavior (locked columns — never lockable, never escalated).
 */
export function isRouteAllowed(page, role) {
  const roleKey = getRoleKey(role);
  const allowedRoutes =
    ROUTE_PERMISSIONS[roleKey] || ROUTE_PERMISSIONS.Guest;

  if (!allowedRoutes.has(page)) return false;

  if ((roleKey === 'Admin' || roleKey === 'Staff') && denialSet) {
    const m = routeModule(page);
    if (m && denialSet.has(`${roleKey}/${m}`)) return false;
  }

  return true;
}

/*
 * Read-only access to the live RBAC configuration.
 * Used by the Super Admin "Roles & Permissions" matrix so it always
 * reflects the actual route guard, never hand-copied data.
 */
export function getRoutePermissions() {
  return ROUTE_PERMISSIONS;
}

/**
 * Alias used by App.jsx.
 *
 * This fixes:
 * Uncaught ReferenceError: isPageAllowed is not defined
 */
export function isPageAllowed(page, role) {
  return isRouteAllowed(page, role);
}

/*
 * Live permission denials managed by Super Admin
 * (backend/api/admin/permissions.php, table role_permission_denials).
 *
 * MODULE_ROUTES mirrors the RolesMatrix module rows: each module lists
 * every frontend route it governs. A denial hides the whole module for
 * that role. Routes with no module always fall back to code behavior.
 */
const MODULE_ROUTES = {
  dashboard: ['dashboard'],
  reports: ['reports', 'all-reports', 'verify', 'new-reports', 'ready-for-assignment', 'assigned-reports', 'in-progress', 'pending-action', 'resolved', 'resolved-reports', 'report-history', 'closed', 'rejected'],
  residents: ['residents', 'residency-verification'],
  announcements: ['announcements'],
  maintenance: ['maintenance'],
  messages: ['messages', 'concerns', 'contact-messages'],
  analytics: ['analytics', 'platform-analytics'],
  'platform-analytics': ['platform-analytics'],
  exports: ['exports'],
  tasks: ['tasks-board', 'my-tasks', 'upcoming-tasks', 'completed-tasks', 'schedules', 'service-requests', 'followups'],
  attendance: ['attendance', 'attendance-logs', 'time-in-out', 'time-requests'],
  performance: ['performance'],
  activity: ['activity'],
  backup: ['backup'],
  users: ['users'],
  security: ['security'],
  'system-settings': ['system-settings'],
  violations: ['violations', 'violation-reports', 'violation-management'],
};

export function routeModule(page) {
  const base = String(page || '').split('/')[0];
  const entries = Object.entries(MODULE_ROUTES);
  for (let i = 0; i < entries.length; i += 1) {
    if (entries[i][1].includes(base)) return entries[i][0];
  }
  return null;
}

const DENIAL_CACHE_KEY = 'xevera_role_denials_v1';

let denialSet = null;
try {
  const cached = JSON.parse(localStorage.getItem(DENIAL_CACHE_KEY) || 'null');
  if (cached && Array.isArray(cached.denials)) {
    denialSet = new Set(cached.denials.map((d) => `${d.role}/${d.module}`));
  }
} catch { /* no cache — code behavior until the first load */ }

export function applyDenials(denials) {
  denialSet = new Set(
    (Array.isArray(denials) ? denials : []).map((d) => `${d.role}/${d.module}`)
  );
  try {
    localStorage.setItem(DENIAL_CACHE_KEY, JSON.stringify({ denials: Array.isArray(denials) ? denials : [] }));
  } catch { /* cache is best-effort */ }
}

/*
 * Fetch the live denial list. Safe to call repeatedly; failures keep
 * the previous (or code-default) behavior. Call after sign-in and
 * after any Super Admin matrix change.
 */
export async function refreshPermissions() {
  try {
    const data = await apiFetch('admin/permissions.php');
    if (data && Array.isArray(data.denials)) {
      applyDenials(data.denials);
      return true;
    }
  } catch { /* offline / forbidden — keep current behavior */ }
  return false;
}

/**
 * Get the page a user should see immediately after login.
 */
export function getLoginRedirect(role) {
  const roleKey = getRoleKey(role);

  return LOGIN_REDIRECT[roleKey] || 'home';
}

/**
 * Get the default page for a role.
 */
export function getDefaultPage(role) {
  const roleKey = getRoleKey(role);

  return DEFAULT_PAGES[roleKey] || 'home';
}

/**
 * Check whether the role belongs to staff/admin/super admin.
 */
export function isStaffRole(role) {
  return STAFF_ROLES.includes(normalizeRole(role));
}

/**
 * Check whether the role is Admin or Super Admin.
 */
export function isManagerRole(role) {
  const normalized = normalizeRole(role);

  return (
    normalized === 'admin' ||
    normalized === 'super_admin'
  );
}

/**
 * Generate the canonical clean URL path for a page.
 *
 * Returns "/" for the home/landing pages and "/<page>" for everything else.
 * The same path is used across all roles - the route guard decides what
 * content to render based on the signed-in role.
 */
export function getCanonicalPath(page, role) {
  const roleKey = getRoleKey(role);

  if (roleKey === 'Guest' || roleKey === 'Resident') {
    return page === 'home'
      ? '/'
      : `/${page}`;
  }

  // Admin/Super Admin: canonical dashboard URL is /admin
  if ((roleKey === 'Admin' || roleKey === 'Super Admin') && page === 'dashboard') {
    return '/admin';
  }

  return page === 'dashboard'
    ? '/dashboard'
    : `/${page}`;
}