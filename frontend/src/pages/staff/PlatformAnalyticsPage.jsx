import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import ExportReportsPage from './ExportReportsPage';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'chart' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'reports', label: 'Reports', icon: 'inbox' },
  { key: 'services', label: 'Service Requests', icon: 'wrench' },
  { key: 'violations', label: 'Violations', icon: 'shield' },
  { key: 'ratings', label: 'Ratings', icon: 'star' },
  { key: 'activity', label: 'Activity', icon: 'clipboardcheck' },
  { key: 'export', label: 'Export', icon: 'download' },
];

const RANGE_OPTIONS = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

const ROLE_COLORS = {
  'Super Admin': { bg: 'bg-[#F0F0FF]', text: 'text-[#6B46C1]' },
  'Admin': { bg: 'bg-[#E8F2FF]', text: 'text-[#166AD8]' },
  'Staff': { bg: 'bg-[#E3F7EB]', text: 'text-[#148448]' },
  'Resident': { bg: 'bg-[#FFF1DB]', text: 'text-[#C97808]' },
};

function rangeLabel(range, data) {
  if (range === 'custom' && data?.range) return `${data.range.from} → ${data.range.to}`;
  const opt = RANGE_OPTIONS.find((o) => o.key === range);
  return opt ? opt.label : 'Last 30 Days';
}

function MiniBarChart({ data, maxVal, color = '#4D91EA', height = 120, emptyText = 'No data for this period' }) {
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((s, d) => s + (d.count || 0), 0);
  if (rows.length === 0 || total === 0) {
    return <div className="text-[12px] text-[#9CA3AF] text-center py-8">{emptyText}</div>;
  }
  const mx = maxVal || Math.max(1, ...rows.map((d) => d.count || 0));
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto" style={{ height }}>
      {rows.map((d, i) => {
        const pct = Math.round(((d.count || 0) / mx) * 100);
        return (
          <div key={d.date || d.day || i} className="flex-1 min-w-[14px] flex flex-col items-center justify-end h-full">
            {(d.count || 0) > 0 && <span className="text-[9px] font-bold mb-0.5">{d.count}</span>}
            <div className="w-full rounded-t-sm hover:opacity-80 transition-opacity" style={{ height: `${Math.max(3, pct)}%`, background: color, minHeight: '3px' }} title={`${d.date || d.day}: ${d.count || 0}`} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon, value, label, color = '#166AD8', delta }) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-[14px] min-h-[78px] flex items-center gap-3 shadow-[0_3px_12px_rgba(20,54,100,0.05)]">
      <span className="w-[42px] h-[42px] rounded-[11px] grid place-items-center flex-shrink-0" style={{ background: `${color}15`, color }}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[21px] font-extrabold text-[#10233F] leading-none">{value ?? '—'}</div>
        <div className="text-[11px] text-[#6B7D94] mt-[2px]">{label}</div>
      </div>
      {typeof delta === 'number' && (
        <div className="ml-auto text-right flex-shrink-0">
          <div className={`text-[11px] font-extrabold ${delta > 0 ? 'text-[#15803D]' : delta < 0 ? 'text-[#E22B35]' : 'text-[#9CA3AF]'}`}>
            {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'} {Math.abs(delta)}%
          </div>
          <small className="block text-[#9CA3AF] font-medium mt-1 text-[10px]">vs prior</small>
        </div>
      )}
    </div>
  );
}

function DonutChart({ data, colors }) {
  const rows = Array.isArray(data) ? data : [];
  const total = rows.reduce((s, d) => s + (d.count || 0), 0);
  if (total === 0) return <div className="text-[12px] text-[#9CA3AF] text-center py-8">No data</div>;
  let acc = 0;
  const segments = rows.filter((d) => (d.count || 0) > 0).map((d, i) => {
    const pct = (d.count / total) * 100;
    const seg = { ...d, pct, color: colors[i % colors.length] };
    acc += pct;
    return seg;
  });
  let from = 0;
  const gradient = segments.map((s) => {
    const part = `${s.color} ${from}% ${from + s.pct}%`;
    from += s.pct;
    return part;
  }).join(', ');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-[22px]">
      <div className="relative w-[126px] h-[126px] rounded-full grid place-items-center flex-shrink-0 mx-auto sm:mx-0" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute w-[82px] h-[82px] bg-white rounded-full" aria-hidden="true" />
        <div className="relative z-[2] text-center">
          <strong className="block text-[19px] text-[#10233F]">{total}</strong>
          <small className="text-[#9CA3AF] text-[9px]">Total</small>
        </div>
      </div>
      <div className="grid gap-[9px]">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-[7px] text-[10px]">
            <span className="w-[10px] h-[10px] rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[#6B7280] font-semibold min-w-[70px]">{s.label}</span>
            <span className="font-extrabold text-[#111827] ml-auto">{s.count} ({Math.round(s.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Citizen Satisfaction — normal card, rating donut + Like/Dislike bars,
   resolved reports only. No star icon, no highlight outline. */
function SatisfactionCard({ data, range, onRange }) {
  const s = data?.satisfaction || { likes: 0, dislikes: 0, total: 0, rate: 0 };
  const total = s.total || 0;
  const rate = Number(s.rate) || 0;
  const likePct = total > 0 ? Math.round((s.likes / total) * 100) : 0;
  const dislikePct = total > 0 ? Math.round((s.dislikes / total) * 100) : 0;
  return (
    <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
      <div className="flex justify-between items-center gap-2">
        <div>
          <h3 className="text-[14px] font-bold text-[#10233F]">Citizen Satisfaction (Ratings)</h3>
          <span className="text-[11px] text-[#9CA3AF]">Resident feedback on resolved reports</span>
        </div>
        {onRange && (
          <select
            aria-label="Ratings period"
            value={range}
            onChange={(e) => onRange(e.target.value)}
            className="border border-[#E5E7EB] bg-white rounded-lg px-2.5 py-[7px] text-[10px] font-semibold text-[#374151] cursor-pointer focus:outline-none focus:border-[#166AD8]"
          >
            {RANGE_OPTIONS.filter((o) => o.key !== 'custom').map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        )}
      </div>
      {total === 0 ? (
        <div className="text-[12px] text-[#9CA3AF] text-center py-8">No resident feedback yet</div>
      ) : (
        <div className="flex items-center gap-6 mt-[9px]">
          <div className="relative w-[126px] h-[126px] rounded-full grid place-items-center flex-shrink-0" style={{ background: `conic-gradient(#21bd67 0 ${rate}%, #e5ebf2 ${rate}% 100%)` }}>
            <div className="absolute w-[82px] h-[82px] bg-white rounded-full" aria-hidden="true" />
            <div className="relative z-[2] text-center">
              <strong className="text-[19px] text-[#10233F] block leading-none">{rate}%</strong>
              <small className="text-[#9CA3AF] text-[9px] block mt-1">Satisfaction Rate</small>
              <small className="text-[#9CA3AF] text-[9px] block">{total} total ratings</small>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-[13px]">
              <div className="flex justify-between text-[10px] mb-[5px]">
                <span>👍 &nbsp;Satisfied (Like)</span>
                <strong>{s.likes} ({likePct}%)</strong>
              </div>
              <div className="h-2 bg-[#edf1f5] rounded-[20px] overflow-hidden">
                <div className="h-full rounded-[20px] bg-[#16ad5c]" style={{ width: `${likePct}%` }} />
              </div>
            </div>
            <div className="mb-[13px]">
              <div className="flex justify-between text-[10px] mb-[5px]">
                <span>👎 &nbsp;Not Satisfied (Dislike)</span>
                <strong>{s.dislikes} ({dislikePct}%)</strong>
              </div>
              <div className="h-2 bg-[#edf1f5] rounded-[20px] overflow-hidden">
                <div className="h-full rounded-[20px] bg-[#ef3b43]" style={{ width: `${dislikePct}%` }} />
              </div>
            </div>
            <div className="bg-[#edf9f1] px-[9px] py-[7px] rounded-[7px] text-[9px] text-[#42664e]">
              Based on {total} resident feedback for resolved reports.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartRangeSelect({ range, onRange, label }) {
  if (!onRange) return null;
  return (
    <select
      aria-label={label}
      value={range === 'custom' ? '30d' : range}
      onChange={(e) => onRange(e.target.value)}
      className="border border-[#E5E7EB] bg-white rounded-lg px-2.5 py-[7px] text-[10px] font-semibold text-[#374151] cursor-pointer focus:outline-none focus:border-[#166AD8]"
    >
      {RANGE_OPTIONS.filter((o) => o.key !== 'custom').map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}

function OverviewTab({ data, range, onRange }) {
  const chartColors = ['#166AD8', '#15803D', '#E22B35', '#F59E0B', '#6B46C1'];
  const wf = data.reports.by_workflow || {};
  const statusData = ['Pending', 'Under Review', 'In Progress', 'Resolved'].map((label) => ({ label, count: wf[label] || 0 }));
  const roleData = Object.entries(data.users.by_role || {}).map(([label, count]) => ({ label, count }));
  const rl = rangeLabel(range, data);

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="users" value={data.users.total} label="Total Users" color="#166AD8" delta={data.deltas?.users_pct} />
        <StatCard icon="inbox" value={data.reports.total} label="Total Reports" color="#15803D" delta={data.deltas?.reports_pct} />
        <StatCard icon="clock" value={data.logins.today} label="Logins Today" color="#F59E0B" />
        <StatCard icon="alert" value={data.reports.urgent_open} label="Urgent Open" color="#E22B35" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[14px] font-bold text-[#10233F]">User Growth</h3>
            <ChartRangeSelect range={range} onRange={onRange} label="User growth period" />
          </div>
          <span className="text-[11px] text-[#9CA3AF]">New users registered per day · {rl}</span>
          <div className="mt-3">
            <MiniBarChart data={data.users.growth} color="#166AD8" height={130} />
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-[14px] font-bold text-[#10233F]">Report Submissions</h3>
            <ChartRangeSelect range={range} onRange={onRange} label="Report submissions period" />
          </div>
          <span className="text-[11px] text-[#9CA3AF]">Reports submitted per day · {rl}</span>
          <div className="mt-3">
            <MiniBarChart data={data.reports.growth} color="#15803D" height={130} />
          </div>
        </div>
      </div>

      {/* Lower cards: status, satisfaction, roles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Report Status</h3>
          <DonutChart data={statusData} colors={chartColors} />
        </div>
        <SatisfactionCard data={data} range={range} onRange={onRange} />
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)] md:col-span-2 xl:col-span-1">
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
      </div>    </div>
  );
}

function UsersTab({ data, range }) {
  const roleData = Object.entries(data.users.by_role || {}).map(([label, count]) => ({ label, count }));
  const chartColors = ['#6B46C1', '#166AD8', '#15803D', '#F59E0B'];
  const rl = rangeLabel(range, data);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="users" value={data.users.total} label="Total Users" color="#166AD8" delta={data.deltas?.users_pct} />
        <StatCard icon="check" value={data.users.active} label="Active" color="#15803D" />
        <StatCard icon="x" value={data.users.inactive} label="Inactive" color="#E22B35" />
        <StatCard icon="plus" value={data.users.new_month} label="New (30d)" color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Growth Chart */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">User Registrations</h3>
          <span className="text-[11px] text-[#9CA3AF]">{rl} — Today: {data.users.new_today} · Week: {data.users.new_week} · Month: {data.users.new_month}</span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[420px]">
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
    </div>
  );
}

function ReportsTab({ data, range }) {
  const chartColors = ['#F59E0B', '#166AD8', '#166AD8', '#E22B35', '#15803D', '#6B7280', '#E22B35'];
  const wf = data.reports.by_workflow || {};
  const statusData = ['Pending', 'Under Review', 'In Progress', 'Resolved'].map((label) => ({ label, count: wf[label] || 0 }));
  const categoryData = data.reports.by_category || [];
  const rl = rangeLabel(range, data);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="inbox" value={data.reports.total} label="Total Reports" color="#166AD8" delta={data.deltas?.reports_pct} />
        <StatCard icon="check" value={data.reports.this_month} label="This Month" color="#15803D" />
        <StatCard icon="clock" value={data.reports.today} label="Today" color="#F59E0B" />
        <StatCard icon="alert" value={data.reports.urgent_open} label="Urgent Open" color="#E22B35" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Growth Chart */}
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Report Submissions</h3>
          <span className="text-[11px] text-[#9CA3AF]">{rl} — Today: {data.reports.today} · Week: {data.reports.this_week} · Month: {data.reports.this_month}</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[420px]">
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
          </div>
        )}
      </div>
    </div>
  );
}

function RatingsTab({ data, range }) {
  const s = data?.satisfaction || { likes: 0, dislikes: 0, total: 0, rate: 0, trend: [], recent: [] };
  const rl = rangeLabel(range, data);
  const recent = Array.isArray(s.recent) ? s.recent : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="star" value={s.total} label="Total Ratings" color="#166AD8" />
        <StatCard icon="check" value={s.likes} label="Satisfied" color="#15803D" />
        <StatCard icon="x" value={s.dislikes} label="Not Satisfied" color="#E22B35" />
        <StatCard icon="chart" value={`${s.rate}%`} label="Satisfaction Rate" color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SatisfactionCard data={data} />
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Rating Trend</h3>
          <span className="text-[11px] text-[#9CA3AF]">{rl} · resolved reports</span>
          <div className="mt-3">
            <MiniBarChart data={(s.trend || []).map((t) => ({ date: t.date, count: (t.likes || 0) + (t.dislikes || 0) }))} color="#166AD8" height={130} emptyText="No ratings in this period" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-[#6B7280]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#15803D]" />Satisfied</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E22B35]" />Not Satisfied</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,.04)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[14px] font-bold text-[#10233F]">Recent Feedback</h3>
        </div>
        {recent.length === 0 ? (
          <div className="p-5"><StaffEmptyState title="No resident feedback yet." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[520px]">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Report</th>
                  <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Category</th>
                  <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Rating</th>
                  <th className="text-left text-[11px] font-bold text-[#6B7280] px-5 py-2.5">Comment</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((f, i) => (
                  <tr key={i} className="border-t border-[#F1F5F9] hover:bg-[#F9FAFB]">
                    <td className="px-5 py-2.5 font-bold text-[#111827] whitespace-nowrap">{f.ref_id}</td>
                    <td className="px-5 py-2.5 text-[#6B7280]">{f.category || '—'}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${String(f.rating) === '5' ? 'bg-[#E7F8EF] text-[#159957]' : 'bg-[#FFE9E9] text-[#E53535]'}`}>
                        {String(f.rating) === '5' ? '👍 Satisfied' : '👎 Not Satisfied'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-[#374151] max-w-[280px] truncate" title={f.comment || ''}>{f.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ data, range }) {
  const sv = data?.services || { total: 0, by_status: {}, trend: [] };
  const raw = sv.by_status || {};
  const labelOf = (k) => (k === 'Completed' ? 'Resolved' : k);
  const statusData = Object.entries(raw).map(([label, count]) => ({ label: labelOf(label), count }));
  const colors = ['#F59E0B', '#166AD8', '#6D28D9', '#15803D', '#E22B35', '#6B7280'];
  const rl = rangeLabel(range, data);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="wrench" value={sv.total} label="Total Requests" color="#166AD8" />
        <StatCard icon="clock" value={raw.Pending || 0} label="Pending" color="#F59E0B" />
        <StatCard icon="spinner" value={raw['In Progress'] || 0} label="In Progress" color="#6D28D9" />
        <StatCard icon="check" value={raw.Completed || 0} label="Resolved" color="#15803D" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Request Submissions</h3>
          <span className="text-[11px] text-[#9CA3AF]">{rl}</span>
          <div className="mt-3">
            <MiniBarChart data={sv.trend || []} color="#6D28D9" height={130} emptyText="No requests in this period" />
          </div>
        </div>
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Status Distribution</h3>
          <DonutChart data={statusData} colors={colors} />
        </div>
      </div>
    </div>
  );
}

function ViolationsTab({ data }) {
  const v = data?.violations || { total: 0, by_status: {}, under_review: 0, confirmed: 0, active_penalties: 0 };
  const statusData = Object.entries(v.by_status || {}).map(([label, count]) => ({ label, count }));
  const colors = ['#F59E0B', '#15803D', '#166AD8', '#E22B35', '#6B46C1', '#6B7280'];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="shield" value={v.total} label="Fake Report Violations" color="#166AD8" />
        <StatCard icon="clock" value={v.under_review} label="Under Review" color="#F59E0B" />
        <StatCard icon="check" value={v.confirmed} label="Confirmed" color="#15803D" />
        <StatCard icon="alert" value={v.active_penalties} label="Active Penalties" color="#E22B35" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-3">Status Distribution</h3>
          <DonutChart data={statusData} colors={colors} />
        </div>
        <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
          <h3 className="text-[14px] font-bold text-[#10233F] mb-1">Penalty Policy</h3>
          <span className="text-[11px] text-[#9CA3AF]">No monetary fees — restrictions and suspensions only, effective 8:00 AM</span>
          <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
            <li className="flex gap-2"><span aria-hidden="true">🟡</span><span><strong>Warning</strong> — formal notice, 0 days</span></li>
            <li className="flex gap-2"><span aria-hidden="true">🟠</span><span><strong>Reporting Restriction</strong> — 3 days, cannot submit reports</span></li>
            <li className="flex gap-2"><span aria-hidden="true">🔴</span><span><strong>Short / Long Suspension</strong> — 7 / 30 days, account deactivated</span></li>
            <li className="flex gap-2"><span aria-hidden="true">⚫</span><span><strong>Permanent Restriction</strong> — admin review to lift</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ data }) {
  const feed = Array.isArray(data?.activity) ? data.activity : [];
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
              data={data.logins.week.map((d) => ({ date: d.date, count: d.logins }))}
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
              data={data.logins.week.map((d) => ({ date: d.date, count: d.failed }))}
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
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[420px]">
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
          </div>
        )}
      </div>

      {/* Recent System Activity */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,.04)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <h3 className="text-[14px] font-bold text-[#10233F]">Recent System Activity</h3>
        </div>
        {feed.length === 0 ? (
          <div className="p-5"><StaffEmptyState title="No recent activity." /></div>
        ) : (
          <ul className="divide-y divide-[#F1F5F9]">
            {feed.map((a, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <span className="mt-0.5 inline-block px-2 py-0.5 rounded-md bg-[#F0F4FA] text-[#47617F] text-[10px] font-bold whitespace-nowrap">
                  {(a.target || a.action || '').replace(/_/g, ' ')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[12px] text-[#374151] leading-snug break-words">{a.detail || a.action}</p>
                  <p className="m-0 mt-0.5 text-[10px] text-[#9CA3AF]">{a.user}{a.role ? ` · ${a.role}` : ''} · {a.date}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function downloadCsv(filename, rows) {
  try {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* no-op */ }
}

function tabToCsv(tab, data) {
  if (!data) return [['section', 'note'], ['empty', 'no data loaded']];
  const rows = [['metric', 'value']];
  if (tab === 'overview') {
    rows.push(['total_users', data.users.total], ['total_reports', data.reports.total],
      ['logins_today', data.logins.today], ['urgent_open', data.reports.urgent_open],
      ['satisfaction_rate', data.satisfaction?.rate ?? ''], ['active_penalties', data.violations?.active_penalties ?? '']);
    rows.push([]);
    rows.push(['user_growth_date', 'count']);
    (data.users.growth || []).forEach((d) => rows.push([d.date, d.count]));
    rows.push([]);
    rows.push(['report_growth_date', 'count']);
    (data.reports.growth || []).forEach((d) => rows.push([d.date, d.count]));
  } else if (tab === 'users') {
    rows.push(['total', data.users.total], ['active', data.users.active], ['inactive', data.users.inactive]);
    rows.push([]);
    rows.push(['role', 'count']);
    Object.entries(data.users.by_role || {}).forEach(([k, v]) => rows.push([k, v]));
  } else if (tab === 'reports') {
    rows.push(['total', data.reports.total]);
    rows.push([]);
    rows.push(['status', 'count']);
    Object.entries(data.reports.by_status || {}).forEach(([k, v]) => rows.push([k, v]));
    rows.push([]);
    rows.push(['category', 'count']);
    (data.reports.by_category || []).forEach((c) => rows.push([c.category, c.count]));
  } else if (tab === 'ratings') {
    const s = data.satisfaction || {};
    rows.push(['total', s.total ?? ''], ['likes', s.likes ?? ''], ['dislikes', s.dislikes ?? ''], ['rate', s.rate ?? '']);
    rows.push([]);
    rows.push(['ref_id', 'category', 'rating', 'comment', 'date']);
    (s.recent || []).forEach((f) => rows.push([f.ref_id, f.category, f.rating, f.comment, f.date]));
  } else if (tab === 'services') {
    rows.push(['total', data.services?.total ?? '']);
    rows.push([]);
    rows.push(['status', 'count']);
    Object.entries(data.services?.by_status || {}).forEach(([k, v]) => rows.push([k, v]));
  } else if (tab === 'violations') {
    rows.push(['total', data.violations?.total ?? ''], ['under_review', data.violations?.under_review ?? ''],
      ['confirmed', data.violations?.confirmed ?? ''], ['active_penalties', data.violations?.active_penalties ?? '']);
    rows.push([]);
    rows.push(['status', 'count']);
    Object.entries(data.violations?.by_status || {}).forEach(([k, v]) => rows.push([k, v]));
  } else if (tab === 'activity') {
    rows.push(['total_logins', data.logins.total], ['logins_today', data.logins.today],
      ['failed_total', data.logins.failed_total]);
    rows.push([]);
    rows.push(['action', 'target', 'user', 'role', 'date', 'detail']);
    (data.activity || []).forEach((a) => rows.push([a.action, a.target, a.user, a.role, a.date, a.detail]));
  }
  return rows;
}

export default function PlatformAnalyticsPage() {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ range });
      if (range === 'custom') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const d = await apiFetch('analytics/platform_stats.php?' + params.toString());
      setData(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => { load(); }, [load]);

  function exportCurrentTab() {
    if (!data) return;
    const stamp = data?.range ? `${data.range.from}_to_${data.range.to}` : range;
    downloadCsv(`analytics_${tab}_${stamp}.csv`, tabToCsv(tab, data));
  }

  if (loading) {
    return (
      <>
        <div className="text-[11px] text-[#8290a7] mb-[5px]">
          XEVERA &nbsp;/&nbsp; <strong>Platform Analytics</strong>
        </div>
        <h1 className="text-[24px] sm:text-[29px] font-extrabold tracking-[-0.8px] text-[#10233F] mb-4">
          Platform Analytics
        </h1>
        <SkeletonRows rows={8} height="h-10" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="text-[11px] text-[#8290a7] mb-[5px]">
          XEVERA &nbsp;/&nbsp; <strong>Platform Analytics</strong>
        </div>
        <h1 className="text-[24px] sm:text-[29px] font-extrabold tracking-[-0.8px] text-[#10233F] mb-4">
          Platform Analytics
        </h1>
        <StaffErrorState message="Unable to load platform analytics." onRetry={load} />
      </>
    );
  }

  if (!data) return null;

  return (
    <>
      <div className="text-[11px] text-[#8290a7] mb-[5px]">
        XEVERA &nbsp;/&nbsp; <strong>Platform Analytics</strong>
      </div>

      <div className="flex justify-between items-end gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[29px] font-extrabold tracking-[-0.8px] text-[#10233F] mb-[3px]">
            Platform Analytics
          </h1>
          <p className="text-[12px] text-[#6B7D94]">
            System-wide metrics and insights for a cleaner, safer, and better Xevera.
          </p>
        </div>

        <div className="flex gap-2.5 flex-wrap items-center">
          <select
            id="pa-range"
            aria-label="Period"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-[39px] rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 text-[12px] font-semibold text-[#374151] focus:outline-none focus:border-[#166AD8] cursor-pointer"
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          {range === 'custom' && (
            <>
              <input
                type="date"
                aria-label="From date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="h-[39px] px-3 rounded-[9px] border border-[#E5E7EB] bg-white text-[12px] font-semibold text-[#374151] focus:outline-none focus:border-[#166AD8]"
              />
              <input
                type="date"
                aria-label="To date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="h-[39px] px-3 rounded-[9px] border border-[#E5E7EB] bg-white text-[12px] font-semibold text-[#374151] focus:outline-none focus:border-[#166AD8]"
              />
            </>
          )}
          {tab !== 'export' && (
            <button
              type="button"
              onClick={exportCurrentTab}
              className="h-[39px] min-w-[108px] inline-flex items-center justify-center gap-1.5 rounded-[9px] bg-[#1769e8] border border-[#1769e8] text-white text-[12px] font-bold hover:bg-[#0757cf] transition-colors cursor-pointer"
            >
              <Icon name="download" size={14} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="mb-[17px] overflow-x-auto">
        <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-[10px] p-1 min-w-max">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-[17px] py-2.5 rounded-lg text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.key ? 'bg-[#1769e8] text-white' : 'text-[#354968] hover:bg-[#f4f7fb]'
              }`}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <OverviewTab data={data} range={range} onRange={setRange} />}
      {tab === 'users' && <UsersTab data={data} range={range} />}
      {tab === 'reports' && <ReportsTab data={data} range={range} />}
      {tab === 'services' && <ServicesTab data={data} range={range} />}
      {tab === 'violations' && <ViolationsTab data={data} />}
      {tab === 'ratings' && <RatingsTab data={data} range={range} />}
      {tab === 'activity' && <ActivityTab data={data} />}
      {tab === 'export' && <ExportReportsPage embedded />}
    </>
  );
}
