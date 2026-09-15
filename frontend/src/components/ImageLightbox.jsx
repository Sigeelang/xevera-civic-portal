import { useEffect, useState, useCallback } from 'react';
import { uploadUrl } from '../services/api';

/*
 * In-page image lightbox.
 *
 * Renders a fullscreen overlay on the SAME page (no new browser tab) so the
 * user can page through a report's photos without losing their place.
 * Supports keyboard navigation (←/→/Esc), a zoom toggle, and an optional
 * "open original" link for anyone who still wants the raw image in a tab.
 *
 * Props:
 *   photos   array of backend-relative paths (resolved through uploadUrl)
 *   index    zero-based index of the photo to show (controlled)
 *   onClose  called when the overlay should close
 *   onIndex  called with the new zero-based index when navigating
 *   title    optional caption / alt text
 */
export default function ImageLightbox({ photos = [], index = 0, onClose, onIndex, title = '' }) {
  const [zoomed, setZoomed] = useState(false);
  const total = photos.length;
  const safeIndex = total ? Math.min(Math.max(0, index), total - 1) : 0;
  const current = total ? photos[safeIndex] : null;

  const go = useCallback((delta) => {
    if (total < 2 || !onIndex) return;
    setZoomed(false);
    onIndex((safeIndex + delta + total) % total);
  }, [total, onIndex, safeIndex]);

  useEffect(() => {
    setZoomed(false);
  }, [safeIndex]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, onClose, go]);

  if (!current) return null;

  const src = uploadUrl(current);

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col p-4 sm:p-6"
      style={{ background: 'rgba(7,19,40,0.9)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0 mb-3">
        <div className="min-w-0 text-white">
          {title && <div className="text-[13px] sm:text-[14px] font-bold truncate">{title}</div>}
          {total > 1 && (
            <div className="text-[11px] sm:text-[12px] text-white/70 mt-0.5">
              {safeIndex + 1} / {total}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="h-[38px] px-3.5 rounded-lg border border-white/25 bg-white/10 text-white text-[12px] font-bold cursor-pointer hover:bg-white/20 transition-colors"
          >
            {zoomed ? 'Fit' : 'Zoom in'}
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="h-[38px] px-3.5 rounded-lg border border-white/25 bg-white/10 text-white text-[12px] font-bold inline-flex items-center hover:bg-white/20 transition-colors no-underline"
          >
            Open original ↗
          </a>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close image viewer"
            className="w-[38px] h-[38px] rounded-lg border-0 bg-white text-[#102957] grid place-items-center cursor-pointer text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Stage */}
      <div
        className={`flex-1 min-h-0 flex items-center justify-center ${zoomed ? 'overflow-auto items-start' : 'overflow-hidden'}`}
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        <img
          src={src}
          alt={title || `Photo ${safeIndex + 1}`}
          onClick={() => setZoomed((z) => !z)}
          className={
            zoomed
              ? 'max-w-none w-auto h-auto cursor-zoom-out rounded-lg bg-white'
              : 'max-w-full max-h-full object-contain cursor-zoom-in rounded-lg'
          }
          style={zoomed ? { width: '160%', maxWidth: 'none' } : undefined}
        />
      </div>

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full border-0 bg-white/95 text-[#102957] grid place-items-center text-2xl leading-none cursor-pointer hover:bg-white transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-[46px] h-[46px] rounded-full border-0 bg-white/95 text-[#102957] grid place-items-center text-2xl leading-none cursor-pointer hover:bg-white transition-colors"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
