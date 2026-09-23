export default function Pager({ currentPage, totalPages, onChange }) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);
  if (total <= 1) return null;

  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const show = pages.length > 7;
  let visible = pages;
  if (show) {
    const start = Math.max(1, Math.min(current - 3, total - 6));
    visible = pages.slice(start - 1, start + 6);
  }

  return (
    <div className="flex items-center gap-1.5 justify-center mt-5">
      <button
        type="button"
        className={`w-8 h-8 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${current <= 1 ? 'border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed' : 'border-[#E5E7EB] text-[#6B7280] hover:border-xevera-600 hover:text-xevera-600 bg-white'}`}
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current <= 1}
        aria-label="Previous page"
      >
        {'\u2190'}
      </button>
      {show && current > 4 && <span className="px-1 text-xs text-[#9CA3AF]">...</span>}
      {visible.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Page ${n}`}
          aria-current={n === current ? 'page' : undefined}
          className={`w-8 h-8 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${
            n === current
              ? 'bg-xevera-600 text-white border-xevera-600 shadow-sm'
              : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-xevera-600 hover:text-xevera-600'
          }`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      {show && current < total - 3 && <span className="px-1 text-xs text-[#9CA3AF]">...</span>}
      <button
        type="button"
        className={`w-8 h-8 rounded-lg border font-bold text-xs transition-colors cursor-pointer ${current >= total ? 'border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed' : 'border-[#E5E7EB] text-[#6B7280] hover:border-xevera-600 hover:text-xevera-600 bg-white'}`}
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current >= total}
        aria-label="Next page"
      >
        {'\u2192'}
      </button>
    </div>
  );
}