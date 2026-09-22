import { useMemo, useState, useRef, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import OtpVerificationPage from './OtpVerificationPage';
import RegistrationPendingPage from './RegistrationPendingPage';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_EXT = '.jpg,.jpeg,.png';
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_PROOFS = 2;

export default function RegisterPage({ onAuth, onLogin, onBack }) {
  const showToast = useToast();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [otpEmail, setOtpEmail] = useState(null);
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [recipientHint, setRecipientHint] = useState('');
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });

  const [proofs, setProofsState] = useState([]);
  const proofsRef = useRef([]);
  function setProofs(next) {
    const val = typeof next === 'function' ? next(proofsRef.current) : next;
    proofsRef.current = val;
    setProofsState(val);
  }
  const [proofUploading, setProofUploading] = useState(false);
  const [proofError, setProofError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const fileInputRef = useRef(null);

  const pwRules = useMemo(() => ({
    length: values.password.length >= 8,
    number: /\d/.test(values.password),
    uppercase: /[A-Z]/.test(values.password),
    special: /[^A-Za-z0-9]/.test(values.password),
  }), [values.password]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
  const validName = values.fullName.trim().length >= 2;
  const validPassword = Object.values(pwRules).every(Boolean);
  const passwordsMatch = values.confirmPassword.length > 0 && values.confirmPassword === values.password;
  const hasProof = proofs.length > 0;
  const canSubmit = validName && validEmail && validPassword && passwordsMatch && terms && hasProof && !loading && !proofUploading;

  function setValue(key) {
    return (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function markTouched(key) {
    return () => setTouched((t) => (t[key] ? t : ({ ...t, [key]: true })));
  }

  const showNameError = !!touched.fullName && !validName;
  const showEmailError = !!touched.email && values.email.trim().length > 0 && !validEmail;
  const showMismatch = !passwordsMatch && (values.confirmPassword.length > 0 || !!touched.confirmPassword);

  const handleProofUpload = useCallback(async (incoming) => {
    setProofError('');
    const files = Array.from(incoming || []).filter((f) => f && f.size > 0);
    if (!files.length || proofUploading) return;

    const slotsLeft = MAX_PROOFS - proofsRef.current.length;
    if (slotsLeft <= 0) {
      setProofError('Maximum 2 images uploaded.');
      return;
    }
    if (files.length > slotsLeft) {
      setProofError(`Maximum 2 images allowed. Only ${slotsLeft === 1 ? '1 image was' : `${slotsLeft} images were`} added.`);
    }
    const batch = files.slice(0, slotsLeft);
    if (batch.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
      setProofError('Only JPG, JPEG, and PNG images are allowed.');
      return;
    }
    if (batch.some((file) => file.size > MAX_SIZE)) {
      setProofError('Each image must be 5 MB or smaller.');
      return;
    }
    await uploadProofBatch(batch);
  }, [proofUploading]);

  async function uploadProofBatch(batch) {
    if (!batch.length) return;
    setProofUploading(true);
    setProofError('');
    try {
      const formData = new FormData();
      batch.forEach((file) => formData.append('proof[]', file));
      const res = await fetch('/api/auth/upload-proof.php', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.files) || !data.files.length) {
        throw new Error(data.error || 'Upload failed.');
      }
      const mapped = data.files.map((f, i) => ({
        filename: f.filename,
        original: f.original_name || batch[i]?.name || 'image',
        size: f.size || batch[i]?.size || 0,
        preview: batch[i] ? URL.createObjectURL(batch[i]) : null,
      }));
      setProofs((prev) => [...prev, ...mapped].slice(0, MAX_PROOFS));
    } catch (err) {
      setProofError(err.message || 'Upload failed.');
    } finally {
      setProofUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleProofUpload(e.dataTransfer.files);
  }

  function onDragOver(e) { e.preventDefault(); setDragOver(true); }
  function onDragLeave(e) { e.preventDefault(); setDragOver(false); }

  function removeProof(index) {
    setProofs((prev) => {
      const target = prev[index];
      if (target && target.preview) {
        try { URL.revokeObjectURL(target.preview); } catch {}
      }
      return prev.filter((_, i) => i !== index);
    });
    setProofError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });
    if (!validName) return setError('Please enter your full name.');
    if (!validEmail) return setError('Please enter a valid email address.');
    if (!validPassword) return setError('Please meet all password requirements.');
    if (!passwordsMatch) return setError('Passwords do not match.');
    if (!hasProof) return setError('Please upload at least one proof-of-residency image.');

    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('auth/register.php', {
        method: 'POST',
        body: {
          name: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
          proof_filenames: proofsRef.current.map((p) => p.filename),
          proof_filename: proofsRef.current[0]?.filename || '',
        },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Unable to create account. Please try again.');
      }
      if (data.pending === true) {
        if (data.mail_sent === false) {
          showToast(data.message || 'Verification email delayed.', 'error');
          setOtpEmail(values.email.trim());
        } else {
          showToast(data.message || 'We sent a verification code to your email.');
          setOtpEmail(values.email.trim());
          setFrom(data.from || 'noreply@xevera.gov.ph');
          setSubject(data.subject || 'Your Xevera Registration Code');
          setRecipientHint(data.recipientHint || '');
        }
        setLoading(false);
        return;
      }
      showToast(data.message || 'Your account has been created and is pending verification.');
      setLoading(false);
      if (onLogin) onLogin();
    } catch (err) {
      setError(err.message || 'Unable to create account. Please try again.');
      setLoading(false);
    }
  }

  // Pending-approval screen wins once registration completes (otpEmail
  // stays set, so this check must come first).
  if (registrationComplete) {
    return <RegistrationPendingPage onLogin={() => onLogin && onLogin()} />;
  }

  if (otpEmail) {
    return (
      <OtpVerificationPage
        email={otpEmail || ''}
        purpose="resident_register"
        fromAddress={from}
        subject={subject}
        recipientHint={recipientHint}
        onVerified={async () => {
          try {
            const done = await apiFetch('auth/complete-registration.php', {
              method: 'POST',
              body: {
                email: otpEmail,
                proof_filenames: proofsRef.current.map((p) => p.filename),
                proof_filename: proofsRef.current[0]?.filename || '',
              },
            });
            if (done.success) {
              setOtpEmail(null);
              setRegistrationComplete(true);
            } else {
              showToast(done.error || 'Could not activate your account. Please try again.', 'error');
            }
          } catch (err) {
            showToast(err.message || 'Could not activate your account. Please try again.', 'error');
          }
        }}
        onLogin={() => onLogin && onLogin()}
      />
    );
  }

  const rulesList = [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'uppercase', label: 'One uppercase letter' },
    { key: 'number', label: 'One number' },
    { key: 'special', label: 'One special character' },
  ];

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', color: '#10284d', background: 'radial-gradient(circle at 15% 18%, rgba(67,135,245,0.17), transparent 23%),radial-gradient(circle at 88% 80%, rgba(67,135,245,0.15), transparent 25%),linear-gradient(135deg,#eef5ff 0%,#ffffff 50%,#edf4ff 100%)', position: 'relative' }}>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0}
:root{--blue:#1264f5;--blue-dark:#0d55d7;--navy:#10284d;--text:#263b60;--muted:#637695;--border:#cfdbeb;--light-blue:#edf5ff}
.background{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.circle-left{position:absolute;width:430px;height:430px;left:-300px;top:-150px;border-radius:50%;border:1px solid rgba(70,130,220,.18);box-shadow:0 0 0 35px rgba(70,130,220,.035),0 0 0 75px rgba(70,130,220,.025)}
.circle-right{position:absolute;width:520px;height:520px;right:-320px;bottom:-280px;border-radius:50%;border:1px solid rgba(70,130,220,.16);box-shadow:0 0 0 38px rgba(70,130,220,.035),0 0 0 85px rgba(70,130,220,.025)}
.dots{position:absolute;width:145px;height:110px;opacity:.55;background-image:radial-gradient(#9dbcf0 1.5px, transparent 1.5px);background-size:18px 18px}
.dots-top{right:70px;top:20px}
.dots-bottom{left:80px;bottom:60px}
.register-page{position:relative;z-index:1;min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 25px}
.register-container{width:min(1100px,100%);display:grid;grid-template-columns:minmax(0,1fr) minmax(500px,540px);align-items:center;gap:70px;margin:0 auto}
.register-left{display:flex;flex-direction:column;justify-content:center;max-width:500px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:65px}
.brand-icon{width:50px;height:50px;border-radius:14px;background:linear-gradient(145deg,#176df5,#1259dd);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 25px rgba(18,100,245,.18)}
.brand-icon svg{width:27px;height:27px}
.brand-name{font-size:25px;line-height:1;font-weight:850;letter-spacing:1px;color:#10284d}
.brand-subtitle{margin-top:4px;color:#1264f5;font-size:9px;font-weight:800;letter-spacing:1.7px}
.welcome-title{color:#10284d;font-size:52px;line-height:1.03;font-weight:850;letter-spacing:-2px;margin-bottom:22px}
.welcome-title span{color:#1264f5}
.welcome-line{width:32px;height:3px;background:#1264f5;margin-bottom:25px;border-radius:4px}
.welcome-text{max-width:440px;color:#496488;font-size:15px;line-height:1.8}
.register-card{width:100%;max-width:540px;margin:0 auto;padding:30px 40px 28px;background:rgba(255,255,255,.97);border:1px solid rgba(207,219,235,.95);border-radius:20px;box-shadow:0 25px 70px rgba(35,75,135,.13);backdrop-filter:blur(14px)}
.card-header{text-align:center;margin-bottom:24px}
.user-circle{width:54px;height:54px;margin:0 auto 16px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#1670ff,#1259dd);box-shadow:0 10px 25px rgba(18,100,245,.18)}
.user-circle svg{width:27px;height:27px}
.card-title{font-size:27px;line-height:1.2;font-weight:800;margin-bottom:7px;color:#10284d}
.card-subtitle{color:#637695;font-size:13px}
.form-group{margin-bottom:17px}
.form-label{display:block;margin-bottom:7px;color:#172b4d;font-size:12px;font-weight:750}
.form-label .required{color:#DC2626;margin-left:3px}
.input-wrapper{position:relative}
.input-icon{position:absolute;left:14px;top:50%;width:18px;height:18px;transform:translateY(-50%);color:#7184a3;pointer-events:none}
.form-input{width:100%;height:43px;padding:0 43px;border:1px solid #cfdbeb;border-radius:9px;outline:none;background:#fff;color:#10284d;font-family:inherit;font-size:13px;transition:.2s ease}
.form-input:focus{border-color:#1264f5;box-shadow:0 0 0 3px rgba(18,100,245,.10)}
.form-input::placeholder{color:#7e91ad}
.email-info{margin-top:-4px;margin-bottom:17px;padding:11px 12px;border-radius:9px;background:#edf5ff;display:flex;gap:10px;color:#49678f}
.email-info-icon{width:20px;height:20px;flex:none;color:#1264f5}
.email-info strong{display:block;color:#1d5fd1;font-size:11px;margin-bottom:3px}
.email-info p{font-size:10px;line-height:1.45}
.password-toggle{position:absolute;right:6px;top:50%;width:32px;height:32px;transform:translateY(-50%);border:0;background:transparent;color:#7184a3;cursor:pointer;display:grid;place-items:center;border-radius:7px}
.password-toggle:hover{background:#f1f6ff;color:#1264f5}
.password-toggle svg{width:17px;height:17px}
.password-rules{margin-top:-3px;margin-bottom:17px;padding:12px;background:#edf5ff;border-radius:9px}
.rules-title{display:flex;align-items:center;gap:7px;margin-bottom:8px;color:#17345e;font-size:11px;font-weight:800}
.rules-icon{width:19px;height:19px;border-radius:5px;background:#1264f5;color:#fff;display:grid;place-items:center}
.rules-icon svg{width:12px;height:12px}
.rules-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px}
.rule{color:#68809f;font-size:10px;display:flex;align-items:center;gap:6px}
.rule::before{content:"✓";color:#a9bbd4;font-size:12px}
.rule.valid{color:#3672cf}
.rule.valid::before{color:#1264f5}
.proof-upload{margin-bottom:17px}
.proof-label{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.proof-label-text{color:#172b4d;font-size:12px;font-weight:750}
.proof-required{color:#DC2626;font-size:11px;font-weight:700}
.proof-helper{color:#637695;font-size:10px;margin-bottom:8px;line-height:1.4}
.proof-dropzone{border:2px dashed #cfdbeb;border-radius:11px;padding:24px 16px;text-align:center;cursor:pointer;transition:all .2s ease;background:#fafcff}
.proof-dropzone:hover,.proof-dropzone.drag-over{border-color:#1264f5;background:#edf5ff}
.proof-dropzone.drag-over{box-shadow:0 0 0 3px rgba(18,100,245,.12)}
.proof-dropzone-icon{width:40px;height:40px;margin:0 auto 10px;border-radius:10px;background:#edf5ff;display:flex;align-items:center;justify-content:center;color:#1264f5}
.proof-dropzone-text{color:#496488;font-size:12px;font-weight:600;margin-bottom:4px}
.proof-dropzone-sub{color:#8494aa;font-size:10px}
.proof-dropzone-sub span{color:#1264f5;font-weight:700}
.proof-accepted{color:#8494aa;font-size:9px;margin-top:8px}
.proof-preview{display:flex;align-items:center;gap:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;margin-top:8px}
.proof-preview img{width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0}
.proof-preview-pdf{width:48px;height:48px;border-radius:6px;background:#fee2e2;display:flex;align-items:center;justify-content:center;color:#DC2626;font-size:10px;font-weight:800}
.proof-preview-info{flex:1;min-width:0}
.proof-preview-name{font-size:11px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.proof-preview-size{font-size:9px;color:#94a3b8;margin-top:2px}
.proof-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
@media(max-width:600px){.proof-grid{grid-template-columns:1fr}}
.proof-dropzone.disabled{cursor:default;background:#f3f6fa}
.proof-dropzone.disabled:hover{border-color:#cfdbeb;background:#f3f6fa}
.proof-counter{font-size:11px;font-weight:700;color:#496488;margin-top:8px;text-align:center}
.proof-remove{background:none;border:1px solid #fecaca;color:#DC2626;font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:all .15s}
.proof-remove:hover{background:#fef2f2;border-color:#DC2626}
.proof-error{color:#DC2626;font-size:10px;margin-top:6px}
.proof-uploading{color:#1264f5;font-size:10px;margin-top:6px;display:flex;align-items:center;gap:6px}
@keyframes proof-spin{to{transform:rotate(360deg)}}
.proof-spinner{width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:#1264f5;border-radius:50%;animation:proof-spin .6s linear infinite}
.terms{display:flex;align-items:flex-start;gap:8px;margin-bottom:17px;color:#657b99;font-size:10px;line-height:1.5}
.terms input{width:16px;height:16px;flex:none;accent-color:#1264f5;cursor:pointer}
.terms a{color:#1264f5;font-weight:700;text-decoration:none}
.create-button{width:100%;height:44px;border:0;border-radius:8px;background:linear-gradient(135deg,#1268f8,#1458d7);color:white;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px rgba(18,100,245,.18);transition:.15s ease}
.create-button:hover{transform:translateY(-1px);box-shadow:0 13px 27px rgba(18,100,245,.23)}
.create-button:disabled{opacity:.65;cursor:wait;transform:none}
.divider{display:flex;align-items:center;gap:12px;margin:17px 0;color:#8494aa;font-size:10px}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:#e1e8f2}
.login-link{text-align:center;color:#637695;font-size:11px}
.login-link a{color:#1264f5;font-weight:800;text-decoration:none;background:none;border:0;cursor:pointer;font-size:11px}
.login-link a:hover{text-decoration:underline}
.message{display:none;margin-top:12px;padding:10px;border-radius:8px;text-align:center;font-size:10px}
.message.show{display:block}
.message.error{color:#a52b24;background:#fff2f1;border:1px solid #ffd4d0}
.message.success{color:#126b45;background:#effbf5;border:1px solid #c9f0dc}
@media(max-width:900px){.register-container{grid-template-columns:1fr;max-width:560px;gap:30px}.register-left{max-width:100%;align-items:center;text-align:center}.brand{margin-bottom:25px}.welcome-title{font-size:42px}.welcome-text{max-width:520px}.register-card{max-width:540px}}
@media(max-width:600px){.register-page{padding:25px 16px}.register-container{gap:24px}.brand{margin-bottom:20px}.brand-icon{width:43px;height:43px}.brand-name{font-size:22px}.brand-subtitle{font-size:8px}.welcome-title{font-size:36px;letter-spacing:-1px}.welcome-text{font-size:13px;line-height:1.6}.register-card{padding:25px 20px}.card-title{font-size:25px}.rules-grid{grid-template-columns:1fr}.dots{display:none}.proof-dropzone{padding:20px 14px}.proof-preview img{width:40px;height:40px}}
@media(max-width:400px){.register-page{padding:20px 12px}.register-card{padding:22px 16px}.welcome-title{font-size:31px}.card-title{font-size:23px}.form-input{height:46px}.create-button{height:48px}}
      `}</style>
      <div className="background"><div className="circle-left"></div><div className="circle-right"></div><div className="dots dots-top"></div><div className="dots dots-bottom"></div></div>
      <main className="register-page"><div className="register-container">
        <section className="register-left">
          <div className="brand"><div className="brand-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6 v6.7 c0 5.2-3.3 8.2-8 10.3 -4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="white" strokeWidth="1.8"/><path d="m8.4 12 2.2 2.2 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg></div><div><div className="brand-name">XEVERA</div><div className="brand-subtitle">CIVIC REPORTING SYSTEM</div></div></div>
          <h1 className="welcome-title">Welcome to<br/><span>Xevera</span> Portal</h1><div className="welcome-line"></div><p className="welcome-text">Create your account to report concerns, track updates, and stay connected with your community.</p>
        </section>
        <section className="register-card">
          <div className="card-header"><div className="user-circle"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="white" strokeWidth="1.8"/><path d="M5 20 c.8-4 3.1-6 7-6 s6.2 2 7 6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg></div><h2 className="card-title">Create Your Account</h2><p className="card-subtitle">Join Xevera community and start making a difference.</p></div>
          {error && (<div className="message show error">{error}</div>)}
          <form id="registerForm" onSubmit={handleSubmit} noValidate>
            <div className="form-group"><label className="form-label" htmlFor="fullName">Full Name</label><div className="input-wrapper"><svg className="input-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M5 20 c.8-4 3.1-6 7-6 s6.2 2 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg><input className="form-input" id="fullName" type="text" placeholder="e.g. Maria Santos" autoComplete="name" maxLength={100} required value={values.fullName} onChange={setValue('fullName')} onBlur={markTouched('fullName')} aria-invalid={showNameError} /></div></div>
            {showNameError && (<p style={{marginTop:7,fontSize:12,color:'#DC2626'}}>Please enter your full name.</p>)}
            <div className="form-group"><label className="form-label" htmlFor="email">Email Address</label><div className="input-wrapper"><svg className="input-icon" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7"/></svg><input className="form-input" id="email" type="email" placeholder="you@example.com" autoComplete="email" required value={values.email} onChange={setValue('email')} onBlur={markTouched('email')} aria-invalid={showEmailError} /></div></div>
            {showEmailError && (<p style={{marginTop:7,fontSize:12,color:'#DC2626'}}>Please enter a valid email address.</p>)}
            <div className="form-group"><label className="form-label" htmlFor="password">Password</label><div className="input-wrapper"><svg className="input-icon" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 10V7 a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7"/></svg><input className="form-input" id="password" type={showPw ? 'text' : 'password'} placeholder="Create a strong password" autoComplete="new-password" required value={values.password} onChange={setValue('password')} onBlur={markTouched('password')} /><button className="password-toggle" type="button" aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} onClick={()=>setShowPw(v=>!v)}>{showPw ? (<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12 s3.4-5 9.5-5 9.5 5 9.5 5 -3.4 5-9.5 5 -9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7"/></svg>) : (<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12 s3.4-5 9.5-5 9.5 5 9.5 5 -3.4 5-9.5 5 -9.5-5-9.5-5Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7"/><path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>)}</button></div></div>
            <div className="form-group"><label className="form-label" htmlFor="confirmPassword">Confirm Password</label><div className="input-wrapper"><svg className="input-icon" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M8 10V7 a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7"/></svg><input className="form-input" id="confirmPassword" type={showPw ? 'text' : 'password'} placeholder="Confirm your password" autoComplete="new-password" required value={values.confirmPassword} onChange={setValue('confirmPassword')} onBlur={markTouched('confirmPassword')} /></div>{showMismatch && (<p style={{marginTop:7,fontSize:12,color:'#DC2626'}}>Passwords do not match.</p>)}</div>
            <div className="password-rules"><div className="rules-title"><span className="rules-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 20 6 v6.7 c0 5.2-3.3 8.2-8 10.3 -4.7-2.1-8-5.1-8-10.3V6l8-3Z" stroke="white" strokeWidth="2"/></svg></span>Password must include:</div><div className="rules-grid">{rulesList.map((r)=> (<div key={r.key} className={`rule ${pwRules[r.key] ? 'valid' : ''}`}>{r.label}</div>))}</div></div>

            <div className="proof-upload">
              <div className="proof-label">
                <span className="proof-label-text">Proof of Residency</span>
                <span className="proof-required">Required</span>
              </div>
              <p className="proof-helper">Upload up to 2 images showing that you are a resident of Xevera.</p>
              <p className="proof-helper">Accepted: JPG, JPEG, PNG • Maximum 5 MB per image</p>
              {proofs.length < MAX_PROOFS ? (
                <div className={`proof-dropzone ${dragOver ? 'drag-over' : ''}`} onClick={() => fileInputRef.current?.click()} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
                  <div className="proof-dropzone-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                  <div className="proof-dropzone-text">Upload Proof of Residency</div>
                  <div className="proof-dropzone-sub"><span>Click to upload</span> or drag and drop</div>
                  <div className="proof-accepted">Maximum 2 images • 5 MB each</div>
                </div>
              ) : (
                <div className="proof-dropzone disabled">
                  <div className="proof-dropzone-text">Maximum 2 images uploaded</div>
                </div>
              )}
              <div className="proof-counter">{proofs.length} / {MAX_PROOFS} images uploaded</div>
              {proofs.length > 0 && (
                <div className="proof-grid">
                  {proofs.map((p, i) => (
                    <div className="proof-preview" key={p.filename}>
                      {p.preview ? (
                        <img src={p.preview} alt={`Proof ${i + 1} preview`} />
                      ) : (
                        <div className="proof-preview-pdf">IMG</div>
                      )}
                      <div className="proof-preview-info">
                        <div className="proof-preview-name">{p.original}</div>
                        <div className="proof-preview-size">{p.size ? `${(p.size / 1024).toFixed(p.size < 1024 * 1024 ? 0 : 1)} ${p.size < 1024 * 1024 ? 'KB' : 'MB'}` : ''}</div>
                      </div>
                      <button type="button" className="proof-remove" onClick={() => removeProof(i)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
              {proofUploading && <div className="proof-uploading"><div className="proof-spinner"></div> Uploading...</div>}
              {proofError && <div className="proof-error">{proofError}</div>}
              <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT} multiple className="sr-only" style={{display:'none'}} onChange={onFileChange} />
            </div>

            <label className="terms"><input type="checkbox" checked={terms} onChange={(e)=>setTerms(e.target.checked)} /><span>I agree to the <a href="#" onClick={(e)=>e.preventDefault()}>Terms of Service</a> and <a href="#" onClick={(e)=>e.preventDefault()}>Privacy Policy</a>.</span></label>
            <button className="create-button" type="submit" disabled={!canSubmit}>{loading ? 'Creating Account...' : 'Create Account'}</button>
            {error && (<div className="message show error" style={{marginTop:12}}>{error}</div>)}
            <div className="divider">OR</div>
            <div className="login-link">Already have an account? <button type="button" onClick={()=>onLogin && onLogin()} style={{background:'none',border:0,color:'#1264f5',fontWeight:800,cursor:'pointer'}}>Log In</button></div>
            {onBack && (<div className="login-link" style={{marginTop:10}}><button type="button" onClick={()=>onBack && onBack()} aria-label="Back to home page" style={{background:'none',border:0,color:'#637695',fontWeight:700,cursor:'pointer',fontSize:11}}>← Back to Home</button></div>)}
          </form>
        </section>
      </div></main>
    </div>
  );
}
