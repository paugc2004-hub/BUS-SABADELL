/**
 * Única font de veritat de tot el que es deriva de la posició d'un bus: progrés,
 * parades restants, "a N parades", línia temporal.
 *
 * La fan servir el motor de simulació i la farà servir qualsevol proveïdor real
 * (GtfsRtProvider, TusSaeProvider): així el mapa, la fitxa de bus, el panell de
 * parada, la línia temporal, el seguiment i les alertes no calculen res pel seu compte.
 */
import type { Journey, JourneyStop, Pattern, VehicleState } from './types.ts';

export type BaseVehicle = Omit<
  VehicleState,
  'dir' | 'origin' | 'headsign' | 'progress' | 'prevStopIndex' | 'atStopIndex' | 'distToNextM' | 'stopsRemaining' | 'delaySec'
> & { delaySec?: number | null };

/** tolerància (m) per considerar que el bus és a la parada */
const AT_STOP_M = 0.5;

/** Fracció del trajecte recorreguda, per distància (no per nombre de parades). */
export function progressOf(p: Pattern, dist: number): number {
  const a = p.stopDist[0] ?? 0;
  const b = p.stopDist[p.stopDist.length - 1] ?? p.length;
  if (b <= a) return 0;
  return Math.min(1, Math.max(0, (dist - a) / (b - a)));
}

export function enrich(p: Pattern, v: BaseVehicle): VehicleState {
  const sd = p.stopDist;
  const n = sd.length;
  let prev = -1;
  for (let i = 0; i < n; i++) if (sd[i]! <= v.dist + AT_STOP_M) prev = i;
  if (v.status === 'EN_CABECERA') prev = -1;
  // en marxa, l'última parada feta és sempre anterior a la propera (encara que en sigui a pocs cm)
  if (v.status !== 'EN_PARADA' && v.status !== 'RETIRADA') prev = Math.min(prev, v.nextStopIndex - 1);
  let at: number | null = null;
  if (v.status === 'EN_PARADA' || v.status === 'EN_CABECERA') {
    const i = v.status === 'EN_CABECERA' ? 0 : prev;
    if (i >= 0 && Math.abs(sd[i]! - v.dist) <= AT_STOP_M) at = i;
  }
  const retired = v.status === 'RETIRADA';
  const nextIdx = v.nextStopIndex;
  return {
    ...v,
    dir: p.dir,
    origin: p.origin,
    headsign: p.headsign,
    progress: v.status === 'EN_CABECERA' ? 0 : retired ? 1 : progressOf(p, v.dist),
    prevStopIndex: prev,
    atStopIndex: at,
    distToNextM: retired || v.nextStopId === null ? null : Math.max(0, Math.round((sd[nextIdx] ?? v.dist) - v.dist)),
    stopsRemaining: retired || at === n - 1 ? 0 : Math.max(0, n - nextIdx),
    delaySec: v.delaySec ?? null,
  };
}

/**
 * Parades que li queden al bus fins a la parada `index` del seu trajecte, comptant-la:
 * 1 = és la propera parada, 0 = hi és aturat ara, < 0 = ja l'ha passada.
 */
export function stopsUntil(v: VehicleState, index: number): number {
  if (v.status === 'RETIRADA') return -1;
  if (v.atStopIndex === index) return 0;
  if (index <= v.prevStopIndex) return -1;
  return index - v.nextStopIndex + 1;
}

/**
 * Línia temporal del trajecte. `times[i]` és l'hora de pas per la parada i: per a les
 * passades, la simulada (o la real, si el proveïdor la té); per a les futures, l'ETA.
 */
export function journeyOf(p: Pattern, v: VehicleState, times: (number | null)[], scheduled: (number | null)[] = []): Journey {
  const stops: JourneyStop[] = p.stopIds.map((stopId, index) => {
    let state: JourneyStop['state'];
    if (v.atStopIndex === index) state = 'current';
    else if (index <= v.prevStopIndex) state = 'passed';
    else if (index === v.nextStopIndex && v.status !== 'RETIRADA') state = 'next';
    else state = 'upcoming';
    return { stopId, index, dist: p.stopDist[index]!, at: times[index] ?? null, scheduledAt: scheduled[index] ?? null, state };
  });
  const a = p.stopDist[0] ?? 0;
  const b = p.stopDist[p.stopDist.length - 1] ?? p.length;
  return {
    vehicleId: v.id,
    patternId: p.id,
    stops,
    progress: v.progress,
    lengthM: Math.round(b - a),
    doneM: Math.round(Math.max(0, Math.min(b, v.dist) - a)),
  };
}
