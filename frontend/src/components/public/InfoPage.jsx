import GuestHero from './GuestHero';

export default function InfoPage({ eyebrow, title, icon, subtitle, accent = '#1258E8', sections, illustration, ctas, fullWidth }) {
  const hasHeroContent = title || eyebrow || icon || subtitle || illustration || ctas;

  return (
    <div className={`px-5 sm:px-8 ${fullWidth ? '' : 'mx-auto'} ${illustration ? 'max-w-[1200px]' : fullWidth ? '' : 'max-w-4xl'}`}>
      {hasHeroContent && (
        <GuestHero
          eyebrow={eyebrow}
          title={title}
          icon={icon}
          subtitle={subtitle}
          accent={accent}
          ctas={ctas}
          illustration={illustration}
        />
      )}
      <div className="space-y-5">
        {sections.map(s => (
          <section key={s.title} className="bg-white rounded-[22px] border border-[#E5E7EB] p-6 shadow-[0_8px_24px_rgba(16,24,40,0.05)]">
            <h2 className="text-[17px] font-extrabold text-[#0B1220] flex items-center gap-2.5">
              {s.icon && <span>{s.icon}</span>}{s.title}
            </h2>
            {s.desc && <p className="text-[14px] text-[#64748B] mt-1.5 leading-relaxed">{s.desc}</p>}

            {s.items && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.items.map(it => (
                  <div key={it.label} className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4">
                    <span className="text-xl leading-none">{it.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#111827]">{it.label}</div>
                      {it.value && <div className="text-[13px] font-semibold text-xevera-600">{it.value}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {s.steps && s.steps.length > 0 && (
              <ol className="mt-4 space-y-3">
                {s.steps.map((st, i) => (
                  <li key={i} className="flex items-start gap-3.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: accent }}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#111827]">{st.title}</div>
                      {st.desc && <div className="text-[13px] text-[#64748B] mt-0.5 leading-relaxed">{st.desc}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {s.cta && (
              <button onClick={s.cta.onClick}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold cursor-pointer bg-none border-none transition-colors hover:opacity-80"
                style={{ color: accent }}>
                {s.cta.text}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}