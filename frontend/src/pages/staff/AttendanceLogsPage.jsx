import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { downloadExport } from '../../services/download';
import { useToast } from '../../components/Toast';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import Modal from '../../components/Modal';

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(String(v).length <= 10 ? v + 'T00:00:00' : String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (${days[d.getDay()]})`;
}

function fmtTime(v) {
  if (!v) return null;
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/* Attendance policy (matches the approval console): time in after 10:00 AM is late. */
const LATE_AFTER_HOUR = 10;

/*
 * Derive a Present / Late / Incomplete classification for one record.
 *   Present    - both time in and time out recorded
 *   Late       - complete record but approved/requested time in was after 10:00 AM
 *   Incomplete - no approved time out yet (missing, pending, or rejected)
 */
function classify(r) {
  const inRaw = r.approved_time_in || r.time_in_recorded_at;
  const hasIn = Boolean(inRaw) && r.time_in_status === 'Approved';
  const hasOut = Boolean(r.time_out_recorded_at) && r.time_out_status === 'Approved';
  if (!hasIn) return 'Incomplete';
  if (!hasOut) return 'Incomplete';
  const d = new Date(String(inRaw).replace(' ', 'T'));
  if (!isNaN(d.getTime()) && d.getHours() >= LATE_AFTER_HOUR) return 'Late';
  return 'Present';
}

const STATUS_PILLS = {
  Present: 'bg-[#DDF5E8] text-[#078C4E]',
  Late: 'bg-[#FFF0D3] text-[#DB8200]',
  Incomplete: 'bg-[#FFE5EB] text-[#DF3150]',
};

export default function AttendanceLogsPage() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [viewRow, setViewRow] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ limit: '100' });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    apiFetch('admin/attendance.php?' + params.toString())
      .then(d => setItems(d.items || []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  /* Sorted by staff name A-Z (mockup behaviour), then by date descending */
  const sorted = useMemo(() => [...(items || [])].sort((a, b) => {
    const byName = String(a.staff_name || '').localeCompare(String(b.staff_name || ''), undefined, { sensitivity: 'base' });
    if (byName !== 0) return byName;
    return String(b.date || '').localeCompare(String(a.date || ''));
  }), [items]);

  const filtered = useMemo(() => sorted.filter((r) => {
    if (statusFilter && classify(r) !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      String(r.staff_name || '').toLowerCase().includes(q) ||
      String(r.username || '').toLowerCase().includes(q) ||
      `st-${String(r.staff_id || '')}`.includes(q)
    );
  }), [sorted, statusFilter, search]);

  useEffect(() => { setPage(1); }, [search, statusFilter, perPage, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const stats = useMemo(() => {
    const list = filtered;
    let present = 0, late = 0, incomplete = 0, minutes = 0, counted = 0;
    list.forEach((r) => {
      const c = classify(r);
      if (c === 'Present') present++;
      else if (c === 'Late') late++;
      else incomplete++;
      if ((r.total_minutes || 0) > 0) { minutes += r.total_minutes; counted++; }
    });
    const avg = counted > 0 ? Math.round(minutes / counted) : 0;
    const avgLabel = counted > 0 ? `${Math.floor(avg / 60)}h ${avg % 60}m` : '—';
    const pct = (n) => (list.length ? Math.round((n / list.length) * 100) : 0);
    return { total: list.length, present, late, incomplete, avgLabel, pct };
  }, [filtered]);

  function exportCsv() {
    if (exporting) return;
    setExporting(true);
    const params = { date_from: dateFrom, date_to: dateTo };
    downloadExport('attendance/export.php', params, {
      filename: 'xevera-attendance-logs-' + new Date().toLocaleDateString('en-CA') + '.csv',
    })
      .then(() => toast('Attendance logs exported.'))
      .catch(e => toast(e.message || 'Unable to export attendance logs.', 'error'))
      .finally(() => setExporting(false));
  }

  function resetFilters() {
    setSearch('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  }

  const statCards = [
    { label: 'Total Records', value: stats.total, desc: 'Attendance records', valueCls: 'text-xevera-600', iconBg: 'bg-[#EDF5FF]' },
    { label: 'Present', value: stats.present, desc: `${stats.pct(stats.present)}% of total`, valueCls: 'text-[#008C4F]', iconBg: 'bg-[#E9F8EF]' },
    { label: 'Late', value: stats.late, desc: `${stats.pct(stats.late)}% of total`, valueCls: 'text-[#DB8200]', iconBg: 'bg-[#FFF6E8]' },
    { label: 'Incomplete', value: stats.incomplete, desc: `${stats.pct(stats.incomplete)}% of total`, valueCls: 'text-[#6037CF]', iconBg: 'bg-[#F2EDFF]' },
    { label: 'Average Hours', value: stats.avgLabel, desc: 'Per day', valueCls: 'text-xevera-600', iconBg: 'bg-[#EDF5FF]' },
  ];

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = (safePage - 1) * perPage + paged.length;

  const pageButtons = useMemo(() => {
    const t = totalPages;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, 2, safePage - 1, safePage, safePage + 1, t - 1, t]);
    const nums = [...set].filter(n => n >= 1 && n <= t).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }, [totalPages, safePage]);

  return (
    <div className="flex-1 space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold text-[#17233D] m-0">Attendance Logs</h1>
          <p className="text-sm text-[#5E6D83] mt-1">View and manage complete staff attendance records.</p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={load} title="Refresh"
            className="h-10 px-4 rounded-lg border border-[#D8E0EA] bg-white text-sm font-bold text-[#17233D] hover:bg-[#F4F7FB] cursor-pointer">↻</button>
          <button onClick={exportCsv} disabled={exporting}
            className="h-10 px-4 rounded-lg bg-xevera-600 border-0 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-60 transition cursor-pointer">
            ⇩ {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-lg p-4 min-h-[100px] flex items-center gap-3.5">
            <span className={`w-[46px] h-[46px] rounded-full grid place-items-center text-xl flex-shrink-0 ${s.iconBg}`}>◷</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#17233D]">{s.label}</div>
              <div className={`text-[24px] font-extrabold font-head my-0.5 truncate ${s.valueCls}`}>{s.value ?? '—'}</div>
              <div className="text-[11px] text-[#68768A]">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-[#E2E7EF] rounded-lg p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff name or ID..."
          className="h-10 w-full lg:w-[285px] border border-[#DCE3ED] rounded-lg px-3 text-xs outline-none focus:border-xevera-600 focus:ring-2 focus:ring-xevera-600/20 bg-white" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 lg:min-w-[210px] border border-[#DCE3ED] rounded-lg px-3 text-xs bg-white outline-none focus:border-xevera-600 cursor-pointer">
          <option value="">All Status</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Incomplete">Incomplete</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="h-10 border border-[#DCE3ED] rounded-lg px-3 text-xs bg-white outline-none focus:border-xevera-600" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="h-10 border border-[#DCE3ED] rounded-lg px-3 text-xs bg-white outline-none focus:border-xevera-600" />
        <button onClick={resetFilters}
          className="lg:ml-auto h-10 px-4 rounded-lg border border-[#DCE3ED] bg-white text-xs font-bold text-[#13284E] hover:bg-[#F4F7FB] cursor-pointer">
          ↻ &nbsp; Reset
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#E0E6EE] rounded-lg overflow-hidden">
        <div className="p-4 text-sm font-bold border-b border-[#EDF0F4] text-[#17233D]">
          Attendance History
          <span className="text-[#64728A] font-semibold text-xs ml-1.5">(Sorted by Staff Name A-Z)</span>
        </div>

        {loading ? (
          <div className="p-5"><SkeletonRows rows={6} height="h-12" /></div>
        ) : error ? (
          <StaffErrorState onRetry={load} />
        ) : paged.length === 0 ? (
          <StaffEmptyState title="No attendance records found." description="Try another search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse">
              <thead className="bg-[#FBFCFE]">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#3B4860]">
                  <th className="py-3 px-3.5 font-bold">Staff Member</th>
                  <th className="py-3 px-3.5 font-bold">Staff ID</th>
                  <th className="py-3 px-3.5 font-bold">Date</th>
                  <th className="py-3 px-3.5 font-bold">Time In</th>
                  <th className="py-3 px-3.5 font-bold">Time Out</th>
                  <th className="py-3 px-3.5 font-bold">Total Hours</th>
                  <th className="py-3 px-3.5 font-bold">Status</th>
                  <th className="py-3 px-3.5 font-bold">Approved By</th>
                  <th className="py-3 px-3.5 font-bold">Remarks</th>
                  <th className="py-3 px-3.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
                  const status = classify(r);
                  const reviewer = r.time_out_reviewed_by || r.time_in_reviewed_by || null;
                  return (
                    <tr key={r.id} className="border-t border-[#EDF0F4] hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-[#EDF1F6] grid place-items-center text-[10px] font-extrabold text-[#40536E] flex-shrink-0">
                            {initials(r.staff_name)}
                          </span>
                          <span className="text-xs font-bold text-[#17233D]">{r.staff_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-[#374151] whitespace-nowrap">ST-{String(r.staff_id).padStart(3, '0')}</td>
                      <td className="py-2.5 px-3.5 text-xs text-[#374151] whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-2.5 px-3.5 text-xs font-bold text-[#17233D] whitespace-nowrap">
                        {fmtTime(r.time_in_recorded_at) || r.time_in || '—'}
                        {!r.time_in && <span className="block text-[10px] font-normal text-[#68768A]">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs font-bold text-[#17233D] whitespace-nowrap">
                        {fmtTime(r.time_out_recorded_at) || r.time_out || '—'}
                        {!r.time_out && <span className="block text-[10px] font-normal text-[#DF3150]">Missing</span>}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-[#374151] whitespace-nowrap">{r.total_hours || '—'}</td>
                      <td className="py-2.5 px-3.5">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${STATUS_PILLS[status]}`}>{status}</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-xs whitespace-nowrap">
                        {reviewer ? (
                          <>
                            <span className="font-semibold text-[#17233D]">{reviewer}</span>
                            <span className="block text-[9px] text-[#718097] mt-0.5">Reviewed</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3.5 text-xs text-[#374151] whitespace-nowrap">
                        {r.time_out_reason || (r.correction_status === 'Pending' ? 'Correction pending' : '—')}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <button onClick={() => setViewRow(r)} title="View attendance"
                          className="w-10 h-10 border-0 rounded-md bg-transparent text-xevera-600 text-base hover:bg-[#EDF4FF] cursor-pointer grid place-items-center">◉</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}
        {!loading && !error && filtered.length > 0 && (
          <div className="min-h-[60px] px-4 py-3 border-t border-[#EDF0F4] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-[#64728A]">Showing {rangeStart} to {rangeEnd} of {filtered.length} records</span>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button onClick={() => setPage(1)} disabled={safePage === 1}
                className="w-9 h-[34px] rounded-md border border-[#DCE3ED] bg-white text-xs cursor-pointer disabled:opacity-40">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="w-9 h-[34px] rounded-md border border-[#DCE3ED] bg-white text-xs cursor-pointer disabled:opacity-40">‹</button>
              {pageButtons.map((n, i) => n === '…' ? (
                <span key={'e' + i} className="w-9 h-[34px] grid place-items-center text-[#9CA3AF] text-xs">…</span>
              ) : (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-9 h-[34px] rounded-md border text-xs cursor-pointer ${
                    n === safePage ? 'bg-xevera-600 border-xevera-600 text-white' : 'border-[#DCE3ED] bg-white hover:bg-[#F4F7FB]'
                  }`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="w-9 h-[34px] rounded-md border border-[#DCE3ED] bg-white text-xs cursor-pointer disabled:opacity-40">›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                className="w-9 h-[34px] rounded-md border border-[#DCE3ED] bg-white text-xs cursor-pointer disabled:opacity-40">»</button>
              <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}
                className="h-[34px] ml-1.5 border border-[#DCE3ED] rounded-md px-2 text-[11px] bg-white cursor-pointer">
                <option value={8}>8 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      <Modal
        open={Boolean(viewRow)}
        title={viewRow ? `Attendance — ${viewRow.staff_name}` : ''}
        description={viewRow ? `${fmtDate(viewRow.date)} · ST-${String(viewRow.staff_id).padStart(3, '0')}` : ''}
        onCancel={() => setViewRow(null)}
        hideActions
      >
        {viewRow && (
          <div className="space-y-2.5 text-sm">
            {[
              ['Time In', fmtTime(viewRow.time_in_recorded_at) || viewRow.time_in || '—'],
              ['Time In Status', viewRow.time_in_status || '—'],
              ['Time In Reviewed By', viewRow.time_in_reviewed_by || '—'],
              ['Time Out', fmtTime(viewRow.time_out_recorded_at) || viewRow.time_out || '—'],
              ['Time Out Status', viewRow.time_out_status || '—'],
              ['Time Out Reviewed By', viewRow.time_out_reviewed_by || '—'],
              ['Total Hours', viewRow.total_hours || '—'],
              ['Status', classify(viewRow)],
              ['Remarks', viewRow.time_out_reason || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7A8598]">{label}</span>
                <span className="text-right font-semibold text-[#111827]">{value}</span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button onClick={() => setViewRow(null)}
                className="px-5 py-2 rounded-xl bg-xevera-600 border-0 text-white text-sm font-bold hover:bg-xevera-700 cursor-pointer">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
