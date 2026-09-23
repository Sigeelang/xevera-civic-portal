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
  'Double Parking',
  'Other',
];

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const inputCls = 'w-full h-[44px] px-3.5 border border-[#DBE3EF] rounded-[11px] bg-white text-[13px] text-[#172F60] focus:outline-none focus:border-[#3D7DF2] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] placeholder:text-[#9AA8BF] transition-colors';

/* Robust server-datetime parsing: naive 'YYYY-MM-DD HH:MM:SS' values are
   stored in Asia/Manila time. Never throws, never returns Invalid Date. */
function parseManilaDateTime(value) {
  if (!value) return null;
  try {
    const s = String(value).trim().replace(' ', 'T');
    if (!s) return null;
    const hasTz = /([Zz]|[+-]\d{2}:?\d{2})$/.test(s);
    const d = new Date(hasTz ? s : s + '+08:00');
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function fmtDateOnly(value) {
  const d = parseManilaDateTime(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTimeOnly(value) {
  const d = parseManilaDateTime(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtRestrictionDate(value) {
  if (!value) return '';
  const d = parseManilaDateTime(value);
  if (!d) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function penaltyDays(startVal, endVal) {
  const s = parseManilaDateTime(startVal);
  const e = parseManilaDateTime(endVal);
  if (!s || !e) return null;
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  return days > 0 ? days : null;
}

function restrictionText(r) {
  if (!r) return '';
  const what = r.violation_type ? ` for \u201C${r.violation_type}\u201D` : '';
  if (!r.penalty_until) return `Reporting is permanently disabled on your account${what} pending admin review. Contact support if you believe this is a mistake.`;
  return `Your reporting is restricted${what} until ${fmtRestrictionDate(r.penalty_until)}. You can still view your existing reports.`;
}

const TIPS = [
  { icon: '💬', title: 'Provide clear details about the issue', desc: 'Accurate descriptions help our team verify and act quickly.' },
  { icon: '📷', title: 'Include photos if possible', desc: 'Photos help our team verify and prioritize the issue.' },
  { icon: '📍', title: 'Specify the exact location', desc: 'Include the street name and lot/block so staff can find it fast.' },
  { icon: '✓', title: 'Check your information before submitting', desc: 'A complete, correct report is resolved faster.' },
];

export default function ResidentReportPage({ onNavigate, presetCategory }) {
  const { user } = useAuth();
  const showToast = useToast();
  const { pushLocal } = useResidentNotifications();

  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [streetBlock, setStreetBlock] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [contact, setContact] = useState(user?.email || '');
  const [consent, setConsent] = useState(false);

  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState(null);
  const [suspiciousFlag, setSuspiciousFlag] = useState(null);
  const [error, setError] = useState('');
  const [restriction, setRestriction] = useState(null);
  const [violations, setViolations] = useState([]);
  const [violationCount, setViolationCount] = useState(0);

  const fileInputRef = useRef(null);

  // Active reporting restriction blocks new submissions (enforced
  // server-side too; this just explains it upfront). The full violation
  // list also feeds the penalty panel below the page heading.
  useEffect(() => {
    let mounted = true;
    apiFetch('violations/my.php')
      .then((d) => {
        if (!mounted) return;
        setRestriction(d?.active_restriction || null);
        setViolations(Array.isArray(d?.violations) ? d.violations : []);
        setViolationCount(Number(d?.violation_count) || 0);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Preselect category when navigated with a preset (e.g. from Dashboard).
  useEffect(() => {
    if (!presetCategory) return;
    const match = CATEGORIES.find((c) => c.toLowerCase() === String(presetCategory).toLowerCase());
    if (match) setCategory(match);
  }, [presetCategory]);

  /*
   * Penalty panel data: prefer the active restriction's own violation;
   * otherwise fall back to the latest unexpired enforcing suspension.
   * All dates flow through the null-safe Manila parser — missing or
   * malformed values render as blank instead of erroring.
   */
  const panelViolation = (() => {
    if (restriction?.violation_id) {
      const found = violations.find((v) => Number(v.id) === Number(restriction.violation_id));
      if (found) {
        return {
          ...found,
          _penaltyStart: restriction.penalty_start ?? found.penalty_start_at ?? null,
          _penaltyEnd: restriction.penalty_until ?? found.penalty_end_at ?? found.restriction_until ?? null,
        };
      }
    }
    const now = Date.now();
    const susp = (violations || []).find((v) => {
      if (!['Short Suspension', 'Long Suspension'].includes(v.penalty_type)) return false;
      if (!['Confirmed', 'Appealed'].includes(v.status)) return false;
      const end = parseManilaDateTime(v.penalty_end_at ?? v.restriction_until);
      return !end || end.getTime() > now;
    });
    if (susp) {
      return { ...susp, _penaltyStart: susp.penalty_start_at ?? null, _penaltyEnd: susp.penalty_end_at ?? susp.restriction_until ?? null };
    }
    return null;
  })();

  const activeViolationCount = (violations || []).filter(
    (v) => ['Confirmed', 'Appealed'].includes(v.status) && v.penalty_type !== 'Warning'
  ).length;

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
    setCategory(''); setDesc(''); setStreetBlock('');
    setFiles([]); setConsent(false); setSuccessRef(null); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (restriction) {
      setError(restrictionText(restriction));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!category) { setError('Please select a category.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!desc.trim()) { setError('Please provide a description of the issue.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!streetBlock.trim()) { setError('Please provide the street/block of the issue.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!consent) { setError('Please agree to the Privacy Policy and Terms of Service.'); return; }

    setSubmitting(true);
    try {
      const fullLocation = streetBlock.trim();
      const fd = new FormData();
      fd.append('title', category);
      fd.append('category', category);
      fd.append('description', desc.trim());
      fd.append('location', fullLocation);
      fd.append('reporter_name', name.trim() || user?.name || 'Anonymous');
      const contactVal = contact.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactVal)) {
        fd.append('reporter_phone', '');
        fd.append('reporter_email', contactVal);
      } else {
        fd.append('reporter_phone', contactVal);
        if (user?.email) fd.append('reporter_email', user.email);
      }
      files.forEach((f) => fd.append('photos[]', f));

      const data = await apiFetch('reports/create.php', { method: 'POST', body: fd });
      pushLocal(`Your report ${data.ref_id} was submitted successfully and is now Pending.`);
      setSuccessRef(data.ref_id);
      setSuspiciousFlag(data.is_suspicious === 1 ? data.suspicion_reason : null);
      setDesc(''); setStreetBlock(''); setFiles([]); setConsent(false);
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
    { icon: '💬', title: 'Contact Support', desc: 'Get help from our support team with your reports.', action: 'contact' },
  ];

  return (
    <ResidentLayout activePage="submit" onNavigate={onNavigate}>
      <div className="pt-4 sm:pt-6">
        {/* ===== Page heading ===== */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-[22px]">
          <div className="flex items-center gap-5">
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

        {panelViolation && (() => {
          const v = panelViolation;
          const days = penaltyDays(v._penaltyStart, v._penaltyEnd);
          const startDate = fmtDateOnly(v._penaltyStart);
          const startTime = fmtTimeOnly(v._penaltyStart);
          const endDate = fmtDateOnly(v._penaltyEnd);
          const endTime = fmtTimeOnly(v._penaltyEnd);
          const count = activeViolationCount > 0 ? activeViolationCount : 1;
          const warnText = v.penalty_type === 'Permanent Restriction' || v.penalty_type === 'Indefinite Suspension'
            ? 'Reporting is disabled on your account. Contact support if you believe this is a mistake.'
            : /suspension/i.test(v.penalty_type || '')
              ? 'Your account is suspended. You cannot submit reports while this penalty is active.'
              : 'You cannot submit new reports while this restriction is active.';
          return (
            <>
              <div className="border border-[#ffc4c4] rounded-[14px] px-5 py-[19px] flex items-center gap-5 mb-[26px]" style={{ background: 'linear-gradient(100deg,#fff4f4,#fffafa)' }}>
                <span className="w-[50px] h-[50px] rounded-full bg-[#ffdcdc] text-[#d92525] grid place-items-center flex-shrink-0">
                  <svg width="27" height="27" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 17H3L12 3z" fill="currentColor" /><path d="M12 9v5" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17" r="1.1" fill="white" /></svg>
                </span>
                <span>
                  <span className="block text-[#d92525] text-[20px] font-bold">You have {count} violation record{count === 1 ? '' : 's'}.</span>
                  <span className="block text-[15px] text-[#71809a] mt-[5px]">Please follow the community rules and submit accurate reports. Repeated violations may result in stricter penalties.</span>
                </span>
              </div>

              <div className="bg-white rounded-[15px] border border-[#edf1f7] shadow-[0_8px_25px_rgba(27,63,116,0.06)] px-[23px] py-[26px] mb-[22px]">
                <div className="grid grid-cols-1 min-[1100px]:grid-cols-[1fr_380px] gap-[25px]">
                  <div className="flex items-start gap-7 max-sm:gap-[14px]">
                    <span className="w-[68px] h-[68px] max-sm:w-[52px] max-sm:h-[52px] rounded-[12px] bg-[#ffeded] text-[#d92525] grid place-items-center flex-shrink-0">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 17H3L12 3z" fill="currentColor" /><path d="M12 9v5" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17" r="1" fill="white" /></svg>
                    </span>
                    <div className="pt-[7px] min-w-0">
                      <div className="text-[18px] font-extrabold text-[#102957]">{v.violation_type || 'Violation'}</div>
                      {(v.reason || v.description) && (
                        <div className="text-[#7485a2] text-[14px] mt-1 mb-[22px]">{v.reason || v.description}</div>
                      )}
                      <div className="flex flex-col gap-3 text-[13px] text-[#687b9b]">
                        {fmtDateOnly(v.created_at) && (
                          <span className="flex items-center gap-[9px]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#526b91" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
                            {fmtDateOnly(v.created_at)}{fmtTimeOnly(v.created_at) ? ` ${fmtTimeOnly(v.created_at)}` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-[9px]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#526b91" strokeWidth="1.8"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>
                          Report ID: {v.report_ref_id || (v.report_id ? `#${v.report_id}` : '—')}
                        </span>
                        {v.issued_by_name && (
                          <span className="flex items-center gap-[9px]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#526b91" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
                            Issued by {v.issued_by_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative pt-[5px]">
                    <div className="min-[1100px]:absolute min-[1100px]:right-0 min-[1100px]:top-0 text-[#7283a0] text-[12px] mb-2">#{`VIO-${v.id}`}</div>
                    <span className="inline-flex bg-[#ffe0e0] text-[#d72727] text-[12px] font-bold px-[17px] py-[7px] rounded-[30px] mb-[13px]">Penalty Active</span>
                    <div className="rounded-[12px] px-[21px] py-[15px]" style={{ background: 'linear-gradient(110deg,#fff0f0,#fff7f7)' }}>
                      <div className="text-[#20365b] text-[13px] font-bold mb-[5px]">Penalty Applied</div>
                      <div className="text-[#d52222] text-[21px] font-extrabold mb-[13px]">
                        {v.penalty_type || 'Restriction'}{days ? ` (${days} day${days === 1 ? '' : 's'})` : ''}
                      </div>
                      <div className="flex flex-col gap-[9px] text-[13px] text-[#637593]">
                        {startDate && (
                          <span className="flex items-center gap-[9px]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#566b8b" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
                            Start: {startDate}{startTime ? <span>{startTime}</span> : null}
                          </span>
                        )}
                        <span className="flex items-center gap-[9px]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#566b8b" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
                          {endDate ? (<>End: {endDate}{endTime ? <span>{endTime}</span> : null}</>) : 'No end date — permanent unless lifted.'}
                        </span>
                      </div>
                      <div className="mt-2 text-[#637593] text-[12px] italic flex items-center gap-[7px]">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"><circle cx="12" cy="12" r="9" fill="currentColor" /><path d="M12 10v5" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="1" fill="white" /></svg>
                        {warnText}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-[22px] bg-[#f1f7ff] border border-[#cbdfff] rounded-[13px] px-[21px] py-[15px] flex gap-[17px]">
                  <span className="w-[31px] h-[31px] rounded-full bg-[#1769f5] text-white grid place-items-center flex-shrink-0">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" /><path d="M12 10v5" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="1" fill="white" /></svg>
                  </span>
                  <div>
                    <div className="text-[14px] font-bold text-[#132b55] mb-[7px]">Reminder</div>
                    <ul className="pl-[17px] text-[#566b8b] text-[13px] leading-[1.8] list-disc">
                      <li>Penalties always start at 8:00 AM.</li>
                      <li>During a suspension or reporting restriction, you will not be able to submit new reports.</li>
                      <li>Follow the community guidelines to avoid further violations.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

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
            {suspiciousFlag && (
              <div className="mb-4 px-3.5 py-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-[12px] leading-relaxed">
                ⚠ Your report has been flagged for review{typeof suspiciousFlag === 'string' ? ` (${suspiciousFlag})` : ''}. This may be due to a very short description, a duplicate submission, or rapid reporting. Our team will review it shortly.
              </div>
            )}
            {error && (
              <div role="alert" className="mb-4 px-3.5 py-3 rounded-[10px] border border-[#FFCACA] bg-[#FFF1F1] text-[#B42323] text-[12px] leading-relaxed">{error}</div>
            )}
            {restriction && (
              <div role="alert" className="mb-4 px-3.5 py-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] text-[12px] leading-relaxed">
                <strong className="block mb-1">⛔ Reporting restricted{restriction.penalty_until ? ` until ${fmtRestrictionDate(restriction.penalty_until)}` : ' (permanent)'}</strong>
                {restrictionText(restriction)}{' '}
                {restriction.reason && (
                  <span className="block mt-1">Penalty reason: {restriction.reason}</span>
                )}
                <button type="button" onClick={() => onNavigate && onNavigate('my-violations')} className="font-bold underline cursor-pointer bg-transparent border-none text-[#92400E]">View My Violations →</button>
              </div>
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
                    onChange={(e) => setDesc(e.target.value.slice(0, 1000))}
                    maxLength={1000}
                    placeholder="Provide more details about the issue..."
                    className="w-full min-h-[105px] py-3 px-3.5 border border-[#DBE3EF] rounded-[11px] bg-white text-[13px] leading-[1.55] resize-y focus:outline-none focus:border-[#3D7DF2] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.08)] placeholder:text-[#9AA8BF]"
                  />
                  <span className="absolute right-3 bottom-2.5 text-[10px] text-[#7283A2]">{desc.length}/1000</span>
                </div>
                {desc.length > 0 && desc.length < 10 && (
                  <p className="mt-1.5 text-[11px] text-[#D97706] leading-relaxed">
                    Your description is very short. Please provide more details for faster verification.
                  </p>
                )}
              </div>

              {/* Lot/Block & Street Name */}
              <div className="sm:col-span-2">
                <label htmlFor="ri-street" className={label}>Block / Lot & Street Name <span className="text-[#ED2525]">*</span></label>
                <input
                  id="ri-street"
                  type="text"
                  value={streetBlock}
                  onChange={(e) => setStreetBlock(e.target.value)}
                  placeholder="e.g. Block 5, Lot 12, Main St"
                  className={inputCls}
                />
              </div>

              {/* Photo upload */}
              <div className="sm:col-span-2">
                <span className={label}>Photo Upload <span className="text-[#8A98B2] font-medium">(Optional)</span></span>
                <div
                  role="button"
                  tabIndex={restriction ? -1 : 0}
                  aria-disabled={!!restriction}
                  onClick={() => { if (!restriction) fileInputRef.current?.click(); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !restriction) fileInputRef.current?.click(); }}
                  onDragOver={(e) => { if (restriction) return; e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { if (restriction) return; e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
                  className={`min-h-[108px] rounded-[12px] border-[1.5px] border-dashed flex flex-col items-center justify-center text-center transition-colors ${
                    restriction ? 'border-[#E3D9B8] bg-[#FAF7EE] opacity-60 cursor-not-allowed'
                    : dragActive ? 'border-xevera-600 bg-[#EDF5FF] cursor-pointer' : 'border-[#9EC1FF] bg-[#F5F9FF] hover:bg-[#EDF5FF] hover:border-xevera-600 cursor-pointer'
                  }`}
                >
                  <span className="text-[26px] mb-1.5">📷</span>
                  <span className="text-[12px] font-bold text-[#445A7E]">{restriction ? 'Photo upload disabled while restricted' : 'Drag & drop files here'}</span>
                  {!restriction && (
                    <span className="mt-1 text-[10px] text-[#7182A1]">or click to browse — PNG, JPG up to 5MB (max {MAX_FILES})</span>
                  )}
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

            {/* Submit */}
            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting || !!restriction}
                className="w-full h-[43px] rounded-[10px] border-0 text-white text-[13px] font-extrabold cursor-pointer disabled:opacity-60 hover:-translate-y-[1px] transition-all"
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

            {/* Contact Support */}
            <div className="mt-4 p-5 rounded-[17px] border border-[#DBEAFE] bg-[#EFF6FF]">
              <div className="flex items-center gap-3">
                <span className="w-[38px] h-[38px] rounded-full bg-white text-[#1E40AF] grid place-items-center flex-shrink-0">💬</span>
                <span className="text-[15px] font-extrabold text-[#1E3A5F]">Need Help?</span>
              </div>
              <p className="my-3.5 text-[11px] text-[#374151] leading-[1.65]">
                Have questions or need assistance with your report?<br /><br />
                Our support team is ready to help you.
              </p>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('contact')}
                className="w-full h-[41px] rounded-[9px] border-0 bg-[#1264f5] text-white text-[12px] font-extrabold hover:bg-[#0B4FCC] transition-colors cursor-pointer"
              >
                💬 &nbsp;Contact Support
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

    </ResidentLayout>
  );
}
