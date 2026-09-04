export default function StaffPageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-xevera-600" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-xevera-600">{eyebrow}</span>
          </div>
        )}
        <h1 className="text-[26px] sm:text-[28px] font-head font-black text-[#15233b] leading-[1.1] tracking-[-0.8px]">{title}</h1>
        {description && <p className="text-[12px] text-[#718096] mt-2 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
