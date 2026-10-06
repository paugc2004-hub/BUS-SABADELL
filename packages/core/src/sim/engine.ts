/**
 * Motor de simulación determinista.
 *
 * La posición de cada bus es una función pura de (red, instante): no hay estado
 * acumulado. Dos navegadores a la misma hora ven lo mismo y recargar no
 * "teletransporta" los buses (bug 12.3-22).
 *
 * Fuente de los tiempos: horarios por parada publicados por TUS (tus.es). Lo que
 * el motor añade —y por eso la posición es SIMULADA— es la interpolación entre
 * paradas, los tiempos de parada y el encadenamiento de expediciones en buses.
 */
import { bearingAlong, haversine, pointAlong, type LonLat } from '../geo.ts';
import { hashString, mulberry32 } from '../prng.ts';
import { addDays, dayTypeFor, localDate, serviceDayOrigin } from '../time.ts';
import type {
  Arrival,
  DayType,
  NetworkData,
  Pattern,
  Route,
  Stop,
  StopEta,
  VehicleState,
  VehicleStatus,
} from '../types.ts';

export interface EngineOptions {
  /** segundos que un bus se ve en cabecera antes de su primera salida */
  preDepartureShowS?: number;
  /** segundos que se ve "Retirada" al final de su última expedición */
  retireShowS?: number;
  /** espera máxima en cabecera entre expediciones para seguir mostrándolo */
  maxLayoverShowS?: number;
  /** distancia máxima entre final de una expedición e inicio de la siguiente para encadenarlas */
  chainRadiusM?: number;
  /** descanso mínimo en cabecera */
  minLayoverS?: number;
}

const DEFAULTS: Required<EngineOptions> = {
  preDepartureShowS: 240,
  retireShowS: 150,
  maxLayoverShowS: 25 * 60,
  chainRadiusM: 350,
  minLayoverS: 60,
};

export interface PreparedPattern {
  p: Pattern;
  coords: LonLat[];
  route: Route;
  stopIndex: Map<string, number[]>;
  start: LonLat;
  end: LonLat;
}

export interface Trip {
  key: string;
  pattern: PreparedPattern;
  dep: number; // s desde el origen del día de servicio
  offsets: number[]; // llegada a cada parada (s desde dep)
  end: number; // dep + última llegada
  dwell: number[]; // tiempo de parada en cada parada (s)
  vehicle: string;
  blockPos: number;
}

export interface Block {
  id: string;
  label: string;
  routeId: string;
  trips: Trip[];
}

interface DayTables {
  trips: Trip[];
  blocks: Block[];
  byStop: Map<string, { trip: Trip; idx: number }[]>;
}

/** Curva de velocidad seno: arranca y frena suave, monótona en [0,1]. */
function ease(f: number): number {
  return f - Math.sin(2 * Math.PI * f) / (2 * Math.PI);
}
function easeSpeedFactor(f: number): number {
  return 1 - Math.cos(2 * Math.PI * f);
}

/** Primer índice con arr[i] > x. */
function upperBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const DAY_TYPES: DayType[] = ['feiner', 'dissabte', 'festiu'];

export class SimEngine {
  readonly network: NetworkData;
  readonly routes = new Map<string, Route>();
  readonly stops = new Map<string, Stop>();
  readonly patterns = new Map<string, PreparedPattern>();
  private readonly days = new Map<DayType, DayTables>();
  private readonly opts: Required<EngineOptions>;

  constructor(network: NetworkData, opts: EngineOptions = {}) {
    this.network = network;
    this.opts = { ...DEFAULTS, ...opts };
    for (const r of network.routes) this.routes.set(r.id, r);
    for (const s of network.stops) this.stops.set(s.id, s);
    for (const p of network.patterns) {
      const route = this.routes.get(p.routeId);
      if (!route) throw new Error(`Pattern ${p.id}: línia desconeguda ${p.routeId}`);
      const stopIndex = new Map<string, number[]>();
      p.stopIds.forEach((id, i) => {
        const arr = stopIndex.get(id) ?? [];
        arr.push(i);
        stopIndex.set(id, arr);
      });
      this.patterns.set(p.id, {
        p,
        coords: p.coords,
        route,
        stopIndex,
        start: pointAlong(p.coords, p.cum, p.stopDist[0] ?? 0),
        end: pointAlong(p.coords, p.cum, p.stopDist[p.stopDist.length - 1] ?? p.length),
      });
    }
    for (const dt of DAY_TYPES) this.days.set(dt, this.buildDay(dt));
  }

  // ------------------------------------------------------------------ preparación

  private buildDay(dayType: DayType): DayTables {
    const trips: Trip[] = [];
    for (const pp of this.patterns.values()) {
      if (pp.p.dayType !== dayType) continue;
      for (const [dep, prof] of pp.p.trips) {
        const offsets = pp.p.profiles[prof];
        if (!offsets) continue;
        const key = `${pp.p.id}@${dep}`;
        const rnd = mulberry32(hashString(key));
        const dwell = offsets.map((o, i) => {
          if (i === 0 || i === offsets.length - 1) return 0;
          const seg = (offsets[i + 1] ?? o) - o;
          const want = 8 + rnd() * 14; // 8–22 s
          return Math.max(0, Math.min(want, seg * 0.3));
        });
        trips.push({
          key,
          pattern: pp,
          dep,
          offsets,
          end: dep + (offsets[offsets.length - 1] ?? 0),
          dwell,
          vehicle: '',
          blockPos: 0,
        });
      }
    }
    trips.sort((a, b) => a.dep - b.dep || a.key.localeCompare(b.key));
    const blocks = this.chain(trips, dayType);
    const byStop = new Map<string, { trip: Trip; idx: number }[]>();
    for (const t of trips) {
      const n = t.offsets.length;
      for (const [stopId, idxs] of t.pattern.stopIndex) {
        for (const idx of idxs) {
          // una expedición que termina en la parada no "pasa" por ella
          if (idx === n - 1) continue;
          const arr = byStop.get(stopId) ?? [];
          arr.push({ trip: t, idx });
          byStop.set(stopId, arr);
        }
      }
    }
    for (const arr of byStop.values())
      arr.sort((a, b) => a.trip.dep + a.trip.offsets[a.idx]! - (b.trip.dep + b.trip.offsets[b.idx]!));
    return { trips, blocks, byStop };
  }

  /**
   * Encadena expediciones en buses (torns): un bus acaba en una cabecera y hace
   * la siguiente salida de la misma línea desde allí. El número de buses sale solo
   * de los horarios (sección 6.3).
   */
  private chain(trips: Trip[], dayType: DayType): Block[] {
    type Open = Block & { freeAt: number; at: LonLat };
    const blocks: Open[] = [];
    const perRouteCount = new Map<string, number>();
    for (const t of trips) {
      const routeId = t.pattern.route.id;
      let best: Open | null = null;
      for (const b of blocks) {
        if (b.routeId !== routeId) continue;
        if (b.freeAt + this.opts.minLayoverS > t.dep) continue;
        if (t.dep - b.freeAt > 3 * 3600) continue; // tras 3 h ya no es el mismo torn
        if (haversine(b.at, t.pattern.start) > this.opts.chainRadiusM) continue;
        if (!best || b.freeAt < best.freeAt) best = b; // FIFO: el que lleva más esperando
      }
      if (!best) {
        const n = (perRouteCount.get(routeId) ?? 0) + 1;
        perRouteCount.set(routeId, n);
        best = {
          id: `${dayType}:${routeId}-${String(n).padStart(2, '0')}`,
          // no es un número de flota real: es el torn simulat (línia·ordre)
          label: `${routeId}·${String(n).padStart(2, '0')}`,
          routeId,
          trips: [],
          freeAt: 0,
          at: t.pattern.start,
        };
        blocks.push(best);
      }
      t.vehicle = best.id;
      t.blockPos = best.trips.length;
      best.trips.push(t);
      best.freeAt = t.end;
      best.at = t.pattern.end;
    }
    return blocks.map(({ id, label, routeId, trips: tr }) => ({ id, label, routeId, trips: tr }));
  }

  // ------------------------------------------------------------------ consultas

  /** Días de servicio activos en el instante t (ayer cubre horas > 24:00). */
  private serviceDays(t: number, extraForward = false) {
    const today = localDate(t);
    const dates = [addDays(today, -1), today];
    if (extraForward) dates.push(addDays(today, 1));
    return dates.map((date) => {
      const dayType = dayTypeFor(date, this.network.holidays);
      return { date, dayType, origin: serviceDayOrigin(date), tables: this.days.get(dayType)! };
    });
  }

  dayTypeAt(t: number): DayType {
    return dayTypeFor(localDate(t), this.network.holidays);
  }

  /** Estado de todos los buses visibles en el instante t (epoch ms). */
  snapshot(t: number): VehicleState[] {
    const out: VehicleState[] = [];
    for (const sd of this.serviceDays(t)) {
      const s = (t - sd.origin) / 1000;
      for (const b of sd.tables.blocks) {
        const v = this.blockState(b, s, sd.origin, sd.date, t);
        if (v) out.push(v);
      }
    }
    return out;
  }

  /** Estado de un bus concreto (id devuelto por snapshot/arrivals). */
  vehicle(id: string, t: number): VehicleState | null {
    const sep = id.indexOf(':');
    const date = id.slice(0, sep);
    const blockId = id.slice(sep + 1);
    const dayType = dayTypeFor(date, this.network.holidays);
    const b = this.days.get(dayType)!.blocks.find((x) => x.id === blockId);
    if (!b) return null;
    const origin = serviceDayOrigin(date);
    return this.blockState(b, (t - origin) / 1000, origin, date, t);
  }

  private blockState(b: Block, s: number, origin: number, date: string, t: number): VehicleState | null {
    const trips = b.trips;
    const first = trips[0];
    const last = trips[trips.length - 1];
    if (!first || !last) return null;
    if (s < first.dep - this.opts.preDepartureShowS) return null;
    if (s > last.end + this.opts.retireShowS) return null;
    // última expedición con salida <= s
    let lo = 0;
    let hi = trips.length - 1;
    let k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (trips[mid]!.dep <= s) {
        k = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const vid = `${date}:${b.id}`;
    if (k === -1) return this.atTerminal(b, vid, first, origin, t);
    const cur = trips[k]!;
    if (s <= cur.end) return this.moving(b, vid, cur, s, origin, t);
    const next = trips[k + 1];
    if (next) {
      if (next.dep - s > this.opts.maxLayoverShowS) return null; // se fue a cochera
      return this.atTerminal(b, vid, next, origin, t);
    }
    return this.atEnd(b, vid, cur, origin, t);
  }

  private base(b: Block, vid: string, trip: Trip, origin: number, t: number) {
    return {
      id: vid,
      label: b.label,
      routeId: b.routeId,
      patternId: trip.pattern.p.id,
      tripKey: trip.key,
      source: 'SIMULATED' as const,
      departure: origin + trip.dep * 1000,
      lastTrip: trip.blockPos === b.trips.length - 1,
      timestamp: t,
    };
  }

  private etasFrom(trip: Trip, fromIdx: number, origin: number): StopEta[] {
    const ids = trip.pattern.p.stopIds;
    const out: StopEta[] = [];
    for (let j = fromIdx; j < ids.length; j++)
      out.push({ stopId: ids[j]!, at: origin + (trip.dep + trip.offsets[j]!) * 1000 });
    return out;
  }

  private atTerminal(b: Block, vid: string, trip: Trip, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const d = pp.p.stopDist[0] ?? 0;
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, d);
    return {
      ...this.base(b, vid, trip, origin, t),
      status: 'EN_CABECERA',
      dist: d,
      lon,
      lat,
      bearing: bearingAlong(pp.coords, pp.p.cum, d + 25),
      speedKmh: 0,
      nextStopIndex: 0,
      nextStopId: pp.p.stopIds[0] ?? null,
      etas: this.etasFrom(trip, 0, origin),
    };
  }

  private atEnd(b: Block, vid: string, trip: Trip, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const n = pp.p.stopIds.length;
    const d = pp.p.stopDist[n - 1] ?? pp.p.length;
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, d);
    return {
      ...this.base(b, vid, trip, origin, t),
      status: 'RETIRADA',
      dist: d,
      lon,
      lat,
      bearing: bearingAlong(pp.coords, pp.p.cum, d - 25),
      speedKmh: 0,
      nextStopIndex: n - 1,
      nextStopId: null,
      etas: [],
    };
  }

  /** Posición de un bus en ruta: interpolación por distancia a lo largo de la geometría. */
  private moving(b: Block, vid: string, trip: Trip, s: number, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const sd = pp.p.stopDist;
    const o = trip.offsets;
    const n = o.length;
    const rel = s - trip.dep;
    // i = última parada a la que ya ha llegado
    const i = Math.max(0, Math.min(n - 1, upperBound(o, rel) - 1));
    let dist: number;
    let status: VehicleStatus = 'EN_RUTA';
    let speed = 0;
    let nextIdx: number;
    if (i >= n - 1) {
      dist = sd[n - 1]!;
      status = 'EN_PARADA';
      nextIdx = n - 1;
    } else if (rel < o[i]! + trip.dwell[i]!) {
      dist = sd[i]!;
      status = 'EN_PARADA';
      nextIdx = i + 1;
    } else {
      const leave = o[i]! + trip.dwell[i]!;
      const dur = Math.max(1, o[i + 1]! - leave);
      const f = Math.min(1, Math.max(0, (rel - leave) / dur));
      const segLen = sd[i + 1]! - sd[i]!;
      dist = sd[i]! + ease(f) * segLen;
      speed = (segLen / dur) * easeSpeedFactor(f) * 3.6;
      nextIdx = i + 1;
    }
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, dist);
    return {
      ...this.base(b, vid, trip, origin, t),
      status,
      dist,
      lon,
      lat,
      bearing: bearingAlong(pp.coords, pp.p.cum, dist),
      speedKmh: Math.round(speed),
      nextStopIndex: nextIdx,
      nextStopId: pp.p.stopIds[nextIdx] ?? null,
      etas: this.etasFrom(trip, nextIdx, origin),
    };
  }

  /**
   * Próximas llegadas a una parada. Sale de los mismos offsets que la ficha de
   * bus, así que ambos siempre coinciden (bug 12.3-24).
   */
  arrivals(stopId: string, t: number, horizonMin = 90, limit = 12): Arrival[] {
    const out: Arrival[] = [];
    for (const sd of this.serviceDays(t, true)) {
      const list = sd.tables.byStop.get(stopId);
      if (!list) continue;
      const s = (t - sd.origin) / 1000;
      for (const { trip, idx } of list) {
        const arr = trip.dep + trip.offsets[idx]!;
        if (arr < s - 20) continue;
        if (arr > s + horizonMin * 60) break;
        const visible = s >= trip.dep - this.opts.preDepartureShowS;
        out.push({
          routeId: trip.pattern.route.id,
          patternId: trip.pattern.p.id,
          headsign: trip.pattern.p.headsign,
          at: sd.origin + arr * 1000,
          vehicleId: visible ? `${sd.date}:${trip.vehicle}` : null,
          status: s >= trip.dep ? 'EN_RUTA' : 'PENDENT_SORTIDA',
          source: 'SIMULATED',
        });
      }
    }
    out.sort((a, b) => a.at - b.at);
    return out.slice(0, limit);
  }

  /** Resumen del día para una línea: primera/última salida y frecuencia actual. */
  routeSummary(routeId: string, t: number) {
    const date = localDate(t);
    const dayType = dayTypeFor(date, this.network.holidays);
    const origin = serviceDayOrigin(date);
    const tables = this.days.get(dayType)!;
    const trips = tables.trips.filter((x) => x.pattern.route.id === routeId);
    if (!trips.length) return { runsToday: false as const, dayType };
    const s = (t - origin) / 1000;
    const counts = new Map<string, number>();
    for (const x of trips) counts.set(x.pattern.p.id, (counts.get(x.pattern.p.id) ?? 0) + 1);
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const deps = trips.filter((x) => x.pattern.p.id === main).map((x) => x.dep);
    const near = deps.filter((d) => Math.abs(d - s) <= 45 * 60);
    let headwayMin: number | null = null;
    if (near.length >= 2)
      headwayMin = Math.round((near[near.length - 1]! - near[0]!) / 60 / (near.length - 1));
    return {
      runsToday: true as const,
      dayType,
      first: origin + trips[0]!.dep * 1000,
      last: origin + Math.max(...trips.map((x) => x.dep)) * 1000,
      headwayMin,
      vehicles: tables.blocks.filter((b) => b.routeId === routeId).length,
    };
  }

  /** Primera salida de la red a partir del instante t (estado "ara no hi ha servei"). */
  nextService(t: number): { at: number; routeId: string } | null {
    for (let k = 0; k < 3; k++) {
      const date = addDays(localDate(t), k);
      const dayType = dayTypeFor(date, this.network.holidays);
      const origin = serviceDayOrigin(date);
      const s = (t - origin) / 1000;
      const tr = this.days.get(dayType)!.trips.find((x) => x.dep >= s);
      if (tr) return { at: origin + tr.dep * 1000, routeId: tr.pattern.route.id };
    }
    return null;
  }

  /** Flota necesaria por tipo de día (prueba de cordura, sección 6.3). */
  fleet(dayType: DayType) {
    const d = this.days.get(dayType)!;
    let peak = 0;
    let peakAt = 0;
    for (let s = 4 * 3600; s <= 25 * 3600; s += 300) {
      let n = 0;
      for (const b of d.blocks) {
        if (s >= b.trips[0]!.dep && s <= b.trips[b.trips.length - 1]!.end) n++;
      }
      if (n > peak) {
        peak = n;
        peakAt = s;
      }
    }
    return { blocks: d.blocks.length, trips: d.trips.length, peak, peakAt };
  }

  runsOn(routeId: string, dayType: DayType): boolean {
    return this.days.get(dayType)!.trips.some((x) => x.pattern.route.id === routeId);
  }

  patternById(id: string): Pattern | undefined {
    return this.patterns.get(id)?.p;
  }

  /** Expediciones del día (para generar GTFS y para tests). */
  tripsOf(dayType: DayType): readonly Trip[] {
    return this.days.get(dayType)!.trips;
  }

  blocksOf(dayType: DayType): readonly Block[] {
    return this.days.get(dayType)!.blocks;
  }
}
