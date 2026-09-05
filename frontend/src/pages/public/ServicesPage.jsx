import ServicesGrid from '../../components/public/ServicesGrid';
import CivicIllustration from '../../components/public/CivicIllustration';
import ServiceBanner from '../../components/public/ServiceBanner';

export default function ServicesPage({ onNavigate }) {
  return (
    <>
      <ServiceBanner
        eyebrow="COMMUNITY SERVICES"
        title="Services"
        description="Explore the services available to Xevera residents and learn how to access them."
        badgeText="Community Services"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
      <div className="mt-8 sm:mt-10 bg-white rounded-[22px] border border-[#E5E7EB] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_8px_24px_rgba(16,24,40,0.05)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-xevera-50 flex items-center justify-center text-xl">
            {'\uD83D\uDCAC'}
          </div>

          <div>
            <div className="font-bold text-[#10245B]">
              Need help with a community concern?
            </div>

            <div className="text-sm text-[#64748B]">
              Submit a civic report and let our team know.
            </div>
          </div>
        </div>

        <button
          onClick={() => onNavigate?.('submit')}
          className="px-5 py-2.5 rounded-xl bg-[#1261F5] text-white font-bold text-sm hover:bg-[#0d4fd6] transition"
        >
          Report an Issue
        </button>
      </div>
    </div>
    </>
  );}
