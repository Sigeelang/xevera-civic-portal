import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import StaffPageHeader from '../../components/StaffPageHeader';
import { SkeletonRows } from '../../components/dashboard/Skeleton';

/*
 * My Notifications (Staff / Admin / Super Admin).
 * Design per prototype: filter toolbar with live counts, date-grouped
 * list on the left, detail panel on the right with Mark-as-read /
 * Delete actions, and a Filter modal (category + read status).
 */

const CATEGORIES = [
  ['all', '👥 All'],
  ['resident', '🏠 Resident'],
  ['staff', '💼 Staff'],
  ['report', '▣ Report'],
  ['contact', '✉ Contact'],
];

function typeInfo(type) {
  const t = String(type || '');
  if (/attendance|time_in|time_out/.test(t)) return { icon: '♟', cls: 'bg-[#FFF3DF] text-[#F28B17]' };
  if (/resident|register/.test(t)) return { icon: '♙', cls: 'bg-[#F1EAFF] text-[#7C4DFF]' };
  if (/announcement/.test(t)) return { icon: '📣', cls: 'bg-[#EAF9F1] text-[#20A466]' };
  if (/maintenance/.test(t)) return { icon: '⚒', cls: 'bg-[#FFF3DF] text-[#ED8A00]' };
  if (/contact/.test(t)) return { icon: '✉', cls: 'bg-[#EDF5FF] text-[#1769ED]' };
  if (/direct_message/.test(t)) return { icon: '✉', cls: 'bg-[#E4F8EF] text-[#14A565]' };
  if (/report|comment|like|follow|status/.test(t)) return { icon: '▤', cls: 'bg-[#EDF5FF] text-xevera-600' };
  return { icon: '🔔', cls: 'bg-[#FFF3DF] text-[#4B4592]' };
}

function categoryOf(type) {
  const t = String(type || '');
  if (/attendance/.test(t)) return 'staff';
  if (/resident|register/.test(t)) return 'resident';
  if (/message|direct|contact/.test(t)) return 'contact';
  if (/report|comment|like|follow|status/.test(t)) return 'report';
  return 'guest';
}

function typeLabel(type) {
  return String(type || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (same(d, yesterday)) return 'Yesterday, ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function NotificationsPage({ onViewReport }) {
  const showToast = useToast();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');   // modal read-status
  const [appliedRead, setAppliedRead] = useState('all'); // active read-status filter
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('notifications/list.php?limit=50')
      .then((d) => {
        const list = d.items || [];
        setItems(list);
        setUnread(d.unread || 0);
        setSelectedId((prev) => (prev !== null && list.some((n) => n.id === prev) ? prev : null));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, appliedRead]);

  const counts = useMemo(() => {
    const c = { all: items.length, guest: 0, resident: 0, staff: 0, report: 0, contact: 0 };
    items.forEach((n) => { c[categoryOf(n.type)]++; });
    return c;
  }, [items]);

  const filtered = useMemo(() => items.filter((n) => {
    const catMatch = filter === 'all' || categoryOf(n.type) === filter;
    const readMatch = appliedRead === 'all'
      || (appliedRead === 'read' && n.read)
      || (appliedRead === 'unread' && !n.read);
    return catMatch && readMatch;
  }), [items, filter, appliedRead]);

  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * perPage, current * perPage);

  const groups = useMemo(() => {
    const order = [];
    const map = {};
    pageItems.forEach((n) => {
      const day = dayLabel(n.date);
      if (!map[day]) { map[day] = { label: day, items: [] }; order.push(day); }
      map[day].items.push(n);
    });
    return order.map((k) => map[k]);
  }, [pageItems]);

  const selected = items.find((n) => n.id === selectedId) || null;
  const selInfo = selected ? typeInfo(selected.type) : null;

  async function markOne(n) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await apiFetch('notifications/mark-read.php', { method: 'POST', body: { id: n.id } }); } catch {}
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await apiFetch('notifications/mark-read.php', { method: 'POST', body: { id: 'all' } });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      showToast('All notifications marked as read.');
    } catch { showToast('Could not mark notifications.', 'error'); } finally {
      setMarkingAll(false);
    }
  }

  async function deleteSelected() {
    if (!selected || deleting) return;
    setDeleting(true);
    try {
      await apiFetch('notifications/delete.php', { method: 'POST', body: { id: selected.id } });
      setItems((prev) => prev.filter((n) => n.id !== selected.id));
      setSelectedId(null);
      showToast('Notification deleted.');
    } catch (err) {
      showToast(err.message || 'Could not delete notification.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function selectNotification(n) {
    setSelectedId(n.id);
    markOne(n);
  }

  function applyModalFilter() {
    setFilter(filter); // category select shares state with buttons
    setAppliedRead(readFilter);
    setPage(1);
    setFilterOpen(false);
    showToast('Notification filter applied.');
  }

  function clearFilters() {
    setFilter('all');
    setReadFilter('all');
    setAppliedRead('all');
    setPage(1);
    setFilterOpen(false);
    showToast('Filters cleared.');
  }

  const selCategory = selected ? categoryOf(selected.type) : '';

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-5">
      <StaffPageHeader
        eyebrow="Account"
        title="My Notifications"
        description="Stay updated with the latest activities and important updates."
        actions={unread > 0 ? (
          <span className="inline-flex items-center gap-2 h-[42px] px-[17px] rounded-full bg-xevera-600 text-white text-[13px] font-extrabold shadow-[0_6px_16px_rgba(20,104,243,0.18)]">
            🔔 {unread} new
          </span>
        ) : null}
      />

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          {CATEGORIES.map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1); }}
              className={`h-[45px] px-[17px] inline-flex items-center gap-2 rounded-[11px] border text-[13px] font-bold transition-all cursor-pointer ${filter === key ? 'bg-xevera-600 border-xevera-600 text-white shadow-[0_5px_14px_rgba(20,104,243,0.18)]' : 'bg-white border-[#DCE5F1] text-[#12366F] hover:border-[#A9C8FF] hover:-translate-y-px'}`}>
              {label} <span className={`text-xs opacity-80 ${filter === key ? '' : ''}`}>{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2.5">
          <button onClick={markAll} disabled={markingAll || unread === 0}
            className="h-[45px] px-[17px] min-w-[160px] inline-flex items-center justify-center gap-2 rounded-[11px] border border-[#DCE5F1] bg-white text-[#12366F] text-[13px] font-bold transition-all hover:border-[#A9C8FF] hover:-translate-y-px disabled:opacity-50 cursor-pointer">
            ✓ Mark all as read
          </button>
          <button onClick={() => setFilterOpen(true)}
            className="h-[45px] px-[17px] min-w-[160px] inline-flex items-center justify-center gap-2 rounded-[11px] border border-[#DCE5F1] bg-white text-[#12366F] text-[13px] font-bold transition-all hover:border-[#A9C8FF] hover:-translate-y-px cursor-pointer">
            ☰ Filter
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <main className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,1fr)] gap-5 items-start">

        {/* LEFT LIST */}
        <section className="bg-white border border-[#DCE5F1] rounded-[16px] overflow-hidden shadow-[0_5px_18px_rgba(24,55,95,0.035)]">
          {loading ? (
            <div className="p-5"><SkeletonRows rows={7} height="h-14" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-[70px] px-6 text-center text-[#627392]">
              <div className="text-[45px] mb-3.5">🔔</div>
              <h3 className="font-bold text-[#142544]">No notifications found</h3>
              <p className="mt-1">Try changing your filters.</p>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.label}>
                  <div className="h-[54px] flex items-center gap-2.5 px-[27px] text-[13px] font-extrabold bg-[#FBFCFE] border-b border-[#DCE5F1]">
                    📅 {g.label}
                  </div>
                  {g.items.map((n) => {
                    const info = typeInfo(n.type);
                    const isSelected = selectedId === n.id;
                    return (
                      <button key={n.id} onClick={() => selectNotification(n)}
                        className={`w-full grid grid-cols-[56px_minmax(0,1fr)_auto_15px] gap-4 items-center px-[25px] py-[15px] border-b border-[#DCE5F1] last:border-b-0 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#EDF5FF]' : n.read ? 'opacity-70 hover:bg-[#F8FBFF]' : 'hover:bg-[#F8FBFF]'
                        }`}>
                        <span className={`w-[46px] h-[46px] rounded-full grid place-items-center text-xl flex-shrink-0 ${info.cls}`}>{info.icon}</span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-extrabold text-[#142544] truncate mb-1 ${n.read ? '' : ''}`}>{n.message}</span>
                          <span className="block text-xs text-[#7283A0] truncate">{typeLabel(n.type)}</span>
                        </span>
                        <span className="text-[11px] text-[#7385A3] whitespace-nowrap">{timeLabel(n.date)}</span>
                        <span className={`w-[9px] h-[9px] rounded-full ${n.read ? 'invisible' : 'bg-xevera-600'}`} />
                      </button>
                    );
                  })}
                </section>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-end gap-2 py-[17px] px-[25px]">
                  <button onClick={() => setPage(Math.max(1, current - 1))} disabled={current <= 1}
                    className="w-9 h-9 rounded-[9px] border border-[#DCE5F1] bg-white text-[#12366F] text-xs font-bold hover:border-[#8FBAFF] disabled:opacity-40 cursor-pointer">←</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-9 h-9 rounded-[9px] border text-xs font-bold cursor-pointer ${n === current ? 'bg-xevera-600 text-white border-xevera-600' : 'bg-white border-[#DCE5F1] text-[#12366F] hover:border-[#8FBAFF]'}`}>{n}</button>
                  ))}
                  <button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current >= totalPages}
                    className="w-9 h-9 rounded-[9px] border border-[#DCE5F1] bg-white text-[#12366F] text-xs font-bold hover:border-[#8FBAFF] disabled:opacity-40 cursor-pointer">→</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* RIGHT DETAIL PANEL */}
        <aside className="bg-white border border-[#DCE5F1] rounded-[16px] shadow-[0_5px_18px_rgba(24,55,95,0.035)] min-h-[500px] xl:min-h-[735px] overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 min-h-[500px] xl:min-h-[735px] flex flex-col items-center justify-center p-[35px] text-center">
              <div className="relative w-[150px] h-[150px] rounded-full bg-[#F1F7FF] grid place-items-center text-[66px] mb-6">
                🔔
                {unread > 0 && (
                  <span className="absolute right-[17px] top-[17px] w-[34px] h-[34px] rounded-full bg-[#ED453B] text-white grid place-items-center font-extrabold text-sm">{unread > 9 ? '9+' : unread}</span>
                )}
              </div>
              <h2 className="text-xl font-bold text-[#142544] mb-2.5">Select a notification</h2>
              <p className="text-sm text-[#627392]">Click an item on the left to view details.</p>
              <div className="mt-5 w-full max-w-[320px] p-[18px] rounded-[12px] bg-[#F3F8FF] border border-[#CFE1FF] text-left">
                <div className="text-[13px] font-extrabold text-[#12366F] mb-1.5">💡 Tip</div>
                <div className="text-[13px] text-[#52688D] leading-relaxed">Use filters above to narrow down notifications by type or category.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="p-[26px] border-b border-[#DCE5F1]">
                <div className="flex justify-between gap-5">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-[0.8px] text-xevera-600 mb-2">{selCategory}</div>
                    <h2 className="text-[21px] font-bold text-[#142544] leading-snug mb-2">{selInfo.icon} {typeLabel(selected.type)}</h2>
                    <div className="text-xs text-[#627392]">{timeLabel(selected.date)}</div>
                  </div>
                  <button onClick={() => setSelectedId(null)} aria-label="Close"
                    className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-[9px] border-none bg-[#F1F5FA] text-[#142544] hover:bg-[#E7EEF8] cursor-pointer">✕</button>
                </div>
              </div>

              {/* Detail body */}
              <div className="p-[27px] flex-1">
                <div className="mb-[25px]">
                  <h3 className="text-[13px] font-bold text-[#142544] mb-2">Message</h3>
                  <p className="text-sm text-[#627392] leading-relaxed">{selected.message}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-[#DCE5F1] rounded-[11px] p-[15px]">
                    <div className="text-[11px] text-[#8190AA] mb-1">Category</div>
                    <div className="text-[13px] font-bold text-[#142544] capitalize">{selCategory}</div>
                  </div>
                  <div className="border border-[#DCE5F1] rounded-[11px] p-[15px]">
                    <div className="text-[11px] text-[#8190AA] mb-1">Status</div>
                    <div className="text-[13px] font-bold text-[#142544]">{selected.read ? 'Read' : 'Unread'}</div>
                  </div>
                  {selected.report_id && (
                    <div className="border border-[#DCE5F1] rounded-[11px] p-[15px]">
                      <div className="text-[11px] text-[#8190AA] mb-1">Reference</div>
                      <div className="text-[13px] font-bold text-[#142544]">Report #{selected.report_id}</div>
                    </div>
                  )}
                  <div className="border border-[#DCE5F1] rounded-[11px] p-[15px]">
                    <div className="text-[11px] text-[#8190AA] mb-1">Type</div>
                    <div className="text-[13px] font-bold text-[#142544] capitalize">{typeLabel(selected.type)}</div>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="mt-auto p-5 px-[27px] border-t border-[#DCE5F1] flex flex-wrap gap-2.5">
                {selected.report_id && onViewReport && (
                  <button onClick={() => { markOne(selected); onViewReport(selected.report_id); }}
                    className="h-[42px] px-4 rounded-[9px] border border-[#1468F3] bg-xevera-600 text-white text-[13px] font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
                    View Report ↗
                  </button>
                )}
                <button onClick={() => markOne(selected)} disabled={selected.read}
                  className="h-[42px] px-4 rounded-[9px] border border-[#A9C8FF] bg-white text-xevera-600 text-[13px] font-bold hover:bg-[#EDF5FF] disabled:opacity-50 transition-colors cursor-pointer">
                  ✓ Mark as read
                </button>
                <button onClick={deleteSelected} disabled={deleting}
                  className="h-[42px] px-4 rounded-[9px] border border-[#F3C4C4] bg-white text-[#E65050] text-[13px] font-bold hover:bg-[#FFF4F4] disabled:opacity-50 transition-colors cursor-pointer">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {/* FILTER MODAL */}
      {filterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-[15px] bg-[rgba(15,32,60,0.35)]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFilterOpen(false); }}>
          <div className="w-full max-w-[460px] rounded-[16px] bg-white shadow-[0_25px_70px_rgba(10,30,70,0.2)] overflow-hidden">
            <div className="p-5 px-[22px] flex items-center justify-between border-b border-[#DCE5F1]">
              <h2 className="text-lg font-bold text-[#142544]">Filter Notifications</h2>
              <button onClick={() => setFilterOpen(false)} aria-label="Close"
                className="w-[34px] h-[34px] grid place-items-center rounded-[8px] border-none bg-[#F1F4F8] text-[#142544] hover:bg-[#E7EEF8] cursor-pointer">✕</button>
            </div>

            <div className="p-[22px] space-y-[17px]">
              <div>
                <label className="block text-[13px] font-bold mb-2 text-[#142544]">Category</label>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                  className="w-full h-[43px] px-3 rounded-[9px] border border-[#DCE5F1] bg-white text-[#142544] outline-none focus:border-xevera-600 cursor-pointer">
                  <option value="all">All categories</option>
                  {CATEGORIES.filter(([k]) => k !== 'all').map(([k, label]) => (
                    <option key={k} value={k}>{label.replace(/^[^\s]+\s/, '')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold mb-2 text-[#142544]">Read status</label>
                <select value={readFilter} onChange={(e) => setReadFilter(e.target.value)}
                  className="w-full h-[43px] px-3 rounded-[9px] border border-[#DCE5F1] bg-white text-[#142544] outline-none focus:border-xevera-600 cursor-pointer">
                  <option value="all">All notifications</option>
                  <option value="unread">Unread only</option>
                  <option value="read">Read only</option>
                </select>
              </div>
            </div>

            <div className="px-[22px] py-4 border-t border-[#DCE5F1] flex justify-end gap-2.5">
              <button onClick={clearFilters}
                className="h-[42px] px-[17px] rounded-[9px] border border-[#DCE5F1] bg-white text-[#12366F] text-[13px] font-bold hover:border-[#A9C8FF] cursor-pointer">Clear</button>
              <button onClick={applyModalFilter}
                className="h-[42px] px-[17px] rounded-[9px] border border-xevera-600 bg-xevera-600 text-white text-[13px] font-bold hover:bg-xevera-700 cursor-pointer">Apply Filter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
