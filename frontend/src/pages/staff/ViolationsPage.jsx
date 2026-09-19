import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pager from '../../components/Pager';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const SEVERITY_COLORS = {
  Minor: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]' },
  Major: { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]' },
  Serious: { bg: 'bg-[#FDE68A]', text: 'text-[#78350F]' },
  Critical: { bg: 'bg-[#FCA5A5]', text: 'text-[#7F1D1D]' },
};

const STATUS_COLORS = {
  'Pending Review': { bg: 'bg-[#FFF4DF]', text: 'text-[#D97706]' },
  'Confirmed': { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
  'Appealed': { bg: 'bg-[#E0E7FF]', text: 'text-[#4338CA]' },
  'Dismissed': { bg: 'bg-[#E7F8EF]', text: 'text-[#159957]' },
  'Resolved': { bg: 'bg-[#EEF2F6]', text: 'text-[#5C6E86]' },
};

const TYPES = ['All', 'False Information', 'Fake Report', 'Spam Report', 'Duplicate Report', 'Abusive Submission'];
const SEVERITIES = ['All', 'Minor', 'Major', 'Serious', 'Critical'];
const STATUSES = ['All', 'Pending Review', 'Confirmed', 'Appealed', 'Dismissed', 'Resolved'];

export default function ViolationsPage({ onNavigate }) {
  const { user } = useAuth();
  const showToast = useToast();

  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [type, setType] = useState('All');
  const [drawer, setDrawer] = useState(null);
  const [drawerHistory, setDrawerHistory] = useState([]);
  const [busyId, setBusyId] = useState(null);

  // Modals
  const [confirmModal, setConfirmModal] = useState(null);
  const [dismissModal, setDismissModal] = useState(null);
  const [fineModal, setFineModal] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [modalNote, setModalNote] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [suspendDays, setSuspendDays] = useState('7');

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const params = new URLSearchParams({ page, limit: perPage });
      if (status !== 'All') params.set('status', status);
      if (severity !== 'All') params.set('severity', severity);
      if (type !== 'All') params.set('type', type);
      if (search) params.set('search', search);
      const data = await apiFetch('violations/list.php?' + params.toString());
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total) || 0);
      setTotalPages(Math.max(1, Number(data.total_pages) || 1));
    } catch {
      setItems([]);
      setError(true);
    }
  }, [page, perPage, status, severity, type, search]);

  useEffect(() => { load(); }, [load]);

  const loadDrawer = useCallback(async (id) => {
    try {
      const [v, h] = await Promise.all([
        apiFetch(`violations/get.php?id=${id}`),
        apiFetch(`violations/get.php?id=${id}`).then(d => d.history || []),
      ]);
      setDrawer(v);
      setDrawerHistory(Array.isArray(h) ? h : []);
    } catch { setDrawer(null); }
  }, []);

  function openDrawer(item) {
    setDrawer(item);
    loadDrawer(item.id);
  }

  async function runAction(item, action, extra = {}) {
    setBusyId(item.id);
    try {
      await apiFetch('violations/update.php', {
        method: 'POST',
        body: { id: item.id, action, ...extra },
      });
      showToast(`Violation #${item.id} ${action}'d.`);
      load();
      setDrawer(null);
      setConfirmModal(null);
      setDismissModal(null);
      setFineModal(null);
      setSuspendModal(null);
      setModalNote('');
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Compliance"
        title="Violations"
        description="Review flagged reports and manage resident violations."
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Pending Review', items?.filter(i => i.status === 'Pending Review').length ?? '-'],
          ['Confirmed', items?.filter(i => i.status === 'Confirmed').length ?? '-'],
          ['Appealed', items?.filter(i => i.status === 'Appealed').length ?? '-'],
          ['Total', total],
        ].map(([label, val]) => (
          <div key={label} className="bg-white border border-[#E4EAF3] rounded-xl px-4 py-3 text-center">
            <div className="text-[20px] font-bold text-[#172F60]">{val}</div>
            <div className="text-[10px] font-bold text-[#6B7A99] uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E4EAF3] rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Search resident or description..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[180px] h-9 px-3 border border-[#DBE3EF] rounded-lg text-[12px] focus:outline-none focus:border-[#3D7DF2]" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-2 border border-[#DBE3EF] rounded-lg text-[12px] bg-white">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(1); }}
          className="h-9 px-2 border border-[#DBE3EF] rounded-lg text-[12px] bg-white">
          {SEVERITIES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Severities' : s}</option>)}
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="h-9 px-2 border border-[#DBE3EF] rounded-lg text-[12px] bg-white">
          {TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E4EAF3] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-[#F5F8FC] text-[10px] font-bold text-[#6B7A99] uppercase tracking-wide">
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Resident</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Penalty</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items === null && <SkeletonRows rows={5} height="h-10" />}
              {error && <tr><td colSpan={8}><StaffErrorState message="Unable to load violations." onRetry={load} /></td></tr>}
              {items && items.length === 0 && <tr><td colSpan={8}><StaffEmptyState title="No violations found." description="Adjust your filters or check back later." /></td></tr>}
              {items && items.map(v => {
                const sev = SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.Minor;
                const sts = STATUS_COLORS[v.status] || STATUS_COLORS['Pending Review'];
                return (
                  <tr key={v.id} className="border-t border-[#EEF2F6] hover:bg-[#F9FBFD] transition-colors">
                    <td className="px-4 py-3 text-[11px] font-bold text-[#172F60]">#{v.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-[12px] font-bold text-[#172F60]">{v.resident_name || '—'}</div>
                      <div className="text-[10px] text-[#8391A8]">{v.resident_email || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#374151]">{v.violation_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${sev.bg} ${sev.text}`}>{v.severity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${sts.bg} ${sts.text}`}>{v.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#374151]">
                      {v.penalty_type === 'Fine' ? `₱${Number(v.penalty_amount || 0).toLocaleString()}` : v.penalty_type || '—'}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[#6B7A99]">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDrawer(v)} className="text-[11px] font-bold text-[#1465F5] hover:underline cursor-pointer bg-transparent border-none">Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#EEF2F6] px-4 py-3 flex items-center justify-between">
          <div className="text-[10px] text-[#6B7A99]">{total} violation{total !== 1 ? 's' : ''}</div>
          <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[#051326]/20" onClick={() => setDrawer(null)} />
          <aside className="absolute top-0 right-0 bottom-0 w-full max-w-[460px] bg-white shadow-2xl flex flex-col animate-[drawerIn_.28s_ease]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4EAF3]">
              <h2 className="text-[15px] font-extrabold text-[#172F60]">Violation #{drawer.id}</h2>
              <button onClick={() => setDrawer(null)} className="w-8 h-8 rounded-lg bg-[#F3F6FA] grid place-items-center text-[#69778D] hover:bg-[#E8EDF4] cursor-pointer border-none text-[16px]">×</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Status + Severity */}
              <div className="flex gap-2">
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${(STATUS_COLORS[drawer.status] || STATUS_COLORS['Pending Review']).bg} ${(STATUS_COLORS[drawer.status] || STATUS_COLORS['Pending Review']).text}`}>{drawer.status}</span>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${(SEVERITY_COLORS[drawer.severity] || SEVERITY_COLORS.Minor).bg} ${(SEVERITY_COLORS[drawer.severity] || SEVERITY_COLORS.Minor).text}`}>{drawer.severity}</span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F6F9FD] rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-[#8391A8] uppercase">Resident</div>
                  <div className="text-[12px] font-bold text-[#172F60]">{drawer.resident_name || '—'}</div>
                  <div className="text-[10px] text-[#6B7A99]">Violations: {drawer.violation_count ?? 0}</div>
                </div>
                <div className="bg-[#F6F9FD] rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-[#8391A8] uppercase">Type</div>
                  <div className="text-[12px] font-bold text-[#172F60]">{drawer.violation_type}</div>
                </div>
                <div className="bg-[#F6F9FD] rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-[#8391A8] uppercase">Penalty</div>
                  <div className="text-[12px] font-bold text-[#172F60]">
                    {drawer.penalty_type === 'Fine' ? `₱${Number(drawer.penalty_amount || 0).toLocaleString()}` : drawer.penalty_type || '—'}
                  </div>
                </div>
                <div className="bg-[#F6F9FD] rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-[#8391A8] uppercase">Report</div>
                  <div className="text-[12px] font-bold text-[#172F60]">{drawer.report_ref_id || '—'}</div>
                </div>
              </div>

              {/* Description */}
              {drawer.description && (
                <div>
                  <div className="text-[10px] font-bold text-[#6B7A99] uppercase mb-1">Description</div>
                  <p className="text-[12px] text-[#374151] leading-relaxed">{drawer.description}</p>
                </div>
              )}

              {/* Appeal */}
              {drawer.status === 'Appealed' && drawer.appeal_reason && (
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg p-3">
                  <div className="text-[10px] font-bold text-[#4338CA] uppercase mb-1">Resident Appeal</div>
                  <p className="text-[12px] text-[#3730A3]">{drawer.appeal_reason}</p>
                  {drawer.appeal_date && <div className="text-[10px] text-[#6366F1] mt-1">Filed: {new Date(drawer.appeal_date).toLocaleString()}</div>}
                </div>
              )}

              {/* History */}
              {drawerHistory.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-[#6B7A99] uppercase mb-2">History</div>
                  <div className="space-y-2">
                    {drawerHistory.map((h, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="w-2 h-2 rounded-full bg-[#1465F5] mt-1.5 flex-shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-[#172F60]">{h.action} {h.note ? `— ${h.note}` : ''}</div>
                          <div className="text-[9px] text-[#8391A8]">{h.acted_by_name || 'System'} · {h.created_at ? new Date(h.created_at).toLocaleString() : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-[#E4EAF3] px-5 py-3 flex flex-wrap gap-2">
              {drawer.status === 'Pending Review' && (
                <>
                  <button onClick={() => { setModalNote(''); setConfirmModal(drawer); }}
                    className="flex-1 h-10 rounded-lg bg-[#0F8F63] text-white text-[11px] font-bold hover:bg-[#0B7A55] cursor-pointer border-none">Confirm Violation</button>
                  <button onClick={() => { setModalNote(''); setDismissModal(drawer); }}
                    className="flex-1 h-10 rounded-lg border border-[#DBE3EF] bg-white text-[#374151] text-[11px] font-bold hover:bg-[#F5F7FA] cursor-pointer">Dismiss</button>
                </>
              )}
              {drawer.status === 'Appealed' && (
                <>
                  <button onClick={() => { setModalNote(''); setConfirmModal(drawer); }}
                    className="flex-1 h-10 rounded-lg bg-[#0F8F63] text-white text-[11px] font-bold hover:bg-[#0B7A55] cursor-pointer border-none">Uphold</button>
                  <button onClick={() => { setModalNote(''); setDismissModal(drawer); }}
                    className="flex-1 h-10 rounded-lg border border-[#DBE3EF] bg-white text-[#374151] text-[11px] font-bold hover:bg-[#F5F7FA] cursor-pointer">Overturn</button>
                </>
              )}
              {drawer.status === 'Confirmed' && (
                <>
                  <button onClick={() => { setFineAmount(drawer.penalty_amount || '100'); setFineModal(drawer); }}
                    className="flex-1 h-10 rounded-lg bg-[#D97706] text-white text-[11px] font-bold hover:bg-[#B45309] cursor-pointer border-none">Issue Fine</button>
                  <button onClick={() => { setSuspendDays('7'); setSuspendModal(drawer); }}
                    className="flex-1 h-10 rounded-lg bg-[#DC2626] text-white text-[11px] font-bold hover:bg-[#B91C1C] cursor-pointer border-none">Suspend</button>
                </>
              )}
              <button onClick={() => setDrawer(null)}
                className="h-10 px-4 rounded-lg border border-[#DBE3EF] bg-white text-[#6B7A99] text-[11px] font-bold hover:bg-[#F5F7FA] cursor-pointer">Close</button>
            </div>
          </aside>
        </div>
      )}

      {/* Confirm Modal */}
      <Modal open={confirmModal !== null} title="Confirm Violation" description={`Confirm violation #${confirmModal?.id || ''} for ${confirmModal?.resident_name || 'this resident'}?`}
        confirmLabel="Confirm" onConfirm={() => runAction(confirmModal, 'confirm', { note: modalNote })} onCancel={() => setConfirmModal(null)}>
        <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={3} placeholder="Optional note..."
          className="w-full px-3 py-2 border border-[#DBE3EF] rounded-lg text-[12px] focus:outline-none focus:border-[#3D7DF2] resize-none" />
      </Modal>

      {/* Dismiss Modal */}
      <Modal open={dismissModal !== null} title="Dismiss Violation" description={`Dismiss violation #${dismissModal?.id || ''}?`}
        confirmLabel="Dismiss" danger onConfirm={() => runAction(dismissModal, 'dismiss', { note: modalNote })} onCancel={() => setDismissModal(null)}>
        <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} rows={3} placeholder="Reason for dismissal..."
          className="w-full px-3 py-2 border border-[#DBE3EF] rounded-lg text-[12px] focus:outline-none focus:border-[#3D7DF2] resize-none" />
      </Modal>

      {/* Fine Modal */}
      <Modal open={fineModal !== null} title="Issue Fine" description={`Issue a fine for violation #${fineModal?.id || ''}?`}
        confirmLabel="Issue Fine" onConfirm={() => runAction(fineModal, 'issue_fine', { amount: parseFloat(fineAmount) || 0 })} onCancel={() => setFineModal(null)}>
        <label className="block text-[11px] font-bold text-[#374151] mb-1">Fine Amount (₱)</label>
        <input type="number" value={fineAmount} onChange={e => setFineAmount(e.target.value)} min="0" step="50"
          className="w-full px-3 py-2 border border-[#DBE3EF] rounded-lg text-[12px] focus:outline-none focus:border-[#3D7DF2]" />
      </Modal>

      {/* Suspend Modal */}
      <Modal open={suspendModal !== null} title="Suspend Account" description={`Suspend ${suspendModal?.resident_name || 'this resident'}'s account?`}
        confirmLabel="Suspend" danger onConfirm={() => runAction(suspendModal, 'suspend', { days: parseInt(suspendDays) || 7 })} onCancel={() => setSuspendModal(null)}>
        <label className="block text-[11px] font-bold text-[#374151] mb-1">Suspension Duration (days)</label>
        <input type="number" value={suspendDays} onChange={e => setSuspendDays(e.target.value)} min="1" max="365"
          className="w-full px-3 py-2 border border-[#DBE3EF] rounded-lg text-[12px] focus:outline-none focus:border-[#3D7DF2]" />
      </Modal>
    </div>
  );
}
