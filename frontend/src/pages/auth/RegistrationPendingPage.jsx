import { useEffect } from 'react';

/*
 * Verification Successful / Pending Admin Approval.
 *
 * Shown immediately after the resident verifies their 6-digit email OTP
 * and clicks "Verify Code to Continue" (RegisterPage calls
 * complete-registration.php, which creates the account as Inactive /
 * residency_status = Pending Verification). Approval itself is strictly
 * backend/admin controlled — this page only informs and routes back to
 * login via the existing onLogin handler.
 */
export default function RegistrationPendingPage({ onLogin }) {
  useEffect(() => {
    try { window.scrollTo(0, 0); } catch {}
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 max-[650px]:p-3"
      style={{
        fontFamily: 'Inter, Arial, Helvetica, sans-serif',
        color: '#12315d',
        background:
          'radial-gradient(circle at 5% 35%, rgba(207, 226, 250, .55) 0 115px, transparent 116px), radial-gradient(circle at 98% 82%, rgba(207, 226, 250, .55) 0 125px, transparent 126px), linear-gradient(135deg, #f4f9ff, #eef5fd)',
      }}
    >
      <style>{`@keyframes vrfCardIn{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}@keyframes vrfPop{0%{transform:scale(.6)}80%{transform:scale(1.08)}100%{transform:scale(1)}}`}</style>

      <main
        className="w-full max-w-[780px] bg-white rounded-[24px] px-12 pt-8 pb-9 text-center max-[650px]:px-5 max-[650px]:pt-7 max-[650px]:pb-[25px] max-[650px]:rounded-[18px]"
        style={{
          boxShadow: '0 20px 60px rgba(25, 69, 125, .12), 0 4px 16px rgba(25, 69, 125, .05)',
          animation: 'vrfCardIn .5s ease',
        }}
      >
        {/* Success icon */}
        <div className="w-[116px] h-[116px] mx-auto mb-[18px] rounded-full grid place-items-center relative max-[650px]:w-[94px] max-[650px]:h-[94px]" style={{ background: '#e4f8ee' }}>
          <span className="absolute left-[-10px] top-1/2 w-[25px] h-1 rounded-[10px] bg-[#19bf68]" aria-hidden="true" />
          <span className="absolute right-[-10px] top-1/2 w-[25px] h-1 rounded-[10px] bg-[#19bf68]" aria-hidden="true" />
          <span
            className="w-[82px] h-[82px] rounded-full text-white grid place-items-center text-[47px] font-extrabold max-[650px]:w-[68px] max-[650px]:h-[68px] max-[650px]:text-[38px]"
            style={{ background: '#19bf68', boxShadow: '0 8px 20px rgba(25, 191, 104, .22)', animation: 'vrfPop .45s ease .15s both' }}
            aria-hidden="true"
          >
            ✓
          </span>
        </div>

        <h1 className="text-[38px] leading-[1.15] font-extrabold text-[#102f5c] mb-2 max-[650px]:text-[28px]">
          Verification Successful!
        </h1>
        <p className="text-[19px] text-[#5f78a0] mb-[22px] max-[650px]:text-base">
          Your email has been verified.
        </p>

        <div className="h-px bg-[#e8eef6] mb-[22px]" />

        {/* Admin approval box */}
        <div className="rounded-[14px] p-[22px_25px] flex items-center gap-6 text-left mb-[18px] border border-[#e4edf8] max-[650px]:flex-col max-[650px]:text-center max-[650px]:p-5 max-[650px]:gap-3.5" style={{ background: 'linear-gradient(135deg, #f0f7ff, #f5f9ff)' }}>
          <div className="w-[92px] h-[92px] flex-none rounded-full grid place-items-center text-[46px] relative max-[650px]:w-[78px] max-[650px]:h-[78px] max-[650px]:text-[38px]" style={{ background: '#e5f1ff' }} aria-hidden="true">
            👤
            <span className="absolute right-0 bottom-[2px] w-[31px] h-[31px] rounded-full bg-white grid place-items-center text-[15px]" style={{ border: '3px solid #f4a414' }}>
              ◷
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-[22px] text-[#10356b] mb-[7px] max-[650px]:text-[19px]">
              Pending Admin Approval
            </h2>
            <p className="text-[16px] leading-[1.5] text-[#5d76a0] max-w-[500px] max-[650px]:text-sm">
              Your account is now waiting for approval from an administrator to activate your access.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-[10px] bg-[#fff0c9] text-[#a96800] rounded-[20px] px-[13px] py-[7px] text-[13px] font-extrabold">
              <span aria-hidden="true">◷</span> In Review
            </span>
          </div>
        </div>

        <p className="text-[16px] leading-[1.5] text-[#607aa3] my-[17px] mx-auto max-w-[560px] max-[650px]:text-sm">
          You will receive an email notification once your account has been approved.
        </p>

        {/* Support box */}
        <div className="rounded-[14px] px-[25px] py-[18px] flex items-center gap-5 text-left border border-[#e4edf8] mb-[22px] max-[650px]:flex-col max-[650px]:text-center max-[650px]:px-3.5 max-[650px]:py-[18px]" style={{ background: 'linear-gradient(135deg, #edf6ff, #f3f8ff)' }}>
          <div className="w-[66px] h-[66px] rounded-full flex-none grid place-items-center text-[31px] text-[#1769e8]" style={{ background: '#e2efff' }} aria-hidden="true">
            ✉
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] text-[#10356b] mb-1">Need assistance?</h3>
            <p className="text-[#617ba2] text-[15px] leading-[1.45] max-[650px]:text-[13px]">
              If you have any questions or need further assistance, please contact us at{' '}
              <a href="mailto:xeveraportal@gmail.com" className="text-[#1267df] font-extrabold no-underline hover:underline">
                xeveraportal@gmail.com
              </a>.
            </p>
          </div>
        </div>

        {/* Back to login — uses the existing login route via onLogin */}
        <button
          type="button"
          onClick={() => onLogin && onLogin()}
          className="w-full max-w-[390px] h-[58px] border-none rounded-[12px] text-white text-[18px] font-extrabold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 max-[650px]:h-[54px] max-[650px]:text-base"
          style={{ background: 'linear-gradient(135deg, #1769e8, #1260dc)', boxShadow: '0 10px 24px rgba(23, 105, 232, .22)' }}
          onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 13px 28px rgba(23, 105, 232, .3)'; }}
          onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 10px 24px rgba(23, 105, 232, .22)'; }}
        >
          Back to Login
        </button>
      </main>
    </div>
  );
}
