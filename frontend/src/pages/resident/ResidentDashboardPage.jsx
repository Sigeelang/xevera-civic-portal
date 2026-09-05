import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import Icon from '../../components/Icon';
import ReportImage from '../../components/ReportImage';
import ResidentLayout from '../../layouts/ResidentLayout';

const WORKFLOW_STEPS = ['Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
const STEP_INDEX = { Pending: 0, Verified: 1, Assigned: 2, 'In Progress': 3, Resolved: 4, Closed: 4, Rejected: 0 };

const STATUS_PILL = {
  Pending: 'bg-[#FFF6E7] text-[#EF9700]',
  Verified: 'bg-[#EEF5FF] text-[#1769FF]',
  Assigned: 'bg-[#EEF5FF] text-[#1769FF]',
  'In Progress': 'bg-[#EEF5FF] text-[#1769FF]',
  Resolved: 'bg-[#EAF9F1] text-[#16A765]',
  Closed: 'bg-[#EAF9F1] text-[#16A765]',
  Rejected: 'bg-[#FFF0F0] text-[#EF4444]',
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

export default function ResidentDashboardPage({ onViewReport, onNavigate }) {
  const { user } = useAuth();
  const { siteName, heroBanner } = useSettings();
  const [impact, setImpact] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const firstName = (user?.name || 'Neighbor').trim().split(' ')[0];

  const loadImpact = useCallback(() => apiFetch('reports/impact.php').then(setImpact).catch(() => setImpact(null)), []);
  const loadRecent = useCallback(() => apiFetch('reports/my.php?limit=5').then((d) => setRecentReports(d.items || [])).catch(() => setRecentReports([])), []);

  useEffect(() => {
    setError(null);
    Promise.all([loadImpact(), loadRecent()]).finally(() => setLoading(false));
  }, [loadImpact, loadRecent]);

  function goTo(action, preset) { if (onNavigate) onNavigate(action, preset); }
  function retry() {
    setLoading(true);
    Promise.all([loadImpact(), loadRecent()]).finally(() => setLoading(false));
  }

  const stats = [
    { key: 'submitted', label: 'Total Reports', desc: 'All time', icon: 'file', tone: 'bg-[#EDF4FF] text-xevera-600', action: 'my-reports' },
    { key: 'pending', label: 'Pending', desc: 'Awaiting review', icon: 'clock', tone: 'bg-[#FFF5E4] text-[#F3A000]', action: 'my-reports', preset: 'Pending' },
    { key: 'in_progress', label: 'In Progress', desc: 'Being resolved', icon: 'wrench', tone: 'bg-[#F0EAFF] text-[#7A4CE0]', action: 'my-reports', preset: 'In Progress' },
    { key: 'resolved', label: 'Resolved', desc: 'Successfully completed', icon: 'check', tone: 'bg-[#E7F8EF] text-[#16A66A]', action: 'my-reports', preset: 'Resolved' },
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
            <div className="text-[10px] sm:text-[11px] font-extrabold tracking-[2px] uppercase text-white/75 mb-3 sm:mb-4">
              Resident Dashboard
            </div>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
              {stats.map((s) => {
                const val = impact ? impact[s.key] ?? 0 : null;
                return (
                  <button key={s.key} onClick={() => goTo(s.action, s.preset)}
                    className="group bg-white border border-[#DFE6EF] rounded-[14px] sm:rounded-[16px] p-4 sm:p-6 min-h-[150px] sm:min-h-[180px] 2xl:min-h-[200px] text-left flex flex-col shadow-[0_8px_28px_rgba(31,59,100,0.08)] hover:-translate-y-[3px] hover:shadow-[0_15px_35px_rgba(31,59,100,0.12)] hover:border-[#C9D8F0] transition-all cursor-pointer">
                    <span className={`w-[42px] h-[42px] sm:w-[48px] sm:h-[48px] rounded-[12px] sm:rounded-[14px] grid place-items-center transition-transform duration-200 group-hover:scale-110 ${s.tone}`}><Icon name={s.icon} size={20} /></span>
                    <div className="mt-4 sm:mt-5 text-[26px] sm:text-[30px] 2xl:text-[34px] leading-none font-extrabold text-navy-950">{val === null ? '—' : val}</div>
                    <div className="mt-2 text-[13px] sm:text-[14px] font-bold text-navy-950">{s.label}</div>
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
                          <span className={`sm:hidden flex-shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[28px] px-3 rounded-full text-[11px] font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${STATUS_PILL[r.status] || 'bg-[#EEF5FF] text-[#1769FF]'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {r.status}
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
                          <span className={`inline-flex items-center justify-center gap-1.5 min-w-[104px] min-h-[32px] px-3.5 rounded-full text-xs font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${STATUS_PILL[r.status] || 'bg-[#EEF5FF] text-[#1769FF]'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            {r.status}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); onViewReport && onViewReport(r.id); }} aria-label="Report options" className="w-[32px] h-[32px] rounded-[8px] bg-transparent border-none text-[#73809A] hover:bg-[#EEF3FB] hover:text-[#1769FF] cursor-pointer">⋮</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Lower grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 sm:gap-5 lg:gap-6">
              {/* Need help */}
              <section className="bg-white border border-[#DFE6EF] rounded-[14px] sm:rounded-[16px] shadow-[0_2px_8px_rgba(18,38,75,0.04),0_12px_30px_rgba(18,38,75,0.04)] overflow-hidden">
                <div className="min-h-[68px] sm:min-h-[76px] px-4 sm:px-6 py-4 sm:py-5 border-b border-[#EDF0F5]">
                  <div className="text-[15px] sm:text-[16px] font-extrabold text-[#152348]">Need Help?</div>
                  <div className="mt-1 sm:mt-1.5 text-[11.5px] sm:text-[12px] text-[#6B7896]">We&apos;re here to assist you</div>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="min-h-[120px] sm:min-h-[140px] rounded-[12px] sm:rounded-[14px] p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5" style={{ background: 'linear-gradient(120deg,#F2F7FF,#EDF4FF)' }}>
                    <span className="w-full sm:w-[130px] sm:h-[96px] h-[80px] flex-shrink-0 rounded-[12px] bg-[#DFEAFF] text-[#1769FF] grid place-items-center">
                      <Icon name="book" size={38} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] sm:text-[14px] font-extrabold text-[#152348]">Visit our Help Center or contact our support team for assistance.</div>
                      <div className="mt-1.5 sm:mt-2 text-[11.5px] sm:text-[12px] text-[#66738D] leading-relaxed">Find answers to common questions, reporting guides, and portal help.</div>
                      <button onClick={() => goTo('contact')} className="mt-3 sm:mt-4 inline-flex items-center min-h-[38px] px-4 rounded-[9px] bg-[#1769FF] text-white text-[12px] font-bold hover:bg-[#0D4ED8] cursor-pointer">Contact Support →</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-3 sm:mt-4">
                    <button onClick={() => goTo('help')} className="min-h-[60px] sm:min-h-[64px] rounded-[11px] sm:rounded-[12px] border border-[#DFE6EF] p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 hover:bg-[#F7FAFF] cursor-pointer">
                      <span className="w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] rounded-[10px] bg-[#EEF5FF] text-[#1769FF] grid place-items-center"><Icon name="book" size={18} /></span>
                      <span className="min-w-0 text-left"><span className="block text-[11.5px] sm:text-[12px] font-extrabold text-[#152348]">Help Center</span><span className="block mt-0.5 sm:mt-1 text-[10px] text-[#8792A8]">Browse guides &amp; FAQs</span></span>
                      <span className="ml-auto text-[#8A96AA]">›</span>
                    </button>
                    <button onClick={() => goTo('contact')} className="min-h-[60px] sm:min-h-[64px] rounded-[11px] sm:rounded-[12px] border border-[#DFE6EF] p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 hover:bg-[#F7FAFF] cursor-pointer">
                      <span className="w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] rounded-[10px] bg-[#EEF5FF] text-[#1769FF] grid place-items-center"><Icon name="phone" size={18} /></span>
                      <span className="min-w-0 text-left"><span className="block text-[11.5px] sm:text-[12px] font-extrabold text-[#152348]">Contact Support</span><span className="block mt-0.5 sm:mt-1 text-[10px] text-[#8792A8]">We typically reply within 24h</span></span>
                      <span className="ml-auto text-[#8A96AA]">›</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        <footer className="pt-8 pb-3 text-center text-[11px] text-[#8A95A9]">&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</footer>
      </div>
    </ResidentLayout>
  );
}