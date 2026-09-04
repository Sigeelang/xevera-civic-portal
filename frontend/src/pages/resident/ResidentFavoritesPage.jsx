import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import ReportImage from '../../components/ReportImage';
import { statusBadgeClass, statusDotClass, publicStatusLabel } from '../../components/ReportCard';

const TABS = [
  { key: 'favorites', label: 'Favorites', icon: 'star' },
  { key: 'followed',   label: 'Followed Reports', icon: 'eye' },
];

const CATEGORY_COLORS = {
  'Flooding': { tint: 'bg-[#DBEAFE] text-[#1D4ED8]', icon: 'flood' },
  'Road Damage': { tint: 'bg-[#FEE2E2] text-[#B91C1C]', icon: 'road' },
  'Garbage / Waste': { tint: 'bg-green-50 text-success-dark', icon: 'trash' },
  'Streetlight': { tint: 'bg-amber-50 text-[#D97706]', icon: 'bolt' },
  'Water Problem': { tint: 'bg-[#DBEAFE] text-[#1D4ED8]', icon: 'drop' },
  'Drainage': { tint: 'bg-[#DBEAFE] text-[#1D4ED8]', icon: 'flood' },
  'Environmental': { tint: 'bg-green-50 text-success-dark', icon: 'leaf' },
  'Public Safety': { tint: 'bg-violet-50 text-[#7C3AED]', icon: 'shield' },
  'Other Issues': { tint: 'bg-[#F3F4F6] text-[#6B7280]', icon: 'clipboard' },
};
const FALLBACK = { tint: 'bg-[#F3F4F6] text-[#6B7280]', icon: 'flag' };

const FAV_KEY = 'xevera.resident.favorites';
const FOLLOW_KEY = 'xevera.resident.followed';

function readSet(key) {
  try { const raw = localStorage.getItem(key); return raw ? new Set(JSON.parse(raw)) : new Set(); }
  catch { return new Set(); }
}
function writeSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

function CompactCard({ report, onView, indicator, onIndicator }) {
  const info = CATEGORY_COLORS[report.category] || FALLBACK;
  return (
    <article onClick={onView} className="group bg-white rounded-2xl border border-[#DFE6EF] overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)] transition-all duration-200">
      <div className="relative h-28 bg-[#F3F4F6] overflow-hidden">
        {report.photos?.[0] ? (
          <ReportImage src={report.photos[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${info.tint}`}>
            <Icon name={info.icon} size={28} strokeWidth={1.5} />
          </div>
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur bg-white/95 ${statusBadgeClass(report.status)}`}>
          <span className={`w-1 h-1 rounded-full ${statusDotClass(report.status)}`} />
          {publicStatusLabel(report.status)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onIndicator(); }}
          aria-label={indicator === 'star' ? 'Remove favorite' : 'Unfollow'}
          className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer ${
            indicator === 'star' ? 'bg-amber-400 text-white hover:bg-amber-500' : 'bg-xevera-600 text-white hover:bg-xevera-700'
          }`}
        >
          <Icon name={indicator === 'star' ? 'star' : 'eye'} size={13} />
        </button>
      </div>
      <div className="p-3">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#9CA3AF] mb-1">#{report.id}</div>
        <h3 className="text-[13px] font-extrabold text-navy-950 line-clamp-2 leading-snug">{report.title}</h3>
        <div className="text-[11px] text-[#6B7280] mt-1 truncate">{report.location}</div>
      </div>
    </article>
  );
}

function Inner({ onViewReport }) {
  const toast = useToast();
  const [tab, setTab] = useState('favorites');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(() => readSet(FAV_KEY));
  const [followed, setFollowed] = useState(() => readSet(FOLLOW_KEY));

  useEffect(() => {
    apiFetch('reports/my.php?filter=mine&limit=50&sort=newest')
      .then((d) => setReports(d.items || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const set = tab === 'favorites' ? favorites : followed;
    return reports.filter((r) => set.has(r.id));
  }, [reports, tab, favorites, followed]);

  function remove(id) {
    if (tab === 'favorites') {
      const next = new Set(favorites); next.delete(id); setFavorites(next); writeSet(FAV_KEY, next);
    } else {
      const next = new Set(followed); next.delete(id); setFollowed(next); writeSet(FOLLOW_KEY, next);
    }
    toast(tab === 'favorites' ? 'Removed from favorites.' : 'Unfollowed.');
  }

  return (
    <>
      <div className="flex items-center gap-1.5 bg-white rounded-2xl border border-[#DFE6EF] p-1.5 mb-5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-colors cursor-pointer ${
              tab === t.key ? 'bg-xevera-600 text-white shadow-sm' : 'text-[#6B7280] hover:bg-xevera-50 hover:text-xevera-700'
            }`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[#DFE6EF] p-12 text-center text-sm text-[#6B7280]">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DFE6EF] p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center mb-4">
            <Icon name={tab === 'favorites' ? 'star' : 'eye'} size={24} />
          </div>
          <h2 className="text-[16px] font-head font-extrabold text-navy-950 mb-1.5">
            No {tab === 'favorites' ? 'favorites' : 'followed reports'} yet
          </h2>
          <p className="text-[13px] text-[#6B7280] max-w-md mx-auto">
            Mark reports with the {tab === 'favorites' ? 'star' : 'eye'} icon from My Reports to add them here.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#6B7280] mb-4">
            <span className="font-bold text-navy-950">{visible.length}</span> {tab === 'favorites' ? 'favorite' : 'followed'} report{visible.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {visible.map((r) => (
              <CompactCard
                key={r.id}
                report={r}
                indicator={tab === 'favorites' ? 'star' : 'eye'}
                onView={() => onViewReport && onViewReport(r.id)}
                onIndicator={() => remove(r.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function ResidentFavoritesPage({ onNavigate, onViewReport }) {
  return (
    <ResidentLayout activePage="favorites" pageTitle="Favorites & Followed" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Favorites & Followed"
        subtitle="Reports you've marked as favorites or followed for updates."
      />
      <Inner onViewReport={onViewReport} />
    </ResidentLayout>
  );
}