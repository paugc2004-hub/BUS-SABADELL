/** Utilidades geométricas. Distancias en metros; coordenadas [lon, lat]. */

export type LonLat = [number, number];

const R = 6371008.8;
const RAD = Math.PI / 180;

export function haversine(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Rumbo inicial de a hacia b, en grados [0, 360). */
export function bearing(a: LonLat, b: LonLat): number {
  const f1 = a[1] * RAD;
  const f2 = b[1] * RAD;
  const dl = (b[0] - a[0]) * RAD;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

export function cumulative(coords: LonLat[]): number[] {
  const out = new Array<number>(coords.length);
  let acc = 0;
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) acc += haversine(coords[i - 1]!, coords[i]!);
    out[i] = acc;
  }
  return out;
}

/** Proyección equirectangular local alrededor de una latitud de referencia (suficiente a escala de ciudad). */
export function makeLocalProjection(lat0: number) {
  const kx = Math.cos(lat0 * RAD) * R * RAD;
  const ky = R * RAD;
  return {
    toXY: (p: LonLat): [number, number] => [p[0] * kx, p[1] * ky],
    toLonLat: (x: number, y: number): LonLat => [x / kx, y / ky],
  };
}

/** Índice i tal que cum[i] <= d < cum[i+1] (búsqueda binaria). */
export function segmentIndex(cum: number[], d: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  if (d <= 0) return 0;
  if (d >= cum[hi]!) return Math.max(0, hi - 1);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Punto a distancia d a lo largo de la polilínea. */
export function pointAlong(coords: LonLat[], cum: number[], d: number): LonLat {
  if (coords.length === 1) return coords[0]!;
  const i = segmentIndex(cum, d);
  const a = coords[i]!;
  const b = coords[i + 1] ?? a;
  const len = cum[i + 1]! - cum[i]!;
  const t = len > 0 ? Math.min(1, Math.max(0, (d - cum[i]!) / len)) : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Rumbo suavizado en la distancia d: mira un tramo de ±`window` metros en lugar
 * de dos vértices muy cercanos (evita giros de 180° en paradas, bug 12.4-29).
 */
export function bearingAlong(coords: LonLat[], cum: number[], d: number, window = 25, back = window): number {
  const total = cum[cum.length - 1] ?? 0;
  const a = pointAlong(coords, cum, Math.max(0, d - back));
  const b = pointAlong(coords, cum, Math.min(total, d + window));
  return bearing(a, b);
}

export interface Projection {
  dist: number; // distancia a lo largo de la línea
  offset: number; // distancia perpendicular del punto a la línea
  segment: number;
}

/**
 * Proyecta p sobre la polilínea, considerando solo la parte con distancia >= minDist
 * y <= maxDist. La búsqueda acotada resuelve recorridos que pasan dos veces por la
 * misma calle (bug 12.1-4).
 */
export function projectOnLine(
  coords: LonLat[],
  cum: number[],
  p: LonLat,
  minDist = 0,
  maxDist = Infinity,
): Projection {
  const proj = makeLocalProjection(p[1]);
  const [px, py] = proj.toXY(p);
  let best: Projection = { dist: Math.max(0, minDist), offset: Infinity, segment: 0 };
  for (let i = 0; i < coords.length - 1; i++) {
    const segStart = cum[i]!;
    const segEnd = cum[i + 1]!;
    if (segEnd < minDist || segStart > maxDist) continue;
    const [ax, ay] = proj.toXY(coords[i]!);
    const [bx, by] = proj.toXY(coords[i + 1]!);
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    let dist = segStart + t * (segEnd - segStart);
    // respetar la ventana dentro del segmento
    if (dist < minDist) dist = minDist;
    if (dist > maxDist) dist = maxDist;
    const tt = segEnd > segStart ? (dist - segStart) / (segEnd - segStart) : 0;
    const qx = ax + dx * tt;
    const qy = ay + dy * tt;
    const off = Math.hypot(px - qx, py - qy);
    if (off < best.offset) best = { dist, offset: off, segment: i };
  }
  return best;
}

/**
 * Douglas-Peucker sobre coordenadas locales. `keep` son índices que nunca se eliminan
 * (vértices donde se proyectan paradas).
 */
export function simplify(coords: LonLat[], toleranceM: number, keep: Set<number> = new Set()): number[] {
  const n = coords.length;
  if (n <= 2) return coords.map((_, i) => i);
  const proj = makeLocalProjection(coords[0]![1]);
  const xy = coords.map((c) => proj.toXY(c));
  const mark = new Uint8Array(n);
  mark[0] = 1;
  mark[n - 1] = 1;
  for (const k of keep) if (k >= 0 && k < n) mark[k] = 1;
  // dividir por los puntos obligatorios y simplificar cada tramo
  const anchors: number[] = [];
  for (let i = 0; i < n; i++) if (mark[i]) anchors.push(i);
  const stack: [number, number][] = [];
  for (let a = 0; a < anchors.length - 1; a++) stack.push([anchors[a]!, anchors[a + 1]!]);
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e - s < 2) continue;
    const [ax, ay] = xy[s]!;
    const [bx, by] = xy[e]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = xy[i]!;
      let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceM && idx > 0) {
      mark[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (mark[i]) out.push(i);
  return out;
}

/** Tram de la polilínia entre les distàncies a i b (m), amb els extrems interpolats. */
export function sliceLine(coords: LonLat[], cum: number[], a: number, b: number): LonLat[] {
  const total = cum[cum.length - 1] ?? 0;
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(total, Math.max(a, b));
  const out: LonLat[] = [pointAlong(coords, cum, lo)];
  for (let i = 0; i < coords.length; i++) if (cum[i]! > lo && cum[i]! < hi) out.push(coords[i]!);
  out.push(pointAlong(coords, cum, hi));
  return out;
}
