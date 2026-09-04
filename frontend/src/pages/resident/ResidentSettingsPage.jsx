import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';

const SECTIONS = [
  { key: 'general',       label: 'General' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'privacy',       label: 'Privacy' },
  { key: 'display',       label: 'Display' },
];

const NOTIF_PREFERENCES = [
  { key: 'email_enabled', label: 'Email Notifications', desc: 'Get important updates by email', default: true },
  { key: 'notify_status', label: 'Report Status Updates', desc: 'Alerts when your report status changes', default: true },
  { key: 'notify_comments', label: 'Comments on your reports', desc: 'When staff or other residents comment', default: true },
];

const DISPLAY_PREFERENCES = [
  { key: 'compact_view', label: 'Compact view', desc: 'Show more reports per row' },
  { key: 'show_resolved', label: 'Show resolved reports', desc: 'Include resolved reports in lists' },
  { key: 'auto_refresh', label: 'Auto-refresh data', desc: 'Automatically refresh every 60 seconds' },
];

const PRIVACY_PREFERENCES = [
  { key: 'public_profile', label: 'Public profile', desc: 'Show your name on your reports' },
  { key: 'share_location', label: 'Share location', desc: 'Allow precise location on reports' },
  { key: 'analytics', label: 'Anonymous analytics', desc: 'Help improve the portal with anonymous data' },
];

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center px-0.5 flex-shrink-0 ${on ? 'bg-xevera-600' : 'bg-[#D1D5DB]'}`}
    >
      <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Inner({ onNavigate }) {
  const toast = useToast();
  const [tab, setTab] = useState('general');
  const [prefs, setPrefs] = useState({});
  const [display, setDisplay] = useState({});
  const [privacy, setPrivacy] = useState({});
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('Asia/Manila');

  useEffect(() => {
    apiFetch('notifications/prefs-get.php').then(setPrefs).catch(() => setPrefs({}));
    try {
      setDisplay(JSON.parse(localStorage.getItem('xevera.resident.displayPrefs') || '{}'));
      setPrivacy(JSON.parse(localStorage.getItem('xevera.resident.privacyPrefs') || '{}'));
      const ui = JSON.parse(localStorage.getItem('xevera.resident.ui') || '{}');
      if (ui.language) setLanguage(ui.language);
      if (ui.timezone) setTimezone(ui.timezone);
    } catch {}
  }, []);

  async function toggleNotif(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await apiFetch('notifications/prefs-save.php', { method: 'POST', body: next });
      toast('Preference saved.');
    } catch (e) {
      setPrefs(prefs);
      toast(e.message || 'Could not save preference.', 'error');
    }
  }

  function toggleDisplay(key) {
    const next = { ...display, [key]: !display[key] };
    setDisplay(next);
    try { localStorage.setItem('xevera.resident.displayPrefs', JSON.stringify(next)); } catch {}
  }
  function togglePrivacy(key) {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    try { localStorage.setItem('xevera.resident.privacyPrefs', JSON.stringify(next)); } catch {}
  }

  function saveUi() {
    try {
      localStorage.setItem('xevera.resident.ui', JSON.stringify({ language, timezone }));
      toast('Settings saved.');
    } catch (e) {
      toast('Could not save settings.', 'error');
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#DFE6EF] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="flex border-b border-[#E5E7EB] bg-[#F8FAFC]">
          {SECTIONS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              className={`flex-1 px-4 py-3 text-[13px] font-bold transition-colors cursor-pointer bg-transparent border-b-2 ${
                tab === s.key
                  ? 'text-xevera-700 border-xevera-600 bg-white'
                  : 'text-[#6B7280] border-transparent hover:text-navy-950 hover:bg-white/60'
              } ${i === 0 ? 'rounded-tl-2xl' : ''} ${i === SECTIONS.length - 1 ? 'rounded-tr-2xl' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-2.5">
          {tab === 'general' && (
            <>
              <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#F1F2F5]">
                <div>
                  <div className="text-[13px] font-bold text-navy-950">Language</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">Choose your preferred language</div>
                </div>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="px-3 py-2 border border-[#DFE6EF] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                  <option>English</option>
                  <option>Filipino</option>
                  <option>Cebuano</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#F1F2F5]">
                <div>
                  <div className="text-[13px] font-bold text-navy-950">Time Zone</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">Used for displaying dates and times</div>
                </div>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="px-3 py-2 border border-[#DFE6EF] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600">
                  <option value="Asia/Manila">Asia/Manila (PHT)</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
              <button onClick={saveUi} className="mt-2 w-full px-4 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
                Save General Settings
              </button>
            </>
          )}

          {tab === 'notifications' && NOTIF_PREFERENCES.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#F1F2F5]">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-navy-950">{p.label}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{p.desc}</div>
              </div>
              <Toggle on={!!prefs[p.key]} onChange={() => toggleNotif(p.key)} />
            </div>
          ))}

          {tab === 'privacy' && PRIVACY_PREFERENCES.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#F1F2F5]">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-navy-950">{p.label}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{p.desc}</div>
              </div>
              <Toggle on={!!privacy[p.key]} onChange={() => togglePrivacy(p.key)} />
            </div>
          ))}

          {tab === 'display' && DISPLAY_PREFERENCES.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#F1F2F5]">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-navy-950">{p.label}</div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{p.desc}</div>
              </div>
              <Toggle on={!!display[p.key]} onChange={() => toggleDisplay(p.key)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4 bg-white rounded-2xl border border-[#DFE6EF] mt-5">
        <div className="flex items-center gap-2.5">
          <Icon name="shield" size={16} className="text-xevera-600" />
          <span className="text-[13px] font-bold text-navy-950">Privacy & Data</span>
        </div>
        <p className="text-[12px] text-[#6B7280] leading-relaxed">
          Your notification preferences are saved to the portal. Display and privacy toggles are kept on this device.
          You can review data usage anytime from the Privacy tab.
        </p>
      </div>
    </>
  );
}

export default function ResidentSettingsPage({ onNavigate }) {
  return (
    <ResidentLayout activePage="settings" pageTitle="Settings" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Settings"
        subtitle="Manage your portal preferences and notifications."
      />
      <Inner onNavigate={onNavigate} />
    </ResidentLayout>
  );
}