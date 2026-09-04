export default function ModeSwitcher({ mode, onChange }) {
  return (
    <div className="sticky top-0 z-100 flex justify-center bg-bg px-0 py-2 border-b border-[#21262d]">
      <div className="flex bg-[#21262d] rounded-full p-0.5">
        <button
          data-mode="public"
          className={`border-none bg-transparent px-6 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase transition-colors ${mode === 'public' ? 'bg-[#0d1117] text-[#00c853] shadow-xs' : 'text-[#8b949e]'}`}
          onClick={() => onChange('public')}
        >
          Residents
        </button>
        <button
          data-mode="staff"
          className={`border-none bg-transparent px-6 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase transition-colors ${mode === 'staff' ? 'bg-[#0d1117] text-[#58a6ff] shadow-xs' : 'text-[#8b949e]'}`}
          onClick={() => onChange('staff')}
        >
          Staff / Admin
        </button>
      </div>
    </div>
  );
}
