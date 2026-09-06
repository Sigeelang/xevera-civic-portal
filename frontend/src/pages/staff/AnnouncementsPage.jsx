import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
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

// --- shared compact form styles (match Create Announcement mockup) ---
const INP = 'w-full h-[37px] px-3.5 border border-[#C5D3E5] rounded-[7px] bg-white text-[13px] text-[#10224F] outline-none focus:border-[#4388FF] focus:ring-[3px] focus:ring-[rgba(67,136,255,0.10)]';
const LBL = 'block mt-[7px] mb-1 text-[13px] font-bold text-[#0B1B4B]';
const CARD = 'bg-white border border-[#DCE7F3] rounded-[11px] mb-3 p-4 sm:p-[14px_32px_16px]';

function SectionHead({ icon, tone, title, desc }) {
  const tones = {
    blue: 'bg-[#E8F1FF] text-[#0867ED]',
    green: 'bg-[#DDF8E8] text-[#08AA4E]',
    purple: 'bg-[#EEE7FF] text-[#6840E8]',
    pink: 'bg-[#FFE5F5] text-[#ED2CA4]',
  };
  return (
    <div className="flex items-center gap-3 mb-2.5">
      <span className={`w-[35px] h-[35px] rounded-full grid place-items-center flex-shrink-0 ${tones[tone] || tones.blue}`}>
        <Icon name={icon} size={21} />
      </span>
      <div>
        <h2 className="text-[17px] font-extrabold text-[#0B1B4B]">{title}</h2>
        <p className="text-[13px] text-[#365181]">{desc}</p>
      </div>
    </div>
  );
}

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
    schedule_label: '', schedule_time: '', recurrence: '', area: '',
  });
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // --- collection time-range modal state (defaults 8:00 AM – 10:00 AM) ---
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [startH, setStartH] = useState('8');
  const [startM, setStartM] = useState('00');
  const [startP, setStartP] = useState('AM');
  const [endH, setEndH] = useState('10');
  const [endM, setEndM] = useState('00');
  const [endP, setEndP] = useState('AM');
  const HOURS12 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const MINUTES5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  const toMinutes12 = (h, m, p) => {
    let hh = parseInt(h, 10);
    if (p === 'AM') { if (hh === 12) hh = 0; } else if (hh !== 12) hh += 12;
    return hh * 60 + parseInt(m, 10);
  };
  const timePreviewText = `${startH}:${startM} ${startP} – ${endH}:${endM} ${endP}`;
  function confirmCollectionTime() {
    if (toMinutes12(endH, endM, endP) <= toMinutes12(startH, startM, startP)) {
      showToast('End time must be later than start time.', 'error');
      return;
    }
    setForm(f => ({ ...f, schedule_time: timePreviewText }));
    setShowTimeModal(false);
  }
  const CATEGORY_ICON = { general: 'tag', maintenance: 'wrench', safety: 'alert', events: 'calendar', garbage: 'trash', advisory: 'megaphone' };
  const AREA_OPTIONS = ['All Areas', ...Array.from({ length: 18 }, (_, i) => `Block ${i + 1}`)];
  const areaValue = AREA_OPTIONS.includes(form.area) ? form.area : (form.area ? `__legacy__` : '');

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
    setForm(f => ({ title: '', category: '', content: '', publish_option: 'now', scheduleDate: f.scheduleDate, scheduleTime: f.scheduleTime, announcementDate: '', announcementStartTime: '', timezone: '(GMT+8) Asia/Manila', audience: 'All Residents', coverFile: null, cover_image: null, schedule_label: '', schedule_time: '', recurrence: '', area: '' }));
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
      schedule_label: item.schedule_label || '', schedule_time: item.schedule_time || '', recurrence: item.recurrence || '', area: item.area || '',
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

  async function handleSave(forceDraft = false) {
    const option = forceDraft ? 'draft' : form.publish_option;
    const derivedTitle = CATEGORY_LABEL[String(form.category || '').toLowerCase()] || form.category;
    if (!form.category) { showToast('Please select a category.'); return; }
    if (!form.content.trim()) { showToast('Please enter the announcement description.'); return; }
    if (String(form.category || '').toLowerCase() === 'garbage') {
      if (!form.schedule_label.trim()) { showToast('Please enter the collection day (e.g. Friday).'); return; }
      if (!form.schedule_time.trim()) { showToast('Please enter the collection time (e.g. 9:00 AM – 10:00 AM).'); return; }
      if (!form.recurrence.trim()) { showToast('Please select a recurrence.'); return; }
      if (!form.area.trim()) { showToast('Please enter the collection area.'); return; }
    }
    if (option === 'later') {
      if (!form.scheduleDate || !form.scheduleTime) { showToast('Please select the scheduled date and time.'); return; }
      const dt = new Date(`${form.scheduleDate}T${form.scheduleTime}`);
      if (dt <= new Date()) { showToast('The scheduled date and time must be in the future.'); return; }
    }
    setSaving(true);
    const publish_at = option === 'later' ? `${form.scheduleDate} ${form.scheduleTime}:00` : '';
    const status = option === 'draft' ? 'draft' : option === 'later' ? 'scheduled' : 'published';
    const base = { title: derivedTitle, content: form.content.trim(), category: form.category, status, audience: form.audience, visibility: 'Public', publish_option: option === 'draft' ? 'draft' : option === 'now' ? 'now' : 'schedule', publish_at, timezone: form.timezone, send_notification: 1, priority: 'Normal', announcement_date: '', announcement_start_time: '', schedule_label: form.schedule_label.trim(), schedule_time: form.schedule_time.trim(), recurrence: form.recurrence.trim(), area: form.area.trim() };
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
      const msg = option === 'later' ? 'Announcement scheduled successfully!' : option === 'draft' ? 'Announcement saved as draft.' : 'Announcement published successfully!';
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

  const submitLabel = form.publish_option === 'later' ? 'Schedule Announcement' : form.publish_option === 'now' ? 'Publish Announcement' : 'Save Draft';

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
        .admin-ann-root .input,.admin-ann-root .select{height:44px;border:1px solid #dbe4ef;border-radius:8px;background:#fff;color:var(--navy);padding:0 12px;font-family:inherit;font-size:12px;outline:none;width:100%}
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
        <div className="max-w-[1500px] mx-auto px-4 sm:px-7 pb-6">
          <header className="min-h-[72px] flex items-center justify-between gap-5 py-3">
            <div className="flex items-center gap-4">
              <span className="w-[52px] h-[52px] flex items-center justify-center text-[#0968ED] flex-shrink-0">
                <Icon name="megaphone" size={36} />
              </span>
              <div>
                <h1 className="text-[22px] font-extrabold text-[#0B1B4B] leading-tight">{editing ? 'Edit Announcement' : 'Create Announcement'}</h1>
                <p className="text-[13px] text-[#365181] mt-0.5">{editing ? 'Update the announcement details.' : 'Share important updates with the community.'}</p>
              </div>
            </div>
            <button type="button" onClick={closeForm} className="h-[37px] px-4 border border-[#B9C9DF] bg-white text-[#10245A] rounded-[7px] text-[13px] font-bold cursor-pointer hover:bg-[#F3F7FC] hover:border-[#8FA8C9] transition-colors flex-shrink-0">
              ← <span className="hidden min-[800px]:inline">Back to Announcements</span>
            </button>
          </header>

          <div className={CARD}>
            <SectionHead icon="filetext" tone="blue" title="Announcement Details" desc="Select a category and provide the details for your announcement." />
            <div className="mb-5">
              <label className={LBL}>Category <span className="text-[#EF3131]">*</span></label>
              <div className="relative">
                <span className="absolute left-[17px] top-1/2 -translate-y-1/2 pointer-events-none text-[#0B245A]">
                  <Icon name={CATEGORY_ICON[String(form.category || '').toLowerCase()] || 'tag'} size={18} />
                </span>
                <select className={`${INP} pl-[52px] pr-10 cursor-pointer hover:border-[#9EB5D2]`} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-5">
              <label className={LBL}>Description <span className="text-[#EF3131]">*</span></label>
              <textarea className="w-full min-h-[84px] p-3 border border-[#C5D3E5] rounded-[7px] text-[13px] text-[#182C57] leading-relaxed outline-none resize-y focus:border-[#4388FF] focus:ring-[3px] focus:ring-[rgba(67,136,255,0.10)]" placeholder="Enter announcement details..." maxLength={1000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              <div className="text-right mt-1 text-xs text-[#526A96]">{form.content.length} / 1000</div>
            </div>
            <div>
              <label className={LBL}>Cover Image <span className="font-medium text-[#53698F]">(Optional)</span></label>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => { const f = e.target.files && e.target.files[0]; if (f) handleImage(f); }}
                onClick={e => { e.target.value = ''; }}
              />
              <div
                className={`relative w-full h-[95px] mt-1 flex flex-col items-center justify-center border-[1.5px] border-dashed rounded-[7px] bg-white cursor-pointer overflow-hidden transition-colors ${dragOver ? 'border-[#4388FF] bg-[#F8FBFF]' : 'border-[#9EB3D1] hover:border-[#4388FF] hover:bg-[#F8FBFF]'}`}
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
                    <span className="text-[#0B1B4B]"><Icon name="camera" size={30} /></span>
                    <strong className="text-[13px] text-[#0B1B4B] mt-0.5">Click to upload an image</strong>
                    <span className="text-[11px] text-[#526A96]">JPG, PNG, WEBP (Max 5 MB)</span>
                    <img src={preview} alt="Preview" className="absolute right-[15px] top-[7px] w-[125px] h-[80px] object-cover rounded-md border border-[#D4DFED] pointer-events-none" />
                    <button type="button" onClick={removeImage} aria-label="Remove image" className="absolute top-1 right-1 w-[26px] h-[26px] rounded-full bg-white border border-[#DBE4EF] cursor-pointer grid place-items-center text-sm leading-none shadow">×</button>
                  </>
                ) : (
                  <>
                    <span className="text-[#0B1B4B]"><Icon name="camera" size={30} /></span>
                    <strong className="text-[13px] text-[#0B1B4B] mt-0.5">Click to upload an image</strong>
                    <span className="text-[11px] text-[#526A96]">JPG, PNG, WEBP (Max 5 MB)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={CARD}>
            <SectionHead icon="calendar" tone="green" title="Collection Schedule" desc="Set the collection schedule for this garbage announcement." />
            <div className="grid grid-cols-1 min-[800px]:grid-cols-2 gap-x-6 gap-y-1">
              <div>
                <label className={LBL}>Collection Day {String(form.category || '').toLowerCase() === 'garbage' && <span className="text-[#EF3131]">*</span>}</label>
                <select className={`${INP} cursor-pointer hover:border-[#9EB5D2]`} value={form.schedule_label} onChange={e => setForm({ ...form, schedule_label: e.target.value })}>
                  <option value="">Select collection day</option>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Collection Time {String(form.category || '').toLowerCase() === 'garbage' && <span className="text-[#EF3131]">*</span>}</label>
                <button type="button" onClick={() => setShowTimeModal(true)} className={`${INP} flex items-center justify-between cursor-pointer hover:border-[#4388FF] bg-white text-left`}>
                  <span className="flex items-center gap-2.5">
                    <span className="text-[#1769FF]"><Icon name="clock" size={18} /></span>
                    <span>{form.schedule_time || 'Select collection time'}</span>
                  </span>
                  <span className="text-xs">▼</span>
                </button>
              </div>
              <div>
                <label className={LBL}>Recurrence {String(form.category || '').toLowerCase() === 'garbage' && <span className="text-[#EF3131]">*</span>}</label>
                <select className={`${INP} cursor-pointer hover:border-[#9EB5D2]`} value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                  <option value="">Select recurrence</option>
                  <option>Every Week</option>
                  <option>Every 2 Weeks</option>
                  <option>Monthly</option>
                  <option>One-time</option>
                </select>
              </div>
              <div>
                <label className={LBL}>Area {String(form.category || '').toLowerCase() === 'garbage' && <span className="text-[#EF3131]">*</span>}</label>
                <select className={`${INP} cursor-pointer hover:border-[#9EB5D2]`} value={areaValue} onChange={e => setForm({ ...form, area: e.target.value === '__legacy__' ? form.area : e.target.value })}>
                  <option value="">Select area</option>
                  {form.area && !AREA_OPTIONS.includes(form.area) && <option value="__legacy__">{form.area} (existing)</option>}
                  {AREA_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>
 
          <div className={CARD}>
            <SectionHead icon="megaphone" tone="purple" title="Publication" desc="Choose when to publish this announcement." />
            <div className="grid grid-cols-1 min-[1000px]:grid-cols-3 gap-4">
              {[
                { value: 'now', title: 'Publish Now', desc: 'Publish the announcement immediately.' },
                { value: 'later', title: 'Schedule for Later', desc: 'Choose a future date and time to publish.' },
                { value: 'draft', title: 'Save as Draft', desc: 'Save as a draft, not visible to residents.' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`min-h-[55px] flex items-center gap-3 px-4 py-2.5 border rounded-[7px] bg-white cursor-pointer transition-colors ${form.publish_option === opt.value ? 'border-[#4B8DFF] bg-[#EDF6FF]' : 'border-[#D1DEED] hover:bg-[#F7FBFF]'}`}
                >
                  <input type="radio" name="publication" className="hidden" checked={form.publish_option === opt.value} onChange={() => setForm({ ...form, publish_option: opt.value })} />
                  <span className={`w-[19px] h-[19px] rounded-full border-[1.7px] flex-shrink-0 relative ${form.publish_option === opt.value ? 'border-[#1670F5]' : 'border-[#49638E]'}`}>
                    {form.publish_option === opt.value && <span className="absolute left-[3px] top-[3px] w-[9px] h-[9px] rounded-full bg-[#1670F5]" />}
                  </span>
                  <span>
                    <strong className="block text-[13px] text-[#0B1B4B]">{opt.title}</strong>
                    <small className="block mt-px text-[11px] text-[#46608B]">{opt.desc}</small>
                  </span>
                </label>
              ))}
            </div>
            {form.publish_option === 'later' && (
              <div className="mt-2.5 p-4 bg-[#F8FBFF] border border-[#DBE5F2] rounded-[10px]">
                <div className="grid grid-cols-1 min-[800px]:grid-cols-2 gap-4">
                  <div>
                    <label className={LBL}>Publish Date</label>
                    <input className={INP} type="date" value={form.scheduleDate} onChange={e => setForm({ ...form, scheduleDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={LBL}>Publish Time</label>
                    <input className={INP} type="time" value={form.scheduleTime} onChange={e => setForm({ ...form, scheduleTime: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-[#667895] mt-2">Timezone: {form.timezone}. Must be in the future.</p>
              </div>
            )}
          </div>

          <footer className="min-h-[66px] flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center justify-between gap-3 p-2.5 border border-[#DCE7F3] rounded-[10px] bg-white">
            <button type="button" className="h-[37px] px-[18px] rounded-[7px] border border-[#C5D3E5] bg-white text-[#10245A] text-[13px] font-bold cursor-pointer hover:bg-[#F4F8FC] hover:border-[#AEBFD5] transition-colors" onClick={closeForm}>Cancel</button>
            <div className="flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center gap-2.5 w-full min-[600px]:w-auto">
              <button type="button" className="h-[37px] px-[18px] rounded-[7px] border border-[#C5D3E5] bg-white text-[#10245A] text-[13px] font-bold cursor-pointer hover:bg-[#F4F8FC] transition-colors disabled:opacity-55" disabled={saving} onClick={() => handleSave(true)}>{saving ? 'Saving...' : 'Save as Draft'}</button>
              <button type="button" className="h-[37px] px-[18px] rounded-[7px] border border-[#0869EF] text-white text-[13px] font-bold cursor-pointer disabled:opacity-55 inline-flex items-center justify-center gap-2" style={{ background: '#0869EF', boxShadow: '0 2px 5px rgba(8,105,239,.20)' }} disabled={saving} onClick={() => handleSave()}>{saving ? 'Saving...' : (<><Icon name="check" size={14} /> {submitLabel}</>)}</button>
            </div>
          </footer>
        </div>
      )}

      {showTimeModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5" style={{ background: 'rgba(10,25,55,0.45)' }} onClick={e => { if (e.target === e.currentTarget) setShowTimeModal(false); }}>
          <div className="w-full max-w-[600px] bg-white rounded-[15px] overflow-hidden" style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.20)' }}>
            <div className="px-5 py-4 border-b border-[#DBE5F2] flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[18px] font-extrabold text-[#102653]">
                <span className="text-[#1769FF]"><Icon name="clock" size={20} /></span>
                <span>Set Collection Time</span>
              </div>
              <button type="button" onClick={() => setShowTimeModal(false)} aria-label="Close" className="w-9 h-9 rounded-lg bg-transparent border-0 text-[#102653] text-[22px] cursor-pointer hover:bg-[#F2F5F9]">×</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { title: 'Start Time', h: startH, setH: setStartH, m: startM, setM: setStartM, p: startP, setP: setStartP },
                  { title: 'End Time', h: endH, setH: setEndH, m: endM, setM: setEndM, p: endP, setP: setEndP },
                ].map(col => (
                  <div key={col.title} className="border border-[#DBE5F2] rounded-[11px] p-4">
                    <h3 className="text-sm font-bold mb-3 text-[#102653]">{col.title}</h3>
                    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                      <select className="h-[45px] px-2 border border-[#C7D5E8] rounded-[9px] text-sm text-center text-[#102653] outline-none bg-white cursor-pointer" value={col.h} onChange={e => col.setH(e.target.value)}>
                        {HOURS12.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="font-extrabold">:</span>
                      <select className="h-[45px] px-2 border border-[#C7D5E8] rounded-[9px] text-sm text-center text-[#102653] outline-none bg-white cursor-pointer" value={col.m} onChange={e => col.setM(e.target.value)}>
                        {MINUTES5.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <span />
                      <select className="h-[45px] px-2 border border-[#C7D5E8] rounded-[9px] text-sm text-center text-[#102653] outline-none bg-white cursor-pointer" value={col.p} onChange={e => col.setP(e.target.value)}>
                        <option>AM</option>
                        <option>PM</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-3 rounded-lg bg-[#EDF5FF] text-[#1468FF] text-center text-base font-extrabold">{timePreviewText}</div>
            </div>
            <div className="px-5 py-4 border-t border-[#DBE5F2] flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button type="button" onClick={() => setShowTimeModal(false)} className="h-[43px] px-4.5 rounded-lg border border-[#C7D5E8] bg-white text-[#102653] font-bold cursor-pointer">Cancel</button>
              <button type="button" onClick={confirmCollectionTime} className="h-[43px] px-5 rounded-lg border-0 bg-[#1468FF] text-white font-bold cursor-pointer hover:bg-[#0D55D9]">Set Time</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={deleteTarget !== null} title="Delete Announcement" description={`Delete "${deleteTarget?.title || 'this announcement'}"? This cannot be undone.`} confirmLabel="Delete" danger onConfirm={submitDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
