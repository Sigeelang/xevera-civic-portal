import { useState, useEffect } from 'react';
import { apiFetch } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import StaffPageHeader from '../../../components/StaffPageHeader';
import { SkeletonRows } from '../../../components/dashboard/Skeleton';
import { StaffEmptyState } from '../../../components/staff/StaffStates';
import AdminDashboard from './AdminDashboard';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso.replace(' ', 'T'))) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const card = 'bg-[#FFFFFF] rounded-[18px] border border-[#E5E7EB] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] p-5 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(16,24,40,0.10)]';

export default function SuperAdminDashboard({ onNavigate }) {
  const { user } = useAuth();
  const { maintenanceMode, registrationEnabled } = useSettings();
  const [users, setUsers] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches = [
      apiFetch('users/list.php').then(setUsers).catch(() => setUsers([])),
      apiFetch('activity/list.php?limit=6').then(setActivity).catch(() => setActivity({ items: [], total: 0 })),
    ];
    Promise.all(fetches).finally(() => setLoading(false));
  }, []);

  // Count accounts by role using the real status field only.
  const byRole = {};
  let residents = 0, staff = 0, admins = 0, superAdmins = 0;
  (users || []).forEach((u) => {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
    if (u.role === 'Resident') residents++;
    else if (u.role === 'Staff') staff++;
    else if (u.role === 'Admin') admins++;
    else if (u.role === 'Super Admin') superAdmins++;
  });
  const roles = Object.keys(byRole);
  const activeUsers = (users || []).filter((u) => u.status === 'Active').length;

  const quickLink = (label, page) => (
    <button onClick={() => onNavigate(page)}
      className="flex-1 px-3 py-2.5 rounded-xl bg-xevera-50 border border-xevera-100 text-xs font-bold text-xevera-700 hover:bg-xevera-100 transition-all duration-300 cursor-pointer">
      {label}
    </button>
  );

  return (
    <>
      <AdminDashboard
        onNavigate={onNavigate}
        eyebrow="Super Admin"
        title="Super Admin Dashboard"
        description={`Welcome back, ${user?.name || 'Admin User'}`}
        activityReady={!loading}
        activityData={activity}
      />

      <div className="space-y-5 mt-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-5">
            <div className={card}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-head font-extrabold">Portal Settings</h4>
                <button onClick={() => onNavigate('system-settings/general')}
                  className="bg-transparent border-none text-[11px] font-bold text-xevera-600 hover:text-xevera-700 cursor-pointer">
                  Manage →
                </button>
              </div>
              <div className="flex flex-col gap-2.5 text-xs mb-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#6B7280]">Maintenance Mode</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${maintenanceMode ? 'bg-[#FFF5E4] text-[#B45309]' : 'bg-success-bg text-success-dark'}`}>
                    {maintenanceMode ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#6B7280]">Registration</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${registrationEnabled ? 'bg-success-bg text-success-dark' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                    {registrationEnabled ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className={card}>
              <h4 className="text-sm font-head font-extrabold mb-3">Users by Role</h4>
              {loading ? (
                <SkeletonRows rows={3} height="h-14" />
              ) : roles.length === 0 ? (
                <StaffEmptyState title="No users found." />
              ) : (
                <div className="flex gap-2.5 flex-wrap">
                  {roles.map((r) => (
                    <div key={r} className="flex-1 min-w-[90px] bg-[#F5F7FA] rounded-xl px-3 py-2.5 text-center border border-[#E5E7EB]">
                      <div className="font-head text-lg font-extrabold">{byRole[r]}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">{r}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {quickLink('Users', 'users/all')}
                {quickLink('System Settings', 'system-settings/general')}
                {quickLink('Security', 'security/overview')}
              </div>
            </div>

            <div className={card + ' flex-1'}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-head font-extrabold">Latest Activity</h4>
                {activity && <span className="text-xs font-bold text-[#6B7280]">{activity.total} total</span>}
              </div>
              {loading ? (
                <SkeletonRows rows={5} height="h-10" />
              ) : (activity?.items || []).length === 0 ? (
                <StaffEmptyState title="No activity recorded yet." />
              ) : (
                (activity.items || []).map((a) => (
                  <div className="py-2.5 border-t border-[#E5E7EB] first:border-t-0" key={a.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-[#111827]">{a.user_name || 'System'}</span>
                        <span className="text-xs text-[#6B7280]"> · {a.action}</span>
                      </div>
                      <span className="text-xs text-[#9CA3AF] whitespace-nowrap flex-shrink-0">{timeAgo(a.created_at)}</span>
                    </div>
                    {a.detail && <div className="text-xs text-[#6B7280] mt-0.5 truncate">{a.detail}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}