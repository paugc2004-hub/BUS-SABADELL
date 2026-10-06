/**
 * Geometría de un trayecto: proyección de paradas con búsqueda acotada,
 * inserción de las paradas como vértices y simplificación que las conserva.
 */
import { cumulative, haversine, pointAlong, projectOnLine, simplify, type LonLat } from '@bus/core';

export interface StopPoint {
  id: string;
  lon: number;
  lat: number;
}

export interface BuiltGeometry {
  coords: LonLat[];
  cum: number[];
  stopDist: number[];
  length: number;
  warnings: string[];
  /** distancia perpendicular de cada parada a la línea */
  stopOffsets: number[];
  maxGap: number;
}

export function dedupeCoords(coords: LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (const c of coords) {
    const last = out[out.length - 1];
    if (!last || haversine(last, c) > 0.5) out.push(c);
  }
  return out;
}

/**
 * Primera pasada del recorrido junto a la parada dentro de la ventana: si la línea
 * pasa dos veces por la misma calle (ida a un ramal y vuelta, p. ej. L14 Ebre → Sau → Ebre),
 * la parada es la de la primera pasada aunque la segunda quede unos metros más cerca.
 */
function firstPass(coords: LonLat[], cum: number[], p: LonLat, minD: number, maxD: number) {
  const best = projectOnLine(coords, cum, p, minD, maxD);
  const ok = Math.max(15, best.offset + 12);
  for (let i = 0; i < coords.length - 1; i++) {
    if (cum[i + 1]! < minD || cum[i]! > maxD) continue;
    const pr = projectOnLine(coords, cum, p, Math.max(minD, cum[i]!), Math.min(maxD, cum[i + 1]!));
    if (pr.offset <= ok) return pr;
  }
  return best;
}

/**
 * Proyecta las paradas en orden. Cada parada se busca a partir de la distancia de
 * la anterior y dentro de una ventana razonable; así un recorrido que pasa dos
 * veces por la misma calle no proyecta la parada en el tramo equivocado (bug 12.1-4).
 */
export function projectStops(coords: LonLat[], cum: number[], stops: StopPoint[]) {
  const total = cum[cum.length - 1] ?? 0;
  const dists: number[] = [];
  const offsets: number[] = [];
  let prev = 0;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]!;
    const p: LonLat = [s.lon, s.lat];
    const prevStop = stops[i - 1];
    const straight = prevStop ? haversine([prevStop.lon, prevStop.lat], p) : 0;
    const minD = i === 0 ? 0 : prev + 1;
    const maxD = i === 0 ? Math.min(total, 400) : Math.min(total, prev + straight * 3 + 400);
    let pr = firstPass(coords, cum, p, minD, maxD);
    if (pr.offset > 60) {
      // ventana más amplia hacia delante
      const wide = projectOnLine(coords, cum, p, minD, total);
      if (wide.offset < pr.offset - 20) pr = wide;
    }
    let d = pr.dist;
    if (i === stops.length - 1) {
      // la última parada: preferir el final de la línea si está cerca
      const end = projectOnLine(coords, cum, p, Math.max(minD, total - 500), total);
      if (end.offset <= pr.offset + 10) d = end.dist;
    }
    if (d <= prev && i > 0) d = Math.min(total, prev + 1);
    dists.push(d);
    offsets.push(pr.offset);
    prev = d;
  }
  return { dists, offsets };
}

/** Ángulo interior (grados) en b del camino a→b→c: 180 = recto, 0 = vuelve por donde ha venido. */
function interiorAngle(a: LonLat, b: LonLat, c: LonLat): number {
  const k = Math.cos((b[1] * Math.PI) / 180);
  const ux = (a[0] - b[0]) * k;
  const uy = a[1] - b[1];
  const vx = (c[0] - b[0]) * k;
  const vy = c[1] - b[1];
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  // tramo de longitud cero (vértice duplicado): no es un giro
  if (!nu || !nv) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)))) * 180) / Math.PI;
}

/**
 * Las polilíneas de tus.es van hasta el poste de cada parada y vuelven (un "pico" de
 * 5–20 m en la acera). Un bus que lo siguiera haría un zigzag y giraría 180° en cada
 * parada. Se quita el vértice del pico solo si: está junto a una parada (≤ 12 m), el
 * camino vuelve casi por donde ha venido (ángulo interior < 40°) y el pico mide ≤ 35 m.
 * Las vueltas reales (rotondas, cambios de sentido) no cumplen las tres condiciones.
 */
export function despike(coords: LonLat[], stops: StopPoint[]): { coords: LonLat[]; removed: number } {
  let out = coords.slice();
  let removed = 0;
  const onStop = (c: LonLat) => stops.some((s) => haversine(c, [s.lon, s.lat]) <= 12);
  for (let pass = 0; pass < 3; pass++) {
    const next: LonLat[] = [];
    let changed = false;
    for (let k = 0; k < out.length; k++) {
      const a = next[next.length - 1];
      const b = out[k]!;
      const c = out[k + 1];
      const ang = a && c ? interiorAngle(a, b, c) : 180;
      const arm = a && c ? Math.max(haversine(a, b), haversine(b, c)) : Infinity;
      // pico junto a una parada, o vuelta exacta sobre el mismo trazo (un bus no circula marcha atrás)
      if ((onStop(b) && ang < 40 && arm <= 35) || (ang < 3 && arm <= 35)) {
        removed++;
        changed = true;
        continue;
      }
      next.push(b);
    }
    out = dedupeCoords(next);
    if (!changed) break;
  }
  return { coords: out, removed };
}

/** Vértices donde el recorrido vuelve sobre sí mismo en menos de 40 m (para la auditoría). */
export function countSpikes(coords: LonLat[]): number {
  let n = 0;
  for (let k = 1; k < coords.length - 1; k++) {
    const a = coords[k - 1]!;
    const b = coords[k]!;
    const c = coords[k + 1]!;
    if (interiorAngle(a, b, c) < 25 && Math.min(haversine(a, b), haversine(b, c)) <= 40) n++;
  }
  return n;
}

export function buildGeometry(rawCoords: LonLat[], stops: StopPoint[], toleranceM = 4): BuiltGeometry {
  const warnings: string[] = [];
  let coords = despike(dedupeCoords(rawCoords), stops).coords;
  if (coords.length < 2) {
    // sin geometría: unir las paradas en línea recta (se marca como aviso)
    coords = stops.map((s) => [s.lon, s.lat] as LonLat);
    warnings.push('sense geometria: recorregut recte entre parades');
  }
  let cum = cumulative(coords);
  let maxGap = 0;
  for (let i = 1; i < coords.length; i++) maxGap = Math.max(maxGap, cum[i]! - cum[i - 1]!);

  // la geometría de tus.es empieza a veces lejos de la primera parada: recortamos lo que sobra
  const { dists, offsets } = projectStops(coords, cum, stops);
  for (let i = 0; i < stops.length; i++)
    if (offsets[i]! > 80) warnings.push(`parada ${stops[i]!.id} a ${Math.round(offsets[i]!)} m del recorregut`);

  // insertar los puntos proyectados como vértices
  const pts: { d: number; c: LonLat; stop: number }[] = [];
  for (let i = 0; i < coords.length; i++) pts.push({ d: cum[i]!, c: coords[i]!, stop: -1 });
  for (let i = 0; i < dists.length; i++) pts.push({ d: dists[i]!, c: pointAlong(coords, cum, dists[i]!), stop: i });
  pts.sort((a, b) => a.d - b.d || b.stop - a.stop);
  const merged: { c: LonLat; stop: number }[] = [];
  for (const p of pts) {
    const last = merged[merged.length - 1];
    if (last && haversine(last.c, p.c) < 0.3) {
      if (p.stop >= 0 && last.stop < 0) last.stop = p.stop;
      else if (p.stop >= 0) merged.push({ c: p.c, stop: p.stop });
      continue;
    }
    merged.push({ c: p.c, stop: p.stop });
  }
  const full = merged.map((m) => m.c);
  const keep = new Set<number>();
  merged.forEach((m, i) => m.stop >= 0 && keep.add(i));
  const idx = simplify(full, toleranceM, keep);
  coords = idx.map((i) => full[i]!);
  cum = cumulative(coords);
  const stopDist: number[] = new Array(stops.length).fill(0);
  idx.forEach((orig, j) => {
    const st = merged[orig]!.stop;
    if (st >= 0) stopDist[st] = cum[j]!;
  });
  // garantizar monotonía estricta
  for (let i = 1; i < stopDist.length; i++)
    if (stopDist[i]! <= stopDist[i - 1]!) {
      warnings.push(`distàncies no monòtones a la parada ${i}`);
      stopDist[i] = stopDist[i - 1]! + 1;
    }
  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    coords: coords.map(([lon, lat]) => [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as LonLat),
    cum: cum.map(round),
    stopDist: stopDist.map(round),
    length: round(cum[cum.length - 1] ?? 0),
    warnings,
    stopOffsets: offsets,
    maxGap,
  };
}
