import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { useResidentNotifications } from '../../context/ResidentNotificationsContext';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const CATEGORIES = ['Document Request', 'Streetlight', 'Waste', 'Water', 'Maintenance', 'Facility', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const inputClass =
  'w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/20 focus:border-xevera-600 placeholder:text-[#9CA3AF]';

const STATUS_CLS = {
  Pending: 'bg-[#FEF3C7] text-[#B45309]',
  Assigned: 'bg-[#DBEAFE] text-[#2563EB]',
  'In Progress': 'bg-[#EDE9FE] text-[#7C3AED]',
  Completed: 'bg-[#DCFCE7] text-[#15803D]',
  Cancelled: 'bg-[#F3F4F6] text-[#6B7280]',
};

function FormContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const { pushLocal } = useResidentNotifications();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: '', location: '', priority: 'Normal', notes: '' });
  const [errors, setErrors] = useState({});

  const loadMine = useCallback(async () => {
    setError(false);
    try {
      const data = await apiFetch('service_requests/list.php?limit=50');
      setRequests(data.items || []);
    } catch {
      setRequests([]);
      setError(true);
    }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  function validate() {
    const next = {};
    if (!formData.title.trim()) next.title = 'Describe the service you need.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('service_requests/create.php', { method: 'POST', body: formData });
      pushLocal(`Your service request${res?.ref_id ? ` ${res.ref_id}` : ''} was submitted. The team will follow up.`);
      setDone(res?.ref_id || 'submitted');
      setFormData({ title: '', category: '', location: '', priority: 'Normal', notes: '' });
      setErrors({});
      showToast('Service request submitted! The team will follow up.');
      loadMine();
    } catch (err) {
      showToast(err.message || 'Could not submit your request.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 sm:p-6">
        <h2 className="text-[15px] font-head font-extrabold text-[#111827] mb-1">Request a Community Service</h2>
        <p className="text-[12px] text-[#6B7280] mb-5">Need a document, streetlight repair, waste collection, or maintenance help? Submit a request and our team will take care of it.</p>

        {done && (
          <div className="mb-5 rounded-xl border border-success bg-success-bg p-4 flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center flex-shrink-0"><Icon name="check" size={16} /></span>
            <div>
              <div className="text-sm font-bold text-[#111827]">Request submitted</div>
              <div className="text-[12px] text-[#6B7280] mt-0.5">Reference <span className="font-bold text-xevera-700">{done}</span>. Track its status below.</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Service Requested <span className="text-red-600">*</span></label>
            <input type="text" value={formData.title} onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Streetlight not working near our block" className={inputClass} />
            {errors.title && <p className="text-[11px] text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#111827]">Category</label>
              <select value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))} className={inputClass}>
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#111827]">Location</label>
              <input type="text" value={formData.location} onChange={(e) => setFormData((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Phase 2, Block 4" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-[#111827]">Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value }))} className={inputClass}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 text-[#111827]">Details <span className="text-[10px] text-[#9CA3AF] font-normal">(Optional)</span></label>
            <textarea value={formData.notes} onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              rows={4} placeholder="Tell us more about what you need..." className={`${inputClass} resize-y min-h-[100px]`} />
          </div>

          <div className="text-[11px] text-[#9CA3AF] inline-flex items-center gap-1">
            <Icon name="user" size={12} /> Submitting as <span className="font-bold text-[#4B5563]">{user?.name}</span> ({user?.email})
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl bg-xevera-600 text-white font-bold text-sm hover:bg-xevera-700 transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-sm">
            {submitting ? 'Submitting...' : 'Submit Service Request'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F1F2F5]">
          <h3 className="text-[15px] font-head font-extrabold text-[#111827]">My Requests</h3>
          <p className="text-[12px] text-[#6B7280] mt-0.5">Track the status of your submitted requests.</p>
        </div>
        {!requests ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-[#F3F4F6] animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="p-5"><StaffErrorState message="Unable to load your requests." onRetry={loadMine} /></div>
        ) : requests.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <span className="w-12 h-12 mx-auto rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mb-3">
              <Icon name="signature" size={20} />
            </span>
            <p className="text-sm font-bold text-[#111827]">No requests yet</p>
            <p className="text-[12px] text-[#6B7280] mt-1 max-w-sm mx-auto">
              Requests you submit will appear here with their live status.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F2F5] max-h-[420px] overflow-y-auto">
            {requests.map((r) => (
              <div key={r.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#111827] truncate">{r.title}</div>
                    <div className="text-[10px] text-[#9CA3AF] font-bold mt-0.5">{r.ref_id} · {r.date}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[r.status] || STATUS_CLS.Pending}`}>{r.status}</span>
                </div>
                {(r.location || r.category) && (
                  <div className="text-[11px] text-[#6B7280] mt-1">{[r.category, r.location].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResidentServiceRequestPage({ onNavigate }) {
  return (
    <ResidentLayout activePage="service-request" pageTitle="Service Requests" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Service Requests"
        subtitle="Request community services and track them here."
      />
      <FormContent />
    </ResidentLayout>
  );
}