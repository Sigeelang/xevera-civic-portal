import { useState, useEffect, useRef } from 'react';
import './violationMgmt/ViolationManagement.css';
import {
  PENALTY_CONFIG,
  PENALTY_ORDER,
  formatPenaltyDate,
  penaltyDurationLabel,
  applyPenaltyToReport,
  nowLabel,
  todayKey,
  loadReports,
  saveReports,
  initialsOf,
  EVIDENCE_IMAGES,
  normalizeTab,
} from './violationMgmt/penaltyData';

const PAGE_SIZE = 8;

function statusPill(status) {
  if (status === 'confirmed') return { label: 'Confirmed', className: 'status status-confirmed' };
  if (status === 'dismissed') return { label: 'Dismissed', className: 'status status-dismissed' };
  return { label: 'Under Review', className: 'status status-review' };
}

function appealBadge(report) {
  if (!report.appealStatus) return { label: 'No Appeal', className: 'appeal-empty' };
  if (report.appealStatus === 'under_review') return { label: '⚠ Under Review', className: 'appeal-indicator' };
  if (report.appealStatus === 'approved') return { label: '✓ Accepted', className: 'appeal-indicator approved' };
  if (report.appealStatus === 'rejected') return { label: '× Rejected', className: 'appeal-indicator rejected' };
  return { label: report.appealStatus, className: 'appeal-indicator' };
}

function severityBadge(severity) {
  return severity === 'Major' ? 'badge badge-major' : 'badge badge-minor';
}

function penaltyOptionLabel(key) {
  const c = PENALTY_CONFIG[key];
  const icon = key === 'warning' ? '🟡' : key === 'reporting_restriction' ? '🟠' : key === 'permanent_restriction' ? '⚫' : '🔴';
  const days = c.days === null ? 'Admin Review' : `${c.days} day${c.days === 1 ? '' : 's'}`;
  return `${icon} ${c.label} — ${days}`;
}

export default function ViolationManagementPage({ initialTab = 'under-review', onNavigate }) {
  const [reports, setReports] = useState(() => loadReports());
  const [tab, setTab] = useState(() => normalizeTab(initialTab));

  // Filters (kept per tab so switching tabs preserves them)
  const [allQ, setAllQ] = useState('');
  const [allStatus, setAllStatus] = useState('');
  const [reviewQ, setReviewQ] = useState('');
  const [reviewSeverity, setReviewSeverity] = useState('');
  const [confirmedQ, setConfirmedQ] = useState('');
  const [confirmedAppeal, setConfirmedAppeal] = useState('');
  const [confirmedSeverity, setConfirmedSeverity] = useState('');
  const [dismissedQ, setDismissedQ] = useState('');
  const [dismissedSeverity, setDismissedSeverity] = useState('');
  const [pageNum, setPageNum] = useState(1);

  // Drawer / verify / resident view / modals / toast
  const [drawerId, setDrawerId] = useState(null);
  const [drawerForm, setDrawerForm] = useState({ severity: 'Major', remarks: '', penalty: 'warning', appealRemarks: '' });
  const [verifyId, setVerifyId] = useState(null);
  const [verifyDecision, setVerifyDecision] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [residentId, setResidentId] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Follow the sidebar submenu tab (App drives initialTab from the URL).
  useEffect(() => {
    setTab(normalizeTab(initialTab));
    setPageNum(1);
  }, [initialTab]);

  // Lock body scroll when an overlay is open.
  useEffect(() => {
    const locked = drawerId !== null || residentId !== null;
    try {
      document.body.style.overflow = locked ? 'hidden' : '';
    } catch { /* no-op */ }
    return () => {
      try { document.body.style.overflow = ''; } catch { /* no-op */ }
    };
  }, [drawerId, residentId]);

  // Escape closes the topmost layer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (imageSrc) setImageSrc(null);
      else if (residentId) setResidentId(null);
      else if (drawerId) setDrawerId(null);
      else if (verifyId) { setVerifyId(null); setVerifyDecision(''); setVerifyNotes(''); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageSrc, residentId, drawerId, verifyId]);

  function showToast(message, kind = 'success') {
    try { clearTimeout(toastTimer.current); } catch { /* no-op */ }
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function persist(next) {
    setReports(next);
    saveReports(next);
  }

  function goTab(nextTab) {
    if (typeof onNavigate === 'function') {
      onNavigate(`violation-management/${nextTab}`);
    } else {
      setTab(normalizeTab(nextTab));
      setPageNum(1);
    }
  }

  /* ---------------- filtering ---------------- */

  const matches = (report, q) => {
    const needle = String(q || '').toLowerCase().trim();
    if (!needle) return true;
    const hay = `${report.id} ${report.resident} ${report.description || ''} ${report.type} ${report.dismissalReason || report.remarks || ''}`.toLowerCase();
    return hay.includes(needle);
  };

  const allFiltered = reports.filter((r) => matches(r, allQ) && (!allStatus || r.status === allStatus));
  const reviewFiltered = reports.filter(
    (r) => r.status === 'under_review' && matches(r, reviewQ) && (!reviewSeverity || r.severity === reviewSeverity)
  );
  const confirmedFiltered = reports.filter(
    (r) =>
      r.status === 'confirmed' &&
      matches(r, confirmedQ) &&
      (!confirmedSeverity || r.severity === confirmedSeverity) &&
      (!confirmedAppeal || (confirmedAppeal === 'none' ? !r.appealStatus : r.appealStatus === confirmedAppeal))
  );
  const dismissedFiltered = reports.filter(
    (r) => r.status === 'dismissed' && matches(r, dismissedQ) && (!dismissedSeverity || r.severity === dismissedSeverity)
  );

  const activeFiltered =
    tab === 'all' ? allFiltered : tab === 'confirmed' ? confirmedFiltered : tab === 'dismissed' ? dismissedFiltered : reviewFiltered;

  const totalPages = Math.max(1, Math.ceil(activeFiltered.length / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const pageRows = activeFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* ---------------- statistics ---------------- */

  const underReview = reports.filter((r) => r.status === 'under_review');
  const confirmed = reports.filter((r) => r.status === 'confirmed');
  const dismissed = reports.filter((r) => r.status === 'dismissed');
  const tKey = todayKey();
  const confirmedToday = confirmed.filter((r) => String(r.confirmedAt || '').includes(tKey)).length;
  const dismissedToday = dismissed.filter((r) => String(r.dismissedAt || '').includes(tKey)).length;
  const warnings = confirmed.filter((r) => String(r.administrativeAction || '').toLowerCase() === 'warning').length;
  const majorConfirmed = confirmed.filter((r) => r.severity === 'Major').length;
  const potentialFake = underReview.filter((r) => r.type === 'Fake Report').length;
  const fakeDismissed = dismissed.filter((r) => r.type === 'Fake Report').length;
  const restored = reports.filter((r) => r.restoredAt).length;

  /* ---------------- drawer actions ---------------- */

  const drawerReport = drawerId ? reports.find((r) => r.id === drawerId) || null : null;

  function openDrawer(id) {
    const report = reports.find((r) => r.id === id);
    if (!report) {
      showToast('Report could not be found.', 'error');
      return;
    }
    setDrawerForm({
      severity: report.severity || 'Major',
      remarks: report.remarks || '',
      penalty: report.penaltyType || 'warning',
      appealRemarks: report.appealDecisionRemarks || '',
    });
    setDrawerId(id);
  }

  function closeDrawer() {
    setDrawerId(null);
  }

  function setFormField(field, value) {
    setDrawerForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleConfirm() {
    if (!drawerReport) return;
    const { severity, remarks, penalty } = drawerForm;
    if (!severity) {
      showToast('Please select a severity.', 'error');
      return;
    }
    if (!String(remarks || '').trim()) {
      showToast('Please enter admin remarks before confirming.', 'error');
      return;
    }
    if (!penalty || !PENALTY_CONFIG[penalty]) {
      showToast('Please select a valid penalty.', 'error');
      return;
    }
    try {
      const next = reports.map((r) => (r.id === drawerReport.id ? { ...r } : r));
      const target = next.find((r) => r.id === drawerReport.id);
      target.type = 'Fake Report';
      target.severity = severity;
      target.remarks = remarks.trim();
      target.status = 'confirmed';
      const result = applyPenaltyToReport(target, penalty);
      target.administrativeAction =
        result.config.days === null ? result.config.label : `${result.config.label} - ${result.config.days} Days`;
      target.penaltySchedule =
        result.config.days === null
          ? 'Starts at 8:00 AM — Admin Review'
          : `Starts ${formatPenaltyDate(result.startDate)}`;
      target.confirmedAt = nowLabel();
      target.confirmedBy = 'Super Admin';
      persist(next);
      showToast(`${target.id} confirmed. ${result.config.label} applied — No Fee.`, 'success');
      closeDrawer();
      goTab('confirmed');
    } catch (err) {
      showToast('Unable to apply the selected penalty.', 'error');
    }
  }

  function handleDismiss() {
    if (!drawerReport) return;
    const remarks = String(drawerForm.remarks || '').trim();
    if (!remarks) {
      showToast('Please enter the reason for dismissal.', 'error');
      return;
    }
    const now = nowLabel();
    const next = reports.map((r) =>
      r.id === drawerReport.id
        ? {
            ...r,
            dismissalReason: remarks,
            dismissedAt: now,
            dismissedBy: 'Super Admin',
            previousStatus: r.status,
            status: 'dismissed',
          }
        : r
    );
    persist(next);
    showToast(`${drawerReport.id} has been dismissed.`, 'success');
    closeDrawer();
    goTab('dismissed');
  }

  function handleAcceptAppeal() {
    if (!drawerReport || drawerReport.appealStatus !== 'under_review') return;
    const remarks = String(drawerForm.appealRemarks || '').trim();
    if (!remarks) {
      showToast('Please enter admin remarks before accepting the appeal.', 'error');
      return;
    }
    const now = nowLabel();
    const next = reports.map((r) =>
      r.id === drawerReport.id
        ? {
            ...r,
            appealStatus: 'approved',
            appealDecisionRemarks: remarks,
            appealReviewedAt: now,
            appealReviewedBy: 'Super Admin',
            previousStatus: r.status,
            status: 'dismissed',
            dismissalReason: 'Violation dismissed after the resident appeal was accepted.',
            dismissedAt: now,
            dismissedBy: 'Super Admin',
            remarks,
          }
        : r
    );
    persist(next);
    showToast(`${drawerReport.id} appeal accepted. The violation has been dismissed.`, 'success');
    closeDrawer();
    goTab('dismissed');
  }

  function handleRejectAppeal() {
    if (!drawerReport || drawerReport.appealStatus !== 'under_review') return;
    const remarks = String(drawerForm.appealRemarks || '').trim();
    if (!remarks) {
      showToast('Please enter admin remarks before rejecting the appeal.', 'error');
      return;
    }
    const now = nowLabel();
    const next = reports.map((r) =>
      r.id === drawerReport.id
        ? {
            ...r,
            appealStatus: 'rejected',
            appealDecisionRemarks: remarks,
            appealReviewedAt: now,
            appealReviewedBy: 'Super Admin',
            status: 'confirmed',
            remarks,
          }
        : r
    );
    persist(next);
    showToast(`${drawerReport.id} appeal rejected. The violation remains confirmed.`, 'success');
    closeDrawer();
    goTab('confirmed');
  }

  /* ---------------- verify flow ---------------- */

  const verifyReport = verifyId ? reports.find((r) => r.id === verifyId) || null : null;

  function openVerify(id) {
    const report = reports.find((r) => r.id === id);
    if (!report) {
      showToast('Report could not be found.', 'error');
      return;
    }
    setVerifyId(id);
    setVerifyDecision('');
    setVerifyNotes('');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { /* no-op */ }
  }

  function closeVerify() {
    setVerifyId(null);
    setVerifyDecision('');
    setVerifyNotes('');
  }

  function submitVerify() {
    if (!verifyReport) {
      showToast('No report selected.', 'error');
      return;
    }
    if (!verifyDecision) {
      showToast('Please choose a verification decision first.', 'error');
      return;
    }
    const notes = String(verifyNotes || '').trim();
    const now = nowLabel();

    if (verifyDecision === 'verified') {
      const next = reports.map((r) =>
        r.id === verifyReport.id
          ? { ...r, status: 'confirmed', confirmedAt: now, confirmedBy: 'Super Admin', remarks: notes || 'Report verified and confirmed by Super Admin.' }
          : r
      );
      persist(next);
      showToast(`${verifyReport.id} has been verified successfully.`, 'success');
      closeVerify();
      goTab('confirmed');
      return;
    }

    if (verifyDecision === 'rejected') {
      if (!notes) {
        showToast('Please enter a reason for rejecting the report.', 'error');
        return;
      }
      const next = reports.map((r) =>
        r.id === verifyReport.id
          ? {
              ...r,
              previousStatus: r.status,
              status: 'dismissed',
              dismissedAt: now,
              dismissedBy: 'Super Admin',
              dismissalReason: notes,
              remarks: notes,
            }
          : r
      );
      persist(next);
      showToast(`${verifyReport.id} has been rejected.`, 'success');
      closeVerify();
      goTab('dismissed');
      return;
    }

    if (verifyDecision === 'fake') {
      const note = notes || 'Report was flagged as potentially fake during verification and requires violation review.';
      const next = reports.map((r) =>
        r.id === verifyReport.id
          ? {
              ...r,
              type: 'Fake Report',
              violationSource: 'Verify Reports',
              flaggedAsFake: true,
              flaggedAt: now,
              flaggedBy: 'Super Admin',
              violationStatus: 'under_review',
              status: 'under_review',
              violationNote: note,
              remarks: note,
            }
          : r
      );
      persist(next);
      const flaggedId = verifyReport.id;
      showToast(`${flaggedId} was sent to Violation Reports → Under Review.`, 'success');
      closeVerify();
      goTab('under-review');
      // Open the same violation workflow drawer once the tab is active.
      setTimeout(() => openDrawer(flaggedId), 150);
    }
  }

  function verifyHistory(report) {
    const items = [
      {
        title: 'Pending → Pending',
        meta: `${report.date || 'Submitted'} · by ${report.reportedBy || 'Resident'} · Awaiting verification`,
      },
    ];
    if (report.flaggedAt) {
      items.push({
        title: 'Pending → Violation Under Review',
        meta: `${report.flaggedAt} · by ${report.flaggedBy || 'Super Admin'} · ${report.violationNote || 'Flagged as fake and sent to Violation Reports.'}`,
      });
    }
    if (report.confirmedAt) {
      items.push({
        title: 'Pending → Confirmed',
        meta: `${report.confirmedAt} · by ${report.confirmedBy || 'Super Admin'} · ${report.remarks || 'Report verified.'}`,
      });
    }
    if (report.dismissedAt) {
      items.push({
        title: 'Pending → Dismissed',
        meta: `${report.dismissedAt} · by ${report.dismissedBy || 'Super Admin'} · ${report.dismissalReason || report.remarks || 'Report dismissed.'}`,
      });
    }
    return items;
  }

  /* ---------------- resident view ---------------- */

  const residentReport = residentId ? reports.find((r) => r.id === residentId) || null : null;

  function openResidentView() {
    const first = confirmed[0];
    if (!first) {
      showToast('No confirmed violation is available yet.', 'error');
      return;
    }
    setResidentId(first.id);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { /* no-op */ }
  }

  /* ---------------- shared row/col builders ---------------- */

  function residentCell(report) {
    return (
      <td>
        <div className="resident">
          <div className="resident-avatar">{initialsOf(report.resident) || report.initials}</div>
          <div>
            <div className="resident-name">{report.resident}</div>
            <div className="resident-block">{report.block || 'Xevera'}</div>
          </div>
        </div>
      </td>
    );
  }

  function viewCell(report, label = 'View') {
    const actionLabel = report.appealStatus === 'under_review' && report.status === 'confirmed' ? 'Review Appeal' : label;
    return (
      <td>
        <button type="button" className="view-btn" onClick={() => openDrawer(report.id)}>
          {actionLabel}
        </button>
      </td>
    );
  }

  function appealCell(report) {
    const info = appealBadge(report);
    return (
      <td>
        <span className={info.className}>{info.label}</span>
      </td>
    );
  }

  /* ---------------- header / stats / filters per tab ---------------- */

  const TAB_META = {
    all: { icon: '⬟', iconClass: 'page-icon all', title: 'All Violations', desc: 'View and manage all Fake Report violations across every status.' },
    'under-review': { icon: '◷', iconClass: 'page-icon', title: 'Under Review', desc: 'Review and investigate Fake Report violations that require admin action.' },
    confirmed: { icon: '✓', iconClass: 'page-icon confirmed', title: 'Confirmed Violations', desc: 'View and manage confirmed violations.' },
    dismissed: { icon: '×', iconClass: 'page-icon dismissed', title: 'Dismissed Violations', desc: 'View violation reports that were reviewed and dismissed by an administrator.' },
  };
  const meta = TAB_META[tab];

  function renderStats() {
    if (tab === 'all') {
      return (
        <div className="stats">
          <div className="stat-card"><div className="stat-icon blue">⬟</div><div><div className="stat-number">{reports.length}</div><div className="stat-title">Total Violations</div><div className="stat-desc">All recorded violations</div></div></div>
          <div className="stat-card"><div className="stat-icon orange">◷</div><div><div className="stat-number">{underReview.length}</div><div className="stat-title">Under Review</div><div className="stat-desc">Awaiting admin action</div></div></div>
          <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{confirmed.length}</div><div className="stat-title">Confirmed</div><div className="stat-desc">Verified violations</div></div></div>
          <div className="stat-card"><div className="stat-icon red">×</div><div><div className="stat-number">{dismissed.length}</div><div className="stat-title">Dismissed</div><div className="stat-desc">Reports dismissed</div></div></div>
        </div>
      );
    }
    if (tab === 'confirmed') {
      return (
        <div className="stats">
          <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{confirmed.length}</div><div className="stat-title">Total Confirmed</div><div className="stat-desc">Confirmed violations</div></div></div>
          <div className="stat-card"><div className="stat-icon orange">⚠</div><div><div className="stat-number">{warnings}</div><div className="stat-title">Administrative Warnings</div><div className="stat-desc">Administrative warnings</div></div></div>
          <div className="stat-card"><div className="stat-icon blue">♙</div><div><div className="stat-number">{majorConfirmed}</div><div className="stat-title">Major Violations</div><div className="stat-desc">Requires attention</div></div></div>
        </div>
      );
    }
    if (tab === 'dismissed') {
      return (
        <div className="stats">
          <div className="stat-card"><div className="stat-icon orange">×</div><div><div className="stat-number">{dismissed.length}</div><div className="stat-title">Total Dismissed</div><div className="stat-desc">Dismissed violations</div></div></div>
          <div className="stat-card"><div className="stat-icon blue">▤</div><div><div className="stat-number">{dismissedToday}</div><div className="stat-title">Dismissed Today</div><div className="stat-desc">Recently reviewed</div></div></div>
          <div className="stat-card"><div className="stat-icon red">⚑</div><div><div className="stat-number">{fakeDismissed}</div><div className="stat-title">Fake Reports</div><div className="stat-desc">Reports dismissed as invalid</div></div></div>
          <div className="stat-card"><div className="stat-icon green">↻</div><div><div className="stat-number">{restored}</div><div className="stat-title">Restored</div><div className="stat-desc">Returned for review</div></div></div>
        </div>
      );
    }
    return (
      <div className="stats">
        <div className="stat-card"><div className="stat-icon orange">▤</div><div><div className="stat-number">{underReview.length}</div><div className="stat-title">Total Under Review</div><div className="stat-desc">Awaiting action</div></div></div>
        <div className="stat-card"><div className="stat-icon red">⚑</div><div><div className="stat-number">{potentialFake}</div><div className="stat-title">Potential Fake Reports</div><div className="stat-desc">Requires verification</div></div></div>
        <div className="stat-card"><div className="stat-icon blue">♙</div><div><div className="stat-number">{confirmed.length}</div><div className="stat-title">Repeat Offenders</div><div className="stat-desc">Previously violated</div></div></div>
        <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{confirmedToday}</div><div className="stat-title">Confirmed Today</div><div className="stat-desc">Successfully reviewed</div></div></div>
      </div>
    );
  }

  function searchField(value, onChange, placeholder) {
    return (
      <div className="field">
        <label>Search</label>
        <div className="control">
          <span aria-hidden="true">🔍</span>
          <input type="text" value={value} onChange={(e) => { onChange(e.target.value); setPageNum(1); }} placeholder={placeholder} />
        </div>
      </div>
    );
  }

  function typeField() {
    return (
      <div className="field">
        <label>Violation Type</label>
        <div className="control">
          <input type="text" className="fixed-type" value="Fake Report" readOnly />
        </div>
      </div>
    );
  }

  function renderFilters() {
    if (tab === 'all') {
      return (
        <div className="filter-box cols-4">
          {searchField(allQ, setAllQ, 'Search report ID, resident, or description...')}
          {typeField()}
          <div className="field">
            <label>Status</label>
            <div className="control">
              <select value={allStatus} onChange={(e) => { setAllStatus(e.target.value); setPageNum(1); }}>
                <option value="">All Statuses</option>
                <option value="under_review">Under Review</option>
                <option value="confirmed">Confirmed</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => showToast('Violation filters applied.')}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { setAllQ(''); setAllStatus(''); setPageNum(1); showToast('Violation filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    if (tab === 'confirmed') {
      return (
        <div className="filter-box">
          {searchField(confirmedQ, setConfirmedQ, 'Search report ID, resident...')}
          {typeField()}
          <div className="field">
            <label>Appeal Status</label>
            <div className="control">
              <select value={confirmedAppeal} onChange={(e) => { setConfirmedAppeal(e.target.value); setPageNum(1); }}>
                <option value="">All Appeals</option>
                <option value="none">No Appeal</option>
                <option value="under_review">Appeal Under Review</option>
                <option value="approved">Appeal Accepted</option>
                <option value="rejected">Appeal Rejected</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Severity</label>
            <div className="control">
              <select value={confirmedSeverity} onChange={(e) => { setConfirmedSeverity(e.target.value); setPageNum(1); }}>
                <option value="">All Severities</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
              </select>
            </div>
          </div>
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => showToast('Violation filters applied.')}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { setConfirmedQ(''); setConfirmedAppeal(''); setConfirmedSeverity(''); setPageNum(1); showToast('Filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    if (tab === 'dismissed') {
      return (
        <div className="filter-box cols-4">
          {searchField(dismissedQ, setDismissedQ, 'Search report ID, resident, or reason...')}
          {typeField()}
          <div className="field">
            <label>Severity</label>
            <div className="control">
              <select value={dismissedSeverity} onChange={(e) => { setDismissedSeverity(e.target.value); setPageNum(1); }}>
                <option value="">All Severities</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
              </select>
            </div>
          </div>
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => showToast('Dismissed filters applied.')}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { setDismissedQ(''); setDismissedSeverity(''); setPageNum(1); showToast('Dismissed filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    return (
      <div className="filter-box cols-4">
        {searchField(reviewQ, setReviewQ, 'Search report ID, resident name, or description...')}
        {typeField()}
        <div className="field">
          <label>Severity</label>
          <div className="control">
            <select value={reviewSeverity} onChange={(e) => { setReviewSeverity(e.target.value); setPageNum(1); }}>
              <option value="">All Severities</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>
          </div>
        </div>
        <div className="filter-buttons">
          <button type="button" className="btn btn-primary" onClick={() => showToast('Under Review filters applied.')}>⚑ Filter</button>
          <button type="button" className="btn btn-light" onClick={() => { setReviewQ(''); setReviewSeverity(''); setPageNum(1); showToast('Filters reset.'); }}>↻ Reset</button>
        </div>
      </div>
    );
  }

  /* ---------------- tables ---------------- */

  function tableHead() {
    if (tab === 'all') {
      return (<tr><th>#</th><th>Report ID</th><th>Resident</th><th>Violation</th><th>Severity</th><th>Status</th><th>Appeal</th><th>Date Submitted</th><th>Actions</th></tr>);
    }
    if (tab === 'confirmed') {
      return (<tr><th>#</th><th>Report ID</th><th>Resident</th><th>Violation</th><th>Severity</th><th>Appeal</th><th>Date Confirmed</th><th>Actions</th></tr>);
    }
    if (tab === 'dismissed') {
      return (<tr><th>#</th><th>Report ID</th><th>Resident</th><th>Violation</th><th>Severity</th><th>Dismissal Reason</th><th>Date Dismissed</th><th>Actions</th></tr>);
    }
    return (<tr><th>#</th><th>Report ID</th><th>Resident</th><th>Violation</th><th>Severity</th><th>Date Submitted</th><th>Actions</th></tr>);
  }

  function tableRow(report, index) {
    const pill = statusPill(report.status);
    const base = (safePage - 1) * PAGE_SIZE + index + 1;
    const idCell = (<td><span className="report-id">{report.id}</span></td>);
    const sevCell = (<td><span className={severityBadge(report.severity)}>{report.severity}</span></td>);
    if (tab === 'all') {
      return (
        <tr key={report.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(report)}
          <td>{report.type}</td>
          {sevCell}
          <td><span className={pill.className}>{pill.label}</span></td>
          {appealCell(report)}
          <td>{report.date}</td>
          {viewCell(report, 'View')}
        </tr>
      );
    }
    if (tab === 'confirmed') {
      return (
        <tr key={report.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(report)}
          <td>{report.type}</td>
          {sevCell}
          {appealCell(report)}
          <td>{report.confirmedAt || report.date}</td>
          {viewCell(report, 'View Details')}
        </tr>
      );
    }
    if (tab === 'dismissed') {
      return (
        <tr key={report.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(report)}
          <td>{report.type}</td>
          {sevCell}
          <td><div className="dismissed-reason">{report.dismissalReason || report.remarks || 'No reason provided'}</div></td>
          <td>{report.dismissedAt || '—'}</td>
          {viewCell(report, 'View Details')}
        </tr>
      );
    }
    return (
      <tr key={report.id}>
        <td>{base}</td>
        {idCell}
        {residentCell(report)}
        <td>{report.type}</td>
        {sevCell}
        <td>{report.date}</td>
        {viewCell(report, 'View Details')}
      </tr>
    );
  }

  const colSpan = tab === 'all' ? 9 : 8;
  const tableTitle = tab === 'all' ? 'All Violations' : tab === 'confirmed' ? 'Confirmed Violations' : tab === 'dismissed' ? 'Dismissed Violations' : 'Under Review Reports';
  const from = activeFiltered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, activeFiltered.length);

  /* ---------------- drawer ---------------- */

  const drawerPenalty = PENALTY_CONFIG[drawerForm.penalty] || PENALTY_CONFIG.warning;
  const drawerPill = drawerReport ? statusPill(drawerReport.status) : null;

  function renderDrawer() {
    return (
      <>
        <div className={`overlay${drawerId ? ' show' : ''}`} onClick={closeDrawer} aria-hidden="true" />
        <aside className={`drawer${drawerId ? ' open' : ''}`} aria-label="Violation details">
          {drawerReport && (
            <>
              <div className="drawer-header">
                <div>
                  <div className="drawer-title">
                    {drawerReport.status === 'confirmed' ? 'Confirmed Violation' : drawerReport.status === 'dismissed' ? 'Dismissed Violation' : 'Review Violation'}
                  </div>
                  <div className="drawer-subtitle">Review the violation details, submitted evidence, and any resident appeal before taking administrative action.</div>
                </div>
                <button type="button" className="close-btn" onClick={closeDrawer} aria-label="Close">×</button>
              </div>
              <div className="drawer-body">
                <div className="report-top">
                  <div className="report-info">
                    <div className="report-icon">▤</div>
                    <div>
                      <div className="report-number">{drawerReport.id}</div>
                      <div className="report-date">Submitted {drawerReport.date}</div>
                    </div>
                  </div>
                  <div className={drawerPill.className}>{drawerPill.label}</div>
                </div>

                <div className="drawer-grid">
                  <div className="detail-card">
                    <div className="detail-heading">Report Information</div>
                    <div className="detail-row"><span className="detail-label">Report ID</span><span className="detail-value">{drawerReport.id}</span></div>
                    <div className="detail-row"><span className="detail-label">Date Submitted</span><span className="detail-value">{drawerReport.date}</span></div>
                    <div className="detail-row"><span className="detail-label">Reported By</span><span className="detail-value">{drawerReport.reportedBy}</span></div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-heading">Resident Information</div>
                    <div className="resident-info">
                      <div className="resident-large">{initialsOf(drawerReport.resident) || drawerReport.initials}</div>
                      <div>
                        <strong>{drawerReport.resident}</strong>
                        <span>{drawerReport.block ? `${drawerReport.block}, Xevera Subdivision` : 'Xevera Subdivision'}</span>
                        <span>{drawerReport.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-heading">Report Description</div>
                    <div className="description">{drawerReport.description}</div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-heading">Evidence ({EVIDENCE_IMAGES.length})</div>
                    <div className="evidence">
                      {EVIDENCE_IMAGES.map((src) => (
                        <button key={src} type="button" className="evidence-image" onClick={() => setImageSrc(src)} aria-label="View evidence">
                          <img src={src} alt="Evidence" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {drawerReport.appealStatus && (
                    <div className="detail-card full">
                      <div className="detail-heading">Resident Appeal</div>
                      <div className="detail-row">
                        <span className="detail-label">Appeal Status</span>
                        <span className={`badge ${drawerReport.appealStatus === 'approved' ? 'badge-green' : drawerReport.appealStatus === 'rejected' ? 'badge-major' : 'badge-warning'}`}>
                          {drawerReport.appealStatus === 'under_review' ? 'Under Review' : drawerReport.appealStatus === 'approved' ? 'Accepted' : drawerReport.appealStatus === 'rejected' ? 'Rejected' : drawerReport.appealStatus}
                        </span>
                      </div>
                      <div className="detail-row"><span className="detail-label">Submitted On</span><span className="detail-value">{drawerReport.appealSubmittedAt || '—'}</span></div>
                      <div className="detail-row"><span className="detail-label">Evidence</span><span className="detail-value">{drawerReport.appealEvidence || '—'}</span></div>
                      <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                        <label>Resident&apos;s Reason</label>
                        <div className="appeal-reason-box">{drawerReport.appealReason || 'No appeal reason was provided.'}</div>
                      </div>
                      {drawerReport.appealReviewedAt && (
                        <div className="detail-row" style={{ marginTop: 8 }}>
                          <span className="detail-label">Decision</span>
                          <span className="detail-value">{drawerReport.appealReviewedBy || 'Super Admin'} • {drawerReport.appealReviewedAt}</span>
                        </div>
                      )}
                      <div className="form-group appeal-admin-note">
                        <label htmlFor="vm-appeal-remarks">Admin Decision Remarks</label>
                        <textarea
                          id="vm-appeal-remarks"
                          className="form-control"
                          placeholder="Enter the reason for accepting or rejecting this appeal..."
                          maxLength={500}
                          value={drawerForm.appealRemarks}
                          disabled={drawerReport.appealStatus !== 'under_review'}
                          onChange={(e) => setFormField('appealRemarks', e.target.value)}
                        />
                      </div>
                      {drawerReport.appealStatus === 'under_review' && (
                        <div className="appeal-actions">
                          <button type="button" className="appeal-approve-btn" onClick={handleAcceptAppeal}>✓ Accept Appeal</button>
                          <button type="button" className="appeal-reject-btn" onClick={handleRejectAppeal}>× Reject Appeal</button>
                        </div>
                      )}
                    </div>
                  )}

                  {drawerReport.status === 'under_review' && (
                    <div className="detail-card full">
                      <div className="detail-heading">Violation Review</div>
                      <div className="form-group">
                        <label htmlFor="vm-violation-type">Violation Type</label>
                        <input id="vm-violation-type" className="form-control" value="Fake Report" readOnly />
                      </div>
                      <div className="form-group">
                        <label htmlFor="vm-severity">Severity</label>
                        <select id="vm-severity" className="form-control" value={drawerForm.severity} onChange={(e) => setFormField('severity', e.target.value)}>
                          <option value="Major">Major</option>
                          <option value="Minor">Minor</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="vm-remarks">Admin Remarks</label>
                        <textarea
                          id="vm-remarks"
                          className="form-control"
                          placeholder="Enter the reason, findings, or review remarks..."
                          maxLength={500}
                          value={drawerForm.remarks}
                          onChange={(e) => setFormField('remarks', e.target.value)}
                        />
                      </div>

                      <div className="penalty-card">
                        <div className="penalty-card-title">Platform Penalty <span className="penalty-no-fee">NO FEE</span></div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label htmlFor="vm-penalty">Penalty Level</label>
                          <select id="vm-penalty" className="form-control" value={drawerForm.penalty} onChange={(e) => setFormField('penalty', e.target.value)}>
                            {PENALTY_ORDER.map((key) => (
                              <option key={key} value={key}>{penaltyOptionLabel(key)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="penalty-summary">
                          <div className="penalty-summary-item"><span className="penalty-summary-label">Duration</span><span className="penalty-summary-value">{penaltyDurationLabel(drawerPenalty.days)}</span></div>
                          <div className="penalty-summary-item"><span className="penalty-summary-label">Start Time</span><span className="penalty-summary-value">8:00 AM</span></div>
                          <div className="penalty-summary-item"><span className="penalty-summary-label">Fee</span><span className="penalty-summary-value">No Fee</span></div>
                          <div className="penalty-summary-item"><span className="penalty-summary-label">Enforcement</span><span className="penalty-summary-value">{drawerPenalty.description}</span></div>
                        </div>
                        <div className="penalty-info-note">
                          All restrictions and suspensions begin at <strong>8:00 AM</strong>. If approved after 8:00 AM, the effective date is the next calendar day at 8:00 AM.
                        </div>
                      </div>

                      <div className="drawer-actions">
                        <button type="button" className="confirm-btn" onClick={handleConfirm}>✓ Confirm Violation</button>
                        <button type="button" className="dismiss-btn" onClick={handleDismiss}>× Dismiss Violation</button>
                      </div>
                    </div>
                  )}

                  {drawerReport.status === 'confirmed' && (
                    <div className="detail-card full">
                      <div className="detail-heading">Penalty Information</div>
                      <div className="detail-row"><span className="detail-label">Penalty</span><span className="detail-value">{drawerReport.penaltyLabel || drawerReport.administrativeAction || 'Warning'}</span></div>
                      <div className="detail-row"><span className="detail-label">Duration</span><span className="detail-value">{penaltyDurationLabel(drawerReport.penaltyDays ?? 0)}</span></div>
                      <div className="detail-row"><span className="detail-label">Start</span><span className="detail-value">{drawerReport.penaltyStartAt ? formatPenaltyDate(drawerReport.penaltyStartAt) : '8:00 AM'}</span></div>
                      <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value" style={{ color: '#078e5a' }}>No Fee</span></div>
                    </div>
                  )}

                  {drawerReport.status === 'dismissed' && (
                    <div className="detail-card full">
                      <div className="detail-heading">Dismissal Information</div>
                      <div className="detail-row"><span className="detail-label">Dismissed On</span><span className="detail-value">{drawerReport.dismissedAt || '—'}</span></div>
                      <div className="detail-row"><span className="detail-label">Dismissed By</span><span className="detail-value">{drawerReport.dismissedBy || 'Super Admin'}</span></div>
                      <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                        <label>Reason for Dismissal</label>
                        <div className="dismissed-reason-box">{drawerReport.dismissalReason || drawerReport.remarks || 'No dismissal reason was provided.'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </>
    );
  }

  /* ---------------- verify section ---------------- */

  function renderVerify() {
    if (!verifyReport) return null;
    const history = verifyHistory(verifyReport);
    const badgeClass = verifyReport.status === 'confirmed' ? 'vr-status confirmed' : verifyReport.status === 'dismissed' ? 'vr-status dismissed' : 'vr-status';
    const badgeLabel = verifyReport.status === 'confirmed' ? '✓ Confirmed' : verifyReport.status === 'dismissed' ? 'Dismissed' : '⌛ Pending Verification';
    const decisions = [
      { id: 'verified', row: 'vr-decision-row green', icon: '✓', title: 'Verify Report', desc: 'Confirm that this report is valid and should proceed.', btn: 'Verify' },
      { id: 'rejected', row: 'vr-decision-row red', icon: '×', title: 'Reject Report', desc: 'Mark this report as invalid, duplicate, or not actionable.', btn: 'Reject' },
      { id: 'fake', row: 'vr-decision-row orange', icon: '⚠', title: 'Flag as Fake', desc: 'Send this report to Violation Reports for further review.', btn: 'Flag Fake' },
    ];
    return (
      <div>
        <div className="vr-header">
          <div className="vr-page-heading">
            <div className="vr-page-icon">✓</div>
            <div>
              <div className="vr-title">Verify Report</div>
              <div className="vr-desc">Review the report details, evidence, and determine if it is valid for further action.</div>
            </div>
          </div>
          <button type="button" className="vr-back" onClick={closeVerify}>‹ &nbsp; Back to Pending Verification</button>
        </div>

        <div className="vr-grid">
          <div>
            <section className="vr-card">
              <div className="vr-card-title"><span>Report Details</span><span className={badgeClass}>{badgeLabel}</span></div>
              <div className="vr-details">
                <div className="vr-detail-grid">
                  <div className="vr-item"><div className="vr-item-icon">▧</div><div><div className="vr-label">Report ID</div><div className="vr-value">{verifyReport.id}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">✉</div><div><div className="vr-label">Description</div><div className="vr-value">{verifyReport.description || 'No description provided.'}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">♙</div><div><div className="vr-label">Submitted By</div><div className="vr-value"><span>{verifyReport.resident}</span><span className="vr-pill">Resident</span></div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">▧</div><div><div className="vr-label">Attachments</div><div className="vr-value">1 photo</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">▤</div><div><div className="vr-label">Category</div><div className="vr-value">{verifyReport.type || '—'}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">◷</div><div><div className="vr-label">Date &amp; Time Submitted</div><div className="vr-value">{verifyReport.date || '—'}</div></div></div>
                </div>
                <div className="vr-note">Maximum of 2 photos may be attached to a report. Video uploads are not allowed.</div>
              </div>
            </section>

            <section className="vr-card vr-decision">
              <div className="vr-card-title">Verification Decision</div>
              <div className="vr-decision-body">
                {decisions.map((d) => (
                  <div key={d.id} className={`${d.row}${verifyDecision === d.id ? ' selected' : ''}`} onClick={() => setVerifyDecision(d.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setVerifyDecision(d.id); }}>
                    <div className="vr-decision-icon">{d.icon}</div>
                    <div className="vr-decision-text"><strong>{d.title}</strong><span>{d.desc}</span></div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setVerifyDecision(d.id); }}>{d.btn}</button>
                  </div>
                ))}
                <div className="vr-notes">
                  <label htmlFor="vm-verify-notes">Verification Notes <span style={{ color: '#8998aa', fontWeight: 500 }}>(optional)</span></label>
                  <textarea id="vm-verify-notes" maxLength={500} placeholder="Add notes about your decision..." value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} />
                  <div className="vr-counter">{verifyNotes.length}/500</div>
                </div>
              </div>
              <div className="vr-footer">
                <button type="button" className="vr-cancel" onClick={() => { setVerifyDecision(''); setVerifyNotes(''); }}>Cancel</button>
                <button type="button" className={`vr-submit${verifyDecision ? ' ready' : ''}`} onClick={submitVerify}>Submit Decision</button>
              </div>
            </section>
          </div>

          <div>
            <section className="vr-card">
              <div className="vr-card-title">Photo Evidence (Maximum 2)</div>
              <div className="vr-evidence-wrap">
                <button type="button" className="vr-evidence-image" onClick={() => setImageSrc(EVIDENCE_IMAGES[0])} aria-label="View evidence">
                  <img src={EVIDENCE_IMAGES[0]} alt="Report evidence" loading="lazy" />
                </button>
              </div>
            </section>

            <section className="vr-card vr-history-card">
              <div className="vr-card-title">Report History</div>
              <div className="vr-history">
                {history.map((item, i) => (
                  <div key={i} className="vr-history-item">
                    <div className="vr-dot">⌛</div>
                    <div>
                      <div className="vr-history-title">{item.title}</div>
                      <div className="vr-history-meta">{item.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- resident view ---------------- */

  function renderResidentView() {
    return (
      <section className={`resident-view${residentId ? ' show' : ''}`} aria-label="Resident violation view">
        {residentReport && (
          <>
            <header className="resident-topbar">
              <div className="resident-logo">✦ XEVERA</div>
              <div className="resident-user">
                <div className="avatar">{initialsOf(residentReport.resident)}</div>
                {residentReport.resident}
              </div>
            </header>
            <div className="resident-content">
              <div className="resident-page-title">My Violation</div>
              <div className="resident-page-subtitle">View the details and administrative status of your confirmed violation.</div>
              <div className="resident-card">
                <div className="resident-card-header">
                  <div>
                    <div className="resident-report-title">Violation Details</div>
                    <div className="resident-report-id">{residentReport.id}</div>
                  </div>
                  <span className="status status-confirmed">Confirmed</span>
                </div>
                <div className="resident-grid">
                  <div className="resident-section">
                    <div className="resident-section-title">Report Information</div>
                    <div className="detail-row"><span className="detail-label">Violation Type</span><span className="detail-value">{residentReport.type}</span></div>
                    <div className="detail-row"><span className="detail-label">Severity</span><span className="detail-value">{residentReport.severity}</span></div>
                    <div className="detail-row"><span className="detail-label">Date Confirmed</span><span className="detail-value">{residentReport.confirmedAt || residentReport.date}</span></div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Evidence</div>
                    <div className="evidence">
                      {EVIDENCE_IMAGES.map((src) => (
                        <button key={src} type="button" className="evidence-image" onClick={() => setImageSrc(src)} aria-label="View evidence">
                          <img src={src} alt="Evidence" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Description</div>
                    <div className="resident-description">{residentReport.description}</div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Violation Information</div>
                    <div className="resident-note">ℹ Please follow the community rules to avoid future violations.</div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Administrative Penalty</div>
                    <div className="detail-row"><span className="detail-label">Penalty</span><span className="detail-value">{residentReport.penaltyLabel || residentReport.administrativeAction || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Duration</span><span className="detail-value">{penaltyDurationLabel(residentReport.penaltyDays ?? 0)}</span></div>
                    <div className="detail-row"><span className="detail-label">Starts</span><span className="detail-value">{residentReport.penaltyStartAt ? formatPenaltyDate(residentReport.penaltyStartAt) : '8:00 AM'}</span></div>
                    <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value" style={{ color: '#078e5a' }}>No Fee</span></div>
                  </div>
                </div>
                <button type="button" className="close-resident" onClick={() => setResidentId(null)}>Back to Resident Portal</button>
              </div>
            </div>
          </>
        )}
      </section>
    );
  }

  /* ---------------- main render ---------------- */

  return (
    <div className="vmgmt">
      {verifyId && verifyReport ? (
        renderVerify()
      ) : (
        <>
          <div className="page-header">
            <div className={meta.iconClass}>{meta.icon}</div>
            <div>
              <div className="page-title">{meta.title}</div>
              <div className="page-description">{meta.desc}</div>
            </div>
          </div>

          {renderStats()}
          {renderFilters()}

          <div className="table-card">
            <div className="table-header">
              <div className="table-title">{tableTitle} ({activeFiltered.length})</div>
              {tab === 'confirmed' && (
                <div className="table-tools">
                  <button type="button" className="btn btn-primary" onClick={openResidentView}>Resident View</button>
                </div>
              )}
              {tab === 'under-review' && activeFiltered.length > 0 && (
                <div className="table-tools">
                  <button type="button" className="btn btn-primary" onClick={() => openVerify(activeFiltered[0].id)}>Verify Oldest Report</button>
                </div>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>{tableHead()}</thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="empty-row">
                        {tab === 'dismissed' ? 'No dismissed violations found.' : 'No violations found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((report, i) => tableRow(report, i))
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <div className="showing">
                {activeFiltered.length === 0 ? 'Showing 0 violations' : `Showing ${from} to ${to} of ${activeFiltered.length} ${activeFiltered.length === 1 ? 'violation' : 'violations'}`}
              </div>
              <div className="pagination">
                <button type="button" className="page-btn" disabled={safePage <= 1} onClick={() => setPageNum(safePage - 1)} aria-label="Previous page">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((n) => (
                  <button key={n} type="button" className={`page-btn${n === safePage ? ' active' : ''}`} onClick={() => setPageNum(n)}>{n}</button>
                ))}
                <button type="button" className="page-btn" disabled={safePage >= totalPages} onClick={() => setPageNum(safePage + 1)} aria-label="Next page">›</button>
              </div>
            </div>
          </div>
        </>
      )}

      {renderDrawer()}
      {renderResidentView()}

      <div className={`image-modal${imageSrc ? ' show' : ''}`} onClick={() => setImageSrc(null)} aria-hidden="true">
        {imageSrc && <img src={imageSrc} alt="Evidence" onClick={(e) => e.stopPropagation()} />}
        <button type="button" className="close-image" onClick={() => setImageSrc(null)} aria-label="Close image">×</button>
      </div>

      <div className={`toast${toast ? ` show ${toast.kind}` : ''}`} role="status">
        {toast ? toast.message : ''}
      </div>
    </div>
  );
}
