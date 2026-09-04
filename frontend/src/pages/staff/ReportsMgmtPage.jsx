import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import Pager from '../../components/Pager';
import { useToast } from '../../components/Toast';
import { downloadExport, exportFilename } from '../../services/download';
import StaffPageHeader from '../../components/StaffPageHeader';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import { getReportActions, getReportStatusConfig, getInitials, canTransitionReport } from '../../utils/reportStatus';

const CATEGORY_ICON = {
  Water: '💧', Electrical: '💡', Waste: '🗑', Drainage: '≋', Roads: '⌁',
  Sanitation: '🧹', Pest: '🐜', Safety: '⚠', Landscaping: '🌿', 'Street Light': '💡',
};

const ACTION_META = {
  verify: { label: 'Verify', cls: 'bg-xevera-600 text-white hover:bg-xevera-700' },
  assign: { label: 'Assign Staff', cls: 'bg-xevera-600 text-white hover:bg-xevera-700' },
  start: { label: 'Start Work', cls: 'bg-xevera-600 text-white hover:bg-xevera-700' },
  update: { label: 'Update', cls: 'border border-[#DBE5F0] bg-white text-[#1769ED] hover:bg-[#EEF5FF]' },
  resolve: { label: 'Mark Resolved', cls: 'bg-[#0F8F63] text-white hover:bg-[#0B7A55]' },
  close: { label: 'Close Report', cls: 'bg-[#374151] text-white hover:bg-[#1F2937]' },
  reopen: { label: 'Reopen', cls: 'bg-[#F59E0B] text-white hover:bg-[#D97706]' },
  reject: { label: 'Reject', cls: 'border border-[#F2B9B9] bg-white text-[#E53535] hover:bg-[#FEF2F2]' },
};

function StatCard({ tone, icon, name, number, footer }) {
  const T = {
    blue: { icon: 'bg-[#EAF2FF] text-[#1769ED]' },
    orange: { icon: 'bg-[#FFF4DF] text-[#F57C00]' },
    purple: { icon: 'bg-[#F0EAFF] text-[#6D28D9]' },
    green: { icon: 'bg-[#E7F8EF] text-[#159957]' },
    gray: { icon: 'bg-[#EEF2F6] text-[#5C6E86]' },
    red: { icon: 'bg-[#FFE9E9] text-[#E53535]' },
  }[tone];
  return (
    <div className="relative min-h-[128px] bg-white border border-[#E2E8F0] rounded-[11px] p-[18px] shadow-[0_4px_18px_rgba(15,35,65,0.06)] overflow-hidden">
      <div className="flex items-center">
        <span className={`w-[38px] h-[38px] rounded-[10px] grid place-items-center text-[20px] flex-shrink-0 ${T.icon}`}>{icon}</span>
        <span className="ml-3 text-[12px] font-bold text-[#102544]">{name}</span>
      </div>
      <div className="mt-3 text-[28px] leading-none font-extrabold tracking-[-0.5px] text-[#102544]">{number}</div>
      <div className="absolute bottom-4 left-[18px] text-[10px] text-[#71819A]">{footer}</div>
      <div className="absolute right-[15px] bottom-[12px] text-[24px] tracking-[-4px] opacity-40 select-none" aria-hidden="true">⌁⌁⌁</div>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = getReportStatusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[20px] text-[9px] font-extrabold whitespace-nowrap ${cfg.cls}`}>
      <span className="w-[6px] h-[6px] rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function buildCards(status, s) {
  const week = Array.isArray(s.week) ? s.week : [];
  const today = week.length ? (week[week.length - 1].count || 0) : 0;
  const weekTotal = week.reduce((a, w) => a + (w.count || 0), 0);
  const cfg = {
    'Admin Action': [
      { tone: 'blue', icon: '▣', name: 'Needs Action', number: (s.pending || 0) + (s.verified || 0) + (s.resolved || 0), footer: 'Pending review / assignment / closure' },
      { tone: 'purple', icon: '◇', name: 'Due Today', number: s.due_today || 0, footer: 'Need action today' },
      { tone: 'green', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
    Verified: [
      { tone: 'blue', icon: '▣', name: 'Ready for Assignment', number: s.verified || 0, footer: 'Verified, awaiting staff' },
      { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
      { tone: 'green', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
    Assigned: [
      { tone: 'blue', icon: '▣', name: 'Assigned', number: s.assigned || 0, footer: 'Assigned, not started' },
      { tone: 'green', icon: '✓', name: 'Resolved', number: s.resolved || 0, footer: 'Reports you have completed' },
      { tone: 'purple', icon: '◇', name: 'Due Today', number: s.due_today || 0, footer: 'Due today' },
      { tone: 'green', icon: '◷', name: 'In Progress', number: s.in_progress || 0, footer: 'Currently being worked on' },
    ],
    'In Progress': [
      { tone: 'blue', icon: '▣', name: 'In Progress', number: s.in_progress || 0, footer: 'Currently being worked on' },
      { tone: 'purple', icon: '◇', name: 'Due Today', number: s.due_today || 0, footer: 'Due today' },
      { tone: 'green', icon: '◷', name: 'Avg Resolve', number: s.avg_resolve_days != null ? `${s.avg_resolve_days}d` : '—', footer: 'Average resolution time' },
    ],
    Resolved: [
      { tone: 'blue', icon: '▣', name: 'Awaiting Closure', number: s.resolved || 0, footer: 'Resolved, awaiting review' },
      { tone: 'green', icon: '◷', name: 'Resolved This Month', number: s.resolved_this_month || 0, footer: 'Resolved since month start' },
      { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
      { tone: 'gray', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
    Closed: [
      { tone: 'gray', icon: '▣', name: 'Closed', number: s.closed || 0, footer: 'Closed / archived' },
      { tone: 'green', icon: '◷', name: 'Resolved This Month', number: s.resolved_this_month || 0, footer: 'Resolved since month start' },
      { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
      { tone: 'gray', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
    Rejected: [
      { tone: 'red', icon: '▣', name: 'Rejected', number: s.rejected || 0, footer: 'Rejected reports' },
      { tone: 'gray', icon: '◷', name: 'Total Reports', number: s.total || 0, footer: 'All time' },
      { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
      { tone: 'green', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
    Pending: [
      { tone: 'blue', icon: '▣', name: 'Needs Verification', number: s.pending || 0, footer: 'Awaiting verification' },
      { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
      { tone: 'green', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
    ],
  };
  return cfg[status] || [
    { tone: 'blue', icon: '▣', name: 'Total Reports', number: s.total || 0, footer: 'All time' },
    { tone: 'purple', icon: '◇', name: 'Today', number: today, footer: 'Submitted today' },
    { tone: 'green', icon: '◷', name: 'This Week', number: weekTotal, footer: 'Submitted this week' },
  ];
}

export default function ReportsMgmtPage({ statusPreset, scope = 'all', onViewReport, onNavigate, title, description, eyebrow }) {
  const showToast = useToast();
  const { categories } = useSettings();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(statusPreset || 'All');
  const [category, setCategory] = useState('All');
  const [staffFilter, setStaffFilter] = useState('all');
  const [perPage, setPerPage] = useState(10);
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolution, setResolution] = useState('');
  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateText, setUpdateText] = useState('');
  const [drawerReport, setDrawerReport] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState(null);
  const [pickerMode, setPickerMode] = useState('assign');
  const [pickerReport, setPickerReport] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [drawerHistory, setDrawerHistory] = useState(null);

  const staffById = (staffList || []).reduce((m, u) => { m[u.id] = u; return m; }, {});
  const isManager = ['Super Admin', 'Admin'].includes(user?.role);

  useEffect(() => {
    apiFetch('users/assignable.php')
      .then((d) => setStaffList(Array.isArray(d) ? d : []))
      .catch(() => setStaffList([]));
  }, []);

  const fmtLocalDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function resolveDateRange() {
    const now = new Date();
    switch (datePreset) {
      case 'today': {
        const s = fmtLocalDate(now);
        return { from: s, to: s };
      }
      case 'week': {
        const start = new Date(now);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        return { from: fmtLocalDate(start), to: fmtLocalDate(now) };
      }
      case 'month': {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: fmtLocalDate(first), to: fmtLocalDate(now) };
      }
      case 'custom':
        return { from: customFrom, to: customTo };
      default:
        return {};
    }
  }

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const params = new URLSearchParams({ search, status, category, page, limit: perPage });
      params.set('staff', 'true');
      if (staffFilter && staffFilter !== 'all') params.set('assigned_to', staffFilter);
      else if (scope === 'assigned') params.set('assigned_to', 'me');
      else if (scope === 'unassigned') params.set('assigned_to', 'none');
      const range = resolveDateRange();
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      const data = await apiFetch('reports/list.php?' + params.toString());
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.total_pages) || 1));
    } catch {
      setItems([]);
      setError(true);
    }
  }, [search, status, category, staffFilter, page, perPage, scope, datePreset, customFrom, customTo]);

  const loadStats = useCallback(() => {
    apiFetch('reports/stats.php' + (scope === 'assigned' ? '?assigned_to=me' : ''))
      .then((d) => setStats(d && typeof d === 'object' && !d.error ? d : null))
      .catch(() => setStats(null));
  }, [scope]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setStatus(statusPreset || 'All'); }, [statusPreset]);

  const s = stats || {};
  const cards = buildCards(status, s);

  async function changeStatus(r, next) {
    setBusyId(r.id);
    try {
      await apiFetch('reports/update.php', { method: 'POST', body: { id: r.id, status: next } });
      showToast(`Report ${r.id} moved to ${next}.`);
      load();
      loadStats();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(r) {
    setRejectTarget(r);
    setRejectReason('');
  }

  async function submitReject() {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      showToast('A rejection reason is required.', 'error');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: rejectTarget.id, status: 'Rejected', rejection_reason: rejectReason.trim() },
      });
      showToast(`Report ${rejectTarget.id} rejected.`);
      setRejectTarget(null);
      load();
      loadStats();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openResolve(r) {
    setResolveTarget(r);
    setResolution('');
  }

  async function submitResolve() {
    if (!resolveTarget) return;
    if (!resolution.trim()) {
      showToast('Resolution details are required.', 'error');
      return;
    }
    setBusyId(resolveTarget.id);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: resolveTarget.id, status: 'Resolved', resolution: resolution.trim() },
      });
      showToast(`Report ${resolveTarget.id} resolved.`);
      setResolveTarget(null);
      load();
      loadStats();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function openUpdate(r) {
    setUpdateTarget(r);
    setUpdateText('');
  }

  async function submitUpdate() {
    if (!updateTarget) return;
    if (!updateText.trim()) {
      showToast('Please enter a progress update.', 'error');
      return;
    }
    setBusyId(updateTarget.id);
    try {
      await apiFetch('reports/update.php', {
        method: 'POST',
        body: { id: updateTarget.id, remarks: updateText.trim() },
      });
      showToast(`Update added to ${updateTarget.id}.`);
      setUpdateTarget(null);
      load();
      loadStats();
    } catch (e) {
      showToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function assignStaff(reportId, staffId, nextStatus) {
    if (!reportId || !staffId) return;
    setBusyId(reportId);
    try {
      const body = { id: reportId, assigned_to: staffId };
      if (nextStatus) body.status = nextStatus;
      await apiFetch('reports/update.php', { method: 'POST', body });
      showToast(nextStatus === 'In Progress'
        ? `Report ${reportId} started and assigned to ${staffById[staffId]?.name || 'staff'}.`
        : `Report ${reportId} assigned.`);
      setPickerOpen(false);
      setDrawerReport(null);
      load();
      loadStats();
    } catch (e) {
      showToast(e.message || 'Assignment failed.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function startWork(r) {
    if (r.assigned_id) {
      changeStatus(r, 'In Progress');
      setDrawerReport(null);
      return;
    }
    if (isManager) {
      openPicker(r, 'start');
      return;
    }
    changeStatus(r, 'In Progress');
    setDrawerReport(null);
  }

  function openPicker(r, mode = 'assign') {
    if (!r) return;
    setPickerMode(mode);
    setPickerReport(r);
    setPickerSearch('');
    setPickerSelected(r.assigned_id || null);
    setPickerOpen(true);
  }

  function runAction(r, action) {
    switch (action) {
      case 'verify': changeStatus(r, 'Verified'); break;
      case 'assign': openPicker(r, 'assign'); break;
      case 'start': startWork(r); break;
      case 'update': openUpdate(r); break;
      case 'resolve': openResolve(r); break;
      case 'close': changeStatus(r, 'Closed'); break;
      case 'reopen': changeStatus(r, r.status === 'Rejected' ? 'Pending' : 'In Progress'); break;
      case 'reject': openReject(r); break;
      default: break;
    }
  }

  function resetFilters() {
    setSearch('');
    setCategory('All');
    setStaffFilter('all');
    setStatus(statusPreset || 'All');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
    showToast('Filters have been reset.');
  }

  /* ============================================================
     BULK SELECTION & ACTIONS
  ============================================================ */

  function toggleSelectRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = Boolean(items?.length) && items.every((r) => selectedIds.has(String(r.id)));

  function toggleSelectAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        items.forEach((r) => next.delete(String(r.id)));
      } else {
        items.forEach((r) => next.add(String(r.id)));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function openBulkAssign() {
    setPickerMode('bulk');
    setPickerReport(null);
    setPickerSearch('');
    setPickerSelected(null);
    setPickerOpen(true);
  }

  async function runBulkAssign(staffId) {
    if (!staffId || bulkBusy) return;
    setBulkBusy(true);
    let updated = 0;
    let skipped = 0;
    try {
      for (const r of items.filter((x) => selectedIds.has(String(x.id)))) {
        if (!['Pending', 'Verified', 'Assigned'].includes(r.status)) { skipped++; continue; }
        try {
          await apiFetch('reports/update.php', { method: 'POST', body: { id: r.id, assigned_to: staffId } });
          updated++;
        } catch { skipped++; }
      }
      showToast(`${updated} reports assigned to ${staffById[staffId]?.name || 'staff'}${skipped ? `, ${skipped} skipped.` : '.'}`);
      setPickerOpen(false);
      clearSelection();
      load();
      loadStats();
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkStatus() {
    if (!bulkStatusValue || bulkBusy) return;
    setBulkBusy(true);
    let updated = 0;
    let skipped = 0;
    try {
      for (const r of items.filter((x) => selectedIds.has(String(x.id)))) {
        if (!canTransitionReport(r.status, bulkStatusValue)) { skipped++; continue; }
        try {
          await apiFetch('reports/update.php', { method: 'POST', body: { id: r.id, status: bulkStatusValue } });
          updated++;
        } catch { skipped++; }
      }
      showToast(
        skipped > 0
          ? `${updated} reports updated, ${skipped} skipped because the status transition is not allowed.`
          : `${updated} reports updated.`
      );
      setBulkStatusOpen(false);
      setBulkStatusValue('');
      clearSelection();
      load();
      loadStats();
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportSelected() {
    if (exporting || selectedIds.size === 0) return;
    setExporting(true);
    try {
      await downloadExport('export/reports.php', { ids: Array.from(selectedIds).join(',') }, { filename: exportFilename('csv') });
      showToast(`Exported ${selectedIds.size} selected reports.`);
    } catch (e) {
      showToast(e.message || 'Unable to export.', 'error');
    } finally {
      setExporting(false);
    }
  }

  /* ============================================================
     STATUS HISTORY (report drawer)
  ============================================================ */

  useEffect(() => {
    setDrawerHistory(null);
    if (!drawerReport) return;
    apiFetch('reports/history.php?id=' + encodeURIComponent(drawerReport.id))
      .then((d) => setDrawerHistory(Array.isArray(d) ? d : Array.isArray(d?.history) ? d.history : []))
      .catch(() => setDrawerHistory([]));
  }, [drawerReport]);

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadExport('export/reports.php', {
        status: status === 'All' ? 'All' : status,
        category: category === 'All' ? 'All' : category,
      }, { filename: exportFilename('csv') });
      showToast('Report export downloaded.');
    } catch (e) {
      showToast(e.message || 'Unable to export.', 'error');
    } finally {
      setExporting(false);
    }
  }

  const canExport = ['Super Admin', 'Admin'].includes(user?.role);
  const assigneeList = (staffList || []).filter((u) => u.role === 'Staff');
  const filteredAssignees = assigneeList.filter((u) =>
    !pickerSearch.trim() || (u.name + ' ' + u.role).toLowerCase().includes(pickerSearch.trim().toLowerCase())
  );
  const drawerStaffRole = drawerReport && staffById[drawerReport.assigned_id] ? staffById[drawerReport.assigned_id].role : 'Staff';
  const drawerActions = drawerReport ? getReportActions(drawerReport, user) : [];

  const titleFallback =
    status === 'Admin Action' ? 'Pending Action'
    : status === 'Verified' ? 'Verified'
    : status === 'Pending' ? 'Pending'
    : status === 'Assigned' ? 'Assigned'
    : status === 'In Progress' ? 'In Progress'
    : status === 'Resolved' ? 'Resolved'
    : status === 'Closed' ? 'Closed'
    : status === 'Rejected' ? 'Rejected'
    : 'All Reports';

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow={eyebrow || 'Report Management'}
        title={title || titleFallback}
        description={description || 'Manage reports through the verification, assignment, and resolution workflow.'}
        actions={
          canExport ? (
            <button onClick={exportCsv} disabled={exporting}
              className="inline-flex items-center justify-center gap-1.5 h-[40px] px-4 rounded-[9px] font-bold text-[10px] bg-white border border-[#DBE4EE] text-[#344A68] hover:border-xevera-600 hover:text-xevera-600 transition-colors disabled:opacity-50 cursor-pointer">
              ↓ Export CSV
            </button>
          ) : undefined
        }
      />

      {/* Contextual stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        {cards.map((c) => (
          <StatCard key={c.name} tone={c.tone} icon={c.icon} name={c.name} number={c.number} footer={c.footer} />
        ))}
      </div>

      {/* Table panel */}
      <div className="bg-white rounded-[12px] border border-[#E2E8F0] shadow-[0_4px_18px_rgba(15,35,65,0.06)] overflow-hidden">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_135px_130px_125px_125px_130px_88px] gap-2.5 p-3.5 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2 h-[40px] px-3 rounded-[8px] border border-[#DCE4ED] bg-white">
            <span className="text-[#7D90A8]">⌕</span>
            <input type="search" placeholder="Search reports by ID, issue, location, resident..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-transparent outline-none border-none text-[11px] text-[#102544] placeholder:text-[#9CA3AF]" />
          </div>
          <select value={staffFilter} onChange={e => { setStaffFilter(e.target.value); setPage(1); }}
            className="h-[40px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] text-[#344A68] focus:outline-none focus:border-xevera-600 cursor-pointer">
            <option value="all">Staff: All</option>
            {(staffList || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="h-[40px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] text-[#344A68] focus:outline-none focus:border-xevera-600 cursor-pointer">
            <option value="All">Category: All</option>
            {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="h-[40px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] font-bold text-[#344A68] focus:outline-none focus:border-xevera-600 cursor-pointer">
            <option value="All">Status: All</option>
            <option value="Pending">Pending</option>
            <option value="Verified">Verified</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="Rejected">Rejected</option>
          </select>
          <select value={datePreset} onChange={e => { setDatePreset(e.target.value); setPage(1); }}
            className="h-[40px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] text-[#344A68] focus:outline-none focus:border-xevera-600 cursor-pointer">
            <option value="all">Date: All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          <button onClick={resetFilters}
            className="h-[40px] px-3 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] font-bold text-[#52657F] hover:border-xevera-600 hover:text-xevera-600 transition-colors cursor-pointer">↻ Reset</button>
        </div>

        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 border-b border-[#E2E8F0] bg-[#FBFCFE]">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#72839A]">Custom range</span>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(1); }}
              className="h-[36px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] text-[#344A68] focus:outline-none focus:border-xevera-600" />
            <span className="text-[10px] text-[#72839A]">to</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(1); }}
              className="h-[36px] px-2.5 rounded-[8px] border border-[#DCE4ED] bg-white text-[11px] text-[#344A68] focus:outline-none focus:border-xevera-600" />
          </div>
        )}

        {/* Bulk actions — only visible when reports are selected */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 border-b border-[#CFE0FF] bg-[#EEF5FF]">
            <span className="text-[11px] font-extrabold text-[#1769ED]">{selectedIds.size} selected</span>
            {isManager && (
              <>
                <button onClick={openBulkAssign} disabled={bulkBusy}
                  className="h-[32px] px-3.5 rounded-[7px] text-[10px] font-bold bg-xevera-600 text-white hover:bg-xevera-700 transition-colors cursor-pointer disabled:opacity-50">Assign Staff</button>
                <button onClick={() => setBulkStatusOpen(true)} disabled={bulkBusy}
                  className="h-[32px] px-3.5 rounded-[7px] text-[10px] font-bold bg-[#374151] text-white hover:bg-[#1F2937] transition-colors cursor-pointer disabled:opacity-50">Change Status</button>
              </>
            )}
            <button onClick={exportSelected} disabled={exporting || bulkBusy}
              className="h-[32px] px-3.5 rounded-[7px] text-[10px] font-bold border border-[#9BBCF5] bg-white text-[#1769ED] hover:bg-[#F5F9FF] transition-colors cursor-pointer disabled:opacity-50">
              {exporting ? 'Exporting…' : 'Export Selected'}
            </button>
            <button onClick={clearSelection}
              className="h-[32px] px-3 rounded-[7px] text-[10px] font-bold text-[#52657F] hover:text-[#102544] transition-colors cursor-pointer">Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr className="h-[42px] text-left text-[9px] uppercase tracking-[0.6px] text-[#72839A] font-extrabold border-b border-[#E2E8F0] bg-[#FBFCFE]">
                <th className="pl-3.5 pr-1 w-[36px]">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllPage}
                    title="Select all on this page"
                    className="w-[14px] h-[14px] accent-[#1769ED] cursor-pointer" />
                </th>
                <th className="px-3.5">Report ID</th>
                <th className="px-3.5">Issue</th>
                <th className="px-3.5">Category</th>
                <th className="px-3.5">Location</th>
                <th className="px-3.5">Assigned Staff</th>
                <th className="px-3.5">Status</th>
                <th className="px-3.5">Date Assigned</th>
                <th className="px-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!items ? (
                <tr><td colSpan={9} className="py-3 px-3"><SkeletonRows rows={5} height="h-10" /></td></tr>
              ) : error ? (
                <tr><td colSpan={9}><StaffErrorState message="Unable to load reports." onRetry={load} /></td></tr>
              ) : items.length > 0 ? items.map(r => {
                const actions = getReportActions(r, user);
                const rowSelected = selectedIds.has(String(r.id));
                return (
                  <tr key={r.id} className={`border-b border-[#EDF1F5] last:border-b-0 transition-colors ${rowSelected ? 'bg-[#F5F9FF]' : 'hover:bg-[#FBFDFF]'}`}>
                    <td className="pl-3.5 pr-1 py-3.5">
                      <input type="checkbox" checked={rowSelected} onChange={() => toggleSelectRow(String(r.id))}
                        className="w-[14px] h-[14px] accent-[#1769ED] cursor-pointer" />
                    </td>
                    <td className="px-3.5 py-3.5">
                      <button onClick={() => setDrawerReport(r)}
                        className="text-[11px] font-extrabold text-[#1769ED] hover:underline cursor-pointer">{r.id}</button>
                    </td>
                    <td className="px-3.5 py-3.5">
                      <div className="text-[11px] font-extrabold text-[#162D4B] max-w-[220px] truncate">{r.title}</div>
                      <div className="text-[9px] text-[#71819A] max-w-[180px] truncate mt-0.5">{r.description || ''}</div>
                      <div className="text-[9px] text-[#526A87] mt-1">By: {r.reporter || 'Anonymous'}</div>
                    </td>
                    <td className="px-3.5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-[26px] h-[26px] rounded-[7px] bg-[#EAF3FF] text-[#1769ED] grid place-items-center text-[13px]">{CATEGORY_ICON[r.category] || '▣'}</span>
                        <span className="text-[10px] text-[#334A66]">{r.category || '—'}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5 text-[10px] text-[#52657E] max-w-[150px] truncate">{r.location || '—'}</td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-[#162D4B]">{r.assigned && r.assigned !== '-' ? r.assigned : 'Unassigned'}</span>
                      {r.assigned_id ? <span className="block text-[9px] text-[#71819A] mt-0.5">{staffById[r.assigned_id]?.role || 'Staff'}</span> : null}
                    </td>
                    <td className="px-3.5 py-3.5"><StatusPill status={r.status} /></td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-[#334A66]">{r.date}</span>
                      <span className="block text-[9px] text-[#71819A] mt-0.5">by: {r.assigned && r.assigned !== '-' ? r.assigned : '—'}</span>
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <div className="flex gap-1.5 items-center">
                        <button onClick={() => setDrawerReport(r)}
                          className="h-[30px] px-3 rounded-[7px] text-[10px] font-bold border border-[#DBE5F0] bg-white text-[#1769ED] hover:bg-[#EEF5FF] hover:border-[#9BBCF5] transition-colors cursor-pointer">View</button>
                        {actions.map((a) => (
                          <button key={a} onClick={() => runAction(r, a)} disabled={busyId === r.id}
                            className={`h-[30px] px-3 rounded-[7px] text-[10px] font-bold transition-colors hover:translate-y-[-1px] cursor-pointer disabled:opacity-50 ${ACTION_META[a].cls}`}>
                            {ACTION_META[a].label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }              ) : (
                <tr><td colSpan={9}>
                  <StaffEmptyState
                    title="No reports found."
                    description="Try adjusting your filters."
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="min-h-[58px] px-3.5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-[11px] text-[#63758E]">
            Showing {items?.length || 0} of {stats?.total ?? 0} reports
          </span>
          <div className="flex items-center gap-1.5">
            <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="h-[32px] px-2 rounded-[7px] border border-[#DBE4ED] bg-white text-[10px] text-[#344A68] focus:outline-none cursor-pointer">
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      <Modal
        open={rejectTarget !== null}
        title="Reject Report"
        description={`Reject ${rejectTarget?.id || 'this report'}? A rejection reason is required.`}
        confirmLabel="Reject Report"
        cancelLabel="Cancel"
        danger
        confirmDisabled={!rejectReason.trim()}
        onConfirm={submitReject}
        onCancel={() => setRejectTarget(null)}
      >
        <label className="block text-xs font-bold mb-1.5 text-[#111827]">Reason (required)</label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          placeholder="Example: The submitted information is incomplete. Please provide a clearer location and supporting photo."
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF] resize-y"
        />
      </Modal>

      {/* Resolve modal */}
      <Modal
        open={resolveTarget !== null}
        title="Mark Report Resolved"
        description={`Resolve ${resolveTarget?.id || 'this report'}? Describe how it was resolved.`}
        confirmLabel="Mark Resolved"
        cancelLabel="Cancel"
        confirmDisabled={!resolution.trim()}
        onConfirm={submitResolve}
        onCancel={() => setResolveTarget(null)}
      >
        <label className="block text-xs font-bold mb-1.5 text-[#111827]">Resolution details (required)</label>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={4}
          placeholder="Example: The street light was repaired and is now working."
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF] resize-y"
        />
      </Modal>

      {/* Update modal */}
      <Modal
        open={updateTarget !== null}
        title="Add Progress Update"
        description={`Add a work note to ${updateTarget?.id || 'this report'}.`}
        confirmLabel="Add Update"
        cancelLabel="Cancel"
        confirmDisabled={!updateText.trim()}
        onConfirm={submitUpdate}
        onCancel={() => setUpdateTarget(null)}
      >
        <label className="block text-xs font-bold mb-1.5 text-[#111827]">Work note</label>
        <textarea
          value={updateText}
          onChange={(e) => setUpdateText(e.target.value)}
          rows={4}
          placeholder="Example: Inspected the site; parts ordered and expected Friday."
          className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF] resize-y"
        />
      </Modal>

      {/* Bulk change status modal */}
      <Modal
        open={bulkStatusOpen}
        title="Bulk Change Status"
        description={`Choose the new status for ${selectedIds.size} selected report(s). Reports whose current status cannot transition will be skipped.`}
        confirmLabel={bulkBusy ? 'Updating…' : 'Apply Status'}
        cancelLabel="Cancel"
        confirmDisabled={!bulkStatusValue || bulkBusy}
        onConfirm={runBulkStatus}
        onCancel={() => { setBulkStatusOpen(false); setBulkStatusValue(''); }}
      >
        <label className="block text-xs font-bold mb-1.5 text-[#111827]">New status</label>
        <select value={bulkStatusValue} onChange={(e) => setBulkStatusValue(e.target.value)}
          className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
          <option value="">Select a status…</option>
          <option value="Verified">Verified</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
          <option value="Rejected">Rejected</option>
        </select>
        <p className="text-[10px] text-[#71819A] mt-2 leading-relaxed">
          Allowed transitions: Pending → Verified / Rejected · Verified → Assigned / Rejected · Assigned → In Progress · In Progress → Resolved · Resolved → Closed / In Progress · Rejected → Pending.
        </p>
      </Modal>

      {/* Report details drawer */}
      {drawerReport && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[#051326]/20" onClick={() => setDrawerReport(null)} />
          <aside className="absolute top-0 right-0 bottom-0 w-full max-w-[420px] bg-white shadow-[-10px_0_35px_rgba(15,35,65,0.14)] flex flex-col animate-[drawerIn_.28s_ease]">
            <style>{'@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}'}</style>
            <div className="h-[76px] px-6 py-[18px] flex items-start justify-between border-b border-[#E2E8F0] flex-shrink-0">
              <div>
                <div className="text-[19px] font-extrabold text-[#102544] leading-tight">Report Details</div>
                <p className="text-[11px] text-[#71819A] mt-1">View assignment, reporter, and work information.</p>
              </div>
              <button onClick={() => setDrawerReport(null)}
                className="border-0 bg-transparent text-[25px] leading-none text-[#263C57] hover:text-[#1769ED] cursor-pointer">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-8">
              <div className="mb-3.5 flex items-center justify-between">
                <StatusPill status={drawerReport.status} />
              </div>
              <div className="border border-[#E1E8F0] rounded-[10px] p-3.5 mb-3.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1769ED] mb-3.5">Report Summary</div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Report ID</label><strong className="text-[11px] text-[#102544]">{drawerReport.id}</strong></div>
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Issue</label><strong className="text-[11px] text-[#102544]">{drawerReport.title}</strong></div>
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Category</label><strong className="text-[11px] text-[#102544]">{drawerReport.category || '—'}</strong></div>
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Location</label><strong className="text-[11px] text-[#102544]">{drawerReport.location || '—'}</strong></div>
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Reported By</label><strong className="text-[11px] text-[#102544]">{drawerReport.reporter || 'Anonymous'}</strong></div>
                  <div><label className="block text-[9px] text-[#72839A] mb-1">Contact</label><strong className="text-[11px] text-[#102544]">{drawerReport.reporter_phone || drawerReport.reporter_email || '—'}</strong></div>
                  <div className="col-span-2"><label className="block text-[9px] text-[#72839A] mb-1">Description</label><p className="text-[11px] leading-relaxed text-[#536983]">{drawerReport.description || 'No description provided.'}</p></div>
                </div>
              </div>

              <div className="border border-[#E1E8F0] rounded-[10px] p-3.5 mb-3.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1769ED] mb-3.5">Assignment</div>
                <label className="block text-[10px] font-bold text-[#61748F] mb-2">Assigned Staff</label>
                <div className="h-[58px] border border-[#DBE4ED] rounded-[9px] flex items-center px-3 bg-[#FBFCFE]">
                  <div className="w-[34px] h-[34px] rounded-full bg-[#E9F1FF] text-[#1769ED] grid place-items-center text-[10px] font-extrabold">{getInitials(drawerReport.assigned)}</div>
                  <div className="ml-2.5">
                    <div className="text-[11px] font-bold text-[#102544]">{drawerReport.assigned && drawerReport.assigned !== '-' ? drawerReport.assigned : 'Unassigned'}</div>
                    <div className="text-[9px] text-[#71819A] mt-0.5">{drawerStaffRole}</div>
                  </div>
                </div>
                <div className="mt-3.5">
                  <label className="block text-[9px] text-[#72839A] mb-1">Reported / Assigned</label>
                  <strong className="text-[11px] text-[#102544]">{drawerReport.date}</strong>
                </div>
              </div>
              <div className="border border-[#E1E8F0] rounded-[10px] p-3.5 mb-3.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1769ED] mb-3.5">Status History</div>
                {!drawerHistory ? (
                  <div className="text-[10px] text-[#71819A] py-2">Loading history…</div>
                ) : drawerHistory.length === 0 ? (
                  <div className="text-[10px] text-[#71819A] py-2">No status changes recorded yet.</div>
                ) : (
                  <div className="flex flex-col">
                    {drawerHistory.map((h, idx) => {
                      const cfg = getReportStatusConfig(h.new_status);
                      const isLast = idx === drawerHistory.length - 1;
                      return (
                        <div key={h.id ?? idx} className="flex gap-2.5">
                          <div className="flex flex-col items-center pt-1">
                            <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${cfg.dot}`} />
                            {!isLast && <span className="w-[1.5px] flex-1 bg-[#DCE4ED] my-0.5" />}
                          </div>
                          <div className={`pb-${isLast ? '0' : '3'}`}>
                            <div className="text-[11px] font-extrabold text-[#102544]">
                              {h.old_status ? `${h.old_status} → ${h.new_status}` : h.new_status}
                            </div>
                            <div className="text-[9px] text-[#71819A] mt-0.5">
                              {[h.actor || 'System', h.date].filter(Boolean).join(' • ')}
                            </div>
                            {h.note && (
                              <div className="text-[9.5px] text-[#536983] mt-1 bg-[#F7FAFD] border border-[#E4EBF3] rounded-[6px] px-2 py-1.5 leading-relaxed">
                                {h.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-[#E2E8F0] flex-shrink-0 flex flex-col gap-2">
              {drawerActions.length > 0 ? drawerActions.map((a) => (
                <button key={a} onClick={() => { runAction(drawerReport, a); if (a !== 'reject' && a !== 'resolve' && a !== 'update') setDrawerReport(null); }} disabled={busyId === drawerReport.id}
                  className={`h-[42px] rounded-[8px] text-[11px] font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${a === 'assign' ? 'border border-[#DBE4ED] bg-white text-[#52657D] hover:border-xevera-600 hover:text-xevera-600' : ACTION_META[a].cls}`}>
                  {a === 'assign' ? '↻ Assign / Change Staff' : ACTION_META[a].label}
                </button>
              )) : (
                <div className="text-center text-[10px] text-[#71819A] py-2">No actions available for your role.</div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Staff assignee picker */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-5 bg-[#071C35]/40 backdrop-blur-[3px]" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setPickerOpen(false)} />
          <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-hidden bg-white border border-[#E2E8F0] rounded-[16px] shadow-[0_24px_70px_rgba(15,35,65,0.22)] flex flex-col">
            <div className="flex items-start justify-between px-6 py-5 border-b border-[#EDF1F6]">
              <div>
                <div className="text-[17px] font-extrabold text-[#102544]">{pickerMode === 'bulk' ? 'Bulk Assign Reports' : 'Assign Report to Staff'}</div>
                <p className="text-[10px] text-[#71819A] mt-1">
                  {pickerMode === 'bulk'
                    ? `Select a staff member to assign the ${selectedIds.size} selected reports (Pending, Verified, and Assigned only).`
                    : pickerMode === 'start'
                    ? 'Select a staff member to start work on this report.'
                    : `${user?.name || 'You'} is assigning this report. Select a staff member to handle it.`}
                </p>
              </div>
              <button onClick={() => setPickerOpen(false)}
                className="w-[34px] h-[34px] rounded-[9px] bg-[#F5F7FB] text-[20px] leading-none text-[#536983] hover:bg-[#EEF2F6] cursor-pointer">×</button>
            </div>

            <div className="px-6 py-4 overflow-y-auto">
              <div className="flex items-center gap-2.5 p-3 bg-[#F7FAFF] border border-[#DBE8FF] rounded-[10px] mb-3.5">
                <div className="w-[38px] h-[38px] rounded-full bg-[#1769ED] text-white grid place-items-center font-extrabold text-[11px]">{getInitials(pickerReport?.assigned)}</div>
                <div>
                  <div className="text-[11px] font-bold text-[#102544]">{pickerReport?.assigned && pickerReport.assigned !== '-' ? pickerReport.assigned : 'Unassigned'}</div>
                  <small className="block text-[9px] text-[#71819A] mt-0.5">Current assignee of {pickerReport?.id}</small>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 mb-3 border border-[#D8E7FF] bg-[#F5F9FF] rounded-[9px] text-[#1769ED]">
                <span className="font-extrabold text-[13px] leading-none mt-0.5">✓</span>
                <div>
                  <div className="text-[10px] font-bold text-[#102544]">Staff assignment only</div>
                  <small className="block mt-0.5 text-[9px] text-[#71819A]">
                    {pickerMode === 'start'
                      ? 'This will assign the selected staff member and immediately move the report to In Progress.'
                      : 'Only active staff members can be selected to perform the assigned report.'}
                  </small>
                </div>
              </div>

              <input type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                placeholder="Search staff member..."
                className="h-[42px] w-full mb-3 px-3 rounded-[9px] border border-[#DBE4ED] bg-white text-[11px] text-[#102544] focus:outline-none focus:border-[#1769ED] focus:shadow-[0_0_0_3px_rgba(23,105,237,0.08)]" />

              <div className="grid gap-2">
                {filteredAssignees.length > 0 ? filteredAssignees.map((u) => (
                  <button key={u.id} onClick={() => setPickerSelected(u.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-[10px] border transition-colors text-left cursor-pointer ${
                      pickerSelected === u.id ? 'border-[#1769ED] bg-[#EEF5FF]' : 'border-[#E2E8F0] bg-white hover:border-[#1769ED] hover:bg-[#F7FAFF]'
                    }`}>
                    <span className="w-[38px] h-[38px] rounded-full bg-[#E9F1FF] text-[#1769ED] grid place-items-center font-extrabold text-[10px] flex-shrink-0">{getInitials(u.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold text-[#102544]">{u.name}</span>
                      <span className="block text-[9px] text-[#71819A] mt-0.5">{u.role}</span>
                    </span>
                    <span className="text-[8px] font-extrabold px-2 py-1 rounded-full bg-[#EEF5FF] text-[#1769ED]">{u.role.toUpperCase()}</span>
                    <span className={`w-5 h-5 rounded-full grid place-items-center border text-[11px] font-black ${
                      pickerSelected === u.id ? 'bg-[#1769ED] border-[#1769ED] text-white' : 'border-[#DBE4ED] text-transparent'
                    }`}>✓</span>
                  </button>
                )) : (
                  <div className="py-6 text-center text-[11px] text-[#71819A]">No staff member found.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-3.5 border-t border-[#EDF1F6] bg-[#FBFCFE] flex-shrink-0">
              <button onClick={() => setPickerOpen(false)}
                className="h-[40px] px-4 rounded-[9px] text-[10px] font-extrabold bg-white border border-[#DBE4ED] text-[#536983] hover:bg-[#F5F7FB] cursor-pointer">Cancel</button>
              <button onClick={() => pickerSelected && (pickerMode === 'bulk'
                  ? runBulkAssign(pickerSelected)
                  : pickerMode === 'start'
                    ? assignStaff(pickerReport?.id, pickerSelected, 'In Progress')
                    : assignStaff(pickerReport?.id, pickerSelected))} disabled={!pickerSelected || busyId === pickerReport?.id || bulkBusy}
                className="h-[40px] px-4 rounded-[9px] text-[10px] font-extrabold bg-[#1769ED] border border-[#1769ED] text-white hover:bg-[#0D4FC5] transition-colors cursor-pointer disabled:opacity-50">
                {pickerMode === 'bulk'
                  ? (bulkBusy ? 'Assigning…' : `Assign ${selectedIds.size} Reports`)
                  : pickerMode === 'start' ? 'Assign & Start Work' : 'Assign to Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}