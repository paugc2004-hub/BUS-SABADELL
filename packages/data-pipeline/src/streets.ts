/**
 * Índex de carrers per al planificador («on vas?»): data/raw/osm/roads-*.json → apps/web/public/data/streets.json.
 *
 * - Només carrers amb nom i a l'abast de la xarxa (algun punt a menys de ~1 km a peu d'una parada).
 * - Un carrer amb el mateix nom en llocs diferents (p. ex. «Carrer Major» de Sabadell i de Barberà) són entrades separades.
 * - Cada carrer es guarda com a punts cada ~60 m: el planificador hi arriba pel punt més proper a la parada.
 * - Municipi: dels límits administratius d'OSM (data/raw/osm/municipis-*.json) si hi són; si no, la parada més propera.
 *
 * Font: © OpenStreetMap contributors (ODbL). S'executa amb `pnpm data:streets` (i al final de `pnpm data:build`).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversine, normalize, type LonLat, type NetworkData } from '@bus/core';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const OSM = join(ROOT, 'data/raw/osm');
const OUT = join(ROOT, 'apps/web/public/data/streets.json');

/** vies que no són un destí a peu */
const SKIP = /^(motorway|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/;
const STEP_M = 60;
/** a menys d'aquests metres en línia recta d'alguna parada (≈ 1,1 km a peu) */
const REACH_M = 850;
/** trossos del mateix nom més lluny que això són carrers diferents */
const SAME_STREET_M = 450;

interface Way {
  tags?: { name?: string; highway?: string };
  geometry?: { lat: number; lon: number }[];
}

export interface StreetEntry {
  id: string;
  name: string;
  /** municipi (si es coneix) */
  muni: string | null;
  /** parada de referència, per distingir-los */
  near: string;
  /** punts [lon, lat, lon, lat, …] amb 5 decimals */
  pts: number[];
}

const latest = (re: RegExp) =>
  readdirSync(OSM)
    .filter((f) => re.test(f))
    .sort()
    .pop();

function resample(g: LonLat[]): LonLat[] {
  const out: LonLat[] = [g[0]!];
  let acc = 0;
  for (let i = 1; i < g.length; i++) {
    const a = g[i - 1]!;
    const b = g[i]!;
    const d = haversine(a, b);
    let t = STEP_M - acc;
    while (t < d) {
      const f = t / d;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      t += STEP_M;
    }
    acc = (acc + d) % STEP_M;
  }
  out.push(g[g.length - 1]!);
  return out;
}

/** Polígons dels municipis (anells exteriors encadenats), si s'han descarregat amb geometria. */
function loadMunicipalities(): { name: string; rings: LonLat[][] }[] {
  const f = latest(/^municipis-.*\.json$/);
  if (!f) return [];
  const data = JSON.parse(readFileSync(join(OSM, f), 'utf8')) as {
    elements: { tags: { name: string }; members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[] }[];
  };
  const out: { name: string; rings: LonLat[][] }[] = [];
  for (const rel of data.elements) {
    const parts = (rel.members ?? []).filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry?.length).map((m) => m.geometry!.map((p) => [p.lon, p.lat] as LonLat));
    if (parts.length === 0) continue;
    // encadena els trossos en anells
    const rings: LonLat[][] = [];
    const left = [...parts];
    while (left.length) {
      const ring = [...left.shift()!];
      let grew = true;
      while (grew) {
        grew = false;
        const end = ring[ring.length - 1]!;
        for (let i = 0; i < left.length; i++) {
          const w = left[i]!;
          const same = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
          if (same(w[0]!, end)) ring.push(...w.slice(1));
          else if (same(w[w.length - 1]!, end)) ring.push(...[...w].reverse().slice(1));
          else continue;
          left.splice(i, 1);
          grew = true;
          break;
        }
      }
      rings.push(ring);
    }
    out.push({ name: rel.tags.name, rings });
  }
  return out;
}

function inRing(p: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function buildStreets(net: NetworkData): { streets: StreetEntry[]; munis: number } {
  const f = latest(/^roads-.*\.json$/);
  if (!f) throw new Error('falta data/raw/osm/roads-*.json (pnpm data:refresh)');
  const ways = (JSON.parse(readFileSync(join(OSM, f), 'utf8')) as { elements: Way[] }).elements;
  const stops = net.stops.map((s) => ({ name: s.name, p: [s.lon, s.lat] as LonLat }));
  const munis = loadMunicipalities();

  // per nom: grups de trossos propers
  const byName = new Map<string, { name: string; groups: LonLat[][] }>();
  for (const w of ways) {
    const name = w.tags?.name?.trim();
    if (!name || !w.geometry || w.geometry.length < 2 || SKIP.test(w.tags?.highway ?? '')) continue;
    const pts = resample(w.geometry.map((g) => [g.lon, g.lat] as LonLat));
    const key = normalize(name);
    const entry = byName.get(key) ?? { name, groups: [] };
    byName.set(key, entry);
    const near = entry.groups.filter((g) => g.some((a) => pts.some((b) => haversine(a, b) < SAME_STREET_M)));
    if (near.length === 0) entry.groups.push(pts);
    else {
      // uneix tots els grups que toca
      const merged = near.flat().concat(pts);
      entry.groups = entry.groups.filter((g) => !near.includes(g)).concat([merged]);
    }
  }

  const streets: StreetEntry[] = [];
  for (const { name, groups } of byName.values()) {
    for (const g of groups) {
      // sense duplicats a menys de 25 m
      const pts: LonLat[] = [];
      for (const p of g) if (!pts.some((q) => haversine(p, q) < 25)) pts.push(p);
      // a l'abast de la xarxa?
      let best = Infinity;
      let nearName = '';
      const c: LonLat = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
      for (const s of stops) {
        for (const p of pts) {
          const d = haversine(p, s.p);
          if (d < best) best = d;
        }
      }
      if (best > REACH_M) continue;
      let cd = Infinity;
      for (const s of stops) {
        const d = haversine(c, s.p);
        if (d < cd) {
          cd = d;
          nearName = s.name;
        }
      }
      const muni = munis.find((m) => m.rings.some((r) => inRing(c, r)))?.name ?? null;
      streets.push({ id: '', name, muni, near: nearName, pts: pts.flatMap((p) => [+p[0].toFixed(5), +p[1].toFixed(5)]) });
    }
  }
  streets.sort((a, b) => a.name.localeCompare(b.name, 'ca') || (a.muni ?? '').localeCompare(b.muni ?? '') || a.near.localeCompare(b.near, 'ca'));
  streets.forEach((s, i) => (s.id = String(i + 1)));
  return { streets, munis: munis.length };
}

export function writeStreets(net: NetworkData) {
  const { streets, munis } = buildStreets(net);
  const roads = latest(/^roads-.*\.json$/)!;
  const body = {
    version: net.version,
    source: { name: 'OpenStreetMap', license: 'ODbL · © OpenStreetMap contributors', file: roads },
    streets,
  };
  writeFileSync(OUT, JSON.stringify(body));
  const kb = Math.round(JSON.stringify(body).length / 1024);
  console.log(`✔ streets.json: ${streets.length} carrers (${kb} KB)${munis ? `, municipis de ${munis} límits` : ', sense límits municipals (es fa servir la parada més propera)'}`);
}

// execució directa: pnpm data:streets
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const netFile = join(ROOT, 'apps/web/public/data/network.json');
  if (!existsSync(netFile)) throw new Error('falta network.json (pnpm data:build)');
  writeStreets(JSON.parse(readFileSync(netFile, 'utf8')) as NetworkData);
}
