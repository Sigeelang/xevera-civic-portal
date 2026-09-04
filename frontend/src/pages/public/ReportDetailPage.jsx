import { useState, useEffect, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
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
  const [liked, setLiked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
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

  useEffect(() => {
    apiFetch('users/assignable.php')
      .then((d) => setStaffList(Array.isArray(d) ? d.filter((u) => u.role === 'Staff') : []))
      .catch(() => setStaffList([]));
  }, []);

  async function handleLike() {
    if (!isResident) {
      showToast('Please log in as a Resident to like reports.', 'error');
      return;
    }
    try {
      const d = await apiFetch('reports/like.php', { method: 'POST', body: { id: reportId } });
      setLiked(d.liked);
      setReport((prev) => ({ ...prev, likes: d.likes }));
    } catch (err) {
      showToast(err.message || 'Could not like the report.', 'error');
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!isResident) {
      showToast('Please log in as a Resident to comment.', 'error');
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      await apiFetch('reports/comment.php', { method: 'POST', body: { id: reportId, comment: text } });
      setCommentText('');
      load();
      showToast('Comment added.');
    } catch (err) {
      showToast(err.message || 'Could not post comment.', 'error');
    } finally {
      setPosting(false);
    }
  }

  async function doAction(message, body) {
    setWorking(true);
    try {
      await apiFetch('reports/update.php', { method: 'POST', body: { id: reportId, ...body } });
      showToast(message || 'Report updated.');
      setActionForm(null);
      setNoteText('');
      setReasonText('');
      setResolutionText('');
      setAssigneeId('');
      load();
    } catch (err) {
      showToast(err.message || 'Could not update report.', 'error');
    } finally {
      setWorking(false);
    }
  }

  function runAction(a) {
    switch (a) {
      case 'verify': doAction('Report verified.', { status: 'Verified' }); break;
      case 'start': doAction('Work started.', { status: 'In Progress' }); break;
      case 'close': doAction('Report closed.', { status: 'Closed' }); break;
      case 'reopen': doAction('Report reopened.', { status: report.status === 'Rejected' ? 'Pending' : 'In Progress' }); break;
      default: setActionForm(a);
    }
  }

  function submitActionForm(e) {
    e.preventDefault();
    if (actionForm === 'assign') {
      if (!assigneeId) { showToast('Select a staff member.', 'error'); return; }
      doAction('Report assigned.', { assigned_to: assigneeId });
    } else if (actionForm === 'update') {
      if (!noteText.trim()) { showToast('Enter a work note.', 'error'); return; }
      doAction('Update added.', { remarks: noteText.trim() });
    } else if (actionForm === 'resolve') {
      if (!resolutionText.trim()) { showToast('Resolution details are required.', 'error'); return; }
      doAction('Report resolved.', { status: 'Resolved', resolution: resolutionText.trim() });
    } else if (actionForm === 'reject') {
      if (!reasonText.trim()) { showToast('A rejection reason is required.', 'error'); return; }
      doAction('Report rejected.', { status: 'Rejected', rejection_reason: reasonText.trim() });
    }
  }

  if (error) return <p className="text-sm text-[#6B7280]">{error}</p>;

  if (!report) {
    return (
      <div className="animate-pulse">
        <div className="h-5 w-32 bg-[#E5E7EB] rounded mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.95fr] gap-5">
          <div className="h-[350px] bg-[#E5E7EB] rounded-[16px]" />
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-6"><div className="h-6 w-3/4 bg-[#E5E7EB] rounded mb-4" /><div className="space-y-2"><div className="h-4 w-full bg-[#E5E7EB] rounded" /><div className="h-4 w-5/6 bg-[#E5E7EB] rounded" /><div className="h-4 w-2/3 bg-[#E5E7EB] rounded" /></div></div>
        </div>
      </div>
    );
  }

  const actions = getReportActions(report, user);
  const actionLabels = {
    verify: 'Verify', assign: 'Assign Staff', start: 'Start Work', update: 'Add Update',
    resolve: 'Mark Resolved', close: 'Close Report', reopen: 'Reopen', reject: 'Reject',
  };
  const firstPhoto = report.photos?.[0] || null;
  const currentIndex = STATUS_STEPS.indexOf(report.status);

  const historyByStatus = {};
  history.forEach((h) => { historyByStatus[h.new_status] = h; });

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-12">
      <button onClick={() => onBack && onBack()}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#0759DC] mb-4 bg-none border-none cursor-pointer hover:underline">
        {'\u2190'} Back to My Reports
      </button>

      {/* Report hero */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(400px,0.95fr)] gap-5 mb-5">
        {/* Image */}
        <div className="bg-white border border-[#E3E9F2] rounded-[16px] overflow-hidden min-h-[350px] shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
          {firstPhoto ? (
            <img src={uploadUrl(firstPhoto)} alt={report.title} className="w-full h-full min-h-[350px] object-cover" />
          ) : (
            <div className="w-full h-full min-h-[350px] grid place-items-center text-[#9AA6B8] text-5xl">{'\u{1F4F7}'}</div>
          )}
          {report.photos?.length > 1 && (
            <div className="flex gap-2 p-3 flex-wrap">
              {report.photos.map((p, i) => (
                <div key={i} onClick={() => setActivePhoto(i + 1)}
                  className={`w-[70px] h-14 rounded-[10px] bg-cover bg-center cursor-pointer transition-all ${activePhoto === i + 1 ? 'ring-2 ring-[#0759DC]' : 'opacity-70 hover:opacity-100'}`}
                  style={{ backgroundImage: 'url(/' + p + ')' }} />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
          <div className="flex items-start justify-between gap-3 mb-5">
            <h1 className="text-[25px] font-extrabold text-[#102044] leading-tight">{report.title}</h1>
            <StatusPill status={report.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="tag" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Report ID</div><div className="text-[12px] font-extrabold text-[#0759DC]">{report.id}</div></div>
            </div>
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="box" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Category</div><div className="text-[12px] font-semibold text-[#102044]">{report.category}</div></div>
            </div>
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="calendar" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Submitted On</div><div className="text-[12px] font-semibold text-[#102044]">{formatDate(report.created_at || report.date)}<br /><small className="text-[10px] text-[#71809A]">{formatTime(report.created_at)}</small></div></div>
            </div>
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="user" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Assigned To</div><div className="text-[12px] font-semibold text-[#102044]">{report.assigned && report.assigned !== '-' ? report.assigned : 'Awaiting assignment'}</div></div>
            </div>
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="user" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Submitted By</div><div className="text-[12px] font-semibold text-[#102044]">{report.reporter}</div></div>
            </div>
            <div className="flex gap-2.5">
              <span className="w-[30px] h-[30px] rounded-[8px] bg-[#F2F6FC] text-[#5F6D84] grid place-items-center flex-shrink-0"><Icon name="pin" size={14} /></span>
              <div><div className="text-[8px] uppercase tracking-[0.6px] font-extrabold text-[#8A96AA] mb-1">Location</div><div className="text-[12px] font-semibold text-[#102044]">{report.location}</div></div>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={handleLike}
              className={`h-8 px-3 rounded-[18px] border text-[12px] font-bold transition-colors cursor-pointer ${liked ? 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]' : 'bg-white border-[#E3E9F2] text-[#102044] hover:border-[#0759DC]'}`}>
              {'\uD83D\uDC4D'} {report.likes || 0}
            </button>
            <button className="h-8 px-3 rounded-[18px] border border-[#E3E9F2] bg-white text-[12px] font-bold text-[#102044] cursor-default">
              {'\uD83D\uDCAC'} {report.comments || 0}
            </button>
          </div>

          <div className="mt-4 px-3.5 py-3 border border-[#C9DCFF] bg-[#EFF6FF] text-[#1257CB] rounded-[10px] text-[10px] font-semibold">
            {'\u24D8'} This report is visible to everyone. Staff will review and take action.
          </div>

          {/* Staff workflow panel */}
          {isStaff && (
            <div className="mt-5 pt-5 border-t border-[#E3E9F2]">
              <div className="text-[14px] font-extrabold text-[#102044] mb-3">Workflow</div>
              <ReportWorkflow status={report.status} />
              {report.assigned && report.assigned !== '-' && (
                <div className="mt-3 text-[12px] text-[#102044]"><span className="font-bold">Assigned to:</span> {report.assigned}</div>
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

      {/* Description */}
      <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 mb-5 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
        <div className="text-[14px] font-extrabold text-[#102044] mb-2.5">Description</div>
        <p className="text-[13px] text-[#58657B] leading-relaxed whitespace-pre-line">{report.desc || 'No description provided.'}</p>
      </div>

      {/* Resolution Evidence - only for Resolved, resident-safe (no email/phone/internal) */}
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

          {/* Evidence Photos */}
          {report.evidence_photos && report.evidence_photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {report.evidence_photos.slice(0, 2).map((p, i) => (
                <div key={i} className="relative rounded-[10px] overflow-hidden border border-[#E3E9F2] bg-[#F3F6FB] h-[140px]">
                  <img src={uploadUrl(p)} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-[6px] bg-black/60 text-white text-[9px] font-bold">Evidence Photo {i + 1}</span>
                </div>
              ))}
              {report.evidence_photos.length === 1 && (
                <div className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] h-[140px] grid place-items-center text-[#94A3B8] text-[11px]">No second photo</div>
              )}
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center text-[12px] text-[#94A3B8] mb-5">No evidence photos attached.</div>
          )}
          {report.evidence_photos && report.evidence_photos.length > 2 && (
            <button onClick={() => setActivePhoto(1)} className="mb-5 text-[11px] font-bold text-[#0759DC] hover:underline bg-transparent border-0 cursor-pointer">View full evidence ({report.evidence_photos.length} photos) →</button>
          )}

          {/* Resolution Notes */}
          <div className="mb-5">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#8A96AA] mb-1.5">Resolution Notes</div>
            <p className="text-[13px] text-[#344054] leading-relaxed bg-[#F9FAFB] border border-[#E3E9F2] rounded-[10px] p-3.5 whitespace-pre-line">{report.resolution || 'The damaged canal was cleaned and cleared of debris.'}</p>
          </div>

          {/* Meta */}
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

      {/* Lower grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Timeline */}
        <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
          <div className="text-[14px] font-extrabold text-[#102044] mb-4">Status Timeline</div>
          <div className="relative mt-5 pl-[29px] before:content-[''] before:absolute before:left-[5px] before:top-2 before:bottom-8 before:w-[2px] before:bg-[#E0E6EF]">
            {STATUS_STEPS.map((step, index) => {
              const entry = historyByStatus[step];
              const completed = entry || (currentIndex >= 0 && index < currentIndex);
              const active = index === currentIndex;
              const dotClass = active ? 'bg-[#0759DC]' : completed ? 'bg-[#F59E0B]' : 'bg-[#9AA6B8]';
              const text = entry?.note || (completed ? (STEP_DEFAULT_TEXT[step] || '') : (STEP_PENDING_TEXT[step] || ''));
              return (
                <div key={step} className="relative pb-5">
                  <span className={`absolute -left-[29px] top-0.5 w-[11px] h-[11px] rounded-full border-2 border-white shadow-[0_0_0_1px_#DCE3EE] ${dotClass}`} />
                  {entry?.actor && <span className="float-right text-[9px] text-[#67748A]">{entry.actor}</span>}
                  <div className="text-[12px] font-extrabold text-[#102044] mb-1">{step}</div>
                  {entry?.date && <div className="text-[9px] text-[#748197] mb-1">{'\u25AB'} {entry.date}</div>}
                  <div className="text-[10px] text-[#718096] leading-relaxed">{text}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white border border-[#E3E9F2] rounded-[16px] p-6 shadow-[0_6px_25px_rgba(25,45,80,0.05)]">
          <div className="text-[14px] font-extrabold text-[#102044] mb-4">Comments</div>
          {isResident && (
            <form onSubmit={handleComment}>
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={4}
                placeholder="Share your thoughts or updates on this report..."
                className="w-full min-h-[95px] px-3.5 py-3 rounded-[11px] border border-[#E3E9F2] text-sm bg-white focus:outline-none focus:border-[#0759DC] focus:ring-[3px] focus:ring-[rgba(7,89,220,0.08)] resize-y placeholder:text-[#9AA3B5]" />
              <button type="submit" disabled={posting || !commentText.trim()}
                className="mt-2.5 h-[38px] px-4 rounded-[9px] bg-[#0759DC] text-white text-[11px] font-extrabold hover:bg-[#063B9B] transition-colors disabled:opacity-50 cursor-pointer">
                {posting ? 'Posting...' : 'Add Comment'}
              </button>
            </form>
          )}
          {!isResident && <p className="text-xs text-[#8995A9] mb-3">Log in as a Resident to comment.</p>}

          {comments.length === 0 ? (
            <div className="min-h-[250px] flex flex-col items-center justify-center text-center text-[#8995A9]">
              <div className="w-[70px] h-[70px] rounded-full bg-[#EDF4FF] text-[#0759DC] grid place-items-center text-[28px] mb-3.5">{'\uD83D\uDCAC'}</div>
              <strong className="text-[12px] text-[#56637A] mb-1">No comments yet.</strong>
              <span className="text-[10px]">Be the first to comment.</span>
            </div>
          ) : (
            <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="bg-[#F9FAFB] border border-[#F1F5F9] rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-extrabold text-[#102044]">{c.user}</span>
                    <span className="text-[10px] text-[#9AA6B8]">{c.date}</span>
                  </div>
                  <p className="text-[13px] text-[#374151] leading-relaxed">{c.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}