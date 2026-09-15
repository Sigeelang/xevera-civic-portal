import { useState, useEffect } from 'react';
function Countdown({ target, dark = false }) {
  const [parts, setParts] = useState(null);
  useEffect(() => {
    function tick() {
      const end = new Date(target);
      if (isNaN(end.getTime())) { setParts(null); return; }
      const diff = end.getTime() - Date.now();
      if (diff <= 0) { setParts({ d: 0, h: 0, m: 0, s: 0 }); return; }
      setParts({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!parts) return null;
  const numCls = dark ? 'text-white' : 'text-[#0B6B35]';
  const lblCls = dark ? 'text-[#7FB0F0]' : 'text-[#35B95F]';
  const sepCls = dark ? 'text-[#3C5C8C]' : 'text-[#8ED19A]';
  const cell = (v, l) => (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-extrabold tabular-nums ${numCls}`}>{String(v).padStart(2, '0')}</span>
      <span className={`text-[10px] uppercase tracking-widest ${lblCls}`}>{l}</span>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-4">
      {cell(parts.d, 'Days')}
      <span className={`text-xl font-bold ${sepCls}`}>:</span>
      {cell(parts.h, 'Hrs')}
      <span className={`text-xl font-bold ${sepCls}`}>:</span>
      {cell(parts.m, 'Min')}
      <span className={`text-xl font-bold ${sepCls}`}>:</span>
      {cell(parts.s, 'Sec')}
    </div>
  );
}

function Duration({ start, target }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startDate = start ? new Date(start) : null;
  const endDate = target ? new Date(target) : null;
  if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) return null;

  const totalMin = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const durationText = totalMin > 0
    ? [d > 0 ? `${d} ${d === 1 ? 'day' : 'days'}` : null, h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : null, m > 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : null].filter(Boolean).join(' ') || 'Unknown'
    : 'Unknown';

  const past = now >= endDate.getTime();
  const running = !past && now >= startDate.getTime();

  const fmtDateTime = (dt) => {
    const date = dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return { date, time };
  };
  const startFmt = fmtDateTime(startDate);
  const endFmt = fmtDateTime(endDate);

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white border border-[#CDEFD2] p-6 shadow-[0_10px_28px_rgba(53,185,95,0.12)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#E8F7EA] text-[#159447] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          </span>
          <h3 className="text-[14px] font-head font-extrabold text-[#0B6B35] text-left">Estimated Maintenance Duration</h3>
        </div>
        {past ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#35B95F] text-white text-[11px] font-bold">
            {'\u2713'} Maintenance Complete
          </span>
        ) : running ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7EA] border border-[#35B95F] text-[#159447] text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35B95F] animate-pulse" /> In Progress
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#35B95F] text-[#159447] text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35B95F]" /> Scheduled
          </span>
        )}
      </div>

      <div className="text-center py-2">
        <div className="text-[28px] leading-none font-head font-extrabold text-[#0B6B35] tabular-nums">{durationText}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#F4FBF5] border border-[#CDEFD2] p-3.5 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#159447] mb-1">Start</div>
          <div className="text-[14px] font-extrabold text-[#0B6B35]">{startFmt.date}</div>
          <div className="text-[12.5px] font-semibold text-[#4A6B4A]">{startFmt.time}</div>
        </div>
        <div className="rounded-xl bg-[#F4FBF5] border border-[#CDEFD2] p-3.5 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#159447] mb-1">Expected End</div>
          <div className="text-[14px] font-extrabold text-[#0B6B35]">{endFmt.date}</div>
          <div className="text-[12.5px] font-semibold text-[#4A6B4A]">{endFmt.time}</div>
        </div>
      </div>

      {past && (
        <div className="mt-4 rounded-xl bg-[#E8F7EA] border border-[#CDEFD2] px-4 py-3">
          <p className="text-[13px] font-bold text-[#0B6B35]">The portal should be available now. Please refresh the page.</p>
        </div>
      )}
    </div>
  );
}

function Illustration() {
  return (
    <div className="relative mb-9 w-full max-w-[420px] mx-auto rounded-[24px] bg-[#F4FBF5] border border-[#CDEFD2] p-6 sm:p-8 shadow-[0_20px_50px_rgba(53,185,95,0.14)]">
      <svg viewBox="0 0 320 200" className="w-full h-auto" role="img" aria-label="System maintenance illustration">
        {/* Monitor + dashboard */}
        <g>
          <rect x="30" y="40" width="120" height="78" rx="8" fill="#F4FBF5" stroke="#CDEFD2" strokeWidth="2" />
          <rect x="36" y="46" width="50" height="12" rx="3" fill="#E8F7EA" />
          <rect x="52" y="62" width="34" height="26" rx="4" fill="#35B95F" />
          <rect x="56" y="66" width="26" height="12" rx="2" fill="#FFFFFF" opacity="0.75" />
          <rect x="60" y="82" width="18" height="4" rx="2" fill="#8ED19A" />
          <line x1="52" y1="80" x2="100" y2="80" stroke="#CDEFD2" strokeWidth="2" strokeDasharray="3 3" />
          <rect x="106" y="62" width="30" height="26" rx="4" fill="#159447" opacity="0.9" />
          <line x1="116" y1="72" x2="130" y2="72" stroke="#E8F7EA" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="36" y="98" width="108" height="4" rx="2" fill="#CDEFD2" opacity="0.6" />
          <path d="M70 100 L80 92 L90 98 L100 88" fill="none" stroke="#35B95F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="132" y="68" width="12" height="10" rx="2" fill="#8ED19A" />
        </g>

        {/* Server racks */}
        <g>
          <rect x="170" y="58" width="60" height="84" rx="8" fill="#F4FBF5" stroke="#CDEFD2" strokeWidth="2" />
          <rect x="177" y="66" width="46" height="12" rx="3" fill="#159447" />
          <rect x="177" y="82" width="46" height="12" rx="3" fill="#35B95F" />
          <rect x="177" y="98" width="30" height="12" rx="3" fill="#8ED19A" />
          <circle cx="224" cy="72" r="2.5" fill="#CDEFD2" />
          <circle cx="224" cy="88" r="2.5" fill="#35B95F" />
          <circle cx="224" cy="104" r="2.5" fill="#35B95F" />
        </g>

        {/* Database cylinders */}
        <g>
          <ellipse cx="228" cy="130" rx="16" ry="6" fill="#E8F7EA" />
          <path d="M212 130 v-24 a16 6 0 0 1 32 0 v24" fill="#CDEFD2" />
          <ellipse cx="228" cy="130" rx="16" ry="6" fill="#35B95F" />
          <ellipse cx="228" cy="115" rx="16" ry="6" fill="#8ED19A" />
          <path d="M212 115 v6 a16 6 0 0 0 32 0 v-6" fill="#8ED19A" />
        </g>

        {/* Cloud */}
        <g>
          <path d="M250 92 a10 10 0 0 1 19-2 a12 12 0 0 1 2 22 h-26 a9 9 0 0 1 5-20 z" fill="#8ED19A" opacity="0.85" />
          <path d="M252 94 a8 8 0 0 1 15-1 a9 9 0 0 1 2 13 h-20 a7 7 0 0 1 3-12 z" fill="#F4FBF5" />
        </g>

        {/* Gears */}
        <g>
          <circle cx="272" cy="72" r="12" fill="none" stroke="#35B95F" strokeWidth="3" />
          {[0, 45, 90, 135].map(a => (
            <line key={a} x1="272" y1="56" x2="272" y2="52" stroke="#35B95F" strokeWidth="3"
              transform={`rotate(${a} 272 72)`} />
          ))}
          <circle cx="272" cy="72" r="4" fill="#159447" />
        </g>

        {/* Wrench */}
        <g transform="translate(24 24)">
          <path d="M-4 30 a9 9 0 0 1 6-8 l-2-2 a11 11 0 0 0-8 5 z" fill="#8ED19A" />
          <line x1="-8" y1="44" x2="4" y2="30" stroke="#8ED19A" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* Cone */}
        <g>
          <polygon points="286,140 298,140 292,158" fill="#35B95F" />
          <rect x="286" y="140" width="12" height="4" rx="2" fill="#FFFFFF" opacity="0.85" />
          <rect x="287" y="158" width="10" height="3" rx="1.5" fill="#0B6B35" />
        </g>

        {/* Floating tech icons */}
        <g>
          <circle cx="300" cy="52" r="3" fill="#8ED19A" />
          <rect x="312" y="60" width="10" height="6" rx="2" fill="#35B95F" transform={`rotate(-15 317 63)`} />
          <circle cx="196" cy="40" r="3" fill="#8ED19A" />
        </g>
      </svg>
    </div>
  );
}

export { Countdown, Duration, Illustration };