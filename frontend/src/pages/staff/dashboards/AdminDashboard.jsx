import { useState, useEffect } from 'react';
import { apiFetch } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/Toast';
import { downloadExport, exportFilename } from '../../../services/download';
import StatCard from '../../../components/dashboard/StatCard';
import { StatusBadge } from '../../../components/Badges';
import StaffPageHeader from '../../../components/StaffPageHeader';
import Icon from '../../../components/Icon';
import { SkeletonRows } from '../../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../../components/staff/StaffStates';

const ICONS = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m5.45-5.11 3.1-6.2A2 2 0 0 1 12.29 0h1.42a2 2 0 0 1 1.74 1.01L18 6M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  clock: 'M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
};

function ModuleRow({ icon, label, value, onClick, color = 'text-[#152842]' }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-transparent border-none text-left">
      <span className="w-[30px] h-[30px] rounded-[9px] bg-[#EEF5FF] text-xevera-600 flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={14} />
      </span>
      <span className="flex-1 min-w-0 truncate text-[12px] font-semibold text-[#10233F]">{label}</span>
      <span className={`text-[13px] font-extrabold ${color}`}>{value ?? '—'}</span>
      <span className="text-[#9CA3AF] text-[12px]">›</span>
    </button>
  );
}

function ModuleCard({ title, subtitle, rows, footer, footerIcon, onFooter }) {
  return (
    <div className="bg-[#FFFFFF] rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-4 flex flex-col">
      <div className="flex items-center gap-2.5 mb-1 px-1">
        <span className="w-[30px] h-[30px] rounded-full bg-[#EEF5FF] text-xevera-600 grid place-items-center flex-shrink-0">
          <Icon name={footerIcon || 'box'} size={14} />
        </span>
        <div className="min-w-0">
          <h4 className="text-[13px] font-head font-extrabold text-[#172033] truncate">{title}</h4>
          {subtitle && <p className="text-[10px] text-[#9CA3AF] truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-2 flex-1 flex flex-col gap-0.5">
        {rows.map((r) => (
          <ModuleRow key={r.label} {...r} />
        ))}
      </div>
      <button onClick={onFooter} className="mt-2 w-full text-left px-2 py-2 rounded-lg bg-[#F8FAFC] border border-[#EEF1F6] text-[11px] font-bold text-xevera-600 hover:bg-[#EEF5FF] transition-colors cursor-pointer">
        {footer || 'View all modules'} →
      </button>
    </div>
  );
}

export default function AdminDashboard({ onNavigate, onViewReport, eyebrow = 'Admin', title = 'Admin Dashboard', description = null, activityReady, activityData, hideQuickActions = false }) {
  const { user } = useAuth();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [modules, setModules] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * Performance: when embedded in SuperAdminDashboard, the parent already
   * fetches activity/list.php (with more items). `activityReady` signals
   * that the parent finished loading and `activityData` carries the shared
   * result, so this component skips its own duplicate request.
   * Standalone (Admin role): activityReady is undefined -> fetch normally.
   */
  const parentActivityTotal = activityData
    ? (activityData.total ?? (Array.isArray(activityData.items) ? activityData.items.length : 0))
    : null;

  useEffect(() => {
    if (activityReady === false) return; // embedded: wait for parent data signal
    let mounted = true;
    setLoading(true);
    const activityPromise = parentActivityTotal !== null
      ? Promise.resolve({ total: parentActivityTotal })
      : apiFetch('activity/list.php?limit=1');
    Promise.allSettled([
      apiFetch('reports/analytics.php'),
      apiFetch('reports/stats.php'),
      apiFetch('admin/attendance-summary.php'),
      apiFetch('maintenance/events.php'),
      apiFetch('followups/stats.php'),
      apiFetch('announcements/list.php'),
      apiFetch('residents/list.php'),
      apiFetch('direct_messages/list.php?limit=1'),
      apiFetch('tasks/list.php?limit=1'),
      activityPromise,
    ]).then((results) => {
      if (!mounted) return;
      const [a, s, att, maint, fu, ann, res, msgs, tasks, act] = results.map((r) => r.status === 'fulfilled' ? r.value : null);
      setData(a || {});
      setStats(s || {});
      const attCounts = att?.counts || {};
      setModules({
        attendance: attCounts,
        followups: fu?.counts || { total: 0 },
        announcements: Array.isArray(ann) ? ann.length : 0,
        maintenance: Array.isArray(maint?.items) ? maint.items.length : 0,
        residents: Array.isArray(res) ? res.length : 0,
        messages: msgs?.unread ?? 0,
        tasks: tasks?.total ?? 0,
        activity: act?.total ?? 0,
      });
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [activityReady, parentActivityTotal]);

  if (!user) return null;

  const bs = data?.by_status || {};
  const total = bs.total ?? 0;
  const resolutionRate = total ? Math.round(((bs.Resolved ?? 0) / total) * 100) : 0;
  const attPresent = modules?.attendance?.present ?? 0;
  const attTotal = modules?.attendance?.total_staff ?? 0;
  const attPct = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

  const workMgmt = [
    { label: 'In Progress', value: stats?.in_progress ?? 0, icon: 'spinner', color: 'text-[#B45309]', onClick: () => onNavigate('in-progress') },
    { label: 'Pending Action', value: stats?.assigned ?? 0, icon: 'alert', color: 'text-[#DC2626]', onClick: () => onNavigate('pending-action') },
    { label: 'Resolved Reports', value: stats?.resolved ?? 0, icon: 'check', color: 'text-success-dark', onClick: () => onNavigate('resolved') },
    { label: 'Closed / Archived', value: stats?.closed ?? 0, icon: 'archive', color: 'text-[#6B7280]', onClick: () => onNavigate('closed') },
    { label: 'Verify Reports', value: stats?.verified ?? 0, icon: 'verify', color: 'text-[#2563EB]', onClick: () => onNavigate('verify') },
  ];
  const community = [
    { label: 'Announcements', value: modules?.announcements, icon: 'megaphone', onClick: () => onNavigate('announcements') },
    { label: 'Maintenance', value: modules?.maintenance, icon: 'wrench', onClick: () => onNavigate('maintenance') },
    { label: 'Residents', value: modules?.residents, icon: 'users', onClick: () => onNavigate('residents') },
    { label: 'Messages', value: modules?.messages, icon: 'letter', onClick: () => onNavigate('messages') },
    { label: 'Calendar', value: null, icon: 'calendar', onClick: () => onNavigate('calendar') },
  ];
  const analytics = [
    { label: 'My Performance', icon: 'chart', onClick: () => onNavigate('performance') },
    { label: 'Platform Analytics', icon: 'trend', onClick: () => onNavigate('platform-analytics') },
    { label: 'Export Reports', icon: 'download', onClick: () => onNavigate('exports') },
    { label: 'Activity Logs', value: modules?.activity, icon: 'folder', onClick: () => onNavigate('activity') },
  ];

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow={eyebrow}
        title={title}
        description={description || `Welcome back, ${user?.name || 'Admin User'}`}
      />


      {/* STATS */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[104px] rounded-[20px] border border-[#E5E7EB] bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard label="Total Reports" value={total} icon={ICONS.inbox} />
          <StatCard label="Pending Action" value={stats?.pending ?? 0} color="text-[#DC2626]" tone="#DC2626" icon={ICONS.folder} />
          <StatCard label="In Progress" value={stats?.in_progress ?? 0} color="text-[#B45309]" tone="#B45309" icon={ICONS.clock} />
          <StatCard label="Resolved Reports" value={bs.Resolved ?? 0} color="text-success-dark" tone="#16A66A" icon={ICONS.check} sub={`${resolutionRate}% resolution rate`} />
        </div>
      )}

      {/* MODULE SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <ModuleCard title="Work Management" subtitle="Report lifecycle" footerIcon="inbox" rows={workMgmt} onFooter={() => onNavigate('reports')} />
        <ModuleCard title="Community" subtitle="Community modules" footerIcon="megaphone" rows={community} onFooter={() => onNavigate('announcements')} />
        <ModuleCard title="Platform Analytics" subtitle="Reports & insights" footerIcon="trend" rows={analytics} onFooter={() => onNavigate('platform-analytics')} />
      </div>

      {/* RECENT REPORTS */}
      <div className="bg-[#FFFFFF] rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-[30px] h-[30px] rounded-full bg-[#EEF5FF] text-xevera-600 grid place-items-center"><Icon name="file" size={14} /></span>
            <h4 className="text-[13px] font-head font-extrabold text-[#172033]">Recent Reports</h4>
          </div>
          <button onClick={() => onNavigate('reports')} className="text-[11px] font-bold text-xevera-600 hover:underline cursor-pointer bg-transparent border-none">View all →</button>
        </div>
        {loading ? (
          <SkeletonRows rows={5} height="h-11" />
        ) : !data?.recent?.length ? (
          <StaffEmptyState title="No reports yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#9CA3AF] border-b border-[#E5E7EB]">
                  <th className="py-2 pr-3 font-bold">Report ID</th>
                  <th className="py-2 pr-3 font-bold">Title</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} onClick={() => onViewReport && onViewReport(r.id)}
                    className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                    <td className="py-2.5 pr-3 font-bold text-xevera-700 whitespace-nowrap">{r.id}</td>
                    <td className="py-2.5 pr-3">
                      <div className="truncate max-w-[260px] font-bold text-[#111827]">{r.title}</div>
                      <div className="text-[11px] text-[#6B7280]">{r.location}</div>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap"><StatusBadge status={r.status} /></td>
                    <td className="py-2.5 pr-3 text-[#6B7280] whitespace-nowrap">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS */}
      {!hideQuickActions && (
      <div className="bg-[#FFFFFF] rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-4">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <span className="w-[30px] h-[30px] rounded-full bg-[#EEF5FF] text-xevera-600 grid place-items-center"><Icon name="bolt" size={14} /></span>
          <h4 className="text-[13px] font-head font-extrabold text-[#172033]">Quick Actions</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <QuickBtn icon="plus" label="Create Report" onClick={() => onNavigate('reports')} />
          <QuickBtn icon="megaphone" label="Add Announcement" onClick={() => onNavigate('announcements')} />
          <QuickBtn icon="download" label="Export Reports" onClick={() => onNavigate('exports')} />
          <QuickBtn icon="calendar" label="View Calendar" onClick={() => onNavigate('calendar')} />
          <QuickBtn icon="letter" label="View Messages" onClick={() => onNavigate('messages')} />
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <button
            onClick={() => downloadExport('export/reports.php', {}, { filename: exportFilename('csv') }).then(() => showToast('Report export downloaded.')).catch(e => showToast(e.message || 'Export failed.', 'error'))}
            className="px-3 py-2 rounded-xl bg-[#F5F7FA] border border-[#E5E7EB] text-[11px] font-bold text-[#374151] hover:border-[#6B7280] transition-colors cursor-pointer">Export CSV</button>
          <button
            onClick={() => downloadExport('export/analytics_pdf.php', {}, { filename: 'xevera-analytics-' + new Date().toLocaleDateString('en-CA') + '.pdf' }).then(() => showToast('Analytics PDF downloaded.')).catch(e => showToast(e.message || 'Export failed.', 'error'))}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-xevera-600 to-xevera-700 text-white text-[11px] font-bold hover:opacity-90 transition-all duration-300 cursor-pointer shadow-[0_6px_14px_rgba(18,88,232,0.30)]">Export PDF</button>
        </div>
      </div>
      )}
    </div>
  );
}

function QuickBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-xevera-50 border border-xevera-100 text-xevera-700 hover:bg-xevera-100 transition-colors cursor-pointer text-left">
      <Icon name={icon} size={15} />
      <span className="text-[11px] font-bold leading-tight">{label}</span>
    </button>
  );
}