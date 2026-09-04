export default function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-xevera-600">
        <span className="w-1.5 h-1.5 rounded-full bg-xevera-600" />
        {eyebrow}
      </span>
      <h2 className="text-[26px] md:text-[32px] font-head font-extrabold text-navy-950 mt-2">{title}</h2>
      {subtitle && <p className="text-sm text-[#64748B] mt-2">{subtitle}</p>}
    </div>
  );
}