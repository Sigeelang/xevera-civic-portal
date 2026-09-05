import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import ServiceBanner from '../../components/public/ServiceBanner';
import ResidentPageHeader from '../../components/public/ResidentPageHeader';

const GROUPS = [
  {
    title: 'Emergency & Safety',
    icon: 'alerttriangle',
    iconBg: '#FFF0F1',
    iconColor: '#EF3E3E',
    titleColor: '#EF3E3E',
    phoneColor: '#EF3E3E',
    phoneBg: '#FFFAFA',
    phoneBorder: '#FFD0D0',
    items: [
      { name: 'PNP Bacolor', phones: ['0998-595-5452 / 0917-805-4164 / 0998-598-5451', '09985955452'] },
      { name: 'BFP Bacolor', phones: ['0923-103-8363 / (045) 436-1828', '09231038363'] },
      { name: 'Bacolor Municipal Health Office', phones: ['(045) 436-1418', '0454361418'] },
      { name: 'Rescue Ambulance', phones: ['0920-912-3456 / (045) 436-1991', '09209123456'] },
      { name: 'Disaster Risk Reduction Office', phones: ['(045) 436-2579', '0454362579'] },
    ],
  },
  {
    title: 'Xevera Community',
    icon: 'users',
    iconBg: '#EDF5FF',
    iconColor: '#1769FF',
    titleColor: '#1769FF',
    phoneColor: '#1769FF',
    phoneBg: '#F8FBFF',
    phoneBorder: '#CDDDF8',
    items: [
      { name: 'HOA Office', phones: ['0951-595-2696', '09515952696'] },
      { name: 'HOA Command Center', phones: ['0939-108-2760', '09391082760'] },
      { name: 'Xevera Guard House', phones: ['0927-123-4567', '09271234567'] },
      { name: 'Clubhouse', phones: ['(045) 436-2001', '0454362001'] },
      { name: 'Property Management Office', phones: ['(045) 436-2100', '0454362100'] },
    ],
  },
  {
    title: 'Utilities',
    icon: 'drop',
    iconBg: '#EDF9F3',
    iconColor: '#159957',
    titleColor: '#159957',
    phoneColor: '#159957',
    phoneBg: '#F7FDF9',
    phoneBorder: '#C5E9D8',
    items: [
      { name: 'Xevera Water', phones: ['0932-190-2508', '09321902508'] },
      { name: 'A.E.C', phones: ['(045) 888-2888', '0458882888'] },
      { name: 'Meralco', phones: ['0917-551-6211', '09175516211'] },
      { name: 'PLDT', phones: ['171', '171'] },
      { name: 'Garbage Collection', phones: ['(045) 436-2555', '0454362555'] },
    ],
  },
];

function telHref(num) {
  return `tel:${String(num || '').replace(/[^0-9+]/g, '')}`;
}

export default function ContactEmergencyPage() {
  const { user } = useAuth();
  const isResident = user?.role === 'Resident';
  return (
    <div className="bg-[#F5F7FB] min-h-screen">
      {isResident ? (
        <ResidentPageHeader
          title="Emergency Contacts"
          description="Important contact numbers you can reach in case of emergencies. Save these numbers for quick access when you need help."
        />
      ) : (
        <ServiceBanner
          eyebrow="Resident Community"
          title="Emergency Contacts"
          description="Important contact numbers you can reach in case of emergencies. Save these numbers for quick access when you need help."
          badgeText="Resident Community"
          badgeIcon
          image="/images/xevera-hero.jpeg"
          height={{ desktop: 360, tablet: 320, mobile: 240 }}
        />
      )}
      <div className={isResident ? 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-0 pb-8 sm:pb-10' : 'max-w-[1250px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10'}>
      {/* Contact grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
        {GROUPS.map((group) => (
          <article
            key={group.title}
            className="bg-white border border-[#DCE5F1] rounded-[18px] overflow-hidden shadow-[0_6px_18px_rgba(20,60,110,0.04)] hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(25,55,100,0.08)] transition-all"
          >
            <header
              className="px-6 py-5 flex items-center gap-4"
              style={{ borderBottom: '1px solid #EDF1F6' }}
            >
              <span
                className="w-[52px] h-[52px] rounded-[14px] grid place-items-center flex-shrink-0"
                style={{ background: group.iconBg, color: group.iconColor }}
              >
                <Icon name={group.icon} size={25} />
              </span>
              <h2
                className="text-[18px] font-extrabold tracking-[-0.01em]"
                style={{ color: group.titleColor }}
              >
                {group.title}
              </h2>
            </header>

            <div className="px-6 pb-3">
              {group.items.map((item) => (
                <a
                  key={item.name}
                  href={telHref(item.phones[1])}
                  className="min-h-[73px] py-4 flex items-center gap-3.5 border-b border-[#EDF1F6] last:border-b-0 group"
                >
                  <span
                    className="w-10 h-10 flex-shrink-0 rounded-full grid place-items-center border"
                    style={{
                      color: group.phoneColor,
                      borderColor: group.phoneBorder,
                      background: group.phoneBg,
                    }}
                  >
                    <Icon name="phonecall" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-[#142F59] mb-1">
                      {item.name}
                    </div>
                    <div className="text-[12px] leading-[1.45] text-[#687B99] group-hover:text-[#1769FF] transition-colors break-words">
                      {item.phones[0]}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* Notice */}
      <section className="mt-6 min-h-[90px] px-6 py-5 flex items-center gap-5 bg-white border border-[#DCE5F1] rounded-[18px] shadow-[0_6px_18px_rgba(20,60,110,0.04)]">
        <span className="w-12 h-12 flex-shrink-0 rounded-[14px] grid place-items-center bg-[#EDF5FF] text-[#1769FF] text-[22px] font-extrabold">
          <Icon name="shield" size={22} />
        </span>
        <p className="text-[14px] leading-[1.65] text-[#344C70]">
          For life-threatening emergencies, please call{' '}
          <a href="tel:911" className="text-[#1769FF] font-extrabold hover:underline">
            911
          </a>{' '}
          immediately. Your safety is our priority.
        </p>
      </section>
      </div>
    </div>
  );
}
