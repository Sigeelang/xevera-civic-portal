import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from './Toast';

/*
 * Resident Feedback on resolved reports (prototype-matched).
 *
 * Feedback card -> centered modal (stars, comment, "what went well"
 * checkboxes) -> submitted panel. All backed by real endpoints:
 *   GET  feedback/summary.php?ref_id=   (count, average, my rating)
 *   POST feedback/submit.php            (rating 1-5 + optional comment,
 *                                        resolved reports only, upsert)
 * Checkbox selections are appended to the stored comment (the API
 * accepts rating + comment only).
 */

const WENT_WELL = [
  'The issue was fully resolved',
  'The response was helpful',
  'The resolution took too long',
  'Other (please specify)',
];

function fmtDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  const d = new Date(s.replace(' ', 'T') + (/([Zz]|[+-]\d{2}:?\d{2})$/.test(s) ? '' : '+08:00'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ResidentFeedback({ refId }) {
  const showToast = useToast();
  const [mine, setMine] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [checked, setChecked] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    if (!refId) return;
    apiFetch('feedback/summary.php?ref_id=' + encodeURIComponent(refId))
      .then((d) => {
        if (d?.mine) {
          setMine(d.mine);
          setRating(Number(d.mine.rating) || 0);
        } else {
          setMine(null);
        }
      })
      .catch(() => {});
  }, [refId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setModalOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  function openModal() {
    setRating(mine ? Number(mine.rating) || 0 : 0);
    setComment(mine?.comment && !mine.comment.startsWith('[Went well:') ? mine.comment : '');
    setChecked([]);
    setFormError('');
    setModalOpen(true);
  }

  function toggleCheck(value) {
    setChecked((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  }

  async function submit() {
    if (!rating) {
      setFormError('Please select a rating before submitting your feedback.');
      return;
    }
    const cleanComment = comment.trim().slice(0, 500);
    const fullComment = checked.length > 0
      ? `${cleanComment}${cleanComment ? '\n\n' : ''}[Went well: ${checked.join('; ')}]`.slice(0, 1000)
      : cleanComment;
    setSubmitting(true);
    setFormError('');
    try {
      const data = await apiFetch('feedback/submit.php', {
        method: 'POST',
        body: { ref_id: refId, rating, comment: fullComment },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Could not submit feedback.');
      }
      showToast(data.message || 'Thank you! Your feedback has been submitted.');
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message || 'Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function displayComment(raw) {
    if (!raw) return '“Thank you for your service and for resolving this report.”';
    const idx = raw.indexOf('[Went well:');
    const main = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
    return main ? `“${main}”` : '“Thank you for your service and for resolving this report.”';
  }

  return (
    <>
      {/* Feedback card / submitted panel */}
      {!mine ? (
        <div className="mt-[10px] p-[13px] rounded-[9px] border border-[#82d9bb] flex items-center justify-between gap-3 flex-wrap"
          style={{ background: 'linear-gradient(90deg,#fafffd,#ffffff)' }}>
          <div className="flex items-center gap-[9px] min-w-0">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#dcfaed] text-[#10a968] grid place-items-center text-[14px] flex-shrink-0">★</span>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-[#10213f]">Resident Feedback</div>
              <div className="text-[7px] text-[#71809a] mt-[3px]">How was your experience with this report resolution?</div>
              <div className="text-[7px] text-[#71809a]">Your feedback helps us improve our community services.</div>
            </div>
          </div>
          <button type="button" onClick={openModal}
            className="border-none bg-[#1264e8] text-white rounded-[5px] px-[14px] py-[9px] text-[7px] font-extrabold cursor-pointer hover:bg-[#0d58ce]">
            Give Feedback →
          </button>
        </div>
      ) : (
        <div className="mt-[10px] bg-white border border-[#dfe7f2] rounded-[9px] p-[15px] shadow-[0_3px_15px_rgba(25,55,95,0.06)]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[9px]">
              <span className="w-[30px] h-[30px] rounded-full bg-[#eafaf2] text-[#10a968] grid place-items-center text-[15px]">★</span>
              <span className="text-[11px] font-black text-[#10213f]">Resident Feedback</span>
            </div>
            <span className="text-[#10a968] bg-[#eafaf2] px-[9px] py-[5px] rounded-[15px] text-[7px] font-extrabold">✓ Feedback Submitted</span>
          </div>
          <div className="mt-[14px] flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={i <= mine.rating ? '' : 'text-[#dce4ee]'} style={{ color: i <= mine.rating ? '#ffad00' : undefined, fontSize: 21 }}>★</span>
            ))}
            <span className="ml-[10px] text-[11px] font-black text-[#10213f]">{mine.rating}.0 / 5</span>
          </div>
          {mine.created_at && <div className="mt-[5px] text-[#8190a5] text-[8px]">Feedback submitted on {fmtDate(mine.created_at)}</div>}
          <div className="mt-[11px] bg-[#eef5ff] rounded-[7px] p-[11px] text-[#304a70] text-[9px] leading-[1.6]">{displayComment(mine.comment)}</div>
          <button type="button" onClick={openModal}
            className="mt-3 text-[11px] font-bold text-[#1264e8] hover:underline bg-transparent border-0 cursor-pointer">
            Update my feedback →
          </button>
        </div>
      )}

      {/* Feedback modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[2000] bg-[rgba(6,26,53,0.58)] flex items-center justify-center p-5 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="w-full max-w-[480px] bg-white rounded-[13px] shadow-[0_25px_70px_rgba(0,0,0,0.22)] overflow-hidden my-4 animate-[modalRise_200ms_ease]">
            <div className="flex justify-between items-center px-[19px] py-[17px] border-b border-[#dfe7f2]">
              <div className="text-[14px] font-black text-[#10213f]">Give Feedback</div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close"
                className="w-7 h-7 border-0 rounded-[7px] bg-[#edf3fb] text-[#19355e] cursor-pointer text-[17px] hover:bg-[#e3edfb] hover:text-[#1264e8]">×</button>
            </div>

            <div className="p-5">
              <div className="text-[12px] font-extrabold text-[#10213f] mb-[10px]">
                How satisfied are you with the resolution? <span className="text-[#dc3545]">*</span>
              </div>
              <div className="flex justify-center gap-[18px] max-sm:gap-2 my-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" onClick={() => { setRating(i); setFormError(''); }}
                    aria-label={`Rate ${i} out of 5`}
                    className="border-none bg-transparent cursor-pointer leading-none transition-transform hover:scale-110"
                    style={{ color: i <= rating ? '#ffae00' : '#d5dfec', fontSize: 35 }}>
                    {i <= rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[#8190a5] text-[10px] mx-4 mb-[19px]">
                <span>Very Dissatisfied</span><span>Very Satisfied</span>
              </div>

              <div className="text-[12px] font-extrabold text-[#10213f] mb-[10px]">What do you think?</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="Tell us about your experience..."
                maxLength={500}
                rows={4}
                className="w-full border border-[#d3deec] rounded-lg p-[10px] outline-none text-[12px] text-[#10213f] resize-y focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)] placeholder:text-[#9aa8bb]"
              />

              <div className="text-[12px] font-extrabold text-[#10213f] mt-[17px]">
                What went well? <span className="font-normal text-[#8190a5]">(Optional)</span>
              </div>
              <div className="mt-[10px]">
                {WENT_WELL.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 mb-[9px] text-[#30496c] text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.includes(opt)}
                      onChange={() => toggleCheck(opt)}
                      className="w-[15px] h-[15px] accent-[#1264e8] cursor-pointer"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {formError && (
                <div className="mt-[9px] p-2 rounded-md bg-[#fff1f2] text-[#dc3545] text-[11px] font-bold">{formError}</div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-[19px] py-[13px] border-t border-[#dfe7f2]">
              <button type="button" onClick={() => setModalOpen(false)}
                className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#d5dfec] bg-white text-[#516681] hover:bg-[#f6f9fc]">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={submitting}
                className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#1264e8] bg-[#1264e8] text-white hover:bg-[#0e56ca] disabled:opacity-55">
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
