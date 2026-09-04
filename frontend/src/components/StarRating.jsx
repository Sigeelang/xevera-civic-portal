export function Stars({ value = 0, size = 12 }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          className={i <= rounded ? 'text-amber-500' : 'text-[#D1D5DB]'}
          fill="currentColor" stroke="none" aria-hidden="true">
          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function StarRating({ value = 0, onChange, size = 22 }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rate this report">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value >= i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange && onChange(i)}
          className={`bg-none border-none p-0.5 cursor-pointer transition-transform hover:scale-110 ${i <= value ? 'text-amber-500' : 'text-[#D1D5DB] hover:text-amber-400'}`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
