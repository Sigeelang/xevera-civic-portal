/*
 * Violation Management — client-side penalty metadata and helpers.
 *
 * The penalty schedule itself (8:00 AM Asia/Manila start, no fees) is
 * computed by the backend (violations/create.php + update.php). This
 * module only holds display metadata, severity/appeal derivation, and
 * date formatting for the live API rows.
 */

export const PENALTY_CONFIG = {
  warning: {
    label: 'Warning',
    description: 'Formal warning',
    days: 0,
    startTime: '08:00',
  },
  reporting_restriction: {
    label: 'Reporting Restriction',
    description: 'Cannot submit new reports',
    days: 3,
    startTime: '08:00',
  },
  short_suspension: {
    label: 'Short Suspension',
    description: 'Account temporarily suspended',
    days: 7,
    startTime: '08:00',
  },
  long_suspension: {
    label: 'Long Suspension',
    description: 'Account temporarily suspended',
    days: 30,
    startTime: '08:00',
  },
  permanent_restriction: {
    label: 'Permanent Restriction',
    description: 'Reporting permanently disabled',
    days: null,
    startTime: '08:00',
  },
};

export const PENALTY_ORDER = [
  'warning',
  'reporting_restriction',
  'short_suspension',
  'long_suspension',
  'permanent_restriction',
];

export function formatPenaltyDate(date) {
  if (!date) return 'Admin Review';
  const d = date instanceof Date ? date : new Date(String(date).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return 'Admin Review';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;
  try {
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return fallback;
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  } catch {
    return fallback;
  }
}

export function penaltyDurationLabel(days) {
  if (days === null || days === undefined) return 'Admin Review';
  const n = Number(days);
  if (Number.isNaN(n)) return 'Admin Review';
  return `${n} day${n === 1 ? '' : 's'}`;
}

/*
 * Severity for rows that have no violation yet (Under Review queue):
 * explicit severity wins, otherwise derive from the suspicion reason
 * (same heuristic as the legacy Violation Reports page).
 */
export function deriveSeverity(item) {
  if (item && item.severity) return item.severity;
  const reason = item ? String(item.suspicion_reason || '') : '';
  if (/fake|false|abusive|vandal|burning|illegal connection|construction without|water/i.test(reason)) return 'Major';
  return 'Minor';
}

/*
 * Appeal state derived from the live violation columns:
 *   appeal_reason empty            -> 'No Appeal'
 *   appeal_outcome = 'Overturned'  -> 'Overturned'  (accepted)
 *   appeal_outcome = 'Upheld'      -> 'Upheld'      (rejected)
 *   otherwise                      -> 'Pending Appeal'
 */
export function deriveAppeal(item) {
  if (!item || !item.appeal_reason) return 'No Appeal';
  const out = item.appeal_outcome || '';
  if (out === 'Overturned') return 'Overturned';
  if (out === 'Upheld') return 'Upheld';
  return 'Pending Appeal';
}

export function initialsOf(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export const TABS = ['all', 'under-review', 'confirmed', 'dismissed'];

export function normalizeTab(tab) {
  return TABS.includes(tab) ? tab : 'under-review';
}
