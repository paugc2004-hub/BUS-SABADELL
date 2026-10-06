import type { SimEngine, VehicleState } from '@bus/core';
import { realtimeVehicles } from './load.ts';

/**
 * Estado de los buses en el instante t. Hoy: simulación local. El día que el
 * backend envíe tiempo real, los vehículos REALTIME frescos sustituyen a los
 * simulados de su línea (mismo criterio que HybridProvider del core).
 */
export function vehiclesAt(engine: SimEngine, t: number): VehicleState[] {
  const sim = engine.snapshot(t);
  if (!realtimeVehicles.size) return sim;
  const rt = [...realtimeVehicles.values()].filter((v) => t - v.timestamp < 90_000);
  const rtRoutes = new Set(rt.map((v) => v.routeId));
  return [...rt, ...sim.filter((v) => !rtRoutes.has(v.routeId))];
}

export function vehicleById(engine: SimEngine, id: string, t: number): VehicleState | null {
  return realtimeVehicles.get(id) ?? engine.vehicle(id, t);
}
