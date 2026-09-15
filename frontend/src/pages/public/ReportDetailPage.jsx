import { useState, useEffect, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ImageLightbox from '../../components/ImageLightbox';
import ReportWorkflow from '../../components/staff/ReportWorkflow';
import { getReportActions, getReportStatusConfig } from '../../utils/reportStatus';

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

function StatusPill({ status }) {
  const cfg = getReportStatusConfig(status);
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
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
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

  function handleLike() {
    setLiked((v) => !v);
    setReport((r) => r ? { ...r, likes: (r.likes || 0) + (liked ? -1 : 1) } : r);
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
    setWorking(true);
    try {
      const body = { id: reportId, action: actionForm };
      if (actionForm === 'assign') body.assignee_id = assigneeId;
      if (actionForm === 'update') body.note = noteText;
      if (actionForm === 'resolve') body.resolution = resolutionText;
      if (actionForm === 'reject') body.reason = reasonText;
      await apiFetch('reports/update.php', { method: 'POST', body });
      showToast('Action completed successfully.', 'success');
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
  const visibleUpdates = showAllUpdates ? staffUpdates : staffUpdates.slice(0, 3);

  return (
    <div className="w-full max-w-[1180px] mx-auto px-3 sm:px-7 pt-6 pb-[50px]">
      <style>{'@keyframes drawerIn{from{transform:translateX(22px);opacity:.55}to{transform:translateX(0);opacity:1}}'}</style>
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
            <StatusPill status={report.status} />
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

          {/* Like + Comment counts (visible to all) */}
          <div className="flex gap-2 mt-6">
            <button onClick={handleLike}
              className={`h-8 px-3 rounded-[18px] border text-[12px] font-bold transition-colors cursor-pointer ${liked ? 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]' : 'bg-white border-[#E3E9F2] text-[#102044] hover:border-[#0759DC]'}`}>
              {'\uD83D\uDC4D'} {report.likes || 0}
            </button>
            <button onClick={() => setCommentsOpen(true)} aria-label="View comments"
              className="h-8 px-3 rounded-[18px] border border-[#E3E9F2] bg-white text-[12px] font-bold text-[#102044] transition-colors cursor-pointer hover:border-[#0759DC] hover:text-[#0759DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0759DC]/25">
              {'\uD83D\uDCAC'} {report.comments || 0}
            </button>
          </div>

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
                      className={`px-4 py-2.5 rounded-[10px] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        a === 'reject' ? 'border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEF2F2]'
                        : a === 'resolve' ? 'bg-[#0F8F63] text-white hover:bg-[#0B7A55]'
                        : a === 'close' ? 'bg-[#374151] text-white hover:bg-[#1F2937]'
                        : a === 'reopen' ? 'bg-[#F59E0B] text-white hover:bg-[#D97706]'
                        : a === 'assign' ? 'border border-[#DBE5F0] bg-white text-[#0759DC] hover:bg-[#EEF5FF]'
                        : 'bg-[#0759DC] text-white hover:bg-[#063B9B]'
                      }`}>{actionLabels[a]}</button>
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

      {/* Status Timeline — landscape stepper */}
      <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 shadow-[0_6px_25px_rgba(25,45,80,0.05)] mb-5">
        <div className="mb-5 text-[14px] font-extrabold text-[#102044]">Status Timeline</div>

        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[900px]">
            {STATUS_STEPS.map((step, index) => {
              const entry = historyByStatus[step];
              const completed = entry || (currentIndex >= 0 && index < currentIndex);
              const active = index === currentIndex;
              const text = entry?.note || (completed ? (STEP_DEFAULT_TEXT[step] || '') : (STEP_PENDING_TEXT[step] || ''));
              const dotClass = active ? 'bg-[#0759DC]' : completed ? 'bg-[#F59E0B]' : 'bg-[#C7D2E0]';
              const leftLine = index === 0 ? 'bg-transparent' : (completed || active ? 'bg-[#F59E0B]' : 'bg-[#E0E6EF]');
              const rightLine = index === STATUS_STEPS.length - 1 ? 'bg-transparent' : (completed ? 'bg-[#F59E0B]' : 'bg-[#E0E6EF]');
              return (
                <div key={step} className="relative min-w-0 flex-1 px-2 pt-0.5 text-center">
                  {/* connector */}
                  <span className="absolute inset-x-0 top-[7px] flex" aria-hidden="true">
                    <span className={`h-[2px] flex-1 ${leftLine}`} />
                    <span className={`h-[2px] flex-1 ${rightLine}`} />
                  </span>
                  {/* marker */}
                  <span className={`relative z-[1] mx-auto block h-[14px] w-[14px] rounded-full border-2 border-white shadow-[0_0_0_1px_#DCE3EE] ${dotClass}`} />
                  <div className="mt-2.5 truncate text-[12px] font-extrabold text-[#102044]">{step}</div>
                  {entry?.date && <div className="mt-0.5 text-[9px] text-[#748197]">{'\u25AB'} {entry.date}</div>}
                  {entry?.actor && <div className="mt-0.5 truncate text-[9px] font-semibold text-[#67748A]">{entry.actor}</div>}
                  <div className="mt-1 text-[10px] leading-snug text-[#718096]">{text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Updates & Responses — official updates from staff and administrators */}
      <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 mb-5 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-[#EDF5FF] text-[#1264F4]" aria-hidden="true">
            <Icon name="letter" size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-[15px] font-extrabold text-[#102044]">Updates &amp; Responses</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[#667895]">
              Official updates from staff and administrators regarding your report.
            </p>
          </div>
        </div>

        {staffUpdates.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#D7E2F0] bg-[#F8FAFC] px-4 py-8 text-center">
            <p className="m-0 text-[13px] font-semibold leading-relaxed text-[#7C8EAA]">
              No updates yet. We&apos;ll notify you when there is progress on your report.
            </p>
          </div>
        ) : (
          <>
            <ol className="relative m-0 list-none p-0">
              {visibleUpdates.map((u, i) => {
                const admin = isAdminRole(u.actor_role);
                return (
                  <li key={u.id ?? i} className="relative pb-4 pl-[42px] last:pb-0">
                    {/* vertical connector */}
                    {i < visibleUpdates.length - 1 && (
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

            {staffUpdates.length > 3 && !showAllUpdates && (
              <button
                type="button"
                onClick={() => setShowAllUpdates(true)}
                className="mt-3 cursor-pointer border-0 bg-transparent text-[12px] font-bold text-[#0759DC] hover:underline"
              >
                View all updates ({staffUpdates.length}) →
              </button>
            )}
          </>
        )}
      </div>

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
