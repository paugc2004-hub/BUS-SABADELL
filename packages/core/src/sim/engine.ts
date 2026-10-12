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
import { enrich, journeyOf, type BaseVehicle } from '../vehicle.ts';
import type {
  Arrival,
  DataSource,
  DayType,
  Journey,
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
  /**
   * Retrasos simulados (deterministas por fecha + expedición). false = todo exactamente
   * a su hora (tests de horario y modo "solo horario").
   */
  delays?: boolean;
}

const DEFAULTS: Required<EngineOptions> = {
  preDepartureShowS: 240,
  retireShowS: 150,
  maxLayoverShowS: 25 * 60,
  chainRadiusM: 350,
  minLayoverS: 60,
  delays: true,
};

/** límites de los retrasos simulados (s) */
export const MAX_EARLY_S = 90;
export const MAX_DELAY_S = 540;

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
  /** variación de velocidad de crucero por tramo (−0,3…0,3): misma duración, distinto ritmo */
  wobble: number[];
  vehicle: string;
  blockPos: number;
}

/** Una expedició que es pot agafar a una parada (planificador de rutes). */
export interface Boarding {
  /** identificador únic de l'expedició en aquell dia de servei */
  tripKey: string;
  routeId: string;
  patternId: string;
  headsign: string;
  /** índex de la parada de pujada dins el pattern */
  fromIndex: number;
  /** hora estimada (epoch ms) a cada parada des de fromIndex fins al final */
  times: number[];
  /** hora programada (epoch ms), mateix ordre */
  scheduled: number[];
  /** el bus, si ja es pot seguir (null si encara ha d'acabar l'expedició anterior o sortir de capçalera) */
  vehicleId: string | null;
  source: DataSource;
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
  blockById: Map<string, Block>;
  byStop: Map<string, { trip: Trip; idx: number }[]>;
}

/**
 * Horas reales (simuladas) de un día concreto: para cada expedición del torn, la salida
 * y la llegada a cada parada en segundos desde el origen del día de servicio.
 */
interface Actual {
  dep: number;
  arr: number[];
  end: number;
}

/** aceleración y frenada típicas de un autobús urbano (m/s²) */
export const ACCEL = 1.0;
export const DECEL = 1.2;

/**
 * Perfil de velocidad trapezoidal entre dos paradas: arranca con aceleración
 * constante, va a velocidad de crucero y frena hasta detenerse en la parada.
 * Recorre `len` metros en `dur` segundos exactos. Si con esas aceleraciones no
 * da tiempo (tramo muy corto o muy rápido), se usa un perfil triangular.
 * Devuelve [metros recorridos, velocidad en m/s] en el instante `tau`.
 */
export function trapezoid(len: number, dur: number, tau: number, a = ACCEL, b = DECEL): [number, number] {
  if (len <= 0 || dur <= 0) return [Math.max(0, len), 0];
  const t = Math.min(dur, Math.max(0, tau));
  const k = (1 / a + 1 / b) / 2;
  const disc = dur * dur - 4 * k * len;
  let v: number;
  let ta: number;
  let tb: number;
  if (disc >= 0) {
    v = (dur - Math.sqrt(disc)) / (2 * k);
    ta = v / a;
    tb = v / b;
  } else {
    // triangular: misma proporción de arranque y frenada, pico = 2·media
    v = (2 * len) / dur;
    ta = (dur * b) / (a + b);
    tb = dur - ta;
  }
  const accA = v / ta;
  const accB = v / tb;
  if (t <= ta) return [0.5 * accA * t * t, accA * t];
  if (t >= dur - tb) {
    const r = dur - t;
    return [len - 0.5 * accB * r * r, accB * r];
  }
  return [0.5 * accA * ta * ta + v * (t - ta), v];
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
        const wobble = offsets.map(() => (rnd() - 0.5) * 0.6);
        trips.push({
          key,
          pattern: pp,
          dep,
          offsets,
          end: dep + (offsets[offsets.length - 1] ?? 0),
          dwell,
          wobble,
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
    return { trips, blocks, blockById: new Map(blocks.map((b) => [b.id, b])), byStop };
  }

  // ------------------------------------------------------------------ retrasos simulados

  private actualCache = new Map<string, Actual[]>();

  /**
   * Retrasos simulados de un torn en una fecha. Deterministas (semilla = fecha + expedición):
   * recargar la página da lo mismo. Cada parada suma una pequeña deriva (más en hora punta),
   * se recupera algo en los tramos rápidos, y un viaje que llega tarde a cabecera sale tarde
   * en el siguiente si no le da tiempo al descanso mínimo. Acotados a [−90 s, +9 min].
   */
  private actualOf(b: Block, date: string): Actual[] {
    const key = `${date}|${b.id}`;
    const hit = this.actualCache.get(key);
    if (hit) return hit;
    if (this.actualCache.size > 4000) this.actualCache.clear();
    const out: Actual[] = [];
    let prevEnd = -Infinity;
    for (const t of b.trips) {
      if (!this.opts.delays) {
        out.push({ dep: t.dep, arr: t.offsets.map((o) => t.dep + o), end: t.end });
        continue;
      }
      const rnd = mulberry32(hashString(`${date}|${t.key}`));
      // carácter de la expedición: la mayoría normales, algunas con tráfico, pocas adelantadas
      const r = rnd();
      const kind = r < 0.75 ? 'normal' : r < 0.9 ? 'traffic' : 'early';
      const h = (t.dep / 3600) % 24;
      const peak = (h >= 7 && h < 9.5) || (h >= 13 && h < 15) || (h >= 17 && h < 19.5) ? 1.6 : 1;
      const own = rnd() * 40; // las salidas de cabecera son casi puntuales
      let d = Math.max(own, prevEnd + this.opts.minLayoverS - t.dep);
      const arr: number[] = [];
      for (let i = 0; i < t.offsets.length; i++) {
        if (i > 0) {
          const seg = t.offsets[i]! - t.offsets[i - 1]!;
          let step: number;
          if (kind === 'traffic') step = (1 + rnd() * 13) * peak;
          else if (kind === 'early') step = -7 + rnd() * 8;
          else step = -6 + rnd() * 11 * peak;
          // un tramo largo deja recuperar (o perder) algo más
          step *= Math.min(2, Math.max(0.5, seg / 75));
          // regulación: con retraso, el conductor (o el centro de control) recupera un poco
          if (d > 120) step -= 4;
          d = Math.min(MAX_DELAY_S, Math.max(-MAX_EARLY_S, d + step));
        }
        let a = t.dep + t.offsets[i]! + d;
        // nunca antes de lo físicamente posible: dwell de la anterior + 15 s de marcha
        if (i > 0) a = Math.max(a, arr[i - 1]! + t.dwell[i - 1]! + 15);
        arr.push(a);
      }
      const dep = arr[0]!;
      const end = arr[arr.length - 1]!;
      out.push({ dep, arr, end });
      prevEnd = end;
    }
    this.actualCache.set(key, out);
    return out;
  }

  /** Hora estimada (s desde el origen del día) de la expedición `trip` en la parada idx. */
  private actualAt(tables: DayTables, trip: Trip, idx: number, date: string): number {
    const b = tables.blockById.get(trip.vehicle);
    if (!b) return trip.dep + trip.offsets[idx]!;
    return this.actualOf(b, date)[trip.blockPos]!.arr[idx]!;
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
      return { date, dayType, origin: serviceDayOrigin(date), tables: this.tablesFor(date) };
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
    const b = this.tablesFor(date).blockById.get(blockId);
    if (!b) return null;
    const origin = serviceDayOrigin(date);
    return this.blockState(b, (t - origin) / 1000, origin, date, t);
  }

  private blockState(b: Block, s: number, origin: number, date: string, t: number): VehicleState | null {
    const trips = b.trips;
    const first = trips[0];
    const last = trips[trips.length - 1];
    if (!first || !last) return null;
    // cota rápida con el horario (los retrasos están acotados) antes de calcular nada
    if (s < first.dep - this.opts.preDepartureShowS - MAX_EARLY_S) return null;
    if (s > last.end + this.opts.retireShowS + MAX_DELAY_S + 3600) return null;
    const act = this.actualOf(b, date);
    if (s < act[0]!.dep - this.opts.preDepartureShowS) return null;
    if (s > act[act.length - 1]!.end + this.opts.retireShowS) return null;
    // última expedición con salida real <= s
    let lo = 0;
    let hi = trips.length - 1;
    let k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (act[mid]!.dep <= s) {
        k = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const vid = `${date}:${b.id}`;
    if (k === -1) return this.atTerminal(b, vid, first, act[0]!, origin, t);
    const cur = trips[k]!;
    if (s <= act[k]!.end) return this.moving(b, vid, cur, act[k]!, s, origin, t);
    const next = trips[k + 1];
    if (next) {
      if (act[k + 1]!.dep - s > this.opts.maxLayoverShowS) return null; // se fue a cochera
      return this.atTerminal(b, vid, next, act[k + 1]!, origin, t);
    }
    return this.atEnd(b, vid, cur, origin, t);
  }

  private base(b: Block, vid: string, trip: Trip, origin: number, t: number, act?: Actual) {
    return {
      id: vid,
      label: b.label,
      routeId: b.routeId,
      patternId: trip.pattern.p.id,
      tripKey: trip.key,
      source: 'SIMULATED' as const,
      departure: origin + (act?.dep ?? trip.dep) * 1000,
      lastTrip: trip.blockPos === b.trips.length - 1,
      timestamp: t,
    };
  }

  private etasFrom(trip: Trip, act: Actual, fromIdx: number, origin: number): StopEta[] {
    const ids = trip.pattern.p.stopIds;
    const out: StopEta[] = [];
    for (let j = fromIdx; j < ids.length; j++)
      out.push({ stopId: ids[j]!, at: Math.round(origin + act.arr[j]! * 1000), scheduledAt: origin + (trip.dep + trip.offsets[j]!) * 1000 });
    return out;
  }

  private atTerminal(b: Block, vid: string, trip: Trip, act: Actual, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const d = pp.p.stopDist[0] ?? 0;
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, d);
    return this.out(pp, {
      ...this.base(b, vid, trip, origin, t, act),
      delaySec: this.opts.delays ? Math.round(act.dep - trip.dep) : null,
      status: 'EN_CABECERA',
      dist: d,
      lon,
      lat,
      bearing: bearingAlong(pp.coords, pp.p.cum, d + 25),
      speedKmh: 0,
      nextStopIndex: 0,
      nextStopId: pp.p.stopIds[0] ?? null,
      etas: this.etasFrom(trip, act, 0, origin),
    });
  }

  private out(pp: PreparedPattern, v: BaseVehicle): VehicleState {
    return enrich(pp.p, v);
  }

  private atEnd(b: Block, vid: string, trip: Trip, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const n = pp.p.stopIds.length;
    const d = pp.p.stopDist[n - 1] ?? pp.p.length;
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, d);
    return this.out(pp, {
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
    });
  }

  /** Posición de un bus en ruta: interpolación por distancia a lo largo de la geometría. */
  private moving(b: Block, vid: string, trip: Trip, act: Actual, s: number, origin: number, t: number): VehicleState {
    const pp = trip.pattern;
    const sd = pp.p.stopDist;
    // horas reales (con el retraso simulado) relativas a la salida real
    const o = act.arr.map((a) => a - act.dep);
    const n = o.length;
    const rel = s - act.dep;
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
      const segLen = sd[i + 1]! - sd[i]!;
      // pequeña variación de ritmo dentro del tramo (misma duración total, monótona)
      const tau = rel - leave;
      const f = Math.min(1, Math.max(0, tau / dur));
      const w = trip.wobble[i] ?? 0;
      const warped = tau + (w * dur * Math.sin(2 * Math.PI * f)) / (2 * Math.PI);
      const [run, ms] = trapezoid(segLen, dur, warped);
      dist = sd[i]! + Math.min(segLen, run);
      speed = ms * (1 + w * Math.cos(2 * Math.PI * f)) * 3.6;
      nextIdx = i + 1;
    }
    const [lon, lat] = pointAlong(pp.coords, pp.p.cum, dist);
    // retraso en la próxima parada: estimado − programado
    const delay = this.opts.delays ? Math.round(act.arr[nextIdx]! - (trip.dep + trip.offsets[nextIdx]!)) : null;
    if (status === 'EN_RUTA' && delay !== null && delay >= 180) status = 'RETRASADO';
    return this.out(pp, {
      ...this.base(b, vid, trip, origin, t, act),
      delaySec: delay,
      status,
      dist,
      lon,
      lat,
      // mirando más hacia delante que hacia atrás: gira con suavidad y no se retrasa en las curvas cerradas
      bearing: bearingAlong(pp.coords, pp.p.cum, dist, 20, 8),
      speedKmh: Math.round(speed),
      nextStopIndex: nextIdx,
      nextStopId: pp.p.stopIds[nextIdx] ?? null,
      etas: this.etasFrom(trip, act, nextIdx, origin),
    });
  }

  /**
   * Línia temporal del trajecte actual d'un bus: hores de pas per totes les parades
   * (les passades, simulades; les futures, les mateixes ETA que la fitxa i el panell de parada).
   */
  journey(id: string, t: number): Journey | null {
    const v = this.vehicle(id, t);
    if (!v) return null;
    const sep = id.indexOf(':');
    const date = id.slice(0, sep);
    const blockId = id.slice(sep + 1);
    const b = this.tablesFor(date).blockById.get(blockId);
    const trip = b?.trips.find((x) => x.key === v.tripKey);
    const pp = this.patterns.get(v.patternId);
    if (!trip || !pp || !b) return null;
    const origin = serviceDayOrigin(date);
    const act = this.actualOf(b, date)[trip.blockPos]!;
    return journeyOf(
      pp.p,
      v,
      act.arr.map((a) => Math.round(origin + a * 1000)),
      trip.offsets.map((o) => origin + (trip.dep + o) * 1000),
    );
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
        const sched = trip.dep + trip.offsets[idx]!;
        // la lista va ordenada por horario; los retrasos están acotados
        if (sched < s - 20 - MAX_DELAY_S) continue;
        if (sched > s + horizonMin * 60 + MAX_EARLY_S) break;
        const arr = this.actualAt(sd.tables, trip, idx, sd.date);
        if (arr < s - 20 || arr > s + horizonMin * 60) continue;
        const b = sd.tables.blockById.get(trip.vehicle);
        const depAct = b ? this.actualOf(b, sd.date)[trip.blockPos]!.dep : trip.dep;
        const visible = s >= depAct - this.opts.preDepartureShowS;
        out.push({
          routeId: trip.pattern.route.id,
          patternId: trip.pattern.p.id,
          headsign: trip.pattern.p.headsign,
          at: Math.round(sd.origin + arr * 1000),
          scheduledAt: sd.origin + sched * 1000,
          delaySec: this.opts.delays ? Math.round(arr - sched) : null,
          vehicleId: visible ? `${sd.date}:${trip.vehicle}` : null,
          status: s >= depAct ? 'EN_RUTA' : 'PENDENT_SORTIDA',
          source: 'SIMULATED',
        });
      }
    }
    out.sort((a, b) => a.at - b.at);
    return out.slice(0, limit);
  }

  /**
   * Per al planificador de rutes: expedicions que passen per una parada dins una finestra, amb
   * l'hora estimada (la mateixa de les llegades i la fitxa del bus) a la parada i a totes les que segueixen.
   */
  boardings(stopId: string, t: number, horizonMin = 60): Boarding[] {
    const out: Boarding[] = [];
    for (const sd of this.serviceDays(t, true)) {
      const list = sd.tables.byStop.get(stopId);
      if (!list) continue;
      const s = (t - sd.origin) / 1000;
      for (const { trip, idx } of list) {
        const sched = trip.dep + trip.offsets[idx]!;
        if (sched < s - MAX_DELAY_S) continue;
        if (sched > s + horizonMin * 60 + MAX_EARLY_S) break;
        const b = sd.tables.blockById.get(trip.vehicle);
        const act = b ? this.actualOf(b, sd.date)[trip.blockPos]! : null;
        const at = (i: number) => (act ? act.arr[i]! : trip.dep + trip.offsets[i]!);
        if (at(idx) < s || at(idx) > s + horizonMin * 60) continue;
        const times: number[] = [];
        const scheduled: number[] = [];
        for (let i = idx; i < trip.offsets.length; i++) {
          times.push(Math.round(sd.origin + at(i) * 1000));
          scheduled.push(sd.origin + (trip.dep + trip.offsets[i]!) * 1000);
        }
        const depAct = act ? act.dep : trip.dep;
        out.push({
          tripKey: `${sd.date}|${trip.key}`,
          routeId: trip.pattern.route.id,
          patternId: trip.pattern.p.id,
          headsign: trip.pattern.p.headsign,
          fromIndex: idx,
          times,
          scheduled,
          vehicleId: s >= depAct - this.opts.preDepartureShowS ? `${sd.date}:${trip.vehicle}` : null,
          source: 'SIMULATED',
        });
      }
    }
    out.sort((a, b) => a.times[0]! - b.times[0]!);
    return out;
  }

  /** Resumen del día para una línea: primera/última salida y frecuencia actual. */
  routeSummary(routeId: string, t: number) {
    const date = localDate(t);
    const dayType = dayTypeFor(date, this.network.holidays);
    const origin = serviceDayOrigin(date);
    const tables = this.tablesFor(date);
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
      const origin = serviceDayOrigin(date);
      const s = (t - origin) / 1000;
      const tr = this.tablesFor(date).trips.find((x) => x.dep >= s);
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

  /** la línia té servei en aquest tipus de dia (sense comptar les línies que només van uns dies concrets) */
  runsOn(routeId: string, dayType: DayType): boolean {
    return this.days.get(dayType)!.trips.some((x) => x.pattern.route.id === routeId);
  }

  /** la línia té servei aquest dia de servei (YYYY-MM-DD), p. ex. la F6 només els festius comercials */
  runsOnDate(routeId: string, date: string): boolean {
    return this.tablesFor(date).trips.some((x) => x.pattern.route.id === routeId);
  }

  /** la línia té servei el dia (local) de l'instant t */
  runsAt(routeId: string, t: number): boolean {
    return this.runsOnDate(routeId, localDate(t));
  }

  private filtered = new Map<string, DayTables>();
  /** taules ja resoltes per data: el tipus de dia i el filtre de `onlyDates` no canvien per a una mateixa data */
  private byDate = new Map<string, DayTables>();

  /**
   * Taules d'un dia de servei concret: les del seu tipus de dia, sense les línies que només circulen unes dates
   * (`Route.onlyDates`) si aquell dia no hi és. Els torns són d'una sola línia, així que es treuen sencers.
   */
  private tablesFor(date: string): DayTables {
    const hit = this.byDate.get(date);
    if (hit) return hit;
    const dayType = dayTypeFor(date, this.network.holidays);
    const base = this.days.get(dayType)!;
    const off = this.network.routes.filter((r) => r.onlyDates && !r.onlyDates.includes(date)).map((r) => r.id);
    let t = base;
    if (off.length > 0) {
      const key = `${dayType}|${off.join(',')}`;
      let f = this.filtered.get(key);
      if (!f) {
        const o = new Set(off);
        f = {
          trips: base.trips.filter((x) => !o.has(x.pattern.route.id)),
          blocks: base.blocks.filter((b) => !o.has(b.routeId)),
          blockById: new Map([...base.blockById].filter(([, b]) => !o.has(b.routeId))),
          byStop: new Map([...base.byStop].map(([k, v]) => [k, v.filter((e) => !o.has(e.trip.pattern.route.id))])),
        };
        this.filtered.set(key, f);
      }
      t = f;
    }
    // poques dates per sessió (ahir, avui, demà i les que es consultin a Línies); acotat per si de cas
    if (this.byDate.size > 400) this.byDate.clear();
    this.byDate.set(date, t);
    return t;
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
