/**
 * Reconstrucción de expediciones a partir de los horarios por parada de tus.es.
 *
 * TUS publica, para cada parada de un trayecto, la lista de horas de paso. Esas
 * listas mezclan pasos de otras variantes de la misma línea que comparten la
 * parada, así que no se pueden alinear por índice: se sigue cada salida de
 * cabecera parada a parada eligiendo la hora más coherente.
 *
 * Las horas vienen al minuto. Para que el movimiento sea creíble se toman como
 * "anclas" las paradas donde cambia el minuto y se reparte el tiempo entre anclas
 * en proporción a la distancia.
 */

export interface StopTimes {
  /** horas de paso en segundos desde medianoche, ordenadas y sin duplicados */
  times: number[];
}

export interface ReconstructedTrip {
  dep: number;
  /** offset (s) de cada parada; null si no se ha podido casar */
  raw: (number | null)[];
  matched: number;
  timed: number;
}

export function parseTimes(list: string[]): number[] {
  const out = new Set<number>();
  for (const s of list) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) continue;
    let sec = Number(m[1]) * 3600 + Number(m[2]) * 60;
    // horas de madrugada que siguen al servicio nocturno: TUS no tiene, pero se admite 00:xx–03:xx
    if (Number(m[1]) < 3) sec += 24 * 3600;
    out.add(sec);
  }
  return [...out].sort((a, b) => a - b);
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Primer elemento de `arr` (ordenado) >= x. */
function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Sigue cada salida de la primera parada a lo largo del trayecto.
 * `dist` = distancia acumulada de cada parada (para estimar tiempos esperados).
 */
export function reconstructTrips(stops: StopTimes[], dist: number[]): ReconstructedTrip[] {
  const deps = stops[0]?.times ?? [];
  const n = stops.length;
  if (!deps.length || n < 2) return [];

  // pasada 1: codicioso, la primera hora >= anterior dentro de una ventana
  const pass1 = deps.map((d) => {
    const raw: (number | null)[] = [0];
    let prev = d;
    let skipped = 0;
    for (let i = 1; i < n; i++) {
      const ts = stops[i]!.times;
      if (!ts.length) {
        raw.push(null);
        skipped++;
        continue;
      }
      const window = 6 * 60 + skipped * 120;
      const k = lowerBound(ts, prev);
      const t = ts[k];
      if (t !== undefined && t - prev <= window) {
        raw.push(t - d);
        prev = t;
        skipped = 0;
      } else {
        raw.push(null);
        skipped++;
      }
    }
    return raw;
  });

  // perfil esperado: mediana de offsets por parada
  const expected: number[] = [];
  for (let i = 0; i < n; i++) {
    const vals = pass1.map((r) => r[i]).filter((x): x is number => x != null);
    expected.push(median(vals));
  }
  fillByDistance(expected, dist);

  // pasada 2: la hora más cercana a la esperada, manteniendo el orden
  return deps.map((d) => {
    const raw: (number | null)[] = [0];
    let prev = d;
    let matched = 0;
    let timed = 0;
    for (let i = 1; i < n; i++) {
      const ts = stops[i]!.times;
      if (!ts.length) {
        raw.push(null);
        continue;
      }
      timed++;
      const want = d + expected[i]!;
      const tol = Math.max(180, expected[i]! * 0.25);
      let best: number | null = null;
      let bestErr = Infinity;
      for (let k = lowerBound(ts, Math.max(prev, want - tol)); k < ts.length && ts[k]! <= want + tol; k++) {
        const err = Math.abs(ts[k]! - want);
        if (err < bestErr) {
          bestErr = err;
          best = ts[k]!;
        }
      }
      if (best != null && best >= prev) {
        raw.push(best - d);
        prev = best;
        matched++;
      } else raw.push(null);
    }
    return { dep: d, raw, matched, timed };
  });
}

/** Rellena NaN interpolando por distancia (y extrapolando con la velocidad media). */
export function fillByDistance(vals: number[], dist: number[]): void {
  const n = vals.length;
  const known = vals.map((v, i) => (Number.isFinite(v) ? i : -1)).filter((i) => i >= 0);
  if (!known.length) {
    for (let i = 0; i < n; i++) vals[i] = dist[i]! / 4.2; // ~15 km/h
    return;
  }
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(vals[i]!)) continue;
    const before = [...known].reverse().find((k) => k < i);
    const after = known.find((k) => k > i);
    if (before !== undefined && after !== undefined) {
      const span = dist[after]! - dist[before]!;
      const f = span > 0 ? (dist[i]! - dist[before]!) / span : 0;
      vals[i] = vals[before]! + f * (vals[after]! - vals[before]!);
    } else if (before !== undefined) {
      const k0 = known[0]!;
      const elapsed = vals[before]! - vals[k0]!;
      const run = dist[before]! - dist[k0]!;
      let v = elapsed > 0 ? run / elapsed : 4.2;
      v = Math.min(7, Math.max(3, v)); // 11–25 km/h
      vals[i] = vals[before]! + (dist[i]! - dist[before]!) / v;
    } else if (after !== undefined) {
      vals[i] = Math.max(0, vals[after]! - (dist[after]! - dist[i]!) / 4.2);
    }
  }
}

/**
 * Convierte offsets al minuto en offsets suaves y estrictamente crecientes.
 *
 * Una hora publicada "7:37" significa "en algún momento de ese minuto". Si se
 * tomara el segundo :00, todos los buses de la red llegarían a sus paradas a la
 * vez cada minuto. Se ajusta una curva tiempo-distancia suave que pasa por
 * dentro de cada ventana [m, m+59 s]:
 *  1. centro de la ventana (m + 30 s) para cada parada con hora;
 *  2. interpolación por distancia donde falta;
 *  3. media con la recta entre vecinas (±2 paradas) para quitar escalones;
 *  4. recorte a la ventana publicada y tiempo mínimo por tramo (45 km/h + 6 s).
 */
export function smoothOffsets(raw: (number | null)[], dist: number[]): number[] {
  const n = raw.length;
  const base: number[] = raw.map((r, i) => (i === 0 ? 0 : r == null ? NaN : r + 30));
  fillByDistance(base, dist);
  const sm = base.slice();
  for (let i = 1; i < n - 1; i++) {
    const a = Math.max(0, i - 2);
    const b = Math.min(n - 1, i + 2);
    const span = dist[b]! - dist[a]!;
    const interp = span > 0 ? base[a]! + ((dist[i]! - dist[a]!) / span) * (base[b]! - base[a]!) : base[i]!;
    sm[i] = 0.5 * base[i]! + 0.5 * interp;
  }
  const out = sm.map((x, i) => {
    const r = raw[i];
    if (i === 0) return 0;
    if (r == null) return Math.round(x);
    return Math.round(Math.min(r + 59, Math.max(r, x)));
  });
  for (let i = 1; i < n; i++) {
    const seg = Math.max(0, dist[i]! - dist[i - 1]!);
    const minT = Math.ceil(seg / 12.5 + 6);
    if (out[i]! < out[i - 1]! + minT) out[i] = out[i - 1]! + minT;
  }
  return out;
}

/** Redondea a 5 s para compartir perfiles entre expediciones. */
export function quantize(offsets: number[]): number[] {
  const out = offsets.map((x) => Math.round(x / 5) * 5);
  for (let i = 1; i < out.length; i++) if (out[i]! <= out[i - 1]!) out[i] = out[i - 1]! + 5;
  return out;
}
