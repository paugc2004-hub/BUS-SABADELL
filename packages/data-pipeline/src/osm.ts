/**
 * OSM: unión de ways de una relación de ruta en una LineString ordenada.
 * Se usa para contrastar la geometría de tus.es (informe de calidad) y como
 * respaldo si algún día tus.es no la publica.
 *
 * Algoritmo (bugs 12.1-1…3): respeta el orden de miembros; orienta cada way según
 * conecte con el anterior; las rotondas (ways cerrados) se recorren solo en el
 * arco entre entrada y salida; los huecos < 50 m se cosen en recto con aviso y los
 * mayores marcan la relación como rota.
 */
import { haversine, type LonLat } from '@bus/core';

export interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
export interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
export interface OsmRel {
  type: 'relation';
  id: number;
  tags: Record<string, string>;
  members: { type: 'node' | 'way' | 'relation'; ref: number; role: string }[];
}
export type OsmElement = OsmNode | OsmWay | OsmRel;

export interface StitchResult {
  coords: LonLat[];
  gaps: number[]; // metros de cada hueco
  broken: boolean;
  warnings: string[];
}

/** Arco de un way cerrado desde el nodo `from` hasta `to` siguiendo su sentido. */
function ringArc(nodes: number[], from: number, to: number): number[] {
  const ring = nodes.slice(0, -1);
  const i = ring.indexOf(from);
  const j = ring.indexOf(to);
  if (i < 0 || j < 0) return nodes;
  const out: number[] = [];
  for (let k = i; ; k = (k + 1) % ring.length) {
    out.push(ring[k]!);
    if (k === j) break;
    if (out.length > ring.length + 1) break;
  }
  return out;
}

export function stitchRelation(rel: OsmRel, ways: Map<number, OsmWay>, nodes: Map<number, OsmNode>): StitchResult {
  const members = rel.members.filter((m) => m.type === 'way' && !/platform/.test(m.role));
  const seq: number[][] = members.map((m) => ways.get(m.ref)?.nodes ?? []).filter((n) => n.length > 1);
  const warnings: string[] = [];
  const gaps: number[] = [];
  const out: number[] = [];
  const ll = (id: number): LonLat | null => {
    const n = nodes.get(id);
    return n ? [n.lon, n.lat] : null;
  };
  for (let i = 0; i < seq.length; i++) {
    let w = seq[i]!;
    const closed = w[0] === w[w.length - 1];
    const next = seq[i + 1];
    if (out.length === 0) {
      // orientar el primero según el segundo
      if (next && !closed && (next.includes(w[0]!) && !next.includes(w[w.length - 1]!))) w = [...w].reverse();
      out.push(...w);
      continue;
    }
    const cur = out[out.length - 1]!;
    if (closed) {
      if (w.includes(cur)) {
        const exit = next ? w.find((n) => n !== cur && (next[0] === n || next[next.length - 1] === n)) : undefined;
        if (exit !== undefined) {
          out.push(...ringArc(w, cur, exit).slice(1));
          continue;
        }
      }
    }
    if (w[0] === cur) out.push(...w.slice(1));
    else if (w[w.length - 1] === cur) out.push(...[...w].reverse().slice(1));
    else {
      const a = ll(cur);
      const s = ll(w[0]!);
      const e = ll(w[w.length - 1]!);
      if (!a || !s || !e) continue;
      const ds = haversine(a, s);
      const de = haversine(a, e);
      const gap = Math.min(ds, de);
      gaps.push(Math.round(gap));
      if (gap >= 50) warnings.push(`forat de ${Math.round(gap)} m abans del way ${members[i]?.ref}`);
      else warnings.push(`forat de ${Math.round(gap)} m cosit en recte`);
      out.push(...(ds <= de ? w : [...w].reverse()));
    }
  }
  const coords = out.map(ll).filter((c): c is LonLat => c !== null);
  return { coords, gaps, broken: gaps.some((g) => g >= 50), warnings };
}

/** Distancia media y p95 (m) de los vértices de `a` a la polilínea `b`. */
export function lineDeviation(a: LonLat[], b: LonLat[]): { mean: number; p95: number } {
  if (!a.length || b.length < 2) return { mean: NaN, p95: NaN };
  const ds: number[] = [];
  const k = Math.cos((a[0]![1] * Math.PI) / 180) * 111320;
  const toXY = (p: LonLat) => [p[0] * k, p[1] * 110540] as const;
  const bxy = b.map(toXY);
  for (const p of a) {
    const [px, py] = toXY(p);
    let best = Infinity;
    for (let i = 0; i < bxy.length - 1; i++) {
      const [ax, ay] = bxy[i]!;
      const [cx, cy] = bxy[i + 1]!;
      const dx = cx - ax;
      const dy = cy - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    ds.push(best);
  }
  ds.sort((x, y) => x - y);
  return { mean: ds.reduce((s, x) => s + x, 0) / ds.length, p95: ds[Math.floor(ds.length * 0.95)]! };
}
