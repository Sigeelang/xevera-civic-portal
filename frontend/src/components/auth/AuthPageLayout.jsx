function ShieldLogo({ size = 60 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M32 5L51 12V28C51 41.5 43.2 53 32 59C20.8 53 13 41.5 13 28V12L32 5Z" stroke="white" strokeWidth={4} strokeLinejoin="round" />
      <path d="M23 32L29 38L42 23" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const AUTH_CARD =
  'relative z-10 w-full max-w-[630px] bg-[rgba(255,255,255,0.96)] rounded-[28px] px-[62px] py-[52px] pb-12 text-center max-md:rounded-[22px] max-md:px-[30px] max-md:py-10 max-sm:px-5 max-sm:py-8 ' +
  'shadow-[0_25px_70px_rgba(31,65,115,0.13),0_3px_15px_rgba(31,65,115,0.04)] border border-[rgba(220,230,245,0.8)]';

/*
 * Full-page auth shell matching the Xevera verification-code
 * prototype: flat backdrop with the XEVERA brand header above
 * a centered card slot.
 */
export default function AuthPageLayout({ children, footer }) {
  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col items-center pt-[52px] pb-10 px-5 max-md:pt-[35px]"
      style={{ background: 'linear-gradient(135deg, #edf4ff, #ffffff 48%, #eaf2ff)' }}>
      {/* Brand */}
      <div className="relative z-10 flex items-center gap-5 mb-[38px] max-md:gap-3.5 max-md:mb-7 max-sm:scale-[0.78] max-sm:origin-top max-sm:mb-1.5">
        <div className="w-[108px] h-[108px] max-md:w-[75px] max-md:h-[75px] rounded-[25px] max-md:rounded-[18px] grid place-items-center"
          style={{ background: 'linear-gradient(145deg,#1163F3,#0B55DD)', boxShadow: '0 18px 35px rgba(20,101,245,0.22)' }}>
          <ShieldLogo size={60} />
        </div>
        <div>
          <div className="text-[48px] max-md:text-[34px] font-extrabold tracking-[7px] max-md:tracking-[4px] leading-none text-[#09285F]">XEVERA</div>
          <div className="mt-[13px] max-md:mt-2 text-[20px] max-md:text-[13px] font-bold tracking-[7px] max-md:tracking-[4px] text-[#1163F3]">CIVIC REPORTING SYSTEM</div>
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">{children}</div>

      {footer}
    </div>
  );
}

export { ShieldLogo };
