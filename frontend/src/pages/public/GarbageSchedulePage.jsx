import InfoPage from '../../components/public/InfoPage';
import CivicIllustration from '../../components/public/CivicIllustration';

const SCHEDULE = [
  { icon: '\uD83D\uDCE6', label: 'Tuesday', value: 'BIODEGRADABLE & RESIDUAL - 6:00 AM - 9:00 AM' },
  { icon: '\uD83D\uDCE6', label: 'Friday', value: 'RECYCLABLES & NON-BIODEGRADABLE - 6:00 AM - 9:00 AM' },
  { icon: '\uD83E\uDDF0', label: 'Bulky / Special', value: 'Call the barangay in advance to schedule a pick-up.' },
];

const SECTIONS = [
  {
    icon: '\uD83D\uDCC5',
    title: 'Collection Schedule',
    desc: 'Place waste at your designated pick-up point by 6:00 AM so our collectors can service the area.',
    items: SCHEDULE,
  },
  {
    icon: '\uD83D\uDCA1',
    title: 'How to sort your waste',
    desc: 'Separating waste correctly keeps our community clean and supports recycling.',
    steps: [
      { title: 'Biodegradables', desc: 'Kitchen and yard waste: food scraps, leaves, fruit peelings.' },
      { title: 'Recyclables', desc: 'Paper, cardboard, plastics (PET/PP), glass, and tin cans. Rinse and flatten.' },
      { title: 'Non-biodegradables', desc: 'Styrofoam, sachets, and mixed packaging that cannot be recycled.' },
      { title: 'Residual / special waste', desc: 'Batteries, bulbs, and hazardous items. Hand these to a designated collector.' },
    ],
  },
  {
    icon: '\uD83D\uDEAA',
    title: 'Missed a collection?',
    desc: 'If your waste was not collected, keep it on-site and report it through the portal or contact the barangay office so the team can follow up.',
  },
];

export default function GarbageSchedulePage() {
  return (
    <InfoPage
      eyebrow="Local services"
      title="Garbage Collection Schedule"
      icon={'\uD83D\uDCE6'}
      subtitle="Collection days and waste-sorting guide for the Xevera community."
      accent="#F59E0B"
      illustration={<CivicIllustration variant="garbage" />}
      sections={SECTIONS}
    />
  );
}