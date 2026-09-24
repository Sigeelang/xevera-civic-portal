import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ImageLightbox from '../../components/ImageLightbox';
import ResidentFeedback from '../../components/ResidentFeedback';
import ReportWorkflow from '../../components/staff/ReportWorkflow';
import { getReportActions, getReportStatusConfig, getEffectiveStatus } from '../../utils/reportStatus';

const STATUS_STEPS = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'];

const STEP_DEFAULT_TEXT = {
  Pending: 'Your report is awaiting review.',
  Verified: 'Your report has been verified.',
  Assigned: 'The report has been assigned to staff.',
  'In Progress': 'Work is in progress.',
  Resolved: 'Your report has been resolved.',
  Closed: 'Your report has been closed.',
  Rejected: 'Your report was rejected.',
};

const STEP_PENDING_TEXT = {
  Pending: 'Awaiting review.',
  Verified: 'Not verified yet.',
  Assigned: 'Not assigned yet.',
  'In Progress': 'Not started yet.',
  Resolved: 'Not resolved yet.',
  Closed: 'Not closed yet.',
  Rejected: 'Not rejected.',
};

/* Initials for the update avatar. */
function initialsOf(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/* Admin / Super Admin updates get the purple badge; everyone else is Staff. */
function isAdminRole(role) {
  return role === 'Admin' || role === 'Super Admin';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status, isSuspicious }) {
  const effective = getEffectiveStatus(status, isSuspicious);
  const cfg = getReportStatusConfig(effective);
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] text-[10px] font-extrabold whitespace-nowrap ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

export default function ReportDetailPage({ reportId, onBack }) {
  const { user } = useAuth();
  const showToast = useToast();
  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(1);
  const [showImageModal, setShowImageModal] = useState(false);
  const [evidenceLightbox, setEvidenceLightbox] = useState(null);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [reactBusy, setReactBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const touchStartRef = useRef(0);
  const [actionForm, setActionForm] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [working, setWorking] = useState(false);

  const isResident = user?.role === 'Resident';
  const isStaff = ['Super Admin', 'Admin', 'Staff'].includes(user?.role);

  const load = useCallback(() => {
    if (!reportId) return;
    apiFetch('reports/get.php?id=' + encodeURIComponent(reportId))
      .then((r) => {
        setReport(r);
        setActivePhoto(r.photos?.[0] ? 1 : 0);
        setLiked(!!r.liked);
        setDisliked(!!r.disliked);
      })
      .catch(() => setError('Report not found.'));
    apiFetch('reports/comments.php?id=' + encodeURIComponent(reportId))
      .then((list) => setComments(Array.isArray(list) ? list : []))
      .catch(() => {});
    apiFetch('reports/history.php?id=' + encodeURIComponent(reportId))
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  // Close the fullscreen image viewer with Escape.
  useEffect(() => {
    if (!showImageModal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowImageModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showImageModal]);

  // Close the comments drawer with Escape + lock background scroll.
  useEffect(() => {
    if (!commentsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setCommentsOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [commentsOpen]);

  // Timeline drawer: Escape to close + lock background scroll.
  useEffect(() => {
    if (!timelineOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setTimelineOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [timelineOpen]);

  // Updates drawer: Escape to close + lock background scroll.
  useEffect(() => {
    if (!updatesOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setUpdatesOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [updatesOpen]);

  // Load staff list when assign action is triggered.
  useEffect(() => {
    if (actionForm !== 'assign' || staffList.length) return;
    apiFetch('users/list.php?role=Staff')
      .then((d) => setStaffList(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [actionForm, staffList.length]);

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await apiFetch('reports/comment.php', { method: 'POST', body: { id: reportId, comment: commentText.trim() } });
      setCommentText('');
      const list = await apiFetch('reports/comments.php?id=' + encodeURIComponent(reportId));
      setComments(Array.isArray(list) ? list : []);
      showToast('Comment posted.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to post comment.', 'error');
    } finally {
      setPosting(false);
    }
  }

  function applyReactionState(data) {
    if (!data) return;
    if (typeof data.liked === 'boolean') setLiked(data.liked);
    if (typeof data.disliked === 'boolean') setDisliked(data.disliked);
    setReport((r) => {
      if (!r) return r;
      const next = { ...r };
      if (typeof data.likes === 'number') next.likes = data.likes;
      if (typeof data.dislikes === 'number') next.dislikes = data.dislikes;
      return next;
    });
  }

  async function handleLike() {
    if (reactBusy) return;
    if (!user) {
      showToast('Log in to like reports.', 'error');
      return;
    }
    if (user.role && user.role !== 'Resident') {
      showToast('Reactions are available to resident accounts.', 'error');
      return;
    }
    setReactBusy(true);
    try {
      const data = await apiFetch('reports/like.php', { method: 'POST', body: { id: reportId } });
      applyReactionState(data);
    } catch (err) {
      showToast(err.message || 'Failed to update like.', 'error');
    } finally {
      setReactBusy(false);
    }
  }

  async function handleDislike() {
    if (reactBusy) return;
    if (!user) {
      showToast('Log in to dislike reports.', 'error');
      return;
    }
    if (user.role && user.role !== 'Resident') {
      showToast('Reactions are available to resident accounts.', 'error');
      return;
    }
    setReactBusy(true);
    try {
      const data = await apiFetch('reports/dislike.php', { method: 'POST', body: { id: reportId } });
      applyReactionState(data);
    } catch (err) {
      showToast(err.message || 'Failed to update dislike.', 'error');
    } finally {
      setReactBusy(false);
    }
  }

  /* Mobile bottom-sheet: swipe down to close the timeline/updates drawer. */
  function onDrawerTouchStart(e) {
    try {
      touchStartRef.current = e.touches[0].clientY;
    } catch { /* no-op */ }
  }

  function onDrawerTouchEnd(e) {
    try {
      const endY = e.changedTouches[0].clientY;
      const diff = endY - touchStartRef.current;
      if (typeof window !== 'undefined' && window.innerWidth <= 650 && diff > 100) {
        setTimelineOpen(false);
        setUpdatesOpen(false);
      }
    } catch { /* no-op */ }
  }

  function runAction(action) {
    if (action === 'assign') {
      setActionForm('assign');
    } else if (action === 'update') {
      setActionForm('update');
    } else if (action === 'resolve') {
      setActionForm('resolve');
    } else if (action === 'reject') {
      setActionForm('reject');
    } else {
      setActionForm(action);
    }
  }

  async function submitActionForm(e) {
    e.preventDefault();
    // Required inputs per action (mirrors ReportsMgmtPage validation).
    if (actionForm === 'assign' && !assigneeId) {
      showToast('Select a staff member to assign.', 'error');
      return;
    }
    if (actionForm === 'reject' && !reasonText.trim()) {
      showToast('A rejection reason is required.', 'error');
      return;
    }
    if (actionForm === 'resolve' && !resolutionText.trim()) {
      showToast('Resolution details are required.', 'error');
      return;
    }
    if (actionForm === 'update' && !noteText.trim()) {
      showToast('Please enter a progress update.', 'error');
      return;
    }
    setWorking(true);
    try {
      // Backend contract (reports/update.php): status transitions via
      // `status`, assignment via `assigned_to`, notes via `note`.
      const body = { id: reportId };
      let doneMsg = 'Action completed successfully.';
      if (actionForm === 'assign') {
        body.assigned_to = assigneeId;
        doneMsg = 'Report assigned.';
      } else if (actionForm === 'update') {
        body.note = noteText.trim();
        doneMsg = 'Progress update posted.';
      } else if (actionForm === 'resolve') {
        body.status = 'Resolved';
        body.resolution = resolutionText.trim();
        doneMsg = 'Report marked as resolved.';
      } else if (actionForm === 'reject') {
        body.status = 'Rejected';
        body.rejection_reason = reasonText.trim();
        doneMsg = 'Report rejected.';
      } else if (actionForm === 'verify') {
        body.status = 'Verified';
        doneMsg = 'Report verified.';
      } else if (actionForm === 'start') {
        body.status = 'In Progress';
        doneMsg = 'Work started.';
      } else if (actionForm === 'close') {
        body.status = 'Closed';
        doneMsg = 'Report closed.';
      } else if (actionForm === 'reopen') {
        body.status = report?.status === 'Rejected' ? 'Pending' : 'In Progress';
        doneMsg = 'Report reopened.';
      } else if (actionForm === 'flag_fake') {
        body.flag_fake = true;
        doneMsg = 'Report flagged as fake.';
      }
      await apiFetch('reports/update.php', { method: 'POST', body });
      showToast(doneMsg, 'success');
      setActionForm(null);
      setNoteText('');
      setReasonText('');
      setResolutionText('');
      setAssigneeId('');
      load();
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    } finally {
      setWorking(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <div className="text-[48px] mb-4">{'\u26A0\uFE0F'}</div>
        <p className="text-[15px] text-[#667B9E] mb-6">{error}</p>
        {onBack && (
          <button onClick={onBack} className="px-5 py-2.5 rounded-xl bg-[#0759DC] text-white text-sm font-bold hover:bg-[#063B9B] transition-colors cursor-pointer">
            Go Back
          </button>
        )}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-3 border-[#0759DC] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[13px] text-[#8995A9] mt-4">Loading report details...</p>
      </div>
    );
  }

  const actions = getReportActions(report, user);
  const actionLabels = {
    verify: 'Verify', assign: 'Assign Staff', start: 'Start Work', update: 'Add Update',
    resolve: 'Mark Resolved', close: 'Close Report', reopen: 'Reopen', reject: 'Reject',
    flag_fake: 'Flag as Fake',
  };
  const actionIcons = {
    verify: 'verify', assign: 'user', start: 'bolt', update: 'chat',
    resolve: 'check', close: 'lock', reopen: 'recycle', reject: 'alerttriangle',
    flag_fake: 'flag',
  };
  const firstPhoto = report.photos?.[0] || null;
  const shownPhoto = (report.photos && report.photos[activePhoto - 1]) || firstPhoto;
  const currentIndex = STATUS_STEPS.indexOf(report.status);

  const historyByStatus = {};
  history.forEach((h) => { historyByStatus[h.new_status] = h; });

  /*
   * Resident-visible updates only (the API already filters internal notes).
   * A work note is used when present; otherwise the status-change itself is
   * shown so the section stays informative.
   */
  const staffUpdates = [...history]
    .map((h) => ({
      ...h,
      message: (h.note && String(h.note).trim()) ? h.note : (STEP_DEFAULT_TEXT[h.new_status] || ''),
    }))
    .filter((h) => h.message)
    .reverse(); // newest first

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-7 pt-6 pb-[50px]">
      <style>{`@keyframes drawerIn{from{transform:translateX(22px);opacity:.55}to{transform:translateX(0);opacity:1}}
.tl-overlay{position:fixed;inset:0;background:rgba(18,42,78,.38);backdrop-filter:blur(2px);z-index:1000;opacity:0;visibility:hidden;transition:.25s}
.tl-overlay.active{opacity:1;visibility:visible}
.tl-drawer{position:fixed;top:0;right:0;width:420px;max-width:100vw;height:100dvh;background:#fff;z-index:1001;transform:translateX(100%);transition:transform .3s ease;box-shadow:-12px 0 35px rgba(20,55,100,.15);display:flex;flex-direction:column}
.tl-overlay.active .tl-drawer{transform:translateX(0)}
@media (max-width:650px){
.tl-drawer{width:100%;height:86dvh;top:auto;bottom:0;right:0;border-radius:22px 22px 0 0;transform:translateY(100%);box-shadow:0 -10px 35px rgba(20,55,100,.2)}
.tl-overlay.active .tl-drawer{transform:translateY(0)}
.tl-grab{display:block !important}
}`}</style>
      <button onClick={() => onBack && onBack()}
        className="inline-flex items-center gap-1.5 text-[13px] sm:text-[15px] font-bold text-[#0759DC] mb-4 sm:mb-[22px] bg-none border-none cursor-pointer hover:underline">
        {'\u2190'} Back to Reports
      </button>

      {/* Report hero — unified for all roles */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(370px,1fr)] gap-4 sm:gap-[18px] mb-4 sm:mb-[18px]">
        {/* Image */}
        <div className="bg-white border border-[#DCE6F4] rounded-2xl overflow-hidden shadow-[0_4px_15px_rgba(16,48,92,0.04)]">
          <div className="relative w-full h-[245px] sm:h-[285px] lg:h-[385px] bg-[#EAF0F8] overflow-hidden">
            {shownPhoto ? (
              <img key={shownPhoto} src={uploadUrl(shownPhoto)} alt={report.title} className="w-full h-full object-cover block" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="absolute inset-0 grid place-items-center" style={{ background: 'linear-gradient(135deg,#FFD1C8,#F6A99A)' }}>
                <div className="flex flex-col items-center gap-2.5 text-white font-bold">
                  <span className="w-[70px] h-[70px] rounded-[20px] grid place-items-center" style={{ background: 'rgba(255,255,255,0.25)' }}>
                    <Icon name="camera" size={30} />
                  </span>
                  <span>Report Image</span>
                </div>
              </div>
            )}
            <button type="button" onClick={() => shownPhoto && setShowImageModal(true)} aria-label="Expand image"
              className="absolute top-[15px] right-[15px] w-10 h-10 rounded-full border-0 text-white grid place-items-center cursor-pointer text-lg" style={{ background: 'rgba(12,25,48,0.82)' }}>⛶</button>
          </div>
          {report.photos?.length > 1 && (
            <div className="flex gap-2 p-2.5 flex-wrap border-t border-[#DCE6F4] bg-white">
              {report.photos.slice(0, 3).map((p, i) => (
                <div key={i} onClick={() => setActivePhoto(i + 1)}
                  className={`w-[70px] h-[58px] rounded-[9px] bg-cover bg-center cursor-pointer transition-all ${activePhoto === i + 1 ? 'ring-2 ring-[#1264F4]' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundImage: `url(${uploadUrl(p)})` }} />
              ))}
              {report.photos.length > 3 && (
                <button type="button" onClick={() => shownPhoto && setShowImageModal(true)}
                  className="w-[70px] h-[58px] border border-[#DCE6F4] rounded-[9px] bg-[#F4F8FE] text-[#102957] font-extrabold cursor-pointer text-sm">
                  +{report.photos.length - 3}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-white border border-[#DCE6F4] rounded-2xl p-5 sm:p-[25px] shadow-[0_4px_15px_rgba(16,48,92,0.04)]">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h2 className="text-[21px] sm:text-[26px] font-extrabold text-[#102957] leading-tight">{report.title}</h2>
            <StatusPill status={report.status} isSuspicious={report.is_suspicious} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
            {[
              { icon: 'tag', label: 'Report ID', val: report.id, link: true },
              { icon: 'box', label: 'Category', val: report.category },
              { icon: 'calendar', label: 'Submitted On', val: `${formatDate(report.created_at || report.date)}${formatTime(report.created_at) ? ` • ${formatTime(report.created_at)}` : ''}` },
              { icon: 'user', label: 'Assigned To', val: report.assigned && report.assigned !== '-' ? report.assigned : 'Awaiting assignment' },
              { icon: 'user', label: 'Submitted By', val: report.reporter },
              { icon: 'pin', label: 'Location', val: report.location },
              ...(isResident ? [] : [{ icon: 'eye', label: 'Visibility', val: 'Visible to everyone' }]),
            ].map((d) => (
              <div key={d.label} className="flex gap-3 min-w-0">
                <span className="w-[42px] h-[42px] rounded-xl bg-[#EDF5FF] text-[#1264F4] grid place-items-center flex-shrink-0">
                  <Icon name={d.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#7C8EAA] uppercase tracking-[0.35px] mb-1">{d.label}</div>
                  <div className={`text-sm font-bold leading-snug break-words ${d.link ? 'text-[#1264F4]' : 'text-[#102957]'}`}>{d.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Description — moved below the detail fields */}
          <div className="mt-6 pt-5 border-t border-[#EDF1F6]">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[#EDF4FF] text-[#1769FF]" aria-hidden="true">
                <Icon name="filetext" size={16} />
              </span>
              <h3 className="m-0 text-[15px] font-extrabold text-[#102044]">Description</h3>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
              <p className="m-0 whitespace-pre-line text-[14px] leading-[1.65] text-[#102044]">
                {report.desc || 'No description provided.'}
              </p>
            </div>
          </div>

          {/* Like + Dislike + Comment counts (visible to all) */}
          <div className="flex gap-2 mt-6">
            <button onClick={handleLike} disabled={reactBusy}
              className={`h-10 px-3 rounded-[18px] border text-[12px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${liked ? 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]' : 'bg-white border-[#E3E9F2] text-[#102044] hover:border-[#0759DC]'}`}>
              {'\uD83D\uDC4D'} {report.likes || 0}
            </button>
            <button onClick={handleDislike} disabled={reactBusy} aria-label="Dislike this report"
              className={`h-10 px-3 rounded-[18px] border text-[12px] font-bold transition-colors cursor-pointer disabled:opacity-60 ${disliked ? 'bg-[#EDE9FE] border-[#C4B5FD] text-[#6D28D9]' : 'bg-white border-[#E3E9F2] text-[#102044] hover:border-[#0759DC]'}`}>
              {'\uD83D\uDC4E'} {report.dislikes || 0}
            </button>
            <button onClick={() => setCommentsOpen(true)} aria-label="View comments"
              className="h-8 px-3 rounded-[18px] border border-[#E3E9F2] bg-white text-[12px] font-bold text-[#102044] transition-colors cursor-pointer hover:border-[#0759DC] hover:text-[#0759DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0759DC]/25">
              {'\uD83D\uDCAC'} {report.comments || 0}
            </button>
          </div>

          {/* Under Review warning panel (visible to residents) */}
          {isResident && report.is_suspicious ? (
            <div className="mt-5 rounded-[14px] border border-[#F5E6A3] bg-[#FFF8E1] p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[#FFF3CD] text-[#B8860B]">{'\u26A0\uFE0F'}</span>
                <h3 className="m-0 text-[14px] font-extrabold text-[#856404]">This report is under review</h3>
              </div>
              <p className="m-0 text-[12px] leading-relaxed text-[#856404] mb-3">
                Our team has flagged this report for verification. You&apos;ll still receive updates as the review progresses. No action is needed from you at this time.
              </p>
              <div className="rounded-[10px] border border-[#F5E6A3] bg-[#FFFDF5] px-4 py-3">
                <div className="text-[11px] font-extrabold text-[#856404] mb-2">What happens next?</div>
                <ul className="m-0 pl-4 space-y-1.5">
                  <li className="text-[11px] leading-relaxed text-[#856404]">Our team will verify the details of your report.</li>
                  <li className="text-[11px] leading-relaxed text-[#856404]">You&apos;ll be notified when the review is complete.</li>
                  <li className="text-[11px] leading-relaxed text-[#856404]">If the report is confirmed, it will proceed through our standard workflow.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {/* Visibility notice (hidden for residents) */}
          {!isResident && (
            <div className="mt-4 px-3.5 py-3 border border-[#C9DCFF] bg-[#EFF6FF] text-[#1257CB] rounded-[10px] text-[10px] font-semibold">
              {'\u24D8'} This report is visible to everyone. Staff will review and take action.
            </div>
          )}

          {/* Staff workflow panel */}
          {isStaff && (
            <div className="mt-5 pt-5 border-t border-[#DCE6F4]">
              <div className="text-[14px] font-extrabold text-[#102957] mb-3">Workflow</div>
              <ReportWorkflow status={report.status} />
              {report.assigned && report.assigned !== '-' && (
                <div className="mt-3 text-[12px] text-[#102957]"><span className="font-bold">Assigned to:</span> {report.assigned}</div>
              )}
              {actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <button key={a} onClick={() => runAction(a)} disabled={working}
                      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        a === 'reject' ? 'border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEF2F2]'
                        : a === 'resolve' ? 'bg-[#0F8F63] text-white hover:bg-[#0B7A55]'
                        : a === 'close' ? 'bg-[#374151] text-white hover:bg-[#1F2937]'
                        : a === 'reopen' ? 'bg-[#F59E0B] text-white hover:bg-[#D97706]'
                        : a === 'assign' ? 'border border-[#DBE5F0] bg-white text-[#0759DC] hover:bg-[#EEF5FF]'
                        : 'bg-[#0759DC] text-white hover:bg-[#063B9B]'
                      }`}>{actionIcons[a] && <Icon name={actionIcons[a]} size={14} />}{actionLabels[a]}</button>
                  ))}
                </div>
              )}
              {actionForm && (
                <form onSubmit={submitActionForm} className="mt-3 space-y-3">
                  {actionForm === 'assign' && (
                    <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E3E9F2] text-sm bg-white focus:outline-none focus:border-[#0759DC]">
                      <option value="">Select staff member...</option>
                      {staffList.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
                  {actionForm === 'update' && (
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Describe the latest progress..."
                      className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E3E9F2] text-sm bg-white focus:outline-none focus:border-[#0759DC] resize-y" />
                  )}
                  {actionForm === 'resolve' && (
                    <textarea value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} rows={3} placeholder="Describe how the report was resolved..."
                      className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E3E9F2] text-sm bg-white focus:outline-none focus:border-[#0759DC] resize-y" />
                  )}
                  {actionForm === 'reject' && (
                    <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={3} placeholder="Explain why this report is being rejected..."
                      className="w-full px-3.5 py-2.5 rounded-[10px] border border-[#E3E9F2] text-sm bg-white focus:outline-none focus:border-[#0759DC] resize-y" />
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setActionForm(null)}
                      className="px-4 py-2.5 rounded-[10px] border border-[#E3E9F2] text-sm font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer">Cancel</button>
                    <button type="submit" disabled={working}
                      className="px-4 py-2.5 rounded-[10px] bg-[#0759DC] text-white text-xs font-bold hover:bg-[#063B9B] transition-colors disabled:opacity-50 cursor-pointer">
                      {working ? 'Saving...' : 'Confirm'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Timeline trigger — opens the timeline drawer */}
      <button type="button" onClick={() => setTimelineOpen(true)}
        className="mt-1 mb-5 w-full bg-white border border-[#1264e8] rounded-xl min-h-[78px] p-[14px_18px] flex items-center gap-[15px] cursor-pointer text-left transition-all hover:bg-[#f5f9ff] hover:-translate-y-px">
        <span className="w-[43px] h-[43px] rounded-full bg-[#eaf3ff] text-[#1264e8] grid place-items-center text-[22px] flex-shrink-0" aria-hidden="true">
          {'\u25F7'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[#0d3574] font-extrabold text-[17px]">Status Timeline</span>
          <span className="block text-[#6d82a3] text-[12px] mt-[5px]">View the current status and progress of this report.</span>
        </span>
        <span className="hidden min-[401px]:inline-block bg-[#1264e8] text-white rounded-lg px-5 py-3 text-[13px] font-bold whitespace-nowrap">
          View Timeline →
        </span>
        <span className="min-[401px]:hidden text-[#1264e8] text-2xl" aria-hidden="true">›</span>
      </button>

      {/* Updates & Responses trigger — opens the updates drawer */}
      <button type="button" onClick={() => setUpdatesOpen(true)}
        className="mt-1 mb-5 w-full bg-white border border-[#1264e8] rounded-xl min-h-[78px] p-[14px_18px] flex items-center gap-[15px] cursor-pointer text-left transition-all hover:bg-[#f5f9ff] hover:-translate-y-px">
        <span className="w-[43px] h-[43px] rounded-full bg-[#eaf3ff] text-[#1264e8] grid place-items-center flex-shrink-0" aria-hidden="true">
          <Icon name="letter" size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 text-[#0d3574] font-extrabold text-[17px]">
            Updates & Responses
            {staffUpdates.length > 0 && (
              <span className="inline-grid place-items-center min-w-[24px] h-6 px-1.5 rounded-full bg-[#1264e8] text-white text-[11px] font-extrabold">
                {staffUpdates.length}
              </span>
            )}
          </span>
          <span className="block text-[#6d82a3] text-[12px] mt-[5px]">Official updates from staff and administrators regarding your report.</span>
        </span>
        <span className="hidden min-[401px]:inline-block bg-[#1264e8] text-white rounded-lg px-5 py-3 text-[13px] font-bold whitespace-nowrap">
          View Updates →
        </span>
        <span className="min-[401px]:hidden text-[#1264e8] text-2xl" aria-hidden="true">›</span>
      </button>

      {/* Resolution Evidence - only for Resolved */}
      {report.status === 'Resolved' && (
        <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 mb-5 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-[#EAF6FF] text-[#0759DC] grid place-items-center"><Icon name="shield" size={16} /></span>
              <h3 className="text-[14px] font-extrabold text-[#102044]">Resolution Evidence</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[20px] text-[10px] font-extrabold bg-[#EAF6FF] text-[#0759DC]">✓ Resolved</span>
          </div>
          <p className="text-[12px] text-[#6B7280] mb-5">This evidence was submitted by the assigned staff member to document the completed resolution.</p>

          {report.evidence_photos && report.evidence_photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {report.evidence_photos.slice(0, 2).map((p, i) => (
                <button key={i} type="button" onClick={() => setEvidenceLightbox(i)}
                  className="relative rounded-[10px] overflow-hidden border border-[#E3E9F2] bg-[#F3F6FB] h-[140px] p-0 cursor-zoom-in">
                  <img src={uploadUrl(p)} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-[6px] bg-black/60 text-white text-[9px] font-bold">Evidence Photo {i + 1}</span>
                </button>
              ))}
              {report.evidence_photos.length === 1 && (
                <div className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] h-[140px] grid place-items-center text-[#94A3B8] text-[11px]">No second photo</div>
              )}
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center text-[12px] text-[#94A3B8] mb-5">No evidence photos attached.</div>
          )}
          {report.evidence_photos && report.evidence_photos.length > 2 && (
            <button onClick={() => setEvidenceLightbox(0)} className="mb-5 text-[11px] font-bold text-[#0759DC] hover:underline bg-transparent border-0 cursor-pointer">View full evidence ({report.evidence_photos.length} photos) →</button>
          )}

          <div className="mb-5">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#8A96AA] mb-1.5">Resolution Notes</div>
            <p className="text-[13px] text-[#344054] leading-relaxed bg-[#F9FAFB] border border-[#E3E9F2] rounded-[10px] p-3.5 whitespace-pre-line">{report.resolution || 'The damaged canal was cleaned and cleared of debris.'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] mb-4">
            <div className="bg-[#F9FAFB] border border-[#E3E9F2] rounded-[10px] p-3"><div className="text-[9px] uppercase font-extrabold text-[#8A96AA] mb-1">Resolved by</div><div className="text-[12px] font-bold text-[#102044]">{report.resolved_by_name || report.assigned || '—'}</div></div>
            <div className="bg-[#F9FAFB] border border-[#E3E9F2] rounded-[10px] p-3"><div className="text-[9px] uppercase font-extrabold text-[#8A96AA] mb-1">Staff role</div><div className="text-[12px] font-semibold text-[#102044]">{report.resolved_by_role || 'Maintenance Staff'}</div></div>
            <div className="bg-[#F9FAFB] border border-[#E3E9F2] rounded-[10px] p-3"><div className="text-[9px] uppercase font-extrabold text-[#8A96AA] mb-1">Resolved on</div><div className="text-[11px] font-semibold text-[#102044]">{report.resolved_at ? new Date(report.resolved_at.replace(' ','T')+'+08:00').toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '—'}</div></div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-[#0F8F63] bg-[#EAF6FF] border border-[#C3E6D8] rounded-[10px] px-3.5 py-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0F8F63] text-white grid place-items-center text-[11px]">✓</span>
            Resolution confirmed by Xevera Management
          </div>
        </div>
      )}

      {/* Resident Feedback — resolved/closed reports, residents only.
          NOTE: reports/get.php returns the ref_id inside `id`
          (there is no `ref_id` key), so gate on report.id. */}
      {['Resolved', 'Closed'].includes(String(report.status || '').trim()) && isResident && report.id && (
        <ResidentFeedback refId={report.id} />
      )}

      {/* Status Timeline drawer (desktop panel / mobile bottom sheet) */}
      <div className={`tl-overlay${timelineOpen ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setTimelineOpen(false); }}
        aria-hidden={!timelineOpen}>
        <aside className="tl-drawer" aria-label="Status Timeline"
          onTouchStart={onDrawerTouchStart} onTouchEnd={onDrawerTouchEnd}>
          <header className="px-[25px] pt-7 pb-[18px] border-b border-[#dce7f5] max-[650px]:px-[18px] max-[650px]:pt-[15px] max-[650px]:pb-[13px]">
            <span className="tl-grab mx-auto mb-[14px] hidden w-12 h-[5px] rounded-[10px] bg-[#9ba8ba]" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-[39px] h-[39px] rounded-full border-[3px] border-[#1264e8] text-[#1264e8] grid place-items-center text-[19px]" aria-hidden="true">
                  {'\u25F7'}
                </span>
                <h2 className="text-[21px] text-[#0d3574] font-extrabold">Status Timeline</h2>
              </div>
              <button type="button" onClick={() => setTimelineOpen(false)} aria-label="Close"
                className="w-[35px] h-[35px] rounded-full border-0 bg-transparent text-[#0d3574] text-[28px] leading-none cursor-pointer hover:bg-[#eaf3ff]">
                {'\u00D7'}
              </button>
            </div>
            <p className="text-[#6d82a3] text-[14px] leading-[1.45] mt-[13px] max-[650px]:text-[12px] max-[650px]:mt-2">
              Track the progress of your report from submission to resolution.
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-[25px] py-[22px] max-[650px]:px-[15px] max-[650px]:py-4">
            <div className="relative pl-1">
              <span className="absolute left-[17px] top-[19px] bottom-[19px] w-[2px] bg-[#d8e1ee]" aria-hidden="true" />
              {STATUS_STEPS.map((step, index) => {
                const entry = historyByStatus[step];
                // Position-guarded: an entry from a previous cycle (e.g. a
                // Resolved note before a reopen back to In Progress) must not
                // mark a future step done.
                const done = Boolean(entry) && currentIndex >= 0 && index <= currentIndex;
                const current = index === currentIndex && currentIndex >= 0;
                const text = entry?.note || ((done || current) ? (STEP_DEFAULT_TEXT[step] || '') : (STEP_PENDING_TEXT[step] || ''));
                return (
                  <div key={step} className="relative flex gap-[13px] mb-3">
                    <span
                      aria-hidden="true"
                      className={`z-[2] flex-shrink-0 rounded-full grid place-items-center text-white text-[13px] font-bold ${
                        current
                          ? 'w-[38px] h-[38px] -ml-[2px] bg-[#09965a] border-4 border-[#09965a]'
                          : done
                            ? 'w-[34px] h-[34px] bg-[#1264e8] border-4 border-[#1264e8]'
                            : 'w-[34px] h-[34px] bg-white border-4 border-[#a8b4c7]'
                      }`}
                    >
                      {(done || current) ? '\u2713' : ''}
                    </span>
                    <div className={`flex-1 rounded-[9px] border px-[13px] py-[11px] min-h-[70px] ${current ? 'bg-[#e3f8ef] border-[#8bdbb7]' : 'bg-white border-[#dce7f5]'}`}>
                      <div className={`text-[14px] font-extrabold ${current ? 'text-[#09965a]' : 'text-[#0d3574]'}`}>{step}</div>
                      {entry?.date && <div className="text-[11px] text-[#6880a2] mt-1">{entry.date}</div>}
                      {entry?.actor && <div className="text-[10px] font-semibold text-[#67748A] mt-0.5">{entry.actor}</div>}
                      <div className="text-[12px] text-[#48688f] mt-[5px] leading-[1.4]">{text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="px-[25px] pt-[15px] pb-[25px] border-t border-[#dce7f5] max-[650px]:px-[15px] max-[650px]:py-[10px] max-[650px]:pb-[15px]">
            <button type="button" onClick={() => setTimelineOpen(false)}
              className="w-full h-[50px] border-0 bg-[#eaf3ff] text-[#1264e8] rounded-[25px] text-base font-bold cursor-pointer hover:bg-[#d8eaff] max-[650px]:h-12 max-[650px]:text-[15px]">
              {'\u00D7'}&nbsp; Close
            </button>
          </footer>
        </aside>
      </div>

      {/* Updates & Responses drawer (desktop panel / mobile bottom sheet) */}
      <div className={`tl-overlay${updatesOpen ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setUpdatesOpen(false); }}
        aria-hidden={!updatesOpen}>
        <aside className="tl-drawer" aria-label="Updates and Responses"
          onTouchStart={onDrawerTouchStart} onTouchEnd={onDrawerTouchEnd}>
          <header className="px-[25px] pt-7 pb-[18px] border-b border-[#dce7f5] max-[650px]:px-[18px] max-[650px]:pt-[15px] max-[650px]:pb-[13px]">
            <span className="tl-grab mx-auto mb-[14px] hidden w-12 h-[5px] rounded-[10px] bg-[#9ba8ba]" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-[39px] h-[39px] rounded-full border-[3px] border-[#1264e8] text-[#1264e8] grid place-items-center" aria-hidden="true">
                  <Icon name="letter" size={18} />
                </span>
                <h2 className="text-[21px] text-[#0d3574] font-extrabold">Updates & Responses</h2>
              </div>
              <button type="button" onClick={() => setUpdatesOpen(false)} aria-label="Close"
                className="w-[35px] h-[35px] rounded-full border-0 bg-transparent text-[#0d3574] text-[28px] leading-none cursor-pointer hover:bg-[#eaf3ff]">
                {'\u00D7'}
              </button>
            </div>
            <p className="text-[#6d82a3] text-[14px] leading-[1.45] mt-[13px] max-[650px]:text-[12px] max-[650px]:mt-2">
              Official updates from staff and administrators regarding your report.
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-[25px] py-[22px] max-[650px]:px-[15px] max-[650px]:py-4">
            {/* Under Review entry — shown at top when flagged */}
            {report.is_suspicious && (
              <div className="mb-4 rounded-[12px] border border-[#F5E6A3] bg-[#FFF8E1] px-4 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="grid h-[31px] w-[31px] place-items-center rounded-full bg-[#FFF3CD] text-[10px] font-extrabold text-[#B8860B]" aria-hidden="true">{'\u26A0\uFE0F'}</span>
                  <span className="text-[12.5px] font-extrabold text-[#856404]">Xevera Team</span>
                  <span className="rounded-[6px] px-2 py-[2px] text-[9.5px] font-extrabold bg-[#FFF3CD] text-[#B8860B]">System</span>
                  <span className="ml-auto whitespace-nowrap text-[10px] text-[#B8860B]">Flagged for Review</span>
                </div>
                <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-[#856404]">
                  This report has been flagged for review by our team. We are verifying the details to ensure accuracy. You will be notified once the review is complete.
                </p>
              </div>
            )}

            {staffUpdates.length === 0 && !report.is_suspicious ? (
              <div className="rounded-[12px] border border-dashed border-[#D7E2F0] bg-[#F8FAFC] px-4 py-8 text-center">
                <p className="m-0 text-[13px] font-semibold leading-relaxed text-[#7C8EAA]">
                  No updates yet. We&apos;ll notify you when there is progress on your report.
                </p>
              </div>
            ) : staffUpdates.length === 0 && report.is_suspicious ? null : (
              <ol className="relative m-0 list-none p-0">
                {staffUpdates.map((u, i) => {
                  const admin = isAdminRole(u.actor_role);
                  return (
                    <li key={u.id ?? i} className="relative pb-4 pl-[42px] last:pb-0">
                      {/* vertical connector */}
                      {i < staffUpdates.length - 1 && (
                        <span className="absolute bottom-0 left-[15px] top-[32px] w-[2px] bg-[#E4EBF4]" aria-hidden="true" />
                      )}
                      {/* avatar / initials */}
                      <span
                        className={`absolute left-0 top-0 grid h-[31px] w-[31px] place-items-center rounded-full text-[10px] font-extrabold text-white ${admin ? 'bg-[#7A4CE0]' : 'bg-[#1769FF]'}`}
                        aria-hidden="true"
                      >
                        {initialsOf(u.actor || 'Xevera')}
                      </span>
                      <div className="rounded-[12px] border border-[#E3E9F2] bg-[#F9FAFB] px-4 py-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-extrabold text-[#102044]">{u.actor || 'Xevera Team'}</span>
                          <span className={`rounded-[6px] px-2 py-[2px] text-[9.5px] font-extrabold ${admin ? 'bg-[#F1EAFF] text-[#6B35D6]' : 'bg-[#EAF2FF] text-[#1264F4]'}`}>
                            {admin ? 'Admin' : 'Staff'}
                          </span>
                          <span className="ml-auto whitespace-nowrap text-[10px] text-[#7C8EAA]">
                            {u.date}{u.new_status ? ` • ${u.new_status}` : ''}
                          </span>
                        </div>
                        <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-[#344054]">{u.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <footer className="px-[25px] pt-[15px] pb-[25px] border-t border-[#dce7f5] max-[650px]:px-[15px] max-[650px]:py-[10px] max-[650px]:pb-[15px]">
            <button type="button" onClick={() => setUpdatesOpen(false)}
              className="w-full h-[50px] border-0 bg-[#eaf3ff] text-[#1264e8] rounded-[25px] text-base font-bold cursor-pointer hover:bg-[#d8eaff] max-[650px]:h-12 max-[650px]:text-[15px]">
              {'\u00D7'}&nbsp; Close
            </button>
          </footer>
        </aside>
      </div>

      {/* Comments drawer */}
      {commentsOpen && (
        <div className="fixed inset-0 z-[900] flex justify-end" role="dialog" aria-modal="true" aria-label="Comments">
          <div className="absolute inset-0 bg-[rgba(8,22,45,0.45)]" onClick={() => setCommentsOpen(false)} />
          <aside className="relative z-[1] flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-14px_0_45px_rgba(16,32,68,0.20)] animate-[drawerIn_220ms_ease]">
            <header className="flex h-[62px] flex-shrink-0 items-center justify-between gap-3 border-b border-[#E3E9F2] px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[#EDF4FF] text-[#0759DC]" aria-hidden="true">{'\uD83D\uDCAC'}</span>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold leading-tight text-[#102044]">Comments</div>
                  <div className="text-[11px] text-[#8995A9]">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</div>
                </div>
              </div>
              <button type="button" onClick={() => setCommentsOpen(false)} aria-label="Close comments"
                className="grid h-8 w-8 flex-shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-[#F1F5FA] text-[18px] leading-none text-[#102044] transition-colors hover:bg-[#E4EBF4]">
                {'\u00D7'}
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {comments.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-[#8995A9]">
                  <div className="mb-3 grid h-[64px] w-[64px] place-items-center rounded-full bg-[#EDF4FF] text-[26px] text-[#0759DC]">{'\uD83D\uDCAC'}</div>
                  <strong className="mb-1 text-[12px] text-[#56637A]">No comments yet.</strong>
                  <span className="text-[11px]">Be the first to comment.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-[#F1F5F9] bg-[#F9FAFB] px-4 py-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-extrabold text-[#102044]">{c.user}</span>
                        <span className="flex-shrink-0 text-[10px] text-[#9AA6B8]">{c.date}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[#374151]">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="flex-shrink-0 border-t border-[#E3E9F2] bg-white px-5 py-4">
              {user ? (
                <form onSubmit={handleComment}>
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3}
                    placeholder="Share your thoughts or updates on this report..."
                    className="min-h-[78px] w-full resize-y rounded-[11px] border border-[#E3E9F2] bg-white px-3.5 py-3 text-sm placeholder:text-[#9AA3B5] focus:border-[#0759DC] focus:outline-none focus:ring-[3px] focus:ring-[rgba(7,89,220,0.08)]" />
                  <button type="submit" disabled={posting || !commentText.trim()}
                    className="mt-2.5 h-[40px] w-full cursor-pointer rounded-[9px] bg-[#0759DC] text-[12px] font-extrabold text-white transition-colors hover:bg-[#063B9B] disabled:opacity-50">
                    {posting ? 'Posting...' : 'Add Comment'}
                  </button>
                </form>
              ) : (
                <p className="text-center text-xs text-[#8995A9]">Log in to comment.</p>
              )}
            </footer>
          </aside>
        </div>
      )}

      {/* Fullscreen image viewer */}
      {showImageModal && (
        <ImageLightbox
          photos={report.photos || []}
          index={Math.max(0, activePhoto - 1)}
          onIndex={(i) => setActivePhoto(i + 1)}
          onClose={() => setShowImageModal(false)}
          title={report.title}
        />
      )}

      {evidenceLightbox !== null && report.evidence_photos?.length > 0 && (
        <ImageLightbox
          photos={report.evidence_photos}
          index={evidenceLightbox}
          onIndex={setEvidenceLightbox}
          onClose={() => setEvidenceLightbox(null)}
          title="Resolution evidence"
        />
      )}
    </div>
  );
}
