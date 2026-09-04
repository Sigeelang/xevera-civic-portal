const STAFF_ROLES = ['super_admin', 'admin', 'staff'];

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
  ]),

  Resident: new Set([
    'home',
    'resident-dashboard',
    'submit',
    'my-reports',
    'community-reports',
    'messages',
    'notifications',
    'help',
    'contact',
    'my-account',
    'change-password',
    'account-security',
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
    'help',
    'time-in-out',
    'report-detail',
    'home',
    'report-success',
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
    'help',
    'time-in-out',
    'calendar',
    'report-detail',
    'home',
    'report-success',
    'analytics',
    'exports',
    'residents',
    'activity',
    'backup',
    'maintenance',
    'attendance',
    'attendance-logs',
    'announcements',
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
    'help',
    'time-in-out',
    'calendar',
    'report-detail',
    'home',
    'report-success',
    'analytics',
    'exports',
    'residents',
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
 */
export function isRouteAllowed(page, role) {
  const roleKey = getRoleKey(role);
  const allowedRoutes =
    ROUTE_PERMISSIONS[roleKey] || ROUTE_PERMISSIONS.Guest;

  return allowedRoutes.has(page);
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

  return page === 'dashboard'
    ? '/dashboard'
    : `/${page}`;
}