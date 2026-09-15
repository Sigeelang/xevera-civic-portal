import { useState, useEffect, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import ImageLightbox from '../../components/ImageLightbox';

const NOTES_MAX = 500;

/* Timeline icon tint per status transition */
const TIMELINE_TINTS = {
  Pending: { cls: 'bg-[#FFF7E7] text-[#F0A000]', icon: '⏳' },
  Verified: { cls: 'bg-[#EDF4FF] text-xevera-600', icon: '✓' },
  Assigned: { cls: 'bg-[#EDF4FF] text-xevera-600', icon: '♙' },
  'In Progress': { cls: 'bg-[#EDF4FF] text-xevera-600', icon: '⚙' },
  Resolved: { cls: 'bg-[#F5EFFF] text-[#7C3AED]', icon: '✓' },
  Closed: { cls: 'bg-[#ECFAFB] text-[#0E9BA0]', icon: '▣' },
  Rejected: { cls: 'bg-[#FFF1F1] text-[#DC2626]', icon: '×' },
};

function fmtDateTime(v) {
  const d = new Date(String(v || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v || '—');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function Detail({ icon, label, children }) {
  return (
    <div className="flex gap-3">
      <span className="w-5 flex-shrink-0 text-center text-[#334C77]">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] text-[#526487] mb-1">{label}</div>
        <div className="text-[13px] font-semibold text-[#081B42] leading-relaxed break-words">{children}</div>
      </div>
    </div>
  );
}

export default function ReportVerifyPage({ reportId, onBack }) {
  const showToast = useToast();
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [decision, setDecision] = useState(null); /* 'verify' | 'reject' | null */
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [r, h] = await Promise.all([
        apiFetch(`reports/get.php?id=${encodeURIComponent(reportId)}`),
        apiFetch(`reports/history.php?id=${encodeURIComponent(reportId)}`).catch(() => []),
      ]);
      setReport(r);
      setHistory(Array.isArray(h) ? h : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!decision) return;
    setSubmitting(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: decision === 'verify'
          ? { id: reportId, status: 'Verified', note: notes.trim() || undefined }
          : { id: reportId, status: 'Rejected', rejection_reason: notes.trim(), note: notes.trim() || undefined },
      });
      showToast(decision === 'verify'
        ? `Report ${reportId} verified successfully.`
        : `Report ${reportId} rejected.`);
      setConfirmOpen(false);
      onBack && onBack();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl bg-white border border-[#E5E7EB] animate-pulse" />
        <div className="h-72 rounded-xl bg-white border border-[#E5E7EB] animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-10 text-center">
        <p className="text-sm text-[#6B7280]">Unable to load this report.</p>
        <button onClick={onBack}
          className="mt-3 px-4 h-9 rounded-lg bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 cursor-pointer">
          Back to Pending Verification
        </button>
      </div>
    );
  }

  const photos = (report.photos || []).slice(0, 2);

  return (
    <div className="space-y-4">
      {/* ===== PAGE HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="w-[55px] h-[55px] rounded-xl bg-[#E9F8EE] text-[#0B9B3D] grid place-items-center flex-shrink-0">
            <Icon name="verify" size={26} />
          </span>
          <div>
            <h1 className="text-[26px] font-bold text-[#172033] m-0 leading-tight">Verify Report</h1>
            <p className="text-[13px] text-[#61708B] mt-1 m-0">
              Review the report details, evidence, and determine if it is valid for further action.
            </p>
          </div>
        </div>
        <button onClick={onBack}
          className="h-[38px] px-4 self-start sm:self-auto rounded-lg bg-white border border-[#82B2FF] text-xevera-600 text-[13px] font-bold hover:bg-[#EEF5FF] transition-colors cursor-pointer whitespace-nowrap">
          ‹ &nbsp; Back to Pending Verification
        </button>
      </div>

      {/* ===== TOP GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
        {/* REPORT DETAILS */}
        <section className="bg-white border border-[#E1E7F0] rounded-xl shadow-[0_3px_12px_rgba(24,49,88,0.05)] overflow-hidden">
          <header className="h-[57px] px-6 flex items-center justify-between border-b border-[#EDF0F5]">
            <h2 className="text-sm font-extrabold m-0 text-[#172033]">Report Details</h2>
            <span className="rounded-full bg-[#FFF5DF] text-[#D88500] px-3 py-1.5 text-[10px] font-bold whitespace-nowrap">
              ⏳ &nbsp;{report.status === 'Pending' ? 'Pending Verification' : report.status}
            </span>
          </header>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-x-10">
              <Detail icon="file" label="Report ID">{report.id}</Detail>
              <Detail icon="letter" label="Description">
                <span className="font-medium leading-relaxed">{report.desc}</span>
              </Detail>
              <Detail icon="user" label="Submitted By">
                {report.reporter}
                <span className="inline-block ml-1.5 px-2 py-0.5 rounded-full bg-[#EAF2FF] text-xevera-600 text-[9px] font-bold align-middle">
                  Resident
                </span>
              </Detail>
              <Detail icon="file" label="Attachments">
                {photos.length > 0
                  ? `${photos.length} photo${photos.length > 1 ? 's' : ''}`
                  : 'No photos attached'}
              </Detail>
              <Detail icon="clipboard" label="Category">{report.category || '—'}</Detail>
              <Detail icon="pin" label="Location (as reported)">{report.location || '—'}</Detail>
              <Detail icon="clock" label="Date & Time Submitted">{fmtDateTime(report.created_at)}</Detail>
              {report.assigned && report.assigned !== '-' && (
                <Detail icon="users" label="Assigned To">{report.assigned}</Detail>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[#68758E] m-0">
              Maximum of <strong>2 photos</strong> may be attached to a report. Video uploads are not allowed.
            </p>
          </div>
        </section>

        {/* PHOTO EVIDENCE */}
        <section className="bg-white border border-[#E1E7F0] rounded-xl shadow-[0_3px_12px_rgba(24,49,88,0.05)] overflow-hidden self-start">
          <header className="h-[57px] px-6 flex items-center border-b border-[#EDF0F5]">
            <h2 className="text-sm font-extrabold m-0 text-[#172033]">Photo Evidence (Maximum 2)</h2>
          </header>
          <div className="p-6">
            {photos.length > 0 ? (
              <div className={`grid gap-3 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setLightboxIndex(i)}
                    className="block h-[160px] w-full p-0 border-0 rounded-lg overflow-hidden bg-[#E8EDF5] group cursor-zoom-in">
                    <img src={uploadUrl(p)} alt={`Evidence ${i + 1}`}
                      className="w-full h-full object-cover block group-hover:scale-[1.02] transition-transform duration-200" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-[160px] grid place-items-center rounded-lg border border-dashed border-[#D8E0EA] bg-[#F8FAFC] text-xs text-[#8CA0BC]">
                No photo evidence submitted
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ===== BOTTOM GRID ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4 items-start">
        {/* VERIFICATION DECISION */}
        <section className="bg-white border border-[#E1E7F0] rounded-xl shadow-[0_3px_12px_rgba(24,49,88,0.05)] overflow-hidden">
          <header className="h-[57px] px-6 flex items-center border-b border-[#EDF0F5]">
            <h2 className="text-sm font-extrabold m-0 text-[#172033]">Verification Decision</h2>
          </header>

          <div className="px-[17px] pt-4 pb-4">
            {/* VERIFY */}
            <button type="button" onClick={() => setDecision('verify')}
              className={`w-full min-h-[56px] mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                decision === 'verify'
                  ? 'border-2 border-xevera-600 shadow-[0_0_0_3px_rgba(17,99,232,0.10)]'
                  : 'border-[#C9EFD5] bg-[#EFFBF3] hover:-translate-y-px'
              }`}>
              <span className="w-[31px] h-[31px] rounded-full bg-white text-[#0B9B3D] grid place-items-center flex-shrink-0 font-bold">✓</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-extrabold text-[#08752D]">Verify Report</span>
                <span className="block text-[10px] text-[#52627C] mt-0.5">Confirm that this report is valid and should proceed.</span>
              </span>
              <span className={`w-[100px] h-[34px] hidden sm:grid place-items-center rounded-md text-xs font-bold flex-shrink-0 ${
                decision === 'verify' ? 'bg-xevera-600 text-white border border-xevera-600' : 'bg-white text-[#08752D] border border-[#79C58E]'
              }`}>Verify</span>
            </button>

            {/* REJECT */}
            <button type="button" onClick={() => setDecision('reject')}
              className={`w-full min-h-[56px] mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                decision === 'reject'
                  ? 'border-2 border-[#EF2428] shadow-[0_0_0_3px_rgba(239,36,40,0.10)]'
                  : 'border-[#FFD0D0] bg-[#FFF3F3] hover:-translate-y-px'
              }`}>
              <span className="w-[31px] h-[31px] rounded-full bg-white text-[#EF2428] grid place-items-center flex-shrink-0 font-bold">×</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-extrabold text-[#A80004]">Reject Report</span>
                <span className="block text-[10px] text-[#52627C] mt-0.5">Mark this report as invalid, duplicate, or not actionable.</span>
              </span>
              <span className={`w-[100px] h-[34px] hidden sm:grid place-items-center rounded-md text-xs font-bold flex-shrink-0 ${
                decision === 'reject' ? 'bg-[#EF2428] text-white border border-[#EF2428]' : 'bg-white text-[#EF2428] border border-[#FF7A7D]'
              }`}>Reject</span>
            </button>

            {/* NOTES */}
            <label className="block text-xs font-extrabold mt-4 mb-2 text-[#172033]">
              Verification Notes {decision === 'reject' ?
                <span className="text-[#EF2428]">(required for rejection)</span> :
                <span className="font-semibold text-[#6C7890]">(optional)</span>}
            </label>
            <div className="relative">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                maxLength={NOTES_MAX}
                placeholder="Add notes about your decision..."
                className="w-full h-[66px] resize-none border border-[#DBE2ED] rounded-lg p-2.5 text-[11px] font-inherit outline-none focus:border-xevera-600 focus:ring-[3px] focus:ring-xevera-600/10 placeholder:text-[#94A3B8]" />
              <span className="absolute bottom-1.5 right-2.5 text-[9px] text-[#748099]">{notes.length}/{NOTES_MAX}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-2.5 max-sm:grid-cols-1">
              <button type="button" onClick={() => { setDecision(null); setNotes(''); setConfirmOpen(false); onBack && onBack(); }}
                className="h-[38px] rounded-lg bg-white border border-[#8DB8FF] text-xevera-600 text-[13px] font-bold hover:bg-[#EEF5FF] cursor-pointer">
                Cancel
              </button>
              <button type="button" disabled={!decision}
                onClick={() => {
                  if (!decision) { showToast('Please select Verify or Reject.', 'error'); return; }
                  if (decision === 'reject' && !notes.trim()) { showToast('A rejection reason is required.', 'error'); return; }
                  setConfirmOpen(true);
                }}
                className="h-[38px] rounded-lg bg-xevera-600 border border-xevera-600 text-white text-[13px] font-bold hover:bg-xevera-700 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition">
                Submit Decision
              </button>
            </div>
          </div>
        </section>

        {/* REPORT HISTORY */}
        <section className="bg-white border border-[#E1E7F0] rounded-xl shadow-[0_3px_12px_rgba(24,49,88,0.05)] overflow-hidden self-start min-h-[300px]">
          <header className="h-[57px] px-6 flex items-center border-b border-[#EDF0F5]">
            <h2 className="text-sm font-extrabold m-0 text-[#172033]">Report History</h2>
          </header>
          <div className="p-6">
            {history.length === 0 ? (
              <p className="text-xs text-[#8CA0BC] m-0">No history recorded yet.</p>
            ) : (
              <div className="relative pl-[37px]">
                <span className="absolute left-3 top-3 bottom-4 w-px bg-[#DBE2ED]" />
                {history.map((h) => {
                  const tint = TIMELINE_TINTS[h.new_status] || { cls: 'bg-[#F1F5F9] text-[#64748B]', icon: '•' };
                  return (
                    <div key={h.id} className="relative mb-7 last:mb-0">
                      <span className={`absolute -left-[37px] top-0 w-[25px] h-[25px] rounded-full grid place-items-center text-[11px] border border-[#E2E7EF] ${tint.cls}`}>
                        {tint.icon}
                      </span>
                      <div className="text-xs font-extrabold text-[#172033]">
                        {h.old_status ? `${h.old_status} → ${h.new_status}` : h.new_status}
                      </div>
                      <div className="text-[10px] text-[#65738D] leading-relaxed mt-1">
                        {h.date}{h.actor ? ` • by ${h.actor}` : ''}
                        {h.note ? <> &nbsp;•&nbsp; {h.note}</> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ===== CONFIRM MODAL ===== */}
      <Modal
        open={confirmOpen}
        title={decision === 'verify' ? 'Verify Report?' : 'Reject Report?'}
        description={decision === 'verify'
          ? `Are you sure you want to verify report ${reportId}? The report will move to the Verified status.`
          : `Are you sure you want to reject report ${reportId}? The report will move to the Rejected status.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        danger={decision === 'reject'}
        confirmDisabled={submitting}
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      >
        {notes.trim() && (
          <div className="text-xs text-[#4B5876] bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-2.5">
            <strong>Notes:</strong> {notes.trim()}
          </div>
        )}
      </Modal>

      {lightboxIndex !== null && photos.length > 0 && (
        <ImageLightbox
          photos={photos}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={`${report.title || 'Report'} — photo evidence`}
        />
      )}
    </div>
  );
}
