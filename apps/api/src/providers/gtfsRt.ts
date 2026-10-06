/**
 * GtfsRtProvider: consume un feed GTFS-Realtime (VehiclePositions + TripUpdates).
 * Listo para el día que TUS publique tiempo real. Se prueba con un fichero .pb de
 * fixture (test/fixtures/vehicle-positions.pb).
 *
 * Correspondencia con nuestra red:
 *  1. trip_id con el formato de nuestro GTFS propio (`<patternId>_<SERVEI>_<HHMM>`) → pattern directo;
 *  2. si no, route_id + proyección de la posición sobre los patterns de esa línea.
 */
import { readFile } from 'node:fs/promises';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import {
  bearingAlong,
  haversine,
  projectOnLine,
  type DataSource,
  type NetworkData,
  type Pattern,
  type StopEta,
  type VehicleState,
} from '@bus/core';
import type { ProviderHealth, Unsubscribe, VehicleDiff, VehicleProvider } from '@bus/core';
import { diffSnapshots, enrich } from '@bus/core';

const { transit_realtime } = GtfsRealtimeBindings;
type IVehiclePosition = GtfsRealtimeBindings.transit_realtime.IVehiclePosition;
type ITripUpdate = GtfsRealtimeBindings.transit_realtime.ITripUpdate;

export interface GtfsRtOptions {
  /** URL http(s) o ruta de fichero local */
  vehiclePositions: string;
  tripUpdates?: string;
  pollMs?: number;
  /** cabeceras (p. ej. clave de API de TUS) */
  headers?: Record<string, string>;
  /** máximo desvío permitido entre la posición y el recorrido (m) */
  maxOffsetM?: number;
}

async function load(src: string, headers?: Record<string, string>): Promise<Uint8Array> {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { headers: { 'User-Agent': 'BusSabadellDemo/0.1', ...(headers ?? {}) } });
    if (!res.ok) throw new Error(`GTFS-RT HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(await readFile(src));
}

export class GtfsRtProvider implements VehicleProvider {
  readonly source: DataSource = 'REALTIME';
  private vehicles = new Map<string, VehicleState>();
  private subs = new Set<(d: VehicleDiff) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private h: ProviderHealth = { source: 'REALTIME', ok: false, lastUpdate: null, errors: 0, lastError: null, latencyMs: null };
  private readonly byRoute = new Map<string, Pattern[]>();
  private readonly byId = new Map<string, Pattern>();

  constructor(
    private readonly network: NetworkData,
    private readonly opts: GtfsRtOptions,
  ) {
    for (const p of network.patterns) {
      this.byId.set(p.id, p);
      const arr = this.byRoute.get(p.routeId) ?? [];
      arr.push(p);
      this.byRoute.set(p.routeId, arr);
    }
  }

  async start(): Promise<void> {
    await this.poll();
    this.timer = setInterval(() => void this.poll(), this.opts.pollMs ?? 10_000);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Una lectura del feed. Pública para los tests. */
  async poll(): Promise<void> {
    const t0 = Date.now();
    try {
      const vp = transit_realtime.FeedMessage.decode(await load(this.opts.vehiclePositions, this.opts.headers));
      const tu = this.opts.tripUpdates
        ? transit_realtime.FeedMessage.decode(await load(this.opts.tripUpdates, this.opts.headers))
        : null;
      const updates = new Map<string, ITripUpdate>();
      for (const e of tu?.entity ?? []) if (e.tripUpdate?.trip?.tripId) updates.set(e.tripUpdate.trip.tripId, e.tripUpdate);
      const next: VehicleState[] = [];
      for (const e of vp.entity) {
        const v = e.vehicle;
        if (!v?.position) continue;
        const st = this.toState(e.id, v, updates.get(v.trip?.tripId ?? ''));
        if (st) next.push(st);
      }
      const diff = diffSnapshots(this.vehicles, next, Date.now());
      this.vehicles = new Map(next.map((x) => [x.id, x]));
      this.h = { ...this.h, ok: true, lastUpdate: Date.now(), latencyMs: Date.now() - t0, lastError: null };
      for (const cb of this.subs) cb(diff);
    } catch (err) {
      this.h = { ...this.h, ok: false, errors: this.h.errors + 1, lastError: (err as Error).message };
    }
  }

  private matchPattern(routeId: string | null | undefined, tripId: string | null | undefined, pos: [number, number]) {
    const fromTrip = tripId ? this.byId.get(tripId.split('_')[0] ?? '') : undefined;
    const candidates = fromTrip ? [fromTrip] : (routeId ? this.byRoute.get(routeId) : undefined) ?? [];
    let best: { p: Pattern; dist: number; offset: number } | null = null;
    for (const p of candidates) {
      const pr = projectOnLine(p.coords, p.cum, pos);
      if (!best || pr.offset < best.offset) best = { p, dist: pr.dist, offset: pr.offset };
    }
    if (!best || best.offset > (this.opts.maxOffsetM ?? 120)) return null;
    return best;
  }

  private toState(entityId: string, v: IVehiclePosition, tu: ITripUpdate | undefined): VehicleState | null {
    const pos: [number, number] = [v.position!.longitude, v.position!.latitude];
    const m = this.matchPattern(v.trip?.routeId, v.trip?.tripId, pos);
    if (!m) return null;
    const { p, dist } = m;
    let nextIdx = p.stopDist.findIndex((d) => d > dist + 5);
    if (nextIdx < 0) nextIdx = p.stopIds.length - 1;
    const ts = Number(v.timestamp ?? 0) * 1000 || Date.now();
    const etas: StopEta[] = [];
    for (const u of tu?.stopTimeUpdate ?? []) {
      const at = Number(u.arrival?.time ?? u.departure?.time ?? 0) * 1000;
      if (u.stopId && at) etas.push({ stopId: u.stopId, at });
    }
    const status = v.currentStatus === transit_realtime.VehiclePosition.VehicleStopStatus.STOPPED_AT ? 'EN_PARADA' : 'EN_RUTA';
    const nearStop = p.stopIds[nextIdx] ? haversine(pos, pointOfStop(this.network, p.stopIds[nextIdx]!)) : Infinity;
    // retard real del TripUpdate (segons): és l'única font que pot posar RETRASADO
    const delay = tu?.stopTimeUpdate?.find((u) => u.arrival?.delay != null)?.arrival?.delay ?? tu?.delay ?? null;
    const delaySec = delay === null || delay === undefined ? null : Number(delay);
    // mateixa derivació (progrés, parades restants…) que la simulació: vehicle.ts del core
    return enrich(p, {
      id: `rt:${v.vehicle?.id ?? entityId}`,
      label: v.vehicle?.label ?? v.vehicle?.id ?? entityId,
      routeId: p.routeId,
      patternId: p.id,
      tripKey: v.trip?.tripId ?? `${p.id}@rt`,
      status: nearStop < 15 ? 'EN_PARADA' : delaySec !== null && delaySec >= 180 ? 'RETRASADO' : status,
      source: 'REALTIME',
      dist,
      lon: pos[0],
      lat: pos[1],
      bearing: v.position?.bearing ?? bearingAlong(p.coords, p.cum, dist),
      speedKmh: Math.round((v.position?.speed ?? 0) * 3.6),
      nextStopIndex: nextIdx,
      nextStopId: p.stopIds[nextIdx] ?? null,
      etas,
      departure: ts,
      lastTrip: false,
      timestamp: ts,
      delaySec,
    });
  }

  snapshot(): VehicleState[] {
    return [...this.vehicles.values()];
  }

  subscribe(cb: (d: VehicleDiff) => void): Unsubscribe {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  health(): ProviderHealth {
    return this.h;
  }
}

function pointOfStop(n: NetworkData, id: string): [number, number] {
  const s = n.stops.find((x) => x.id === id);
  return s ? [s.lon, s.lat] : [0, 0];
}
