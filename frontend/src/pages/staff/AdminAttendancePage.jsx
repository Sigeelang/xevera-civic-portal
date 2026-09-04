import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { downloadExport } from '../../services/download';
import { useToast } from '../../components/Toast';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v + 'T00:00:00');
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLongDate(v) {
  if (!v) return '—';
  const d = new Date(v + 'T00:00:00');
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(v) {
  if (!v) return null;
  return new Date(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function deriveStatus(r) {
  if (r.time_in_status === 'Rejected' || r.time_out_status === 'Rejected') return 'Rejected';
  if ((r.approved_time_in || r.time_in_status === 'Approved') && (r.approved_time_out || r.time_out_status === 'Approved') && r.time_out) return 'Completed';
  if (r.time_in_status === 'Pending') return 'Pending Time In';
  if (r.time_out_status === 'Pending') return 'Pending Time Out';
  if (r.time_in) return 'Time In Approved';
  return r.status || 'Unavailable';
}

function statusPill(status) {
  const map = {
    'Pending Time In': 'bg-[#FFF5DD] border border-[#F5D58D] text-[#D88400]',
    'Pending Time Out': 'bg-[#FDECEC] border border-[#F5C7C7] text-[#DC2626]',
    'Time In Approved': 'bg-[#EAF3FF] border border-[#C9DCF5] text-xevera-600',
    'Present': 'bg-[#EAF3FF] border border-[#C9DCF5] text-xevera-600',
    'Completed': 'bg-[#E8F7EF] border border-[#BFE8D2] text-[#16A05D]',
    'Rejected': 'bg-[#FDECEC] border border-[#F5C7C7] text-[#DC2626]',
    'Absent': 'bg-[#F1F5F9] border border-[#DCE5F0] text-[#64748B]',
  };
  const cls = map[status] || 'bg-[#F1F5F9] border border-[#DCE5F0] text-[#64748B]';
  return <span className={`inline-flex px-[9px] py-[5px] rounded-md text-[10px] font-bold whitespace-nowrap ${cls}`}>{status}</span>;
}

const STAT_ICONS = {
  users: (
    <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></svg>
  ),
};

export default function AdminAttendancePage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState(null);
  const [approveAction, setApproveAction] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [adminTimeOut, setAdminTimeOut] = useState(null);
  const [adminTimeOutReason, setAdminTimeOutReason] = useState('');
  const [adminTimeOutBusy, setAdminTimeOutBusy] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search, date_from: dateFrom, date_to: dateTo, page: String(page), limit: '20', filter });
    apiFetch('admin/attendance.php?' + params.toString())
      .then(d => {
        setItems(d.items || []);
        setTotalPages(d.total_pages || 1);
        setTotal(d.total || 0);
      })
      .catch(() => setError('Unable to load attendance records.'))
      .finally(() => setLoading(false));
  }

  function loadSummary() {
    apiFetch('admin/attendance-summary.php')
      .then(d => setSummary(d.counts || {}))
      .catch(() => setSummary(null));
  }

  useEffect(() => { load(); }, [search, dateFrom, dateTo, page, filter]);
  useEffect(() => { loadSummary(); }, []);

  async function confirmApproval() {
    if (!approveAction) return;
    if (approveAction.action === 'reject' && !approveAction.reason.trim()) {
      toast('Please provide a rejection reason.', 'error');
      return;
    }
    setReviewingId(approveAction.id + approveAction.type);
    try {
      await apiFetch('attendance/review.php', {
        method: 'POST',
        body: {
          action: approveAction.action,
          type: approveAction.type,
          attendance_id: approveAction.id,
          reason: approveAction.reason.trim(),
        },
      });
      toast('Request ' + (approveAction.action === 'approve' ? 'approved' : 'rejected') + ' successfully.');
      setApproveAction(null);
      load();
      loadSummary();
    } catch (e) {
      toast(e.message || 'Failed to update request.', 'error');
    } finally {
      setReviewingId(null);
    }
  }

  async function submitAdminTimeOut() {
    if (!adminTimeOut || !adminTimeOutReason.trim()) {
      toast('Please provide a reason for recording time out.', 'error');
      return;
    }
    setAdminTimeOutBusy(true);
    try {
      await apiFetch('attendance/time-out.php', {
        method: 'POST',
        body: { staff_id: adminTimeOut.staff_id, reason: adminTimeOutReason.trim() },
      });
      toast('Time out recorded successfully.');
      setAdminTimeOut(null);
      setAdminTimeOutReason('');
      load();
      loadSummary();
    } catch (e) {
      toast(e.message || 'Failed to record time out.', 'error');
    } finally {
      setAdminTimeOutBusy(false);
    }
  }

  function exportCsv() {
    if (exporting) return;
    setExporting(true);
    const dateStr = new Date().toLocaleDateString('en-CA');
    const params = { search, date_from: dateFrom, date_to: dateTo, status: filter === 'all' ? 'All' : (filter === 'pending_time_in' ? 'Pending Time In' : 'Pending Time Out') };
    downloadExport('attendance/export.php', params, { filename: 'xevera-staff-attendance-' + dateStr + '.csv' })
      .then(() => toast('Attendance export downloaded.'))
      .catch(e => toast(e.message || 'Unable to export attendance records.', 'error'))
      .finally(() => setExporting(false));
  }

  function changeTab(tab) {
    setFilter(tab);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setFilter('all');
    setPage(1);
  }

  const stats = summary || { total_staff: 0, present: 0, pending_time_in: 0, pending_time_out: 0, completed: 0 };

  const statCards = [
    { key: null, iconTint: 'bg-[#EAF3FF] text-xevera-600', label: 'Total Staff', value: stats.total_staff, desc: 'All staff members', valueCls: 'text-xevera-600', icon: STAT_ICONS.users },
    { key: null, iconTint: 'bg-[#E8F7EF] text-[#16A05D]', label: 'Present Today', value: stats.present, desc: 'Checked in today', valueCls: 'text-[#16A05D]', icon: STAT_ICONS.check },
    { key: 'pending_time_in', clickable: true, cardBorder: 'border-[#F5C96D]', iconTint: 'bg-[#FFF5DD] text-[#F59E0B]', label: 'Pending Time In', value: stats.pending_time_in, desc: 'Requires approval', valueCls: 'text-[#D88400]', clickCls: 'text-[#D88400]', icon: STAT_ICONS.clock },
    { key: 'pending_time_out', clickable: true, cardBorder: 'border-[#EFB5B5]', iconTint: 'bg-[#FDECEC] text-[#DC2626]', label: 'Pending Time Out', value: stats.pending_time_out, desc: 'Requires approval', valueCls: 'text-[#DC2626]', clickCls: 'text-[#DC2626]', icon: STAT_ICONS.clock },
    { key: null, iconTint: 'bg-[#E8F7EF] text-[#16A05D]', label: 'Completed', value: stats.completed, desc: 'Attendance completed', valueCls: 'text-[#16A05D]', icon: STAT_ICONS.calendar },
  ];

  const tabs = [
    { key: 'all', label: 'All Records' },
    { key: 'pending_time_in', label: 'Pending Time In', count: stats.pending_time_in, countCls: 'bg-[#F59E0B]' },
    { key: 'pending_time_out', label: 'Pending Time Out', count: stats.pending_time_out, countCls: 'bg-[#DC2626]' },
  ];

  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);

  return (
    <div className="w-full min-h-screen bg-[#F5F8FC]" style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}>
      <div className="max-w-[1500px] mx-auto px-[30px] py-[30px] max-md:px-[18px] max-md:py-[18px]">

        {/* HEADER */}
        <header className="flex items-start justify-between gap-5 mb-[28px] max-sm:flex-col">
          <div>
            <div className="flex items-center gap-2 mb-2 text-xevera-600 text-xs font-extrabold tracking-[2px]">
              <span className="text-[13px]">♟</span>
              MANAGEMENT
            </div>
            <h1 className="text-[38px] leading-[1.15] font-bold tracking-[-1px] text-[#102B56] max-sm:text-[30px]">Staff Attendance</h1>
            <p className="mt-3 text-sm text-[#64748B]">Monitor and approve staff Time In and Time Out records.</p>
          </div>
          <button onClick={exportCsv} disabled={exporting}
            className="h-[46px] px-[18px] flex items-center justify-center gap-[9px] rounded-[11px] border border-[#C9DCF5] bg-white text-xevera-600 text-[13px] font-bold hover:bg-[#EAF3FF] hover:border-xevera-600 transition-colors disabled:opacity-60 cursor-pointer max-sm:w-full">
            ⇩
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </header>

        {/* TABS */}
        <div className="flex gap-[28px] border-b border-[#DCE5F0] mb-5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => changeTab(t.key)}
              className={`relative flex items-center gap-[7px] pb-[14px] pt-1 px-[5px] border-0 bg-transparent text-[13px] font-semibold cursor-pointer whitespace-nowrap ${filter === t.key ? 'text-xevera-600' : 'text-[#52637C] hover:text-xevera-600'}`}>
              {t.label}
              {!!t.count && (
                <span className={`min-w-5 h-5 inline-flex items-center justify-center px-1.5 rounded-full text-white text-[10px] font-extrabold ${t.countCls}`}>{t.count}</span>
              )}
              {filter === t.key && <span className="absolute left-0 right-0 bottom-[-1px] h-[3px] rounded-t-[5px] bg-xevera-600"></span>}
            </button>
          ))}
        </div>

        {/* FILTERS */}
        <section className="grid grid-cols-1 md:grid-cols-[minmax(300px,1fr)_210px_210px_145px] gap-3 p-[13px] mb-6 rounded-[15px] border border-[#E0E8F2] bg-white shadow-[0_4px_16px_rgba(16,43,86,0.05)]">
          <div className="relative">
            <span className="absolute left-[15px] top-1/2 -translate-y-1/2 text-[#52637C] text-xl">⌕</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
              className="w-full h-12 pl-[43px] pr-[15px] rounded-[10px] border border-[#D7E2EF] outline-none text-inherit focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(23,105,194,0.08)] placeholder:text-[#94A3B8]" />
          </div>
          <div className="relative">
            <label className="absolute left-[42px] top-[3px] z-10 text-[10px] text-[#64748B]">Date From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full h-12 pt-[13px] pl-[42px] pr-[10px] rounded-[10px] border border-[#D7E2EF] bg-white outline-none focus:border-xevera-600" />
          </div>
          <div className="relative">
            <label className="absolute left-[42px] top-[3px] z-10 text-[10px] text-[#64748B]">Date To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full h-12 pt-[13px] pl-[42px] pr-[10px] rounded-[10px] border border-[#D7E2EF] bg-white outline-none focus:border-xevera-600" />
          </div>
          <button onClick={clearFilters}
            className="h-12 flex items-center justify-center gap-[9px] rounded-[10px] border border-[#D7E2EF] bg-white text-inherit text-[13px] font-bold hover:bg-[#F5F8FC] cursor-pointer">
            ☷ Filters ⌄
          </button>
        </section>

        {/* STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-[14px] mb-6">
          {statCards.map(s => {
            const inner = (
              <>
                <span className={`w-[60px] h-[60px] flex-shrink-0 grid place-items-center rounded-full [&>svg]:w-[31px] [&>svg]:h-[31px] [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${s.iconTint}`}>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-[#64748B]">{s.label}</div>
                  <div className={`mt-[3px] text-[28px] leading-none font-bold ${s.valueCls}`}>{s.value}</div>
                  <div className="mt-1.5 text-[11px] text-[#64748B]">{s.desc}</div>
                  {s.clickable && <div className={`mt-[7px] text-[11px] font-bold ${s.clickCls}`}>Click to view</div>}
                </div>
              </>
            );
            return s.clickable ? (
              <button key={s.label} onClick={() => changeTab(s.key)}
                className={`min-h-[145px] w-full p-5 flex items-center gap-4 text-left rounded-[15px] border bg-white shadow-[0_4px_14px_rgba(16,43,86,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(16,43,86,0.09)] cursor-pointer ${s.cardBorder}`}>
                {inner}
              </button>
            ) : (
              <div key={s.label} className="min-h-[145px] p-5 flex items-center gap-4 rounded-[15px] border border-[#DCE5F0] bg-white shadow-[0_4px_14px_rgba(16,43,86,0.04)]">
                {inner}
              </div>
            );
          })}
        </section>

        {/* APPROVAL INFO */}
        {filter !== 'all' && (
          <div className="flex items-center gap-2.5 px-[15px] py-3 mb-[15px] rounded-[10px] border border-[#F4D99A] bg-[#FFF9EA] text-[#9A6700] text-[13px]">
            <span>ⓘ</span>
            <div>{filter === 'pending_time_in'
              ? 'Review staff Time In records and approve or reject them.'
              : 'Review staff Time Out records and approve or reject them.'}</div>
          </div>
        )}

        {/* TABLE */}
        <section className="rounded-[15px] border border-[#DCE5F0] bg-white shadow-[0_4px_16px_rgba(16,43,86,0.05)] overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead className="bg-[#FBFCFE]">
                <tr>
                  {['STAFF NAME', 'USERNAME', 'DATE', 'TIME IN', 'TIME OUT', 'APPROVED TIME IN', 'APPROVED TIME OUT', 'TOTAL HOURS', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} className="py-[15px] px-[13px] border-b border-[#DCE5F0] text-left whitespace-nowrap text-[10px] font-extrabold tracking-[0.4px] text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-5"><SkeletonRows rows={6} height="h-10" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={10}><StaffErrorState message={error} onRetry={load} /></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={10}><StaffEmptyState title="No attendance records found." description="Adjust your filters or try a different date range." /></td></tr>
                ) : items.map(r => {
                  const st = deriveStatus(r);
                  const pin = r.time_in_status === 'Pending';
                  const pout = r.time_out_status === 'Pending';
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFCFF] transition-colors">
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4]">
                        <div className="flex items-center gap-2.5">
                          <span className="w-[31px] h-[31px] flex-shrink-0 grid place-items-center rounded-full bg-xevera-600 text-white text-[10px] font-extrabold">{initials(r.staff_name)}</span>
                          <span className="font-bold">{r.staff_name}</span>
                        </div>
                      </td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4] text-xs whitespace-nowrap">{r.username}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4] text-xs whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4] text-xs whitespace-nowrap">{formatTime(r.time_in) || '—'}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4] text-xs whitespace-nowrap">{formatTime(r.time_out) || '—'}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4]">
                        {r.time_in_status === 'Approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-[#E8F7EF] text-[#16A05D] text-[10px] font-bold">{formatTime(r.approved_time_in) || formatTime(r.time_in)} ✓</span>
                        ) : pin ? (
                          <button onClick={() => setDrawerRecord(r)} className="px-2.5 py-[6px] rounded-[7px] border-0 bg-[#FFF5DD] text-[#D88400] text-[10px] font-extrabold hover:bg-[#F59E0B] hover:text-white cursor-pointer">Approve</button>
                        ) : '—'}
                      </td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4]">
                        {r.time_out_status === 'Approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-[#E8F7EF] text-[#16A05D] text-[10px] font-bold">{formatTime(r.approved_time_out) || formatTime(r.time_out)} ✓</span>
                        ) : pout ? (
                          <button onClick={() => setDrawerRecord(r)} className="px-2.5 py-[6px] rounded-[7px] border-0 bg-[#FFF5DD] text-[#D88400] text-[10px] font-extrabold hover:bg-[#F59E0B] hover:text-white cursor-pointer">Approve</button>
                        ) : '—'}
                      </td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4] text-xs whitespace-nowrap">{r.total_hours || '—'}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4]">{statusPill(st)}</td>
                      <td className="py-[15px] px-[13px] border-b border-[#E8EDF4]">
                        <button onClick={() => setDrawerRecord(r)}
                          className="inline-flex items-center gap-[5px] px-[11px] py-2 rounded-lg border border-[#D7E2EF] bg-white text-xs font-bold hover:border-xevera-600 hover:text-xevera-600 cursor-pointer">
                          Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 p-[15px]">
            <div className="text-xs text-[#64748B]">Showing {from} to {to} of {total} records</div>
            {totalPages > 1 && <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />}
          </div>
        </section>

        {/* DETAILS DRAWER */}
        {drawerRecord && <AttendanceDrawer record={drawerRecord} reviewingId={reviewingId} onClose={() => setDrawerRecord(null)} onAction={(action, type) => setApproveAction({ id: drawerRecord.id, type, action, name: drawerRecord.staff_name, reason: '' })} onRecordTimeout={() => setAdminTimeOut({ id: drawerRecord.id, staff_id: drawerRecord.staff_id, name: drawerRecord.staff_name })} />}

        {/* APPROVE / REJECT MODAL */}
        {approveAction && (
          <Modal
            open={approveAction !== null}
            title={`${approveAction.action === 'approve' ? 'Approve' : 'Reject'} ${approveAction.type === 'time_in' ? 'Time In' : 'Time Out'} Request`}
            description={`You are about to ${approveAction.action} the ${approveAction.type === 'time_in' ? 'time in' : 'time out'} request for ${approveAction.name}.`}
            danger={approveAction.action === 'reject'}
            confirmLabel={reviewingId ? 'Processing...' : (approveAction.action === 'approve' ? 'Approve' : 'Reject')}
            onConfirm={confirmApproval}
            onCancel={() => setApproveAction(null)}
          >
            {approveAction.action === 'reject' && (
              <label className="block">
                <span className="block text-xs font-bold mb-1.5 text-[#111827]">Rejection Reason <span className="text-[#DC2626]">*</span></span>
                <textarea rows={3} value={approveAction.reason || ''} onChange={e => setApproveAction(a => ({ ...a, reason: e.target.value }))} placeholder="Provide a reason for this decision..." className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
              </label>
            )}
          </Modal>
        )}

        {/* ADMIN TIME OUT MODAL */}
        {adminTimeOut && (
          <Modal
            open={adminTimeOut !== null}
            title="Record Time Out"
            description={`You are about to record a time out for ${adminTimeOut.name}. This action will be logged in the audit trail.`}
            confirmLabel={adminTimeOutBusy ? 'Recording...' : 'Record Time Out'}
            onConfirm={submitAdminTimeOut}
            onCancel={() => { setAdminTimeOut(null); setAdminTimeOutReason(''); }}
          >
            <label className="block">
              <span className="block text-xs font-bold mb-1.5 text-[#111827]">Reason <span className="text-[#DC2626]">*</span></span>
              <textarea rows={3} value={adminTimeOutReason} onChange={e => setAdminTimeOutReason(e.target.value)} placeholder="Provide a reason for recording this time out..." className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
            </label>
          </Modal>
        )}

      </div>
    </div>
  );
}

function AttendanceDrawer({ record, onClose, onAction, onRecordTimeout, reviewingId = null }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const st = deriveStatus(record);
  const pin = record.time_in_status === 'Pending';
  const pout = record.time_out_status === 'Pending';
  const inApproved = record.time_in_status === 'Approved';
  const outApproved = record.time_out_status === 'Approved';
  const inRejected = record.time_in_status === 'Rejected';
  const outRejected = record.time_out_status === 'Rejected';

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-[rgba(16,43,86,0.18)] backdrop-blur-[2px]" onClick={onClose}></div>
      <aside className="fixed top-0 right-0 z-[100] w-[430px] max-w-full h-screen flex flex-col bg-white border-l border-[#DCE5F0] shadow-[-12px_0_35px_rgba(16,43,86,0.12)]">
        <div className="flex items-center justify-between py-[27px] px-[25px] border-b border-[#DCE5F0]">
          <h2 className="text-[21px] font-bold text-[#102B56]">Attendance Details</h2>
          <button onClick={onClose} aria-label="Close" className="w-[35px] h-[35px] grid place-items-center rounded-lg bg-transparent text-[#52637C] text-[27px] leading-none hover:bg-[#F1F5F9] cursor-pointer">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-[25px]">
          {/* PROFILE */}
          <div className="flex items-center gap-3.5 pb-[23px] border-b border-[#DCE5F0]">
            <span className="w-[50px] h-[50px] grid place-items-center rounded-full bg-xevera-600 text-white text-sm font-extrabold">{initials(record.staff_name)}</span>
            <div>
              <h3 className="text-lg font-bold text-[#102B56]">{record.staff_name}</h3>
              <p className="mt-1 text-[13px] text-[#64748B]">@{record.username}</p>
            </div>
            <div className="ml-auto">{statusPill(st)}</div>
          </div>

          {/* DATE */}
          <div className="flex items-center justify-between py-[22px]">
            <div>
              <span className="block text-xs text-[#64748B]">Date</span>
              <strong className="block mt-1.5 text-sm text-inherit">{formatLongDate(record.date)}</strong>
            </div>
            <span className="text-[#102B56] text-xl">▣</span>
          </div>

          {/* TIME IN */}
          <div className="mb-[18px] p-[19px] rounded-[13px] border border-[#DCE5F0] bg-white">
            <h4 className="text-[13px] font-bold text-xevera-600 mb-[22px]">TIME IN</h4>
            <span className="block text-xs text-[#64748B]">Staff Time In</span>
            <strong className="block mt-[5px] text-[21px] text-[#102B56]">{formatTime(record.time_in) || '—'}</strong>

            <div className="mt-[21px]">
              <span className="block mb-2 text-xs text-[#64748B]">Approval Status</span>
              {inApproved && <span className="status completed inline-flex px-[9px] py-[5px] rounded-md bg-[#E8F7EF] border border-[#BFE8D2] text-[10px] font-bold text-[#16A05D]">✓ Approved</span>}
              {inRejected && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#FDECEC] border border-[#F5C7C7] text-[10px] font-bold text-[#DC2626]">Rejected</span>}
              {pin && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#FFF5DD] border border-[#F5D58D] text-[10px] font-bold text-[#D88400]">Pending</span>}
              {!record.time_in && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#F1F5F9] border border-[#DCE5F0] text-[10px] font-bold text-[#64748B]">Not Recorded</span>}
            </div>

            {pin && (
              <div className="grid grid-cols-2 gap-3 mt-5 max-sm:grid-cols-1">
                <button onClick={() => onAction('approve', 'time_in')} disabled={!!reviewingId}
                  className="h-[37px] flex items-center justify-center gap-1.5 rounded-[7px] border border-[#16A05D] bg-[#16A05D] text-white text-[10px] font-extrabold hover:bg-[#12864E] disabled:opacity-50 cursor-pointer">✓ Approve Time In</button>
                <button onClick={() => onAction('reject', 'time_in')} disabled={!!reviewingId}
                  className="h-[37px] flex items-center justify-center gap-1.5 rounded-[7px] border border-[#DC2626] bg-white text-[#DC2626] text-[10px] font-extrabold hover:bg-[#FDECEC] disabled:opacity-50 cursor-pointer">× Reject Time In</button>
              </div>
            )}
          </div>

          {/* TIME OUT */}
          <div className="mb-[18px] p-[19px] rounded-[13px] border border-[#DCE5F0] bg-white">
            <h4 className="text-[13px] font-bold text-xevera-600 mb-[22px]">TIME OUT</h4>
            <span className="block text-xs text-[#64748B]">Staff Time Out</span>
            <strong className="block mt-[5px] text-[21px] text-[#102B56]">{formatTime(record.time_out) || '—'}</strong>

            <div className="mt-[21px]">
              <span className="block mb-2 text-xs text-[#64748B]">Approval Status</span>
              {outApproved && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#E8F7EF] border border-[#BFE8D2] text-[10px] font-bold text-[#16A05D]">✓ Approved</span>}
              {outRejected && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#FDECEC] border border-[#F5C7C7] text-[10px] font-bold text-[#DC2626]">Rejected</span>}
              {pout && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#FFF5DD] border border-[#F5D58D] text-[10px] font-bold text-[#D88400]">Pending</span>}
              {!record.time_out && <span className="inline-flex px-[9px] py-[5px] rounded-md bg-[#F1F5F9] border border-[#DCE5F0] text-[10px] font-bold text-[#64748B]">Not Available</span>}
            </div>

            {pout ? (
              <div className="grid grid-cols-2 gap-3 mt-5 max-sm:grid-cols-1">
                <button onClick={() => onAction('approve', 'time_out')} disabled={!!reviewingId}
                  className="h-[37px] flex items-center justify-center gap-1.5 rounded-[7px] border border-[#16A05D] bg-[#16A05D] text-white text-[10px] font-extrabold hover:bg-[#12864E] disabled:opacity-50 cursor-pointer">✓ Approve Time Out</button>
                <button onClick={() => onAction('reject', 'time_out')} disabled={!!reviewingId}
                  className="h-[37px] flex items-center justify-center gap-1.5 rounded-[7px] border border-[#DC2626] bg-white text-[#DC2626] text-[10px] font-extrabold hover:bg-[#FDECEC] disabled:opacity-50 cursor-pointer">× Reject Time Out</button>
              </div>
            ) : !outApproved && (
              <div className="mt-2.5 text-center text-[10px] leading-relaxed text-[#94A3B8]">
                {record.time_out
                  ? (inApproved ? 'This time out was already reviewed.' : 'Time In must be approved before Time Out can be approved.')
                  : record.attendance_status === 'TIMED_IN'
                    ? 'Staff is still timed in.'
                    : 'No time out recorded yet.'}
              </div>
            )}

            {record.attendance_status === 'TIMED_IN' && (
              <button onClick={onRecordTimeout}
                className="w-full mt-4 h-[37px] rounded-[7px] border-0 bg-xevera-600 text-white text-[11px] font-extrabold hover:bg-[#063A7A] cursor-pointer">
                Record Time Out for Staff
              </button>
            )}
          </div>

          {/* TOTAL HOURS */}
          <div className="pt-[5px]">
            <span className="block text-[11px] text-[#64748B]">TOTAL HOURS</span>
            <strong className="block mt-[7px] text-[23px] text-[#102B56]">{record.total_hours || '—'}</strong>
          </div>
        </div>

        <div className="py-[18px] px-[25px] border-t border-[#DCE5F0]">
          <button onClick={onClose} className="w-full h-[42px] rounded-[9px] border border-[#D7E2EF] bg-white text-xs font-bold hover:bg-[#F5F8FC] cursor-pointer">Close</button>
        </div>
      </aside>
    </>
  );
}
