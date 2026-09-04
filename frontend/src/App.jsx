import { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';

import TopBar from './components/TopBar';
import StaffSidebar from './components/StaffSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import MaintenanceBanner from './components/MaintenanceBanner';
import GuestLayout from './layouts/GuestLayout';
import ResidentLayout from './layouts/ResidentLayout';
import { ResidentNotificationsProvider } from './context/ResidentNotificationsContext';
import AdminMaintenanceScreen from './pages/staff/AdminMaintenanceScreen';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ForcePasswordChangePage from './pages/auth/ForcePasswordChangePage';

import XeveraLanding from './pages/public/XeveraLanding';
import SubmitPage from './pages/public/SubmitPage';
import ReportsPage from './pages/public/ReportsPage';
import ReportDetailPage from './pages/public/ReportDetailPage';
import ReportSuccessPage from './pages/public/ReportSuccessPage';
import HowItWorksPage from './pages/public/HowItWorksPage';
import GuestAnnouncementsPage from './pages/public/GuestAnnouncementsPage';
import MaintInfoPage from './pages/public/MaintInfoPage';
import ContactPage from './pages/public/ContactPage';
import ContactEmergencyPage from './pages/public/ContactEmergencyPage';
import DocumentsPage from './pages/public/DocumentsPage';
import GarbageSchedulePage from './pages/public/GarbageSchedulePage';
import AboutPage from './pages/public/AboutPage';
import NotificationsPage from './pages/public/NotificationsPage';
import {
  FaqPage,
  GuidelinesPage,
  PrivacyPage,
  TermsPage,
} from './pages/public/LegalPages';

import AttendancePage from './pages/staff/AttendancePage';

import ResidentDashboardPage from './pages/resident/ResidentDashboardPage';
import ResidentMyReportsPage from './pages/resident/ResidentMyReportsPage';
import ResidentReportPage from './pages/resident/ResidentReportPage';
import ResidentSecurityPage from './pages/resident/ResidentSecurityPage';
import ResidentChangePasswordPage from './pages/resident/ResidentChangePasswordPage';
import ResidentHelpCenterPage from './pages/resident/ResidentHelpCenterPage';
import ResidentNotificationsPage from './pages/public/ResidentNotificationsPage';
import ResidentMessagesPage from './pages/resident/ResidentMessagesPage';
import ResidentAccountPage from './pages/public/ResidentAccountPage';
import ResidentContactPage from './pages/resident/ResidentContactPage';

import SuperAdminDashboard from './pages/staff/dashboards/SuperAdminDashboard';
import AdminDashboard from './pages/staff/dashboards/AdminDashboard';
import StaffDashboard from './pages/staff/dashboards/StaffDashboard';
import ReportsMgmtPage from './pages/staff/ReportsMgmtPage';
import VerifyReportsPage from './pages/staff/VerifyReportsPage';
import MyPerformancePage from './pages/staff/MyPerformancePage';
import ExportReportsPage from './pages/staff/ExportReportsPage';
import AnalyticsPage from './pages/staff/AnalyticsPage';
import TimeRequestsPage from './pages/staff/TimeRequestsPage';
import CalendarPage from './pages/staff/CalendarPage';
import HelpCenterPage from './pages/staff/HelpCenterPage';
import UsersMgmtPage from './pages/staff/UsersMgmtPage';
import SecurityPage from './pages/staff/SecurityPage';
import SystemSettingsPage from './pages/staff/SystemSettingsPage';
import ResidentsPage from './pages/staff/ResidentsPage';
import AnnouncementsPage from './pages/staff/AnnouncementsPage';

import MessagesPage from './pages/staff/MessagesPage';
import SettingsPage from './pages/staff/SettingsPage';
import MaintenancePage from './pages/staff/MaintenancePage';
import ProfilePage from './pages/staff/ProfilePage';
import BackupPage from './pages/staff/BackupPage';
import AdminAttendancePage from './pages/staff/AdminAttendancePage';
import StaffAssignedReportsPage from './pages/staff/StaffAssignedReportsPage';
import TrackReportPage from './pages/public/TrackReportPage';
import AttendanceLogsPage from './pages/staff/AttendanceLogsPage';
import TasksBoardPage from './pages/staff/TasksBoardPage';
import ServiceRequestsPage from './pages/staff/ServiceRequestsPage';
import FollowUpsPage from './pages/staff/FollowUpsPage';

import {
  isRouteAllowed,
  getLoginRedirect,
  getDefaultPage,
  isStaffRole,
  isManagerRole,
  getCanonicalPath,
} from './utils/routeGuard';

export default function App() {
  const { user, loading, completeLogin, logout } = useAuth();
  const {
    siteName,
    maintenanceMode,
    maintenanceAllowedRoles,
    refreshSettings,
  } = useSettings();

  const [page, setPage] = useState('home');
  const [reportId, setReportId] = useState(null);
  const [reportDetailSource, setReportDetailSource] = useState(null); // remembers my-reports vs community-reports for back
  const [statusPreset, setStatusPreset] = useState(null);
  const [submitCategory, setSubmitCategory] = useState(null);
  const [categoryPreset, setCategoryPreset] = useState(null);
  const [trackCategoryPreset, setTrackCategoryPreset] = useState(null);
  const [successRef, setSuccessRef] = useState(null);
  const [trackFocusRef, setTrackFocusRef] = useState(null);
  const [announcementFocus, setAnnouncementFocus] = useState(null);
  const [usersSection, setUsersSection] = useState(null);
  const [securitySection, setSecuritySection] = useState(null);
  const [systemSettingsSection, setSystemSettingsSection] = useState(null);
  const [authPage, setAuthPage] = useState(null);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [forDashboard, setForDashboard] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forcePwChange, setForcePwChange] = useState(() => {
    try { return localStorage.getItem('xevera_force_pw_change') === '1'; } catch { return false; }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('xeveraSidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isStaff = user && isStaffRole(user?.role);
  const canManage = user && isManagerRole(user?.role);

  /*
   * Maintenance auto-logout for residents: while maintenance mode is ON,
   * signed-in residents are signed out automatically (token cleared,
   * redirected to the public portal which shows the maintenance screen).
   * Staff/Admin/Super Admin keep their sessions.
   */
  const loggedOutForMaintenance = useRef(false);

  // Re-check maintenance status periodically so residents who are already
  // signed in get logged out promptly when maintenance turns on.
  useEffect(() => {
    if (loading) return undefined;
    if (!user || user.role !== 'Resident') return undefined;
    const t = setInterval(() => {
      try { refreshSettings(); } catch { /* silent - next tick retries */ }
    }, 30000);
    return () => clearInterval(t);
  }, [loading, user, refreshSettings]);

  useEffect(() => {
    if (!maintenanceMode) {
      loggedOutForMaintenance.current = false;
      return;
    }
    if (!user || user.role !== 'Resident' || loggedOutForMaintenance.current) return;
    loggedOutForMaintenance.current = true;
    try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
    try {
      const r = logout('/');
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch { /* logout clears locally even if the request fails */ }
  }, [maintenanceMode, user, logout]);

  const maintenanceAllowed =
    user &&
    maintenanceAllowedRoles.includes(user?.role);

  const inMaintenance =
    maintenanceMode && !maintenanceAllowed;

  /*
   * No automatic scroll on page navigation: resident sidebar clicks
   * (Help Center / Contact Support / My Account) stay where the user
   * clicked. Only auth screens reset scroll.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authPage) return;
    try {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    } catch { /* no-op */ }
  }, [authPage]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'xeveraSidebarCollapsed',
        sidebarCollapsed ? 'true' : 'false'
      );
    } catch {}
  }, [sidebarCollapsed]);

  // Handle Google OAuth redirect with token
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('google_token');
    const err = params.get('google_error');
    if (err) {
      setAuthError('Google sign-in failed: ' + err);
      setAuthPage('login');
      try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch {}
      return;
    }
    if (token) {
      try {
        // Per-account isolation: clear the previous account's token,
        // force-password flag, and any in-memory user state before
        // we accept the new Google account's token. Otherwise a new
        // account logs in and briefly sees the previous account's data.
        try { localStorage.removeItem('xevera_auth_token'); } catch {}
        try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
        setUser(null);

        // Decode payload to get user info for handleAuthSuccess
        const b64 = token.split('.')[0];
        const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json);
        // Store the new token and trigger the standard login flow
        try { localStorage.setItem('xevera_auth_token', token); } catch {}
        // Use completeLogin if available to set user state
        if (payload && payload.user_id) {
          // Construct minimal user object from token payload
          const userObj = {
            id: payload.user_id,
            name: payload.name,
            username: payload.username,
            email: payload.email,
            role: payload.role,
            status: payload.status,
            photo: payload.photo,
            address: payload.address,
          };
          try { completeLogin({ token, user: userObj }); } catch {}
        }
        try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch {}
        // Navigate to correct dashboard based on role
        const role = payload?.role || 'Resident';
        const target = role === 'Resident' ? 'resident-dashboard' : 'dashboard';
        setPage(target);
        setAuthPage(null);
      } catch {}
    }
  }, []);

  function toggleSidebar() {
    if (window.innerWidth <= 900) {
      setSidebarOpen((value) => !value);
    } else {
      setSidebarCollapsed((value) => !value);
    }
  }

  /*
   * Read the current URL path and determine which page
   * should be displayed. Shared by the initial-load/direct-entry effect
   * and the popstate (Back/Forward) listener below: real pages push
   * history entries via pushPath, service/API actions never touch it.
   */
  function applyPathToState() {
    if (loading) return;

    const raw = (window.location.pathname || '/').replace(/^\/+|\/+$/g, '');
    const parts = raw.split('/').filter(Boolean);
    const slug = (parts[0] || '').toLowerCase();
    const param = parts.slice(1).join('/') || null;

    // Leaving an auth screen via Back/Forward or direct entry: any path
    // other than login/register (including the empty root path) means the
    // login/register screen is no longer showing.
    if (slug !== 'login' && slug !== 'register') {
      setAuthPage(null);
    }

    // Root URL (no path): public landing for guests, dashboard for
    // signed-in users. Keeps Back-to-root and direct-entry coherent.
    if (!slug) {
      if (user?.role === 'Resident') setPage('resident-dashboard');
      else if (isStaff) setPage('dashboard');
      else if (!user) setPage('home');
      return;
    }

    // Authentication routes
    if (slug === 'login') {
      setAuthPage('login');
      return;
    }

    if (slug === 'register') {
      setAuthPage('register');
      return;
    }

    // Report success
    if (slug === 'report-success') {
      if (param) {
        setSuccessRef(param);
        setPage('report-success');
      } else {
        setPage('home');
      }

      return;
    }

    // Track report — removed from public; redirect guests to community reports
    if (slug === 'track') {
      const role = user?.role || 'Guest';
      if (role === 'Guest') {
        // Public track removed: show community reports instead
        setStatusPreset(null);
        setCategoryPreset(param ? decodeURIComponent(param) : null);
        setPage('reports');
        return;
      }
      setStatusPreset(null);
      setTrackFocusRef(param ? decodeURIComponent(param) : null);
      setPage('track');
      return;
    }

    /*
     * Staff/Admin/Super Admin canonical entry:
     *
     * /dashboard
     *
     * Logged-in staff -> dashboard
     * Resident -> resident dashboard
     * Guest -> staff login
     */
    if (slug === 'dashboard') {
      if (isStaff) {
        setPage('dashboard');
      } else if (user?.role === 'Resident') {
        setPage('resident-dashboard');
      } else {
        setForDashboard(true);
        setAuthPage('login');
        syncPath('login');
      }

      return;
    }

    /*
     * /admin is a legacy-friendly alias for /dashboard. The canonical
     * staff portal entry is /dashboard, but many users (and external
     * links) expect /admin to "just work" and open the staff login or
     * dashboard. Without this branch, the slug 'admin' is not in KNOWN
     * and the page silently fails to render — which previously caused
     * a stale resident login screen to remain visible.
     */
    if (slug === 'admin') {
      if (isStaff) {
        setPage('dashboard');
        syncPath('dashboard');
      } else if (user?.role === 'Resident') {
        setPage('resident-dashboard');
        syncPath('resident-dashboard');
      } else {
        setForDashboard(true);
        setAuthPage('login');
        syncPath('login');
      }
      return;
    }

    // Valid application routes
    const KNOWN = new Set([
      'home',
      'submit',
      'reports',
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

      // Admin routes
      'analytics',
      'users',
      'residents',
      'activity',
      'time-in-out',
      'time-requests',
      'calendar',
      'help',
      'messages',
      'settings',
      'profile',
      'assigned-reports',
      'backup',
      'attendance',
      'new-reports',
      'verify',
      'in-progress',
      'pending-action',
      'resolved',
      'resolved-reports',
      'report-history',
      'closed',
      'concerns',
      'service-requests',
      'followups',
      'schedules',
      'tasks-board',
      'performance',
      'exports',
      'my-tasks',
      'upcoming-tasks',
      'completed-tasks',
      'all-reports',
      'ready-for-assignment',
      'rejected',

// Resident routes
'my-account',
'my-reports',
'community-reports',
'messages',
'change-password',
'resident-dashboard',
'service-request',
'account-security',

      // Super Admin only
      'security',
      'system-settings',
    ]);

    if (KNOWN.has(slug)) {
      if (slug === 'report-detail') {
        if (param) {
          // Direct entry / refresh / Back to a detail URL restores the
          // detail view instead of dropping to the reports list.
          setReportDetailSource('reports');
          setReportId(decodeURIComponent(param));
          setPage('report-detail');
        } else {
          setPage('reports');
        }
      } else {
        setPage(slug);
      }

      // Announcement deep-link: #/announcements/<id>
      setAnnouncementFocus(
        slug === 'announcements' && param ? param : null
      );

      // Track Report deep-link: #/track/<ref>
      setTrackFocusRef(slug === 'track' && param ? decodeURIComponent(param) : null);

      // Tabbed Super Admin pages: restore section from #/<page>/<section>
      setUsersSection(slug === 'users' ? (param || 'all') : null);
      setSecuritySection(slug === 'security' ? (param || 'overview') : null);
      setSystemSettingsSection(slug === 'system-settings' ? (param || 'general') : null);

      const PRESET_STATUS = {
        'new-reports': 'Pending',
        'in-progress': 'In Progress',
        resolved: 'Resolved',
        'resolved-reports': 'Resolved',
        closed: 'Closed',
        'ready-for-assignment': 'Verified',
        rejected: 'Rejected',
      };

      setStatusPreset(PRESET_STATUS[slug] || null);
    }
  }

  useEffect(() => {
    applyPathToState();
  }, [loading, isStaff, user?.role]);

  // Latest parser for the Back/Forward listener (avoids stale closures).
  const applyPathRef = useRef(null);
  applyPathRef.current = applyPathToState;

  /*
   * Browser Back/Forward: re-apply the URL hash to page state without
   * pushing a new entry. pushState/replaceState never fire popstate,
   * and this handler never pushes, so it cannot loop.
   */
  useEffect(() => {
    const onPopState = () => {
      try {
        if (applyPathRef.current) applyPathRef.current();
      } catch {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /*
   * Route guard.
   *
   * IMPORTANT:
   * Use isRouteAllowed because that is the function
   * exported from routeGuard.js.
   */
  useEffect(() => {
    if (loading) return;

    const role = user?.role || 'Guest';
    const currentPage = page;

    const currentPath = (window.location.pathname || '/').replace(
      /^\/+|\/+$/g,
      ''
    );

    const pathSlug = (
      currentPath.split('/')[0] || ''
    ).toLowerCase();

    // Login/register should not be redirected by the guard.
    if (authPage) return;

    // Resident attempting staff dashboard.
    if (
      role === 'Resident' &&
      pathSlug === 'dashboard'
    ) {
      handleNavigate('resident-dashboard');
      return;
    }

    /*
     * Staff/Admin/Super Admin visiting the public landing page is
     * intentionally allowed. Admins frequently want to view the
     * public site (e.g. to preview a resident report flow) without
     * logging out. The rendering logic at the bottom of this
     * component treats page === 'home' as a public page for all
     * signed-in users, so this guard no longer needs to force a
     * redirect to /dashboard.
     */

    // Check permission.
    if (!isRouteAllowed(currentPage, role)) {
      const defaultPage = getDefaultPage(role);
      handleNavigate(defaultPage);
    }
  }, [
    loading,
    user,
    page,
    authPage,
  ]);

  function syncPath(next) {
    // replaceState ONLY: guard redirects, auth transitions, and other
    // corrections that must not create Back-button history entries.
    const role = user?.role || 'Guest';
    const path = getCanonicalPath(next, role);

    try {
      window.history.replaceState(null, '', path);
    } catch {}
  }

  /*
   * Real page navigation: push a history entry so Browser Back/Forward
   * step through visited pages. Skips the push when the URL already
   * matches (re-clicking the current nav item must not stack dupes).
   * Service/API actions (login submit, form posts, guard redirects)
   * keep using syncPath above and never appear in history.
   */
  function pushPath(next) {
    const role = user?.role || 'Guest';
    const path = getCanonicalPath(next, role);

    try {
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
    } catch {}
  }

  function handleNavigate(next, preset, categoryPreset) {
    setSidebarOpen(false);

    // Protected notification page.
    if (next === 'notifications' && !user) {
      setPendingAuth('notifications');
      setAuthPage('login');
      return;
    }

    // Protected profile page.
    if (next === 'profile' && !user) {
      setPendingAuth('profile');
      setAuthPage('login');
      return;
    }

    const role = user?.role || 'Guest';

    // Public Track Report removed: guests are redirected to community Reports
    if (next === 'track' && role === 'Guest') {
      const cat = categoryPreset || null;
      setPage('reports');
      setCategoryPreset(cat);
      setTrackCategoryPreset(null);
      setTrackFocusRef(null);
      syncPath('reports');
      return;
    }

    /*
     * Sub-path navigation, e.g. 'users/staff', 'security/overview'.
     * Permission is checked against the base page; the sub path is
     * stored as the active tab/section of that page.
     */
    const slashIdx = next.indexOf('/');
    const basePath = slashIdx === -1 ? next : next.slice(0, slashIdx);
    const subPath = slashIdx === -1 ? null : next.slice(slashIdx + 1);

    // Permission check before navigation.
    if (!isRouteAllowed(basePath, role)) {
      const defaultPage = getDefaultPage(role);

      setPage(defaultPage);
      syncPath(defaultPage);
      return;
    }

    setPage(basePath);

    // Keep the per-page section states in sync.
    setUsersSection(basePath === 'users' ? (subPath || 'all') : null);
    setSecuritySection(basePath === 'security' ? (subPath || 'overview') : null);
    setSystemSettingsSection(basePath === 'system-settings' ? (subPath || 'general') : null);
    if (basePath !== 'announcements') {
      setAnnouncementFocus(null);
    }

    pushPath(subPath ? `${basePath}/${subPath}` : basePath);

    if (next === 'submit') {
      setSubmitCategory(preset || null);
    } else {
      setSubmitCategory(null);
    }

    if (next === 'reports' && categoryPreset) {
      setCategoryPreset(categoryPreset);
    } else {
      setCategoryPreset(null);
    }

    if (next === 'track' && categoryPreset) {
      setTrackCategoryPreset(categoryPreset);
    } else {
      setTrackCategoryPreset(null);
    }

    if (preset) {
      setStatusPreset(preset);
    } else if (next === 'reports' || next === 'report-history' || next === 'resolved-reports' || next === 'assigned-reports' || next === 'in-progress') {
      setStatusPreset(null);
    }
  }

  function handleOpenAnnouncement(id) {
    if (id === undefined || id === null || id === '') return;

    setSidebarOpen(false);
    setPage('announcements');
    setAnnouncementFocus(String(id));
    pushPath(
      'announcements/' + encodeURIComponent(id)
    );
  }

  function handleViewReport(id) {
    setSidebarOpen(false);
    setReportDetailSource(page); // remember where we came from (my-reports vs community-reports)
    setReportId(id);
    setPage('report-detail');
    pushPath('report-detail/' + encodeURIComponent(id));
  }

  function handleReportSuccess(ref) {
    setSidebarOpen(false);
    setSuccessRef(ref);
    setPage('report-success');

    pushPath(
      'report-success/' +
        encodeURIComponent(ref)
    );
  }

  function handleTrackByRef(ref) {
    setSidebarOpen(false);
    setTrackFocusRef(ref);
    setStatusPreset(null);
    setPage('track');

    pushPath(
      'track/' +
        encodeURIComponent(ref)
    );
  }

  function handleAuth(mode) {
    setAuthPage(mode || 'login');

    pushPath(
      mode === 'register'
        ? 'register'
        : 'login'
    );
  }

  function handleAuthSuccess(authenticatedUser) {
    setAuthLoading(false);
    setAuthError('');

    /*
     * Per-account isolation: any user-specific data left over from a
     * previously signed-in account must be cleared before we hand the
     * session over to the newly authenticated user. The API client and
     * localStorage were already reset in AuthContext.login / completeLogin;
     * the React user state is still stale until setUser below, so we
     * also reset the force-password gate and any cached page flags.
     */
    try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
    setForcePwChange(false);
    try { setUser(null); } catch {}
    const target = pendingAuth;

    setPendingAuth(null);

    /*
     * Dashboard login is handled separately below.
     * Keep the login page open when a Resident tries
     * to use the staff portal.
     */
    if (forDashboard) {
      if (
        authenticatedUser?.role === 'Resident'
      ) {
        setAuthError(
          'Access denied. Staff, Admin, or Super Admin access is required.'
        );

        setAuthPage('login');
        return;
      }

      setForDashboard(false);
      setAuthPage(null);
      if (authenticatedUser?.must_change_password) {
        try { localStorage.setItem('xevera_force_pw_change', '1'); } catch {}
        setForcePwChange(true);
        setPage('dashboard');
        syncPath('dashboard');
        return;
      }
      try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
      setForcePwChange(false);
      setPage('dashboard');
      syncPath('dashboard');

      return;
    }

    if (authenticatedUser?.must_change_password) {
      try { localStorage.setItem('xevera_force_pw_change', '1'); } catch {}
      setAuthPage(null);
      setForcePwChange(true);
      setPage('dashboard');
      syncPath('dashboard');
      return;
    }

    setAuthPage(null);
    try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
    setForcePwChange(false);

    if (target) {
      setPage(target);
      syncPath(target);
      return;
    }

    // Regular resident/public login.
    const redirectPage =
      getLoginRedirect(
        authenticatedUser?.role
      );

    setPage(redirectPage);
    syncPath(redirectPage);
  }

  function handleBackFromAuth() {
    /*
     * Returning from the auth screen back to the public landing must
     * drop any previously signed-in user's residual state. The Token
     * and force-password flag are cleared so a new account cannot pick
     * up data from the previous one.
     */
    setPendingAuth(null);
    setAuthPage(null);
    setForDashboard(false);
    setAuthError('');
    try { localStorage.removeItem('xevera_auth_token'); } catch {}
    try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
    setUser(null);
    setForcePwChange(false);
    syncPath('home');
  }

  function renderStaffPage() {
    if (page === 'report-detail') {
      return (
        <ReportDetailPage
          reportId={reportId}
          onBack={() => setPage('reports')}
        />
      );
    }

    if (page === 'notifications') {
      return (
        <NotificationsPage
          onViewReport={handleViewReport}
        />
      );
    }

    switch (page) {
      case 'reports':
      case 'all-reports':
        return (
          <ReportsMgmtPage
            key={page}
            statusPreset={statusPreset}
            scope="all"
            title="All Reports"
            description="Every report across the community lifecycle."
            onViewReport={handleViewReport}
          />
        );

      case 'new-reports':
        return (
          <ReportsMgmtPage
            key="new-reports"
            statusPreset="Pending"
            scope="all"
            title="Pending"
            description="Newly submitted reports awaiting verification."
            onViewReport={handleViewReport}
          />
        );

      case 'ready-for-assignment':
        return (
          <ReportsMgmtPage
            key="ready-for-assignment"
            statusPreset="Verified"
            scope="unassigned"
            title="Verified"
            description="Verified reports waiting to be assigned to staff."
            onViewReport={handleViewReport}
          />
        );

      case 'verify':
        return (
          <VerifyReportsPage
            onViewReport={handleViewReport}
          />
        );

      case 'in-progress':
        return (
          <ReportsMgmtPage
            key="in-progress"
            statusPreset="In Progress"
            scope={canManage ? 'all' : 'assigned'}
            title="In Progress"
            description="Reports currently being worked on."
            onViewReport={handleViewReport}
          />
        );

      case 'pending-action':
        return (
          <ReportsMgmtPage
            key="pending-action"
            statusPreset={
              canManage
                ? 'Admin Action'
                : 'Assigned'
            }
            scope={canManage ? 'all' : 'assigned'}
            title="Pending Action"
            description={
              canManage
                ? 'Reports needing your review — verify, assign, or close.'
                : 'Reports assigned to you that are awaiting action.'
            }
            onViewReport={handleViewReport}
          />
        );

      case 'resolved':
        return (
          <ReportsMgmtPage
            key="resolved"
            statusPreset="Resolved"
            scope={canManage ? 'all' : 'assigned'}
            title="Resolved"
            description="Resolved reports waiting for final admin review."
            onViewReport={handleViewReport}
          />
        );

      case 'resolved-reports':
        return (
          <ReportsMgmtPage
            key="resolved-reports"
            statusPreset="Resolved"
            scope="assigned"
            title="Resolved Reports"
            description="Reports you have completed — with resolution notes, evidence and verification status."
            onViewReport={handleViewReport}
          />
        );

      case 'report-history':
        return (
          <ReportsMgmtPage
            key="report-history"
            statusPreset={statusPreset}
            scope="assigned"
            title="Report History"
            description="Your completed and previous assignments. Filter by status or search by ID, issue, location or category."
            onViewReport={handleViewReport}
          />
        );

      case 'closed':
        return (
          <ReportsMgmtPage
            key="closed"
            statusPreset="Closed"
            scope="all"
            title="Closed"
            description="Closed and archived reports."
            onViewReport={handleViewReport}
          />
        );

      case 'rejected':
        return (
          <ReportsMgmtPage
            key="rejected"
            statusPreset="Rejected"
            scope="all"
            title="Rejected"
            description="Reports that were rejected and may be reopened."
            onViewReport={handleViewReport}
          />
        );

      case 'concerns':
      case 'contact-messages':
        return (
          <MessagesPage
            onNavigate={handleNavigate}
            onViewReport={handleViewReport}
            initialFilter="Contact"
          />
        );

      case 'service-requests':
        return <ServiceRequestsPage />;

      case 'followups':
        return <FollowUpsPage />;

      case 'schedules':
        return (
          <CalendarPage
            onNavigate={handleNavigate}
          />
        );

      case 'tasks-board':
        return <TasksBoardPage />;

      case 'my-tasks':
        return (
          <TasksBoardPage preset="my" />
        );

      case 'upcoming-tasks':
        return (
          <TasksBoardPage preset="upcoming" />
        );

      case 'completed-tasks':
        return (
          <TasksBoardPage preset="completed" />
        );

      case 'performance':
        return (
          <MyPerformancePage
            onViewReport={handleViewReport}
          />
        );

      case 'exports':
        return <ExportReportsPage />;

      case 'assigned-reports':
        return canManage ? (
          <ReportsMgmtPage
            key="assigned-reports"
            statusPreset="Assigned"
            scope="all"
            title="Assigned"
            description="Reports assigned to staff and awaiting work."
            onViewReport={handleViewReport}
          />
        ) : (
          <StaffAssignedReportsPage onViewReport={handleViewReport} />
        );

      case 'reports-detail':
        return (
          <ReportDetailPage
            reportId={reportId}
            onBack={() => setPage('reports')}
          />
        );

      case 'analytics':
        return (
          <AnalyticsPage
            onNavigate={handleNavigate}
          />
        );

      case 'users':
        return (
          <UsersMgmtPage
            preset={usersSection || 'all'}
            onNavigate={handleNavigate}
          />
        );

      case 'security':
        return (
          <SecurityPage
            section={securitySection || 'overview'}
            onNavigate={handleNavigate}
          />
        );

      case 'system-settings':
        return (
          <SystemSettingsPage
            section={systemSettingsSection || 'general'}
            onNavigate={handleNavigate}
          />
        );

      case 'residents':
        return <ResidentsPage />;

      case 'announcements':
        return <AnnouncementsPage />;

      

      case 'messages':
        return (
          <MessagesPage
            onNavigate={handleNavigate}
            onViewReport={handleViewReport}
          />
        );

      case 'settings':
        return <SettingsPage onNavigate={handleNavigate} />;

      case 'maintenance':
        return <MaintenancePage />;

      case 'profile':
        return <ProfilePage onNavigate={handleNavigate} />;

      case 'time-in-out':
        return <AttendancePage />;

      case 'attendance':
        return <AdminAttendancePage />;

      case 'attendance-logs':
        return <AttendanceLogsPage />;

      case 'time-requests':
        return <TimeRequestsPage />;

      case 'backup':
        return <BackupPage />;

      case 'calendar':
        return (
          <CalendarPage
            onNavigate={handleNavigate}
          />
        );

      case 'help':
        return <HelpCenterPage />;

      case 'home':
      case 'dashboard':
      default:
        if (user?.role === 'Super Admin') {
          return (
            <SuperAdminDashboard
              onNavigate={handleNavigate}
            />
          );
        }

        if (user?.role === 'Admin') {
          return (
            <AdminDashboard
              onNavigate={handleNavigate}
              onViewReport={handleViewReport}
            />
          );
        }

        return (
          <StaffDashboard
            onViewReport={handleViewReport}
            onNavigate={handleNavigate}
          />
        );
    }
  }

  function renderResidentPage() {
    const props = {
      onNavigate: handleNavigate,
      onViewReport: handleViewReport,
    };

    switch (page) {
      case 'report-detail':
        return (
          <ReportDetailPage
            reportId={reportId}
            onBack={() =>
              handleNavigate(reportDetailSource === 'community-reports' ? 'community-reports' : reportDetailSource === 'my-reports' ? 'my-reports' : 'my-reports')
            }
          />
        );

      case 'notifications':
        return (
          <ResidentNotificationsPage
            {...props}
          />
        );

       case 'messages':
        return (
          <ResidentMessagesPage
            {...props}
          />
        );

      case 'my-account':
        return (
          <ResidentAccountPage
            {...props}
          />
        );
      case 'my-reports':
        return (
          <ResidentMyReportsPage
            {...props}
            statusPreset={statusPreset}
            initialScope="mine"
          />
        );

      case 'community-reports':
        return (
          <ResidentMyReportsPage
            {...props}
            statusPreset={statusPreset}
            initialScope="all"
          />
        );

      case 'account-security':
        return (
          <ResidentSecurityPage
            onNavigate={handleNavigate}
          />
        );

      case 'change-password':
        return (
          <ResidentChangePasswordPage
            {...props}
          />
        );

      case 'help':
        return (
          <ResidentHelpCenterPage
            {...props}
          />
        );

      case 'contact':
        return (
          <ResidentContactPage
            onNavigate={handleNavigate}
          />
        );

      case 'service-request':
        return null;

      case 'submit':
        return (
          <ResidentReportPage
            presetCategory={submitCategory}
            onNavigate={handleNavigate}
            onSuccess={handleReportSuccess}
          />
        );

      case 'report-success':
        return (
          <ReportSuccessPage
            reference={successRef}
            onNavigate={handleNavigate}
            onTrack={handleTrackByRef}
            onNewReport={() =>
              handleNavigate('submit')
            }
          />
        );

      case 'announcements':
        return (
          <GuestAnnouncementsPage
            onNavigate={handleNavigate}
            focusId={announcementFocus}
          />
        );

      case 'emergency':
        return <ContactEmergencyPage />;

      case 'maintenance':
        return (
          <MaintInfoPage
            onNavigate={handleNavigate}
          />
        );

      case 'home':
      case 'resident-dashboard':
      default:
        return (
          <ResidentDashboardPage
            {...props}
          />
        );
    }
  }

  function renderGuestPage() {
    switch (page) {
      case 'track':
        return <TrackReportPage focusRef={trackFocusRef} onNavigate={handleNavigate} presetCategory={trackCategoryPreset} />;

      case 'report-detail':
        return (
          <ReportDetailPage
            reportId={reportId}
            onBack={() => setPage('reports')}
          />
        );

      case 'reports':
        return (
          <ReportsPage
            preset={statusPreset}
            presetCategory={categoryPreset}
            onNavigate={handleNavigate}
            onViewReport={handleViewReport}
          />
        );

      case 'submit':
        return (
          <SubmitPage
            presetCategory={submitCategory}
            onNavigate={handleNavigate}
            onSuccess={handleReportSuccess}
          />
        );

      case 'report-success':
        return (
          <ReportSuccessPage
            reference={successRef}
            onNavigate={handleNavigate}
            onTrack={handleTrackByRef}
            onNewReport={() =>
              handleNavigate('submit')
            }
          />
        );

      case 'how-it-works':
        return (
          <HowItWorksPage
            onNavigate={handleNavigate}
          />
        );

      case 'announcements':
        return (
          <GuestAnnouncementsPage
            onNavigate={handleNavigate}
            focusId={announcementFocus}
          />
        );

      case 'maintenance':
        return (
          <MaintInfoPage
            onNavigate={handleNavigate}
          />
        );

      /* Guest Contact page removed — residents use Contact Support instead */

      case 'emergency':
        return <ContactEmergencyPage />;

      case 'documents':
        return (
          <DocumentsPage
            onNavigate={handleNavigate}
          />
        );

      case 'garbage':
        return <GarbageSchedulePage />;

      case 'about':
        return (
          <AboutPage
            onNavigate={handleNavigate}
          />
        );

      case 'notifications':
        return <NotificationsPage />;

      case 'faq':
        return <FaqPage />;

      case 'guidelines':
        return <GuidelinesPage />;

      case 'privacy':
        return <PrivacyPage />;

      case 'terms':
        return <TermsPage />;

      case 'home':
      default:
        return (
          <XeveraLanding
            onAuth={handleAuth}
            onNavigate={handleNavigate}
          />
        );
    }
  }

  /*
   * Wait for AuthContext to restore the session.
   */
  if (loading) {
    return null;
  }

  /*
   * Forced password change on first login (Staff/Admin with a
   * temporary password). Blocks ALL app content until completed -
   * cannot be bypassed by navigation or refresh (localStorage guard).
   */
  if (forcePwChange && user && user.role !== 'Resident') {
    return (
      <ForcePasswordChangePage
        userName={user?.name || user?.email}
        onDone={() => {
          setForcePwChange(false);
          try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
          setPage('dashboard');
          syncPath('dashboard');
        }}
        onLogout={async () => {
          setForcePwChange(false);
          try { localStorage.removeItem('xevera_force_pw_change'); } catch {}
          try { await logout(); } catch {}
        }}
      />
    );
  }

  /*
   * Login page.
   *
   * portalType:
   * resident -> public/resident login
   * staff    -> Staff/Admin/Super Admin login
   */
  if (authPage === 'login') {
    return (
      <LoginPage
        onAuth={handleAuthSuccess}
        onRegister={
          forDashboard
            ? undefined
            : () => setAuthPage('register')
        }
        onForgot={
          forDashboard
            ? undefined
            : () => setAuthPage('forgot')
        }
        onBack={handleBackFromAuth}
        portalType={
          forDashboard
            ? 'staff'
            : 'resident'
        }
        loading={authLoading}
        error={authError}
        onLoadingChange={setAuthLoading}
      />
    );
  }

  /*
   * Forgot password.
   */
  if (authPage === 'forgot') {
    return (
      <ForgotPasswordPage
        onBack={handleBackFromAuth}
        onLogin={() =>
          setAuthPage('login')
        }
      />
    );
  }

  /*
   * Register.
   */
  if (authPage === 'register') {
    return (
      <RegisterPage
        onAuth={handleAuthSuccess}
        onLogin={() =>
          setAuthPage('login')
        }
        onBack={handleBackFromAuth}
      />
    );
  }

  /*
   * Maintenance screen.
   */
  if (inMaintenance) {
    return (
      <AdminMaintenanceScreen
        siteName={siteName}
        eyebrow="Xevera Portal"
        onReturnToLogin={() =>
          setAuthPage('login')
        }
      />
    );
  }

  /*
   * STAFF / ADMIN / SUPER ADMIN
   *
   * IMPORTANT:
   * This uses isRouteAllowed(), which is already
   * imported from routeGuard.js.
   *
   * Previously this line incorrectly used:
   *
   * isPageAllowed(...)
   *
   * which caused the blank page.
   */
  /*
   * Sidebar active key includes the sub-path section so nested
   * submenu items highlight correctly (e.g. 'security/overview').
   */
  const sidebarActivePage =
    page === 'users' && usersSection
      ? `users/${usersSection}`
      : page === 'security' && securitySection
        ? `security/${securitySection}`
        : page === 'system-settings' && systemSettingsSection
          ? `system-settings/${systemSettingsSection}`
          : page;

  /*
   * Staff/Admin/Super Admin: render the staff shell EXCEPT when the
   * current page is the public landing (page === 'home'). For that
   * single page, fall through to the GuestLayout branch below so a
   * signed-in admin sees the same public landing page that guests do.
   */
  if (isStaff && page !== 'home') {
    const allowed = isRouteAllowed(
      page,
      user?.role
    );

    return (
      <ErrorBoundary
        onReset={() =>
          handleNavigate('dashboard')
        }
      >
        <div className="min-h-screen bg-[#F5F7FB] staff-shell">
          {maintenanceMode && (
            <MaintenanceBanner
              siteName={siteName}
              onManage={() =>
                handleNavigate('maintenance')
              }
            />
          )}

          <div className="min-h-screen flex">
            <StaffSidebar
              activePage={sidebarActivePage}
              onNavigate={handleNavigate}
              open={sidebarOpen}
              collapsed={sidebarCollapsed}
              onClose={() =>
                setSidebarOpen(false)
              }
            />

            <div
              className={`
                flex-1
                flex
                flex-col
                min-w-0
                ${
                  sidebarCollapsed
                    ? 'lg:pl-[78px]'
                    : 'lg:pl-[255px]'
                }
              `}
            >
              <TopBar
                page={page}
                titleOverride={page === 'users' && usersSection === 'management' ? 'Staff & Administrators' : undefined}
                onNavigate={handleNavigate}
                onViewReport={handleViewReport}
                onOpenAnnouncement={handleOpenAnnouncement}
                onToggleSidebar={toggleSidebar}
              />

              <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-10">
                {allowed ? (
                  renderStaffPage()
                ) : (
                  <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-10 text-center max-w-lg mx-auto mt-10">
                    <div className="w-12 h-12 mx-auto rounded-full bg-red-50 text-[#DC2626] flex items-center justify-center mb-3">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                        />

                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>

                    <h2 className="text-lg font-head font-extrabold text-[#111827]">
                      Access denied
                    </h2>

                    <p className="text-sm text-[#6B7280] mt-1.5">
                      You do not have permission to
                      view this page.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        handleNavigate('dashboard')
                      }
                      className="mt-4 px-4 py-2 rounded-lg bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                )}
              </main>

              <footer className="text-center px-4 py-5 border-t border-[#E5E7EB]">
                <p className="text-xs text-[#6B7280]">
                  &copy; {new Date().getFullYear()}{' '}
                  {siteName}. All rights reserved.
                </p>
              </footer>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  /*
   * RESIDENT
   */
  if (
    user &&
    user.role === 'Resident'
  ) {
    // Most resident pages render their own <ResidentLayout>; wrapping them again
    // here would duplicate the sidebar and "Welcome" topbar. Only these two
    // render bare page content and need the shell provided here.
    const BARE_PAGES = ['report-detail', 'report-success', 'announcements', 'emergency', 'maintenance'];
    const needsShell = BARE_PAGES.includes(page);

    return (
      <ResidentNotificationsProvider
        onViewReport={handleViewReport}
        onOpenAnnouncement={handleOpenAnnouncement}
        onNavigate={handleNavigate}
      >
        {needsShell ? (
          <ResidentLayout
            activePage={page}
            onNavigate={handleNavigate}
          >
            {renderResidentPage()}
          </ResidentLayout>
        ) : (
          renderResidentPage()
        )}
      </ResidentNotificationsProvider>
    );
  }

  /*
   * GUEST / PUBLIC PORTAL
   */
  return (
    <GuestLayout
      page={page}
      onNavigate={handleNavigate}
      onAuth={handleAuth}
      onLogin={() =>
        handleAuth('login')
      }
    >
      {renderGuestPage()}
    </GuestLayout>
  );
}
