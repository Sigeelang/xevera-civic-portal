import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import Icon from '../../../components/Icon';
import StaffPageHeader from '../../../components/StaffPageHeader';
import { SkeletonRows } from '../../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../../components/staff/StaffStates';

const STATUS_CLS = {
  'In Progress': 'bg-[#E8F2FF] text-[#166AD8]',
  'Pending': 'bg-[#FFF1DB] text-[#C97808]',
  'Assigned': 'bg-[#E8F2FF] text-[#166AD8]',
  'Closed': 'bg-[#EDF1F5] text-[#50647D]',
  'Resolved': 'bg-[#E3F7EB] text-[#148448]',
  'Verified': 'bg-[#F0F0FF] text-[#6B46C1]',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2.5 py-[3px] rounded-full text-[10px] font-bold ${STATUS_CLS[status] || 'bg-[#F3F4F6] text-[#6B7280]'}`}>
      {status}
    </span>
  );
}

function PriorityTask({ r, onClick }) {
  const now = new Date();
  const due = r.due_date ? new Date(r.due_date.replace(' ', 'T')) : null;
  const isOverdue = due && due < now && r.status !== 'Resolved' && r.status !== 'Closed';
  const isToday = due && due.toDateString() === now.toDateString();
  const dotColor = isOverdue ? 'bg-[#E22B35]' : isToday ? 'bg-[#EF8B16]' : 'bg-[#1C74E8]';
  const dueLabel = isOverdue
    ? `${Math.ceil((now - due) / 86400000)}d overdue`
    : isToday
    ? `Due ${due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : due
    ? `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <button
      onClick={() => onClick && onClick(r.id)}
      className="w-full text-left flex items-start gap-2.5 py-3 px-3 rounded-lg border border-[#E3E9F0] mb-2 hover:bg-[#F8FAFF] transition-colors cursor-pointer bg-transparent"
    >
      <span className={`w-[9px] h-[9px] rounded-full mt-1 flex-shrink-0 ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-[#0870E8]">{r.id}</div>
        <div className="text-[12px] font-bold text-[#172033] mt-0.5">{r.title}</div>
        <div className="text-[10px] text-[#66778E] mt-0.5 truncate">{r.description || r.location || ''}</div>
      </div>
      {dueLabel && (
        <span className={`text-[11px] font-bold flex-shrink-0 ${isOverdue ? 'text-[#E22B35]' : isToday ? 'text-[#EF8B16]' : 'text-[#667892]'}`}>
          {dueLabel} ›
        </span>
      )}
    </button>
  );
}

export default function StaffDashboard({ onViewReport, onNavigate }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [mine, setMine] = useState(null);
  const [mineError, setMineError] = useState(false);

  const load = useCallback(() => {
    setMineError(false);
    apiFetch('reports/stats.php?assigned_to=me')
      .then(setStats)
      .catch(() => setStats(null));
    apiFetch('reports/list.php?assigned_to=me&limit=30')
      .then(setMine)
      .catch(() => { setMine({ items: [], total: 0 }); setMineError(true); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const mineItems = mine?.items || [];
  const recent = mineItems.slice(0, 5);
  const priority = mineItems
    .filter((r) => r.status === 'Assigned' || r.status === 'In Progress' || r.status === 'Pending')
    .sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date) : new Date(9999, 0);
      const db = b.due_date ? new Date(b.due_date) : new Date(9999, 0);
      return da - db;
    })
    .slice(0, 3);

  const card = 'bg-[#FFFFFF] rounded-[12px] border border-[#E3EAF2] shadow-[0_2px_7px_rgba(23,47,78,.04)]';
  const kpiIcon = 'w-[42px] h-[42px] rounded-[9px] grid place-items-center flex-shrink-0';

  return (
    <>
      <StaffPageHeader
        eyebrow="Staff"
        title="Staff Dashboard"
        description={`Welcome back, ${user?.name || 'Staff User'}`}
        className="mb-5"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[11px] mb-[14px]">
        <a onClick={() => onNavigate('assigned-reports')} className={`${card} p-4 flex items-center gap-3 hover:-translate-y-[2px] hover:shadow-[0_5px_14px_rgba(23,47,78,.09)] hover:border-[#CBD9E8] transition-all cursor-pointer`}>
          <span className={`${kpiIcon} bg-[#EDF5FF] text-[#126BE4]`}><Icon name="inbox" size={21} /></span>
          <div>
            <div className="text-[10px] font-bold text-[#657A95] uppercase tracking-wider">Assigned Reports</div>
            <div className="text-[25px] font-[750] text-[#10233F] leading-tight">{stats?.total ?? '—'}</div>
            <div className="text-[11px] text-[#6D7E94]">Reports assigned to you</div>
          </div>
        </a>
        <a onClick={() => onNavigate('pending-action')} className={`${card} p-4 flex items-center gap-3 hover:-translate-y-[2px] hover:shadow-[0_5px_14px_rgba(23,47,78,.09)] hover:border-[#CBD9E8] transition-all cursor-pointer`}>
          <span className={`${kpiIcon} bg-[#FFF0F1] text-[#E22B35]`}><Icon name="alert" size={21} /></span>
          <div>
            <div className="text-[10px] font-bold text-[#657A95] uppercase tracking-wider">Pending Action</div>
            <div className="text-[25px] font-[750] text-[#10233F] leading-tight">{(stats?.assigned ?? 0) + (stats?.pending ?? 0)}</div>
            <div className="text-[11px] text-[#6D7E94]">Requires your action</div>
          </div>
        </a>
        <a onClick={() => onNavigate('in-progress')} className={`${card} p-4 flex items-center gap-3 hover:-translate-y-[2px] hover:shadow-[0_5px_14px_rgba(23,47,78,.09)] hover:border-[#CBD9E8] transition-all cursor-pointer`}>
          <span className={`${kpiIcon} bg-[#EDF5FF] text-[#126BE4]`}><Icon name="spinner" size={21} /></span>
          <div>
            <div className="text-[10px] font-bold text-[#657A95] uppercase tracking-wider">In Progress</div>
            <div className="text-[25px] font-[750] text-[#10233F] leading-tight">{stats?.in_progress ?? '—'}</div>
            <div className="text-[11px] text-[#6D7E94]">Currently working on</div>
          </div>
        </a>
        <a onClick={() => onNavigate('assigned-reports')} className={`${card} p-4 flex items-center gap-3 hover:-translate-y-[2px] hover:shadow-[0_5px_14px_rgba(23,47,78,.09)] hover:border-[#CBD9E8] transition-all cursor-pointer`}>
          <span className={`${kpiIcon} bg-[#FFF5E9] text-[#EF8B16]`}><Icon name="clock" size={21} /></span>
          <div>
            <div className="text-[10px] font-bold text-[#657A95] uppercase tracking-wider">Due Today</div>
            <div className="text-[25px] font-[750] text-[#10233F] leading-tight">{stats?.due_today ?? '—'}</div>
            <div className="text-[11px] text-[#6D7E94]">Reports due today</div>
          </div>
        </a>
        <a onClick={() => onNavigate('resolved')} className={`${card} p-4 flex items-center gap-3 hover:-translate-y-[2px] hover:shadow-[0_5px_14px_rgba(23,47,78,.09)] hover:border-[#CBD9E8] transition-all cursor-pointer`}>
          <span className={`${kpiIcon} bg-[#EBF9F0] text-[#129447]`}><Icon name="check" size={21} /></span>
          <div>
            <div className="text-[10px] font-bold text-[#657A95] uppercase tracking-wider">Resolved This Month</div>
            <div className="text-[25px] font-[750] text-[#10233F] leading-tight">{stats?.resolved_this_month ?? '—'}</div>
            <div className="text-[11px] text-[#6D7E94]">Reports you resolved</div>
          </div>
        </a>
      </div>

      {/* Middle: Chart + Priority Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[13px] mb-[14px]">
        {/* Reports This Week Chart */}
        <div className={card + ' p-4'}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[16px] font-bold text-[#10233F] m-0">Reports This Week</h2>
              <span className="text-[11px] text-[#6B7D94]">Number of reports assigned to you</span>
            </div>
          </div>
          {!stats ? (
            <SkeletonRows rows={3} height="h-8" />
          ) : (
            <div className="relative h-[205px] flex items-end gap-[22px] px-[18px] pb-[25px] border-b border-[#DFE7F0]">
              {/* Grid lines */}
              <div className="absolute left-[18px] right-[18px] border-t border-[#EDF1F5]" style={{ bottom: '25%' }} />
              <div className="absolute left-[18px] right-[18px] border-t border-[#EDF1F5]" style={{ bottom: '50%' }} />
              <div className="absolute left-[18px] right-[18px] border-t border-[#EDF1F5]" style={{ bottom: '75%' }} />
              {(stats?.week || []).map((d) => {
                const max = stats.week_max || 1;
                const pct = Math.round((d.count / max) * 100);
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full z-[1]">
                    {d.count > 0 && <span className="text-[11px] font-bold mb-1">{d.count}</span>}
                    <div className="w-[52%] max-w-[48px] rounded-t-[4px] bg-[#4D91EA] hover:bg-[#3A7FD6] transition-colors" style={{ height: `${Math.max(5, pct)}%`, minHeight: '5px' }} title={`${d.label}: ${d.count}`} />
                    <span className="text-[10px] text-[#5F7189] mt-[7px]">{d.day}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Priority Tasks */}
        <div className={card + ' p-4'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#10233F] m-0">My Priority Tasks</h2>
            <button onClick={() => onNavigate('assigned-reports')} className="text-[11px] font-bold text-[#0870E8] bg-transparent border-none cursor-pointer hover:underline">View all →</button>
          </div>
          {!mine ? (
            <SkeletonRows rows={3} height="h-14" />
          ) : priority.length === 0 ? (
            <StaffEmptyState title="No priority tasks." />
          ) : (
            priority.map((r) => <PriorityTask key={r.id} r={r} onClick={onViewReport} />)
          )}
        </div>
      </div>

      {/* Recently Assigned Table */}
      <div className={card + ' overflow-hidden'}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3EAF2]">
          <h2 className="text-[16px] font-bold text-[#10233F] m-0">Recently Assigned</h2>
          <button onClick={() => onNavigate('assigned-reports')} className="text-[11px] font-bold text-[#0870E8] bg-transparent border-none cursor-pointer hover:underline">View all →</button>
        </div>
        {!mine ? (
          <div className="p-4"><SkeletonRows rows={4} height="h-10" /></div>
        ) : mineError ? (
          <div className="p-4"><StaffErrorState message="Unable to load assigned reports." onRetry={load} /></div>
        ) : recent.length === 0 ? (
          <div className="p-4"><StaffEmptyState title="No reports assigned to you yet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#F7F9FC]">
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Report ID</th>
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Category</th>
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Description</th>
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Date Assigned</th>
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Status</th>
                  <th className="text-left text-[10px] font-bold text-[#647791] px-3 py-[9px] border-b border-[#E3EAF2]">Action</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== 'Resolved' && r.status !== 'Closed';
                  return (
                    <tr key={r.id} className="hover:bg-[#F8FAFF] transition-colors">
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5] font-bold text-[#0870E8] whitespace-nowrap cursor-pointer" onClick={() => onViewReport && onViewReport(r.id)}>{r.id}</td>
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5] whitespace-nowrap text-[#10233F] font-semibold">{r.title || r.category}</td>
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5] text-[#667892] max-w-[200px] truncate">{r.description || r.location || ''}</td>
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5] whitespace-nowrap text-[#667892]">{r.date}</td>
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5]"><StatusPill status={r.status} /></td>
                      <td className="px-3 py-[9px] border-b border-[#EDF1F5]">
                        <button onClick={() => onViewReport && onViewReport(r.id)}
                          className="bg-[#EDF5FF] border-0 rounded-full px-[13px] py-[5px] text-[#0870E8] font-bold text-[10px] cursor-pointer hover:bg-[#DCECFF] transition-colors">
                          {r.status === 'Resolved' || r.status === 'Closed' ? 'View' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
