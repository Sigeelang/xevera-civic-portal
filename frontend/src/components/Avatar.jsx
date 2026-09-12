import { useState } from 'react';
import { uploadUrl } from '../services/api';

function initialsOf(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export default function Avatar({ name, photo, size = 36, className = '', online = null }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : uploadUrl(photo);

  const px = typeof size === 'number' ? `${size}px` : size;
  const fontPx = Math.max(8, Math.round((typeof size === 'number' ? size : 36) * 0.34));
  const dotSize = Math.max(8, Math.round((typeof size === 'number' ? size : 36) * 0.3));

  return (
    <span className={`relative inline-flex flex-shrink-0 ${className}`} style={{ width: px, height: px }}>
      <span
        aria-hidden="true"
        className="rounded-full overflow-hidden bg-gradient-to-br from-xevera-500 to-xevera-700 text-white flex items-center justify-center font-extrabold flex-shrink-0 ring-2 ring-white/60 select-none"
        style={{ width: px, height: px, fontSize: `${fontPx}px`, lineHeight: 1 }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          initialsOf(name)
        )}
      </span>
      {online !== null && (
        <span
          className={`absolute -bottom-px -right-px block rounded-full ring-2 ring-white ${online ? 'bg-[#20b86b]' : 'bg-[#AEB9C8]'}`}
          style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
        />
      )}
    </span>
  );
}
