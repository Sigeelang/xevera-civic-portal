import InfoPage from '../../components/public/InfoPage';
import CivicIllustration from '../../components/public/CivicIllustration';

export default function DocumentsPage({ onNavigate }) {
  return (
    <InfoPage
      eyebrow="Community services"
      title="Request Documents"
      icon={'\uD83D\uDCCB'}
      subtitle="Request the common community certificates and forms you need."
      illustration={<CivicIllustration variant="documents" />}
      sections={[
        {
          icon: '\uD83D\uDCCB',
          title: 'Available documents',
          desc: 'The barangay can prepare the following documents for residents.',
          items: [
            { icon: '\uD83C\uDFE1', label: 'Barangay Certificate', value: 'Proof of residency' },
            { icon: '\uD83E\uDEA7', label: 'Clearance', value: 'Barangay clearance for permits & work' },
            { icon: '\uD83D\uDCC4', label: 'Business Permit Support', value: 'Certificate of no objection' },
            { icon: '\uD83D\uDDF9\uFE0F', label: 'First-time Job Seeker', value: 'Employment-related certificate' },
            { icon: '\uD83D\uDCDA', label: 'Indigency / Residency', value: 'For assistance programs' },
            { icon: '\uD83D\uDDC2\uFE0F', label: 'Official Letter / Form', value: 'Other requested documents' },
          ],
        },
        {
          icon: '\uD83D\uDCCB',
          title: 'How to request',
          desc: 'Requests are usually processed within 1-3 working days.',
          steps: [
            { title: 'Prepare your details', desc: 'Fill in the request with your full legal name and purpose.' },
            { title: 'Contact the barangay', desc: 'Send your request through the contact form or visit the barangay hall during office hours.' },
            { title: 'Pay the fee (if applicable)', desc: 'Small certification fees may apply. Confirm with the office.' },
            { title: 'Claim your document', desc: 'Pick up the signed document, or arrange a meeeting if mailing is supported.' },
          ],
          cta: { text: 'Contact the team to request a document', onClick: () => onNavigate && onNavigate('submit') },
        },
      ]}
    />
  );
}