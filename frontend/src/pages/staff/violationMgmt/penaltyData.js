/*
 * Violation Management — penalty configuration, seed data, and storage.
 *
 * NO-FEE penalty model: every penalty/restriction starts at 8:00 AM.
 * If approved after 8:00 AM, the effective date is the next calendar
 * day at 8:00 AM. No monetary fee is ever attached.
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

export function getPenaltyStartDate(now = new Date()) {
  const start = new Date(now);
  // Every restriction/suspension becomes effective at 8:00 AM.
  // If approval happens after 8:00 AM, use the next calendar day.
  if (now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0)) {
    start.setDate(start.getDate() + 1);
  }
  start.setHours(8, 0, 0, 0);
  return start;
}

export function formatPenaltyDate(date) {
  if (!date) return 'Admin Review';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'Admin Review';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function calculatePenaltyEnd(startDate, days) {
  if (days === null || days === undefined || days === 0) return null;
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);
  end.setHours(8, 0, 0, 0);
  return end;
}

export function penaltyDurationLabel(days) {
  if (days === null || days === undefined) return 'Admin Review';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/*
 * Applies a penalty to a report object (mutates and returns schedule info).
 * Throws when the penalty type is unknown.
 */
export function applyPenaltyToReport(report, penaltyType, appliedBy = 'Super Admin') {
  const config = PENALTY_CONFIG[penaltyType];
  if (!config) {
    throw new Error('Invalid penalty type.');
  }

  const startDate = getPenaltyStartDate();
  const endDate = calculatePenaltyEnd(startDate, config.days);

  report.penaltyType = penaltyType;
  report.penaltyLabel = config.label;
  report.penaltyDescription = config.description;
  report.penaltyDays = config.days;
  report.penaltyStartTime = config.startTime;
  report.penaltyStartAt = startDate.toISOString();
  report.penaltyEndAt = endDate ? endDate.toISOString() : null;

  // Explicitly no monetary penalty.
  report.penaltyFee = 0;
  report.penaltyFeeLabel = 'No Fee';

  report.penaltyAppliedAt = new Date().toISOString();
  report.penaltyAppliedBy = appliedBy;

  // Platform enforcement flags.
  report.reportingRestricted =
    penaltyType === 'reporting_restriction' ||
    penaltyType === 'permanent_restriction';
  report.accountSuspended =
    penaltyType === 'short_suspension' ||
    penaltyType === 'long_suspension';
  report.permanentReportingRestriction =
    penaltyType === 'permanent_restriction';

  return { config, startDate, endDate };
}

export function nowLabel() {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function todayKey() {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/* Seed data (Fake Report violations only)                             */
/* ------------------------------------------------------------------ */

export const SEED_REPORTS = [
  {
    id: 'VR-2026-0045',
    resident: 'Carlos M. Dela Cruz',
    initials: 'CD',
    block: 'Block 12 Lot 5',
    phone: '+63 912 345 6789',
    type: 'Fake Report',
    severity: 'Major',
    date: 'Sep 21, 2026 10:14 AM',
    description:
      'Resident submitted a report that was verified to be false after verification and on-site inspection.',
    status: 'under_review',
    remarks: '',
    reportedBy: 'Resident (Carlos M. Dela Cruz)',
  },
  {
    id: 'VR-2026-0044',
    resident: 'Angela R. Santos',
    initials: 'AS',
    block: 'Block 8 Lot 3',
    phone: '+63 917 123 4567',
    type: 'Fake Report',
    severity: 'Minor',
    date: 'Sep 20, 2026 02:31 PM',
    description:
      'The submitted report could not be verified during the administrative review.',
    status: 'under_review',
    remarks: '',
    reportedBy: 'Resident (Angela R. Santos)',
  },
  {
    id: 'VR-2026-0043',
    resident: 'Mark L. Reyes',
    initials: 'MR',
    block: 'Block 15 Lot 7',
    phone: '+63 918 555 1234',
    type: 'Fake Report',
    severity: 'Minor',
    date: 'Sep 19, 2026 11:20 AM',
    description:
      'The reported incident was investigated and found to be inaccurate.',
    status: 'under_review',
    remarks: '',
    reportedBy: 'Resident (Mark L. Reyes)',
  },
  {
    id: 'VR-2026-0042',
    resident: 'Liza P. Villanueva',
    initials: 'LV',
    block: 'Block 3 Lot 1',
    phone: '+63 919 888 1111',
    type: 'Fake Report',
    severity: 'Major',
    date: 'Sep 18, 2026 04:05 PM',
    description:
      'The report was investigated and the alleged incident could not be verified.',
    status: 'confirmed',
    remarks:
      'After verification and on-site inspection, the submitted report was found to be false.',
    reportedBy: 'Resident (Liza P. Villanueva)',
    confirmedAt: 'Sep 18, 2026 05:10 PM',
    confirmedBy: 'Super Admin',
    administrativeAction: 'Reporting Restriction - 3 Days',
    penaltyType: 'reporting_restriction',
    penaltyLabel: 'Reporting Restriction',
    penaltyDescription: 'Cannot submit new reports',
    penaltyDays: 3,
    penaltyStartTime: '08:00',
    penaltyFee: 0,
    penaltyFeeLabel: 'No Fee',
  },
  {
    id: 'VR-2026-0041',
    resident: 'John T. Gonzales',
    initials: 'JG',
    block: 'Block 6 Lot 9',
    phone: '+63 920 222 3333',
    type: 'Fake Report',
    severity: 'Minor',
    date: 'Sep 17, 2026 09:18 AM',
    description:
      'The report was reviewed and did not contain sufficient factual basis.',
    status: 'confirmed',
    remarks: 'The report was confirmed as a fake report after review.',
    reportedBy: 'Resident (John T. Gonzales)',
    confirmedAt: 'Sep 17, 2026 11:00 AM',
    confirmedBy: 'Super Admin',
    administrativeAction: 'Warning',
    penaltyType: 'warning',
    penaltyLabel: 'Warning',
    penaltyDescription: 'Formal warning',
    penaltyDays: 0,
    penaltyStartTime: '08:00',
    penaltyFee: 0,
    penaltyFeeLabel: 'No Fee',
  },
  {
    id: 'VR-2026-0040',
    resident: 'Sofia Garcia',
    initials: 'SG',
    block: 'Block 10 Lot 4',
    phone: '+63 921 111 2233',
    type: 'Fake Report',
    severity: 'Major',
    date: 'Sep 16, 2026 02:18 PM',
    description:
      'A repeated false report was verified during administrative review.',
    status: 'confirmed',
    remarks: 'The report was verified as false based on available evidence.',
    reportedBy: 'Resident (Sofia Garcia)',
    confirmedAt: 'Sep 16, 2026 04:05 PM',
    confirmedBy: 'Super Admin',
    administrativeAction: 'Short Suspension - 7 Days',
    penaltyType: 'short_suspension',
    penaltyLabel: 'Short Suspension',
    penaltyDescription: 'Account temporarily suspended',
    penaltyDays: 7,
    penaltyStartTime: '08:00',
    penaltyFee: 0,
    penaltyFeeLabel: 'No Fee',
  },
  {
    id: 'VR-2026-0039',
    resident: 'Elena Ramos',
    initials: 'ER',
    block: 'Block 9 Lot 2',
    phone: '+63 922 777 8899',
    type: 'Fake Report',
    severity: 'Minor',
    date: 'Sep 15, 2026 01:45 PM',
    description:
      'The submitted allegation could not be supported by the available evidence.',
    status: 'dismissed',
    remarks:
      'Insufficient evidence to confirm that the report was intentionally false.',
    reportedBy: 'Resident (Elena Ramos)',
    dismissedAt: 'Sep 15, 2026 03:20 PM',
    dismissedBy: 'Super Admin',
    dismissalReason:
      'Insufficient evidence. The violation was dismissed.',
  },
  {
    id: 'VR-2026-0038',
    resident: 'Mark Villanueva',
    initials: 'MV',
    block: 'Block 6 Lot 8',
    phone: '+63 923 333 4455',
    type: 'Fake Report',
    severity: 'Major',
    date: 'Sep 14, 2026 10:05 AM',
    description:
      'The report was investigated but could not be established as a confirmed fake report.',
    status: 'dismissed',
    remarks: 'The violation was dismissed after verification.',
    reportedBy: 'Resident (Mark Villanueva)',
    dismissedAt: 'Sep 14, 2026 01:40 PM',
    dismissedBy: 'Super Admin',
    dismissalReason: 'Dismissed after verification.',
  },
];

/* ------------------------------------------------------------------ */
/* localStorage persistence                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'xevera_violation_reports_v2';

export function loadReports() {
  const base = SEED_REPORTS.map((r) => ({ ...r, type: 'Fake Report' }));
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return base;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return base;
    parsed.forEach((savedReport) => {
      if (!savedReport || !savedReport.id) return;
      const existing = base.find((r) => r.id === savedReport.id);
      if (existing) {
        Object.assign(existing, savedReport);
      } else {
        base.push({ ...savedReport, type: 'Fake Report' });
      }
    });
  } catch {
    /* corrupted storage -> fall back to seeds */
  }
  return base;
}

export function saveReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    /* storage unavailable (private mode) — state still works in memory */
  }
}

/* ------------------------------------------------------------------ */
/* Cross-navigation intents (survive the App remount between tabs)     */
/* ------------------------------------------------------------------ */

let pendingDrawerId = null;
let pendingToast = null;

export function setPendingDrawerId(id) {
  pendingDrawerId = id;
}

export function takePendingDrawerId() {
  const id = pendingDrawerId;
  pendingDrawerId = null;
  return id;
}

export function setPendingToast(message, kind = 'success') {
  pendingToast = { message, kind };
}

export function takePendingToast() {
  const t = pendingToast;
  pendingToast = null;
  return t;
}

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

export function initialsOf(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export const EVIDENCE_IMAGES = [
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=500&q=80',
];

export const TABS = ['all', 'under-review', 'confirmed', 'dismissed'];

export function normalizeTab(tab) {
  return TABS.includes(tab) ? tab : 'under-review';
}
