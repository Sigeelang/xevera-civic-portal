import InfoPage from '../../components/public/InfoPage';
import ServiceBanner from '../../components/public/ServiceBanner';

export function FaqPage() {
  return (
    <>
      <ServiceBanner
        eyebrow="COMMUNITY FAQ & HELP"
        title="FAQs"
        description="Quick answers to the most common questions about the Xevera Civic Portal."
        badgeText="COMMUNITY FAQ & HELP"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <InfoPage
        fullWidth
        sections={[
        {
          title: 'Getting Started',
          icon: '🚀',
          desc: 'Everything you need to start reporting issues today.',
          steps: [
            { title: 'Do I need an account to report an issue?', desc: 'No. Anyone can submit a report — no registration required. An account is only needed to comment, follow up, and receive personal notifications.' },
            { title: 'How do I track my report?', desc: 'Open Track Report and search by title, location, or the reference ID (e.g. XR-2026-001001) given to you after submission.' },
            { title: 'Can I submit photos?', desc: 'Yes. The report form accepts image uploads (PNG, JPG) up to the configured size limit per photo.' },
          ],
        },
        {
          title: 'Reports & Statuses',
          icon: '📋',
          desc: 'How reports move through the system.',
          steps: [
            { title: 'What does each status mean?', desc: 'Submitted → Verified → Assigned → In Progress → Resolved → Closed. You can follow every step on the report\'s timeline.' },
            { title: 'How long does resolution take?', desc: 'It depends on the issue. The home page shows the current average days-to-resolve across the community.' },
            { title: 'My report was rejected — why?', desc: 'Reports may be rejected if they are duplicates, unclear, or outside the portal\'s scope. The reason is shown on the report detail page.' },
          ],
        },
        {
          title: 'Account & Access',
          icon: '🔐',
          desc: 'Login-related questions.',
          steps: [
            { title: 'I forgot my password.', desc: 'Use the Forgot Password link on the login page, or contact the administrators at the civic desk.' },
            { title: 'Who can access the staff portal?', desc: 'Staff, Admin, and Super Admin accounts are provisioned by the barangay administration.' },
          ],
        },
      ]}
      />
    </>
  );
}

export function GuidelinesPage() {
  return (
    <>
      <ServiceBanner
        eyebrow="REPORTING TIPS & GUIDANCE"
        title="Reporting Guidelines"
        description="How to submit effective reports that get resolved fast."
        badgeText="REPORTING TIPS & GUIDANCE"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <InfoPage
        fullWidth
        sections={[
        {
          title: 'Before You Report',
          icon: '✅',
          steps: [
            { title: 'Check for existing reports', desc: 'Search Track Report first — your issue may already be reported and in progress.' },
            { title: 'Make sure it is a civic issue', desc: 'The portal handles road damage, waste, drainage, streetlights, flooding, environment, and public safety concerns.' },
            { title: 'Emergencies go to authorities', desc: 'For immediate danger to life or property, call emergency services first — do not wait for a portal response.' },
          ],
        },
        {
          title: 'Writing a Good Report',
          icon: '✍️',
          steps: [
            { title: 'Give a clear, specific title', desc: 'e.g. "Pothole on Sunset Ave near the Phase 2 gate" instead of "road problem".' },
            { title: 'Describe the issue factually', desc: 'What, where, since when, and how it affects the community. Avoid personal remarks.' },
            { title: 'Pin the exact location', desc: 'Use street and lot/block — or the Use My Location button for GPS coordinates.' },
            { title: 'Attach photos', desc: 'Clear, well-lit photos help staff verify the issue without a site visit.' },
          ],
        },
        {
          title: 'After You Submit',
          icon: '📩',
          steps: [
            { title: 'Save your reference ID', desc: 'You will need it to track the report later.' },
            { title: 'Watch the status timeline', desc: 'Every action by staff is recorded and visible on the report detail page.' },
            { title: 'Be patient and constructive', desc: 'Reports are prioritized by urgency and available resources.' },
          ],
        },
      ]}
      />
    </>
  );
}

export function PrivacyPage() {
  return (
    <>
      <ServiceBanner
        eyebrow="YOUR PRIVACY & DATA"
        title="Privacy Policy"
        description="How the Xevera Civic Portal handles the information you share."
        badgeText="YOUR PRIVACY & DATA"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <InfoPage
        fullWidth
        sections={[
        {
          title: 'Information We Collect',
          icon: '📂',
          desc: 'Only what is needed to process your report.',
          items: [
            { icon: '📝', label: 'Report details', value: 'Category, description, location, and photos you submit' },
            { icon: '👤', label: 'Optional contact info', value: 'Name, phone, or email — only if you provide them' },
            { icon: '📊', label: 'Activity logs', value: 'Standard records kept for security and transparency' },
          ],
        },
        {
          title: 'How We Use It',
          icon: '⚙️',
          steps: [
            { title: 'To process and resolve your report', desc: 'Staff use the details to verify, assign, and fix the issue.' },
            { title: 'To update you', desc: 'If you leave contact details, we use them only for updates about your report.' },
            { title: 'To improve the community', desc: 'Aggregated, anonymous statistics guide local planning.' },
          ],
        },
        {
          title: 'What We Do Not Do',
          icon: '🚫',
          steps: [
            { title: 'We do not sell your data', desc: 'Your information is never sold or shared for marketing.' },
            { title: 'We do not make reports public with your identity', desc: 'Public listings show report content, not your personal contact details.' },
          ],
        },
        {
          title: 'Your Choices',
          icon: '🧭',
          steps: [
            { title: 'Report anonymously', desc: 'Contact fields are optional — you may submit without any personal details.' },
            { title: 'Request removal', desc: 'Contact the civic desk to request deletion of your personal data where legally possible.' },
          ],
        },
      ]}
      />
    </>
  );
}

export function TermsPage() {
  return (
    <>
      <ServiceBanner
        eyebrow="PORTAL TERMS & CONDITIONS"
        title="Terms of Service"
        description="The ground rules for using the Xevera Civic Portal."
        badgeText="PORTAL TERMS & CONDITIONS"
        badgeIcon
        image="/images/xevera-hero.jpeg"
        height={{ desktop: 360, tablet: 320, mobile: 240 }}
      />
      <InfoPage
        fullWidth
        sections={[
        {
          title: 'Using the Portal',
          icon: '🤝',
          steps: [
            { title: 'Report truthfully', desc: 'Submit only genuine issues you have observed. False or malicious reports may be removed.' },
            { title: 'Be respectful', desc: 'No profanity, harassment, personal attacks, or discriminatory content.' },
            { title: 'One report per issue', desc: 'Avoid duplicates — check Track Report before submitting.' },
          ],
        },
        {
          title: 'Content You Submit',
          icon: '🖼️',
          steps: [
            { title: 'You own your content', desc: 'You keep ownership of photos and text you submit.' },
            { title: 'You grant us a license', desc: 'By submitting, you allow the portal to display your report publicly for transparency purposes.' },
            { title: 'Do not upload sensitive material', desc: 'No private individuals\' identity documents, explicit content, or third-party copyrighted images.' },
          ],
        },
        {
          title: 'Limitations',
          icon: '⚠️',
          steps: [
            { title: 'Not an emergency service', desc: 'The portal is for non-urgent civic issues. Emergencies require direct contact with authorities.' },
            { title: 'No guarantee of resolution time', desc: 'Reports are prioritized by urgency and available resources.' },
            { title: 'Moderation rights', desc: 'Administrators may edit, reject, or remove reports that violate these terms.' },
          ],
        },
      ]}
      />
    </>
  );
}
