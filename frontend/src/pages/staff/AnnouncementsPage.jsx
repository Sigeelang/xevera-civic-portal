import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { SkeletonRows } from '../../components/dashboard/Skeleton';
import { StaffEmptyState, StaffErrorState } from '../../components/staff/StaffStates';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'safety', label: 'Safety' },
  { value: 'events', label: 'Events' },
  { value: 'garbage', label: 'Garbage Schedule' },
  { value: 'advisory', label: 'Advisory' },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
const CATEGORY_STYLE = {
  general: { bg: '#f1f5f9', color: '#64748b', icon: '▦' },
  maintenance: { bg: '#fff7e6', color: '#e58b00', icon: '⚙' },
  safety: { bg: '#ffe9e9', color: '#e53e3e', icon: '⚠' },
  events: { bg: '#eef4ff', color: '#1769ff', icon: '▣' },
  garbage: { bg: '#e8f8ef', color: '#159447', icon: '♻' },
  advisory: { bg: '#f0ebff', color: '#7452e8', icon: '◈' },
};
const STATUS_OPTIONS = ['published', 'scheduled', 'draft'];

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function AnnouncementsPage() {
  const showToast = useToast();
  const { user } = useAuth();
  const isManager = user?.role === 'Admin' || user?.role === 'Super Admin';

  // --- data ---
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [error, setError] = useState(false);

  // --- form ---
  const [view, setView] = useState('list'); // list | form
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({
    title: '', category: '', content: '',
    publish_option: 'later', // now | later | draft
    scheduleDate: '', scheduleTime: '',
    announcementDate: '', announcementStartTime: '',
    timezone: '(GMT+8) Asia/Manila',
    audience: 'All Residents',
    coverFile: null,
    cover_image: null,
    schedule_label: '', schedule_time: '', recurrence: 'Every Week', area: '',
  });
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // default schedule = tomorrow 08:00
  useEffect(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    const yyyy = t.getFullYear(), mm = String(t.getMonth() + 1).padStart(2, '0'), dd = String(t.getDate()).padStart(2, '0');
    setForm(f => ({ ...f, scheduleDate: f.scheduleDate || `${yyyy}-${mm}-${dd}`, scheduleTime: f.scheduleTime || '08:00' }));
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await apiFetch(isManager ? 'announcements/admin_list.php' : 'announcements/list.php');
      const list = Array.isArray(data) ? data : (data.items || []);
      // deleted: the 2 garbage schedule demo rows
      const filtered = list.filter(a => {
        const t = String(a.title || '').toLowerCase().trim();
        return !(t === 'garbage collection schedule - may 2026' || t === 'garbage collection schedule - september 2026');
      });
      setItems(filtered);
    } catch { setError(true); setItems([]); }
  }, [isManager]);
  useEffect(() => { load(); }, [load]);

  const stats = {
    total: items ? items.length : 0,
    published: items ? items.filter(a => (a.status || 'published').toLowerCase() === 'published').length : 0,
    scheduled: items ? items.filter(a => (a.status || '').toLowerCase() === 'scheduled').length : 0,
    drafts: items ? items.filter(a => (a.status || '').toLowerCase() === 'draft').length : 0,
  };

  let visible = (items || []).filter(a => {
    const text = (a.title + ' ' + a.content + ' ' + a.category).toLowerCase();
    if (search.trim() && !text.includes(search.toLowerCase())) return false;
    if (category !== 'all' && String(a.category).toLowerCase() !== category) return false;
    if (statusFilter !== 'all' && (a.status || 'published').toLowerCase() !== statusFilter) return false;
    return true;
  });
  visible = [...visible].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const current = Math.min(page, totalPages);
  const pageItems = visible.slice((current - 1) * perPage, current * perPage);
  useEffect(() => { setPage(1); }, [search, category, statusFilter, sort, perPage]);

  function openCreate() {
    setEditing(null);
    setForm(f => ({ title: '', category: 'garbage', content: '', publish_option: 'now', scheduleDate: f.scheduleDate, scheduleTime: f.scheduleTime, announcementDate: f.announcementDate, announcementStartTime: f.announcementStartTime, timezone: '(GMT+8) Asia/Manila', audience: 'All Residents', coverFile: null, cover_image: null, schedule_label: '', schedule_time: '', recurrence: 'Every Week', area: '' }));
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openEdit(item) {
    setEditing(item.id);
    const isScheduled = (item.status || '').toLowerCase() === 'scheduled' && item.publish_at;
    const isDraft = (item.status || '').toLowerCase() === 'draft';
    let d = '', t = '', ad = '', at = '';
    if (item.publish_at) {
      const dt = new Date(item.publish_at);
      if (!isNaN(dt.getTime())) { d = dt.toISOString().slice(0, 10); t = dt.toISOString().slice(11, 16); }
    }
    if (item.announcement_date) {
      const adt = new Date(item.announcement_date);
      if (!isNaN(adt.getTime())) { ad = adt.toISOString().slice(0, 10); }
    }
    if (item.announcement_start_time) {
      at = item.announcement_start_time.slice(0, 5);
    }
    setForm({
      title: item.title || '', category: String(item.category || '').toLowerCase(), content: item.content || '',
      publish_option: isDraft ? 'draft' : isScheduled ? 'later' : 'now',
      scheduleDate: d || '', scheduleTime: t || '08:00',
      announcementDate: ad || '', announcementStartTime: at || '',
      timezone: '(GMT+8) Asia/Manila', audience: item.audience || 'All Residents', coverFile: null, cover_image: item.cover_image || null,
      schedule_label: item.schedule_label || '', schedule_time: item.schedule_time || '', recurrence: item.recurrence || 'Every Week', area: item.area || '',
    });
    setPreview(item.cover_image ? (item.cover_image.startsWith('http') ? item.cover_image : uploadUrl(item.cover_image)) : null);
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeForm() { setView('list'); setEditing(null); }

  function handleImage(file) {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    const typeOk = allowedTypes.includes(file.type) || allowedExts.includes(ext);
    if (!typeOk) { showToast('Please upload JPG, PNG, or WEBP only.', 'error'); if (fileRef.current) fileRef.current.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be smaller than 5MB.', 'error'); if (fileRef.current) fileRef.current.value = ''; return; }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
    setForm(f => ({ ...f, coverFile: file }));
    // keep input value cleared so same file can be re-selected after remove
    setDragOver(false);
  }
  function removeImage(e) { e?.preventDefault(); e?.stopPropagation(); if (fileRef.current) fileRef.current.value = ''; setPreview(null); setForm(f => ({ ...f, coverFile: null, cover_image: null })); setDragOver(false); }
  function triggerFilePicker() { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }

  async function handleSave() {
    if (!form.title.trim()) { showToast('Please enter an announcement title.'); return; }
    if (!form.category) { showToast('Please select a category.'); return; }
    if (!form.content.trim()) { showToast('Please enter the announcement description.'); return; }
    if (String(form.category || '').toLowerCase() === 'garbage') {
      if (!form.schedule_label.trim()) { showToast('Please enter the collection day (e.g. Friday).'); return; }
      if (!form.schedule_time.trim()) { showToast('Please enter the collection time (e.g. 9:00 AM – 10:00 AM).'); return; }
      if (!form.area.trim()) { showToast('Please enter the collection area.'); return; }
    }
    if (form.publish_option === 'later') {
      if (!form.announcementDate) { showToast('Please select the announcement date.'); return; }
      if (!form.announcementStartTime) { showToast('Please select the start time.'); return; }
    }
    if (form.publish_option === 'later' && (!form.scheduleDate || !form.scheduleTime)) { showToast('Please select the scheduled date and time.'); return; }
    if (form.publish_option === 'later') {
      const dt = new Date(`${form.scheduleDate}T${form.scheduleTime}`);
      if (dt <= new Date()) { showToast('The scheduled date and time must be in the future.'); return; }
    }
    setSaving(true);
    const publish_at = form.publish_option === 'later' ? `${form.scheduleDate} ${form.scheduleTime}:00` : '';
    const status = form.publish_option === 'draft' ? 'draft' : form.publish_option === 'later' ? 'scheduled' : 'published';
    const base = { title: form.title.trim(), content: form.content.trim(), category: form.category, status, audience: form.audience, visibility: 'Public', publish_option: form.publish_option === 'draft' ? 'draft' : form.publish_option === 'now' ? 'now' : 'schedule', publish_at, timezone: form.timezone, send_notification: 1, priority: 'Normal', announcement_date: form.announcementDate, announcement_start_time: form.announcementStartTime, schedule_label: form.schedule_label.trim(), schedule_time: form.schedule_time.trim(), recurrence: form.recurrence.trim(), area: form.area.trim() };
    try {
      if (editing) base.id = editing;
      let body = base;
      if (form.coverFile) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => fd.append(k, v));
        fd.append('cover_image', form.coverFile);
        body = fd;
      }
      await apiFetch(editing ? 'announcements/update.php' : 'announcements/create.php', { method: 'POST', body });
      const msg = form.publish_option === 'later' ? 'Announcement scheduled successfully!' : form.publish_option === 'draft' ? 'Announcement saved as draft.' : 'Announcement published successfully!';
      showToast(msg);
      setView('list');
      setEditing(null);
      await load();
    } catch (err) { showToast(err.message || 'Failed to save.', 'error'); } finally { setSaving(false); }
  }

  async function submitDelete() {
    if (!deleteTarget) return;
    try { await apiFetch('announcements/delete.php', { method: 'POST', body: { id: deleteTarget.id } }); setDeleteTarget(null); await load(); showToast('Announcement deleted.'); } catch { showToast('Failed to delete.', 'error'); }
  }

  const submitLabel = form.publish_option === 'later' ? '▣ Schedule Announcement' : form.publish_option === 'now' ? '✓ Publish Announcement' : '▣ Save Draft';

  return (
    <div className="admin-ann-root">
      <style>{`
        .admin-ann-root{--blue:#1769ff;--blue-dark:#0e52cf;--blue-light:#edf4ff;--navy:#10254b;--muted:#63789b;--bg:#f5f7fb;--white:#ffffff;--border:#dfe6f0;--green:#159447;--green-bg:#e8f8ef;--orange:#e58b00;--orange-bg:#fff2da;--purple:#7452e8;--purple-bg:#f0ebff;--shadow:0 5px 20px rgba(30,65,110,.06);font-family:Inter,"Segoe UI",Arial,sans-serif;color:var(--navy)}
        .admin-ann-root .content{max-width:1320px;margin:0 auto;padding:10px 0 20px}
        .admin-ann-root .page-top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}
        .admin-ann-root .page-title-area{display:flex;gap:14px;align-items:center}
        .admin-ann-root .title-icon{width:48px;height:48px;border-radius:50%;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 48px}
        .admin-ann-root .eyebrow{color:var(--blue);font-size:9px;font-weight:900;letter-spacing:1px;margin-bottom:5px}
        .admin-ann-root h1{font-size:28px;line-height:1.1;font-weight:900}
        .admin-ann-root .subtitle{color:var(--muted);font-size:11px;margin-top:7px}
        .admin-ann-root .primary-button{height:43px;padding:0 20px;background:var(--blue);border:0;border-radius:8px;color:white;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:7px;box-shadow:0 5px 12px rgba(23,105,255,.16)}
        .admin-ann-root .primary-button:hover{background:var(--blue-dark)}
        .admin-ann-root .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:25px}
        .admin-ann-root .stat-card{background:white;border:1px solid var(--border);border-radius:13px;padding:16px;display:flex;align-items:center;gap:13px;box-shadow:var(--shadow)}
        .admin-ann-root .stat-icon{width:39px;height:39px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px;flex:0 0 39px}
        .admin-ann-root .stat-icon.blue{background:var(--blue-light);color:var(--blue)}
        .admin-ann-root .stat-icon.green{background:var(--green-bg);color:var(--green)}
        .admin-ann-root .stat-icon.orange{background:var(--orange-bg);color:var(--orange)}
        .admin-ann-root .stat-icon.purple{background:var(--purple-bg);color:var(--purple)}
        .admin-ann-root .stat-number{font-size:20px;font-weight:900}
        .admin-ann-root .stat-label{color:var(--muted);font-size:8px;margin-top:3px}
        .admin-ann-root .stat-link{color:var(--blue);font-size:8px;margin-top:5px;cursor:pointer}
        .admin-ann-root .filter-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px;display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:9px;margin-bottom:22px;box-shadow:var(--shadow);position:sticky;top:68px;z-index:5}
        .admin-ann-root .input,.admin-ann-root .select{height:39px;border:1px solid #dbe4ef;border-radius:8px;background:#fff;color:var(--navy);padding:0 12px;font-family:inherit;font-size:10px;outline:none;width:100%}
        .admin-ann-root .input:focus,.admin-ann-root .select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(23,105,255,.08)}
        .admin-ann-root .search-wrap{position:relative}
        .admin-ann-root .search-wrap .input{padding-left:34px}
        .admin-ann-root .search-icon{position:absolute;left:12px;top:11px;color:#7588a5;font-size:14px}
        .admin-ann-root .table-card{background:white;border:1px solid var(--border);border-radius:13px;overflow:hidden;box-shadow:var(--shadow)}
        .admin-ann-root .table{width:100%;border-collapse:collapse;table-layout:fixed}
        .admin-ann-root .announcement-cards-mobile{display:none}
        .admin-ann-root .announcement-mobile-card{background:white;border:1px solid var(--border);border-radius:13px;overflow:hidden;box-shadow:var(--shadow)}
        .admin-ann-root .announcement-mobile-image{width:100%;height:140px;object-fit:cover;background:#e9eef5}
        .admin-ann-root .announcement-mobile-body{padding:12px}
        .admin-ann-root .announcement-mobile-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
        .admin-ann-root .announcement-mobile-title{font-size:12px;font-weight:900;color:var(--navy);line-height:1.4;margin-bottom:6px}
        .admin-ann-root .announcement-mobile-desc{font-size:9px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px}
        .admin-ann-root .announcement-mobile-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:8px;color:var(--muted)}
        .admin-ann-root .announcement-mobile-actions{display:flex;gap:5px}
        .admin-ann-root .table th{height:49px;text-align:left;padding:0 14px;color:#637595;font-size:8px;font-weight:800;letter-spacing:.2px;border-bottom:1px solid var(--border)}
        .admin-ann-root .table td{padding:15px 14px;vertical-align:middle;border-bottom:1px solid #edf1f6;font-size:9px}
        .admin-ann-root .announcement{display:flex;gap:10px;align-items:center}
        .admin-ann-root .announcement-image{width:68px;height:58px;object-fit:cover;border-radius:7px;background:#e9eef5;flex:0 0 68px}
        .admin-ann-root .announcement-title{color:var(--navy);font-size:10px;font-weight:900;line-height:1.45;margin-bottom:5px}
        .admin-ann-root .announcement-description{color:var(--muted);line-height:1.5;font-size:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .admin-ann-root .category{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border-radius:7px;font-size:8px;font-weight:700;background:var(--green-bg);color:var(--green)}
        .admin-ann-root .status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:20px;font-size:8px;font-weight:800}
        .admin-ann-root .status::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
        .admin-ann-root .status.published{background:var(--green-bg);color:var(--green)}
        .admin-ann-root .status.scheduled{background:var(--orange-bg);color:var(--orange)}
        .admin-ann-root .status.draft{background:#f1f5f9;color:#64748b}
        .admin-ann-root .date{font-size:9px;font-weight:700;color:var(--navy);line-height:1.5}
        .admin-ann-root .subtext{color:var(--muted);font-size:8px;margin-top:3px}
        .admin-ann-root .actions{display:flex;gap:5px}
        .admin-ann-root .icon-button{width:30px;height:30px;background:white;border:1px solid #dbe4ef;border-radius:7px;cursor:pointer;color:#526b91;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
        .admin-ann-root .icon-button:hover{color:var(--blue);border-color:#b8cef7;background:var(--blue-light)}
        .admin-ann-root .table-footer{min-height:55px;border-top:1px solid var(--border);padding:0 14px;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:8px;flex-wrap:wrap;gap:10px}
        .admin-ann-root .pagination{display:flex;align-items:center;gap:5px}
        .admin-ann-root .page-button{width:31px;height:31px;border:1px solid var(--border);border-radius:7px;background:white;color:var(--navy);cursor:pointer;font-size:10px}
        .admin-ann-root .page-button.active{color:var(--blue);border-color:var(--blue);background:#f6f9ff;font-weight:800}
        .admin-ann-root .page-button:disabled{opacity:.4;cursor:not-allowed}
        .admin-ann-root .info-card{margin-top:24px;padding:17px 20px;background:#f6faff;border:1px solid #cbdfff;border-radius:11px;display:flex;align-items:center;gap:12px}
        .admin-ann-root .info-icon{width:31px;height:31px;border-radius:50%;background:var(--blue);color:white;display:flex;align-items:center;justify-content:center;font-weight:900;flex:0 0 31px}
        .admin-ann-root .form-card{background:white;border:1px solid var(--border);border-radius:13px;padding:26px;box-shadow:var(--shadow)}
        .admin-ann-root .form-section{margin-bottom:28px}
        .admin-ann-root .form-section-title{font-size:12px;font-weight:900;margin-bottom:15px}
        .admin-ann-root .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px;align-items:stretch}
        .admin-ann-root .form-group{display:flex;flex-direction:column;gap:7px}
        .admin-ann-root .form-group.full{grid-column:1 / -1}
        .admin-ann-root label{font-size:9px;font-weight:800}
        .admin-ann-root .required{color:#ef3e45}
        .admin-ann-root .textarea{width:100%;min-height:100px;border:1px solid #dbe4ef;border-radius:8px;resize:vertical;padding:11px 12px;font-family:inherit;font-size:10px;color:var(--navy);outline:none}
        .admin-ann-root .textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(23,105,255,.08)}
        .admin-ann-root .char-count{text-align:right;color:var(--muted);font-size:8px}
        .admin-ann-root .upload-area{min-height:73px;height:100%;border:1px dashed #b9c8dc;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;cursor:pointer;color:var(--navy);background:#fbfdff;overflow:hidden;position:relative;transition:all .2s ease}
        .admin-ann-root .upload-area:hover{border-color:var(--blue);background:#f7faff}
        .admin-ann-root .upload-area.drag-over{border-color:var(--blue);background:#f0f7ff;box-shadow:0 0 0 3px rgba(23,105,255,0.12);border-style:solid}
        .admin-ann-root .upload-area:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
        .admin-ann-root .tip{padding:14px 16px;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:10px;color:#14532d;min-height:73px;height:auto;display:flex;flex-direction:column;justify-content:center;gap:6px;box-shadow:0 1px 8px rgba(22,163,74,0.07)}
        .admin-ann-root .tip strong{font-size:10px;font-weight:900;letter-spacing:.3px;color:#15803d;display:flex;align-items:center;gap:6px}
        .admin-ann-root .tip p{font-size:9px;line-height:1.6;color:#365a3a;margin:0}
        .admin-ann-root .publication{display:grid;grid-template-columns:280px 1fr;gap:25px;align-items:start}
        .admin-ann-root .radio-list{display:flex;flex-direction:column;gap:16px}
        .admin-ann-root .radio-option{display:flex;align-items:flex-start;gap:9px;cursor:pointer}
        .admin-ann-root .radio-option input{margin-top:2px;accent-color:var(--blue)}
        .admin-ann-root .radio-title{display:block;font-size:10px;font-weight:800}
        .admin-ann-root .radio-description{display:block;color:var(--muted);font-size:8px;line-height:1.5;margin-top:3px}
        .admin-ann-root .schedule-box{border:1px solid var(--blue);border-radius:9px;padding:14px;background:#fbfdff;display:none}
        .admin-ann-root .schedule-box.show{display:block}
        .admin-ann-root .schedule-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
        .admin-ann-root .timezone{grid-column:1 / -1}
        .admin-ann-root .schedule-note{color:var(--muted);font-size:8px;margin-top:7px}
        .admin-ann-root .audience-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px}
        .admin-ann-root .audience-help{background:var(--blue-light);border:1px solid #d1e0ff;border-radius:8px;padding:13px;display:flex;gap:9px}
        .admin-ann-root .form-footer{margin-top:25px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap}
        .admin-ann-root .secondary-button{height:42px;padding:0 20px;border:1px solid #d4dfec;background:white;color:var(--navy);border-radius:8px;font-size:10px;font-weight:800;cursor:pointer}
        .admin-ann-root .schedule-button{height:42px;padding:0 22px;background:var(--blue);color:white;border:0;border-radius:8px;font-size:10px;font-weight:800;cursor:pointer}
        .admin-ann-root .schedule-button:disabled{opacity:.6;cursor:not-allowed}
        @media(max-width:1100px){
          .admin-ann-root .stats{grid-template-columns:repeat(2,1fr)}
          .admin-ann-root .filter-card{grid-template-columns:1fr 1fr}
          .admin-ann-root .publication{grid-template-columns:1fr}
          .admin-ann-root .audience-grid{grid-template-columns:1fr}
        }
        @media(max-width:700px){
          .admin-ann-root .content{padding:10px 0}
          .admin-ann-root .page-top{align-items:flex-start;flex-direction:column;margin-bottom:20px}
          .admin-ann-root .title-icon{width:42px;height:42px;font-size:19px}
          .admin-ann-root h1{font-size:23px}
          .admin-ann-root .primary-button{width:100%;justify-content:center}
          .admin-ann-root .stats{grid-template-columns:1fr 1fr;gap:8px}
          .admin-ann-root .filter-card{grid-template-columns:1fr;padding:9px;position:static}
          .admin-ann-root .table-card{display:none}
          .admin-ann-root .announcement-cards-mobile{display:grid;gap:12px;margin-bottom:22px}
          .admin-ann-root .form-card{padding:15px}
          .admin-ann-root .form-grid{grid-template-columns:1fr}
          .admin-ann-root .schedule-grid{grid-template-columns:1fr}
          .admin-ann-root .form-footer{flex-direction:column-reverse}
          .admin-ann-root .secondary-button,.admin-ann-root .schedule-button{width:100%}
        }
        @media(max-width:430px){
          .admin-ann-root .stats{grid-template-columns:1fr}
          .admin-ann-root h1{font-size:21px}
        }
      `}</style>

      {view === 'list' ? (
        <div className="content">
          <div className="page-top">
            <div className="page-title-area">
              <div className="title-icon">⚑</div>
              <div>
                <div className="eyebrow">COMMUNICATIONS</div>
                <h1>Announcements</h1>
                <p className="subtitle">Create, manage, and schedule important community announcements.</p>
              </div>
            </div>
            {isManager && (
              <button className="primary-button" onClick={openCreate}>+ New Announcement</button>
            )}
          </div>

          <div className="stats">
            <div className="stat-card">
              <div className="stat-icon blue">⚑</div>
              <div>
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total Announcements</div>
                <div className="stat-link" onClick={() => { setStatusFilter('all'); setCategory('all'); }}>View all</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">✓</div>
              <div>
                <div className="stat-number">{stats.published}</div>
                <div className="stat-label">Published</div>
                <div className="stat-link" onClick={() => setStatusFilter('published')}>View published</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange">▣</div>
              <div>
                <div className="stat-number">{stats.scheduled}</div>
                <div className="stat-label">Scheduled</div>
                <div className="stat-link" onClick={() => setStatusFilter('scheduled')}>View scheduled</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">▤</div>
              <div>
                <div className="stat-number">{stats.drafts}</div>
                <div className="stat-label">Drafts</div>
                <div className="stat-link" onClick={() => setStatusFilter('draft')}>View drafts</div>
              </div>
            </div>
          </div>

          <div className="filter-card">
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input className="input" placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
            </select>
            <select className="select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">↕ Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>

          <div className="table-card">
            {error ? (
              <div style={{ padding: 30 }}><StaffErrorState message="Unable to load announcements." onRetry={load} /></div>
            ) : !items ? (
              <div style={{ padding: 20 }}><SkeletonRows rows={4} height="h-16" /></div>
            ) : pageItems.length === 0 ? (
              <div style={{ padding: 30 }}><StaffEmptyState title="No announcements found." description="Try adjusting your search or filters." /></div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>ANNOUNCEMENT</th>
                      <th style={{ width: '12%' }}>CATEGORY</th>
                      <th style={{ width: '10%' }}>STATUS</th>
                      <th style={{ width: '16%' }}>PUBLISHED / SCHEDULED</th>
                      <th style={{ width: '12%' }}>AUDIENCE</th>
                      <th style={{ width: '12%' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map(a => {
                      const cover = a.cover_image ? (String(a.cover_image).startsWith('http') ? a.cover_image : uploadUrl(a.cover_image)) : null;
                      const catLabel = CATEGORY_LABEL[String(a.category).toLowerCase()] || a.category || 'General';
                      const status = (a.status || 'published').toLowerCase();
                      return (
                        <tr key={a.id}>
                          <td>
                            <div className="announcement">
                              <img className="announcement-image" src={cover || 'https://via.placeholder.com/68x58?text='} alt="" onError={e => { e.currentTarget.src = 'https://via.placeholder.com/68x58?text='; }} />
                              <div>
                                <div className="announcement-title">{a.title}</div>
                                <div className="announcement-description">{a.content}</div>
                              </div>
                            </div>
                          </td>
                          <td>{(() => { const s = CATEGORY_STYLE[String(a.category).toLowerCase()] || CATEGORY_STYLE.general; return <span className="category" style={{ background: s.bg, color: s.color }}>{s.icon} {catLabel}</span>; })()}</td>
                          <td><span className={`status ${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                          <td>
                            <div className="date">{formatDate(a.publish_at || a.created_at)}</div>
                            <div className="subtext">by {a.author_name || 'Super Admin'}</div>
                          </td>
                          <td>
                            <div className="date">♙ {a.audience || 'All Residents'}</div>
                            <div className="subtext">{a.visibility || 'Public'}</div>
                          </td>
                          <td>
                            <div className="actions">
                              <button className="icon-button" title="View" onClick={() => showToast('Opening: ' + a.title)}>◉</button>
                              {isManager && <button className="icon-button" title="Edit" onClick={() => openEdit(a)}>✎</button>}
                              {isManager && <button className="icon-button" title="Delete" onClick={() => setDeleteTarget(a)}>🗑</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="table-footer">
                  <span>Showing {(current - 1) * perPage + 1} to {Math.min(current * perPage, visible.length)} of {visible.length} results</span>
                  <div className="pagination">
                    <button className="page-button" disabled={current <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, current - 3), Math.min(totalPages, current + 2)).map(n => (
                      <button key={n} className={`page-button ${n === current ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                    ))}
                    <button className="page-button" disabled={current >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
                    <select className="select" style={{ width: 100, height: 31 }} value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="announcement-cards-mobile">
            {pageItems.map(a => {
              const cover = a.cover_image ? (String(a.cover_image).startsWith('http') ? a.cover_image : uploadUrl(a.cover_image)) : null;
              const s = CATEGORY_STYLE[String(a.category).toLowerCase()] || CATEGORY_STYLE.general;
              const status = (a.status || 'published').toLowerCase();
              return (
                <div key={'m-' + a.id} className="announcement-mobile-card">
                  <img className="announcement-mobile-image" src={cover || 'https://via.placeholder.com/400x180?text='} alt="" onError={e => { e.currentTarget.src = 'https://via.placeholder.com/400x180?text='; }} />
                  <div className="announcement-mobile-body">
                    <div className="announcement-mobile-meta">
                      <span className="category" style={{ background: s.bg, color: s.color }}>{s.icon} {CATEGORY_LABEL[String(a.category).toLowerCase()] || a.category}</span>
                      <span className={`status ${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                    <div className="announcement-mobile-title">{a.title}</div>
                    <div className="announcement-mobile-desc">{a.content}</div>
                    <div className="announcement-mobile-footer">
                      <span>{formatDate(a.publish_at || a.created_at)} · {a.audience || 'All Residents'}</span>
                      <span className="announcement-mobile-actions">
                        <button className="icon-button" onClick={() => showToast('Opening: ' + a.title)}>◉</button>
                        {isManager && <button className="icon-button" onClick={() => openEdit(a)}>✎</button>}
                        {isManager && <button className="icon-button" onClick={() => setDeleteTarget(a)}>🗑</button>}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="info-card">
            <div className="info-icon">i</div>
            <div>
              <strong>About Scheduled Announcements</strong>
              <p>Scheduled announcements will be automatically published at the selected date and time. Residents will only see the announcement after it becomes published.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="content">
          <div className="page-top">
            <div className="page-title-area">
              <div className="title-icon">⚑</div>
              <div>
                <div className="eyebrow">ANNOUNCEMENTS</div>
                <h1>{editing ? 'Edit Announcement' : 'New Announcement'}</h1>
                <p className="subtitle">{editing ? 'Update the announcement details.' : 'Create and schedule an important announcement for the community.'}</p>
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">1. Announcement Details</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Title <span className="required">*</span></label>
                  <input className="input" placeholder="Enter announcement title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={150} />
                </div>
                <div className="form-group">
                  <label>Category <span className="required">*</span></label>
                  <select className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group full">
                  <label>Description <span className="required">*</span></label>
                  <textarea className="textarea" placeholder="Enter announcement details..." maxLength={1000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                  <div className="char-count">{form.content.length} / 1000</div>
                </div>
                <div className="form-group">
                  <label>Optional Image</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handleImage(f); }}
                    onClick={e => { e.target.value = ''; }}
                  />
                  <div
                    className={`upload-area ${dragOver ? 'drag-over' : ''}`}
                    onClick={triggerFilePicker}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerFilePicker(); }}}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload cover image"
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleImage(f); }}
                  >
                    {preview ? (
                      <>
                        <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: 8, pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 45%)', pointerEvents: 'none' }} />
                        <span style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, color: '#1769ff', pointerEvents: 'none' }}>Click to change</span>
                        <button type="button" onClick={removeImage} aria-label="Remove image" style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1px solid #dbe4ef', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 14, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>×</button>
                      </>
                    ) : (
                      <>
                        <strong>☁ Upload Image</strong>
                        <span>JPG, PNG, WEBP up to 5MB</span>
                        <span style={{ fontSize: 8, color: '#8a9bb7' }}>or drag and drop here</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="tip">
                  <strong><span aria-hidden style={{ fontSize: '13px', lineHeight: 1 }}>💡</span> Tips</strong>
                  <p>Adding an image can help residents better understand your announcement — use a clear, well-lit photo related to the topic.</p>
                </div>
                <div className="form-group full" style={{ marginTop: 12 }}>
                  <label>Collection Schedule &amp; Area <span style={{ fontWeight: 400, color: '#63789b' }}>(separate from publication — required for Garbage Schedule)</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="input" placeholder="Collection day (e.g. Friday)" value={form.schedule_label} onChange={e => setForm({ ...form, schedule_label: e.target.value })} maxLength={100} />
                    <input className="input" placeholder="Time (e.g. 9:00 AM – 10:00 AM)" value={form.schedule_time} onChange={e => setForm({ ...form, schedule_time: e.target.value })} maxLength={100} />
                    <select className="select" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                      <option>Every Week</option>
                      <option>Every 2 Weeks</option>
                      <option>Monthly</option>
                      <option>One-time</option>
                    </select>
                    <input className="input" placeholder="Area (e.g. Phase 1, Phase 2)" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} maxLength={190} />
                  </div>
                </div>
</div>
            </div>
 
            {/* ===== ② Announcement Date & Time - hidden for Publish Now, no date needed ===== */}
            {form.publish_option === 'later' && (
            <div className="form-section">
              <div className="form-section-title">② Announcement Date & Time</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Announcement Date <span className="required">*</span></label>
                  <input className="input" type="date" value={form.announcementDate} onChange={e => setForm({ ...form, announcementDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Start Time <span className="required">*</span></label>
                  <input className="input" type="time" value={form.announcementStartTime} onChange={e => setForm({ ...form, announcementStartTime: e.target.value })} />
                </div>
              </div>
            </div>
            )}
 
            <div className="form-section">
              <div className="form-section-title">2. Publication</div>
              <div className="publication">
                <div className="radio-list">
                  <label className="radio-option">
                    <input type="radio" name="publication" checked={form.publish_option === 'now'} onChange={() => setForm({ ...form, publish_option: 'now' })} />
                    <span><span className="radio-title">Publish Now</span><span className="radio-description">Publish the announcement immediately.</span></span>
                  </label>
                  <label className="radio-option">
                    <input type="radio" name="publication" checked={form.publish_option === 'later'} onChange={() => setForm({ ...form, publish_option: 'later' })} />
                    <span><span className="radio-title">Reschedule for Later</span><span className="radio-description">Choose a future date and time to publish.</span></span>
                  </label>
                  <label className="radio-option">
                    <input type="radio" name="publication" checked={form.publish_option === 'draft'} onChange={() => setForm({ ...form, publish_option: 'draft' })} />
                    <span><span className="radio-title">Save as Draft</span><span className="radio-description">Save as draft, not visible to residents.</span></span>
                  </label>
                </div>
                <div className={`schedule-box ${form.publish_option === 'later' ? 'show' : ''}`}>
                  <div className="schedule-grid">
                    <div className="form-group">
                      <label>Rescheduled Date <span className="required">*</span></label>
                      <input className="input" type="date" value={form.scheduleDate} onChange={e => setForm({ ...form, scheduleDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Rescheduled Time <span className="required">*</span></label>
                      <input className="input" type="time" value={form.scheduleTime} onChange={e => setForm({ ...form, scheduleTime: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">3. Audience</div>
              <div className="audience-grid">
                <div className="form-group">
                  <label>Audience <span className="required">*</span></label>
                  <select className="select" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                    <option>All Residents</option>
                    <option>Residents</option>
                    <option>Staff</option>
                    <option>Admins</option>
                  </select>
                  <div className="subtext">Select who can see this announcement.</div>
                </div>
                {/* Who can see this removed on new announcement - D:\GAMES\backup (9)\frontend */}
              </div>
            </div>

            <div className="form-footer">
              <button className="secondary-button" onClick={closeForm}>Cancel</button>
              <button className="secondary-button" disabled={saving} onClick={async () => { const prev = form.publish_option; setForm({ ...form, publish_option: 'draft' }); setTimeout(() => handleSave(), 0); }}>{saving ? 'Saving...' : '▣ Save as Draft'}</button>
              <button className="schedule-button" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : submitLabel}</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={deleteTarget !== null} title="Delete Announcement" description={`Delete "${deleteTarget?.title || 'this announcement'}"? This cannot be undone.`} confirmLabel="Delete" danger onConfirm={submitDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
