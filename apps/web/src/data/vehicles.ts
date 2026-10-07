/**
 * Punt únic d'accés a les dades en directe per a tota la interfície.
 *
 * Cap vista no ha de cridar el motor de simulació directament per saber on és un bus,
 * quan arriba o per on passarà: ho demana aquí. Avui la font és la simulació local
 * (SimEngine al navegador). El dia que el backend enviï temps real (GTFS-RT / SAE de TUS),
 * els vehicles REALTIME frescos substitueixen els simulats de la seva línia —mateix criteri
 * que el HybridProvider del core— i les llegades i la línia temporal es construeixen a partir
 * de les seves ETA, sense tocar cap component.
 */
import { journeyOf, planTrip, type Arrival, type Journey, type LonLat, type PlanResult, type SimEngine, type VehicleState } from '@bus/core';
import { realtimeVehicles } from './load.ts';

/** un vehicle de temps real es considera fresc durant 90 s */
const FRESH_MS = 90_000;

function freshRealtime(t: number): VehicleState[] {
  return [...realtimeVehicles.values()].filter((v) => t - v.timestamp < FRESH_MS);
}

function realtimeRoutes(t: number): Set<string> {
  return new Set(freshRealtime(t).map((v) => v.routeId));
}

/** Estat de tots els buses en l'instant t. */
export function vehiclesAt(engine: SimEngine, t: number): VehicleState[] {
  const sim = engine.snapshot(t);
  if (!realtimeVehicles.size) return sim;
  const rt = freshRealtime(t);
  const rtRoutes = new Set(rt.map((v) => v.routeId));
  return [...rt, ...sim.filter((v) => !rtRoutes.has(v.routeId))];
}

export function vehicleById(engine: SimEngine, id: string, t: number): VehicleState | null {
  return realtimeVehicles.get(id) ?? engine.vehicle(id, t);
}

/**
 * Properes llegades a una parada. Simulació: horari + retard simulat del motor.
 * Temps real: les ETA que envia cada vehicle (TripUpdates) per a les seves línies.
 */
export function arrivalsAt(engine: SimEngine, stopId: string, t: number, horizonMin = 90, limit = 12): Arrival[] {
  const sim = engine.arrivals(stopId, t, horizonMin, limit * 2);
  if (!realtimeVehicles.size) return sim.slice(0, limit);
  const rtRoutes = realtimeRoutes(t);
  const rt: Arrival[] = [];
  for (const v of freshRealtime(t)) {
    const e = v.etas.find((x) => x.stopId === stopId && x.at >= t - 20_000 && x.at <= t + horizonMin * 60_000);
    if (!e) continue;
    rt.push({
      routeId: v.routeId,
      patternId: v.patternId,
      headsign: v.headsign,
      at: e.at,
      scheduledAt: e.scheduledAt ?? e.at,
      delaySec: v.delaySec,
      vehicleId: v.id,
      status: 'EN_RUTA',
      source: 'REALTIME',
    });
  }
  return [...rt, ...sim.filter((a) => !rtRoutes.has(a.routeId))].sort((a, b) => a.at - b.at).slice(0, limit);
}

/** Línia temporal del trajecte actual d'un bus (parades fetes, on és, les que vénen). */
export function journeyFor(engine: SimEngine, id: string, t: number): Journey | null {
  const rt = realtimeVehicles.get(id);
  if (!rt) return engine.journey(id, t);
  const p = engine.patternById(rt.patternId);
  if (!p) return null;
  // temps real: hores futures de les ETA; les passades no les sabem (el feed no les envia)
  const times = p.stopIds.map((_, i) => (i >= rt.nextStopIndex ? rt.etas[i - rt.nextStopIndex]?.at ?? null : null));
  const sched = p.stopIds.map((_, i) => (i >= rt.nextStopIndex ? rt.etas[i - rt.nextStopIndex]?.scheduledAt ?? null : null));
  return journeyOf(p, rt, times, sched);
}

/**
 * Com hi arribo: rutes en bus d'un punt a un destí (un carrer són molts punts). Avui sobre les hores
 * estimades de la simulació; amb temps real, el planificador hauria de llegir les ETA reals (mateixa interfície).
 */
export function planFor(engine: SimEngine, from: LonLat, to: LonLat[], t: number): PlanResult {
  return planTrip(engine, from, to, t);
}
