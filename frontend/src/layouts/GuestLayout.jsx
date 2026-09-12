import { useState, useEffect, useLayoutEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import XeverAIChat from '../components/Assistant/XeverAIChat';
import SectionBackground from '../components/public/SectionBackground';

const NAV = [
  { key: 'home', label: 'Home', action: 'home' },
  { key: 'announcements', label: 'Announcements', action: 'announcements', icon: 'megaphone' },
  { key: 'how-it-works', label: 'How It Works', action: 'how-it-works', icon: 'doc' },
  { key: 'about', label: 'About Us', action: 'about', icon: 'users' },
];

const FOOTER_LINKS = [
  { key: 'home', label: 'Home', desc: 'Return to the landing page.', action: 'home' },
  { key: 'maintenance', label: 'Maintenance', desc: 'Scheduled and ongoing maintenance.', action: 'maintenance' },
  { key: 'announcements', label: 'Announcements', desc: 'Latest community updates.', action: 'announcements' },
  { key: 'how-it-works', label: 'How It Works', desc: 'Learn the reporting process.', action: 'how-it-works' },
  { key: 'about', label: 'About Us', desc: 'About the Xevera Civic Portal.', action: 'about' },
];

const RESOURCE_LINKS = [
  { key: 'faq', label: 'FAQs', desc: 'Common questions answered.', action: 'faq' },
  { key: 'guidelines', label: 'Reporting Guidelines', desc: 'Tips for writing a good report.', action: 'guidelines' },
  { key: 'privacy', label: 'Privacy Policy', desc: 'How we protect your data.', action: 'privacy' },
  { key: 'terms', label: 'Terms of Service', desc: 'Rules and conditions for using the portal.', action: 'terms' },
];

function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="url(#xlLogoGrad)" />
      <defs>
        <linearGradient id="xlLogoGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#2E6BF0" />
          <stop offset="100%" stopColor="#0B3AAB" />
        </linearGradient>
      </defs>
      <path d="M16 5C11 9 7 13 7 18c0 5 4 9 9 9 5 0 9-4 9-9 0-5-4-9-9-9Z" fill="#FFFFFF" opacity="0.35" />
      <path d="M16 9C13 12 11 15 11 18c0 3 2 5 5 5 3 0 5-2 5-5 0-3-2-6-5-9Z" fill="#FFFFFF" opacity="0.3" />
      <path d="M16 13c-1.5 0-2.5 1-2.5 3-.5 2 .5 2.5.5 2.5 2 0 2.5-1 2.5-2.5 0-1.5-.5-3-.5-3Z" fill="#FFFFFF" />
    </svg>
  );
}

export default function GuestLayout({ page, onNavigate, onAuth, onLogin, children }) {
  const { settings, siteName, maintenanceMode, maintenanceScheduledAt, maintenanceHeadline, maintenanceDescription } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(92);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const header = document.querySelector('header');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }
  }, [page]);

  const name = siteName || 'Xevera Civic Portal';
  const brandTop = 'XEVERA';
  const brandSub = 'CIVIC PORTAL';
  const contactEmail = settings?.contact_email || 'civicdesk@xevera.gov.ph';
  const contactPhone = settings?.contact_phone || '(02) 8123-4567';
  const contactAddress = settings?.barangay_address || 'Xevera, Calibutbut, Bacolor';
  const officeHours = settings?.office_hours || 'Monday – Friday · 8:00 AM – 5:00 PM';

  function handleNav(item) {
    setMobileOpen(false);
    onNavigate(item.action);
  }

  const isActive = (k) => {
    switch (k) {
      case 'home': return page === 'home';
      case 'reports': return page === 'reports';
      case 'track': return page === 'track';
      case 'maintenance': return false;
      case 'how-it-works': return page === 'how-it-works';
      case 'about': return page === 'about';
      case 'announcements': return page === 'announcements';
      case 'emergency': return page === 'emergency';
      default: return false;
    }
  };

  const openAuth = () => {
    setMobileOpen(false);
    if (onLogin) onLogin();
    else if (onAuth) onAuth('login');
  };

  const navButtonCls = (active) =>
    `inline-flex items-center px-3.5 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors bg-none border-none cursor-pointer ${
      active ? 'text-xevera-700 bg-xevera-50' : 'text-navy-950/80 hover:text-xevera-600 hover:bg-xevera-50'
    }`;

  const hasStickyBar = page !== 'home' && page !== 'submit';

  return (
      <div className="min-h-screen bg-page-bg flex flex-col overflow-x-clip w-full max-w-[100vw]">
      {/* ===== Maintenance Banner ===== */}
      {maintenanceMode && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{maintenanceHeadline || 'System maintenance is in progress.'}</span>
          <button onClick={() => onNavigate('maintenance')} className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold border-none cursor-pointer transition-colors">
            View Details
          </button>
        </div>
      )}

      {/* ===== Header ===== */}
      <header
        className={`fixed inset-x-0 z-50 transition-all duration-300 ${
          maintenanceMode ? 'top-[42px]' : 'top-0'
        } ${
          scrolled ? 'bg-white shadow-[0_4px_20px_rgba(10,26,69,0.07)]' : 'bg-white'
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-[78px] flex items-center justify-between">
          <button
            onClick={() => { setMobileOpen(false); onNavigate('home'); }}
            className="flex items-center gap-2.5 bg-none border-none cursor-pointer flex-shrink-0"
          >
            <Logo size={34} />
            <div className="text-left leading-none">
              <div className="font-head font-extrabold text-[16px] tracking-[0.08em] text-navy-950">{brandTop}</div>
              <div className="text-[9px] font-bold tracking-[0.28em] uppercase text-xevera-600 mt-[3px]">{brandSub}</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1 mx-4" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors bg-none border border-transparent cursor-pointer ${
                    active
                      ? 'text-[#1264f5] bg-[#EBF2FF]'
                      : 'text-[#10284d]/80 hover:text-[#1264f5] hover:bg-[#EBF2FF]'
                  }`}
                >
                  {item.icon === 'megaphone' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                  )}
                  {item.icon === 'doc' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  )}
                  {item.icon === 'users' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  )}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Emergency button — standalone red */}
            <button
              onClick={() => handleNav({ action: 'emergency' })}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors bg-[#DC2626] text-white border-none cursor-pointer hover:bg-[#B91C1C] shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 21h16L12 3Z"/><path d="M12 9v5M12 17.5v.01"/></svg>
              Emergency
            </button>
            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex items-center justify-center w-11 h-11 rounded-full bg-[#1264f5] text-white cursor-pointer"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-[#E5E7EB] px-4 py-3 shadow-lg max-h-[70vh] overflow-y-auto">
            <nav className="flex flex-col gap-0.5" aria-label="Mobile">
              {NAV.map((item) => {
                const active = isActive(item.key);
                return (
                  <button
                    key={item.key}
                    onClick={() => handleNav(item)}
                    className={`text-left px-4 py-2.5 rounded-xl text-sm font-semibold bg-none border border-transparent cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'text-[#1264f5] bg-[#EBF2FF]'
                        : 'text-[#10284d]/80 hover:bg-[#EBF2FF] hover:text-[#1264f5]'
                    }`}
                  >
                    {item.icon === 'megaphone' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                    )}
                    {item.icon === 'doc' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>
                    )}
                    {item.icon === 'users' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    )}
                    {item.label}
                  </button>
                );
              })}
              {/* Emergency button — mobile */}
              <button
                onClick={() => handleNav({ action: 'emergency' })}
                className="text-left px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#DC2626] text-white border border-[#DC2626] cursor-pointer flex items-center gap-2 mt-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 21h16L12 3Z"/><path d="M12 9v5M12 17.5v.01"/></svg>
                Emergency
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ===== Content ===== */}
      <main className="flex-1 relative">
        <SectionBackground />
        <div className="relative z-10" style={{ paddingTop: headerHeight }}>
          {page === 'home'
            ? <div>{children}</div>
            : <div className="pb-20 md:pb-16 lg:pb-24">{children}</div>}
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="mt-10 bg-navy-footer bg-[linear-gradient(180deg,#001B45_0%,#001338_100%)] text-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-10 lg:pb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 lg:gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Logo size={32} />
              <div className="leading-none">
                <div className="font-head font-extrabold text-[15px] tracking-[0.08em] text-white">{brandTop}</div>
                <div className="text-[8.5px] font-bold tracking-[0.28em] uppercase text-xevera-400 mt-[3px]">{brandSub}</div>
              </div>
            </div>
            <p className="text-[13.5px] text-white/70 leading-relaxed max-w-[280px]">
              Together, let&rsquo;s build a safer, cleaner, and better Xevera.
            </p>
            <div className="flex items-center gap-2.5 mt-5">
              <a href="https://www.facebook.com/xhoabacolor/?rdid=eIIOMAtjv6Z4ChOj&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F18uCmZVH2Y" target="_blank" rel="noreferrer" aria-label="Facebook page"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-xevera-600 hover:text-white hover:border-xevera-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href={'mailto:' + contactEmail} aria-label="Email us"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-xevera-600 hover:text-white hover:border-xevera-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              </a>
              <a href={'tel:' + contactPhone.replace(/[^+\d]/g, '')} aria-label="Call us"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-xevera-600 hover:text-white hover:border-xevera-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
              </a>
              <a href={'mailto:' + contactEmail} aria-label="Message us"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:bg-xevera-600 hover:text-white hover:border-xevera-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-[13px] font-bold mb-4 text-white/95 uppercase tracking-widest">Quick Links</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((l) => {
                const isActive = page === l.key;
                return (
                  <li key={l.key}>
                    <button
                      onClick={() => handleNav(l)}
                      className={`w-full text-left text-[13px] sm:text-sm font-semibold py-2 px-2.5 rounded-md bg-transparent border-0 cursor-pointer transition-colors ${
                        isActive ? 'text-white bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {l.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-bold mb-4 text-white/95 uppercase tracking-widest">Resources</h4>
            <ul className="space-y-2">
              {RESOURCE_LINKS.map((l) => {
                const isActive = page === l.key;
                return (
                  <li key={l.key}>
                    <button
                      onClick={() => handleNav(l)}
                      className={`w-full text-left text-[13px] sm:text-sm font-semibold py-2 px-2.5 rounded-md bg-transparent border-0 cursor-pointer transition-colors ${
                        isActive ? 'text-white bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {l.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-bold mb-4 text-white/95 uppercase tracking-widest">Contact Us</h4>
            <ul className="space-y-3 text-[13.5px] text-white/70">
              <li className="flex items-start gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-xevera-400"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                <span>{contactAddress}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-xevera-400"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                <span>{contactEmail}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-xevera-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
                <span>{contactPhone}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0 text-xevera-400"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <span>{officeHours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/70">&copy; {new Date().getFullYear()} {name}. All rights reserved.</p>
            <p className="text-xs text-white/70">Serving the Xevera community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}