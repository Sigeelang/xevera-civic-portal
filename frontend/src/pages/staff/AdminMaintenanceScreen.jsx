import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Countdown } from '../../components/MaintenanceVisuals';

/*
 * Full-screen Maintenance page — dark navy "We'll be right back!" design.
 * Matches the Super Admin "Maintenance Page Preview" card exactly.
 * Used for the public / resident maintenance view.
 *
 * Real data sources preserved:
 *   - maintenanceHeadline / Description / Footer (admin-editable settings)
 *   - maintenanceScheduledAt / maintenanceReturn (scheduled window + countdown)
 *   - system_version (settings)
 * Refresh performs a full reload so the live maintenance status is re-checked.
 */

function ShieldMark() {
  return (
    <div className="w-[30px] h-[35px] border-[3px] border-[#4E93F5] relative"
      style={{ clipPath: 'polygon(50% 0%, 91% 15%, 87% 63%, 50% 100%, 13% 63%, 9% 15%)' }}>
      <span className="absolute inset-x-[6px] top-[9px] h-[3px] bg-[#4E93F5]" />
      <span className="absolute inset-x-[10px] top-[15px] h-[3px] bg-[#4E93F5]" />
    </div>
  );
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function AdminMaintenanceScreen({ siteName, onReturnToLogin, onEnterAnyway, title, subtitle, eyebrow }) {
  const { settings, maintenanceHeadline, maintenanceDescription, maintenanceFooter, maintenanceReturn, maintenanceScheduledAt } = useSettings();

  const [checking, setChecking] = useState(false);
  const name = siteName || 'Xevera Portal';
  const version = settings?.system_version || 'v2.4.1';
  const headline = title || maintenanceHeadline || "We'll be right back!";
  const description = subtitle || maintenanceDescription || `${name} is currently undergoing scheduled maintenance.`;
  const countdownTarget = maintenanceReturn || maintenanceScheduledAt;

  const startStr = fmtDateTime(maintenanceScheduledAt);
  const endStr = fmtDateTime(maintenanceReturn);
  const range = startStr ? `${startStr}${endStr ? ' – ' + endStr : ''}` : '';

  /* Real behaviour: full reload re-checks the live maintenance flag. */
  function refreshPage() {
    setChecking(true);
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-5 py-14 text-center"
      style={{ background: 'linear-gradient(165deg,#061D45 0%,#04122B 100%)' }}>

      {/* Brand */}
      <div className="flex items-center gap-3 mb-10">
        <ShieldMark />
        <div className="text-left">
          <div className="text-white text-[18px] font-extrabold leading-tight">{name}</div>
          <div className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#6E9BE0] mt-[3px]">
            {eyebrow || 'Xevera Portal'}
          </div>
        </div>
      </div>

      {/* Icon + headline */}
      <div className="text-[46px] leading-none mb-5">⚙</div>
      <h1 className="text-white font-extrabold text-[clamp(28px,5vw,44px)] leading-[1.15] max-w-[760px] m-0">
        {headline}
      </h1>

      {/* Messages */}
      <p className="text-[#C8D5E8] text-[15px] leading-relaxed mt-4 max-w-[560px] m-0">
        {description}
      </p>
      <p className="text-[#9FB4D4] text-[14px] leading-relaxed mt-2 max-w-[560px] m-0">
        We're working hard to improve your experience. Please check back soon.
      </p>

      {/* Scheduled window */}
      {range && (
        <div className="w-full max-w-[420px] bg-white text-[#26384F] rounded-[12px] p-4 mt-8 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#64758B]">◷ Scheduled Time</div>
          <div className="text-[15px] font-extrabold mt-1">{range}</div>
        </div>
      )}

      {/* Countdown */}
      {countdownTarget && (
        <div className="mt-6 w-full max-w-[420px] rounded-[12px] bg-white/[0.04] border border-white/10 p-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-[#7FB0F0] mb-3">Estimated Return</div>
          <Countdown target={countdownTarget} dark />
        </div>
      )}

      {/* Refresh */}
      <button onClick={refreshPage} disabled={checking}
        className="mt-8 h-[52px] px-8 rounded-[12px] border-0 bg-white text-[#061D45] text-[15px] font-extrabold cursor-pointer shadow-[0_14px_30px_rgba(0,0,0,0.30)] hover:bg-[#EAF2FF] transition-colors disabled:opacity-80">
        <span className={`inline-block mr-2 align-[-1px] ${checking ? 'animate-spin' : ''}`}>↻</span>
        {checking ? 'Checking...' : 'Refresh'}
      </button>

      {/* Secondary actions */}
      {onEnterAnyway && (
        <button onClick={onEnterAnyway}
          className="mt-5 text-[12px] font-semibold text-[#7FB0F0] hover:text-white bg-none border-none cursor-pointer transition-colors">
          → Enter Dashboard Anyway
        </button>
      )}
      {onReturnToLogin && !onEnterAnyway && (
        <button onClick={onReturnToLogin}
          className="mt-5 text-[12px] font-semibold text-[#7FB0F0] hover:text-white bg-none border-none cursor-pointer hover:underline">
          ← Return to Login
        </button>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center">
        <div className="text-[#9FB4D4] text-[14px] mb-4">
          {maintenanceFooter || 'Thank you for your patience and understanding.'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-[#8CA9CB]">
          <span>&copy; {new Date().getFullYear()} {name}</span>
          <span className="py-1.5 px-3 bg-white/[0.05] border border-white/10 rounded-[8px] text-[#9FB4D4] font-semibold">
            System Version&nbsp; {version}
          </span>
          <span>Contact Administrator</span>
        </div>
      </footer>
    </div>
  );
}
