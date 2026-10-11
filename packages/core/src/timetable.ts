/**
 * Horari teòric (publicat) per parada i per tipus de dia, i freqüències d'una línia.
 * Licitació 2024, PPT §2.2.1: «consultar – i imprimir – informació de les freqüències segons el tipus de dia,
 * així com dels horaris de pas teòrics per les diferents parades».
 *
 * Són les hores de pas de l'horari (expedició + perfil de temps de la variant), sense retards simulats.
 * Segons des de l'inici del dia de servei (poden passar de 24 h).
 */
import type { DayType, Pattern } from './types.ts';

export interface StopDepartures {
  routeId: string;
  dir: number;
  headsign: string;
  /** segons del dia de servei, ordenats */
  times: number[];
}

/** Hores de pas teòriques per una parada (totes les línies, o una), agrupades per línia i destinació. */
export function stopTimetable(patterns: readonly Pattern[], stopId: string, dayType: DayType, routeId?: string): StopDepartures[] {
  const groups = new Map<string, StopDepartures>();
  for (const p of patterns) {
    if (p.dayType !== dayType || (routeId && p.routeId !== routeId)) continue;
    const last = p.stopIds.length - 1;
    p.stopIds.forEach((sid, i) => {
      // a la darrera parada el bus arriba, no surt (excepte en circulars, on torna a començar)
      if (sid !== stopId || (i === last && !p.circular)) return;
      const key = `${p.routeId}|${p.dir}|${p.headsign}`;
      const g = groups.get(key) ?? { routeId: p.routeId, dir: p.dir, headsign: p.headsign, times: [] };
      for (const [dep, k] of p.trips) {
        const off = p.profiles[k]?.[i];
        if (off !== undefined) g.times.push(dep + off);
      }
      groups.set(key, g);
    });
  }
  return [...groups.values()]
    .map((g) => ({ ...g, times: [...new Set(g.times)].sort((a, b) => a - b) }))
    .filter((g) => g.times.length > 0)
    .sort((a, b) => a.routeId.localeCompare(b.routeId, 'ca', { numeric: true }) || a.dir - b.dir || a.headsign.localeCompare(b.headsign));
}

export interface Frequency {
  dayType: DayType;
  dir: number;
  headsign: string;
  trips: number;
  /** primera i darrera sortida de capçalera (s del dia de servei) */
  first: number;
  last: number;
  /** interval habitual entre busos (mediana, minuts) de 7 a 21 h; null si hi ha menys de 3 sortides */
  headwayMin: number | null;
}

/** Freqüències d'una línia per tipus de dia i sentit, a partir de les sortides de capçalera. */
export function routeFrequencies(patterns: readonly Pattern[], routeId: string): Frequency[] {
  const groups = new Map<string, { dayType: DayType; dir: number; headsign: string; deps: number[] }>();
  for (const p of patterns) {
    if (p.routeId !== routeId || !p.trips.length) continue;
    const key = `${p.dayType}|${p.dir}`;
    const g = groups.get(key) ?? { dayType: p.dayType, dir: p.dir, headsign: p.headsign, deps: [] };
    // la destinació de referència és la de la variant amb més expedicions
    if (!groups.has(key) || p.trips.length > g.deps.length) g.headsign = p.headsign;
    for (const [dep] of p.trips) g.deps.push(dep);
    groups.set(key, g);
  }
  const order: Record<DayType, number> = { feiner: 0, dissabte: 1, festiu: 2 };
  return [...groups.values()]
    .map((g) => {
      const deps = [...new Set(g.deps)].sort((a, b) => a - b);
      const day = deps.filter((d) => d >= 7 * 3600 && d <= 21 * 3600);
      const gaps = day.slice(1).map((d, i) => d - day[i]!).sort((a, b) => a - b);
      const med = gaps.length >= 2 ? gaps[Math.floor(gaps.length / 2)]! : null;
      return { dayType: g.dayType, dir: g.dir, headsign: g.headsign, trips: deps.length, first: deps[0]!, last: deps.at(-1)!, headwayMin: med === null ? null : Math.round(med / 60) };
    })
    .sort((a, b) => order[a.dayType] - order[b.dayType] || a.dir - b.dir);
}

/** «07:05» a partir de segons del dia de servei (les hores > 24 h es mostren com 24:15, 25:02…, com al GTFS) */
export function hhmm(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
