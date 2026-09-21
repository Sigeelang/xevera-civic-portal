import { useState, useEffect, useCallback } from 'react';
import ResidentLayout from '../../layouts/ResidentLayout';
import { apiFetch } from '../../services/api';
import './MyViolations.css';

const ENFORCING_TYPES = [
  'Reporting Restriction',
  'Short Suspension',
  'Long Suspension',
  'Permanent Restriction',
  'Indefinite Suspension',
  'Fine',
];

function parseDbDate(value) {
  if (!value) return null;
  try {
    const d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/* Effective penalty end: penalty_end_at -> restriction_until ->
   created_at + suspension_days -> created_at + 3 days fallback. */
function penaltyEndOf(v) {
  const direct = parseDbDate(v.penalty_end_at) || parseDbDate(v.restriction_until);
  if (direct) return direct;
  const created = parseDbDate(v.created_at);
  if (!created) return null;
  const days = v.suspension_days ? Number(v.suspension_days) : 3;
  if (!days || days <= 0) return null;
  return new Date(created.getTime() + days * 86400000);
}

export function isViolationActive(v) {
  if (!v) return false;
  if (v.status !== 'Confirmed' && v.status !== 'Appealed') return false;
  if (v.penalty_type === 'Permanent Restriction' || v.penalty_type === 'Indefinite Suspension') return true;
  if (!ENFORCING_TYPES.includes(v.penalty_type)) return false;
  const end = penaltyEndOf(v);
  if (!end) return true;
  return end.getTime() > Date.now();
}

export function isViolationWarning(v) {
  return v && v.penalty_type === 'Warning' && (v.status === 'Confirmed' || v.status === 'Appealed');
}

export function isViolationCompleted(v) {
  if (!v) return false;
  if (['Dismissed', 'Resolved', 'Completed'].includes(v.status)) return true;
  if (v.appeal_outcome === 'Overturned') return true;
  if ((v.status === 'Confirmed' || v.status === 'Appealed') && !isViolationActive(v) && !isViolationWarning(v)) return true;
  return false;
}

/* Violation statuses mirror the staff Violations page so residents see
   the same lifecycle: Pending Review -> Confirmed -> Appealed ->
   Dismissed / Resolved / Completed. */
const STATUS_TABS = ['All', 'Pending Review', 'Confirmed', 'Appealed', 'Dismissed', 'Resolved', 'Completed'];

const STATUS_PILL_CLASS = {
  'Pending Review': 'rvio-status-pending',
  Confirmed: 'rvio-status-confirmed',
  Appealed: 'rvio-status-appealed',
  Dismissed: 'rvio-status-done',
  Resolved: 'rvio-status-resolved',
  Completed: 'rvio-status-done',
};

function statusPillClass(status) {
  return STATUS_PILL_CLASS[status] || 'rvio-status-done';
}

export function violationCode(v) {
  const d = parseDbDate(v.created_at);
  const year = d ? d.getFullYear() : new Date().getFullYear();
  return `VR-${year}-${String(v.id).padStart(4, '0')}`;
}

function fmtShort(value, fallback = '—') {
  const d = parseDbDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(value) {
  const d = parseDbDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtLong(value, fallback = '—') {
  const d = parseDbDate(value);
  if (!d) return fallback;
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

  function penaltyDaysOf(v) {
    if (v.penalty_type === 'Permanent Restriction' || v.penalty_type === 'Indefinite Suspension') return null;
    if (v.penalty_type === 'Warning') return 0;
    if (v.suspension_days) return Number(v.suspension_days);
    return null;
  }

  /* Compact "N days · Starts 8:00 AM" line used by the mobile cards. */
  function cardPenaltyLine(v) {
    const days = penaltyDaysOf(v);
    if (days === null) return 'Admin review';
    if (days === 0) return 'No restriction';
    return `${days} day${days === 1 ? '' : 's'} · Starts 8:00 AM`;
  }

  function renderEmptyState() {
    return (
      <div className="rvio-empty-state">
        <div className="rvio-empty-icon">🛡</div>
        <div className="rvio-empty-title">No Violations</div>
        <div className="rvio-empty-text">You currently have no recorded violations.</div>
      </div>
    );
  }

function restrictionNoteFor(v) {
  switch (v.penalty_type) {
    case 'Reporting Restriction':
      return 'This penalty restricts your ability to submit new reports. You can still view your existing reports and access other portal features.';
    case 'Short Suspension':
    case 'Long Suspension':
      return 'Your account is temporarily suspended. You cannot sign in or use resident features until the penalty ends at 8:00 AM on the end date.';
    case 'Permanent Restriction':
      return 'Reporting is permanently disabled on your account pending admin review. Contact support if you believe this is a mistake.';
    case 'Warning':
      return 'This is a formal warning. No restriction was placed on your account. Please follow the community rules to avoid further penalties.';
    default:
      return 'Please follow the community rules to avoid further penalties.';
  }
}

export default function ResidentViolationsPage({ onNavigate }) {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(message, kind = 'success') {
    setToast({ message, kind });
    try {
      setTimeout(() => setToast(null), 3200);
    } catch { /* no-op */ }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await apiFetch('violations/my.php');
      setViolations(Array.isArray(data.violations) ? data.violations : []);
    } catch {
      setLoadError(true);
      setViolations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the open drawer in sync after reloads (e.g. after an appeal).
  useEffect(() => {
    if (!selected) return;
    const fresh = violations.find((v) => v.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [violations, selected]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (appealOpen) setAppealOpen(false);
        else setSelected(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, appealOpen]);

  const total = violations.length;
  const statusCounts = {};
  STATUS_TABS.forEach((t) => {
    statusCounts[t] = t === 'All' ? total : violations.filter((v) => v.status === t).length;
  });

  const needle = search.toLowerCase().trim();
  const filtered = violations.filter((v) => {
    if (activeTab !== 'All' && v.status !== activeTab) return false;
    if (statusFilter !== 'All' && v.status !== statusFilter) return false;
    if (!needle) return true;
    const hay = `${violationCode(v)} ${v.violation_type || ''} ${v.description || ''} ${v.penalty_type || ''} ${v.status || ''}`.toLowerCase();
    return hay.includes(needle);
  });

  function pickTab(next) {
    setActiveTab(next);
    setStatusFilter(next);
  }

  async function submitAppeal() {
    if (!selected || appealBusy) return;
    const reason = appealReason.trim();
    if (!reason) {
      showToast('Please explain why you are appealing this violation.', 'error');
      return;
    }
    setAppealBusy(true);
    try {
      await apiFetch('violations/appeal.php', {
        method: 'POST',
        body: { violation_id: selected.id, appeal_reason: reason },
      });
      showToast('Appeal submitted. An administrator will review it.', 'success');
      setAppealOpen(false);
      setAppealReason('');
      await load();
    } catch (e) {
      showToast(e && e.message ? e.message : 'Failed to submit appeal.', 'error');
    } finally {
      setAppealBusy(false);
    }
  }

  const canAppeal = selected && selected.status === 'Confirmed' && !selected.appeal_reason;

  function appealBadge(v) {
    if (!v.appeal_reason) return null;
    const out = v.appeal_outcome || '';
    if (out === 'Overturned') return <span className="rvio-appeal ok">✓ Accepted</span>;
    if (out === 'Upheld') return <span className="rvio-appeal no">× Rejected</span>;
    return <span className="rvio-appeal wait">⚠ Under Review</span>;
  }

  return (
    <ResidentLayout activePage="my-violations" onNavigate={onNavigate}>
      <div className="rvio">
        <div className="rvio-title">
          <h1>My Violations</h1>
          <p>View your violation records, penalties, and account status.</p>
        </div>

        <div className="rvio-toolbar">
          <div className="rvio-tabs" role="tablist" aria-label="Violation filter">
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={activeTab === t}
                className={`rvio-tab${activeTab === t ? ' active' : ''}`}
                onClick={() => pickTab(t)}
              >
                {t === 'All' ? `All Violations (${statusCounts.All})` : `${t} (${statusCounts[t]})`}
              </button>
            ))}
          </div>
          <div className="rvio-tools">
            <input
              type="text"
              className="rvio-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search violations..."
              aria-label="Search violations"
            />
            <select
              className="rvio-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setActiveTab(e.target.value);
              }}
              aria-label="Filter by status"
            >
              <option value="All">All Status</option>
              {STATUS_TABS.filter((t) => t !== 'All').map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rvio-table-card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Violation ID</th>
                <th>Violation Type</th>
                <th>Date</th>
                <th>Penalty</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                    <tr><td colSpan={7} className="rvio-empty">Loading violations…</td></tr>
                  ) : loadError ? (
                    <tr><td colSpan={7} className="rvio-empty">Failed to load. Please try again.</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="rvio-empty-cell">{renderEmptyState()}</td></tr>
                  ) : (
                    filtered.map((v, i) => {
                  const active = isViolationActive(v);
                  const days = penaltyDaysOf(v);
                  return (
                    <tr key={v.id}>
                      <td>{i + 1}</td>
                      <td><strong>{violationCode(v)}</strong></td>
                      <td>
                        <strong>{v.violation_type || 'Violation'}</strong>
                        {v.description && <span className="rvio-sub">{String(v.description).slice(0, 80)}</span>}
                      </td>
                      <td>
                        {fmtShort(v.created_at)}
                        <span className="rvio-sub">{fmtTime(v.created_at)}</span>
                      </td>
                      <td>
                        <span className="rvio-penalty">{v.penalty_type || '—'}</span>
                        <span className="rvio-sub">
                          {days === null ? 'Admin review' : days === 0 ? 'No restriction' : `${days} day${days === 1 ? '' : 's'} (Starts 8:00 AM)`}
                        </span>
                      </td>
                      <td>
                        <span className={statusPillClass(v.status)}>{v.status || '—'}</span>
                        {isViolationActive(v) && <span className="rvio-sub">Enforced now</span>}
                      </td>
                      <td>
                        <button type="button" className="rvio-details-btn" onClick={() => { setSelected(v); setAppealOpen(false); setAppealReason(''); }}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile violation cards (replaces the table below ~700px) */}
        <div className="rvio-cards" aria-label="Violations">
          {loading ? (
            <div className="rvio-card rvio-card-status">Loading violations…</div>
          ) : loadError ? (
            <div className="rvio-card rvio-card-status">Failed to load. Please try again.</div>
          ) : filtered.length === 0 ? (
            <div className="rvio-card">{renderEmptyState()}</div>
          ) : (
            filtered.map((v) => {
              const cardActive = isViolationActive(v);
              return (
                <article key={v.id} className="rvio-card">
                  <div className="rvio-card-top">
                    <span className={`rvio-card-icon${cardActive ? '' : ' done'}`}>⚠</span>
                    <div className="rvio-card-idwrap">
                      <div className="rvio-card-id">{violationCode(v)}</div>
                      <div className="rvio-card-type">{v.violation_type || 'Violation'}</div>
                    </div>
                    <span className={statusPillClass(v.status)}>{v.status || '—'}</span>
                  </div>
                  <div className="rvio-card-penalty">
                    <span className="rvio-penalty">{v.penalty_type || '—'}</span>
                  </div>
                  <div className="rvio-card-meta">{cardPenaltyLine(v)}</div>
                  <div className="rvio-card-date">{fmtShort(v.created_at)}{fmtTime(v.created_at) ? ` · ${fmtTime(v.created_at)}` : ''}</div>
                  <button
                    type="button"
                    className="rvio-card-btn"
                    onClick={() => { setSelected(v); setAppealOpen(false); setAppealReason(''); }}
                  >
                    View Details
                  </button>
                </article>
              );
            })
          )}
        </div>

        {selected && (
          <>
            <div className="rvio-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />
            <aside className="rvio-drawer" aria-label="Violation details">
              <div className="rvio-drawer-header">
                <h2>Violation Details</h2>
                <button type="button" className="rvio-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
              </div>

              <div className="rvio-violation-card">
                <div className="rvio-warning-icon">!</div>
                <div className="rvio-violation-info">
                  <div className="rvio-violation-top">
                    <div className="rvio-violation-id">{violationCode(selected)}</div>
                    {isViolationActive(selected)
                      ? <div className="rvio-active-pill">Active</div>
                      : <div className="rvio-done-pill">{isViolationCompleted(selected) ? 'Completed' : selected.status}</div>}
                  </div>
                  <div className="rvio-violation-type">{selected.violation_type || 'Violation'}</div>
                  <div className="rvio-drawer-muted">{selected.description || 'No description provided.'}</div>
                  <div className="rvio-drawer-muted">Reported Date: {fmtLong(selected.created_at)}</div>
                  {appealBadge(selected)}
                </div>
              </div>

              <div className="rvio-section">
                <h3>Penalty Information</h3>
                <div className="rvio-penalty-card">
                  <div className="rvio-penalty-name">{selected.penalty_type || '—'}</div>
                  <div className="rvio-penalty-days">
                    {(() => {
                      const d = penaltyDaysOf(selected);
                      return d === null ? 'Admin review' : d === 0 ? 'No restriction' : `${d} day${d === 1 ? '' : 's'}`;
                    })()}
                  </div>
                  <div className="rvio-date-grid">
                    <div>
                      <div className="rvio-date-label">Start Date &amp; Time</div>
                      <div className="rvio-date-value">{selected.penalty_start_at ? fmtLong(selected.penalty_start_at) : '8:00 AM'}</div>
                      <div className="rvio-start-note">Penalties take effect at 8:00 AM</div>
                    </div>
                    <div>
                      <div className="rvio-date-label">End Date &amp; Time</div>
                      <div className="rvio-date-value">
                        {(() => {
                          const end = penaltyEndOf(selected);
                          if (selected.penalty_type === 'Permanent Restriction' || selected.penalty_type === 'Indefinite Suspension') return 'Until lifted by admin';
                          return end ? fmtLong(end.toISOString()) : '—';
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="rvio-restriction-note">{restrictionNoteFor(selected)}</div>
                </div>
              </div>

              <div className="rvio-section">
                <h3>Violation Details</h3>
                <div className="rvio-info-list">
                  <div className="rvio-info-row">
                    <div className="rvio-info-label">Confirmed By</div>
                    <div className="rvio-info-value">{selected.issued_by_name || 'Admin'}</div>
                  </div>
                  <div className="rvio-info-row">
                    <div className="rvio-info-label">Date Confirmed</div>
                    <div className="rvio-info-value">{fmtLong(selected.created_at)}</div>
                  </div>
                  <div className="rvio-info-row">
                    <div className="rvio-info-label">Reason</div>
                    <div className="rvio-info-value">{selected.description || '—'}</div>
                  </div>
                  {selected.appeal_reason && (
                    <div className="rvio-info-row">
                      <div className="rvio-info-label">Your Appeal</div>
                      <div className="rvio-info-value">
                        {selected.appeal_reason}
                        {selected.appeal_outcome && <span className="rvio-sub">Decision: {selected.appeal_outcome}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {canAppeal && !appealOpen && (
                <button type="button" className="rvio-appeal-btn" onClick={() => setAppealOpen(true)}>
                  Appeal This Violation
                </button>
              )}

              {appealOpen && (
                <div className="rvio-appeal-box">
                  <label htmlFor="rvio-appeal-reason">Why are you appealing?</label>
                  <textarea
                    id="rvio-appeal-reason"
                    rows={4}
                    maxLength={500}
                    placeholder="Explain why this violation should be reviewed…"
                    value={appealReason}
                    disabled={appealBusy}
                    onChange={(e) => setAppealReason(e.target.value)}
                  />
                  <div className="rvio-appeal-actions">
                    <button type="button" className="rvio-appeal-cancel" disabled={appealBusy} onClick={() => { setAppealOpen(false); setAppealReason(''); }}>
                      Cancel
                    </button>
                    <button type="button" className="rvio-appeal-submit" disabled={appealBusy} onClick={submitAppeal}>
                      {appealBusy ? 'Submitting…' : 'Submit Appeal'}
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </>
        )}

        {toast && (
          <div className={`rvio-toast show ${toast.kind}`} role="status">
            {toast.message}
          </div>
        )}
      </div>
    </ResidentLayout>
  );
}
