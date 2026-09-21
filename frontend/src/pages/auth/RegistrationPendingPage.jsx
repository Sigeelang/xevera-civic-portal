import { useEffect } from 'react';

/*
 * Verification Submitted / Pending Admin Approval.
 *
 * Shown immediately after the resident verifies their 6-digit email OTP
 * (RegisterPage -> complete-registration.php creates the account as
 * Inactive / residency_status = Pending Verification). Approval itself is
 * strictly backend/admin controlled — this page only informs and routes
 * back to login via the existing onLogin handler.
 */
export default function RegistrationPendingPage({ onLogin }) {
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch {}
  }, []);

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#12366d',
        background:
          'radial-gradient(circle at 0% 0%, #e7f1ff 0, transparent 28%), radial-gradient(circle at 100% 75%, #eef6ff 0, transparent 30%), #f8fbff',
      }}
    >
      {/* Background circles */}
      <div className="fixed rounded-full pointer-events-none" style={{ width: 360, height: 360, top: -210, left: -160, background: '#e6f0ff', zIndex: 0 }} aria-hidden="true" />
      <div className="fixed rounded-full pointer-events-none" style={{ width: 430, height: 430, right: -260, bottom: -180, background: '#edf6ff', zIndex: 0 }} aria-hidden="true" />

      <main className="relative min-h-screen flex flex-col items-center px-5 pt-[30px] pb-[50px] max-[800px]:px-3.5 max-[800px]:pt-5 max-[800px]:pb-[35px]" style={{ zIndex: 1 }}>
        {/* Brand */}
        <header className="flex items-center gap-[22px] mb-[25px] max-[800px]:gap-[13px] max-[800px]:mb-[18px]">
          <div
            className="w-[115px] h-[115px] rounded-[28px] flex items-center justify-center max-[800px]:w-[75px] max-[800px]:h-[75px] max-[800px]:rounded-[19px] max-[420px]:w-[60px] max-[420px]:h-[60px]"
            style={{ background: 'linear-gradient(145deg, #1766f2, #0755df)', boxShadow: '0 15px 30px rgba(25, 91, 215, 0.22)' }}
          >
            <svg viewBox="0 0 100 120" className="w-[55px] h-[65px] max-[800px]:w-[38px] max-[800px]:h-[45px] max-[420px]:w-[30px] max-[420px]:h-[36px]" aria-hidden="true">
              <path d="M50 5 L90 20 V55 C90 82 73 103 50 115 C27 103 10 82 10 55 V20 Z" fill="none" stroke="white" strokeWidth="7" />
              <path d="M30 58 L43 71 L70 40" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-[48px] tracking-[6px] leading-none font-extrabold text-[#0d2e64] max-[800px]:text-[31px] max-[800px]:tracking-[3px] max-[420px]:text-[25px] max-[420px]:tracking-[2px]">
              XEVERA
            </h1>
            <p className="mt-[18px] text-[22px] tracking-[7px] font-bold text-[#1766e9] max-[800px]:text-[11px] max-[800px]:tracking-[3px] max-[800px]:mt-2 max-[420px]:text-[9px] max-[420px]:tracking-[2px]">
              CIVIC REPORTING SYSTEM
            </p>
          </div>
        </header>

        {/* Main card */}
        <section
          className="w-full max-w-[815px] text-center rounded-[30px] border border-[#e4edf9] px-[58px] pt-[38px] pb-9 max-[800px]:px-5 max-[800px]:pt-[30px] max-[800px]:pb-7 max-[800px]:rounded-[23px] max-[420px]:px-[15px] max-[420px]:pt-[25px]"
          style={{
            background: 'rgba(255, 255, 255, 0.97)',
            boxShadow: '0 20px 55px rgba(42, 89, 150, 0.10), 0 3px 12px rgba(42, 89, 150, 0.04)',
          }}
        >
          {/* Status illustration */}
          <div className="w-[175px] h-[175px] mx-auto mb-[18px] flex items-center justify-center max-[800px]:w-[125px] max-[800px]:h-[125px] max-[420px]:w-[105px] max-[420px]:h-[105px]">
            <svg viewBox="0 0 200 200" className="w-full h-full" role="img" aria-label="Verification pending illustration">
              <rect x="40" y="25" width="120" height="150" rx="15" fill="#f3f8ff" stroke="#789bd0" strokeWidth="7" />
              <circle cx="100" cy="70" r="30" fill="#4b91ed" />
              <circle cx="100" cy="63" r="10" fill="white" />
              <path d="M82 88 Q100 70 118 88" fill="white" />
              <rect x="65" y="113" width="70" height="9" rx="5" fill="#7299d1" />
              <rect x="65" y="132" width="45" height="9" rx="5" fill="#7299d1" />
              <circle cx="151" cy="145" r="34" fill="#ffb927" />
              <line x1="151" y1="128" x2="151" y2="151" stroke="white" strokeWidth="7" strokeLinecap="round" />
              <circle cx="151" cy="161" r="4" fill="white" />
              <line x1="20" y1="70" x2="10" y2="60" stroke="#3e8df0" strokeWidth="6" strokeLinecap="round" />
              <line x1="15" y1="90" x2="5" y2="90" stroke="#3e8df0" strokeWidth="6" strokeLinecap="round" />
              <line x1="180" y1="70" x2="190" y2="60" stroke="#3e8df0" strokeWidth="6" strokeLinecap="round" />
              <line x1="185" y1="90" x2="195" y2="90" stroke="#3e8df0" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="text-[#123a78] text-[42px] font-extrabold leading-[1.15] mb-[5px] max-[800px]:text-[30px] max-[420px]:text-[27px]">
            Verification Submitted!
          </h2>
          <h3 className="text-[#123a78] text-[30px] font-bold mb-[25px] max-[800px]:text-[22px] max-[800px]:mb-5 max-[420px]:text-[20px]">
            Please Wait for Admin Approval
          </h3>

          <p className="text-[#58739b] text-[19px] leading-[1.5] max-w-[650px] mx-auto mb-[25px] max-[800px]:text-[15px] max-[420px]:text-[14px]">
            Your verification code has been successfully verified.
            <br />
            Your account is now pending approval by an administrator.
            <br />
            You will receive an email notification once your account
            <br />
            has been approved. After approval, you can proceed to complete
            <br />
            your account registration and start using the Xevera Civic Reporting System.
          </p>

          {/* What happens next */}
          <div
            className="text-left mt-[10px] mb-[27px] rounded-[18px] border border-[#e1edfc] px-7 py-[22px] max-[800px]:p-[18px]"
            style={{ background: 'linear-gradient(135deg, #edf6ff, #e6f1ff)' }}
          >
            <div className="flex items-center gap-[13px] text-[#1164e9] text-[20px] font-extrabold mb-3 max-[800px]:text-[17px]">
              <span className="w-8 h-8 rounded-full bg-[#1164e9] text-white flex items-center justify-center font-bold text-[18px] flex-shrink-0">
                i
              </span>
              <span>What happens next?</span>
            </div>
            <ol className="list-none ml-[45px] max-[800px]:ml-[35px] max-[420px]:ml-[27px]">
              {[
                'Our admin will review your information.',
                'You will receive an email once your account is approved.',
                'After approval, you can continue to create your account.',
              ].map((step) => (
                <li key={step} className="relative text-[#4f6b94] text-[17px] leading-[1.7] max-[800px]:text-[14px] max-[420px]:text-[13px]">
                  <span
                    className="absolute rounded-full bg-[#5793e8]"
                    style={{ left: -20, top: 12, width: 6, height: 6 }}
                    aria-hidden="true"
                  />
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Back to login — uses the existing login route via onLogin */}
          <button
            type="button"
            onClick={() => onLogin && onLogin()}
            className="inline-flex items-center justify-center gap-3 w-[335px] max-w-full h-[54px] rounded-[30px] border-none bg-[#e8f2ff] text-[#0964e9] text-[19px] font-bold cursor-pointer transition-all duration-200 hover:bg-[#d9eaff] hover:-translate-y-0.5 max-[800px]:w-full max-[800px]:h-[52px] max-[800px]:text-base"
            style={{ boxShadow: 'none' }}
            onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(30, 103, 226, 0.12)'; }}
            onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span className="text-[28px] leading-none" aria-hidden="true">←</span>
            <span>Back to Login</span>
          </button>

          <div className="mt-[23px] text-[#637b9f] text-base max-[800px]:text-[13px]">
            Need help? Contact us at{' '}
            <a href="mailto:xeveraportal@gmail.com" className="text-[#0867eb] font-bold no-underline hover:underline">
              xeveraportal@gmail.com
            </a>
          </div>
        </section>
      </main>

      {/* Decorative community (desktop ambience, subtle on mobile) */}
      <div className="fixed bottom-0 left-0 right-0 h-[210px] pointer-events-none opacity-55 max-[800px]:opacity-30" style={{ zIndex: 0 }} aria-hidden="true">
        <div className="absolute bottom-0 left-0">
          <div className="absolute rounded-full bg-[#d2e4fa] bottom-[85px] left-[55px] w-20 h-20" />
          <div className="absolute rounded-full bg-[#d2e4fa] bottom-[65px] left-[190px] w-[62px] h-[62px]" />
          <div className="relative w-[190px] h-[95px] bg-[#dbeaff] border-2 border-[#cbdff7]">
            <div className="absolute w-[35px] h-[30px] top-[25px] left-5 bg-[#edf6ff] border-[3px] border-[#c2d9f5]" />
            <div className="absolute w-[35px] h-[30px] top-[25px] right-5 bg-[#edf6ff] border-[3px] border-[#c2d9f5]" />
            <div className="absolute w-[35px] h-[55px] bottom-0 left-[75px] bg-[#c5daf4]" />
          </div>
        </div>
        <div className="absolute bottom-0 right-0 max-[800px]:hidden">
          <div className="absolute rounded-full bg-[#d2e4fa] bottom-[85px] left-[55px] w-20 h-20" />
          <div className="relative w-[190px] h-[95px] bg-[#dbeaff] border-2 border-[#cbdff7]">
            <div className="absolute w-[35px] h-[30px] top-[25px] left-5 bg-[#edf6ff] border-[3px] border-[#c2d9f5]" />
            <div className="absolute w-[35px] h-[30px] top-[25px] right-5 bg-[#edf6ff] border-[3px] border-[#c2d9f5]" />
            <div className="absolute w-[35px] h-[55px] bottom-0 left-[75px] bg-[#c5daf4]" />
          </div>
        </div>
      </div>
    </div>
  );
}
