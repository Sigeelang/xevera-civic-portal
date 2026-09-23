import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from './Toast';

/*
 * Resident Feedback on resolved reports (prototype-matched).
 *
 * Card + right-side drawer, all backed by real endpoints:
 *   GET  feedback/summary.php?ref_id=   (count, average, my rating)
 *   POST feedback/submit.php            (rating 1-5 + optional comment,
 *                                        resolved reports only, upsert)
 * Community feedback stays anonymous: residents see the aggregate
 * score only (feedback/list.php remains staff-only).
 */

function Stars({ value, size = 21 }) {
  return (
    <span aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= value ? '#ffad00' : '#dce4ee', fontSize: size }}>★</span>
      ))}
    </span>
  );
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T') + (/([Zz]|[+-]\d{2}:?\d{2})$/.test(String(v).trim()) ? '' : '+08:00'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ResidentFeedback({ refId }) {
  const showToast = useToast();
  const [summary, setSummary] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    if (!refId) return;
    apiFetch('feedback/summary.php?ref_id=' + encodeURIComponent(refId))
      .then((d) => {
        setSummary(d || { count: 0, average: 0, mine: null });
        if (d?.mine) {
          setRating(Number(d.mine.rating) || 0);
          setComment(d.mine.comment || '');
        }
      })
      .catch(() => {});
  }, [refId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  async function submit() {
    if (!rating) { setFormError('Please select a rating before submitting your feedback.'); return; }
    if (comment.trim().length > 500) { setFormError('Comment must be 500 characters or fewer.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const data = await apiFetch('feedback/submit.php', {
        method: 'POST',
        body: { ref_id: refId, rating, comment: comment.trim() },
      });
      if (!data || data.success !== true) {
        throw new Error(data?.error || 'Could not submit feedback.');
      }
      showToast(data.message || 'Thank you! Your feedback has been submitted.');
      setDrawerOpen(false);
      load();
    } catch (err) {
      setFormError(err.message || 'Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const mine = summary?.mine || null;
  const avg = Number(summary?.average) || 0;
  const count = Number(summary?.count) || 0;

  return (
    <>
      {/* Feedback card */}
      {mine ? (
        <div className="mt-[10px] bg-white border border-[#dfe7f2] rounded-[9px] p-[15px] shadow-[0_3px_15px_rgba(25,55,95,0.06)]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-[9px]">
              <span className="w-[30px] h-[30px] rounded-full bg-[#eafaf2] text-[#10a968] grid place-items-center text-[15px]">★</span>
              <span className="text-[11px] font-black text-[#10213f]">Resident Feedback</span>
            </div>
            <span className="text-[#10a968] bg-[#eafaf2] px-[9px] py-[5px] rounded-[15px] text-[7px] font-extrabold">✓ Feedback Submitted</span>
          </div>
          <div className="mt-[14px] flex items-center gap-1">
            <Stars value={mine.rating} />
            <span className="ml-[10px] text-[11px] font-black text-[#10213f]">{mine.rating}.0 / 5</span>
          </div>
          {mine.created_at && <div className="mt-[5px] text-[#8190a5] text-[8px]">Feedback submitted on {fmtDate(mine.created_at)}</div>}
          {mine.comment && (
            <div className="mt-[11px] bg-[#eef5ff] rounded-[7px] p-[11px] text-[#304a70] text-[9px] leading-[1.6]">“{mine.comment}”</div>
          )}
          <button type="button" onClick={() => { setFormError(''); setDrawerOpen(true); }}
            className="mt-3 text-[11px] font-bold text-[#1264e8] hover:underline bg-transparent border-0 cursor-pointer">
            Update my feedback →
          </button>
        </div>
      ) : (
        <div className="mt-[10px] p-[13px] rounded-[9px] border border-[#82d9bb] flex items-center justify-between gap-3 flex-wrap"
          style={{ background: 'linear-gradient(90deg,#fafffd,#ffffff)' }}>
          <div className="flex items-center gap-[9px] min-w-0">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#dcfaed] text-[#10a968] grid place-items-center text-[14px] flex-shrink-0">★</span>
            <div className="min-w-0">
              <div className="text-[10px] font-black text-[#10213f]">Resident Feedback</div>
              <div className="text-[7px] text-[#71809a] mt-[3px]">How was your experience with this report resolution?</div>
              <div className="text-[7px] text-[#71809a]">Your feedback helps us improve our community services.</div>
              {count > 0 && (
                <div className="text-[8px] text-[#71809a] mt-1">
                  <Stars value={Math.round(avg)} size={12} /> <strong>{avg.toFixed(1)}</strong> · {count} resident{count === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={() => { setFormError(''); setDrawerOpen(true); }}
            className="border-none bg-[#1264e8] text-white rounded-[5px] px-[14px] py-[9px] text-[7px] font-extrabold cursor-pointer hover:bg-[#0d58ce]">
            Give Feedback →
          </button>
        </div>
      )}

      {/* Feedback drawer */}
      <div className={`tl-overlay${drawerOpen ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
        aria-hidden={!drawerOpen}>
        <aside className="tl-drawer" aria-label="Give Feedback">
          <header className="px-[25px] pt-7 pb-[18px] border-b border-[#dce7f5] max-[650px]:px-[18px] max-[650px]:pt-[15px] max-[650px]:pb-[13px]">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] text-[#10213f] font-black">Give Feedback</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close"
                className="w-[35px] h-[35px] rounded-full border-0 bg-transparent text-[#0d3574] text-[28px] leading-none cursor-pointer hover:bg-[#eaf3ff]">×</button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-[25px] py-[22px] max-[650px]:px-[15px] max-[650px]:py-4">
            {mine && (
              <div className="mb-[22px] p-[15px] bg-[#f8fbff] border border-[#dce8f7] rounded-[12px]">
                <div className="flex items-center gap-[10px] mb-[12px]">
                  <span className="w-8 h-8 rounded-[9px] bg-[#eafaf2] text-[#10a968] grid place-items-center">★</span>
                  <span className="text-[12px] font-black text-[#10213f]">Resident Feedback</span>
                  <span className="ml-auto text-[#10a968] bg-[#eafaf2] px-[9px] py-[5px] rounded-[15px] text-[7px] font-extrabold">✓ Feedback Submitted</span>
                </div>
                <div className="flex items-center gap-[3px] text-[25px] leading-none">
                  <Stars value={mine.rating} size={25} />
                  <span className="ml-[9px] text-[10px] font-black text-[#10213f]">{mine.rating}.0 / 5</span>
                </div>
              </div>
            )}

            <div className="mb-[22px] p-[15px] bg-[#f8fbff] border border-[#dce8f7] rounded-[12px]">
              <div className="text-[10px] font-black text-[#10213f] mb-[9px]">Community Rating</div>
              {count > 0 ? (
                <div className="flex items-center gap-[13px]">
                  <div className="text-[30px] leading-none font-black text-[#082d63]">{avg.toFixed(1)}</div>
                  <div>
                    <Stars value={Math.round(avg)} size={17} />
                    <div className="mt-[5px] text-[#7b8ba2] text-[7.5px] font-bold">{count} resident feedback</div>
                  </div>
                </div>
              ) : (
                <div className="text-[#7b8ba2] text-[8px]">No ratings yet — yours will be the first.</div>
              )}
              <div className="mt-3 pt-[10px] border-t border-[#e4ecf6] text-[#8190a5] text-[7px] leading-[1.5]">
                Feedback is shown anonymously to protect resident privacy.
              </div>
            </div>

            <div className="text-[12px] font-black text-[#10213f]">Share Your Feedback</div>
            <div className="mt-1 mb-[18px] text-[#71809a] text-[8px]">Tell us about your experience with this report resolution.</div>

            <div className="text-[12px] font-bold text-[#10213f]">How satisfied are you with the resolution? <span className="text-[#dc3545]">*</span></div>
            <div className="flex justify-center gap-[18px] max-sm:gap-2 my-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => { setRating(i); setFormError(''); }} aria-label={`Rate ${i} out of 5`}
                  className="border-none bg-transparent cursor-pointer leading-none transition-transform hover:scale-110"
                  style={{ color: i <= rating ? '#ffae00' : '#d5dfec', fontSize: 35 }}>
                  {i <= rating ? '★' : '☆'}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[#8190a5] text-[7px] mx-4 mb-[19px]">
              <span>Very Dissatisfied</span><span>Very Satisfied</span>
            </div>

            <div className="text-[12px] font-bold text-[#10213f] mb-2">What do you think?</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              placeholder="Tell us about your experience..."
              maxLength={500}
              rows={4}
              className="w-full border border-[#d3deec] rounded-lg p-[10px] outline-none text-[12px] text-[#10213f] resize-y focus:border-[#1264e8] focus:shadow-[0_0_0_3px_rgba(18,100,232,0.08)] placeholder:text-[#9aa8bb]"
            />
            {formError && (
              <div className="mt-[9px] p-2 rounded-md bg-[#fff1f2] text-[#dc3545] text-[11px] font-bold">{formError}</div>
            )}
          </div>

          <footer className="px-[25px] py-[15px] border-t border-[#dce7f5] flex justify-end gap-2 max-[650px]:px-[15px]">
            <button type="button" onClick={() => setDrawerOpen(false)}
              className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#d5dfec] bg-white text-[#516681] hover:bg-[#f6f9fc]">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={submitting}
              className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#1264e8] bg-[#1264e8] text-white hover:bg-[#0e56ca] disabled:opacity-55">
              {submitting ? 'Submitting...' : mine ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </footer>
        </aside>
      </div>
    </>
  );
}
