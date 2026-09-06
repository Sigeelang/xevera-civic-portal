import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffErrorState } from '../../components/staff/StaffStates';

const ROLES = [
  { key: 'Super Admin', label: 'Super Admin', description: 'Full system access', icon: '♛', colorClass: 'bg-[#7136d4]' },
  { key: 'Admin', label: 'Admin', description: 'Manage reports and users', icon: '♜', colorClass: 'bg-[#1594e9]' },
  { key: 'Staff', label: 'Staff', description: 'Process and update reports', icon: '♙', colorClass: 'bg-[#27a45c]' },
  { key: 'Resident', label: 'Resident', description: 'Submit and track reports', icon: '●', colorClass: 'bg-[#ef9b22]' },
];

const roleSlug = (key) => key.toLowerCase().replace(/\s+/g, '_');

function Toggle({ enabled, onChange, disabled = false, busy = false }) {
  return (
    <label className={`relative inline-flex items-center ${disabled || busy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={!!enabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled || busy}
        className="sr-only peer"
      />
      <span className="w-[33px] h-[18px] bg-[#aeb8ca] rounded-full peer peer-checked:bg-[#16a35b] transition-colors duration-200 after:content-[''] after:absolute after:w-[14px] after:h-[14px] after:left-[2px] after:top-[2px] after:bg-white after:rounded-full after:transition-transform after:duration-200 peer-checked:after:translate-x-[15px]" />
    </label>
  );
}

function RoleAvatar({ role, size = 32 }) {
  return (
    <div className={`${role.colorClass} text-white flex items-center justify-center font-extrabold text-[13px]`} style={{ width: size, height: size, borderRadius: '50%' }}>
      {role.icon}
    </div>
  );
}

export default function SystemTwoFactorControlSection() {
  const showToast = useToast();
  const [settings, setSettings] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSettings, setEditSettings] = useState({});

  const load = useCallback(async () => {
    setError(false);
    try {
      const [settingsRes, countsRes] = await Promise.all([
        apiFetch('settings/get.php'),
        apiFetch('users/counts.php').catch(() => ({ counts: {} })),
      ]);

      const twofaEnabled = settingsRes.twofa_enabled === '1' || settingsRes.twofa_enabled === 'true';
      let twofaRoles = [];
      try {
        const parsed = JSON.parse(settingsRes.twofa_roles || '[]');
        if (Array.isArray(parsed)) twofaRoles = parsed;
      } catch {
        twofaRoles = [];
      }

      const roleSettings = {};
      ROLES.forEach((role) => {
        const slug = roleSlug(role.key);
        roleSettings[role.key] = {
          require2fa: twofaRoles.includes(role.key),
          emailOtp: settingsRes[`2fa_email_otp_${slug}`] !== '0',
        };
      });

      setSettings({
        enabled: twofaEnabled,
        roles: roleSettings,
      });
      setCounts(countsRes?.counts || {});
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function buildPayload(s) {
    const enabledRoles = ROLES.filter((r) => s.roles[r.key]?.require2fa).map((r) => r.key);
    const payload = {
      twofa_enabled: s.enabled ? '1' : '0',
      twofa_roles: JSON.stringify(enabledRoles),
    };
    ROLES.forEach((role) => {
      payload[`2fa_email_otp_${roleSlug(role.key)}`] = s.roles[role.key]?.emailOtp ? '1' : '0';
    });
    return payload;
  }

  async function persist(newSettings, key) {
    if (key) setBusyKey(key);
    setSaving(true);
    try {
      const payload = buildPayload(newSettings);
      await apiFetch('settings/save.php', { method: 'POST', body: { settings: payload } });
      setSettings(newSettings);
    } catch (err) {
      showToast(err.message || 'Failed to save 2FA setting.', 'error');
      throw err;
    } finally {
      setSaving(false);
      if (key) setBusyKey(null);
    }
  }

  async function handleMasterToggle(enabled) {
    if (!settings) return;
    const next = { ...settings, enabled };
    if (!enabled) {
      const nextRoles = { ...settings.roles };
      ROLES.forEach((r) => { nextRoles[r.key] = { ...nextRoles[r.key], require2fa: false }; });
      next.roles = nextRoles;
    }
    try {
      await persist(next, 'master');
      showToast(enabled ? '2FA enabled system-wide.' : '2FA disabled system-wide.');
    } catch {}
  }

  async function handleRoleToggle(roleKey, enabled) {
    if (!settings) return;
    if (!settings.enabled && enabled) {
      showToast('Enable the 2FA system first.', 'error');
      return;
    }
    const nextRoles = { ...settings.roles, [roleKey]: { ...settings.roles[roleKey], require2fa: enabled } };
    try {
      await persist({ ...settings, roles: nextRoles }, `role:${roleKey}`);
      showToast(`${roleKey} ${enabled ? 'requires' : 'no longer requires'} 2FA.`);
    } catch {}
  }

  async function handleMethodToggle(roleKey, enabled) {
    if (!settings) return;
    const nextRoles = { ...settings.roles, [roleKey]: { ...settings.roles[roleKey], emailOtp: enabled } };
    try {
      await persist({ ...settings, roles: nextRoles }, `method:${roleKey}`);
      showToast(`Email OTP ${enabled ? 'enabled' : 'disabled'} for ${roleKey}.`);
    } catch {}
  }

  function openEditModal(roleKey) {
    setEditingRole(roleKey);
    setEditSettings({ ...settings.roles[roleKey] });
    setEditModalOpen(true);
  }

  async function saveEditSettings() {
    if (!editingRole) return;
    const newSettings = {
      ...settings,
      roles: { ...settings.roles, [editingRole]: { ...editSettings } },
    };
    try {
      await persist(newSettings, `edit:${editingRole}`);
      setEditModalOpen(false);
      setEditingRole(null);
      showToast('2FA settings updated.');
    } catch {}
  }

  if (error) return <StaffErrorState message="Unable to load two-factor settings." onRetry={load} />;

  const editingRoleData = ROLES.find((r) => r.key === editingRole);
  const masterEnabled = !!settings?.enabled;
  const anyRoleRequiring = settings ? ROLES.some((r) => settings.roles[r.key]?.require2fa) : false;

  return (
    <div id="two-factor" className="space-y-5">
      <div className={`flex items-center gap-3 border rounded-lg p-3 min-w-0 w-full flex-wrap ${masterEnabled && anyRoleRequiring ? 'border-[#cfe9d7] bg-[#f4fbf6]' : 'border-[#f3d98a] bg-[#fff9e8]'}`}>
        <div className={`w-[34px] h-[38px] text-white flex items-center justify-center font-black flex-shrink-0 ${masterEnabled && anyRoleRequiring ? 'bg-[#2da55a]' : 'bg-[#d8a200]'}`} style={{ clipPath: 'polygon(50% 0, 92% 18%, 86% 68%, 50% 100%, 14% 68%, 8% 18%)' }}>
          {masterEnabled && anyRoleRequiring ? '✓' : '!'}
        </div>
        <div className="flex-1">
          <strong className="text-[12px] text-[#07133a]">2FA Policy Status</strong>
          <span className="block text-[10px] text-[#34435e] mt-[3px]">
            {masterEnabled
              ? (anyRoleRequiring
                  ? 'Email OTP verification is active for the selected roles.'
                  : '2FA is enabled but no role is currently required to use it.')
              : '2FA is disabled system-wide. Users will not be asked for a verification code.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#34435e]">System 2FA</span>
          <Toggle enabled={masterEnabled} onChange={handleMasterToggle} busy={busyKey === 'master'} />
        </div>
      </div>

      <div className="border border-[#e0e6f0] rounded-[10px] bg-white shadow-[0_2px_7px_rgba(20,43,80,.025)] p-[18px_20px]">
        <h2 className="text-[16px] font-bold text-[#07133a] mb-3.5">Role-Based 2FA Configuration</h2>

        {!settings ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse border border-[#e0e6f0] rounded-lg overflow-hidden text-[11px]">
              <thead>
                <tr>
                  <th className="bg-[#fbfcfe] text-[#12234c] text-[10px] font-semibold px-3 py-3 border-r border-b border-[#e4e8f0] text-left">ROLE</th>
                  <th className="bg-[#fbfcfe] text-[#12234c] text-[10px] font-semibold px-3 py-3 border-r border-b border-[#e4e8f0] text-center">USERS</th>
                  <th className="bg-[#fbfcfe] text-[#12234c] text-[10px] font-semibold px-3 py-3 border-r border-b border-[#e4e8f0] text-center">REQUIRE 2FA<small className="block font-normal mt-1 text-[#64718a]">Force verification</small></th>
                  <th className="bg-[#fbfcfe] text-[#12234c] text-[10px] font-semibold px-3 py-3 border-r border-b border-[#e4e8f0] text-center">EMAIL OTP<small className="block font-normal mt-1 text-[#64718a]">Method</small></th>
                  <th className="bg-[#fbfcfe] text-[#12234c] text-[10px] font-semibold px-3 py-3 border-b border-[#e4e8f0] text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => {
                  const roleSettings = settings.roles[role.key] || { require2fa: false, emailOtp: true };
                  const requireBusy = busyKey === `role:${role.key}`;
                  const methodBusy = busyKey === `method:${role.key}`;
                  return (
                    <tr key={role.key} className="hover:bg-[#f9fafb] transition-colors">
                      <td className="px-3 py-3 border-r border-b border-[#e4e8f0]">
                        <div className="flex items-center gap-2.5 text-left">
                          <RoleAvatar role={role} />
                          <div className="role-name">
                            <strong className="text-[11px] text-[#07133a] block">{role.label}</strong>
                            <small className="text-[9px] text-[#61708b] block mt-[2px]">{role.description}</small>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-r border-b border-[#e4e8f0] text-center">
                        <strong className="text-[11px]">{counts[role.key] ?? 0}</strong>
                      </td>
                      <td className="px-3 py-3 border-r border-b border-[#e4e8f0] text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Toggle
                            enabled={roleSettings.require2fa}
                            onChange={(v) => handleRoleToggle(role.key, v)}
                            disabled={!masterEnabled}
                            busy={requireBusy}
                          />
                          <span className={`text-[11px] ${roleSettings.require2fa ? 'text-[#168341] font-bold' : 'text-[#65718a]'}`}>
                            {roleSettings.require2fa ? 'Required' : 'Optional'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-r border-b border-[#e4e8f0] text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Toggle
                            enabled={roleSettings.emailOtp}
                            onChange={(v) => handleMethodToggle(role.key, v)}
                            busy={methodBusy}
                          />
                          <span className="text-[11px]">{roleSettings.emailOtp ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 border-b border-[#e4e8f0] text-center">
                        <button
                          onClick={() => openEditModal(role.key)}
                          className="border border-[#2b69f0] bg-white text-[#075ae9] rounded-[6px] px-4 py-[7px] text-[10px] cursor-pointer hover:bg-[#f1f6ff] transition-colors"
                        >
                          ✎ &nbsp;Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2.5 px-2.5 py-2 border border-[#dce8fb] bg-[#f5f8ff] text-[#075ae9] rounded-[7px] text-[10px]">
          ⓘ Toggling "Require 2FA" controls whether the role is prompted for a verification code on login. Email OTP is the available verification method. Changes apply to all users of the affected role on their next login.
        </div>
      </div>

      {editModalOpen && editingRoleData && (
        <div className="fixed inset-0 bg-[rgba(4,16,38,.55)] backdrop-blur-[3px] flex items-center justify-center p-5 z-[1000]" onClick={(e) => { if (e.target === e.currentTarget) { setEditModalOpen(false); setEditingRole(null); } }}>
          <div className="w-full max-w-[900px] max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-[0_25px_70px_rgba(0,0,0,.25)]">
            <div className="px-6 py-5 border-b border-[#e7ebf2] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-full bg-[#eee5ff] text-[#7136d4] flex items-center justify-center text-[19px]">🔐</div>
                <div>
                  <h2 className="text-[19px] font-bold text-[#07133a]">Edit 2FA Settings</h2>
                  <p className="text-[10px] text-[#66738b] mt-1">Configure two-factor authentication settings for this role.</p>
                </div>
              </div>
              <button onClick={() => { setEditModalOpen(false); setEditingRole(null); }} className="w-8 h-8 border-0 bg-[#f2f4f8] rounded-[6px] cursor-pointer text-lg text-[#52617a] hover:bg-[#e8ebef]">×</button>
            </div>

            <div className="mx-6 mt-5 border border-[#e0e6f0] rounded-[9px] p-4 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center text-xl ${editingRoleData.colorClass}`}>{editingRoleData.icon}</div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#07133a]">
                  {editingRoleData.label}
                  <span className="ml-1.5 px-1.5 py-[3px] bg-[#efe8ff] text-[#6733cf] rounded-[5px] text-[9px] font-semibold">{editingRoleData.description}</span>
                </h3>
                <p className="text-[10px] text-[#64718a] mt-1">Manage two-factor authentication for users with this role.</p>
              </div>
            </div>

            <div className="px-6 pt-5 pb-5 space-y-3.5">
              <section className="border border-[#e0e6f0] rounded-[9px] p-[18px]">
                <div className="flex gap-[11px] items-start">
                  <div className="w-[35px] h-[35px] rounded-full bg-[#f0e8ff] text-[#6935d2] flex items-center justify-center flex-shrink-0">🛡</div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#07133a]">Require 2FA for this role</h3>
                    <p className="text-[10px] text-[#63708a] mt-1 leading-relaxed">When enabled, users of this role must complete an OTP check on login. Requires the 2FA system to be enabled.</p>
                  </div>
                </div>

                <div className="mt-4 py-3 border-t border-b border-[#edf0f5] flex items-center text-[11px]">
                  <strong className="text-[#07133a]">Require 2FA</strong>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Toggle
                      enabled={editSettings.require2fa}
                      onChange={(v) => setEditSettings((prev) => ({ ...prev, require2fa: v }))}
                      disabled={!masterEnabled}
                    />
                    <span className="text-[11px] font-medium">{editSettings.require2fa ? 'Required' : 'Optional'}</span>
                  </div>
                </div>
              </section>

              <section className="border border-[#e0e6f0] rounded-[9px] p-[18px]">
                <div className="flex gap-[11px] items-start">
                  <div className="w-[35px] h-[35px] rounded-full bg-[#f0e8ff] text-[#6935d2] flex items-center justify-center flex-shrink-0">✉</div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#07133a]">Email OTP Verification</h3>
                    <p className="text-[10px] text-[#63708a] mt-1 leading-relaxed">The verification method. A 6-digit code is sent to the user's registered email.</p>
                  </div>
                </div>

                <div className="mt-4 py-3 border-t border-b border-[#edf0f5] flex items-center text-[11px]">
                  <strong className="text-[#07133a]">Enable Email OTP</strong>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Toggle
                      enabled={editSettings.emailOtp}
                      onChange={(v) => setEditSettings((prev) => ({ ...prev, emailOtp: v }))}
                    />
                    <span className="text-[11px] font-medium">{editSettings.emailOtp ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                <div className="mt-3.5">
                  <div className="text-[11px] font-bold text-[#07133a]">Delivery Method</div>
                  <div className="text-[10px] text-[#69758a] mt-1 mb-3.5">Select how the one-time password will be delivered.</div>
                  <div className="flex gap-6">
                    <label className="flex gap-[7px] items-start w-1/2 text-[10px] cursor-pointer">
                      <input type="radio" name="otpDelivery" value="email" defaultChecked={editSettings.emailOtp} className="accent-[#1765ee] mt-[2px]" />
                      <span>
                        <strong className="block text-[#07133a]">Email</strong>
                        <small className="block text-[#64718a] mt-1 leading-relaxed">Send OTP to the user's registered email address.</small>
                      </span>
                    </label>
                    <label className="flex gap-[7px] items-start w-1/2 text-[10px] cursor-not-allowed opacity-60">
                      <input type="radio" name="otpDelivery" value="backup_email" disabled className="accent-[#1765ee] mt-[2px]" />
                      <span>
                        <strong className="block text-[#07133a]">Backup Email</strong>
                        <small className="block text-[#64718a] mt-1 leading-relaxed">Coming soon. Will send OTP to a secondary email when available.</small>
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="border border-[#e0e6f0] rounded-[9px] p-[18px] bg-[#fbfcfe]">
                <h3 className="text-[14px] font-bold text-[#07133a] mb-3">Role 2FA Summary</h3>

                <div className="bg-white border border-[#e1e7ef] rounded-[8px] p-3 mb-2.5 flex gap-2.5">
                  <div className="w-[35px] h-[35px] rounded-full bg-[#f0e8ff] text-[#6935d2] flex items-center justify-center flex-shrink-0">🛡</div>
                  <div className="flex-1">
                    <strong className="text-[10px] text-[#07133a]">
                      Require 2FA
                      <span className={`ml-1.5 px-[5px] py-[3px] rounded-[5px] text-[8px] font-bold ${editSettings.require2fa ? 'bg-[#dff4e5] text-[#168341]' : 'bg-[#eef1f5] text-[#65718a]'}`}>
                        {editSettings.require2fa ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </strong>
                    <p className="text-[9px] text-[#65728a] mt-2 leading-[1.7]">Forces a verification step on every login for users of this role.</p>
                  </div>
                </div>

                <div className="bg-white border border-[#e1e7ef] rounded-[8px] p-3 mb-2.5 flex gap-2.5">
                  <div className="w-[35px] h-[35px] rounded-full bg-[#f0e8ff] text-[#6935d2] flex items-center justify-center flex-shrink-0">✉</div>
                  <div className="flex-1">
                    <strong className="text-[10px] text-[#07133a]">
                      Email OTP
                      <span className={`ml-1.5 px-[5px] py-[3px] rounded-[5px] text-[8px] font-bold ${editSettings.emailOtp ? 'bg-[#dff4e5] text-[#168341]' : 'bg-[#eef1f5] text-[#65718a]'}`}>
                        {editSettings.emailOtp ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </strong>
                    <p className="text-[9px] text-[#65728a] mt-2 leading-[1.7]">Method used to deliver the verification code.</p>
                  </div>
                </div>

                <div className="bg-[#fff9e8] border border-[#f3d98a] rounded-[7px] p-3 text-[#6c5315] text-[9px] leading-relaxed mt-3">
                  <strong className="text-[11px]">⚠ Important Note</strong>
                  <br /><br />
                  Changes made here will apply to all users under the selected role. Users will follow the new policy on their next login.
                </div>
              </section>
            </div>

            <div className="px-6 py-3.5 border-t border-[#e7ebf2] flex gap-3">
              <button onClick={() => { setEditModalOpen(false); setEditingRole(null); }} className="flex-1 h-[38px] rounded-[7px] cursor-pointer text-[11px] bg-white border border-[#d9e0eb] text-[#075eea] hover:bg-[#f5f7fa]">Cancel</button>
              <button onClick={saveEditSettings} disabled={saving} className="flex-1 h-[38px] rounded-[7px] cursor-pointer text-[11px] bg-[#075cf4] border-0 text-white hover:bg-[#004fd8] disabled:opacity-60">💾 &nbsp;Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
