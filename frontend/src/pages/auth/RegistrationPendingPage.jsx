import { useEffect } from 'react';

export default function RegistrationPendingPage({ onLogin }) {
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch {}
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden"
      style={{
        color: '#17345d',
        background:
          'radial-gradient(circle at 8% 10%, rgba(43,111,232,0.10), transparent 24%), linear-gradient(135deg, #eef5ff 0%, #ffffff 48%, #eef5ff 100%)',
      }}>

      {/* Background decorations */}
      <div className="fixed pointer-events-none">
        <div className="absolute w-[420px] h-[420px] border border-[rgba(61,126,229,0.15)] rounded-full top-[-250px] left-[-220px]">
          <div className="absolute inset-[32px] border border-[rgba(61,126,229,0.10)] rounded-full" />
        </div>
      </div>
      <div className="fixed pointer-events-none">
        <div className="absolute w-[500px] h-[500px] border border-[rgba(61,126,229,0.15)] rounded-full right-[-270px] bottom-[-300px]">
          <div className="absolute inset-[35px] border border-[rgba(61,126,229,0.10)] rounded-full" />
        </div>
      </div>
      <div className="fixed w-[115px] h-[95px] opacity-[0.65] pointer-events-none top-[15px] right-[70px]"
        style={{
          backgroundImage: 'radial-gradient(#9ec4fa 1.2px, transparent 1.2px)',
          backgroundSize: '16px 16px',
        }} />
      <div className="fixed w-[115px] h-[95px] opacity-[0.65] pointer-events-none bottom-[65px] left-[65px]"
        style={{
          backgroundImage: 'radial-gradient(#9ec4fa 1.2px, transparent 1.2px)',
          backgroundSize: '16px 16px',
        }} />

      <main className="min-h-screen w-full flex items-center justify-center px-[7%] py-10 relative">
        <div className="w-full max-w-[1180px] grid grid-cols-2 items-center gap-[70px] max-md:grid-cols-1 max-md:max-w-[650px] max-md:gap-[45px]">

          {/* LEFT SIDE */}
          <section className="pl-[25px] max-md:pl-0 max-md:text-center">
            <div className="flex items-center gap-3.5 mb-[65px] max-md:justify-center max-md:mb-10">
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center"
                style={{ background: 'linear-gradient(145deg, #1677ff, #1260dd)', boxShadow: '0 8px 20px rgba(23,105,245,0.20)' }}>
                <svg width="29" height="29" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3L27 7.5V15.8C27 22.4 22.5 27.2 16 29C9.5 27.2 5 22.4 5 15.8V7.5L16 3Z" stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
                  <path d="M11.5 16L14.5 19L21 12.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-[27px] font-extrabold tracking-[-0.8px] text-[#17345d] leading-none">XEVERA</div>
                <div className="mt-1 text-[#1769f5] text-[10px] font-extrabold tracking-[1.3px]">CIVIC REPORTING SYSTEM</div>
              </div>
            </div>

            <h1 className="text-[clamp(42px,4.2vw,58px)] leading-[0.98] tracking-[-2.4px] font-extrabold text-[#142f57]">
              Welcome to<br /><span className="text-[#1769f5]">Xevera</span> Portal
            </h1>
            <div className="w-[31px] h-[3px] bg-[#1769f5] my-[25px] rounded-[5px]" />
            <p className="max-w-[450px] text-[#526e96] text-[15px] leading-[1.8]">
              Create your account to report concerns, track updates, and stay connected with your community.
            </p>
          </section>

          {/* RIGHT CARD */}
          <section className="bg-[rgba(255,255,255,0.96)] border border-[#cedded] rounded-[18px] px-[55px] pt-[55px] pb-8 text-center max-sm:px-5 max-sm:pt-9 max-sm:pb-6 max-sm:rounded-[15px]"
            style={{ boxShadow: '0 20px 60px rgba(44,85,135,0.07), 0 3px 12px rgba(44,85,135,0.04)' }}>

            {/* Success illustration */}
            <div className="relative w-[170px] h-[170px] mx-auto mb-5 flex justify-center items-center">
              {/* Green circle */}
              <div className="absolute w-[150px] h-[150px] bg-[#e8faf5] rounded-full" />

              {/* Confetti pieces */}
              <div className="absolute w-[10px] h-[4px] rounded-[4px] bg-[#1769f5] left-[12px] top-[38px] rotate-[48deg] z-10" />
              <div className="absolute w-[10px] h-[4px] rounded-[4px] bg-[#26c69a] left-[2px] top-[87px] rotate-[45deg] z-10" />
              <div className="absolute w-[10px] h-[4px] rounded-[4px] bg-[#1769f5] right-[15px] top-[50px] rotate-[-48deg] z-10" />
              <div className="absolute w-[10px] h-[4px] rounded-[4px] bg-[#26c69a] right-0 top-[91px] rotate-[-50deg] z-10" />

              {/* Document */}
              <div className="relative w-[100px] h-[130px] bg-white rounded-[8px] pt-[17px] px-[15px] z-[2] -translate-x-[5px] translate-y-1"
                style={{ boxShadow: '0 8px 20px rgba(44,85,135,0.12)' }}>
                {/* Avatar circle */}
                <div className="relative w-[29px] h-[29px] bg-[#e1edff] rounded-full mb-2">
                  <div className="absolute w-[10px] h-[10px] bg-[#4b91f7] rounded-full top-[5px] left-[9px]" />
                  <div className="absolute w-[17px] h-[8px] bg-[#4b91f7] rounded-t-[9px] rounded-b-[4px] bottom-1 left-[6px]" />
                </div>
                {/* Lines */}
                <div className="h-[5px] rounded-[5px] bg-[#a9c8f5] mb-2 w-[82%]" />
                <div className="h-[5px] rounded-[5px] bg-[#a9c8f5] mb-2 w-[65%]" />
                <div className="h-[5px] rounded-[5px] bg-[#a9c8f5] mb-2 w-[82%]" />
                <div className="h-[5px] rounded-[5px] bg-[#a9c8f5] mb-2 w-[82%]" />
                <div className="h-[5px] rounded-[5px] bg-[#a9c8f5] w-[65%]" />
              </div>

              {/* Check circle */}
              <div className="absolute z-[4] w-[62px] h-[62px] rounded-full bg-[#26c69a] bottom-1 right-2 flex items-center justify-center"
                style={{ boxShadow: '0 7px 18px rgba(38,198,154,0.25)' }}>
                <svg width="35" height="35" viewBox="0 0 40 40" fill="none">
                  <path d="M10 20.5L17 27L30 13" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-[29px] leading-[1.2] text-[#17345d] font-extrabold tracking-[-0.8px] mb-[17px] max-sm:text-[25px]">
              OTP Verified Successfully!
            </h2>

            <p className="text-[#58729a] text-[16px] leading-[1.55] max-w-[480px] mx-auto mb-[27px] max-sm:text-[14px]">
              Your account has been created and your documents have been submitted.
            </p>

            {/* Info box */}
            <div className="bg-[#eaf4ff] rounded-[10px] p-5 flex gap-[17px] items-start text-left mb-[30px] max-sm:p-4 max-sm:gap-3">
              <div className="w-[46px] h-[46px] flex-shrink-0 bg-[#1769f5] rounded-full text-white flex items-center justify-center text-[25px] font-medium max-sm:w-10 max-sm:h-10 max-sm:text-[21px]">
                i
              </div>
              <div className="pt-px">
                <div className="text-[15px] font-extrabold text-[#17345d] mb-[7px] max-sm:text-[14px]">
                  Your registration is now pending verification.
                </div>
                <div className="text-[#526d94] text-[14px] leading-[1.55] max-sm:text-[13px]">
                  An administrator will review and verify your submitted documents. You will be notified via email once your account has been approved.
                </div>
              </div>
            </div>

            {/* Login button */}
            <button
              onClick={() => onLogin && onLogin()}
              className="w-full border-none rounded-[9px] px-[22px] py-[17px] bg-[#1769f5] text-white text-[16px] font-bold cursor-pointer transition-all duration-[0.25s] hover:bg-[#105bd7] hover:-translate-y-px max-sm:text-[14px]"
              style={{ boxShadow: '0 7px 16px rgba(23,105,245,0.20)' }}
            >
              <span className="flex items-center justify-center gap-3">
                <span>Back to Login</span>
                <span className="text-[22px] leading-none transition-transform duration-200 hover:translate-x-1">→</span>
              </span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
