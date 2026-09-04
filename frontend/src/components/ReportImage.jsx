import { useState } from 'react';
import { uploadUrl } from '../services/api';

/**
 * Report photo thumbnail. Resolves backend-relative paths through the
 * /xevera-portal/uploads proxy and falls back to a neutral placeholder
 * (or custom children) if the image is missing/broken.
 */
export default function ReportImage({ src, alt = '', className = '', children }) {
  const [broken, setBroken] = useState(false);
  const resolved = broken ? null : uploadUrl(src);

  if (!resolved) {
    return (
      <span className={`w-full h-full grid place-items-center bg-[#F3F6FB] text-[#AAB3C5] ${className}`} aria-hidden="true">
        {children || (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-4-4-8 8" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
