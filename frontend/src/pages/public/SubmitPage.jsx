import Icon from '../../components/Icon';
import ReportForm from '../../components/report/ReportForm';
import GuestBanner from '../../components/public/GuestBanner';

const TIPS = [
  { icon: 'chat', title: 'Provide clear details about the issue', desc: 'Accurate descriptions help our team verify and act quickly.' },
  { icon: 'camera', title: 'Include photos if possible', desc: 'Photos help our team verify and prioritize the issue.' },
  { icon: 'pin', title: 'Specify the exact location', desc: 'Include the street name and lot/block so staff can find it fast.' },
  { icon: 'check', title: 'Check your information before submitting', desc: 'A complete, correct report is resolved faster.' },
];

export default function SubmitPage({ onNavigate, onSuccess, presetCategory }) {
  return (
    <div className="max-w-[1180px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] mb-4" aria-label="Breadcrumb">
        <button onClick={() => onNavigate && onNavigate('home')} className="hover:text-xevera-600 cursor-pointer bg-none border-none">Home</button>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        <span className="text-navy-950">Report an Issue</span>
      </nav>

      {/* Hero band */}
      <GuestBanner
        tone="blue"
        eyebrow="Report an Issue"
        title="Report an Issue"
        subtitle="Spotted a community problem? Report it here — no account required — and our team will take it from there."
        ctas={[{ label: '➤ Submit a Report', onClick: () => { document.getElementById('f-title')?.focus(); } }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Form */}
        <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6 sm:p-8">
          <ReportForm onSuccess={onSuccess} onNavigate={onNavigate} presetCategory={presetCategory} />
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-xevera-50 text-xevera-600 flex items-center justify-center">
                <Icon name="bulb" size={17} strokeWidth={2} />
              </span>
              <h3 className="text-[15px] font-head font-extrabold text-navy-950">Tips for a Good Report</h3>
            </div>
            <ul className="space-y-3.5">
              {TIPS.map((t) => (
                <li key={t.title} className="flex gap-3">
                  <span className="mt-0.5 w-7 h-7 rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
                    <Icon name={t.icon} size={14} strokeWidth={2} />
                  </span>
                  <div>
                    <div className="text-[13px] font-bold text-navy-950">{t.title}</div>
                    <div className="text-[12px] text-[#64748B] leading-relaxed mt-0.5">{t.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[20px] border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-[#1E40AF] flex items-center justify-center">
                <Icon name="chat" size={17} strokeWidth={2} />
              </span>
              <h3 className="text-[15px] font-head font-extrabold text-[#1E3A5F]">Need Help?</h3>
            </div>
            <p className="text-[12.5px] text-[#374151] leading-relaxed">
              Have questions or need assistance with your report? Our support team is here to help.
            </p>
            <button
              onClick={() => onNavigate && onNavigate('contact')}
              className="mt-4 w-full py-2.5 rounded-xl bg-[#1264f5] text-white text-[13px] font-bold hover:bg-[#0B4FCC] transition-colors cursor-pointer">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}