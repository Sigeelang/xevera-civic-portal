import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import ServiceBanner from '../../components/public/ServiceBanner';

const BADGE_META = {
  general: { label: 'General', cls: 'bg-[#EDF3FB] text-[#526987]' },
  maintenance: { label: 'Maintenance', cls: 'bg-[#FFF1DE] text-[#DF7300]' },
  safety: { label: 'Safety', cls: 'bg-[#F0E9FF] text-[#673CE4]' },
  events: { label: 'Events', cls: 'bg-[#E9F2FF] text-[#1769FF]' },
  garbage: { label: 'Garbage', cls: 'bg-[#E8F8EE] text-[#149657]' },
  advisory: { label: 'Advisory', cls: 'bg-[#F0EAFF] text-[#6839DC]' },
};

const CARD_TONE = {
  garbage: { wrap: 'bg-[#EAF9F0] text-[#149657]', icon: 'trash' },
  maintenance: { wrap: 'bg-[#FFF3E4] text-[#DF7300]', icon: 'wrench' },
  safety: { wrap: 'bg-[#F1EBFF] text-[#673CE4]', icon: 'shield' },
  events: { wrap: 'bg-[#EAF3FF] text-[#1769FF]', icon: 'calendar' },
  advisory: { wrap: 'bg-[#F2ECFF] text-[#6839DC]', icon: 'megaphone' },
  general: { wrap: 'bg-[#EDF5FF] text-[#1769FF]', icon: 'megaphone' },
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'safety', label: 'Safety' },
  { key: 'events', label: 'Events' },
  { key: 'garbage', label: 'Garbage Schedule' },
  { key: 'advisory', label: 'Advisory' },
];

function classify(cat) {
  const k = String(cat || '').toLowerCase().trim();
  if (k === 'event' || k === 'events') return 'events';
  if (k === 'advisory') return 'advisory';
  if (k === 'maintenance') return 'maintenance';
  if (k === 'safety') return 'safety';
  if (k === 'garbage' || k === 'garbage schedule') return 'garbage';
  if (k === 'general') return 'general';
  return 'general';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventParts(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '', day: '' };
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

export default function GuestAnnouncementsPage({ onNavigate, focusId }) {
  const { user } = useAuth();
  const isResident = user?.role === 'Resident';
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      apiFetch('announcements/list.php'),
      apiFetch('community/events.php?limit=10'),
      apiFetch('maintenance/public.php'),
    ])
      .then(([ann, ev, maint]) => {
        setItems(Array.isArray(ann) ? ann : []);
        setEvents((ev && ev.items) || []);
        setUpdates((maint && maint.items) || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const appliedFocus = useRef(null);
  useEffect(() => {
    if (!focusId || loading || items.length === 0) return;
    if (appliedFocus.current === focusId) return;
    const found = items.find((a) => String(a.id) === String(focusId));
    if (found) {
      appliedFocus.current = focusId;
      setSelected(found);
    }
  }, [focusId, loading, items]);

  const filtered = useMemo(() => {
    let list = items.slice();
    if (filter !== 'all') list = list.filter((a) => classify(a.category) === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((a) => String(a.title || '').toLowerCase().includes(q) || String(a.content || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime() || 0;
      const tb = new Date(b.created_at).getTime() || 0;
      return sort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [items, filter, query, sort]);

  function badgeFor(cat) { return BADGE_META[classify(cat)] || BADGE_META.general; }
  function toneFor(cat) { return CARD_TONE[classify(cat)] || CARD_TONE.general; }

  const onSite = (onNavigate && typeof onNavigate === 'function') ? onNavigate : null;

  if (selected) {
    const meta = badgeFor(selected.category);
    const dateLabel = formatDate(selected.created_at) || '—';
    const posterInitials = (selected.author_name || 'X').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    return (
      <div className="px-6 sm:px-7 lg:px-8 py-6 lg:py-8 max-w-[1320px] mx-auto">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-2 bg-none border-none text-[#1769FF] text-[14px] font-extrabold cursor-pointer hover:-translate-x-[2px] hover:text-[#0D55D9] transition-transform mb-5"
        >
          <span className="text-[20px] leading-none">←</span> Back to Announcements
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_minmax(310px,0.85fr)] gap-6 items-start">
          <article className="bg-white border border-[#DCE5F1] rounded-[18px] shadow-[0_8px_24px_rgba(20,60,110,0.06)] overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold tracking-[0.04em] mb-4 ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <h1 className="text-[clamp(26px,3.4vw,40px)] leading-[1.1] font-extrabold text-[#102957] tracking-[-0.035em] mb-4">
                    {selected.title}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2.5 text-[13px] text-[#526789]">
                    <span className="w-9 h-9 rounded-full grid place-items-center text-white text-[12px] font-extrabold" style={{ background: 'linear-gradient(135deg,#1D6DFF,#6CA2FF)' }}>{posterInitials}</span>
                    <span>Posted by</span>
                    <span className="font-bold text-[#102957]">{selected.author_name || 'Community'}</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#3159D8] bg-[#EDF2FF]">✓ Verified</span>
                  </div>
                </div>
                <div className="flex-shrink-0 min-w-[170px] px-4 py-4 border border-[#DCE5F1] rounded-[14px]" style={{ background: 'linear-gradient(135deg,#F8FBFF,#F1F6FF)' }}>
                  <div className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#1769FF]">Published</div>
                  <div className="mt-1 text-[16px] font-extrabold text-[#102957]">{dateLabel}</div>
                </div>
              </div>

              {selected.cover_image ? (
                <img src={uploadUrl(selected.cover_image)} alt={selected.title} className="mt-6 w-full max-h-[380px] object-cover rounded-[14px] border border-[#DCE5F1]" />
              ) : null}

              <p className="mt-6 text-[15px] sm:text-[16px] leading-[1.7] text-[#162B56] whitespace-pre-line">
                {selected.content}
              </p>

              {/* Structured schedule - publication kept separate from collection schedule */}
              {(selected.schedule_label || selected.schedule_time || selected.recurrence || selected.area) && (
                <div className="mt-6 rounded-[14px] border border-[#DCE5F1] overflow-hidden">
                  <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#F8FBFF,#F1F6FF)' }}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1769FF]">Schedule</div>
                    {String(selected.category || '').toLowerCase() === 'garbage' && (
                      <div className="mt-2 text-[18px] font-extrabold text-[#102957]">🗑️ Garbage Collection</div>
                    )}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><div className="text-[10px] font-bold text-[#71809A] uppercase">Day</div><div className="text-[14px] font-extrabold text-[#102957]">{selected.schedule_label || '—'}</div></div>
                      <div><div className="text-[10px] font-bold text-[#71809A] uppercase">Time</div><div className="text-[14px] font-extrabold text-[#102957]">{selected.schedule_time || '—'}</div></div>
                      <div><div className="text-[10px] font-bold text-[#71809A] uppercase">Recurrence</div><div className="text-[14px] font-extrabold text-[#102957]">{selected.recurrence || '—'}</div></div>
                    </div>
                    <div className="mt-3 text-[12px] text-[#526789]"><span className="font-extrabold text-[#102957]">Applies to:</span> {selected.area || 'All Areas'}</div>
                  </div>
                </div>
              )}

              {/* Share this announcement removed on resident page - D:\GAMES\backup (9)\frontend */}
            </div>
          </article>

          <aside className="flex flex-col gap-4">
            <div className="bg-white border border-[#DCE5F1] rounded-[16px] shadow-[0_6px_18px_rgba(20,60,110,0.04)] p-5">
              <div className="flex items-center gap-3 pb-4 border-b border-[#E8EEF6]">
                <span className="w-10 h-10 rounded-[10px] grid place-items-center bg-[#EDF4FF] text-[#1769FF]">
                  <Icon name="filetext" size={18} />
                </span>
                <h2 className="text-[15px] font-extrabold text-[#102957]">Details</h2>
              </div>
              <div className="flex flex-col">
                {[
                  { icon: 'tag', label: 'Category', val: selected.category || 'General' },
                  { icon: 'calendar', label: 'Published', val: dateLabel },
                  { icon: 'clock', label: 'Schedule', val: selected.schedule_label ? `${selected.schedule_label}${selected.schedule_time ? ` · ${selected.schedule_time}` : ''}` : '—' },
                  { icon: 'pin', label: 'Area', val: selected.area || 'All Areas' },
                  { icon: 'user', label: 'Posted by', val: selected.author_name || 'Subdivision Administration' },
                  { icon: 'check', label: 'Status', val: selected.status ? String(selected.status).charAt(0).toUpperCase() + String(selected.status).slice(1) : 'Published' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 py-3.5 border-b border-[#EDF1F6] last:border-b-0">
                    <span className="w-9 h-9 rounded-[10px] grid place-items-center bg-[#F5F8FD] text-[#1769FF] flex-shrink-0">
                      <Icon name={row.icon} size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-[#526789]">{row.label}</div>
                      <div className="text-[13px] font-extrabold text-[#102957] truncate">{row.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const resultCount = filtered.length;
  const resultLabel = resultCount === 1 ? 'update' : 'updates';

  return (
    <div className="bg-[#F5F7FB] min-h-screen">
      <ServiceBanner
        eyebrow="Community Information"
        title="Announcements & Events"
        description="Stay up to date with official community announcements, advisories, and upcoming events across Xevera."
        badgeText="News & Updates"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <div className="max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

      {/* Toolbar */}
      <section className="bg-white border border-[#DCE5F1] rounded-[16px] p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <div className="h-[46px] flex items-center gap-2.5 px-3.5 border border-[#D6E1EF] rounded-[10px]">
          <span className="text-[#8191AA] text-[18px]">
            <Icon name="search" size={18} />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search announcements and advisories..."
            className="w-full border-0 outline-none text-[#102B5C] bg-transparent text-[13px] placeholder:text-[#93A3BA]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[#6D7D98] text-[12px] font-extrabold whitespace-nowrap">Sort by:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-[46px] px-3 rounded-[10px] border border-[#D6E1EF] bg-white text-[#102B5C] outline-none cursor-pointer text-[12px] font-bold"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`h-[38px] px-3.5 border rounded-[9px] text-[11px] font-extrabold tracking-[0.04em] transition-colors cursor-pointer ${
                filter === c.key
                  ? 'bg-[#1769FF] text-white border-[#1769FF] shadow-[0_4px_10px_rgba(23,105,255,0.18)]'
                  : 'bg-white text-[#526582] border-[#D7E1EE] hover:text-[#1769FF] hover:border-[#1769FF]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main grid - sidebar hidden on resident */}
      <section className={`mt-5 grid grid-cols-1 gap-5 lg:gap-6 ${isResident ? '' : 'lg:grid-cols-[minmax(0,2fr)_minmax(310px,0.85fr)]'}`}>
        {/* List */}
        <div className="bg-white border border-[#DCE5F1] rounded-[16px] overflow-hidden shadow-[0_6px_18px_rgba(20,60,110,0.04)]">
          <div className="min-h-[58px] px-5 flex items-center justify-between border-b border-[#E8EEF6]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-[8px] grid place-items-center bg-[#EDF4FF] text-[#1769FF]">
                <Icon name="megaphone" size={14} />
              </span>
              <h2 className="text-[14px] font-extrabold text-[#102957]">Community Announcements</h2>
            </div>
            <span className="text-[#8492AA] text-[11px] font-bold">{resultCount} {resultLabel}</span>
          </div>

          <div>
            {loading ? (
              <div className="p-5 space-y-3.5">
                {[1, 2, 3].map((i) => <div key={i} className="h-[125px] bg-[#F3F6FB] rounded-[13px] animate-pulse" />)}
              </div>
            ) : error ? (
              <div className="p-10 text-center">
                <p className="text-[14px] font-bold text-[#102B5C] mb-1">Couldn't load announcements</p>
                <p className="text-[12px] text-[#7183A4]">Please try again in a moment.</p>
                <button onClick={load} className="mt-4 px-5 py-2.5 rounded-[10px] bg-[#1769FF] text-white text-[12px] font-extrabold cursor-pointer hover:bg-[#0D55D9]">Try again</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center px-5">
                <span className="w-14 h-14 mx-auto rounded-full bg-[#F1F5F9] text-[#8AA8D8] grid place-items-center mb-3">
                  <Icon name="search" size={22} />
                </span>
                <h3 className="text-[14px] font-extrabold text-[#102957]">No announcements found</h3>
                <p className="mt-1 text-[12px] text-[#7183A4]">
                  {items.length === 0 ? 'Check back soon for community updates.' : 'Try another search term or select a different category.'}
                </p>
              </div>
            ) : (
              <div>
                {filtered.map((a) => {
                  const tone = toneFor(a.category);
                  const badge = badgeFor(a.category);
                  const cover = a.cover_image ? uploadUrl(a.cover_image) : null;
                  return (
                    <article
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="m-3.5 p-3.5 min-h-[125px] grid grid-cols-[78px_1fr_auto] gap-4 items-center border border-[#E2EAF4] rounded-[13px] cursor-pointer hover:border-[#BCD1F4] hover:shadow-[0_8px_20px_rgba(30,75,130,0.06)] hover:-translate-y-[1px] transition-all"
                    >
                      {cover ? (
                        <img src={cover} alt={a.title} className="w-[78px] h-[78px] object-cover rounded-[12px] flex-shrink-0 border border-[#E2EAF4]" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <span className={`w-[78px] h-[78px] grid place-items-center rounded-[12px] flex-shrink-0 ${tone.wrap}`}>
                          <Icon name={tone.icon} size={28} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-[0.06em] uppercase ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="text-[#8291A9] text-[10px] font-bold whitespace-nowrap">{formatDate(a.created_at)}</span>
                        </div>
                        <h3 className="mt-2 text-[16px] font-extrabold text-[#102957] leading-snug truncate">{a.title}</h3>
                        <p className="mt-1 text-[12px] text-[#71819B] leading-[1.5] line-clamp-2">{a.content}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#7B8BA5] font-bold">
                          <span>Posted by {a.author_name || 'Community'}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                        className="self-end border-0 bg-transparent text-[#1769FF] text-[11px] font-extrabold cursor-pointer whitespace-nowrap hover:underline"
                      >
                        Read more →
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right side - hidden on resident - Important Updates + Upcoming Events removed */}
        {!isResident && (
        <aside className="flex flex-col gap-5">
          <div className="bg-white border border-[#DCE5F1] rounded-[16px] shadow-[0_6px_18px_rgba(20,60,110,0.04)] overflow-hidden">
            <div className="px-4 py-4 flex items-center justify-between border-b border-[#E8EEF6]">
              <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-[#102957]">
                <span className="text-[#EF7900]"><Icon name="alert" size={14} /></span>
                Important Updates
              </h3>
              <button
                onClick={() => onSite && onSite('maintenance')}
                className="border-0 bg-transparent text-[#1769FF] text-[10px] font-extrabold cursor-pointer hover:underline"
              >
                View all
              </button>
            </div>
            <div>
              {updates.length === 0 ? (
                <div className="p-5 text-center text-[12px] text-[#7183A4]">No scheduled maintenance right now.</div>
              ) : (
                updates.slice(0, 3).map((u) => {
                  const dt = new Date(u.start_at);
                  const palette = u.status === 'running'
                    ? { wrap: 'bg-[#F0E9FF] text-[#6736DF]', icon: 'wrench' }
                    : { wrap: 'bg-[#FFF1E4] text-[#EF7900]', icon: 'alert' };
                  return (
                    <div key={u.id} className="px-4 py-3.5 flex items-start gap-3 border-b border-[#EDF1F6] last:border-b-0">
                      <span className={`w-[34px] h-[34px] flex-shrink-0 rounded-[9px] grid place-items-center ${palette.wrap}`}>
                        <Icon name={palette.icon} size={15} />
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-[12px] font-extrabold text-[#102957]">Maintenance Notice</strong>
                        <p className="mt-1 text-[11px] font-bold text-[#102957] line-clamp-1">{u.reason || 'Scheduled maintenance'}</p>
                        <small className="block mt-0.5 text-[10px] text-[#8594AB]">{isNaN(dt) ? '—' : dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white border border-[#DCE5F1] rounded-[16px] shadow-[0_6px_18px_rgba(20,60,110,0.04)] overflow-hidden">
            <div className="px-4 py-4 flex items-center justify-between border-b border-[#E8EEF6]">
              <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-[#102957]">
                <span className="text-[#1769FF]"><Icon name="calendar" size={14} /></span>
                Upcoming Events
              </h3>
              <button className="border-0 bg-transparent text-[#1769FF] text-[10px] font-extrabold cursor-pointer hover:underline">View all</button>
            </div>
            <div>
              {events.length === 0 ? (
                <div className="p-5 text-center text-[12px] text-[#7183A4]">No upcoming events at the moment.</div>
              ) : (
                events.slice(0, 3).map((e) => {
                  const parts = eventParts(e.starts_at);
                  return (
                    <div key={e.id} className="px-4 py-3.5 flex items-start gap-3 border-b border-[#EDF1F6] last:border-b-0">
                      <div className="w-[48px] min-w-[48px] h-[55px] flex flex-col items-center justify-center border border-[#E0E8F2] rounded-[9px] bg-[#F8FAFF] flex-shrink-0">
                        <strong className="text-[#1769FF] text-[8px] font-extrabold tracking-[0.08em]">{parts.month}</strong>
                        <b className="text-[#102957] text-[20px] font-extrabold leading-none">{parts.day}</b>
                      </div>
                      <div className="min-w-0">
                        <strong className="block text-[12px] font-extrabold text-[#102957] line-clamp-1">{e.title}</strong>
                        <p className="mt-1 text-[10px] text-[#71819A] font-bold">
                          {e.date || '—'}{e.time ? ` · ${e.time}` : ''}
                        </p>
                        <small className="block mt-0.5 text-[10px] text-[#71819A] line-clamp-1">{e.location || 'Xevera'}</small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
        )}
      </section>

      <footer className="pt-8 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[#71819B] text-[10px] font-bold">
        <span>© {new Date().getFullYear()} Xevera Civic Portal. All rights reserved.</span>
        <div className="flex items-center gap-2.5">
          <a href="#" className="text-[#63738E] no-underline hover:text-[#1769FF]">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="text-[#63738E] no-underline hover:text-[#1769FF]">Terms of Service</a>
          <span>•</span>
          <a href="#" className="text-[#63738E] no-underline hover:text-[#1769FF]">Contact Us</a>
        </div>
      </footer>
      </div>
    </div>
  );
}
