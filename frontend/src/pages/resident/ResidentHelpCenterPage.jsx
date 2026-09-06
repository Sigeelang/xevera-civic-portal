import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';

const FAQS = [
  { q: 'How do I submit a report?', a: 'Go to Report an Issue, fill in the category, location, and description, and attach photos. You can submit without signing in, but creating an account lets you track status.' },
  { q: 'How do I track my report?', a: 'Open My Reports. Each card shows the current status (Pending, In Progress, Resolved, etc.) and the latest activity on the timeline.' },
  { q: 'How long does it take for my report to be resolved?', a: 'Resolution time depends on the category and urgency. The home page shows the current community average. You will receive a notification when your status changes.' },
  { q: 'Can I save a report for later?', a: 'Yes. Open a report and tap the bookmark icon. Saved reports appear under Saved Reports in your sidebar.' },
  { q: 'How do I change my notification settings?', a: 'Open Settings → Notifications. Each channel can be toggled independently and is saved to your account.' },
  { q: 'How is my data protected?', a: 'Xevera follows the Data Privacy Act. Your contact details are only used to update you about your reports and never shared publicly without consent.' },
];

const CONTACT = {
  email: 'civicdesk@xevera.gov.ph',
  phone: '(02) 8123-4567',
  address: 'Xevera, Calibutbut, Bacolor',
  hours: 'Monday – Friday · 8:00 AM – 5:00 PM',
};

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="bg-white border border-[#DFE6EF] rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left cursor-pointer bg-transparent border-none"
      >
        <span className="text-[14px] font-bold text-navy-950">{item.q}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 text-[13px] text-[#4B5876] leading-relaxed">{item.a}</div>}
    </div>
  );
}

const TOPICS = [
  { key: 'my-reports', icon: 'file', title: 'Track a Report', desc: 'View the status of your reports.' },
  { key: 'submit', icon: 'clipboard', title: 'Report an Issue', desc: 'Submit a new community concern.' },
  { key: 'my-account', icon: 'user', title: 'Account & Settings', desc: 'Manage your profile and preferences.' },
  { key: 'contact', icon: 'phone', title: 'Contact Support', desc: 'Send the team a message.' },
];

function Inner({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(0);
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    apiFetch('helpcenter/list.php').then((d) => setArticles(d.items || [])).catch(() => setArticles([]));
  }, []);

  // Pre-fill name + email from the logged-in resident.
  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || user?.name || '',
      email: f.email || user?.email || '',
    }));
  }, [user]);

  const items = articles.length > 0 ? articles.map((a, i) => ({ q: a.question, a: a.answer })) : FAQS;
  const filteredItems = query.trim()
    ? items.filter((f) => (f.q + ' ' + f.a).toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  function goTo(action) {
    if (onNavigate) onNavigate(action);
  }

  async function send(e) {
    e.preventDefault();
    if (!form.subject || !form.message) {
      toast('Please add a subject and message.', 'error');
      return;
    }
    setSending(true);
    try {
      await apiFetch('contact/create.php', { method: 'POST', body: form });
      toast('Message sent. We will get back to you shortly.');
      setForm({ name: '', email: '', subject: '', message: '' });
      setSent(true);
    } catch (err) {
      toast(err.message || 'Could not send your message.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {TOPICS.map((t) => (
          <button
            key={t.key}
            onClick={() => goTo(t.key)}
            className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer"
          >
            <span className="w-10 h-10 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center mb-3">
              <Icon name={t.icon} size={18} strokeWidth={2} />
            </span>
            <div className="text-[13.5px] font-extrabold text-navy-950">{t.title}</div>
            <div className="text-[12px] text-[#6B7280] leading-relaxed mt-1">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(-1); }}
          placeholder="Search help articles..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#DFE6EF] bg-white text-sm text-navy-950 placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[16px] font-head font-extrabold text-navy-950">Frequently Asked Questions</h2>
            <p className="text-[12.5px] text-[#6B7280] mt-0.5">Quick answers to the most common questions.</p>
          </div>
        </div>
        {filteredItems.length === 0 ? (
          <div className="text-center py-10">
            <span className="w-12 h-12 mx-auto rounded-full bg-[#F3F4F6] text-[#9CA3AF] flex items-center justify-center mb-3"><Icon name="search" size={20} /></span>
            <p className="text-sm font-bold text-navy-950">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-[12px] text-[#6B7280] mt-1">Try different keywords or send us a message below.</p>
          </div>
        ) : (
        <div className="space-y-2">
          {filteredItems.slice(0, 6).map((f, i) => (
            <FaqItem
              key={i}
              item={f}
              open={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </div>
        )}
      </div>
    </>
  );
}

export default function ResidentHelpCenterPage({ onNavigate }) {
  return (
    <ResidentLayout activePage="help" pageTitle="Help Center" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Help Center"
        subtitle="Find answers to common questions about the portal."
        className="pt-4 sm:pt-6"
      />
      <Inner onNavigate={onNavigate} />
    </ResidentLayout>
  );
}