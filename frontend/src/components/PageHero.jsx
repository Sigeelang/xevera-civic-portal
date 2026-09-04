export default function PageHero({ eyebrow, title, description, children }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#FFFFFF_0%,#F2F7FF_45%,#D5E1F7_100%)] border border-[rgba(18,88,232,0.14)] shadow-[0_16px_40px_rgba(10,26,69,0.08)] px-6 sm:px-10 py-10 sm:py-12 mb-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(18,88,232,0.14),transparent_65%)]" />
        <div className="absolute right-12 bottom-0 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(18,88,232,0.10),transparent_65%)]" />
        <div className="absolute top-0 left-0 right-0 h-14 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, rgba(18,88,232,0.10) 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }} />
      </div>
      <div className="relative max-w-[680px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[rgba(18,88,232,0.18)] px-3 py-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-xevera-600" />
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-xevera-600">{eyebrow}</span>
        </span>
        <h1 className="text-[30px] sm:text-[38px] leading-[1.12] font-head font-extrabold text-navy-950">{title}</h1>
        {description && <p className="mt-3 text-[14px] sm:text-[15px] text-[#4B5876] max-w-[540px] leading-relaxed">{description}</p>}
        {children}
      </div>
    </section>
  );
}