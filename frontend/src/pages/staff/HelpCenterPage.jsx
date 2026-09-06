import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const FAQ_CATEGORIES = [
  'Reports',
  'Attendance',
  'Messages',
  'Account',
  'System',
  'Troubleshooting',
];

const FAQ_ITEMS = [
  {
    id: 1,
    question: 'How do I view my assigned reports?',
    answer: 'Navigate to the Assigned Reports section in your Staff Dashboard. Here you can see all reports assigned to you with their current status, priority, and due dates.',
  },
  {
    id: 2,
    question: 'How do I update a report status?',
    answer: 'In the Assigned Reports section, find the report you want to update. Use the View or Change status button based on the report\'s current status. You can add remarks and change the status to In Progress, Resolved, or Closed.',
  },
  {
    id: 3,
    question: 'How do I time in?',
    answer: 'Go to the Time In/Out section in your Staff Dashboard. Click the "Start Time In" button at the start of your shift. Your attendance will be recorded with the current time.',
  },
  {
    id: 4,
    question: 'How do I submit a time request?',
    answer: 'Navigate to My Time Requests in your Staff Dashboard. Click "Create Request" and select the request type (Leave, Overtime, Schedule Change, or Time Adjustment). Fill in the date, time, and reason, then submit for approval.',
  },
  {
    id: 5,
    question: 'How do I change my password?',
    answer: 'In the Settings page, go to the Privacy tab. Enter your current password and new password, then click "Update Password." You can also change your password from the profile dropdown in the top header.',
  },
];

export default function HelpCenterPage() {
  const [articles, setArticles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('All');
  const [contact, setContact] = useState(null);

  const loadFaqs = useCallback(() => {
    setLoading(true);
    setError(false);
    apiFetch('helpcenter/list.php').then(d => {
      setArticles(Array.isArray(d.items) ? d.items : []);
    }).catch(() => {
      setError(true);
      setArticles(FAQ_ITEMS);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadFaqs();
    apiFetch('settings/get.php').then(d => {
      setContact({
        address: d.barangay_address || 'Xevera, Calibutbut, Bacolor',
        phone: d.contact_phone || '(02) 8123-4567',
        email: d.contact_email || 'civicdesk@xevera.gov.ph',
      });
    }).catch(() => {});
  }, [loadFaqs]);

  const visible = articles.filter(a =>
    (category === 'All' || String(a.category || '').toLowerCase() === category.toLowerCase()) &&
    (!search.trim() || (a.question + ' ' + a.answer).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="Communications"
        title="Help Center"
        description="How can we help you? Search FAQs or contact support."
        actions={
          <input type="search" placeholder="Search help..." value={search} onChange={e => setSearch(e.target.value)}
            className="min-w-[250px] px-3.5 py-2 rounded-full border border-[#D1D5DB] text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
        }
      />

      <div className="flex gap-1.5 flex-wrap">
        {['All', ...FAQ_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer border border-transparent ${
              category === c ? 'bg-xevera-600 text-white' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F8FAFC]'
            }`}>
            {c}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-4">
        {loading ? (
          <div className="p-5"><SkeletonRows rows={4} height="h-16" /></div>
        ) : error ? (
          <StaffErrorState message="Unable to load help content." onRetry={loadFaqs} />
        ) : visible.length === 0 ? (
          <StaffEmptyState title="No FAQs found matching your search." />
        ) : (
          <div className="space-y-3">
            {visible.map(a => (
              <details key={a.id} className="group bg-white rounded-lg border border-[#E5E7EB] p-4 hover:bg-[#F9FAFB] transition-colors">
                <summary className="flex items-start justify-between cursor-pointer list-none">
                  <div>
                    <h4 className="font-head font-bold text-[#172033]">{a.question}</h4>
                    {a.category && <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">{a.category}</span>}
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9CA3AF] group-open:rotate-180 transition-transform">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">{a.answer}</p>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
        <h3 className="font-head font-extrabold text-sm uppercase tracking-wider text-[#6B7280] mb-4">Contact Support</h3>
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5">
          <div className="space-y-2 text-sm text-[#6B7280]">
            <p><span className="font-bold text-[#111827]">Address:</span> {contact?.address || 'Xevera, Calibutbut, Bacolor'}</p>
            <p><span className="font-bold text-[#111827]">Phone:</span> {contact?.phone || '(02) 8123-4567'}</p>
            <p><span className="font-bold text-[#111827]">Email:</span> {contact?.email || 'civicdesk@xevera.gov.ph'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}