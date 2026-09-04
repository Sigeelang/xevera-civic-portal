import { useState, useEffect } from 'react';

const QUERIES = [
  { key: 'desktop', mq: '(min-width: 1024px)' },
  { key: 'tablet', mq: '(min-width: 768px)' },
];

export default function ServiceBanner({
  eyebrow = 'Xevera Civic Portal',
  title = 'Service',
  description = '',
  image = '/images/xevera-hero.jpeg',
  badgeText = '',
  badgeIcon = null,
  ctas = [],
  className = '',
  height = { desktop: 360, tablet: 320, mobile: 240 },
  overlay = 'default',
  contentMaxWidth = 720,
}) {
  const [mounted, setMounted] = useState(false);
  const [activeBreakpoint, setActiveBreakpoint] = useState('mobile');

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * Watch viewport width so the responsive `height` prop
   * (mobile / tablet / desktop) is honored on every breakpoint.
   * Without this the inline `minHeight` would be locked to one
   * value and smaller screens would render the desktop height.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mqls = QUERIES.map((q) => ({ ...q, mql: window.matchMedia(q.mq) }));
    const evaluate = () => {
      const match = [...mqls].reverse().find((q) => q.mql.matches);
      setActiveBreakpoint(match ? match.key : 'mobile');
    };
    evaluate();
    mqls.forEach((q) => q.mql.addEventListener('change', evaluate));
    return () => mqls.forEach((q) => q.mql.removeEventListener('change', evaluate));
  }, []);

  const getOverlayStyle = () => {
    if (overlay === 'strong') {
      return {
        background: 'linear-gradient(90deg, rgba(5, 31, 72, 0.92), rgba(8, 43, 91, 0.65))',
      };
    }
    // Default: exact TrackReportPage desktop gradient
    return {
      background:
        'linear-gradient(90deg, rgba(5, 31, 72, 0.95) 0%, rgba(8, 43, 91, 0.84) 34%, rgba(8, 43, 91, 0.35) 65%, rgba(8, 43, 91, 0.05) 100%)',
    };
  };

  const getMobileOverlayStyle = () => ({
    background: 'linear-gradient(90deg, rgba(5, 31, 72, 0.95), rgba(8, 43, 91, 0.78))',
  });

  const desktopHeight = height.desktop || 360;
  const tabletHeight = height.tablet || 320;
  const mobileHeight = height.mobile || 240;

  const activeHeight =
    activeBreakpoint === 'desktop'
      ? desktopHeight
      : activeBreakpoint === 'tablet'
        ? tabletHeight
        : mobileHeight;

  return (
    <section
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: `${activeHeight}px`,
      }}
      aria-label={eyebrow}
    >
      {/* Desktop overlay - exact TrackReportPage gradient */}
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 31, 72, 0.95) 0%, rgba(8, 43, 91, 0.84) 34%, rgba(8, 43, 91, 0.35) 65%, rgba(8, 43, 91, 0.05) 100%)',
        }}
        aria-hidden="true"
      />
      {/* Mobile overlay - stronger, exact TrackReportPage */}
      <div className="absolute inset-0 md:hidden" style={{
        background: 'linear-gradient(90deg, rgba(5, 31, 72, 0.95), rgba(8, 43, 91, 0.78))',
      }} aria-hidden="true" />

      {/* Content */}
      <div
        className="relative z-10 w-full max-w-[1460px] mx-auto px-5 md:px-9 h-full flex items-center"
        style={{ minHeight: `${activeHeight}px` }}
      >
        <div className="w-full max-w-[720px] flex flex-col justify-center">
          {(badgeIcon || badgeText) && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/95 backdrop-blur-sm self-start px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-xs font-bold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-xevera-600 shadow-[0_4px_12px_rgba(8,28,72,0.18)]">
              {badgeIcon && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-xevera-600 flex-shrink-0" aria-hidden="true" />}
              {badgeText || eyebrow}
            </div>
          )}
          <h1 className="text-[42px] md:text-[56px] font-extrabold text-white leading-[1.1] mb-3 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[18px] md:text-[20px] text-white/90 max-w-[600px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}