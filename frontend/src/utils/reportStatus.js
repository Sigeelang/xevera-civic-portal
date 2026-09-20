// Canonical report lifecycle. Single source of truth for statuses,
// transitions, badge styling, and role-based actions.
// Mirrors backend/api/reports/update.php.

export const REPORT_STATUSES = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  UNDER_REVIEW: 'Under Review',
};

export const WORKFLOW_STEPS = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

export const REPORT_TRANSITIONS = {
  Pending: ['Verified', 'Rejected'],
  Verified: ['Assigned', 'Rejected'],
  Assigned: ['In Progress'],
  'In Progress': ['Resolved'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [],
  Rejected: ['Pending'],
};

export function canTransitionReport(currentStatus, nextStatus) {
  return (REPORT_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

const STATUS_CONFIGS = {
  Pending: { label: 'Pending', cls: 'bg-[#FFF4DF] text-[#D97706]', dot: 'bg-[#F4A900]' },
  Verified: { label: 'Verified', cls: 'bg-[#E0F7FA] text-[#0D9BB0]', dot: 'bg-[#0D9BB0]' },
  Assigned: { label: 'Assigned', cls: 'bg-[#EAF2FF] text-[#1769ED]', dot: 'bg-[#1769ED]' },
  'In Progress': { label: 'In Progress', cls: 'bg-[#F0EAFF] text-[#6D28D9]', dot: 'bg-[#6D28D9]' },
  Resolved: { label: 'Resolved', cls: 'bg-[#E7F8EF] text-[#159957]', dot: 'bg-[#159957]' },
  Closed: { label: 'Closed', cls: 'bg-[#EEF2F6] text-[#5C6E86]', dot: 'bg-[#5C6E86]' },
  Rejected: { label: 'Rejected', cls: 'bg-[#FFE9E9] text-[#E53535]', dot: 'bg-[#E53535]' },
  'Under Review': { label: 'Under Review', cls: 'bg-[#FFF3CD] text-[#B8860B]', dot: 'bg-[#DAA520]' },
};

/**
 * Returns the effective status for a report. If `is_suspicious` is 1,
 * the report is shown as "Under Review" to residents (and staff), regardless
 * of its underlying DB status.
 */
export function getEffectiveStatus(status, isSuspicious) {
  if (isSuspicious) return 'Under Review';
  return status;
}

export function getReportStatusConfig(status) {
  return (
    STATUS_CONFIGS[status] || {
      label: status || 'Unknown',
      cls: 'bg-[#F3F4F6] text-[#6B7280]',
      dot: 'bg-[#9CA3AF]',
    }
  );
}

// Role-based actions a user can perform on a report.
// Backend remains the authority; this drives the UI only.
export function getReportActions(report, user) {
  const status = report?.status;
  const role = user?.role;
  const isAdmin = role === 'Admin' || role === 'Super Admin';
  const isAssignee =
    report &&
    report.assigned_id &&
    user &&
    String(report.assigned_id) === String(user.id);
  const canWork = isAdmin || isAssignee;

  // A report is "open" while it still has work left to do.
  const isOpen = ['Pending', 'Verified', 'Assigned', 'In Progress'].includes(status);

  const actions = [];

  if (status === 'Pending' && isAdmin) actions.push('verify', 'reject');
  if (status === 'Verified' && isAdmin) actions.push('assign', 'reject');
  if (status === 'Assigned' && canWork) actions.push('start');
  if (status === 'In Progress' && canWork) actions.push('resolve');
  if (status === 'Resolved' && isAdmin) actions.push('close', 'reopen');
  if (status === 'Rejected' && isAdmin) actions.push('reopen');

  /*
   * "Add Update" (work note) — available to the assigned staff member or any
   * admin while the report is still open. Hidden once it is resolved, closed
   * or rejected.
   */
  if (isOpen && canWork) actions.push('update');

  // Flag as Fake — available to admins on any report
  if (isAdmin) actions.push('flag_fake');

  return actions;
}

export function getInitials(name) {
  return (name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
}