import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './violationMgmt/ViolationManagement.css';
import {
  PENALTY_CONFIG,
  PENALTY_ORDER,
  formatPenaltyDate,
  formatDateTime,
  penaltyDurationLabel,
  deriveSeverity,
  deriveAppeal,
  initialsOf,
  normalizeTab,
} from './violationMgmt/penaltyData';

const PAGE_SIZE = 8;
const CLIENT_LIMIT = 50;

const API_STATUS = {
  all: 'All',
  'under-review': 'Under Review',
  confirmed: 'Confirmed',
  dismissed: 'Dismissed',
};

function statusPill(violationStatus) {
  if (violationStatus === 'Confirmed') return { label: 'Confirmed', className: 'status status-confirmed' };
  if (violationStatus === 'Dismissed') return { label: 'Dismissed', className: 'status status-dismissed' };
  if (violationStatus === 'Appealed') return { label: 'Appealed', className: 'status status-review' };
  return { label: 'Under Review', className: 'status status-review' };
}

function appealBadge(appeal) {
  if (appeal === 'Pending Appeal') return { label: '⚠ Under Review', className: 'appeal-indicator' };
  if (appeal === 'Overturned') return { label: '✓ Accepted', className: 'appeal-indicator approved' };
  if (appeal === 'Upheld') return { label: '× Rejected', className: 'appeal-indicator rejected' };
  return { label: 'No Appeal', className: 'appeal-empty' };
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

function defaultPenaltyFor(severity) {
  return severity === 'Major' ? 'reporting_restriction' : 'warning';
}

function photoSrc(path) {
  if (!path) return null;
  try {
    return uploadUrl(path);
  } catch {
    return null;
  }
}

export default function ViolationManagementPage({ initialTab = 'under-review', onNavigate }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => normalizeTab(initialTab));

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters (shared, reset whenever the tab changes)
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [appealFilter, setAppealFilter] = useState('All');
  const [pageNum, setPageNum] = useState(1);

  // Drawer / verify / resident view / modals / toast
  const [drawerItem, setDrawerItem] = useState(null);
  const [drawerForm, setDrawerForm] = useState({ severity: 'Major', remarks: '', penalty: 'warning', appealRemarks: '' });
  const [busy, setBusy] = useState(false);
  const [verifyItem, setVerifyItem] = useState(null);
  const [verifyDecision, setVerifyDecision] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [residentItem, setResidentItem] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const pendingDrawerRef = useRef(null);

  const actorName = user?.name || 'Admin';

  // Follow the sidebar submenu tab (App drives initialTab from the URL).
  useEffect(() => {
    setTab(normalizeTab(initialTab));
    setSearch('');
    setSeverityFilter('All');
    setAppealFilter('All');
    setPageNum(1);
    setDrawerItem(null);
    setVerifyItem(null);
    setResidentItem(null);
  }, [initialTab]);

  function showToast(message, kind = 'success') {
    try { clearTimeout(toastTimer.current); } catch { /* no-op */ }
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  const clientFilteredTab = tab === 'under-review' || tab === 'confirmed';

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const p = new URLSearchParams({
        status: API_STATUS[tab],
        page: String(clientFilteredTab ? 1 : pageNum),
        limit: String(clientFilteredTab ? CLIENT_LIMIT : PAGE_SIZE),
      });
      if (search.trim()) p.set('search', search.trim());
      if (tab === 'confirmed' && severityFilter !== 'All') p.set('severity', severityFilter);
      const data = await apiFetch('reports/flagged.php?' + p.toString());
      let rows = Array.isArray(data.items) ? data.items : [];
      if (tab === 'under-review' && severityFilter !== 'All') {
        rows = rows.filter((r) => deriveSeverity(r) === severityFilter);
      }
      if (tab === 'confirmed' && appealFilter !== 'All') {
        rows = rows.filter((r) => deriveAppeal(r) === appealFilter);
      }
      setItems(rows);
      setStats(data.stats || {});
      if (clientFilteredTab) {
        setTotal(rows.length);
        setTotalPages(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
      } else {
        setTotal(Number(data.total) || 0);
        setTotalPages(Math.max(1, Number(data.total_pages) || 1));
      }
    } catch {
      setLoadError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, pageNum, search, severityFilter, appealFilter, clientFilteredTab]);

  useEffect(() => { load(); }, [load]);

  // Open a drawer that was requested before the list finished reloading
  // (e.g. flag-as-fake from the verify overlay).
  useEffect(() => {
    if (pendingDrawerRef.current && items.length > 0) {
      const refId = pendingDrawerRef.current;
      const found = items.find((r) => r.id === refId);
      if (found) {
        openDrawer(found);
        pendingDrawerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Lock body scroll when an overlay is open.
  useEffect(() => {
    const locked = drawerItem !== null || residentItem !== null;
    try {
      document.body.style.overflow = locked ? 'hidden' : '';
    } catch { /* no-op */ }
    return () => {
      try { document.body.style.overflow = ''; } catch { /* no-op */ }
    };
  }, [drawerItem, residentItem]);

  // Escape closes the topmost layer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (imageSrc) setImageSrc(null);
      else if (residentItem) setResidentItem(null);
      else if (drawerItem) setDrawerItem(null);
      else if (verifyItem) { setVerifyItem(null); setVerifyDecision(''); setVerifyNotes(''); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imageSrc, residentItem, drawerItem, verifyItem]);

  function goTab(nextTab) {
    if (typeof onNavigate === 'function') {
      onNavigate(`violation-management/${nextTab}`);
    } else {
      setTab(normalizeTab(nextTab));
      setPageNum(1);
    }
  }

  const safePage = Math.min(pageNum, totalPages);
  const pageRows = clientFilteredTab
    ? items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : items;

  /* ---------------- statistics ---------------- */

  const s = {
    total: Number(stats.total) || 0,
    under_review: Number(stats.under_review) || 0,
    confirmed: Number(stats.confirmed) || 0,
    dismissed: Number(stats.dismissed) || 0,
    fake_reports: Number(stats.fake_reports) || 0,
    repeat_offenders: Number(stats.repeat_offenders) || 0,
    reopened: Number(stats.reopened) || 0,
    warnings: Number(stats.warnings) || 0,
    major_confirmed: Number(stats.major_confirmed) || 0,
    confirmed_today: Number(stats.confirmed_today) || 0,
    dismissed_today: Number(stats.dismissed_today) || 0,
  };

  /* ---------------- drawer actions ---------------- */

  function openDrawer(item) {
    const sev = deriveSeverity(item);
    setDrawerForm({
      severity: sev,
      remarks: '',
      penalty: defaultPenaltyFor(sev),
      appealRemarks: '',
    });
    setDrawerItem(item);
  }

  function closeDrawer() {
    setDrawerItem(null);
  }

  function setFormField(field, value) {
    setDrawerForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleConfirm() {
    if (!drawerItem || busy) return;
    const { severity, remarks, penalty } = drawerForm;
    if (!String(remarks || '').trim()) {
      showToast('Please enter admin remarks before confirming.', 'error');
      return;
    }
    if (!penalty || !PENALTY_CONFIG[penalty]) {
      showToast('Please select a valid penalty.', 'error');
      return;
    }
    setBusy(true);
    try {
      const reason = `${drawerItem.suspicion_reason || 'Report flagged as suspicious'} | Admin remarks: ${remarks.trim()} (by ${actorName})`;
      const resp = await apiFetch('violations/create.php', {
        method: 'POST',
        body: {
          report_id: drawerItem.db_id,
          violation_type: 'Fake Report',
          severity,
          reason,
          penalty_key: penalty,
        },
      });
      const p = resp && resp.penalty ? resp.penalty : null;
      const schedText = p && p.start
        ? ` Starts ${formatPenaltyDate(p.start)}${p.end ? ` until ${formatPenaltyDate(p.end)}` : ''}.`
        : '';
      showToast(`${drawerItem.id} confirmed. ${p ? p.type : PENALTY_CONFIG[penalty].label} applied — No Fee.${schedText}`, 'success');
      closeDrawer();
      await load();
      goTab('confirmed');
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to confirm violation.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    if (!drawerItem || busy) return;
    const remarks = String(drawerForm.remarks || '').trim();
    if (!remarks) {
      showToast('Please enter the reason for dismissal.', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: {
          id: drawerItem.db_id,
          is_suspicious: 0,
          staff_notes: `${remarks} (Dismissed by ${actorName})`,
        },
      });
      showToast(`${drawerItem.id} has been dismissed.`, 'success');
      closeDrawer();
      await load();
      goTab('dismissed');
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to dismiss.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptAppeal() {
    if (!drawerItem || !drawerItem.violation_id || busy) {
      if (!drawerItem || !drawerItem.violation_id) showToast('No violation record found for this report.', 'error');
      return;
    }
    const remarks = String(drawerForm.appealRemarks || '').trim();
    if (!remarks) {
      showToast('Please enter admin remarks before accepting the appeal.', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('violations/update.php', {
        method: 'POST',
        body: { id: drawerItem.violation_id, action: 'accept_appeal', note: `${remarks} (by ${actorName})` },
      });
      showToast(`${drawerItem.id} appeal accepted. The violation has been dismissed.`, 'success');
      closeDrawer();
      await load();
      goTab('dismissed');
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to process appeal.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectAppeal() {
    if (!drawerItem || !drawerItem.violation_id || busy) {
      if (!drawerItem || !drawerItem.violation_id) showToast('No violation record found for this report.', 'error');
      return;
    }
    const remarks = String(drawerForm.appealRemarks || '').trim();
    if (!remarks) {
      showToast('Please enter admin remarks before rejecting the appeal.', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('violations/update.php', {
        method: 'POST',
        body: { id: drawerItem.violation_id, action: 'reject_appeal', note: `${remarks} (by ${actorName})` },
      });
      showToast(`${drawerItem.id} appeal rejected. The violation remains confirmed.`, 'success');
      closeDrawer();
      await load();
      goTab('confirmed');
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to process appeal.', 'error');
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- verify flow ---------------- */

  async function openVerifyOldest() {
    setVerifyBusy(true);
    try {
      const data = await apiFetch('reports/list.php?staff=true&status=Pending&limit=10');
      const list = Array.isArray(data.items) ? data.items : [];
      if (list.length === 0) {
        showToast('No pending reports waiting for verification.', 'error');
        return;
      }
      const oldest = list[list.length - 1] || list[0];
      setVerifyItem(oldest);
      setVerifyDecision('');
      setVerifyNotes('');
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch { /* no-op */ }
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to load pending reports.', 'error');
    } finally {
      setVerifyBusy(false);
    }
  }

  function closeVerify() {
    setVerifyItem(null);
    setVerifyDecision('');
    setVerifyNotes('');
  }

  async function submitVerify() {
    if (!verifyItem || verifyBusy) return;
    if (!verifyDecision) {
      showToast('Please choose a verification decision first.', 'error');
      return;
    }
    const notes = String(verifyNotes || '').trim();
    const refId = verifyItem.id;
    setVerifyBusy(true);
    try {
      if (verifyDecision === 'verified') {
        await apiFetch('reports/update.php', { method: 'POST', body: { id: refId, status: 'Verified' } });
        showToast(`${refId} has been verified successfully.`, 'success');
        closeVerify();
        await load();
        goTab('confirmed');
        return;
      }
      if (verifyDecision === 'rejected') {
        if (!notes) {
          showToast('Please enter a reason for rejecting the report.', 'error');
          return;
        }
        await apiFetch('reports/update.php', { method: 'POST', body: { id: refId, status: 'Rejected', rejection_reason: notes } });
        showToast(`${refId} has been rejected.`, 'success');
        closeVerify();
        await load();
        goTab('dismissed');
        return;
      }
      // Flag as fake -> lands in the Under Review queue, then open its drawer
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: refId, flag_fake: 1, flag_reason: notes || 'Flagged as fake during verification' },
      });
      showToast(`${refId} was sent to Violation Reports → Under Review.`, 'success');
      closeVerify();
      pendingDrawerRef.current = refId;
      await load();
      goTab('under-review');
    } catch (e) {
      showToast(e && e.message ? e.message : 'Verification failed.', 'error');
    } finally {
      setVerifyBusy(false);
    }
  }

  function verifyHistory() {
    if (!verifyItem) return [];
    return [
      {
        title: 'Submitted → Pending',
        meta: `${formatDateTime(verifyItem.created_at, verifyItem.date || 'Submitted')} · by ${verifyItem.reporter_name || verifyItem.reporter || 'Resident'} · Awaiting verification`,
      },
    ];
  }

  /* ---------------- resident view ---------------- */

  async function openResidentView() {
    try {
      const data = await apiFetch('reports/flagged.php?status=Confirmed&page=1&limit=1');
      const first = data && Array.isArray(data.items) && data.items[0] ? data.items[0] : null;
      if (!first) {
        showToast('No confirmed violation is available yet.', 'error');
        return;
      }
      setResidentItem(first);
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch { /* no-op */ }
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to load confirmed violations.', 'error');
    }
  }

  /* ---------------- shared builders ---------------- */

  function residentCell(item) {
    return (
      <td>
        <div className="resident">
          <div className="resident-avatar">{initialsOf(item.reporter_name) || 'R'}</div>
          <div>
            <div className="resident-name">{item.reporter_name || 'Anonymous'}</div>
            <div className="resident-block">{item.reporter_address || 'Xevera'}</div>
          </div>
        </div>
      </td>
    );
  }

  function viewCell(item, label = 'View') {
    const actionLabel = item.violation_status === 'Appealed' && tab === 'confirmed' ? 'Review Appeal' : label;
    return (
      <td>
        <button type="button" className="view-btn" onClick={() => openDrawer(item)}>
          {actionLabel}
        </button>
      </td>
    );
  }

  function appealCell(item) {
    const info = appealBadge(deriveAppeal(item));
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
          <div className="stat-card"><div className="stat-icon blue">⬟</div><div><div className="stat-number">{s.total}</div><div className="stat-title">Total Violations</div><div className="stat-desc">All recorded violations</div></div></div>
          <div className="stat-card"><div className="stat-icon orange">◷</div><div><div className="stat-number">{s.under_review}</div><div className="stat-title">Under Review</div><div className="stat-desc">Awaiting admin action</div></div></div>
          <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{s.confirmed}</div><div className="stat-title">Confirmed</div><div className="stat-desc">Verified violations</div></div></div>
          <div className="stat-card"><div className="stat-icon red">×</div><div><div className="stat-number">{s.dismissed}</div><div className="stat-title">Dismissed</div><div className="stat-desc">Reports dismissed</div></div></div>
        </div>
      );
    }
    if (tab === 'confirmed') {
      return (
        <div className="stats">
          <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{s.confirmed}</div><div className="stat-title">Total Confirmed</div><div className="stat-desc">Confirmed violations</div></div></div>
          <div className="stat-card"><div className="stat-icon orange">⚠</div><div><div className="stat-number">{s.warnings}</div><div className="stat-title">Administrative Warnings</div><div className="stat-desc">Administrative warnings</div></div></div>
          <div className="stat-card"><div className="stat-icon blue">♙</div><div><div className="stat-number">{s.major_confirmed}</div><div className="stat-title">Major Violations</div><div className="stat-desc">Requires attention</div></div></div>
        </div>
      );
    }
    if (tab === 'dismissed') {
      return (
        <div className="stats">
          <div className="stat-card"><div className="stat-icon orange">×</div><div><div className="stat-number">{s.dismissed}</div><div className="stat-title">Total Dismissed</div><div className="stat-desc">Dismissed violations</div></div></div>
          <div className="stat-card"><div className="stat-icon blue">▤</div><div><div className="stat-number">{s.dismissed_today}</div><div className="stat-title">Dismissed Today</div><div className="stat-desc">Recently reviewed</div></div></div>
          <div className="stat-card"><div className="stat-icon red">⚑</div><div><div className="stat-number">{s.dismissed}</div><div className="stat-title">Fake Reports</div><div className="stat-desc">Reports dismissed as invalid</div></div></div>
          <div className="stat-card"><div className="stat-icon green">↻</div><div><div className="stat-number">{s.reopened}</div><div className="stat-title">Restored</div><div className="stat-desc">Returned for review</div></div></div>
        </div>
      );
    }
    return (
      <div className="stats">
        <div className="stat-card"><div className="stat-icon orange">▤</div><div><div className="stat-number">{s.under_review}</div><div className="stat-title">Total Under Review</div><div className="stat-desc">Awaiting action</div></div></div>
        <div className="stat-card"><div className="stat-icon red">⚑</div><div><div className="stat-number">{s.fake_reports}</div><div className="stat-title">Potential Fake Reports</div><div className="stat-desc">Requires verification</div></div></div>
        <div className="stat-card"><div className="stat-icon blue">♙</div><div><div className="stat-number">{s.repeat_offenders}</div><div className="stat-title">Repeat Offenders</div><div className="stat-desc">Previously violated</div></div></div>
        <div className="stat-card"><div className="stat-icon green">✓</div><div><div className="stat-number">{s.confirmed_today}</div><div className="stat-title">Confirmed Today</div><div className="stat-desc">Successfully reviewed</div></div></div>
      </div>
    );
  }

  function searchField(placeholder) {
    return (
      <div className="field">
        <label>Search</label>
        <div className="control">
          <span aria-hidden="true">🔍</span>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPageNum(1); }} placeholder={placeholder} />
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

  function severityField() {
    return (
      <div className="field">
        <label>Severity</label>
        <div className="control">
          <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPageNum(1); }}>
            <option value="All">All Severities</option>
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
          </select>
        </div>
      </div>
    );
  }

  function resetFilters() {
    setSearch('');
    setSeverityFilter('All');
    setAppealFilter('All');
    setPageNum(1);
  }

  function renderFilters() {
    if (tab === 'all') {
      return (
        <div className="filter-box cols-3">
          {searchField('Search report ID, resident, or description...')}
          {typeField()}
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => { setPageNum(1); load(); }}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { resetFilters(); showToast('Violation filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    if (tab === 'confirmed') {
      return (
        <div className="filter-box">
          {searchField('Search report ID, resident...')}
          {typeField()}
          <div className="field">
            <label>Appeal Status</label>
            <div className="control">
              <select value={appealFilter} onChange={(e) => { setAppealFilter(e.target.value); setPageNum(1); }}>
                <option value="All">All Appeals</option>
                <option value="No Appeal">No Appeal</option>
                <option value="Pending Appeal">Appeal Under Review</option>
                <option value="Overturned">Appeal Accepted</option>
                <option value="Upheld">Appeal Rejected</option>
              </select>
            </div>
          </div>
          {severityField()}
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => { setPageNum(1); load(); }}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { resetFilters(); showToast('Filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    if (tab === 'dismissed') {
      return (
        <div className="filter-box cols-4">
          {searchField('Search report ID, resident, or reason...')}
          {typeField()}
          {severityField()}
          <div className="filter-buttons">
            <button type="button" className="btn btn-primary" onClick={() => { setPageNum(1); load(); }}>⚑ Filter</button>
            <button type="button" className="btn btn-light" onClick={() => { resetFilters(); showToast('Dismissed filters reset.'); }}>↻ Reset</button>
          </div>
        </div>
      );
    }
    return (
      <div className="filter-box cols-4">
        {searchField('Search report ID, resident name, or description...')}
        {typeField()}
        {severityField()}
        <div className="filter-buttons">
          <button type="button" className="btn btn-primary" onClick={() => { setPageNum(1); load(); }}>⚑ Filter</button>
          <button type="button" className="btn btn-light" onClick={() => { resetFilters(); showToast('Filters reset.'); }}>↻ Reset</button>
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

  function tableRow(item, index) {
    const pill = statusPill(item.violation_status);
    const sev = deriveSeverity(item);
    const base = (safePage - 1) * PAGE_SIZE + index + 1;
    const idCell = (<td><span className="report-id">{item.id}</span></td>);
    const sevCell = (<td><span className={severityBadge(sev)}>{sev}</span></td>);
    const violationLabel = item.violation_type || 'Fake Report';
    if (tab === 'all') {
      return (
        <tr key={item.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(item)}
          <td>{violationLabel}</td>
          {sevCell}
          <td><span className={pill.className}>{pill.label}</span></td>
          {appealCell(item)}
          <td>{formatDateTime(item.created_at, item.date)}</td>
          {viewCell(item, 'View')}
        </tr>
      );
    }
    if (tab === 'confirmed') {
      return (
        <tr key={item.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(item)}
          <td>{violationLabel}</td>
          {sevCell}
          {appealCell(item)}
          <td>{formatDateTime(item.violation_created_at, item.date)}</td>
          {viewCell(item, 'View Details')}
        </tr>
      );
    }
    if (tab === 'dismissed') {
      return (
        <tr key={item.id}>
          <td>{base}</td>
          {idCell}
          {residentCell(item)}
          <td>{violationLabel}</td>
          {sevCell}
          <td><div className="dismissed-reason">{item.dismissal_note || item.suspicion_reason || item.violation_reason || 'No reason provided'}</div></td>
          <td>{formatDateTime(item.updated_at, item.date)}</td>
          {viewCell(item, 'View Details')}
        </tr>
      );
    }
    return (
      <tr key={item.id}>
        <td>{base}</td>
        {idCell}
        {residentCell(item)}
        <td>{violationLabel}</td>
        {sevCell}
        <td>{formatDateTime(item.created_at, item.date)}</td>
        {viewCell(item, 'View Details')}
      </tr>
    );
  }

  const colSpan = tab === 'all' ? 9 : 8;
  const tableTitle = tab === 'all' ? 'All Violations' : tab === 'confirmed' ? 'Confirmed Violations' : tab === 'dismissed' ? 'Dismissed Violations' : 'Under Review Reports';
  const rowCount = clientFilteredTab ? total : pageRows.length;
  const from = rowCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = clientFilteredTab ? Math.min(safePage * PAGE_SIZE, total) : pageRows.length;

  /* ---------------- drawer ---------------- */

  const drawerPenalty = PENALTY_CONFIG[drawerForm.penalty] || PENALTY_CONFIG.warning;
  const drawerPill = drawerItem ? statusPill(drawerItem.violation_status) : null;
  const drawerAppeal = drawerItem ? deriveAppeal(drawerItem) : 'No Appeal';
  const drawerPhotos = drawerItem && Array.isArray(drawerItem.photos) ? drawerItem.photos.map(photoSrc).filter(Boolean) : [];

  function penaltyDurationFor(item) {
    if (!item) return 'Admin Review';
    if (item.penalty_type === 'Permanent Restriction') return 'Admin Review';
    if (item.penalty_type === 'Warning') return '0 days';
    if (item.restriction_days) return penaltyDurationLabel(item.restriction_days);
    return item.penalty_type || '—';
  }

  function renderDrawer() {
    return (
      <>
        <div className={`overlay${drawerItem ? ' show' : ''}`} onClick={closeDrawer} aria-hidden="true" />
        <aside className={`drawer${drawerItem ? ' open' : ''}`} aria-label="Violation details">
          {drawerItem && (
            <>
              <div className="drawer-header">
                <div>
                  <div className="drawer-title">
                    {drawerItem.violation_status === 'Confirmed' || drawerItem.violation_status === 'Appealed' ? 'Confirmed Violation' : drawerItem.violation_status === 'Dismissed' ? 'Dismissed Violation' : 'Review Violation'}
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
                      <div className="report-number">{drawerItem.id}</div>
                      <div className="report-date">Submitted {formatDateTime(drawerItem.created_at, drawerItem.date)}</div>
                    </div>
                  </div>
                  <div className={drawerPill.className}>{drawerPill.label}</div>
                </div>

                <div className="drawer-grid">
                  <div className="detail-card">
                    <div className="detail-heading">Report Information</div>
                    <div className="detail-row"><span className="detail-label">Report ID</span><span className="detail-value">{drawerItem.id}</span></div>
                    <div className="detail-row"><span className="detail-label">Date Submitted</span><span className="detail-value">{formatDateTime(drawerItem.created_at, drawerItem.date)}</span></div>
                    <div className="detail-row"><span className="detail-label">Reported By</span><span className="detail-value">Resident</span></div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-heading">Resident Information</div>
                    <div className="resident-info">
                      <div className="resident-large">{initialsOf(drawerItem.reporter_name) || 'R'}</div>
                      <div>
                        <strong>{drawerItem.reporter_name || 'Anonymous'}</strong>
                        <span>{drawerItem.reporter_address ? `${drawerItem.reporter_address}, Xevera Subdivision` : 'Xevera Subdivision'}</span>
                        <span>{drawerItem.reporter_phone || drawerItem.reporter_email || ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-heading">Report Description</div>
                    <div className="description">{drawerItem.description || 'No description provided.'}</div>
                  </div>

                  <div className="detail-card full">
                    <div className="detail-heading">Evidence ({drawerPhotos.length})</div>
                    {drawerPhotos.length > 0 ? (
                      <div className="evidence">
                        {drawerPhotos.map((src) => (
                          <button key={src} type="button" className="evidence-image" onClick={() => setImageSrc(src)} aria-label="View evidence">
                            <img src={src} alt="Evidence" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="description">No photo evidence attached to this report.</div>
                    )}
                  </div>

                  {drawerItem.appeal_reason && (
                    <div className="detail-card full">
                      <div className="detail-heading">Resident Appeal</div>
                      <div className="detail-row">
                        <span className="detail-label">Appeal Status</span>
                        <span className={`badge ${drawerAppeal === 'Overturned' ? 'badge-green' : drawerAppeal === 'Upheld' ? 'badge-major' : 'badge-warning'}`}>
                          {drawerAppeal === 'Pending Appeal' ? 'Under Review' : drawerAppeal === 'Overturned' ? 'Accepted' : drawerAppeal === 'Upheld' ? 'Rejected' : drawerAppeal}
                        </span>
                      </div>
                      <div className="detail-row"><span className="detail-label">Submitted On</span><span className="detail-value">{formatDateTime(drawerItem.appeal_date)}</span></div>
                      <div className="detail-row"><span className="detail-label">Evidence</span><span className="detail-value">—</span></div>
                      <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                        <label>Resident&apos;s Reason</label>
                        <div className="appeal-reason-box">{drawerItem.appeal_reason || 'No appeal reason was provided.'}</div>
                      </div>
                      {drawerItem.appeal_outcome && (
                        <div className="detail-row" style={{ marginTop: 8 }}>
                          <span className="detail-label">Decision</span>
                          <span className="detail-value">{drawerItem.appeal_outcome}{drawerItem.confirmed_by ? ` • ${drawerItem.confirmed_by}` : ''}</span>
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
                          disabled={drawerAppeal !== 'Pending Appeal' || busy}
                          onChange={(e) => setFormField('appealRemarks', e.target.value)}
                        />
                      </div>
                      {drawerAppeal === 'Pending Appeal' && (
                        <div className="appeal-actions">
                          <button type="button" className="appeal-approve-btn" disabled={busy} onClick={handleAcceptAppeal}>✓ Accept Appeal</button>
                          <button type="button" className="appeal-reject-btn" disabled={busy} onClick={handleRejectAppeal}>× Reject Appeal</button>
                        </div>
                      )}
                    </div>
                  )}

                  {drawerItem.violation_status !== 'Confirmed' && drawerItem.violation_status !== 'Appealed' && drawerItem.violation_status !== 'Dismissed' && (
                    <div className="detail-card full">
                      <div className="detail-heading">Violation Review</div>
                      <div className="form-group">
                        <label htmlFor="vm-violation-type">Violation Type</label>
                        <input id="vm-violation-type" className="form-control" value="Fake Report" readOnly />
                      </div>
                      <div className="form-group">
                        <label htmlFor="vm-severity">Severity</label>
                        <select id="vm-severity" className="form-control" value={drawerForm.severity} disabled={busy} onChange={(e) => { setFormField('severity', e.target.value); setFormField('penalty', defaultPenaltyFor(e.target.value)); }}>
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
                          disabled={busy}
                          onChange={(e) => setFormField('remarks', e.target.value)}
                        />
                      </div>

                      <div className="penalty-card">
                        <div className="penalty-card-title">Platform Penalty <span className="penalty-no-fee">NO FEE</span></div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label htmlFor="vm-penalty">Penalty Level</label>
                          <select id="vm-penalty" className="form-control" value={drawerForm.penalty} disabled={busy} onChange={(e) => setFormField('penalty', e.target.value)}>
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
                        <button type="button" className="confirm-btn" disabled={busy} onClick={handleConfirm}>{busy ? 'Working…' : '✓ Confirm Violation'}</button>
                        <button type="button" className="dismiss-btn" disabled={busy} onClick={handleDismiss}>{busy ? 'Working…' : '× Dismiss Violation'}</button>
                      </div>
                    </div>
                  )}

                  {(drawerItem.violation_status === 'Confirmed' || drawerItem.violation_status === 'Appealed') && (
                    <div className="detail-card full">
                      <div className="detail-heading">Penalty Information</div>
                      <div className="detail-row"><span className="detail-label">Penalty</span><span className="detail-value">{drawerItem.penalty_type || drawerItem.violation_type || 'Warning'}</span></div>
                      <div className="detail-row"><span className="detail-label">Duration</span><span className="detail-value">{penaltyDurationFor(drawerItem)}</span></div>
                      <div className="detail-row"><span className="detail-label">Start</span><span className="detail-value">{drawerItem.penalty_start_at ? formatPenaltyDate(drawerItem.penalty_start_at) : '8:00 AM'}</span></div>
                      <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value" style={{ color: '#078e5a' }}>No Fee</span></div>
                    </div>
                  )}

                  {drawerItem.violation_status === 'Dismissed' && (
                    <div className="detail-card full">
                      <div className="detail-heading">Dismissal Information</div>
                      <div className="detail-row"><span className="detail-label">Dismissed On</span><span className="detail-value">{formatDateTime(drawerItem.updated_at, drawerItem.date)}</span></div>
                      <div className="detail-row"><span className="detail-label">Dismissed By</span><span className="detail-value">{drawerItem.confirmed_by || 'Admin'}</span></div>
                      <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                        <label>Reason for Dismissal</label>
                        <div className="dismissed-reason-box">{drawerItem.dismissal_note || drawerItem.suspicion_reason || drawerItem.violation_reason || 'No dismissal reason was provided.'}</div>
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
    if (!verifyItem) return null;
    const history = verifyHistory();
    const vPhotos = Array.isArray(verifyItem.photos) ? verifyItem.photos.map(photoSrc).filter(Boolean) : [];
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
          <button type="button" className="vr-back" onClick={closeVerify} disabled={verifyBusy}>‹ &nbsp; Back to Pending Verification</button>
        </div>

        <div className="vr-grid">
          <div>
            <section className="vr-card">
              <div className="vr-card-title"><span>Report Details</span><span className="vr-status">⌛ Pending Verification</span></div>
              <div className="vr-details">
                <div className="vr-detail-grid">
                  <div className="vr-item"><div className="vr-item-icon">▧</div><div><div className="vr-label">Report ID</div><div className="vr-value">{verifyItem.id}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">✉</div><div><div className="vr-label">Description</div><div className="vr-value">{verifyItem.description || verifyItem.desc || 'No description provided.'}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">♙</div><div><div className="vr-label">Submitted By</div><div className="vr-value"><span>{verifyItem.reporter_name || verifyItem.reporter || 'Resident'}</span><span className="vr-pill">Resident</span></div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">▧</div><div><div className="vr-label">Attachments</div><div className="vr-value">{vPhotos.length > 0 ? `${vPhotos.length} photo${vPhotos.length === 1 ? '' : 's'}` : 'No photos'}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">▤</div><div><div className="vr-label">Category</div><div className="vr-value">{verifyItem.category || '—'}</div></div></div>
                  <div className="vr-item"><div className="vr-item-icon">◷</div><div><div className="vr-label">Date &amp; Time Submitted</div><div className="vr-value">{formatDateTime(verifyItem.created_at, verifyItem.date)}</div></div></div>
                </div>
                <div className="vr-note">Maximum of 2 photos may be attached to a report. Video uploads are not allowed.</div>
              </div>
            </section>

            <section className="vr-card vr-decision">
              <div className="vr-card-title">Verification Decision</div>
              <div className="vr-decision-body">
                {decisions.map((d) => (
                  <div key={d.id} className={`${d.row}${verifyDecision === d.id ? ' selected' : ''}`} onClick={() => !verifyBusy && setVerifyDecision(d.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && !verifyBusy) setVerifyDecision(d.id); }}>
                    <div className="vr-decision-icon">{d.icon}</div>
                    <div className="vr-decision-text"><strong>{d.title}</strong><span>{d.desc}</span></div>
                    <button type="button" disabled={verifyBusy} onClick={(e) => { e.stopPropagation(); setVerifyDecision(d.id); }}>{d.btn}</button>
                  </div>
                ))}
                <div className="vr-notes">
                  <label htmlFor="vm-verify-notes">Verification Notes <span style={{ color: '#8998aa', fontWeight: 500 }}>(optional)</span></label>
                  <textarea id="vm-verify-notes" maxLength={500} placeholder="Add notes about your decision..." value={verifyNotes} disabled={verifyBusy} onChange={(e) => setVerifyNotes(e.target.value)} />
                  <div className="vr-counter">{verifyNotes.length}/500</div>
                </div>
              </div>
              <div className="vr-footer">
                <button type="button" className="vr-cancel" disabled={verifyBusy} onClick={() => { setVerifyDecision(''); setVerifyNotes(''); }}>Cancel</button>
                <button type="button" className={`vr-submit${verifyDecision ? ' ready' : ''}`} disabled={verifyBusy} onClick={submitVerify}>{verifyBusy ? 'Submitting…' : 'Submit Decision'}</button>
              </div>
            </section>
          </div>

          <div>
            <section className="vr-card">
              <div className="vr-card-title">Photo Evidence (Maximum 2)</div>
              <div className="vr-evidence-wrap">
                {vPhotos.length > 0 ? (
                  <button type="button" className="vr-evidence-image" onClick={() => setImageSrc(vPhotos[0])} aria-label="View evidence">
                    <img src={vPhotos[0]} alt="Report evidence" loading="lazy" />
                  </button>
                ) : (
                  <div className="vr-note">No photo evidence attached.</div>
                )}
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
      <section className={`resident-view${residentItem ? ' show' : ''}`} aria-label="Resident violation view">
        {residentItem && (
          <>
            <header className="resident-topbar">
              <div className="resident-logo">✦ XEVERA</div>
              <div className="resident-user">
                <div className="avatar">{initialsOf(residentItem.reporter_name)}</div>
                {residentItem.reporter_name || 'Resident'}
              </div>
            </header>
            <div className="resident-content">
              <div className="resident-page-title">My Violation</div>
              <div className="resident-page-subtitle">View the details and administrative status of your confirmed violation.</div>
              <div className="resident-card">
                <div className="resident-card-header">
                  <div>
                    <div className="resident-report-title">Violation Details</div>
                    <div className="resident-report-id">{residentItem.id}</div>
                  </div>
                  <span className="status status-confirmed">Confirmed</span>
                </div>
                <div className="resident-grid">
                  <div className="resident-section">
                    <div className="resident-section-title">Report Information</div>
                    <div className="detail-row"><span className="detail-label">Violation Type</span><span className="detail-value">{residentItem.violation_type || 'Fake Report'}</span></div>
                    <div className="detail-row"><span className="detail-label">Severity</span><span className="detail-value">{deriveSeverity(residentItem)}</span></div>
                    <div className="detail-row"><span className="detail-label">Date Confirmed</span><span className="detail-value">{formatDateTime(residentItem.violation_created_at, residentItem.date)}</span></div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Evidence</div>
                    {Array.isArray(residentItem.photos) && residentItem.photos.length > 0 ? (
                      <div className="evidence">
                        {residentItem.photos.map(photoSrc).filter(Boolean).map((src) => (
                          <button key={src} type="button" className="evidence-image" onClick={() => setImageSrc(src)} aria-label="View evidence">
                            <img src={src} alt="Evidence" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="resident-description">No photo evidence attached.</div>
                    )}
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Description</div>
                    <div className="resident-description">{residentItem.description || 'No description provided.'}</div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Violation Information</div>
                    <div className="resident-note">ℹ Please follow the community rules to avoid future violations.</div>
                  </div>
                  <div className="resident-section">
                    <div className="resident-section-title">Administrative Penalty</div>
                    <div className="detail-row"><span className="detail-label">Penalty</span><span className="detail-value">{residentItem.penalty_type || '—'}</span></div>
                    <div className="detail-row"><span className="detail-label">Duration</span><span className="detail-value">{penaltyDurationFor(residentItem)}</span></div>
                    <div className="detail-row"><span className="detail-label">Starts</span><span className="detail-value">{residentItem.penalty_start_at ? formatPenaltyDate(residentItem.penalty_start_at) : '8:00 AM'}</span></div>
                    <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value" style={{ color: '#078e5a' }}>No Fee</span></div>
                  </div>
                </div>
                <button type="button" className="close-resident" onClick={() => setResidentItem(null)}>Back to Resident Portal</button>
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
      {verifyItem ? (
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
              <div className="table-title">{tableTitle} ({total})</div>
              {tab === 'confirmed' && (
                <div className="table-tools">
                  <button type="button" className="btn btn-primary" onClick={openResidentView}>Resident View</button>
                </div>
              )}
              {tab === 'under-review' && (
                <div className="table-tools">
                  <button type="button" className="btn btn-primary" disabled={verifyBusy} onClick={openVerifyOldest}>{verifyBusy ? 'Loading…' : 'Verify Oldest Report'}</button>
                </div>
              )}
            </div>
            <div className="table-wrapper">
              <table>
                <thead>{tableHead()}</thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={colSpan} className="empty-row">Loading violations…</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={colSpan} className="empty-row">Failed to load. Please try again.</td></tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="empty-row">
                        {tab === 'dismissed' ? 'No dismissed violations found.' : 'No violations found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((item, i) => tableRow(item, i))
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <div className="showing">
                {total === 0 ? 'Showing 0 violations' : `Showing ${from} to ${to} of ${total} ${total === 1 ? 'violation' : 'violations'}`}
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
