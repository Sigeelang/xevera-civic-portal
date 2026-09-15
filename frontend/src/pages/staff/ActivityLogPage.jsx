import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ActivityLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      const d = await apiFetch('security/login_activity.php?' + params.toString());
      setItems(d.items || []);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <StaffPageHeader
        eyebrow="Audit Logs"
        title="User Activity"
        description="Successful sign-ins recorded by the portal."
        className="mb-5"
      />

      <div className="space-y-4">
        <div className="flex gap-2.5 items-center flex-wrap">
          <input type="search" placeholder="Search user, email or IP..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
          {total > 0 && <span className="text-[11px] text-[#8B98AA] whitespace-nowrap">{total} record{total === 1 ? '' : 's'}</span>}
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5 overflow-x-auto">
          {loading ? (
            <SkeletonRows rows={6} height="h-12" />
          ) : error ? (
            <StaffErrorState message="Unable to load activity logs." onRetry={load} />
          ) : items.length === 0 ? (
            <StaffEmptyState title="No login records yet." description="Successful sign-ins are recorded here." />
          ) : (
            <table className="w-full border-collapse text-sm min-w-[640px]">
              <thead>
                <tr>
                  {['User', 'Role', 'Browser', 'Device', 'IP Address', 'Date & Time']
                    .map((h) => <th key={h} className="text-left text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB] whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-3 py-3 border-b border-[#F1F5F9]">
                      <div className="text-[#374151] font-semibold">{r.user_name || 'Unknown'}</div>
                      <div className="text-[11px] text-[#94A3B8]">{r.user_username || r.email || ''}</div>
                    </td>
                    <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.user_role || '—'}</td>
                    <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.browser || '—'}</td>
                    <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151] whitespace-nowrap">{r.device || '—'}{r.os ? ` (${r.os})` : ''}</td>
                    <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.ip || '—'}</td>
                    <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#64748B] whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">← Previous</button>
              <span className="text-[11px] text-[#8B98AA]">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Next →</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
