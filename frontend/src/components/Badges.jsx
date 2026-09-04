import { getReportStatusConfig } from '../utils/reportStatus';

export function StatusBadge({ status }) {
  const s = getReportStatusConfig(status);
  return (
    <span className={`status-badge ${s.cls}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
}

const PRIORITY_MAP = {
  Normal:  { cls: 'bg-[#E5E7EB] text-[#374151]', label: 'Normal' },
  High:    { cls: 'bg-[#FEF3C7] text-[#B45309]', label: 'High' },
  Urgent:  { cls: 'bg-[#FEE2E2] text-[#DC2626]', label: 'EMERGENCY' },
};

export function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] || PRIORITY_MAP.Normal;
  return (
    <span className={`status-badge ${p.cls} font-semibold`}>
      <span className="dot" />
      {p.label}
    </span>
  );
}