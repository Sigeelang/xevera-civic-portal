import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StaffPageHeader from '../../components/StaffPageHeader';
import StatCard from '../../components/dashboard/StatCard';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const STATUS_COLORS = {
  Pending: '#B45309',
  Verified: '#1264e8',
  Assigned: '#1264e8',
  'In Progress': '#2563EB',
  Resolved: '#15803D',
  Closed: '#6B7280',
  Rejected: '#DC2626',
};

export default function MyPerformancePage({ onViewReport }) {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [s, l] = await Promise.all([
        apiFetch('reports/stats.php?assigned_to=me'),
        apiFetch('reports/list.php?assigned_to=me&limit=50'),
      ]);
      setStats(s);
      setItems(l.items || []);
    } catch {
      setStats(null);
      setItems([]);
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Last 7 days of activity from real report timestamps.
  const week = (() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { weekday: 'short' }), count: 0 });
    }
    const keyed = new Map(days.map((d) => [d.key, d]));
    for (const r of items || []) {
      const k = (r.created_at || '').slice(0, 10);
      if (keyed.has(k)) keyed.get(k).count += 1;
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return { days, max };
  })();

  const bars = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected']
    .map((s) => ({ status: s, count: stats?.[s.toLowerCase().replace(/\s+/g, '_')] || 0 }))
    .filter((b) => b.count > 0);
  const barMax = Math.max(1, ...bars.map((b) => b.count));

  const card = 'bg-white rounded-[18px] border border-[#E5E7EB] p-5';
  const recent = (items || []).slice(0, 6);

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Reporting & Insights"
        title="My Performance"
        description="Your report-handling statistics, drawn from your assigned work."
      />

      {error ? (
        <StaffErrorState message="Unable to load your performance data." onRetry={load} />
      ) : !stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"><SkeletonRows rows={2} height="h-24" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Reports Handled" value={stats.total || 0} icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <StatCard label="Resolved" value={stats.resolved || 0} color="text-success-dark" icon="M20 6 9 17l-5-5" />
            <StatCard label="In Progress" value={stats.in_progress || 0} color="text-xevera-700" tone="#2563EB" icon="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            <StatCard label="Pending Action" value={(stats.assigned || 0) + (stats.pending || 0)} color="text-[#B45309]" tone="#B45309" icon="M12 3 2 20h20L12 3Z" />
            <StatCard label="Avg Resolve" value={stats.avg_resolve_days != null ? stats.avg_resolve_days + 'd' : '—'} color="text-[#6B7280]" tone="#6B7280" icon="M12 7v5l3 2" />
            <StatCard label="Resolved This Month" value={stats.resolved_this_month || 0} color="text-success-dark" tone="#15803D" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Weekly activity */}
            <div className={card}>
              <h4 className="text-sm font-head font-extrabold mb-4">Reports Handled — Last 7 Days</h4>
              <div className="flex items-end gap-2 h-[160px]">
                {week.days.map((d) => (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.key} · ${d.count}`}>
                    <div className="w-full rounded-t-md bg-[#1264e8] transition-all" style={{ height: Math.max(4, (d.count / week.max) * 120) }} />
                    <span className="text-[9px] text-[#6B7280]">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status breakdown */}
            <div className={card}>
              <h4 className="text-sm font-head font-extrabold mb-4">Your Reports by Status</h4>
              {bars.length === 0 ? (
                <StaffEmptyState title="No status data yet." />
              ) : (
                <div className="flex flex-col gap-3">
                  {bars.map((b) => (
                    <div key={b.status} className="flex items-center gap-3">
                      <span className="w-[90px] text-[11px] font-semibold text-[#374151] flex-shrink-0">{b.status}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: Math.max(4, (b.count / barMax) * 100) + '%', background: STATUS_COLORS[b.status] }} />
                      </div>
                      <span className="w-7 text-right text-[11px] font-bold text-[#111827] flex-shrink-0">{b.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent assigned work */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-head font-extrabold">Recent Assigned Work</h4>
            </div>
            {recent.length === 0 ? (
              <StaffEmptyState title="No assigned reports yet." />
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((r) => (
                  <button key={r.id} onClick={() => onViewReport && onViewReport(r.id)}
                    className="w-full text-left flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#F8FAFF] transition-colors cursor-pointer bg-transparent border-none">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLORS[r.status] ? '' : 'bg-[#D1D5DB]'}`} style={STATUS_COLORS[r.status] ? { background: STATUS_COLORS[r.status] } : undefined} />
                    <span className="text-[12px] font-extrabold text-[#1264e8] w-[92px] flex-shrink-0">{r.id}</span>
                    <span className="text-[13px] font-bold text-[#111827] truncate flex-1">{r.title}</span>
                    <span className="text-[11px] text-[#6B7280] flex-shrink-0">{r.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}