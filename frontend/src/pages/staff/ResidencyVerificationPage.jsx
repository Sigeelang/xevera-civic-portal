import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../components/Toast';

const STATUS_COLORS = {
  'Pending Verification': 'bg-amber-100 text-amber-800 border-amber-200',
  'Residency Verified': 'bg-green-100 text-green-800 border-green-200',
  'Residency Verification Rejected': 'bg-red-100 text-red-800 border-red-200',
};

export default function ResidencyVerificationPage() {
  const showToast = useToast();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, status: statusFilter, search });
      const d = await apiFetch(`admin/residency-verify.php?action=list&${params}`);
      setData(d.data || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
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
      await apiFetch('admin/residency-verify.php?action=approve', {
        method: 'POST',
        body: { user_id: userId },
      });
      showToast('Residency approved.');
      setSelected(null);
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
      await apiFetch('admin/residency-verify.php?action=reject', {
        method: 'POST',
        body: { user_id: userId, reason: rejectReason },
      });
      showToast('Residency rejected.');
      setShowRejectModal(false);
      setRejectReason('');
      setSelected(null);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to reject.', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  function openProof(id) {
    window.open(`/api/admin/residency-verify.php?action=preview&id=${id}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#15233B]">Residency Verification</h1>
          <p className="text-sm text-[#63748A] mt-1">Review and verify resident proof of residency documents.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-10 px-4 pl-10 border border-[#DFE5EC] bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-[#8491A4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 border border-[#DFE5EC] bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Statuses</option>
            <option value="Pending Verification">Pending Verification</option>
            <option value="Residency Verified">Residency Verified</option>
            <option value="Residency Verification Rejected">Residency Rejected</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-[#63748A]">Loading...</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-[#63748A]">
              <svg className="w-12 h-12 mx-auto mb-3 text-[#C9D5E3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/></svg>
              <p className="font-semibold">No residents found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Verified By</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Verified At</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Registered</th>
                    <th className="text-right px-4 py-3 font-semibold text-[#374151]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.id} className="border-b border-[#F0F0F0] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-medium text-[#1E293B]">{r.name}</td>
                      <td className="px-4 py-3 text-[#64748B]">{r.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[r.residency_status] || 'bg-gray-100 text-gray-800'}`}>
                          {r.residency_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{r.verified_by_name || '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{r.verified_at ? new Date(r.verified_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSelected(r)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <span className="text-xs text-[#63748A]">Page {page} of {pages} ({total} results)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs border border-[#DFE5EC] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC] cursor-pointer">Previous</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs border border-[#DFE5EC] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC] cursor-pointer">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !actionLoading && setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#15233B]">Residency Verification</h3>
                <button onClick={() => setSelected(null)} className="text-[#63748A] hover:text-[#15233B] cursor-pointer"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#63748A] text-xs">Name</span>
                  <p className="font-semibold text-[#1E293B]">{selected.name}</p>
                </div>
                <div>
                  <span className="text-[#63748A] text-xs">Email</span>
                  <p className="font-semibold text-[#1E293B]">{selected.email}</p>
                </div>
                <div>
                  <span className="text-[#63748A] text-xs">Status</span>
                  <p className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border mt-1 ${STATUS_COLORS[selected.residency_status] || 'bg-gray-100 text-gray-800'}`}>
                    {selected.residency_status}
                  </p>
                </div>
                <div>
                  <span className="text-[#63748A] text-xs">Registered</span>
                  <p className="font-semibold text-[#1E293B]">{new Date(selected.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selected.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  <span className="font-semibold text-red-800 text-xs">Rejection Reason:</span>
                  <p className="text-red-700 mt-1">{selected.rejection_reason}</p>
                </div>
              )}

              <div>
                <span className="text-[#63748A] text-xs block mb-2">Proof of Residency</span>
                {selected.residency_proof ? (
                  <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    {selected.residency_proof.match(/\.(jpg|jpeg|png)$/i) ? (
                      <img src={`/api/admin/residency-verify.php?action=preview&id=${selected.id}`} alt="Proof" className="w-full max-h-[300px] object-contain bg-[#F8FAFC]" />
                    ) : (
                      <div className="p-6 text-center bg-[#F8FAFC]">
                        <svg className="w-10 h-10 mx-auto mb-2 text-[#63748A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <p className="text-sm text-[#63748A]">PDF Document</p>
                      </div>
                    )}
                    <div className="flex gap-2 p-3 bg-[#F8FAFC] border-t border-[#E5E7EB]">
                      <button onClick={() => openProof(selected.id)} className="flex-1 h-9 px-3 text-xs font-semibold text-blue-600 border border-blue-200 bg-white rounded-lg hover:bg-blue-50 cursor-pointer">Preview</button>
                      <form method="POST" action="/api/admin/residency-verify.php?action=download" target="_blank" className="flex-1">
                        <input type="hidden" name="id" value={selected.id} />
                        <button type="submit" className="w-full h-9 px-3 text-xs font-semibold text-[#374151] border border-[#DFE5EC] bg-white rounded-lg hover:bg-[#F8FAFC] cursor-pointer">Download</button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#63748A] italic">No proof document uploaded.</p>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-[#E5E7EB] flex gap-3">
              {selected.residency_status !== 'Residency Verified' && (
                <button disabled={actionLoading} onClick={() => handleApprove(selected.id)}
                  className="flex-1 h-10 px-4 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer">Approve</button>
              )}
              {selected.residency_status !== 'Residency Verification Rejected' && (
                <button disabled={actionLoading} onClick={() => setShowRejectModal(true)}
                  className="flex-1 h-10 px-4 text-sm font-bold text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 disabled:opacity-50 cursor-pointer">Reject</button>
              )}
              <button disabled={actionLoading} onClick={() => setSelected(null)}
                className="h-10 px-4 text-sm font-bold text-[#374151] border border-[#DFE5EC] bg-white rounded-lg hover:bg-[#F8FAFC] cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selected && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => !actionLoading && setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-lg font-bold text-[#15233B] mb-2">Reject Residency</h3>
              <p className="text-sm text-[#63748A] mb-3">Provide an optional reason for rejection.</p>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Document unclear, not a Xevera resident..." rows={3}
                className="w-full px-3 py-2 border border-[#DFE5EC] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none" />
            </div>
            <div className="p-5 border-t border-[#E5E7EB] flex gap-3">
              <button disabled={actionLoading} onClick={() => handleReject(selected.id)}
                className="flex-1 h-10 px-4 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 cursor-pointer">Reject</button>
              <button disabled={actionLoading} onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="h-10 px-4 text-sm font-bold text-[#374151] border border-[#DFE5EC] bg-white rounded-lg hover:bg-[#F8FAFC] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
