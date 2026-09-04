export function SkeletonRows({ rows = 3, height = 'h-12' }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} bg-[#F1F5F9] rounded-xl animate-pulse`} />
      ))}
    </div>
  );
}
