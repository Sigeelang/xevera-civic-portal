import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Countdown, Duration } from '../../components/MaintenanceVisuals';

/*
 * Full-screen Maintenance page — blue "We'll Be Back Soon!" design.
 * Used for BOTH the public/resident maintenance view and the
 * Super Admin dashboard preview (via onEnterAnyway).
 *
 * Real data sources preserved:
 *   - maintenanceHeadline / Description / Footer (admin-editable settings)
 *   - maintenanceScheduledAt / Return (countdown + duration)
 *   - system_version (settings)
 * Refresh performs a full reload so the live maintenance status is re-checked.
 */

function ShieldMark() {
  return (
    <div className="w-[34px] h-[40px] border-[3px] border-xevera-600 relative"
      style={{ clipPath: 'polygon(50% 0%, 91% 15%, 87% 63%, 50% 100%, 13% 63%, 9% 15%)' }}>
      <span className="absolute inset-x-[7px] top-[10px] h-[3px] bg-xevera-600" />
      <span className="absolute inset-x-[11px] top-[17px] h-[3px] bg-xevera-600" />
    </div>
  );
}

/* ---------- CSS-art illustration pieces ---------- */

function WebWindow() {
  return (
    <div className="absolute w-[230px] h-[180px] left-[95px] top-[80px] bg-white border-2 border-[#CFE1FA] rounded-[13px] shadow-[0_16px_30px_rgba(53,121,211,0.10)]">
      <div className="h-[30px] rounded-t-[11px] flex items-center gap-[6px] pl-3"
        style={{ background: 'linear-gradient(90deg,#2785F6,#4A9CFF)' }}>
        {[0, 1, 2].map((i) => <span key={i} className="w-[6px] h-[6px] bg-white/90 rounded-full" />)}
      </div>
      <div className="p-[17px]">
        <div className="w-[150px] h-[10px] rounded-full bg-[#E8F1FC] mb-[14px]" />
        <div className="w-[95px] h-[10px] rounded-full bg-[#E8F1FC] mb-[14px]" />
        <div className="relative mt-5">
          <div className="w-[67px] h-[47px] border-4 border-xevera-600 rounded-[6px] relative">
            <span className="absolute w-[20px] h-[4px] bg-xevera-600 bottom-[-10px] left-[19px]" />
            <span className="absolute w-[35px] h-[3px] bg-xevera-600 left-[12px] bottom-[-17px]" />
          </div>
          <div className="absolute w-9 h-6 right-[22px] bottom-[24px]"
            style={{
              borderLeft: '3px solid #4E9BF9',
              borderBottom: '3px solid #4E9BF9',
              transform: 'skewY(-20deg)',
            }} />
        </div>
      </div>
    </div>
  );
}

function Toolbox() {
  return (
    <div className="absolute w-[70px] h-[55px] left-[220px] top-[160px] rounded-[9px] shadow-[0_10px_20px_rgba(20,113,222,0.20)]"
      style={{ background: 'linear-gradient(145deg,#398FF7,#1472DF)' }}>
      <span className="absolute w-[27px] h-[12px] left-[21px] top-[-8px] border-4 border-[#1472DF] border-b-0 rounded-t-[7px]" />
      <span className="absolute w-[25px] h-[25px] left-[22px] top-[16px] border-4 border-white rounded-full" />
      <span className="absolute w-[19px] h-[5px] bg-white rotate-[-45deg] top-[32px] left-[37px] rounded-[5px]" />
    </div>
  );
}

function Document() {
  return (
    <div className="absolute w-[135px] h-[190px] right-[115px] top-[88px] bg-white border-2 border-[#D1E3FA] rounded-[12px] shadow-[0_15px_30px_rgba(50,115,202,0.08)] p-5">
      <div className="h-[9px] rounded-full bg-[#DCEAFD] mb-[14px]" />
      <div className="h-[9px] rounded-full bg-[#4B98F8] mb-[14px]" />
      <div className="h-[9px] rounded-full bg-[#DCEAFD] mb-[14px]" />
      <div className="h-[9px] w-[65%] rounded-full bg-[#DCEAFD] mb-[14px]" />
      <div className="h-[9px] rounded-full bg-[#DCEAFD] mb-[14px]" />
      <div className="h-[9px] w-[65%] rounded-full bg-[#DCEAFD]" />
    </div>
  );
}

function Gear() {
  return (
    <div className="absolute right-[88px] top-[65px] w-[62px] h-[62px] rounded-full bg-xevera-600 shadow-[0_8px_20px_rgba(20,120,242,0.2)]">
      <span className="absolute w-[26px] h-[26px] bg-white rounded-full left-[18px] top-[18px]" />
      <span className="absolute text-xevera-600 text-[25px] left-[18px] top-[8px]">✦</span>
    </div>
  );
}

function Clock() {
  return (
    <div className="absolute right-[65px] top-[145px] w-[55px] h-[55px] border-4 border-[#398DF3] rounded-full bg-white">
      <span className="absolute w-[3px] h-[18px] bg-[#398DF3] left-[23px] top-[8px]" />
      <span className="absolute w-[15px] h-[3px] bg-[#398DF3] left-[23px] top-[25px] origin-left rotate-[20deg]" />
    </div>
  );
}

function Database() {
  const cyl = 'absolute w-[72px] h-[25px] rounded-[50%]';
  const grad = { background: 'linear-gradient(180deg,#58A5FB,#1478E9)' };
  return (
    <div className="absolute right-[100px] bottom-[78px] w-[72px] h-[70px]">
      <div className={`${cyl} top-0 z-[3]`} style={grad} />
      <div className={`${cyl} top-[17px]`} style={grad} />
      <div className={`${cyl} top-[34px]`} style={grad} />
    </div>
  );
}

function Cloud() {
  return (
    <div className="absolute right-[165px] bottom-[72px] w-[72px] h-[35px] bg-[#EEF6FF] border-[3px] border-[#9EC8FB] rounded-[30px]">
      <span className="absolute w-[35px] h-[35px] bg-[#EEF6FF] border-[3px] border-[#9EC8FB] rounded-full left-[10px] top-[-22px]" />
      <span className="absolute w-[28px] h-[28px] bg-[#EEF6FF] border-[3px] border-[#9EC8FB] rounded-full right-[8px] top-[-15px]" />
    </div>
  );
}

function Cone() {
  return (
    <div className="absolute right-[40px] bottom-[50px] w-[45px] h-[60px]"
      style={{
        background: 'linear-gradient(135deg,#4A9CF8,#116FE3)',
        clipPath: 'polygon(50% 0, 65% 8%, 92% 82%, 8% 82%, 35% 8%)',
      }}>
      <span className="absolute w-[55px] h-[8px] left-[-5px] bottom-0 bg-[#126FE2] rounded-[4px]" />
    </div>
  );
}

export default function AdminMaintenanceScreen({ siteName, onReturnToLogin, onEnterAnyway, title, subtitle, eyebrow }) {
  const { settings, maintenanceHeadline, maintenanceDescription, maintenanceFooter, maintenanceReturn, maintenanceScheduledAt } = useSettings();

  const [checking, setChecking] = useState(false);
  const name = siteName || 'Xevera Portal';
  const version = settings?.system_version || 'v2.4.1';
  const headline = title || maintenanceHeadline;
  const description = subtitle || maintenanceDescription;
  const countdownTarget = maintenanceReturn || maintenanceScheduledAt;

  /* Real behaviour: full reload re-checks the live maintenance flag. */
  function refreshPage() {
    setChecking(true);
    setTimeout(() => window.location.reload(), 700);
  }

  function splitHeadline(text) {
    /* Highlight everything after the last word pair break in blue,
       mirroring the "We'll Be <blue>Back Soon!</blue>" reference. */
    const words = String(text).split(' ');
    if (words.length < 3) return { main: text, accent: '' };
    const main = words.slice(0, words.length - 2).join(' ');
    const accent = words.slice(-2).join(' ');
    return { main, accent };
  }

  const rawHeadline = headline || "We'll Be Back Soon!";
  const { main, accent } = splitHeadline(rawHeadline);

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans text-[#173764]"
      style={{
        background:
          'radial-gradient(circle at 8% 5%, rgba(78,145,245,0.13) 0, rgba(78,145,245,0.13) 115px, transparent 116px),' +
          'radial-gradient(circle at 94% 7%, rgba(78,145,245,0.12) 0, rgba(78,145,245,0.12) 120px, transparent 121px),' +
          'linear-gradient(135deg,#FFFFFF 0%,#F8FBFF 45%,#EDF5FF 100%)',
      }}>

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute w-[300px] h-[300px] -top-[170px] -left-[80px] rounded-full bg-[rgba(58,133,241,0.08)] blur-[1px]" />
        <div className="absolute w-[280px] h-[280px] -top-[150px] -right-[80px] rounded-full bg-[rgba(58,133,241,0.08)] blur-[1px]" />
        <div className="absolute w-[400px] h-[400px] bottom-[-280px] left-[-100px] rounded-full bg-[rgba(44,126,242,0.12)] blur-[1px]" />
        <div className="absolute w-[400px] h-[400px] bottom-[-280px] right-[-100px] rounded-full bg-[rgba(44,126,242,0.10)] blur-[1px]" />
        {/* Dot grids */}
        <div className="absolute w-[90px] h-[120px] opacity-65 top-[200px] left-[80px]"
          style={{ backgroundImage: 'radial-gradient(#C8DDFA 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
        <div className="absolute w-[90px] h-[120px] opacity-65 top-[155px] right-[80px]"
          style={{ backgroundImage: 'radial-gradient(#C8DDFA 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
      </div>

      <main className="relative z-[2] min-h-screen flex justify-center px-5 pt-[58px] pb-[30px]">
        <div className="w-full max-w-[1100px] flex flex-col items-center">

          {/* Brand */}
          <div className="flex items-center gap-4 mb-[38px] max-sm:mb-[25px]">
            <div className="w-[78px] h-[78px] grid place-items-center bg-white/90 border border-[#DBE9FB] rounded-[20px] shadow-[0_12px_30px_rgba(31,105,198,0.12)] max-sm:w-[60px] max-sm:h-[60px] max-sm:rounded-[16px]">
              <ShieldMark />
            </div>
            <div>
              <div className="text-[22px] max-sm:text-[19px] font-extrabold text-[#123765] leading-[1.1]">{name}</div>
              <div className="mt-1 text-xs font-bold tracking-wide text-xevera-600 uppercase">{eyebrow || 'Xevera Portal'}</div>
            </div>
          </div>

          {/* Illustration card */}
          <div className="w-full max-w-[640px] h-[370px] max-sm:h-[240px] relative overflow-hidden rounded-[34px] border border-[#D9E8FB] shadow-[0_20px_55px_rgba(33,106,196,0.10)] mb-[38px] max-sm:rounded-[25px] max-sm:scale-[.92]"
            style={{ background: 'linear-gradient(145deg,#FFFFFF,#F8FBFF)' }}>
            <div className="absolute w-[380px] h-[180px] rounded-full blur-[10px] top-[90px] left-[130px]" style={{ background: 'rgba(70,145,246,0.06)' }} />
            <div className="absolute inset-0">
              <WebWindow />
              <Toolbox />
              <Document />
              <Gear />
              <Clock />
              <Database />
              <Cloud />
              <Cone />
            </div>
          </div>

          {/* Message */}
          <section className="text-center max-w-[850px]">
            <h1 className="font-extrabold text-[#123765] leading-[1.1] tracking-[-2px] mb-5 text-[clamp(32px,5vw,54px)]">
              {rawHeadline.includes(' ') ? (
                <>{main}{' '}
                  {accent && <span className="text-xevera-600">{accent}</span>}
                </>
              ) : rawHeadline}
            </h1>

            <p className="text-[#5D7190] text-lg leading-relaxed max-w-[720px] mx-auto">
              {description || (
                <>
                  Our team is currently improving the system to serve you better.
                  <br className="hidden sm:block" />
                  Thank you for your patience.
                </>
              )}
            </p>

            {/* Refresh */}
            <button onClick={refreshPage} disabled={checking}
              className={`mt-8 w-[225px] h-[60px] rounded-[17px] border-none text-white text-lg font-bold cursor-pointer shadow-[0_13px_28px_rgba(25,119,236,0.25)] transition-all hover:-translate-y-[3px] hover:shadow-[0_18px_35px_rgba(25,119,236,0.34)] active:translate-y-0 disabled:opacity-80 ${checking ? '' : ''}`}
              style={{ background: 'linear-gradient(135deg,#318BF7,#106EE0)' }}>
              <span className={`inline-block text-2xl mr-2 align-[-2px] ${checking ? 'animate-spin' : ''}`}>↻</span>
              {checking ? 'Checking...' : 'Refresh'}
            </button>
          </section>

          {/* Countdown (real schedule from settings) */}
          {countdownTarget && (
            <div className="mt-9 w-full max-w-md rounded-2xl bg-white/80 border border-[#D5E5FC] p-5 text-center shadow-[0_10px_24px_rgba(31,105,198,0.10)]">
              <div className="mb-3 text-[11px] uppercase tracking-widest font-bold text-xevera-600">Estimated Return</div>
              <Countdown target={countdownTarget} />
            </div>
          )}

          {maintenanceScheduledAt && maintenanceReturn && (
            <div className="mt-5 w-full max-w-md">
              <Duration start={maintenanceScheduledAt} target={maintenanceReturn} />
            </div>
          )}

          {/* Enter anyway (Super Admin preview path) */}
          {onEnterAnyway && (
            <button onClick={onEnterAnyway}
              className="mt-5 text-[12px] font-semibold text-xevera-600 hover:text-xevera-700 bg-none border-none cursor-pointer transition-colors">
              → Enter Dashboard Anyway
            </button>
          )}
          {onReturnToLogin && !onEnterAnyway && (
            <button onClick={onReturnToLogin}
              className="mt-3 text-[12px] font-semibold text-xevera-600 hover:text-xevera-700 bg-none border-none cursor-pointer hover:underline">
              ← Return to Login
            </button>
          )}

          {/* Footer */}
          <footer className="w-full max-w-[950px] mt-[55px] border-t border-[#DCE8F8] pt-[26px] text-center">
            <div className="text-xevera-600 text-[15px] mb-[22px]">
              {maintenanceFooter || 'Thank you for your patience and understanding.'}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-[27px] text-sm text-[#173765]">
              <span>&copy; {new Date().getFullYear()} {name}</span>
              <span className="text-[#8CA9CB] max-sm:hidden">|</span>
              <span className="py-2 px-4 bg-white border border-[#DBE8F8] rounded-[9px] text-xevera-600 font-semibold shadow-[0_4px_12px_rgba(30,106,195,0.06)]">
                System Version&nbsp; {version}
              </span>
              <span className="text-[#8CA9CB] max-sm:hidden">|</span>
              <span>Contact Administrator</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
