import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { useResidentNotifications } from '../../context/ResidentNotificationsContext';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import { formatPhoneOrEmailLive, normalizePhoneOrEmail } from '../../utils/phone';

const CATEGORIES = [
  'Road / Street',
  'Street Light',
  'Water Problem',
  'Drainage / Flooding',
  'Garbage / Waste',
  'Public Safety',
  'Noise Complaint',
  'Environment',
  'Other',
];

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const inputCls = 'w-full h-[44px] px-3.5 border border-[#DBE3EF] rounded-[11px] bg-white text-[13px] text-[#172F60] focus:outline-none focus:border-[#3D7DF2] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] placeholder:text-[#9AA8BF] transition-colors';

const TIPS = [
  { icon: '💬', title: 'Provide clear details about the issue', desc: 'Accurate descriptions help our team verify and act quickly.' },
  { icon: '📷', title: 'Include photos if possible', desc: 'Photos help our team verify and prioritize the issue.' },
  { icon: '📍', title: 'Specify the exact location', desc: 'Include street, landmark, or purok so staff can find it fast.' },
  { icon: '✓', title: 'Check your information before submitting', desc: 'A complete, correct report is resolved faster.' },
];

export default function ResidentReportPage({ onNavigate, presetCategory }) {
  const { user } = useAuth();
  const showToast = useToast();
  const { pushLocal } = useResidentNotifications();

  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [streetBlock, setStreetBlock] = useState('');
  const [landmark, setLandmark] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [contact, setContact] = useState(user?.email || '');
  const [consent, setConsent] = useState(false);

  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successRef, setSuccessRef] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Preselect category when navigated with a preset (e.g. from Dashboard).
  useEffect(() => {
    if (!presetCategory) return;
    const match = CATEGORIES.find((c) => c.toLowerCase() === String(presetCategory).toLowerCase());
    if (match) setCategory(match);
  }, [presetCategory]);

  function addFiles(incoming) {
    setError('');
    const next = [...files];
    for (const file of Array.from(incoming || [])) {
      if (next.length >= MAX_FILES) { showToast(`You can upload a maximum of ${MAX_FILES} photos.`, 'error'); break; }
      if (!ALLOWED_TYPES.includes(file.type)) { showToast('Only JPG, PNG, and WEBP images are allowed.', 'error'); continue; }
      if (file.size > MAX_SIZE) { showToast(`${file.name} is larger than 5MB.`, 'error'); continue; }
      next.push(file);
    }
    setFiles(next);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setCategory(''); setDesc(''); setStreet(''); setBlock(''); setLandmark('');
    setFiles([]); setConsent(false); setSuccessRef(null); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!category) { setError('Please select a category.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!desc.trim()) { setError('Please provide a description of the issue.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!streetBlock.trim()) { setError('Please provide the street/block of the issue.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!consent) { setError('Please agree to the Privacy Policy and Terms of Service.'); return; }

    setSubmitting(true);
    try {
      const fullLocation = [streetBlock.trim(), landmark.trim()].filter(Boolean).join(', ');
      const fd = new FormData();
      fd.append('title', category);
      fd.append('category', category);
      fd.append('description', desc.trim());
      fd.append('location', fullLocation);
      fd.append('reporter_name', name.trim() || user?.name || 'Anonymous');
      fd.append('reporter_phone', contact.trim());
      if (user?.email) fd.append('reporter_email', user.email);
      files.forEach((f) => fd.append('photos[]', f));

      const data = await apiFetch('reports/create.php', { method: 'POST', body: fd });
      pushLocal(`Your report ${data.ref_id} was submitted successfully and is now Pending.`);
      setSuccessRef(data.ref_id);
      setDesc(''); setStreet(''); setBlock(''); setLandmark(''); setFiles([]); setConsent(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const label = 'block mb-2 text-[12px] font-bold text-[#10295C]';
  const quickLinks = [
    { icon: '📄', title: 'Track My Reports', desc: 'View status and updates of your submitted reports.', action: 'my-reports' },
    { icon: '☎', title: 'Emergency Contacts', desc: 'View important emergency hotlines and contacts.', action: 'emergency' },
  ];

  return (
    <ResidentLayout activePage="submit" onNavigate={onNavigate}>
      <div className="pt-4 sm:pt-6">
        {/* ===== Page heading ===== */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-[22px]">
          <div className="flex items-center gap-5">
            <span className="w-[72px] h-[72px] rounded-[17px] bg-[#EDF4FF] text-xevera-600 grid place-items-center flex-shrink-0">
              <Icon name="file" size={34} />
            </span>
            <div>
              <h1 className="text-[30px] sm:text-[34px] font-head font-extrabold text-navy-950 leading-none tracking-[-1px]">Report an Issue</h1>
              <p className="mt-2 text-[14px] text-[#687A9D]">Help us improve our community by reporting issues around you.</p>
            </div>
          </div>

          <div className="max-w-[365px] px-[18px] py-3.5 rounded-[13px] border border-[#D7E5FF] bg-[#F5F9FF] flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-xevera-600 text-white font-black grid place-items-center flex-shrink-0 text-[13px]">i</span>
            <span className="text-[12px] text-[#294576] leading-relaxed">Our team will review your report and take appropriate action as soon as possible.</span>
          </div>
        </div>

        {/* ===== Main grid: form + side column ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_304px] gap-[18px] items-start">
          {/* ---- Form ---- */}
          <form id="resident-report-form" onSubmit={handleSubmit} className="bg-white border border-[#E4EAF3] rounded-[17px] px-5 sm:px-[30px] pt-[23px] pb-[18px] shadow-[0_7px_24px_rgba(25,55,100,0.05)]">
            {/* Alerts */}
            {successRef && (
              <div className="mb-4 px-3.5 py-3 rounded-[10px] border border-[#B8EDCC] bg-[#EFFCF4] text-[#14733B] text-[12px] leading-relaxed">
                ✓ Your report has been submitted successfully. Reference number:{' '}
                <strong>{successRef}</strong>. Our team will review it shortly — you can track it under{' '}
                <button type="button" onClick={() => onNavigate && onNavigate('my-reports')} className="font-bold underline cursor-pointer bg-transparent border-none">My Reports</button>.
              </div>
            )}
            {error && (
              <div role="alert" className="mb-4 px-3.5 py-3 rounded-[10px] border border-[#FFCACA] bg-[#FFF1F1] text-[#B42323] text-[12px] leading-relaxed">{error}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category (used as the report title) */}
              <div className="sm:col-span-2">
                <label htmlFor="ri-category" className={label}>Category <span className="text-[#ED2525]">*</span></label>
                <select id="ri-category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label htmlFor="ri-desc" className={label}>Description <span className="text-[#ED2525]">*</span></label>
                <div className="relative">
                  <textarea
                    id="ri-desc"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value.slice(0, 500))}
                    maxLength={500}
                    placeholder="Provide more details about the issue..."
                    className="w-full min-h-[105px] py-3 px-3.5 border border-[#DBE3EF] rounded-[11px] bg-white text-[13px] leading-[1.55] resize-y focus:outline-none focus:border-[#3D7DF2] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] placeholder:text-[#9AA8BF]"
                  />
                  <span className="absolute right-3 bottom-2.5 text-[10px] text-[#7283A2]">{desc.length}/500</span>
                </div>
              </div>

              {/* Street & Block */}
              <div className="sm:col-span-2">
                <label htmlFor="ri-street" className={label}>Street & Block <span className="text-[#ED2525]">*</span></label>
                <input
                  id="ri-street"
                  type="text"
                  value={streetBlock}
                  onChange={(e) => setStreetBlock(e.target.value)}
                  placeholder="e.g. Main St, Block 5"
                  className={inputCls}
                />
              </div>

              {/* Landmark */}
              <div>
                <label htmlFor="ri-landmark" className={label}>Landmark</label>
                <input
                  id="ri-landmark"
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Nearby landmark or purok"
                  className={inputCls}
                />
              </div>

              {/* Photo upload */}
              <div className="sm:col-span-2">
                <span className={label}>Photo Upload <span className="text-[#8A98B2] font-medium">(Optional)</span></span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
                  className={`min-h-[108px] rounded-[12px] border-[1.5px] border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    dragActive ? 'border-xevera-600 bg-[#EDF5FF]' : 'border-[#9EC1FF] bg-[#F5F9FF] hover:bg-[#EDF5FF] hover:border-xevera-600'
                  }`}
                >
                  <span className="text-[26px] mb-1.5">📷</span>
                  <span className="text-[12px] font-bold text-[#445A7E]">Drag &amp; drop files here</span>
                  <span className="mt-1 text-[10px] text-[#7182A1]">or click to browse — PNG, JPG up to 5MB (max {MAX_FILES})</span>
                </div>
                <input ref={fileInputRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#DCE6F4] bg-white text-[11px] text-[#334C77]">
                        📷 <span className="max-w-[140px] truncate">{f.name}</span>
                        <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} className="text-[#EF3030] font-black cursor-pointer bg-transparent border-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label htmlFor="ri-name" className={label}>Name <span className="text-[#8A98B2] font-medium">(Optional)</span></label>
                <input id="ri-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>

              {/* Contact */}
              <div>
                <label htmlFor="ri-contact" className={label}>Phone or Email <span className="text-[#8A98B2] font-medium">(Optional)</span></label>
                <input id="ri-contact" type="text" value={contact} onChange={(e) => setContact(formatPhoneOrEmailLive(e.target.value))} onBlur={() => setContact((c) => normalizePhoneOrEmail(c))} placeholder="09XX XXX XXXX or email address" className={inputCls} />
              </div>
            </div>

            <p className="mt-2 text-[10px] text-[#8291AA]">Your contact details are only used for updates about this report.</p>

            {/* Consent */}
            <label className="mt-4 flex items-start gap-2.5 text-[11px] text-[#556884] leading-relaxed cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 mt-0.5 flex-shrink-0 accent-xevera-600 cursor-pointer" />
              <span>
                I agree that my report details may be processed to resolve this issue, in line with the{' '}
                <button type="button" onClick={() => onNavigate && onNavigate('help')} className="text-xevera-600 font-bold underline-offset-2 hover:underline cursor-pointer bg-transparent border-none">Privacy Policy</button> and{' '}
                <button type="button" onClick={() => onNavigate && onNavigate('help')} className="text-xevera-600 font-bold underline-offset-2 hover:underline cursor-pointer bg-transparent border-none">Terms of Service</button>.
              </span>
            </label>

            {/* Full View + Submit */}
            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="h-[43px] px-5 rounded-[10px] border border-[#B9CFF5] bg-white text-xevera-600 text-[13px] font-extrabold cursor-pointer hover:bg-[#F2F7FF] transition-colors flex-shrink-0 inline-flex items-center gap-2"
              >
                <Icon name="eye" size={15} /> Full View
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-[43px] rounded-[10px] border-0 text-white text-[13px] font-extrabold cursor-pointer disabled:opacity-60 hover:-translate-y-[1px] transition-all"
                style={{ background: 'linear-gradient(135deg,#1468F3,#1553DA)', boxShadow: '0 8px 20px rgba(20,100,238,0.18)' }}
              >
                ➤ &nbsp;{submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
            <p className="mt-2.5 text-center text-[10px] text-[#8795AD]">We respect your privacy.</p>
          </form>

          {/* ---- Side column ---- */}
          <aside>
            {/* Tips */}
            <div className="bg-white border border-[#E4EAF3] rounded-[17px] px-5 pt-5 pb-3 shadow-[0_7px_24px_rgba(25,55,100,0.05)]">
              <div className="flex items-center gap-3 mb-2.5">
                <span className="w-[38px] h-[38px] rounded-full bg-[#EDF4FF] text-xevera-600 grid place-items-center flex-shrink-0">💡</span>
                <span className="text-[15px] font-extrabold text-navy-950">Tips for a Good Report</span>
              </div>
              {TIPS.map((t) => (
                <div key={t.title} className="flex gap-3 py-3 border-b border-[#EDF1F6] last:border-b-0">
                  <span className="w-[38px] h-[38px] flex-shrink-0 rounded-full bg-[#EDF4FF] text-xevera-600 grid place-items-center text-[15px]">{t.icon}</span>
                  <div>
                    <strong className="block text-[11px] leading-snug text-[#122E64]">{t.title}</strong>
                    <p className="mt-1.5 text-[10px] text-[#6A7B9A] leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency */}
            <div className="mt-4 p-5 rounded-[17px] border border-[#FFCACA] bg-[#FFF0F0]">
              <div className="flex items-center gap-3">
                <span className="w-[38px] h-[38px] rounded-full bg-white text-[#ED2929] grid place-items-center flex-shrink-0">⚠</span>
                <span className="text-[15px] font-extrabold text-[#B51E1E]">Is it an emergency?</span>
              </div>
              <p className="my-3.5 text-[11px] text-[#A72B2B] leading-[1.65]">
                This form is for non-urgent civic issues.<br /><br />
                For emergencies, please call local authorities or use the Emergency page.
              </p>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('emergency')}
                className="w-full h-[41px] rounded-[9px] border-0 bg-[#E92727] text-white text-[12px] font-extrabold hover:bg-[#D31F1F] transition-colors cursor-pointer"
              >
                ☎ &nbsp;Go to Emergency
              </button>
            </div>
          </aside>
        </div>

        {/* ===== Quick links ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mt-[18px]">
          {quickLinks.map((q) => (
            <button
              key={q.title}
              type="button"
              onClick={() => onNavigate && onNavigate(q.action)}
              className="min-h-[78px] p-[13px] rounded-[14px] border border-[#E3E9F2] bg-white shadow-[0_5px_17px_rgba(25,55,100,0.035)] flex items-center gap-3 text-left hover:-translate-y-[2px] hover:border-[#CBDCFB] hover:shadow-[0_9px_22px_rgba(25,55,100,0.07)] transition-all cursor-pointer"
            >
              <span className="w-[38px] h-[38px] rounded-[10px] bg-[#EEF5FF] text-xevera-600 grid place-items-center flex-shrink-0 text-[16px]">{q.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold text-navy-950">{q.title}</span>
                <span className="block mt-1 text-[9px] text-[#70809D] leading-snug">{q.desc}</span>
              </span>
              <span className="text-[#153E83] flex-shrink-0">›</span>
            </button>
          ))}
        </div>

        <footer className="mt-10 pt-4 text-center text-[10px] text-[#8795AD]">&copy; {new Date().getFullYear()} Xevera Civic Portal · All rights reserved.</footer>
      </div>

      {/* ===== Full View preview modal ===== */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(9,28,57,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-[18px] border border-[#E4EAF3] shadow-[0_20px_60px_rgba(10,26,69,0.25)]">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#EDF1F6] sticky top-0 bg-white rounded-t-[18px]">
              <h2 className="text-[16px] font-extrabold text-navy-950">Report Preview</h2>
              <button type="button" onClick={() => setShowPreview(false)} aria-label="Close preview" className="w-8 h-8 rounded-lg bg-[#F1F5FA] border-0 text-[#445A7E] cursor-pointer grid place-items-center text-base hover:bg-[#E4ECF7]">×</button>
            </div>
            <div className="px-5 sm:px-6 py-5">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#EDF4FF] text-xevera-600 text-[11px] font-extrabold tracking-wide uppercase">{category || 'No category selected'}</span>
              <h3 className="mt-2.5 text-[20px] font-extrabold text-navy-950 leading-snug">{category || 'Untitled report'}</h3>
              <p className="mt-2 text-[13.5px] text-[#445A7E] leading-relaxed whitespace-pre-line">{desc || <span className="text-[#9AA8BF]">No description entered yet.</span>}</p>
              <div className="mt-3 text-[12.5px] text-[#445A7E]">
                <strong className="text-navy-950">Location: </strong>
                {[streetBlock.trim(), landmark.trim()].filter(Boolean).join(', ') || <span className="text-[#9AA8BF]">Not provided yet.</span>}
              </div>
              {files.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} alt={`Preview ${i + 1}`} className="w-full h-[110px] object-cover rounded-[10px] border border-[#E4EAF3]" />
                  ))}
                </div>
              )}
              {(name.trim() || contact.trim()) && (
                <div className="mt-3 text-[12px] text-[#6A7B9A]">
                  {name.trim() && <div><strong className="text-navy-950">Name: </strong>{name.trim()}</div>}
                  {contact.trim() && <div className="mt-0.5"><strong className="text-navy-950">Contact: </strong>{contact.trim()}</div>}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 px-5 sm:px-6 py-4 border-t border-[#EDF1F6]">
              <button type="button" onClick={() => setShowPreview(false)} className="flex-1 h-[43px] rounded-[10px] border border-[#B9CFF5] bg-white text-xevera-600 text-[13px] font-extrabold cursor-pointer hover:bg-[#F2F7FF]">Back to Edit</button>
              <button type="button" disabled={submitting} onClick={() => { setShowPreview(false); document.getElementById('resident-report-form')?.requestSubmit(); }} className="flex-1 h-[43px] rounded-[10px] border-0 text-white text-[13px] font-extrabold cursor-pointer disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#1468F3,#1553DA)', boxShadow: '0 8px 20px rgba(20,100,238,0.18)' }}>
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ResidentLayout>
  );
}
