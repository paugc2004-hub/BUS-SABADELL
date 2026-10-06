/**
 * Correcciones de red que se deducen de los datos (nunca se inventa un recorrido):
 *
 *  1. Sentido (`dir`) por geometría: una variante va en sentido 0 si recorre el
 *     recorrido principal de la línea hacia delante. Antes se decidía por el nombre
 *     de la cabecera y variantes como "Els Merinals - Parc Taulí - Can Roqueta" o
 *     "Zona Industrial - Estació Sud - La Roureda" salían en el sentido equivocado.
 *  2. Circular: también cuando la geometría publicada es un bucle cerrado (L15/F15).
 *  3. Tramos fuera de calle: si un tramo entre dos paradas consecutivas sale de las
 *     calles de OSM (p. ej. F6 por la antigua carretera de Bellaterra, eliminada en
 *     2024) y otra variante —de cualquier línea— hace el mismo tramo entre las MISMAS
 *     dos paradas por calle, se usa la geometría de esa variante. Si no hay donante,
 *     no se toca y la auditoría lo marca como error.
 */
import { cumulative, haversine, pointAlong, projectOnLine, type LonLat, type Pattern, type Stop } from '@bus/core';
import { OFFROAD_RUN_ERR_M, ROAD_TOL_M, STOP_TOL_M, type SegmentGrid } from './audit.ts';

const ll = (s: Stop): LonLat => [s.lon, s.lat];

export function isCircular(stopIds: string[], coords: LonLat[], stops: Map<string, Stop>): boolean {
  const fs = stops.get(stopIds[0]!);
  const ls = stops.get(stopIds[stopIds.length - 1]!);
  if (stopIds[0] === stopIds[stopIds.length - 1]) return true;
  if (fs && ls && haversine(ll(fs), ll(ls)) < 200) return true;
  // bucle cerrado publicado como tal: empieza y acaba en el mismo punto
  const a = coords[0];
  const b = coords[coords.length - 1];
  return Boolean(a && b && coords.length > 2 && haversine(a, b) < 60);
}

/**
 * Sentido de cada variante de una línea respecto de su variante principal
 * (la de más expediciones entre las que salen de la cabecera principal).
 */
export function assignDirections(pats: Pattern[], stops: Map<string, Stop>, mainOrigin: string): Map<string, 0 | 1> {
  const out = new Map<string, 0 | 1>();
  const pool = pats.filter((p) => p.origin === mainOrigin && !p.circular);
  const main = (pool.length ? pool : pats.filter((p) => !p.circular)).sort((a, b) => b.trips.length - a.trips.length)[0];
  for (const p of pats) {
    if (p.circular || !main) {
      out.set(p.id, 0);
      continue;
    }
    if (p === main) {
      out.set(p.id, 0);
      continue;
    }
    // proyección de cada parada sobre el recorrido principal; solo cuentan las que están encima
    const along: number[] = [];
    for (const id of p.stopIds) {
      const s = stops.get(id);
      if (!s) continue;
      const pr = projectOnLine(main.coords, main.cum, ll(s));
      if (pr.offset <= 60) along.push(pr.dist);
    }
    let fwd = 0;
    let back = 0;
    for (let i = 1; i < along.length; i++) {
      const d = along[i]! - along[i - 1]!;
      if (d > 0) fwd += d;
      else back -= d;
    }
    if (fwd + back > 200) {
      out.set(p.id, fwd >= back ? 0 : 1);
      continue;
    }
    // sin tramo común suficiente: por cabeceras (destino cerca del destino principal → sentido 0)
    const last = stops.get(p.stopIds[p.stopIds.length - 1]!);
    const mFirst = stops.get(main.stopIds[0]!);
    const mLast = stops.get(main.stopIds[main.stopIds.length - 1]!);
    if (last && mFirst && mLast) out.set(p.id, haversine(ll(last), ll(mLast)) <= haversine(ll(last), ll(mFirst)) ? 0 : 1);
    else out.set(p.id, p.dir);
  }
  return out;
}

/** Peor tramo seguido fuera de calle entre las distancias a y b del patrón. */
function offroadRun(p: Pattern, a: number, b: number, roads: SegmentGrid, step = 10): number {
  let run = 0;
  let worst = 0;
  for (let d = a; d <= b; d += step) {
    if (roads.dist(pointAlong(p.coords, p.cum, d)) <= ROAD_TOL_M) run = 0;
    else worst = Math.max(worst, (run += step));
  }
  return worst;
}

function stopOff(p: Pattern, i: number, stops: Map<string, Stop>): number {
  const s = stops.get(p.stopIds[i]!);
  return s ? haversine(ll(s), pointAlong(p.coords, p.cum, p.stopDist[i]!)) : Infinity;
}

/** Vértices del patrón entre las distancias a y b (incluidos los extremos interpolados). */
function slice(p: Pattern, a: number, b: number): LonLat[] {
  const out: LonLat[] = [pointAlong(p.coords, p.cum, a)];
  for (let i = 0; i < p.coords.length; i++) if (p.cum[i]! > a && p.cum[i]! < b) out.push(p.coords[i]!);
  out.push(pointAlong(p.coords, p.cum, b));
  return out;
}

function segmentOk(p: Pattern, i: number, stops: Map<string, Stop>, roads: SegmentGrid): boolean {
  return (
    offroadRun(p, p.stopDist[i]!, p.stopDist[i + 1]!, roads) <= OFFROAD_RUN_ERR_M &&
    stopOff(p, i, stops) <= STOP_TOL_M &&
    stopOff(p, i + 1, stops) <= STOP_TOL_M
  );
}

export interface RepairNote {
  pattern: string;
  from: string;
  to: string;
  donor: string;
  reason: string;
}

/**
 * Sustituye, en el sitio, los tramos parada→parada defectuosos por el de un donante
 * que hace el mismo tramo entre las mismas dos paradas y sí pasa la validación.
 */
export function repairSegments(patterns: Pattern[], stops: Map<string, Stop>, roads: SegmentGrid): RepairNote[] {
  const notes: RepairNote[] = [];
  // índice de tramos válidos: "a>b" → [patrón, índice]
  const good = new Map<string, { p: Pattern; i: number }[]>();
  for (const p of patterns)
    for (let i = 0; i < p.stopIds.length - 1; i++)
      if (segmentOk(p, i, stops, roads)) {
        const k = `${p.stopIds[i]}>${p.stopIds[i + 1]}`;
        good.set(k, [...(good.get(k) ?? []), { p, i }]);
      }
  for (const p of patterns) {
    for (let i = 0; i < p.stopIds.length - 1; i++) {
      if (segmentOk(p, i, stops, roads)) continue;
      const k = `${p.stopIds[i]}>${p.stopIds[i + 1]}`;
      const donors = (good.get(k) ?? []).filter((d) => d.p !== p).sort((a, b) => b.p.trips.length - a.p.trips.length);
      const d = donors[0];
      if (!d) continue;
      const run = offroadRun(p, p.stopDist[i]!, p.stopDist[i + 1]!, roads);
      const reason = run > OFFROAD_RUN_ERR_M ? `${run} m fora de carrer` : 'parada lluny del recorregut';
      const a = p.stopDist[i]!;
      const b = p.stopDist[i + 1]!;
      const head = slice(p, p.stopDist[0]! > 0 ? 0 : 0, a).slice(0, -1);
      const mid = slice(d.p, d.p.stopDist[d.i]!, d.p.stopDist[d.i + 1]!);
      const tail = slice(p, b, p.length).slice(1);
      // si el patrón empieza en la parada i, la cabeza es solo ese punto
      const coords = [...(head.length ? head : []), ...mid, ...tail];
      const cum = cumulative(coords);
      const headLen = head.length ? cumulative([...head, mid[0]!]).at(-1)! : 0;
      const midLen = cumulative(mid).at(-1)!;
      const shift = headLen + midLen - b;
      const stopDist = p.stopDist.map((x, j) => (j < i ? x : j === i ? headLen : x + shift));
      p.coords = coords;
      p.cum = cum;
      p.length = cum[cum.length - 1]!;
      p.stopDist = stopDist;
      notes.push({
        pattern: p.id,
        from: stops.get(p.stopIds[i]!)?.name ?? p.stopIds[i]!,
        to: stops.get(p.stopIds[i + 1]!)?.name ?? p.stopIds[i + 1]!,
        donor: d.p.id,
        reason,
      });
    }
  }
  return notes;
}
