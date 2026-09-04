export const XEVERA = {
  brand: {
    blue: '#1258E8',
    blueHover: '#0E48D0',
    blueDark: '#0B3AAB',
    pale: '#D5E1F7',
    paleLight: '#EEF4FE',
    chip: '#C7DDF8',
  },
  navy: {
    text: '#0A1A45',
    deep: '#0A1A45',
    footer: '#001B45',
  },
  neutrals: {
    pageBg: '#F5F7FA',
    card: '#FFFFFF',
    border: '#E5E7EB',
    muted: '#64748B',
    faint: '#9CA3AF',
    heading: '#0A1A45',
    body: '#374151',
  },
  status: {
    success: '#1EA85B',
    successDark: '#15803D',
    successBg: '#E4F6EC',
    pending: '#F59E0B',
    pendingBg: '#FEF3C7',
    progress: '#1258E8',
    progressBg: '#DBEAFE',
    rejected: '#DC2626',
    rejectedBg: '#FEE2E2',
  },
  accent: {
    orange: '#F86038',
    orangeBg: '#FEE8E2',
    purple: '#8B5CF6',
    purpleBg: '#EFEAFE',
  },
  font: {
    head: 'Manrope, Inter, sans-serif',
    body: 'Inter, Manrope, sans-serif',
  },
};

export const REFS = {
  canvas: {
    home: { w: 708, h: 484 },
    report: { w: 662, h: 611 },
    track: { w: 668, h: 430 },
    howItWorks: { w: 756, h: 621 },
    about: { w: 705, h: 511 },
  },
  // Proportion fractions of the canvas occupied by major bands (from pixel scan)
  bands: {
    home: { header: 0.2, heroImageRight: true, footer: true },
    report: { header: 0.18, heroPaleBlue: true, form: true, footer: true },
    track: { footerBelowFold: true },
    howItWorks: { hero: true, footer: true },
    about: { gateImageCenter: true, footer: true },
  },
};