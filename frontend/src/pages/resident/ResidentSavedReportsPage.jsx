import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import ReportImage from '../../components/ReportImage';
import { statusBadgeClass, statusDotClass, publicStatusLabel } from '../../components/ReportCard';
import Pager from '../../components/Pager';

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

const BOOKMARKS_KEY = 'xevera.resident.savedReports';

function readBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeBookmarks(ids) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(ids)); } catch {}
}

function SavedCard({ report, onView, onToggleSave, saved }) {
  const info = CATEGORY_COLORS[report.category] || FALLBACK;
  const statusLabel = publicStatusLabel(report.status);
  const firstPhoto = report.photos?.[0];

  return (
    <article onClick={onView} className="group bg-white rounded-2xl border border-[#DFE6EF] overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(16,24,40,0.08)] transition-all duration-200">
      <div className="relative h-40 bg-[#F3F4F6] overflow-hidden">
        {firstPhoto ? (
          <ReportImage src={firstPhoto} alt={report.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${info.tint}`}>
            <Icon name={info.icon} size={36} strokeWidth={1.5} />
          </div>
        )}
        <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur bg-white/95 ${statusBadgeClass(report.status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(report.status)}`} />
          {statusLabel}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          aria-label={saved ? 'Remove from saved reports' : 'Save report'}
          title={saved ? 'Saved' : 'Save'}
          className={`absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors cursor-pointer ${
            saved ? 'bg-xevera-600 text-white hover:bg-xevera-700' : 'bg-white/95 text-[#6B7280] hover:text-xevera-600'
          }`}
        >
          <Icon name="pin" size={15} className={saved ? '' : 'fill-current'} />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-[#9CA3AF] mb-1.5">
          <span>#{report.id}</span>
          <span>{report.date}</span>
        </div>
        <h3 className="text-[15px] font-extrabold text-navy-950 line-clamp-2 leading-snug mb-1.5">{report.title}</h3>
        <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
          <Icon name="pin" size={11} />
          <span className="truncate">{report.location}</span>
        </div>
      </div>
    </article>
  );
}

function Inner({ onViewReport }) {
  const toast = useToast();
  const [allReports, setAllReports] = useState([]);
  const [savedIds, setSavedIds] = useState(() => readBookmarks());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    apiFetch('reports/my.php?filter=mine&limit=50&sort=newest')
      .then((d) => setAllReports(d.items || []))
      .catch(() => setAllReports([]))
      .finally(() => setLoading(false));
  }, []);

  const savedReports = useMemo(() => allReports.filter((r) => savedIds.includes(r.id)), [allReports, savedIds]);
  const visible = savedReports.slice(0, page * pageSize);
  const hasMore = savedReports.length > visible.length;

  const toggle = useCallback((id) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeBookmarks(next);
      return next;
    });
  }, []);

  const unsave = useCallback((id) => {
    setSavedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeBookmarks(next);
      return next;
    });
    toast('Removed from saved reports.');
  }, [toast]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#DFE6EF] p-12 text-center text-sm text-[#6B7280]">
        Loading your saved reports…
      </div>
    );
  }

  if (savedReports.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#DFE6EF] p-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center mb-4">
          <Icon name="pin" size={24} />
        </div>
        <h2 className="text-[16px] font-head font-extrabold text-navy-950 mb-1.5">No saved reports yet</h2>
        <p className="text-[13px] text-[#6B7280] max-w-md mx-auto">
          Save reports from My Reports by tapping the bookmark icon. Saved reports appear here for quick access.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#6B7280]">
          <span className="font-bold text-navy-950">{savedReports.length}</span> saved report{savedReports.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((r) => (
          <SavedCard
            key={r.id}
            report={r}
            saved
            onView={() => onViewReport && onViewReport(r.id)}
            onToggleSave={() => unsave(r.id)}
          />
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-5">
          <button onClick={() => setPage((p) => p + 1)} className="px-6 py-2.5 rounded-xl border border-[#DFE6EF] bg-white text-sm font-bold text-navy-950 hover:bg-[#F3F4F6] transition-colors cursor-pointer">
            Load More
          </button>
        </div>
      )}
    </>
  );
}

export default function ResidentSavedReportsPage({ onNavigate, onViewReport }) {
  return (
    <ResidentLayout activePage="saved-reports" pageTitle="Saved Reports" onNavigate={onNavigate}>
      <ResidentPageHeader
        title="Saved Reports"
        subtitle="Your bookmarked reports — quick access to anything you want to follow up on."
      />
      <Inner onViewReport={onViewReport} />
    </ResidentLayout>
  );
}