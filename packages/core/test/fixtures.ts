import { cumulative, type LonLat } from '../src/geo.ts';
import type { NetworkData, Pattern } from '../src/types.ts';

/** Línea recta este-oeste de ~2 km por Sabadell con paradas cada ~400 m. */
export function straightLine(n = 6): { coords: LonLat[]; stops: LonLat[] } {
  const coords: LonLat[] = [];
  for (let i = 0; i <= 20; i++) coords.push([2.1 + i * 0.0012, 41.55]);
  const stops: LonLat[] = [];
  for (let i = 0; i < n; i++) stops.push([2.1 + i * 0.0048 * (20 / 20) * (5 / (n - 1)) * 1, 41.55]);
  return { coords, stops };
}

export function makePattern(over: Partial<Pattern> & { id: string; routeId: string }): Pattern {
  const coords: LonLat[] = over.coords ?? Array.from({ length: 11 }, (_, i) => [2.1 + i * 0.0024, 41.55] as LonLat);
  const cum = cumulative(coords);
  const len = cum[cum.length - 1]!;
  const nStops = over.stopIds?.length ?? 5;
  const stopDist = over.stopDist ?? Array.from({ length: nStops }, (_, i) => (len * i) / (nStops - 1));
  return {
    dir: 0,
    name: 'A - B',
    origin: 'A',
    headsign: 'B',
    dayType: 'feiner',
    circular: false,
    stopIds: Array.from({ length: nStops }, (_, i) => `${over.routeId}-s${i}`),
    stopDist,
    coords,
    cum,
    length: len,
    profiles: [Array.from({ length: nStops }, (_, i) => i * 120)],
    trips: [],
    ...over,
  };
}

/** Red mínima: una línea con ida y vuelta, cada 10 min de 06:00 a 22:00 en feiners. */
export function tinyNetwork(extra: Partial<NetworkData> = {}): NetworkData {
  const deps: [number, number][] = [];
  for (let s = 6 * 3600; s <= 22 * 3600; s += 600) deps.push([s, 0]);
  const fwd = makePattern({ id: 'X1-a', routeId: 'X1', trips: deps });
  const back = makePattern({
    id: 'X1-b',
    routeId: 'X1',
    dir: 1,
    origin: 'B',
    headsign: 'A',
    coords: [...fwd.coords].reverse(),
    stopIds: [...fwd.stopIds].reverse(),
    trips: deps.map(([s]) => [s + 300, 0]),
  });
  const stops = fwd.stopIds.map((id, i) => ({ id, name: `Parada ${i}`, lon: fwd.coords[i * 2]![0], lat: 41.55, routes: ['X1'] }));
  return {
    version: 'test',
    builtAt: '2026-10-06',
    timezone: 'Europe/Madrid',
    sources: [],
    routes: [{ id: 'X1', ref: 'X1', longName: 'A - B', color: '#e63027', textColor: '#FFFFFF', kind: 'diurna', order: 1, agency: 'TUS' }],
    stops,
    patterns: [fwd, back],
    holidays: [{ date: '2026-10-12', name: 'Festa Nacional', scope: 'estatal' }],
    alerts: [],
    holidaysPending: [],
    ...extra,
  };
}

/** Instante local Europe/Madrid como epoch ms. */
export function local(iso: string): number {
  // iso sin zona: "2026-10-06T08:00"
  const d = new Date(`${iso}:00Z`);
  // offset de Madrid para esa fecha (CET +1 / CEST +2)
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' });
  for (const off of [2, 1]) {
    const t = d.getTime() - off * 3600_000;
    if (Number(fmt.format(new Date(t))) === d.getUTCHours()) return t;
  }
  return d.getTime() - 3600_000;
}
