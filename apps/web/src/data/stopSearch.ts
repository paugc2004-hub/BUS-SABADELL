/**
 * Cerca de parades pel codi o el nom (paritat amb «Buscar parada por código, nombre o QR» de l'app de TUS).
 * Un codi exacte va primer (és el número de la marquesina); després, coincidències de nom sense accents.
 * Cada pal és una parada amb el seu codi (p. ex. 19 i 43 són els dos pals de Casal Pere Quart).
 */
import { haversine, normalize, type SimEngine, type Stop } from '@bus/core';

export interface StopHit {
  stop: Stop;
  /** distància a la posició de l'usuari (m), si se sap */
  m: number | null;
}

export function findStops(engine: SimEngine, query: string, pos: [number, number] | null, limit = 20): StopHit[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalize(q);
  const tokens = nq.split(/\s+/).filter(Boolean);
  const all = [...engine.stops.values()];
  const dist = (s: Stop) => (pos ? haversine(pos, [s.lon, s.lat]) : null);
  const exact = engine.stops.get(q);
  const byCode = /^\d+$/.test(q) ? all.filter((s) => s.id !== q && s.id.startsWith(q)).sort((a, b) => a.id.length - b.id.length || Number(a.id) - Number(b.id)) : [];
  const byName = all
    .filter((s) => s.id !== q && !byCode.includes(s) && tokens.every((tk) => normalize(s.name).includes(tk)))
    .sort((a, b) => {
      const pa = normalize(a.name).startsWith(nq) ? 0 : 1;
      const pb = normalize(b.name).startsWith(nq) ? 0 : 1;
      return pa - pb || (dist(a) ?? 0) - (dist(b) ?? 0) || a.name.localeCompare(b.name) || Number(a.id) - Number(b.id);
    });
  return [...(exact ? [exact] : []), ...byCode, ...byName].slice(0, limit).map((stop) => ({ stop, m: dist(stop) }));
}

/** Les parades més properes (cada pal, amb el seu codi). */
export function nearStops(engine: SimEngine, pos: [number, number], n = 4, maxM = 800): StopHit[] {
  return [...engine.stops.values()]
    .map((stop) => ({ stop, m: haversine(pos, [stop.lon, stop.lat]) }))
    .filter((h) => h.m <= maxM)
    .sort((a, b) => a.m - b.m)
    .slice(0, n);
}
