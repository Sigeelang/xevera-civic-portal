import { uploadUrl } from '../services/api';

const CATEGORY_INFO = {
  'Waste': { icon: '\u{1F5D1}\uFE0F', bg: 'bg-xevera-50', text: 'text-xevera-700', label: 'Waste' },
  'Garbage': { icon: '\u{1F5D1}\uFE0F', bg: 'bg-xevera-50', text: 'text-xevera-700', label: 'Garbage' },
  'Water': { icon: '\u{1F4A7}', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', label: 'Water' },
  'Water Leak': { icon: '\u{1F4A7}', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', label: 'Leak' },
  'Road & Infrastructure': { icon: '\u{1F6E3}\uFE0F', bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', label: 'Road' },
  'Road': { icon: '\u{1F6E3}\uFE0F', bg: 'bg-[#FEE2E2]', text: 'text-[#B91C1C]', label: 'Road' },
  'Flood': { icon: '\u{1F30A}', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', label: 'Flood' },
  'Drainage': { icon: '\u{1F30A}', bg: 'bg-[#DBEAFE]', text: 'text-[#1D4ED8]', label: 'Drainage' },
  'Electrical': { icon: '\u{1F4A1}', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', label: 'Electrical' },
  'Streetlight': { icon: '\u{1F4A1}', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', label: 'Light' },
  'Public Safety': { icon: '\u{1F6E1}\uFE0F', bg: 'bg-[#EDE9FE]', text: 'text-[#6D28D9]', label: 'Safety' },
  'Illegal Parking': { icon: '\u{1F697}', bg: 'bg-[#EDE9FE]', text: 'text-[#6D28D9]', label: 'Parking' },
  'Noise': { icon: '\u{1F50A}', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', label: 'Noise' },
  'Trees': { icon: '\u{1F333}', bg: 'bg-xevera-50', text: 'text-xevera-700', label: 'Trees' },
  'Others': { icon: '\u{1F4CB}', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', label: 'Other' },
};

const CATEGORY_FALLBACK = { icon: '\u{1F4CB}', bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', label: 'Report' };

export function statusBadgeClass(s) {
  if (s === 'Pending') return 'bg-[#FEF3C7] text-[#B45309]';
  if (s === 'In Progress' || s === 'Claimed') return 'bg-[#DBEAFE] text-[#1D4ED8]';
  if (s === 'Resolved') return 'bg-xevera-50 text-xevera-700';
  if (s === 'Closed') return 'bg-[#E4F6EC] text-success-dark';
  if (s === 'Rejected') return 'bg-[#FEE2E2] text-[#B91C1C]';
  return 'bg-[#F3F4F6] text-[#6B7280]';
}

export function publicStatusLabel(s) {
  return s === 'Claimed' ? 'In Progress' : s;
}

export function statusDotClass(s) {
  if (s === 'Pending') return 'bg-[#F59E0B]';
  if (s === 'In Progress' || s === 'Claimed') return 'bg-[#3B82F6]';
  if (s === 'Resolved') return 'bg-xevera-700';
  if (s === 'Closed') return 'bg-success';
  if (s === 'Rejected') return 'bg-[#EF4444]';
  return 'bg-[#9CA3AF]';
}

function PriorityTag({ priority }) {
  if (priority === 'Urgent') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#DC2626] text-white shadow-sm">{'\u26A0\uFE0F'} Urgent</span>;
  }
  if (priority === 'High') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F59E0B] text-white shadow-sm">{'\u2691'} High</span>;
  }
  return null;
}

export default function ReportCard({ report, onClick }) {
  const info = CATEGORY_INFO[report.category] || CATEGORY_FALLBACK;
  const firstPhoto = report.photos?.[0] || null;
  return (
    <div
      className="group bg-white rounded-[18px] border border-[#E5E7EB] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(16,24,40,0.10)] shadow-[0_1px_3px_rgba(16,24,40,0.06),0_4px_12px_rgba(16,24,40,0.06)]"
      onClick={onClick}
    >
      <div className={`h-[150px] flex items-center justify-center relative overflow-hidden ${firstPhoto ? '' : info.bg}`}>
        {firstPhoto ? (
          <>
            <img src={uploadUrl(firstPhoto)} alt={report.title} className="w-full h-full object-cover absolute inset-0 transition-transform duration-300 group-hover:scale-105" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        ) : (
          <span className={`text-5xl ${info.text}`}>{info.icon}</span>
        )}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap shadow-sm backdrop-blur-sm bg-white/95 ${statusBadgeClass(report.status)}">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(report.status)}`} />
          {publicStatusLabel(report.status)}
        </div>
        <div className="absolute top-2.5 left-2.5">
          <PriorityTag priority={report.priority} />
        </div>
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-white/95 text-[#111827] shadow-sm">
          <span className={info.text}>{info.icon}</span>
          {info.label}
        </span>
      </div>
      <div className="px-4 py-3.5">
        <h4 className="text-[15px] font-extrabold mb-1.5 text-[#111827] line-clamp-2">{report.title}</h4>
        <div className="text-xs text-[#6B7280] space-y-0.5">
          <div className="flex items-center gap-1.5 truncate">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            <span className="truncate">{report.location}</span>
          </div>
          <span>{report.date}</span>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3.5 text-xs text-[#6B7280]">
        <span className="px-2 py-1 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] flex items-center gap-1">{'\uD83D\uDC4D'} {report.likes}</span>
        <span className="px-2 py-1 rounded-md bg-[#F9FAFB] border border-[#E5E7EB] flex items-center gap-1">{'\uD83D\uDCAC'} {report.comments}</span>
      </div>
    </div>
  );
}
