import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Pager from '../../components/Pager';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const TYPE_STYLES = {
  'Fake Report': { bg: 'bg-[#FFE1E1]', text: 'text-[#DC3030]' },
  'Duplicate Report': { bg: 'bg-[#FFF0D2]', text: 'text-[#C98200]' },
  'False Information': { bg: 'bg-[#FFE4E4]', text: 'text-[#DC3030]' },
  'Spam Report': { bg: 'bg-[#FFE4E4]', text: 'text-[#DC3030]' },
  'Abusive Submission': { bg: 'bg-[#EEE6FF]', text: 'text-[#7040D7]' },
  'Not a Violation': { bg: 'bg-[#DFF7E9]', text: 'text-[#16864E]' },
};

const STATUS_STYLES = {
  'Under Review': { bg: 'bg-[#FFF0D2]', text: 'text-[#C98200]', icon: '\u26A0' },
  'Confirmed': { bg: 'bg-[#FFE1E1]', text: 'text-[#D83232]', icon: '\u26A0' },
  'Dismissed': { bg: 'bg-[#DDF6E7]', text: 'text-[#16864E]', icon: '\u25CF' },
};

const STATUSES = ['All', 'Under Review', 'Confirmed', 'Dismissed'];
const TYPES = ['All', 'Fake Report', 'Duplicate Report', 'False Information', 'Spam Report', 'Abusive Submission', 'Not a Violation'];
const CATEGORIES = ['All', 'Environmental', 'Traffic & Parking', 'Noise Violation', 'Building & Construction', 'Pets & Animals', 'Property Damage', 'Utilities'];

const CATEGORY_STYLES = {
  'Environmental': { bg: 'bg-[#daf5e7]', text: 'text-[#098956]', icon: '\u{1F343}' },
  'Traffic & Parking': { bg: 'bg-[#e3efff]', text: 'text-[#0d5ec7]', icon: '\u{1F697}' },
  'Noise Violation': { bg: 'bg-[#eee8ff]', text: 'text-[#7048c7]', icon: '\u{1F50A}' },
  'Building & Construction': { bg: 'bg-[#fff0d0]', text: 'text-[#ad6800]', icon: '\u{1F528}' },
  'Pets & Animals': { bg: 'bg-[#eee7dc]', text: 'text-[#76562e]', icon: '\u{1F43E}' },
  'Property Damage': { bg: 'bg-[#ffe0e2]', text: 'text-[#bd2028]', icon: '\u26A0' },
  'Utilities': { bg: 'bg-[#e0efff]', text: 'text-[#1768c9]', icon: '\u{1F4A7}' },
};

function CategoryBadge({ category }) {
  var s = CATEGORY_STYLES[category] || { bg: 'bg-[#F0F4F8]', text: 'text-[#5C6E86]', icon: '\u2022' };
  return <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-[9px] text-[10px] font-bold whitespace-nowrap ' + s.bg + ' ' + s.text}>{s.icon} {category || 'Uncategorized'}</span>;
}

function getSeverity(item) {
  if (item && item.severity) return item.severity;
  var reason = item ? (item.suspicion_reason || '') : '';
  if (/fake|false|abusive|vandal|burning|illegal connection|construction without|water/i.test(reason)) return 'Major';
  return 'Minor';
}

function SeverityBadge({ severity }) {
  var isMinor = severity === 'Minor';
  return <span className={'inline-block px-[11px] py-1.5 rounded-[8px] text-[10px] font-extrabold ' + (isMinor ? 'bg-[#fff0cf] text-[#aa7300]' : 'bg-[#ffe0e2] text-[#cf343a]')}>{severity}</span>;
}

function ConfirmedStatusBadge({ value }) {
  var cls = value === 'Active' ? 'bg-[#ffe7eb] text-[#ef3148]' : value === 'Suspended' ? 'bg-[#e9f1ff] text-[#1769ff]' : 'bg-[#e6f8ed] text-[#159653]';
  return <span className={'inline-flex items-center px-[9px] py-[5px] rounded-[15px] text-[9px] font-bold whitespace-nowrap ' + cls}>{value}</span>;
}

function formatDrawerDate(dateStr, createdAt) {
  try {
    var d = createdAt ? new Date(createdAt) : new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '\u2014';
    var datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return datePart + ' at ' + timePart;
  } catch { return dateStr || '\u2014'; }
}

function shortDate(dt) {
  try {
    var d = new Date(dt);
    if (isNaN(d.getTime())) return '\u2014';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '\u2014'; }
}

function getPenaltyBucket(item) {
  var pt = item ? (item.penalty_type || '') : '';
  if (/suspension|restriction/i.test(pt)) return 'Suspension';
  if (/^fine$/i.test(pt) || (item && item.fine != null && Number(item.fine) > 0)) return 'Fine';
  if (/warning/i.test(pt)) return 'Warning';
  return 'Warning';
}

function penaltyLabel(item) {
  var bucket = getPenaltyBucket(item);
  if (bucket === 'Fine') {
    var amt = item && item.fine != null ? Number(item.fine) : 0;
    return 'Fine: \u20B1' + amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (bucket === 'Suspension') {
    if (item && item.restriction_days) return 'Suspension: ' + item.restriction_days + ' days';
    return 'Suspension';
  }
  return 'Warning';
}

function getAppealStatus(item) {
  if (!item || !item.appeal_reason) return 'No Appeal';
  var out = item.appeal_outcome || '';
  if (out === 'Upheld') return 'Upheld';
  if (out === 'Overturned') return 'Overturned';
  return 'Pending Appeal';
}

function getConfirmedStatus(item) {
  if (!item) return 'Active';
  var vs = item.violation_status || '';
  if (vs === 'Resolved' || vs === 'Completed') return 'Completed';
  if (getPenaltyBucket(item) === 'Suspension') {
    if (item.restriction_until) {
      try { if (new Date(item.restriction_until).getTime() > Date.now()) return 'Suspended'; } catch {}
    } else {
      return 'Suspended';
    }
  }
  return 'Active';
}

function suspensionText(item) {
  if (!item || getPenaltyBucket(item) !== 'Suspension' || !item.restriction_days) return { label: 'None', sub: '\u2014' };
  var start = item.violation_created_at || item.created_at;
  var end = item.restriction_until;
  if (!end && start) {
    try { end = new Date(new Date(start).getTime() + item.restriction_days * 86400000).toISOString(); } catch {}
  }
  return { label: item.restriction_days + ' days', sub: shortDate(start) + ' \u2013 ' + shortDate(end) };
}

function TypeBadge({ type }) {
  var s = TYPE_STYLES[type] || { bg: 'bg-[#F0F4F8]', text: 'text-[#5C6E86]' };
  return <span className={'inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold ' + s.bg + ' ' + s.text}>{type}</span>;
}

function StatusBadge({ status }) {
  var s = STATUS_STYLES[status] || STATUS_STYLES['Under Review'];
  return <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold ' + s.bg + ' ' + s.text}>{s.icon} {status}</span>;
}

function InfoItem({ icon, label, value, children }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-[21px] text-[#607DA9] text-[17px] flex-shrink-0 pt-0.5">{icon}</div>
      <div>
        <div className="text-[10px] text-[#7B8BA4] mb-1">{label}</div>
        {children || <div className="text-[12px] font-semibold text-[#102A56] leading-relaxed">{value || '\u2014'}</div>}
      </div>
    </div>
  );
}

function TimelineItem({ dotColor, lineColor, title, titleColor, date, description, avatarBg, avatarColor, initials, userName, userRole, isLast }) {
  return (
    <div className="grid grid-cols-[28px_1fr_150px] gap-2.5 min-h-[68px] relative">
      <div className="flex flex-col items-center">
        <div className="w-[15px] h-[15px] rounded-full mt-[3px] z-10 relative" style={{ background: dotColor, border: '3px solid ' + lineColor }} />
        {!isLast && <div className="w-0.5 flex-1 absolute left-2 top-[18px] bottom-[-4px]" style={{ background: '#DCE4EE' }} />}
      </div>
      <div>
        <div className="text-[12px] font-bold" style={{ color: titleColor }}>{title}</div>
        <div className="text-[9px] text-[#647893] mt-1">{date}</div>
        {description && <div className="text-[10px] text-[#667A97] mt-1">{description}</div>}
      </div>
      <div className="flex gap-2 items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-extrabold" style={{ background: avatarBg, color: avatarColor }}>{initials}</div>
        <div>
          <div className="text-[10px] font-bold text-[#263D60]">{userName}</div>
          <div className="text-[8px] text-[#8090A8] mt-0.5">{userRole}</div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ borderColor, bgColor, iconBg, iconColor, icon, number, title, subtitle }) {
  return (
    <div className="min-h-[102px] bg-white border rounded-[11px] p-4 flex items-center gap-3.5" style={{ borderColor: borderColor, background: bgColor }}>
      <div className="w-[43px] h-[43px] rounded-[10px] flex items-center justify-center text-[19px] flex-shrink-0" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div>
        <div className="text-[25px] leading-none font-extrabold text-[#102A56]">{number}</div>
        <div className="text-[12px] font-bold mt-1.5">{title}</div>
        <div className="text-[10px] text-[#8090A8] mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

function UrgencyBadge({ dateStr }) {
  if (!dateStr) return null;
  var diff = Date.now() - new Date(dateStr).getTime();
  var hours = Math.floor(diff / 3600000);
  var days = Math.floor(hours / 24);
  if (days > 7) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFE1E1] text-[#DC3030] text-[8px] font-bold">Critical ({days}d)</span>;
  if (days > 2) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0D2] text-[#C98200] text-[8px] font-bold">Urgent ({days}d)</span>;
  if (hours > 24) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F1FF] text-[#1263ED] text-[8px] font-bold">Recent ({days}d)</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DDF6E7] text-[#16864E] text-[8px] font-bold">New</span>;
}

export default function ViolationReportsPage({ onNavigate, initialStatus = 'All' }) {
  const { user } = useAuth();
  const showToast = useToast();

  const [items, setItems] = useState(null);
  const [stats, setStats] = useState({ total: 0, under_review: 0, confirmed: 0, dismissed: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmType, setConfirmType] = useState('Fake Report');
  const [confirmSeverity, setConfirmSeverity] = useState('Major');
  const [confirmFine, setConfirmFine] = useState(1000);
  const [dismissModal, setDismissModal] = useState(null);
  const [reopenModal, setReopenModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [deleteModal, setDeleteModal] = useState(null);
  const [severity, setSeverity] = useState('All');
  const [penaltyType, setPenaltyType] = useState('All');
  const [appealStatus, setAppealStatus] = useState('All');
  const [remarks, setRemarks] = useState('');

  var load = useCallback(async function() {
    try {
      setError(false);
      var p = new URLSearchParams({ page: page, limit: perPage });
      if (status !== 'All') p.set('status', status);
      if (status === 'Under Review' || status === 'Confirmed') {
        if (type !== 'All') p.set('category', type);
        if (status === 'Confirmed' && severity !== 'All') p.set('severity', severity);
      } else if (type !== 'All') {
        p.set('type', type);
      }
      if (search) p.set('search', search);
      if (dateFrom) p.set('date_from', dateFrom);
      if (dateTo) p.set('date_to', dateTo);
      var data = await apiFetch('reports/flagged.php?' + p.toString());
      var rawItems = data.items || [];
      if (status === 'Under Review' && severity !== 'All') rawItems = rawItems.filter(function(r) { return getSeverity(r) === severity; });
      if (status === 'Confirmed' && penaltyType !== 'All') rawItems = rawItems.filter(function(r) { return getPenaltyBucket(r) === penaltyType; });
      if (status === 'Confirmed' && appealStatus !== 'All') rawItems = rawItems.filter(function(r) { return getAppealStatus(r) === appealStatus; });
      if (sortBy === 'oldest') rawItems = rawItems.slice().reverse();
      if (sortBy === 'severity') {
        var order = { Critical: 1, Serious: 2, Major: 3, Minor: 4 };
        rawItems = rawItems.slice().sort(function(a, b) { return (order[getSeverity(a)] || 5) - (order[getSeverity(b)] || 5); });
      }
      setItems(rawItems);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setStats(data.stats || { total: 0, under_review: 0, confirmed: 0, dismissed: 0 });
    } catch (e) {
      setError(true);
      setItems(null);
    }
  }, [page, perPage, status, type, search, dateFrom, dateTo, sortBy, severity, penaltyType, appealStatus]);

  useEffect(function() { load(); }, [load]);
  useEffect(function() { setPage(1); }, [status, type, search, dateFrom, dateTo, severity, penaltyType, appealStatus]);

  function resetFilters() {
    setSearch('');
    setType('All');
    setSeverity('All');
    setPenaltyType('All');
    setAppealStatus('All');
    setDateFrom('');
    if (status !== 'Under Review') setStatus('All');
    setDateTo('');
    setSortBy('newest');
  }

  var openDetail = async function(item) {
    setSelected(item);
    setCarouselIndex(0);
    setRemarks('');
    setDetailLoading(true);
    try {
      var data = await apiFetch('reports/get.php?id=' + item.db_id);
      var rep = data.report || data;
      setDetail(rep);
      if (rep && rep.photos && rep.photos.length > 0) {
        setSelected(function(prev) { return prev ? Object.assign({}, prev, { photos: rep.photos }) : prev; });
      }
    } catch (e) {
      setDetail(item);
    }
    setDetailLoading(false);
  };

  function closeDetail() { setSelected(null); setDetail(null); setRemarks(''); setLightbox(null); }

  useEffect(function() {
    function onKey(e) {
      if (e.key === 'Escape') { closeDetail(); }
    }
    if (selected || lightbox) {
      document.addEventListener('keydown', onKey);
      try { document.body.style.overflow = 'hidden'; } catch {}
      return function() {
        document.removeEventListener('keydown', onKey);
        try { document.body.style.overflow = ''; } catch {}
      };
    }
    return undefined;
  }, [selected, lightbox]);

  var doDrawerDismiss = async function() {
    if (!selected) return;
    if (!remarks.trim()) { showToast('Please enter admin remarks before dismissing.', 'error'); return; }
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: selected.db_id, is_suspicious: 0, suspicion_reason: null, staff_notes: remarks.trim() + ' (Dismissed by ' + (user?.name || 'Admin') + ')' },
      });
      showToast('Violation dismissed successfully.', 'success');
      closeDetail();
      load();
    } catch (e) {
      showToast('Failed to dismiss.', 'error');
    }
    setBusy(false);
  };

  var doAppeal = async function(action) {
    if (!selected || !selected.violation_id) { showToast('No violation record found for this report.', 'error'); return; }
    setBusy(true);
    try {
      await apiFetch('violations/update.php', {
        method: 'POST',
        body: { id: selected.violation_id, action: action === 'uphold' ? 'uphold_appeal' : 'overturn_appeal' },
      });
      showToast(action === 'uphold' ? 'Appeal upheld. Original violation remains active.' : 'Appeal overturned. Violation status updated.', 'success');
      closeDetail();
      load();
    } catch (e) {
      showToast('Failed to process appeal.', 'error');
    }
    setBusy(false);
  };

  var doDismiss = async function() {
    if (!dismissModal) return;
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: dismissModal.db_id, is_suspicious: 0, suspicion_reason: null, staff_notes: 'Dismissed by ' + (user?.name || 'Admin') },
      });
      showToast('Report dismissed.', 'success');
      setDismissModal(null);
      load();
      if (selected && selected.db_id === dismissModal.db_id) closeDetail();
    } catch (e) {
      showToast('Failed to dismiss.', 'error');
    }
    setBusy(false);
  };

  var doConfirm = async function() {
    if (!confirmModal) return;
    setBusy(true);
    try {
      var reason = confirmModal.suspicion_reason || 'Report flagged as suspicious';
      if (remarks.trim()) reason = reason + ' | Admin remarks: ' + remarks.trim();
      await apiFetch('violations/create.php', {
        method: 'POST',
        body: { report_id: confirmModal.db_id, violation_type: confirmType, severity: confirmSeverity, reason: reason, penalty_amount: confirmFine },
      });
      showToast('Violation confirmed successfully.', 'success');
      setConfirmModal(null);
      load();
      if (selected && selected.db_id === confirmModal.db_id) closeDetail();
    } catch (e) {
      showToast('Failed to create violation.', 'error');
    }
    setBusy(false);
  };

  var doReopen = async function() {
    if (!reopenModal) return;
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: reopenModal.db_id, is_suspicious: 1, suspicion_reason: reopenModal.suspicion_reason || 'Re-opened for review', staff_notes: 'Re-opened by ' + (user?.name || 'Admin') },
      });
      showToast('Report re-opened for review.', 'success');
      setReopenModal(null);
      load();
    } catch (e) {
      showToast('Failed to re-open report.', 'error');
    }
    setBusy(false);
  };

  var doDelete = async function() {
    if (!deleteModal) return;
    setBusy(true);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: deleteModal.db_id, is_suspicious: 0, suspicion_reason: null, staff_notes: 'Removed by reporter ' + (user?.name || 'User') },
      });
      showToast('Report removed successfully.', 'success');
      setDeleteModal(null);
      load();
      closeDetail();
    } catch (e) {
      showToast('Failed to remove report.', 'error');
    }
    setBusy(false);
  };

  var doBulkConfirm = async function() {
    if (!bulkModal || selectedIds.length === 0) return;
    setBusy(true);
    var success = 0;
    var failed = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      try {
        await apiFetch('violations/create.php', {
          method: 'POST',
          body: { report_id: selectedIds[i], violation_type: confirmType, severity: confirmSeverity, reason: 'Bulk confirmed by ' + (user?.name || 'Admin'), penalty_amount: confirmFine },
        });
        success++;
      } catch (e) { failed++; }
    }
    showToast(success + ' confirmed, ' + failed + ' failed.', success > 0 ? 'success' : 'error');
    setSelectedIds([]);
    setBulkModal(null);
    load();
    setBusy(false);
  };

  var doBulkDismiss = async function() {
    if (!bulkModal || selectedIds.length === 0) return;
    setBusy(true);
    var success = 0;
    var failed = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      try {
        await apiFetch('reports/update.php', {
          method: 'POST',
          body: { id: selectedIds[i], is_suspicious: 0, suspicion_reason: null, staff_notes: 'Bulk dismissed by ' + (user?.name || 'Admin') },
        });
        success++;
      } catch (e) { failed++; }
    }
    showToast(success + ' dismissed, ' + failed + ' failed.', success > 0 ? 'success' : 'error');
    setSelectedIds([]);
    setBulkModal(null);
    load();
    setBusy(false);
  };

  var doSendReminder = async function(item) {
    try {
      await apiFetch('notifications/create.php', {
        method: 'POST',
        body: {
          user_id: item.reporter_user_id,
          type: 'reminder',
          message: 'Reminder: Your report ' + item.id + ' regarding "' + (item.title || item.description) + '" is still under review. Please ensure all information is accurate.',
          report_id: item.db_id,
        },
      });
      showToast('Reminder sent to ' + item.reporter_name + '.', 'success');
    } catch (e) {
      showToast('Failed to send reminder.', 'error');
    }
  };

  var doEscalate = async function(item) {
    try {
      await apiFetch('notifications/create.php', {
        method: 'POST',
        body: {
          user_id: item.reporter_user_id,
          type: 'escalation',
          message: 'Escalation: Report ' + item.id + ' regarding "' + (item.title || item.description) + '" has been escalated for further review.',
          report_id: item.db_id,
        },
      });
      showToast('Report escalated.', 'success');
    } catch (e) {
      showToast('Failed to escalate report.', 'error');
    }
  };

  function toggleSelect(id) {
    setSelectedIds(function(prev) {
      return prev.includes(id) ? prev.filter(function(x) { return x !== id; }) : prev.concat([id]);
    });
  }

  function toggleSelectAll() {
    if (!items) return;
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(function(r) { return r.db_id; }));
    }
  }

  function exportCSV() {
    if (!items || items.length === 0) { showToast('No data to export.', 'info'); return; }
    var headers = ['Report ID', 'Title', 'Category', 'Reporter', 'Date', 'Status', 'Suspicion Reason'];
    var rows = items.map(function(r) { return [r.id, r.title, r.category, r.reporter_name, r.date, r.violation_status || 'Under Review', r.suspicion_reason || '']; });
    var csv = [headers].concat(rows).map(function(row) { return row.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'violation-reports.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV.', 'success');
  }

  function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
  }

  var viewStatus = selected ? (detail ? (detail.violation_status || (detail.is_suspicious ? 'Under Review' : null)) : null) : null;
  var reporterInitials = getInitials(detail ? detail.reporter_name : (selected ? selected.reporter_name : ''));

  var isUnderReview = status === 'Under Review';
  var isConfirmed = status === 'Confirmed';
  var isDismissed = status === 'Dismissed';
  var isAll = status === 'All';

  return (
    <div className="p-6 max-w-[1600px] mx-auto">

      {/* === LIST VIEW (stays mounted behind the drawer) === */}
      {(
        <div>

          {/* Page Header - Status-specific */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isUnderReview && <div className="w-[69px] h-[67px] rounded-[11px] bg-[#f9edcf] text-[#c58a12] flex justify-center items-center flex-shrink-0"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7V12L15 14" /></svg></div>}
              {isConfirmed && <div className="w-[68px] h-[68px] rounded-[14px] bg-[#ffe8ed] text-[#ff2948] flex items-center justify-center text-[32px] flex-shrink-0">{'\u26A0'}</div>}
              {isDismissed && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#DDF6E7] text-[#16864E] flex items-center justify-center text-[25px]">{'\u2713'}</div>}
              {isAll && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#FFE9E9] text-[#EF3340] flex items-center justify-center text-[25px]">{'\u25C7'}</div>}
              <div>
                <div className="text-[29px] leading-[1.1] text-[#132f59] font-extrabold tracking-[-0.5px]">
                  {isUnderReview && 'Under Review'}
                  {isConfirmed && 'Confirmed Violations'}
                  {isDismissed && 'Dismissed Reports'}
                  {isAll && 'Violation Reports'}
                </div>
                <div className="text-[13px] text-[#5e779a] mt-1">
                  {isUnderReview && 'Review and investigate reports that have been flagged as potential violations.'}
                  {isConfirmed && 'Manage confirmed violations, penalties, suspensions, and appeals.'}
                  {isDismissed && 'View dismissed reports, track appeals, and re-open if necessary.'}
                  {isAll && 'Manage and review reports that have been flagged as fake, misleading, or policy violations.'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isUnderReview && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-[10px] text-[#50627E] font-bold">{selectedIds.length} selected</span>
                  <button onClick={function() { setBulkModal({ action: 'confirm' }); }} className="h-[38px] px-4 border-none rounded-[7px] bg-[#0F8F63] text-white text-[11px] font-bold cursor-pointer hover:bg-[#0B7A55]">Bulk Confirm</button>
                  <button onClick={function() { setBulkModal({ action: 'dismiss' }); }} className="h-[38px] px-4 border-none rounded-[7px] bg-[#E53535] text-white text-[11px] font-bold cursor-pointer hover:bg-[#DC2626]">Bulk Dismiss</button>
                </div>
              )}
              <button onClick={exportCSV} className="h-[38px] px-[17px] border-none rounded-[7px] bg-[#1463FF] text-white text-[11px] font-bold hover:bg-[#0954DF] cursor-pointer">{'\u2193'} Export Report</button>
            </div>
          </div>

          {/* Summary Cards - Different based on status */}
          {isAll && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[18px]">
              <SummaryCard borderColor="#FFD0D0" bgColor="#FFFAFA" iconBg="#FFE2E2" iconColor="#EF3340" icon={'\u25A4'} number={stats.total} title="Total Violation Reports" subtitle="All time" />
              <SummaryCard borderColor="#F2DFB8" bgColor="#FFFDF8" iconBg="#FFF0D1" iconColor="#F59E0B" icon={'\u25F7'} number={stats.under_review} title="Under Review" subtitle="Awaiting verification" />
              <SummaryCard borderColor="#FFD0D0" bgColor="#FFFAFA" iconBg="#FFE2E2" iconColor="#EF3340" icon={'\u26A0'} number={stats.confirmed} title="Confirmed Violations" subtitle="Resulted in penalty" />
              <SummaryCard borderColor="#D0EADC" bgColor="#FBFFFC" iconBg="#E4F7EB" iconColor="#16A05D" icon={'\u2713'} number={stats.dismissed} title="Dismissed" subtitle="Not a violation" />
            </div>
          )}

          {isUnderReview && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[13px] mb-4">
              <div className="h-[88px] bg-white border border-[#e4c875] rounded-[8px] px-[14px] flex items-center gap-[13px]">
                <div className="w-[54px] h-[54px] rounded-[10px] bg-[#fff3d5] text-[#c58a12] flex justify-center items-center flex-shrink-0">
                  <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3H19V21H5Z" /><path d="M8 7H16" /><path d="M8 11H16" /><path d="M8 15H13" /></svg>
                </div>
                <div>
                  <div className="text-[25px] font-extrabold leading-none text-[#122f5a]">{stats.under_review}</div>
                  <div className="text-[13px] font-bold mt-1">Total Under Review</div>
                  <div className="text-[11px] text-[#627a9b] mt-[3px]">Awaiting action</div>
                </div>
              </div>
              <div className="h-[88px] bg-white border border-[#f0c3c7] rounded-[8px] px-[14px] flex items-center gap-[13px]">
                <div className="w-[54px] h-[54px] rounded-[10px] bg-[#ffe8e9] text-[#e43740] flex justify-center items-center flex-shrink-0">
                  <svg width="29" height="29" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3H19V14H5Z" /><path d="M7 14L5 21L12 17L19 21L17 14Z" /></svg>
                </div>
                <div>
                  <div className="text-[25px] font-extrabold leading-none text-[#122f5a]">{stats.fake_reports != null ? stats.fake_reports : stats.under_review}</div>
                  <div className="text-[13px] font-bold mt-1">Potential Fake Reports</div>
                  <div className="text-[11px] text-[#627a9b] mt-[3px]">Requires verification</div>
                </div>
              </div>
              <div className="h-[88px] bg-white border border-[#cbd9ef] rounded-[8px] px-[14px] flex items-center gap-[13px]">
                <div className="w-[54px] h-[54px] rounded-[10px] bg-[#e8f1ff] text-[#1769e8] flex justify-center items-center flex-shrink-0">
                  <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20C3 16 5.5 14 9 14C12.5 14 15 16 15 20" /><path d="M14 15C17.5 14.5 20 16.5 20 20" /></svg>
                </div>
                <div>
                  <div className="text-[25px] font-extrabold leading-none text-[#122f5a]">{stats.repeat_offenders != null ? stats.repeat_offenders : 0}</div>
                  <div className="text-[13px] font-bold mt-1">Repeat Offenders</div>
                  <div className="text-[11px] text-[#627a9b] mt-[3px]">Previously violated</div>
                </div>
              </div>
            </div>
          )}

          {isConfirmed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[9px] mb-4">
              <div className="bg-white border border-[#e4e9f1] rounded-[8px] p-[15px] flex items-center gap-[13px]">
                <div className="w-[45px] h-[45px] rounded-[10px] bg-[#edf4ff] text-[#1769ff] flex items-center justify-center text-[20px] flex-shrink-0">{'\u25A4'}</div>
                <div>
                  <div className="text-[21px] text-[#112958] font-extrabold">{stats.confirmed}</div>
                  <div className="text-[11px] font-bold text-[#142957]">Total Confirmed</div>
                  <div className="block text-[#8290a7] text-[10px] mt-[2px]">All confirmed violations</div>
                </div>
              </div>
              <div className="bg-white border border-[#e4e9f1] rounded-[8px] p-[15px] flex items-center gap-[13px]">
                <div className="w-[45px] h-[45px] rounded-[10px] bg-[#fff2d9] text-[#e89a00] flex items-center justify-center text-[20px] flex-shrink-0">{'\u25C9'}</div>
                <div>
                  <div className="text-[21px] text-[#112958] font-extrabold">{stats.active_penalties != null ? stats.active_penalties : 0}</div>
                  <div className="text-[11px] font-bold text-[#142957]">Active Penalties</div>
                  <div className="block text-[#8290a7] text-[10px] mt-[2px]">Fines to be collected</div>
                </div>
              </div>
              <div className="bg-white border border-[#e4e9f1] rounded-[8px] p-[15px] flex items-center gap-[13px]">
                <div className="w-[45px] h-[45px] rounded-[10px] bg-[#ffe9ed] text-[#ff3452] flex items-center justify-center text-[20px] flex-shrink-0">{'\u2659'}</div>
                <div>
                  <div className="text-[21px] text-[#112958] font-extrabold">{stats.suspended_residents != null ? stats.suspended_residents : 0}</div>
                  <div className="text-[11px] font-bold text-[#142957]">Suspended Residents</div>
                  <div className="block text-[#8290a7] text-[10px] mt-[2px]">Currently suspended</div>
                </div>
              </div>
              <div className="bg-white border border-[#e4e9f1] rounded-[8px] p-[15px] flex items-center gap-[13px]">
                <div className="w-[45px] h-[45px] rounded-[10px] bg-[#edf0ff] text-[#5268e8] flex items-center justify-center text-[20px] flex-shrink-0">{'\u25A3'}</div>
                <div>
                  <div className="text-[21px] text-[#112958] font-extrabold">{stats.pending_appeals != null ? stats.pending_appeals : 0}</div>
                  <div className="text-[11px] font-bold text-[#142957]">Pending Appeals</div>
                  <div className="block text-[#8290a7] text-[10px] mt-[2px]">Awaiting review</div>
                </div>
              </div>
            </div>
          )}

          {isDismissed && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[18px]">
              <SummaryCard borderColor="#D0EADC" bgColor="#FBFFFC" iconBg="#E4F7EB" iconColor="#16A05D" icon={'\u2713'} number={stats.dismissed} title="Dismissed Reports" subtitle="Total dismissed" />
              <SummaryCard borderColor="#F2DFB8" bgColor="#FFFDF8" iconBg="#FFF0D1" iconColor="#F59E0B" icon={'\u26A0'} number={stats.appealed || 0} title="Appealed" subtitle="Resident disputes" />
              <SummaryCard borderColor="#E8F1FF" bgColor="#FAFCFF" iconBg="#E8F1FF" iconColor="#1263ED" icon={'\u23F1'} number={stats.reopened || 0} title="Re-opened" subtitle="Sent back to review" />
              <SummaryCard borderColor="#FFE1E1" bgColor="#FFFAFA" iconBg="#FFE2E2" iconColor="#EF3340" icon={'\u25A4'} number={Math.max(0, stats.dismissed - (stats.appealed || 0) - (stats.reopened || 0))} title="Final" subtitle="No appeal filed" />
            </div>
          )}

          {/* Filter Panel - Prototype layout for Under Review */}
          {isUnderReview && (
            <div className="bg-white border border-[#d9e2ef] rounded-[8px] px-[15px] py-[13px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-[13px] mb-4">
              <div>
                <label className="block text-[11px] font-bold text-[#17345d] mb-[7px]">Search</label>
                <div className="h-[37px] border border-[#cbd8e8] rounded-[6px] bg-white flex items-center px-[10px] gap-2 text-[#617898]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><circle cx="11" cy="11" r="7" /><path d="M16 16L21 21" /></svg>
                  <input type="text" value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search report ID, description, resident..." className="w-full h-full border-none outline-none bg-transparent text-[12px] text-[#617898] placeholder:text-[#91A0B4]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#17345d] mb-[7px]">Violation Type</label>
                <div className="h-[37px] border border-[#cbd8e8] rounded-[6px] bg-white flex items-center px-[10px] text-[#617898]">
                  <select value={type} onChange={function(e) { setType(e.target.value); }} className="w-full h-full border-none outline-none bg-transparent text-[12px] text-[#617898]">
                    {CATEGORIES.map(function(t) { return <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>; })}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#17345d] mb-[7px]">Severity</label>
                <div className="h-[37px] border border-[#cbd8e8] rounded-[6px] bg-white flex items-center px-[10px] text-[#617898]">
                  <select value={severity} onChange={function(e) { setSeverity(e.target.value); }} className="w-full h-full border-none outline-none bg-transparent text-[12px] text-[#617898]">
                    <option value="All">All Severities</option>
                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#17345d] mb-[7px]">Date Range</label>
                <div className="h-[37px] border border-[#cbd8e8] rounded-[6px] bg-white flex items-center px-[10px] text-[#617898]">
                  <input type="date" value={dateFrom} onChange={function(e) { setDateFrom(e.target.value); setDateTo(e.target.value); }} className="w-full h-full border-none outline-none bg-transparent text-[12px] text-[#617898]" />
                </div>
              </div>
            </div>
          )}
          {/* Filter Panel - Prototype layout for Confirmed */}
          {isConfirmed && (
            <div className="bg-white border border-[#e1e7f0] rounded-[8px] p-[13px] mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto_auto] gap-[9px] items-end">
                <div>
                  <label className="block text-[10px] font-bold mb-[6px] text-[#23385d]">Search</label>
                  <input type="text" value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search report ID, resident name..." className="w-full h-[38px] border border-[#dce3ed] rounded-[6px] px-[10px] text-[#425472] text-[11px] bg-white outline-none focus:border-[#1769ff]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-[6px] text-[#23385d]">Violation Type</label>
                  <select value={type} onChange={function(e) { setType(e.target.value); }} className="w-full h-[38px] border border-[#dce3ed] rounded-[6px] px-[10px] text-[#425472] text-[11px] bg-white outline-none focus:border-[#1769ff]">
                    {CATEGORIES.map(function(t) { return <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>; })}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-[6px] text-[#23385d]">Severity</label>
                  <select value={severity} onChange={function(e) { setSeverity(e.target.value); }} className="w-full h-[38px] border border-[#dce3ed] rounded-[6px] px-[10px] text-[#425472] text-[11px] bg-white outline-none focus:border-[#1769ff]">
                    <option value="All">All Severities</option>
                    <option value="Minor">Minor</option>
                    <option value="Major">Major</option>
                    <option value="Serious">Serious</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-[6px] text-[#23385d]">Penalty Type</label>
                  <select value={penaltyType} onChange={function(e) { setPenaltyType(e.target.value); }} className="w-full h-[38px] border border-[#dce3ed] rounded-[6px] px-[10px] text-[#425472] text-[11px] bg-white outline-none focus:border-[#1769ff]">
                    <option value="All">All Penalties</option>
                    <option value="Fine">Fine</option>
                    <option value="Warning">Warning</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Stop Work Order">Stop Work Order</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-[6px] text-[#23385d]">Appeal Status</label>
                  <select value={appealStatus} onChange={function(e) { setAppealStatus(e.target.value); }} className="w-full h-[38px] border border-[#dce3ed] rounded-[6px] px-[10px] text-[#425472] text-[11px] bg-white outline-none focus:border-[#1769ff]">
                    <option value="All">All Appeal Status</option>
                    <option value="Pending Appeal">Pending Appeal</option>
                    <option value="No Appeal">No Appeal</option>
                    <option value="Upheld">Upheld</option>
                    <option value="Overturned">Overturned</option>
                  </select>
                </div>
                <button onClick={load} className="h-[38px] px-4 border-none rounded-[6px] bg-[#1769ff] text-white text-[11px] font-bold cursor-pointer">Filter</button>
                <button onClick={resetFilters} className="h-[38px] px-4 rounded-[6px] bg-white text-[#52617a] text-[11px] font-bold cursor-pointer border border-[#dce3ed]">Reset</button>
              </div>
            </div>
          )}
          {/* Filter Panel - existing layout for All/Dismissed */}
          {!isUnderReview && !isConfirmed && (
          <div className="bg-white border border-[#DFE6EF] rounded-[11px] p-[17px] mb-[18px] grid grid-cols-[1.5fr_0.85fr_0.85fr_1fr_auto] gap-3.5 items-end">
            <div>
              <label className="block text-[10px] font-bold text-[#142B50] mb-[7px]">Search</label>
              <input type="text" value={search} onChange={function(e) { setSearch(e.target.value); }} placeholder="Search report ID, description, resident..." className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] placeholder:text-[#91A0B4] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#142B50] mb-[7px]">Violation Type</label>
              <select value={type} onChange={function(e) { setType(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] bg-white outline-none">
                {TYPES.map(function(t) { return <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>; })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#142B50] mb-[7px]">Status</label>
              <select value={status} onChange={function(e) { setStatus(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] bg-white outline-none">
                {STATUSES.map(function(s) { return <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>; })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#142B50] mb-[7px]">Date Range</label>
              <div className="flex gap-2">
                <input type="date" value={dateFrom} onChange={function(e) { setDateFrom(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] outline-none" placeholder="From" />
                <input type="date" value={dateTo} onChange={function(e) { setDateTo(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] outline-none" placeholder="To" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={load} className="h-[38px] px-4 border-none rounded-[7px] bg-[#1463FF] text-white text-[11px] font-bold cursor-pointer">{'\u26F2'} Filter</button>
              <button onClick={resetFilters} className="h-[38px] px-[15px] border border-[#D7E0EB] rounded-[7px] bg-white text-[#50627E] text-[11px] font-bold cursor-pointer">{'\u27F3'} Reset</button>
            </div>
          </div>
          )}

          {/* Table Card */}
          <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">

            {/* Table Header */}
            <div className="h-[55px] px-[15px] flex items-center justify-between border-b border-[#E8EDF3]">
              <div className="flex items-center gap-3">
                <div className="text-[17px] font-extrabold text-[#14315b]">
                  {isUnderReview && <span>Under Review Reports (<span>{items ? items.length : 0}</span>)</span>}
                  {isConfirmed && <span>Confirmed Violations (<span>{items ? items.length : 0}</span>)</span>}
                  {isDismissed && 'Dismissed Reports'}
                  {isAll && 'Violation Reports List'}
                </div>
              </div>
              {!isUnderReview && (
              <div className="flex items-center gap-2 text-[10px] text-[#687A95]">
                {isConfirmed ? 'Sort:' : 'Sort by:'}
                <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }} className="h-[34px] border border-[#dce3ed] rounded-[6px] px-[9px] text-[11px] text-[#4e607e] bg-white outline-none">
                  <option value="newest">{isConfirmed ? 'Confirmed Date (Newest)' : 'Date Submitted (Newest)'}</option>
                  <option value="oldest">{isConfirmed ? 'Confirmed Date (Oldest)' : 'Date Submitted (Oldest)'}</option>
                  {isConfirmed && <option value="severity">Severity</option>}
                </select>
              </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse report-table" style={isUnderReview ? { minWidth: '850px', tableLayout: 'fixed' } : { minWidth: '1050px' }}>
                <thead className="bg-[#F7F9FC]">
                  {isUnderReview ? (
                    <tr>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-8 text-center">#</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[86px]">Report ID</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[150px]">Description</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[145px]">Resident</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[130px]">Violation Type</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[72px]">Severity</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[90px]">Date Submitted</th>
                      <th className="h-10 px-[9px] text-left text-[#17345d] text-[9px] font-extrabold w-[84px]">Actions</th>
                    </tr>
                  ) : isConfirmed ? (
                    <tr>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">#</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Report ID</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Resident</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Violation Type</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Severity</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Penalty</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Confirmed Date</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Status</th>
                      <th className="h-10 px-3 text-left text-[10px] text-[#415476] font-bold whitespace-nowrap">Actions</th>
                    </tr>
                  ) : (
                    <tr>
                    {isUnderReview && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap w-10"></th>}
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">#</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Report ID</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Description</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Violation Type</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Reported Resident</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Date Submitted</th>
                    {isUnderReview && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Urgency</th>}
                    {isConfirmed && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Fine</th>}
                    {isConfirmed && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Payment</th>}
                    {isDismissed && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Dismiss Reason</th>}
                    {isDismissed && <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Appeal</th>}
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Status</th>
                    <th className="h-[39px] px-3 text-left text-[10px] text-[#435875] font-bold whitespace-nowrap">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {error && <tr><td colSpan={isUnderReview ? 8 : isConfirmed ? 9 : isDismissed ? 10 : 8}><StaffErrorState message="Unable to load flagged reports." onRetry={load} /></td></tr>}
                  {!items && !error && <SkeletonRows cols={isUnderReview ? 8 : isConfirmed ? 9 : isDismissed ? 10 : 8} />}
                  {items && items.length === 0 && <tr><td colSpan={isUnderReview ? 8 : isConfirmed ? 9 : isDismissed ? 10 : 8}><StaffEmptyState title="No violation reports found." description="Adjust your filters or check back later." /></td></tr>}
                  {items && items.map(function(r, idx) {
                    if (isUnderReview) {
                      var sev = getSeverity(r);
                      var thumb = (r.photos && r.photos[0]) || '';
                      var timePart = '';
                      try { var dObj = new Date(r.created_at); if (!isNaN(dObj.getTime())) timePart = dObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch {}
                      return (
                        <tr key={r.id} className="hover:bg-[#f8fbff]">
                          <td className="px-[9px] py-[7px] text-[11px] text-[#405b7e] text-center align-middle">{idx + 1}</td>
                          <td className="px-[9px] py-[7px] align-middle"><span className="text-[#065dc6] font-extrabold text-[11px] cursor-pointer hover:underline" onClick={function() { openDetail(r); }}>{r.id}</span></td>
                          <td className="px-[9px] py-[7px] align-middle">
                            <div className="flex items-center gap-2">
                              {thumb ? <img src={thumb} alt="" className="w-[48px] h-[47px] rounded-[5px] object-cover block flex-shrink-0" /> : <div className="w-[48px] h-[47px] rounded-[5px] bg-[#eef3f9] flex-shrink-0" />}
                              <div className="text-[11px] leading-[1.3] text-[#405b7e]" title={r.description}>{r.title || r.description}</div>
                            </div>
                          </td>
                          <td className="px-[9px] py-[7px] align-middle"><div className="font-extrabold text-[#19375e] text-[11px]">{r.reporter_name || '\u2014'}</div><div className="text-[10px] text-[#7086a3] mt-[3px]">{r.location || 'Xevera Subdivision'}</div></td>
                          <td className="px-[9px] py-[7px] align-middle"><CategoryBadge category={r.category} /></td>
                          <td className="px-[9px] py-[7px] align-middle"><SeverityBadge severity={sev} /></td>
                          <td className="px-[9px] py-[7px] align-middle"><div className="text-[11px] text-[#405b7e]">{r.date}</div>{timePart && <div className="text-[10px] text-[#7085a2] mt-[3px]">{timePart}</div>}</td>
                          <td className="px-[9px] py-[7px] align-middle"><button onClick={function() { openDetail(r); }} className="border border-[#aac4e6] bg-white text-[#1762bb] rounded-[6px] px-[10px] py-2 text-[10px] cursor-pointer hover:bg-[#edf5ff] whitespace-nowrap">View Details</button></td>
                        </tr>
                      );
                    }
                    if (isConfirmed) {
                      var cSev = getSeverity(r);
                      var cStat = getConfirmedStatus(r);
                      var cTime = '';
                      try { var cdObj = new Date(r.violation_created_at || r.created_at); if (!isNaN(cdObj.getTime())) cTime = cdObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch {}
                      return (
                        <tr key={r.id} className="hover:bg-[#f8fbff]">
                          <td className="px-3 py-[11px] text-[11px] text-[#34486a] align-middle">{idx + 1}</td>
                          <td className="px-3 py-[11px] align-middle"><span className="text-[#075fe8] font-bold text-[11px] cursor-pointer hover:underline" onClick={function() { openDetail(r); }}>{r.id}</span></td>
                          <td className="px-3 py-[11px] align-middle">
                            <div className="flex items-center gap-[7px]">
                              <div className="w-[28px] h-[28px] rounded-full bg-[#dbe9ff] flex items-center justify-center text-[#1769ff] font-bold text-[9px] flex-shrink-0">{getInitials(r.reporter_name)}</div>
                              <div>
                                <strong className="block text-[11px] text-[#162b54]">{r.reporter_name || '\u2014'}</strong>
                                <small className="text-[9px] text-[#7c8ba5]">{r.location || 'Xevera Subdivision'}</small>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-[11px] align-middle"><CategoryBadge category={r.category} /></td>
                          <td className="px-3 py-[11px] align-middle"><SeverityBadge severity={cSev} /></td>
                          <td className="px-3 py-[11px] align-middle"><span className="inline-flex items-center px-[9px] py-[5px] rounded-[15px] text-[9px] font-bold whitespace-nowrap bg-[#ffe7eb] text-[#ef3148]">{penaltyLabel(r)}</span></td>
                          <td className="px-3 py-[11px] align-middle"><div className="text-[11px] text-[#34486a]">{shortDate(r.violation_created_at || r.created_at)}</div>{cTime && <div className="text-[10px] text-[#8190a7]">{cTime}</div>}</td>
                          <td className="px-3 py-[11px] align-middle"><ConfirmedStatusBadge value={cStat} /></td>
                          <td className="px-3 py-[11px] align-middle"><button onClick={function() { openDetail(r); }} className="h-[31px] px-3 border border-[#bcd1f7] bg-white text-[#1769ff] rounded-[5px] text-[10px] font-bold cursor-pointer hover:bg-[#edf4ff] whitespace-nowrap">View Details</button></td>
                        </tr>
                      );
                    }
                    var st = r.violation_status || 'Under Review';
                    var ts = TYPE_STYLES[r.suspicion_reason] || TYPE_STYLES['Fake Report'];
                    var ss = STATUS_STYLES[st] || STATUS_STYLES['Under Review'];
                    return (
                      <tr key={r.id} className="hover:bg-[#FAFCFF] border-t border-[#EDF0F4]">
                        {isUnderReview && (
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selectedIds.includes(r.db_id)} onChange={function() { toggleSelect(r.db_id); }} className="w-3.5 h-3.5 accent-[#1463FF]" />
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-[10px] font-bold text-[#516784]">{idx + 1}</td>
                        <td className="px-3 py-2.5"><span className="text-[10px] text-[#1263ED] font-bold cursor-pointer hover:underline" onClick={function() { openDetail(r); }}>{r.id}</span></td>
                        <td className="px-3 py-2.5 max-w-[260px] text-[10px] text-[#263D60] leading-[1.45]" title={r.title || r.description}>{r.title || r.description}</td>
                        <td className="px-3 py-2.5"><TypeBadge type={r.suspicion_reason || 'Fake Report'} /></td>
                        <td className="px-3 py-2.5"><div className="text-[10px] font-bold text-[#142B50]">{r.reporter_name}</div><div className="text-[10px] text-[#7889A1] mt-0.5">Resident</div></td>
                        <td className="px-3 py-2.5 text-[10px] text-[#263D60] leading-[1.45]">{r.date}</td>
                        {isUnderReview && <td className="px-3 py-2.5"><UrgencyBadge dateStr={r.date} /></td>}
                        {isConfirmed && <td className="px-3 py-2.5 text-[10px] font-bold text-[#142B50]">{'\u20B1'}{Number(r.fine || 1000).toLocaleString()}</td>}
                        {isConfirmed && <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0D2] text-[#C98200] text-[8px] font-bold">Pending</span></td>}
                        {isDismissed && <td className="px-3 py-2.5 text-[10px] text-[#526783] max-w-[150px] truncate">{r.suspicion_reason || 'No violation found'}</td>}
                        {isDismissed && <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#DDF6E7] text-[#16864E] text-[8px] font-bold">None</span></td>}
                        <td className="px-3 py-2.5"><StatusBadge status={st} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={function() { openDetail(r); }} className="h-[35px] px-3 border border-[#B9CDEC] bg-white text-[#1263ED] rounded-[7px] text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-[#EDF4FF]">View Details</button>
                            {isUnderReview && (
                              <div className="relative group">
                                <button className="w-[30px] h-[30px] border-none bg-transparent text-[17px] text-[#60728D] cursor-pointer">{'\u22EE'}</button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-[#DFE6EF] rounded-[7px] shadow-lg py-1 z-20 hidden group-hover:block min-w-[120px]">
                                  <button onClick={function() { setConfirmModal(r); }} className="w-full px-3 py-1.5 text-left text-[10px] text-[#0F8F63] hover:bg-[#F0FFF8] cursor-pointer border-none bg-transparent font-bold">Confirm</button>
                                  <button onClick={function() { setDismissModal(r); }} className="w-full px-3 py-1.5 text-left text-[10px] text-[#E53535] hover:bg-[#FEF2F2] cursor-pointer border-none bg-transparent font-bold">Dismiss</button>
                                </div>
                              </div>
                            )}
                            {isConfirmed && (
                              <div className="relative group">
                                <button className="w-[30px] h-[30px] border-none bg-transparent text-[17px] text-[#60728D] cursor-pointer">{'\u22EE'}</button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-[#DFE6EF] rounded-[7px] shadow-lg py-1 z-20 hidden group-hover:block min-w-[140px]">
                                  <button onClick={function() { doSendReminder(r); }} className="w-full px-3 py-1.5 text-left text-[10px] text-[#1263ED] hover:bg-[#EDF4FF] cursor-pointer border-none bg-transparent font-bold">Send Reminder</button>
                                  <button onClick={function() { doEscalate(r); }} className="w-full px-3 py-1.5 text-left text-[10px] text-[#C98200] hover:bg-[#FFF8E1] cursor-pointer border-none bg-transparent font-bold">Escalate</button>
                                </div>
                              </div>
                            )}
                            {isDismissed && (
                              <div className="relative group">
                                <button className="w-[30px] h-[30px] border-none bg-transparent text-[17px] text-[#60728D] cursor-pointer">{'\u22EE'}</button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-[#DFE6EF] rounded-[7px] shadow-lg py-1 z-20 hidden group-hover:block min-w-[120px]">
                                  <button onClick={function() { setReopenModal(r); }} className="w-full px-3 py-1.5 text-left text-[10px] text-[#1263ED] hover:bg-[#EDF4FF] cursor-pointer border-none bg-transparent font-bold">Re-open</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="h-[57px] px-[15px] flex items-center justify-between border-t border-[#EDF0F4]">
              <div className="text-[11px] text-[#607898]">{isUnderReview ? 'Showing 1 to ' + Math.min(items ? items.length : 0, 8) + ' of ' + (items ? items.length : 0) + ' reports' : isConfirmed ? 'Showing 1 to ' + (items ? items.length : 0) + ' of ' + (items ? items.length : 0) + ' violations' : 'Showing ' + (items ? Math.min((page - 1) * perPage + 1, total) : 0) + ' to ' + (items ? Math.min(page * perPage, total) : 0) + ' of ' + total + ' violation reports'}</div>
              <div className="flex items-center gap-[5px]">
                <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === DETAIL DRAWER (prototype) === */}
      {selected && (
        <div className="fixed inset-0 bg-[rgba(8,29,57,0.45)] z-[500]" onClick={closeDetail} />
      )}
      <aside className={'fixed top-0 right-0 w-[445px] max-w-full h-screen bg-white z-[600] overflow-y-auto transition-transform duration-[280ms] ease-in-out ' + (selected ? 'translate-x-0' : 'translate-x-full')} style={{ boxShadow: '-10px 0 35px rgba(10,37,70,0.18)', visibility: selected ? 'visible' : 'hidden' }}>
        {selected && (
        <div>
          <div className="px-6 pt-4 pb-[13px] border-b border-[#e1e8f1]">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-[20px] text-[#102d58] font-extrabold">Report Details</h2>
                <p className="text-[12px] text-[#5f7698] mt-[5px]">View full report information, evidence, and take action.</p>
              </div>
              <button className="border-none bg-transparent cursor-pointer text-[#2161b8] text-[28px] leading-none p-0" onClick={closeDetail} aria-label="Close">&times;</button>
            </div>
          </div>

          <div className="px-6 pt-[17px] pb-[25px]">
            {detailLoading ? (
              <div className="py-8 text-center text-[12px] text-[#71819A]">Loading...</div>
            ) : (
            <div>
              {/* Report heading */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-[11px]">
                  <div className="w-[43px] h-[43px] rounded-[8px] bg-[#e9f2ff] flex items-center justify-center text-[#1769e8] flex-shrink-0">
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3H15L19 7V21H6Z" /><path d="M14 3V8H19" /><path d="M9 12H16" /><path d="M9 16H16" /></svg>
                  </div>
                  <div>
                    <h3 className="text-[18px] text-[#102e5b] font-extrabold">{selected.id}</h3>
                    <div className="text-[11px] text-[#55719a] mt-[3px]">Submitted on {formatDrawerDate(selected.date, selected.created_at)}</div>
                  </div>
                </div>
                {(function() {
                  var vst = detail ? (detail.violation_status || (detail.is_suspicious ? 'Under Review' : null)) : (selected.violation_status || 'Under Review');
                  if (vst === 'Confirmed') return <div className="rounded-[8px] px-[11px] py-2 text-[10px] font-bold flex items-center gap-1.5 bg-[#ffe1e4] text-[#ed3038]">{'\u25CF'} Confirmed</div>;
                  if (vst === 'Dismissed') return <div className="rounded-[8px] px-[11px] py-2 text-[10px] font-bold flex items-center gap-1.5 bg-[#dcf8ea] text-[#0aa56a]">{'\u25CF'} Dismissed</div>;
                  return <div className="rounded-[8px] px-[11px] py-2 text-[10px] font-bold flex items-center gap-1.5 bg-[#fff0d1] text-[#bd7600]">{'\u25F7'} Under Review</div>;
                })()}
              </div>

              {/* Main evidence */}
              {selected.photos && selected.photos.length > 0 ? (
                <div className="relative mb-[15px]">
                  <img src={selected.photos[carouselIndex] || selected.photos[0]} alt="Report evidence" className="w-full h-[202px] rounded-[7px] object-cover block cursor-pointer" onClick={function() { setLightbox(selected.photos[carouselIndex] || selected.photos[0]); }} />
                  {selected.photos.length > 1 && (
                    <div>
                      <button onClick={function(e) { e.stopPropagation(); setCarouselIndex(function(prev) { return prev > 0 ? prev - 1 : selected.photos.length - 1; }); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-[32px] h-[32px] rounded-full bg-white/90 border-none text-[#253B5D] text-[14px] font-bold cursor-pointer shadow-lg hover:bg-white flex items-center justify-center">{'\u25C0'}</button>
                      <button onClick={function(e) { e.stopPropagation(); setCarouselIndex(function(prev) { return prev < selected.photos.length - 1 ? prev + 1 : 0; }); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-[32px] h-[32px] rounded-full bg-white/90 border-none text-[#253B5D] text-[14px] font-bold cursor-pointer shadow-lg hover:bg-white flex items-center justify-center">{'\u25B6'}</button>
                      <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-black/60 text-white text-[9px] font-bold">{carouselIndex + 1} / {selected.photos.length}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-[120px] rounded-[7px] bg-[#eef3f9] flex items-center justify-center text-[11px] text-[#8190A7] mb-[15px]">No photo evidence attached.</div>
              )}

              {/* Description */}
              <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                <div className="flex items-center gap-[10px] text-[#102e5b] text-[12px] font-extrabold mb-[7px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3H19V21H5Z" /><path d="M8 8H16" /><path d="M8 12H16" /><path d="M8 16H13" /></svg>
                  Report Description
                </div>
                <div className="text-[#435f84] text-[12px] leading-[1.5] pl-7">{selected.description || selected.title || '\u2014'}</div>
                {selected.suspicion_reason && <div className="text-[#b35400] text-[11px] leading-[1.5] pl-7 mt-1.5">Flagged as: {selected.suspicion_reason}</div>}
              </div>

              {/* Resident */}
              <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                <div className="flex items-center gap-[10px] text-[#102e5b] text-[12px] font-extrabold mb-[7px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path d="M5 21C5 16.5 7.7 14 12 14C16.3 14 19 16.5 19 21" /></svg>
                  Reported Resident
                </div>
                <div className="flex items-center gap-[11px] pl-7">
                  <div className="w-[39px] h-[39px] rounded-full bg-[#dceaff] flex justify-center items-center text-[#1769e8] flex-shrink-0">
                    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path d="M5 21C5 16.5 7.7 14 12 14C16.3 14 19 16.5 19 21" /></svg>
                  </div>
                  <div>
                    <strong className="block text-[#14345f] text-[13px]">{selected.reporter_name || '\u2014'}</strong>
                    <span className="block text-[#6680a3] text-[11px] mt-[3px]">{selected.location ? selected.location + ', Xevera Subdivision' : 'Xevera Subdivision'}</span>
                  </div>
                </div>
              </div>

              {/* Type + Severity */}
              <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                <div className="grid grid-cols-2">
                  <div className="pl-7 border-r border-[#dfe7f1]">
                    <div className="text-[11px] font-extrabold mb-2 text-[#16345d]">Violation Type</div>
                    <CategoryBadge category={selected.category} />
                  </div>
                  <div className="pl-[22px]">
                    <div className="text-[11px] font-extrabold mb-2 text-[#16345d]">Severity</div>
                    <SeverityBadge severity={getSeverity(selected)} />
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                <div className="flex items-center gap-[10px] text-[#102e5b] text-[12px] font-extrabold mb-[7px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="M4 17L9 12L13 16L16 13L20 17" /></svg>
                  Evidence ({selected.photos ? selected.photos.length : 0})
                </div>
                {selected.photos && selected.photos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 pl-7">
                    {selected.photos.slice(0, 3).map(function(p, i) {
                      return <img key={i} src={p} alt={'Evidence ' + (i + 1)} className="w-full h-[78px] rounded-[6px] object-cover cursor-pointer border border-[#dbe4ef]" onClick={function() { setCarouselIndex(i); setLightbox(p); }} />;
                    })}
                    <button className="border border-dashed border-[#b6cae5] bg-[#f8fbff] text-[#1769e8] rounded-[6px] cursor-pointer flex flex-col items-center justify-center text-[10px] gap-[5px] min-h-[78px]" onClick={function() { setLightbox(selected.photos[carouselIndex] || selected.photos[0]); }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M16 16L21 21" /></svg>
                      View All
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8190A7] pl-7">No photo evidence attached.</div>
                )}
              </div>

              {/* Date */}
              <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                <div className="flex items-center gap-[10px] text-[#102e5b] text-[12px] font-extrabold mb-[7px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2V6" /><path d="M16 2V6" /><path d="M3 9H21" /></svg>
                  Date Submitted
                </div>
                <div className="text-[#54729b] text-[12px] pl-7">{formatDrawerDate(selected.date, selected.created_at)}</div>
              </div>

              {/* Admin Remarks + Actions (Under Review) / Full detail (Confirmed) / Status box (Dismissed) */}
              {(function() {
                var vst = detail ? (detail.violation_status || (detail.is_suspicious ? 'Under Review' : null)) : (selected.violation_status || 'Under Review');
                if (vst === 'Confirmed') {
                  var susp = suspensionText(selected);
                  var appeal = getAppealStatus(selected);
                  var cSev = getSeverity(selected);
                  return (
                    <div>
                      {/* Penalty + Suspension */}
                      <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[#7b8aa3] text-[9px] mb-1">Applied Penalty</div>
                            <span className="inline-flex items-center px-[9px] py-[5px] rounded-[15px] text-[9px] font-bold whitespace-nowrap bg-[#ffe7eb] text-[#ef3148]">{penaltyLabel(selected)}</span>
                            <small className="block text-[#7b8aa3] mt-[5px] text-[10px]">To be handled according to policy</small>
                          </div>
                          <div>
                            <div className="text-[#7b8aa3] text-[9px] mb-1">Suspension Period</div>
                            <strong className="text-[11px] text-[#142957]">{susp.label}</strong>
                            <small className="block text-[#7b8aa3] mt-[5px] text-[10px]">{susp.sub}</small>
                          </div>
                        </div>
                      </div>
                      {/* Confirmation details */}
                      <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                        <div className="text-[10px] font-bold text-[#20375d] mb-[7px]">Confirmation Details</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[#7b8aa3] text-[9px] mb-1">Confirmed</div>
                            <strong className="text-[11px] text-[#142957]">{shortDate(selected.violation_created_at || selected.created_at)}</strong>
                          </div>
                          <div>
                            <div className="text-[#7b8aa3] text-[9px] mb-1">Confirmed By</div>
                            <strong className="text-[11px] text-[#142957]">{selected.confirmed_by || (user ? user.name : 'Admin')}</strong>
                          </div>
                        </div>
                      </div>
                      {/* Evidence */}
                      <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                        <div className="text-[10px] font-bold text-[#20375d] mb-[7px]">Evidence ({selected.photos ? selected.photos.length : 0})</div>
                        {selected.photos && selected.photos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-[6px]">
                            {selected.photos.slice(0, 3).map(function(p, i) {
                              return <div key={i} className="h-[67px] rounded-[6px] overflow-hidden bg-[#dfe7ef] cursor-pointer" onClick={function() { setCarouselIndex(i); setLightbox(p); }}><img src={p} alt={'Evidence ' + (i + 1)} className="w-full h-full object-cover" /></div>;
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#8190A7]">No photo evidence attached.</div>
                        )}
                      </div>
                      {/* Admin remarks */}
                      <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                        <div className="text-[10px] font-bold text-[#20375d] mb-[7px]">Admin Remarks</div>
                        <div className="bg-[#f7f9fc] border border-[#e4e9f0] rounded-[6px] p-[10px] text-[10px] leading-[1.5] text-[#52627c]">{selected.violation_reason || selected.suspicion_reason || 'No remarks recorded.'}</div>
                      </div>
                      {/* Appeal */}
                      <div className="pb-[13px]">
                        <div className="text-[10px] font-bold text-[#20375d] mb-[7px]">Appeal Status</div>
                        <div className="bg-[#fff8e9] border border-[#ffe1a2] rounded-[7px] p-[11px]">
                          <strong className="text-[11px] text-[#142957]">{appeal}</strong>
                          <small className="block text-[#7c6d4f] mt-[3px] text-[9px]">{appeal === 'Pending Appeal' ? 'Submitted by resident and awaiting review.' : selected.appeal_reason ? selected.appeal_reason : 'No active appeal for this violation.'}</small>
                        </div>
                        {appeal === 'Pending Appeal' && (
                          <div className="flex gap-2 mt-[15px]">
                            <button disabled={busy} onClick={function() { showToast('Opening full appeal details...'); }} className="flex-1 h-[39px] rounded-[6px] bg-white text-[#536681] text-[10px] font-bold cursor-pointer border border-[#cbd6e5]">View Appeal</button>
                            <button disabled={busy} onClick={function() { doAppeal('uphold'); }} className="flex-1 h-[39px] border-none rounded-[6px] text-white text-[10px] font-bold cursor-pointer bg-[#159653] disabled:opacity-50">{'\u2713'} Uphold</button>
                            <button disabled={busy} onClick={function() { doAppeal('overturn'); }} className="flex-1 h-[39px] border-none rounded-[6px] text-white text-[10px] font-bold cursor-pointer bg-[#ff3047] disabled:opacity-50">{'\u2715'} Overturn</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                if (vst !== 'Under Review') {
                  return (
                    <div className="rounded-[9px] p-3.5 border" style={{ background: '#F0FDF6', borderColor: '#BBE5C5' }}>
                      <div className="text-[12px] font-extrabold" style={{ color: '#16864E' }}>Dismissed — No violation found</div>
                      {(selected.suspicion_reason || selected.violation_reason) && <div className="text-[11px] text-[#526783] mt-1">{selected.suspicion_reason || selected.violation_reason}</div>}
                    </div>
                  );
                }
                return (
                  <div>
                    <div className="border-b border-[#dfe7f1] pb-[13px] mb-[13px]">
                      <div className="flex items-center gap-[10px] text-[#102e5b] text-[12px] font-extrabold mb-[7px]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4H20V17H7L4 20V4Z" /></svg>
                        Admin Remarks
                      </div>
                      <textarea value={remarks} onChange={function(e) { setRemarks(e.target.value); }} placeholder="Enter remarks, notes, or findings..." className="w-[calc(100%-28px)] ml-7 min-h-[73px] border border-[#cbd9e9] rounded-[6px] p-[10px] resize-y outline-none text-[12px] text-[#405c7f] focus:border-[#1769e8]" />
                    </div>
                    <div className="grid grid-cols-2 gap-[11px] mt-[17px]">
                      <button disabled={busy} onClick={function() { if (!remarks.trim()) { showToast('Please enter admin remarks before confirming.', 'error'); return; } setConfirmModal(selected); }} className="h-[46px] border-none rounded-[7px] text-white font-bold text-[12px] cursor-pointer bg-[#079c62] hover:bg-[#058552] disabled:opacity-50">{'\u2713'} Confirm Violation</button>
                      <button disabled={busy} onClick={doDrawerDismiss} className="h-[46px] border-none rounded-[7px] text-white font-bold text-[12px] cursor-pointer bg-[#f01922] hover:bg-[#d70d16] disabled:opacity-50">{busy ? 'Processing...' : '\u00D7 Dismiss Violation'}</button>
                    </div>
                    {selected && user && selected.reporter_user_id === user.id && (
                      <button onClick={function() { setDeleteModal(selected); }} className="w-full mt-2.5 h-[38px] border border-[#F5C2C2] bg-[#FFF5F5] text-[#DC3030] rounded-[7px] text-[10px] font-bold cursor-pointer hover:bg-[#FFE8E8]">Remove My Report</button>
                    )}
                  </div>
                );
              })()}
            </div>
            )}
          </div>
        </div>
        )}
      </aside>

      {/* Lightbox */}
      {lightbox && selected && selected.photos && (
        <div className="fixed inset-0 bg-[rgba(3,20,45,0.82)] z-[5000] flex items-center justify-center p-[25px]" onClick={function() { setLightbox(null); }}>
          <button className="absolute right-[25px] top-5 w-[42px] h-[42px] rounded-full border-none bg-white text-[#253B5D] text-[22px] cursor-pointer" onClick={function() { setLightbox(null); }}>&times;</button>
          {/* Prev Arrow */}
          {selected.photos.length > 1 && (
            <button onClick={function(e) { e.stopPropagation(); var photos = selected.photos; var idx = photos.indexOf(lightbox); var prev = idx > 0 ? idx - 1 : photos.length - 1; setLightbox(photos[prev]); setCarouselIndex(prev); }} className="absolute left-[25px] top-1/2 -translate-y-1/2 w-[48px] h-[48px] rounded-full bg-white/90 border-none text-[#253B5D] text-[20px] font-bold cursor-pointer shadow-lg hover:bg-white flex items-center justify-center">{'\u25C0'}</button>
          )}
          <img src={lightbox} alt="Evidence" className="max-w-[90vw] max-h-[85vh] object-contain rounded-[8px] shadow-[0_20px_70px_rgba(0,0,0,0.4)]" onClick={function(e) { e.stopPropagation(); }} />
          {/* Next Arrow */}
          {selected.photos.length > 1 && (
            <button onClick={function(e) { e.stopPropagation(); var photos = selected.photos; var idx = photos.indexOf(lightbox); var next = idx < photos.length - 1 ? idx + 1 : 0; setLightbox(photos[next]); setCarouselIndex(next); }} className="absolute right-[25px] top-1/2 -translate-y-1/2 w-[48px] h-[48px] rounded-full bg-white/90 border-none text-[#253B5D] text-[20px] font-bold cursor-pointer shadow-lg hover:bg-white flex items-center justify-center">{'\u25B6'}</button>
          )}
          {/* Counter */}
          {selected.photos.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 text-white text-[12px] font-bold">{selected.photos.indexOf(lightbox) + 1} / {selected.photos.length}</div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      <Modal open={!!confirmModal} title="Confirm Violation" description={'Create a violation for report ' + (confirmModal ? confirmModal.id : '') + '. Configure the violation details below.'}
        onClose={function() { setConfirmModal(null); }}
        actions={
          <>
            <button onClick={function() { setConfirmModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doConfirm} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#0F8F63] rounded-lg hover:bg-[#0B7A55] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Confirm Violation'}</button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-[11px] font-bold text-[#142B50] mb-1.5">Violation Type</label>
            <select value={confirmType} onChange={function(e) { setConfirmType(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] bg-white outline-none">
              <option value="Fake Report">Fake Report</option>
              <option value="Duplicate Report">Duplicate Report</option>
              <option value="False Information">False Information</option>
              <option value="Spam Report">Spam Report</option>
              <option value="Abusive Submission">Abusive Submission</option>
              <option value="Not a Violation">Not a Violation</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#142B50] mb-1.5">Severity</label>
            <select value={confirmSeverity} onChange={function(e) { setConfirmSeverity(e.target.value); }} className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] bg-white outline-none">
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
              <option value="Serious">Serious</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#142B50] mb-1.5">Fine Amount (₱)</label>
            <input type="number" value={confirmFine} onChange={function(e) { setConfirmFine(Number(e.target.value)); }} min="0" step="100" className="w-full h-[38px] border border-[#D7E0EB] rounded-[7px] px-[11px] text-[11px] text-[#596D89] outline-none" />
          </div>
        </div>
      </Modal>

      {/* Dismiss Modal */}
      <Modal open={!!dismissModal} title="Dismiss Report" description={'Dismiss report ' + (dismissModal ? dismissModal.id : '') + '? The reporter will be notified.'}
        onClose={function() { setDismissModal(null); }}
        actions={
          <>
            <button onClick={function() { setDismissModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doDismiss} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#E53535] rounded-lg hover:bg-[#DC2626] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Dismiss'}</button>
          </>
        }
      />

      {/* Reopen Modal */}
      <Modal open={!!reopenModal} title="Re-open Report" description={'Re-open report ' + (reopenModal ? reopenModal.id : '') + ' for review? It will be moved back to Under Review.'}
        onClose={function() { setReopenModal(null); }}
        actions={
          <>
            <button onClick={function() { setReopenModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doReopen} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#1263ED] rounded-lg hover:bg-[#0954DF] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Re-open'}</button>
          </>
        }
      />

      {/* Bulk Action Modal */}
      <Modal open={!!bulkModal} title={bulkModal && bulkModal.action === 'confirm' ? 'Bulk Confirm Violations' : 'Bulk Dismiss Reports'} description={bulkModal && bulkModal.action === 'confirm' ? 'Confirm ' + selectedIds.length + ' reports as violations? This will create penalties for each.' : 'Dismiss ' + selectedIds.length + ' reports? This action cannot be undone.'}
        onClose={function() { setBulkModal(null); }}
        actions={
          <>
            <button onClick={function() { setBulkModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={bulkModal && bulkModal.action === 'confirm' ? doBulkConfirm : doBulkDismiss} disabled={busy} className={'px-4 py-2 text-[11px] font-bold text-white rounded-lg cursor-pointer border-none disabled:opacity-50 ' + (bulkModal && bulkModal.action === 'confirm' ? 'bg-[#0F8F63] hover:bg-[#0B7A55]' : 'bg-[#E53535] hover:bg-[#DC2626]')}>{busy ? 'Processing...' : (bulkModal && bulkModal.action === 'confirm' ? 'Confirm All' : 'Dismiss All')}</button>
          </>
        }
      />

      {/* Delete Modal */}
      <Modal open={!!deleteModal} title="Remove Report" description={'Are you sure you want to remove report ' + (deleteModal ? deleteModal.id : '') + '? This action cannot be undone.'}
        onClose={function() { setDeleteModal(null); }}
        actions={
          <>
            <button onClick={function() { setDeleteModal(null); }} className="px-4 py-2 text-[11px] font-bold text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer">Cancel</button>
            <button onClick={doDelete} disabled={busy} className="px-4 py-2 text-[11px] font-bold text-white bg-[#E53535] rounded-lg hover:bg-[#DC2626] cursor-pointer border-none disabled:opacity-50">{busy ? 'Processing...' : 'Remove'}</button>
          </>
        }
      />
    </div>
  );
}