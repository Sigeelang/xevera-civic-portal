import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import Icon from '../../components/Icon';
import ResidentLayout from '../../layouts/ResidentLayout';
import ResidentPageHeader from '../../components/resident/ResidentPageHeader';
import { useToast } from '../../components/Toast';
import ReportImage from '../../components/ReportImage';
import { publicStatusLabel } from '../../components/ReportCard';
import { getReportStatusConfig, getEffectiveStatus } from '../../utils/reportStatus';

const CATEGORY_INFO = {
  'Flooding': { icon: 'flood', label: 'Flooding' },
  'Road Damage': { icon: 'road', label: 'Road' },
  'Garbage / Waste': { icon: 'trash', label: 'Garbage' },
  'Streetlight': { icon: 'bolt', label: 'Light' },
  'Water Problem': { icon: 'drop', label: 'Water' },
  'Drainage': { icon: 'flood', label: 'Drainage' },
  'Environmental': { icon: 'leaf', label: 'Environment' },
  'Public Safety': { icon: 'shield', label: 'Safety' },
  'Other Issues': { icon: 'clipboard', label: 'Other' },
  'Waste': { icon: 'trash', label: 'Waste' },
  'Garbage': { icon: 'trash', label: 'Garbage' },
  'Water': { icon: 'drop', label: 'Water' },
  'Water Leak': { icon: 'drop', label: 'Leak' },
  'Road & Infrastructure': { icon: 'road', label: 'Road' },
  'Road': { icon: 'road', label: 'Road' },
  'Flood': { icon: 'flood', label: 'Flood' },
  'Electrical': { icon: 'bolt', label: 'Electrical' },
  'Illegal Parking': { icon: 'car', label: 'Parking' },
  'Noise': { icon: 'volume', label: 'Noise' },
  'Trees': { icon: 'tree', label: 'Trees' },
  'Others': { icon: 'clipboard', label: 'Other' },
};

const CATEGORY_FALLBACK = { icon: 'clipboard', label: 'Report' };
const STATUS_FILTERS = ['All', 'Pending', 'Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
const PAGE_SIZE_MINE = 4;
const PAGE_SIZE_ALL = 5;

function StatusPill({ status, isSuspicious }) {
  const effectiveStatus = getEffectiveStatus(status, isSuspicious);
  const cfg = getReportStatusConfig(effectiveStatus);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[20px] text-[10px] font-extrabold whitespace-nowrap ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 border border-[#DFE6EF] rounded-[14px] p-2.5 bg-white animate-pulse">
      <div className="w-full sm:w-[245px] h-[118px] rounded-[10px] bg-[#EEF2F7] flex-shrink-0" />
      <div className="flex-1 space-y-3 py-1">
        <div className="h-4 w-1/3 bg-[#EEF2F7] rounded" />
        <div className="h-5 w-1/2 bg-[#EEF2F7] rounded" />
        <div className="h-3 w-2/3 bg-[#EEF2F7] rounded" />
      </div>
    </div>
  );
}

function getCategoryClass(category) {
  if (category === 'Road & Infrastructure' || category === 'Road Damage' || category === 'Road') return 'community-category-road';
  if (category === 'Utilities' || category === 'Streetlight' || category === 'Electrical') return 'community-category-utility';
  if (category === 'Sanitation' || category === 'Garbage / Waste' || category === 'Waste' || category === 'Garbage') return 'community-category-sanitation';
  if (category === 'Flooding' || category === 'Drainage' || category === 'Flood' || category === 'Water Problem' || category === 'Water') return 'community-category-flooding';
  return 'community-category-safety';
}

function getStatusClass(status, isSuspicious) {
  const s = getEffectiveStatus(status, isSuspicious);
  if (s === 'Under Review') return 'community-status-review';
  if (s === 'Resolved' || s === 'Closed') return 'community-status-resolved';
  if (s === 'Pending' || s === 'Rejected') return 'community-status-received';
  return 'community-status-progress';
}

export default function ResidentMyReportsPage({ onViewReport, onNavigate, statusPreset, initialScope }) {
  const showToast = useToast();
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState(initialScope || 'all');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (statusPreset) { setStatus(statusPreset); setPage(1); }
  }, [statusPreset]);

  useEffect(() => {
    if (initialScope && (initialScope === 'mine' || initialScope === 'all')) { setScope(initialScope); setPage(1); }
  }, [initialScope]);

  /* Community scope has no Pending filter — drop a stale selection. */
  useEffect(() => {
    if (scope === 'all') setStatus('All');
  }, [scope]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = scope === 'all' ? 'reports/list.php?limit=100&sort=newest' : 'reports/my.php?filter=mine&limit=100&sort=newest';
      const data = await apiFetch(endpoint);
      const items = data.items || data.reports || [];
      setAllReports(items);
    } catch (err) {
      setError(err.message || 'Failed to load reports.');
      setAllReports([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach((s) => { counts[s] = 0; });
    allReports.forEach((r) => {
      const effective = getEffectiveStatus(r.status, r.is_suspicious);
      const label = publicStatusLabel(effective);
      if (counts[label] !== undefined) counts[label]++;
    });
    counts['All'] = allReports.length;
    return counts;
  }, [allReports]);

  const filtered = useMemo(() => {
    let result = [...allReports];
    /* Community Reports never shows still-pending submissions. */
    if (scope === 'all') {
      result = result.filter((r) => r.status !== 'Pending');
    }
    if (status !== 'All' && status !== 'all') {
      result = result.filter((r) => {
        const effective = getEffectiveStatus(r.status, r.is_suspicious);
        const label = publicStatusLabel(effective);
        return label === status || r.status === status;
      });
    }
    if (scope === 'all' && categoryFilter !== 'all') {
      result = result.filter((r) => String(r.category || '') === categoryFilter);
    }
    if (scope === 'all' && barangayFilter !== 'all') {
      const blk = barangayFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blkRe = new RegExp(`\\b${blk}\\b`, 'i');
      result = result.filter((r) => blkRe.test(String(r.location || '')) || String(r.barangay || '').toLowerCase() === barangayFilter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.description || r.desc || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date);
      const dateB = new Date(b.created_at || b.date);
      if (sort === 'oldest') return dateA - dateB;
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
      return dateB - dateA;
    });
    return result;
  }, [allReports, status, search, sort, categoryFilter, barangayFilter, scope]);

  const pageSize = scope === 'all' ? PAGE_SIZE_ALL : PAGE_SIZE_MINE;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, filtered.length);

  const submitted = allReports.length;
  const pending = statusCounts['Pending'] || 0;
  const inProgress = (statusCounts['In Progress'] || 0) + (statusCounts['Assigned'] || 0);
  const resolved = (statusCounts['Resolved'] || 0) + (statusCounts['Closed'] || 0);

  function goTo(action, preset) {
    if (onNavigate) onNavigate(action, preset);
  }

  function changeStatus(s) { setStatus(s); setPage(1); }

  function resetFilters() {
    setStatus('All');
    setSearch('');
    setSort('newest');
    setCategoryFilter('all');
    setBarangayFilter('all');
    setPage(1);
    showToast('Filters reset.');
  }

  function clearFilters() {
    setSearch('');
    setCategoryFilter('all');
    setStatus('All');
    setBarangayFilter('all');
    setPage(1);
  }

  function goPage(p) { setPage(Math.max(1, Math.min(p, totalPages))); }

  function openModal(r) { setSelectedReport(r); }
  function closeModal() { setSelectedReport(null); }

  // ---------- COMMUNITY VIEW (provided HTML design, responsive) ----------
  if (scope === 'all') {
    return (
      <ResidentLayout activePage="community-reports" onNavigate={onNavigate}>
        <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
          <style>{`
            .community-wrap{width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-x:hidden}
            .community-wrap *{box-sizing:border-box}
            .community-wrap img{max-width:100%}
            .community-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px;width:100%;max-width:100%;min-width:0}
            .community-page-title{color:#122b54;font-size:27px;font-weight:850;letter-spacing:-.6px;line-height:1.1;overflow-wrap:break-word;word-break:break-word}
            .community-page-desc{margin-top:5px;color:#617493;font-size:12px;overflow-wrap:break-word}
            .community-report-btn{height:39px;padding:0 17px;border:0;border-radius:9px;background:linear-gradient(135deg,#146cff,#1259dd);color:#fff;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:14px;box-shadow:0 8px 18px rgba(18,100,245,.18);white-space:nowrap;flex:none}
            .community-stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-bottom:20px;width:100%;max-width:100%;min-width:0}
            .community-stat-card{min-height:125px;background:#fff;border:1px solid #dce5f1;border-radius:13px;padding:17px;box-shadow:0 4px 14px rgba(37,72,121,.035);width:100%;max-width:100%;min-width:0}
            .community-stat-icon{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;margin-bottom:10px}
            .community-stat-blue{background:#eaf2ff;color:#1264f5}
            .community-stat-orange{background:#fff3d9;color:#e99b18}
            .community-stat-purple{background:#eee8ff;color:#7755df}
            .community-stat-green{background:#e5f8f0;color:#18a673}
            .community-stat-label{color:#526783;font-size:11px;font-weight:650;overflow-wrap:break-word}
            .community-stat-number{color:#122b54;font-size:26px;line-height:1.1;font-weight:850;margin-top:3px}
            .community-stat-desc{color:#7a8aa5;font-size:9px;margin-top:2px;overflow-wrap:break-word}
            .community-reports-card{background:#fff;border:1px solid #dce5f1;border-radius:14px;box-shadow:0 4px 15px rgba(37,72,121,.035);overflow:hidden;width:100%;max-width:100%;min-width:0}
            .community-status-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;width:100%;max-width:100%}
            .community-status-tab{padding:7px 12px;border-radius:20px;font-size:11px;font-weight:800;border:1px solid #dce5f1;background:#fff;color:#56627A;cursor:pointer;white-space:nowrap;flex:none}
            .community-status-tab.active{background:#1264f5;border-color:#1264f5;color:#fff}
            .community-filters{padding:17px;display:grid;grid-template-columns:minmax(240px,1fr) 150px 150px 150px;gap:10px;border-bottom:1px solid #dce5f1;width:100%;max-width:100%;min-width:0}
            .community-search-box{position:relative;width:100%;max-width:100%;min-width:0}
            .community-search-input,.community-filter-select{width:100%;max-width:100%;min-width:0;height:37px;border:1px solid #dce5f1;border-radius:8px;background:#fff;outline:none;color:#20365c;font-size:11px;box-sizing:border-box}
            .community-search-input{padding:0 12px 0 35px}
            .community-filter-select{padding:0 10px;cursor:pointer}
            .community-filter-button{height:37px;border:1px solid #dce5f1;background:#fff;border-radius:8px;color:#1264f5;font-size:10px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;width:100%}
            .community-table-wrapper{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;width:100%;max-width:100%}
            .community-mobile-list{display:none}
            .community-table-wrapper::-webkit-scrollbar{height:6px}
            .community-table-wrapper::-webkit-scrollbar-thumb{background:#dce5f1;border-radius:4px}
            .community-reports-table{width:100%;min-width:900px;border-collapse:collapse}
            .community-reports-table th{height:43px;padding:0 17px;text-align:left;color:#71819b;font-size:8px;font-weight:850;letter-spacing:.4px;background:#fff;white-space:nowrap}
            .community-reports-table td{padding:11px 17px;border-top:1px solid #edf1f6;vertical-align:middle}
            .community-issue-cell{display:flex;align-items:center;gap:11px;min-width:280px}
            .community-issue-image{width:69px;height:53px;border-radius:8px;object-fit:cover;background:#eaf0f7;flex:none}
            .community-category-badge,.community-status-badge{display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:20px;font-size:8px;font-weight:800;white-space:nowrap}
            .community-category-road{background:#e8f1ff;color:#3a78d6}
            .community-category-utility{background:#eee9ff;color:#7252dc}
            .community-category-sanitation{background:#e4f7f0;color:#139269}
            .community-category-flooding{background:#e7f2ff;color:#3878cf}
            .community-category-safety{background:#eee9ff;color:#6f4cdb}
            .community-status-progress{background:#fff3d9;color:#dc8a00}
            .community-status-review{background:#FFF3CD;color:#B8860B}
            .community-status-received{background:#ffebeb;color:#dc4545}
            .community-status-resolved{background:#e5f8f0;color:#15936a}
            .community-view-button{width:38px;height:38px;border:1px solid #dce5f1;border-radius:50%;background:#fff;color:#1264f5;display:grid;place-items:center;cursor:pointer;flex:none}
            .community-table-footer{min-height:55px;padding:0 17px;display:flex;align-items:center;justify-content:space-between;gap:15px;border-top:1px solid #dce5f1;flex-wrap:wrap}
            .community-bottom-cta{margin-top:18px;min-height:67px;padding:12px 17px;border:1px solid #dce8fa;border-radius:13px;background:linear-gradient(90deg,#f2f7ff,#f7faff);display:flex;align-items:center;justify-content:space-between;gap:20px;width:100%;max-width:100%;min-width:0}
            @media(max-width:1024px) and (min-width:769px){
              .community-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
              .community-filters{grid-template-columns:1fr 1fr}
              .community-search-box{grid-column:span 2}
            }
            @media(max-width:768px){
              .community-page-header{flex-direction:column;align-items:stretch;gap:12px}
              .community-page-title{font-size:22px}
              .community-report-btn{width:100%;justify-content:center}
              .community-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
              .community-stat-card{min-height:110px;padding:12px}
              .community-filters{grid-template-columns:1fr;gap:8px}
              .community-status-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;max-width:100%;padding-bottom:6px;scrollbar-width:none;-ms-overflow-style:none}
              .community-status-tabs::-webkit-scrollbar{display:none;width:0;height:0}
              .community-status-tab{flex:0 0 auto}
              .community-bottom-cta{flex-direction:column;align-items:stretch}
              .community-bottom-cta button{width:100%;justify-content:center}
              .community-table-footer{flex-direction:column;align-items:stretch;padding:13px 17px}
              .community-table-wrapper{display:none}
              .community-mobile-list{display:block;width:100%;max-width:100%;min-width:0}
              .community-mobile-card{width:100%;max-width:100%;min-width:0;box-sizing:border-box;background:#fff;border-bottom:1px solid #edf1f6;padding:12px 17px}
              .community-mobile-card:last-child{border-bottom:0}
              .community-mobile-img{width:100%;height:150px;border-radius:10px;object-fit:cover;background:#eaf0f7}
              .community-mobile-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}
              .community-mobile-title{color:#172d52;font-size:14px;font-weight:800;line-height:1.35;overflow-wrap:break-word;word-break:break-word}
              .community-mobile-desc{color:#687b98;font-size:12px;line-height:1.5;margin-top:4px;overflow-wrap:break-word;word-break:break-word}
              .community-mobile-meta{color:#6e809d;font-size:11px;margin-top:6px}
            }
            @media(max-width:412px){
              .community-stats-grid{gap:8px}
              .community-stat-card{padding:10px;min-height:100px}
              .community-stat-number{font-size:20px}
              .community-filters{padding:12px}
            }
            @media(max-width:390px){
              .community-stat-card{padding:9px}
              .community-stat-number{font-size:19px}
            }
            @media(max-width:375px){
              .community-stats-grid{gap:7px}
              .community-stat-card{padding:8px;min-height:95px}
              .community-stat-number{font-size:18px}
              .community-filters{padding:10px}
            }
          `}</style>
          <div className="community-wrap pt-4 sm:pt-6">
            <div className="community-page-header">
              <div style={{ minWidth: 0 }}>
                <h1 className="community-page-title">Community Reports</h1>
                <p className="community-page-desc">View and track issues reported by other residents in your community.</p>
              </div>
              {/* Report an Issue button removed on community reports - function kept via sidebar - D:\GAMES\backup (9)\frontend */}
            </div>
            <div className="community-reports-card">
              {/* Status tab buttons removed on community reports - filtering still works via dropdowns - D:\GAMES\backup (9)\frontend */}
              <div className="community-filters">
                <div className="community-search-box">
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7487a4' }}><Icon name="search" size={15} /></span>
                  <input className="community-search-input" type="search" placeholder="Search reports by title, location, or category..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select className="community-filter-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Categories</option>
                  <option value="Road & Infrastructure">Road &amp; Infrastructure</option>
                  <option value="Road Damage">Road Damage</option>
                  <option value="Garbage / Waste">Garbage / Waste</option>
                  <option value="Sanitation">Sanitation</option>
                  <option value="Flooding">Flooding</option>
                  <option value="Drainage">Drainage</option>
                  <option value="Streetlight">Streetlight</option>
                  <option value="Water Problem">Water Problem</option>
                  <option value="Public Safety">Public Safety</option>
                  <option value="Environmental">Environmental</option>
                </select>
                <select className="community-filter-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="All">All Statuses</option>
                  <option value="Verified">Verified</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
                <select className="community-filter-select" value={barangayFilter} onChange={(e) => { setBarangayFilter(e.target.value); setPage(1); }}>
                  <option value="all">All Blocks</option>
                  {Array.from({ length: 18 }).map((_, i) => (
                    <option key={i + 1} value={`Block ${i + 1}`}>Block {i + 1}</option>
                  ))}
                </select>
                {/* Filter button removed on community reports - function kept - D:\GAMES\backup (9)\frontend */}
              </div>
              <div className="community-table-wrapper">
                <table className="community-reports-table">
                  <thead>
                    <tr><th>ISSUE</th><th>CATEGORY</th><th>LOCATION</th><th>STATUS</th><th>REPORTED</th><th>ACTIONS</th></tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#7485a0' }}>Loading community reports...</td></tr>
                    ) : error ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#b42318' }}>{error} <button onClick={loadAll} style={{ marginLeft: 8, color: '#1264f5', background: 'none', border: 0, cursor: 'pointer' }}>Retry</button></td></tr>
                    ) : visible.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#7485a0' }}><div style={{ fontWeight: 800, color: '#122b54' }}>No reports found</div><div style={{ fontSize: 10, marginTop: 4 }}>Try changing your search or filters.</div></td></tr>
                    ) : visible.map((r) => {
                      const firstPhoto = r.photos && r.photos[0] ? r.photos[0] : null;
                      const imgSrc = firstPhoto ? uploadUrl(firstPhoto) : null;
                      return (
                        <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openModal(r)}>
                          <td>
                            <div className="community-issue-cell">
                              {imgSrc ? <img src={imgSrc} alt={r.title} style={{ width: 69, height: 53, borderRadius: 8, objectFit: 'cover', background: '#eaf0f7', flex: 'none' }} /> : <div style={{ width: 69, height: 53, borderRadius: 8, background: '#eaf0f7', display: 'grid', placeItems: 'center', color: '#9aaac0', flex: 'none' }}><Icon name="file" size={20} /></div>}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#172d52', fontSize: 11, fontWeight: 800, marginBottom: 3 }}>{r.title}</div>
                                <div style={{ maxWidth: 350, color: '#687b98', fontSize: 9, lineHeight: 1.4, marginBottom: 3 }}>{r.desc || r.description || 'No description'}</div>
                                <div style={{ color: '#6e809d', fontSize: 8 }}>{r.location || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className={`community-category-badge ${getCategoryClass(r.category)}`}>{r.category || '—'}</span></td>
                          <td><div style={{ color: '#415777', fontSize: 9, fontWeight: 750 }}>{r.location || '—'}</div></td>
                          <td><span className={`community-status-badge ${getStatusClass(r.status, r.is_suspicious)}`}>{getEffectiveStatus(r.status, r.is_suspicious)}</span></td>
                          <td><div style={{ color: '#617493', fontSize: 8, lineHeight: 1.5 }}>{r.date}<br />{r.created_at ? new Date(String(r.created_at).replace(' ', 'T') + '+08:00').toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : ''}</div></td>
                          <td><button className="community-view-button" onClick={(e) => { e.stopPropagation(); openModal(r); }} title="View report"><Icon name="search" size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="community-mobile-list">
                {loading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#7485a0', fontSize: 12 }}>Loading community reports...</div>
                ) : error ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#b42318', fontSize: 12 }}>{error} <button onClick={loadAll} style={{ marginLeft: 8, color: '#1264f5', background: 'none', border: 0, cursor: 'pointer' }}>Retry</button></div>
                ) : visible.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#7485a0' }}><div style={{ fontWeight: 800, color: '#122b54', fontSize: 13 }}>No reports found</div><div style={{ fontSize: 11, marginTop: 4 }}>Try changing your search or filters.</div></div>
                ) : visible.map((r) => {
                  const mPhoto = r.photos && r.photos[0] ? r.photos[0] : null;
                  const mSrc = mPhoto ? uploadUrl(mPhoto) : null;
                  return (
                    <div key={r.id} className="community-mobile-card" onClick={() => openModal(r)}>
                      {mSrc ? <img src={mSrc} alt={r.title} className="community-mobile-img" loading="lazy" /> : null}
                      <div className="community-mobile-row">
                        <span className={`community-category-badge ${getCategoryClass(r.category)}`}>{r.category || '—'}</span>
                        <span className={`community-status-badge ${getStatusClass(r.status, r.is_suspicious)}`}>{getEffectiveStatus(r.status, r.is_suspicious)}</span>
                      </div>
                      <div className="community-mobile-title">{r.title}</div>
                      <div className="community-mobile-desc">{r.desc || r.description || 'No description'}</div>
                      <div className="community-mobile-meta">{r.location || '—'} · {r.date}</div>
                    </div>
                  );
                })}
              </div>
              <div className="community-table-footer">
                <div style={{ color: '#71819b', fontSize: 9 }}>Showing {from} to {to} of {filtered.length} reports</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button onClick={() => goPage(safePage - 1)} disabled={safePage <= 1} style={{ minWidth: 31, height: 31, border: '1px solid #dce5f1', borderRadius: 7, background: '#fff', cursor: 'pointer', opacity: safePage <= 1 ? 0.45 : 1 }}>‹</button>
                  {Array.from({ length: Math.min(totalPages, 6) }).map((_, i) => {
                    const n = i + 1;
                    return <button key={n} onClick={() => goPage(n)} style={{ minWidth: 31, height: 31, border: '1px solid ' + (safePage === n ? '#1264f5' : '#dce5f1'), borderRadius: 7, background: safePage === n ? '#edf4ff' : '#fff', color: safePage === n ? '#1264f5' : '#415777', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>{n}</button>;
                  })}
                  <button onClick={() => goPage(safePage + 1)} disabled={safePage >= totalPages} style={{ minWidth: 31, height: 31, border: '1px solid #dce5f1', borderRadius: 7, background: '#fff', cursor: 'pointer', opacity: safePage >= totalPages ? 0.45 : 1 }}>›</button>
                </div>
              </div>
            </div>
            <div className="community-bottom-cta">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 35, height: 35, borderRadius: '50%', background: '#e3efff', color: '#1264f5', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="shield" size={16} /></div>
                <div>
                  <div style={{ color: '#285ba9', fontSize: 11, fontWeight: 800, marginBottom: 3 }}>See something that needs attention?</div>
                  <div style={{ color: '#6b7f9e', fontSize: 9 }}>Help make our community better by reporting issues you encounter.</div>
                </div>
              </div>
              {/* Report an Issue button removed on community reports - function kept via sidebar - D:\GAMES\backup (9)\frontend */}
            </div>
          </div>
          {selectedReport && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,28,57,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={closeModal}>
              <div style={{ width: 'min(560px,100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 17 }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #dce5f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: '#122b54', fontSize: 18, fontWeight: 850 }}>Report Details</h2>
                  <button type="button" aria-label="Close report details" onClick={closeModal} style={{ width: 32, height: 32, border: 0, background: '#f1f5fa', borderRadius: 8, cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ padding: 20 }}>
                  {selectedReport.is_suspicious ? (
                    <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: '#FFF3CD', border: '1px solid #F5E6A3', color: '#856404', fontSize: 11, fontWeight: 700 }}>
                      {'\u26A0\uFE0F'} This report is currently <strong>Under Review</strong> by our team.
                    </div>
                  ) : null}
                  {selectedReport.photos && selectedReport.photos[0] ? <img src={uploadUrl(selectedReport.photos[0])} alt="" style={{ width: '100%', height: 210, objectFit: 'cover', borderRadius: 11, marginBottom: 17 }} /> : null}
                  <h3 style={{ color: '#122b54', fontSize: 18, fontWeight: 850, marginBottom: 8 }}>{selectedReport.title}</h3>
                  <p style={{ color: '#657895', fontSize: 12, lineHeight: 1.7, marginBottom: 17 }}>{selectedReport.description || selectedReport.desc}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: 12, borderRadius: 9, background: '#f6f9fd', border: '1px solid #e7edf5' }}><div style={{ color: '#8391a8', fontSize: 8, fontWeight: 800 }}>Category</div><div style={{ color: '#30496e', fontSize: 10, fontWeight: 700 }}>{selectedReport.category}</div></div>
                    <div style={{ padding: 12, borderRadius: 9, background: '#f6f9fd', border: '1px solid #e7edf5' }}><div style={{ color: '#8391a8', fontSize: 8, fontWeight: 800 }}>Status</div><div style={{ color: '#30496e', fontSize: 10, fontWeight: 700 }}>{getEffectiveStatus(selectedReport.status, selectedReport.is_suspicious)}</div></div>
                    <div style={{ padding: 12, borderRadius: 9, background: '#f6f9fd', border: '1px solid #e7edf5' }}><div style={{ color: '#8391a8', fontSize: 8, fontWeight: 800 }}>Location</div><div style={{ color: '#30496e', fontSize: 10, fontWeight: 700 }}>{selectedReport.location}</div></div>
                    <div style={{ padding: 12, borderRadius: 9, background: '#f6f9fd', border: '1px solid #e7edf5' }}><div style={{ color: '#8391a8', fontSize: 8, fontWeight: 800 }}>Reported</div><div style={{ color: '#30496e', fontSize: 10, fontWeight: 700 }}>{selectedReport.date}</div></div>
                  </div>
                  <button type="button" onClick={() => { closeModal(); if (onViewReport) onViewReport(selectedReport.id); }} style={{ marginTop: 16, width: '100%', height: 40, border: 0, borderRadius: 9, background: '#1264f5', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>View Full Details</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ResidentLayout>
    );
  }

  const stats = [
    { label: 'Submitted', value: submitted, icon: 'clipboard', tint: 'bg-[#EDF4FF] text-xevera-600', desc: 'Total reports submitted' },
    { label: 'Pending', value: pending, icon: 'clock', tint: 'bg-[#FFF5E4] text-[#F3A000]', desc: 'Awaiting review' },
    { label: 'In Progress', value: inProgress, icon: 'wrench', tint: 'bg-[#F0EAFF] text-[#7A4CE0]', desc: 'Currently being handled' },
    { label: 'Resolved', value: resolved, icon: 'check', tint: 'bg-[#E7F8EF] text-[#16A66A]', desc: 'Successfully resolved' },
  ];

  return (
    <ResidentLayout activePage="my-reports" onNavigate={onNavigate}>
      <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
        <ResidentPageHeader
          title="My Reports"
          subtitle="Track the reports you've submitted and follow their progress."
          className="pt-4 sm:pt-6"
        />
        <div className="bg-white rounded-[17px] border border-[#DFE6EF] overflow-hidden" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <div className="p-5 border-b border-[#DFE6EF]">
            <div className="flex gap-2 mb-3" style={{ overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none', maxWidth: '100%' }}>
              {STATUS_FILTERS.map((s) => (
                <button key={s} onClick={() => changeStatus(s)} className={`px-[14px] py-2 rounded-[9px] text-[12px] font-bold border cursor-pointer flex-none whitespace-nowrap ${status === s ? 'bg-[#1769FF] border-[#1769FF] text-white' : 'bg-white border-[#DFE6EF] text-[#56627A]'}`}>
                  {s}<span className="ml-1 opacity-70">{statusCounts[s]}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_165px_85px] gap-2.5" style={{ width: '100%', maxWidth: '100%' }}>
              <div className="relative" style={{ width: '100%', maxWidth: '100%' }}>
                <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search reports by title or location..." className="w-full h-[43px] pl-4 pr-4 rounded-[10px] border border-[#DFE6EF] bg-white text-sm" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} />
              </div>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="h-[43px] px-3 rounded-[10px] border border-[#DFE6EF] bg-white text-sm cursor-pointer" style={{ width: '100%', maxWidth: '100%' }}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
              </select>
              <button onClick={resetFilters} className="h-[43px] rounded-[10px] border border-[#DFE6EF] bg-white font-bold text-sm cursor-pointer" style={{ width: '100%' }}>Filter</button>
            </div>
          </div>
          <div className="px-5 pt-[18px] pb-3 text-[12px] font-bold text-[#5D6980]">Showing {from} to {to} of {filtered.length} reports</div>
          <div className="px-5 pb-4" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            {error ? (
              <div className="text-center py-12"><p className="font-bold mb-1">Unable to load your reports</p><p className="text-sm mb-4">{error}</p><button onClick={loadAll} className="px-5 py-2.5 rounded-[10px] bg-[#1769FF] text-white text-xs font-bold cursor-pointer">Try Again</button></div>
            ) : loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-14"><h3 className="font-extrabold mb-1.5">No reports found</h3><button onClick={() => goTo('submit')} className="px-5 py-2.5 rounded-[10px] bg-[#1769FF] text-white text-xs font-bold cursor-pointer">Submit a Report</button></div>
            ) : (
              <div className="space-y-2" style={{ width: '100%', maxWidth: '100%' }}>
                {visible.map((r) => {
                  const info = CATEGORY_INFO[r.category] || CATEGORY_FALLBACK;
                  const firstPhoto = r.photos && r.photos[0] ? r.photos[0] : null;
                  return (
                    <article key={r.id} className="grid grid-cols-1 md:grid-cols-[245px_1fr_auto] gap-4 border border-[#DFE6EF] rounded-[14px] p-2.5 bg-white" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                      <div className="w-full md:w-[245px] h-[96px] md:h-[118px] rounded-[10px] overflow-hidden bg-[#F3F6FB]" style={{ maxWidth: '100%' }}>
                        {firstPhoto ? <ReportImage src={firstPhoto} alt={r.title} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-[#AAB3C5]"><Icon name={info.icon} size={34} /></div>}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h2 className="text-[17px] font-extrabold leading-snug mb-2" style={{ overflowWrap: 'break-word' }}>{r.title}</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#718098] mb-1.5"><span>{r.location || '—'}</span><span>{r.date}</span></div>
                        <p className="text-[11px] text-[#8A94A7] line-clamp-2">{r.desc || 'No description provided.'}</p>
                      </div>
                      <div className="flex md:flex-col items-center justify-between gap-3">
                        <StatusPill status={r.status} isSuspicious={r.is_suspicious} />
                        <button onClick={() => onViewReport && onViewReport(r.id)} className="h-[38px] px-4 rounded-[9px] border border-[#D9E1EF] bg-white text-[#1769FF] text-[12px] font-extrabold cursor-pointer">View Details</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
          {!loading && !error && filtered.length > 0 && (
            <div className="border-t border-[#DFE6EF] px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-[#7B879D]">Showing {from} to {to} of {filtered.length} reports</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => goPage(safePage - 1)} disabled={safePage <= 1} className="w-[35px] h-[35px] rounded-[8px] border border-[#DFE6EF] bg-white text-[12px] font-bold disabled:opacity-40 cursor-pointer">‹</button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} onClick={() => goPage(i + 1)} className={`w-[35px] h-[35px] rounded-[8px] border text-[12px] font-bold cursor-pointer ${safePage === i + 1 ? 'bg-[#1769FF] border-[#1769FF] text-white' : 'bg-white border-[#DFE6EF]'}`}>{i + 1}</button>
                ))}
                <button onClick={() => goPage(safePage + 1)} disabled={safePage >= totalPages} className="w-[35px] h-[35px] rounded-[8px] border border-[#DFE6EF] bg-white text-[12px] font-bold disabled:opacity-40 cursor-pointer">›</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ResidentLayout>
  );
}
