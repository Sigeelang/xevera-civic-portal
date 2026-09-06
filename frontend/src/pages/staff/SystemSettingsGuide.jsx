import { useState } from 'react';

export function InfoBox({ title, text }) {
  return (
    <div className="flex gap-3.5 p-4 rounded-[8px] bg-[#F1F6FF] border border-[#CFE0FB]">
      <span className="w-7 h-7 flex-shrink-0 grid place-items-center rounded-full border-2 border-[#1264E8] text-[#1264E8] text-sm font-extrabold">i</span>
      <div>
        <strong className="block text-[15px] text-[#1264E8]">{title}</strong>
        <p className="mt-1 text-xs text-[#405777] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

export function WarnBox({ strong, text }) {
  return (
    <div className="mt-5 flex gap-3 p-4 rounded-[8px] bg-[#FFFAF0] border border-[#F2D9AA]">
      <span className="w-[27px] h-[27px] flex-shrink-0 grid place-items-center rounded-full bg-[#ED8A00] text-white font-extrabold">!</span>
      <div>
        <strong className="text-[13px] text-[#7D5000]">{strong}</strong>
        <p className="mt-1 text-[11px] text-[#876B3A] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function CodeBox({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className={`mt-3 min-h-[53px] flex items-center justify-between gap-4 pl-4 pr-2.5 rounded-[7px] border transition-colors ${copied ? 'border-[#C5EAD9] bg-[#F1FBF6]' : 'border-[#DCE3ED] bg-[#F8FAFC]'}`}>
      <code className="min-w-0 overflow-x-auto whitespace-nowrap text-xs font-bold text-[#14213A] font-mono">{code}</code>
      <button type="button" onClick={copy} aria-label="Copy"
        className={`w-9 h-9 flex-shrink-0 grid place-items-center rounded-[7px] border bg-white cursor-pointer transition-colors ${copied ? 'border-[#BFE6D2] text-[#138A56]' : 'border-[#DBE2EC] text-[#526681] hover:border-[#1264E8] hover:text-[#1264E8]'}`}>
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  );
}

const STEPS = [
  { title: 'Install OTP Table', desc: 'Create the required database table' },
  { title: 'Configure SMTP', desc: 'Set up email configuration' },
  { title: 'Enable OTP Service', desc: 'Activate OTP verification' },
  { title: 'Test Configuration', desc: 'Verify everything works' },
  { title: 'Troubleshooting', desc: 'Common issues and solutions' },
];

function Row({ n, check, title, children }) {
  return (
    <div className="grid grid-cols-[44px_1fr] gap-4 mb-5">
      <span className={`w-11 h-11 grid place-items-center rounded-full font-bold ${check ? 'bg-transparent' : 'bg-[#EAF2FF]'} text-[#1264E8] text-[17px]`}>
        {check ? '✓' : n}
      </span>
      <div>
        <h4 className="text-[15px] font-bold text-[#15233C]">{title}</h4>
        <p className="mt-1.5 text-xs text-[#5D708B] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function StepBody({ step }) {
  if (step === 1) {
    return (
      <>
        <InfoBox title="Why is this needed?" text="The OTP service requires a database table to store hashed codes, expiration time, and verification status. Run the installation script below to create the table automatically." />
        <h3 className="mt-6 mb-4 text-lg font-extrabold text-[#14213A]">Steps to Install OTP Table</h3>
        <Row n="1" title="Locate the installation script">Navigate to the following file in your project directory:</Row>
        <CodeBox code="backend/install_otp_table.php" />
        <Row n="2" title="Run the script">Open the script in your browser or execute it on the server:</Row>
        <CodeBox code="http://localhost:8000/install_otp_table.php" />
        <Row n="3" title="Verify installation">After running the script you should see a success message confirming that the OTP table was created.</Row>
        <Row n="4" title="Check status here">Click Refresh Status above and confirm that OTP Table Status now displays Installed.</Row>
      </>
    );
  }
  if (step === 2) {
    return (
      <>
        <InfoBox title="Why configure SMTP?" text="SMTP allows Xevera Portal to send OTP codes, notifications, account messages and other system emails." />
        <h3 className="mt-6 mb-4 text-lg font-extrabold text-[#14213A]">SMTP Configuration</h3>
        <Row n="1" title="SMTP Host">For Gmail use <b>ssl://smtp.gmail.com</b>.</Row>
        <Row n="2" title="SMTP Port">SSL uses port <b>465</b>. TLS commonly uses port <b>587</b>.</Row>
        <Row n="3" title="Username">Use the Gmail account configured for sending system emails.</Row>
        <Row n="4" title="Password">Store credentials server-side in backend/api/config/mail_config.php using a Google App Password. Never expose the password in frontend JavaScript.</Row>
        <WarnBox strong="Security recommendation" text="Keep SMTP credentials in your PHP backend configuration rather than storing them anywhere in the browser." />
      </>
    );
  }
  if (step === 3) {
    return (
      <>
        <InfoBox title="Before enabling OTP" text="Make sure the OTP table exists and your SMTP configuration has passed its connection test." />
        <h3 className="mt-6 mb-4 text-lg font-extrabold text-[#14213A]">Enable OTP Verification</h3>
        <Row check title="Install the OTP table">Complete Step 1 before activating the OTP service.</Row>
        <Row check title="Verify SMTP">Use Test Connection on this page to verify the server can authenticate with your mail provider.</Row>
        <Row check title="Enable OTP">Once the backend reports the OTP table exists, enable OTP in the authentication flow.</Row>
        <WarnBox strong="Do not enable OTP before installation" text="The authentication flow requires the OTP storage table to exist first." />
      </>
    );
  }
  if (step === 4) {
    return (
      <>
        <InfoBox title="Final verification" text="Complete these checks before considering the email and OTP configuration ready." />
        <h3 className="mt-6 mb-4 text-lg font-extrabold text-[#14213A]">Configuration Checklist</h3>
        <div className="flex flex-col gap-3">
          {['SMTP host and port are configured.',
            'SMTP authentication succeeds (Test Connection).',
            'A test email can be delivered (Send Test Email).',
            'OTP database table status shows Installed.',
            'OTP verification successfully generates and validates a code.'].map((t) => (
            <div key={t} className="flex items-start gap-2.5">
              <span className="w-[22px] h-[22px] flex-shrink-0 grid place-items-center rounded-full bg-[#EAF8F1] text-[#138A56] text-[11px] font-extrabold">✓</span>
              <span className="text-xs text-[#536782] leading-relaxed">{t}</span>
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <h3 className="mb-4 text-lg font-extrabold text-[#14213A]">Common Issues</h3>
      <Row n="!" title="SMTP connection failed">Check the SMTP host, port, encryption method and server network connectivity.</Row>
      <Row n="!" title="Authentication failed">Verify the SMTP username and app password in mail_config.php. For Gmail, always use a Google App Password rather than your normal account password.</Row>
      <Row n="!" title="OTP table not installed">Run install_otp_table.php, then click Refresh Status on this page.</Row>
      <Row n="!" title="OTP email not received">First test SMTP independently with Send Test Email, then check backend mail logs and the recipient address.</Row>
    </>
  );
}

export default function SetupGuideModal({ onClose }) {
  const [step, setStep] = useState(1);
  const total = STEPS.length;

  function goTo(next) {
    if (next >= 1 && next <= total) setStep(next);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 bg-[rgba(20,31,51,0.62)] backdrop-blur-[5px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[1170px] h-[min(885px,calc(100vh-40px))] grid grid-cols-1 md:grid-cols-[300px_1fr] md:grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-[16px] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.28),0_10px_30px_rgba(0,0,0,0.15)]">

        <aside className="hidden md:flex flex-col row-span-2 py-10 px-[18px] pb-7 bg-[#FBFCFF] border-r border-[#E5EAF1] min-h-0">
          <div className="px-4">
            <div className="flex items-center gap-3.5">
              <span className="text-[31px] text-[#1264E8]">♧</span>
              <h1 className="text-[23px] font-bold text-[#14213A] tracking-[-0.4px]">Setup Guide</h1>
            </div>
            <p className="mt-3 text-[13px] text-[#526580] leading-relaxed">Configure SMTP and OTP service for your system.</p>
          </div>

          <div className="mt-7 flex flex-col gap-1.5 overflow-y-auto">
            {STEPS.map((s, i) => (
              <button key={s.title} type="button" onClick={() => goTo(i + 1)}
                className={`min-h-[72px] flex items-center gap-[15px] px-3.5 py-2.5 rounded-[9px] text-left transition-colors cursor-pointer ${step === i + 1 ? 'bg-[#EAF2FF]' : 'hover:bg-[#F1F5FB]'}`}>
                <span className={`w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-full text-[15px] font-bold ${step === i + 1 ? 'bg-[#1468ED] text-white' : 'bg-[#D7DFEB] text-white'}`}>{i + 1}</span>
                <span className="min-w-0">
                  <strong className={`block text-sm font-bold ${step === i + 1 ? 'text-[#1264E8]' : 'text-[#17243C]'}`}>{s.title}</strong>
                  <span className="block mt-1 text-[11px] text-[#61728C] leading-snug">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-auto p-[17px] rounded-[8px] bg-[#EEF5FF] border border-[#D5E4FF]">
            <div className="flex items-center gap-2.5 text-sm font-bold text-[#1264E8]">
              <span className="w-6 h-6 grid place-items-center rounded-full border-2 border-[#1264E8] text-[13px]">i</span>
              Need Help?
            </div>
            <p className="mt-1.5 ml-[35px] text-[11px] text-[#526580] leading-relaxed">If you encounter any issues, contact the system administrator or refer to the documentation.</p>
          </div>
        </aside>

        <section className="relative md:col-start-2 md:row-start-1 flex flex-col min-h-0">
          <button type="button" onClick={onClose} aria-label="Close setup guide"
            className="absolute top-[22px] right-6 w-9 h-9 grid place-items-center rounded-[7px] border-none bg-transparent text-[#60718A] text-[27px] font-light hover:bg-[#F1F4F8] hover:text-[#1D2B42] cursor-pointer">×</button>

          <div className="flex items-center gap-[22px] pr-[50px] pt-10 px-6">
            <span className="w-[90px] h-[90px] flex-shrink-0 hidden sm:grid place-items-center rounded-full bg-[#EDF4FF] text-[#1264E8] text-[39px]">▤</span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#1264E8]">Step {step} of {total}</div>
              <h2 className="mt-1 text-[26px] leading-tight font-extrabold text-[#101D36] tracking-[-0.5px]">{STEPS[step - 1].title}</h2>
              <p className="mt-1.5 text-sm text-[#4F6381]">{STEPS[step - 1].desc}</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-7">
            <StepBody step={step} />
          </div>
        </section>

        <div className="md:col-start-2 md:row-start-2 min-h-[70px] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-[#E4E9F0]">
          <button type="button" disabled={step === 1} onClick={() => goTo(step - 1)}
            className={`h-12 min-w-0 sm:min-w-[160px] w-full sm:w-auto px-5 rounded-[8px] text-sm font-bold transition-colors ${step === 1 ? 'border border-[#E0E5EC] bg-[#F4F6F9] text-[#B5C0CE] cursor-not-allowed' : 'border border-[#D8E0EA] bg-white text-[#52637C] hover:bg-[#F6F8FB] cursor-pointer'}`}>
            ← Previous
          </button>
          <button type="button" onClick={() => (step === total ? onClose() : goTo(step + 1))}
            className="h-12 min-w-0 sm:min-w-[160px] w-full sm:w-auto px-5 rounded-[8px] border border-[#1264E8] bg-[#1468ED] text-white text-sm font-bold shadow-[0_5px_15px_rgba(20,104,237,0.18)] hover:bg-[#075BD8] cursor-pointer">
            {step === total ? 'Finish ✓' : 'Next Step →'}
          </button>
        </div>
      </div>
    </div>
  );
}
