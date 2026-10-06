/**
 * Derivacions per a la interfície. No calculen ETA ni posicions: només combinen el
 * VehicleState i les llegades del motor (única font de veritat, core/vehicle.ts).
 */
import { haversine, normalize, stopsUntil, type Arrival, type SimEngine, type Stop, type VehicleState } from '@bus/core';
import { vehicleById } from './vehicles.ts';

// ---------------------------------------------------------------- zones de parada

/**
 * "La meva parada" és un lloc, no un pal: Estació Centre són sis pals (un per sentit i
 * carrer). S'agrupen els pals amb el mateix nom a menys de 250 m.
 */
export function stopAreas(stops: Stop[]): Map<string, string[]> {
  const byName = new Map<string, Stop[]>();
  for (const s of stops) {
    const k = normalize(s.name);
    byName.set(k, [...(byName.get(k) ?? []), s]);
  }
  const area = new Map<string, string[]>();
  for (const group of byName.values()) {
    // unió de components connexos a ≤ 250 m
    const parent = new Map(group.map((s) => [s.id, s.id]));
    const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (haversine([group[i]!.lon, group[i]!.lat], [group[j]!.lon, group[j]!.lat]) <= 250)
          parent.set(find(group[i]!.id), find(group[j]!.id));
    const comp = new Map<string, string[]>();
    for (const s of group) comp.set(find(s.id), [...(comp.get(find(s.id)) ?? []), s.id]);
    for (const ids of comp.values()) for (const id of ids) area.set(id, ids);
  }
  return area;
}

let areaCache: { engine: SimEngine; map: Map<string, string[]> } | null = null;
export function areaOf(engine: SimEngine, stopId: string): string[] {
  if (!areaCache || areaCache.engine !== engine) areaCache = { engine, map: stopAreas([...engine.stops.values()]) };
  return areaCache.map.get(stopId) ?? [stopId];
}

// ---------------------------------------------------------------- llegades amb posició

export interface LiveArrival extends Arrival {
  stopId: string;
  /** índex de la parada dins el pattern del bus */
  stopIndex: number;
  vehicle: VehicleState | null;
  /** parades que li queden al bus fins aquí, comptant-la (1 = és la propera) */
  stopsAway: number | null;
}

/** Llegades a una zona (tots els pals), amb el bus que ve i a quantes parades és. */
export function liveArrivals(engine: SimEngine, stopIds: string[], t: number, horizonMin = 90, limit = 40): LiveArrival[] {
  const out: LiveArrival[] = [];
  for (const stopId of stopIds) {
    for (const a of engine.arrivals(stopId, t, horizonMin, limit)) {
      const p = engine.patternById(a.patternId);
      const v = a.vehicleId ? vehicleById(engine, a.vehicleId, t) : null;
      // el bus que fa aquesta llegada és el que té aquest pattern ara (si no, encara ha d'acabar l'expedició anterior)
      const same = v && v.patternId === a.patternId ? v : null;
      let stopIndex = p ? p.stopIds.indexOf(stopId) : -1;
      if (same && p) {
        // circulars: la propera ocurrència de la parada per davant del bus
        const idx = p.stopIds.findIndex((id, i) => id === stopId && i >= same.nextStopIndex - (same.atStopIndex === i ? 1 : 0));
        if (idx >= 0) stopIndex = idx;
      }
      out.push({
        ...a,
        stopId,
        stopIndex,
        vehicle: v,
        stopsAway: same && stopIndex >= 0 ? stopsUntil(same, stopIndex) : null,
      });
    }
  }
  return out.sort((x, y) => x.at - y.at).slice(0, limit);
}

// ---------------------------------------------------------------- on és el bus

export type WhereNow =
  | { kind: 'at'; stopId: string }
  | { kind: 'terminal'; stopId: string }
  | { kind: 'between'; from: string; to: string; fraction: number }
  | { kind: 'retired'; stopId: string | null };

export function whereNow(engine: SimEngine, v: VehicleState): WhereNow {
  const p = engine.patternById(v.patternId)!;
  if (v.status === 'RETIRADA' || v.atStopIndex === p.stopIds.length - 1) return { kind: 'retired', stopId: p.stopIds[p.stopIds.length - 1] ?? null };
  if (v.status === 'EN_CABECERA') return { kind: 'terminal', stopId: p.stopIds[0]! };
  if (v.atStopIndex !== null) return { kind: 'at', stopId: p.stopIds[v.atStopIndex]! };
  const i = Math.max(0, v.prevStopIndex);
  const a = p.stopDist[i]!;
  const b = p.stopDist[v.nextStopIndex] ?? a;
  return { kind: 'between', from: p.stopIds[i]!, to: p.stopIds[v.nextStopIndex]!, fraction: b > a ? (v.dist - a) / (b - a) : 0 };
}
