import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ReportImage from '../../components/ReportImage';
import ResidentLayout from '../../layouts/ResidentLayout';
import { getEffectiveStatus } from '../../utils/reportStatus';

const WORKFLOW_STEPS = ['Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
const STEP_INDEX = { Pending: 0, Verified: 1, Assigned: 2, 'In Progress': 3, Resolved: 4, Closed: 4, Rejected: 0 };

const STATUS_PILL = {
  Pending: 'bg-white text-[#EF9700] border-[#F3DFAE]',
  Verified: 'bg-white text-[#1769FF] border-[#C4D9F7]',
  Assigned: 'bg-white text-[#1769FF] border-[#C4D9F7]',
  'In Progress': 'bg-white text-[#1769FF] border-[#C4D9F7]',
  Resolved: 'bg-white text-[#16A765] border-[#B9E9CF]',
  Closed: 'bg-white text-[#16A765] border-[#B9E9CF]',
  Rejected: 'bg-white text-[#EF4444] border-[#F3BFC0]',
  'Under Review': 'bg-white text-[#B8860B] border-[#F5E6A3]',
};

const CAT_ICON = {
  'Water': 'drop', 'Water Problem': 'drop', 'Water Leak': 'drop',
  'Electrical': 'bolt', 'Streetlight': 'bolt',
  'Waste': 'trash', 'Garbage': 'trash', 'Garbage / Waste': 'trash',
  'Drainage': 'flood', 'Flood': 'flood', 'Flooding': 'flood',
  'Roads': 'road', 'Road': 'road', 'Road Damage': 'road', 'Road & Infrastructure': 'road',
  'Public Safety': 'shield', 'Noise': 'volume', 'Trees': 'tree', 'Environmental': 'leaf',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function ViolationItem({ v, onViewDetails, onAppeal }) {
  return (
    <div className="mx-4 sm:mx-6 my-3 sm:my-4 p-3 sm:p-4 rounded-[11px] border border-[#F2CCCC] bg-gradient-to-r from-[#FFF7F7] to-white grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.2fr_auto] gap-3 sm:gap-4 items-center">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-[42px] h-[42px] sm:w-[45px] sm:h-[45px] rounded-[10px] bg-[#FFE4E4] text-[#EF4444] grid place-items-center flex-shrink-0"><Icon name="alert" size={18} /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold text-[#152B50] truncate">{v.type || 'Violation'}</div>
          <div className="text-[10px] text-[#75859D] mt-0.5">Related Report: <strong className="text-[#3970BC]">{v.report_ref_id || `#${v.report_id}`}</strong></div>
          <div className="text-[10px] text-[#71829B] mt-0.5">Date Issued: {v.date_issued || (v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '\u2014')}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {v.severity && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFDADA] text-[#D93636]">{v.severity}</span>}
        {v.status === 'Appealed' ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E8F1FF] text-[#2563EB]">Appeal Submitted</span>
        ) : (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFE3E3] text-[#C92E2E]">{'\u25CF'} Confirmed</span>
        )}
      </div>

      <div>
        <div className="text-[11px] font-bold text-[#172D50] mb-1">Penalty</div>
        <div className="text-[10px] text-[#657691] flex items-center gap-1.5">
          <span className="w-[18px] h-[18px] rounded-full bg-[#E4F7EC] text-[#159447] grid place-items-center text-[10px] font-extrabold flex-shrink-0">!</span>
          {v.penalty_type || 'Warning'}
        </div>
        {v.restriction_days > 0 && <div className="text-[10px] text-[#657691] mt-0.5">{'\u2298'} {v.restriction_days}-day reporting restriction</div>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onViewDetails(v)} className="h-[35px] px-3 rounded-[8px] bg-white border border-[#BDD1EE] text-[#1263ED] text-[10px] font-bold cursor-pointer hover:bg-[#F1F6FF] whitespace-nowrap">View Details</button>
        {v.status === 'Confirmed' && <button onClick={() => onAppeal(v)} className="h-[35px] px-3 rounded-[8px] bg-white border border-[#1463FF] text-[#1263ED] text-[10px] font-bold cursor-pointer hover:bg-[#F1F6FF] whitespace-nowrap">Submit Appeal</button>}
      </div>
    </div>
  );
}

function ViolationDetailsModal({ v, onClose, onAppeal }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5" style={{ background: 'rgba(12,29,55,0.48)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-full max-w-[590px] bg-white rounded-[15px] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.2)] animate-[modalIn_0.2s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E6EBF2] flex justify-between items-start">
          <div>
            <div className="text-[18px] font-extrabold text-[#102A56]">Violation Details</div>
            <div className="text-[11px] text-[#74859E] mt-1">Review your violation and penalty information.</div>
          </div>
          <button onClick={onClose} className="w-[32px] h-[32px] rounded-[8px] bg-[#F1F4F8] border-none cursor-pointer text-[18px] text-[#52627B]">{'\u00D7'}</button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 mb-4">
            {v.severity && <span className="px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-[#FFDADA] text-[#D93636]">{v.severity}</span>}
            <span className="px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-[#FFE3E3] text-[#C92E2E]">{v.status === 'Appealed' ? 'Appealed' : '\u25CF Confirmed'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-[10px] text-[#8391A7] mb-1">Violation Type</div><div className="text-[12px] font-bold text-[#172D50]">{v.type || '\u2014'}</div></div>
            <div><div className="text-[10px] text-[#8391A7] mb-1">Date Issued</div><div className="text-[12px] font-bold text-[#172D50]">{v.date_issued || (v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '\u2014')}</div></div>
            <div><div className="text-[10px] text-[#8391A7] mb-1">Related Report</div><div className="text-[12px] font-bold text-[#172D50]">{v.report_ref_id || `#${v.report_id}`}</div></div>
            <div><div className="text-[10px] text-[#8391A7] mb-1">Report Category</div><div className="text-[12px] font-bold text-[#172D50]">{v.report_category || '\u2014'}</div></div>
          </div>
          <div className="mt-4 p-3.5 rounded-[9px] bg-[#F6F8FB]">
            <div className="text-[12px] font-bold text-[#1B3154] mb-2">Reason</div>
            <p className="text-[11px] text-[#687991] leading-relaxed m-0">{v.reason || 'No reason provided.'}</p>
          </div>
          <div className="mt-3.5 p-3.5 rounded-[9px] bg-[#FFF8ED] border border-[#F4DFBD]">
            <div className="text-[12px] font-bold text-[#1B3154] mb-2">Penalty</div>
            <div className="flex justify-between text-[11px] text-[#64748B] py-1.5"><span>Penalty</span><strong className="text-[#182D4E]">{v.penalty_type || '—'}</strong></div>
            <div className="flex justify-between text-[11px] text-[#64748B] py-1.5"><span>Reporting Restriction</span><strong className="text-[#182D4E]">{v.restriction_days || 0} day(s)</strong></div>
          </div>
          {v.status === 'Appealed' && v.appeal_reason && (
            <div className="mt-3.5 p-3.5 rounded-[9px] bg-[#EEF5FF] border border-[#C9DDFF]">
              <div className="text-[11px] font-bold text-[#24518F]">Appeal Submitted</div>
              <p className="mt-1.5 text-[10px] text-[#55719A] m-0">{v.appeal_reason}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-[#E6EBF2] flex justify-end gap-2">
          <button onClick={onClose} className="h-[37px] px-4 rounded-[8px] bg-white border border-[#D2DBEA] text-[#596B85] text-[11px] font-bold cursor-pointer">Close</button>
          {v.status === 'Confirmed' && <button onClick={() => onAppeal(v)} className="h-[37px] px-4 rounded-[8px] bg-[#1463FF] border border-[#1463FF] text-white text-[11px] font-bold cursor-pointer">Submit Appeal</button>}
        </div>
      </div>
    </div>
  );
}

function ViolationAppealModal({ v, text, setText, onClose, onSubmit, appealing }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5" style={{ background: 'rgba(12,29,55,0.48)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-full max-w-[590px] bg-white rounded-[15px] overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.2)] animate-[modalIn_0.2s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#E6EBF2] flex justify-between items-start">
          <div>
            <div className="text-[18px] font-extrabold text-[#102A56]">Submit Violation Appeal</div>
            <div className="text-[11px] text-[#74859E] mt-1">Explain why you believe this violation should be reviewed.</div>
          </div>
          <button onClick={onClose} className="w-[32px] h-[32px] rounded-[8px] bg-[#F1F4F8] border-none cursor-pointer text-[18px] text-[#52627B]">{'\u00D7'}</button>
        </div>
        <div className="p-5">
          <div className="flex gap-2.5 p-3.5 bg-[#FFF8E8] border border-[#F1D69B] rounded-[9px] text-[#A66A00] mb-4">
            <span className="text-[18px] flex-shrink-0">{'\u26A0'}</span>
            <p className="text-[11px] leading-relaxed m-0">Your appeal will be reviewed by the Xevera administration. You will be notified once a decision has been made.</p>
          </div>
          <label className="text-[11px] font-bold text-[#243957] block mb-1.5">Appeal Reason</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Please explain why you believe this violation was issued incorrectly..." className="w-full min-h-[130px] resize-y border border-[#D5DEEA] rounded-[9px] p-2.5 text-[12px] font-[inherit]" style={{ outline: 'none' }} />
          <div className="text-right text-[9px] text-[#8996AA] mt-1">{text.length}/1000</div>
        </div>
        <div className="px-5 py-3.5 border-t border-[#E6EBF2] flex justify-end gap-2">
          <button onClick={onClose} className="h-[37px] px-4 rounded-[8px] bg-white border border-[#D2DBEA] text-[#596B85] text-[11px] font-bold cursor-pointer">Cancel</button>
          <button onClick={onSubmit} disabled={!text.trim() || appealing} className="h-[37px] px-4 rounded-[8px] bg-[#1463FF] border border-[#1463FF] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{appealing ? 'Submitting...' : 'Submit Appeal'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ResidentDashboardPage({ onViewReport, onNavigate }) {
  const { user } = useAuth();
  const { siteName, heroBanner } = useSettings();
  const showToast = useToast();
  const [impact, setImpact] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [violations, setViolations] = useState([]);
  const [violationCount, setViolationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealing, setAppealing] = useState(false);

  const firstName = (user?.name || 'Neighbor').trim().split(' ')[0];

  const loadImpact = useCallback(() => apiFetch('reports/impact.php').then(setImpact).catch(() => setImpact(null)), []);
  const loadRecent = useCallback(() => apiFetch('reports/my.php?limit=5').then((d) => setRecentReports(d.items || [])).catch(() => setRecentReports([])), []);
  const loadViolations = useCallback(() => apiFetch('violations/my.php').then((d) => {
    setViolations(d.violations || []);
    setViolationCount(d.violation_count || 0);
  }).catch(() => { setViolations([]); setViolationCount(0); }), []);

  useEffect(() => {
    setError(null);
    Promise.all([loadImpact(), loadRecent(), loadViolations()]).finally(() => setLoading(false));
  }, [loadImpact, loadRecent, loadViolations]);

  function goTo(action, preset) { if (onNavigate) onNavigate(action, preset); }
  function retry() {
    setLoading(true);
    Promise.all([loadImpact(), loadRecent(), loadViolations()]).finally(() => setLoading(false));
  }

  function openViolationDetails(v) { setSelectedViolation(v); setShowDetails(true); }
  function closeViolationDetails() { setShowDetails(false); }
  function openViolationAppeal(v) { setSelectedViolation(v); setAppealText(''); setShowAppeal(true); }
  function closeViolationAppeal() { setShowAppeal(false); setAppealText(''); }

  async function submitAppeal() {
    if (!appealText.trim() || !selectedViolation) return;
    setAppealing(true);
    try {
      await apiFetch('violations/appeal.php', {
        method: 'POST',
        body: { violation_id: selectedViolation.id, appeal_reason: appealText.trim() },
      });
      showToast('Appeal submitted successfully.', 'success');
      closeViolationAppeal();
      loadViolations();
    } catch (err) {
      showToast(err.message || 'Failed to submit appeal.', 'error');
    } finally {
      setAppealing(false);
    }
  }

  const stats = [
    { key: 'submitted', label: 'Total Reports', desc: 'All time', icon: 'file', tone: 'bg-[#EDF4FF] text-xevera-600', action: 'my-reports' },
    { key: 'pending', label: 'Pending', desc: 'Awaiting review', icon: 'clock', tone: 'bg-[#FFF5E4] text-[#F3A000]', action: 'my-reports', preset: 'Pending' },
    { key: 'in_progress', label: 'In Progress', desc: 'Being resolved', icon: 'wrench', tone: 'bg-[#F0EAFF] text-[#7A4CE0]', action: 'my-reports', preset: 'In Progress' },
    { key: 'resolved', label: 'Resolved', desc: 'Successfully completed', icon: 'check', tone: 'bg-[#E7F8EF] text-[#16A66A]', action: 'my-reports', preset: 'Resolved' },
    { key: 'violations', label: 'Violations', desc: 'Confirmed violations', icon: 'alert', tone: 'bg-[#FFF0DC] text-[#F59E0B]', value: violationCount },
  ];

  /*
   * Quick-action tiles shown on mobile. Mirrors the sidebar nav so residents
   * have one-tap access to every section without opening the drawer.
   */
  const quickActions = [
    { key: 'submit',     label: 'Report',         icon: 'plus',         tone: 'bg-[#EEF5FF] text-[#1769FF]' },
    { key: 'my-reports', label: 'My Reports',     icon: 'file',         tone: 'bg-[#EAF8EF] text-[#16A66A]' },
    { key: 'messages',   label: 'Messages',       icon: 'letter',       tone: 'bg-[#F0EAFF] text-[#7A4CE0]' },
    { key: 'notifications', label: 'Alerts',      icon: 'bell',         tone: 'bg-[#FFF5E4] text-[#F3A000]' },
    { key: 'announcements', label: 'News',        icon: 'megaphone',    tone: 'bg-[#FDE8E8] text-[#E5484D]' },
    { key: 'contact',    label: 'Support',        icon: 'phone',        tone: 'bg-[#E6F4F1] text-[#0F9B6E]' },
  ];

  // Normalize heroBanner from backend (e.g. "uploads/hero_banner.png?v=123" -> "/uploads/hero_banner.png?v=123") else fallback to xevera=hero.jpeg
  const rawHero = heroBanner || '/images/xevera-hero.jpeg';
  const heroImage = rawHero.startsWith('/') || rawHero.startsWith('http') || rawHero.startsWith('data:') ? rawHero : `/${rawHero}`;

  return (
    <ResidentLayout activePage="resident-dashboard" onNavigate={onNavigate} fullWidth>
      <div className="px-4 sm:px-7 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8 max-w-[1320px] mx-auto">
        {/* Hero (full-bleed image banner) - xevera=hero.jpeg */}
        <section
          className="relative w-full overflow-hidden rounded-[18px] sm:rounded-[20px] border border-[#0F3A8C]/15 shadow-[0_8px_24px_rgba(15,58,140,0.18)] min-h-[300px] sm:min-h-[320px] md:min-h-[330px] lg:min-h-[340px] flex items-center"
          style={{
            backgroundImage: `url('${heroImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            backgroundRepeat: 'no-repeat',
          }}
          aria-label="Xevera Civic Portal community"
        >
          {/* Dark/blue gradient overlay on the left for legibility. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(100deg, rgba(8,28,72,0.85) 0%, rgba(8,28,72,0.65) 35%, rgba(8,28,72,0.15) 70%, rgba(8,28,72,0) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative z-[2] w-full px-6 sm:px-10 lg:px-12 xl:px-14 py-10 sm:py-12 lg:py-14 max-w-[760px]">
            <span className="inline-flex items-center gap-2 self-start whitespace-nowrap rounded-full bg-white px-3 py-1.5 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-[11px] font-extrabold tracking-[2px] uppercase text-[#1769FF] shadow-[0_4px_12px_rgba(8,28,72,0.25)] mb-6 sm:mb-8">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#1769FF] flex-shrink-0" aria-hidden="true" />
              Resident Dashboard
            </span>
            <h1 className="text-[24px] sm:text-[30px] md:text-[34px] lg:text-[clamp(28px,3.2vw,38px)] leading-[1.12] font-extrabold text-white mb-2.5 sm:mb-3 tracking-[-0.7px] [text-shadow:0_2px_14px_rgba(8,28,72,0.45)]">
              {greeting()}, {firstName}! 👋
            </h1>
            <p className="text-[13.5px] sm:text-[14.5px] md:text-[15px] lg:text-[16px] text-white/85 leading-relaxed max-w-[560px] [text-shadow:0_1px_8px_rgba(8,28,72,0.5)]">
              Here&apos;s what&apos;s happening in your community. Stay informed and take action.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mt-6 sm:mt-7">
              <button
                onClick={() => goTo('submit')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 rounded-[10px] sm:rounded-[11px] bg-xevera-600 border border-xevera-600 text-white text-[13px] sm:text-[13.5px] font-extrabold shadow-[0_8px_18px_rgba(23,105,255,0.35)] hover:bg-[#0F57DC] hover:-translate-y-[1px] transition-all cursor-pointer"
              >
                <Icon name="plus" size={16} /> Report an Issue
              </button>
              <button
                onClick={() => goTo('my-reports')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[46px] px-5 sm:px-6 rounded-[10px] sm:rounded-[11px] bg-white border border-white text-xevera-600 text-[13px] sm:text-[13.5px] font-extrabold hover:bg-[#F5F8FD] transition-colors cursor-pointer"
              >
                <Icon name="file" size={16} /> Track My Reports
              </button>
            </div>
          </div>
        </section>

        {/* Quick actions (mobile only — mirrors the sidebar nav) */}
        <section className="lg:hidden">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
            {quickActions.map((a) => (
              <button
                key={a.key}
                onClick={() => goTo(a.key)}
                className="bg-white border border-[#DFE6EF] rounded-[14px] p-3 sm:p-3.5 flex flex-col items-center gap-2 text-center shadow-[0_2px_8px_rgba(20,60,110,0.04)] hover:-translate-y-[1px] hover:shadow-[0_6px_16px_rgba(20,60,110,0.08)] hover:border-[#C9D8F0] transition-all cursor-pointer"
              >
                <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] grid place-items-center ${a.tone}`}>
                  <Icon name={a.icon} size={18} />
                </span>
                <span className="text-[11px] sm:text-[12px] font-extrabold text-[#102D59] leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="bg-white rounded-[16px] border border-red-200 p-8 text-center">
            <p className="text-sm font-bold text-red-700 mb-2">Unable to load dashboard data</p>
            <button onClick={retry} className="px-4 py-2 rounded-[10px] bg-[#1769FF] text-white text-sm font-bold hover:bg-[#0D4ED8] transition-colors cursor-pointer">Try Again</button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5 lg:gap-6">
              {stats.map((s) => {
                const val = s.key === 'violations' ? s.value : (impact ? impact[s.key] ?? 0 : null);
                return (
                  <button key={s.key} onClick={() => s.key === 'violations' ? document.getElementById('violationsSection')?.scrollIntoView({ behavior: 'smooth' }) : goTo(s.action, s.preset)}
                    className={`group bg-white border border-[#DFE6EF] rounded-[14px] sm:rounded-[16px] p-4 sm:p-6 min-h-[150px] sm:min-h-[180px] 2xl:min-h-[200px] text-left flex flex-col shadow-[0_8px_28px_rgba(31,59,100,0.08)] hover:-translate-y-[3px] hover:shadow-[0_15px_35px_rgba(31,59,100,0.12)] hover:border-[#C9D8F0] transition-all cursor-pointer ${s.key === 'violations' ? 'bg-gradient-to-br from-white to-[#FFFCF5] border-[#F0D9B0]' : ''}`}>
                    <span className={`w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] rounded-[12px] sm:rounded-[14px] grid place-items-center transition-transform duration-200 group-hover:scale-110 ${s.tone}`}><Icon name={s.icon} size={20} /></span>
                    <div className={`mt-4 sm:mt-5 text-[26px] sm:text-[30px] 2xl:text-[34px] leading-none font-extrabold ${s.key === 'violations' ? 'text-[#C92E2E]' : 'text-navy-950'}`}>{val === null ? '—' : val}</div>
                    <div className={`mt-2 text-[13px] sm:text-[14px] font-bold ${s.key === 'violations' ? 'text-[#C92E2E]' : 'text-navy-950'}`}>{s.label}</div>
                    <div className="mt-1 text-[11.5px] sm:text-[12px] text-[#7A8AA2]">{s.desc}</div>
                    <span className="mt-auto pt-3 sm:pt-4 inline-flex text-[11.5px] sm:text-[12px] font-extrabold text-[#1769FF]">View details →</span>
                  </button>
                );
              })}
            </div>

            {/* Recent reports */}
            <section className="bg-white border border-[#DFE6EF] rounded-[14px] sm:rounded-[16px] shadow-[0_2px_8px_rgba(18,38,75,0.04),0_12px_30px_rgba(18,38,75,0.04)] overflow-hidden">
              <div className="min-h-[68px] sm:min-h-[76px] px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 border-b border-[#EDF0F5]">
                <div className="min-w-0">
                  <div className="text-[15px] sm:text-[16px] font-extrabold text-[#152348]">My Recent Reports</div>
                  <div className="mt-1 sm:mt-1.5 text-[11.5px] sm:text-[12px] text-[#6B7896]">Track the status of your submitted reports</div>
                </div>
                <button onClick={() => goTo('my-reports')} className="text-[#1769FF] text-[12px] font-bold hover:underline bg-none border-none cursor-pointer whitespace-nowrap">View all →</button>
              </div>

              {loading ? (
                <div className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                  {[1, 2].map((i) => <div key={i} className="h-[86px] bg-[#F3F6FB] rounded-[12px] animate-pulse" />)}
                </div>
              ) : recentReports.length === 0 ? (
                <div className="py-12 sm:py-16 text-center px-4 sm:px-6">
                  <span className="w-[60px] h-[60px] mx-auto mb-4 rounded-[18px] bg-[#F1F5F9] text-[#94A3B8] grid place-items-center"><Icon name="file" size={26} /></span>
                  <p className="text-sm font-bold text-[#374151]">No reports yet</p>
                  <p className="text-[12px] text-[#94A3B8] mt-1.5">Submit your first report to see it here.</p>
                  <button onClick={() => goTo('submit')} className="mt-5 px-5 py-2.5 rounded-[10px] bg-[#1769FF] text-white text-xs font-bold hover:bg-[#0D4ED8] cursor-pointer">Report an Issue</button>
                </div>
              ) : (
                <div>
                  {recentReports.map((r) => {
                    const idx = STEP_INDEX[r.status] ?? 0;
                    const isDone = r.status === 'Resolved' || r.status === 'Closed';
                    const lineColor = isDone ? '#16A765' : '#1769FF';
                    const stepColor = isDone ? '#16A765' : '#1769FF';
                    const icon = CAT_ICON[r.category] || 'file';
                    const firstPhoto = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0] : null;
                    return (
                      <div key={r.id} className="grid grid-cols-1 lg:grid-cols-[minmax(260px,1.15fr)_minmax(330px,1.6fr)_auto] gap-3 sm:gap-4 lg:gap-5 items-stretch lg:items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-[#EDF0F5] last:border-b-0 hover:bg-[#FBFDFF] transition-colors cursor-pointer" onClick={() => onViewReport && onViewReport(r.id)}>
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <span className="w-[64px] h-[56px] sm:w-[88px] sm:h-[64px] flex-shrink-0 rounded-[10px] overflow-hidden bg-gradient-to-br from-[#DBE9FF] to-[#EDF4FF] text-[#1769FF] border border-[#D9E6FF] grid place-items-center relative">
                            {firstPhoto ? (
                              <ReportImage
                                src={firstPhoto}
                                alt={r.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Icon name={icon} size={24} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] sm:text-[14px] font-extrabold text-[#152348] truncate">{r.title}</div>
                            <div className="mt-1 sm:mt-1.5 text-[11.5px] sm:text-[12px] text-[#596782] truncate">{r.location || '—'}</div>
                            <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-[#8390A6]">
                              <span className="truncate">{r.date}</span><span>•</span><span className="truncate">{r.id}</span>
                            </div>
                          </div>
                          <span className={`sm:hidden flex-shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[28px] px-3 rounded-full border text-[11px] font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${STATUS_PILL[getEffectiveStatus(r.status, r.is_suspicious)] || 'bg-white text-[#1769FF] border-[#C4D9F7]'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {getEffectiveStatus(r.status, r.is_suspicious)}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="relative flex justify-between mx-3 sm:mx-3.5 mb-1.5 sm:mb-2">
                            <span className="absolute left-[5px] right-[5px] top-[6px] h-[2px] bg-[#DCE3F0]" />
                            <span className="absolute left-[5px] top-[6px] h-[2px] transition-all" style={{ width: idx > 0 ? `calc(${(idx / 4) * 100}% - 10px)` : '0px', background: lineColor }} />
                            {WORKFLOW_STEPS.map((s, i) => {
                              const completed = isDone || i < idx;
                              const current = !isDone && i === idx;
                              return (
                                <span key={s} className={`relative z-[2] w-[12px] h-[12px] sm:w-[13px] sm:h-[13px] rounded-full border-2 ${completed ? 'bg-[#1769FF] border-[#1769FF]' : current ? 'bg-white border-[3px] border-[#9EBCF9] shadow-[0_0_0_3px_#EEF5FF]' : 'bg-white border-[2px] border-[#AAB6CC]'}`} style={completed && isDone ? { background: stepColor, borderColor: stepColor } : undefined} />
                              );
                            })}
                          </div>
                          <div className="flex justify-between gap-1 sm:gap-2">
                            {WORKFLOW_STEPS.map((s) => <span key={s} className="w-[20%] text-center text-[9px] sm:text-[10px] text-[#65728B] whitespace-nowrap">{s}</span>)}
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center justify-between gap-3">
                          <span className={`inline-flex items-center justify-center gap-1.5 min-w-[104px] min-h-[32px] px-3.5 rounded-full border text-xs font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${STATUS_PILL[getEffectiveStatus(r.status, r.is_suspicious)] || 'bg-white text-[#1769FF] border-[#C4D9F7]'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {getEffectiveStatus(r.status, r.is_suspicious)}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); onViewReport && onViewReport(r.id); }} aria-label="Report options" className="w-[32px] h-[32px] rounded-[8px] bg-transparent border-none text-[#73809A] hover:bg-[#EEF3FB] hover:text-[#1769FF] cursor-pointer">⋮</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* My Violations */}
            <section id="violationsSection" className="bg-white border border-[#DFE6EF] rounded-[14px] sm:rounded-[16px] shadow-[0_2px_8px_rgba(18,38,75,0.04),0_12px_30px_rgba(18,38,75,0.04)] overflow-hidden">
              <div className="min-h-[68px] sm:min-h-[76px] px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 border-b border-[#EDF0F5]">
                <div className="min-w-0">
                  <div className="text-[15px] sm:text-[16px] font-extrabold text-[#152348]">My Violations</div>
                  <div className="mt-1 sm:mt-1.5 text-[11.5px] sm:text-[12px] text-[#6B7896]">Review your confirmed violations and penalties</div>
                </div>
              </div>

              {violations.length === 0 ? (
                <div className="m-5 p-5 rounded-[12px] border border-[#D9EEE1] bg-[#F7FCF8] flex items-center gap-3.5">
                  <span className="w-[46px] h-[46px] rounded-full bg-[#E2F6E9] text-[#16A05D] grid place-items-center flex-shrink-0"><Icon name="check" size={20} /></span>
                  <div>
                    <div className="text-[14px] font-extrabold text-[#174D31]">No violations</div>
                    <div className="mt-1 text-[11px] text-[#67806F]">You currently have no confirmed violations on your account.</div>
                  </div>
                </div>
              ) : (
                <div>
                  {violations.map((v) => (
                    <ViolationItem key={v.id} v={v} onViewDetails={openViolationDetails} onAppeal={openViolationAppeal} />
                  ))}
                </div>
              )}

              <div className="mx-4 sm:mx-6 mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-[9px] border border-[#BDD7FF] bg-[#F1F7FF] flex items-center gap-2.5 sm:gap-3">
                <span className="w-[28px] h-[28px] sm:w-[29px] sm:h-[29px] rounded-full bg-[#2171E8] text-white grid place-items-center flex-shrink-0 text-[13px] font-bold">i</span>
                <div>
                  <div className="text-[12px] font-bold text-[#18335D]">Need help?</div>
                  <div className="mt-0.5 text-[10px] text-[#5D7190]">If you believe a violation was issued incorrectly, you may submit an appeal for review.</div>
                </div>
              </div>
            </section>

          </>
        )}

        {/* Violation Details Modal */}
        {showDetails && selectedViolation && <ViolationDetailsModal v={selectedViolation} onClose={closeViolationDetails} onAppeal={(v) => { closeViolationDetails(); openViolationAppeal(v); }} />}

        {/* Appeal Modal */}
        {showAppeal && selectedViolation && <ViolationAppealModal v={selectedViolation} text={appealText} setText={setAppealText} onClose={closeViolationAppeal} onSubmit={submitAppeal} appealing={appealing} />}

        <footer className="pt-8 pb-3 text-center text-[11px] text-[#8A95A9]">&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</footer>
      </div>
    </ResidentLayout>
  );
}