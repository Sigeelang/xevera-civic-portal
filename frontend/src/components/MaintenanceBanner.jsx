import { useSettings } from '../context/SettingsContext';

export default function MaintenanceBanner({ siteName = 'Xevera Portal', onManage, height = { desktop: 360, tablet: 320, mobile: 240 } }) {
  const { maintenanceScheduledAt } = useSettings();

  let schedule = '';
  if (maintenanceScheduledAt) {
    const d = new Date(maintenanceScheduledAt);
    if (!isNaN(d.getTime())) {
      schedule = 'Estimated completion: ' + d.toLocaleString();
    }
  }

  return (
    <div className="bg-[#E8F7EA] border-b border-[#CDEFD2] py-2.5 flex items-center gap-3 flex-wrap min-h-[240px] md:min-h-[320px] lg:min-h-[360px]" style={{ minHeight: `${height.desktop}px` }}>
      <span className="w-2.5 h-2.5 rounded-full bg-[#35B95F] animate-pulse flex-shrink-0" />
      <div className="text-[13px] text-[#0B6B35] flex-1 min-w-[200px]">
        <span className="font-bold">Scheduled maintenance in progress</span>
        {' '}
        <span className="text-[#4A6B4A]/90">— the {siteName} portal is being updated. Some services may be briefly unavailable.</span>
        {schedule && (
          <span className="block mt-0.5 text-[12px] font-semibold text-[#159447]">{schedule}</span>
        )}
      </div>
      {onManage && (
        <button
          onClick={onManage}
          className="bg-none border border-[#35B95F]/40 text-[#159447] hover:bg-[#CDEFD2] text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
        >
          Manage
        </button>
      )}
    </div>
  );
}