import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import Icon from '../../components/Icon';
import GuestBanner from '../../components/public/GuestBanner';
import CivicIllustration from '../../components/public/CivicIllustration';
import Pager from '../../components/Pager';
import { statusBadgeClass, publicStatusLabel, statusDotClass } from '../../components/ReportCard';

const STATUS_TILES = [
  { key: 'All', label: 'All', value: 'total', color: 'text-[#111827]', dot: 'bg-[#9CA3AF]' },
  { key: 'Pending', label: 'Pending', value: 'pending', color: 'text-[#B45309]', dot: 'bg-[#F59E0B]' },
  { key: 'In Progress', label: 'In Progress', value: 'claimed', color: 'text-[#1D4ED8]', dot: 'bg-[#3B82F6]' },
  { key: 'Resolved', label: 'Resolved', value: 'resolved', color: 'text-success-dark', dot: 'bg-success' },
];

const TIMELINE_COLORS = {
  Resolved: 'bg-success',
  Closed: 'bg-success',
  'In Progress': 'bg-[#2563EB]',
  Pending: 'bg-[#F59E0B]',
  Rejected: 'bg-[#DC2626]',
};

export default function ReportsPage({ onViewReport, preset, presetCategory, onNavigate }) {
  const { categories } = useSettings();
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState(() => {
    const c = String(presetCategory || '');
    if (c && c !== 'All') return c;
    return 'All';
  });
  const [status, setStatus] = useState(() => {
    const p = String(preset || '');
    if (p === 'Claimed') return 'In Progress';
    if (['Pending', 'In Progress', 'Resolved', 'Rejected'].includes(p)) return p;
    return 'All';
  });
  const [sort, setSort] = useState('newest');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const searchTimer = useRef(null);

  useEffect(() => {
    apiFetch('reports/stats.php')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, category, status, sort, page, limit: 12 });
    try {
      const data = await apiFetch('reports/list.php?' + params.toString());
      setItems(data.items);
      setTotalPages(data.total_pages);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, status, sort, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, category, status, sort]);

  useEffect(() => {
    if (!loading && items.length > 0 && page === 1 && !selected) {
      setSelected(items[0].id);
    }
  }, [loading, items, page, selected]);

  useEffect(() => {
    if (!selected) { setDetail(null); setHistory([]); setComments([]); return; }
    setDetailLoading(true);
    apiFetch('reports/get.php?id=' + encodeURIComponent(selected))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
    apiFetch('reports/history.php?id=' + encodeURIComponent(selected))
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => setHistory([]));
    apiFetch('reports/comments.php?id=' + encodeURIComponent(selected))
      .then((list) => setComments(Array.isArray(list) ? list : []))
      .catch(() => setComments([]));
  }, [selected]);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val.trim()), 350);
  }

  function photoSrc(photos, i) {
    return uploadUrl(photos?.[i - 1]);
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Hero band */}
      <GuestBanner
        tone="green"
        eyebrow="Track Your Report"
        title="Track Your Report"
        subtitle="Search by title, location, or reference number and follow its progress."
      />

      {/* Status tiles */}
      <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-4 sm:p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-head font-extrabold text-[#111827]">Community Report Overview</h3>
          <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">Tap a card to filter</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATUS_TILES.map((t) => {
            const active = status === t.key;
            const value = stats ? stats[t.value] : null;
            return (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`rounded-xl px-4 py-3 text-left border transition-all cursor-pointer ${
                  active
                    ? 'border-xevera-600 bg-xevera-50 ring-2 ring-xevera-600/15'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                  <span className={`text-[11px] uppercase tracking-wider font-bold ${active ? 'text-xevera-600' : 'text-[#6B7280]'}`}>
                    {t.label}
                  </span>
                </div>
                {value === null ? (
                  <span className="inline-block w-7 h-7 bg-[#E5E7EB] rounded-lg animate-pulse align-middle" />
                ) : (
                  <span className={`text-2xl font-head font-extrabold ${t.color}`}>{value}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
        {/* ===== Left: search + list ===== */}
        <div className="min-w-0">
          <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-4 mb-4">
            <div className="relative">
              <Icon name="search" size={15} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
              <input
                type="search"
                placeholder="Search title, location, or ref #..."
                value={searchInput}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#E5E7EB] bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 mt-3">
              <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                {['All', ...(categories || [])].map((c) => {
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap border transition-colors cursor-pointer ${
                        active
                          ? 'bg-xevera-600 border-xevera-600 text-white shadow-sm'
                          : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-xevera-600/50 hover:text-[#111827]'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 flex-shrink-0">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 animate-pulse">
                  <div className="h-4 w-3/4 bg-[#F3F4F6] rounded mb-2" />
                  <div className="h-3 w-1/2 bg-[#F3F4F6] rounded" />
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left bg-white rounded-[16px] border p-4 transition-all cursor-pointer ${
                    selected === r.id
                      ? 'border-xevera-600 ring-2 ring-xevera-600/15 shadow-[0_8px_20px_rgba(18,88,232,0.10)]'
                      : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-[0_6px_16px_rgba(16,24,40,0.06)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {r.photos && r.photos.length > 0 ? (
                      <img src={uploadUrl(r.photos[0])} alt="" className="w-14 h-14 rounded-xl object-cover border border-[#E5E7EB] flex-shrink-0" loading="lazy" />
                    ) : (
                      <span className="w-14 h-14 rounded-xl bg-[linear-gradient(135deg,#F2F7FF,#D5E1F7)] text-xevera-400 flex items-center justify-center flex-shrink-0">
                        <Icon name="camera" size={20} strokeWidth={1.8} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[14px] font-extrabold text-[#111827] leading-snug line-clamp-2">{r.title}</h4>
                        <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap flex-shrink-0 ${statusBadgeClass(r.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${statusDotClass(r.status)}`} />
                          {publicStatusLabel(r.status)}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#6B7280] mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon name="pin" size={11} strokeWidth={2} className="flex-shrink-0" />
                          <span className="truncate">{r.location}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Icon name="calendar" size={11} strokeWidth={2} className="flex-shrink-0" />
                          {r.date}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 text-[11px] text-[#6B7280]">
                        <span className="px-2 py-0.5 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] flex items-center gap-1">{r.category}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] flex items-center gap-1">Ref {r.id}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <Pager currentPage={page} totalPages={totalPages} onChange={setPage} />
            </div>
          ) : (
            <div className="bg-white rounded-[18px] border border-[#E5E7EB] text-center py-12">
              <div className="w-12 h-12 mx-auto rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center mb-3">
                <Icon name="search" size={22} strokeWidth={2} />
              </div>
              <p className="text-sm font-bold text-[#111827]">No reports match your filters</p>
              <p className="text-xs text-[#6B7280] mt-1">Try adjusting your search, category, or status.</p>
            </div>
          )}
        </div>

        {/* ===== Right: selected report detail ===== */}
        <div className="min-w-0">
          {detailLoading ? (
            <div className="bg-white rounded-[20px] border border-[#E5E7EB] p-6 animate-pulse">
              <div className="h-[180px] bg-[#F3F4F6] rounded-[16px] mb-4" />
              <div className="h-5 w-3/4 bg-[#F3F4F6] rounded mb-3" />
              <div className="h-4 w-1/2 bg-[#F3F4F6] rounded" />
            </div>
          ) : detail ? (
            <div className="space-y-5">
              {/* Image + info */}
              <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] overflow-hidden">
                {detail.photos?.[0] ? (
                  <div className="h-[200px] sm:h-[240px] bg-cover bg-center" style={{ backgroundImage: 'url(/' + detail.photos[0] + ')' }} />
                ) : (
                  <div className="h-[120px] bg-[linear-gradient(135deg,#F2F7FF,#D5E1F7)] flex items-center justify-center">
                    <Icon name="camera" size={34} strokeWidth={1.5} className="text-xevera-300" />
                  </div>
                )}
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-[17px] font-head font-extrabold text-[#111827] leading-snug">{detail.title}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${statusBadgeClass(detail.status)}`}>
                      {publicStatusLabel(detail.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] mt-3">
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Reference</div>
                      <div className="font-bold text-xevera-600">{detail.id}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Reported on</div>
                      <div className="text-[#111827]">{detail.date}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Category</div>
                      <div className="text-[#111827]">{detail.category}</div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Reporter</div>
                      <div className="text-[#111827]">{detail.reporter}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-[#9CA3AF] font-bold mb-0.5">Location</div>
                      <div className="text-[#111827] flex items-center gap-1.5">
                        <Icon name="pin" size={13} strokeWidth={2} />
                        {detail.location}
                      </div>
                    </div>
                  </div>
                  {detail.desc && (
                    <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line border-t border-[#E5E7EB] mt-4 pt-4">{detail.desc}</p>
                  )}
                </div>
              </div>

              {/* Current status callout */}
              <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-5">
                <h3 className="text-sm font-head font-extrabold text-[#111827] mb-3">Current Status</h3>
                <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFF] border border-[#E5E7EB] p-4">
                  <span className={`w-10 h-10 rounded-full ${statusDotClass(detail.status)} text-white flex items-center justify-center flex-shrink-0`}>
                    <Icon name={detail.status === 'Resolved' ? 'check' : detail.status === 'In Progress' ? 'wrench' : 'clock'} size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="text-[14px] font-extrabold text-[#111827]">{publicStatusLabel(detail.status)}</div>
                    <div className="text-[12px] text-[#6B7280]">
                      {detail.assigned && detail.assigned !== '-' ? 'Handled by ' + detail.assigned : 'Awaiting review by our team'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status timeline */}
              <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-5">
                <h3 className="text-sm font-head font-extrabold text-[#111827] mb-4">Status Timeline</h3>
                {history.length === 0 ? (
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-[12px] text-[#9CA3AF] text-center">
                    No status updates yet. This report is awaiting initial review.
                  </div>
                ) : (
                  <ol className="relative border-l border-[#E5E7EB] ml-2 space-y-4">
                    {history.map((h) => (
                      <li key={h.id} className="ml-5 relative">
                        <span className={`absolute -left-[21px] mt-0.5 w-3 h-3 rounded-full border-2 border-white ${TIMELINE_COLORS[h.new_status] || 'bg-[#9CA3AF]'}`} />
                        <div className="text-[13px] font-bold text-[#111827]">{h.new_status}</div>
                        {h.note && <div className="text-xs text-[#6B7280] mt-0.5">{h.note}</div>}
                        <div className="text-[11px] text-[#9CA3AF] mt-0.5">{h.date}{h.actor ? ' · ' + h.actor : ''}</div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Activity / Comments */}
              <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-5">
                <h3 className="text-sm font-head font-extrabold text-[#111827] mb-4">Comments & Activity</h3>
                <p className="text-[11.5px] text-[#9CA3AF] mb-4">Log in as a Resident to join the discussion and support community reports.</p>
                {comments.length === 0 ? (
                  <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-[12px] text-[#9CA3AF] text-center">
                    No comments yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[260px] overflow-y-auto">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-[#F9FAFB] border border-[#F1F5F9] rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12px] font-extrabold text-[#111827]">{c.user}</span>
                          <span className="text-[10px] text-[#9CA3AF]">{c.date}</span>
                        </div>
                        <p className="text-[13px] text-[#374151] leading-relaxed">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] border border-[#E5E7EB] text-center py-16">
              <div className="w-14 h-14 mx-auto rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center mb-4">
                <Icon name="file" size={26} strokeWidth={2} />
              </div>
              <p className="text-sm font-bold text-[#111827]">Select a report to view details</p>
              <p className="text-xs text-[#6B7280] mt-1">Choose a report from the list to see its full timeline and updates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}