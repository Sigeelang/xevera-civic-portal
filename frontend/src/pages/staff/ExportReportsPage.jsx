import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { downloadExport } from '../../services/download';
import { useToast } from '../../components/Toast';

const REPORT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Reports' },
  { value: 'summary', label: 'Summary Report' },
  { value: 'staff_assignment', label: 'Staff Performance' },
  { value: 'by_category', label: 'Category Report' },
];

const STATUS_OPTIONS = ['All Status', 'Pending', 'In Progress', 'Resolved', 'Rejected'];

function toInputDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'bg-[#FFF5DD] text-[#C47A00]';
    case 'in progress': case 'assigned': case 'verified': return 'bg-[#EAF3FF] text-[#1769C2]';
    case 'resolved': case 'closed': return 'bg-[#E8F7EF] text-[#16A05D]';
    case 'rejected': return 'bg-[#FDECEC] text-[#DC2626]';
    default: return 'bg-[#EAF3FF] text-[#1769C2]';
  }
}

function priorityClass(priority) {
  switch ((priority || '').toLowerCase()) {
    case 'high': return 'bg-[#FDECEC] text-[#DC2626]';
    case 'low': return 'bg-[#E8F7EF] text-[#16A05D]';
    default: return 'bg-[#EAF3FF] text-[#2563EB]';
  }
}

export default function ExportReportsPage() {
  const showToast = useToast();

  const [reportType, setReportType] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const t = new Date();
    return toInputDate(new Date(t.getFullYear(), t.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const [scope, setScope] = useState('All Areas');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [staff, setStaff] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [categories, setCategories] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [periodStats, setPeriodStats] = useState(null);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState('');
  const [generatedAt, setGeneratedAt] = useState(new Date());

  useEffect(() => {
    apiFetch('settings/get.php')
      .then((d) => {
        let list = d.categories;
        if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    apiFetch('users/assignable.php')
      .then((d) => setStaffOptions(Array.isArray(d?.users) ? d.users : Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch('reports/stats.php').then(setOverallStats).catch(() => {});
  }, []);

  const hasActiveFilters = category !== 'all' || statusFilter !== 'all' || staff !== 'all';

  useEffect(() => {
    const params = new URLSearchParams({ page: '1', limit: '50', sort: sortBy === 'title' ? 'title' : sortBy });
    if (category !== 'all') params.set('category', category);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    apiFetch('reports/list.php?' + params.toString())
      .then((d) => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setItems([]));
  }, [category, statusFilter, sortBy, refreshing]);

  useEffect(() => {
    if (!hasActiveFilters && !dateFrom && !dateTo) { setPeriodStats(null); return; }
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (category !== 'all') params.set('category', category);
    if (staff !== 'all') params.set('assigned', staff);
    apiFetch('reports/export_stats.php?' + params.toString())
      .then(setPeriodStats)
      .catch(() => setPeriodStats(null));
  }, [dateFrom, dateTo, statusFilter, category, staff]);

  function applyFilters() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      showToast('The start date cannot be after the end date.', 'error');
      return;
    }
    setRefreshing((r) => r + 1);
    showToast('Filters applied.');
  }

  function resetFilters() {
    const t = new Date();
    setDateFrom(toInputDate(new Date(t.getFullYear(), t.getMonth(), 1)));
    setDateTo(toInputDate(t));
    setReportType('all');
    setScope('All Areas');
    setCategory('all');
    setStatusFilter('all');
    setStaff('all');
    setSortBy('newest');
    setRefreshing((r) => r + 1);
  }

  function refreshData() {
    setRefreshing((r) => r + 1);
    apiFetch('reports/stats.php').then(setOverallStats).catch(() => {});
    setGeneratedAt(new Date());
  }

  async function runExport(format) {
    setExporting(format);
    try {
      const params = { report: reportType, format };
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (category !== 'all') params.category = category;
      if (staff !== 'all') params.assigned = staff;
      await downloadExport('export/custom.php', params, {
        filename: reportType + '_export_' + new Date().toLocaleDateString('en-CA') + '.' + format,
      });
      showToast('Report exported as ' + format.toUpperCase() + '.');
    } catch (err) {
      showToast(err.message || 'Export failed.', 'error');
    } finally {
      setExporting('');
    }
  }

  /* Derived analytics */
  const s = overallStats || {};
  const totalReports = periodStats ? Number(periodStats.total ?? 0) : Number(s.total ?? 0);
  const pendingCount = periodStats ? Number(periodStats.pending ?? 0) : Number(s.pending ?? 0);
  const progressCount = periodStats ? Number(periodStats.in_progress ?? 0) : Number((s.in_progress ?? 0) + (s.claimed ?? 0));
  const resolvedCount = periodStats ? Number(periodStats.resolved ?? 0) : Number(s.resolved ?? 0);
  const rejectedCount = Number(s.rejected ?? 0);
  const pct = (n) => (totalReports > 0 ? ((n / totalReports) * 100).toFixed(2) + '%' : '0%');

  const categoryRows = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const key = it.category || 'Others';
      map[key] = (map[key] || 0) + 1;
    });
    const rows = Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    rows.push({ name: 'Others', count: Math.max(0, items.length - rows.reduce((a, r) => a + r.count, 0)) });
    return rows.filter((r) => r.count > 0);
  }, [items]);

  const staffRows = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const name = it.assigned && it.assigned !== '-' ? it.assigned : null;
      if (!name) return;
      map[name] = map[name] || { name, assigned: 0, resolved: 0, progress: 0, pending: 0 };
      const row = map[name];
      row.assigned++;
      const st = (it.status || '').toLowerCase();
      if (st === 'resolved' || st === 'closed') row.resolved++;
      else if (st === 'in progress' || st === 'assigned' || st === 'verified') row.progress++;
      else row.pending++;
    });
    return Object.values(map).sort((a, b) => b.assigned - a.assigned).slice(0, 5);
  }, [items]);

  const recentReports = useMemo(() => {
    const list = [...items];
    if (sortBy === 'oldest') list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    else if (sortBy === 'title') list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    else list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return list.slice(0, 5);
  }, [items, sortBy]);

  const trend = Array.isArray(s.week) ? s.week : [];
  const trendMax = Math.max(1, ...trend.map((d) => d.count));

  const donutSegments = [
    { label: 'Resolved', color: '#16A05D', count: resolvedCount },
    { label: 'In Progress', color: '#1769C2', count: progressCount },
    { label: 'Pending', color: '#F59E0B', count: pendingCount },
    { label: 'Rejected', color: '#DC2626', count: rejectedCount },
  ];
  const donutTotal = donutSegments.reduce((a, seg) => a + seg.count, 0) || 1;
  let donutAcc = 0;
  const donutStops = donutSegments.map((seg) => {
    const start = (donutAcc / donutTotal) * 100;
    donutAcc += seg.count;
    const end = (donutAcc / donutTotal) * 100;
    return `${seg.color} ${start}% ${end}%`;
  });

  const cardHeader = (icon, title) => (
    <div className="h-[42px] px-[14px] flex items-center gap-2 text-xevera-600 text-xs font-extrabold bg-gradient-to-r from-[#F3F8FF] to-white border-b border-[#C9DCF5]">
      <span className="text-[15px]">{icon}</span>
      {title}
    </div>
  );

  const trendPoints = (() => {
    if (trend.length < 2) return null;
    const stepX = 530 / (trend.length - 1);
    const pts = trend.map((d, i) => ({
      x: 55 + i * stepX,
      y: 155 - (d.count / trendMax) * 110,
      label: d.label,
      count: d.count,
    }));
    return pts;
  })();

  return (
    <div className="w-full min-h-screen bg-[#F5F9FF]" style={{ fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      <div className="max-w-[1550px] mx-auto px-5 py-4">

        {/* PAGE HEADER */}
        <div className="text-right text-[11px] text-[#64748B] mb-1.5">
          <span className="text-xevera-600">Reports</span>
          &nbsp;›&nbsp;
          Export Reports
        </div>

        <div className="flex justify-between items-end mb-3">
          <div>
            <h1 className="text-[27px] leading-tight font-bold text-[#17345F]">Export Reports</h1>
            <p className="mt-1 text-xs text-[#64748B]">Generate, filter, preview and export comprehensive system reports.</p>
          </div>
          <button onClick={refreshData}
            className="h-[34px] px-[15px] flex items-center gap-[7px] rounded-md border border-[#C9DCF5] bg-white text-xevera-600 text-[11px] font-semibold hover:bg-[#EAF3FF] cursor-pointer">
            ↻ Refresh Data
          </button>
        </div>

        {/* FILTERS + EXPORT */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.3fr)_minmax(290px,0.95fr)] gap-[18px] mb-[18px]">

          {/* REPORT FILTERS CARD */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('⚗', 'REPORT FILTERS')}
            <div className="p-3.5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[13px] gap-y-2.5">

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Report Type</label>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer">
                    {REPORT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Date From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2]" />
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Date To</label>
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2]" />
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Scope</label>
                  <select value={scope} onChange={(e) => setScope(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer">
                    <option>All Areas</option>
                    <option>Xevera Subdivision</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer">
                    <option value="all">All Categories</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Status</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer">
                    {STATUS_OPTIONS.map((o) => <option key={o} value={o === 'All Status' ? 'all' : o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Staff</label>
                  <select value={staff} onChange={(e) => setStaff(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer min-w-0">
                    <option value="all">All Staff</option>
                    {staffOptions.map((st) => (
                      <option key={st.id ?? st.user_id} value={String(st.id ?? st.user_id)}>{st.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-[10px] font-semibold text-[#40516B]">Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="w-full h-8 px-2.5 rounded border border-[#C9D8EA] bg-white text-[11px] outline-none focus:border-[#1769C2] cursor-pointer">
                    <option value="newest">Date (Newest)</option>
                    <option value="oldest">Date (Oldest)</option>
                    <option value="title">Title</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={applyFilters}
                  className="h-8 px-3.5 rounded border-0 bg-xevera-600 text-white text-[11px] font-bold hover:bg-[#063A7A] cursor-pointer">
                  ⚱ Apply Filters
                </button>
                <button onClick={resetFilters}
                  className="h-8 px-3.5 rounded border border-[#C9DCF5] bg-white text-xevera-600 text-[11px] font-bold hover:bg-[#EAF3FF] cursor-pointer">
                  ↻ Reset
                </button>
              </div>
            </div>
          </div>

          {/* EXPORT OPTIONS CARD */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden self-start w-full">
            {cardHeader('⇩', 'EXPORT OPTIONS')}
            <div className="p-2">

              <button onClick={() => runExport('pdf')} disabled={!!exporting}
                className="w-full min-h-[54px] px-2.5 py-[7px] mb-1.5 flex items-center gap-2.5 rounded-md border border-[#E3EBF5] bg-white hover:bg-[#F5F9FF] hover:border-[#C9DCF5] transition-colors disabled:opacity-60 cursor-pointer text-left">
                <span className="w-8 h-8 grid place-items-center rounded-md bg-[#FDECEC] text-[#DC2626] text-[10px] font-black">PDF</span>
                <span className="flex-1">
                  <strong className="block text-[11px] text-[#152E55]">{exporting === 'pdf' ? 'Generating...' : 'Export as PDF'}</strong>
                  <span className="block mt-0.5 text-[9px] text-[#64748B]">Generate PDF report</span>
                </span>
                <span className="text-[#64748B] text-[17px]">›</span>
              </button>

              <button onClick={() => runExport('xlsx')} disabled={!!exporting}
                className="w-full min-h-[54px] px-2.5 py-[7px] mb-1.5 flex items-center gap-2.5 rounded-md border border-[#E3EBF5] bg-white hover:bg-[#F5F9FF] hover:border-[#C9DCF5] transition-colors disabled:opacity-60 cursor-pointer text-left">
                <span className="w-8 h-8 grid place-items-center rounded-md bg-[#E8F7EF] text-[#16A05D] text-[10px] font-black">XLS</span>
                <span className="flex-1">
                  <strong className="block text-[11px] text-[#152E55]">{exporting === 'xlsx' ? 'Generating...' : 'Export as Excel'}</strong>
                  <span className="block mt-0.5 text-[9px] text-[#64748B]">Download Excel file</span>
                </span>
                <span className="text-[#64748B] text-[17px]">›</span>
              </button>

              <button onClick={() => window.print()}
                className="w-full min-h-[54px] px-2.5 py-[7px] flex items-center gap-2.5 rounded-md border border-[#E3EBF5] bg-white hover:bg-[#F5F9FF] hover:border-[#C9DCF5] transition-colors cursor-pointer text-left">
                <span className="w-8 h-8 grid place-items-center rounded-md bg-[#EAF3FF] text-xevera-600 text-[15px]">🖨</span>
                <span className="flex-1">
                  <strong className="block text-[11px] text-[#152E55]">Print Report</strong>
                  <span className="block mt-0.5 text-[9px] text-[#64748B]">Print current report</span>
                </span>
                <span className="text-[#64748B] text-[17px]">›</span>
              </button>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-[18px]">

          {[
            {
              key: 'total',
              bar: '#1769C2', iconBg: '#EAF3FF', iconColor: '#1769C2', labelColor: '#1769C2',
              label: 'TOTAL REPORTS',
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 2h9l5 5v15H6V2z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 12h6" />
                  <path d="M9 16h6" />
                </svg>
              ),
              value: totalReports, sub: '100% of total',
            },
            {
              key: 'resolved',
              bar: '#16A05D', iconBg: '#E8F7EF', iconColor: '#16A05D', labelColor: '#16A05D',
              label: 'RESOLVED',
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12 2.5 2.5L16 9" />
                </svg>
              ),
              value: resolvedCount, sub: pct(resolvedCount),
            },
            {
              key: 'progress',
              bar: '#1769C2', iconBg: '#EAF3FF', iconColor: '#1769C2', labelColor: '#1769C2',
              label: 'IN PROGRESS',
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12a8 8 0 0 1 14-5" />
                  <path d="M18 4v4h-4" />
                  <path d="M20 12a8 8 0 0 1-14 5" />
                  <path d="M6 20v-4h4" />
                </svg>
              ),
              value: progressCount, sub: pct(progressCount),
            },
            {
              key: 'pending',
              bar: '#F59E0B', iconBg: '#FFF5DD', iconColor: '#F59E0B', labelColor: '#D88400',
              label: 'PENDING',
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              ),
              value: pendingCount, sub: pct(pendingCount),
            },
            {
              key: 'rejected',
              bar: '#DC2626', iconBg: '#FDECEC', iconColor: '#DC2626', labelColor: '#DC2626',
              label: 'REJECTED',
              icon: (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m9 9 6 6" />
                  <path d="m15 9-6 6" />
                </svg>
              ),
              value: rejectedCount, sub: pct(rejectedCount),
            },
          ].map((st) => (
            <div key={st.key}
              className="relative h-[88px] min-w-0 px-[14px] py-3 flex items-center gap-[11px] rounded-md border border-[#D7E4F2] bg-white shadow-[0_2px_8px_rgba(11,78,162,0.05)] overflow-hidden">
              <span className="absolute top-0 left-0 right-0 h-1" style={{ background: st.bar }}></span>

              <span className="w-[39px] h-[39px] min-w-[39px] grid place-items-center rounded-full"
                style={{ background: st.iconBg, color: st.iconColor }}>
                <span className="block w-5 h-5 [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                  {st.icon}
                </span>
              </span>

              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="text-[9px] leading-[1.1] font-bold uppercase whitespace-nowrap overflow-hidden text-ellipsis truncate"
                  style={{ color: st.labelColor }}>
                  {st.label}
                </div>
                <div className="mt-[3px] text-[25px] leading-none font-bold text-[#102B56]">{st.value}</div>
                <div className="mt-1 text-[9px] leading-none text-[#64748B]">{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr_1.7fr] gap-[18px] mb-[18px]">

          {/* CATEGORY TABLE */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('◔', 'REPORTS BY CATEGORY')}
            <div className="p-2 pb-2.5 overflow-x-auto">
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr>
                    {['Category', 'Reports', 'Percentage'].map((h) => (
                      <th key={h} className="h-[29px] px-[7px] bg-[#F0F6FF] text-xevera-600 border border-[#C9DCF5] text-[9px] font-bold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.length === 0 && (
                    <tr><td colSpan={3} className="h-[27px] px-[7px] border border-[#DCE7F3] text-center text-[#64748B]">No data</td></tr>
                  )}
                  {categoryRows.map((row) => (
                    <tr key={row.name} className="hover:bg-[#F2F7FF] odd:bg-transparent even:bg-[#FAFCFF]">
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{row.name}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{row.count}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{pct(row.count)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#EAF3FF]">
                    <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">TOTAL</td>
                    <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">{items.length}</td>
                    <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* STATUS DONUT */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('◔', 'REPORT STATUS DISTRIBUTION')}
            <div className="min-h-[214px] py-[18px] px-5 flex items-center justify-center gap-7 flex-wrap">
              <div
                className="relative w-[145px] h-[145px] rounded-full grid place-items-center flex-shrink-0"
                style={{ background: `conic-gradient(${donutStops.join(',')})` }}
              >
                <span className="absolute w-[87px] h-[87px] rounded-full bg-white"></span>
                <div className="relative z-10 text-center">
                  <strong className="block text-[23px] text-[#142F59]">{donutSegments.reduce((a, x) => a + x.count, 0)}</strong>
                  <span className="text-[9px] text-[#64748B]">Total</span>
                </div>
              </div>

              <div className="flex flex-col gap-[11px] min-w-[150px]">
                {donutSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2 text-[9px] text-[#26364E]">
                    <span className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: seg.color }}></span>
                    {seg.label}
                    <span className="ml-auto font-bold">{(seg.count / donutTotal * 100).toFixed(2)}% ({seg.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MONTHLY TREND */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('↗', 'WEEKLY TREND')}
            <div className="min-h-[214px] px-3 py-2.5">
              <div className="text-[9px] text-[#64748B] mb-1">Reports per day (last 7 days)</div>
              {trendPoints ? (
                <svg className="w-full h-[170px]" viewBox="0 0 620 190" preserveAspectRatio="none">
                  <line x1="40" y1="20" x2="40" y2="155" stroke="#C9DCF5" />
                  <line x1="40" y1="155" x2="600" y2="155" stroke="#C9DCF5" />
                  <line x1="40" y1="110" x2="600" y2="110" stroke="#EAF3FF" />
                  <line x1="40" y1="65" x2="600" y2="65" stroke="#EAF3FF" />
                  <polygon
                    fill="rgba(23,105,194,0.08)"
                    points={trendPoints.map((p) => `${p.x},${p.y}`).join(' ') + ` ${trendPoints[trendPoints.length - 1].x},155 ${trendPoints[0].x},155`}
                  />
                  <polyline fill="none" stroke="#1769C2" strokeWidth="3" points={trendPoints.map((p) => `${p.x},${p.y}`).join(' ')} />
                  {trendPoints.map((p) => (
                    <g key={p.label}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#1769C2" />
                      <text x={p.x - 7} y={p.y - 8} fontSize="10" fontWeight="700" fill="#16335F">{p.count}</text>
                      <text x={p.x - 18} y="176" fontSize="8" fill="#64748B">{p.label}</text>
                    </g>
                  ))}
                </svg>
              ) : (
                <div className="grid place-items-center h-[170px] text-xs text-[#64748B]">No trend data available.</div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.7fr] gap-[18px] mb-[18px]">

          {/* STAFF PERFORMANCE */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('♟', 'STAFF PERFORMANCE')}
            <div className="p-2 pb-2.5 overflow-x-auto">
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr>
                    {['Staff Name', 'Assigned', 'Resolved', 'In Progress', 'Pending', 'Rate'].map((h) => (
                      <th key={h} className="h-[29px] px-[7px] bg-[#F0F6FF] text-xevera-600 border border-[#C9DCF5] text-[9px] font-bold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffRows.length === 0 && (
                    <tr><td colSpan={6} className="h-[27px] px-[7px] border border-[#DCE7F3] text-center text-[#64748B]">No assigned reports in range</td></tr>
                  )}
                  {staffRows.map((row) => (
                    <tr key={row.name} className="hover:bg-[#F2F7FF] even:bg-[#FAFCFF]">
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{row.name}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{row.assigned}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{row.resolved}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{row.progress}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">{row.pending}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E]">
                        {row.assigned > 0 ? ((row.resolved / row.assigned) * 100).toFixed(2) : '0.00'}%
                      </td>
                    </tr>
                  ))}
                  {staffRows.length > 0 && (
                    <tr className="bg-[#EAF3FF]">
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">TOTAL</td>
                      {[['assigned'], ['resolved'], ['progress'], ['pending']].map(([k], i) => (
                        <td key={k} className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">
                          {staffRows.reduce((a, r) => a + r[k], 0)}
                        </td>
                      ))}
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-xevera-600 font-extrabold">
                        {(() => {
                          const ta = staffRows.reduce((a, r) => a + r.assigned, 0);
                          const tr = staffRows.reduce((a, r) => a + r.resolved, 0);
                          return ta > 0 ? ((tr / ta) * 100).toFixed(2) : '0.00';
                        })()}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECENT REPORTS */}
          <div className="bg-white border border-[#DFE9F4] rounded-lg shadow-[0_3px_16px_rgba(11,78,162,0.08)] overflow-hidden">
            {cardHeader('▤', 'RECENT REPORTS')}
            <div className="p-2 pb-2.5 overflow-x-auto">
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr>
                    {['ID', 'Title', 'Category', 'Status', 'Priority', 'Assigned To', 'Date Submitted'].map((h) => (
                      <th key={h} className="h-[29px] px-[7px] bg-[#F0F6FF] text-xevera-600 border border-[#C9DCF5] text-[9px] font-bold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentReports.length === 0 && (
                    <tr><td colSpan={7} className="py-6 border border-[#DCE7F3] text-center text-[#64748B]">No reports found.</td></tr>
                  )}
                  {recentReports.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F2F7FF] even:bg-[#FAFCFF]">
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{r.id}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] max-w-[160px] truncate">{r.title}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{r.category || '-'}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3]">
                        <span className={`inline-flex items-center justify-center min-w-[63px] h-[18px] px-2 rounded-full text-[7.5px] font-extrabold uppercase whitespace-nowrap ${statusClass(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3]">
                        <span className={`inline-flex items-center justify-center min-w-[48px] h-[17px] px-[7px] rounded-full text-[7px] font-bold ${priorityClass(r.priority)}`}>{r.priority || 'Normal'}</span>
                      </td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{r.assigned || '-'}</td>
                      <td className="h-[27px] px-[7px] border border-[#DCE7F3] text-[#26364E] whitespace-nowrap">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="h-12 bg-white border-t border-[#C9DCF5] flex items-center justify-between px-6 text-[9px] text-xevera-600 mb-1">
          <div>Transparency • Accountability • Community</div>
          <div className="flex items-center gap-4">
            <div>
              Generated on: <strong>{generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
            </div>
            <div><strong>{generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong></div>
            <div className="min-w-[40px] h-6 px-[9px] grid place-items-center rounded-full bg-xevera-600 text-white text-[9px] font-bold">1 / 1</div>
          </div>
        </footer>

      </div>
    </div>
  );
}
