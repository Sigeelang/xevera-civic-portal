import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const REQUEST_TYPES = [
  { value: 'Time In correction', label: 'Time In Correction' },
  { value: 'Time Out correction', label: 'Time Out Correction' },
  { value: 'Attendance correction', label: 'Attendance Correction' },
  { value: 'Missing attendance correction', label: 'Missing Attendance Correction' },
];

export default function TimeRequestsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isManager = user?.role === 'Admin' || user?.role === 'Super Admin';
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'Time In correction', date: '', time: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    setItems(null);
    apiFetch('attendance/corrections.php')
      .then(d => setItems(Array.isArray(d?.items) ? d.items : []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Time requests are a Staff-only feature - managers review them in the Attendance Console. */
  if (isManager) {
    return (
      <div className="flex-1 space-y-5">
        <StaffPageHeader
          eyebrow="Operations"
          title="My Time Requests"
          description="Time requests are available to Staff accounts. Review staff requests in the Attendance Console."
        />
        <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10 text-center">
          <StaffEmptyState
            title="Staff accounts only."
            description="Admins and Super Admins manage attendance via the Attendance Console."
          />
        </div>
      </div>
    );
  }

  function statusClass(st) {
    const cls = {
      Pending: 'bg-[#FEF3C7] text-[#B45309]',
      Approved: 'bg-success-bg text-success-dark',
      Rejected: 'bg-[#FEE2E2] text-[#DC2626]',
    };
    return cls[st] || 'bg-[#F3F4F6] text-[#6B7280]';
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.date || !form.reason) {
      toast('Date and reason are required.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const requestedTimeIn = form.type === 'Time In correction' || form.type === 'Attendance correction'
        ? (form.time ? `${form.date} ${form.time}:00` : null)
        : null;
      const requestedTimeOut = form.type === 'Time Out correction' || form.type === 'Attendance correction'
        ? (form.time ? `${form.date} ${form.time}:00` : null)
        : null;
      // Get the attendance record id for the chosen date (needed by corrections API)
      const hist = await apiFetch(`attendance/history.php?limit=50`);
      const rec = (hist.items || []).find(r => r.date === form.date);
      if (!rec || !rec.id) {
        throw new Error('No attendance record found for the selected date. Time in first.');
      }
      await apiFetch('attendance/corrections.php', {
        method: 'POST',
        body: { attendance_id: rec.id, reason: form.reason, requested_time_in: requestedTimeIn, requested_time_out: requestedTimeOut },
      });
      setShowForm(false);
      setForm({ type: 'Time In correction', date: '', time: '', reason: '' });
      load();
      toast('Request submitted successfully. Status: Pending');
    } catch (err) {
      toast(err.message || 'Could not submit request.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <StaffPageHeader
        eyebrow="Operations"
        title="My Time Requests"
        description="Request corrections for your time in, time out, or attendance."
        actions={
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            + New Request
          </button>
        }
      />

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] overflow-hidden">
        {loading ? (
          <div className="p-5"><SkeletonRows rows={5} height="h-12" /></div>
        ) : error ? (
          <StaffErrorState onRetry={load} />
        ) : (items || []).length === 0 ? (
          <StaffEmptyState title="No time requests yet." description="Create a request to correct your attendance." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#9CA3AF] border-b border-[#E5E7EB]">
                  <th className="py-3 px-4 font-bold">Request ID</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Request Type</th>
                  <th className="py-3 px-4 font-bold">Requested Time</th>
                  <th className="py-3 px-4 font-bold">Reason</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Admin Remarks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3 px-4 font-bold text-xevera-700">#{r.id}</td>
                    <td className="py-3 px-4 text-[#374151]">{r.created_at ? r.created_at.split(' ')[0] : '—'}</td>
                    <td className="py-3 px-4 text-[#374151]">
                      {r.requested_time_in && r.requested_time_out ? 'Attendance correction'
                        : r.requested_time_in ? 'Time In correction'
                        : r.requested_time_out ? 'Time Out correction' : 'Attendance correction'}
                    </td>
                    <td className="py-3 px-4 text-[#374151]">
                      {[r.requested_time_in, r.requested_time_out].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="py-3 px-4 text-[#374151] max-w-[180px] truncate">{r.reason || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${statusClass(r.status)}`}>
                        {r.status || 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#374151] max-w-[160px] truncate">{r.review_reason || r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showForm}
        title="New Time Request"
        description="Submit a correction request for your attendance."
        onCancel={() => setShowForm(false)}
        hideActions
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Request Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
              {REQUEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Requested Time</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2}
              placeholder="Explain why a correction is needed..."
              className="mt-1 w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 resize-y placeholder:text-[#9CA3AF]" />
          </div>
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 disabled:opacity-50 transition-colors cursor-pointer">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}