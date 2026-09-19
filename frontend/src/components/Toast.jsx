import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const lastMsgRef = useRef('');
  const lastTimeRef = useRef(0);

  const showToast = useCallback((msg, type = 'success', opts = {}) => {
    const now = Date.now();
    const { dedupe = true, priority = 0 } = opts;
    // Deduplicate identical messages within 4 seconds (unless higher priority)
    if (dedupe && msg === lastMsgRef.current && now - lastTimeRef.current < 4000 && priority <= 0) {
      return;
    }
    // Higher-priority action confirmations can overwrite background toasts
    if (priority <= 0 && toast && now - (toast._time || 0) < 1500) {
      // Don't overwrite a very recent action confirmation with a background notification
      return;
    }
    lastMsgRef.current = msg;
    lastTimeRef.current = now;
    setToast({ msg, type, _time: now, _priority: priority });
  }, [toast]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div className={`fixed top-15 right-5 z-999 px-5 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg max-w-96 animate-[slidein_0.3s_ease] ${toast.type === 'success' ? 'bg-xevera-700' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
