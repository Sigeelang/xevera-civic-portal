import { useState, useEffect } from 'react';

export default function ResidentErrorBoundary({ children, onNavigate }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      // Ignore resource errors (broken images etc.): they carry no Error
      // object. Only real JS exceptions trip the fallback UI.
      const err = e && e.error;
      if (!err || typeof err.message !== 'string') return;
      setError(err);
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', handler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', handler);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F7F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[24px] border border-[#DFE6EF] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-head font-extrabold text-[#111827] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#6B7280] mb-6">The Resident Portal encountered an unexpected error. You can try returning to the dashboard or reload the page.</p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => { setError(null); onNavigate && onNavigate('resident-dashboard'); }}
              className="px-5 py-2.5 rounded-xl bg-xevera-600 text-white text-sm font-bold hover:bg-xevera-700 transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl border border-[#DFE6EF] text-sm font-bold text-[#374151] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
