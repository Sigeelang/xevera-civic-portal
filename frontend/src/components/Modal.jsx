import { useEffect, useRef, useCallback } from 'react';

export default function Modal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  hideActions = false,
  confirmDisabled = false,
  size = 'md',
}) {
  const dialogRef = useRef(null);

  const close = useCallback(() => {
    if (onCancel) onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open && dialogRef.current) dialogRef.current.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_180ms_ease]">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-[0_24px_60px_rgba(10,26,69,0.25)] w-full p-6 sm:p-7 outline-none animate-[modalRise_220ms_ease] max-h-[90vh] overflow-y-auto ${
          size === 'lg' ? 'max-w-[760px]' : 'max-w-[420px]'
        }`}
      >
        <div className={`flex flex-col ${size === 'lg' ? 'items-start text-left' : 'items-center text-center'}`}>
          {size !== 'lg' && (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                danger ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-xevera-50 text-xevera-600'
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {danger ? (
                  <>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                  </>
                )}
              </svg>
            </div>
          )}
          {title && (
            <h2 id="modal-title" className="text-[18px] font-head font-extrabold text-navy-950 leading-tight">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-[13.5px] text-[#4B5876] mt-1.5 leading-relaxed">{description}</p>
          )}
          {children && <div className="w-full mt-4 text-left">{children}</div>}
        </div>

        {!hideActions && (
          <div className="flex gap-2.5 mt-5">
            <button
              type="button"
              onClick={close}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm || close}
              disabled={confirmDisabled}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                danger
                  ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                  : 'bg-xevera-600 hover:bg-xevera-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}