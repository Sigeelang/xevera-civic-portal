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
      {/* No dark overlay - image shows bright, text uses dark navy for readability */}
      {/* Content */}
      <div
        className="relative z-10 w-full max-w-[1460px] mx-auto px-5 md:px-9 h-full flex items-center"
        style={{ minHeight: `${activeHeight}px` }}
      >
        <div className="w-full max-w-[720px] flex flex-col justify-center">
          {(badgeIcon || badgeText) && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white backdrop-blur-sm self-start px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-xs font-bold tracking-[0.14em] sm:tracking-[0.16em] uppercase text-xevera-600 border border-[#D6E1EF] shadow-[0_4px_12px_rgba(8,28,72,0.12)]">
              {badgeIcon && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-xevera-600 flex-shrink-0" aria-hidden="true" />}
              {badgeText || eyebrow}
            </div>
          )}
          <h1 className="text-[28px] sm:text-[36px] md:text-[42px] lg:text-[56px] font-extrabold text-[#102957] leading-[1.1] mb-3 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] sm:text-[16px] md:text-[18px] lg:text-[20px] text-[#4B5876] max-w-[600px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}