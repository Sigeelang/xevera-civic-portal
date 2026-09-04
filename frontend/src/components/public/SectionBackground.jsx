export default function SectionBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Base wash: white center, icy-blue edges */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_at_50%_20%,#FFFFFF_0%,#F8FAFF_55%,#EEF5FF_100%)]" />

      {/* Subtle glows for depth */}
      <div className="absolute top-[24%] left-[15%] w-[70%] h-24 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(220,234,255,0.5),rgba(220,234,255,0))]" />
      <div className="absolute bottom-[18%] left-[10%] w-[80%] h-24 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(220,234,255,0.4),rgba(220,234,255,0))]" />

      {/* Top-left: subtle blue orb + small dot grid */}
      <div className="absolute -top-24 -left-24 w-[320px] h-[320px] rounded-full bg-[radial-gradient(circle,rgba(191,214,255,0.4),rgba(191,214,255,0))]" style={{ filter: 'blur(10px)' }} />
      <svg className="absolute top-5 left-5 w-36 h-36" style={{ opacity: 0.4 }}>
        <defs>
          <pattern id="xlsbg-dot-tl" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.3" fill="#BFD6FF" opacity="0.35" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#xlsbg-dot-tl)" />
      </svg>

      {/* Top-right: thin concentric rings */}
      <div className="absolute top-6 right-6 w-40 h-40 rounded-full bg-[radial-gradient(circle,rgba(220,234,255,0.6),rgba(220,234,255,0))]" />
      <svg className="absolute top-10 right-10 w-56 h-56" viewBox="0 0 224 224" style={{ opacity: 0.4 }}>
        <circle cx="112" cy="112" r="88" fill="none" stroke="#BFD6FF" strokeWidth="1.4" opacity="0.4" />
        <circle cx="112" cy="112" r="62" fill="none" stroke="#DCEAFF" strokeWidth="1.2" opacity="0.5" />
        <circle cx="112" cy="112" r="36" fill="none" stroke="#BFD6FF" strokeWidth="1" opacity="0.3" />
      </svg>

      {/* Bottom-left: small dot grid */}
      <svg className="absolute bottom-4 left-4 w-32 h-32" style={{ opacity: 0.35 }}>
        <defs>
          <pattern id="xlsbg-dot-bl" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.3" fill="#BFD6FF" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#xlsbg-dot-bl)" />
      </svg>

      {/* Bottom-right: dot grid */}
      <svg className="absolute bottom-6 right-6 w-36 h-36" style={{ opacity: 0.3 }}>
        <defs>
          <pattern id="xlsbg-dot-br" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.4" fill="#BFD6FF" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#xlsbg-dot-br)" />
      </svg>

      {/* Small translucent circles */}
      <span className="absolute top-[30%] left-10 w-2 h-2 rounded-full bg-blue-500/30" />
      <span className="absolute top-[42%] right-12 w-1.5 h-1.5 rounded-full bg-blue-400/50" />
      <span className="absolute bottom-[30%] left-14 w-1.5 h-1.5 rounded-full bg-blue-400/45" />
      <span className="absolute top-[58%] right-10 w-2 h-2 rounded-full bg-blue-500/25" />
    </div>
  );
}