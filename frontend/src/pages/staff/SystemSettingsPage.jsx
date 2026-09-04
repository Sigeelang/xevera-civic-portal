import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import Icon from '../../components/Icon';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import Modal from '../../components/Modal';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import EmailOtpSection from './SystemEmailOtpSection';
// Login 2FA policy UI (SystemTwoFactorControlSection) was retired because
// normal login no longer requires OTP for any role. The component file is
// kept in the repository for reference; it is not rendered anywhere.
// See: backend/api/auth/login_common.php (xevera_twofa_policy() defaults
// twofa_roles to []) and frontend/src/pages/auth/LoginPage.jsx (OTP bypass).


/*
 * Super Admin System Settings.
 * One page, five sections driven by the route (#/system-settings/<section>).
 *
 * - General: edits real keys in system_settings via settings/save.php (SA-only).
 * - Notifications: interactive documentation hub for the EXISTING per-account
 *   notification systems. There are NO global toggles here by design —
 *   preferences belong to each user account.
 * - Email / OTP: live SMTP status + real connection test / test email
 *   (settings/test_smtp.php) + OTP table status + setup guide.
 *   Credentials never leave the server.
 * - Categories: manages the existing `categories` JSON key that the report
 *   submission flow already reads. No new tables.
 * - Statuses: read-only visualization of the hardcoded workflow used by
 *   ~15 endpoints. Editing it would break reports/analytics/assignment.
 */

const SECTIONS = [
  { key: 'general', label: 'General Settings', icon: 'gear' },
  { key: 'notifications', label: 'Notification Settings', icon: 'bell' },
  { key: 'email-otp', label: 'Email / OTP Settings', icon: 'letter' },
  { key: 'categories', label: 'Report Categories', icon: 'tag' },
  { key: 'statuses', label: 'Status Configuration', icon: 'checklist' },
];

const inputCls = 'w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]';

/* ============================================================
   GENERAL SETTINGS
============================================================ */

function GeneralSection({ refreshKey = 0 }) {
  const showToast = useToast();
  const [values, setValues] = useState(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const d = await apiFetch('settings/get.php');
      setValues({
        site_name: d.site_name || '',
        contact_email: d.contact_email || '',
        contact_phone: d.contact_phone || '',
        barangay_address: d.barangay_address || '',
        hero_title: d.hero_title || '',
        hero_subtitle: d.hero_subtitle || '',
        registration_enabled: String(d.registration_enabled ?? '1'),
      });
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function save(e) {
    e.preventDefault();
    if (!values.site_name.trim() || !values.contact_email.trim()) {
      showToast('Please complete the required fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('settings/save.php', { method: 'POST', body: { settings: values } });
      setUpdated(new Date());
      showToast('System settings saved successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (error) return <StaffErrorState message="Unable to load settings." onRetry={load} />;

  const FIELDS = [
    ['◎', 'Site Name', 'The name of your portal shown to users.',
      <input key="sn" type="text" value={values?.site_name || ''} placeholder="Xevera Portal" required
        onChange={(e) => setValues((v) => ({ ...v, site_name: e.target.value }))} className={inputCls} />],
    ['✉', 'Contact Email', 'Main email used for official communications.',
      <input key="ce" type="email" value={values?.contact_email || ''} placeholder="civicdesk@xevera.gov.ph" required
        onChange={(e) => setValues((v) => ({ ...v, contact_email: e.target.value }))} className={inputCls} />],
    ['☎', 'Contact Phone', 'Primary contact number.',
      <input key="cp" type="tel" value={values?.contact_phone || ''} placeholder="(02) 8123-4567"
        onChange={(e) => setValues((v) => ({ ...v, contact_phone: e.target.value }))} className={inputCls} />],
    ['⌖', 'Barangay Address', 'Main address of your barangay.',
      <input key="ad" type="text" value={values?.barangay_address || ''} placeholder="Barangay Hall, San Isidro, Xevera"
        onChange={(e) => setValues((v) => ({ ...v, barangay_address: e.target.value }))} className={inputCls} />],
    ['T', 'Homepage Headline', 'Main headline displayed on the homepage.',
      <input key="ht" type="text" value={values?.hero_title || ''} placeholder="Building a Better Xevera Together"
        onChange={(e) => setValues((v) => ({ ...v, hero_title: e.target.value }))} className={inputCls} />],
    ['≡', 'Homepage Subtitle', 'Short description shown under the headline.',
      <textarea key="hs" value={values?.hero_subtitle || ''} placeholder="Report environmental and civic issues in your community..."
        onChange={(e) => setValues((v) => ({ ...v, hero_subtitle: e.target.value }))}
        className={inputCls + ' min-h-[62px] py-[11px] resize-y leading-relaxed'} />],
    ['♙+', 'Public Registration', 'Controls the existing registration gate.',
      <select key="rg" value={values?.registration_enabled ?? '1'}
        onChange={(e) => setValues((v) => ({ ...v, registration_enabled: e.target.value }))} className={inputCls}>
        <option value="1">Open — residents may self-register</option>
        <option value="0">Closed — registration is disabled</option>
      </select>],
  ];

  return (
    <form onSubmit={save} className="w-full">
      <section className="bg-white rounded-[15px] border border-[#E0E6EE] shadow-[0_3px_12px_rgba(20,33,58,0.045)] overflow-hidden">
        <div className="min-h-[90px] flex items-center gap-4 px-[34px] max-sm:px-[18px] py-5 border-b border-[#E7EBF1]">
          <span className="w-[49px] h-[49px] flex-shrink-0 grid place-items-center rounded-[13px] bg-[#EAF2FF] text-[#1264E8] text-2xl">♙</span>
          <div>
            <h2 className="text-base font-extrabold text-[#14213A]">General Information</h2>
            <p className="mt-1 text-xs text-[#65758D]">Update the basic information about your portal.</p>
          </div>
        </div>

        <div className="px-[34px] pb-6 max-sm:px-[18px]">
          {!values ? (
            <div className="py-8"><SkeletonRows rows={6} height="h-16" /></div>
          ) : FIELDS.map(([icon, title, desc, control]) => (
            <div key={title} className="min-h-[80px] grid grid-cols-1 md:grid-cols-[44%_56%] items-center border-b border-[#EDF0F4] py-4 md:py-0">
              <div className="flex items-center gap-4 md:pr-6">
                <span className="w-[49px] h-[49px] flex-shrink-0 grid place-items-center rounded-[12px] bg-[#EDF4FF] text-[#1264E8] text-xl">{icon}</span>
                <div>
                  <div className="text-[13px] font-bold text-[#243450]">{title}</div>
                  <div className="mt-1 text-[11px] text-[#6C7B91] leading-snug">{desc}</div>
                </div>
              </div>
              <div className="md:pl-5 mt-3 md:mt-0">{control}</div>
            </div>
          ))}

          {values && (
            <>
              <div className="mt-4 min-h-[46px] px-[13px] flex items-center gap-2.5 rounded-[8px] bg-[#F3F7FF] border border-[#CFE0FB] text-[11px] text-[#5C6F89]">
                <span className="w-[18px] h-[18px] flex-shrink-0 grid place-items-center rounded-full bg-xevera-600 text-white text-[10px] font-extrabold">i</span>
                Controls the existing registration gate used by auth/register.php.
              </div>

              <div className="flex items-center justify-between pt-[18px]">
                {updated
                  ? <span className="text-[11px] text-[#52627A]">Last updated: {updated.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  : <span />}
                <button type="submit" disabled={saving}
                  className={`h-[46px] px-5 inline-flex items-center gap-2 rounded-[10px] border-none bg-[#1264E8] text-white text-[13px] font-extrabold shadow-[0_5px_14px_rgba(18,100,232,0.2)] transition-all hover:bg-[#0757D5] hover:-translate-y-px active:translate-y-0 disabled:opacity-70 cursor-pointer ${saving ? 'pointer-events-none' : ''}`}>
                  ▣ {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </form>
  );
}

/* ============================================================
   NOTIFICATION SETTINGS — interactive documentation hub for
   the existing per-account notification systems. There are NO
   global toggles here by design: preferences belong to each
   user account (residents: notifications/prefs-*.php,
   staff: profile/prefs.php) and no second backend is created.
============================================================ */

const NOTIF_RESIDENT_TYPES = [
  { name: 'Email Notifications', icon: '✉', tint: 'bg-[#EAF2FF] text-[#1769F5]',
    description: 'Control general email notifications sent to the resident account.',
    rows: [['General portal emails', 'Receive important account and portal messages.', true], ['Security alerts', 'Receive security-related account alerts by email.', true], ['Service notices', 'Receive important service and maintenance notices.', true]],
    note: 'Email preferences apply to the registered resident email address.' },
  { name: 'Report Updates', icon: '▤', tint: 'bg-[#EAF2FF] text-[#1769F5]',
    description: 'Choose which report activity should generate resident notifications.',
    rows: [['Status changes', 'Notify me when my report changes status.', true], ['Assignment updates', 'Notify me when my report is assigned to staff.', true], ['Resolution updates', 'Notify me when my report is marked resolved.', true], ['Closure updates', 'Notify me when my report is closed.', true]],
    note: 'Report notifications are tied to reports submitted by the resident.' },
  { name: 'Comments & Replies', icon: '◯', tint: 'bg-[#F1EDFF] text-[#7554E8]',
    description: 'Manage alerts for conversations attached to resident reports.',
    rows: [['New comments', 'Notify me when staff add a comment to my report.', true], ['Replies', 'Notify me when someone replies to a comment.', true], ['Mentions', 'Notify me when I am mentioned in a report conversation.', true]],
    note: 'Comments and replies help residents stay informed without repeatedly checking a report.' },
  { name: 'Announcements', icon: '📣', tint: 'bg-[#EAF9F1] text-[#15955B]',
    description: 'Choose whether important community announcements appear as notifications.',
    rows: [['Community announcements', 'Receive important community-wide announcements.', true], ['Maintenance advisories', 'Receive scheduled maintenance and service advisories.', true], ['Emergency notices', 'Receive urgent notices published by authorized staff.', true]],
    note: 'Announcement delivery still depends on the publisher selecting Send Notification.' },
  { name: 'Digest & Summary', icon: '◷', tint: 'bg-[#FFF6DF] text-[#D98A00]', optional: true,
    description: 'Optional daily or weekly summaries of portal activity.',
    rows: [['Digest email', 'Receive a summary of recent report and notification activity.', false]],
    note: 'Digest & Summary is optional and configured per resident account.' },
];

const NOTIF_STAFF_TYPES = [
  { name: 'Email Notifications', icon: '✉', tint: 'bg-[#F1EDFF] text-[#7554E8]',
    description: 'Control important email notifications for staff and administrators.',
    rows: [['General staff emails', 'Receive important portal and account messages.', true], ['Security alerts', 'Receive security and account activity alerts.', true], ['Service notices', 'Receive important system service notices.', true]],
    note: 'These settings belong to the individual staff account.' },
  { name: 'Task & Assignment Alerts', icon: '✓', tint: 'bg-[#EAF9F1] text-[#15955B]',
    description: 'Stay informed when reports and tasks require staff action.',
    rows: [['New assignments', 'Notify me when a report or task is assigned to me.', true], ['Reassignments', 'Notify me when an assigned report is reassigned.', true], ['Due-date reminders', 'Notify me when assigned work needs attention.', true], ['Resolution requests', 'Notify me when a report requires resolution action.', true]],
    note: 'Assignment alerts help staff respond to work without continuously checking the dashboard.' },
  { name: 'System Updates', icon: '▤', tint: 'bg-[#EEF5FF] text-[#1264E8]',
    description: 'Manage notifications related to system and account changes.',
    rows: [['System notices', 'Receive important portal system notices.', true], ['Account changes', 'Receive alerts for changes to your staff account.', true], ['Maintenance notices', 'Receive scheduled maintenance notifications.', true]],
    note: 'Critical security and account alerts follow the existing system rules.' },
  { name: 'Comments & Mentions', icon: '◯', tint: 'bg-[#F1EDFF] text-[#7554E8]',
    description: 'Receive alerts when staff conversations require your attention.',
    rows: [['Comments', 'Notify me when a report receives a new comment.', true], ['Replies', 'Notify me when someone replies to my comment.', true], ['Mentions', 'Notify me when another staff member mentions me.', true]],
    note: 'Comments and mentions are associated with reports and staff conversations.' },
  { name: 'Announcements', icon: '📣', tint: 'bg-[#FFF6DF] text-[#D98A00]', optional: true,
    description: 'Receive important announcements relevant to staff and administrators.',
    rows: [['Portal announcements', 'Receive important internal portal announcements.', true], ['System advisories', 'Receive system-wide advisories and notices.', true], ['Community updates', 'Receive selected community announcements.', false]],
    note: 'Optional announcement notifications can be changed from each staff account.' },
];

function DisplayToggle({ on, optional }) {
  return (
    <span className="flex items-center gap-2.5 flex-shrink-0">
      <span className={`text-[11px] font-extrabold ${optional ? 'text-[#D98A00]' : on ? 'text-[#15955B]' : 'text-[#8B98AA]'}`}>{optional ? 'Optional' : on ? 'Enabled' : 'Off'}</span>
      <span aria-hidden className={`relative w-12 h-[27px] rounded-full pointer-events-none ${on ? 'bg-[#15955B]' : 'bg-[#CBD5E1]'} ${optional ? 'opacity-60' : ''}`}>
        <span className={`absolute top-[3px] w-[21px] h-[21px] rounded-full bg-white shadow transition-all ${on ? 'left-[24px]' : 'left-[3px]'}`} />
      </span>
    </span>
  );
}

function NotifPanel({ data, onClose, kindLabel }) {
  const enabledCount = data.rows.filter((r) => r[2]).length;
  const total = data.rows.length;

  return (
    <section className="mt-5 rounded-[14px] border border-[#DCE5F2] bg-white overflow-hidden">
      <div className="p-[22px] border-b border-[#DCE5F2]" style={{ background: 'linear-gradient(100deg,#F8FBFF,#FFFFFF)' }}>
        <div className="flex items-center gap-3.5">
          <span className={`w-[46px] h-[46px] flex-shrink-0 grid place-items-center rounded-[12px] text-[21px] ${data.tint}`}>{data.icon}</span>
          <div>
            <h2 className="text-[19px] font-extrabold text-[#14213A]">{data.name}</h2>
            <p className="mt-1 text-[13px] text-[#64748B]">{data.description}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">{kindLabel} • {enabledCount}/{total} signals enabled</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-[13px] border border-[#DCE5F2] overflow-hidden">
          {data.rows.map((row, idx) => (
            <div key={row[0]} className="flex items-start gap-4 px-[18px] py-[17px] border-b border-[#DCE5F2] last:border-b-0 hover:bg-[#F9FBFF] transition-colors">
              <span className={`w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[11px] text-lg ${row[2] ? 'bg-[#EAF9F1] text-[#15955B]' : 'bg-[#FFF6DF] text-[#D98A00]'}`}>{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#17243C]">{row[0]}</h3>
                <p className="mt-1 text-xs text-[#64748B] leading-relaxed">{row[1]}</p>
              </div>
              <DisplayToggle on={row[2]} optional={!row[2]} />
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-[11px] bg-[#F3F8FF] border border-[#CFE1FF] text-xs text-[#315486] leading-relaxed">
          ⓘ {data.note}
        </div>

        <div className="mt-4 p-4 rounded-[11px] bg-[#FFFAF0] border border-[#F5DF9E] text-xs text-[#9A6900] leading-relaxed flex items-start gap-3">
          <span>ⓘ</span>
          <span>
            These toggles are <b>read-only documentation</b> of what each account can configure.
            Preferences belong to individual users and are managed by them through their own
            Settings page — Super Admin cannot override personal notification choices.
          </span>
        </div>

        <div className="mt-[18px] pt-[17px] border-t border-[#DCE5F2] flex justify-end">
          <button onClick={onClose}
            className="h-[42px] px-4 rounded-[9px] border border-[#9EC3FF] bg-white text-[#1769F5] text-xs font-extrabold hover:bg-[#EDF5FF] transition-colors cursor-pointer">
            ← Back to {kindLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function AnnouncementPushView({ onNavigate }) {
  const showToast = useToast();
  const [tab, setTab] = useState('delivery');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);

  // Real delivery history: recent announcements published with Send Notification.
  const load = useCallback(async () => {
    setError(false);
    try {
      const d = await apiFetch('announcements/admin_list.php');
      const list = Array.isArray(d) ? d : [];
      setItems(list.filter((a) => (a.send_notification ?? 1) === 1 || a.send_notification === true).slice(0, 8));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    ['delivery', 'Notification Delivery'],
    ['scope', 'Recipient Scope'],
    ['history', 'Delivery History'],
    ['manage', 'Announcement Management'],
  ];

  return (
    <section>
      <button onClick={() => setView('overview')}
        className="border-none bg-transparent text-[#1769F5] text-[13px] font-extrabold px-0 py-2 mt-[18px] mb-[18px] cursor-pointer hover:underline">
        ← Back to Notification Settings
      </button>

      <div className="bg-white border border-[#DCE5F2] rounded-[16px] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_4px_18px_rgba(27,54,93,0.07)]">
        <div className="flex items-center gap-[18px] min-w-0">
          <span className="w-[58px] h-[58px] flex-shrink-0 grid place-items-center rounded-full bg-[#EAF9F1] text-[#15955B] text-[28px]">📣</span>
          <div>
            <h2 className="text-[21px] font-extrabold text-[#14213A]">Announcement Push</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">The system-triggered notification flow for published announcements.</p>
          </div>
        </div>
        <div className="rounded-[10px] border border-[#B9D4FF] bg-[#F3F8FF] p-[14px_18px] text-[13px] text-[#315486] leading-relaxed max-w-[390px]">
          <strong>ⓘ About Announcement Push</strong>
          <div className="mt-1.5">Notifications trigger when an announcement is published with <b>Send Notification</b>.</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-[7px] p-[5px] rounded-[12px] border border-[#DCE5F2] bg-[#F7F9FC]">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`min-h-[44px] px-2.5 rounded-[9px] text-xs font-extrabold border-none cursor-pointer transition-colors ${tab === key ? 'bg-white text-[#15955B] shadow-[0_2px_8px_rgba(27,54,93,0.08)]' : 'bg-transparent text-[#43516A] hover:bg-[#EEF3FA]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Delivery */}
      {tab === 'delivery' && (
        <div className="space-y-5 mt-5">
          <div className="rounded-[14px] border border-[#A8E4C5] bg-[#F0FBF5] p-5 flex items-start gap-3.5">
            <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-full bg-[#EAF9F1] text-[#15955B] text-xl">✓</span>
            <div>
              <h3 className="text-[15px] font-bold text-[#168354]">ANNOUNCEMENT NOTIFICATIONS AVAILABLE</h3>
              <p className="mt-1 text-[13px] text-[#557866] leading-relaxed">The existing announcement flow notifies active residents when an administrator publishes an announcement with “Send Notification” enabled.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[['Delivery Method', 'Portal Bell Alert'], ['Recipient Scope', 'Active Residents'], ['Trigger', 'Published Announcement']].map(([t, v]) => (
              <div key={t} className="border border-[#DCE5F2] rounded-[13px] p-[18px] bg-white">
                <h3 className="text-[13px] text-[#425572] mb-2">{t}</h3>
                <strong className="text-[15px] text-[#14213A]">{v}</strong>
              </div>
            ))}
          </div>

          <div className="rounded-[14px] border border-[#DCE5F2] overflow-hidden bg-white">
            <div className="p-5 border-b border-[#DCE5F2]">
              <h2 className="text-lg font-extrabold text-[#14213A]">Notification Delivery Flow</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">How announcement notifications work in the current system.</p>
            </div>
            {[
              ['Create Announcement', 'Staff or administrator creates an announcement in the existing Announcements module.'],
              ['Enable Send Notification', 'The publisher selects the existing Send Notification option before publishing.'],
              ['Notify Active Residents', 'create.php inserts one bell notification per Active Resident account.'],
              ['Resident Receives Bell Alert', 'Residents see it live via realtime polling — no refresh needed.'],
            ].map(([t, d], i) => (
              <div key={t} className="flex items-center gap-4 px-5 py-[17px] border-b border-[#DCE5F2] last:border-b-0 hover:bg-[#F8FBFF] transition-colors">
                <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] bg-[#EAF2FF] text-[#1769F5] font-extrabold text-sm">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#17243C]">{t}</h3>
                  <p className="mt-1 text-xs text-[#64748B]">{d}</p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-[#EAF9F1] text-[#15955B] text-[11px] font-extrabold whitespace-nowrap">Available</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scope */}
      {tab === 'scope' && (
        <div className="space-y-5 mt-5">
          <div className="rounded-[14px] border border-[#DCE5F2] bg-white overflow-hidden">
            {[['Primary Recipient Group', 'Current behavior delivers announcement alerts to active resident accounts only.', 'Active Residents'],
              ['Notification Channel', 'In-app bell alert via the realtime polling system.', 'Portal Bell'],
              ['Trigger Condition', 'Only announcements published with Send Notification enabled create alerts.', 'Send Notification ON']].map(([t, d, v]) => (
              <div key={t} className="flex flex-wrap items-center gap-3 px-[18px] py-[17px] border-b border-[#DCE5F2] last:border-b-0">
                <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] bg-[#EAF2FF] text-[#1769F5]">♙</span>
                <div className="flex-1 min-w-[200px]">
                  <h3 className="text-sm font-bold text-[#17243C]">{t}</h3>
                  <p className="mt-1 text-xs text-[#64748B]">{d}</p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-[#F1FBF5] border border-[#B8E8CC] text-[#168354] text-xs font-extrabold whitespace-nowrap">{v}</span>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-[11px] bg-[#F3F8FF] border border-[#CFE1FF] text-xs text-[#315486] leading-relaxed">
            ⓘ Recipient scope is defined by the existing announcement backend (create.php) and its authorization rules. Changing scope would require backend support first.
          </div>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="space-y-4 mt-5">
          <div className="rounded-[14px] border border-[#DCE5F2] overflow-hidden bg-white">
            <div className="p-5 border-b border-[#DCE5F2]">
              <h2 className="text-lg font-extrabold text-[#14213A]">Recent Notification Activity</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">Real announcements published with Send Notification enabled.</p>
            </div>
            {error ? (
              <StaffErrorState message="Unable to load announcement history." onRetry={load} />
            ) : items === null ? (
              <div className="p-5"><SkeletonRows rows={4} height="h-12" /></div>
            ) : !items.length ? (
              <StaffEmptyState title="No announcement notifications yet." description="Publish an announcement with Send Notification to see activity here." />
            ) : (
              items.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-[18px] py-[15px] border-t border-[#DCE5F2] first:border-t-0 hover:bg-[#F8FBFF] transition-colors">
                  <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] bg-[#EAF9F1] text-[#15955B]">📣</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#17243C] truncate">{a.title}</h3>
                    <p className="mt-0.5 text-xs text-[#64748B] truncate">{a.category || 'General'} • {a.audience || 'All Residents'}</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-[#EAF9F1] text-[#15955B] text-[11px] font-extrabold whitespace-nowrap">Sent</span>
                </div>
              ))
            )}
          </div>
          <p className="text-[10px] text-[#8B98AA]">Recipients: every Active Resident account at publish time. Per-resident read state lives in each user&apos;s notifications list.</p>
        </div>
      )}

      {/* Management */}
      {tab === 'manage' && (
        <div className="space-y-5 mt-5">
          <div className="rounded-[14px] border border-[#DCE5F2] bg-white overflow-hidden">
            {[
              ['📣', 'Create or Edit Announcement', 'Use the existing Announcements module to create or update content.', 'Available'],
              ['✉', 'Send Notification Toggle', 'Enable the existing notification option when the announcement should alert residents.', 'Required'],
              ['↗', 'Publish', 'Publishing triggers the existing announcement notification flow.', 'Ready'],
            ].map(([icon, t, d, pill]) => (
              <div key={t} className="flex items-center gap-4 px-[18px] py-[17px] border-b border-[#DCE5F2] last:border-b-0">
                <span className={`w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] ${pill === 'Required' ? 'bg-[#EEF5FF] text-[#1769F5]' : pill === 'Ready' ? 'bg-[#EAF9F1] text-[#15955B]' : 'bg-[#F1EDFF] text-[#7554E8]'}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#17243C]">{t}</h3>
                  <p className="mt-1 text-xs text-[#64748B]">{d}</p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-[#F1F5F9] text-[#64748B] text-[11px] font-extrabold whitespace-nowrap">{pill}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={() => { showToast('Opening the Announcements module.'); onNavigate && onNavigate('announcements'); }}
              className="h-[42px] px-4 rounded-[9px] border border-[#9EC3FF] bg-white text-[#1769F5] text-xs font-extrabold hover:bg-[#EDF5FF] transition-colors cursor-pointer">
              📣 Open Announcements →
            </button>
          </div>
        </div>
      )}

      {/* Always-visible availability footer */}
      <div className="mt-5 rounded-[14px] border border-[#A8E4C5] bg-[#F0FBF5] p-5 flex items-start gap-3.5">
        <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-full bg-[#EAF9F1] text-[#15955B] text-xl">✓</span>
        <div>
          <h3 className="text-[15px] font-bold text-[#168354]">ANNOUNCEMENT NOTIFICATIONS AVAILABLE</h3>
          <p className="mt-1 text-[13px] text-[#557866] leading-relaxed">This screen represents the existing event-triggered flow. It does not create a second notification backend.</p>
        </div>
      </div>
    </section>
  );
}

function NotificationsSection({ onNavigate, sub }) {
  // Sub-view deep links: #/system-settings/notifications/<view>
  const [view, setView] = useState(() => {
    if (sub === 'residents') return 'residents';
    if (sub === 'staff') return 'staff';
    if (sub === 'announcements') return 'announcements';
    return 'overview';
  });

  const [residentPanel, setResidentPanel] = useState(null);
  const [staffPanel, setStaffPanel] = useState(null);

  function openSub(viewName) {
    setResidentPanel(null);
    setStaffPanel(null);
    setView(viewName);
    if (onNavigate) onNavigate(`system-settings/notifications/${viewName}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const residentData = residentPanel ? NOTIF_RESIDENT_TYPES.find((t) => t.name === residentPanel) : null;
  const staffData = staffPanel ? NOTIF_STAFF_TYPES.find((t) => t.name === staffPanel) : null;

  /* ---------- OVERVIEW ---------- */
  if (view === 'overview') {
    return (
      <div className="space-y-5">
        <div className="rounded-[15px] border border-[#CFE1FF] p-6 lg:p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
          style={{ background: 'linear-gradient(100deg,#F2F7FF,#EDF5FF)' }}>
          <div className="flex items-start gap-[18px]">
            <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-full bg-xevera-600 text-white text-xl font-bold">i</span>
            <div>
              <div className="text-[17px] font-extrabold text-[#14213A] mb-1.5">Notifications are managed at the account level.</div>
              <p className="text-sm text-[#5B6D89] leading-relaxed max-w-[780px]">
                Super Admin does not have global notification toggles. Notification preferences belong
                to individual accounts and are managed through the existing systems below.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-[22px]">
          {/* Resident card */}
          <article className="bg-white border border-[#DCE5F2] rounded-[16px] p-[26px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] flex flex-col">
            <span className="w-16 h-16 rounded-[13px] grid place-items-center text-3xl bg-[#EAF2FF] text-[#1769F5] mb-[18px]">♙</span>
            <h2 className="text-[19px] font-extrabold text-[#14213A]">Resident Preferences</h2>
            <p className="mt-1.5 text-sm text-[#64748B]">Per-resident notification controls</p>
            <div className="border-t border-[#DCE5F2] my-[22px]" />
            <p className="text-sm text-[#566781] leading-relaxed">Residents can manage what notifications they receive from their own account.</p>
            <ul className="mt-3 space-y-2.5">
              {[['Email notifications', '✉'], ['Report updates', '▤'], ['Comments and replies', '◯'], ['Announcements', '📣']].map(([t]) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-[#566781]">
                  <span className="w-[17px] h-[17px] flex-shrink-0 grid place-items-center rounded-full bg-[#2EAA70] text-white text-[10px]">✓</span>{t}
                </li>
              ))}
            </ul>
            <button onClick={() => openSub('residents')}
              className="mt-auto pt-[22px] w-full">
              <span className="block w-full min-h-[43px] leading-[41px] border border-[#9EC3FF] rounded-[10px] bg-white text-[#1769F5] text-[13px] font-extrabold hover:bg-[#EDF5FF] hover:border-xevera-600 transition-colors cursor-pointer text-left px-4">
                View Resident Preferences <span className="float-right">›</span>
              </span>
            </button>
          </article>

          {/* Staff card */}
          <article className="bg-white border border-[#DCE5F2] rounded-[16px] p-[26px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] flex flex-col">
            <span className="w-16 h-16 rounded-[13px] grid place-items-center text-3xl bg-[#F1EDFF] text-[#7554E8] mb-[18px]">♧</span>
            <h2 className="text-[19px] font-extrabold text-[#14213A]">Staff Preferences</h2>
            <p className="mt-1.5 text-sm text-[#64748B]">Per-staff notification controls</p>
            <div className="border-t border-[#DCE5F2] my-[22px]" />
            <p className="text-sm text-[#566781] leading-relaxed">Staff and administrators manage their personal notification settings.</p>
            <ul className="mt-3 space-y-2.5">
              {[['Email notifications', '✉'], ['Task and assignment alerts', '✓'], ['System updates', '▤'], ['Comments and mentions', '◯']].map(([t]) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-[#566781]">
                  <span className="w-[17px] h-[17px] flex-shrink-0 grid place-items-center rounded-full bg-[#2EAA70] text-white text-[10px]">✓</span>{t}
                </li>
              ))}
            </ul>
            <button onClick={() => openSub('staff')}
              className="mt-auto pt-[22px] w-full">
              <span className="block w-full min-h-[43px] leading-[41px] border border-[#9EC3FF] rounded-[10px] bg-white text-[#1769F5] text-[13px] font-extrabold hover:bg-[#EDF5FF] hover:border-xevera-600 transition-colors cursor-pointer text-left px-4">
                View Staff Preferences <span className="float-right">›</span>
              </span>
            </button>
          </article>

          {/* Announcement card */}
          <article className="bg-white border border-[#DCE5F2] rounded-[16px] p-[26px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] flex flex-col">
            <span className="w-16 h-16 rounded-[13px] grid place-items-center text-3xl bg-[#EAF9F1] text-[#15955B] mb-[18px]">📣</span>
            <h2 className="text-[19px] font-extrabold text-[#14213A]">Announcement Push</h2>
            <p className="mt-1.5 text-sm text-[#64748B]">System-triggered notifications</p>
            <div className="border-t border-[#DCE5F2] my-[22px]" />
            <p className="text-sm text-[#566781] leading-relaxed">When an announcement is published with <strong>“Send Notification”</strong>, active residents receive a bell alert.</p>
            <div className="mt-3 rounded-[10px] border border-[#A8E4C5] bg-[#EAF9F1] p-3.5 text-[#168354]">
              <strong className="text-[13px]">✓ AVAILABLE</strong>
              <div className="text-[13px] mt-1">System will notify active residents.</div>
            </div>
            <button onClick={() => openSub('announcements')}
              className="mt-auto pt-[22px] w-full">
              <span className="block w-full min-h-[43px] leading-[41px] border border-[#9EC3FF] rounded-[10px] bg-white text-[#1769F5] text-[13px] font-extrabold hover:bg-[#EDF5FF] hover:border-xevera-600 transition-colors cursor-pointer text-left px-4">
                Manage Announcements <span className="float-right">›</span>
              </span>
            </button>
          </article>
        </div>

        {/* Architecture */}
        <section className="bg-white border border-[#DCE5F2] rounded-[16px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] p-[26px]">
          <div className="flex items-center gap-[15px] pb-5 border-b border-[#DCE5F2]">
            <span className="w-[52px] h-[52px] grid place-items-center rounded-full bg-[#EAF2FF] text-[#1769F5] text-[25px]">🛡</span>
            <div>
              <h2 className="text-[19px] font-extrabold text-[#14213A]">Notification Architecture</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">How notifications work in the current system</p>
            </div>
          </div>
          <div className="pt-6 grid grid-cols-1 xl:grid-cols-3">
            {[
              ['♙', 'Per-Account Preferences', 'Notification preferences are stored per user account.', ''],
              ['▤', 'Existing Backend System', 'Managed by the current preference endpoints (notifications/prefs-*.php and profile/prefs.php).', 'purple'],
              ['⚡', 'Event-Triggered Delivery', 'Notifications are sent based on events and each user\u2019s preferences.', 'green'],
            ].map(([icon, t, d, tone], i) => (
              <div key={t} className={`flex gap-4 px-0 xl:px-7 py-5 xl:py-0 ${i > 0 ? 'xl:border-l xl:border-[#DCE5F2]' : ''}`}>
                <span className={`w-[50px] h-[50px] flex-shrink-0 grid place-items-center rounded-full ${tone === 'purple' ? 'bg-[#F1EDFF] text-[#7554E8]' : tone === 'green' ? 'bg-[#EAF9F1] text-[#15955B]' : 'bg-[#EAF2FF] text-[#1769F5]'}`}>{icon}</span>
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#14213A] mb-1.5">{t}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-[15px] border border-[#F5DF9E] bg-[#FFFAF0] p-[18px_24px] py-[18px] px-6 flex items-center gap-[15px] text-[#9A6900]">
          <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full bg-[#FFF0C7] font-bold">ⓘ</span>
          <div>
            <strong>No Global Toggles</strong>
            <div className="mt-1 text-[13px] text-[#7B6A46] leading-relaxed">Global enable/disable switches are not available because notifications are controlled at the account level in the existing architecture.</div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- RESIDENT DETAIL ---------- */
  if (view === 'residents') {
    const panelData = residentPanel ? NOTIF_RESIDENT_TYPES.find((t) => t.name === residentPanel) : null;
    return (
      <section>
        <button onClick={() => openSub('overview')}
          className="border-none bg-transparent text-[#1769F5] text-[13px] font-extrabold px-0 py-2 mt-[18px] mb-[18px] cursor-pointer hover:underline block">
          ← Back to Notification Settings
        </button>

        <div className="bg-white border border-[#DCE5F2] rounded-[16px] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_4px_18px_rgba(27,54,93,0.07)]">
          <div className="flex items-center gap-[18px]">
            <span className="w-[58px] h-[58px] flex-shrink-0 grid place-items-center rounded-full bg-[#EAF2FF] text-[#1769F5] text-[28px]">♙</span>
            <div>
              <h2 className="text-[21px] font-extrabold text-[#14213A]">Resident Notification Preferences</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">Manage the notification types that residents can receive.</p>
            </div>
          </div>
          <div className="rounded-[10px] border border-[#B9D4FF] bg-[#F3F8FF] p-[14px_18px] text-[13px] text-[#315486] leading-relaxed max-w-[390px]">
            <strong>ⓘ About Resident Notifications</strong>
            <div className="mt-1.5">These preferences are managed by each resident from their account settings.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[22px] mt-5">
          <aside className="bg-white border border-[#DCE5F2] rounded-[16px] p-3.5 shadow-[0_4px_18px_rgba(27,54,93,0.07)] h-fit">
            <nav className="flex flex-col gap-1">
              <button onClick={() => setResidentPanel(null)}
                className={`text-left px-3.5 py-3 rounded-[10px] text-[13px] font-bold border-none cursor-pointer transition-colors ${!residentPanel ? 'bg-[#EDF5FF] text-xevera-600' : 'bg-transparent text-[#334967] hover:bg-[#F2F6FC]'}`}>
                ▦ Overview
              </button>
              {NOTIF_RESIDENT_TYPES.map((t) => (
                <button key={t.name} onClick={() => setResidentPanel(t.name)}
                  className={`text-left px-3.5 py-3 rounded-[10px] text-[13px] font-bold border-none cursor-pointer transition-colors ${residentPanel === t.name ? 'bg-[#EDF5FF] text-xevera-600' : 'bg-transparent text-[#334967] hover:bg-[#F2F6FC]'}`}>
                  {t.icon} {t.name}
                </button>
              ))}
            </nav>
            <div className="mt-4 p-5 rounded-[12px] border border-[#C8DDFF] bg-[#F2F7FF]">
              <h3 className="text-[15px] font-bold text-xevera-600">💡 Quick Tip</h3>
              <p className="mt-2 text-[13px] text-[#60718B] leading-relaxed">Residents can update their preferences anytime from their own Notification Settings page.</p>
            </div>
          </aside>

          <div className="bg-white border border-[#DCE5F2] rounded-[16px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] p-6 min-w-0">
            {!panelData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                  {[['✓', NOTIF_RESIDENT_TYPES.filter((t) => !t.optional).length, 'Enabled', 'Active notification groups', 'bg-[#EAF9F1] text-[#15955B]'],
                    ['||', NOTIF_RESIDENT_TYPES.filter((t) => t.optional).length, 'Optional', 'Opt-in groups', 'bg-[#FFF6DF] text-[#D98A00]'],
                    ['♧', 0, 'Disabled', 'Not enabled', 'bg-[#F1EDFF] text-[#7554E8]'],
                    ['♙', NOTIF_RESIDENT_TYPES.length, 'Total Types', 'Notification groups', 'bg-[#EAF2FF] text-[#1769F5]']].map(([ic, n, l, d, tint]) => (
                    <div key={l} className="border border-[#DCE5F2] rounded-[13px] p-[18px] flex items-center gap-3 bg-white">
                      <span className={`w-[43px] h-[43px] flex-shrink-0 grid place-items-center rounded-full ${tint}`}>{ic}</span>
                      <div><div className="text-[23px] font-extrabold text-[#14213A] leading-none">{n}</div><div className="text-xs font-bold text-[#334967] mt-1">{l}</div><div className="text-[11px] text-[#94A3B8] mt-0.5">{d}</div></div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[14px] border border-[#DCE5F2] overflow-hidden">
                  <div className="p-5 border-b border-[#DCE5F2]">
                    <h2 className="text-lg font-extrabold text-[#14213A]">Notification Types</h2>
                    <p className="mt-1 text-[13px] text-[#64748B]">What each resident can choose to receive. Click a group for details.</p>
                  </div>
                  {NOTIF_RESIDENT_TYPES.map((t) => (
                    <button key={t.name} onClick={() => setResidentPanel(t.name)}
                      className="w-full flex items-center gap-3.5 px-5 py-[17px] border-b border-[#DCE5F2] last:border-b-0 text-left hover:bg-[#F8FBFF] transition-colors cursor-pointer bg-transparent">
                      <span className={`w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] text-lg ${t.tint}`}>{t.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-[#17243C]">{t.name}</span>
                        <span className="block text-xs text-[#64748B] mt-1">{t.description}</span>
                      </span>
                      <span className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap ${t.optional ? 'bg-[#FFF6DF] text-[#D98A00]' : 'bg-[#EAF9F1] text-[#15955B]'}`}>{t.optional ? 'Optional' : 'Enabled'}</span>
                      <span className="text-[#73839B] text-lg">›</span>
                    </button>
                  ))}
                </div>

                <div className="mt-[18px] rounded-[14px] bg-[#F3F8FF] border border-[#C8DDFF] p-[18px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-[43px] h-[43px] flex-shrink-0 grid place-items-center rounded-full bg-[#E1EDFF] text-[#1769F5]">🛡</span>
                    <div>
                      <h3 className="text-sm font-bold text-[#1457BB]">Your privacy is important</h3>
                      <p className="text-xs text-[#64748B] mt-1">We only send notifications for activity that matters to each user.</p>
                    </div>
                  </div>
                  <button onClick={() => setResidentPanel(NOTIF_RESIDENT_TYPES[0].name)}
                    className="w-full sm:w-auto px-[17px] py-[11px] rounded-[9px] border border-[#91BCFF] bg-white text-[#1769F5] text-xs font-extrabold hover:bg-[#EDF5FF] transition-colors cursor-pointer">
                    ⚙ View Preference Details
                  </button>
                </div>
              </>
            ) : (
              <NotifPanel data={{ ...panelData }} kindLabel="Resident Preferences" onClose={() => setResidentPanel(null)} />
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ---------- STAFF DETAIL ---------- */
  if (view === 'staff') {
    const panelData = staffPanel ? NOTIF_STAFF_TYPES.find((t) => t.name === staffPanel) : null;
    return (
      <section>
        <button onClick={() => openSub('overview')}
          className="border-none bg-transparent text-[#1769F5] text-[13px] font-extrabold px-0 py-2 mt-[18px] mb-[18px] cursor-pointer hover:underline block">
          ← Back to Notification Settings
        </button>

        <div className="bg-white border border-[#DCE5F2] rounded-[16px] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-[0_4px_18px_rgba(27,54,93,0.07)]">
          <div className="flex items-center gap-[18px]">
            <span className="w-[58px] h-[58px] flex-shrink-0 grid place-items-center rounded-full bg-[#F1EDFF] text-[#7554E8] text-[28px]">♧</span>
            <div>
              <h2 className="text-[21px] font-extrabold text-[#14213A]">Staff Notification Preferences</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">Manage the notification types available to staff and administrators.</p>
            </div>
          </div>
          <div className="rounded-[10px] border border-[#B9D4FF] bg-[#F3F8FF] p-[14px_18px] text-[13px] text-[#315486] leading-relaxed max-w-[390px]">
            <strong>ⓘ About Staff Notifications</strong>
            <div className="mt-1.5">Staff and administrators manage their personal notification preferences through their account settings.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-[22px] mt-5">
          <aside className="bg-white border border-[#DCE5F2] rounded-[16px] p-3.5 shadow-[0_4px_18px_rgba(27,54,93,0.07)] h-fit">
            <nav className="flex flex-col gap-1">
              <button onClick={() => setStaffPanel(null)}
                className={`text-left px-3.5 py-3 rounded-[10px] text-[13px] font-bold border-none cursor-pointer transition-colors ${!staffPanel ? 'bg-[#EDF5FF] text-xevera-600' : 'bg-transparent text-[#334967] hover:bg-[#F2F6FC]'}`}>
                ▦ Overview
              </button>
              {NOTIF_STAFF_TYPES.map((t) => (
                <button key={t.name} onClick={() => setStaffPanel(t.name)}
                  className={`text-left px-3.5 py-3 rounded-[10px] text-[13px] font-bold border-none cursor-pointer transition-colors ${staffPanel === t.name ? 'bg-[#EDF5FF] text-xevera-600' : 'bg-transparent text-[#334967] hover:bg-[#F2F6FC]'}`}>
                  {t.icon} {t.name}
                </button>
              ))}
            </nav>
            <div className="mt-4 p-5 rounded-[12px] border border-[#C8DDFF] bg-[#F2F7FF]">
              <h3 className="text-[15px] font-bold text-xevera-600">💡 Quick Tip</h3>
              <p className="mt-2 text-[13px] text-[#60718B] leading-relaxed">Super Admin does not override individual notification preferences here — each staff member controls their own.</p>
            </div>
          </aside>

          <div className="bg-white border border-[#DCE5F2] rounded-[16px] shadow-[0_4px_18px_rgba(27,54,93,0.07)] p-6 min-w-0">
            {!panelData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                  {[['✓', NOTIF_STAFF_TYPES.filter((t) => !t.optional).length, 'Enabled', 'Active notification groups', 'bg-[#EAF9F1] text-[#15955B]'],
                    ['||', NOTIF_STAFF_TYPES.filter((t) => t.optional).length, 'Optional', 'Opt-in groups', 'bg-[#FFF6DF] text-[#D98A00]'],
                    ['♧', 0, 'Disabled', 'Not enabled', 'bg-[#F1EDFF] text-[#7554E8]'],
                    ['♙', NOTIF_STAFF_TYPES.length, 'Total Types', 'Notification groups', 'bg-[#EAF2FF] text-[#1769F5]']].map(([ic, n, l, d, tint]) => (
                    <div key={l} className="border border-[#DCE5F2] rounded-[13px] p-[18px] flex items-center gap-3 bg-white">
                      <span className={`w-[43px] h-[43px] flex-shrink-0 grid place-items-center rounded-full ${tint}`}>{ic}</span>
                      <div><div className="text-[23px] font-extrabold text-[#14213A] leading-none">{n}</div><div className="text-xs font-bold text-[#334967] mt-1">{l}</div><div className="text-[11px] text-[#94A3B8] mt-0.5">{d}</div></div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[14px] border border-[#DCE5F2] overflow-hidden">
                  <div className="p-5 border-b border-[#DCE5F2]">
                    <h2 className="text-lg font-extrabold text-[#14213A]">Staff Notification Types</h2>
                    <p className="mt-1 text-[13px] text-[#64748B]">Staff notification controls are managed per account. Click a group for details.</p>
                  </div>
                  {NOTIF_STAFF_TYPES.map((t) => (
                    <button key={t.name} onClick={() => setStaffPanel(t.name)}
                      className="w-full flex items-center gap-3.5 px-5 py-[17px] border-b border-[#DCE5F2] last:border-b-0 text-left hover:bg-[#F8FBFF] transition-colors cursor-pointer bg-transparent">
                      <span className={`w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[10px] text-lg ${t.tint}`}>{t.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-[#17243C]">{t.name}</span>
                        <span className="block text-xs text-[#64748B] mt-1">{t.description}</span>
                      </span>
                      <span className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap ${t.optional ? 'bg-[#FFF6DF] text-[#D98A00]' : 'bg-[#EAF9F1] text-[#15955B]'}`}>{t.optional ? 'Optional' : 'Enabled'}</span>
                      <span className="text-[#73839B] text-lg">›</span>
                    </button>
                  ))}
                </div>

                <div className="mt-[18px] rounded-[14px] bg-[#F3F8FF] border border-[#C8DDFF] p-[18px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-[43px] h-[43px] flex-shrink-0 grid place-items-center rounded-full bg-[#E1EDFF] text-[#1769F5]">🛡</span>
                    <div>
                      <h3 className="text-sm font-bold text-[#1457BB]">Each account controls its own preferences</h3>
                      <p className="text-xs text-[#64748B] mt-1">Staff notification preferences remain associated with the individual account.</p>
                    </div>
                  </div>
                  <button onClick={() => setStaffPanel(NOTIF_STAFF_TYPES[0].name)}
                    className="w-full sm:w-auto px-[17px] py-[11px] rounded-[9px] border border-[#91BCFF] bg-white text-[#1769F5] text-xs font-extrabold hover:bg-[#EDF5FF] transition-colors cursor-pointer">
                    ⚙ View Preference Details
                  </button>
                </div>
              </>
            ) : (
              <NotifPanel data={{ ...panelData }} kindLabel="Staff Preferences" onClose={() => setStaffPanel(null)} />
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ---------- ANNOUNCEMENT PUSH ---------- */
  return <AnnouncementPushView onNavigate={onNavigate} />;
}

/* ============================================================
   REPORT CATEGORIES — manages the existing `categories` JSON
   setting via settings/get.php + settings/save.php.
   Edits are staged locally and saved with one click.
============================================================ */

const DEFAULT_CATEGORIES = [
  'Flooding', 'Road Damage', 'Garbage / Waste', 'Streetlight',
  'Water Problem', 'Drainage', 'Environmental', 'Public Safety', 'Other Issues',
];

function CategoriesSection({ refreshKey = 0 }) {
  const showToast = useToast();
  const [original, setOriginal] = useState(null);   // last-saved list
  const [draft, setDraft] = useState(null);         // working copy
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);   // { type: 'remove'|'reset', index }

  const load = useCallback(async () => {
    setError(false);
    try {
      const d = await apiFetch('settings/get.php');
      let list = d.categories;
      if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
      const clean = Array.isArray(list) ? list : [];
      setOriginal(clean);
      setDraft([...clean]);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const dirty = original !== null && draft !== null && JSON.stringify(draft) !== JSON.stringify(original);
  const removedCount = original && draft ? Math.max(0, original.length - draft.length) : 0;

  function add(e) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) { showToast('Please enter a category name.'); return; }
    if (draft.some((c) => c.toLowerCase() === name.toLowerCase())) {
      showToast('That category already exists.', 'error');
      return;
    }
    setNewCategory('');
    setDraft((d) => [...d, name]);
    showToast(`"${name}" added to categories.`);
  }

  async function persist(list) {
    setSaving(true);
    try {
      await apiFetch('settings/save.php', { method: 'POST', body: { settings: { categories: list } } });
      setOriginal(list);
      showToast('Report categories saved successfully.');
    } catch (err) {
      showToast(err.message || 'Unable to save categories.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDrop(toIndex) {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null); setOverIndex(null);
      return;
    }
    setDraft((d) => {
      const next = [...d];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  }

  async function confirmAction() {
    if (!confirmTarget) return;
    if (confirmTarget.type === 'remove') {
      const removed = draft[confirmTarget.index];
      setDraft((d) => d.filter((_, i) => i !== confirmTarget.index));
      showToast(`"${removed}" removed.`);
    } else {
      setDraft([...DEFAULT_CATEGORIES]);
      setReorderMode(false);
      showToast('Categories restored to default. Click Save Changes to apply.');
    }
    setConfirmTarget(null);
  }

  if (error) return <StaffErrorState message="Unable to load categories." onRetry={load} />;
  if (!draft || !original) return <SkeletonRows rows={4} height="h-14" />;

  const itemCls = (i) => `min-h-[56px] flex items-center gap-2.5 px-3.5 rounded-[16px] border transition-all ${
    dragIndex === i ? 'opacity-45 scale-[0.98]'
    : overIndex === i ? 'border-xevera-600 shadow-[0_0_0_3px_rgba(20,101,232,0.12)]'
    : 'border-[#D8E6FA] hover:border-[#A9CAFF] hover:shadow-[0_6px_15px_rgba(25,88,175,0.09)]'
  } bg-gradient-to-b from-[#F1F6FF] to-[#EDF4FD] text-[#124293]`;

  return (
    <div>
      {/* Info banner */}
      <div className="min-h-[95px] flex items-center gap-[18px] p-5 rounded-[17px] bg-[#F1F6FF] border border-[#C9DDFF]">
        <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-full bg-xevera-600 text-white text-xl font-extrabold">i</span>
        <p className="text-base text-[#254D8D] leading-relaxed">
          These categories feed the resident report submission flow (stored as the existing <b>categories</b> setting).
          Removing a category does not change historical reports that use it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-7 items-start mt-[23px]">

        {/* Category management card */}
        <section className="bg-white border border-[#E1E7F0] rounded-[20px] shadow-[0_5px_18px_rgba(27,51,83,0.07)] p-7 max-lg:p-[18px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-[23px] font-extrabold text-[#122343]">Active Report Categories</h2>
              <span className="min-w-[35px] h-[35px] grid place-items-center rounded-full bg-[#E9F2FF] text-[#1261DF] text-base font-extrabold">{draft.length}</span>
            </div>
            <button type="button" onClick={() => setReorderMode((m) => !m)}
              className={`h-11 px-[18px] inline-flex items-center justify-center gap-2 rounded-[11px] text-sm font-extrabold border-[1.5px] transition-colors cursor-pointer whitespace-nowrap ${reorderMode ? 'bg-xevera-600 border-xevera-600 text-white' : 'bg-white border-xevera-600 text-[#1261DF] hover:bg-[#EDF5FF]'}`}>
              ↕ {reorderMode ? '✓ Done Reordering' : 'Reorder Categories'}
            </button>
          </div>

          <div className="flex items-center gap-2.5 mb-[22px] text-[15px] text-[#647695]">
            <span className="text-xl">↕</span>
            <span>{reorderMode ? 'Drag the ⠿ handle to reorder categories.' : 'Enable Reorder Mode to rearrange categories.'}</span>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 ${reorderMode ? '' : ''}`}>
            {draft.map((c, i) => (
              <div key={c}
                draggable={reorderMode}
                onDragStart={() => reorderMode && setDragIndex(i)}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                onDragOver={(e) => { if (!reorderMode) return; e.preventDefault(); if (dragIndex !== null && dragIndex !== i) setOverIndex(i); }}
                onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
                className={itemCls(i)}>
                <span className={`${reorderMode ? 'inline-block' : 'hidden'} text-[#7B91B0] cursor-grab text-[17px] select-none`}>⠿</span>
                <span className="flex-1 text-[15px] font-extrabold truncate" title={c}>{c}</span>
                <button type="button" title={`Remove ${c}`} onClick={() => setConfirmTarget({ type: 'remove', index: i })}
                  className="w-[27px] h-[27px] flex-shrink-0 grid place-items-center rounded-full border-0 bg-white text-xevera-600 text-base font-bold hover:bg-[#E5EFFF] hover:text-[#084BB5] hover:scale-110 transition-all cursor-pointer">
                  ×
                </button>
              </div>
            ))}
            {draft.length === 0 && (
              <StaffEmptyState title="No categories." description="Add your first category below." />
            )}
          </div>

          <div className="h-px bg-[#E3E9F1] my-[26px]" />

          <h3 className="text-[17px] font-extrabold text-[#142542] mb-4">Add New Category</h3>
          <form onSubmit={add} className="flex flex-col sm:flex-row gap-3.5">
            <div className="relative flex-1">
              <span className="absolute left-[18px] top-1/2 -translate-y-1/2 text-[#6E85A4] text-xl">◇</span>
              <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={50}
                placeholder="Enter new category name..."
                className="w-full h-[53px] pl-12 pr-[18px] rounded-[13px] border border-[#D4DEEC] bg-white text-base text-[#172844] outline-none transition-colors placeholder:text-[#8CA0BB] focus:border-xevera-600 focus:shadow-[0_0_0_3px_rgba(17,101,235,0.12)]" />
            </div>
            <button type="submit"
              className="sm:min-w-[190px] h-[53px] rounded-[13px] border-0 text-white text-[15px] font-extrabold shadow-[0_7px_16px_rgba(18,101,232,0.2)] transition-all hover:-translate-y-px hover:shadow-[0_10px_22px_rgba(18,101,232,0.27)] cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#1265E8,#145DE0)' }}>
              ＋ Add Category
            </button>
          </form>
          <p className="mt-2.5 text-[13px] text-[#7386A2]">Press Enter to add or click the button.</p>
        </section>

        {/* About card */}
        <aside className="bg-white border border-[#D9E4F5] rounded-[19px] p-7 shadow-[0_5px_18px_rgba(27,51,83,0.05)] max-lg:hidden">
          <h2 className="flex items-center gap-3 text-lg font-extrabold text-[#1261DF] mb-[18px]">ⓘ About Report Categories</h2>
          <p className="text-[15px] text-[#536887] leading-relaxed">
            These categories appear in the resident report submission form. Residents can select one of these
            categories when submitting a new report.
          </p>
          <div className="h-px bg-[#DCE5F1] my-6" />
          <h3 className="flex items-center gap-3 text-lg font-extrabold text-[#1261DF] mb-[18px]">♧ Tips</h3>
          <ul className="space-y-3.5">
            {[['Keep categories clear and specific.', false],
              ['You can reorder categories by dragging.', true],
              ['Removed categories won\u2019t affect existing reports.', true]].map(([t, needsReorder]) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-[#536887] leading-relaxed">
                <span className="w-[19px] h-[19px] flex-shrink-0 mt-0.5 grid place-items-center rounded-full border-2 border-[#8EA2BE] text-[#7187A5] text-[10px] font-extrabold">✓</span>
                <span>{t}{needsReorder && !reorderMode ? ' (enable Reorder Mode above)' : ''}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Bottom actions */}
      <section className="mt-[23px] min-h-[105px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] gap-5 xl:gap-[35px] items-center p-5 xl:px-7 bg-white border border-[#E1E7F0] rounded-[19px] shadow-[0_5px_18px_rgba(27,51,83,0.06)]">
        <div className="flex items-center gap-4">
          <span className="w-[55px] h-[55px] flex-shrink-0 grid place-items-center rounded-[15px] bg-[#E9F2FF] text-[#1261DF] text-[25px]">▱</span>
          <div><div className="text-[15px] font-bold text-[#1A2D4B]">Total Categories</div><div className="mt-0.5 text-[23px] font-extrabold text-[#122343]">{draft.length}</div></div>
        </div>

        <div className="flex items-center gap-4">
          <span className="w-[55px] h-[55px] flex-shrink-0 grid place-items-center rounded-[15px] bg-[#FFF0F0] text-[#DF2C2C] text-[25px]">♜</span>
          <div><div className="text-[15px] font-bold text-[#DF2C2C]">Pending Removals</div><div className="mt-0.5 text-[23px] font-extrabold text-[#122343]">{removedCount}</div></div>
        </div>

        <button type="button" onClick={() => setConfirmTarget({ type: 'reset' })}
          className="h-[53px] px-7 rounded-[12px] border-[1.5px] border-xevera-600 bg-white text-[#1261DF] text-[15px] font-extrabold hover:bg-[#F0F6FF] transition-colors cursor-pointer whitespace-nowrap">
          ↻ Reset to Default
        </button>

        <button type="button" onClick={() => persist(draft)} disabled={!dirty || saving}
          className="xl:min-w-[190px] h-[53px] px-7 rounded-[12px] border-0 text-white text-[15px] font-extrabold shadow-[0_7px_16px_rgba(18,101,232,0.2)] transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 cursor-pointer whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg,#1265E8,#145DE0)' }}>
          ▣ {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
        </button>
      </section>

      {/* Confirm modal (remove / reset) */}
      <Modal
        open={confirmTarget !== null}
        title={confirmTarget?.type === 'reset' ? 'Reset to Default Categories' : 'Remove Category'}
        description={
          confirmTarget?.type === 'reset'
            ? 'Restore the default category list? Any unsaved changes will be discarded.'
            : `Are you sure you want to remove "${draft[confirmTarget?.index] || ''}"? Historical reports using this category will not be changed.`
        }
        confirmLabel={confirmTarget?.type === 'reset' ? 'Reset Categories' : 'Remove Category'}
        cancelLabel="Cancel"
        danger={confirmTarget?.type !== 'reset'}
        onConfirm={confirmAction}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

function StatusesSection() {
  /*
   * Read-only visualization of the hardcoded report lifecycle.
   * Colors/symbols mirror the prototype; editing is intentionally
   * not supported because ~15 endpoints enforce these values.
   */
  const STATUS_META = [
    { name: 'Pending', num: '#F59E0B', soft: 'bg-[#FFF3DC]', sym: '⌛',
      desc: 'Newly submitted, awaiting verification.', dot: 'bg-[#F59E0B]' },
    { name: 'Verified', num: '#1769E8', soft: 'bg-[#EAF2FF]', sym: '♢',
      desc: 'Confirmed valid by staff, ready for assignment.', dot: 'bg-[#1769E8]' },
    { name: 'Assigned', num: '#7C3AED', soft: 'bg-[#F1EAFF]', sym: '♙',
      desc: 'Assigned to a staff member.', dot: 'bg-[#7C3AED]' },
    { name: 'In Progress', num: '#08A4D9', soft: 'bg-[#E3F8FD]', sym: '🔧',
      desc: 'Work has started on site.', dot: 'bg-[#08A4D9]' },
    { name: 'Resolved', num: '#16A35A', soft: 'bg-[#E4F7ED]', sym: '✓',
      desc: 'Fixed; awaiting admin closure review.', dot: 'bg-[#16A35A]' },
    { name: 'Closed', num: '#64748B', soft: 'bg-[#EDF1F5]', sym: '▣',
      desc: 'Final archived state.', dot: 'bg-[#64748B]' },
  ];

  return (
    <div>
      {/* Read-only notice */}
      <div className="mt-5 flex items-start gap-4 p-[17px_21px] py-[17px] px-[21px] rounded-[13px] border border-[#F4D99C]"
        style={{ background: 'linear-gradient(90deg,#FFFAF0,#FFFDF8)' }}>
        <span className="w-11 h-11 flex-shrink-0 grid place-items-center rounded-[12px] bg-[#FFF0D1] text-[#E58A00] text-[22px]">🔒</span>
        <div className="pt-0.5">
          <div className="text-base font-extrabold text-[#B66500] mb-1">Read only.</div>
          <p className="text-sm text-[#53617A] leading-relaxed">
            The report workflow below is defined in application code and enforced by ~15 API endpoints.
            Making statuses editable would risk breaking filtering, assignment, analytics, and notifications,
            so it is shown here for reference only.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.5fr)_minmax(280px,1fr)] gap-5 mt-[18px]">

        {/* Workflow card */}
        <section className="bg-white border border-[#DCE5F2] rounded-[15px] shadow-[0_4px_16px_rgba(27,57,91,0.07)] p-7 max-sm:p-5">
          <h2 className="text-[23px] font-extrabold text-[#12203B] tracking-[-0.4px]">Report Status Workflow</h2>
          <p className="mt-1.5 text-sm text-[#526583]">This is the fixed lifecycle used by all resident reports.</p>

          {/* Timeline */}
          <div className="relative grid grid-cols-3 md:grid-cols-6 mt-8 pb-3 px-2 md:px-3.5 overflow-x-auto">
            <span aria-hidden className="hidden md:block absolute left-[8%] right-[8%] top-[25px] h-0.5 bg-[#D9E2EF]" />
            {STATUS_META.map((s, i) => (
              <div key={s.name} className="relative z-[1] flex flex-col items-center min-w-0 md:min-w-[100px]">
                <span className="w-[50px] h-[50px] grid place-items-center rounded-full text-white text-base font-extrabold border-[6px] border-white shadow-[0_2px_7px_rgba(0,0,0,0.06)]"
                  style={{ background: s.num }}>{i + 1}</span>
                <span className="mt-2 text-sm font-extrabold text-center whitespace-nowrap" style={{ color: s.num }}>{s.name}</span>
                <span className={`w-[67px] h-[67px] mt-4 grid place-items-center rounded-full text-[27px] ${s.soft}`} style={{ color: s.num }}>{s.sym}</span>
              </div>
            ))}
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[50px] gap-y-[17px] mt-7 pt-6 border-t border-[#E3E9F1]">
            {[...STATUS_META].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <div key={s.name} className="flex items-start gap-2.5 text-sm text-[#526583] leading-snug">
                <span className={`w-[9px] h-[9px] flex-shrink-0 mt-[5px] rounded-full ${s.dot}`} />
                <span><b className="text-[#12203B] font-extrabold">{s.name}</b> — {s.desc.charAt(0).toLowerCase() + s.desc.slice(1)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* About card */}
        <aside className="bg-white border border-[#DCE5F2] rounded-[15px] shadow-[0_4px_16px_rgba(27,57,91,0.07)] p-[25px]">
          <div className="flex items-start gap-3.5">
            <span className="w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[#EAF3FF] text-[#1264E8] text-[21px]">ⓘ</span>
            <h2 className="text-lg font-extrabold text-[#12203B] pt-1.5">About Status Configuration</h2>
          </div>
          <p className="mt-4 text-sm text-[#526583] leading-relaxed">
            These statuses are the backbone of the report management system and are used throughout the platform.
          </p>

          <div className="h-px bg-[#E3E9F1] my-[22px]" />

          {[
            ['⏷', 'Filtering', 'Reports can be filtered by status across all views.'],
            ['♙', 'Assignment', 'Staff assignments depend on the current status.'],
            ['▤', 'Analytics', 'Metrics and dashboards use these statuses.'],
            ['♧', 'Notifications', 'Status changes trigger automated notifications.'],
          ].map(([icon, t, d]) => (
            <div key={t} className="flex gap-3.5 mb-[18px] last:mb-0">
              <span className="w-10 h-10 flex-shrink-0 grid place-items-center rounded-[10px] bg-[#EDF4FF] text-[#1264E8] text-[19px]">{icon}</span>
              <div>
                <div className="text-sm font-extrabold text-[#12203B] mb-1">{t}</div>
                <div className="text-[13px] text-[#526583] leading-relaxed">{d}</div>
              </div>
            </div>
          ))}
        </aside>
      </div>

      {/* Summary strip */}
      <div className="mt-[18px] grid grid-cols-1 md:grid-cols-3 bg-white border border-[#DCE5F2] rounded-[15px] shadow-[0_4px_16px_rgba(27,57,91,0.07)] px-7 py-5">
        {[
          ['▱', false, '6', 'Total Statuses', 'Fixed workflow'],
          ['♧', true, 'Fixed Workflow', 'Defined in application code', 'and enforced by the system'],
          ['▣', false, 'Reference Only', 'Statuses cannot be edited', 'to ensure system integrity'],
        ].map(([icon, green, big, title, sub], i) => (
          <div key={title} className={`flex items-center gap-4 py-3 md:py-1 md:px-7 first:md:pl-0 last:md:pr-0 ${i > 0 ? 'border-t md:border-t-0 md:border-l border-[#E1E7EF]' : ''}`}>
            <span className={`w-12 h-12 flex-shrink-0 grid place-items-center rounded-[13px] text-2xl ${green ? 'bg-[#E4F7ED] text-[#16A35A]' : 'bg-[#EAF2FF] text-xevera-600'}`}>{icon}</span>
            <div className="min-w-0">
              <div className={`text-[23px] font-extrabold leading-tight whitespace-nowrap ${green ? 'text-[#16A35A]' : 'text-xevera-600'}`}>{big}</div>
              <div className="text-sm font-extrabold text-[#12203B] mt-0.5">{title}</div>
              <div className="text-xs text-[#526583] mt-0.5">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SystemSettingsPage({ section = 'general', onNavigate }) {
  /*
   * section may contain a sub-path, e.g. 'notifications/residents'.
   * Split into base (tab) + sub (inner view) so deep links restore both.
   */
  const slashIdx = section.indexOf('/');
  const baseSection = slashIdx === -1 ? section : section.slice(0, slashIdx);
  const subSection = slashIdx === -1 ? null : section.slice(slashIdx + 1);

  // Map two-factor-control to section
  const current = SECTIONS.some((s) => s.key === baseSection) ? baseSection : 'general';

  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
    setTimeout(() => setRefreshing(false), 600);
  }

  const descriptions = {
    general: 'Global portal configuration used across the public site and APIs.',
    notifications: 'Manage how notifications are delivered across the Xevera Portal.',
    'email-otp': 'Manage email delivery and OTP verification settings.',
    categories: 'Categories offered when residents submit reports.',
    statuses: 'The report lifecycle used across the platform.',
  };

  return (
    <div className="space-y-5">
      <StaffPageHeader
        eyebrow="System"
        title="System Settings"
        description={descriptions[current]}
        actions={current === 'general' && (
          <button onClick={refresh} disabled={refreshing}
            className="h-[44px] px-4 inline-flex items-center gap-2 rounded-[8px] border border-xevera-600 bg-white text-xevera-600 text-xs font-bold hover:bg-[#EDF4FF] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap">
            ↻ {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
        )}
      />

      {onNavigate && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-[5px] p-[5px] bg-white border border-[#E0E6EE] rounded-[12px] shadow-[0_2px_8px_rgba(20,33,58,0.04)]">
          {SECTIONS.map((s) => (
            <button key={s.key}
              onClick={() => onNavigate(`system-settings/${s.key}`)}
              className={`inline-flex items-center justify-center gap-2 min-h-[48px] px-3 rounded-[9px] text-[13px] font-semibold border-none cursor-pointer transition-colors ${
                current === s.key ? 'bg-xevera-600 text-white shadow-[0_4px_12px_rgba(18,100,232,0.25)]' : 'bg-transparent text-[#455671] hover:bg-[#F5F8FC]'
              }`}>
              <Icon name={s.icon} size={15} />
              {s.label}
            </button>
          ))}
        </div>
      )}

      {current === 'general' && <GeneralSection refreshKey={refreshTick} />}
      {current === 'notifications' && <NotificationsSection onNavigate={onNavigate} sub={subSection} />}
      {current === 'email-otp' && <EmailOtpSection />}
      {current === 'categories' && <CategoriesSection refreshKey={refreshTick} />}
      {current === 'statuses' && <StatusesSection />}
    </div>
  );
}

