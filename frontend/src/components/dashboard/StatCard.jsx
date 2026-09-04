const TONES = {
  '#2563EB': { chip: 'bg-[#EAF1FF] text-[#2563EB]' },
  '#B45309': { chip: 'bg-[#FFF5DF] text-[#D97706]' },
  '#15803D': { chip: 'bg-[#EAF8EF] text-[#16A34A]' },
  '#7C3AED': { chip: 'bg-[#F2EBFF] text-[#7C3AED]' },
  '#DC2626': { chip: 'bg-[#FFF0F0] text-[#DC2626]' },
  '#0891B2': { chip: 'bg-[#E6F7FA] text-[#0891B2]' },
};

export default function StatCard({ label, value, color = 'text-[#15233b]', sub, icon, tone = '#2563EB' }) {
  const chip = TONES[tone]?.chip || 'bg-[#EAF1FF] text-[#2563EB]';
  return (
    <div className="bg-white rounded-[16px] border border-[#E7EBF2] shadow-[0_10px_30px_rgba(15,35,65,0.06)] px-5 py-[17px] relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,35,65,0.10)] animate-rise">
      <div className="flex items-center justify-between">
        <div className="text-[9px] uppercase tracking-[1px] text-[#8190a5] font-black">{label}</div>
        {icon && (
          <div className={`w-[31px] h-[31px] rounded-[9px] flex items-center justify-center flex-shrink-0 ${chip}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={icon} />
            </svg>
          </div>
        )}
      </div>
      <div className={`font-head text-[26px] font-black mt-3 tracking-[-0.5px] leading-none ${color}`}>{value ?? '—'}</div>
      {sub && <div className="text-[10px] text-[#718096] mt-1.5">{sub}</div>}
    </div>
  );
}
