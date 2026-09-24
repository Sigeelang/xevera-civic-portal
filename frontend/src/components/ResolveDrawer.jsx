import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from './Toast';

/*
 * Shared "Mark Report Resolved" drawer (prototype-matched).
 *
 * Resolution details (required, max 500) + photo proof (required,
 * max 2 images at 5MB each — the backend cap in reports/update.php)
 * submitted as multipart FormData:
 *   { id, status: 'Resolved', resolution, photos[] }
 * Used by every staff resolve entry point so the flow is identical
 * everywhere with no error paths.
 */

const MAX_FILES = 2;
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_RESOLUTION = 500;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ResolveDrawer({ report, open, onClose, onResolved }) {
  const showToast = useToast();
  const [resolution, setResolution] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setResolution('');
      setFiles([]);
      setPreviews([]);
      setDragOver(false);
      setSubmitting(false);
    }
  }, [open, report?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previews.forEach((u) => { try { URL.revokeObjectURL(u); } catch {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !report) return null;

  const canSubmit = resolution.trim().length > 0 && files.length > 0 && !submitting;

  function addFiles(incoming) {
    const next = [...files];
    const nextPreviews = [...previews];
    for (const file of Array.from(incoming || [])) {
      if (next.length >= MAX_FILES) {
        showToast(`You can upload a maximum of ${MAX_FILES} photos.`, 'error');
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast(`${file.name} is not a supported image (JPG, PNG, WEBP).`, 'error');
        continue;
      }
      if (file.size > MAX_SIZE) {
        showToast(`${file.name} is larger than 5MB.`, 'error');
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
      try {
        nextPreviews.push(URL.createObjectURL(file));
      } catch {
        nextPreviews.push('');
      }
    }
    setFiles(next);
    setPreviews(nextPreviews);
  }

  function removeFile(index) {
    try {
      if (previews[index]) URL.revokeObjectURL(previews[index]);
    } catch {}
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('id', report.id);
      fd.append('status', 'Resolved');
      fd.append('resolution', resolution.trim().slice(0, MAX_RESOLUTION));
      files.forEach((f) => fd.append('photos[]', f));
      try {
        await apiFetch('reports/update.php', { method: 'POST', body: fd });
      } catch (e) {
        /* One retry on network-level failure only (never on 4xx/5xx). */
        if (!/failed to fetch|networkerror|network request failed|load failed|timeout|aborterror|connection/i.test(String(e?.message || ''))) throw e;
        await new Promise((r) => setTimeout(r, 1200));
        await apiFetch('reports/update.php', { method: 'POST', body: fd });
      }
      showToast(`Report ${report.id} successfully marked as resolved.`);
      onClose && onClose();
      onResolved && onResolved();
    } catch (err) {
      const reason = err.message || 'Could not mark report as resolved.';
      const stale = /not found|cannot change|transition|already/i.test(reason);
      showToast(`Resolve failed for report ${report.id}: ${reason}${stale ? ' Refresh the list and try again.' : ''}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-[rgba(10,20,35,0.57)]" onClick={() => !submitting && onClose && onClose()} aria-hidden="true" />
      <aside className="fixed right-0 top-0 h-[100dvh] w-[610px] max-w-full bg-white z-[100] shadow-[-8px_0_30px_rgba(0,0,0,0.14)] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Mark Report Resolved">
        <div className="px-8 pt-[27px] pb-[18px] flex items-start gap-[15px] max-sm:px-5 max-sm:pt-[22px] max-sm:pb-4">
          <span className="w-[58px] h-[58px] max-sm:w-12 max-sm:h-12 rounded-full bg-[#edf5ff] text-[#0877f9] flex items-center justify-center flex-shrink-0">
            <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" /><circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[23px] max-sm:text-[19px] leading-[1.25] font-extrabold text-[#142b50]">Mark Report Resolved</div>
            <div className="mt-[5px] text-[#63728a] text-[14px]">{report.id}</div>
          </div>
          <button type="button" onClick={() => !submitting && onClose && onClose()} aria-label="Close"
            className="ml-auto border-0 bg-transparent cursor-pointer text-[#5e6c82] text-[27px] leading-none p-0 hover:text-[#0877f9]">×</button>
        </div>

        <div className="px-8 pb-5 overflow-y-auto flex-1 max-sm:px-5">
          <div className="bg-[#edf5ff] border border-[#e0edff] rounded-[12px] p-[17px_19px] flex gap-3 mb-[25px]">
            <span className="text-[#0877f9] flex-shrink-0 mt-[1px]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" />
              </svg>
            </span>
            <div>
              <div className="text-[#0068e8] text-[14px] font-extrabold mb-[3px]">Photo proof is required</div>
              <div className="text-[13px] text-[#53637b] leading-[1.45]">
                Please upload clear photos after resolving the issue. You can upload up to <strong>{MAX_FILES} photos</strong> as proof of completion.
              </div>
            </div>
          </div>

          <div className="text-[14px] font-extrabold text-[#182c4e] mb-[10px]">
            Resolution details <span className="text-[#ef4444]">*</span>
          </div>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value.slice(0, MAX_RESOLUTION))}
            maxLength={MAX_RESOLUTION}
            placeholder="Example: The street light was repaired and is now working."
            rows={4}
            className="w-full border border-[#d8dfeb] rounded-[11px] p-[15px] text-[14px] text-[#243858] outline-none resize-y transition-all focus:border-[#287ff2] focus:shadow-[0_0_0_3px_rgba(40,127,242,0.09)] placeholder:text-[#99a6b9]"
          />
          <div className="text-right text-[#61718a] text-[12px] mt-[5px]">{resolution.length}/{MAX_RESOLUTION}</div>

          <div className="mt-[23px]">
            <div className="flex justify-between items-center mb-[10px]">
              <div className="text-[14px] font-extrabold text-[#182c4e]">
                Photo proof (Max {MAX_FILES} photos) <span className="text-[#ef4444]">*</span>
              </div>
              <div className="text-[13px] text-[#65748a] font-bold">{files.length}/{MAX_FILES}</div>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files || [])); }}
              className={`border-[1.5px] border-dashed rounded-[13px] min-h-[155px] bg-[#f9fbff] flex flex-col justify-center items-center text-center cursor-pointer transition-all p-5 ${dragOver ? 'border-[#1878ed] bg-[#f1f7ff]' : 'border-[#b8c7dd] hover:border-[#1878ed] hover:bg-[#f1f7ff]'}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
              aria-label="Upload photo proof"
            >
              <span className="w-[45px] h-[45px] rounded-full bg-[#e9f2ff] text-[#0877f9] flex items-center justify-center mb-[9px]">
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" />
                </svg>
              </span>
              <div className="text-[#172d51] text-[14px] font-extrabold">Click to upload photos</div>
              <div className="text-[12px] text-[#78879c] mt-[5px]">or drag and drop</div>
              <div className="text-[11px] text-[#718097] mt-3">You can upload up to {MAX_FILES} photos (JPG, PNG, WEBP · Max 5MB each).</div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-[14px]">
                {files.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} className="min-w-0">
                    <div className="h-[112px] max-sm:h-[90px] relative overflow-hidden rounded-[9px] bg-[#eef2f7] border border-[#e1e7ef]">
                      {previews[i] ? (
                        <img src={previews[i]} className="w-full h-full object-cover" alt="Photo proof" />
                      ) : null}
                      <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}
                        className="absolute top-[7px] right-[7px] w-[27px] h-[27px] rounded-full border border-[#dce2ea] bg-white text-[#34445c] cursor-pointer text-[16px] font-semibold shadow-[0_2px_7px_rgba(0,0,0,0.12)] hover:bg-[#fff1f1] hover:text-[#e33434]">
                        ×
                      </button>
                    </div>
                    <div className="mt-[7px] text-[11px] text-[#52627a] whitespace-nowrap overflow-hidden text-ellipsis">{f.name}</div>
                    <div className="mt-[2px] text-[10px] text-[#8b98aa]">{fmtSize(f.size)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#f4f8ff] rounded-[11px] p-[16px_18px] mt-5">
            <div className="text-[#146bd4] text-[13px] font-extrabold mb-2">✓ &nbsp;Photo Guidelines</div>
            <ul className="pl-[18px] text-[#65748a] text-[12px] leading-[1.65]">
              <li>Take clear and recent photos after the work is completed.</li>
              <li>Show the resolved issue from different angles when possible.</li>
              <li>Make sure the photos are not blurry and related to this report.</li>
            </ul>
          </div>
        </div>

        <div className="px-8 pt-[18px] pb-7 flex gap-[18px] bg-white border-t border-[#f0f2f6] max-sm:px-5 max-sm:pt-[15px] max-sm:pb-5">
          <button type="button" onClick={() => !submitting && onClose && onClose()} disabled={submitting}
            className="h-[51px] rounded-[11px] text-[14px] font-extrabold cursor-pointer flex-1 border border-[#dbe2eb] bg-white text-[#243653] hover:bg-[#f7f9fc] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit}
            className="h-[51px] rounded-[11px] text-[14px] font-extrabold cursor-pointer flex-1 bg-[#277df0] border border-[#277df0] text-white hover:bg-[#126be1] disabled:bg-[#9bbff0] disabled:border-[#9bbff0] disabled:cursor-not-allowed">
            {submitting ? 'Resolving...' : 'Mark Resolved'}
          </button>
        </div>
      </aside>
    </>
  );
}
