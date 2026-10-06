/**
 * Sentits únics: el bus no pot anar en contra d'un carrer de sentit únic d'OSM,
 * llevat que el carrer tingui excepció per a bus (oneway:bus=no, oneway:psv=no,
 * busway=opposite_lane, carril bus a contrasentit).
 *
 * Per a cada punt del recorregut (cada 10 m) es miren els trams de carrer propers
 * alineats amb la marxa (± 40°, en qualsevol dels dos sentits). Si n'hi ha algun que
 * permet circular en el sentit del bus, és correcte; si tots els alineats són de sentit
 * únic al revés, és un contrasentit. Les calçades separades (dos carrers de sentit únic
 * paral·lels) no donen falsos positius perquè n'hi ha prou que un dels dos ho permeti.
 */
import { bearing, pointAlong, type LonLat, type Pattern } from '@bus/core';

export interface RoadWay {
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Sentits permesos per a un bus respecte de l'ordre dels nodes del carrer. */
export function busDirections(tags: Record<string, string> = {}): { fwd: boolean; back: boolean } {
  const yes = (v?: string) => v === 'yes' || v === 'true' || v === '1';
  const exempt =
    tags['oneway:bus'] === 'no' ||
    tags['oneway:psv'] === 'no' ||
    /opposite/.test(tags.busway ?? '') ||
    /opposite/.test(tags['busway:left'] ?? '') ||
    /opposite/.test(tags['busway:right'] ?? '') ||
    /opposite/.test(tags['busway:both'] ?? '') ||
    Number(tags['lanes:bus:backward'] ?? tags['lanes:psv:backward'] ?? 0) > 0;
  if (exempt) return { fwd: true, back: true };
  const o = tags['oneway:bus'] ?? tags['oneway:psv'] ?? tags.oneway;
  if (o === '-1' || o === 'reverse') return { fwd: false, back: true };
  if (yes(o)) return { fwd: true, back: false };
  if (o === 'no') return { fwd: true, back: true };
  // implícits: rotondes i autopistes
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return { fwd: true, back: false };
  if (/^motorway/.test(tags.highway ?? '')) return { fwd: true, back: false };
  return { fwd: true, back: true };
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  brg: number;
  fwd: boolean;
  back: boolean;
  name: string;
}

export class DirectedGrid {
  private cells = new Map<string, number[]>();
  private segs: Seg[] = [];
  private readonly kx: number;
  private readonly ky = 110540;
  constructor(
    lat0: number,
    private readonly cell = 50,
  ) {
    this.kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
  }
  private xy(p: LonLat): [number, number] {
    return [p[0] * this.kx, p[1] * this.ky];
  }
  addWay(w: RoadWay) {
    const g = w.geometry ?? [];
    const d = busDirections(w.tags);
    const name = w.tags?.name ?? w.tags?.highway ?? '';
    for (let i = 0; i < g.length - 1; i++) {
      const a: LonLat = [g[i]!.lon, g[i]!.lat];
      const b: LonLat = [g[i + 1]!.lon, g[i + 1]!.lat];
      const [ax, ay] = this.xy(a);
      const [bx, by] = this.xy(b);
      const k = this.segs.push({ ax, ay, bx, by, brg: bearing(a, b), fwd: d.fwd, back: d.back, name }) - 1;
      const c = this.cell;
      for (let x = Math.floor(Math.min(ax, bx) / c); x <= Math.floor(Math.max(ax, bx) / c); x++)
        for (let y = Math.floor(Math.min(ay, by) / c); y <= Math.floor(Math.max(ay, by) / c); y++) {
          const key = `${x},${y}`;
          const arr = this.cells.get(key);
          if (arr) arr.push(k);
          else this.cells.set(key, [k]);
        }
    }
  }
  /** null: no hi ha cap carrer alineat a prop · true: permès · false: contrasentit */
  allows(p: LonLat, travel: number, radius = 12): { ok: boolean | null; street: string } {
    const [px, py] = this.xy(p);
    const cx = Math.floor(px / this.cell);
    const cy = Math.floor(py / this.cell);
    let aligned = 0;
    let street = '';
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        for (const i of this.cells.get(`${x},${y}`) ?? []) {
          const s = this.segs[i]!;
          const dx = s.bx - s.ax;
          const dy = s.by - s.ay;
          const l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2)) : 0;
          if (Math.hypot(px - s.ax - t * dx, py - s.ay - t * dy) > radius) continue;
          const diff = Math.abs(((travel - s.brg + 540) % 360) - 180);
          if (diff <= 40) {
            aligned++;
            if (s.fwd) return { ok: true, street: s.name };
            street = s.name;
          } else if (diff >= 140) {
            aligned++;
            if (s.back) return { ok: true, street: s.name };
            street = s.name;
          }
        }
    return { ok: aligned ? false : null, street };
  }
}

export interface ContraflowRun {
  fromM: number;
  lengthM: number;
  at: LonLat;
  street: string;
}

/** Trams del recorregut que van en contra d'un sentit únic. */
export function contraflow(p: Pattern, grid: DirectedGrid, step = 10, from?: number, to?: number): ContraflowRun[] {
  const runs: ContraflowRun[] = [];
  const a = from ?? p.stopDist[0] ?? 0;
  const b = to ?? p.stopDist[p.stopDist.length - 1] ?? p.length;
  let cur: ContraflowRun | null = null;
  for (let d = a + 5; d <= b - 5; d += step) {
    const here = pointAlong(p.coords, p.cum, d);
    const travel = bearing(pointAlong(p.coords, p.cum, d - 5), pointAlong(p.coords, p.cum, d + 5));
    const r = grid.allows(here, travel);
    if (r.ok === false) {
      if (cur) cur.lengthM += step;
      else cur = { fromM: Math.round(d), lengthM: step, at: here, street: r.street };
    } else if (r.ok === true && cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

/** Tots els carrers de data/raw/osm/roads-*.json amb el seu sentit per a bus. */
export function directedGridFrom(ways: RoadWay[], lat0 = 41.55): DirectedGrid {
  const g = new DirectedGrid(lat0);
  for (const w of ways) g.addWay(w);
  return g;
}

/** a partir d'aquests metres seguits a contrasentit, la variant és errònia */
export const CONTRAFLOW_ERR_M = 40;
