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
        background: 'linear-gradient(90deg, rgba(5, 22, 54, 0.94) 0%, rgba(5, 22, 54, 0.78) 45%, rgba(5, 22, 54, 0.45) 100%)',
      };
    }
    if (overlay === 'light') {
      return {
        background: 'linear-gradient(90deg, rgba(5, 22, 54, 0.75) 0%, rgba(5, 22, 54, 0.45) 45%, rgba(5, 22, 54, 0.15) 75%, rgba(5, 22, 54, 0) 100%)',
      };
    }
    // Default: dark left for text, clear right for image
    return {
      background:
        'linear-gradient(90deg, rgba(5, 22, 54, 0.88) 0%, rgba(5, 22, 54, 0.68) 38%, rgba(5, 22, 54, 0.30) 65%, rgba(5, 22, 54, 0.05) 100%)',
    };
  };

  const getMobileOverlayStyle = () => {
    if (overlay === 'strong') {
      return {
        background: 'linear-gradient(90deg, rgba(5, 22, 54, 0.94) 0%, rgba(5, 22, 54, 0.78) 45%, rgba(5, 22, 54, 0.45) 100%)',
      };
    }
    if (overlay === 'light') {
      return {
        background: 'linear-gradient(90deg, rgba(5, 22, 54, 0.75) 0%, rgba(5, 22, 54, 0.45) 60%, rgba(5, 22, 54, 0.20) 100%)',
      };
    }
    return {
      background: 'linear-gradient(90deg, rgba(5, 22, 54, 0.88) 0%, rgba(5, 22, 54, 0.62) 45%, rgba(5, 22, 54, 0.30) 100%)',
    };
  };

  const desktopHeight = height.desktop || 360;
  const tabletHeight = height.tablet || 320;
  const mobileHeight = height.mobile || 240;

  const activeHeight =
    activeBreakpoint === 'desktop'
      ? desktopHeight
      : activeBreakpoint === 'tablet'
        ? tabletHeight
        : mobileHeight;

  const hasImage = Boolean(image);

  return (
    <section
      className={`relative w-full overflow-hidden ${className}`}
      style={
        hasImage
          ? {
              backgroundImage: `url(${image})`,
              backgroundSize: 'cover',
              backgroundPosition: '65% 45%',
              backgroundRepeat: 'no-repeat',
              minHeight: `${activeHeight}px`,
            }
          : {
              background: '#F5F7FB',
              minHeight: `${activeHeight}px`,
            }
      }
      aria-label={eyebrow}
    >
      {/* Desktop overlay - dark left for text, clear right for image */}
      {hasImage && (
        <div
          className="absolute inset-0 hidden md:block"
          style={getOverlayStyle()}
          aria-hidden="true"
        />
      )}
      {/* Mobile overlay - keeps building/fountain visible on phones */}
      {hasImage && (
        <div className="absolute inset-0 md:hidden" style={getMobileOverlayStyle()} aria-hidden="true" />
      )}

      {/* Content */}
      <div
        className={
          hasImage
            ? 'relative z-10 w-full max-w-[1460px] mx-auto px-5 md:px-9 h-full flex items-center'
            : 'relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-5 py-8 md:py-12'
        }
        style={hasImage ? { minHeight: `${activeHeight}px` } : undefined}
      >
        <div className="w-full max-w-[720px] flex flex-col justify-center">
          {(badgeIcon || badgeText) && (
            <div className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full self-start px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[10px] sm:text-xs font-bold tracking-[0.14em] sm:tracking-[0.16em] uppercase ${hasImage ? 'bg-white/95 backdrop-blur-sm text-xevera-600 shadow-[0_4px_12px_rgba(8,28,72,0.18)]' : 'bg-[#EDF4FF] text-[#1769FF]'}`}>
              {badgeIcon && <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${hasImage ? 'bg-xevera-600' : 'bg-[#1769FF]'}`} aria-hidden="true" />}
              {badgeText || eyebrow}
            </div>
          )}
          <h1 className={`font-extrabold leading-[1.1] mb-3 tracking-tight ${hasImage ? 'text-[28px] sm:text-[36px] md:text-[42px] lg:text-[56px] text-white' : 'text-[32px] sm:text-[36px] md:text-[40px] text-[#102957]'}`} style={hasImage ? { textShadow: '0 3px 16px rgba(5, 22, 54, 0.75)' } : undefined}>
            {title}
          </h1>
          {description && (
            <p className={`max-w-[600px] ${hasImage ? 'text-[14px] sm:text-[16px] md:text-[18px] lg:text-[20px] leading-relaxed text-white/90' : 'text-base md:text-[17px] leading-[1.6] text-[#526789]'}`} style={hasImage ? { textShadow: '0 2px 8px rgba(5, 22, 54, 0.70)' } : undefined}>
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}