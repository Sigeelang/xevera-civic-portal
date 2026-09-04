/**
 * Shared page header for all Resident Portal pages.
 * Matches the prototype: blue uppercase kicker, large navy title (up to 38px),
 * muted description, optional right-side actions.
 * Bottom margin is intentionally omitted — the layout's content container
 * already spaces children consistently. Add `className` if a page needs extra spacing.
 */
export default function ResidentPageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <span className="inline-block text-[10px] font-bold tracking-[1.4px] uppercase text-xevera-600 mb-2">Resident Portal</span>
        <h1 className="text-[30px] sm:text-[34px] lg:text-[38px] font-head font-extrabold text-navy-950 leading-[1.1] tracking-[-1px]">{title}</h1>
        {subtitle && <p className="text-[15px] text-[#71829E] mt-2 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
      )}
    </div>
  );
}
