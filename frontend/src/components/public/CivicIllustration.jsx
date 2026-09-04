const C = {
  primary: '#1258E8',
  navy: '#0A1A45',
  deep: '#0B3AAB',
  blue600: '#2E6BF0',
  blue400: '#4E86F0',
  blue300: '#8FB4F2',
  blue200: '#B7CDF5',
  blue100: '#D5E1F7',
  sky: '#EAF3FF',
  white: '#FFFFFF',
  orange: '#F59E0B',
  green: '#1EA85B',
  red: '#DC2626',
  gray: '#94A3B8',
  grayLight: '#CBD5E1',
  skin: '#F3B391',
  ground: '#DEE9F7',
  groundDark: '#CBD8EC',
};

function Cloud({ x, y, s = 1, o = 0.9 }) {
  return (
    <g opacity={o} fill="#FFFFFF">
      <ellipse cx={x} cy={y} rx={14 * s} ry={8 * s} />
      <ellipse cx={x + 12 * s} cy={y - 5 * s} rx={10 * s} ry={7 * s} />
      <ellipse cx={x + 24 * s} cy={y} rx={12 * s} ry={7 * s} />
    </g>
  );
}

function Tree({ x, y, s = 1, c = C.green }) {
  return (
    <g>
      <rect x={x - 2 * s} y={y} width={4 * s} height={10 * s} rx={2 * s} fill="#7C5A3E" />
      <circle cx={x} cy={y - 8 * s} r={11 * s} fill={c} />
      <circle cx={x - 6 * s} cy={y - 3 * s} r={7 * s} fill={c} opacity="0.8" />
      <circle cx={x + 7 * s} cy={y - 4 * s} r={8 * s} fill={c} opacity="0.85" />
    </g>
  );
}

function House({ x, y, w = 34, h = 26, body = '#FFFFFF', roof = C.blue600, door = C.primary }) {
  const roofH = 14;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={body} />
      <path d={`M${x - 4} ${y} L${x + w / 2} ${y - roofH} L${x + w + 4} ${y} Z`} fill={roof} />
      <rect x={x + w / 2 - 3.5} y={y + h - 8} width={7} height={8} rx={1.5} fill={door} opacity="0.85" />
      <rect x={x + 5} y={y + 6} width={6} height={6} rx={1} fill={C.blue100} stroke={C.blue300} strokeWidth="1" />
      <rect x={x + w - 11} y={y + 6} width={6} height={6} rx={1} fill={C.blue100} stroke={C.blue300} strokeWidth="1" />
    </g>
  );
}

function Building({ x, y, w = 30, h = 60, c = C.blue400, floors = 2 }) {
  const winW = 5;
  const winH = 7;
  const gapX = 6;
  const rowH = 14;
  const rows = Math.max(1, Math.floor((h - 16) / rowH));
  const cols = Math.max(1, Math.floor((w - 14) / (winW + gapX)));
  const offsetX = (w - (cols * (winW + gapX) - gapX)) / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={c} />
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, col) => (
          <rect
            key={r + '-' + col}
            x={x + offsetX + col * (winW + gapX)}
            y={y + 10 + r * rowH}
            width={winW}
            height={winH}
            rx={1}
            fill="#FFFFFF"
            opacity="0.85"
          />
        ))
      )}
    </g>
  );
}

function Lamp({ x, y }) {
  return (
    <g>
      <rect x={x - 1.5} y={y} width={3} height={26} rx={1.5} fill={C.navy} opacity="0.6" />
      <path d={`M${x - 7} ${y} q7 -7 14 0`} fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <circle cx={x} cy={y - 2} r={3} fill="#F9C74F" />
    </g>
  );
}

function Person({ x, y, shirt = C.primary, hat, scale = 1, h = 22 }) {
  const r = 4.5 * scale;
  const bodyTop = y - h * scale;
  return (
    <g>
      <circle cx={x} cy={bodyTop + r} r={r} fill={C.skin} />
      <rect x={x - 6.5 * scale} y={bodyTop + r * 1.6} width={13 * scale} height={(h - r * 1.6 - 4) * scale} rx={5 * scale} fill={shirt} />
      <rect x={x - 7 * scale} y={y - 4.5 * scale} width={14 * scale} height={4.5 * scale} rx={2 * scale} fill={C.navy} opacity="0.75" />
      {hat && <circle cx={x} cy={bodyTop + r - 3 * scale} r={5.5 * scale} fill={hat} />}
    </g>
  );
}

function IconBadge({ x, y, s = 1, children, ring = C.blue200 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={13 * s} fill="#FFFFFF" stroke={ring} strokeWidth="1.5" />
      <g transform={`translate(${x} ${y}) scale(${s})`}>{children}</g>
    </g>
  );
}

function PinIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.red}>
      <path d="M0 -7 C-4.5 -2.8 -6 0.6 -6 2.6 A6 6 0 0 0 6 2.6 C6 0.6 4.5 -2.8 0 -7 Z" fill={C.red} />
      <circle cx="0" cy="2.6" r="2.2" fill="#FFFFFF" />
    </IconBadge>
  );
}

function DocIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <rect x="-5.5" y="-6" width="11" height="12" rx="1.5" fill={C.white} stroke={C.blue400} strokeWidth="1.3" />
      <path d="M-3.5 -3 h7 M-3.5 0 h7 M-3.5 3 h4.5" stroke={C.blue400} strokeWidth="1.1" strokeLinecap="round" />
    </IconBadge>
  );
}

function CheckIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.green}>
      <circle cx="0" cy="0" r="7" fill={C.green} />
      <path d="M-3.5 0 l2.5 2.6 4.5 -5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </IconBadge>
  );
}

function SearchIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <circle cx="-1.5" cy="-1.5" r="4.5" fill="none" stroke={C.primary} strokeWidth="1.8" />
      <path d="M2 2 l4 4" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" />
    </IconBadge>
  );
}

function WrenchIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.orange}>
      <path
        d="M-4.2 -5.5 L2 0.7 a1 1 0 0 1 0 1.4 l-1.4 1.4 a1 1 0 0 1-1.4 0 L-7 -2.1 a3.4 3.4 0 0 0 4.4 4.4 l1.3 1.3 a1.6 1.6 0 0 0 2.2-2.2 l-1.2-1.2 a3.4 3.4 0 0 0-4.3-4.3 Z"
        fill={C.orange}
      />
    </IconBadge>
  );
}

function GearIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue200}>
      <g fill={C.blue400}>
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="-1.4"
            y="-9"
            width="2.8"
            height="3.6"
            rx="1"
            transform={`rotate(${i * 45})`}
          />
        ))}
        <circle cx="0" cy="0" r="5.5" fill={C.blue400} />
        <circle cx="0" cy="0" r="2.2" fill="#FFFFFF" />
      </g>
    </IconBadge>
  );
}

function ShieldIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <path d="M0 -7 L6 -4.5 V1.5 C6 4.5 3.4 6.4 0 7 C-3.4 6.4 -6 4.5 -6 1.5 V-4.5 Z" fill={C.blue400} />
      <path d="M-2.5 0.5 l2 2 3.5 -4" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </IconBadge>
  );
}

function MegaphoneIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.orange}>
      <path d="M-6 -3 v4 a1 1 0 0 0 1 1 h2.5 l3.5 3 V-7 L-2.5 -4 H-5 a1 1 0 0 0-1 1 Z" fill={C.orange} />
      <path d="M2.5 -3.5 a4 4 0 0 1 0 7 M5 -5.5 a7 7 0 0 1 0 11" stroke={C.orange} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </IconBadge>
  );
}

function CalendarIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <rect x="-6" y="-5.5" width="12" height="11" rx="1.5" fill={C.white} stroke={C.primary} strokeWidth="1.3" />
      <path d="M-3.5 -5.5 v-2 M3.5 -5.5 v-2 M-6 -2 h12" stroke={C.primary} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="-3" cy="1" r="0.8" fill={C.primary} />
      <circle cx="0" cy="1" r="0.8" fill={C.primary} />
      <circle cx="3" cy="1" r="0.8" fill={C.primary} />
    </IconBadge>
  );
}

function ChatIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.green}>
      <path d="M-5.5 -5.5 H5.5 V4 H0.5 L-3 6 V4 H-5.5 Z" fill={C.green} />
      <path d="M-3.5 -1.5 h7 M-3.5 1 h4.5" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
    </IconBadge>
  );
}

function FolderIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <path d="M-6.5 -1.5 H-1.5 L0.5 -4.5 H6.5 V3 A1.5 1.5 0 0 1 5 4.5 H-5 A1.5 1.5 0 0 1 -6.5 3 Z" fill={C.blue100} stroke={C.blue400} strokeWidth="1.3" />
      <path d="M-3.5 0 h7 M-3.5 2 h5" stroke={C.blue400} strokeWidth="1.1" strokeLinecap="round" />
    </IconBadge>
  );
}

function Backdrop() {
  return (
    <>
      <circle cx="286" cy="34" r="18" fill="#F9C74F" opacity="0.9" />
      <circle cx="286" cy="34" r="27" fill="#F9C74F" opacity="0.22" />
      <Cloud x={36} y={32} s={0.9} />
      <Cloud x={128} y={54} s={0.7} o={0.7} />
      <Cloud x={268} y={72} s={0.7} o={0.6} />
      <g opacity="0.5">
        <Building x={8} y={150} w={26} h={62} c={C.blue200} floors={3} />
        <Building x={40} y={164} w={22} h={48} c={C.blue100} floors={2} />
        <Building x={66} y={140} w={28} h={72} c={C.blue100} floors={3} />
        <Building x={250} y={150} w={24} h={62} c={C.blue200} floors={3} />
        <Building x={278} y={164} w={26} h={48} c={C.blue100} floors={2} />
        <Building x={306} y={146} w={11} h={66} c={C.blue100} floors={2} />
      </g>
      <rect x="0" y="210" width="320" height="30" fill={C.ground} />
      <rect x="0" y="226" width="320" height="14" fill={C.groundDark} />
    </>
  );
}

function Neighborhood() {
  return (
    <>
      <House x={78} y={184} w={34} h={26} />
      <House x={124} y={188} w={30} h={22} body="#F1F6FE" roof={C.blue400} />
      <Tree x={68} y={200} s={0.85} />
      <Tree x={164} y={204} s={0.7} c={C.blue400} />
      <Building x={208} y={150} w={40} h={60} c={C.blue400} floors={2} />
      <rect x={208} y={150} width={40} height={10} rx={3} fill={C.blue600} />
      <Lamp x={196} y={184} />
      <Lamp x={262} y={188} />
      <Cloud x={200} y={120} s={0.6} o={0.6} />
    </>
  );
}

function HomeScene() {
  return (
    <>
      <Neighborhood />
      <Person x={92} y={210} shirt={C.blue600} h={22} />
      <Person x={124} y={210} shirt={C.green} h={20} />
      <Person x={158} y={210} shirt={C.deep} h={23} />
      <Person x={238} y={210} shirt={C.orange} hat="#0A1A45" h={22} />
    </>
  );
}

function ReportScene() {
  return (
    <>
      <House x={40} y={188} w={30} h={22} body="#F1F6FE" roof={C.blue400} />
      <House x={76} y={184} w={32} h={26} />
      <Building x={112} y={158} w={34} h={52} c={C.blue400} floors={2} />
      <Tree x={36} y={202} s={0.7} />
      <Lamp x={156} y={188} />
      <Person x={116} y={210} shirt={C.blue600} h={22} />
      <PinIcon x={146} y={196} s={1.05} />
      <DocIcon x={178} y={196} s={1.1} />
      <Person x={216} y={210} shirt={C.deep} h={24} />
      <rect x={248} y={182} width={48} height={20} rx={6} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={254} y={188} width={26} height={3} rx={1.5} fill={C.blue300} />
      <rect x={254} y={194} width={18} height={3} rx={1.5} fill={C.blue200} />
      <path d="M244 192 l-6 5 v-10 Z" fill={C.blue400} />
    </>
  );
}

function TrackScene() {
  return (
    <>
      <Building x={30} y={158} w={32} h={52} c={C.blue400} floors={2} />
      <Building x={66} y={170} w={26} h={40} c={C.blue200} floors={2} />
      <Tree x={28} y={200} s={0.7} />
      <Person x={60} y={210} shirt={C.blue600} h={22} />
      <rect x={88} y={168} width={86} height={40} rx={8} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={96} y={178} width={40} height={4} rx={2} fill={C.blue300} />
      {[
        [96, 190, C.green],
        [112, 194, C.blue400],
        [128, 190, C.orange],
        [144, 194, C.blue300],
      ].map(([dx, dy, color], i) => (
        <circle key={i} cx={dx} cy={dy} r={3} fill={color} />
      ))}
      <path d="M96 194 h56" stroke={C.blue200} strokeWidth="1.5" strokeDasharray="3 3" />
      <SearchIcon x={196} y={190} s={1.1} />
      <Person x={232} y={210} shirt={C.deep} h={24} />
      <rect x={256} y={180} width={38} height={22} rx={5} fill={C.white} stroke={C.blue300} strokeWidth="1.5" />
      <rect x={262} y={188} width={22} height={3} rx={1.5} fill={C.blue300} />
      <CheckIcon x={278} y={166} s={0.95} />
    </>
  );
}

function MaintenanceScene() {
  return (
    <>
      <Neighborhood />
      <GearIcon x={232} y={158} s={1.15} />
      <ShieldIcon x={276} y={166} s={1} />
      <Person x={112} y={210} shirt={C.orange} hat="#0A1A45" h={24} />
      <WrenchIcon x={150} y={186} s={1.05} />
      <rect x={196} y={186} width={40} height={18} rx={4} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={202} y={191} width={22} height={3} rx={1.5} fill={C.blue300} />
      <rect x={202} y={196} width={15} height={3} rx={1.5} fill={C.blue200} />
    </>
  );
}

function HowItWorksScene() {
  return (
    <>
      <Building x={24} y={158} w={34} h={52} c={C.blue400} floors={2} />
      <Building x={62} y={168} w={26} h={42} c={C.blue200} floors={2} />
      <Tree x={22} y={200} s={0.7} />
      <Lamp x={92} y={188} />
      <Person x={92} y={210} shirt={C.blue600} h={22} />
      {[
        [150, 146, 'p', C.blue600],
        [150, 172, 'd', C.blue400],
        [150, 198, 'c', C.green],
      ].map(([x, y, kind, color]) => (
        <g key={y}>
          <circle cx={x} cy={y} r={13} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
          {kind === 'p' && (
            <>
              <circle cx={x} cy={y - 4} r={3.5} fill={C.skin} />
              <rect x={x - 5} y={y} width={10} height={7} rx={3.5} fill={color} />
            </>
          )}
          {kind === 'd' && (
            <>
              <rect x={x - 5} y={y - 5} width={10} height={10} rx={1.5} fill={C.white} stroke={color} strokeWidth="1.3" />
              <path d={`M${x - 3} ${y - 1} h6 M${x - 3} ${y + 1.5} h4`} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
            </>
          )}
          {kind === 'c' && (
            <>
              <circle cx={x} cy={y} r={7} fill={C.green} />
              <path d={`M${x - 3} ${y} l2.4 2.5 4.5 -4.8`} stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
          {y < 198 && <path d={`M${x} ${y + 14} v6`} stroke={C.blue200} strokeWidth="2" />}
        </g>
      ))}
      <Person x={200} y={210} shirt={C.deep} h={23} />
      <GearIcon x={234} y={178} s={0.9} />
      <CheckIcon x={262} y={198} s={1} />
    </>
  );
}

function AboutScene() {
  return (
    <>
      <Neighborhood />
      <Person x={92} y={210} shirt={C.blue600} h={22} />
      <Person x={126} y={210} shirt={C.green} h={20} />
      <Person x={160} y={210} shirt={C.deep} h={23} />
      <Person x={198} y={210} shirt={C.orange} h={21} />
      <Person x={232} y={210} shirt={C.blue400} h={24} />
      <IconBadge x={156} y={164} s={1.05} ring={C.blue200}>
        <path d="M-4 -2 C-2 -6 2 -6 4 -2 C6 1 3 4 0 4 C-3 4 -6 1 -4 -2 Z" fill={C.blue400} opacity="0.9" />
        <path d="M-2.5 1 a3 3 0 0 1 5 0" stroke={C.white} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="0" cy="-4.5" r="2.2" fill={C.skin} />
        <circle cx="0" cy="-4.5" r="0.8" fill={C.navy} />
      </IconBadge>
    </>
  );
}

function ServicesScene() {
  return (
    <>
      <House x={64} y={184} w={34} h={26} />
      <Tree x={52} y={198} s={0.75} />
      <Building x={116} y={158} w={40} h={52} c={C.blue400} floors={2} />
      <Lamp x={106} y={184} />
      <Lamp x={164} y={186} />
      <TrashIcon x={196} y={176} s={1} />
      <DocIcon x={226} y={170} s={0.95} />
      <WrenchIcon x={196} y={206} s={1} />
      <ShieldIcon x={228} y={206} s={1} />
      <CheckIcon x={262} y={186} s={1} />
      <Person x={240} y={210} shirt={C.deep} h={22} />
    </>
  );
}

function TrashIcon({ x, y, s = 1 }) {
  return (
    <IconBadge x={x} y={y} s={s} ring={C.blue300}>
      <path d="M-5 3 h10 l-1.5 -9 h-7 Z" fill={C.blue400} />
      <rect x="-2.5" y="-7.5" width="5" height="2.5" rx="1" fill={C.blue400} />
      <path d="M-3.5 0 h.8 v5 h-0.8 Z M0.5 0 h.8 v5 h-0.8 Z" fill={C.white} opacity="0.9" />
    </IconBadge>
  );
}

function AnnouncementsScene() {
  return (
    <>
      <Neighborhood />
      <MegaphoneIcon x={236} y={160} s={1.1} />
      <CalendarIcon x={272} y={168} s={1} />
      <rect x={98} y={176} width={72} height={34} rx={5} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={98} y={176} width={72} height={8} rx={5} fill={C.blue400} />
      <rect x={106} y={188} width={30} height={3} rx={1.5} fill={C.blue300} />
      <rect x={106} y={193} width={24} height={3} rx={1.5} fill={C.blue200} />
      <rect x={106} y={198} width={28} height={3} rx={1.5} fill={C.blue300} />
      <circle cx={160} cy={192} r={4.5} fill={C.orange} />
      <Person x={176} y={210} shirt={C.blue600} h={22} />
      <Person x={210} y={210} shirt={C.deep} h={23} />
    </>
  );
}

function ContactScene() {
  return (
    <>
      <Building x={36} y={160} w={40} h={50} c={C.blue400} floors={2} />
      <Building x={82} y={170} w={30} h={40} c={C.blue200} floors={2} />
      <Tree x={34} y={200} s={0.7} />
      <Lamp x={120} y={188} />
      <Person x={118} y={210} shirt={C.blue600} h={22} />
      <ChatIcon x={150} y={184} s={1.15} />
      <Person x={186} y={210} shirt={C.deep} h={24} />
      <rect x={210} y={176} width={58} height={22} rx={6} fill="#FFFFFF" stroke={C.green} strokeWidth="1.5" />
      <rect x={218} y={182} width={30} height={3} rx={1.5} fill={C.green} opacity="0.7" />
      <rect x={218} y={188} width={24} height={3} rx={1.5} fill={C.blue200} />
      <path d="M206 182 l-6 5 v-10 Z" fill={C.green} />
      <circle cx={262} cy={196} r={8} fill={C.green} opacity="0.15" />
      <path d="M256 196 a6 6 0 0 1 12 0" stroke={C.green} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M260.5 196 a2 2 0 0 1 3 0" stroke={C.green} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  );
}

function DocumentsScene() {
  return (
    <>
      <Building x={40} y={156} w={42} h={54} c={C.blue400} floors={2} />
      <Tree x={38} y={200} s={0.7} />
      <Person x={100} y={210} shirt={C.blue600} h={22} />
      <DocIcon x={134} y={188} s={1.1} />
      <FolderIcon x={166} y={188} s={1.1} />
      <rect x={196} y={164} width={60} height={42} rx={6} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={196} y={164} width={60} height={9} rx={6} fill={C.blue100} stroke={C.blue300} strokeWidth="1" />
      <rect x={204} y={180} width={34} height={3} rx={1.5} fill={C.blue300} />
      <rect x={204} y={186} width={26} height={3} rx={1.5} fill={C.blue200} />
      <rect x={204} y={192} width={30} height={3} rx={1.5} fill={C.blue300} />
      <rect x={204} y={198} width={18} height={3} rx={1.5} fill={C.blue200} />
      <rect x={240} y={180} width={8} height={3} rx={1.5} fill={C.blue400} />
      <rect x={240} y={186} width={8} height={3} rx={1.5} fill={C.blue400} />
      <CheckIcon x={270} y={162} s={0.95} />
    </>
  );
}

function GarbageScene() {
  return (
    <>
      <House x={30} y={184} w={32} h={26} />
      <House x={72} y={188} w={28} h={22} body="#F1F6FE" roof={C.blue400} />
      <Tree x={24} y={200} s={0.7} />
      <Lamp x={108} y={188} />
      <g>
        <rect x={136} y={172} width={30} height={22} rx={3} fill={C.blue400} />
        <path d="M128 194 h50 l-4 -10 h-42 Z" fill={C.blue600} />
        <rect x={128} y={194} width={14} height={10} rx={2} fill={C.blue100} />
        <circle cx={150} cy={204} r={5} fill={C.navy} />
        <circle cx={176} cy={204} r={5} fill={C.navy} />
        <rect x={138} y={182} width={26} height={4} rx={2} fill={C.blue100} />
        <rect x={138} y={188} width={18} height={3} rx={1.5} fill={C.blue200} />
      </g>
      <rect x={216} y={190} width={22} height={14} rx={3} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={222} y={194} width={10} height={3} rx={1.5} fill={C.blue300} />
      <rect x={222} y={199} width={7} height={3} rx={1.5} fill={C.blue200} />
      <CalendarIcon x={262} y={170} s={0.95} />
      <Tree x={288} y={204} s={0.65} />
    </>
  );
}

function SuccessScene() {
  return (
    <>
      <House x={34} y={188} w={30} h={22} body="#F1F6FE" roof={C.blue400} />
      <House x={70} y={184} w={32} h={26} />
      <Building x={106} y={158} w={34} h={52} c={C.blue400} floors={2} />
      <Tree x={28} y={202} s={0.7} />
      <Lamp x={150} y={188} />
      <Person x={112} y={210} shirt={C.blue600} h={22} />
      <rect x={140} y={182} width={44} height={20} rx={6} fill="#FFFFFF" stroke={C.blue300} strokeWidth="1.5" />
      <rect x={146} y={188} width={22} height={3} rx={1.5} fill={C.blue300} />
      <rect x={146} y={194} width={15} height={3} rx={1.5} fill={C.blue200} />
      <CheckIcon x={196} y={172} s={1.15} />
      <PinIcon x={236} y={190} s={1} />
      <Person x={268} y={210} shirt={C.deep} h={24} />
      <path d="M206 192 l-10 8 v-16 Z" fill={C.blue400} />
      <circle cx={264} cy={200} r={9} fill={C.green} opacity="0.15" />
    </>
  );
}

const SCENES = {
  home: HomeScene,
  report: ReportScene,
  track: TrackScene,
  success: SuccessScene,
  maintenance: MaintenanceScene,
  'how-it-works': HowItWorksScene,
  about: AboutScene,
  services: ServicesScene,
  announcements: AnnouncementsScene,
  contact: ContactScene,
  documents: DocumentsScene,
  garbage: GarbageScene,
};

export default function CivicIllustration({ variant = 'home', className = '' }) {
  const Scene = SCENES[variant] || HomeScene;
  return (
    <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
      <svg
        viewBox="0 0 320 240"
        className={`w-full h-auto max-w-full ${className}`}
        fill="none"
        role="img"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <Backdrop />
        <Scene />
      </svg>
    </div>
  );
}