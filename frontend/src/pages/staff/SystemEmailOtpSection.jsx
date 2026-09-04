import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';
import SetupGuideModal from './SystemSettingsGuide';

function maskEmailValue(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return email;
  return parts[0].substring(0, 3) + '***@' + parts[1];
}

function fmtTested(value) {
  const d = new Date(String(value).replace(' ', 'T'));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const SMTP_STATE_META = {
  testing: { label: 'TESTING', color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', sub: 'Testing SMTP connection...' },
  failed: { label: 'CONNECTION FAILED', color: '#DC2626', bg: '#FFF6F6', border: '#EFC8C8' },
  'not-configured': { label: 'NOT CONFIGURED', color: '#D87800', bg: '#FFFAF0', border: '#F2DFBC', sub: 'Credentials missing in backend/api/config/mail_config.php' },
  untested: { label: 'CONFIGURED — NOT TESTED', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', sub: 'SMTP credentials are configured. Test the connection before relying on email delivery.' },
  connected: { label: 'CONNECTED', color: '#128354', bg: '#F4FBF7', border: '#D6EADF' },
};

const OTP_STATE_META = {
  disabled: { label: 'DISABLED', color: '#DC2626', bg: '#FFF6F6', border: '#EFC8C8', dot: '#DC2626',
    sub: 'OTP verification is unavailable because the required OTP table has not been installed.' },
  'no-smtp': { label: 'ENABLED', color: '#D87800', bg: '#FFFAF0', border: '#F2DFBC', dot: '#EC9000',
    sub: 'OTP email delivery is unavailable until SMTP is configured.' },
  untested: { label: 'CONFIGURED — NOT TESTED', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B',
    sub: 'Test the SMTP connection before relying on OTP email delivery.' },
  ready: { label: 'READY', color: '#128354', bg: '#F4FBF7', border: '#D6EADF', dot: '#138A56',
    sub: '✓ OTP verification is ready' },
};

export default function SystemEmailOtpSection() {
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  const [guideOpen, setGuideOpen] = useState(false);

  /* OTP test delivery */
  const [otpSending, setOtpSending] = useState(false);
  const [otpResult, setOtpResult] = useState(null);

  /* Recent security activity (real audit data) */
  const [activity, setActivity] = useState(null);
  const SECURITY_ACTIONS = ['login', 'login_failed', 'test_smtp', 'update_settings'];

  const load = useCallback(async () => {
    setError(false);
    try { setData(await apiFetch('settings/mail_status.php')); }
    catch { setError(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Recent security-related activity */
  useEffect(() => {
    apiFetch('activity/list.php?limit=25')
      .then((d) => {
        const items = Array.isArray(d?.items) ? d.items : [];
        setActivity(items.filter((i) => SECURITY_ACTIONS.includes(i.action)).slice(0, 5));
      })
      .catch(() => setActivity([]));
  }, []);

  async function sendTestOtp() {
    if (otpSending) return;
    setOtpSending(true);
    setOtpResult(null);
    try {
      const d = await apiFetch('settings/test_smtp.php', { method: 'POST', body: { action: 'send_test_otp' } });
      setOtpResult({ ok: true, message: d.message || 'Test OTP sent.' });
      showToast('Test OTP sent to the configured mailbox.');
      load();
    } catch (err) {
      setOtpResult({ ok: false, message: err.message || 'Could not send the test OTP.' });
      showToast(err.message || 'Could not send the test OTP.', 'error');
    } finally {
      setOtpSending(false);
    }
  }

  const ACTIVITY_META = {
    login: { icon: '✓', label: 'Login Successful', cls: 'bg-[#E8F8EF] text-[#12945A]', status: 'Success', statusCls: 'bg-[#E8F8EF] text-[#138B58]' },
    login_failed: { icon: '!', label: 'Failed Login Attempt', cls: 'bg-[#FFF4DF] text-[#E89600]', status: 'Warning', statusCls: 'bg-[#FFF0DC] text-[#D98300]' },
    test_smtp: { icon: '✉', label: 'Email / SMTP Activity', cls: 'bg-[#EAF2FF] text-[#1769ED]', status: 'Info', statusCls: 'bg-[#EAF2FF] text-[#1769ED]' },
    update_settings: { icon: '⚙', label: 'Settings Changed', cls: 'bg-[#F3EDFF] text-[#7C4EE4]', status: 'Info', statusCls: 'bg-[#F3EDFF] text-[#7548D4]' },
  };

  function fmtActivityDate(v) {
    const d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d.getTime()) ? v : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  async function refreshStatus() {
    await load();
    showToast('Email & OTP status refreshed.');
  }

  async function testConnection() {
    setTesting(true);
    try {
      const d = await apiFetch('settings/test_smtp.php', { method: 'POST', body: { action: 'test_connection' } });
      setTestResult({ ok: true, message: d.message || 'SMTP connection and authentication successful.', server: d.server, security: d.security, at: new Date() });
      showToast('SMTP connection successful.');
      load();
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'SMTP test failed.', server: null, security: null, at: new Date() });
      showToast(err.message || 'SMTP test failed.', 'error');
    } finally {
      setTesting(false);
    }
  }

  async function sendTestEmail(e) {
    e.preventDefault();
    const email = testEmail.trim();
    if (!email) { setEmailResult({ ok: false, message: 'Please enter a recipient email address.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailResult({ ok: false, message: 'Please enter a valid email address.' }); return; }
    setSending(true);
    setEmailResult(null);
    try {
      const d = await apiFetch('settings/test_smtp.php', { method: 'POST', body: { action: 'send_test_email', to: email } });
      setEmailResult({ ok: true, message: d.message || `Test email sent to ${maskEmailValue(email)}.` });
      showToast('Test email sent.');
    } catch (err) {
      setEmailResult({ ok: false, message: err.message || 'Could not send the test email.' });
      showToast(err.message || 'Could not send the test email.', 'error');
    } finally {
      setSending(false);
    }
  }

  function closeAndResetModal() {
    setModalOpen(false);
    setEmailResult(null);
    setTestEmail('');
  }

  if (error) return <StaffErrorState message="Unable to load email configuration." onRetry={load} />;
  if (!data) return <SkeletonRows rows={5} height="h-16" />;

  const smtpState = testing ? 'testing'
    : (testResult && !testResult.ok) ? 'failed'
    : (testResult && testResult.ok) || data.smtp.last_tested_at ? 'connected'
    : !data.smtp.configured ? 'not-configured'
    : 'untested';

  const smtpMeta = SMTP_STATE_META[smtpState];
  if (smtpState === 'failed') smtpMeta.sub = testResult?.message || 'The last connection attempt failed.';
  if (smtpState === 'connected') smtpMeta.sub = `SMTP connection successful${data.smtp.last_tested_at ? ' • Last tested ' + fmtTested(data.smtp.last_tested_at) : ''}`;

  const otpState = !data.otp.enabled ? 'disabled'
    : data.otp.ready ? 'ready'
    : data.smtp.configured ? 'untested'
    : 'no-smtp';

  const otpMeta = OTP_STATE_META[otpState];

  const smtpDeliveryLabel = !data.smtp.configured ? 'Not Configured'
    : data.smtp.last_tested_at ? 'Connected'
    : 'Not Tested';

  const infoRow = 'min-h-[53px] px-4 flex items-center justify-between border-b border-[#E5E9EF] last:border-b-0';

  return (
    <div className="space-y-5">
      {/* SMTP CARD */}
      <section className="bg-white rounded-[17px] border border-[#E3E8F0] shadow-[0_3px_12px_rgba(15,23,42,0.035),0_1px_3px_rgba(15,23,42,0.025)] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-14 h-14 flex-shrink-0 grid place-items-center bg-[#EDF4FF] text-[#1264E8] rounded-full text-2xl">✉</span>
            <div>
              <h2 className="text-[19px] font-extrabold text-[#14213A] tracking-[-0.2px]">SMTP Configuration</h2>
              <p className="mt-1.5 text-[13px] text-[#66758B]">Configure and test the outgoing email service used by the Xevera Portal.</p>
            </div>
          </div>

          <div className={`min-w-[230px] px-4 py-3 flex items-center gap-2.5 rounded-[9px] border ${smtpState === 'testing' ? 'animate-pulse' : ''}`}
            style={{ borderColor: smtpMeta.border, background: smtpMeta.bg }}>
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${smtpState === 'testing' ? 'animate-ping' : ''}`} style={{ background: smtpMeta.color }} />
            <div>
              <strong className="block text-xs font-extrabold" style={{ color: smtpMeta.color }}>{smtpMeta.label}</strong>
              <small className="block mt-1 text-[11px] text-[#687990]">{smtpMeta.sub}</small>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] mt-6">
          <div className="border border-[#E1E6EE] rounded-[9px] overflow-hidden">
            {[['◎', 'SMTP Host', data.smtp.host || '—'], ['▣', 'Port', data.smtp.port || '—'], ['◇', 'Security', data.smtp.security || '—']].map(([icon, label, value]) => (
              <div key={label} className={infoRow}>
                <span className="flex items-center gap-3 text-[13px] text-[#596A82]"><span className="w-5 text-center text-base text-[#566983]">{icon}</span>{label}</span>
                <strong className="text-[13px] font-extrabold text-[#152238]">{value}</strong>
              </div>
            ))}
          </div>

          <div className="border border-[#E1E6EE] rounded-[9px] overflow-hidden">
            {[['♙', 'Mailbox / Username', data.smtp.username_masked || '—'],
              ['▣', 'Password', data.smtp.password_configured ? 'Configured ✓' : 'Not configured', data.smtp.password_configured],
              ['✉', 'From Email', data.smtp.from ? maskEmailValue(data.smtp.from) : '—']].map(([icon, label, value, success]) => (
              <div key={label} className={infoRow}>
                <span className="flex items-center gap-3 text-[13px] text-[#596A82]"><span className="w-5 text-center text-base text-[#566983]">{icon}</span>{label}</span>
                <strong className={`text-[13px] font-extrabold ${success ? 'text-[#138A56]' : 'text-[#152238]'}`}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <button onClick={refreshStatus}
            className="h-[42px] px-5 inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#1468ED] bg-white text-[#1264E8] text-xs font-bold hover:bg-[#F1F6FF] transition-colors cursor-pointer">
            ⟳ Refresh Status
          </button>
          <button onClick={testConnection} disabled={testing}
            className="h-[42px] px-5 min-w-[195px] inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#1468ED] bg-[#1468ED] text-white text-xs font-bold hover:bg-[#075BD8] disabled:opacity-65 disabled:cursor-not-allowed transition-colors cursor-pointer">
            {testing ? '⟳ Testing...' : '➤ Test Connection'}
          </button>
          <button onClick={() => setModalOpen(true)}
            className="h-[42px] px-5 min-w-[195px] inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#1468ED] bg-white text-[#1264E8] text-xs font-bold hover:bg-[#F1F6FF] transition-colors cursor-pointer">
            ✉ Send Test Email
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 min-h-[80px] p-4 flex flex-wrap items-center gap-3.5 rounded-[9px] border ${testResult.ok ? 'border-[#BEE7D1] bg-[#F2FBF6]' : 'border-[#EFC8C8] bg-[#FFF6F6]'}`}>
            <span className={`w-10 h-10 flex-shrink-0 grid place-items-center rounded-full border-2 text-xl font-extrabold ${testResult.ok ? 'border-[#15945D] text-[#15945D]' : 'border-[#D84848] text-[#D84848]'}`}>
              {testResult.ok ? '✓' : '!'}
            </span>
            <div className="flex-1 min-w-[200px]">
              <strong className={`block text-sm font-extrabold ${testResult.ok ? 'text-[#138653]' : 'text-[#C63838]'}`}>
                {testResult.ok ? 'SMTP Connection Successful' : 'SMTP Connection Failed'}
              </strong>
              <p className="mt-1 text-[11px] text-[#63748B]">{testResult.message}</p>
            </div>
            {testResult.ok && (<>
              <div className="min-w-[115px]"><span className="block text-[10px] text-[#148856] mb-1">Server</span><strong className="text-xs text-[#27364C]">{testResult.server}</strong></div>
              <div className="min-w-[115px]"><span className="block text-[10px] text-[#148856] mb-1">Security</span><strong className="text-xs text-[#27364C]">{testResult.security}</strong></div>
              <div className="min-w-[115px]"><span className="block text-[10px] text-[#148856] mb-1">Authentication</span><strong className="text-xs text-[#27364C]">Successful</strong></div>
            </>)}
            <div className="min-w-[115px]">
              <span className={`block text-[10px] mb-1 ${testResult.ok ? 'text-[#148856]' : 'text-[#C63838]'}`}>Last Tested</span>
              <strong className="text-xs text-[#27364C]">{testResult.at.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong>
            </div>
          </div>
        )}

        <div className="mt-4 px-4 py-3 flex items-center gap-2.5 rounded-[8px] bg-[#F5F8FF] border border-[#DCE8FB] text-[11px] text-[#60718A]">
          <span className="text-[#1264E8] text-base">◇</span>
          SMTP credentials are stored securely on the server and are never exposed to the browser.
        </div>
      </section>

      {/* OTP CARD */}
      <section className="bg-white rounded-[17px] border border-[#E3E8F0] shadow-[0_3px_12px_rgba(15,23,42,0.035),0_1px_3px_rgba(15,23,42,0.025)] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-14 h-14 flex-shrink-0 grid place-items-center bg-[#EAF9F1] text-[#138A56] rounded-full text-2xl">♢</span>
            <div>
              <h2 className="text-[19px] font-extrabold text-[#14213A] tracking-[-0.2px]">OTP Service</h2>
              <p className="mt-1.5 text-[13px] text-[#66758B]">One-Time Password verification used for account recovery and email verification.</p>
            </div>
          </div>

          <div className={`min-w-[230px] px-4 py-3 flex items-center gap-2.5 rounded-[9px] border ${otpState === 'ready' ? '' : ''}`}
            style={{ borderColor: otpMeta.border, background: otpMeta.bg }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: otpMeta.dot }} />
            <div>
              <strong className="block text-xs font-extrabold" style={{ color: otpMeta.color }}>{otpMeta.label}</strong>
              <small className={`block mt-1 text-[11px] ${otpState === 'ready' ? 'text-[#128354] font-bold' : 'text-[#687990]'}`}>{otpMeta.sub}</small>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5 mt-6">
          {[['⚙', 'OTP Status', data.otp.enabled ? 'Enabled' : 'Disabled', !data.otp.enabled],
            ['⚙', 'Delivery Method', data.otp.delivery || 'Email', false],
            ['◈', 'OTP Expiration', `${data.otp.expires_minutes} minutes`, false],
            ['▣', 'Maximum Attempts', `${data.otp.max_attempts ?? 5} attempts`, false],
            ['✉', 'SMTP Delivery', smtpDeliveryLabel, smtpDeliveryLabel !== 'Connected']].map(([icon, label, value, warn]) => (
            <div key={label} className="min-h-[55px] px-4 grid grid-cols-[25px_1fr_auto] items-center gap-2 border border-[#E1E6EE] rounded-[8px]">
              <span className="text-[#65758C]">{icon}</span>
              <span className="text-[12px] text-[#65758C]">{label}</span>
              <strong className={`text-xs font-extrabold ${warn ? 'text-[#D87800]' : 'text-[#18273D]'}`}>{value}</strong>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
          <button onClick={sendTestOtp} disabled={otpSending || !data.smtp.configured || !data.otp.enabled}
            title={!data.smtp.configured ? 'Configure SMTP first' : !data.otp.enabled ? 'OTP service is not installed' : 'Send a test OTP to the configured mailbox'}
            className="h-[42px] px-5 min-w-[185px] inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#1468ED] bg-[#1468ED] text-white text-xs font-bold hover:bg-[#075BD8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer">
            {otpSending ? '⟳ Sending...' : '➤ Send Test OTP'}
          </button>
          <p className="text-[11px] text-[#7388A2] flex-1 min-w-[220px] m-0">
            <strong className="block text-[#4F6682]">Send a test OTP</strong>
            {data.smtp.username_masked
              ? <>Delivers a one-time password to the configured mailbox ({data.smtp.username_masked}). The test code is not stored and cannot be used to log in.</>
              : 'Configure SMTP to enable OTP delivery.'}
          </p>
        </div>

        {otpResult && (
          <div className={`mt-3 px-3.5 py-2.5 rounded-[8px] text-xs font-semibold ${otpResult.ok ? 'bg-[#EFFAF4] text-[#138A56]' : 'bg-[#FFF4F4] text-[#C63838]'}`}>
            {otpResult.ok ? '✓ ' : '! '}{otpResult.message}
          </div>
        )}

        {otpState === 'no-smtp' && (
          <div className="mt-3.5 px-4 py-3.5 flex flex-wrap items-center gap-3 rounded-[9px] bg-[#FFFAF0] border border-[#F2D9AA]">
            <span className="w-[29px] h-[29px] flex-shrink-0 grid place-items-center rounded-full bg-[#EF8B00] text-white font-extrabold">!</span>
            <div className="flex-1 min-w-[240px]">
              <strong className="block text-xs text-[#1E293B]">SMTP is not configured. OTP codes can be generated but cannot be emailed.</strong>
              <p className="mt-1.5 text-[11px] text-[#697990]">Configure the credentials in <code className="px-1.5 py-0.5 rounded bg-[#FFF0D4] text-[#9C6100]">backend/api/config/mail_config.php</code> to enable OTP email delivery.</p>
            </div>
            <button onClick={() => setGuideOpen(true)}
              className="h-10 px-4 inline-flex items-center gap-2 self-end rounded-[8px] border border-[#1468ED] bg-white text-[#1264E8] text-xs font-bold hover:bg-[#F2F7FF] transition-colors cursor-pointer whitespace-nowrap">
              ▣ View Setup Guide
            </button>
          </div>
        )}

        {otpState === 'untested' && (
          <div className="mt-3.5 px-4 py-3.5 flex flex-wrap items-center gap-3 rounded-[9px] bg-[#FFFBEB] border border-[#FDE68A]">
            <span className="w-[29px] h-[29px] flex-shrink-0 grid place-items-center rounded-full bg-[#F59E0B] text-white font-extrabold">!</span>
            <div className="flex-1 min-w-[240px]">
              <strong className="block text-xs text-[#1E293B]">SMTP credentials are present, but the connection has not yet been successfully tested.</strong>
              <p className="mt-1.5 text-[11px] text-[#697990]">Use Test Connection above before relying on OTP email delivery.</p>
            </div>
          </div>
        )}
      </section>

      {/* RECENT SECURITY ACTIVITY */}
      <section className="bg-white rounded-[17px] border border-[#E3E8F0] shadow-[0_3px_12px_rgba(15,23,42,0.035),0_1px_3px_rgba(15,23,42,0.025)] overflow-hidden">
        <div className="px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 flex-shrink-0 grid place-items-center bg-[#EDF4FF] text-[#1264E8] rounded-full text-xl">◷</span>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#14213A]">Recent Security Activity</h2>
              <p className="mt-1 text-[11px] text-[#66758B]">Latest logins, failed attempts, and security-related changes.</p>
            </div>
          </div>
          <button onClick={() => { window.location.hash = '#/activity'; }}
            className="self-start sm:self-auto h-[38px] px-4 inline-flex items-center rounded-[7px] border border-[#1468ED] bg-white text-[#1264E8] text-[11px] font-bold hover:bg-[#F1F6FF] transition-colors cursor-pointer">
            View All Activity
          </button>
        </div>

        <div className="px-6 pb-5 overflow-x-auto">
          {!activity ? (
            <SkeletonRows rows={4} height="h-11" />
          ) : activity.length === 0 ? (
            <StaffEmptyState title="No security activity yet." description="Logins and OTP/email events will appear here." />
          ) : (
            <table className="w-full min-w-[680px] border border-[#E0E6EE] rounded-[9px] overflow-hidden border-separate border-spacing-0">
              <thead>
                <tr>
                  {['Event', 'User', 'Role', 'Status', 'Time'].map((h) => (
                    <th key={h} className="bg-[#F8FAFC] text-[#71839A] text-[9px] uppercase tracking-[0.5px] text-left px-3 py-2.5 border-b border-[#E1E7EE]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((ev) => {
                  const meta = ACTIVITY_META[ev.action] || ACTIVITY_META.login;
                  const failed = ev.action === 'login_failed';
                  const detail = ev.detail || (failed ? 'Invalid credentials entered' : meta.label);
                  return (
                    <tr key={ev.id}>
                      <td className="px-3 py-2.5 border-b border-[#E8EDF3] last:border-b-0">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 flex-shrink-0 grid place-items-center rounded-full text-[11px] font-extrabold ${meta.cls}`}>{meta.icon}</span>
                          <div>
                            <strong className="block text-[11px] text-[#1E293B]">{meta.label}</strong>
                            <span className="block text-[10px] text-[#8293A8] truncate max-w-[260px]">{detail}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E8EDF3] last:border-b-0 text-[11px] font-bold text-[#1E293B]">{ev.user_name || 'System'}</td>
                      <td className="px-3 py-2.5 border-b border-[#E8EDF3] last:border-b-0">
                        <span className="inline-block rounded-full px-2 py-1 text-[9px] font-extrabold bg-[#F1EAFF] text-[#7548D4]">{ev.user_role || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E8EDF3] last:border-b-0">
                        <span className={`inline-block rounded-full px-2 py-1 text-[9px] font-extrabold ${meta.statusCls}`}>{failed ? '! Warning' : `✓ ${meta.status}`}</span>
                      </td>
                      <td className="px-3 py-2.5 border-b border-[#E8EDF3] last:border-b-0 text-[10px] text-[#64748B] whitespace-nowrap">{fmtActivityDate(ev.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="min-h-[47px] px-4 py-3 flex flex-wrap items-center gap-2.5 rounded-[8px] bg-[#F5F8FF] border border-[#DCE8FB] text-[11px] text-[#5F718C]">
        <span className="text-[#1264E8] text-base">◇</span>
        <span>SMTP credentials are stored securely on the server and are never exposed to the browser.</span>
        <button onClick={() => setGuideOpen(true)} className="ml-auto border-none bg-transparent text-[#1264E8] text-[11px] font-bold hover:underline cursor-pointer">
          Learn more about email &amp; OTP setup ↗
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-[rgba(15,23,42,0.48)] backdrop-blur-[3px]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeAndResetModal(); }}>
          <form onSubmit={sendTestEmail} className="w-full max-w-[500px] overflow-hidden rounded-[15px] bg-white shadow-[0_25px_70px_rgba(15,23,42,0.25)]">
            <div className="p-[22px] pb-[17px] flex items-start justify-between gap-4 border-b border-[#E7EBF0]">
              <div>
                <span className="text-[10px] font-extrabold tracking-wide text-[#1264E8]">EMAIL SERVICE</span>
                <h2 className="mt-1.5 text-xl font-extrabold text-[#14213A]">Send Test Email</h2>
                <p className="mt-1 text-xs text-[#64748B]">Verify that your configured SMTP server can deliver email.</p>
              </div>
              <button type="button" onClick={closeAndResetModal} aria-label="Close"
                className="w-8 h-8 grid place-items-center rounded-[7px] border-none bg-[#F2F4F7] text-[#64748B] text-xl hover:bg-[#E8EBEF] cursor-pointer">×</button>
            </div>

            <div className="p-[22px]">
              <label className="block mb-2 text-xs font-bold text-[#26364B]">Recipient Email</label>
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="example@gmail.com" autoFocus
                className="w-full h-11 px-3.5 rounded-[8px] border border-[#D8E0E9] text-[13px] text-[#1E293B] outline-none focus:border-[#1468ED] focus:shadow-[0_0_0_3px_rgba(20,104,237,0.1)] placeholder:text-[#94A3B8]" />

              <div className="mt-3 p-3 flex gap-2.5 rounded-[7px] bg-[#F4F8FF] text-[11px] leading-relaxed text-[#60728C]">
                <span>ℹ</span>
                <span>The email will be sent using your existing SMTP configuration. Your SMTP password will not be exposed.</span>
              </div>

              {emailResult && (
                <div className={`mt-3 p-2.5 rounded-[7px] text-xs font-semibold ${emailResult.ok ? 'bg-[#EFFAF4] text-[#138A56]' : 'bg-[#FFF4F4] text-[#C63838]'}`}>
                  {emailResult.ok ? '✓ ' : '! '}{emailResult.message}
                </div>
              )}
            </div>

            <div className="px-[22px] py-3.5 flex justify-end gap-2 border-t border-[#E7EBF0] bg-[#FAFBFC]">
              <button type="button" onClick={closeAndResetModal}
                className="h-10 px-4 rounded-[7px] border border-[#D8E0E9] bg-white text-xs font-bold text-[#52627A] hover:bg-[#F3F5F8] cursor-pointer">Cancel</button>
              <button type="submit" disabled={sending}
                className="h-10 px-4 rounded-[7px] border border-[#1264E8] bg-[#1264E8] text-xs font-bold text-white hover:bg-[#0B54CE] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">
                {sending ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </form>
        </div>
      )}

      {guideOpen && <SetupGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
