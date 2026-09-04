import Icon from '../Icon';

export default function CtaBanner({ title, subtitle, primary, secondary }) {
  return (
    <section className="bg-[linear-gradient(120deg,#002068_0%,#002A7F_55%,#00309D_100%)]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12 flex flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-head font-extrabold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-white/80 mt-1.5 max-w-[520px]">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {primary && (
            <button
              onClick={primary.onClick}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white text-[#0B3AAB] font-bold text-sm shadow-[0_10px_24px_rgba(0,0,0,0.20)] hover:bg-xevera-50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              {primary.icon && <Icon name={primary.icon} size={15} strokeWidth={2.2} />}
              {primary.label}
            </button>
          )}
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/40 text-white font-bold text-sm hover:bg-white/10 transition-colors cursor-pointer"
            >
              {secondary.icon && <Icon name={secondary.icon} size={15} strokeWidth={2.2} />}
              {secondary.label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}