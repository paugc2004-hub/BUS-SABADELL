/** Icones de les pantalles de paritat (traç de 1,8 px, com la resta del set de l'app). */
import type { ReactNode } from 'react';
const S = { stroke: 'currentColor', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const svg = (size: number, body: ReactNode) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
    {body}
  </svg>
);

export const Ic = {
  back: svg(22, <path d="M19 12H5M11 6l-6 6 6 6" {...S} strokeWidth={2} />),
  chevron: svg(18, <path d="M9 6l6 6-6 6" {...S} strokeWidth={2} />),
  qr: svg(
    20,
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" {...S} />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" {...S} />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" {...S} />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 18.5v2M18.5 14h2" {...S} />
    </>,
  ),
  search: svg(
    20,
    <>
      <circle cx="10.5" cy="10.5" r="6" {...S} strokeWidth={2} />
      <path d="M15 15l5 5" {...S} strokeWidth={2} />
    </>,
  ),
  alert: svg(
    20,
    <>
      <path d="M12 3.5l9 16H3z" {...S} />
      <path d="M12 10v4.5M12 17.2v.3" {...S} strokeWidth={2} />
    </>,
  ),
  plan: svg(
    20,
    <>
      <path d="M8 20V5M4 9l4-4 4 4M16 4v15M12 15l4 4 4-4" {...S} strokeWidth={2} />
    </>,
  ),
  more: svg(
    20,
    <>
      <circle cx="12" cy="5.5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.6" fill="currentColor" />
    </>,
  ),
  home: svg(20, <path d="M4 11l8-7 8 7v9h-5.5v-6h-5v6H4z" {...S} />),
  map: svg(20, <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" {...S} />),
  lines: svg(
    20,
    <>
      <path d="M3 17l5-6 4 3 8-8" {...S} strokeWidth={2} />
      <circle cx="8" cy="11" r="1.6" fill="currentColor" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" />
    </>,
  ),
  swap: svg(20, <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" {...S} strokeWidth={2} />),
  locate: svg(
    18,
    <>
      <circle cx="12" cy="12" r="6.5" {...S} />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" {...S} />
    </>,
  ),
  cart: svg(
    22,
    <>
      <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4" {...S} />
      <circle cx="9" cy="19" r="1.6" fill="currentColor" />
      <circle cx="17" cy="19" r="1.6" fill="currentColor" />
    </>,
  ),
  euro: svg(22, <path d="M17.5 6.5A6.5 6.5 0 1017.5 17.5M4 10.5h9M4 13.5h9" {...S} strokeWidth={2} />),
  history: svg(
    22,
    <>
      <path d="M4.5 12a7.5 7.5 0 101.8-4.9M4 4.5v3.2h3.2" {...S} />
      <path d="M12 8v4.3l3 1.8" {...S} />
    </>,
  ),
  nfc: svg(
    22,
    <>
      <rect x="3" y="7" width="13" height="10" rx="2" {...S} />
      <path d="M18.5 8.5a5 5 0 010 7M20.8 6.2a8.2 8.2 0 010 11.6" {...S} />
    </>,
  ),
  ticket: svg(
    22,
    <>
      <path d="M3.5 7.5h17v3a1.6 1.6 0 000 3v3h-17v-3a1.6 1.6 0 000-3z" {...S} />
      <path d="M9.5 7.5v9" {...S} strokeDasharray="1.6 2" />
    </>,
  ),
  link: svg(22, <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" {...S} />),
  user: svg(
    22,
    <>
      <circle cx="12" cy="8.5" r="3.8" {...S} />
      <path d="M4.8 20c1.3-3.7 4-5.6 7.2-5.6s5.9 1.9 7.2 5.6" {...S} />
    </>,
  ),
  badge: svg(
    22,
    <>
      <rect x="3.5" y="6.5" width="17" height="13" rx="2" {...S} />
      <path d="M9 6.5V4.5h6v2M7.5 15.5c.6-1.6 1.6-2.4 2.8-2.4s2.2.8 2.8 2.4M14.5 11h3M14.5 14h3" {...S} />
      <circle cx="10.3" cy="10.7" r="1.4" {...S} />
    </>,
  ),
  info: svg(
    22,
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M12 11v5.5M12 7.6v.4" {...S} strokeWidth={2} />
    </>,
  ),
  key: svg(
    22,
    <>
      <circle cx="7.5" cy="12" r="3.8" {...S} />
      <path d="M11.3 12H21M17.5 12v3M20.5 12v2.5" {...S} />
    </>,
  ),
  gear: svg(
    22,
    <>
      <circle cx="12" cy="12" r="3" {...S} />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" {...S} />
    </>,
  ),
  trash: svg(22, <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6M14 10.5v6" {...S} />),
  star: svg(22, <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...S} />),
  store: svg(
    22,
    <>
      <path d="M4 9.5l1.5-5h13l1.5 5M4 9.5h16v10H4zM4 9.5a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0" {...S} />
      <path d="M10 19.5v-5h4v5" {...S} />
    </>,
  ),
  office: svg(
    22,
    <>
      <path d="M4 20V8l8-4 8 4v12M2.5 20h19M9 20v-5h6v5" {...S} />
      <path d="M8 11h.01M12 11h.01M16 11h.01" {...S} strokeWidth={2.4} />
    </>,
  ),
  globe: svg(
    22,
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5S9.5 6.1 12 3.5z" {...S} />
    </>,
  ),
  access: svg(
    22,
    <>
      <circle cx="12" cy="4.8" r="1.8" fill="currentColor" />
      <path d="M5 8.5l7 1.5 7-1.5M12 10v4.5l-3 6M12 14.5l3 6" {...S} strokeWidth={2} />
    </>,
  ),
  ext: svg(16, <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" {...S} />),
  share: svg(20, <path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12.5V20h14v-7.5" {...S} />),
  refresh: svg(20, <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4v4.5H15" {...S} />),
  doc: svg(22, <path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6" {...S} />),
  // il·lustracions de la portada (pròpies; cap recurs de TUS)
  cards: (
    <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden>
      <rect x="22" y="6" width="58" height="38" rx="7" fill="#2a3246" stroke="#ffb224" strokeWidth="2" transform="rotate(-8 51 25)" />
      <rect x="10" y="20" width="58" height="38" rx="7" fill="#f4f5f7" />
      <path d="M17 44h18M17 36h30" stroke="#151a26" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 28 V44 L60 34" fill="none" stroke="#ffb224" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 64 80" width="52" height="66" aria-hidden>
      <rect x="12" y="4" width="40" height="72" rx="9" fill="#f4f5f7" />
      <rect x="17" y="12" width="30" height="50" rx="4" fill="#151a26" />
      <path d="M24 50 V24 L40 50 V24" fill="none" stroke="#f4f5f7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="37" r="3.6" fill="#ffb224" />
      <rect x="26" y="66" width="12" height="3" rx="1.5" fill="#151a26" opacity=".35" />
    </svg>
  ),
  routeArt: (
    <svg viewBox="0 0 96 64" width="96" height="64" aria-hidden>
      <path d="M6 54 C 24 54, 22 18, 44 18 S 70 46, 90 12" fill="none" stroke="#f4f5f7" strokeWidth="4" strokeLinecap="round" opacity=".9" />
      <circle cx="6" cy="54" r="5" fill="#151a26" stroke="#f4f5f7" strokeWidth="3" />
      <circle cx="44" cy="18" r="5" fill="#151a26" stroke="#f4f5f7" strokeWidth="3" />
      <circle cx="90" cy="12" r="5" fill="#151a26" stroke="#f4f5f7" strokeWidth="3" />
      <rect x="58" y="26" width="18" height="12" rx="3.5" fill="#ffb224" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      <circle cx="24" cy="15" r="9" fill="#f4f5f7" />
      <path d="M7 44c2.5-10 9-15 17-15s14.5 5 17 15z" fill="#f4f5f7" />
    </svg>
  ),
  infoBig: (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      <circle cx="24" cy="24" r="20" fill="#f4f5f7" />
      <rect x="21" y="20" width="6" height="16" rx="2" fill="#151a26" />
      <circle cx="24" cy="13.5" r="3.4" fill="#ffb224" />
    </svg>
  ),
};
