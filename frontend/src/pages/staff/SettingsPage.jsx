import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import StaffPageHeader from '../../components/StaffPageHeader';
import { useTheme } from '../../context/ThemeContext';
import { SkeletonRows } from '../../components/dashboard/Skeleton';

const card = 'bg-[#FFFFFF] rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(20,40,70,0.03)] p-4 sm:p-[18px]';

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-[31px] h-[19px] rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-xevera-600' : 'bg-[#CBD3DF]'}`}>
      <span className={`absolute top-[2px] w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${checked ? 'left-[14px]' : 'left-[2px]'}`} />
    </button>
  );
}

export default function SettingsPage({ onNavigate }) {
  const showToast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';
  const { setTheme } = useTheme();
  const [tab, setTab] = useState('notifications');
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPrefs = useCallback(() => {
    apiFetch('profile/prefs.php')
      .then(d => setPrefs(d.prefs || {}))
      .catch(() => setPrefs({}));
  }, []);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  async function savePrefs() {
    setSaving(true);
    try {
      await apiFetch('profile/prefs.php', { method: 'POST', body: { prefs } });
      const t = prefs.theme || 'light';
      if (t === 'dark' || t === 'light') setTheme(t);
      showToast('Settings saved successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function resetPrefs() {
    setPrefs({
      language: 'English',
      theme: 'light',
      notify_report_updates: true,
      notify_tasks: true,
      notify_messages: true,
      notify_announcements: true,
      notify_email: true,
      notify_browser: false,
      compact_mode: false,
      sidebar_collapsed: false,
      timezone: 'Asia/Manila (GMT+8)',
      date_format: 'MM/DD/YYYY',
      time_format: '12-hour (AM/PM)',
    });
    setTheme('light');
    showToast('Settings restored to default.');
  }

  function selectTab(key, label) {
    setTab(key);
    showToast(label + ' settings selected.');
  }

  function selectTheme(t) {
    setPrefs(p => ({ ...p, theme: t }));
    showToast(t === 'dark' ? 'Dark theme selected.' : (t === 'system' ? 'System theme selected.' : 'Light theme selected.'));
  }

  if (!prefs) {
    return (
      <div className="space-y-5 max-w-6xl">
        <StaffPageHeader eyebrow="Account" title="Settings" description="Manage your preferences." />
        <div className={card}><SkeletonRows rows={6} height="h-10" /></div>
      </div>
    );
  }

  const notifications = [
    { key: 'notify_report_updates', label: 'Report Updates', desc: 'Get notified when reports are created or updated.', icon: '▧' },
    { key: 'notify_tasks', label: 'Task Notifications', desc: 'Get notified about task assignments and updates.', icon: '▣' },
    { key: 'notify_messages', label: 'Message Notifications', desc: 'Get notified when you receive new messages.', icon: '▱' },
    { key: 'notify_announcements', label: 'Announcements', desc: 'Get notified about system announcements.', icon: '♢' },
    { key: 'notify_email', label: 'Email Notifications', desc: 'Receive notifications via email.', icon: '✉' },
    { key: 'notify_browser', label: 'Browser Notifications', desc: 'Show notifications on this browser.', icon: '▣' },
  ];

  const appearanceRows = [
    { key: 'compact_mode', label: 'Compact Mode', desc: 'Reduce spacing for a more compact view.' },
    { key: 'sidebar_collapsed', label: 'Sidebar Collapsed', desc: 'Collapse sidebar by default.' },
  ];

  const tabs = [
    { key: 'personal', label: '♙  Personal' },
    { key: 'notifications', label: '♧  Notifications' },
    { key: 'appearance', label: '◉  Appearance' },
    { key: 'security', label: '♢  Security' },
    { key: 'system', label: '⚙  System' },
  ];

  return (
    <div className="max-w-6xl space-y-5">
      <StaffPageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your personal preferences, notifications, security, and system options."
      />

      {/* TABS */}
      <div className="flex gap-5 sm:gap-7 border-b border-[#E1E7EF] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => selectTab(t.key, t.label.replace(/\s/g, ''))}
            className={`pb-3 pt-2 min-h-[44px] text-xs font-bold relative cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.key ? 'text-xevera-600' : 'text-[#596A80] hover:text-xevera-700'}`}>
            {t.label}
            {tab === t.key && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-xevera-600" />}
          </button>
        ))}
      </div>

      {/* TOP GRID: NOTIFICATIONS + APPEARANCE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {/* NOTIFICATIONS */}
        <div className={card}>
          <div className="text-[13px] font-extrabold text-[#17263D]">Notifications</div>
          <div className="text-[9px] text-[#8491A4] mt-1">Choose what you want to be notified about.</div>
          <div className="mt-3">
            {notifications.map(n => (
              <div key={n.key} className="min-h-[47px] border-b border-[#EDF1F5] last:border-b-0 flex items-center gap-2.5 py-2">
                <span className="w-[29px] h-[29px] rounded-[8px] bg-[#EDF4FF] text-xevera-600 grid place-items-center text-[11px] flex-shrink-0">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <strong className="block text-[11px] text-[#24364D]">{n.label}</strong>
                  <span className="block text-[9px] text-[#8996A8] mt-0.5">{n.desc}</span>
                </div>
                <Switch checked={!!prefs[n.key]} onChange={v => setPrefs({ ...prefs, [n.key]: v })} label={n.label} />
              </div>
            ))}
          </div>
        </div>

        {/* APPEARANCE */}
        <div className={card}>
          <div className="text-[13px] font-extrabold text-[#17263D]">Appearance</div>
          <div className="text-[9px] text-[#8491A4] mt-1">Customize how Xevera looks and feels.</div>

          <div className="text-[11px] font-bold text-[#24364D] mt-4 mb-2">Theme</div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { key: 'light', icon: '☼', label: 'Light' },
              { key: 'dark', icon: '☾', label: 'Dark' },
              { key: 'system', icon: '▣', label: 'System' },
            ].map(t => (
              <button key={t.key} onClick={() => selectTheme(t.key)}
                className={`relative h-[84px] rounded-[9px] border flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${(prefs.theme || 'light') === t.key ? 'border-xevera-600 bg-[#FAFDFF]' : 'border-[#E1E7EF] hover:border-[#A9C6F7]'}`}>
                {(prefs.theme || 'light') === t.key && <span className="absolute -right-px -top-px w-4 h-4 rounded-full bg-xevera-600 text-white grid place-items-center text-[8px]">✓</span>}
                <span className="text-[21px]">{t.icon}</span>
                <strong className="text-[11px] text-[#24364D]">{t.label}</strong>
              </button>
            ))}
          </div>

          <div className="mt-3.5">
            {appearanceRows.map(r => (
              <div key={r.key} className="min-h-[48px] border-t border-[#EDF1F5] flex items-center justify-between gap-3 py-2.5">
                <div>
                  <strong className="block text-[11px] text-[#24364D]">{r.label}</strong>
                  <span className="block text-[9px] text-[#8996A8] mt-0.5">{r.desc}</span>
                </div>
                <Switch checked={!!prefs[r.key]} onChange={v => setPrefs({ ...prefs, [r.key]: v })} label={r.label} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LANGUAGE & REGION */}
      <div className={card}>
        <div className="text-[13px] font-extrabold text-[#17263D]">Language & Region</div>
        <div className="text-[9px] text-[#8491A4] mt-1">Set your preferred language and regional formats.</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mt-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-[#65758A] mb-1.5">Language</span>
            <select value={prefs.language || 'English'} onChange={e => setPrefs({ ...prefs, language: e.target.value })} className="w-full h-[34px] px-2.5 border border-[#D8E1EB] rounded-[6px] bg-white text-[11px] text-[#24364D] focus:border-xevera-600 focus:outline-none cursor-pointer">
              <option>English</option>
              <option>Filipino</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-[#65758A] mb-1.5">Time Zone</span>
            <select value={prefs.timezone || 'Asia/Manila (GMT+8)'} onChange={e => setPrefs({ ...prefs, timezone: e.target.value })} className="w-full h-[34px] px-2.5 border border-[#D8E1EB] rounded-[6px] bg-white text-[11px] text-[#24364D] focus:border-xevera-600 focus:outline-none cursor-pointer">
              <option>Asia/Manila (GMT+8)</option>
              <option>Asia/Singapore (GMT+8)</option>
              <option>UTC</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-[#65758A] mb-1.5">Date Format</span>
            <select value={prefs.date_format || 'MM/DD/YYYY'} onChange={e => setPrefs({ ...prefs, date_format: e.target.value })} className="w-full h-[34px] px-2.5 border border-[#D8E1EB] rounded-[6px] bg-white text-[11px] text-[#24364D] focus:border-xevera-600 focus:outline-none cursor-pointer">
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-[#65758A] mb-1.5">Time Format</span>
            <select value={prefs.time_format || '12-hour (AM/PM)'} onChange={e => setPrefs({ ...prefs, time_format: e.target.value })} className="w-full h-[34px] px-2.5 border border-[#D8E1EB] rounded-[6px] bg-white text-[11px] text-[#24364D] focus:border-xevera-600 focus:outline-none cursor-pointer">
              <option>12-hour (AM/PM)</option>
              <option>24-hour</option>
            </select>
          </label>
        </div>
      </div>

      {/* SECURITY */}
      <div className={card}>
        <div className="text-[13px] font-extrabold text-[#17263D]">Security</div>
        <div className="text-[9px] text-[#8491A4] mt-1">Account authentication is managed by XEVERA. Security status and history live in the Security Center.</div>
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_1fr_auto] items-center gap-x-5 gap-y-4 mt-4">
          <div className="flex items-center gap-2.5">
            <span className="w-[43px] h-[43px] rounded-full bg-[#E8F8EE] text-[#19A35B] grid place-items-center text-[17px] flex-shrink-0">♢</span>
            <div>
              <strong className="block text-[11px] text-[#24364D]">Two-Factor Authentication</strong>
              <span className="block text-[9px] text-[#8491A4] mt-0.5">OTP verification via email is handled by the platform.</span>
            </div>
          </div>
          <div className="md:border-l md:border-[#EDF1F5] md:pl-5">
            <span className="block text-[9px] text-[#8996A8] mb-1">Status</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-[#F3F4F6] text-[#6B7280] text-[9px] font-bold">Managed centrally</span>
          </div>
          <div className="md:border-l md:border-[#EDF1F5] md:pl-5">
            <span className="block text-[9px] text-[#8996A8] mb-1">Last Password Change</span>
            <strong className="text-[11px] text-[#24364D]">—</strong>
          </div>
          {isSuperAdmin && onNavigate ? (
            <button onClick={() => onNavigate('security/two-factor')} className="h-[34px] px-4 rounded-[6px] border border-[#A9C8FB] bg-white text-xevera-600 text-[11px] font-bold hover:bg-[#F2F7FF] transition-colors cursor-pointer md:w-auto w-full">
              Open Security
            </button>
          ) : (
            <span className="text-[10px] text-[#8B98AA]">Contact your administrator for changes.</span>
          )}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-end gap-2.5">
        <button onClick={resetPrefs} className="h-[36px] px-5 rounded-[7px] border border-[#E1E7EF] bg-white text-[11px] font-bold text-[#53647A] hover:bg-[#F8FAFC] transition-colors cursor-pointer">Reset</button>
        <button onClick={savePrefs} disabled={saving} className="h-[36px] px-5 rounded-[7px] bg-xevera-600 text-white text-[11px] font-bold hover:bg-xevera-700 disabled:opacity-50 transition-colors cursor-pointer">
          {saving ? 'Saving...' : '▣  Save Changes'}
        </button>
      </div>
    </div>
  );
}