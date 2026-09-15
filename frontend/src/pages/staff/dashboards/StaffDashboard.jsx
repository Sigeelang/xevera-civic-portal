import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/Toast';
import StatCard from '../../../components/dashboard/StatCard';
import { StatusBadge } from '../../../components/Badges';
import StaffPageHeader from '../../../components/StaffPageHeader';
import { SkeletonRows } from '../../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../../components/staff/StaffStates';

export default function StaffDashboard({ onViewReport, onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [mine, setMine] = useState(null);
  const [mineError, setMineError] = useState(false);
  const [activity, setActivity] = useState([]);

  const load = useCallback(() => {
    setMineError(false);
    apiFetch('reports/stats.php?assigned_to=me')
      .then(setStats)
      .catch(() => setStats(null));
    apiFetch('reports/list.php?assigned_to=me&limit=30')
      .then(setMine)
      .catch(() => { setMine({ items: [], total: 0 }); setMineError(true); });
    apiFetch('activity/list.php?limit=8')
      .then((d) => setActivity(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setActivity([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const mineItems = mine?.items || [];
  const recent = mineItems.slice(0, 5);

  const card = 'bg-[#FFFFFF] rounded-[20px] border border-[#E6EBF2] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(16,24,40,0.10)] animate-rise';

  return (
    <>
      <StaffPageHeader
        eyebrow="Staff"
        title="Staff Dashboard"
        description={`Welcome back, ${user?.name || 'Staff User'}`}
        className="mb-5"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
        <StatCard label="Assigned Reports" value={stats?.total ?? '—'} icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <StatCard label="Pending Action" value={(stats?.assigned ?? 0) + (stats?.pending ?? 0)} color="text-[#B45309]" tone="#B45309" icon="M12 3 2 20h20L12 3Z" />
        <StatCard label="In Progress" value={stats?.in_progress ?? '—'} color="text-xevera-700" tone="#2563EB" icon="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        <StatCard label="Due Today" value={stats?.due_today ?? '—'} color="text-[#D98500]" tone="#D98500" icon="M12 7v5l3 2" />
        <StatCard label="Resolved This Month" value={stats?.resolved_this_month ?? '—'} color="text-success-dark" tone="#15803D" icon="M20 6 9 17l-5-5" />
      </div>

      {/* Reports This Week */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-head font-extrabold">Reports This Week</h4>
          <button onClick={() => onNavigate && onNavigate('assigned-reports')}
            className="text-[10px] font-bold text-[#1264e8] bg-transparent border-none cursor-pointer">View all</button>
        </div>
        {!stats ? (
          <SkeletonRows rows={3} height="h-8" />
        ) : (
          <div className="flex items-end gap-2 h-[140px]">
            {(stats?.week || []).map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-[#6B7280]">{d.count || ''}</div>
                <div className="w-full rounded-t-md bg-xevera-600 hover:bg-xevera-700 transition-colors"
                  style={{ height: `${(d.count / (stats.week_max || 1)) * 130}px`, opacity: 0.85 }} title={d.label} />
                <div className="text-[10px] font-bold text-[#9CA3AF]">{d.day}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Assigned */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-head font-extrabold">Recently Assigned</h4>
          <button onClick={() => onNavigate && onNavigate('assigned-reports')}
            className="text-[10px] font-bold text-[#1264e8] bg-transparent border-none cursor-pointer">View all</button>
        </div>
        {!mine ? (
          <SkeletonRows rows={4} height="h-10" />
        ) : mineError ? (
          <StaffErrorState message="Unable to load assigned reports." onRetry={load} />
        ) : recent.length === 0 ? (
          <StaffEmptyState title="No reports assigned to you yet." />
        ) : (
          <div className="flex flex-col">
            {recent.map((r) => (
              <button key={r.id} onClick={() => onViewReport && onViewReport(r.id)}
                className="w-full text-left flex items-center gap-3 py-2.5 border-b border-[#F0F2F5] last:border-b-0 hover:bg-[#F8FAFF] transition-colors cursor-pointer bg-transparent border-none">
                <span className="text-[12px] font-extrabold text-[#1264e8] w-[92px] flex-shrink-0">{r.id}</span>
                <span className="text-[12px] font-bold text-[#172033] truncate flex-1">{r.title}</span>
                <StatusBadge status={r.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-head font-extrabold">Recent Activity</h4>
          <button onClick={() => onNavigate && onNavigate('activity')}
            className="text-[10px] font-bold text-[#1264e8] bg-transparent border-none cursor-pointer">View all</button>
        </div>
        {activity.length === 0 ? (
          <StaffEmptyState title="No recent activity." />
        ) : (
          <div className="flex flex-col">
            {activity.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-[#F0F2F5] last:border-b-0">
                <span className="w-2 h-2 rounded-full mt-1.5 bg-xevera-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-[#172033] leading-snug">{a.detail || a.action}</div>
                  <div className="text-[9px] text-[#718096] mt-0.5">{a.user_name || 'System'} · {a.created_at}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}