import { SERVICES } from '../../data/services';

export default function ServicesGrid({ onNavigate }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {SERVICES.map(s => (
        <button key={s.title} onClick={() => onNavigate && onNavigate(s.action)}
          className="group text-left bg-white rounded-[22px] border border-[#E5E7EB] p-6 shadow-[0_8px_24px_rgba(16,24,40,0.05)] hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(16,24,40,0.12)] transition-all duration-300 cursor-pointer">
          <div className={`w-[52px] h-[52px] rounded-2xl bg-gradient-to-br ${s.grad} text-white flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            {s.icon}
          </div>
          <h3 className="text-[16px] font-extrabold text-[#0B1220] mt-4">{s.title}</h3>
          <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">{s.desc}</p>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-xevera-600 mt-3">
            Open service
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </span>
        </button>
      ))}
    </div>
  );
}