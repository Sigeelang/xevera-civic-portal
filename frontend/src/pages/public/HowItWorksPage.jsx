import { useRef } from 'react';
import Icon from '../../components/Icon';
import CivicIllustration from '../../components/public/CivicIllustration';
import SectionHeader from '../../components/public/SectionHeader';
import ServiceBanner from '../../components/public/ServiceBanner';

const STEPS = [
  { n: '01', title: 'Submit', icon: 'clipboard', desc: 'Submit a report with details, location, and photos if available.' },
  { n: '02', title: 'Verify', icon: 'search', desc: 'Our admin reviews and verifies the legitimacy of your report.' },
  { n: '03', title: 'Assign', icon: 'users', desc: 'The report is assigned to the appropriate staff or department.' },
  { n: '04', title: 'In Progress', icon: 'wrench', desc: 'Our team works on resolving the reported issue.' },
  { n: '05', title: 'Resolved', icon: 'check', desc: 'The issue is fixed and the resolution is documented.' },
  { n: '06', title: 'Closed', icon: 'flag', desc: 'The report is reviewed and officially closed with full history.' },
];

const STEP_COLORS = [
  { bg: 'bg-xevera-600', chip: 'bg-xevera-50 text-xevera-700' },
  { bg: 'bg-[#7C3AED]', chip: 'bg-[#F5F3FF] text-[#7C3AED]' },
  { bg: 'bg-[#1EA85B]', chip: 'bg-[#E4F6EC] text-success-dark' },
  { bg: 'bg-[#F86038]', chip: 'bg-[#FEE8E2] text-[#C2410C]' },
  { bg: 'bg-xevera-700', chip: 'bg-xevera-50 text-xevera-700' },
  { bg: 'bg-[#0B3AAB]', chip: 'bg-xevera-50 text-xevera-800' },
];

const REASONS = [
  { title: 'Improves Our Community', icon: 'home', desc: 'Every report helps us identify and fix issues that affect everyday life in Xevera.' },
  { title: 'Promotes Transparency', icon: 'eye', desc: 'Reports are processed through a clear, documented workflow open to everyone.' },
  { title: 'Encourages Accountability', icon: 'thumbsup', desc: 'Your report holds the community and local team accountable for real action.' },
  { title: 'Builds a Better Xevera', icon: 'tree', desc: 'Working together, we create a cleaner, safer, and stronger neighborhood.' },
];

export default function HowItWorksPage({ onNavigate }) {
  const stepsRef = useRef(null);

  function scrollToSteps() {
    stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <ServiceBanner
        eyebrow="HOW XEVERA WORKS"
        title="How It Works"
        description="Learn how to submit a report, track its progress, and stay informed throughout the resolution process."
        badgeText="How It Works"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
        {/* ===== Process steps ===== */}
        <section ref={stepsRef} className="relative scroll-mt-24 mb-14">
          <SectionHeader eyebrow="The Process" title="From Report to Resolution" subtitle="Every report follows the same clear path so you always know where things stand." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="h-full bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(16,24,40,0.05)] p-6 hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(16,24,40,0.12)] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className={`w-11 h-11 rounded-full ${STEP_COLORS[i].bg} text-white flex items-center justify-center shadow-md`}>
                      <Icon name={s.icon} size={20} strokeWidth={2} />
                    </span>
                    <span className="text-[24px] font-head font-extrabold text-[#D5E1F7]">{s.n}</span>
                  </div>
                  <h3 className="text-[16px] font-extrabold text-navy-950 mt-4">{s.title}</h3>
                  <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className="hidden lg:flex absolute top-1/2 -right-[18px] -translate-y-1/2 z-10 text-xevera-600"
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-[rgba(18,88,232,0.18)] px-4 py-2 text-[12px] font-bold text-xevera-600 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-success" />
              No account required to get started
            </span>
          </div>
        </section>

        {/* ===== Why Your Report Matters ===== */}
        <section className="relative mb-14">
          <SectionHeader eyebrow="Why It Matters" title="Why Your Report Matters" subtitle="Your voice helps drive real change in the community." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {REASONS.map((r) => (
              <div key={r.title} className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(16,24,40,0.05)] p-6 text-center hover:-translate-y-1.5 hover:shadow-[0_18px_40px_rgba(16,24,40,0.12)] transition-all duration-300">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-xevera-600 to-xevera-900 text-white flex items-center justify-center shadow-[0_8px_16px_rgba(18,88,232,0.30)]">
                  <Icon name={r.icon} size={22} strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-extrabold text-navy-950 mt-4">{r.title}</h3>
                <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}