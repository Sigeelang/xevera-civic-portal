import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { useToast } from './Toast';

/*
 * Resident Feedback on resolved/closed reports (prototype-matched).
 *
 * Feedback card -> right-side drawer (community summary + list +
 * star/comment/checkbox form) -> submitted panel. All real endpoints:
 *   GET  feedback/summary.php?ref_id=     (count, average, my rating)
 *   GET  feedback/community.php?ref_id=    (aggregate + anonymized list)
 *   POST feedback/submit.php              (rating 1-5 + optional comment,
 *                                          resolved/closed only, upsert)
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Stars({ value, size = 21, gap = 4 }) {
  return (
    <span className="inline-flex items-center" style={{ gap }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= value ? '#ffad00' : '#dce4ee', fontSize: size, lineHeight: 1 }}>★</span>
      ))}
    </span>
  );
}

export default function ResidentFeedback({ refId }) {
  const showToast = useToast();
  const [mine, setMine] = useState(null);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [community, setCommunity] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [checked, setChecked] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadSummary = useCallback(() => {
    if (!refId) return;
    apiFetch('feedback/summary.php?ref_id=' + encodeURIComponent(refId))
      .then((d) => {
        setAvg(Number(d?.average) || 0);
        setCount(Number(d?.count) || 0);
        if (d?.mine) {
          setMine(d.mine);
          setRating(Number(d.mine.rating) || 0);
        } else {
          setMine(null);
        }
      })
      .catch(() => {});
  }, [refId]);

  const loadCommunity = useCallback(() => {
    if (!refId) return;
    apiFetch('feedback/community.php?ref_id=' + encodeURIComponent(refId))
      .then((d) => {
        setAvg(Number(d?.average) || 0);
        setCount(Number(d?.count) || 0);
        setCommunity(Array.isArray(d?.items) ? d.items : []);
      })
      .catch(() => {});
  }, [refId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    loadCommunity();
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, loadCommunity]);

  function openDrawer() {
    setRating(mine ? Number(mine.rating) || 0 : 0);
    const raw = mine?.comment || '';
    const idx = raw.indexOf('[Went well:');
    setComment(idx >= 0 ? raw.slice(0, idx).trim() : raw);
    setChecked([]);
    setFormError('');
    setDrawerOpen(true);
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
      setDrawerOpen(false);
      loadSummary();
      loadCommunity();
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

  const roundedAvg = Math.round(avg);

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
              {count > 0 && (
                <div className="text-[8px] text-[#71809a] mt-1 flex items-center gap-1">
                  <Stars value={roundedAvg} size={12} gap={1} />
                  <strong>{avg.toFixed(1)}</strong><span>· {count} resident{count === 1 ? '' : 's'}</span>
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={openDrawer}
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
            <Stars value={mine.rating} />
            <span className="ml-[10px] text-[11px] font-black text-[#10213f]">{mine.rating}.0 / 5</span>
          </div>
          {mine.created_at && <div className="mt-[5px] text-[#8190a5] text-[8px]">Feedback submitted on {fmtDate(mine.created_at)}</div>}
          <div className="mt-[11px] bg-[#eef5ff] rounded-[7px] p-[11px] text-[#304a70] text-[9px] leading-[1.6]">{displayComment(mine.comment)}</div>
          <button type="button" onClick={openDrawer}
            className="mt-3 text-[11px] font-bold text-[#1264e8] hover:underline bg-transparent border-0 cursor-pointer">
            Update my feedback →
          </button>
        </div>
      )}

      {/* Feedback drawer */}
      <div
        className={`fixed inset-0 z-[2000] flex items-stretch justify-end transition-opacity duration-200 ${drawerOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(7,25,52,0.38)' }}
        onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
        aria-hidden={!drawerOpen}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Give Feedback"
          className="bg-white shadow-[-18px_0_55px_rgba(9,32,66,0.18)] overflow-y-auto overflow-x-hidden flex flex-col transition-transform duration-300 w-[min(520px,100vw)] max-sm:w-screen rounded-l-[18px] max-sm:rounded-l-2xl"
          style={{ height: '100vh', transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)' }}>
          <div className="flex justify-between items-center px-[22px] py-5 border-b border-[#dfe7f2] bg-white flex-shrink-0 max-sm:px-[17px]">
            <div className="text-[15px] font-black text-[#10213f]">Give Feedback</div>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close"
              className="w-8 h-8 border-0 rounded-lg bg-[#edf3fb] text-[#19355e] cursor-pointer text-[19px] leading-none hover:bg-[#e3edfb] hover:text-[#1264e8]">×</button>
          </div>

          <div className="flex-1 px-[22px] py-6 max-sm:px-[17px] max-sm:py-5">
            {mine && (
              <div className="mt-0 pt-0 border-0">
                <div className="flex items-center gap-[10px] mb-3">
                  <span className="w-8 h-8 rounded-[9px] bg-[#eafaf2] text-[#10a968] grid place-items-center">★</span>
                  <span className="text-[12px] font-black text-[#10213f]">Resident Feedback</span>
                  <span className="ml-auto text-[#10a968] bg-[#eafaf2] px-[9px] py-[5px] rounded-[15px] text-[7px] font-extrabold">✓ Feedback Submitted</span>
                </div>
                <div className="flex items-center gap-[3px] text-[25px] leading-none">
                  <Stars value={mine.rating} size={25} gap={3} />
                  <span className="ml-[9px] text-[10px] font-black text-[#10213f]">{mine.rating}.0 / 5</span>
                </div>
                <div className="h-px bg-[#dfe7f2] my-6" />
              </div>
            )}

            <div className="mb-[22px] p-[15px] bg-[#f8fbff] border border-[#dce8f7] rounded-[12px]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-[#10213f] mb-[9px]">Community Rating</div>
                  {count > 0 ? (
                    <div className="flex items-center gap-[13px]">
                      <div className="text-[30px] max-sm:text-[27px] leading-none font-black text-[#082d63]">{avg.toFixed(1)}</div>
                      <div>
                        <Stars value={roundedAvg} size={17} gap={1} />
                        <div className="mt-[5px] text-[#7b8ba2] text-[7.5px] font-bold">{count} resident feedback</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[#7b8ba2] text-[11px]">No ratings yet — yours will be the first.</div>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-[10px] border-t border-[#e4ecf6] text-[#8190a5] text-[10px] leading-[1.5]">
                Feedback is shown anonymously to protect resident privacy.
              </div>
            </div>

            {community.length > 0 && (
              <>
                <div className="text-[10px] font-black text-[#10213f]">What Residents Are Saying</div>
                <div className="flex flex-col gap-[9px] mt-[9px] mb-[22px]">
                  {community.map((c, i) => (
                    <div key={i} className="p-[13px] bg-white border border-[#e1e8f2] rounded-[10px]">
                      <div className="flex items-center justify-between gap-[10px] mb-[7px] max-sm:flex-col max-sm:items-start max-sm:gap-[3px]">
                        <span className="text-[#294568] text-[7.5px] font-extrabold">{c.label}</span>
                        <span className="text-[#94a1b2] text-[7px] whitespace-nowrap">{fmtDate(c.created_at)}</span>
                      </div>
                      <div className="text-[#ffad00] text-[14px] leading-none mb-2">
                        {'★'.repeat(c.rating)}{'☆'.repeat(Math.max(0, 5 - c.rating))}
                      </div>
                      {c.comment && <div className="text-[#435a78] text-[8.5px] leading-[1.55]">{c.comment}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="h-px bg-[#dfe7f2] my-5" />
            <div className="text-[12px] font-black text-[#10213f]">Share Your Feedback</div>
            <div className="mt-1 mb-[18px] text-[#71809a] text-[11px]">Tell us about your experience with this report resolution.</div>

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

          <div className="flex justify-end gap-2 px-[22px] py-[15px] border-t border-[#dfe7f2] bg-white sticky bottom-0 max-sm:px-[17px] max-sm:py-[13px]">
            <button type="button" onClick={() => setDrawerOpen(false)}
              className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#d5dfec] bg-white text-[#516681] hover:bg-[#f6f9fc]">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={submitting}
              className="h-9 px-4 rounded-[7px] text-[12px] font-extrabold cursor-pointer border border-[#1264e8] bg-[#1264e8] text-white hover:bg-[#0e56ca] disabled:opacity-55">
              {submitting ? 'Submitting...' : mine ? 'Update Feedback' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
