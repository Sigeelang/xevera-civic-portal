import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';
import OtpVerificationPage from '../../pages/auth/OtpVerificationPage';

/*
 * OTP-protected Change Email flow:
 *   current + new Gmail -> "Send Verification Code"
 *   -> email_change OTP sent to the NEW address (email_change_init.php)
 *   -> existing OTP verification page (verify-otp.php / resend-otp.php)
 *   -> on success the account email is updated by
 *      email_change_complete.php and marked verified.
 * The old address stays untouched until verification succeeds.
 */
export default function ResidentChangeEmailModal({ open, email, onClose, onChanged }) {
  const toast = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [completing, setCompleting] = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNewEmail('');
      setError('');
      setOtpStep(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  async function sendCode(e) {
    e.preventDefault();
    if (!newEmail.trim()) { setError('Please enter your new Gmail address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) { setError('Please enter a valid Gmail address.'); return; }
    if (newEmail.trim().toLowerCase() === String(email || '').toLowerCase()) { setError('The new email is the same as your current one.'); return; }
    setSending(true);
    setError('');
    try {
      const data = await apiFetch('profile/email_change_init.php', { method: 'POST', body: { new_email: newEmail.trim().toLowerCase() } });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to send the verification code. Please try again.');
      }
      toast(data.message || 'Verification code sent to your new email.');
      setOtpStep(true);
    } catch (err) {
      setError(err.message || 'Could not send the verification code.');
    } finally {
      setSending(false);
    }
  }

  async function completeChange() {
    if (completing) return;
    setCompleting(true);
    try {
      const data = await apiFetch('profile/email_change_complete.php', {
        method: 'POST',
        body: { new_email: newEmail.trim().toLowerCase() },
      });
      toast(data.message || 'Your Gmail address has been changed and verified successfully.');
      onChanged && onChanged(data.email);
      onClose && onClose();
    } catch (err) {
      toast(err.message || 'Could not change your email.', 'error');
    } finally {
      setCompleting(false);
    }
  }

  if (otpStep) {
    return (
      <OtpVerificationPage
        email={newEmail.trim()}
        purpose="email_change"
        onVerified={completeChange}
        onLogin={() => setOtpStep(false)}
      />
    );
  }

  const inputCls = 'w-full h-[48px] border border-[#D7E0EC] rounded-[11px] px-3.5 text-[12px] text-[#102044] bg-white outline-none transition-colors focus:border-[#145BEA] focus:shadow-[0_0_0_3px_rgba(20,91,234,0.09)] placeholder:text-[#A1ACBC]';

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[3000] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-[rgba(13,25,45,0.62)] backdrop-blur-[7px] overflow-y-auto" onClick={(e) => { if (e.target === overlayRef.current) onClose && onClose(); }}>
      <div className="w-full max-w-[620px] bg-white rounded-[22px] shadow-[0_25px_70px_rgba(18,35,65,0.22)] overflow-hidden my-2 animate-[modalRise_220ms_ease]">
        {/* Header */}
        <div className="relative pt-7 pb-5 px-8 sm:px-9 text-center">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-5 w-9 h-9 rounded-[10px] bg-[#F3F6FA] text-[#69778D] text-[22px] leading-none hover:bg-[#E8EDF4] hover:text-[#102044] transition-colors cursor-pointer">×</button>
          <div className="w-[62px] h-[62px] mx-auto mb-3.5 rounded-full bg-[#EDF4FF] text-[#145BEA] grid place-items-center text-[28px] shadow-[0_5px_15px_rgba(20,91,234,0.08)]">✉</div>
          <h2 className="text-[24px] font-head font-extrabold text-[#102044] tracking-[-0.3px]">Change Email</h2>
          <p className="max-w-[430px] mx-auto mt-1.5 text-[13px] text-[#7B889D] leading-relaxed">
            We&apos;ll send a verification code to your new Gmail address. Your current email stays active until the code is verified.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 sm:px-9 pb-8">
          {/* Account box */}
          <div className="flex items-center gap-3.5 p-3.5 border border-[#DFE6F0] rounded-[13px] mb-4 bg-white">
            <div className="w-[44px] h-[44px] rounded-[12px] bg-[#EDF4FF] text-[#145BEA] grid place-items-center font-black text-[19px] flex-shrink-0">◆</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-extrabold text-[#102044]">Current Gmail</div>
              <div className="text-[11px] text-[#7B889D] mt-1 truncate">{email || '—'}</div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[20px] bg-[#EAF9F1] text-[#159C59] text-[9px] font-extrabold whitespace-nowrap flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-current" />Verified
            </span>
          </div>

          <form onSubmit={sendCode} noValidate>
            <label className="block text-[11px] font-extrabold text-[#102044] mb-1.5">New Gmail Address</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="your.new@gmail.com"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
              className={inputCls}
            />

            {error && (
              <div className="mt-3 p-3 rounded-[10px] bg-[#FDECEC] border border-[#F5C7C7] text-[#B91C1C] text-[10px]">{error}</div>
            )}

            <div className="mt-4 p-3.5 rounded-[13px] bg-[#F2F7FF] border border-[#D5E4FF] flex gap-3">
              <span className="w-8 h-8 rounded-[9px] bg-white text-[#145BEA] grid place-items-center text-[15px] flex-shrink-0">🔒</span>
              <div className="text-[10px] text-[#637695] leading-relaxed">
                For your security, the change only takes effect after you enter the code sent to your new Gmail.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.45fr] gap-2.5 pt-5">
              <button type="button" onClick={onClose} className="h-[46px] rounded-[10px] bg-white text-[#526077] text-[11px] font-extrabold border border-[#DCE3ED] hover:bg-[#F5F7FA] transition-colors cursor-pointer">Cancel</button>
              <button type="submit" disabled={sending} className="h-[46px] rounded-[10px] bg-[#145BEA] text-white text-[11px] font-extrabold border border-[#145BEA] hover:bg-[#0B48C9] disabled:opacity-55 disabled:cursor-not-allowed transition-colors cursor-pointer">
                {sending ? 'Sending...' : (<><span>Send Verification Code</span> <span className="ml-2">→</span></>)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
