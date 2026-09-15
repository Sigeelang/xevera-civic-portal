import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import StaffPageHeader from '../../components/StaffPageHeader';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

/*
 * Super Admin Security Center.
 * One page, five sections driven by the route (#/security/<section>).
 *
 * All data comes from real backend tables:
 *   - login_history  (written by auth/login.php on successful sign-in)
 *   - activity_logs  ('login_failed' rows on failed attempts)
 *   - users          (account counts / status)
 *
 * HONEST LIMITATIONS surfaced in the UI:
 *   - Active Sessions is VIEW-ONLY. Authentication uses stateless
 *     signed tokens, so remote token revocation is not supported yet.
 */

const SECTIONS = [
  { key: 'overview', label: 'Security Overview', icon: 'shield' },
];

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon, tint, value, label }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4">
      <span className={`w-9 h-9 rounded-[10px] grid place-items-center mb-2 ${tint}`}><Icon name={icon} size={17} /></span>
      <strong className="block text-[22px] font-extrabold text-[#111827]">{value}</strong>
      <span className="text-[11px] text-[#64748B]">{label}</span>
    </div>
  );
}

function OverviewSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    apiFetch('security/overview.php').then(setData).catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <StaffErrorState message="Unable to load security overview." onRetry={load} />;
  if (!data) return <SkeletonRows rows={4} height="h-20" />;

  const { accounts, stats, recent_events } = data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="users" tint="bg-xevera-50 text-xevera-600" value={accounts.total} label="Total Accounts" />
        <StatCard icon="check" tint="bg-success-bg text-success-dark" value={accounts.active} label="Active Accounts" />
        <StatCard icon="lock" tint="bg-[#FFF5E4] text-[#B45309]" value={accounts.inactive} label="Inactive Accounts" />
        <StatCard icon="clock" tint="bg-[#EEF5FF] text-[#1769ED]" value={stats.logins_7d} label="Users signed in (7 days)" />
        <StatCard icon="clock" tint="bg-[#F1EBFF] text-[#7C3AED]" value={stats.logins_30d} label="Users signed in (30 days)" />
        <StatCard icon="alerttriangle" tint="bg-[#FFF0F0] text-[#E53935]" value={stats.failed_logins_7d} label="Failed logins (7 days)" />
        <StatCard icon="alerttriangle" tint="bg-[#FFF0F0] text-[#DC2626]" value={stats.failed_logins_total} label="Failed logins (all time)" />
        <StatCard icon="shield" tint="bg-[#F3EDFF] text-[#7C3AED]" value={accounts.super_admins} label="Active Super Admins" />
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5">
        <h3 className="text-[15px] font-extrabold text-[#111827] mb-3">Recent security-related events</h3>
        {recent_events.length === 0 ? (
          <StaffEmptyState title="No security events yet." description="Logins and failures will appear here." />
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {recent_events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 py-2.5">
                <span className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${
                  e.action === 'login_failed' ? 'bg-[#FFF0F0] text-[#E53935]' : 'bg-[#F1F5F9] text-[#64748B]'
                }`}>
                  <Icon name={e.action === 'login_failed' ? 'alerttriangle' : 'check'} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-[#111827]">{e.user_name || e.detail || e.action}</div>
                  <div className="text-[11px] text-[#64748B] truncate">{e.action.replace(/_/g, ' • ')}{e.ip ? ` • ${e.ip}` : ''}</div>
                </div>
                <time className="text-[10px] text-[#94A3B8] whitespace-nowrap">{fmtDateTime(e.created_at)}</time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoginActivitySection({ viewOnlySessions }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
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
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Group by user+device to approximate "active devices".
  const sessions = [];
  const seen = new Set();
  for (const row of items) {
    const key = `${row.user_id}|${row.browser}|${row.os}|${row.device}`;
    if (!seen.has(key)) {
      seen.add(key);
      sessions.push(row);
    }
  }

  return (
    <div className="space-y-4">
      {viewOnlySessions && (
        <div className="flex items-start gap-3 p-3.5 rounded-[12px] bg-[#FFF9EC] border border-[#F5DEB8]">
          <Icon name="alert" size={17} />
          <p className="text-[11px] text-[#7A5A16] leading-relaxed">
            <b>View only.</b> Xevera uses stateless signed tokens for authentication, so sessions cannot be
            remotely terminated from here yet. This list shows each account&apos;s most recent known device sign-ins.
          </p>
        </div>
      )}

      <div className="flex gap-2.5 items-center flex-wrap">
        <input type="search" placeholder="Search user, email or IP..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]" />
        {total > 0 && <span className="text-[11px] text-[#8B98AA] whitespace-nowrap">{total} record{total === 1 ? '' : 's'}</span>}
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5 overflow-x-auto">
        {loading ? (
          <SkeletonRows rows={6} height="h-12" />
        ) : error ? (
          <StaffErrorState message="Unable to load login history." onRetry={load} />
        ) : items.length === 0 ? (
          <StaffEmptyState title="No login records yet." description="Successful sign-ins are recorded here." />
        ) : (
          <table className="w-full border-collapse text-sm min-w-[640px]">
            <thead>
              <tr>
                {(viewOnlySessions ? ['User', 'Device', 'IP Address', 'Last Sign-in'] : ['User', 'Role', 'Browser', 'Device', 'IP Address', 'Date & Time'])
                  .map((h) => <th key={h} className="text-left text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB] whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(viewOnlySessions ? sessions : items).map((r) => (
                <tr key={r.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-3 py-3 border-b border-[#F1F5F9]">
                    <div className="text-[#374151] font-semibold">{r.user_name || 'Unknown'}</div>
                    <div className="text-[11px] text-[#94A3B8]">{r.user_username || r.email || ''}</div>
                  </td>
                  {!viewOnlySessions && <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.user_role || '—'}</td>}
                  {!viewOnlySessions && <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.browser || '—'}</td>}
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151] whitespace-nowrap">{r.device || '—'}{!viewOnlySessions && r.os ? ` (${r.os})` : ''}</td>
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{r.ip || '—'}</td>
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#64748B] whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && !viewOnlySessions && (
          <div className="flex items-center justify-between mt-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">← Previous</button>
            <span className="text-[11px] text-[#8B98AA]">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-bold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function EventsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const d = await apiFetch('activity/list.php?action=login_failed&limit=50');
      setItems(d.items || []);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3.5 rounded-[12px] bg-[#F0F6FF] border border-[#D5E4FF]">
        <Icon name="alert" size={17} />
        <p className="text-[11px] text-[#536B93] leading-relaxed">
          Failed sign-in attempts are recorded in the audit trail every time a wrong password is used.
          Repeated failures from unknown IPs may indicate probing — consider suspending affected accounts.
        </p>
      </div>

      <div className="bg-white rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-5 overflow-x-auto">
        {loading ? (
          <SkeletonRows rows={6} height="h-12" />
        ) : error ? (
          <StaffErrorState message="Unable to load security events." onRetry={load} />
        ) : items.length === 0 ? (
          <StaffEmptyState title="No failed logins recorded." description="That is good news — no suspicious attempts so far." />
        ) : (
          <table className="w-full border-collapse text-sm min-w-[560px]">
            <thead>
              <tr>
                {['Detail', 'IP Address', 'Date & Time'].map((h) => (
                  <th key={h} className="text-left text-[11px] uppercase tracking-wider text-[#9CA3AF] font-bold px-3 py-2.5 border-b border-[#E5E7EB]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{e.detail || e.action}</td>
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#374151]">{e.ip_address || '—'}</td>
                  <td className="px-3 py-3 border-b border-[#F1F5F9] text-[#64748B] whitespace-nowrap">{fmtDateTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function SecurityPage({ section = 'overview', onNavigate }) {
  const current = SECTIONS.some((s) => s.key === section) ? section : 'overview';

  const title = SECTIONS.find((s) => s.key === current)?.label || 'Security';

  const descriptions = {
    overview: 'A live snapshot of account health and authentication activity.',
  };

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="System"
        title="Security"
        description={descriptions[current]}
      />

      {/* Section tabs */}
      {onNavigate && (
        <div className="flex gap-1.5 flex-wrap bg-white border border-[#E5E7EB] rounded-[14px] p-1.5">
          {SECTIONS.map((s) => (
            <button key={s.key}
              onClick={() => onNavigate(`security/${s.key}`)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[12px] font-bold transition-colors cursor-pointer ${
                current === s.key ? 'bg-xevera-600 text-white shadow-[0_4px_12px_rgba(18,100,232,0.25)]' : 'text-[#58677E] hover:bg-[#F0F4FA] hover:text-xevera-600'
              }`}>
              <Icon name={s.icon} size={14} />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {current === 'overview' && <OverviewSection />}
    </div>
  );
}
