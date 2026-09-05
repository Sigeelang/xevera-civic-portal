import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../Toast';
import Icon from '../Icon';
import { cleanPhoneOrEmail, normalizePhoneOrEmail } from '../../utils/phone';

const CATEGORY_GROUPS = [
  {
    label: 'Road & Infrastructure',
    items: ['Road Damage', 'Streetlight'],
  },
  {
    label: 'Waste Management',
    items: ['Garbage / Waste'],
  },
  {
    label: 'Drainage & Flooding',
    items: ['Flooding', 'Drainage'],
  },
  {
    label: 'Environment',
    items: ['Environmental'],
  },
  {
    label: 'Others',
    items: ['Water Problem', 'Public Safety', 'Other Issues'],
  },
];

function groupedCategories(flat) {
  if (!flat || flat.length === 0) return CATEGORY_GROUPS;
  const groups = CATEGORY_GROUPS
    .map((g) => ({ label: g.label, items: g.items.filter((c) => flat.includes(c)) }))
    .filter((g) => g.items.length > 0);
  const grouped = new Set(groups.flatMap((g) => g.items));
  const rest = flat.filter((c) => !grouped.has(c));
  if (rest.length) groups.push({ label: 'Others', items: rest });
  return groups;
}

export default function ReportForm({ onSuccess, onNavigate, submitLabel = 'Submit Report', presetCategory }) {
  const { user } = useAuth();
  const { categories, maxPhotos, maxSizeMb } = useSettings();
  const showToast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [category, setCategory] = useState(presetCategory || '');

  useEffect(() => {
    if (presetCategory) setCategory(presetCategory);
  }, [presetCategory]);

  useEffect(() => {
    return () => photoPreviews.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFiles(fileList) {
    const input = document.getElementById('f-photo');
    const accepted = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (accepted.length === 0) {
      showToast('Please choose image files (PNG, JPG, etc.).', 'error');
      return;
    }
    const tooBig = accepted.filter((f) => f.size > maxSizeMb * 1024 * 1024);
    if (tooBig.length > 0) {
      showToast(`Each photo must be ${maxSizeMb}MB or smaller.`, 'error');
      return;
    }
    const limited = accepted.slice(0, maxPhotos);
    const dt = new DataTransfer();
    limited.forEach((f) => dt.items.add(f));
    if (input) input.files = dt.files;
    photoPreviews.forEach((u) => URL.revokeObjectURL(u));
    setPhotoPreviews(limited.map((f) => URL.createObjectURL(f)));
  }

  function handlePhotoPick(e) {
    applyFiles(e.target.files ?? []);
  }

  function handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    applyFiles(e.dataTransfer?.files ?? []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const title = form['f-title'].value.trim();
    const desc = form['f-desc'].value.trim();
    const location = form['f-location'].value.trim();

    if (!title || !category || !desc || !location) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData(form);
      fd.set('title', title);
      fd.set('category', category);
      fd.set('description', desc);
      fd.set('location', location);
      fd.append('reporter_name', form['f-name'].value.trim() || user?.name || 'Anonymous');
      const contact = form['f-phone'].value.trim();
      const hiddenEmail = form['f-email'].value.trim();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        fd.append('reporter_phone', '');
        fd.append('reporter_email', contact);
      } else {
        fd.append('reporter_phone', contact);
        fd.append('reporter_email', hiddenEmail);
      }

      const photoInput = document.getElementById('f-photo');
      if (photoInput && photoInput.files.length > 0) {
        for (const file of photoInput.files) {
          fd.append('photos[]', file);
        }
      }

      const data = await apiFetch('reports/create.php', {
        method: 'POST',
        body: fd,
      });

      setPhotoPreviews([]);
      form.reset();
      if (onSuccess && data.ref_id) {
        onSuccess(data.ref_id);
      } else {
        showToast('Report submitted! Reference ID: ' + (data.ref_id || ''));
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit report.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-xl text-sm bg-white text-navy-950 focus:outline-none focus:ring-2 focus:ring-xevera-600/30 focus:border-xevera-600 placeholder:text-[#9CA3AF]';
  const labelCls = 'block text-xs font-bold mb-1.5 text-navy-950';

  return (
    <form id="report-form" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls} htmlFor="f-title">Issue Title <span className="text-red-600">*</span></label>
          <input type="text" name="f-title" id="f-title" placeholder="e.g. Water Leak" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-category">Category <span className="text-red-600">*</span></label>
          <select name="f-category" id="f-category" required value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="" disabled>Select a category</option>
            {groupedCategories(categories).map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
            {category && !groupedCategories(categories).flatMap((g) => g.items).includes(category) && (
              <option value={category}>{category}</option>
            )}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className={labelCls} htmlFor="f-desc">Description <span className="text-red-600">*</span></label>
        <textarea name="f-desc" id="f-desc" placeholder="Provide more details about the issue..." required
          className={inputCls + ' resize-y min-h-[110px]'}></textarea>
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold text-navy-950" htmlFor="f-location">Location <span className="text-red-600">*</span></label>
        <input type="text" name="f-location" id="f-location" placeholder="Street, landmark, or purok" required className={inputCls + ' mt-1.5'} />
      </div>

      <div className="mb-4">
        <label className={labelCls}>Photo Upload <span className="text-xs text-[#9CA3AF] font-normal">(Optional)</span></label>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photos"
          onClick={() => document.getElementById('f-photo').click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('f-photo').click(); } }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handlePhotoDrop}
          className={`border-2 border-dashed rounded-2xl py-7 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-xevera-600 bg-xevera-50 text-xevera-600' : 'border-[#C7DDF8] text-[#64748B] hover:border-xevera-600 hover:text-xevera-600 bg-xevera-50'
          }`}>
          <Icon name="camera" size={34} strokeWidth={1.5} className="mx-auto mb-2 opacity-80" />
          <div className="text-xs font-bold">Drag &amp; drop files here</div>
          <div className="text-[10px] font-normal mt-0.5">or click to browse — PNG, JPG up to {maxSizeMb}MB (max {maxPhotos})</div>
        </div>
        <input type="file" id="f-photo" name="photos[]" accept="image/*" multiple className="hidden" onChange={handlePhotoPick} />
        {photoPreviews.length > 0 && (
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {photoPreviews.map((url, i) => (
              <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-16 h-16 rounded-xl object-cover border border-[#E5E7EB]" />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls} htmlFor="f-name">Name <span className="text-xs text-[#9CA3AF] font-normal">(Optional)</span></label>
          <input type="text" name="f-name" id="f-name" placeholder="Your full name" defaultValue={user?.name || ''} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-phone">Phone or Email <span className="text-xs text-[#9CA3AF] font-normal">(Optional)</span></label>
          <input type="text" name="f-phone" id="f-phone" placeholder="09XX XXX XXXX or email address" className={inputCls}
            onChange={(e) => { e.target.value = cleanPhoneOrEmail(e.target.value); }}
            onBlur={(e) => { e.target.value = normalizePhoneOrEmail(e.target.value); }} />
        </div>
      </div>
      <input type="hidden" name="f-email" id="f-email" defaultValue={user?.email || ''} />

      <p className="text-xs text-[#9CA3AF] mb-4">Your contact details are only used for updates about this report.</p>

      <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
        <input type="checkbox" name="f-agree" id="f-agree" required className="mt-0.5 w-4 h-4 rounded border-[#D1D5DB] accent-xevera-600 flex-shrink-0" />
        <span className="text-[12px] text-[#4B5876] leading-relaxed">
          I agree that my report details may be processed to resolve this issue, in line with the{' '}
          <button type="button" onClick={() => onNavigate && onNavigate('privacy')} className="font-bold text-xevera-600 hover:text-xevera-700 bg-none border-none cursor-pointer p-0">Privacy Policy</button>
          {' '}and{' '}
          <button type="button" onClick={() => onNavigate && onNavigate('terms')} className="font-bold text-xevera-600 hover:text-xevera-700 bg-none border-none cursor-pointer p-0">Terms of Service</button>.
        </span>
      </label>

      <button type="submit" disabled={submitting}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-xevera-600 to-xevera-700 text-white font-bold text-sm hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-[0_8px_20px_rgba(18,88,232,0.30)]">
        {submitting ? 'Submitting...' : submitLabel}
      </button>
      <p className="text-xs text-[#9CA3AF] text-center mt-3">We respect your privacy.</p>
    </form>
  );
}