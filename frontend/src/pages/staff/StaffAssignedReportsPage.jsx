import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';
import ImageLightbox from '../../components/ImageLightbox';

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const STATUS_BADGES = {
  Assigned: 'bg-[#E7F0FF] text-[#0865DD]',
  'In Progress': 'bg-[#E5F8EE] text-[#078F50]',
  Resolved: 'bg-[#EEE9FF] text-[#6034D0]',
};

/* Stepper position: how many steps are done / which is current */
function stepperFor(status) {
  const order = ['Assigned', 'In Progress', 'Resolved', 'Closed'];
  const idx = Math.max(0, order.indexOf(status));
  return { done: idx, current: status === 'Closed' ? -1 : Math.min(idx + 1 === 4 ? 3 : idx + 1, 3), idx };
}

export default function StaffAssignedReportsPage({ onViewReport }) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selected, setSelected] = useState(null);       /* full row in drawer */
  const [busyId, setBusyId] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  /* Resolution modal */
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [evidence, setEvidence] = useState([]);          /* File[] */
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  /* Progress update modal */
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateText, setUpdateText] = useState('');

  const load = useCallback(() => {
    setError(false);
    setItems(null);
    apiFetch('reports/list.php?staff=true&assigned_to=me&limit=50')
      .then(d => setItems(d.items || []))
      .catch(() => { setItems([]); setError(true); });
    apiFetch('reports/stats.php?assigned_to=me')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(
    () => [...new Set((items || []).map(r => r.category).filter(Boolean))],
    [items]
  );

  const filtered = useMemo(() => (items || [])
    .filter(r => statusFilter === 'All' || r.status === statusFilter)
    .filter(r => categoryFilter === 'All' || r.category === categoryFilter)
    .filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        String(r.id).toLowerCase().includes(q) ||
        String(r.title || '').toLowerCase().includes(q) ||
        String(r.location || '').toLowerCase().includes(q) ||
        String(r.reporter || '').toLowerCase().includes(q)
      );
    }), [items, statusFilter, categoryFilter, search]);

  function openDrawer(r) {
    setSelected(r);
  }

  async function startWork() {
    if (!selected) return;
    setBusyId(selected.id);
    try {
      await apiFetch('reports/update.php', { method: 'POST', body: { id: selected.id, status: 'In Progress' } });
      toast(`Report ${selected.id} moved to In Progress.`);
      const updated = { ...selected, status: 'In Progress' };
      setSelected(updated);
      load();
    } catch (e) {
      toast(e.message || 'Failed to start work.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function submitUpdate(e) {
    e.preventDefault();
    if (!updateText.trim()) { toast('Please enter a progress update.', 'error'); return; }
    setBusyId(selected.id);
    try {
      await apiFetch('reports/update.php', { method: 'POST', body: { id: selected.id, remarks: updateText.trim() } });
      toast(`Progress update added to ${selected.id}.`);
      setUpdateOpen(false);
      setUpdateText('');
      load();
    } catch (e2) {
      toast(e2.message || 'Failed to add update.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  function onEvidenceChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length > 2) { toast('Maximum of 2 evidence photos.', 'error'); e.target.value = ''; return; }
    for (const f of files) {
      if (!f.type.startsWith('image/')) { toast('Only image files are allowed.', 'error'); e.target.value = ''; setEvidence([]); setPreviews([]); return; }
      if (f.size > 5 * 1024 * 1024) { toast(`${f.name} is larger than 5MB.`, 'error'); e.target.value = ''; setEvidence([]); setPreviews([]); return; }
    }
    setEvidence(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  }

  async function submitResolution(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!selected) return;
    if (!resolutionText.trim()) { toast('Resolution remarks are required.', 'error'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('id', selected.id);
      fd.append('status', 'Resolved');
      fd.append('resolution', resolutionText.trim());
      evidence.forEach(f => fd.append('photos[]', f));
      await apiFetch('reports/update.php', { method: 'POST', body: fd });
      toast(`Report ${selected.id} resolved. Waiting for Admin verification.`);
      setSelected({ ...selected, status: 'Resolved', resolution: resolutionText.trim() });
      setResolveOpen(false);
      setResolutionText('');
      setEvidence([]);
      setPreviews([]);
      load();
    } catch (e2) {
      toast(e2.message || 'Failed to submit resolution.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const statCards = [
    { label: 'Assigned', value: stats?.assigned ?? 0, desc: 'Assigned, not started', iconCls: 'bg-[#E8F1FF] text-[#0764DF]', icon: '▣' },
    { label: 'Resolved', value: stats?.resolved ?? 0, desc: 'Reports you have completed', iconCls: 'bg-[#E5F8EE] text-[#079452]', icon: '✓' },
    { label: 'Due Today', value: stats?.due_today ?? 0, desc: 'Due today', iconCls: 'bg-[#F0EAFF] text-[#6635D1]', icon: '◇' },
  ];

  const st = selected?.status;
  const step = stepperFor(st || 'Assigned');
  const STEPS = ['Assigned', 'In Progress', 'Resolved', 'Closed'];

  return (
    <div className="flex-1 space-y-5">
      {/* HEADER */}
      <div>
        <div className="text-[10px] font-bold tracking-[1.4px] uppercase text-xevera-600">Report Management</div>
        <h1 className="text-[30px] font-bold text-[#172033] mt-1.5 m-0">Assigned</h1>
        <p className="text-[13px] text-[#66748B] mt-1.5 m-0">Reports assigned to you and awaiting work.</p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-[#E1E7EF] rounded-lg p-5 min-h-[110px]">
            <div className="flex items-center gap-3">
              <span className={`w-[45px] h-[45px] rounded-xl grid place-items-center text-xl flex-shrink-0 ${s.iconCls}`}>{s.icon}</span>
              <span className="text-xs font-bold text-[#172033]">{s.label}</span>
            </div>
            <div className="text-[30px] font-extrabold font-head mt-2.5 text-[#102044]">{s.value}</div>
            <div className="text-[11px] text-[#68758C]">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* REPORT TABLE */}
      <div className="bg-white border border-[#E1E7EF] rounded-lg overflow-hidden">
        <div className="p-3.5 flex flex-col sm:flex-row gap-2.5 border-b border-[#E7EBF1]">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports by ID, issue, location, resident..."
            className="h-[42px] flex-1 border border-[#DCE3EC] rounded-md px-3.5 text-xs outline-none focus:border-xevera-600 bg-white" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-[42px] border border-[#DCE3EC] rounded-md px-3 text-xs bg-white outline-none cursor-pointer">
            <option value="All">Status: All</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="h-[42px] border border-[#DCE3EC] rounded-md px-3 text-xs bg-white outline-none cursor-pointer">
            <option value="All">Category: All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {!items ? (
          <div className="p-4"><SkeletonRows rows={4} height="h-12" /></div>
        ) : error ? (
          <StaffErrorState onRetry={load} />
        ) : filtered.length === 0 ? (
          <StaffEmptyState title="No assigned reports found." description="Reports assigned to you will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#54627A] bg-[#FAFBFD] border-b border-[#E7EBF1]">
                  <th className="py-3.5 px-3.5 font-bold">Report ID</th>
                  <th className="py-3.5 px-3.5 font-bold">Issue</th>
                  <th className="py-3.5 px-3.5 font-bold">Category</th>
                  <th className="py-3.5 px-3.5 font-bold">Location</th>
                  <th className="py-3.5 px-3.5 font-bold">Assigned Staff</th>
                  <th className="py-3.5 px-3.5 font-bold">Status</th>
                  <th className="py-3.5 px-3.5 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-[#EDF0F4] last:border-b-0 hover:bg-[#FAFCFF] transition-colors">
                    <td className="py-4 px-3.5 text-xs font-bold text-xevera-600">{r.id}</td>
                    <td className="py-4 px-3.5 max-w-[260px]">
                      <div className="text-xs font-bold text-[#172033] truncate">{r.title}</div>
                      <div className="text-[11px] text-[#738097] truncate mt-1">{r.description || ''}</div>
                    </td>
                    <td className="py-4 px-3.5 text-xs text-[#374151] whitespace-nowrap">{r.category || '—'}</td>
                    <td className="py-4 px-3.5 text-xs text-[#374151] max-w-[150px] truncate">{r.location || '—'}</td>
                    <td className="py-4 px-3.5 text-xs text-[#374151] whitespace-nowrap">
                      {user?.name || 'Me'}
                      <span className="block text-[10px] text-[#8CA0BC]">Staff</span>
                    </td>
                    <td className="py-4 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap ${STATUS_BADGES[r.status] || 'bg-[#F1F5F9] text-[#64748B]'}`}>{r.status}</span>
                        {r.is_suspicious == 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold whitespace-nowrap">
                            ⚠ Fake
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-3.5">
                      <button onClick={() => openDrawer(r)}
                        className="h-[40px] px-3.5 rounded-md border border-[#D8E1EC] bg-white text-xevera-600 text-xs font-bold hover:bg-[#EEF5FF] transition-colors cursor-pointer">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== DETAILS DRAWER ===== */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-[rgba(11,25,48,0.25)] z-[90]" onClick={() => setSelected(null)} />
          <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[505px] bg-white z-[100] shadow-[-10px_0_30px_rgba(0,0,0,0.12)] flex flex-col">
            <header className="px-7 py-5 border-b border-[#E6EBF1] flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-extrabold m-0 text-[#172033]">Report Details</h2>
                <p className="text-xs text-[#77849A] mt-1 m-0">View assignment, reporter, and work information.</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close"
                className="border-0 bg-transparent text-2xl text-[#1B2B4A] cursor-pointer leading-none">×</button>
            </header>

            <div className="px-7 py-6 overflow-y-auto flex-1">
              {/* STATUS */}
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <span className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-bold ${STATUS_BADGES[st] || 'bg-[#F1F5F9] text-[#64748B]'}`}>● {st}</span>
                {selected.is_suspicious == 1 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold">
                    ⚠ Flagged as Fake{selected.suspicion_reason ? `: ${selected.suspicion_reason}` : ''}
                  </span>
                )}
              </div>

              {/* REPORT SUMMARY */}
              <section className="border border-[#E1E7EF] rounded-lg p-[18px] mb-4">
                <h3 className="text-xs font-extrabold text-xevera-600 mb-4 mt-0 uppercase tracking-wide">Report Summary</h3>
                <div className="grid grid-cols-2 gap-5">
                  <div><div className="text-[10px] text-[#8490A3] mb-1.5">Report ID</div><div className="text-xs font-bold">{selected.id}</div></div>
                  <div><div className="text-[10px] text-[#8490A3] mb-1.5">Issue</div><div className="text-xs font-bold break-words">{selected.title}</div></div>
                  <div><div className="text-[10px] text-[#8490A3] mb-1.5">Category</div><div className="text-xs font-bold">{selected.category || '—'}</div></div>
                  <div><div className="text-[10px] text-[#8490A3] mb-1.5">Location</div><div className="text-xs font-bold">{selected.location || '—'}</div></div>
                  <div><div className="text-[10px] text-[#8490A3] mb-1.5">Reported By</div><div className="text-xs font-bold">{selected.reporter || 'Anonymous'}</div></div>
                  <div>
                    <div className="text-[10px] text-[#8490A3] mb-1.5">Contact</div>
                    <div className="text-xs font-bold break-words">
                      {[selected.reporter_phone, selected.reporter_email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-[#8490A3] mb-1.5">Description</div>
                    <div className="text-xs font-normal text-[#62718A] leading-relaxed">{selected.description || '—'}</div>
                  </div>
                  {selected.photos?.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-[10px] text-[#8490A3] mb-1.5">Submitted Photos</div>
                      <div className="flex gap-2">
                        {selected.photos.slice(0, 2).map((p, i) => (
                          <button key={i} type="button" onClick={() => setLightboxIndex(i)}
                            className="block p-0 border-0 bg-transparent cursor-zoom-in">
                            <img src={uploadUrl(p)} alt="" className="w-[65px] h-[55px] object-cover rounded-md border border-[#E1E7EF]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ASSIGNMENT */}
              <section className="border border-[#E1E7EF] rounded-lg p-[18px] mb-4">
                <h3 className="text-xs font-extrabold text-xevera-600 mb-4 mt-0 uppercase tracking-wide">Assignment</h3>
                <div className="text-[10px] text-[#8490A3] mb-2">Assigned Staff</div>
                <div className="border border-[#E0E6EF] rounded-lg p-3 flex items-center gap-2.5">
                  <span className="w-[38px] h-[38px] rounded-full bg-xevera-600 text-white grid place-items-center text-[11px] font-bold flex-shrink-0">
                    {initials(selected.assigned !== '-' ? selected.assigned : user?.name)}
                  </span>
                  <div>
                    <div className="text-xs font-bold">{selected.assigned && selected.assigned !== '-' ? selected.assigned : (user?.name || 'Me')}</div>
                    <div className="text-[10px] text-[#8490A3] mt-0.5">Staff</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-[10px] text-[#8490A3] mb-1.5">Reported / Assigned</div>
                  <div className="text-xs font-bold">{selected.date}</div>
                </div>
              </section>

              {/* STATUS HISTORY STEPPER */}
              <section className="border border-[#E1E7EF] rounded-lg p-[18px] mb-4">
                <h3 className="text-xs font-extrabold text-xevera-600 mb-5 mt-0 uppercase tracking-wide">Status History</h3>
                <div className="flex mt-2">
                  {STEPS.map((label, i) => {
                    const done = i <= step.done;
                    const isCurrent = i === step.current && st !== 'Resolved' && st !== 'Closed';
                    return (
                      <div key={label} className="text-center flex-1 relative">
                        {i < STEPS.length - 1 && (
                          <span className={`absolute top-[12px] left-[60%] w-[80%] h-[2px] ${i < step.done || done && i < step.done ? 'bg-xevera-600' : 'bg-[#E3E8EF]'}`} />
                        )}
                        <span className={`relative z-10 mx-auto w-[25px] h-[25px] rounded-full grid place-items-center text-[10px] font-bold ${
                          isCurrent ? 'bg-[#0AAF62] text-white'
                          : done ? 'bg-xevera-600 text-white'
                          : 'bg-[#E9EDF3] text-[#8994A7]'
                        }`}>
                          {done ? '✓' : i + 1}
                        </span>
                        <div className={`text-[9px] mt-1.5 ${done || isCurrent ? 'text-[#16294D] font-bold' : 'text-[#7C889A]'}`}>{label}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* WORK ACTIONS */}
              <div className="mt-5">
                <div className="text-xs font-extrabold mb-2.5 text-[#172033]">WORK ACTIONS</div>

                {st === 'Assigned' && (
                  <button onClick={startWork} disabled={busyId === selected.id}
                    className="h-[42px] px-[18px] rounded-md bg-xevera-600 border border-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 disabled:opacity-50 transition cursor-pointer">
                    ▶ &nbsp; Start Work
                  </button>
                )}

                {st === 'In Progress' && (
                  <div className="flex gap-2.5 flex-wrap">
                    <button onClick={() => setUpdateOpen(true)} disabled={busyId === selected.id}
                      className="h-[42px] px-[18px] rounded-md bg-white border border-[#DCE3EC] text-[#17305A] text-xs font-bold hover:bg-[#F8FAFF] disabled:opacity-50 transition cursor-pointer">
                      ✎ &nbsp; Update Progress
                    </button>
                    <button onClick={() => { setResolveOpen(true); setResolutionText(''); }}
                      disabled={busyId === selected.id}
                      className="h-[42px] px-[18px] rounded-md bg-[#08A45C] border border-[#08A45C] text-white text-xs font-bold hover:brightness-95 disabled:opacity-50 transition cursor-pointer">
                      ✓ &nbsp; Mark as Resolved
                    </button>
                  </div>
                )}

                {st === 'Resolved' && (
                  <div className="bg-[#EAF8F0] text-[#087F48] p-3.5 rounded-lg text-[11px] font-semibold">
                    ✓ Resolution submitted. Waiting for Admin verification.
                    {selected.resolution && (
                      <div className="font-normal mt-1.5 leading-relaxed">"{selected.resolution}"</div>
                    )}
                  </div>
                )}

                {st === 'Closed' && (
                  <div className="bg-[#EEF2F7] text-[#52657F] p-3.5 rounded-lg text-[11px] font-semibold">
                    This report has been closed and archived.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ===== PROGRESS UPDATE MODAL ===== */}
      <Modal
        open={updateOpen}
        title="Update Progress"
        description={`Add a progress remark to report ${selected?.id || ''}.`}
        confirmLabel="Add Update"
        cancelLabel="Cancel"
        confirmDisabled={!updateText.trim()}
        onConfirm={submitUpdate}
        onCancel={() => setUpdateOpen(false)}
      >
        <textarea value={updateText} onChange={(e) => setUpdateText(e.target.value)}
          rows={4}
          placeholder="Describe the current progress of the work..."
          className="w-full px-3 py-2 border border-[#D9E1EB] rounded-lg text-sm resize-y outline-none focus:border-xevera-600 focus:ring-2 focus:ring-xevera-600/20 placeholder:text-[#94A3B8]" />
      </Modal>

      {/* ===== RESOLUTION MODAL ===== */}
      <Modal
        open={resolveOpen}
        title="Mark Report as Resolved"
        description={`Submit your resolution for report ${selected?.id || ''}.`}
        confirmLabel={submitting ? 'Submitting...' : '✓ Submit Resolution'}
        cancelLabel="Cancel"
        danger
        confirmDisabled={submitting}
        onConfirm={() => submitResolution()}
        onCancel={() => { if (!submitting) { setResolveOpen(false); setEvidence([]); setPreviews([]); } }}
      >
        <form onSubmit={submitResolution} id="resolutionForm">
          <label className="block text-[11px] font-bold mb-1.5 text-[#111827]">
            Resolution Remarks <span className="text-[#E02C47]">*</span>
          </label>
          <textarea value={resolutionText} onChange={(e) => setResolutionText(e.target.value)}
            rows={5}
            placeholder="Describe the work completed and how the issue was resolved..."
            className="w-full min-h-[120px] resize-y border border-[#D9E1EB] rounded-lg p-3 text-sm outline-none focus:border-xevera-600 focus:ring-2 focus:ring-xevera-600/20 placeholder:text-[#94A3B8]" />

          <label className="block text-[11px] font-bold mt-4 mb-1.5 text-[#111827]">Resolution Evidence</label>
          {!previews.length ? (
            <button type="button" onClick={() => document.getElementById('evidenceInput')?.click()}
              className="w-full min-h-[110px] rounded-lg border-[1.5px] border-dashed border-[#BDC9D9] flex flex-col items-center justify-center text-[#63718A] hover:bg-[#F8FAFF] hover:border-xevera-600 transition-colors cursor-pointer bg-transparent">
              <span className="text-2xl">⇧</span>
              <strong className="text-xevera-600 text-xs mt-1.5">Upload Photos</strong>
              <span className="text-[10px] mt-1">PNG, JPG up to 5MB each · maximum of 2</span>
            </button>
          ) : (
            <div>
              <div className="flex gap-2">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-[65px] h-[55px] object-cover rounded-md border border-[#E1E7EF]" />
                ))}
                <button type="button" onClick={() => { setEvidence([]); setPreviews([]); }}
                  className="self-center text-[11px] font-bold text-[#DC2626] bg-transparent border-0 cursor-pointer hover:underline ml-1">Remove</button>
              </div>
            </div>
          )}
          <input type="file" id="evidenceInput" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={onEvidenceChange} />
        </form>
      </Modal>

      {lightboxIndex !== null && selected?.photos?.length > 0 && (
        <ImageLightbox
          photos={selected.photos}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={`${selected.id || 'Report'} — submitted photos`}
        />
      )}
    </div>
  );
}
