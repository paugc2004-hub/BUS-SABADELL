/**
 * Cerca global: línies, parades i destinacions, tolerant a accents, majúscules,
 * abreviatures ("pl." = plaça) i ordre de paraules.
 */
import { collator, normalize, type NetworkData, type Route, type Stop } from '@bus/core';

export interface SearchResults {
  routes: Route[];
  /** una entrada per zona de parada (no un resultat per cada pal) */
  stops: { stop: Stop; poles: number; routes: string[] }[];
  /** destinacions: capçaleres de destí amb les línies que hi van */
  destinations: { name: string; routes: string[] }[];
}

const empty: SearchResults = { routes: [], stops: [], destinations: [] };

export function searchAll(net: NetworkData, q: string, areaOf: (id: string) => string[]): SearchResults {
  const nq = normalize(q);
  if (!nq) return empty;
  const tokens = nq.split(' ').filter(Boolean);
  const has = (text: string) => {
    const n = normalize(text);
    return tokens.every((tk) => n.includes(tk));
  };
  // "2", "l2", "L 2" → L2
  const code = nq.replace(/\s+/g, '').replace(/^l(?=\d)/, '').toUpperCase();
  const routes = net.routes
    .filter((r) => r.ref.replace(/^L/, '') === code || r.ref === code || has(`${r.ref} ${r.longName}`))
    .sort((a, b) => Number(b.ref.replace(/^L/, '') === code || b.ref === code) - Number(a.ref.replace(/^L/, '') === code || a.ref === code) || a.order - b.order)
    .slice(0, 6);

  const seenArea = new Set<string>();
  const stops: SearchResults['stops'] = [];
  const cand = net.stops
    .filter((s) => has(s.name) || s.id === q.trim())
    .sort((a, b) => Number(normalize(b.name).startsWith(nq)) - Number(normalize(a.name).startsWith(nq)) || b.routes.length - a.routes.length || collator.compare(a.name, b.name));
  for (const s of cand) {
    const area = areaOf(s.id);
    const key = [...area].sort().join(',');
    if (seenArea.has(key)) continue;
    seenArea.add(key);
    const all = new Set(area.flatMap((id) => net.stops.find((x) => x.id === id)?.routes ?? []));
    stops.push({ stop: s, poles: area.length, routes: [...all] });
    if (stops.length >= 8) break;
  }

  const dest = new Map<string, Set<string>>();
  for (const p of net.patterns) {
    if (!p.trips.length || !has(p.headsign)) continue;
    const k = p.headsign;
    dest.set(k, (dest.get(k) ?? new Set()).add(p.routeId));
  }
  const destinations = [...dest.entries()]
    .map(([name, rs]) => ({ name, routes: [...rs].sort((a, b) => (net.routes.find((r) => r.id === a)?.order ?? 0) - (net.routes.find((r) => r.id === b)?.order ?? 0)) }))
    .sort((a, b) => collator.compare(a.name, b.name))
    .slice(0, 5);
  return { routes, stops, destinations };
}
