import { useState } from 'react';
import './SuperAdminRecoveryPage.css';

const API = '/api/auth/super-admin-recovery.php';

function passwordIssues(pw) {
  const issues = [];
  if (pw.length < 8) issues.push('length');
  if (!/[A-Z]/.test(pw)) issues.push('upper');
  if (!/[a-z]/.test(pw)) issues.push('lower');
  if (!/[0-9]/.test(pw)) issues.push('number');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('special');
  return issues;
}

async function postJson(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || !data) {
    throw new Error((data && data.error) || 'Request failed. Please try again.');
  }
  return data;
}

export default function SuperAdminRecoveryPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [status, setStatus] = useState(null); // {type:'success'|'error', text}
  const [submitting, setSubmitting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);

  function sanitizeCode(v) {
    return v.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (!fullName.trim()) { setStatus({ type: 'error', text: 'Please enter your full name.' }); return; }
    if (!email.trim()) { setStatus({ type: 'error', text: 'Please enter your official email address.' }); return; }
    if (!recoveryCode.trim()) { setStatus({ type: 'error', text: 'Please enter your recovery code.' }); return; }
    if (passwordIssues(password).length) { setStatus({ type: 'error', text: 'Password does not meet the required security requirements.' }); return; }
    if (password !== confirmPassword) { setStatus({ type: 'error', text: 'Passwords do not match.' }); return; }

    setSubmitting(true);
    try {
      const data = await postJson({
        action: 'request',
        full_name: fullName.trim(),
        email: email.trim(),
        recovery_code: recoveryCode.trim(),
        new_password: password,
        confirm_password: confirmPassword,
      });
      setOtp('');
      setOtpOpen(true);
      setStatus({ type: 'success', text: data.message || 'A verification code has been sent to your official email address.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) { alert('Please enter the verification code.'); return; }
    setVerifying(true);
    try {
      const data = await postJson({
        action: 'confirm',
        full_name: fullName.trim(),
        email: email.trim(),
        new_password: password,
        otp: otp.trim(),
      });
      setOtpOpen(false);
      setDone(true);
      setStatus({ type: 'success', text: data.message || 'Super Admin account created successfully.' });
    } catch (err) {
      alert(err.message);
    } finally {
      setVerifying(false);
    }
  }

  function goBack() {
    window.location.href = '/dashboard';
  }

  return (
    <div className="sarec">
      <div className="sarec-bg-circle sarec-circle-left-1" />
      <div className="sarec-bg-circle sarec-circle-left-2" />
      <div className="sarec-bg-circle sarec-circle-right-1" />
      <div className="sarec-bg-circle sarec-circle-right-2" />
      <div className="sarec-dots sarec-dots-top" />
      <div className="sarec-dots sarec-dots-bottom" />

      <div className="sarec-page">
        <div className="sarec-brand">
          <div className="sarec-brand-shield" />
          <div>
            <div className="sarec-brand-name">XEVERA</div>
            <div className="sarec-brand-subtitle">CIVIC REPORTING SYSTEM</div>
          </div>
        </div>

        <div className="sarec-card">
          <div className="sarec-portal-icon"><div className="sarec-shield" /></div>
          <div className="sarec-portal-label">🛡 SECURE RECOVERY</div>
          <h1 className="sarec-portal-title">Super Admin Recovery Portal</h1>
          <p className="sarec-portal-description">Create or restore an authorized Super Admin account.</p>
          <div className="sarec-divider"><span /></div>

          <div className="sarec-warning">
            <div className="sarec-warning-icon">!</div>
            <div>
              <strong>AUTHORIZED ACCESS ONLY</strong>
              <p>This portal is for emergency account recovery of the Super Admin account only. Unauthorized use or attempts to create unauthorized accounts are strictly prohibited and may be subject to investigation.</p>
            </div>
          </div>

          {done ? (
            <div>
              {status && <div className={`sarec-status ${status.type}`}>{status.text}</div>}
              <button type="button" className="sarec-btn sarec-primary-btn" onClick={goBack}>
                Go to Management Portal →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="sarec-form-group">
                <label htmlFor="sarec-name">Full Name</label>
                <div className="sarec-input-wrap">
                  <span className="sarec-input-icon">♙</span>
                  <input id="sarec-name" type="text" placeholder="Enter your full name" autoComplete="name"
                    value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              </div>

              <div className="sarec-form-group">
                <label htmlFor="sarec-email">Official Email Address</label>
                <div className="sarec-input-wrap">
                  <span className="sarec-input-icon">✉</span>
                  <input id="sarec-email" type="email" placeholder="Enter your official email address" autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="sarec-helper">Use your official organizational email address.</div>
              </div>

              <div className="sarec-form-group">
                <label htmlFor="sarec-code">Recovery Code</label>
                <div className="sarec-input-wrap">
                  <span className="sarec-input-icon">⚿</span>
                  <input id="sarec-code" type="text" placeholder="Enter the recovery code" autoComplete="off"
                    value={recoveryCode} onChange={(e) => setRecoveryCode(sanitizeCode(e.target.value))} required />
                </div>
                <div className="sarec-helper">Enter the valid recovery code provided by the system administrator.</div>
              </div>

              <div className="sarec-form-group">
                <label htmlFor="sarec-pw">New Password</label>
                <div className="sarec-input-wrap">
                  <span className="sarec-input-icon">▣</span>
                  <input id="sarec-pw" type={showPw ? 'text' : 'password'} placeholder="Create a new password" autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" className="sarec-password-toggle" aria-label={showPw ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPw((v) => !v)} style={{ display: 'grid', placeItems: 'center' }}>
                    {showPw ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.3" /><path d="M4 4l16 16" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="sarec-form-group">
                <label htmlFor="sarec-pw2">Confirm Password</label>
                <div className="sarec-input-wrap">
                  <span className="sarec-input-icon">▣</span>
                  <input id="sarec-pw2" type={showPw2 ? 'text' : 'password'} placeholder="Confirm your new password" autoComplete="new-password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  <button type="button" className="sarec-password-toggle" aria-label={showPw2 ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPw2((v) => !v)} style={{ display: 'grid', placeItems: 'center' }}>
                    {showPw2 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.3" /><path d="M4 4l16 16" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="sarec-requirements">
                <div className="sarec-requirements-icon">✓</div>
                <div>
                  <div className="sarec-requirements-title">Password Requirements:</div>
                  <ul>
                    <li>At least 8 characters long</li>
                    <li>Include uppercase and lowercase letters</li>
                    <li>Include at least one number</li>
                    <li>Include at least one special character</li>
                  </ul>
                </div>
              </div>

              <div className="sarec-verification">
                <div className="sarec-verification-icon">✓</div>
                <div>
                  <strong>Identity verification required</strong>
                  <span>You must provide a valid recovery code and official email to proceed.</span>
                </div>
              </div>

              {status && <div className={`sarec-status ${status.type}`}>{status.text}</div>}

              <button type="submit" className="sarec-btn sarec-primary-btn" disabled={submitting}>
                {submitting ? 'Sending Code...' : 'Create Super Admin Account →'}
              </button>
              <button type="button" className="sarec-btn sarec-secondary-btn" onClick={goBack}>
                ← Back to Management Portal
              </button>
            </form>
          )}
        </div>

        <div className="sarec-footer">
          <div className="sarec-security">🛡 Your data is protected with enterprise-grade security.</div>
          <div>© 2026 <strong>Xevera Portal</strong>. All rights reserved.</div>
        </div>
      </div>

      <div className={`sarec-modal${otpOpen ? ' show' : ''}`}>
        <div className="sarec-modal-card" role="dialog" aria-modal="true" aria-label="Verify your email">
          <div className="sarec-modal-icon">✉</div>
          <h2>Verify Your Email</h2>
          <p>A verification code has been sent to your official email address. Enter the code below to continue.</p>
          <input type="text" inputMode="numeric" className="sarec-otp-input" maxLength={6}
            placeholder="••••••" value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
          <button className="sarec-btn sarec-primary-btn" onClick={handleVerifyOtp} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify & Create Account'}
          </button>
          <button className="sarec-btn sarec-secondary-btn" onClick={() => setOtpOpen(false)} disabled={verifying}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
