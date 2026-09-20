import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pager from '../../components/Pager';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const STATUS_STYLES = {
  'Under Review': { bg: 'bg-[#FFF3CD]', text: 'text-[#B8860B]', dot: 'bg-[#F59E0B]' },
  'Confirmed': { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
  'Dismissed': { bg: 'bg-[#E7F8EF]', text: 'text-[#159957]', dot: 'bg-[#159957]' },
};

const TYPES = ['All', 'Short Description', 'Duplicate Submission', 'Rapid Submission', 'Other'];
const STATUSES = ['All', 'Under Review', 'Confirmed', 'Dismissed'];

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-[18px] shadow-[0_4px_18px_rgba(15,35,65,0.06)]">
      <div className="flex items-center gap-3">
        <span className={`w-[38px] h-[38px] rounded-[10px] grid place-items-center text-[20px] flex-shrink-0 ${color}`}>{icon}</span>
        <span className="text-[12px] font-bold text-[#102544]">{label}</span>
      </div>
      <div className="mt-3 text-[28px] leading-none font-extrabold tracking-[-0.5px] text-[#102544]">{value ?? '\u2014'}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES['Under Review'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function TimelineStep({ label, date, active, done }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${done ? 'bg-xevera-600 border-xevera-600' : active ? 'bg-white border-xevera-600' : 'bg-white border-[#D1D5DB]'}`} />
        <div className={`w-0.5 flex-1 min-h-[20px] ${done ? 'bg-xevera-600' : 'bg-[#E5E7EB]'}`} />
      </div>
      <div className="pb-4">
        <div className={`text-[12px] font-bold ${done || active ? 'text-[#152348]' : 'text-[#9CA3AF]'}`}>{label}</div>
        {date && <div className="text-[10px] text-[#71819A] mt-0.5">{date}</div>}
      </div>
    </div>
  );
}

function ImageLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <img src={src} alt="Evidence" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-[16px] text-[#374151] hover:bg-[#F3F4F6] cursor-pointer border-none">&times;</button>
      </div>
    </div>
  );
}

export default function ViolationReportsPage({ onNavigate }) {
  const { user } = useAuth();
  const showToast = useToast();

  const [items, setItems] = useState(null);
  const [stats, setStats] = useState({ total: 0, under_review: 0, confirmed: 0, dismissed: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [dismissModal, setDismissModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const p = new URLSearchParams({ page, limit: perPage });
      if (status !== 'All') p.set('status', status);
      if (type !== 'All') p.set('type', type);
      if (search) p.set('search', search);
      if (dateFrom) p.set('date_from', dateFrom);
      if (dateTo) p.set('date_to', dateTo);
      const data = await apiFetch('reports/flagged.php?' + p.toString());
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setStats(data.stats || { total: 0, under_review: 0, confirmed: 0, dismissed: 0 });
    } catch {
      setError(true);
      setItems(null);
    }
  }, [page, perPage, status, type, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, type, search, dateFrom, dateTo]);

  const openDetail = async (item) => {
    setSelected(item);
    setDetailLoading(true);
    try {
      const data = await apiFetch('reports/get.php?id=' + item.db_id);
      setDetail(data.report || data);
    } catch {
      setDetail(item);
    }
    setDetailLoading(false);
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  const doDismiss = async () => {
    if (!dismissModal) return;
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: dismissModal.db_id, is_suspicious: 0, suspicion_reason: null, staff_notes: 'Dismissed by ' + (user?.name || 'Admin') },
      });
      showToast('Report dismissed.', 'success');
      setDismissModal(null);
      load();
      if (selected && selected.db_id === dismissModal.db_id) closeDetail();
    } catch {
      showToast('Failed to dismiss.', 'error');
    }
    setBusy(false);
  };

  const doConfirm = async () => {
    if (!confirmModal) return;
    setBusy(true);
    try {
      await apiFetch('violations/create.php', {
        method: 'POST',
        body: { report_id: confirmModal.db_id, violation_type: 'Fake Report', severity: 'Major', reason: confirmModal.suspicion_reason || 'Report flagged as suspicious', penalty_amount: 1000 },
      });
      showToast('Violation created.', 'success');
      setConfirmModal(null);
      load();
      if (selected && selected.db_id === confirmModal.db_id) closeDetail();
    } catch {
      showToast('Failed to create violation.', 'error');
    }
    setBusy(false);
  };

  const exportCSV = () => {
    if (!items || items.length === 0) { showToast('No data to export.', 'info'); return; }
    var headers = ['Report ID', 'Title', 'Category', 'Reporter', 'Date', 'Status', 'Suspicion Reason'];
    var rows = items.map(function(r) { return [r.id, r.title, r.category, r.reporter_name, r.date, r.violation_status || 'Under Review', r.suspicion_reason || '']; });
    var csv = [headers].concat(rows).map(function(row) { return row.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'violation-reports.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV.', 'success');
  };

  var viewStatus = selected ? (detail ? (detail.violation_status || (detail.is_suspicious ? 'Under Review' : null)) : null) : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <StaffPageHeader
        eyebrow="Admin"
        title="Violation Reports"
        description="Manage and review reports flagged as suspicious or fake."
        actions={
          <>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Export</button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white bg-xevera-600 rounded-lg hover:bg-xevera-700 cursor-pointer">Refresh</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
        <StatCard icon={'\u{1F6A9}'} label="Total Flagged" value={stats.total} color="bg-[#FFE9E9] text-[#E53535]" />
        <StatCard icon={'\u{1F50D}'} label="Under Review" value={stats.under_review} color="bg-[#FFF4DF] text-[#F57C00]" />
        <StatCard icon={'\u26A0\uFE0F'} label="Confirmed" value={stats.confirmed} color="bg-[#FEE2E2] text-[#DC2626]" />
        <StatCard icon={'\u2705'} label="Dismissed" value={stats.dismissed} color="bg-[#E7F8EF] text-[#159957]" />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-4 mb-6 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input type="text" value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search by ID, title, or resident..." className="w-full px-3 py-2 border border-[#D5DEEA] rounded-lg text-[12px] outline-none focus:border-xevera-600" />
          </div>
          <select value={status} onChange={function(e) { setStatus(e.target.value); }} className="px-3 py-2 border border-[#D5DEEA] rounded-lg text-[12px] outline-none bg-white cursor-pointer">
            {STATUSES.map(function(s) { return <option key={s}>{s}</option>; })}
          </select>
          <select value={type} onChange={function(e) { setType(e.target.value); }} className="px-3 py-2 border border-[#D5DEEA] rounded-lg text-[12px] outline-none bg-white cursor-pointer">
            {TYPES.map(function(t) { return <option key={t}>{t}</option>; })}
          </select>
          <input type="date" value={dateFrom} onChange={function(e) { setDateFrom(e.target.value); }} className="px-3 py-2 border border-[#D5DEEA] rounded-lg text-[12px] outline-none" />
          <span className="text-[11px] text-[#71819A]">to</span>
          <input type="date" value={dateTo} onChange={function(e) { setDateTo(e.target.value); }} className="px-3 py-2 border border-[#D5DEEA] rounded-lg text-[12px] outline-none" />
        </div>
      </div>

      {!selected && (
        <div className="bg-white border border-[#E2E8F0] rounded-[11px] shadow-[0_2px_8px_rgba(18,38,75,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Report ID</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Description</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Type</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Resident</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {error && <tr><td colSpan={7}><StaffErrorState message="Unable to load flagged reports." onRetry={load} /></td></tr>}
                {!items && !error && <SkeletonRows cols={7} />}
                {items && items.length === 0 && <tr><td colSpan={7}><StaffEmptyState title="No flagged reports." description="No reports match your filters." /></td></tr>}
                {items && items.map(function(r) {
                  var st = r.violation_status || 'Under Review';
                  return (
                    <tr key={r.id} className="hover:bg-[#F8FAFC] cursor-pointer group" onClick={function() { openDetail(r); }}>
                      <td className="px-4 py-3 text-[11px] font-bold text-[#152348]">{r.id}</td>
                      <td className="px-4 py-3 text-[11px] text-[#374151] max-w-[220px] truncate group-hover:text-[#1769ED] transition-colors" title={r.title || r.description}>{r.title || r.description}</td>
                      <td className="px-4 py-3 text-[11px] text-[#374151]">{r.category}</td>
                      <td className="px-4 py-3 text-[11px] text-[#374151]">{r.reporter_name}</td>
                      <td className="px-4 py-3 text-[11px] text-[#71819A] whitespace-nowrap">{r.date}</td>
                      <td className="px-4 py-3"><StatusBadge status={st} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={function(e) { e.stopPropagation(); }}>
                          {st === 'Under Review' && (
                            <>
                              <button onClick={function() { setConfirmModal(r); }} className="px-2.5 py-1.5 text-[10px] font-bold text-white bg-[#0F8F63] rounded hover:bg-[#0B7A55] cursor-pointer border-none">Confirm</button>
                              <button onClick={function() { setDismissModal(r); }} className="px-2.5 py-1.5 text-[10px] font-bold text-[#E53535] bg-white border border-[#F2B9B9] rounded hover:bg-[#FEF2F2] cursor-pointer">Dismiss</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E8F0] flex items-center justify-between">
            <div className="text-[10px] text-[#6B7A99]">{total} report{total !== 1 ? 's' : ''}</div>
            <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={closeDetail} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">
              <span className="text-[14px]">&#8592;</span> Back to List
            </button>
            <h2 className="text-[18px] font-extrabold text-[#172F60]">Report {selected.id}</h2>
            <StatusBadge status={viewStatus || 'Under Review'} />
          </div>

          {detailLoading ? (
            <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-8 text-center text-[12px] text-[#71819A]">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                  <div className="text-[14px] font-extrabold text-[#172F60] mb-4">Report Information</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-[10px] text-[#8391A7] mb-1">Report ID</div><div className="text-[12px] font-bold text-[#172D50]">{selected.id}</div></div>
                    <div><div className="text-[10px] text-[#8391A7] mb-1">Category</div><div className="text-[12px] font-bold text-[#172D50]">{selected.category || '\u2014'}</div></div>
                    <div><div className="text-[10px] text-[#8391A7] mb-1">Suspicion Reason</div><div className="text-[12px] font-bold text-[#172D50]">{selected.suspicion_reason || 'Fake Report'}</div></div>
                    <div><div className="text-[10px] text-[#8391A7] mb-1">Location</div><div className="text-[12px] font-bold text-[#172D50]">{selected.location || '\u2014'}</div></div>
                    <div><div className="text-[10px] text-[#8391A7] mb-1">Date Submitted</div><div className="text-[12px] font-bold text-[#172D50]">{selected.date}</div></div>
                  </div>
                  <div className="mt-4"><div className="text-[10px] text-[#8391A7] mb-1">Description</div><div className="text-[12px] text-[#374151] leading-relaxed bg-[#F8FAFC] rounded-lg p-3">{selected.description}</div></div>
                </div>

                {selected.photos && selected.photos.length > 0 && (
                  <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                    <div className="text-[14px] font-extrabold text-[#172F60] mb-3">Photo Evidence</div>
                    <div className="flex gap-3 flex-wrap">
                      {selected.photos.map(function(p, i) {
                        return (
                          <div key={i} className="w-[100px] h-[80px] rounded-lg overflow-hidden cursor-pointer border border-[#E2E8F0] hover:opacity-80" onClick={function() { setLightbox(p); }}>
                            <img src={p} alt={'Evidence ' + (i + 1)} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {viewStatus && viewStatus !== 'Under Review' && (
                  <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                    <div className="text-[14px] font-extrabold text-[#172F60] mb-3">Final Decision</div>
                    <StatusBadge status={viewStatus} />
                    {selected.violation_id && <div className="mt-2 text-[11px] text-[#71819A]">Violation #{selected.violation_id} created</div>}
                    {selected.violation_type && <div className="text-[11px] text-[#71819A]">Type: {selected.violation_type}</div>}
                    {selected.severity && <div className="text-[11px] text-[#71819A]">Severity: {selected.severity}</div>}
                    {selected.fine != null && <div className="text-[11px] text-[#71819A]">Fine: {'\u20B1'}{Number(selected.fine).toLocaleString()}</div>}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                  <div className="text-[14px] font-extrabold text-[#172F60] mb-4">Verification & Decision</div>
                  <TimelineStep label="Submitted" date={selected.date} done={true} />
                  <TimelineStep label="Under Review" active={viewStatus === 'Under Review'} done={viewStatus === 'Confirmed' || viewStatus === 'Dismissed'} />
                  <TimelineStep label={viewStatus === 'Dismissed' ? 'Dismissed' : 'Confirmed'} date={viewStatus !== 'Under Review' ? selected.date : undefined} done={viewStatus === 'Confirmed' || viewStatus === 'Dismissed'} />
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                  <div className="text-[14px] font-extrabold text-[#172F60] mb-3">Reporter Information</div>
                  <div className="space-y-2">
                    <div><div className="text-[10px] text-[#8391A7]">Name</div><div className="text-[12px] font-bold text-[#172D50]">{selected.reporter_name || '\u2014'}</div></div>
                    <div><div className="text-[10px] text-[#8391A7]">Email</div><div className="text-[12px] font-bold text-[#172D50]">{selected.reporter_email || '\u2014'}</div></div>
                  </div>
                </div>

                {viewStatus === 'Under Review' && (
                  <div className="bg-white border border-[#E2E8F0] rounded-[11px] p-5 shadow-[0_2px_8px_rgba(18,38,75,0.04)]">
                    <div className="text-[14px] font-extrabold text-[#172F60] mb-3">Final Decision</div>
                    <div className="space-y-2">
                      <button onClick={function() { setConfirmModal(selected); }} className="w-full h-10 rounded-lg bg-[#0F8F63] text-white text-[11px] font-bold hover:bg-[#0B7A55] cursor-pointer border-none">Confirm Violation</button>
                      <button onClick={function() { setDismissModal(selected); }} className="w-full h-10 rounded-lg border border-[#F2B9B9] bg-white text-[#E53535] text-[11px] font-bold hover:bg-[#FEF2F2] cursor-pointer">Dismiss Report</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {lightbox && <ImageLightbox src={lightbox} onClose={function() { setLightbox(null); }} />}

      <Modal open={!!confirmModal} title="Confirm Violation" description={'Create a violation for report ' + (confirmModal ? confirmModal.id : '') + '? This action confirms the report is fake.'}
        onClose={function() { setConfirmModal(null); }}
        actions={
          <>
            <button onClick={function() { setConfirmModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doConfirm} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#0F8F63] rounded-lg hover:bg-[#0B7A55] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Confirm'}</button>
          </>
        }
      />

      <Modal open={!!dismissModal} title="Dismiss Report" description={'Dismiss report ' + (dismissModal ? dismissModal.id : '') + '? The reporter will be notified.'}
        onClose={function() { setDismissModal(null); }}
        actions={
          <>
            <button onClick={function() { setDismissModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doDismiss} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#E53535] rounded-lg hover:bg-[#DC2626] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Dismiss'}</button>
          </>
        }
      />
    </div>
  );
}
