import Icon from '../Icon';

export function StaffEmptyState({ title = 'Nothing here yet', description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] mb-3">
        <Icon name="file" size={22} strokeWidth={2} />
      </div>
      <div className="text-sm font-bold text-[#334155]">{title}</div>
      {description && <p className="text-[13px] text-[#64748B] mt-1 max-w-sm">{description}</p>}
      {action && (
        <button onClick={action}
          className="mt-4 px-4 py-2 rounded-lg bg-xevera-600 text-white text-xs font-bold hover:bg-xevera-700 transition-colors cursor-pointer">
          {actionLabel || 'Go'}
        </button>
      )}
    </div>
  );
}

export function StaffErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-[#DC2626] mb-3">
        <Icon name="wrench" size={22} strokeWidth={2} />
      </div>
      <div className="text-sm font-bold text-[#334155]">Unable to load</div>
      <p className="text-[13px] text-[#64748B] mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#334155] hover:bg-[#F8FAFC] transition-colors cursor-pointer">
          Try Again
        </button>
      )}
    </div>
  );
}