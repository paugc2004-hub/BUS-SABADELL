/**
 * Punts de venda de títols de TUS (Oficina de Mobilitat i xarxa PunTUS).
 *
 * Font inicial: llista facilitada pel responsable del projecte (2026-10-11), procedent de la pàgina de punts de venda
 * de tus.es. No s'ha pogut obrir la pàgina original des de l'entorn de desenvolupament (xarxa bloquejada).
 * Sense coordenades: no s'inventen; el mapa s'obre amb una cerca de l'adreça. Horaris tal com es publiquen, sense
 * excepcions conegudes (festius, vacances o tancaments puntuals es diuen «a confirmar»).
 */
import type { SalesTitle } from './fares.ts';

type L = { ca: string; es: string };
/** minuts des de mitjanit [obertura, tancament) */
export type Range = [number, number];
/** 0 = dilluns … 6 = diumenge */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface DayHours {
  ranges: Range[];
  /** franges que depenen d'una condició que no sabem (p. ex. dies lectius): «a confirmar» */
  maybe?: Range[];
}

export interface SalesPoint {
  id: string;
  name: string;
  address: string;
  municipality: 'Sabadell' | 'Sant Quirze del Vallès';
  neighbourhood: string | null;
  hours: Partial<Record<Weekday, DayHours>>;
  /** horari en festius, si es publica; si no, en un festiu l'estat és «a confirmar» */
  holidays?: DayHours;
  /** nota sobre l'horari tal com es publica */
  note?: L;
  titles: SalesTitle[];
  source: string;
  checked: string | null;
}

const SRC = 'https://www.tus.es/index.php/ca/informacio-d-interes/punts-de-venda';

/** '9:00-13:45,17:00-20:30' → franges en minuts */
export function parseRanges(s: string): Range[] {
  return s.split(',').map((part) => {
    const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(part.trim());
    if (!m) throw new Error(`horari invàlid: ${part}`);
    return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
  });
}

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4];
/** construeix l'horari: { 'dl-dv': '…', 'ds': '…', 'dg': '…', 'dl-ds': '…', 'dl-dg': '…', 'ds-dg': '…' } */
function H(spec: Record<string, string>): Partial<Record<Weekday, DayHours>> {
  const days: Record<string, Weekday[]> = { 'dl-dv': WEEKDAYS, ds: [5], dg: [6], 'dl-ds': [0, 1, 2, 3, 4, 5], 'dl-dg': [0, 1, 2, 3, 4, 5, 6], 'ds-dg': [5, 6] };
  const out: Partial<Record<Weekday, DayHours>> = {};
  for (const [k, v] of Object.entries(spec)) for (const d of days[k]!) out[d] = { ranges: parseRanges(v) };
  return out;
}

const P = (
  id: string,
  name: string,
  address: string,
  neighbourhood: string | null,
  hours: Partial<Record<Weekday, DayHours>>,
  extra: Partial<SalesPoint> = {},
): SalesPoint => ({
  id,
  name,
  address,
  municipality: 'Sabadell',
  neighbourhood,
  hours,
  titles: ['t-sabadell'],
  source: SRC,
  checked: null,
  ...extra,
});

export const SALES_POINTS: SalesPoint[] = [
  P('oficina-mobilitat', 'Oficina de Mobilitat', 'C. de l’Estació, 67', 'Centre', H({ 'dl-dv': '8:00-13:00,16:00-19:00' }), {
    titles: ['t-sabadell', 't10', 't-mensual', 't-mensual-jove'],
  }),
  P('estanc-1', 'ESTANC-1, Aragay', 'C. d’en Font, 26', 'Centre', H({ 'dl-dv': '9:00-13:45,17:00-20:30', ds: '9:30-13:45' })),
  P('estanc-7', 'ESTANC-7, Costa', 'Passeig de la Plaça Major, 25', 'Centre', H({ 'dl-ds': '8:00-13:30,16:00-20:30' })),
  P('estanc-30', 'ESTANC-30, Fontanella', 'C. de Fontanella, 79', 'La Creu de Barberà', H({ 'dl-dv': '8:30-14:00,16:30-20:30', ds: '9:00-13:30' })),
  P('estanc-42', 'ESTANC-42, Matadepera', 'Av. de Matadepera, 147', 'Ca n’Oriac', H({ 'dl-dv': '8:30-20:30', dg: '8:30-13:30' }), {
    note: { ca: 'Dissabte sense horari publicat.', es: 'Sábado sin horario publicado.' },
  }),
  P('estanc-16', 'ESTANC-16, l’Estanquet de la Rambla', 'C. de Lacy, 4', 'Centre', H({ 'dl-dv': '9:00-14:00,17:00-20:30', ds: '10:00-13:30,17:00-20:30' })),
  P(
    'llibreria-yoli',
    'Llibreria Yoli',
    'C. de Pizarro, 6',
    'La Creu de Barberà',
    {
      ...Object.fromEntries(WEEKDAYS.map((d) => [d, { ranges: parseRanges('8:00-14:00'), maybe: parseRanges('14:00-15:00') }])),
      ...H({ 'ds-dg': '8:00-14:00' }),
    },
    { note: { ca: 'De dilluns a divendres: fins a les 15:00 els dies lectius i fins a les 14:00 els no lectius.', es: 'De lunes a viernes: hasta las 15:00 los días lectivos y hasta las 14:00 los no lectivos.' } },
  ),
  P('estanc-39', 'ESTANC-39, Tabacs', 'Plaça Espanya, 21', 'La Concòrdia', H({ 'dl-dv': '8:00-14:00,16:30-20:30', 'ds-dg': '8:00-14:00' }), {
    holidays: { ranges: parseRanges('8:00-14:00') },
  }),
  P('papereria-can-deu', 'Papereria Can Deu', 'C. de la Ginesta, 14', 'Can Deu', H({ 'dl-dv': '8:30-13:30,16:30-20:00', ds: '8:00-13:30' })),
  P('estanc-33', 'ESTANC-33', 'C. de Sol i Padrís, 22', 'Sol i Padrís', H({ 'dl-dv': '8:30-20:30', ds: '9:00-13:30' }), {
    note: { ca: 'De dilluns a divendres, horari continu.', es: 'De lunes a viernes, horario continuo.' },
  }),
  P('estanc-8', 'ESTANC-8', 'Av. de Matadepera, 243', 'La Roureda', H({ 'dl-ds': '8:30-13:30,17:00-20:30' })),
  P('estanc-4', 'ESTANC-4, Tony', 'Ronda Zamenhof, 66', 'Centre', H({ 'dl-dv': '7:30-14:00,17:00-20:30', ds: '9:30-14:00,17:00-21:30', dg: '9:00-14:00' }), {
    holidays: { ranges: parseRanges('9:00-14:00') },
  }),
  P('estanc-45', 'ESTANC-45', 'Via Aurelia, 1', 'La Concòrdia', H({ 'dl-dv': '8:30-13:30,16:30-20:00', ds: '16:30-20:00' })),
  P('estanc-concordia', 'ESTANC Concòrdia', 'Av. Concòrdia, 56', 'La Concòrdia', H({ 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:30-13:30' })),
  P('estanc-9', 'ESTANC-9', 'Ctra. de Barcelona, 307', 'Avinguda–Eixample', H({ 'dl-dv': '8:00-14:00,16:30-20:30', ds: '9:00-13:30,17:00-20:00' })),
  P('estanc-27', 'ESTANC-27', 'Av. de Matadepera, 91', 'Ca n’Oriac', H({ 'dl-ds': '8:30-13:30,16:30-20:30' })),
  P('estanc-5', 'ESTANC-5', 'C. de Lope de Vega, 64', 'La Creu de Barberà', H({ 'dl-ds': '9:00-14:00,16:30-20:30' })),
  P('estanc-29', 'ESTANC-29', 'Ctra. de Terrassa, 339', 'Els Merinals', H({ 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:00-14:00,17:00-20:00' })),
  P('estanc-36', 'ESTANC-36', 'C. de Plaute, 51', 'Can Rull', H({ 'dl-dg': '9:00-14:00' })),
  P('estanc-35', 'ESTANC-35', 'Ronda Zamenhof, 110', 'Centre', H({ 'dl-dv': '7:30-21:00', 'ds-dg': '8:00-21:00' })),
  P('estanc-23', 'ESTANC-23', 'C. de Sol i Padrís, 105', 'Sol i Padrís', H({ 'dl-ds': '8:00-21:00', dg: '8:00-14:30' })),
  P('estanc-44', 'ESTANC-44', 'Pl. de Madrid, 19', 'Can Llong', H({ 'dl-ds': '8:00-21:00', dg: '8:00-14:30' })),
  P('estanc-18', 'ESTANC-18', 'C. de Campoamor, 65', 'Campoamor', H({ 'dl-dv': '8:30-13:30,17:00-20:00', ds: '9:00-13:30' })),
  P('tabacs-21', 'TABACS-21', 'C. de Pi i Margall, 6', 'La Creu Alta', H({ 'dl-ds': '9:00-21:00' })),
  P('estanc-24', 'ESTANC-24', 'Av. de Barberà, 318', 'Avinguda–Eixample', H({ 'dl-ds': '9:00-14:00,17:00-21:00' })),
  P('estanc-14', 'ESTANC-14', 'Ctra. de Barcelona, 13', 'Centre', H({ 'dl-ds': '9:00-14:00,17:00-21:00' })),
  P('estanc-12', 'ESTANC-12', 'C. de les Tres Creus, 166', 'Centre', H({ 'dl-ds': '8:30-20:30', dg: '8:30-13:30' })),
  P('estanc-3', 'ESTANC-3', 'C. de Pau Rigalt, 10', 'La Creu Alta', H({ 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:00-14:00' })),
  P('estanc-pau-casals', 'ESTANC Pau Casals', 'Av. de Pau Casals, 29', null, H({ 'dl-dv': '9:00-14:00,17:00-20:00', ds: '9:00-14:00' }), {
    municipality: 'Sant Quirze del Vallès',
  }),
  P('estanc-32', 'ESTANC-32', 'Ctra. de Terrassa, 440', 'Cifuentes', H({ 'dl-dv': '9:00-14:00,17:00-21:00', ds: '9:00-14:00' })),
  P('estanc-11', 'ESTANC-11', 'Av. de Barberà, 20', 'Avinguda–Eixample', H({ 'dl-dv': '9:00-13:30,17:00-20:00', ds: '10:00-13:30,18:00-20:30' })),
  P('estanc-6', 'ESTANC-6', 'Rambla de Sabadell, 211', 'Centre', H({ 'dl-dv': '9:00-14:00,16:00-20:30', ds: '10:00-20:30' })),
  P('estanc-20', 'ESTANC-20', 'Ctra. de Terrassa, 108', 'Hostafrancs', H({ 'dl-dv': '8:30-13:30,16:30-20:30', ds: '9:30-13:30,17:00-20:30' })),
];

/* ---------- obert ara? (hora local de Sabadell) */

export interface LocalNow {
  date: string; // AAAA-MM-DD
  day: Weekday;
  min: number;
}

const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WD: Record<string, Weekday> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function localNow(t: number): LocalNow {
  const p = Object.fromEntries(FMT.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, day: WD[p.weekday!]!, min: Number(p.hour) * 60 + Number(p.minute) };
}

export type OpenState =
  | { state: 'open'; closesAt: number }
  | { state: 'closed'; opens: { day: Weekday; min: number; today: boolean } | null }
  | { state: 'unknown'; reason: 'holiday' | 'condition' | 'noCalendar' };

/**
 * Estat segons l'horari publicat. `holidays` = dates festives (AAAA-MM-DD) que coneixem; si no les sabem (null),
 * no es diu «obert» ni «tancat» (podria ser festiu).
 */
export function openState(p: SalesPoint, t: number, holidays: ReadonlySet<string> | null): OpenState {
  const now = localNow(t);
  if (!holidays) return { state: 'unknown', reason: 'noCalendar' };
  let today: DayHours | undefined = p.hours[now.day];
  if (holidays.has(now.date)) {
    if (!p.holidays) return { state: 'unknown', reason: 'holiday' };
    today = p.holidays;
  }
  const inR = (r: Range) => now.min >= r[0] && now.min < r[1];
  const open = today?.ranges.find(inR);
  if (open) {
    // si la franja continua en una de «a confirmar», tanca com a mínim a l'hora segura
    return { state: 'open', closesAt: open[1] };
  }
  if (today?.maybe?.some(inR)) return { state: 'unknown', reason: 'condition' };
  // propera obertura: avui més tard o els propers 7 dies (sense saber si seran festius)
  const later = today?.ranges.filter((r) => r[0] > now.min).sort((a, b) => a[0] - b[0])[0];
  if (later) return { state: 'closed', opens: { day: now.day, min: later[0], today: true } };
  for (let k = 1; k <= 7; k++) {
    const d = ((now.day + k) % 7) as Weekday;
    const first = p.hours[d]?.ranges.slice().sort((a, b) => a[0] - b[0])[0];
    if (first) return { state: 'closed', opens: { day: d, min: first[0], today: false } };
  }
  return { state: 'closed', opens: null };
}

export const hhmmMin = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/** barris de Sabadell amb punts de venda (ordre alfabètic) */
export const NEIGHBOURHOODS: string[] = [...new Set(SALES_POINTS.map((p) => p.neighbourhood).filter((n): n is string => Boolean(n)))].sort((a, b) =>
  a.localeCompare(b, 'ca'),
);

/** enllaç de cerca de l'adreça en una app de mapes (sense coordenades inventades) */
export function mapsSearchUrl(p: SalesPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address}, ${p.municipality}`)}`;
}
