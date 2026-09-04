import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

function fmtDate(value) {
  const d = new Date(String(value || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(value || '');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (${days[d.getDay()]})`;
}

const STATUS_PILLS = {
  Approved: 'bg-[#E9F8EF] text-[#16A34A]',
  Pending: 'bg-[#FFF7DF] text-[#C27A00]',
  Rejected: 'bg-[#FFF0F0] text-[#EF2B2D]',
};

export default function AttendancePage() {
  const toast = useToast();
  const { user } = useAuth();
  const isStaff = user?.role === 'Staff';
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [today, setToday] = useState(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attBusy, setAttBusy] = useState(false);
  const [clock, setClock] = useState('');

  /* Request modal */
  const [requestType, setRequestType] = useState(null); /* 'Time In' | 'Time Out' | null */
  const [remarks, setRemarks] = useState('');

  /* Detail modal */
  const [viewRow, setViewRow] = useState(null);

  useEffect(() => {
    const tick = () => setClock(
      new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })
    );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(false); setItems(null); }
    const params = new URLSearchParams({ limit: '50' });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    try {
      const d = await apiFetch('attendance/history.php?' + params.toString());
      setItems(d.items || []);
    } catch {
      if (!silent) { setItems([]); setError(true); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const loadToday = useCallback(async (silent = false) => {
    if (!silent) setAttLoading(true);
    try {
      setToday(await apiFetch('attendance/today.php'));
    } catch {
      if (!silent) setToday(null);
    } finally {
      if (!silent) setAttLoading(false);
    }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  /*
   * Live updates: poll today + history every 15s so approvals/rejections
   * made by Admin / Super Admin appear without a manual page refresh.
   */
  useEffect(() => {
    const t = setInterval(() => { loadToday(true); loadHistory(true); }, 15000);
    return () => clearInterval(t);
  }, [loadToday, loadHistory]);

  async function submitRequest(e) {
    e.preventDefault();
    if (!requestType) return;
    setAttBusy(true);
    try {
      if (requestType === 'Time In') {
        await apiFetch('attendance/time-in.php', { method: 'POST', body: {} });
        toast('Time in request submitted. Waiting for Admin approval.');
      } else {
        await apiFetch('attendance/time-out.php', {
          method: 'POST',
          body: remarks.trim() ? { reason: remarks.trim() } : {},
        });
        toast('Time out request submitted. Waiting for Admin approval.');
      }
      setRequestType(null);
      setRemarks('');
      loadToday();
      loadHistory();
    } catch (e2) {
      toast(e2.message || 'Failed to submit request.', 'error');
    } finally {
      setAttBusy(false);
    }
  }

  async function cancelAttendance() {
    setAttBusy(true);
    try {
      await apiFetch('attendance/cancel.php', {
        method: 'POST',
        body: { type: today?.pending_time_in ? 'time_in' : 'time_out' },
      });
      toast('Request cancelled.');
      loadToday();
      loadHistory();
    } catch (e) {
      toast(e.message || 'Failed to cancel.', 'error');
    } finally {
      setAttBusy(false);
    }
  }

  /* Per-day attendance records (one row per day, both time in and out) */
  const dayRows = useMemo(() => (items || []).map((r) => ({
    id: r.id,
    date: r.date,
    timeIn: r.time_in || null,
    timeOut: r.time_out || null,
    timeInStatus: r.time_in_status === 'Approved' ? 'Approved' : (r.time_in_status === 'Rejected' ? 'Rejected' : (r.time_in ? 'Pending' : null)),
    timeOutStatus: r.time_out_status === 'Approved' ? 'Approved' : (r.time_out_status === 'Rejected' ? 'Rejected' : (r.time_out ? 'Pending' : null)),
    status: r.status,
    totalHours: r.total_hours || null,
    reviewedBy: r.time_out_reviewed_by || r.time_in_reviewed_by || null,
    remarks: r.time_out_reason || '',
    raw: r,
  })), [items]);

  function exportCSV() {
    const header = ['Date', 'Time In', 'Time In Status', 'Time Out', 'Time Out Status', 'Total Hours', 'Status', 'Reviewed By', 'Remarks'];
    const lines = dayRows.map((r) => [
      fmtDate(r.date), r.timeIn || '', r.timeInStatus || '', r.timeOut || '', r.timeOutStatus || '',
      r.totalHours || '', r.status, r.reviewedBy || '', r.remarks || '',
    ]);
    const csv = [header, ...lines].map((row) =>
      row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xevera-my-attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const todayDate = new Date();
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const completed = today?.attendance_status === 'TIMED_OUT';

  function pillFor(status) {
    return STATUS_PILLS[status] || 'bg-[#F3F4F6] text-[#6B7280]';
  }

  return (
    <div className="flex-1 space-y-5">
      <StaffPageHeader
        eyebrow="ATTENDANCE"
        title="Time In / Time Out"
        description="Track your attendance by requesting time in and time out."
      />

      {/* ================= TODAY ================= */}
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-head font-extrabold text-[#172033]">Today's Attendance</h2>
          <p className="text-sm text-[#6B7280] mt-1">{todayDate.toLocaleDateString('en-US', dateOptions)}</p>
        </div>

        {attLoading ? (
          <SkeletonRows rows={4} height="h-16" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_270px] gap-3.5">
            {/* Time In */}
            <div className="min-h-[120px] rounded-xl border border-[#E5E7EB] p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#68758F]">Time In</div>
              <div className="text-[23px] font-head font-extrabold mt-2 text-[#16A34A]">
                {today?.time_in_label || (today?.pending_time_in ? 'Pending' : '—')}
              </div>
              <div className="text-xs text-[#66728A] mt-2">
                Status:{' '}
                {today?.time_in_status === 'Approved' ? (
                  <span className="text-[#16A34A] font-bold">Approved ✓</span>
                ) : today?.time_in_status === 'Rejected' ? (
                  <span className="text-[#EF2B2D] font-bold">Rejected ✕</span>
                ) : today?.pending_time_in ? (
                  <span className="text-[#C27A00] font-bold">Pending Approval</span>
                ) : ('—')}
              </div>
              <div className="text-xs text-[#66728A] mt-1">By: {today?.time_in_reviewed_by || 'Admin / Super Admin'}</div>
            </div>

            {/* Time Out */}
            <div className="min-h-[120px] rounded-xl border border-[#E5E7EB] p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#68758F]">Time Out</div>
              <div className="text-[23px] font-head font-extrabold mt-2 text-[#EF2B2D]">
                {today?.time_out_label || (today?.pending_time_out ? 'Pending' : '—')}
              </div>
              <div className="text-xs text-[#66728A] mt-2">
                Status:{' '}
                {today?.time_out_status === 'Approved' ? (
                  <span className="text-[#16A34A] font-bold">Approved ✓</span>
                ) : today?.time_out_status === 'Rejected' ? (
                  <span className="text-[#EF2B2D] font-bold">Rejected ✕</span>
                ) : today?.pending_time_out ? (
                  <span className="text-[#C27A00] font-bold">Pending Approval</span>
                ) : ('—')}
              </div>
              <div className="text-xs text-[#66728A] mt-1">By: {today?.time_out_reviewed_by || 'Admin / Super Admin'}</div>
            </div>

            {/* Total Hours */}
            <div className="min-h-[120px] rounded-xl border border-[#E5E7EB] p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#68758F]">Total Hours</div>
              <div className="text-[23px] font-head font-extrabold mt-2 text-[#111827]">{today?.total_hours || '—'}</div>
            </div>

            {/* Today's Status */}
            <div className="min-h-[120px] rounded-xl border border-[#E5E7EB] p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-[#68758F]">Today's Status</div>
              {completed && (
                <span className="inline-block bg-[#E9F8EF] text-[#16A34A] px-2.5 py-1 rounded-full text-[11px] font-bold mt-2">
                  Completed
                </span>
              )}
              <div className="text-xs text-[#66728A] mt-2">
                {completed
                  ? 'Thank you for your work today!'
                  : today?.status || 'Not started yet.'}
              </div>
            </div>

            {/* Current Local Time */}
            <div className="md:col-span-2 xl:col-span-1 xl:border-l border-[#E5E7EB] flex flex-col items-center justify-center p-4">
              <small className="text-[10px] uppercase tracking-wider font-bold text-[#68758F]">Current Local Time</small>
              <strong className="text-[32px] font-head font-extrabold my-2.5 text-[#111827]">{clock}</strong>
              <span className="bg-[#EAF2FF] text-xevera-700 px-2.5 py-1 rounded-full text-[10px] font-bold">PHST (UTC+8)</span>
            </div>
          </div>
        )}
      </div>

      {/* ================= REQUEST CARDS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] border-t-4 border-t-[#16A34A] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5">
          <h3 className="text-base font-extrabold text-[#087D28] mb-2">Request Time In</h3>
          <p className="text-xs text-[#6B7280] mb-4">Request to start your work for the day.</p>
          <button onClick={() => isStaff && setRequestType('Time In')} disabled={!isStaff || attBusy || !today?.can_time_in}
            className="w-full h-10 rounded-lg bg-[#0CA52F] text-white text-sm font-bold hover:brightness-95 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer">
            ⇥ &nbsp; Request Time In
          </button>
          <p className="text-center text-[11px] text-[#68758F] mt-3">You can only request once per day.</p>
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] border-t-4 border-t-[#ED171B] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5">
          <h3 className="text-base font-extrabold text-[#172033] mb-2">Request Time Out</h3>
          <p className="text-xs text-[#6B7280] mb-4">Request to end your work for the day.</p>
          <button onClick={() => isStaff && setRequestType('Time Out')} disabled={!isStaff || attBusy || !today?.can_time_out}
            className="w-full h-10 rounded-lg bg-[#ED171B] text-white text-sm font-bold hover:brightness-95 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer">
            ⇥ &nbsp; Request Time Out
          </button>
          <p className="text-center text-[11px] text-[#68758F] mt-3">Time out can only be requested after time in.</p>
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5">
          <h3 className="text-base font-extrabold text-[#172033] mb-4">How it works</h3>
          {[
            'Request time in or time out.',
            'Your request will be sent to Admin / Super Admin.',
            'They will review and approve your request.',
            'Once approved, it will appear in your history.',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5 my-2.5 text-xs text-[#4E5B73]">
              <span className="min-w-[19px] h-[19px] rounded-full bg-xevera-600 text-white grid place-items-center text-[10px] font-bold">{i + 1}</span>
              {step}
            </div>
          ))}
          {today?.can_cancel && (
            <button onClick={cancelAttendance} disabled={attBusy}
              className="mt-2 w-full h-9 rounded-lg border border-[#E5E7EB] text-xs font-bold text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-50 transition cursor-pointer">
              Cancel pending request
            </button>
          )}
        </div>
      </div>

      {/* ================= FILTER ================= */}
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-4">
        <div className="text-[13px] font-bold text-xevera-700 mb-3">▣ &nbsp; Filter by Date Range</div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_130px] gap-4">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 border border-[#E5E7EB] rounded-lg px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-10 border border-[#E5E7EB] rounded-lg px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          <button onClick={() => loadHistory()}
            className="h-10 rounded-lg bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 transition cursor-pointer">
            ⚱ &nbsp; Filter
          </button>
        </div>
      </div>

      {/* ================= HISTORY ================= */}
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-sm font-bold text-xevera-700">◷ &nbsp; My Attendance History</div>
          <button onClick={exportCSV}
            className="h-9 px-4 rounded-lg border border-[#B8D0FB] bg-white text-xevera-700 text-xs font-bold hover:bg-[#F1F6FF] transition cursor-pointer">
            ⇩ &nbsp; Export
          </button>
        </div>

        {loading ? (
          <SkeletonRows rows={5} height="h-12" />
        ) : error ? (
          <StaffErrorState onRetry={loadHistory} />
        ) : dayRows.length === 0 ? (
          <StaffEmptyState title="No attendance records yet." description="Your attendance history appears here after you time in." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead className="bg-[#F7F9FC]">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#66728A]">
                    <th className="py-3 px-2.5 font-bold">Date</th>
                    <th className="py-3 px-2.5 font-bold">Time In</th>
                    <th className="py-3 px-2.5 font-bold">Time Out</th>
                    <th className="py-3 px-2.5 font-bold">Total Hours</th>
                    <th className="py-3 px-2.5 font-bold">Status</th>
                    <th className="py-3 px-2.5 font-bold">Reviewed By</th>
                    <th className="py-3 px-2.5 font-bold">Remarks</th>
                    <th className="py-3 px-2.5 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((r) => (
                    <tr key={r.id} className="border-t border-[#EDF0F5] hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-2.5 text-xs text-[#374151] whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="py-3 px-2.5 text-xs text-[#374151] whitespace-nowrap">
                        {r.timeIn || <span className="text-[#8CA0BC]">Missing</span>}
                        {r.timeInStatus === 'Pending' && <span className="block text-[10px] text-[#C27A00]">Pending approval</span>}
                      </td>
                      <td className="py-3 px-2.5 text-xs text-[#374151] whitespace-nowrap">
                        {r.timeOut || <span className="text-[#8CA0BC]">Missing</span>}
                        {r.timeOutStatus === 'Pending' && <span className="block text-[10px] text-[#C27A00]">Pending approval</span>}
                      </td>
                      <td className="py-3 px-2.5 text-xs text-[#374151] whitespace-nowrap">{r.totalHours || '—'}</td>
                      <td className="py-3 px-2.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${pillFor(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="py-3 px-2.5 text-xs text-[#374151] whitespace-nowrap">
                        {r.reviewedBy || <span className="text-[#C27A00]">Pending Review</span>}
                      </td>
                      <td className="py-3 px-2.5 text-xs text-[#374151]">{r.remarks || '—'}</td>
                      <td className="py-3 px-2.5">
                        <button onClick={() => setViewRow(r)} title="View details"
                          className="border-0 bg-transparent text-xevera-600 hover:text-xevera-700 cursor-pointer text-base">◉</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-center text-[#6D7890] text-[11px] pt-4">
              Showing {dayRows.length} of {dayRows.length} records
            </div>
          </>
        )}
      </div>

      {/* ================= REQUEST MODAL ================= */}
      {requestType && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-[rgba(4,24,53,0.55)]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setRequestType(null); }}>
          <form onSubmit={submitRequest} className="w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="px-5 py-5 border-b border-[#E1E7F0] flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#172033] m-0">Request {requestType}</h2>
              <button type="button" aria-label="Close" onClick={() => setRequestType(null)}
                className="border-0 bg-transparent text-xl text-[#647593] cursor-pointer leading-none">×</button>
            </div>

            <div className="p-5">
              <p className="text-[13px] text-[#68758F] mb-4">
                Your request will be sent to Admin / Super Admin for approval.
              </p>

              <div className="bg-[#F7F9FC] border border-[#E1E7F0] rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#7A8598] font-bold">Request Type</div>
                    <div className="font-bold text-[13px] mt-1.5 text-[#111827]">{requestType}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#7A8598] font-bold">Request Time</div>
                    <div className="font-bold text-[13px] mt-1.5 text-[#111827]">
                      {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#7A8598] font-bold">Send Request To</div>
                    <div className="font-bold text-[13px] mt-1.5 text-[#111827]">Admin / Super Admin</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#7A8598] font-bold">Status</div>
                    <div className="font-bold text-[13px] mt-1.5 text-[#C27A00]">Pending Approval</div>
                  </div>
                </div>
              </div>

              <label className="block text-xs font-bold text-[#26364B]">
                Remarks
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  placeholder={requestType === 'Time Out'
                    ? 'Enter reason or remarks (optional)...'
                    : 'Enter remarks (optional)...'}
                  className="w-full h-[90px] resize-none border border-[#E1E7F0] rounded-[9px] p-3 mt-2 text-[13px] font-normal text-[#172033] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#94A3B8]" />
              </label>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <button type="button" onClick={() => setRequestType(null)}
                  className="h-10 rounded-lg bg-white border border-[#E1E7F0] text-[#0D1B3D] text-sm font-bold hover:bg-[#F5F8FC] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={attBusy}
                  className="h-10 rounded-lg bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-50 transition cursor-pointer">
                  {attBusy ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= DETAIL MODAL ================= */}
      {viewRow && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-[rgba(4,24,53,0.55)]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setViewRow(null); }}>
          <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="px-5 py-5 border-b border-[#E1E7F0] flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#172033] m-0">Attendance Details</h2>
              <button aria-label="Close" onClick={() => setViewRow(null)}
                className="border-0 bg-transparent text-xl text-[#647593] cursor-pointer leading-none">×</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {[
                ['Date', fmtDate(viewRow.date)],
                ['Time In', `${viewRow.timeIn || 'Missing'}${viewRow.timeInStatus ? ` (${viewRow.timeInStatus})` : ''}`],
                ['Time Out', `${viewRow.timeOut || 'Missing'}${viewRow.timeOutStatus ? ` (${viewRow.timeOutStatus})` : ''}`],
                ['Total Hours', viewRow.totalHours || '—'],
                ['Reviewed By', viewRow.reviewedBy || 'Pending Review'],
                ['Remarks', viewRow.remarks || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#7A8598]">{label}</span>
                  <span className="text-right font-semibold text-[#111827] break-words">{value}</span>
                </div>
              ))}
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7A8598]">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${pillFor(viewRow.status)}`}>{viewRow.status}</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E1E7F0] bg-[#FAFBFC] flex justify-end">
              <button onClick={() => setViewRow(null)}
                className="h-10 px-5 rounded-lg bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
