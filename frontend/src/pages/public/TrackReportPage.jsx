import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, uploadUrl, getToken } from '../../services/api';
import { getEffectiveStatus } from '../../utils/reportStatus';
import ServiceBanner from '../../components/public/ServiceBanner';

/* Progress timeline steps shown on the detail page */
const TIMELINE = [
  { key: 'Submitted', icon: '✓', text: 'Your report has been submitted.' },
  { key: 'Verified', icon: '✓', text: 'Your report has been verified.' },
  { key: 'Assigned', icon: '●', text: 'Your report has been assigned to our team.' },
  { key: 'In Progress', icon: '⚙', text: 'Our team is now working on this issue.' },
  { key: 'Resolved', icon: '✓', text: 'The issue has been resolved.' },
  { key: 'Closed', icon: '○', text: 'Pending confirmation from you.' },
];

const STATUS_PILLS = {
  Pending: 'bg-[#FFF6DF] text-[#C77F00]',
  Verified: 'bg-[#F0F2F5] text-[#65728A]',
  Assigned: 'bg-[#EAF2FF] text-[#1468FF]',
  'In Progress': 'bg-[#EAF3FF] text-[#1468FF]',
  Resolved: 'bg-[#EAF3FF] text-[#1763E7]',
  Closed: 'bg-[#E8F9F1] text-[#12945A]',
  Rejected: 'bg-[#FFF1F2] text-[#EF4444]',
  'Under Review': 'bg-[#FFF3CD] text-[#B8860B]',
};

function fmtDateTime(v) {
  const d = new Date(String(v || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(v || '');
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}\n${time}`;
}

export default function TrackReportPage({ onNavigate, focusRef, presetCategory }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statFilter, setStatFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(() => presetCategory || 'all');
  const [sortNewest, setSortNewest] = useState(true);
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list');
  const [openRef, setOpenRef] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [isResident] = useState(() => {
    try {
      const t = getToken();
      return t ? decodeToken(t)?.role === 'Resident' : false;
    } catch { return false; }
  });

  /* Feedback widget state */
  const [fbChoice, setFbChoice] = useState(null);
  const [fbComment, setFbComment] = useState('');
  const [fbDone, setFbDone] = useState(false);
  const [fbBusy, setFbBusy] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setItems(null);
    apiFetch('reports/list.php?limit=50')
      .then(d => setItems(d.items || []))
      .catch(() => { setItems([]); setError(true); });
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (focusRef) setSearch(String(focusRef));
  }, [focusRef]);

  /* Overview counts */
  const counts = useMemo(() => {
    const list = items || [];
    const group = s => (s === 'Assigned' ? 'In Progress' : s);
    return {
      all: list.length,
      Pending: list.filter(r => group(r.status) === 'Pending').length,
      'In Progress': list.filter(r => group(r.status) === 'In Progress').length,
      Resolved: list.filter(r => group(r.status) === 'Resolved').length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...(items || [])];
    if (statFilter !== 'all') {
      list = list.filter(r => {
        const g = r.status === 'Assigned' ? 'In Progress' : r.status;
        return g === statFilter;
      });
    }
    if (categoryFilter !== 'all') {
      list = list.filter(r => String(r.category || '').toLowerCase() === String(categoryFilter).toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r =>
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.title || '').toLowerCase().includes(q) ||
        String(r.location || '').toLowerCase().includes(q) ||
        String(r.category || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => sortNewest
      ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
      : String(a.created_at || '').localeCompare(String(b.created_at || '')));
    return list;
  }, [items, statFilter, categoryFilter, search, sortNewest]);

  useEffect(() => { setPage(1); }, [search, statFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 7));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * 7, safePage * 7);

  function openDetail(refId) {
    const row = (items || []).find(r => r.id === refId);
    if (!row) return;
    setOpenRef(refId);
    setDetail(row);
    setHistory([]);
    setView('detail');
    setFbChoice(null);
    setFbComment('');
    setFbDone(false);
    apiFetch(`reports/history.php?id=${encodeURIComponent(refId)}`)
      .then(h => setHistory(Array.isArray(h) ? h : []))
      .catch(() => setHistory([]));
  }

  async function submitFeedback() {
    if (!fbChoice) { alert('Please choose Yes or Not yet first.'); return; }
    if (!fbComment.trim()) { alert('Please enter a comment first.'); return; }
    if (!isResident) { alert('Only resident accounts can submit feedback.'); return; }
    setFbBusy(true);
    try {
      await apiFetch('feedback/submit.php', {
        method: 'POST',
        body: { ref_id: openRef, rating: fbChoice === 'yes' ? 5 : 1, comment: fbComment.trim() },
      });
      setFbDone(true);
    } catch (e) {
      alert(e.message || 'Failed to submit feedback.');
    } finally {
      setFbBusy(false);
    }
  }

  /* ===== DETAIL VIEW DATA ===== */
  const photos = detail?.photos || [];
  const beforePhoto = photos[0] || null;
  const afterPhoto = photos.length > 1 ? photos[photos.length - 1] : null;

  const timeline = useMemo(() => {
    const entries = [];
    entries.push({
      key: 'Submitted',
      date: fmtDateTime(detail?.created_at),
      text: TIMELINE[0].text,
      done: true,
    });
    let reachedResolve = false;
    (history || []).forEach(h => {
      if (h.new_status === 'Rejected') {
        entries.push({
          key: 'Rejected',
          date: h.date,
          text: h.note ? `Rejected: ${h.note}` : 'This report was rejected.',
          done: true,
          rejected: true,
        });
        return;
      }
      const t = TIMELINE.find(x => x.key === h.new_status);
      if (!t) return;
      if (h.new_status === 'Resolved') reachedResolve = true;
      entries.push({
        key: h.new_status,
        date: h.date,
        text: t.text,
        done: h.new_status === 'Resolved',
        actor: h.actor,
        note: h.note,
      });
    });
    ['Closed'].forEach(k => {
      if ((detail?.status === k)) {
        entries.push({ key: k, date: '', text: TIMELINE[TIMELINE.length - 1].text.replace('Pending confirmation from you.', 'This report has been closed.'), done: true });
      }
    });
    if (detail?.status === 'Resolved' && !reachedResolve) {}
    return entries;
  }, [history, detail]);

  const currentStatusMeta = useMemo(() => {
    const h = [...(history || [])].reverse().find(x => x.new_status === detail?.status);
    return {
      status: detail?.status || '',
      by: h?.actor || detail?.assigned && detail.assigned !== '-' ? (h?.actor || (detail?.assigned !== '-' ? detail.assigned : '')) : '',
      date: h?.date || fmtDateTime(detail?.created_at),
      resolution: null,
    };
  }, [history, detail]);

  const pageButtons = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);

  const pillCls = s => STATUS_PILLS[s] || 'bg-[#F0F2F5] text-[#65728A]';
  const stats = [
    { key: 'all', label: 'ALL REPORTS', value: counts.all, desc: 'Total reports', iconCls: 'bg-[#E8F1FF]', icon: '▣' },
    { key: 'Pending', label: 'PENDING', value: counts.Pending, desc: 'Awaiting action', iconCls: 'bg-[#FFF6DF]', icon: '◷' },
    { key: 'In Progress', label: 'IN PROGRESS', value: counts['In Progress'], desc: 'Being handled', iconCls: 'bg-[#EAF2FF]', icon: '◌' },
    { key: 'Resolved', label: 'RESOLVED', value: counts.Resolved, desc: 'Successfully resolved', iconCls: 'bg-[#E9F9F1]', icon: '✓' },
  ];

  /* ============================== LIST VIEW ============================== */
  if (view === 'list') {
    return (
      <>
        <ServiceBanner
          eyebrow="TRACK REPORT"
          title="Track Report"
          description="Follow your report from submission to resolution and see the latest status updates."
          badgeText="Track Report"
          badgeIcon
          image="/images/xevera-hero.jpeg"
          height={{ desktop: 360, tablet: 320, mobile: 240 }}
        />
        <div className="w-full max-w-[1460px] mx-auto px-5 md:px-9 pt-6 pb-12">
          {/* OVERVIEW STATS */}
          <div className="flex justify-between items-center mx-0 md:mx-5 mt-5 mb-2.5">
            <h3 className="text-[15px] font-bold m-0">Community Report Overview</h3>
            <span className="text-xs text-[#71809E] font-bold uppercase">Tap a card to filter</span>
          </div>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
            {stats.map(s => (
              <button key={s.key} onClick={() => { setStatFilter(s.key === 'all' ? 'all' : s.key); setPage(1); }}
                className={`text-left bg-white border rounded-[15px] min-h-[105px] px-6 py-[18px] flex items-center gap-[18px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(35,72,130,0.08)] ${
                  statFilter === s.key || (s.key === 'all' && statFilter === 'all')
                    ? 'border-2 border-xevera-600 bg-[#F4F8FF]'
                    : 'border-[#E4E9F2]'
                }`}>
                <span className={`w-[52px] h-[52px] rounded-[13px] grid place-items-center text-2xl flex-shrink-0 ${s.iconCls}`}>{s.icon}</span>
                <div>
                  <small className="block text-xs font-bold text-[#526586]">{s.label}</small>
                  <strong className="block text-[28px] my-1">{s.value ?? '—'}</strong>
                  <p className="text-xs text-[#7885A0] m-0">{s.desc}</p>
                </div>
              </button>
            ))}
          </section>

          {/* TOOLBAR */}
          <section className="bg-white border border-[#E4E9F2] rounded-[15px] p-3.5 mt-3.5 flex flex-wrap items-center gap-3">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search title, location, or reference number..."
              className="flex-1 min-w-[220px] h-[42px] border border-[#DCE3EF] rounded-[10px] px-3.5 text-sm outline-none focus:border-xevera-600 bg-white" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="min-w-[160px] h-[42px] border border-[#DCE3EF] bg-white rounded-[10px] px-3.5 text-sm outline-none focus:border-xevera-600">
              <option value="all">All Categories</option>
              <option value="Flooding">Flooding</option>
              <option value="Road Damage">Road Damage</option>
              <option value="Garbage / Waste">Garbage / Waste</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Water Problem">Water Problem</option>
              <option value="Drainage">Drainage</option>
            </select>
            <button onClick={() => { setStatFilter('all'); setSearch(''); setCategoryFilter('all'); }}
              className={`border rounded-[10px] px-5 py-2.5 font-bold cursor-pointer transition-colors ${
                statFilter === 'all' && !search && categoryFilter === 'all' ? 'bg-xevera-600 border-xevera-600 text-white' : 'border-[#DCE3EF] bg-white text-[#1A2C53]'
              }`}>All</button>
            <button onClick={() => setSortNewest(v => !v)}
              className="border border-[#DCE3EF] bg-white rounded-[10px] px-5 py-2.5 font-bold text-[#1A2C53] cursor-pointer min-w-[125px]">
              {sortNewest ? 'Newest ▼' : 'Oldest ▲'}
            </button>
          </section>

          {/* TABLE HEADER */}
          <div className="hidden lg:grid grid-cols-[2.1fr_1.15fr_1.2fr_1.15fr_1.15fr_.8fr_.35fr] items-center px-6 pt-5 pb-2.5 text-[11px] font-extrabold text-[#667795]">
            <div>REPORT</div><div>CATEGORY</div><div>LOCATION</div><div>REFERENCE NO.</div><div>DATE REPORTED</div><div>STATUS</div><div>ACTION</div>
          </div>

          {/* ROWS */}
          {!items ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-[72px] rounded-[14px] bg-white border border-[#E6EBF3] animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-[#DC2626] bg-white border border-[#E6EBF3] rounded-[14px]">
              Unable to load reports.
              <button onClick={load} className="block mx-auto mt-3 px-5 h-9 rounded-lg bg-xevera-600 text-white text-xs font-bold cursor-pointer border-0">Retry</button>
            </div>
          ) : paged.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#7B879D] bg-white border border-[#E6EBF3] rounded-[14px]">No reports found.</div>
          ) : (
            paged.map(r => (
              <div key={r.id} onClick={() => openDetail(r.id)}
                className="grid lg:grid-cols-[2.1fr_1.15fr_1.2fr_1.15fr_1.15fr_.8fr_.35fr] items-center gap-y-3 bg-white border border-[#E6EBF3] rounded-[14px] mb-[7px] min-h-[72px] lg:min-h-0 py-4 lg:py-2.5 px-4 lg:px-[18px] cursor-pointer transition-all hover:border-[#A9C7FF] hover:shadow-[0_5px_20px_rgba(20,104,255,0.07)] hover:-translate-y-px">
                <div className="flex items-center gap-3.5">
                  {r.photos && r.photos.length > 0 ? (
                    <img src={uploadUrl(r.photos[0])} alt={r.title} className="w-[46px] h-[46px] rounded-[9px] object-cover flex-shrink-0 bg-[#EAF2FF] border border-[#E4E9F2]" />
                  ) : (
                    <span className="w-[46px] h-[46px] rounded-[9px] bg-[#EAF2FF] grid place-items-center text-xl text-xevera-600 flex-shrink-0">▣</span>
                  )}
                  <div className="min-w-0">
                    <strong className="block text-sm text-[#172033] truncate">{r.title}</strong>
                    <small className="block text-[#70809E] mt-1 truncate">Reported by: {r.reporter}</small>
                  </div>
                </div>
                <div className="text-[13px] text-[#1C315C]">{r.category || '—'}</div>
                <div className="text-[13px] text-[#1C315C]">⌖ {r.location || '—'}</div>
                <div className="text-[13px] font-extrabold text-xevera-600">{r.id}</div>
                <div className="text-[13px] text-[#1C315C] whitespace-pre-line leading-snug">{fmtDateTime(r.created_at)}</div>
                <div><span className={`inline-flex items-center gap-[7px] rounded-full px-3 py-1.5 text-[11px] font-extrabold ${pillCls(getEffectiveStatus(r.status, r.is_suspicious))}`}><span className="w-[7px] h-[7px] rounded-full bg-current" />{getEffectiveStatus(r.status, r.is_suspicious)}</span></div>
                <div className="text-2xl text-[#4C638A] hidden lg:block">›</div>
              </div>
            ))
          )}

          {/* PAGINATION */}
          {!error && items && filtered.length > 0 && (
            <div className="flex justify-between items-center px-5 py-4 text-[13px] text-[#52627F]">
              <span>Showing {filtered.length === 0 ? 0 : (safePage - 1) * 7 + 1} to {(safePage - 1) * 7 + paged.length} of {filtered.length} reports</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="w-[38px] h-[38px] border border-[#DCE4EF] rounded-[9px] bg-white cursor-pointer disabled:opacity-40">‹</button>
                {pageButtons.slice(0, 5).map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-[38px] h-[38px] border rounded-[9px] bg-white cursor-pointer ${
                      n === safePage ? 'border-xevera-600 text-xevera-600 font-bold' : 'border-[#DCE4EF]'
                    }`}>{n}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  className="w-[38px] h-[38px] border border-[#DCE4EF] rounded-[9px] bg-white cursor-pointer disabled:opacity-40">›</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ============================== DETAIL VIEW ============================== */
  const doneCount = timeline.filter(t => t.done).length;

  return (
    <div className="w-full max-w-[1460px] mx-auto px-5 md:px-9 pt-4 pb-12">
        <button onClick={() => { setView('list'); load(); }}
        className="inline-flex items-center gap-2 text-[#263B61] font-bold mb-4 mt-1 bg-transparent border-0 cursor-pointer hover:text-xevera-600 transition-colors">
        ← Back to Track Reports
      </button>

      <section className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-[18px] items-start">
        {/* LEFT COLUMN */}
        <aside className="space-y-[18px]">
          <div className="bg-white border border-[#E4E9F2] rounded-2xl p-[22px]">
            <h2 className="text-lg font-bold mb-5 mt-0 m-0 text-[#172033]" style={{ marginBottom: 20 }}>Report Progress</h2>
            {timeline.map((t, i) => (
              <div key={t.key + i} className={`relative pl-[43px] ${i < timeline.length - 1 ? 'pb-7' : ''}`}>
                {i < timeline.length - 1 && (
                  <span className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-32px)] bg-[#CFE0FF]" />
                )}
                <span className={`absolute left-0 top-0 w-[25px] h-[25px] rounded-full grid place-items-center text-xs text-white ${
                  t.rejected ? 'bg-[#EF4444]' : t.done ? 'bg-[#12A864]' : i === doneCount ? 'bg-xevera-600' : 'bg-[#8A94A8]'
                }`}>
                  {t.done ? '✓' : t.rejected ? '×' : i === doneCount ? '●' : '○'}
                </span>
                <strong className="text-[13px] text-[#172033]">{t.key}</strong>
                <time className="float-right text-[11px] text-[#667795] whitespace-pre-line">{t.date || ''}</time>
                <p className="text-xs text-[#687896] leading-relaxed mt-1.5 mb-0">{t.text}{t.note ? ` — ${t.note}` : ''}</p>
              </div>
            ))}

            {/* Under Review entry — shown when flagged */}
            {detail.is_suspicious && (
              <div className="relative pl-[43px] pb-7">
                <span className="absolute left-[11px] top-6 w-0.5 h-[calc(100%-32px)] bg-[#F5E6A3]" />
                <span className="absolute left-0 top-0 w-[25px] h-[25px] rounded-full grid place-items-center text-xs bg-[#FFF3CD] text-[#B8860B]">{'\u26A0'}</span>
                <strong className="text-[13px] text-[#856404]">Under Review</strong>
                <p className="text-xs text-[#856404] leading-relaxed mt-1.5 mb-0">This report is being reviewed by our team for verification.</p>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-[#E4E9F2]">
              <h2 className="text-lg font-bold mb-4 mt-0 text-[#172033]">Report Information</h2>
              {[
                ['Reference No.', detail.id],
                ['Category', detail.category || '—'],
                ['Location', detail.location || '—'],
                ['Reported On', fmtDateTime(detail.created_at)],
                ['Reported By', detail.reporter],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 my-3 text-[13px]">
                  <span className="text-[#667795]">{k}</span>
                  <strong className="text-right break-words">{v}</strong>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN */}
        <section className="bg-white border border-[#E4E9F2] rounded-2xl p-[22px]">
          <h2 className="text-lg font-bold mb-5 m-0 text-[#172033]">Report Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-[330px_minmax(0,1fr)] gap-6 items-start">
            {beforePhoto ? (
              <img src={uploadUrl(beforePhoto)} alt="Report photo"
                className="w-full h-[195px] object-cover rounded-xl bg-[#EAF1FB]" />
            ) : (
              <div className="w-full h-[195px] rounded-xl bg-[#EAF1FB] grid place-items-center text-3xl text-[#9DB4D8]">▣</div>
            )}
            <div>
              <h1 className="text-[25px] font-bold mb-2 m-0 break-words text-[#172033]">{detail.title}</h1>
              <div className="text-xevera-600 font-extrabold mb-3">{detail.id}</div>
              <span className={`inline-flex items-center gap-[7px] rounded-full px-3 py-1.5 text-[11px] font-extrabold ${pillCls(getEffectiveStatus(detail.status, detail.is_suspicious))}`}>
                <span className="w-[7px] h-[7px] rounded-full bg-current" />{getEffectiveStatus(detail.status, detail.is_suspicious)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#E4EAF2] rounded-xl mt-5 overflow-hidden">
            {[
              ['▣ Category', detail.category || '—'],
              ['⌖ Location', detail.location || '—'],
              ['▣ Reported On', fmtDateTime(detail.created_at)],
              ['♙ Reported By', detail.reporter || 'Anonymous'],
            ].map(([label, v], i) => (
              <div key={label} className={`p-4 ${i < 3 ? 'md:border-r border-b md:border-b-0 border-[#E4EAF2]' : ''}`}>
                <small className="block text-[#667795] mb-1.5">{label}</small>
                <strong className="text-[13px] break-words">{v}</strong>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-[#E4E9F2]">
            <h3 className="text-[15px] font-bold mb-2.5 mt-0 text-[#172033]">Description</h3>
            <p className="text-[#586987] leading-relaxed text-sm m-0">{detail.description || '—'}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_.9fr] gap-4 mt-[18px]">
            {/* UPDATES & NOTES */}
            <div className="pt-[18px] border-t border-[#E4E9F2]">
              <h3 className="text-[15px] font-bold mb-2.5 mt-0 text-[#172033]">Updates &amp; Notes</h3>
              {[...(history || [])].reverse().filter(h => h.actor).slice(0, 3).map(h => (
                <div key={'n' + h.id} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-3">
                    <span className="w-[42px] h-[42px] rounded-full bg-[#E8F1FF] grid place-items-center text-xevera-600 font-extrabold text-xs flex-shrink-0">
                      {(h.actor || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <div>
                      <strong className="text-xs block">{h.actor}</strong>
                      <small className="text-[#6D7B99] block">Staff Update · {h.new_status}</small>
                    </div>
                  </div>
                  {h.note && <p className="ml-[54px] mt-2.5 text-[13px] text-[#52627F] leading-relaxed m-0">{h.note}</p>}
                </div>
              ))}
              {history.filter(h => h.actor).length === 0 && (
                <p className="text-xs text-[#9AA5B7] m-0">No staff updates yet.</p>
              )}

              {/* RESOLUTION EVIDENCE */}
              {photos.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#E4E9F2]">
                  <h3 className="text-[15px] font-bold mb-2.5 mt-0 text-[#172033]">Resolution Evidence</h3>
                  <div className={`grid gap-2.5 items-center ${photos.length > 1 ? 'grid-cols-[1fr_45px_1fr]' : 'grid-cols-1'}`}>
                    <div>
                      <small className="block text-[#687896] mb-1">Before</small>
                      <img src={uploadUrl(beforePhoto)} alt="Before" className="w-full h-[170px] object-cover rounded-[10px]" />
                    </div>
                    {afterPhoto && (
                      <>
                        <span className="text-xevera-600 text-2xl text-center">→</span>
                        <div>
                          <small className="block text-[#687896] mb-1">After</small>
                          <img src={uploadUrl(afterPhoto)} alt="After" className="w-full h-[170px] object-cover rounded-[10px]" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CURRENT STATUS + FEEDBACK */}
            <div>
              <div className="rounded-xl p-[18px] bg-[#FBFFFD] border border-[#DFE9E5]">
                <h3 className="text-sm font-bold mb-4 mt-0 text-[#172033]">Current Status</h3>
                <div className="flex gap-3 items-center">
                  <span className={`w-[45px] h-[45px] rounded-full grid place-items-center text-xl border-2 flex-shrink-0 ${
                    detail.status === 'Resolved' || detail.status === 'Closed'
                      ? 'border-[#36B878] text-[#12A864]'
                      : 'border-xevera-600 text-xevera-600'
                  }`}>✓</span>
                  <div>
                    <strong className={`block ${detail.status === 'Resolved' || detail.status === 'Closed' ? 'text-[#12A864]' : 'text-xevera-600'}`}>{detail.status}</strong>
                    <span className="text-xs text-[#687896] block">Handled by {(currentStatusMeta.by) || 'the Xevera team'}</span>
                    <span className="text-xs text-[#687896] block whitespace-pre-line">{currentStatusMeta.date}</span>
                  </div>
                </div>
              </div>

              {/* FEEDBACK (residents only) */}
              {detail.status === 'Resolved' || detail.status === 'Closed' ? (
                <div className="bg-white border border-[#E4E9F2] rounded-2xl p-[18px] mt-5">
                  {fbDone ? (
                    <div className="bg-[#EAF9EF] text-[#12945A] p-3.5 rounded-lg text-[13px] font-semibold text-center">
                      ✓ Thank you! Your feedback has been submitted.
                    </div>
                  ) : (
                    <>
                      <h3 className="text-[15px] font-bold mb-2 mt-0 text-[#172033]">How was your experience?</h3>
                      <p className="text-[13px] text-[#64728E] mb-3.5 mt-0">Was this issue resolved?</p>
                      <div className="flex gap-2.5">
                        <button type="button" onClick={() => setFbChoice('yes')}
                          className={`flex-1 py-2.5 rounded-lg font-bold cursor-pointer transition-colors ${
                            fbChoice === 'yes' ? 'bg-[#12945A] border-[#12945A] text-white' : 'border border-[#86DDB2] bg-[#F5FFF9] text-[#12945A]'
                          }`}>👍 Yes, resolved</button>
                        <button type="button" onClick={() => setFbChoice('no')}
                          className={`flex-1 py-2.5 rounded-lg font-bold cursor-pointer transition-colors ${
                            fbChoice === 'no' ? 'bg-[#E33434] border-[#E33434] text-white' : 'border border-[#FFC2C2] bg-[#FFF9F9] text-[#E33434]'
                          }`}>👎 Not yet</button>
                      </div>
                      <textarea value={fbComment} onChange={e => setFbComment(e.target.value)}
                        placeholder="Write your comment..."
                        className="w-full h-[90px] mt-3.5 resize-none border border-[#DCE3EF] rounded-lg p-3 outline-none text-[13px] focus:border-xevera-600 placeholder:text-[#94A3B8]" />
                      <button onClick={submitFeedback} disabled={fbBusy}
                        className="mt-2.5 float-right border-0 bg-xevera-600 text-white px-5 py-2.5 rounded-lg font-bold cursor-pointer hover:bg-xevera-700 disabled:opacity-50 transition-colors">
                        {fbBusy ? 'Submitting...' : 'Submit'}
                      </button>
                      <div className="clear-both" />
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-[#E4E9F2] rounded-2xl p-[18px] mt-5 text-xs text-[#9AA5B7]">
                  Feedback will be available once this report is resolved.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <div className="mt-4 bg-[#F1F7FF] border border-[#CFE0FF] px-5 py-4 rounded-xl text-[#40547A] text-[13px]">
        ✉️ You will receive an email notification once this report is closed.
      </div>
    </div>
  );
}