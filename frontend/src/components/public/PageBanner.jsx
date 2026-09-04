const TONES = {
  blue: { badge: '#5AA2FF', btn: '#1769FF' },
  green: { badge: '#3DDC97', btn: '#16A765' },
  orange: { badge: '#FFA45C', btn: '#FF7A18' },
  purple: { badge: '#B49CFF', btn: '#7452E8' },
  teal: { badge: '#4FD8DE', btn: '#18A6AC' },
  red: { badge: '#FF7A85', btn: '#EF3340' },
  about: { badge: '#FF7A85', btn: '#EF3340' },
};

/* Unified full-bleed banner — 1600×360 style, consistent across all guest pages.
   compact: shrinks to match the top bar height (64px / 68px). */
export default function PageBanner({
  eyebrow,
  title,
  subtitle,
  tone = 'blue',
  ctas,
  onNavigate,
  illustration,
  compact = false,
}) {
  const t = TONES[tone] || TONES.blue;

  return (
    /* Full-bleed landscape banner — no card/border/frame */
    <section
      className={`relative left-1/2 -translate-x-1/2 w-screen overflow-hidden ${
        compact
          ? 'h-16 md:h-[68px]'
          : 'h-[220px] sm:h-[240px] md:h-[260px] lg:h-[280px]'
      }`}
    >
      {/* Plaza/fountain image — kept bright, positioned toward the right */}
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}images/xevera-hero.jpeg')`,
          backgroundPosition: '68% 45%',
        }}
      />

      {/* Strong navy gradient on the left, transparent on the right so the image stays bright */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,22,54,0.95) 0%, rgba(8,32,79,0.82) 30%, rgba(11,42,91,0.55) 50%, rgba(11,42,91,0.12) 70%, rgba(11,42,91,0) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-[2] w-full max-w-[1340px] mx-auto px-6 sm:px-10 h-full flex items-center">
        <div className={compact ? 'flex flex-wrap items-center gap-x-5 gap-y-1 w-full' : 'max-w-[540px]'}>
          {compact ? (
            <>
              {/* Inline: dot + title, subtitle to the right, small CTA */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.badge }} />
                <h1
                  className="
                    text-[17px]
                    sm:text-[20px]
                    font-head
                    font-extrabold
                    text-white
                    tracking-[-0.5px]
                    whitespace-nowrap
                    overflow-hidden
                    text-ellipsis
                  "
                  style={{ textShadow: '0 1px 6px rgba(5,22,54,0.6)' }}
                >
                  {title}
                </h1>
              </div>

              {subtitle && (
                <p className="hidden lg:block text-[13px] text-white/85 truncate max-w-[430px]" style={{ textShadow: '0 1px 6px rgba(5,22,54,0.6)' }}>
                  {subtitle}
                </p>
              )}

              {ctas && ctas.length > 0 && (
                <button
                  type="button"
                  onClick={ctas[0].onClick || (() => onNavigate && onNavigate(ctas[0].to))}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-1.5
                    rounded-[9px]
                    px-4
                    py-1.5
                    text-[12px]
                    font-bold
                    text-white
                    cursor-pointer
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    active:translate-y-0
                    ml-auto
                  "
                  style={{
                    background: t.btn,
                    boxShadow: `0 6px 14px ${t.btn}59`,
                  }}
                >
                  {ctas[0].label}
                </button>
              )}
            </>
          ) : (
            <>
          {/* Badge */}
          <span
            className="
              inline-flex
              items-center
              gap-2
              px-3.5
              py-1.5
              rounded-full
              border
              border-white/30
              bg-white/10
              backdrop-blur-md
              text-white
              text-[11px]
              font-extrabold
              uppercase
              tracking-[0.18em]
              mb-5
            "
            style={{ textShadow: '0 1px 3px rgba(5,22,54,0.6)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.badge }} />
            {eyebrow}
          </span>

          {/* Title */}
          <h1
            className="
              text-[clamp(34px,4.4vw,56px)]
              leading-[1.05]
              font-head
              font-extrabold
              text-white
              tracking-[-1.8px]
              mb-3
            "
            style={{ textShadow: '0 3px 16px rgba(5,22,54,0.6)' }}
          >
            {title}
          </h1>

          {/* Subtitle — short supporting line */}
          {subtitle && (
            <p
              className="
                text-[15px]
                sm:text-[16px]
                md:text-[18px]
                leading-[1.6]
                text-white/90
                max-w-[500px]
                mb-6
              "
              style={{ textShadow: '0 2px 8px rgba(5,22,54,0.6)' }}
            >
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          {ctas && ctas.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {ctas.map((cta, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={cta.onClick || (() => onNavigate && onNavigate(cta.to))}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-[14px]
                    px-7
                    h-[54px]
                    text-[15px]
                    font-bold
                    text-white
                    cursor-pointer
                    transition-all
                    duration-200
                    hover:-translate-y-0.5
                    active:translate-y-0
                  "
                  style={{
                    background: i === 0 ? t.btn : 'rgba(255,255,255,0.15)',
                    border: i === 0 ? '1px solid transparent' : '1px solid rgba(255,255,255,0.4)',
                    boxShadow: i === 0 ? `0 12px 26px ${t.btn}66` : 'none',
                  }}
                >
                  {cta.label}
                </button>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {/* Optional illustration on the right (kept for backwards compatibility) */}
        {illustration && (
          <div className="hidden lg:block absolute right-6 top-1/2 -translate-y-1/2 opacity-90 pointer-events-none">
            {illustration}
          </div>
        )}
      </div>
    </section>
  );
}