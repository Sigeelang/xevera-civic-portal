import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getToken } from '../../services/api';
import { useToast } from '../../components/Toast';

const STATUS_BADGE = {
  'Pending Verification': { cls: 'bg-[#FFF4D6] text-[#A86B00]', label: 'Pending' },
  'Residency Verified': { cls: 'bg-[#DEF4E7] text-[#16864D]', label: 'Approved' },
  'Residency Verification Rejected': { cls: 'bg-[#FFE2E2] text-[#C93333]', label: 'Rejected' },
};

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ResidencyVerificationPage() {
  const showToast = useToast();
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [proofUrls, setProofUrls] = useState({});
  const [proofError, setProofError] = useState(null);

  /*
   * Proof images carry no Authorization header on plain <img>/form
   * requests, so the preview/download endpoints would 403. Fetch as
   * authenticated blobs and render via object URLs instead.
   */
  async function proofBlob(userId, n) {
    const token = getToken();
    const res = await fetch(`/api/admin/residency-verify.php?action=preview&id=${userId}&n=${n}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (!res.ok) throw new Error('Preview failed (' + res.status + ')');
    return URL.createObjectURL(await res.blob());
  }

  useEffect(() => {
    if (!selected) { setProofUrls({}); setProofError(null); return undefined; }
    let alive = true;
    const urls = {};
    setProofUrls({});
    setProofError(null);
    (async () => {
      try {
        for (const n of [selected.residency_proof ? 1 : null, selected.residency_proof2 ? 2 : null].filter(Boolean)) {
          const url = await proofBlob(selected.id, n);
          if (!alive) { URL.revokeObjectURL(url); return; }
          urls[n] = url;
          setProofUrls({ ...urls });
        }
      } catch {
        if (alive) setProofError('Could not load proof images. The file may be missing on the server.');
      }
    })();
    return () => { alive = false; Object.values(urls).forEach((u) => URL.revokeObjectURL(u)); };
  }, [selected]);

  async function downloadProof(userId, n, filename) {
    try {
      const url = await proofBlob(userId, n);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `residency-proof-${n}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      showToast('Could not download the proof document.', 'error');
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, status: statusFilter, search });
      const d = await apiFetch(`admin/residency-verify.php?action=list&${params}`);
      const rows = d.data || [];
      setData(rows);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setStats({
        pending: rows.filter(r => r.residency_status === 'Pending Verification').length,
        approved: rows.filter(r => r.residency_status === 'Residency Verified').length,
        rejected: rows.filter(r => r.residency_status === 'Residency Verification Rejected').length,
      });
    } catch (err) {
      showToast(err.message || 'Failed to load.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(userId) {
    setActionLoading(true);
    try {
      await apiFetch('admin/residency-verify.php?action=approve', { method: 'POST', body: { user_id: userId } });
      showToast('Residency approved.');
      setSelected(null);
      setRejectReason('');
      load();
    } catch (err) {
      showToast(err.message || 'Failed to approve.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(userId) {
    setActionLoading(true);
    try {
      await apiFetch('admin/residency-verify.php?action=reject', { method: 'POST', body: { user_id: userId, reason: rejectReason } });
      showToast('Residency rejected.');
      setSelected(null);
      setRejectReason('');
      load();
    } catch (err) {
      showToast(err.message || 'Failed to reject.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  function closePanel() {
    setSelected(null);
    setRejectReason('');
    setFullImage(null);
  }

  return (
    <div className="min-h-screen bg-[#EEF3F9]">
      <div className="max-w-[1500px] mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-[28px] font-bold text-[#24364F]">Residency Verification</h1>
          <p className="text-sm text-[#6D7E94] mt-1">Review and verify resident proof of residency documents.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-white border border-[#DBE3EE] rounded-[14px] p-5 flex items-center gap-4">
            <div className="w-[58px] h-[58px] rounded-[14px] bg-[#FFF2D0] text-[#D68B00] flex items-center justify-center text-2xl flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#24364F]">{stats.pending}</h2>
              <span className="text-[13px] text-[#6D7E94]">Pending</span>
            </div>
          </div>
          <div className="bg-white border border-[#DBE3EE] rounded-[14px] p-5 flex items-center gap-4">
            <div className="w-[58px] h-[58px] rounded-[14px] bg-[#DFF5E9] text-[#138B50] flex items-center justify-center text-2xl flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#24364F]">{stats.approved}</h2>
              <span className="text-[13px] text-[#6D7E94]">Approved</span>
            </div>
          </div>
          <div className="bg-white border border-[#DBE3EE] rounded-[14px] p-5 flex items-center gap-4">
            <div className="w-[58px] h-[58px] rounded-[14px] bg-[#FFE1E1] text-[#D93636] flex items-center justify-center text-2xl flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#24364F]">{stats.rejected}</h2>
              <span className="text-[13px] text-[#6D7E94]">Rejected</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-[50px] px-4 pl-11 border border-[#DBE3EE] bg-white rounded-[10px] text-[14px] text-[#24364F] focus:outline-none focus:border-[#1764D5]" />
            <svg className="absolute left-3.5 top-3.5 w-[18px] h-[18px] text-[#8491A4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-[50px] w-full sm:w-[160px] px-3 border border-[#DBE3EE] bg-white rounded-[10px] text-[14px] text-[#24364F] focus:outline-none focus:border-[#1764D5] cursor-pointer">
            <option value="">All Status</option>
            <option value="Pending Verification">Pending</option>
            <option value="Residency Verified">Approved</option>
            <option value="Residency Verification Rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#DBE3EE] rounded-[14px] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-[#6D7E94]">Loading...</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-[#6D7E94]">
              <svg className="w-14 h-14 mx-auto mb-3 text-[#C9D5E3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
              <p className="font-semibold text-[15px]">No residents found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#EDF1F6] bg-[#F8FAFC]">
                    <th className="text-left px-5 py-4 font-semibold text-[#374151]">Name</th>
                    <th className="text-left px-5 py-4 font-semibold text-[#374151] hidden sm:table-cell">Email</th>
                    <th className="text-left px-5 py-4 font-semibold text-[#374151]">Registered</th>
                    <th className="text-left px-5 py-4 font-semibold text-[#374151]">Status</th>
                    <th className="text-right px-5 py-4 font-semibold text-[#374151]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => {
                    const badge = STATUS_BADGE[r.residency_status] || { cls: 'bg-gray-100 text-gray-700', label: r.residency_status };
                    return (
                      <tr key={r.id} className="border-b border-[#EDF1F6] hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-4 font-medium text-[#24364F]">{r.name}</td>
                        <td className="px-5 py-4 text-[#6D7E94] hidden sm:table-cell">{r.email}</td>
                        <td className="px-5 py-4 text-[#6D7E94]">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold ${badge.cls}`}>
                            {r.residency_status === 'Pending Verification' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                            {r.residency_status === 'Residency Verified' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            {r.residency_status === 'Residency Verification Rejected' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => { setSelected(r); setRejectReason(r.rejection_reason || ''); }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#CFD9E6] bg-white text-[#1764D5] rounded-[8px] text-[13px] font-semibold hover:bg-[#F0F4FF] cursor-pointer transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#EDF1F6]">
              <span className="text-[13px] text-[#6D7E94]">Page {page} of {pages} ({total} results)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 text-[13px] border border-[#DBE3EE] rounded-[8px] disabled:opacity-40 hover:bg-[#F8FAFC] cursor-pointer font-semibold">Previous</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 text-[13px] border border-[#DBE3EE] rounded-[8px] disabled:opacity-40 hover:bg-[#F8FAFC] cursor-pointer font-semibold">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => !actionLoading && closePanel()}>
          <div className="absolute inset-0 bg-[#0E223C]/32" />
          <div className="relative w-full max-w-[680px] bg-white h-full overflow-auto shadow-[-10px_0_30px_rgba(0,0,0,.15)] flex flex-col"
            onClick={(e) => e.stopPropagation()}>

            {/* Panel Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-[#E5EBF2] flex-shrink-0">
              <h2 className="text-xl font-bold text-[#24364F]">Resident Details</h2>
              <button onClick={closePanel} className="w-9 h-9 flex items-center justify-center text-[#6D7E94] hover:text-[#24364F] text-2xl cursor-pointer bg-transparent border-none">&times;</button>
            </div>

            <div className="flex-1 overflow-auto px-7 py-5 space-y-5">
              {/* Profile */}
              <div className="flex items-center gap-4 pb-5 border-b border-[#E5EBF2]">
                <div className="w-[70px] h-[70px] rounded-full bg-[#7B98B8] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {getInitials(selected.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#24364F]">{selected.name}</h3>
                  <p className="text-[14px] text-[#6D7E94]">{selected.email}</p>
                  <p className="text-[13px] text-[#6D7E94]">Registered on {new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Resident Information */}
              <div className="bg-[#F6F9FC] border border-[#E1E8F0] rounded-[12px] p-5">
                <h4 className="text-[15px] font-bold text-[#24364F] mb-4">Resident Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] text-[#6D7E94]">Full Name</div>
                    <div className="font-semibold text-[#24364F] mt-1">{selected.name}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#6D7E94]">Registration Date</div>
                    <div className="font-semibold text-[#24364F] mt-1">{new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#6D7E94]">Email Address</div>
                    <div className="font-semibold text-[#24364F] mt-1">{selected.email}</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-[#6D7E94]">Status</div>
                    <div className="mt-1">
                      {(() => {
                        const b = STATUS_BADGE[selected.residency_status] || { cls: 'bg-gray-100 text-gray-700', label: selected.residency_status };
                        return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold ${b.cls}`}>{b.label}</span>;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Proof of Residency */}
              <div className="bg-[#F6F9FC] border border-[#E1E8F0] rounded-[12px] p-5">
                <h4 className="text-[15px] font-bold text-[#24364F] mb-3">Proof of Residency</h4>
                {(() => {
                  const docs = [
                    selected.residency_proof ? { file: selected.residency_proof, n: 1, label: 'Image 1' } : null,
                    selected.residency_proof2 ? { file: selected.residency_proof2, n: 2, label: 'Image 2' } : null,
                  ].filter(Boolean);
                  if (!docs.length) {
                    return <p className="text-[14px] text-[#6D7E94] italic mt-2">No proof document uploaded.</p>;
                  }
                  if (proofError && Object.keys(proofUrls).length === 0) {
                    return <p className="text-[13px] text-[#C92A2A] italic mt-2">{proofError}</p>;
                  }
                  return (
                    <>
                      <div className={`grid gap-3 mt-3 ${docs.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                        {docs.map((d) => (
                          <div key={d.n}>
                            <button
                              type="button"
                              onClick={() => proofUrls[d.n] && setFullImage(proofUrls[d.n])}
                              className="block w-full p-0 border border-[#DBE3EE] rounded-[12px] overflow-hidden bg-white cursor-zoom-in"
                              title="View full image"
                            >
                              {proofUrls[d.n] ? (
                                <img src={proofUrls[d.n]} alt={`Proof of Residency ${d.label}`}
                                  className="w-full h-[220px] object-cover block" loading="lazy" />
                              ) : (
                                <span className="block w-full h-[220px] animate-pulse bg-[#EDF1F6]" />
                              )}
                            </button>
                            <div className="flex items-center justify-between mt-2 gap-2">
                              <b className="text-[13px] text-[#24364F] truncate">{d.label} — {d.file}</b>
                              <button
                                type="button"
                                onClick={() => downloadProof(selected.id, d.n, d.file)}
                                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#CFD9E6] bg-white text-[#1764D5] rounded-[8px] text-[13px] font-semibold hover:bg-[#F0F4FF] cursor-pointer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[12px] text-[#6D7E94] mt-2">Click an image to view it full-screen.</p>
                    </>
                  );
                })()}
              </div>

              {/* Verification Action */}
              <div className="bg-[#F6F9FC] border border-[#E1E8F0] rounded-[12px] p-5">
                <h4 className="text-[15px] font-bold text-[#24364F] mb-4">Verification Action</h4>

                {selected.residency_status !== 'Residency Verified' && selected.residency_status !== 'Residency Verification Rejected' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button disabled={actionLoading} onClick={() => handleApprove(selected.id)}
                        className="h-[50px] bg-[#16864D] text-white border-none rounded-[9px] font-bold text-[14px] hover:bg-[#127040] disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve Residency
                      </button>
                      <button disabled={actionLoading}
                        className="h-[50px] bg-[#E43B3B] text-white border-none rounded-[9px] font-bold text-[14px] hover:bg-[#CC3232] disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject Application
                      </button>
                    </div>
                    <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason if rejecting..."
                      className="w-full h-[90px] border border-[#DBE3EE] rounded-[10px] p-3 text-[14px] text-[#24364F] focus:outline-none focus:border-[#1764D5] resize-none" />
                  </>
                ) : selected.residency_status === 'Residency Verified' ? (
                  <div className="flex items-center gap-3 p-4 bg-[#DEF4E7] rounded-[10px]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16864D" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span className="text-[14px] font-bold text-[#16864D]">Residency Verified</span>
                    {selected.verified_by_name && <span className="text-[13px] text-[#16864D]/70">by {selected.verified_by_name}</span>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-[#FFE2E2] rounded-[10px]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C93333" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span className="text-[14px] font-bold text-[#C93333]">Residency Verification Rejected</span>
                    </div>
                    {selected.rejection_reason && (
                      <div className="p-3 bg-white border border-[#E1E8F0] rounded-[10px] text-[13px] text-[#6D7E94]">
                        <span className="font-semibold text-[#24364F]">Reason:</span> {selected.rejection_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer */}
            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-[#E5EBF2] flex-shrink-0">
              <button disabled={actionLoading} onClick={closePanel}
                className="px-5 py-3 bg-[#EDF2F7] border-none rounded-[9px] font-bold text-[14px] text-[#24364F] hover:bg-[#DDE5EE] cursor-pointer">Cancel</button>
              {(selected.residency_status === 'Pending Verification') && (
                <button disabled={actionLoading}
                  className="px-5 py-3 bg-[#1764D5] text-white border-none rounded-[9px] font-bold text-[14px] hover:bg-[#1458C0] cursor-pointer disabled:opacity-50"
                  onClick={() => {
                    if (rejectReason.trim()) handleReject(selected.id);
                    else handleApprove(selected.id);
                  }}>
                  Save Decision
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen proof image */}
      {fullImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setFullImage(null)}
          role="dialog"
          aria-label="Proof image fullscreen"
        >
          <button
            type="button"
            onClick={() => setFullImage(null)}
            aria-label="Close fullscreen"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white text-2xl leading-none hover:bg-white/30 cursor-pointer border-none"
          >
            ×
          </button>
          <img
            src={fullImage}
            alt="Proof of residency fullscreen"
            className="max-w-full max-h-[90vh] rounded-[10px] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
