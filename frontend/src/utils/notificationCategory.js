/*
 * Shared notification category taxonomy.
 *
 * Single source of truth for the segmented filter controls on both
 * the My Notifications page and the TopBar bell dropdown:
 *   all | report | resident | staff | system
 *
 * Anything unmatched (announcements, maintenance, contact, future
 * types) falls into System so every notification stays filterable —
 * there is intentionally no invisible catch-all bucket.
 */

export const NOTIF_CATEGORIES = [
  ['all', 'All'],
  ['report', 'Reports'],
  ['resident', 'Residents'],
  ['staff', 'Staff'],
  ['system', 'System'],
];

export function notifCategory(type) {
  const t = String(type || '');
  if (/attendance/.test(t)) return 'staff';
  if (/resident|register/.test(t)) return 'resident';
  if (/message|direct/.test(t)) return 'staff';
  if (/report|comment|like|follow|status|assign|violation/.test(t)) return 'report';
  return 'system';
}
