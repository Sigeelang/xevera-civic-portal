import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const CATEGORY_COLORS = [
  '#1258E8', '#2563EB', '#B45309', '#DC2626', '#7C3AED',
  '#0891B2', '#1EA85B', '#CA8A04', '#DB2777', '#64748B',
];

const ICONS = {
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m5.45-5.11 3.1-6.2A2 2 0 0 1 12.29 0h1.42a2 2 0 0 1 1.74 1.01L18 6M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  clock: 'M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  signature: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
};

const STATUS_INFO = {
  Pending:  { cls: 'bg-[#FEF3C7] text-[#B45309]', label: 'Pending',   bar: '#B45309' },
  Claimed:  { cls: 'bg-[#DBEAFE] text-[#2563EB]', label: 'In Progress', bar: '#2563EB' },
  Resolved: { cls: 'bg-success-bg text-success-dark', label: 'Resolved', bar: '#1EA85B' },
  Rejected: { cls: 'bg-[#FEE2E2] text-[#DC2626]', label: 'Rejected', bar: '#DC2626' },
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'reports', label: 'Reports' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'residents', label: 'Residents' },
];

const card = 'bg-[#FFFFFF] rounded-[20px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5';

export default function AnalyticsPage({ onNavigate }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [residents, setResidents] = useState(null);
  const [resLoading, setResLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch('reports/analytics.php')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Lazy-load per-tab data (cached after first fetch) */
  useEffect(() => {
    if (tab === 'residents' && !residents && !resLoading) {
      setResLoading(true);
      apiFetch('residents/list.php')
        .then((d) => setResidents(Array.isArray(d) ? d : []))
        .catch(() => setResidents([]))
        .finally(() => setResLoading(false));
    }
  }, [tab, residents, resLoading]);

  const bs = data?.by_status || {};
  const total = bs.total ?? 0;
  const weekMax = data?.week_max || 1;
  const week = data?.week || [];
  const cats = data?.category_count || [];
  const catTotal = cats.reduce((s, c) => s + parseInt(c.c, 10), 0) || 1;
  let acc = 0;
  const donutStops = cats.map((c, i) => {
    const p = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    const start = (acc / catTotal) * 100;
    acc += parseInt(c.c, 10);
    const end = (acc / catTotal) * 100;
    return `${p} ${start}% ${end}%`;
  }).join(', ');

  const header = (
    <StaffPageHeader
      eyebrow="Management"
      title="Platform Analytics"
      description="Operational metrics and trends across reports, categories, and urgency."
      actions={<span className="px-3 py-1.5 rounded-full bg-xevera-50 text-xevera-700 text-xs font-bold uppercase tracking-wider">Insights</span>}
    />
  );

  const tabBar = (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((t) => (
        <button key={t.key} onClick={() => setTab(t.key)}
          className={`px-3.5 py-2 rounded-[9px] text-xs font-bold transition-colors cursor-pointer border-0 ${
            tab === t.key ? 'bg-xevera-600 text-white shadow-[0_4px_12px_rgba(18,100,232,0.25)]' : 'bg-white text-[#58677E] border border-[#E5E7EB] hover:bg-[#F0F4FA] hover:text-xevera-600'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );

  /* ---------------- Overview (existing dashboard content) ---------------- */
  const overviewContent = (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={total} icon={ICONS.inbox} />
        <StatCard label="Open" value={data?.open ?? 0} color="text-[#B45309]" tone="#B45309" icon={ICONS.folder} />
        <StatCard label="Resolved" value={bs.Resolved ?? 0} color="text-success-dark" icon={ICONS.check} sub={total ? `${Math.round((bs.Resolved / total) * 100)}% resolution rate` : undefined} />
        <StatCard label="Avg Response" value={data?.response_avg != null ? data.response_avg + 'h' : '—'} color="text-[#2563EB]" tone="#2563EB" icon={ICONS.clock} sub="Pending → first action" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        <div className={card}>
          <h4 className="text-sm font-head font-extrabold mb-3">Status Overview</h4>
          <div className="flex flex-col gap-3">
            {Object.entries(STATUS_INFO).map(([k, cfg]) => {
              const v = bs[k] ?? 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full ${cfg.cls} text-xs font-bold w-[100px]`}>{cfg.label}</span>
                  <span className="font-head text-lg font-extrabold text-[#111827] w-10">{v}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${total ? (v / total) * 100 : 0}%`, background: cfg.bar }} />
                  </div>
                  <span className="text-xs text-[#9CA3AF] w-12 text-right">{total ? Math.round((v / total) * 100) : 0}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={card}>
        <h4 className="text-sm font-head font-extrabold mb-1">Reports This Week</h4>
        <div className="flex items-end gap-2 h-[150px] mt-4">
          {week.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] font-bold text-[#6B7280]">{d.count || ''}</div>
              <div className="w-full rounded-t-md bg-xevera-600 hover:bg-xevera-700 transition-colors"
                style={{ height: `${(d.count / weekMax) * 140}px`, opacity: 0.85 }} title={d.label} />
              <div className="text-[10px] font-bold text-[#9CA3AF]">{d.day}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ---------------- Reports tab ---------------- */
  const reportsContent = (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Reports" value={total} icon={ICONS.inbox} />
        <StatCard label="Open" value={data?.open ?? 0} color="text-[#B45309]" tone="#B45309" icon={ICONS.folder} />
        <StatCard label="Resolved" value={bs.Resolved ?? 0} color="text-success-dark" icon={ICONS.check} />
        <StatCard label="Rejected" value={bs.Rejected ?? 0} color="text-[#DC2626]" tone="#DC2626" icon={ICONS.folder} />
      </div>

      <div className={card}>
        <h4 className="text-sm font-head font-extrabold mb-3">Reports by Status</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold border-b border-[#E5E7EB]">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Count</th>
                <th className="py-2 pr-3">Share</th>
                <th className="py-2">Progress</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Pending', value: bs.Pending ?? 0, bar: '#B45309' },
                { label: 'Verified', value: bs.Verified ?? 0, bar: '#1264e8' },
                { label: 'Assigned', value: bs.Assigned ?? 0, bar: '#2563EB' },
                { label: 'In Progress', value: bs['In Progress'] ?? 0, bar: '#0891B2' },
                { label: 'Resolved', value: bs.Resolved ?? 0, bar: '#1EA85B' },
                { label: 'Closed', value: bs.Closed ?? 0, bar: '#64748B' },
                { label: 'Rejected', value: bs.Rejected ?? 0, bar: '#DC2626' },
              ].map((row) => {
                const pct = total ? Math.round((row.value / total) * 100) : 0;
                return (
                  <tr key={row.label} className="border-b border-[#F1F5F9] last:border-b-0">
                    <td className="py-2.5 pr-3 font-bold text-[#374151]">{row.label}</td>
                    <td className="py-2.5 pr-3 font-head font-extrabold text-[#111827]">{row.value}</td>
                    <td className="py-2.5 pr-3 text-[#6B7280]">{pct}%</td>
                    <td className="py-2.5">
                      <div className="w-32 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.bar }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        <div className={card}>
          <h4 className="text-sm font-head font-extrabold mb-1">Reports This Week</h4>
          <div className="flex items-end gap-2 h-[150px] mt-4">
            {week.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-[#6B7280]">{d.count || ''}</div>
                <div className="w-full rounded-t-md bg-xevera-600 hover:bg-xevera-700 transition-colors"
                  style={{ height: `${(d.count / weekMax) * 140}px`, opacity: 0.85 }} title={d.label} />
                <div className="text-[10px] font-bold text-[#9CA3AF]">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h4 className="text-sm font-head font-extrabold mb-1">Reports by Category</h4>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mt-2">
            <div className="shrink-0 w-[130px] h-[130px] rounded-full mx-auto sm:mx-0"
              style={{ background: `conic-gradient(${donutStops})` }}>
              <div className="w-full h-full rounded-full flex items-center justify-center"
                style={{ background: 'radial-gradient(circle, #FFFFFF 0 55%, transparent 56%)' }}>
                <span className="text-lg font-extrabold text-[#111827]">{total}</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 w-full sm:w-auto">
              {cats.map((c, i) => (
                <div key={c.category} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="flex-1 truncate text-[#374151]">{c.category}</span>
                  <span className="font-bold text-[#111827]">{c.c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  /* ---------------- Resolution tab ---------------- */
  const resolved = bs.Resolved ?? 0;
  const closed = bs.Closed ?? 0;
  const resolutionContent = (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Resolved" value={resolved} color="text-success-dark" icon={ICONS.check} />
        <StatCard label="Closed / Archived" value={closed} color="text-[#6B7280]" icon={ICONS.folder} />
        <StatCard label="Resolution Rate" value={total ? `${Math.round((resolved / total) * 100)}%` : '—'} color="text-success-dark" tone="#16A66A" icon={ICONS.check} sub={`${resolved} of ${total} reports`} />
        <StatCard label="Avg Response" value={data?.response_avg != null ? data.response_avg + 'h' : '—'} color="text-[#2563EB]" tone="#2563EB" icon={ICONS.clock} sub="Pending → first action" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        <div className={card}>
          <h4 className="text-sm font-head font-extrabold mb-3">Lifecycle Funnel</h4>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Resolved', value: resolved, bar: '#1EA85B' },
              { label: 'Closed', value: closed, bar: '#64748B' },
              { label: 'Still Open', value: data?.open ?? 0, bar: '#B45309' },
              { label: 'Rejected', value: bs.Rejected ?? 0, bar: '#DC2626' },
            ].map((row) => {
              const pct = total ? Math.round((row.value / total) * 100) : 0;
              return (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#374151] w-[90px]">{row.label}</span>
                  <span className="font-head text-lg font-extrabold text-[#111827] w-10">{row.value}</span>
                  <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.bar }} />
                  </div>
                  <span className="text-xs text-[#9CA3AF] w-12 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={card}>
          <h4 className="text-sm font-head font-extrabold mb-1">Weekly Throughput</h4>
          <p className="text-[11px] text-[#9CA3AF] mb-2">Reports submitted per day (last 7 days)</p>
          <div className="flex items-end gap-2 h-[150px] mt-4">
            {week.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold text-[#6B7280]">{d.count || ''}</div>
                <div className="w-full rounded-t-md bg-[#1EA85B] hover:bg-[#159957] transition-colors"
                  style={{ height: `${(d.count / weekMax) * 140}px`, opacity: 0.85 }} title={d.label} />
                <div className="text-[10px] font-bold text-[#9CA3AF]">{d.day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={card}>
        <h4 className="text-sm font-head font-extrabold mb-3">Resolution by Category</h4>
        <div className="space-y-2.5">
          {cats.map((c, i) => {
            const pct = total ? Math.round((parseInt(c.c, 10) / total) * 100) : 0;
            return (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                <span className="text-xs font-bold text-[#374151] flex-1 truncate">{c.category}</span>
                <span className="font-head text-sm font-extrabold text-[#111827] w-10">{c.c}</span>
                <div className="flex-1 max-w-[220px] h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                </div>
                <span className="text-xs text-[#9CA3AF] w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  /* ---------------- Residents tab ---------------- */
  const resTotal = (residents || []).length;
  const resActive = (residents || []).filter((r) => r.status === 'Active').length;
  const resInactive = resTotal - resActive;
  const recent = [...(residents || [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 6);
  const residentsContent = resLoading ? (
    <div className={card}><SkeletonRows rows={6} height="h-12" /></div>
  ) : (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Residents" value={resTotal} icon={ICONS.users} />
        <StatCard label="Active" value={resActive} color="text-success-dark" icon={ICONS.check} sub={resTotal ? `${Math.round((resActive / resTotal) * 100)}% of residents` : undefined} />
        <StatCard label="Inactive" value={resInactive} color="text-[#DC2626]" tone="#DC2626" icon={ICONS.folder} />
        <StatCard label="Community Reports" value={total} color="text-[#2563EB]" tone="#2563EB" icon={ICONS.inbox} sub="submitted by the community" />
      </div>

      <div className={card}>
        <h4 className="text-sm font-head font-extrabold mb-3">Account Status Breakdown</h4>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Active', value: resActive, bar: '#1EA85B' },
            { label: 'Inactive', value: resInactive, bar: '#DC2626' },
          ].map((row) => {
            const pct = resTotal ? Math.round((row.value / resTotal) * 100) : 0;
            return (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#374151] w-[100px]">{row.label}</span>
                <span className="font-head text-lg font-extrabold text-[#111827] w-10">{row.value}</span>
                <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.bar }} />
                </div>
                <span className="text-xs text-[#9CA3AF] w-12 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={card}>
        <h4 className="text-sm font-head font-extrabold mb-3">Newest Residents</h4>
        {recent.length === 0 ? (
          <StaffEmptyState title="No residents found." />
        ) : (
          <div className="space-y-2.5">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 text-xs border-b border-[#F1F5F9] last:border-b-0 pb-2.5">
                <span className="w-8 h-8 rounded-full bg-[#EEF5FF] text-xevera-700 grid place-items-center font-extrabold shrink-0">
                  {String(r.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#111827] truncate">{r.name}</div>
                  <div className="text-[#6B7280] truncate">{r.email}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full font-bold ${r.status === 'Active' ? 'bg-success-bg text-success-dark' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => onNavigate('residents')}
          className="mt-4 px-3 py-2 rounded-lg bg-[#EAF2FF] text-xevera-700 text-xs font-bold hover:bg-[#DBEAFE] transition-colors">
          Open Residents Directory
        </button>
      </div>
    </>
  );

  const tabContent = {
    overview: overviewContent,
    reports: reportsContent,
    resolution: resolutionContent,
    residents: residentsContent,
  }[tab];

  const analyticsError = error || !data;

  return (
    <div className="space-y-5">
      {header}
      {tabBar}

      {(tab === 'overview' || tab === 'reports' || tab === 'resolution') ? (
        loading ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[104px] rounded-[20px] border border-[#E5E7EB] bg-white animate-pulse" />
              ))}
            </div>
            <div className={card}><SkeletonRows rows={5} height="h-9" /></div>
          </>
        ) : analyticsError ? (
          <div className={card}>
            <StaffErrorState message="Unable to load analytics data. The analytics endpoint may be unavailable." onRetry={load} />
          </div>
        ) : (
          tabContent
        )
      ) : (
        tabContent
      )}
    </div>
  );
}
