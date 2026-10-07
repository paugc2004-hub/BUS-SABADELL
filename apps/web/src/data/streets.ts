/**
 * Carrers i llocs (equipaments, clubs, escoles, comerços, estacions, barris…) de Sabadell i voltants,
 * d'OpenStreetMap, per al planificador. `streets.json` (~130 KB gzip) es baixa la primera vegada que es
 * cerca, no abans. La cerca es fa al dispositiu: el que escrius no surt d'aquí.
 */
import { normalize, type LonLat } from '@bus/core';

export interface Street {
  id: string;
  name: string;
  muni: string | null;
  near: string;
  barri?: string;
  pts: LonLat[];
}

export interface Place {
  id: string;
  name: string;
  /** tipus (la UI el tradueix): stadium, pool, school, hospital… */
  kind: string;
  muni: string | null;
  near: string;
  barri?: string;
  alt?: string;
  pt: LonLat;
}

interface Indexed {
  /** paraules del nom i dels àlies */
  tokens: string[];
  /** paraules del barri (només ajuden si el nom ja coincideix en part) */
  ctx: string[];
  norm: string;
}

export type IndexedStreet = Street & Indexed;
export type IndexedPlace = Place & Indexed & { kindWords: string[] };
export interface Gazetteer {
  streets: IndexedStreet[];
  places: IndexedPlace[];
}

/** paraules que no distingeixen un lloc (tipus de via, articles); en català i en castellà */
const NOISE = new Set(
  'carrer calle c cl avinguda avenida av avda passeig paseo pg placa plaza pl placeta ronda via cami camino travessera travesia passatge pasaje ptge pje carretera ctra baixada bajada de del dels la les el els l d i en na lo los las y'.split(' '),
);
/** castellà / formes curtes → com és a OSM */
const ALIAS: Record<string, string> = { san: 'sant', natacion: 'natacio', estadio: 'estadi', campo: 'camp', piscinas: 'piscines', colegio: 'escola', instituto: 'institut', ayuntamiento: 'ajuntament', estacion: 'estacio', mercado: 'mercat', parque: 'parc', iglesia: 'esglesia', biblioteca: 'biblioteca', club: 'club', cn: 'cn', ce: 'ce' };

const tokensOf = (s: string) =>
  normalize(s)
    .split(' ')
    .map((w) => ALIAS[w] ?? w)
    .filter((w) => w && !NOISE.has(w));

/** paraules que descriuen cada tipus de lloc (ca/es): «estació nord», «parc catalunya», «piscina can llong» */
const KIND_WORDS: Record<string, string> = {
  stadium: 'estadi camp futbol estadio campo',
  sports: 'poliesportiu pavello centre esportiu club polideportivo pabellon',
  pool: 'piscina piscines',
  pitch: 'camp pista futbol campo',
  gym: 'gimnas gimnasio',
  park: 'parc jardi parque jardin',
  train: 'estacio tren renfe rodalies fgc ferrocarrils estacion',
  busStation: 'estacio autobusos estacion autobuses',
  hospital: 'hospital',
  health: 'cap ambulatori centre salut metge ambulatorio',
  pharmacy: 'farmacia',
  school: 'escola institut col legi colegio instituto escuela',
  kindergarten: 'escola bressol guarderia',
  university: 'universitat universidad',
  library: 'biblioteca',
  townhall: 'ajuntament ayuntamiento',
  market: 'mercat mercado',
  mall: 'centre comercial centro',
  supermarket: 'supermercat supermercado',
  cemetery: 'cementiri cementerio',
  museum: 'museu museo',
  civic: 'centre civic casal centro civico',
  district: 'barri barrio',
};

type Raw = { streets: (Omit<Street, 'pts'> & { pts: number[] })[]; places?: Place[] };

/** Prepara l'índex de cerca a partir del JSON. */
export function indexGazetteer(d: Raw): Gazetteer {
  return {
    streets: d.streets.map((s) => {
      const pts: LonLat[] = [];
      for (let i = 0; i < s.pts.length; i += 2) pts.push([s.pts[i]!, s.pts[i + 1]!]);
      return { ...s, pts, tokens: tokensOf(s.name), ctx: tokensOf(s.barri ?? ''), norm: normalize(s.name) };
    }),
    places: (d.places ?? []).map((p) => ({ ...p, tokens: tokensOf(`${p.name} ${p.alt ?? ''}`), ctx: tokensOf(`${p.barri ?? ''} ${p.near} ${KIND_WORDS[p.kind] ?? ''}`), kindWords: tokensOf(KIND_WORDS[p.kind] ?? ''), norm: normalize(`${p.name} ${p.alt ?? ''}`) })),
  };
}

let cache: Promise<Gazetteer> | null = null;

export function loadStreets(): Promise<Gazetteer> {
  cache ??= fetch('/data/streets.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Raw>;
    })
    .then(indexGazetteer)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

export const streetById = (g: Gazetteer, id: string) => g.streets.find((s) => s.id === id);
export const placeById = (g: Gazetteer, id: string) => g.places.find((s) => s.id === id);

/** tipus de lloc que la gent busca més: pugen a la llista */
const IMPORTANT = new Set(['stadium', 'sports', 'pool', 'pitch', 'hospital', 'train', 'busStation', 'university', 'school', 'townhall', 'market', 'mall', 'park', 'district', 'library', 'culture', 'civic', 'museum', 'health', 'cemetery']);

function score<T extends Indexed>(x: T, qt: string[], nq: string): number | null {
  let inName = 0;
  let kind = 0;
  const kw = (x as Partial<IndexedPlace>).kindWords ?? [];
  for (const w of qt) {
    if (x.tokens.some((t) => t.startsWith(w))) inName++;
    else if (kw.includes(w)) kind++;
    else if (!x.ctx.some((t) => t.startsWith(w))) return null;
  }
  // el barri sol no basta («can llong» no dona tots els llocs del barri); amb el tipus sí («piscina can llong»)
  if (inName === 0 && (kind === 0 || kind === qt.length)) return null;
  const whole = qt.filter((w) => x.tokens.includes(w)).length;
  return inName * 12 + kind * 8 + whole * 6 + (x.norm.includes(nq) ? 8 : 0) + (x.tokens[0]?.startsWith(qt[0]!) ? 4 : 0) - x.tokens.length * 0.5;
}

/** Cerca per paraules (en qualsevol ordre, prefixos): «sant pere», «c/ sant pere», «natació can llong», «camp del mercantil». */
export function searchPlaces(g: Gazetteer, q: string, limit = 5): { streets: Street[]; places: Place[] } {
  const qt = tokensOf(q);
  const nq = normalize(q);
  if (qt.length === 0) return { streets: [], places: [] };
  const rank = <T extends Indexed & { name: string }>(list: T[], bonus: (x: T) => number) =>
    list
      .flatMap((x) => {
        const s = score(x, qt, nq);
        return s === null ? [] : [{ x, s: s + bonus(x) }];
      })
      .sort((a, b) => b.s - a.s || a.x.name.localeCompare(b.x.name, 'ca'))
      .slice(0, limit)
      .map((h) => h.x);
  // el tipus de lloc que s'ha escrit («parc», «estació»…) compta molt
  return { streets: rank(g.streets, () => 0), places: rank(g.places, (p) => (IMPORTANT.has(p.kind) ? 3 : 0) + (qt.some((w) => p.kindWords.includes(w)) ? 14 : 0)) };
}
