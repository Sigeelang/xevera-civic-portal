const TONES = {
  blue: {
    bg: 'linear-gradient(135deg, #EEF5FF, #DCEAFF)',
    badge: '#1769FF',
    btn: '#1769FF',
  },

  green: {
    bg: 'linear-gradient(135deg, #EEFCF8, #E8F8F2)',
    badge: '#16A765',
    btn: '#16A765',
  },

  orange: {
    bg: 'linear-gradient(135deg, #FFF8F1, #FFF0E5)',
    badge: '#FF7A18',
    btn: '#FF7A18',
  },

  purple: {
    bg: 'linear-gradient(135deg, #F8F5FF, #F0EDFF)',
    badge: '#7452E8',
    btn: '#7452E8',
  },

  about: {
    bg: 'linear-gradient(135deg, #FFF3F5, #FFEEF1)',
    badge: '#EF3340',
    btn: '#EF3340',
  },

  services: {
    bg: 'linear-gradient(135deg, #EFFBFC, #E8F7F8)',
    badge: '#18A6AC',
    btn: '#18A6AC',
  },
};

export default function GuestBanner({
  eyebrow,
  title,
  subtitle,
  icon,
  accent,
  ctas,
  illustration,
  tone = 'blue',
}) {
  const t = TONES[tone] || TONES.blue;

  return (
    <section
      className="
        relative
        overflow-hidden
        min-h-[250px]
        rounded-[24px]
        border
        border-[#CBDCF7]
        mb-0
      "
      style={{
        background: `
          radial-gradient(
            circle at 92% 20%,
            rgba(255,255,255,0.85),
            transparent 18%
          ),
          ${t.bg}
        `,
        boxShadow: '0 12px 35px rgba(28,65,120,0.08)',
      }}
    >
      {/* Decorative circle */}
      <div
        className="
          absolute
          w-[320px]
          h-[320px]
          rounded-full
          right-[-130px]
          top-[-180px]
          pointer-events-none
        "
        style={{
          background: 'rgba(255,255,255,0.25)',
        }}
      />

      {/* Content */}
      <div
        className="
          relative
          z-[2]
          w-full
          px-6
          sm:px-10
          lg:px-12
          py-8
          sm:py-10
          lg:py-12
        "
      >
        {/* Badge */}
        <span
          className="
            inline-flex
            items-center
            gap-1.5
            px-3
            py-1.5
            rounded-full
            bg-white
            border
            border-[#CBDCFF]
            text-[11px]
            font-extrabold
            uppercase
            tracking-[0.4px]
          "
          style={{
            color: t.badge,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: t.badge,
            }}
          />

          {eyebrow}
        </span>

        {/* Title */}
        <h1
          className="
            mt-3.5
            text-[28px]
            sm:text-[32px]
            lg:text-[36px]
            leading-[1.15]
            font-extrabold
            text-[#0D2858]
            tracking-[-1px]
            max-w-[650px]
          "
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="
              mt-2.5
              max-w-[650px]
              text-[15px]
              sm:text-[16px]
              leading-7
              text-[#536689]
            "
          >
            {subtitle}
          </p>
        )}

        {/* Buttons */}
        {ctas && ctas.length > 0 && (
          <div
            className="
              flex
              flex-col
              sm:flex-row
              flex-wrap
              gap-3
              mt-5
            "
          >
            {ctas.map((cta, i) => {
              const className = `
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-[12px]
                px-5
                py-3
                text-[13px]
                font-extrabold
                cursor-pointer
                transition-all
                duration-200
                hover:-translate-y-[2px]
                active:translate-y-0
                ${i === 0
                  ? 'text-white border border-transparent'
                  : 'bg-white border'}
              `;

              const style =
                i === 0
                  ? {
                      background: t.btn,
                      boxShadow: `0 8px 20px ${t.btn}38`,
                    }
                  : {
                      color: t.btn,
                      borderColor: '#BFD3F7',
                    };

              if (cta.href) {
                return (
                  <a
                    key={cta.label}
                    href={cta.href}
                    className={className}
                    style={style}
                  >
                    {cta.label}
                  </a>
                );
              }

              return (
                <button
                  key={cta.label}
                  type="button"
                  onClick={cta.onClick}
                  className={className}
                  style={style}
                >
                  {cta.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom subtle overlay */}
      <div
        className="
          absolute
          left-0
          right-0
          bottom-0
          h-16
          pointer-events-none
        "
        style={{
          background:
            'linear-gradient(to top, rgba(255,255,255,0.12), transparent)',
        }}
      />
    </section>
  );
}
