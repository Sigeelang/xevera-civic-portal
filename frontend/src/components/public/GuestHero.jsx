export default function GuestHero({ eyebrow, title, subtitle, icon, accent = '#1258E8', ctas, illustration }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[20px] border border-[rgba(18,88,232,0.12)] bg-[linear-gradient(135deg,#EAF0FA_0%,#DDE8F8_50%,#C9DAF2_100%)] shadow-[0_12px_30px_rgba(10,26,69,0.08)] px-4 sm:px-6 lg:px-8 py-10 md:py-12 lg:py-14 mb-10 ${illustration ? 'lg:px-12' : ''}`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(18,88,232,0.14),transparent_65%)]" />
        <div className="absolute -bottom-16 -left-10 w-52 h-52 rounded-full bg-[radial-gradient(circle,rgba(18,88,232,0.10),transparent_65%)]" />
        {!illustration && (
          <div className="absolute top-8 right-12 hidden lg:block opacity-50">
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 20 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-xevera-600/40" />)}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`relative z-10 animate-[rise_450ms_ease_both] motion-reduce:animate-none ${
            illustration
              ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-8 lg:gap-12 items-center'
              : ''
          }`}
        >
          <div className={illustration ? 'text-center lg:text-left max-w-2xl' : 'max-w-2xl'}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[rgba(18,88,232,0.18)] px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase" style={{ color: accent }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {eyebrow}
            </span>

            <h1 className={`font-head font-extrabold text-navy-950 mt-3 flex items-center gap-3 ${illustration ? 'text-[28px] sm:text-[32px] leading-[1.12] justify-center lg:justify-start' : 'text-[28px] sm:text-[34px] leading-[1.1]'}`}>
              {icon && <span>{icon}</span>}
              <span>{title}</span>
            </h1>

            {subtitle && <p className={`mt-2 text-sm sm:text-[15px] text-[#4B5876] leading-relaxed ${illustration ? 'mx-auto lg:mx-0 max-w-xl' : 'max-w-xl'}`}>{subtitle}</p>}

            {ctas && ctas.length > 0 && (
              <div className={`mt-6 flex flex-wrap gap-3 ${illustration ? 'justify-center lg:justify-start' : ''}`}>
                {ctas.map((cta, i) =>
                  cta.onClick ? (
                    <button
                      key={i}
                      onClick={cta.onClick}
                      className={
                        i === 0
                          ? 'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-xevera-600 text-white font-bold text-sm shadow-[0_10px_30px_rgba(18,88,232,0.30)] hover:bg-xevera-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer'
                          : 'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-xevera-600 font-bold text-sm border border-[rgba(18,88,232,0.22)] hover:bg-xevera-50 transition-colors cursor-pointer'
                      }
                    >
                      {cta.label}
                    </button>
                  ) : (
                    <a
                      key={i}
                      href={cta.href}
                      className={
                        i === 0
                          ? 'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-xevera-600 text-white font-bold text-sm shadow-[0_10px_30px_rgba(18,88,232,0.30)] hover:bg-xevera-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer'
                          : 'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-xevera-600 font-bold text-sm border border-[rgba(18,88,232,0.22)] hover:bg-xevera-50 transition-colors cursor-pointer'
                      }
                    >
                      {cta.label}
                    </a>
                  )
                )}
              </div>
            )}
          </div>

          {illustration && (
            <div className="relative animate-[rise_550ms_120ms_ease_both] motion-reduce:animate-none">
              <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
                <div className="absolute top-4 -right-4 w-24 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.65),transparent_70%)]" />
              </div>
              <div className="relative -mb-6">{illustration}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}