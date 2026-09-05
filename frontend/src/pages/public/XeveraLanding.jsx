import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import Icon from '../../components/Icon';

const CATEGORY_COLORS = ['#1258E8', '#1EA85B', '#F86038', '#8B5CF6', '#0EA5E9', '#6B7280'];
const FALLBACK_CATS = ['Road & Pavement', 'Garbage Collection', 'Streetlights', 'Drainage', 'Environment', 'Other'];

const CATEGORY_ICONS = {
  'Road & Pavement': 'road', 'Road Damage': 'road', 'Road & Infrastructure': 'road',
  'Garbage Collection': 'trash', 'Garbage / Waste': 'trash', 'Waste': 'trash',
  'Streetlights': 'bolt', 'Streetlight': 'bulb',
  'Drainage': 'pipe', 'Flooding': 'flood', 'Drainage & Flooding': 'flood',
  'Environment': 'leaf', 'Environmental': 'tree',
  'Water Problem': 'drop', 'Water': 'drop', 'Public Safety': 'shield', 'Other': 'box', 'Other Issues': 'box',
};

// Map display category names to TrackReportPage filter values
const CATEGORY_TO_TRACK_FILTER = {
  'Flooding': 'Flooding',
  'Road Damage': 'Road Damage',
  'Road & Pavement': 'Road Damage',
  'Road & Infrastructure': 'Road Damage',
  'Garbage / Waste': 'Garbage / Waste',
  'Garbage Collection': 'Garbage / Waste',
  'Waste': 'Garbage / Waste',
  'Streetlight': 'Streetlight',
  'Streetlights': 'Streetlight',
  'Water Problem': 'Water Problem',
  'Water': 'Water Problem',
  'Drainage': 'Drainage',
  'Drainage & Flooding': 'Drainage',
};

const STATS = [
  { key: 'total', label: 'Reports Submitted', icon: 'file', from: '#1258E8', to: '#0B3AAB', tint: '#1258E8' },
  { key: 'resolved', label: 'Reports Resolved', icon: 'check', from: '#1EA85B', to: '#15803D', tint: '#1EA85B' },
  { key: 'avg_resolve_days', label: 'Avg. Days to Resolve', icon: 'clock', from: '#F59E0B', to: '#D97706', tint: '#F59E0B' },
  { key: 'satisfaction', label: 'Community Satisfaction', icon: 'thumbsup', from: '#8B5CF6', to: '#7C3AED', tint: '#8B5CF6' },
];

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 px-1">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-xevera-600">
        <span className="w-1.5 h-1.5 rounded-full bg-xevera-600" />
        {eyebrow}
      </span>
      <h2 className="text-[clamp(22px,5.5vw,32px)] font-head font-extrabold text-navy-950 mt-2 leading-[1.15]">{title}</h2>
      {subtitle && <p className="text-[13px] sm:text-sm text-[#64748B] mt-2 leading-relaxed px-2">{subtitle}</p>}
    </div>
  );
}

export default function XeveraLanding({ onNavigate, onAuth }) {
  const { settings, categories } = useSettings();
  const [stats, setStats] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    apiFetch('reports/stats.php')
      .then(setStats)
      .catch(() => setStats({ total: 0, pending: 0, claimed: 0, resolved: 0 }));
    apiFetch('maintenance/public.php')
      .then((d) => setMaintenance(Array.isArray(d.items) ? d.items : []))
      .catch(() => setMaintenance([]));
    apiFetch('announcements/list.php')
      .then((d) => setAnnouncements(Array.isArray(d) ? d : []))
      .catch(() => setAnnouncements([]));
  }, []);

  const heroTitle = settings?.hero_title || 'Together, We Improve Xevera';
  const heroSubtitle = settings?.hero_subtitle || 'Report local concerns, follow updates, and help make our community safer, cleaner, and better.';
  const cats = (categories && categories.length ? categories : FALLBACK_CATS).slice(0, 6);
  const upcoming = maintenance.slice(0, 3);
  const updates = announcements.slice(0, 3);

  return (
    <div className="overflow-x-hidden w-full max-w-[100vw]">
      {/* ===== Full-width Hero Banner ===== */}
      <section className="relative w-full overflow-hidden">
        <div
          className="relative w-full h-[480px] sm:h-[540px] md:h-[640px] lg:h-[620px] flex items-center"
          style={{
            backgroundImage: "url('/images/xevera-hero.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Darker gradient overlay for legibility (left → right) */}
          <div
            className="absolute inset-0 pointer-events-none hidden md:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(5, 22, 54, 0.88) 0%, rgba(5, 22, 54, 0.68) 38%, rgba(5, 22, 54, 0.30) 65%, rgba(5, 22, 54, 0.05) 100%)',
            }}
            aria-hidden="true"
          />
          {/* Mobile overlay - keeps building/fountain visible on phones */}
          <div
            className="absolute inset-0 pointer-events-none md:hidden"
            style={{
              background:
                'linear-gradient(90deg, rgba(5, 22, 54, 0.88) 0%, rgba(5, 22, 54, 0.62) 45%, rgba(5, 22, 54, 0.30) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full pl-6 pr-6 sm:pl-8 sm:pr-6 md:pl-12 md:pr-8 lg:pl-16 lg:pr-12 max-w-3xl flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/95 backdrop-blur-sm self-start px-3 py-1.5 sm:px-3.5 sm:py-1.5 text-[10.5px] sm:text-xs font-bold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-xevera-600 shadow-[0_4px_12px_rgba(8,28,72,0.18)]">
              <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-xevera-600 flex-shrink-0" />
              <span className="whitespace-nowrap">OFFICIAL COMMUNITY PORTAL</span>
            </div>
            <h1 className="mt-4 sm:mt-4 text-[clamp(40px,7vw,56px)] font-head font-extrabold text-white leading-[1.05] sm:leading-[1.1] tracking-[-0.5px] [text-shadow:0_3px_16px_rgba(5,22,54,0.75)]">
              Building a Better
              <br className="hidden sm:inline" />
              <span className="sm:inline"> Xevera Together</span>
            </h1>
            <p className="mt-3 sm:mt-3 max-w-xl text-[16px] sm:text-[15px] md:text-[16px] text-white/90 leading-[1.55] sm:leading-relaxed [text-shadow:0_2px_8px_rgba(5,22,54,0.70)]">
              Report environmental and civic issues in your community
              and track how the local team responds — from submission
              all the way to resolution.
            </p>

            {/* Login / Register CTAs */}
            <div className="mt-6 sm:mt-5 flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onAuth && onAuth('login')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[46px] px-5 sm:px-6 rounded-[12px] sm:rounded-[12px] bg-xevera-600 border border-xevera-600 text-white text-[14px] sm:text-[14px] font-extrabold shadow-[0_8px_18px_rgba(23,105,255,0.35)] hover:bg-xevera-700 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login
              </button>
              <button
                type="button"
                onClick={() => onAuth && onAuth('register')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[46px] px-5 sm:px-6 rounded-[12px] sm:rounded-[12px] bg-white border border-white text-xevera-600 text-[14px] sm:text-[14px] font-extrabold shadow-[0_6px_16px_rgba(8,28,72,0.18)] hover:bg-[#F5F8FD] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Community statistics ===== */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 lg:pt-10 pb-10 sm:pb-14 lg:pb-16">
        <SectionHeader eyebrow="Community Impact" title="Our Impact So Far" subtitle="Live counts across the community, updated as reports come in." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {STATS.map((s) => {
            const raw = stats ? (stats[s.key] ?? 0) : 0;
            const val = s.key === 'satisfaction' ? raw + '%'
              : s.key === 'avg_resolve_days' ? (stats && stats[s.key] !== null && stats[s.key] !== undefined ? raw : '—')
              : Number(raw || 0).toLocaleString();
            return (
              <div key={s.key} className="bg-white rounded-[16px] sm:rounded-[20px] border border-[#E5E7EB] p-4 sm:p-6 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(10,26,69,0.10)] transition-all duration-300 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})`, boxShadow: `0 8px 18px ${s.tint}40` }}>
                    <Icon name={s.icon} size={18} strokeWidth={2.2} />
                  </div>
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ background: s.tint }} />
                </div>
                <div className="text-[22px] sm:text-[28px] leading-none font-extrabold text-navy-950 mt-3 sm:mt-4 break-words">{stats ? val : '—'}</div>
                <div className="text-[11.5px] sm:text-[12.5px] font-semibold text-[#64748B] mt-1.5 leading-tight">{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Why Xevera / Feature highlights ===== */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-2 sm:pt-4 pb-10 sm:pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
              title: 'Secure',
              desc: 'Your data is protected with advanced security.',
              from: '#1769FF', to: '#0B3AAB', tint: '#1769FF',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 11h-6" />
                  <path d="M19 8v6" />
                </svg>
              ),
              title: 'Community Focused',
              desc: 'Better service for a better Xevera community.',
              from: '#1EA85B', to: '#15803D', tint: '#1EA85B',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m13 2-2 7 4 2-8 11 2-7-4-2 8-11Z" />
                </svg>
              ),
              title: 'Fast & Easy',
              desc: 'Quick access to reporting tools and updates.',
              from: '#F59E0B', to: '#D97706', tint: '#F59E0B',
            },
            {
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              ),
              title: 'Stay Informed',
              desc: 'Get real-time updates on your reports and announcements.',
              from: '#8B5CF6', to: '#7C3AED', tint: '#8B5CF6',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white border border-[#E5E7EB] rounded-[16px] sm:rounded-[20px] p-4 sm:p-5 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(10,26,69,0.10)] transition-all duration-300 min-w-0"
            >
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${f.from}, ${f.to})`, boxShadow: `0 8px 18px ${f.tint}40` }}
              >
                {f.icon}
              </div>
              <div className="text-[14px] sm:text-[15px] font-extrabold text-navy-950 mt-3 sm:mt-3.5">{f.title}</div>
              <div className="text-[11.5px] sm:text-[12.5px] text-[#64748B] mt-1 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular report categories removed from public - D:\GAMES\backup (9)\frontend */}
    </div>
  );
}