import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import Icon from '../../components/Icon';
import CivicIllustration from '../../components/public/CivicIllustration';
import SectionHeader from '../../components/public/SectionHeader';
import ServiceBanner from '../../components/public/ServiceBanner';

const VALUES = [
  { icon: 'eye', title: 'Transparency' },
  { icon: 'shield', title: 'Accountability' },
  { icon: 'users', title: 'Community Participation' },
  { icon: 'home', title: 'Ownership' },
  { icon: 'star', title: 'Integrity' },
];

const HELP_ITEMS = [
  { icon: 'search', title: 'Track Updates', desc: 'Follow every report through a transparent status timeline to resolution.' },
  { icon: 'bell', title: 'Stay Informed', desc: 'Get announcements, maintenance windows, and community updates in one place.' },
  { icon: 'users', title: 'Work Together', desc: 'Residents and the local team, building a cleaner and safer Xevera as one.' },
];

const BENEFITS = [
  { icon: 'clock', title: 'Faster Response', desc: 'Digital submissions reach our team instantly, cutting down wait times.' },
  { icon: 'search', title: 'Full Transparency', desc: 'Track every report through a public, documented status timeline.' },
  { icon: 'users', title: 'Community Voice', desc: 'Every report counts toward a cleaner, safer, and stronger Xevera.' },
  { icon: 'check', title: 'Accountability', desc: 'Staff are assigned to each issue with clear ownership and results.' },
];

export default function AboutPage({ onNavigate }) {
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiFetch('settings/get.php')
      .then(setSettings)
      .catch(() => {});
    apiFetch('reports/stats.php')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const name = settings?.site_name || 'Xevera Civic Platform';

  return (
    <>
      <ServiceBanner
        eyebrow="ABOUT XEVERA"
        title="About Us"
        description="Learn more about the Xevera Civic Portal and our commitment to building a better, safer, and more connected community."
        badgeText="About Xevera"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />

      {/* Civic Reporting stats removed from public About Us - D:\GAMES\backup (9)\frontend */}

      {/* ===== Mission / Vision / Values ===== */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-xevera-50 text-xevera-600 flex items-center justify-center">
                <Icon name="flag" size={20} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[19px] font-head font-extrabold text-navy-950">Our Mission</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-xevera-600">What we stand for</span>
              </div>
            </div>
            <p className="text-sm sm:text-[15px] text-[#4B5876] leading-relaxed">
              {name} lets residents flag environmental and civic issues in their neighborhood — waste, water leaks,
              potholes, and more — and track how the local government responds, with no account required. Every report
              is reviewed, assigned, and followed through so that Xevera grows cleaner, safer, and stronger together.
            </p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-[#EFEAFE] text-purple flex items-center justify-center">
                <Icon name="eye" size={20} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[19px] font-head font-extrabold text-navy-950">Our Vision</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-purple">What we aspire to</span>
              </div>
            </div>
            <p className="text-sm sm:text-[15px] text-[#4B5876] leading-relaxed">
              A Xevera where every resident is empowered to shape their community — where reporting an issue is simple,
              transparent, and produces real results. We envision a digital-first community built on trust, accountability,
              and shared responsibility for the place we call home.
            </p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-[#E4F6EC] text-success-dark flex items-center justify-center">
                <Icon name="heart" size={20} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[19px] font-head font-extrabold text-navy-950">Our Values</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-success-dark">How we work</span>
              </div>
            </div>
            <ul className="space-y-2.5">
              {VALUES.map((v) => (
                <li key={v.title} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-xevera-50 text-xevera-600 flex items-center justify-center flex-shrink-0">
                    <Icon name={v.icon} size={14} strokeWidth={2} />
                  </span>
                  <span className="text-[13.5px] font-bold text-navy-950">{v.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== Our Story + Quote ===== */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-stretch">
          <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(10,26,69,0.06)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl bg-[#FEE8E2] text-[#F86038] flex items-center justify-center">
                <Icon name="book" size={20} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[19px] font-head font-extrabold text-navy-950">Our Story</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#F86038]">How it began</span>
              </div>
            </div>
            <p className="text-sm sm:text-[15px] text-[#4B5876] leading-relaxed">
              Xevera started with a simple question: how can residents and the local team work better together? Traditional
              ways of reporting issues were slow and hard to follow up on, leaving residents unsure whether anything would
              be done. We built this platform to answer that — a single digital space where anyone can report an issue,
              watch it move through a transparent workflow, and see it through to a resolution.
            </p>
            <p className="text-sm sm:text-[15px] text-[#4B5876] leading-relaxed mt-4">
              Today, {name} is the community's bridge to its own improvement — powered by every report submitted, every
              issue resolved, and every resident who takes part.
            </p>
          </div>

          <div className="rounded-[20px] border border-[rgba(18,88,232,0.14)] bg-[linear-gradient(150deg,#F4F9FF_0%,#E6F0FD_100%)] p-6 sm:p-8 flex flex-col justify-center shadow-[0_8px_24px_rgba(10,26,69,0.06)]">
            <Icon name="chat" size={30} strokeWidth={1.6} className="text-xevera-400 mb-4" />
            <blockquote className="text-[16px] sm:text-[18px] font-head font-bold text-navy-950 leading-relaxed">
              &ldquo;A small act today can make a big difference tomorrow.&rdquo;
            </blockquote>
            <div className="mt-5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-xevera-600 to-xevera-900 text-white flex items-center justify-center">
                <Icon name="users" size={18} strokeWidth={2} />
              </span>
              <div>
                <div className="text-[13px] font-extrabold text-navy-950">The Xevera Team</div>
                <div className="text-[11.5px] font-semibold text-[#64748B]">Community Civic Desk</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== What We Help With ===== */}
      <section className="bg-white border-t border-[#E5E7EB] py-14">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <SectionHeader eyebrow="What We Help With" title="What We Help With" subtitle="Four simple ways the portal works for you and the community." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HELP_ITEMS.map((h) => (
              <button key={h.title} onClick={() => onNavigate && onNavigate(h.title === 'Report Issues' ? 'submit' : h.title === 'Track Updates' ? 'reports' : h.title === 'Stay Informed' ? 'announcements' : 'about')}
                className="group text-left bg-[#F8FAFF] rounded-[18px] border border-[#E5E7EB] p-5 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(16,24,40,0.10)] transition-all duration-300 cursor-pointer">
                <div className="w-11 h-11 rounded-xl bg-white border border-[#E5E7EB] text-xevera-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Icon name={h.icon} size={20} strokeWidth={2} />
                </div>
                <div className="text-[14.5px] font-extrabold text-navy-950 mt-3">{h.title}</div>
                <div className="text-[12.5px] text-[#64748B] mt-1 leading-relaxed">{h.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How It Benefits You ===== */}
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 py-14">
        <SectionHeader eyebrow="Why It Works" title="How It Benefits You" subtitle="The platform is built around the people it serves." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {BENEFITS.map((b) => (
            <div key={b.title} className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_8px_24px_rgba(16,24,40,0.05)] p-6 text-center hover:-translate-y-1.5 hover:shadow-[0_14px_32px_rgba(16,24,40,0.12)] transition-all duration-300">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-xevera-600 to-xevera-900 text-white flex items-center justify-center shadow-[0_8px_16px_rgba(18,88,232,0.30)]">
                <Icon name={b.icon} size={22} strokeWidth={2} />
              </div>
              <h3 className="text-[15px] font-extrabold text-navy-950 mt-4">{b.title}</h3>
              <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}