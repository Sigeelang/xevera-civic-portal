import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch, getToken } from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import './ResidentsPage.css';

const AVATAR_CLASSES = ['avatar-orange', 'avatar-cyan', 'avatar-green', 'avatar-purple'];

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const Svg = ({ children, className = 'nav-icon-svg' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    {children}
  </svg>
);

const NAV_TABS = [
  { key: 'management', label: 'Staff & Admins', icon: (<><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" /></>) },
  { key: 'all', label: 'All Users', icon: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
  { key: 'staff', label: 'Staff', icon: (<><path d="M14.7 6.3a1 1 0 0 0-1.4 0l-7 7a1 1 0 0 0 0 1.4l3 3a1 1 0 0 0 1.4 0l7-7" /><path d="M17 3l4 4" /><path d="M6 21l3-3" /></>) },
  { key: 'administrators', label: 'Administrators', icon: (<><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" /></>) },
  { key: 'residents', label: 'Residents', icon: (<><path d="M20.8 8.7c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.7 4.7 0 0 1 12 5a4.7 4.7 0 0 1 8.8 3.7z" /></>) },
  { key: 'roles', label: 'Roles & Permissions', icon: (<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>) },
  { key: 'status', label: 'Account Status', icon: (<><circle cx="12" cy="12" r="9" /><path d="M8 12l2.5 2.5L16 9" /></>) },
];

const PROOF_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <circle cx="11" cy="14" r="2.5" />
    <path d="M13 16l2 2" />
  </svg>
);

const LOCK_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const TRASH_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 14h10l1-14" />
    <path d="M9 7V4h6v3" />
  </svg>
);

const ZOOM_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
    <path d="M11 8v6M8 11h6" />
  </svg>
);

export default function ResidentsPage({ onNavigate }) {
  const showToast = useToast();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [drawerResident, setDrawerResident] = useState(null);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [proofUrls, setProofUrls] = useState({});
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  function load(q = serverSearch) {
    setLoading(true);
    setError(false);
    const params = q ? '?search=' + encodeURIComponent(q) : '';
    apiFetch('residents/list.php' + params)
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== serverSearch) { setServerSearch(search); setPage(1); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { if (serverSearch !== undefined) load(serverSearch); }, [serverSearch]);

  const closeDrawer = useCallback(() => {
    setDrawerResident(null);
    setViewerSrc(null);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerSrc(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeViewer();
        setConfirmState(null);
        closeDrawer();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDrawer, closeViewer]);

  useEffect(() => {
    document.body.style.overflow = (drawerResident || viewerSrc) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerResident, viewerSrc]);

  /*
   * Proof images must be fetched with the Authorization header: plain
   * <img> requests carry no Bearer token, so the preview endpoint
   * would answer 403 and every image would render broken. Blobs are
   * converted to object URLs for <img> + fullscreen viewer use.
   */
  useEffect(() => {
    if (!drawerResident) {
      setProofUrls({});
      setProofError(null);
      setProofLoading(false);
      return undefined;
    }
    const docNums = [
      drawerResident.residency_proof ? 1 : null,
      drawerResident.residency_proof2 ? 2 : null,
    ].filter(Boolean);
    if (!docNums.length) return undefined;
    let alive = true;
    const urls = {};
    setProofLoading(true);
    setProofError(null);
    setProofUrls({});
    (async () => {
      try {
        const token = getToken();
        for (const n of docNums) {
          const res = await fetch(`/api/admin/residency-verify.php?action=preview&id=${drawerResident.id}&n=${n}`, {
            headers: token ? { Authorization: 'Bearer ' + token } : {},
          });
          if (!res.ok) throw new Error('Preview failed (' + res.status + ')');
          const blob = await res.blob();
          if (!alive) return;
          urls[n] = URL.createObjectURL(blob);
          setProofUrls({ ...urls });
        }
      } catch {
        if (alive) setProofError('Could not load proof images. The file may be missing on the server.');
      } finally {
        if (alive) setProofLoading(false);
      }
    })();
    return () => {
      alive = false;
      Object.values(urls).forEach(u => URL.revokeObjectURL(u));
    };
  }, [drawerResident]);

  async function submitCreate(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const data = await apiFetch('residents/create.php', { method: 'POST', body: { name: form.name, email: form.email, password: form.password, address: form.address } });
      showToast('Account created for ' + form.name + ' (username: ' + data.username + ')');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', address: '' });
      load();
    } catch (err) {
      showToast(err.message || 'Failed to create account.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirmState) return;
    const { action, resident } = confirmState;
    setConfirmBusy(true);
    try {
      if (action === 'suspend') {
        await apiFetch('residents/toggle.php', { method: 'POST', body: { id: resident.id } });
        showToast(resident.status === 'Active' ? 'Account suspended.' : 'Account reactivated.');
      } else if (action === 'delete') {
        await apiFetch('residents/delete.php', { method: 'POST', body: { id: resident.id } });
        showToast('Resident removed.');
      } else if (action === 'activate') {
        await apiFetch('admin/residency-verify.php?action=approve', { method: 'POST', body: { user_id: resident.id } });
        showToast(resident.name + "'s account has been activated successfully.");
        closeDrawer();
      } else if (action === 'reject') {
        await apiFetch('admin/residency-verify.php?action=reject', { method: 'POST', body: { user_id: resident.id } });
        showToast(resident.name + "'s account has been rejected.");
        closeDrawer();
      }
      setConfirmState(null);
      load();
    } catch {
      showToast('Failed to complete action.', 'error');
    } finally {
      setConfirmBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(r => {
      // Backend stores Active/Inactive; the UI labels Inactive as Suspended.
      const st = String(r.status || '').toLowerCase() === 'inactive' ? 'suspended' : String(r.status || '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || st === statusFilter;
      const matchesQ = !q
        || String(r.name || '').toLowerCase().includes(q)
        || String(r.username || '').toLowerCase().includes(q)
        || String(r.email || '').toLowerCase().includes(q)
        || String(r.address || '').toLowerCase().includes(q);
      return matchesStatus && matchesQ;
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const drawerDocs = useMemo(() => {
    if (!drawerResident) return [];
    const docs = [];
    if (drawerResident.residency_proof) docs.push({ file: drawerResident.residency_proof, n: 1, label: 'Document 1' });
    if (drawerResident.residency_proof2) docs.push({ file: drawerResident.residency_proof2, n: 2, label: 'Document 2' });
    return docs;
  }, [drawerResident]);

  const drawerStatus = drawerResident ? String(drawerResident.status || 'Active') : '';
  const drawerResidency = drawerResident ? String(drawerResident.residency_status || '') : '';
  const drawerIsPending = drawerResidency === 'Pending Verification' || drawerStatus.toLowerCase() !== 'active';

  const confirmMeta = (() => {
    if (!confirmState) return null;
    const { action, resident } = confirmState;
    if (action === 'suspend') return { title: resident.status === 'Active' ? 'Suspend Account' : 'Reactivate Account', message: resident.status === 'Active' ? `Are you sure you want to suspend ${resident.name}'s account?` : `Are you sure you want to reactivate ${resident.name}'s account?`, label: resident.status === 'Active' ? 'Suspend' : 'Reactivate', danger: resident.status === 'Active' };
    if (action === 'delete') return { title: 'Delete Account', message: `Are you sure you want to delete ${resident.name}'s account? This action cannot be undone.`, label: 'Delete', danger: true };
    if (action === 'activate') return { title: 'Activate Account', message: `Confirm that ${resident.name}'s residency proof has been verified and activate the account?`, label: 'Activate', danger: false };
    if (action === 'reject') return { title: 'Reject Account', message: `Are you sure you want to reject ${resident.name}'s account?`, label: 'Reject', danger: true };
    return null;
  })();

  return (
    <div className="res-page">
      <div className="res-wrap">
        <header className="page-header">
          <div>
            <div className="header-label">
              <span className="header-dot"></span>
              USER MANAGEMENT
            </div>
            <h1 className="page-title">Resident Accounts</h1>
            <p className="page-subtitle">Add, edit, suspend, or remove user accounts.</p>
          </div>
          <button className="add-user-btn" onClick={() => setShowForm(true)}>+ Add User</button>
        </header>

        <nav className="user-nav" aria-label="User management sections">
          {NAV_TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { if (t.key !== 'residents' && onNavigate) onNavigate(`users/${t.key}`); }}
              className={'nav-item' + (t.key === 'residents' ? ' active' : '')}
              aria-current={t.key === 'residents' ? 'page' : undefined}
            >
              <Svg>{t.icon}</Svg>
              {t.label}
            </button>
          ))}
        </nav>

        <section className="table-card">
          <div className="toolbar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, username, or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="status-filter" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table className="resident-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>USERNAME / EMAIL</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>CREATED</th>
                  <th>LAST LOGIN</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-5"><SkeletonRows rows={5} height="h-12" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={7}><StaffErrorState message="Unable to load residents." onRetry={() => load()} /></td></tr>
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7}><StaffEmptyState title="No residents found." description="Create an account or adjust your filters." /></td></tr>
                ) : paged.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="name-cell">
                        <div className={`avatar ${AVATAR_CLASSES[Number(r.id) % AVATAR_CLASSES.length]}`}>{initials(r.name)}</div>
                        <span className="name">{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="username">{r.username || '—'}</div>
                      <div className="email">{r.email}</div>
                    </td>
                    <td><span className="role-badge">{r.role || 'Resident'}</span></td>
                    <td>
                      <span className={`status-badge ${String(r.status).toLowerCase() === 'active' ? 'status-active' : 'status-suspended'}`}>
                        {String(r.status).toLowerCase() === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="date">{formatDate(r.created_at)}</td>
                    <td className="date">{r.last_login_at ? formatDate(r.last_login_at) : '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="action-btn proof-btn" disabled={busyId === r.id} onClick={() => setDrawerResident(r)} title="View Residency Proof Details">
                          <span className="tooltip">View Residency<br />Proof Details</span>
                          {PROOF_SVG}
                        </button>
                        <button className="action-btn suspend-btn" disabled={busyId === r.id} onClick={() => setConfirmState({ action: 'suspend', resident: r })} title={r.status === 'Active' ? 'Suspend Account' : 'Reactivate Account'}>
                          {LOCK_SVG}
                        </button>
                        <button className="action-btn delete-btn" disabled={busyId === r.id} onClick={() => setConfirmState({ action: 'delete', resident: r })} title="Delete Account">
                          {TRASH_SVG}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="result-count">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} results
            </div>
            <div className="footer-actions">
              <div className="footer-action proof">{PROOF_SVG}View Residency<br />Proof Details</div>
              <div className="footer-action">{LOCK_SVG}Suspend<br />Account</div>
              <div className="footer-action delete">{TRASH_SVG}Delete<br />Account</div>
            </div>
          </div>

          <div className="res-pagination">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} className={n === safePage ? 'pg-active' : ''}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>›</button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>
        </section>
      </div>

      <div className={`drawer-overlay${drawerResident ? ' open' : ''}`} onClick={closeDrawer}></div>
      <aside className={`drawer${drawerResident ? ' open' : ''}`} aria-hidden={!drawerResident}>
        {drawerResident && (
          <>
            <div className="drawer-header">
              <h2 className="drawer-title">Residency Proof Details</h2>
              <p className="drawer-subtitle">Review the resident's submitted document before activating the account.</p>
              <button className="close-drawer" onClick={closeDrawer} aria-label="Close">
                <svg viewBox="0 0 24 24" width="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="drawer-content">
              <div className="info-card">
                <h3 className="info-title">Account Information</h3>
                <div className="info-row">
                  <span className="info-label">Name</span>
                  <span className="info-value">{drawerResident.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{drawerResident.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Phone</span>
                  <span className="info-value">{drawerResident.phone || '—'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Address</span>
                  <span className="info-value">{drawerResident.address || '—'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Date Submitted</span>
                  <span className="info-value">{formatDate(drawerResident.created_at)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Account Status</span>
                  {drawerIsPending
                    ? <span className="pending-badge">Pending Approval</span>
                    : <span className="status-badge status-active">{drawerStatus}</span>}
                </div>
              </div>

              <div className="notice">
                <div className="notice-icon">i</div>
                <div>Please verify that the submitted document is valid and matches the provided information.</div>
              </div>

              <div className="proof-card">
                <div className="proof-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M8 13h8M8 17h5" />
                  </svg>
                  <h3>Proof of Residency</h3>
                </div>
                <div className="proof-body">
                  <div className="proof-meta">
                    <span>File Name:</span>
                    <span className="proof-filename">{drawerDocs.length ? drawerDocs.map(d => d.file).join(', ') : '—'}</span>
                  </div>
                  {!drawerDocs.length ? (
                    <p className="no-docs">No proof documents uploaded for this resident.</p>
                  ) : proofLoading && Object.keys(proofUrls).length === 0 ? (
                    <div className="image-grid">
                      {drawerDocs.map((d) => (
                        <div className="document-preview" key={d.n}>
                          <div className="document-loading"><span /></div>
                          <div className="document-caption">{d.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : proofError && Object.keys(proofUrls).length === 0 ? (
                    <p className="proof-error">{proofError}</p>
                  ) : (
                    <div className="image-grid">
                      {drawerDocs.map((d) => {
                        const src = proofUrls[d.n];
                        if (!src) return null;
                        return (
                          <div className="document-preview" key={d.n}>
                            <img
                              className="document-image"
                              src={src}
                              alt={`Residency proof ${d.label}`}
                              onClick={() => setViewerSrc(src)}
                            />
                            <button className="zoom-btn" onClick={() => setViewerSrc(src)} aria-label="Zoom document">
                              {ZOOM_SVG}
                            </button>
                            <div className="document-caption">{d.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="drawer-actions">
                <button
                  className="drawer-btn reject-btn"
                  disabled={confirmBusy}
                  onClick={() => setConfirmState({ action: drawerResident.status === 'Active' ? 'suspend' : 'reject', resident: drawerResident })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9 9l6 6M15 9l-6 6" />
                  </svg>
                  {drawerResident.status === 'Active' ? 'Suspend Account' : 'Reject Account'}
                </button>
                <button
                  className="drawer-btn activate-btn"
                  disabled={confirmBusy || !drawerIsPending}
                  onClick={() => setConfirmState({ action: 'activate', resident: drawerResident })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l4 4L19 6" />
                  </svg>
                  Activate Account
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      <Modal
        open={showForm}
        title="Create Resident Account"
        description="Create a resident login so they can submit reports through the portal."
        hideActions
        onCancel={() => setShowForm(false)}
      >
        <form onSubmit={submitCreate} className="res-create-form">
          <div>
            <label>Full Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Enter resident name" />
          </div>
          <div>
            <label>Email Address *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="resident@gmail.com" />
          </div>
          <div>
            <label>Password *</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div>
            <label>Address</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Block, Phase, Xevera" />
          </div>
          <div className="res-create-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" disabled={saving} className="primary">{saving ? 'Creating...' : 'Save Account'}</button>
          </div>
        </form>
      </Modal>

      <div className={`res-modal-overlay${confirmState ? ' show' : ''}`} onClick={() => !confirmBusy && setConfirmState(null)}>
        <div className="res-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <h2>{confirmMeta?.title || 'Confirm Action'}</h2>
          <p>{confirmMeta?.message || 'Are you sure you want to continue?'}</p>
          <div className="modal-buttons">
            <button className="modal-btn" onClick={() => setConfirmState(null)} disabled={confirmBusy}>Cancel</button>
            <button
              className={`modal-btn ${confirmMeta?.danger ? 'danger' : 'confirm'}`}
              onClick={runConfirm}
              disabled={confirmBusy}
            >
              {confirmBusy ? 'Please wait...' : confirmMeta?.label || 'Confirm'}
            </button>
          </div>
        </div>
      </div>

      <div className={`image-viewer${viewerSrc ? ' show' : ''}`} onClick={closeViewer}>
        <button className="viewer-close" onClick={closeViewer} aria-label="Close viewer">×</button>
        {viewerSrc && <img src={viewerSrc} alt="Residency proof fullscreen" onClick={e => e.stopPropagation()} />}
      </div>
    </div>
  );
}
