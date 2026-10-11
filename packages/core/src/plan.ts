/**
 * Planificador de rutes: d'on soc a on vull anar, en bus.
 *
 * Camina fins a una parada → bus → (com a molt un transbord) → bus → camina fins al destí.
 * Les hores són les mateixes estimacions que la resta de l'app (`engine.boardings`), així que el bus
 * que proposa és el mateix que es veu al mapa. Avui són estimacions simulades sobre l'horari publicat.
 *
 * El destí és un conjunt de punts (els d'un carrer): s'arriba al que queda més a prop de la parada on es baixa.
 */
import { haversine, type LonLat } from './geo.ts';
import type { Boarding, SimEngine } from './sim/engine.ts';
import type { DataSource } from './types.ts';

/** 4,5 km/h */
export const WALK_M_PER_MIN = 75;
/** els carrers no van en línia recta: distància a peu ≈ recta × 1,3 */
export const WALK_DETOUR = 1.3;
/** com a molt, metres a peu fins a la primera parada i des de l'última */
export const MAX_ACCESS_M = 1100;
/** com a molt, metres a peu en un transbord (canviar de vorera, de pal…) */
export const MAX_TRANSFER_M = 350;
/** marge per fer un transbord, a més de caminar */
export const TRANSFER_BUFFER_MS = 60_000;

export interface WalkLeg {
  kind: 'walk';
  from: LonLat;
  to: LonLat;
  meters: number;
  start: number;
  end: number;
}

export interface BusLeg {
  kind: 'bus';
  routeId: string;
  patternId: string;
  headsign: string;
  tripKey: string;
  vehicleId: string | null;
  boardIndex: number;
  alightIndex: number;
  boardStopId: string;
  alightStopId: string;
  depart: number;
  arrive: number;
  scheduledDepart: number;
  scheduledArrive: number;
  /** parades que fa el bus des que hi puges fins que baixes */
  stops: number;
  source: DataSource;
}

export type Leg = WalkLeg | BusLeg;

export interface Itinerary {
  legs: Leg[];
  /** quan has de sortir d'on ets */
  leaveAt: number;
  arrive: number;
  transfers: number;
  walkMeters: number;
}

export interface PlanResult {
  itineraries: Itinerary[];
  /** anar-hi a peu, si és a menys de 2 km */
  walk: WalkLeg | null;
  /** el destí és tan a prop que és millor caminar */
  walkIsBetter: boolean;
  /** per què no hi ha cap opció en bus */
  reason: 'ok' | 'origin-far' | 'destination-far' | 'no-service';
}

export interface PlanOptions {
  maxAccessM?: number;
  /** quantes opcions com a molt */
  limit?: number;
  /** minuts endavant per buscar el primer bus */
  horizonMin?: number;
}

export const walkMeters = (a: LonLat, b: LonLat) => haversine(a, b) * WALK_DETOUR;
export const walkMs = (m: number) => Math.round((m / WALK_M_PER_MIN) * 60_000);

const neighbourCache = new WeakMap<SimEngine, Map<string, { id: string; m: number }[]>>();

/** Parades a menys de MAX_TRANSFER_M a peu d'una altra (inclosa ella mateixa). */
function neighbours(engine: SimEngine, stopId: string) {
  let cache = neighbourCache.get(engine);
  if (!cache) neighbourCache.set(engine, (cache = new Map()));
  const hit = cache.get(stopId);
  if (hit) return hit;
  const s = engine.stops.get(stopId)!;
  const out: { id: string; m: number }[] = [];
  for (const o of engine.stops.values()) {
    const m = o.id === s.id ? 0 : walkMeters([s.lon, s.lat], [o.lon, o.lat]);
    if (m <= MAX_TRANSFER_M) out.push({ id: o.id, m });
  }
  cache.set(stopId, out);
  return out;
}

function busLeg(engine: SimEngine, b: Boarding, k: number): BusLeg {
  const p = engine.patternById(b.patternId)!;
  return {
    kind: 'bus',
    routeId: b.routeId,
    patternId: b.patternId,
    headsign: b.headsign,
    tripKey: b.tripKey,
    vehicleId: b.vehicleId,
    boardIndex: b.fromIndex,
    alightIndex: b.fromIndex + k,
    boardStopId: p.stopIds[b.fromIndex]!,
    alightStopId: p.stopIds[b.fromIndex + k]!,
    depart: b.times[0]!,
    arrive: b.times[k]!,
    scheduledDepart: b.scheduled[0]!,
    scheduledArrive: b.scheduled[k]!,
    stops: k,
    source: b.source,
  };
}

const posOf = (engine: SimEngine, id: string): LonLat => {
  const s = engine.stops.get(id)!;
  return [s.lon, s.lat];
};

function walk(from: LonLat, to: LonLat, start: number): WalkLeg {
  const meters = walkMeters(from, to);
  return { kind: 'walk', from, to, meters: Math.round(meters), start, end: start + walkMs(meters) };
}

function build(engine: SimEngine, from: LonLat, buses: BusLeg[], dest: { m: number; pt: LonLat }): Itinerary {
  const legs: Leg[] = [];
  const first = buses[0]!;
  const access = walk(from, posOf(engine, first.boardStopId), 0);
  const leaveAt = first.depart - (access.end - access.start);
  legs.push({ ...access, start: leaveAt, end: first.depart });
  buses.forEach((b, i) => {
    if (i > 0) {
      const prev = buses[i - 1]!;
      if (prev.alightStopId !== b.boardStopId) legs.push(walk(posOf(engine, prev.alightStopId), posOf(engine, b.boardStopId), prev.arrive));
    }
    legs.push(b);
  });
  const last = buses[buses.length - 1]!;
  const egress = walk(posOf(engine, last.alightStopId), dest.pt, last.arrive);
  legs.push(egress);
  const walked = legs.reduce((a, l) => a + (l.kind === 'walk' ? l.meters : 0), 0);
  return { legs, leaveAt, arrive: egress.end, transfers: buses.length - 1, walkMeters: walked };
}

/**
 * Puntuació de «millor opció» (menys és millor), en ms: l'hora d'arribada estimada, més +5 min per transbord,
 * +0,5 min per cada minut a peu i +1 min si el bus encara no ha sortit de capçalera (menys segur).
 * A l'usuari només se li diu «Millor opció».
 */
export function scoreOf(it: Itinerary): number {
  const walkMin = it.walkMeters / WALK_M_PER_MIN;
  const first = it.legs.find((l): l is BusLeg => l.kind === 'bus');
  return it.arrive + it.transfers * 5 * 60_000 + walkMin * 0.5 * 60_000 + (first && !first.vehicleId ? 60_000 : 0);
}

/** A domina B si arriba abans (o igual), surt més tard (o igual), amb menys o igual transbords i caminant semblant. */
const dominates = (a: Itinerary, b: Itinerary) =>
  a !== b && a.arrive <= b.arrive && a.leaveAt >= b.leaveAt && a.transfers <= b.transfers && a.walkMeters <= b.walkMeters + 150;

export function planTrip(engine: SimEngine, from: LonLat, to: LonLat[], t: number, opts: PlanOptions = {}): PlanResult {
  const maxAccess = opts.maxAccessM ?? MAX_ACCESS_M;
  const limit = opts.limit ?? 3;
  const horizon = opts.horizonMin ?? 75;

  // a peu
  let nearestDest = to[0]!;
  let nearestM = Infinity;
  for (const p of to) {
    const m = walkMeters(from, p);
    if (m < nearestM) {
      nearestM = m;
      nearestDest = p;
    }
  }
  const walkLeg = nearestM <= 2000 ? walk(from, nearestDest, t) : null;

  // parades de sortida i d'arribada
  const origins: { id: string; m: number }[] = [];
  const dests = new Map<string, { m: number; pt: LonLat }>();
  for (const s of engine.stops.values()) {
    const sp: LonLat = [s.lon, s.lat];
    const m = walkMeters(from, sp);
    if (m <= maxAccess) origins.push({ id: s.id, m });
    let best = Infinity;
    let pt = to[0]!;
    for (const p of to) {
      const d = walkMeters(sp, p);
      if (d < best) {
        best = d;
        pt = p;
      }
    }
    if (best <= maxAccess) dests.set(s.id, { m: best, pt });
  }
  origins.sort((a, b) => a.m - b.m);
  const result = (itineraries: Itinerary[], reason: PlanResult['reason']): PlanResult => ({
    itineraries,
    walk: walkLeg,
    // a peu només si és curt: < 450 m, o arribes abans i no passa de ~15 min caminant
    walkIsBetter: Boolean(
      walkLeg && (walkLeg.meters < 450 || (walkLeg.meters <= 15 * WALK_M_PER_MIN && (itineraries.length === 0 || walkLeg.end <= itineraries[0]!.arrive))),
    ),
    reason,
  });
  if (origins.length === 0) return result([], 'origin-far');
  if (dests.size === 0) return result([], 'destination-far');

  const found: Itinerary[] = [];
  // una sola volta: l'hora més aviat que s'arriba a cada parada amb un bus (per als transbords)
  const reach = new Map<string, BusLeg>();
  for (const o of origins.slice(0, 30)) {
    const ready = t + walkMs(o.m);
    for (const b of engine.boardings(o.id, ready, horizon)) {
      const p = engine.patternById(b.patternId)!;
      for (let k = 1; k < b.times.length; k++) {
        const stopId = p.stopIds[b.fromIndex + k]!;
        const leg = busLeg(engine, b, k);
        const d = dests.get(stopId);
        if (d) found.push(build(engine, from, [leg], d));
        const prev = reach.get(stopId);
        if (!prev || leg.arrive < prev.arrive) reach.set(stopId, leg);
      }
    }
  }

  // un transbord: només si pot millorar el millor directe. Per a cada parada on es pot fer el canvi,
  // les expedicions es demanen un sol cop (des del primer moment que s'hi pot ser).
  const bestDirect = found.reduce((a, i) => Math.min(a, i.arrive), Infinity);
  const transfersAt = new Map<string, { leg1: BusLeg; ready: number }[]>();
  for (const [stopId, leg1] of reach) {
    if (leg1.arrive >= bestDirect) continue;
    const here = dests.get(stopId);
    if (here && here.m < 250) continue; // ja hi ets
    for (const n of neighbours(engine, stopId)) {
      const list = transfersAt.get(n.id) ?? [];
      list.push({ leg1, ready: leg1.arrive + walkMs(n.m) + TRANSFER_BUFFER_MS });
      transfersAt.set(n.id, list);
    }
  }
  for (const [stopId, list] of transfersAt) {
    const first = list.reduce((a, x) => Math.min(a, x.ready), Infinity);
    const boards = engine.boardings(stopId, first, 60);
    if (boards.length === 0) continue;
    for (const b of boards) {
      const p = engine.patternById(b.patternId)!;
      // destins que fa aquesta expedició (abans del millor directe)
      const hits: number[] = [];
      for (let k = 1; k < b.times.length; k++) {
        if (b.times[k]! >= bestDirect) break;
        if (dests.has(p.stopIds[b.fromIndex + k]!)) hits.push(k);
      }
      if (hits.length === 0) continue;
      for (const { leg1, ready } of list) {
        if (b.routeId === leg1.routeId || b.times[0]! < ready) continue;
        for (const k of hits) found.push(build(engine, from, [leg1, busLeg(engine, b, k)], dests.get(p.stopIds[b.fromIndex + k]!)!));
      }
    }
  }
  if (found.length === 0) return result([], 'no-service');

  // una opció per combinació d'expedicions (la que arriba abans), sense les dominades
  const byTrips = new Map<string, Itinerary>();
  for (const it of found) {
    const key = it.legs.flatMap((l) => (l.kind === 'bus' ? [l.tripKey] : [])).join('>');
    const cur = byTrips.get(key);
    if (!cur || it.arrive < cur.arrive || (it.arrive === cur.arrive && it.walkMeters < cur.walkMeters)) byTrips.set(key, it);
  }
  const uniq = [...byTrips.values()];
  const kept = uniq.filter((b) => !uniq.some((a) => dominates(a, b) && !(dominates(b, a) && uniq.indexOf(b) < uniq.indexOf(a))));
  // la millor opció primer (puntuació), i opcions variades: no tres vegades el mateix bus a la mateixa parada
  kept.sort((a, b) => scoreOf(a) - scoreOf(b));
  const picked: Itinerary[] = [];
  const seen = new Set<string>();
  for (const it of kept) {
    const b = it.legs.find((l): l is BusLeg => l.kind === 'bus')!;
    const key = `${it.legs.flatMap((l) => (l.kind === 'bus' ? [l.routeId] : [])).join('>')}@${b.boardStopId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(it);
    if (picked.length >= limit) break;
  }
  // si no n'hi ha prou de diferents, el següent bus de la millor
  for (const it of kept) if (picked.length < limit && !picked.includes(it)) picked.push(it);
  return result(picked, 'ok');
}

/**
 * «Arribar a les…» (licitació 2024, PPT §2.2.1: hora de sortida o d'arribada). Busca cap enrere des de l'hora
 * límit, de 10 en 10 min (fins a 2 h abans), i es queda amb les opcions que hi arriben a temps i surten més tard.
 * Les hores són les mateixes estimacions que la resta de l'app.
 */
export function planArriveBy(engine: SimEngine, from: LonLat, to: LonLat[], deadline: number, opts: PlanOptions = {}): PlanResult {
  const limit = opts.limit ?? 3;
  let last: PlanResult | null = null;
  for (let k = 1; k <= 12; k++) {
    const r = planTrip(engine, from, to, deadline - k * 10 * 60_000, { ...opts, limit: 12, horizonMin: Math.max(opts.horizonMin ?? 0, k * 10 + 15) });
    last = r;
    if (r.reason === 'origin-far' || r.reason === 'destination-far') return { ...r, itineraries: [] };
    const ok = r.itineraries.filter((it) => it.arrive <= deadline);
    if (ok.length) {
      const seen = new Set<string>();
      const picked = ok
        .sort((a, b) => b.leaveAt - a.leaveAt || a.arrive - b.arrive)
        .filter((it) => {
          const key = it.legs.flatMap((l) => (l.kind === 'bus' ? [l.tripKey] : [])).join('>');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, limit);
      return { ...r, itineraries: picked, reason: 'ok' };
    }
  }
  return { ...(last ?? planTrip(engine, from, to, deadline)), itineraries: [], reason: 'no-service' };
}
