import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import { formatPhoneLive, normalizePhMobile } from '../../utils/phone';

const CONTACT_GROUPS = [
  {
    title: 'Emergency & Safety',
    icon: 'alerttriangle',
    iconBg: '#FFF0F1',
    iconColor: '#EF3E3E',
    titleColor: '#EF3E3E',
    phoneColor: '#EF3E3E',
    phoneBg: '#FFFAFA',
    phoneBorder: '#FFD0D0',
    items: [
      { name: 'PNP Bacolor', phones: ['0998-595-5452 / 0917-805-4164 / 0998-598-5451', '09985955452'] },
      { name: 'BFP Bacolor', phones: ['0923-103-8363 / (045) 436-1828', '09231038363'] },
      { name: 'Bacolor Municipal Health Office', phones: ['(045) 436-1418', '0454361418'] },
      { name: 'Rescue Ambulance', phones: ['0920-912-3456 / (045) 436-1991', '09209123456'] },
      { name: 'Disaster Risk Reduction Office', phones: ['(045) 436-2579', '0454362579'] },
    ],
  },
  {
    title: 'Xevera Community',
    icon: 'users',
    iconBg: '#EDF5FF',
    iconColor: '#1769FF',
    titleColor: '#1769FF',
    phoneColor: '#1769FF',
    phoneBg: '#F8FBFF',
    phoneBorder: '#CDDDF8',
    items: [
      { name: 'HOA Office', phones: ['0951-595-2696', '09515952696'] },
      { name: 'HOA Command Center', phones: ['0939-108-2760', '09391082760'] },
      { name: 'Xevera Guard House', phones: ['0927-123-4567', '09271234567'] },
      { name: 'Clubhouse', phones: ['(045) 436-2001', '0454362001'] },
      { name: 'Property Management Office', phones: ['(045) 436-2100', '0454362100'] },
    ],
  },
  {
    title: 'Utilities',
    icon: 'drop',
    iconBg: '#EDF9F3',
    iconColor: '#159957',
    titleColor: '#159957',
    phoneColor: '#159957',
    phoneBg: '#F7FDF9',
    phoneBorder: '#C5E9D8',
    items: [
      { name: 'Xevera Water', phones: ['0932-190-2508', '09321902508'] },
      { name: 'A.E.C', phones: ['(045) 888-2888', '0458882888'] },
      { name: 'Meralco', phones: ['0917-551-6211', '09175516211'] },
      { name: 'PLDT', phones: ['171', '171'] },
      { name: 'Garbage Collection', phones: ['(045) 436-2555', '0454362555'] },
    ],
  },
];

function telHref(num) {
  return `tel:${String(num || '').replace(/[^0-9+]/g, '')}`;
}

const CATEGORIES = [
  'General Inquiry',
  'Report Assistance',
  'Account Support',
  'Technical Issue',
  'Other',
];

const initialForm = { name: '', email: '', phone: '', category: '', subject: '', message: '' };

function Field({ label, required, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-bold text-[#102D59] mb-[7px]">
        {label}{required && <span className="text-[#E5484D] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full border border-[#DCE5F2] rounded-[9px] bg-white text-[#102D59] px-[13px] py-[12px] outline-none transition-colors focus:border-[#1769FF] focus:shadow-[0_0_0_3px_rgba(23,105,255,0.08)] placeholder:text-[#A3AFC1]';

function CategorySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const selected = options.includes(value) ? value : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-[44px] border ${open ? 'border-[#1769FF] shadow-[0_0_0_3px_rgba(23,105,255,0.08)]' : 'border-[#DCE5F2]'} rounded-[9px] bg-white px-[13px] outline-none transition-colors cursor-pointer flex items-center justify-between text-left text-[#102D59]`}
      >
        <span className={selected ? 'text-[#102D59]' : 'text-[#A3AFC1]'}>
          {selected || 'Select a category'}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[#6B7896] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 top-[46px] bg-white border border-[#DCE5F2] rounded-[10px] shadow-[0_10px_28px_rgba(20,60,110,0.14)] overflow-hidden max-h-[240px] overflow-y-auto"
        >
          {options.map((opt) => {
            const isActive = opt === selected;
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-[14px] py-2.5 text-[13px] font-bold cursor-pointer transition-colors flex items-center justify-between ${isActive ? 'bg-[#EEF5FF] text-[#1769FF]' : 'text-[#102D59] hover:bg-[#F4F7FC]'}`}
                >
                  <span>{opt}</span>
                  {isActive && (
                    <span className="text-[#1769FF]">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <input type="hidden" name="category" value={selected} />
    </div>
  );
}

export default function ResidentContactPage({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(initialForm);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: f.name || user?.name || '',
      email: f.email || user?.email || '',
    }));
  }, [user]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.message || !form.category || !form.subject) {
      setError('Please complete all required fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (String(form.phone || '').trim() && !/^09\d{9}$/.test(String(form.phone).trim())) {
      setError('Phone number must be 11 digits starting with 09.');
      return;
    }

    setSending(true);
    try {
      await apiFetch('contact/create.php', { method: 'POST', body: form });
      toast('Your support message has been submitted successfully.');
      setForm({
        ...initialForm,
        name: user?.name || '',
        email: user?.email || '',
      });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send your message.');
      toast(err.message || 'Could not send your message.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <ResidentLayout activePage="contact" onNavigate={onNavigate}>
      <div className="px-6 sm:px-7 lg:px-8 py-6 lg:py-8 max-w-[1250px] mx-auto">
        {/* PAGE HEADER */}
        <section className="mb-7">
          <h1 className="text-[clamp(28px,3.4vw,34px)] leading-[1.15] font-extrabold text-[#0F2F63] mb-2">
            Contact Support
          </h1>
          <p className="text-[14px] text-[#7183A1] max-w-[650px] leading-[1.6]">
            Reach the civic desk for help, feedback, or account questions.
            We typically reply within 1–2 business days.
          </p>
        </section>

        {/* SUPPORT GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] gap-5 lg:gap-6 items-stretch">
          {/* FORM CARD */}
          <div className="bg-white border border-[#DCE5F2] rounded-[16px] shadow-[0_8px_25px_rgba(31,61,100,0.05)] p-6 sm:p-[25px]">
            <div className="flex items-center gap-3 pb-5 border-b border-[#DCE5F2] mb-[22px]">
              <span className="w-[38px] h-[38px] rounded-[10px] bg-[#EEF5FF] text-[#1769FF] grid place-items-center">
                <Icon name="chat" size={18} />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold text-[#102D59] leading-tight">Send us a message</h2>
                <p className="text-[12px] text-[#7183A1] mt-1">Fill out the form below and we'll respond as soon as possible.</p>
              </div>
            </div>

            {sent && !sending && (
              <div className="mb-5 p-4 rounded-[10px] border border-[#D9F1E2] bg-[#F0FBF5] flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-[#27A95D] text-white grid place-items-center flex-shrink-0">
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <strong className="block text-[13.5px] text-[#0B6B35]">Your support message has been submitted successfully.</strong>
                  <p className="text-[12px] text-[#3E6B4F] mt-0.5">The civic desk has been notified. You can submit another message below.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-5 p-3.5 rounded-[10px] border border-[#FFD0D0] bg-[#FFF5F5] text-[12.5px] font-bold text-[#B42318]">
                {error}
              </div>
            )}

            <form onSubmit={submit} noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Your Name" required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Juan Dela Cruz"
                    className={`${inputClass} h-[44px]`}
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field label="Email Address" required>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="you@example.com"
                    className={`${inputClass} h-[44px]`}
                    autoComplete="email"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', formatPhoneLive(e.target.value))}
                    onBlur={(e) => update('phone', normalizePhMobile(e.target.value))}
                    placeholder="09xx-xxx-xxxx"
                    maxLength={11}
                    className={`${inputClass} h-[44px]`}
                    autoComplete="tel"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Category" required>
                  <CategorySelect
                    value={form.category}
                    onChange={(v) => update('category', v)}
                    options={CATEGORIES}
                  />
                </Field>
              </div>

              <Field label="Subject" required>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => update('subject', e.target.value)}
                  placeholder="What is your message about?"
                  className={`${inputClass} h-[44px]`}
                  maxLength={150}
                  required
                />
              </Field>

              <Field label="Message" required>
                <textarea
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  placeholder="Tell us what's going on. Please include any details that will help us respond."
                  className={`${inputClass} min-h-[150px] resize-y leading-relaxed`}
                  maxLength={1000}
                  required
                />
                <div className="text-right text-[10px] text-[#8C9BB0] mt-[5px]">
                  <span>{form.message.length}</span>/1000 characters
                </div>
              </Field>

              <div className="flex gap-2.5 bg-[#F1F6FF] border border-[#DCE9FF] rounded-[10px] p-3 text-[11px] text-[#607493] leading-[1.5] mt-2">
                <span className="text-[#1769FF] text-[16px] flex-shrink-0">
                  <Icon name="shield" size={14} />
                </span>
                <div>
                  By submitting, you agree to be contacted by the civic desk
                  using the details above. Your message is linked to your
                  resident account.
                </div>
              </div>

              <div className="flex justify-end mt-[18px]">
                <button
                  type="submit"
                  disabled={sending}
                  className="border-0 bg-[#1769FF] text-white rounded-[9px] px-6 py-3 font-bold cursor-pointer shadow-[0_7px_18px_rgba(23,105,255,0.2)] hover:bg-[#075BE8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={14} /> Submit Message
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* WHAT TO EXPECT */}
          <aside className="bg-white border border-[#DCE5F2] rounded-[16px] shadow-[0_8px_25px_rgba(31,61,100,0.05)] p-6 sm:p-[25px]">
            <h2 className="text-[17px] font-extrabold text-[#102D59] mb-[22px]">What to expect</h2>

            {[
              { icon: 'verify', t: 'Verified recipients', d: 'Your message is delivered to the Admin and Super Admin team.' },
              { icon: 'clock', t: '1–2 business days', d: 'Most messages receive a reply within one to two business days.' },
              { icon: 'lock', t: 'Privacy first', d: 'Your contact details are only used to respond to your inquiry.' },
              { icon: 'bell', t: 'In-app notification', d: 'You will be notified in the Message Box when staff responds.' },
            ].map((row) => (
              <div key={row.t} className="flex gap-3.5 py-[15px] border-b border-[#EDF1F7] last:border-b-0">
                <span className="w-[38px] h-[38px] flex-shrink-0 rounded-full bg-[#EEF5FF] text-[#1769FF] grid place-items-center">
                  <Icon name={row.icon} size={15} />
                </span>
                <div>
                  <h3 className="text-[13px] font-extrabold text-[#102D59] mb-1">{row.t}</h3>
                  <p className="text-[11px] text-[#7183A1] leading-[1.5]">{row.d}</p>
                </div>
              </div>
            ))}

            <div className="mt-5 p-4 bg-[#F0F7FF] border border-[#DBEAFE] rounded-[10px]">
              <strong className="block text-[12px] text-[#1E40AF]">Our team is here to help</strong>
              <p className="text-[11px] text-[#374151] mt-1 leading-[1.5]">
                We typically respond within 24-48 hours. For urgent matters, please call the phone numbers listed above.
              </p>
            </div>
          </aside>
        </section>

        {/* EMERGENCY & IMPORTANT CONTACTS */}
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-[38px] h-[38px] rounded-[10px] bg-[#EEF5FF] text-[#1769FF] grid place-items-center">
              <Icon name="phone" size={18} />
            </span>
            <div>
              <h2 className="text-[18px] font-extrabold text-[#0F2F63]">Important Contacts</h2>
              <p className="text-[12px] text-[#7183A1] mt-0.5">Save these numbers for quick access when you need help.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {CONTACT_GROUPS.map((group) => (
              <article
                key={group.title}
                className="bg-white border border-[#DCE5F1] rounded-[18px] overflow-hidden shadow-[0_6px_18px_rgba(20,60,110,0.04)] hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(25,55,100,0.08)] transition-all"
              >
                <header
                  className="px-6 py-5 flex items-center gap-4"
                  style={{ borderBottom: '1px solid #EDF1F6' }}
                >
                  <span
                    className="w-[52px] h-[52px] rounded-[14px] grid place-items-center flex-shrink-0"
                    style={{ background: group.iconBg, color: group.iconColor }}
                  >
                    <Icon name={group.icon} size={25} />
                  </span>
                  <h3
                    className="text-[18px] font-extrabold tracking-[-0.01em]"
                    style={{ color: group.titleColor }}
                  >
                    {group.title}
                  </h3>
                </header>

                <div className="px-6 pb-3">
                  {group.items.map((item) => (
                    <a
                      key={item.name}
                      href={telHref(item.phones[1])}
                      className="min-h-[73px] py-4 flex items-center gap-3.5 border-b border-[#EDF1F6] last:border-b-0 group"
                    >
                      <span
                        className="w-10 h-10 flex-shrink-0 rounded-full grid place-items-center border"
                        style={{
                          color: group.phoneColor,
                          borderColor: group.phoneBorder,
                          background: group.phoneBg,
                        }}
                      >
                        <Icon name="phonecall" size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-extrabold text-[#142F59] mb-1">
                          {item.name}
                        </div>
                        <div className="text-[12px] leading-[1.45] text-[#687B99] group-hover:text-[#1769FF] transition-colors break-words">
                          {item.phones[0]}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {/* 911 Notice */}
          <div className="mt-6 min-h-[90px] px-6 py-5 flex items-center gap-5 bg-white border border-[#DCE5F1] rounded-[18px] shadow-[0_6px_18px_rgba(20,60,110,0.04)]">
            <span className="w-12 h-12 flex-shrink-0 rounded-[14px] grid place-items-center bg-[#EDF5FF] text-[#1769FF] text-[22px] font-extrabold">
              <Icon name="shield" size={22} />
            </span>
            <p className="text-[14px] leading-[1.65] text-[#344C70]">
              For life-threatening emergencies, please call{' '}
              <a href="tel:911" className="text-[#1769FF] font-extrabold hover:underline">
                911
              </a>{' '}
              immediately. Your safety is our priority.
            </p>
          </div>
        </section>
      </div>
    </ResidentLayout>
  );
}
