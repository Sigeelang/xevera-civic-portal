import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StaffPageHeader from '../../components/StaffPageHeader';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ActivityLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [browser, setBrowser] = useState('');
  const [device, setDevice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedRole, setAppliedRole] = useState('');
  const [appliedBrowser, setAppliedBrowser] = useState('');
  const [appliedDevice, setAppliedDevice] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
      if (appliedRole) params.set('role', appliedRole);
      if (appliedBrowser) params.set('browser', appliedBrowser);
      if (appliedDevice) params.set('device', appliedDevice);
      if (appliedFrom) params.set('from', appliedFrom);
      if (appliedTo) params.set('to', appliedTo);
      const d = await apiFetch('security/login_activity.php?' + params.toString());
      setItems(d.items || []);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, appliedRole, appliedBrowser, appliedDevice, appliedFrom, appliedTo]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() {
    setAppliedSearch(search);
    setAppliedRole(role);
    setAppliedBrowser(browser);
    setAppliedDevice(device);
    setAppliedFrom(from);
    setAppliedTo(to);
    setPage(1);
  }

  function resetFilters() {
    setSearch(''); setRole(''); setBrowser(''); setDevice(''); setFrom(''); setTo('');
    setAppliedSearch(''); setAppliedRole(''); setAppliedBrowser(''); setAppliedDevice(''); setAppliedFrom(''); setAppliedTo('');
    setPage(1);
  }

  function handleSearchKey(e) {
    if (e.key === 'Enter') applyFilters();
  }

  const dateLabel = appliedFrom || appliedTo
    ? `${fmtDateShort(appliedFrom || '2020-01-01')} - ${fmtDateShort(appliedTo || new Date().toISOString().slice(0, 10))}`
    : '';

  const ROLE_OPTIONS = ['', 'Resident', 'Staff', 'Admin', 'Super Admin'];
  const BROWSER_OPTIONS = ['', 'Chrome Windows', 'Edge Windows', 'Firefox Windows', 'Safari'];
  const DEVICE_OPTIONS = ['', 'Desktop', 'Laptop', 'Mobile', 'Tablet'];

  const start = total > 0 ? ((page - 1) * 20) + 1 : 0;
  const end = Math.min(page * 20, total);

  return (
    <>
      <StaffPageHeader
        eyebrow="Audit Logs"
        title="User Activity"
        description="Successful sign-ins recorded by the portal."
        className="mb-5"
      />

      {/* Date range display */}
      <div className="flex justify-end mb-3">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-white border border-[#DBE4EF] text-[13px] text-[#253C5C]">
          <Icon name="calendar" size={16} />
          <span>{dateLabel || 'All dates'}</span>
        </div>
      </div>

      {/* Filter card */}
      <div className="bg-white rounded-[10px] border border-[#E0E8F1] shadow-[0_2px_7px_rgba(34,65,100,.04)] p-5 mb-5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] bg-[#F8FAFC] border border-[#E0E7F0] mb-4">
          <Icon name="search" size={18} />
          <input type="text" placeholder="Search user, email or IP..." value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKey}
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#273D5C]" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[13px] font-semibold text-[#243B5A] mb-1.5">Role</label>
            <div className="relative">
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 border border-[#D3DEEA] rounded-[8px] bg-white px-3 text-[13px] text-[#213956] outline-none appearance-none cursor-pointer">
                {ROLE_OPTIONS.map((v) => <option key={v} value={v}>{v || 'All Roles'}</option>)}
              </select>
              <span className="absolute right-3 top-2.5 pointer-events-none text-[#6B7280] text-xs">⌄</span>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#243B5A] mb-1.5">Browser</label>
            <div className="relative">
              <select value={browser} onChange={(e) => setBrowser(e.target.value)}
                className="w-full h-10 border border-[#D3DEEA] rounded-[8px] bg-white px-3 text-[13px] text-[#213956] outline-none appearance-none cursor-pointer">
                {BROWSER_OPTIONS.map((v) => <option key={v} value={v}>{v || 'All Browsers'}</option>)}
              </select>
              <span className="absolute right-3 top-2.5 pointer-events-none text-[#6B7280] text-xs">⌄</span>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#243B5A] mb-1.5">Device</label>
            <div className="relative">
              <select value={device} onChange={(e) => setDevice(e.target.value)}
                className="w-full h-10 border border-[#D3DEEA] rounded-[8px] bg-white px-3 text-[13px] text-[#213956] outline-none appearance-none cursor-pointer">
                {DEVICE_OPTIONS.map((v) => <option key={v} value={v}>{v || 'All Devices'}</option>)}
              </select>
              <span className="absolute right-3 top-2.5 pointer-events-none text-[#6B7280] text-xs">⌄</span>
            </div>
          </div>

          <div className="col-span-2 md:col-span-3 xl:col-span-2">
            <label className="block text-[13px] font-semibold text-[#243B5A] mb-1.5">Date Range</label>
            <div className="flex gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="flex-1 h-10 border border-[#D3DEEA] rounded-[8px] bg-white px-3 text-[13px] text-[#213956] outline-none" />
              <span className="flex items-center text-[13px] text-[#9CA3AF]">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="flex-1 h-10 border border-[#D3DEEA] rounded-[8px] bg-white px-3 text-[13px] text-[#213956] outline-none" />
            </div>
          </div>

          <div className="col-span-2 md:col-span-3 xl:col-span-5 flex gap-2">
            <button onClick={applyFilters}
              className="h-10 px-5 rounded-[8px] bg-[#1172E3] text-white text-[13px] font-semibold border border-[#1172E3] shadow-[0_2px_5px_rgba(17,114,227,.2)] cursor-pointer hover:bg-[#0E5FCA] transition-colors">
              Apply
            </button>
            <button onClick={resetFilters}
              className="h-10 px-5 rounded-[8px] bg-white text-[#263D5B] text-[13px] font-semibold border border-[#BAC9DA] cursor-pointer hover:bg-[#F3F4F6] transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-[#E1E8F0] shadow-[0_2px_8px_rgba(32,58,90,.035)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead className="bg-[#F4F7FB]">
              <tr>
                {['USER', 'ROLE', 'BROWSER', 'DEVICE', 'IP ADDRESS', 'DATE & TIME'].map((h) => (
                  <th key={h} className="h-[51px] text-left px-[14px] first:pl-[26px] text-[12px] font-bold text-[#72849C] tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-5"><SkeletonRows rows={6} height="h-12" /></td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="p-5"><StaffErrorState message="Unable to load activity logs." onRetry={load} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="p-5"><StaffEmptyState title="No activity records found." /></td></tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="border-t border-[#E8EDF3] hover:bg-[#F9FAFB]">
                    <td className="h-[58px] px-[14px] first:pl-[26px]">
                      <span className="block font-bold text-[#132C4D]">{r.user_name || 'Unknown'}</span>
                      <span className="block text-[12px] text-[#3B5270]">{r.user_username || ''}</span>
                    </td>
                    <td className="h-[58px] px-[14px] text-[13px] text-[#1F3858] font-medium">{r.user_role || '—'}</td>
                    <td className="h-[58px] px-[14px] text-[13px] text-[#1F3858]">{r.browser || '—'}</td>
                    <td className="h-[58px] px-[14px] text-[13px] text-[#1F3858] whitespace-nowrap">{r.device || '—'}{r.os ? ` (${r.os})` : ''}</td>
                    <td className="h-[58px] px-[14px] text-[13px] text-[#1F3858]">{r.ip || '—'}</td>
                    <td className="h-[58px] px-[14px] text-[13px] text-[#243C5D] whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="min-h-[63px] flex items-center justify-between px-4 border-t border-[#E8EDF3]">
          <span className="text-[13px] text-[#435A78]">
            {total > 0 ? `Showing ${start} - ${end} of ${total} records` : 'Showing 0 records'}
          </span>
          <div className="flex gap-1.5 items-center py-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="w-[31px] h-[31px] rounded-[7px] border border-[#DBE3EC] bg-white text-[18px] text-[#233D5E] cursor-pointer hover:bg-[#F1F6FC] disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-[31px] h-[31px] rounded-[7px] border text-[13px] cursor-pointer ${n === page ? 'bg-[#1174E5] text-white border-[#1174E5]' : 'bg-white text-[#233D5E] border-[#DBE3EC] hover:bg-[#F1F6FC]'}`}>{n}</button>
            ))}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="w-[31px] h-[31px] rounded-[7px] border border-[#DBE3EC] bg-white text-[18px] text-[#233D5E] cursor-pointer hover:bg-[#F1F6FC] disabled:opacity-40 disabled:cursor-not-allowed">›</button>
          </div>
        </div>
      </div>
    </>
  );
}
