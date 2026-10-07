/**
 * Carrers de Sabadell i voltants (OSM) per al planificador. `streets.json` (~90 KB gzip) es baixa
 * la primera vegada que es cerca, no abans. La cerca es fa al dispositiu: el que escrius no surt d'aquí.
 */
import { normalize, type LonLat } from '@bus/core';

export interface Street {
  id: string;
  name: string;
  muni: string | null;
  near: string;
  pts: LonLat[];
}

interface Indexed extends Street {
  tokens: string[];
  norm: string;
}

/** paraules que no distingeixen un carrer (tipus de via, articles); en català i en castellà */
const NOISE = new Set(
  'carrer calle c cl avinguda avenida av avda passeig paseo pg pº placa plaza pl placeta ronda via cami camino travessera travesia passatge pasaje ptge pje carretera ctra baixada bajada rambla de del dels la les el els l d i en na lo los las y'.split(' '),
);
/** «san» (castellà) → «sant» */
const ALIAS: Record<string, string> = { san: 'sant', santa: 'santa', calle: 'carrer' };

const tokensOf = (s: string) =>
  normalize(s)
    .split(' ')
    .map((w) => ALIAS[w] ?? w)
    .filter((w) => w && !NOISE.has(w));

let cache: Promise<Indexed[]> | null = null;

export function loadStreets(): Promise<Indexed[]> {
  cache ??= fetch('/data/streets.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ streets: (Omit<Street, 'pts'> & { pts: number[] })[] }>;
    })
    .then((d) =>
      d.streets.map((s) => {
        const pts: LonLat[] = [];
        for (let i = 0; i < s.pts.length; i += 2) pts.push([s.pts[i]!, s.pts[i + 1]!]);
        return { ...s, pts, tokens: tokensOf(s.name), norm: normalize(s.name) };
      }),
    )
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export function streetById(list: Street[], id: string): Street | undefined {
  return list.find((s) => s.id === id);
}

/** Cerca per paraules (en qualsevol ordre, prefixos): «sant pere», «c/ sant pere», «calle san pere». */
export function searchStreets(list: Indexed[], q: string, limit = 6): Street[] {
  const qt = tokensOf(q);
  const nq = normalize(q);
  if (qt.length === 0) return [];
  const hits: { s: Indexed; score: number }[] = [];
  for (const s of list) {
    if (!qt.every((w) => s.tokens.some((t) => t.startsWith(w)))) continue;
    // millor: totes les paraules senceres, el nom comença igual, noms curts
    const whole = qt.filter((w) => s.tokens.includes(w)).length;
    const score = whole * 10 + (s.norm.includes(nq) ? 6 : 0) + (s.tokens[0]?.startsWith(qt[0]!) ? 4 : 0) - s.tokens.length;
    hits.push({ s, score });
  }
  hits.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, 'ca'));
  return hits.slice(0, limit).map((h) => h.s);
}

/** Text curt per distingir carrers amb el mateix nom. */
export const streetWhere = (s: Street) => s.muni ?? s.near;
