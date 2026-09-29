import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import Icon from './Icon';

/*
 * AnnouncementTicker — slim scrolling announcement strip mounted directly
 * above the TopBar (staff shell in App.jsx, resident header in
 * ResidentLayout.jsx). Shows the latest published announcements, pauses on
 * hover, dismissible per session, click-through to the announcements page.
 */
const DISMISS_KEY = 'xevera-ticker-dismissed';

export default function AnnouncementTicker({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    let alive = true;
    const load = () => {
      apiFetch('announcements/list.php')
        .then((d) => {
          if (!alive) return;
          const arr = Array.isArray(d) ? d : (Array.isArray(d?.items) ? d.items : []);
          setItems(arr.slice(0, 5));
        })
        .catch(() => { if (alive) setItems([]); });
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (dismissed || items.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  const openAnnouncements = () => {
    if (onNavigate) onNavigate('announcements');
  };

  // Duplicated list for a seamless marquee loop.
  const loop = [...items, ...items];

  return (
    <div
      className="flex items-center gap-2 bg-[#142544] text-white overflow-hidden"
      role="marquee"
      aria-label="Latest announcements"
    >
      <button
        onClick={openAnnouncements}
        className="flex items-center gap-1.5 flex-shrink-0 pl-3 sm:pl-4 py-2 text-[11px] font-extrabold uppercase tracking-widest text-white/90 hover:text-white bg-transparent border-none cursor-pointer"
        title="Open announcements"
      >
        <Icon name="megaphone" size={14} />
        <span className="hidden sm:inline">Announcements</span>
      </button>
      <div className="relative flex-1 overflow-hidden xevera-ticker-mask">
        <div className="xevera-ticker-track flex items-center gap-8 whitespace-nowrap py-2 pr-8">
          {loop.map((a, i) => (
            <button
              key={`${a.id ?? i}-${i}`}
              onClick={openAnnouncements}
              className="text-[12px] text-white/85 hover:text-white bg-transparent border-none cursor-pointer truncate"
              title={String(a.title || 'Announcement')}
            >
              <span className="text-[#8FB4F2] font-bold mr-1.5">•</span>
              {a.category ? <span className="font-bold mr-1.5">[{a.category}]</span> : null}
              {String(a.title || 'Announcement')}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcements ticker"
        className="flex-shrink-0 mr-2 sm:mr-3 w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/10 bg-transparent border-none cursor-pointer flex items-center justify-center"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
