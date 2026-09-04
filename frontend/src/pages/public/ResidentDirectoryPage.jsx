import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import PageHero from '../../components/PageHero';
import Icon from '../../components/Icon';

function initials(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export default function ResidentDirectoryPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch('residents/directory.php')
      .then((d) => setItems(Array.isArray(d?.items) ? d.items : []))
      .catch((e) => setError(e.message || 'Failed to load the directory.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const visible = query.trim()
    ? items.filter((r) => (r.name + ' ' + (r.address || '')).toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8">
      <PageHero
        eyebrow="Community"
        title="Resident Directory"
        description="Meet the active members of Barangay San Isidro, Xevera and see their community contributions."
      />

      <div className="mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search residents by name or address..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#DFE6EF] text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]"
          />
        </div>
        <p className="text-xs text-[#6B7280]">
          {loading ? 'Loading...' : error ? '—' : `${visible.length} active resident${visible.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[20px] border border-line p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#F3F4F6]" />
                <div className="flex-1 space-y-1.5"><div className="h-4 w-3/4 bg-[#F3F4F6] rounded" /><div className="h-3 w-1/2 bg-[#F3F4F6] rounded" /></div>
              </div>
              <div className="h-3 w-full bg-[#F3F4F6] rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-[20px] border border-line text-center py-14">
          <div className="mb-3 text-[#DC2626] flex justify-center"><Icon name="alert" size={34} strokeWidth={1.6} /></div>
          <p className="text-sm font-bold text-[#111827]">Couldn't load the directory</p>
          <p className="text-xs text-[#6B7280] mt-1">{error}</p>
          <button onClick={load}
            className="mt-5 px-5 py-2.5 rounded-full bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-line text-center py-14">
          <div className="mb-3 text-[#9CA3AF] flex justify-center"><Icon name="search" size={34} strokeWidth={1.6} /></div>
          <p className="text-sm font-bold text-[#111827]">No residents found</p>
          <p className="text-xs text-[#6B7280] mt-1">Try a different name or address.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((r) => (
            <div key={r.id} className="bg-white rounded-[20px] border border-line p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05),0_4px_12px_rgba(16,24,40,0.05)] hover:shadow-[0_10px_24px_rgba(16,24,40,0.10)] hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-xevera-600 to-xevera-500 text-white flex items-center justify-center text-[13px] font-extrabold flex-shrink-0">
                  {initials(r.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-[#111827] truncate">{r.name}</div>
                  <div className="text-[11px] text-[#6B7280] truncate">{r.address || 'Xevera'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-[#F1F2F5] text-xs text-[#6B7280]">
                <span className="flex items-center gap-1.5"><Icon name="clipboard" size={12} /> {r.submitted}</span>
                <span className="flex items-center gap-1.5 text-[#15803D]"><Icon name="check" size={12} /> {r.resolved} resolved</span>
                <span className="flex items-center gap-1.5"><Icon name="thumbsup" size={12} /> {r.likes_received}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
