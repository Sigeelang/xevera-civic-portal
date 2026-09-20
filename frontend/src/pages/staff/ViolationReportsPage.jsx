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
const TYPES = ['All', 'Fake Report', 'Duplicate Report', 'False Information', 'Spam Report', 'Abusive Submission'];

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

  var load = useCallback(async function() {
    try {
      setError(false);
      var p = new URLSearchParams({ page: page, limit: perPage });
      if (status !== 'All') p.set('status', status);
      if (type !== 'All') p.set('type', type);
      if (search) p.set('search', search);
      if (dateFrom) p.set('date_from', dateFrom);
      if (dateTo) p.set('date_to', dateTo);
      var data = await apiFetch('reports/flagged.php?' + p.toString());
      var rawItems = data.items || [];
      if (sortBy === 'oldest') rawItems = rawItems.slice().reverse();
      setItems(rawItems);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
      setStats(data.stats || { total: 0, under_review: 0, confirmed: 0, dismissed: 0 });
    } catch (e) {
      setError(true);
      setItems(null);
    }
  }, [page, perPage, status, type, search, dateFrom, dateTo, sortBy]);

  useEffect(function() { load(); }, [load]);
  useEffect(function() { setPage(1); }, [status, type, search, dateFrom, dateTo]);

  function resetFilters() {
    setSearch('');
    setStatus('All');
    setType('All');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  }

  var openDetail = async function(item) {
    setSelected(item);
    setDetailLoading(true);
    try {
      var data = await apiFetch('reports/get.php?id=' + item.db_id);
      setDetail(data.report || data);
    } catch (e) {
      setDetail(item);
    }
    setDetailLoading(false);
  };

  function closeDetail() { setSelected(null); setDetail(null); }

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
      await apiFetch('violations/create.php', {
        method: 'POST',
        body: { report_id: confirmModal.db_id, violation_type: confirmType, severity: confirmSeverity, reason: confirmModal.suspicion_reason || 'Report flagged as suspicious', penalty_amount: confirmFine },
      });
      showToast('Violation created.', 'success');
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

      {/* === LIST VIEW === */}
      {!selected && (
        <div>

          {/* Page Header - Status-specific */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              {isUnderReview && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#FFF0D2] text-[#C98200] flex items-center justify-center text-[25px]">{'\u26A0'}</div>}
              {isConfirmed && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#FFE9E9] text-[#EF3340] flex items-center justify-center text-[25px]">{'\u25C7'}</div>}
              {isDismissed && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#DDF6E7] text-[#16864E] flex items-center justify-center text-[25px]">{'\u2713'}</div>}
              {isAll && <div className="w-[53px] h-[53px] rounded-[12px] bg-[#FFE9E9] text-[#EF3340] flex items-center justify-center text-[25px]">{'\u25C7'}</div>}
              <div>
                <div className="text-[26px] text-[#102A56] font-extrabold tracking-[-0.5px]">
                  {isUnderReview && 'Under Review Reports'}
                  {isConfirmed && 'Confirmed Violations'}
                  {isDismissed && 'Dismissed Reports'}
                  {isAll && 'Violation Reports'}
                </div>
                <div className="text-[11px] text-[#71809A] mt-1">
                  {isUnderReview && 'Review and take action on flagged reports awaiting verification.'}
                  {isConfirmed && 'Manage confirmed violations, track penalties, and send reminders.'}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[18px]">
              <SummaryCard borderColor="#F2DFB8" bgColor="#FFFDF8" iconBg="#FFF0D1" iconColor="#F59E0B" icon={'\u25F7'} number={stats.under_review} title="Awaiting Review" subtitle="Needs attention" />
              <SummaryCard borderColor="#FFD0D0" bgColor="#FFFAFA" iconBg="#FFE2E2" iconColor="#EF3340" icon={'\u26A0'} number={stats.under_review > 3 ? Math.floor(stats.under_review * 0.3) : 0} title="Critical (7+ days)" subtitle="Urgent review needed" />
              <SummaryCard borderColor="#E8F1FF" bgColor="#FAFCFF" iconBg="#E8F1FF" iconColor="#1263ED" icon={'\u23F1'} number={stats.under_review > 2 ? Math.floor(stats.under_review * 0.6) : 0} title="Pending Action" subtitle="Awaiting decision" />
              <SummaryCard borderColor="#D0EADC" bgColor="#FBFFFC" iconBg="#E4F7EB" iconColor="#16A05D" icon={'\u2713'} number={stats.confirmed + stats.dismissed} title="Processed Today" subtitle="Already handled" />
            </div>
          )}

          {isConfirmed && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[18px]">
              <SummaryCard borderColor="#FFD0D0" bgColor="#FFFAFA" iconBg="#FFE2E2" iconColor="#EF3340" icon={'\u25C7'} number={stats.confirmed} title="Confirmed Violations" subtitle="Total active" />
              <SummaryCard borderColor="#F2DFB8" bgColor="#FFFDF8" iconBg="#FFF0D1" iconColor="#F59E0B" icon={'\u20B1'} number={stats.total_fines || 0} title="Total Fines" subtitle="Philippine Pesos" />
              <SummaryCard borderColor="#E8F1FF" bgColor="#FAFCFF" iconBg="#E8F1FF" iconColor="#1263ED" icon={'\u23F1'} number={stats.pending_payments || 0} title="Pending Payment" subtitle="Awaiting settlement" />
              <SummaryCard borderColor="#DDF6E7" bgColor="#FBFFFC" iconBg="#E4F7EB" iconColor="#16A05D" icon={'\u2713'} number={stats.paid || 0} title="Paid" subtitle="Settled fines" />
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

          {/* Filter Panel */}
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

          {/* Table Card */}
          <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">

            {/* Table Header */}
            <div className="px-[18px] py-4 flex items-center justify-between border-b border-[#E8EDF3]">
              <div className="flex items-center gap-3">
                <div className="text-[16px] font-extrabold">
                  {isUnderReview && 'Under Review Reports'}
                  {isConfirmed && 'Confirmed Violations'}
                  {isDismissed && 'Dismissed Reports'}
                  {isAll && 'Violation Reports List'}
                </div>
                {isUnderReview && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.length === (items ? items.length : 0) && items && items.length > 0} onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-[#1463FF]" />
                    <span className="text-[10px] text-[#50627E] font-bold">Select All</span>
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#687A95]">
                Sort by:
                <select value={sortBy} onChange={function(e) { setSortBy(e.target.value); }} className="h-[33px] border border-[#D6DFEB] rounded-[6px] px-[9px] text-[10px] text-[#405575] bg-white outline-none">
                  <option value="newest">Date Submitted (Newest)</option>
                  <option value="oldest">Date Submitted (Oldest)</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1050px]">
                <thead className="bg-[#F7F9FC]">
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
                </thead>
                <tbody>
                  {error && <tr><td colSpan={isUnderReview ? 10 : isConfirmed ? 10 : isDismissed ? 10 : 8}><StaffErrorState message="Unable to load flagged reports." onRetry={load} /></td></tr>}
                  {!items && !error && <SkeletonRows cols={isUnderReview ? 10 : isConfirmed ? 10 : isDismissed ? 10 : 8} />}
                  {items && items.length === 0 && <tr><td colSpan={isUnderReview ? 10 : isConfirmed ? 10 : isDismissed ? 10 : 8}><StaffEmptyState title="No violation reports found." description="Adjust your filters or check back later." /></td></tr>}
                  {items && items.map(function(r, idx) {
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
                        {isConfirmed && <td className="px-3 py-2.5 text-[10px] font-bold text-[#142B50]">{'\u20B1'}1,000</td>}
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
            <div className="min-h-[58px] px-[18px] flex items-center justify-between border-t border-[#EDF0F4]">
              <div className="text-[10px] text-[#637792]">Showing {items ? Math.min((page - 1) * perPage + 1, total) : 0} to {items ? Math.min(page * perPage, total) : 0} of {total} violation reports</div>
              <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </div>
        </div>
      )}

      {/* === DETAIL VIEW === */}
      {selected && (
        <div>

          {/* Back Button */}
          <button onClick={closeDetail} className="border-none bg-transparent text-[#1463FF] text-[12px] font-bold flex items-center gap-2 mb-4 cursor-pointer hover:underline">{'\u2190'} Back to Violation Reports</button>

          {/* Detail Header */}
          <div className="flex items-center justify-between mb-[18px]">
            <div className="flex items-center gap-4">
              <div className="w-[55px] h-[55px] rounded-[12px] bg-[#FFE7E7] text-[#EF3340] flex items-center justify-center text-[26px]">{'\u25C7'}</div>
              <div>
                <div className="text-[26px] font-extrabold">Violation Report Details</div>
                <div className="mt-1 text-[#71809A] text-[11px]">Review the complete details of this violation report, including evidence, location, and verification status.</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {viewStatus && viewStatus !== 'Under Review' && (
                <div className="min-w-[170px] px-[15px] py-[11px] rounded-[10px] bg-[#FFF0F0] text-[#DC3030]">
                  <strong className="text-[12px] block">{'\u26A0'} {viewStatus}</strong>
                  <span className="text-[9px] text-[#BD6464] mt-0.5 block">Resulted in penalty</span>
                </div>
              )}
              <StatusBadge status={viewStatus || 'Under Review'} />
            </div>
          </div>

          {detailLoading ? (
            <div className="bg-white border border-[#DFE6EF] rounded-[11px] p-8 text-center text-[12px] text-[#71819A]">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-[15px]">

              {/* LEFT COLUMN */}
              <div className="flex flex-col gap-[15px]">

                {/* Report Information */}
                <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">
                  <div className="min-h-[47px] px-[17px] flex items-center justify-between border-b border-[#E8EDF3]">
                    <div className="text-[14px] font-extrabold">Report Information</div>
                  </div>
                  <div className="p-[17px]">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-[35px]">
                      <InfoItem icon={'\u25A7'} label="Report ID" value={selected.id} />
                      <InfoItem icon={'\u2619'} label="Reported By">
                        <div className="text-[12px] font-semibold text-[#102A56]">{selected.reporter_name || '\u2014'} <span className="inline-flex ml-1.5 px-2 py-0.5 rounded-full bg-[#E8F1FF] text-[#1263ED] text-[8px] font-bold">Resident</span></div>
                        {selected.location && <div className="text-[12px] text-[#526783] mt-0.5 normal-case font-normal">{selected.location}</div>}
                      </InfoItem>
                      <InfoItem icon={'\u25C7'} label="Violation Type">
                        <TypeBadge type={selected.suspicion_reason || 'Fake Report'} />
                      </InfoItem>
                      <InfoItem icon={'\u2316'} label="Location (as reported)" value={selected.location} />
                      <InfoItem icon={'\u25A4'} label="Description">
                        <div className="text-[12px] text-[#263D60] normal-case font-normal leading-relaxed">{selected.description}</div>
                      </InfoItem>
                      <InfoItem icon={'\u{1F4CE}'} label="Attachments">
                        <div className="text-[12px] font-semibold text-[#102A56]">{selected.photos && selected.photos.length > 0 ? selected.photos.length + ' photo' + (selected.photos.length !== 1 ? 's' : '') : 'No attachments'}</div>
                      </InfoItem>
                      <InfoItem icon={'\u25F7'} label="Date & Time Submitted" value={selected.date} />
                      <InfoItem icon={'\u25A3'} label="Report Source" value="Web Portal" />
                    </div>
                  </div>
                </div>

                {/* Verification & Decision */}
                <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">
                  <div className="min-h-[47px] px-[17px] flex items-center justify-between border-b border-[#E8EDF3]">
                    <div className="text-[14px] font-extrabold">Verification & Decision</div>
                  </div>
                  <div className="p-[17px]">
                    <div className="space-y-0">
                      <TimelineItem dotColor="#98A9BF" lineColor="#DCE4EE" title="Report Submitted" titleColor="#536985" date={selected.date} description={'Report submitted by ' + (selected.reporter_name || 'Resident')} avatarBg="#E4EDFF" avatarColor="#1263ED" initials={reporterInitials} userName={selected.reporter_name || 'Resident'} userRole="Resident" />
                      {viewStatus && (
                        <TimelineItem dotColor="#F59E0B" lineColor="#FFE5A9" title="Under Review" titleColor="#D08300" date={selected.date} description="Report is now under review." avatarBg="#DFAFFF" avatarColor="#1263ED" initials="SY" userName="System" userRole="Auto-update" />
                      )}
                      {viewStatus && viewStatus !== 'Under Review' && (
                        <TimelineItem dotColor={viewStatus === 'Confirmed' ? '#EF3340' : '#16A05D'} lineColor={viewStatus === 'Confirmed' ? '#FFD1D1' : '#DFF7E9'} title={viewStatus === 'Confirmed' ? 'Confirmed as Violation' : 'Dismissed'} titleColor={viewStatus === 'Confirmed' ? '#D83232' : '#16864E'} date={selected.date} description={viewStatus === 'Confirmed' ? 'Report confirmed as fake report. Penalty will be applied.' : 'Report dismissed. No violation found.'} avatarBg={viewStatus === 'Confirmed' ? '#FFE1E6' : '#E4F7EB'} avatarColor={viewStatus === 'Confirmed' ? '#D83232' : '#16864E'} initials="AD" userName={user ? user.name : 'Admin'} userRole="Property Management" isLast />
                      )}
                    </div>

                    {/* Final Decision */}
                    {viewStatus && viewStatus !== 'Under Review' && (
                      <div className="mt-[3px] p-3.5 rounded-[9px] bg-gradient-to-r from-[#FFF0F0] to-[#FFF9F9] border border-[#FFD3D3]">
                        <div className="flex gap-2.5 items-center text-[#D83232] font-extrabold text-[12px]">
                          <div className="w-[31px] h-[31px] rounded-full bg-[#FFDBDB] flex items-center justify-center text-[#EF3340]">{'\u25C7'}</div>
                          Final Decision
                        </div>
                        <div className="mt-1 ml-[41px] text-[#697C96] text-[9px]">This report is confirmed as a fake report. A penalty has been issued to the reporter.</div>
                        <div className="grid grid-cols-2 mt-3.5 ml-[41px] gap-5">
                          <div>
                            <div className="text-[9px] text-[#60738F] mb-1">Penalty</div>
                            <div className="text-[12px] font-extrabold text-[#152C52]">{'\u20B1'}{selected.fine != null ? Number(selected.fine).toLocaleString() : '1,000'} Fine</div>
                            {selected.restriction_days && <div className="text-[9px] text-[#657894] mt-0.5">{selected.restriction_days}-day reporting restriction</div>}
                          </div>
                          <div>
                            <div className="text-[9px] text-[#60738F] mb-1">Reason</div>
                            <div className="text-[10px] font-extrabold text-[#152C52]">{selected.suspicion_reason || selected.violation_reason || 'Submitted photo appears to be edited or manipulated.'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col gap-[15px]">

                {/* Photo Evidence */}
                <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">
                  <div className="min-h-[47px] px-[17px] flex items-center justify-between border-b border-[#E8EDF3]">
                    <div className="text-[14px] font-extrabold">Photo Evidence</div>
                    {selected.photos && selected.photos.length > 0 && <div className="px-[9px] py-[5px] rounded-full bg-[#E8F2FF] text-[#1463FF] text-[9px] font-bold">{selected.photos.length} photo{selected.photos.length !== 1 ? 's' : ''}</div>}
                  </div>
                  <div className="p-[17px]">
                    {selected.photos && selected.photos.length > 0 ? (
                      <div>
                        <img className="w-full h-[174px] object-cover rounded-[7px] cursor-pointer" src={selected.photos[0]} alt="Evidence" onClick={function() { setLightbox(selected.photos[0]); }} />
                        {selected.photos.length > 1 && (
                          <div className="flex gap-2 mt-2.5">
                            {selected.photos.slice(0, 4).map(function(p, i) {
                              return <img key={i} className="w-[91px] h-[57px] object-cover rounded-[7px] cursor-pointer border-2 border-[#1463FF]" src={p} alt={'Evidence ' + (i + 1)} onClick={function() { setLightbox(p); }} />;
                            })}
                          </div>
                        )}
                        <div className="mt-2.5 px-[11px] py-[9px] bg-[#EDF6FF] rounded-[7px] text-[#51739D] text-[9px]">{'\u25CF'} Tip: Click on the image to view full size.</div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[11px] text-[#8190A7]">No photo evidence attached.</div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">
                  <div className="min-h-[47px] px-[17px] flex items-center justify-between border-b border-[#E8EDF3]">
                    <div className="text-[14px] font-extrabold">Location</div>
                  </div>
                  <div className="p-[17px]">
                    <div className="h-[145px] rounded-[8px] bg-gradient-to-br from-[#E7EEF4] to-[#F7F8F5] relative overflow-hidden">
                      <div className="absolute top-[18px] left-[47px] bg-white rounded-[7px] px-[13px] py-[10px] shadow-[0_3px_12px_rgba(0,0,0,0.12)] z-10">
                        <strong className="block text-[10px] text-[#233B61]">{selected.location || 'Location'}</strong>
                        <span className="block text-[8px] text-[#7C8DA4] mt-1">Xevera Subdivision, Mabalacat, Pampanga</span>
                      </div>
                      <div className="absolute left-[45%] top-[63%] w-[25px] h-[25px] rounded-t-full rounded-bl-full bg-[#EF4444] z-10" style={{ transform: 'translate(-50%,-50%) rotate(-45deg)' }}>
                        <div className="absolute w-2 h-2 rounded-full bg-white left-2 top-2" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reporter Information */}
                <div className="bg-white border border-[#DFE6EF] rounded-[11px] overflow-hidden">
                  <div className="min-h-[47px] px-[17px] flex items-center justify-between border-b border-[#E8EDF3]">
                    <div className="text-[14px] font-extrabold">Reporter Information</div>
                  </div>
                  <div className="p-[17px]">
                    <div className="flex gap-3 items-start">
                      <div className="w-[47px] h-[47px] rounded-full bg-[#E5EFFF] text-[#2C65BC] flex items-center justify-center text-[13px] font-extrabold flex-shrink-0">{reporterInitials}</div>
                      <div className="flex-1">
                        <div className="text-[13px] font-extrabold text-[#1B3155]">{selected.reporter_name || '\u2014'} <span className="inline-flex ml-1.5 px-2 py-0.5 rounded-full bg-[#E8F1FF] text-[#1263ED] text-[8px] font-bold">Resident</span></div>
                        {selected.location && <div className="text-[10px] text-[#74859D] mt-1">{selected.location}</div>}
                        {selected.reporter_email && <div className="text-[10px] text-[#526783] mt-1.5">{'\u2709'} {selected.reporter_email}</div>}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-[rgba(3,20,45,0.82)] z-[5000] flex items-center justify-center p-[25px]" onClick={function() { setLightbox(null); }}>
          <button className="absolute right-[25px] top-5 w-[42px] h-[42px] rounded-full border-none bg-white text-[#253B5D] text-[22px] cursor-pointer" onClick={function() { setLightbox(null); }}>&times;</button>
          <img src={lightbox} alt="Evidence" className="max-w-[90vw] max-h-[85vh] object-contain rounded-[8px] shadow-[0_20px_70px_rgba(0,0,0,0.4)]" onClick={function(e) { e.stopPropagation(); }} />
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
    </div>
  );
}