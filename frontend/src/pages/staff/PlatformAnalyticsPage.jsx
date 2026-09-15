import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StaffPageHeader from '../../components/StaffPageHeader';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import ExportReportsPage from './ExportReportsPage';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'chart' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'reports', label: 'Reports', icon: 'inbox' },
  { key: 'activity', label: 'Activity', icon: 'clipboardcheck' },
  { key: 'export', label: 'Export', icon: 'download' },
];

const ROLE_COLORS = {
  'Super Admin': { bg: 'bg-[#F0F0FF]', text: 'text-[#6B46C1]' },
  'Admin': { bg: 'bg-[#E8F2FF]', text: 'text-[#166AD8]' },
  'Staff': { bg: 'bg-[#E3F7EB]', text: 'text-[#148448]' },
  'Resident': { bg: 'bg-[#FFF1DB]', text: 'text-[#C97808]' },
};

function MiniBarChart({ data, maxVal, color = '#4D91EA', height = 120 }) {
  const mx = maxVal || Math.max(1, ...data.map(d => d.count));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d) => {
        const pct = Math.round((d.count / mx) * 100);
        return (
          <div key={d.date || d.day} className="flex-1 flex flex-col items-center justify-end h-full">
            {d.count > 0 && <span className="text-[9px] font-bold mb-0.5">{d.count}</span>}
            <div className="w-full rounded-t-sm hover:opacity-80 transition-opacity" style={{ height: `${Math.max(3, pct)}%`, background: color, minHeight: '3px' }} title={`${d.date || d.day}: ${d.count}`} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon, value, label, color = '#166AD8' }) {
  return (
    <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-4 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0" style={{ background: `${color}15`, color }}>
          <Icon name={icon} size={18} />
        </span>
        <div>
          <div className="text-[22px] font-[750] text-[#10233F] leading-tight">{value ?? '—'}</div>
          <div className="text-[11px] font-semibold text-[#6B7D94]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data, colors }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <div className="text-[12px] text-[#9CA3AF] text-center py-8">No data</div>;
  let cumulative = 0;
  const segments = data.filter(d => d.count > 0).map((d, i) => {
    const pct = (d.count / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start, color: colors[i % colors.length] };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-[120px] h-[120px] flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {segments.map((s, i) => (
            <circle key={i} cx="18" cy="18" r="14" fill="none" stroke={s.color} strokeWidth="5"
              strokeDasharray={`${s.pct} ${100 - s.pct}`} strokeDashoffset={`${-s.start}`}
              className="transition-all duration-500" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[18px] font-[750] text-[#10233F]">{total}</span>
          <span className="text-[9px] text-[#9CA3AF]">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[#6B7280] font-semibold min-w-[70px]">{s.label}</span>
            <span className="font-bold text-[#111827]">{s.count}</span>
            <span className="text-[#9CA3AF]">({Math.round(s.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ data }) {
  const chartColors = ['#166AD8', '#15803D', '#E22B35', '#F59E0B', '#6B46C1'];
  const statusData = Object.entries(data.reports.by_status || {}).map(([label, count]) => ({ label, count }));
  const roleData = Object.entries(data.users.by_role || {}).map(([label, count]) => ({ label, count }));

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="users" value={data.users.total} label="Total Users" color="#166AD8" />
        <StatCard icon="inbox" value={data.reports.total} label="Total Reports" color="#15803D" />
        <StatCard icon="clock" value={data.logins.today} label="Logins Today" color="#F59E0B" />
        <StatCard icon="alert" value={data.reports.urgent_open} label="Urgent Open" color="#E22B35" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">User Growth</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 30 days</span>
          <div className="mt-3">
            <MiniBarChart data={data.users.growth} color="#166AD8" height={130} />
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Report Submissions</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 30 days</span>
          <div className="mt-3">
            <MiniBarChart data={data.reports.growth} color="#15803D" height={130} />
          </div>
        </div>
      </div>

      {/* Distribution Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Report Status</h3>
          <DonutChart data={statusData} colors={chartColors} />
        </div>
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Users by Role</h3>
          <DonutChart data={roleData} colors={chartColors} />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="check" value={data.reports.this_week} label="Reports This Week" color="#15803D" />
        <StatCard icon="eye" value={data.logins.active_now} label="Active Now" color="#166AD8" />
        <StatCard icon="letter" value={data.email.otp_sent_week} label="OTPs Sent (7d)" color="#F59E0B" />
        <StatCard icon="shield" value={data.logins.failed_week} label="Failed Logins (7d)" color="#E22B35" />
      </div>
    </div>
  );
}

function UsersTab({ data }) {
  const roleData = Object.entries(data.users.by_role || {}).map(([label, count]) => ({ label, count }));
  const chartColors = ['#6B46C1', '#166AD8', '#15803D', '#F59E0B'];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="users" value={data.users.total} label="Total Users" color="#166AD8" />
        <StatCard icon="check" value={data.users.active} label="Active" color="#15803D" />
        <StatCard icon="x" value={data.users.inactive} label="Inactive" color="#E22B35" />
        <StatCard icon="plus" value={data.users.new_month} label="New (30d)" color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Growth Chart */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">User Registrations</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 30 days — Today: {data.users.new_today} · Week: {data.users.new_week} · Month: {data.users.new_month}</span>
          <div className="mt-3">
            <MiniBarChart data={data.users.growth} color="#166AD8" height={150} />
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Role Distribution</h3>
          <DonutChart data={roleData} colors={chartColors} />
        </div>
      </div>

      {/* Role Breakdown Table */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,.04)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[14px] font-bold text-[#10233F]">Account Breakdown</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Role</th>
              <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Count</th>
              <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {roleData.map((r) => {
              const colors = ROLE_COLORS[r.label] || { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' };
              const pct = data.users.total > 0 ? Math.round((r.count / data.users.total) * 100) : 0;
              return (
                <tr key={r.label} className="border-t border-[#F1F5F9] hover:bg-[#F9FAFB]">
                  <td className="px-5 py-2.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>{r.label}</span>
                  </td>
                  <td className="px-5 py-2.5 font-bold text-[#111827]">{r.count}</td>
                  <td className="px-5 py-2.5 text-[#6B7280]">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                        <div className="h-full rounded-full bg-[#166AD8]" style={{ width: `${pct}%` }} />
                      </div>
                      {pct}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab({ data }) {
  const chartColors = ['#F59E0B', '#166AD8', '#166AD8', '#E22B35', '#15803D', '#6B7280', '#E22B35'];
  const statusData = Object.entries(data.reports.by_status || {}).map(([label, count]) => ({ label, count }));
  const categoryData = data.reports.by_category || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="inbox" value={data.reports.total} label="Total Reports" color="#166AD8" />
        <StatCard icon="check" value={data.reports.this_month} label="This Month" color="#15803D" />
        <StatCard icon="clock" value={data.reports.today} label="Today" color="#F59E0B" />
        <StatCard icon="alert" value={data.reports.urgent_open} label="Urgent Open" color="#E22B35" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Growth Chart */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Report Submissions</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 30 days — Today: {data.reports.today} · Week: {data.reports.this_week} · Month: {data.reports.this_month}</span>
          <div className="mt-3">
            <MiniBarChart data={data.reports.growth} color="#15803D" height={150} />
          </div>
        </div>

        {/* Status Donut */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Status Distribution</h3>
          <DonutChart data={statusData} colors={chartColors} />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,.04)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[14px] font-bold text-[#10233F]">Reports by Category</h3>
        </div>
        {categoryData.length === 0 ? (
          <div className="p-5"><StaffEmptyState title="No reports yet." /></div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Category</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Count</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((c) => {
                const pct = data.reports.total > 0 ? Math.round((c.count / data.reports.total) * 100) : 0;
                return (
                  <tr key={c.category} className="border-t border-[#F1F5F9] hover:bg-[#F9FAFB]">
                    <td className="px-5 py-2.5 font-semibold text-[#111827]">{c.category}</td>
                    <td className="px-5 py-2.5 font-bold text-[#111827]">{c.count}</td>
                    <td className="px-5 py-2.5 text-[#6B7280]">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div className="h-full rounded-full bg-[#15803D]" style={{ width: `${pct}%` }} />
                        </div>
                        {pct}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ActivityTab({ data }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="log" value={data.logins.total} label="Total Logins" color="#166AD8" />
        <StatCard icon="clock" value={data.logins.today} label="Logins Today" color="#15803D" />
        <StatCard icon="eye" value={data.logins.active_now} label="Active Now" color="#F59E0B" />
        <StatCard icon="shield" value={data.logins.failed_total} label="Failed Logins" color="#E22B35" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Login Trends */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Login Trends</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 7 days</span>
          <div className="mt-3">
            <MiniBarChart
              data={data.logins.week.map(d => ({ date: d.date, count: d.logins }))}
              color="#166AD8" height={120} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#166AD8]" />Logins</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E22B35]" />Failed</span>
          </div>
        </div>

        {/* Failed Logins */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Failed Login Attempts</h3>
          <span className="text-[11px] text-[#9CA3AF]">Last 7 days — Week: {data.logins.failed_week} · Total: {data.logins.failed_total}</span>
          <div className="mt-3">
            <MiniBarChart
              data={data.logins.week.map(d => ({ date: d.date, count: d.failed }))}
              color="#E22B35" height={120} />
          </div>
        </div>
      </div>

      {/* Top Active Users */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,.04)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[14px] font-bold text-[#10233F]">Most Active Users (7d)</h3>
        </div>
        {!data.logins.top_users?.length ? (
          <div className="p-5"><StaffEmptyState title="No login activity this week." /></div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">#</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">User</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Role</th>
                <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Logins</th>
              </tr>
            </thead>
            <tbody>
              {data.logins.top_users.map((u, i) => {
                const colors = ROLE_COLORS[u.role] || { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]' };
                return (
                  <tr key={i} className="border-t border-[#F1F5F9] hover:bg-[#F9FAFB]">
                    <td className="px-5 py-2.5 text-[#9CA3AF] font-bold">{i + 1}</td>
                    <td className="px-5 py-2.5 font-bold text-[#111827]">{u.name}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-2.5 font-bold text-[#111827]">{u.login_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function PlatformAnalyticsPage() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await apiFetch('analytics/platform_stats.php');
      setData(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <>
        <StaffPageHeader eyebrow="Analytics" title="Platform Analytics" description="Loading..." className="mb-5" />
        <SkeletonRows rows={8} height="h-10" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <StaffPageHeader eyebrow="Analytics" title="Platform Analytics" description="Error loading data" className="mb-5" />
        <StaffErrorState message="Unable to load platform analytics." onRetry={load} />
      </>
    );
  }

  if (!data) return null;

  return (
    <>
      <StaffPageHeader
        eyebrow="Analytics"
        title="Platform Analytics"
        description="System-wide metrics and insights"
        className="mb-5"
      />

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap bg-white border border-[#E5E7EB] rounded-[14px] p-1.5 mb-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[12px] font-bold transition-colors cursor-pointer ${
              tab === t.key ? 'bg-xevera-600 text-white shadow-[0_4px_12px_rgba(18,100,232,0.25)]' : 'text-[#58677E] hover:bg-[#F0F4FA] hover:text-xevera-600'
            }`}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab data={data} />}
      {tab === 'users' && <UsersTab data={data} />}
      {tab === 'reports' && <ReportsTab data={data} />}
      {tab === 'activity' && <ActivityTab data={data} />}
      {tab === 'export' && <ExportReportsPage embedded />}
    </>
  );
}
