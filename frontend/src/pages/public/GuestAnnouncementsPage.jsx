import { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import ServiceBanner from '../../components/public/ServiceBanner';
import ResidentPageHeader from '../../components/public/ResidentPageHeader';

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
      <div className="px-3 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1050px] mx-auto">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-2 bg-none border-none text-[#1769FF] text-[14px] font-extrabold cursor-pointer hover:-translate-x-[2px] hover:text-[#0D55D9] transition-transform mb-5 min-h-[44px] py-2"
        >
          <span className="text-[20px] leading-none">←</span> Back to Announcements
        </button>

        <div>
          <article key={selected.id} className="bg-white border border-[#E4EAF3] rounded-[13px] px-3.5 py-5 sm:px-6 sm:py-6" style={{ boxShadow: '0 8px 30px rgba(30,61,100,0.07)' }}>
            <div className="relative lg:pr-[205px]">
              <div>
                <span className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold ${meta.cls}`}>
                  <Icon name={(toneFor(selected.category) || {}).icon || 'tag'} size={12} />
                  <span>{meta.label}</span>
                </span>
                <h1 className="mt-2.5 text-[25px] sm:text-[28px] lg:text-[31px] leading-[1.15] font-extrabold text-[#102957]">
                  {selected.title}
                </h1>
                <div className="mt-2.5 flex items-center flex-wrap gap-2 text-xs text-[#5C6980]">
                  <span className="w-[35px] h-[35px] rounded-full grid place-items-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1D6DFF,#6CA2FF)' }}>{posterInitials}</span>
                  <span>Posted by</span>
                  <strong className="text-[#1467F5]">{selected.author_name || 'Community'}</strong>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold text-[#1467F5] bg-[#E8F2FF]">
                    <Icon name="check" size={12} />
                    Verified
                  </span>
                </div>
              </div>
              <div className="mt-3 lg:mt-0 lg:absolute lg:top-0 lg:right-0 lg:w-[200px] px-3.5 py-3 flex items-center gap-3 bg-[#F1F6FF] border border-[#DCE8FC] rounded-xl">
                <span className="text-[#1467F5]"><Icon name="calendar" size={20} /></span>
                <div>
                  <div className="text-[9px] font-extrabold tracking-[0.12em] text-[#1467F5]">PUBLISHED</div>
                  <div className="mt-1 text-xs font-bold text-[#15284D]">{dateLabel}</div>
                </div>
              </div>
            </div>

              <div className="mt-4 rounded-[14px] overflow-hidden bg-[#E9EEF5] leading-none">
                <div className="relative w-full aspect-video max-h-[280px] md:max-h-[420px] overflow-hidden bg-[#E9EEF5]">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#94A3B8] text-[13px]">
                    <Icon name="camera" size={32} />
                    <span>Announcement image</span>
                  </div>
                  {selected.cover_image && (
                    <img key={selected.cover_image} src={uploadUrl(selected.cover_image)} alt={selected.title} className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  )}
                </div>
              </div>

              <section className="mt-4 p-4 sm:p-[17px_20px] flex items-start sm:items-center gap-4 sm:gap-[18px] border border-[#CDEEDE] rounded-xl" style={{ background: 'linear-gradient(100deg,#F0FFF8,#F7FFFB)' }}>
                <span className="w-[43px] h-[43px] sm:w-[55px] sm:h-[55px] rounded-full bg-[#DDF7E8] text-[#18A04E] grid place-items-center flex-shrink-0">
                  <Icon name="leaf" size={22} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs sm:text-[12.5px] text-[#267052] leading-relaxed whitespace-pre-line">{selected.content}</p>
                </div>
              </section>

              {/* Structured schedule - publication kept separate from collection schedule */}
              {(selected.schedule_label || selected.schedule_time || selected.recurrence || selected.area) && (
                <section className="mt-[18px]">
                  <div className="flex items-center gap-2.5 mb-2.5 text-[#102957]">
                    <Icon name="calendar" size={17} />
                    <span className="text-base font-extrabold">Collection Schedule</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { icon: 'calendar', tint: 'bg-[#EAF2FF] text-[#1467F5]', label: 'Day', val: selected.schedule_label || '—' },
                      { icon: 'clock', tint: 'bg-[#FFF0E5] text-[#FF7413]', label: 'Time', val: selected.schedule_time || '—' },
                      { icon: 'recycle', tint: 'bg-[#F1EAFF] text-[#8147F5]', label: 'Recurrence', val: selected.recurrence || '—' },
                      { icon: 'pin', tint: 'bg-[#E5F8ED] text-[#14954B]', label: 'Area', val: selected.area || 'All Areas' },
                    ].map(s => (
                      <div key={s.label} className="min-h-[68px] flex items-center gap-3 px-3 py-2.5 border border-[#E3EAF3] rounded-xl bg-white">
                        <span className={`w-[41px] h-[41px] rounded-[11px] grid place-items-center flex-shrink-0 ${s.tint}`}>
                          <Icon name={s.icon} size={17} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#64728A] mb-1">{s.label}</div>
                          <div className="text-[12.5px] font-bold text-[#102957] truncate">{s.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Share this announcement removed on resident page - D:\GAMES\backup (9)\frontend */}
          </article>
        </div>
      </div>
    );
  }

  const resultCount = filtered.length;
  const resultLabel = resultCount === 1 ? 'update' : 'updates';

  return (
    <div className="bg-[#F5F7FB] min-h-screen">
      {isResident ? (
        <ResidentPageHeader
          title="Announcements & Events"
          description="Stay up to date with official community announcements, advisories, and upcoming events across Xevera."
        />
      ) : (
        <ServiceBanner
          eyebrow="COMMUNITY NEWS & UPDATES"
          title="Announcements & Events"
          description="Stay up to date with official community announcements, advisories, and upcoming events across Xevera."
          badgeText="COMMUNITY NEWS & UPDATES"
          badgeIcon
          image="/images/xevera-hero.jpeg"
          height={{ desktop: 360, tablet: 320, mobile: 240 }}
        />
      )}
      <div className={isResident ? 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-0 pb-8 sm:pb-10' : 'max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10'}>

      {/* Toolbar */}
      <section className="bg-white border border-[#DCE5F1] rounded-[16px] p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
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
              className={`h-[44px] px-3.5 border rounded-[9px] text-[11px] font-extrabold tracking-[0.04em] transition-colors cursor-pointer ${
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

      {/* Main list - full width */}
      <section className="mt-5 sm:mt-6 overflow-x-clip">
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
                  {items.length === 0 ? 'Check back soon for community updates.' : 'Try selecting a different category.'}
                </p>
              </div>
            ) : (
              <div className="p-3.5 grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {filtered.map((a) => {
                  const tone = toneFor(a.category);
                  const badge = badgeFor(a.category);
                  const cover = a.cover_image ? uploadUrl(a.cover_image) : null;
                  return (
                    <article
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="p-3.5 min-h-[125px] grid grid-cols-[78px_minmax(0,1fr)_auto] lg:grid-cols-[88px_minmax(0,1fr)_auto] gap-4 items-center border border-[#E2EAF4] rounded-[13px] cursor-pointer hover:border-[#BCD1F4] hover:shadow-[0_8px_20px_rgba(30,75,130,0.06)] hover:-translate-y-[1px] transition-all"
                    >
                      {cover ? (
                        <img src={cover} alt={a.title} className="w-[78px] h-[78px] lg:w-[88px] lg:h-[88px] object-cover rounded-[12px] flex-shrink-0 border border-[#E2EAF4]" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <span className={`w-[78px] h-[78px] lg:w-[88px] lg:h-[88px] grid place-items-center rounded-[12px] flex-shrink-0 ${tone.wrap}`}>
                          <Icon name={tone.icon} size={28} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold tracking-[0.06em] uppercase ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="text-[#8291A9] text-xs sm:text-[12px] font-bold whitespace-nowrap">{formatDate(a.created_at)}</span>
                        </div>
                        <h3 className="mt-2 text-[16px] font-extrabold text-[#102957] leading-snug truncate">{a.title}</h3>
                        <p className="mt-1 text-[12.5px] sm:text-[13px] text-[#71819B] leading-[1.5] line-clamp-2">{a.content}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-[12px] text-[#7B8BA5] font-bold">
                          <span>Posted by {a.author_name || 'Community'}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                        className="self-end border-0 bg-transparent text-[#1769FF] text-xs sm:text-sm font-extrabold cursor-pointer whitespace-nowrap hover:underline min-h-[44px] inline-flex items-center"
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

      </section>

      <footer className="pt-8 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[#71819B] text-xs font-bold">
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
