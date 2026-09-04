import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

export default function StatusTicker({ onNavigate }) {
  const { maintenanceMode, maintenanceHeadline, maintenanceDescription } = useSettings();
  const [announcement, setAnnouncement] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    apiFetch('announcements/list.php')
      .then(d => {
        const items = d && d.length ? d : [];
        setAnnouncement(items[0] || null);
      })
      .catch(() => {});
    apiFetch('reports/stats.php')
      .then(s => setCount(s?.resolved || 0))
      .catch(() => {});
  }, []);

  let text = '';
  let icon = '\uD83D\uDCF0';
  let href = 'announcements';

  if (maintenanceMode) {
    text = maintenanceHeadline || 'Scheduled maintenance in progress';
    icon = '\uD83D\uDEE1\uFE0F';
  } else if (announcement) {
    text = announcement.title || 'Community update';
    if (announcement.id) href = 'announcements';
  } else {
    text = 'Community status is all clear';
    icon = '\u2705';
  }

  if (!maintenanceMode && count > 0) {
    text = text + ' \u2022 ' + count + ' report' + (count === 1 ? '' : 's') + ' resolved';
  }

  return (
    <button
      onClick={() => onNavigate && onNavigate(href)}
      className="w-full bg-xevera-50 text-navy-950/85 text-[12px] font-semibold px-4 py-1.5 text-left cursor-pointer flex items-center gap-2 border-b border-[#E5E7EB]/70 hover:bg-xevera-100 transition-colors"
      aria-label="Community status ticker"
    >
      <span className="inline-flex w-2 h-2 rounded-full bg-xevera-600 animate-pulse flex-shrink-0" />
      <span className="truncate">{icon} {text}</span>
    </button>
  );
}
