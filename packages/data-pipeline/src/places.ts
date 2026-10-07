/**
 * Llocs amb nom per al planificador («vull anar al Club Natació Can Llong», «a l'estadi»…):
 * data/raw/osm/llocs-*.json (Overpass, `q-llocs.overpass`) → `places` dins apps/web/public/data/streets.json.
 *
 * - Només llocs d'un tipus conegut (equipaments, esport, salut, educació, comerços, estacions, barris…).
 * - Només a l'abast de la xarxa (a menys de ~850 m en línia recta d'una parada).
 * - Àlies: altres noms d'OSM (alt_name, short_name, official_name, operator…) i els de data/config/llocs-alias.yaml.
 * Font: © OpenStreetMap contributors (ODbL).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { haversine, normalize, type LonLat } from '@bus/core';

type Tags = Record<string, string>;

/** tipus de lloc (la UI el tradueix): de les etiquetes d'OSM */
export function kindOf(t: Tags): string | null {
  const l = t.leisure;
  const a = t.amenity;
  if (l === 'stadium' || t.building === 'stadium') return 'stadium';
  if (l === 'swimming_pool' || l === 'water_park' || /swimming/.test(t.sport ?? '') || (l === 'sports_centre' && /nataci/i.test(t.name ?? ''))) return 'pool';
  if (l === 'sports_centre' || l === 'sports_hall' || t.building === 'sports_hall') return 'sports';
  if (l === 'pitch' || l === 'track') return 'pitch';
  if (l === 'fitness_centre') return 'gym';
  if (l === 'park' || l === 'garden' || l === 'nature_reserve') return 'park';
  if (t.railway === 'station' || t.building === 'train_station' || (t.public_transport === 'station' && t.train === 'yes')) return 'train';
  if (a === 'bus_station') return 'busStation';
  if (a === 'hospital' || t.healthcare === 'hospital' || t.building === 'hospital') return 'hospital';
  if (a === 'clinic' || a === 'doctors' || t.healthcare === 'centre' || t.healthcare === 'clinic' || t.healthcare === 'doctor') return 'health';
  if (a === 'pharmacy') return 'pharmacy';
  if (a === 'school' || t.building === 'school') return 'school';
  if (a === 'kindergarten') return 'kindergarten';
  if (a === 'university' || a === 'college' || t.building === 'university') return 'university';
  if (a === 'library') return 'library';
  if (a === 'townhall' || (t.office === 'government' && /ajuntament/i.test(t.name ?? ''))) return 'townhall';
  if (t.office === 'government' || a === 'courthouse') return 'government';
  if (a === 'police') return 'police';
  if (a === 'fire_station') return 'fire';
  if (a === 'theatre' || a === 'cinema' || a === 'arts_centre') return 'culture';
  if (a === 'community_centre' || a === 'social_centre' || t.building === 'civic') return 'civic';
  if (a === 'social_facility' || a === 'nursing_home') return 'social';
  if (a === 'marketplace') return 'market';
  if (a === 'place_of_worship' || t.building === 'church' || t.landuse === 'religious') return 'worship';
  if (a === 'post_office') return 'post';
  if (a === 'restaurant' || a === 'cafe' || a === 'bar' || a === 'fast_food' || a === 'pub' || a === 'ice_cream') return 'food';
  if (a === 'bank') return 'bank';
  if (a === 'fuel') return 'fuel';
  if (a === 'parking') return 'parking';
  if (t.tourism === 'museum') return 'museum';
  if (t.tourism === 'hotel' || t.tourism === 'hostel' || t.tourism === 'guest_house') return 'hotel';
  if (t.tourism === 'attraction' || t.tourism === 'viewpoint' || t.historic) return 'sight';
  if (t.shop === 'supermarket') return 'supermarket';
  if (t.shop === 'mall' || t.landuse === 'retail') return 'mall';
  if (t.shop) return 'shop';
  if (t.landuse === 'cemetery' || a === 'grave_yard') return 'cemetery';
  if (t.place === 'neighbourhood' || t.place === 'suburb' || t.place === 'quarter') return 'district';
  if (t.club || t.sport) return 'club';
  if (t.office === 'association') return 'civic';
  return null;
}

export interface PlaceEntry {
  id: string;
  name: string;
  kind: string;
  muni: string | null;
  near: string;
  /** [lon, lat] amb 5 decimals */
  pt: [number, number];
  /** altres noms, per a la cerca */
  alt?: string;
  /** barri (OSM), per a la cerca: «natació can llong» */
  barri?: string;
}

export interface Barri {
  name: string;
  p: LonLat;
}

/** Barris d'OSM (place=neighbourhood|quarter|suburb) del fitxer de llocs. */
export function loadBarris(osmDir: string): Barri[] {
  const f = readdirSync(osmDir)
    .filter((x) => /^llocs-.*\.json$/.test(x))
    .sort()
    .pop();
  if (!f) return [];
  const els = (JSON.parse(readFileSync(join(osmDir, f), 'utf8')) as { elements: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }[] }).elements;
  return els.flatMap((e) => {
    const c = e.center ?? (e.lat !== undefined ? { lat: e.lat, lon: e.lon! } : null);
    return c && e.tags?.name && /^(neighbourhood|quarter|suburb)$/.test(e.tags.place ?? '') ? [{ name: e.tags.name, p: [c.lon, c.lat] as LonLat }] : [];
  });
}

export function barriOf(barris: Barri[], p: LonLat): string | undefined {
  let best = 900;
  let name: string | undefined;
  for (const b of barris) {
    const d = haversine(p, b.p);
    if (d < best) {
      best = d;
      name = b.name;
    }
  }
  return name;
}

const REACH_M = 850;

export function buildPlaces(osmDir: string, configDir: string, stops: { name: string; p: LonLat }[], muniOf: (p: LonLat) => string | null, barris: Barri[]): PlaceEntry[] {
  const f = readdirSync(osmDir)
    .filter((x) => /^llocs-.*\.json$/.test(x))
    .sort()
    .pop();
  if (!f) return [];
  const els = (JSON.parse(readFileSync(join(osmDir, f), 'utf8')) as { elements: { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }[] }).elements;
  const aliasFile = join(configDir, 'llocs-alias.yaml');
  const aliases = existsSync(aliasFile) ? ((parse(readFileSync(aliasFile, 'utf8')) as { llocs?: { nom: string; alies: string[] }[] }).llocs ?? []) : [];

  const out: PlaceEntry[] = [];
  for (const e of els) {
    const t = e.tags ?? {};
    const name = t.name?.trim();
    const c = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!name || !c) continue;
    const kind = kindOf(t);
    if (!kind) continue;
    const p: LonLat = [c.lon, c.lat];
    let best = Infinity;
    let near = '';
    for (const s of stops) {
      const d = haversine(p, s.p);
      if (d < best) {
        best = d;
        near = s.name;
      }
    }
    if (best > REACH_M) continue;
    // el mateix lloc pot ser un node i una àrea: un sol resultat
    if (out.some((o) => o.kind === kind && normalize(o.name) === normalize(name) && haversine(o.pt, p) < 200)) continue;
    const alt = [t.alt_name, t.short_name, t.official_name, t['name:ca'], t['name:es'], t.old_name, t.operator, t.brand, ...aliases.filter((a) => normalize(a.nom) === normalize(name)).flatMap((a) => a.alies)]
      .filter((x): x is string => Boolean(x) && normalize(x!) !== normalize(name))
      .join(' · ');
    const barri = kind === 'district' ? undefined : barriOf(barris, p);
    out.push({ id: '', name, kind, muni: muniOf(p), near, pt: [+p[0].toFixed(5), +p[1].toFixed(5)], ...(alt ? { alt } : {}), ...(barri ? { barri } : {}) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ca') || a.near.localeCompare(b.near, 'ca'));
  out.forEach((p, i) => (p.id = String(i + 1)));
  return out;
}
