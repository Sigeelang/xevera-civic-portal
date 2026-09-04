import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../Toast';

function fmtDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' (GMT+8)';
}
function deviceLabel(item) {
  const clean = (s) => String(s || '').replace(/Windows NT 10\.0/i, 'Windows').replace(/Macintosh/i, 'MacOS');
  return `${clean(item?.os) || 'Unknown'} • ${item?.browser || 'Unknown'}`;
}
function deviceIcon(item) {
  const d = String(item?.device || '').toLowerCase();
  const os = String(item?.os || '').toLowerCase();
  if (d.includes('mobile') || d.includes('phone') || os.includes('android') || os.includes('iphone')) return '📱';
  if (d.includes('tablet') || os.includes('ipad')) return '💻';
  if (os.includes('mac')) return '💻';
  return '🖥';
}

export default function ResidentLoginSessions() {
  const toast = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [menuSession, setMenuSession] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('profile/history.php')
      .then((d) => setHistory(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const sessions = history;
  const current = sessions[0] || null;

  function openMenu(e, item) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 5, left: Math.max(10, rect.right - 150) });
    setMenuSession(item);
  }
  function signOutSession(item) {
    setMenuSession(null);
    if (item === current) { toast('Your current session cannot be signed out here.', 'error'); return; }
    if (!window.confirm('Are you sure you want to sign out this session?')) return;
    setHistory((list) => list.filter((s) => s.id !== item.id));
    toast('The selected session has been signed out.');
  }
  function signOutAllOthers() {
    setConfirmAll(false);
    setDrawerOpen(false);
    setHistory((list) => list.filter((s) => s.id === current?.id));
    toast('All other sessions have been signed out.');
  }

  return (
    <>
      {/* Last Login */}
      <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[390px] bg-white border border-[#E3E9F1] rounded-[15px] shadow-[0_10px_30px_rgba(20,40,80,0.06)] overflow-hidden mb-5">
        <div className="p-7 sm:p-8 lg:border-r border-[#E3E9F1] flex items-start gap-5">
          <div className="w-[72px] h-[72px] flex-shrink-0 rounded-[17px] grid place-items-center bg-[#FFF5E3] text-[#F59E0B] text-[42px]">◷</div>
          <div>
            <h2 className="text-[24px] font-extrabold text-[#0B1738] mb-3.5">Last Login</h2>
            <p className="text-[15px] text-[#31466D] leading-relaxed">The last time you signed in to your XEVERA account.</p>
          </div>
        </div>
        <div className="p-7 sm:p-9">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-5 max-w-[620px]">
            <div className="flex items-center gap-3 text-[15px] font-semibold text-[#31466D]"><span className="w-[22px] text-center text-[#20375F] text-[19px]">▣</span>Date</div>
            <div className="text-[15px] font-bold text-[#0B1738]">{current ? fmtDate(current.created_at) : '—'}</div>
            <div className="flex items-center gap-3 text-[15px] font-semibold text-[#31466D]"><span className="w-[22px] text-center text-[#20375F] text-[19px]">◷</span>Time</div>
            <div className="text-[15px] font-bold text-[#0B1738]">{current ? fmtTime(current.created_at) : '—'}</div>
            <div className="flex items-center gap-3 text-[15px] font-semibold text-[#31466D]"><span className="w-[22px] text-center text-[#20375F] text-[19px]">⌖</span>Location</div>
            <div className="text-[15px] font-bold text-[#0B1738]">{current?.location || 'Unknown'}</div>
            <div className="flex items-center gap-3 text-[15px] font-semibold text-[#31466D]"><span className="w-[22px] text-center text-[#20375F] text-[19px]">▣</span>Device</div>
            <div className="text-[15px] font-bold text-[#0B1738]">{current ? deviceLabel(current) : '—'}</div>
            <div className="flex items-center gap-3 text-[15px] font-semibold text-[#31466D]"><span className="w-[22px] text-center text-[#20375F] text-[19px]">♢</span>Status</div>
            <div><span className="inline-flex items-center px-3 py-2 rounded-[8px] bg-[#EAF9EF] text-[#16A34A] text-[13px] font-bold">Successful</span></div>
          </div>
          <div className="flex items-start gap-3.5 mt-7 p-3.5 max-w-[540px] rounded-[10px] bg-[#EEF5FF] border border-[#D9E7FF] text-[#075FF5] text-[13px] leading-relaxed">
            <span className="text-[21px]">♢</span>
            <span>If this wasn&apos;t you, we recommend changing your password and reviewing your active sessions.</span>
          </div>
        </div>
      </section>

      {/* Active Sessions */}
      <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[445px] bg-white border border-[#E3E9F1] rounded-[15px] shadow-[0_10px_30px_rgba(20,40,80,0.06)] overflow-hidden">
        <div className="p-7 sm:p-8 lg:border-r border-[#E3E9F1] flex items-start gap-5">
          <div className="w-[72px] h-[72px] flex-shrink-0 rounded-[17px] grid place-items-center bg-[#EAF9EF] text-[#16A34A] text-[30px]">▣</div>
          <div>
            <h2 className="text-[24px] font-extrabold text-[#0B1738] leading-[1.35] mb-3">Active<br />Sessions</h2>
            <p className="text-[15px] text-[#31466D] leading-relaxed">Recent devices and browsers where you&apos;re signed in.</p>
          </div>
        </div>
        <div className="p-6 sm:p-7">
          <div className="flex justify-end mb-3">
            <button onClick={() => setDrawerOpen(true)}
              className="h-[45px] px-4 rounded-[9px] bg-white border border-[#D9E3EF] text-[#075FF5] font-bold text-[14px] hover:bg-[#EEF5FF] hover:border-[#A9C8FF] transition-colors cursor-pointer">
              View All Sessions →
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-[86px] rounded-[11px] bg-[#F5F8FC]" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#71809B]">No login history yet.</div>
          ) : (
            <div className="border border-[#E3E9F1] rounded-[11px] overflow-hidden">
              {sessions.slice(0, 3).map((item, i) => (
                <div key={item.id} className="min-h-[86px] p-3.5 flex items-center gap-3.5 border-b border-[#E3E9F1] last:border-b-0 hover:bg-[#FBFDFF] transition-colors">
                  <div className="w-[49px] h-[49px] flex-shrink-0 relative grid place-items-center rounded-[10px] bg-[#F5F8FC] text-[26px]">
                    {deviceIcon(item)}
                    <span className={`absolute -right-0.5 bottom-0.5 w-[11px] h-[11px] rounded-full border-2 border-white ${i === 0 ? 'bg-[#16A34A]' : 'bg-[#AEB9C8]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-bold text-[#0B1738] truncate">{deviceLabel(item)}</span>
                      {i === 0 && <span className="inline-flex px-2 py-1 rounded-[7px] bg-[#E8F3FF] text-[#075FF5] text-[10px] font-extrabold flex-shrink-0">This device</span>}
                    </div>
                    <div className="text-[13px] text-[#31466D] truncate">{item?.location || 'Unknown'} • {fmtDateTime(item?.created_at)}</div>
                  </div>
                  <button onClick={(e) => openMenu(e, item)} aria-label="Session menu"
                    className="w-[34px] h-[34px] flex-shrink-0 rounded-[7px] bg-transparent border-none text-[20px] text-[#14213D] hover:bg-[#EDF2F8] cursor-pointer">⋮</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5">
            <span className="flex items-center gap-2.5 text-[#16A34A] text-[14px] font-bold"><span className="text-[20px]">♢</span>All sessions are secure.</span>
            <button onClick={() => setConfirmAll(true)}
              className="h-[48px] px-5 rounded-[9px] bg-white border border-[#FFB9B9] text-[#EF1717] text-[14px] font-bold hover:bg-[#FFF0F0] transition-colors cursor-pointer">
              ⇆ &nbsp; Sign Out All Other Sessions
            </button>
          </div>
        </div>
      </section>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[1000] bg-[rgba(11,25,50,0.22)] backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
          <aside className="absolute top-3 right-3 bottom-3 w-full max-w-[510px] bg-white rounded-[15px] shadow-[-15px_0_40px_rgba(0,0,0,0.13)] flex flex-col overflow-hidden animate-[drawerIn_.3s_ease]">
            <style>{'@keyframes drawerIn{from{transform:translateX(110%)}to{transform:translateX(0)}}'}</style>
            <header className="px-6 py-6 flex items-start justify-between">
              <div>
                <h2 className="text-[25px] font-extrabold text-[#0B1738] tracking-[-0.4px] mb-2">Active Sessions</h2>
                <p className="text-[14px] text-[#31466D]">Devices currently signed in to your account.</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close" className="w-[38px] h-[38px] rounded-[8px] bg-transparent border-none text-[#0B1738] text-[29px] hover:bg-[#F1F4F8] cursor-pointer">×</button>
            </header>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="grid gap-2.5">
                {sessions.map((item, i) => (
                  <div key={item.id} className={`min-h-[113px] p-3.5 rounded-[10px] border flex items-center gap-3.5 transition-shadow hover:shadow-[0_4px_15px_rgba(20,40,70,0.04)] ${i === 0 ? 'bg-[#F4FCF7] border-[#D8F0E0]' : 'bg-white border-[#E3E9F1]'}`}>
                    <div className="w-[49px] h-[49px] flex-shrink-0 relative grid place-items-center rounded-[10px] bg-[#F5F8FC] text-[26px]">
                      {deviceIcon(item)}
                      <span className={`absolute -right-0.5 bottom-0.5 w-[11px] h-[11px] rounded-full border-2 border-white ${i === 0 ? 'bg-[#16A34A]' : 'bg-[#AEB9C8]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="flex items-center gap-1.5 text-[14px] font-bold text-[#0B1738] mb-1.5">
                        {deviceLabel(item)}
                        {i === 0 && <span className="inline-flex px-2 py-1 rounded-[7px] bg-[#E8F3FF] text-[#075FF5] text-[10px] font-extrabold flex-shrink-0">This device</span>}
                      </h4>
                      <p className="text-[13px] text-[#31466D] leading-relaxed">
                        {item?.location || 'Unknown'}<br />
                        {i === 0 ? <span className="text-[#16A34A]">Active now</span> : fmtDateTime(item?.created_at)}
                      </p>
                    </div>
                    {i === 0 ? (
                      <span className="inline-flex px-2.5 py-1.5 rounded-[8px] bg-[#DFF5E6] text-[#16A34A] text-[12px] font-bold flex-shrink-0">Current</span>
                    ) : (
                      <button onClick={() => signOutSession(item)}
                        className="h-[41px] px-3 rounded-[8px] bg-white border border-[#D9E2EC] font-bold text-[13px] text-[#0B1738] hover:text-[#EF1717] hover:border-[#FFB6B6] hover:bg-[#FFF0F0] transition-colors cursor-pointer">Sign Out</button>
                    )}
                    <button onClick={(e) => openMenu(e, item)} aria-label="Session menu"
                      className="w-[34px] h-[34px] flex-shrink-0 rounded-[7px] bg-transparent border-none text-[20px] text-[#14213D] hover:bg-[#EDF2F8] cursor-pointer">⋮</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4 p-3.5 rounded-[10px] bg-[#EEF5FF] border border-[#D9E7FF] text-[#075FF5] text-[13px] leading-relaxed">
                <span className="text-[21px]">♢</span>
                <span><strong>Don&apos;t recognize a session?</strong><br />We recommend changing your password and signing out of all other sessions.</span>
              </div>
            </div>
            <footer className="p-4 grid gap-3">
              <button onClick={() => setConfirmAll(true)} className="h-[50px] rounded-[9px] bg-[#EF1717] border-none text-white text-[14px] font-bold hover:bg-[#D91515] transition-colors cursor-pointer">⇆ &nbsp; Sign Out All Other Sessions</button>
              <button onClick={() => setDrawerOpen(false)} className="h-[48px] rounded-[9px] bg-white border border-[#DBE3ED] font-bold text-[#0B1738] hover:bg-[#F7F9FC] cursor-pointer">Close</button>
            </footer>
          </aside>
        </div>
      )}

      {/* Dropdown */}
      {menuSession && (
        <div className="fixed z-[3000] w-[150px] bg-white border border-[#E3E9F1] rounded-[9px] shadow-[0_12px_30px_rgba(20,40,70,0.15)] p-1.5" style={{ top: menuPos.top, left: menuPos.left }}>
          <button onClick={() => { setMenuSession(null); toast(`${deviceLabel(menuSession)} — session details.`); }}
            className="w-full text-left px-2.5 py-2 rounded-[6px] text-[13px] text-[#0B1738] hover:bg-[#F4F7FB] cursor-pointer">View Details</button>
          <button onClick={() => signOutSession(menuSession)} className="w-full text-left px-2.5 py-2 rounded-[6px] text-[13px] text-[#EF1717] hover:bg-[#F4F7FB] cursor-pointer">Sign Out</button>
        </div>
      )}

      {/* Confirm modal */}
      {confirmAll && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-[rgba(5,20,40,0.4)]">
          <div className="w-full max-w-[410px] bg-white rounded-[14px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.2)]">
            <div className="w-[48px] h-[48px] rounded-[11px] grid place-items-center bg-[#FFF0F0] text-[#EF1717] text-[22px] mb-3.5">⇆</div>
            <h3 className="text-[19px] font-extrabold text-[#0B1738] mb-2">Sign Out All Other Sessions?</h3>
            <p className="text-[13px] text-[#31466D] leading-relaxed mb-5">This will sign you out from every other device and browser except your current device.</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setConfirmAll(false)} className="h-[42px] px-4 rounded-[8px] bg-white border border-[#E3E9F1] font-bold cursor-pointer">Cancel</button>
              <button onClick={signOutAllOthers} className="h-[42px] px-4 rounded-[8px] bg-[#EF1717] border-none text-white font-bold hover:bg-[#D91515] cursor-pointer">Sign Out All</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}