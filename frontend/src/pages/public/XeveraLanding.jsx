import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';

const STATS = [
  { key: 'total', label: 'Reports Submitted', icon: 'file', color: '#1264f5' },
  { key: 'resolved', label: 'Reports Resolved', icon: 'check', color: '#1EA85B' },
  { key: 'avg_resolve_days', label: 'Avg. Days to Resolve', icon: 'clock', color: '#F59E0B' },
  { key: 'satisfaction', label: 'Community Satisfaction', icon: 'thumbsup', color: '#8B5CF6' },
  { key: 'residents', label: 'Total Residents', icon: 'users', color: '#1264f5', subtitle: 'All registered residents in Xevera', recommended: true },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    ),
    title: 'Secure',
    desc: 'Your data is protected with advanced security.',
    color: '#1264f5',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/></svg>
    ),
    title: 'Community Focused',
    desc: 'Better service for a better Xevera community.',
    color: '#1EA85B',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-2 7 4 2-8 11 2-7-4-2 8-11Z"/></svg>
    ),
    title: 'Fast & Easy',
    desc: 'Quick access to reporting tools and updates.',
    color: '#F59E0B',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
    ),
    title: 'Stay Informed',
    desc: 'Get real-time updates on your reports and announcements.',
    color: '#8B5CF6',
  },
];

function StatIcon({ type, size = 20 }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (type) {
    case 'file':
      return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'check':
      return <svg {...s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    case 'clock':
      return <svg {...s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'thumbsup':
      return <svg {...s}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
    case 'users':
      return <svg {...s}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    default:
      return null;
  }
}

export default function XeveraLanding({ onAuth }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch('reports/stats.php')
      .then(setStats)
      .catch(() => setStats({ total: 0, pending: 0, claimed: 0, resolved: 0 }));
  }, []);

  return (
    <div className="overflow-x-hidden w-full max-w-[100vw]">

      {/* ===== HERO SECTION ===== */}
      <section className="relative w-full overflow-hidden" style={{ height: '600px' }}>
        <div
          className="absolute inset-0 flex items-center"
          style={{
            backgroundImage: "url('/images/xevera-hero.jpeg')",
            backgroundSize: '100% auto',
            backgroundPosition: 'center 40%',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 pointer-events-none hidden md:block" style={{ background: 'linear-gradient(90deg, rgba(5,22,54,0.92) 0%, rgba(5,22,54,0.82) 28%, rgba(5,22,54,0.50) 52%, rgba(5,22,54,0.10) 72%, transparent 100%)' }} aria-hidden="true" />
          <div className="absolute inset-0 pointer-events-none md:hidden" style={{ background: 'linear-gradient(90deg, rgba(5,22,54,0.92) 0%, rgba(5,22,54,0.72) 45%, rgba(5,22,54,0.30) 100%)' }} aria-hidden="true" />

          <div className="absolute inset-0 z-10 w-full pl-6 pr-6 sm:pl-10 sm:pr-6 md:pl-16 md:pr-8 lg:pl-20 lg:pr-12 max-w-[1500px] mx-auto flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/95 backdrop-blur-sm self-start px-4 py-2 sm:px-5 sm:py-2.5 text-[10px] sm:text-[11px] font-bold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-[#1264f5] shadow-[0_4px_12px_rgba(8,28,72,0.18)]">
              <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-[#1264f5] flex-shrink-0" />
              <span className="whitespace-nowrap">OFFICIAL COMMUNITY PORTAL</span>
            </div>

            <h1 className="mt-5 sm:mt-6 text-[clamp(36px,6.5vw,54px)] font-extrabold text-white leading-[1.05] sm:leading-[1.08] tracking-[-0.5px] [text-shadow:0_3px_16px_rgba(5,22,54,0.75)] max-w-[560px]">
              Building a Better<br />Xevera Together
            </h1>

            <p className="mt-4 sm:mt-4 max-w-[480px] text-[15px] sm:text-[16px] text-white/88 leading-[1.6] [text-shadow:0_2px_8px_rgba(5,22,54,0.60)]">
              Report environmental and civic issues in your community and track how the local team responds — from submission all the way to resolution.
            </p>

            <div className="mt-7 sm:mt-6 flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-3 w-full sm:w-auto">
              <button type="button" onClick={() => onAuth && onAuth('login')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[50px] sm:min-h-[48px] px-7 sm:px-8 rounded-[12px] bg-[#1264f5] border border-[#1264f5] text-white text-[15px] font-extrabold shadow-[0_8px_20px_rgba(18,100,245,0.35)] hover:bg-[#0d52d6] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 cursor-pointer">
                Login
              </button>
              <button type="button" onClick={() => onAuth && onAuth('register')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[50px] sm:min-h-[48px] px-7 sm:px-8 rounded-[12px] bg-white border border-white text-[#1264f5] text-[15px] font-extrabold shadow-[0_6px_16px_rgba(8,28,72,0.18)] hover:bg-[#F5F8FD] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 cursor-pointer">
                Create Account
              </button>
            </div>

            <div className="mt-8 sm:mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
              {[
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m8 12 3 3 5-5"/></svg>, label: 'Cleaner Environment' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>, label: 'Safer Community' },
                { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: 'A Better Xevera' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[10px] bg-white/15 backdrop-blur-sm flex items-center justify-center text-white border border-white/20">{b.icon}</div>
                  <span className="text-[13px] sm:text-[14px] font-semibold text-white/90">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== IMPACT SECTION ===== */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-10 sm:pt-12 lg:pt-14 pb-6 sm:pb-8">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 px-1">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#1264f5]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1264f5]" />
            COMMUNITY IMPACT
          </span>
          <h2 className="text-[clamp(24px,5vw,34px)] font-extrabold text-[#10284d] mt-2 leading-[1.15]">Our Impact So Far</h2>
          <p className="text-[13px] sm:text-sm text-[#64748B] mt-2 leading-relaxed px-2">
            Live counts across the community, updated as reports come in.
          </p>
        </div>

        {/* 5 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {STATS.map((s) => {
            let val;
            if (s.key === 'residents') {
              val = '2,458';
            } else {
              const raw = stats ? (stats[s.key] ?? 0) : 0;
              val = s.key === 'satisfaction' ? raw + '%'
                : s.key === 'avg_resolve_days' ? (stats && stats[s.key] !== null && stats[s.key] !== undefined ? raw : '—')
                : Number(raw || 0).toLocaleString();
            }
            return (
              <div
                key={s.key}
                className={`relative bg-white rounded-[16px] sm:rounded-[20px] border p-5 sm:p-6 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(10,26,69,0.10)] transition-all duration-300 min-w-0 ${s.recommended ? 'border-[#1264f5] shadow-[0_4px_16px_rgba(18,100,245,0.10)]' : 'border-[#E5E7EB]'}`}
              >
                {s.recommended && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF2FF] text-[#1264f5] text-[9px] font-bold tracking-wide uppercase">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Recommended
                  </span>
                )}
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white shadow-md flex-shrink-0"
                  style={{ background: s.color, boxShadow: `0 8px 18px ${s.color}30` }}>
                  <StatIcon type={s.icon} />
                </div>
                <div className="text-[24px] sm:text-[30px] leading-none font-extrabold text-[#10284d] mt-4 sm:mt-5 break-words">
                  {stats || s.key === 'residents' ? val : '—'}
                </div>
                <div className="text-[12px] sm:text-[13px] font-semibold text-[#64748B] mt-2 leading-tight">{s.label}</div>
                {s.subtitle && (
                  <div className="text-[11px] text-[#8A9AB5] mt-1 leading-snug">{s.subtitle}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== RECOMMENDATION PANEL ===== */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pb-10 sm:pb-14">
        <div className="bg-[#F1F7FF] border border-[#D0E2FF] rounded-[16px] sm:rounded-[20px] p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Lightbulb Icon */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1264f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] sm:text-[16px] font-extrabold text-[#10284d] leading-snug">
              Why show the total number of residents?
            </h3>
            <p className="text-[13px] sm:text-[14px] text-[#4A5E7A] mt-1.5 leading-relaxed">
              Displaying the total number of residents helps build transparency, shows the platform&rsquo;s reach, and provides context for the community impact. It also helps measure participation rate and encourages more residents to use the platform.
            </p>
          </div>
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#DBEAFE] text-[#1264f5] text-[12px] font-bold whitespace-nowrap flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            Good to Add
          </span>
        </div>
      </section>

      {/* ===== WHY XEVERA / FEATURES ===== */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-4 sm:pt-6 pb-12 sm:pb-16">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 px-1">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#1264f5]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1264f5]" />
            WHY XEVERA
          </span>
          <h2 className="text-[clamp(24px,5vw,34px)] font-extrabold text-[#10284d] mt-2 leading-[1.15]">Why Choose Our Platform</h2>
          <p className="text-[13px] sm:text-sm text-[#64748B] mt-2 leading-relaxed px-2">
            Everything you need to report issues and improve your community.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white border border-[#E5E7EB] rounded-[16px] sm:rounded-[20px] p-5 sm:p-6 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(10,26,69,0.10)] transition-all duration-300 min-w-0"
            >
              <div
                className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white shadow-md flex-shrink-0"
                style={{ background: f.color, boxShadow: `0 8px 18px ${f.color}30` }}
              >
                {f.icon}
              </div>
              <div className="text-[15px] sm:text-[16px] font-extrabold text-[#10284d] mt-4">{f.title}</div>
              <div className="text-[12px] sm:text-[13px] text-[#64748B] mt-1.5 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
