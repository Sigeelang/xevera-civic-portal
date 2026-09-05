import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import { useResidentNotifications } from '../../context/ResidentNotificationsContext';
import { currentDayLabel } from '../../utils/notificationFormat';

/*
 * Icon + tone map for each notification type. Anything not listed
 * falls back to the generic `bell` so unknown types still render cleanly.
 *
 * `iconBox` and `badge` use inline Tailwind so the styles work without
 * a custom stylesheet; `tint` is the brand color used by the badges.
 */
const NOTIF_META = {
  announcement:     { icon: 'megaphone', iconBox: 'bg-[#FFF4DF] text-[#E99A00]',                     badge: 'bg-[#FFF4DF] text-[#B86B00] border border-[#FBE3B5]', label: 'Announcement' },
  direct_message:   { icon: 'letter',    iconBox: 'bg-[#EAF2FF] text-[#1769FF]',                     badge: 'bg-[#EAF2FF] text-[#1769FF] border border-[#C9DDFF]', label: 'Message' },
  message:          { icon: 'letter',    iconBox: 'bg-[#EAF2FF] text-[#1769FF]',                     badge: 'bg-[#EAF2FF] text-[#1769FF] border border-[#C9DDFF]', label: 'Message' },
  contact:          { icon: 'phone',     iconBox: 'bg-[#F1EAFF] text-[#7048DC]',                     badge: 'bg-[#F1EAFF] text-[#7048DC] border border-[#DCC9F7]', label: 'Contact' },
  contact_message:  { icon: 'phone',     iconBox: 'bg-[#F1EAFF] text-[#7048DC]',                     badge: 'bg-[#F1EAFF] text-[#7048DC] border border-[#DCC9F7]', label: 'Contact' },
  contact_reply:    { icon: 'phone',     iconBox: 'bg-[#F1EAFF] text-[#7048DC]',                     badge: 'bg-[#F1EAFF] text-[#7048DC] border border-[#DCC9F7]', label: 'Contact' },
  report_status:    { icon: 'file',      iconBox: 'bg-[#E7F8EF] text-[#18A56B]',                     badge: 'bg-[#E7F8EF] text-[#159660] border border-[#C8E9D6]', label: 'Report Update' },
  report_assigned:  { icon: 'wrench',    iconBox: 'bg-[#E7F8EF] text-[#18A56B]',                     badge: 'bg-[#E7F8EF] text-[#159660] border border-[#C8E9D6]', label: 'Report Update' },
  report:           { icon: 'file',      iconBox: 'bg-[#E7F8EF] text-[#18A56B]',                     badge: 'bg-[#E7F8EF] text-[#159660] border border-[#C8E9D6]', label: 'Report Update' },
  comment:          { icon: 'chat',      iconBox: 'bg-[#EAF2FF] text-[#1769FF]',                     badge: 'bg-[#EAF2FF] text-[#1769FF] border border-[#C9DDFF]', label: 'Comment' },
  like:             { icon: 'thumbsup',  iconBox: 'bg-[#E7F8EF] text-[#18A56B]',                     badge: 'bg-[#E7F8EF] text-[#159660] border border-[#C8E9D6]', label: 'Like' },
  follow:           { icon: 'pin',       iconBox: 'bg-[#FFF4DF] text-[#E99A00]',                     badge: 'bg-[#FFF4DF] text-[#B86B00] border border-[#FBE3B5]', label: 'Follow' },
  maintenance:      { icon: 'wrench',    iconBox: 'bg-[#FFF4DF] text-[#E99A00]',                     badge: 'bg-[#FFF4DF] text-[#B86B00] border border-[#FBE3B5]', label: 'Maintenance' },
  system:           { icon: 'gear',      iconBox: 'bg-[#F1EAFF] text-[#7048DC]',                     badge: 'bg-[#F1EAFF] text-[#7048DC] border border-[#DCC9F7]', label: 'System' },
};

function metaFor(type) {
  return NOTIF_META[type] || { icon: 'bell', iconBox: 'bg-[#EEF2F8] text-[#7283A0]', badge: 'bg-[#F1F5FB] text-[#52647F] border border-[#E2E8F0]', label: 'System' };
}

function categorize(type) {
  if (type === 'announcement') return 'announcement';
  if (type === 'direct_message' || type === 'message' || type === 'comment' || type === 'contact' || type === 'contact_message' || type === 'contact_reply') return 'message';
  if (
    type === 'report_status' ||
    type === 'report_assigned' ||
    type === 'report' ||
    type === 'like' ||
    type === 'follow' ||
    type === 'maintenance'
  ) return 'report';
  return 'system';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getThisWeekCount(items) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return items.filter((n) => {
    const d = new Date(n.date);
    return !isNaN(d.getTime()) && d >= start;
  }).length;
}

function getArchivedCount(items) {
  return items.filter((n) => n.read).length;
}

function formatDayLabel(label) {
  if (!label) return '';
  const upper = label.toUpperCase();
  if (upper === 'TODAY' || upper === 'YESTERDAY' || upper === 'EARLIER') return upper;
  return label.toUpperCase();
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'report', label: 'Reports' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'system', label: 'System' },
];

export default function ResidentNotificationsPage({ onNavigate, onViewReport }) {
  const { notifs, notifUnread, markAllRead, markRead, openNotif, loading } = useResidentNotifications();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  /*
   * Viewing = reading: visiting the notifications page clears the
   * top-bar badge automatically after a short delay.
   */
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;
  useEffect(() => {
    const t = setTimeout(() => { try { markAllReadRef.current(); } catch {} }, 2000);
    return () => clearTimeout(t);
  }, []);

  const stats = useMemo(() => {
    const total = notifs.length;
    const unread = notifUnread;
    const thisWeek = getThisWeekCount(notifs);
    const archived = getArchivedCount(notifs);
    return { total, unread, thisWeek, archived };
  }, [notifs, notifUnread]);

  const filtered = useMemo(() => {
    let list = notifs.slice();
    if (filter === 'unread') list = list.filter((n) => !n.read);
    else if (filter !== 'all') list = list.filter((n) => categorize(n.type) === filter);

    list.sort((a, b) => {
      const ta = new Date(a.date).getTime() || 0;
      const tb = new Date(b.date).getTime() || 0;
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [notifs, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const grouped = useMemo(() => {
    const order = [];
    const map = {};
    pageItems.forEach((n) => {
      const day = formatDayLabel(currentDayLabel(n.date));
      if (!map[day]) { map[day] = []; order.push(day); }
      map[day].push(n);
    });
    return order.map((k) => ({ label: k, items: map[k] }));
  }, [pageItems]);

  const total = filtered.length;
  const showing = total === 0 ? '0' : `${pageStart + 1} to ${Math.min(pageStart + PAGE_SIZE, total)}`;
  const onItemClick = (n) => { openNotif(n); };

  return (
    <ResidentLayout activePage="notifications" onNavigate={onNavigate} fullWidth>
      <div className="px-6 sm:px-7 lg:px-8 py-6 lg:py-8 max-w-[1250px] mx-auto">
        {/* PAGE HEADER */}
        <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
          <div>
            <div className="text-[10px] font-extrabold tracking-[1.5px] uppercase text-[#1769FF] mb-2">
              Resident Portal
            </div>
            <h1 className="text-[30px] leading-[1.15] font-extrabold text-[#102D59] mb-1.5">
              My Notifications
            </h1>
            <p className="text-[13px] text-[#7283A0]">
              Stay updated with important alerts and activities.
            </p>
          </div>
          {notifUnread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 border border-[#CBDCF7] bg-white text-[#1769FF] px-4 py-2.5 rounded-[10px] text-[12px] font-bold hover:bg-[#EDF4FF] transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Icon name="check" size={12} /> Mark all as read
            </button>
          )}
        </section>

        {/* STATS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-6">
          <StatCard icon="bell" iconBox="bg-[#EAF2FF] text-[#1769FF]" title="All Notifications" value={stats.total} desc="Total notifications" />
          <StatCard icon="letter" iconBox="bg-[#FFF4DF] text-[#E99A00]" title="Unread" value={stats.unread} desc="Unread notifications" />
          <StatCard icon="check" iconBox="bg-[#E7F8EF] text-[#18A56B]" title="This Week" value={stats.thisWeek} desc="Notifications this week" />
          <StatCard icon="archive" iconBox="bg-[#F1EAFF] text-[#7048DC]" title="Archived" value={stats.archived} desc="Read notifications" />
        </section>

        {/* NOTIFICATION PANEL */}
        <section className="bg-white border border-[#DFE7F2] rounded-[16px] shadow-[0_7px_22px_rgba(30,60,100,0.04)] overflow-hidden">
          {/* FILTERS */}
          <div className="min-h-[72px] px-4 sm:px-[18px] py-4 flex items-center gap-2.5 border-b border-[#DFE7F2] overflow-x-auto">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count =
                f.key === 'unread'
                  ? stats.unread
                  : f.key === 'all'
                    ? stats.total
                    : notifs.filter((n) => categorize(n.type) === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setPage(1); }}
                  className={`h-[38px] px-4 rounded-[9px] border text-[12px] font-extrabold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-[#1769FF] border-[#1769FF] text-white'
                      : 'bg-white border-[#DFE7F2] text-[#52647F] hover:border-[#B7CEF5]'
                  }`}
                >
                  {f.label}
                  {f.key === 'unread' && count > 0 && (
                    <span className={`inline-grid place-items-center w-[18px] h-[18px] rounded-full text-[9px] font-extrabold ${active ? 'bg-white text-[#1769FF]' : 'bg-[#1769FF] text-white'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-2">
              <label className="hidden sm:inline text-[11px] font-bold text-[#7283A0]">Sort:</label>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="h-[38px] px-3 min-w-[145px] border border-[#DFE7F2] bg-white rounded-[9px] text-[#102D59] text-[12px] font-bold cursor-pointer"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          {/* LIST */}
          <div className="p-4 sm:p-[18px]">
            {loading && notifs.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[92px] bg-[#F3F6FB] rounded-[13px] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center">
                <span className="w-14 h-14 mx-auto rounded-full bg-[#EAF2FF] text-[#1769FF] flex items-center justify-center mb-3 shadow-[inset_0_-2px_0_rgba(0,0,0,0.04)]">
                  <Icon name="bell" size={26} strokeWidth={2.2} />
                </span>
                <p className="text-[14px] font-extrabold text-[#102D59]">No notifications found</p>
                <p className="text-[12px] text-[#7283A0] mt-1.5">
                  {notifs.length === 0 ? 'Updates about your reports and the community will appear here.' : 'Try a different filter.'}
                </p>
              </div>
            ) : (
              <div>
                {grouped.map((g) => (
                  <div key={g.label} className="mb-3 last:mb-0">
                    <div className="text-[10px] font-extrabold tracking-[1px] uppercase text-[#687993] my-2.5 first:mt-0">
                      {g.label}
                    </div>
                    <div className="border border-[#DFE7F2] rounded-[13px] overflow-hidden bg-white">
                      {g.items.map((n, idx) => {
                        const m = metaFor(n.type);
                        return (
                          <button
                            key={n.id}
                            onClick={() => onItemClick(n)}
                            className={`group w-full text-left flex items-center gap-4 min-h-[92px] px-4 py-4 cursor-pointer transition-colors hover:bg-[#FBFDFF] bg-transparent border-0 ${
                              idx > 0 ? 'border-t border-[#DFE7F2]' : ''
                            } ${n.read ? '' : 'bg-[#F4F8FF]/60'}`}
                          >
                            <span className={`w-12 h-12 flex-shrink-0 rounded-full grid place-items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.04)] ${m.iconBox} ${n.read ? 'opacity-90' : 'ring-2 ring-white shadow-[0_4px_10px_rgba(23,105,255,0.12)]'}`}>
                              <Icon name={m.icon} size={20} strokeWidth={2.2} />
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className={`text-[13px] leading-snug ${n.read ? 'text-[#52647F] font-bold' : 'text-[#102D59] font-extrabold'}`}>
                                {n.message}
                              </div>
                              <div className="text-[10.5px] text-[#8290A7] mt-1.5">
                                {formatTime(n.date)}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-[0.06em] uppercase whitespace-nowrap ${m.badge}`}>
                                {m.label}
                              </span>
                              {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-[#1769FF] shadow-[0_0_0_3px_rgba(23,105,255,0.18)]" />}
                              <span className="hidden sm:inline text-[#74839B] text-[16px] group-hover:text-[#1769FF]">⋮</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FOOTER */}
          {filtered.length > 0 && (
            <div className="min-h-[66px] border-t border-[#DFE7F2] px-4 sm:px-[18px] py-3 flex items-center justify-between">
              <div className="text-[11px] text-[#7283A0]">
                Showing {showing} of {total} notifications
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="w-9 h-9 border border-[#DFE7F2] rounded-[9px] bg-white text-[#7283A0] cursor-pointer hover:border-[#B7CEF5] hover:text-[#1769FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 border rounded-[9px] text-[12px] font-bold transition-colors cursor-pointer ${
                      p === safePage
                        ? 'bg-[#1769FF] border-[#1769FF] text-white'
                        : 'bg-white border-[#DFE7F2] text-[#7283A0] hover:border-[#B7CEF5] hover:text-[#1769FF]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="w-9 h-9 border border-[#DFE7F2] rounded-[9px] bg-white text-[#7283A0] cursor-pointer hover:border-[#B7CEF5] hover:text-[#1769FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </ResidentLayout>
  );
}

function StatCard({ icon, iconBox, title, value, desc }) {
  return (
    <div className="bg-white border border-[#DFE7F2] rounded-[15px] p-[22px] min-h-[120px] flex items-center gap-4 shadow-[0_5px_18px_rgba(30,60,100,0.04)]">
      <span className={`w-[52px] h-[52px] flex-shrink-0 rounded-full grid place-items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.04)] ${iconBox}`}>
        <Icon name={icon} size={22} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[#7283A0] mb-1.5">{title}</div>
        <div className="text-[25px] font-extrabold text-[#102D59] leading-none mb-1">{value}</div>
        <div className="text-[10px] text-[#7283A0]">{desc}</div>
      </div>
    </div>
  );
}
