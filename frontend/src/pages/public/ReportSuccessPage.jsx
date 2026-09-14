import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import CivicIllustration from '../../components/public/CivicIllustration';
import { statusBadgeClass, publicStatusLabel } from '../../components/ReportCard';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text)
    );
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function SuccessIcon({ size = 64 }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#E4F6EC] shadow-[0_0_0_10px_rgba(22,163,74,0.10),0_10px_24px_rgba(22,163,74,0.18)] animate-[successPop_400ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="inline-flex items-center justify-center rounded-full bg-success text-white" style={{ width: size - 20, height: size - 20 }}>
        <Icon name="check" size={size * 0.4} strokeWidth={2.8} />
      </span>
    </span>
  );
}

function Breadcrumb({ onNavigate }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] mb-4" aria-label="Breadcrumb">
      <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-xevera-600 cursor-pointer bg-none border-none">Home</button>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      <button onClick={() => onNavigate && onNavigate('submit')} className="hover:text-xevera-600 cursor-pointer bg-none border-none">Report an Issue</button>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      <span className="text-navy-950" aria-current="page">Report Submitted</span>
    </nav>
  );
}

function Hero({ report }) {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-[rgba(18,88,232,0.12)] bg-[linear-gradient(135deg,#EAF0FA_0%,#DDE8F8_50%,#C9DAF2_100%)] shadow-[0_12px_30px_rgba(10,26,69,0.08)] px-6 sm:px-10 py-10 mb-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(18,88,232,0.14),transparent_65%)]" />
        <div className="absolute -bottom-16 -left-10 w-52 h-52 rounded-full bg-[radial-gradient(circle,rgba(22,163,74,0.10),transparent_65%)]" />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-8 lg:gap-12 items-center animate-[rise_450ms_ease_both] motion-reduce:animate-none">
        <div className="text-center lg:text-left max-w-2xl">
          <SuccessIcon />
          <h1 className="font-head font-extrabold text-navy-950 mt-5 text-[30px] sm:text-[34px] leading-[1.12]">Report Submitted!</h1>
          <p className="mt-2 text-sm sm:text-[15px] text-[#4B5876] leading-relaxed max-w-xl mx-auto lg:mx-0">
            Thank you for helping improve Xevera. Your report has been successfully received by our community team.
          </p>
          {report && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white border border-[rgba(18,88,232,0.18)] px-4 py-2 text-[12.5px] font-bold text-navy-950 shadow-sm">
              <Icon name="clipboard" size={14} strokeWidth={2} className="text-xevera-600" />
              Reference
              <span className="font-extrabold text-xevera-700">{report.id}</span>
            </div>
          )}
        </div>

        <div className="relative animate-[rise_550ms_120ms_ease_both] motion-reduce:animate-none">
          <div className="relative -mb-6">
            <CivicIllustration variant="success" />
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ getText, label, copiedLabel, successLabel }) {
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    if (state === 'copied') return;
    const ok = await copyToClipboard(getText());
    clearTimeout(timer.current);
    setState(ok ? 'copied' : 'error');
    setMsg(ok ? successLabel : 'Unable to copy. Please copy manually.');
    timer.current = setTimeout(() => {
      setState('idle');
      setMsg('');
    }, 2200);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[11px] text-[13px] font-bold transition-all duration-200 cursor-pointer disabled:opacity-60 ${
          state === 'copied'
            ? 'bg-[#E4F6EC] text-success border border-[#BBE7CE]'
            : state === 'error'
              ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
              : 'bg-white text-xevera-600 border border-[rgba(18,88,232,0.22)] hover:bg-xevera-50'
        }`}
      >
        {state === 'copied' ? <Icon name="check" size={15} strokeWidth={2.5} /> : <Icon name="copy" size={15} strokeWidth={2} />}
        {state === 'copied' ? copiedLabel : label}
      </button>
      <p aria-live="polite" className={`text-[11px] font-semibold mt-1.5 ${state === 'copied' ? 'text-success' : state === 'error' ? 'text-[#DC2626]' : 'text-transparent'}`}>
        {msg}
      </p>
    </div>
  );
}

export default function ReportSuccessPage({ reference, onNavigate, onTrack, onNewReport }) {
  const showToast = useToast();
  const [report, setReport] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | notfound | unavailable | error
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const trackingUrl = typeof window !== 'undefined' && reference
    ? window.location.origin + '/track/' + encodeURIComponent(reference)
    : '';

  const load = useCallback(() => {
    if (!reference) {
      setState('notfound');
      return;
    }
    setState('loading');
    apiFetch('reports/get.php?id=' + encodeURIComponent(reference))
      .then((r) => {
        setReport(r);
        setState('ready');
      })
      .catch((err) => {
        setReport(null);
        if (err.status === 404) setState('notfound');
        else setState('error');
      });
  }, [reference]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state !== 'ready' || !trackingUrl) return;
    let cancelled = false;
    QRCode.toDataURL(trackingUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#0A1A45', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [state, trackingUrl]);

  function formatDateSafe() {
    return formatDate(report?.created_at);
  }

  async function handleDownload() {
    if (!report || !trackingUrl) return;
    setDownloading(true);
    try {
      let qr = qrDataUrl;
      if (!qr) {
        try { qr = await QRCode.toDataURL(trackingUrl, { margin: 1, width: 240, color: { dark: '#0A1A45', light: '#FFFFFF' } }); } catch {}
      }
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();

      doc.setFillColor(10, 26, 69);
      doc.rect(0, 0, W, 30, 'F');
      doc.setFillColor(18, 88, 232);
      doc.rect(0, 30, W, 2.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('XEVERA CIVIC PORTAL', 14, 14);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 215, 240);
      doc.text('Report Confirmation', 14, 21);

      doc.setTextColor(10, 26, 69);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Report Submitted', 14, 46);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Thank you for helping improve Xevera. This document confirms your report was received.', 14, 54);

      doc.setFillColor(238, 245, 255);
      doc.setDrawColor(215, 227, 245);
      doc.roundedRect(14, 62, W - 28, 24, 2.5, 2.5, 'FD');
      doc.setTextColor(10, 26, 69);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('REPORT REFERENCE', 20, 70);
      doc.setFontSize(16);
      doc.setTextColor(18, 88, 232);
      doc.text(report.id, 20, 79);

      let y = 96;
      const field = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(label, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        const lines = doc.splitTextToSize(String(value || '-'), W - 100);
        doc.text(lines, 60, y);
        y += Math.max(lines.length, 1) * 6 + 2;
      };

      field('Issue Title', report.title);
      field('Category', report.category);
      field('Location', report.location);
      field('Date Submitted', formatDateSafe());
      field('Current Status', publicStatusLabel(report.status));
      field('Tracking URL', trackingUrl);

      if (qr) {
        try { doc.addImage(qr, 'PNG', W - 64, y + 4, 50, 50); } catch {}
      }

      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(215, 227, 245);
      doc.roundedRect(14, 250, W - 28, 20, 2.5, 2.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(18, 88, 232);
      doc.text('PRIVACY NOTICE', 20, 257);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('This confirmation contains public tracking information only. Please keep your reference number to track this report.', 20, 263);

      doc.save('Xevera-Report-' + report.id + '.pdf');
      showToast('Confirmation downloaded!');
    } catch {
      showToast('Unable to generate confirmation.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  function renderState() {
    if (state === 'loading') {
      return (
        <div className="space-y-5" aria-busy="true" aria-label="Loading report confirmation">
          <div className="rounded-[22px] border border-[#E5E7EB] bg-white p-8 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#E5E7EB] mx-auto" />
            <div className="h-6 w-56 bg-[#E5E7EB] rounded-full mx-auto mt-4" />
            <div className="h-4 w-80 max-w-full bg-[#E5E7EB] rounded mx-auto mt-3" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 animate-pulse"><div className="h-5 w-40 bg-[#E5E7EB] rounded mb-4" /><div className="h-4 w-32 bg-[#E5E7EB] rounded" /></div>
            <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 animate-pulse"><div className="h-5 w-40 bg-[#E5E7EB] rounded mb-4" /><div className="h-24 w-24 bg-[#E5E7EB] rounded mx-auto" /></div>
          </div>
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 animate-pulse"><div className="h-5 w-48 bg-[#E5E7EB] rounded mb-4" /><div className="grid grid-cols-3 gap-4"><div className="h-4 bg-[#E5E7EB] rounded" /><div className="h-4 bg-[#E5E7EB] rounded" /><div className="h-4 bg-[#E5E7EB] rounded" /></div></div>
        </div>
      );
    }

    if (state === 'notfound' || state === 'unavailable' || state === 'error') {
      const isNotFound = state === 'notfound';
      return (
        <div className="max-w-[560px] mx-auto bg-white rounded-[22px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.08)] p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mb-4">
            <Icon name={isNotFound ? 'search' : 'alert'} size={26} strokeWidth={2} />
          </div>
          <h2 className="text-xl font-head font-extrabold text-navy-950 mb-2">
            {isNotFound ? 'Report Not Found' : state === 'unavailable' ? 'Report Unavailable' : 'Unable to Load Report'}
          </h2>
          <p className="text-sm text-[#64748B] leading-relaxed">
            {isNotFound
              ? "We couldn't find a report associated with this reference."
              : state === 'unavailable'
                ? 'This report is currently unavailable for tracking.'
                : 'There was a problem loading this report. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-6">
            <button onClick={load}
              className="px-5 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
              Try Again
            </button>
            <button onClick={() => onNavigate && onNavigate('reports')}
              className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#64748B] hover:bg-[#F9FAFB] transition-colors cursor-pointer">
              Track Another Report
            </button>
          </div>
        </div>
      );
    }

    if (!report) return null;

    const summaryRows = [
      { icon: 'filetext', label: 'Issue Title', value: report.title },
      { icon: 'tag', label: 'Category', value: report.category },
      { icon: 'pin', label: 'Location', value: report.location },
      { icon: 'calendar', label: 'Date Submitted', value: formatDateSafe() },
      { icon: 'messagesquare', label: 'Description', value: report.desc },
      { icon: 'paperclip', label: 'Attachments', value: (report.attachments_count || 0) + (report.attachments_count === 1 ? ' photo' : ' photos') },
    ];

    return (
      <div className="space-y-5">
        <Breadcrumb onNavigate={onNavigate} />
        <Hero report={report} />

        {/* ===== Reference + Tracking ===== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5" aria-label="Report reference and tracking">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(18,88,232,0.06)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-xevera-50 text-xevera-600 flex items-center justify-center">
                <Icon name="shield" size={17} strokeWidth={2} />
              </span>
              <h2 className="text-[15px] font-head font-extrabold text-navy-950 uppercase tracking-wider">Your Report Reference</h2>
            </div>
            <div className="rounded-[14px] bg-[#F5F9FF] border-2 border-xevera-600 px-5 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#64748B] mb-1">Reference Number</div>
                <div className="text-[22px] sm:text-[24px] font-head font-extrabold text-xevera-700 tracking-wide break-all">{report.id}</div>
              </div>
              <Icon name="shield" size={22} strokeWidth={1.6} className="text-xevera-300 flex-shrink-0" />
            </div>
            <div className="mt-4">
              <CopyButton
                getText={() => report.id}
                label="Copy Reference Number"
                copiedLabel="Reference copied!"
                successLabel="Reference copied to clipboard."
              />
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(18,88,232,0.06)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-xevera-50 text-xevera-600 flex items-center justify-center">
                <Icon name="link" size={17} strokeWidth={2} />
              </span>
              <h2 className="text-[15px] font-head font-extrabold text-navy-950 uppercase tracking-wider">Track Your Report</h2>
            </div>
            <div className="flex items-stretch gap-3">
              <div className="flex-1 rounded-[14px] bg-[#F5F9FF] border border-xevera-600/40 px-4 py-3 flex items-center gap-2 min-w-0">
                <Icon name="link" size={15} strokeWidth={2} className="text-xevera-400 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-navy-950 break-all leading-snug">{trackingUrl}</span>
              </div>
            </div>
            <div className="mt-4">
              <CopyButton
                getText={() => trackingUrl}
                label="Copy Tracking Link"
                copiedLabel="Link copied!"
                successLabel="Tracking link copied to clipboard."
              />
            </div>

            <div className="mt-5 pt-5 border-t border-[#E5E7EB] flex items-center gap-5">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code linking to the public report tracking page" className="w-[148px] h-[148px] rounded-xl border border-[#E5E7EB] bg-white p-2 flex-shrink-0" />
              ) : (
                <div className="w-[148px] h-[148px] rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-center animate-pulse flex-shrink-0">
                  <Icon name="qrcode" size={36} strokeWidth={1.4} className="text-[#CBD5E1]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon name="scan" size={16} strokeWidth={2} className="text-xevera-600" />
                  <span className="text-[14px] font-extrabold text-navy-950">Scan to Track</span>
                </div>
                <p className="text-[12.5px] text-[#64748B] leading-relaxed">Scan this QR code with your phone to open the public tracking page for this report.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Quick Actions ===== */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Quick actions">
          <button onClick={() => onTrack && onTrack(report.id)}
            className="group text-left bg-white rounded-[18px] border border-[#E5E7EB] p-5 hover:border-xevera-600 hover:shadow-[0_10px_28px_rgba(18,88,232,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <span className="w-11 h-11 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center mb-3 group-hover:bg-xevera-600 group-hover:text-white transition-colors">
              <Icon name="search" size={20} strokeWidth={2} />
            </span>
            <div className="text-[14px] font-extrabold text-navy-950 mb-1">Track My Report</div>
            <div className="text-[12px] text-[#64748B] leading-relaxed">View the current status of your report.</div>
          </button>

          <button onClick={handleDownload} disabled={downloading}
            className="group text-left bg-white rounded-[18px] border border-[#E5E7EB] p-5 hover:border-xevera-600 hover:shadow-[0_10px_28px_rgba(18,88,232,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:pointer-events-none">
            <span className="w-11 h-11 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center mb-3 group-hover:bg-xevera-600 group-hover:text-white transition-colors">
              <Icon name="download" size={20} strokeWidth={2} />
            </span>
            <div className="text-[14px] font-extrabold text-navy-950 mb-1">{downloading ? 'Generating...' : 'Download Confirmation'}</div>
            <div className="text-[12px] text-[#64748B] leading-relaxed">Save a copy of your report confirmation as a PDF.</div>
          </button>

          <button onClick={() => onNewReport && onNewReport()}
            className="group text-left bg-white rounded-[18px] border border-[#E5E7EB] p-5 hover:border-xevera-600 hover:shadow-[0_10px_28px_rgba(18,88,232,0.12)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <span className="w-11 h-11 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center mb-3 group-hover:bg-xevera-600 group-hover:text-white transition-colors">
              <Icon name="plus" size={20} strokeWidth={2} />
            </span>
            <div className="text-[14px] font-extrabold text-navy-950 mb-1">Report Another Issue</div>
            <div className="text-[12px] text-[#64748B] leading-relaxed">Submit another report to help the community.</div>
          </button>
        </section>

        {/* ===== Report Summary ===== */}
        <section className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(18,88,232,0.06)] p-6 sm:p-7" aria-label="Report summary">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-xevera-50 text-xevera-600 flex items-center justify-center">
                <Icon name="filetext" size={17} strokeWidth={2} />
              </span>
              <h2 className="text-[15px] font-head font-extrabold text-navy-950 uppercase tracking-wider">Report Summary</h2>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${statusBadgeClass(report.status)}`}>
              {publicStatusLabel(report.status)}
            </span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            {summaryRows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-1.5">
                  <Icon name={row.icon} size={13} strokeWidth={2} className="flex-shrink-0" />
                  {row.label}
                </dt>
                <dd className="text-[13px] font-semibold text-navy-950 leading-relaxed break-words">{row.value || '-'}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ===== Important Reminder ===== */}
        <section className="flex gap-4 rounded-[18px] border border-[#FCD34D] bg-[linear-gradient(180deg,#FFFBEB_0%,#FEF3C7_100%)] p-5 sm:p-6" aria-label="Important reminder">
          <span className="w-10 h-10 rounded-full bg-[#F59E0B] text-white flex items-center justify-center flex-shrink-0">
            <Icon name="bell" size={19} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[14px] font-head font-extrabold text-[#92400E] mb-1">IMPORTANT REMINDER</h2>
            <p className="text-[12.5px] text-[#78350F] leading-relaxed">
              Please save your report reference number <span className="font-extrabold">{report.id}</span> to track your report.
              Since you are reporting as a guest, you can track progress any time using this reference number or the tracking link above.
            </p>
          </div>
        </section>

        {/* ===== Contact Support ===== */}
        <section className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[18px] border border-[#DBEAFE] bg-[linear-gradient(180deg,#EFF6FF_0%,#DBEAFE_100%)] p-5 sm:p-6" aria-label="Contact support">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <span className="w-10 h-10 rounded-full bg-[#1264f5] text-white flex items-center justify-center flex-shrink-0">
              <Icon name="chat" size={19} strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[14px] font-head font-extrabold text-[#1E3A5F] mb-1">Need Help?</h2>
              <p className="text-[12.5px] text-[#374151] leading-relaxed">
                Have questions about your report or need assistance? Our support team is here to help.
              </p>
            </div>
          </div>
          <button onClick={() => onNavigate && onNavigate('contact')}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-[#1264f5] text-white text-[13px] font-bold hover:bg-[#0B4FCC] transition-colors cursor-pointer">
            Contact Support
          </button>
        </section>

        {/* ===== Privacy ===== */}
        <section className="flex items-start gap-4 rounded-[18px] border border-[#DCE7F5] bg-[#F5F9FF] p-5 sm:p-6" aria-label="Privacy assurance">
          <span className="w-10 h-10 rounded-full bg-xevera-600 text-white flex items-center justify-center flex-shrink-0">
            <Icon name="lock" size={19} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[14px] font-head font-extrabold text-navy-950 mb-1">Your information is safe with us.</h2>
            <p className="text-[12.5px] text-[#4B5876] leading-relaxed">
              We respect your privacy and keep your information secure. Only public tracking details are shown on this page.
              {' '}
              <button onClick={() => onNavigate && onNavigate('privacy')}
                className="font-bold text-xevera-600 hover:text-xevera-700 bg-none border-none cursor-pointer p-0 underline underline-offset-2">
                Privacy Policy
              </button>
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      {renderState()}
    </div>
  );
}