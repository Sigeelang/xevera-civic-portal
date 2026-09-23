import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { PriorityBadge } from '../../components/Badges';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import ReportVerifyPage from './ReportVerifyPage';

const PAGE_SIZE = 10;

export default function VerifyReportsPage({ onViewReport }) {
  const showToast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingId, setViewingId] = useState(null);

  /* Server-side pagination: 10 pending reports per page */
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const params = new URLSearchParams({
        staff: 'true', status: 'Pending', limit: String(PAGE_SIZE), page: String(page),
      });
      const data = await apiFetch('reports/list.php?' + params.toString());
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch {
      setItems([]);
      setError(true);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  /* After a verify/reject the list shrinks - step back if this page emptied out */
  function refreshAfterAction() {
    if ((items || []).length <= 1 && page > 1) setPage((p) => p - 1);
    else load();
  }

  async function verify(r) {
    setBusyId(r.id);
    try {
      await apiFetch('reports/update.php', { method: 'POST', body: { id: r.id, status: 'Verified' } });
      showToast(`Report ${r.id} verified.`);
      refreshAfterAction();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(r) {
    setRejectTarget(r);
    setRejectReason('');
  }

  async function submitReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      showToast('A rejection reason is required.', 'error');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: rejectTarget.id, status: 'Rejected', rejection_reason: rejectReason.trim() },
      });
      showToast(`Report ${rejectTarget.id} rejected.`);
      setRejectTarget(null);
      refreshAfterAction();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  /* Detail verification view for one pending report */
  if (viewingId) {
    return (
      <ReportVerifyPage
        reportId={viewingId}
        onBack={() => { setViewingId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Operations"
        title="Verify Reports"
        description="Newly submitted reports awaiting verification. Confirm the report details and photos before moving them into the work queue."
      />

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-5">
        {!items ? (
          <SkeletonRows rows={5} height="h-14" />
        ) : error ? (
          <StaffErrorState message="Unable to load reports." onRetry={load} />
        ) : items.length === 0 ? (
          <StaffEmptyState title="No reports awaiting verification." description="Newly submitted reports will appear here." />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#E6EBF2] p-3 hover:bg-[#F8FAFF] transition-colors">
                {r.photos && r.photos[0] ? (
                  <img src={uploadUrl(r.photos[0])} alt="" className="w-[64px] h-[64px] rounded-lg object-cover border border-[#E5E7EB] flex-shrink-0" />
                ) : (
                  <div className="w-[64px] h-[64px] rounded-lg bg-[#F1F5F9] text-[#9CA3AF] flex items-center justify-center flex-shrink-0">
                    <Icon name="file" size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-extrabold text-[#1264e8]">{r.id}</span>
                    {r.priority === 'Urgent' && <PriorityBadge priority="Urgent" />}
                  </div>
                  <div className="text-[13px] font-bold text-[#111827] truncate" title={r.title}>{r.title}</div>
                  <div className="text-[11px] text-[#6B7280] truncate" title={`${r.category} · ${r.location || '—'} · by ${r.reporter} · ${r.date}`}>
                    {r.category} · {r.location || '—'} · by {r.reporter} · {r.date}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button type="button" onClick={() => setViewingId(r.id)}
                    className="flex-1 sm:flex-none min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB] transition-colors cursor-pointer">
                    View
                  </button>
                  <button type="button" onClick={() => verify(r)} disabled={busyId === r.id}
                    className="flex-1 sm:flex-none min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#1264e8] text-white hover:bg-[#0954c7] disabled:opacity-50 transition-colors cursor-pointer">
                    Verify
                  </button>
                  <button type="button" onClick={() => openReject(r)} disabled={busyId === r.id}
                    className="flex-1 sm:flex-none min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-[#E5E7EB] text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors cursor-pointer">
                    Reject
                  </button>
                </div>
              </div>
            ))}

            {/* PAGINATION */}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              from={(page - 1) * PAGE_SIZE + 1}
              to={Math.min(page * PAGE_SIZE, total)}
              onPage={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        open={rejectTarget !== null}
        title="Reject Report"
        description={`Reject ${rejectTarget?.id || 'this report'}? A rejection reason is required.`}
        confirmLabel="Reject Report"
        cancelLabel="Cancel"
        danger
        confirmDisabled={!rejectReason.trim()}
        onConfirm={submitReject}
        onCancel={() => setRejectTarget(null)}
      >
        <label className="block text-xs font-bold mb-1.5 text-[#111827]">Reason (required)</label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Example: The submitted information is incomplete. Please provide a clearer location and supporting photo."
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF] resize-y"
        />
      </Modal>
    </div>
  );
}

/* Compact pagination footer: Showing X–Y of Z + ‹ Previous 1 2 3 Next › */
function Pagination({ page, totalPages, total, from, to, onPage }) {
  const pageButtons = useMemo(() => {
    const t = totalPages;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, 2, page - 1, page, page + 1, t - 1, t]);
    const nums = [...set].filter((n) => n >= 1 && n <= t).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }, [totalPages, page]);

  if (!total) return null;

  const btn = 'h-8 min-w-[32px] px-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="mt-4 pt-4 border-t border-[#EDF0F5] flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-xs text-[#64748B]">
        Showing {from}–{to} of {total} pending reports
      </span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className={`${btn} bg-white border-[#DCE3ED] text-[#374151] hover:bg-[#F5F8FC]`}>
          ‹ Previous
        </button>
        {pageButtons.map((n, i) => n === '…' ? (
          <span key={`e${i}`} className="w-6 text-center text-[#9CA3AF] text-xs">…</span>
        ) : (
          <button key={n} onClick={() => onPage(n)}
            className={`${btn} ${n === page
              ? 'bg-[#1264e8] border-[#1264e8] text-white'
              : 'bg-white border-[#DCE3ED] text-[#374151] hover:bg-[#F5F8FC]'}`}>
            {n}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          className={`${btn} bg-white border-[#DCE3ED] text-[#374151] hover:bg-[#F5F8FC]`}>
          Next ›
        </button>
      </div>
    </div>
  );
}