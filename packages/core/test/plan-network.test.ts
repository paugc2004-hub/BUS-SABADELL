/**
 * Planificador sobre la xarxa real (network.json): propietats que ha de complir qualsevol itinerari
 * que es mostra a l'usuari, per a orígens, destins i hores a l'atzar (fast-check, llavor fixa).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_ACCESS_M, SimEngine, planArriveBy, planTrip, scoreOf, type Itinerary, type LonLat, type NetworkData } from '../src/index.ts';

const net = JSON.parse(readFileSync(join(__dirname, '../../../apps/web/public/data/network.json'), 'utf8')) as NetworkData;
const engine = new SimEngine(net);
const stops = net.stops;
// dimarts 6 d'octubre de 2026 a les 00:00 (hora local, UTC+2)
const DAY = Date.parse('2026-10-05T22:00:00Z');
const H = 3600_000;

const span = (l: Itinerary['legs'][number]): [number, number] => (l.kind === 'bus' ? [l.depart, l.arrive] : [l.start, l.end]);

/** un punt a ~0–400 m d'una parada de la xarxa */
const placeArb = fc
  .tuple(fc.integer({ min: 0, max: stops.length - 1 }), fc.double({ min: -0.003, max: 0.003, noNaN: true }), fc.double({ min: -0.003, max: 0.003, noNaN: true }))
  .map(([i, dx, dy]): LonLat => [stops[i]!.lon + dx, stops[i]!.lat + dy]);

function checkItinerary(it: Itinerary, t: number) {
  const buses = it.legs.filter((l) => l.kind === 'bus');
  // a peu → bus → (a peu) → (bus) → a peu
  expect(it.legs[0]!.kind).toBe('walk');
  expect(it.legs.at(-1)!.kind).toBe('walk');
  expect(buses.length).toBe(it.transfers + 1);
  expect(it.transfers).toBeLessThanOrEqual(1);
  // no et diu que surtis abans d'ara i el temps sempre avança
  expect(it.leaveAt).toBeGreaterThanOrEqual(t);
  expect(span(it.legs[0]!)[0]).toBe(it.leaveAt);
  expect(span(it.legs.at(-1)!)[1]).toBe(it.arrive);
  for (let i = 1; i < it.legs.length; i++) expect(span(it.legs[i]!)[0]).toBeGreaterThanOrEqual(span(it.legs[i - 1]!)[1]);
  for (const l of it.legs) expect(span(l)[1]).toBeGreaterThanOrEqual(span(l)[0]);
  // a peu fins a la parada i des de la parada, dins del límit
  const [first, last] = [it.legs[0]!, it.legs.at(-1)!];
  if (first.kind === 'walk') expect(first.meters).toBeLessThanOrEqual(MAX_ACCESS_M + 1);
  if (last.kind === 'walk') expect(last.meters).toBeLessThanOrEqual(MAX_ACCESS_M + 1);
  for (const b of buses) {
    if (b.kind !== 'bus') continue;
    expect(b.stops).toBeGreaterThanOrEqual(1);
    expect(b.boardStopId).not.toBe(b.alightStopId);
    expect(b.arrive).toBeGreaterThan(b.depart);
    // simulació: mai s'etiqueta com a temps real
    expect(b.source).not.toBe('REALTIME');
    const p = engine.patternById(b.patternId)!;
    expect(p.stopIds[b.boardIndex]).toBe(b.boardStopId);
    expect(p.stopIds[b.alightIndex]).toBe(b.alightStopId);
  }
  if (buses.length === 2 && buses[0]!.kind === 'bus' && buses[1]!.kind === 'bus') {
    // transbord: una altra línia i temps per canviar
    expect(buses[1]!.routeId).not.toBe(buses[0]!.routeId);
    expect(buses[1]!.depart).toBeGreaterThanOrEqual(buses[0]!.arrive + 60_000);
  }
}

describe('planificador sobre la xarxa real', () => {
  it('qualsevol itinerari és coherent: ordre, hores, parades, transbords i origen de les dades', () => {
    fc.assert(
      fc.property(placeArb, placeArb, fc.integer({ min: 6 * 60, max: 21 * 60 }), (from, to, min) => {
        const t = DAY + min * 60_000;
        const r = planTrip(engine, from, [to], t);
        expect(['ok', 'origin-far', 'destination-far', 'no-service']).toContain(r.reason);
        if (r.reason !== 'ok') {
          expect(r.itineraries).toHaveLength(0);
          return;
        }
        // sense cap bus útil, és perquè anar-hi a peu és millor
        if (r.itineraries.length === 0) {
          expect(r.walk).not.toBeNull();
          return;
        }
        // cap opció en bus fa caminar més que anar-hi directament
        for (const it of r.itineraries) if (r.walk) expect(it.walkMeters).toBeLessThan(r.walk.meters);
        expect(r.itineraries.length).toBeLessThanOrEqual(3);
        for (const it of r.itineraries) checkItinerary(it, t);
        // la primera és la millor opció
        const sc = r.itineraries.map(scoreOf);
        expect(sc[0]).toBe(Math.min(...sc));
        // opcions diferents (cap expedició repetida exactament)
        const keys = r.itineraries.map((i) => i.legs.flatMap((l) => (l.kind === 'bus' ? [`${l.tripKey}:${l.boardStopId}:${l.alightStopId}`] : [])).join('>'));
        expect(new Set(keys).size).toBe(keys.length);
      }),
      { numRuns: 60, seed: 20261006 },
    );
  });

  it('determinista: la mateixa pregunta, la mateixa resposta (el mapa i la ruta no es contradiuen)', () => {
    const from: LonLat = [stops[10]!.lon, stops[10]!.lat];
    const to: LonLat = [stops[200]!.lon, stops[200]!.lat];
    const t = DAY + 9 * H;
    expect(planTrip(engine, from, [to], t)).toEqual(planTrip(new SimEngine(net), from, [to], t));
  });

  it('de matinada, sense servei: ho diu (no-service) i no s’inventa cap bus', () => {
    const from: LonLat = [stops[10]!.lon, stops[10]!.lat];
    const to: LonLat = [stops[200]!.lon, stops[200]!.lat];
    const r = planTrip(engine, from, [to], DAY + 2 * H);
    expect(r.reason).toBe('no-service');
    expect(r.itineraries).toHaveLength(0);
  });

  it('destí fora de l’abast de la xarxa → destination-far', () => {
    const from: LonLat = [stops[10]!.lon, stops[10]!.lat];
    const r = planTrip(engine, from, [[2.3, 41.7]], DAY + 9 * H);
    expect(r.reason).toBe('destination-far');
    expect(r.walk).toBeNull();
  });

  it('destí d’un carrer (diversos punts): baixes a prop d’algun d’ells', () => {
    const from: LonLat = [stops[10]!.lon, stops[10]!.lat];
    const street: LonLat[] = [stops[150]!, stops[151]!, stops[152]!].map((s) => [s.lon + 0.0008, s.lat]);
    const r = planTrip(engine, from, street, DAY + 10 * H);
    if (r.reason !== 'ok') return;
    const last = r.itineraries[0]!.legs.at(-1)!;
    expect(last.kind === 'walk' && street.some((p) => p[0] === last.to[0] && p[1] === last.to[1])).toBe(true);
  });
});

describe('«Arribar a les…» sobre la xarxa real', () => {
  it('totes les opcions arriben abans de l’hora límit i són coherents; surten tan tard com es pot', () => {
    let found = 0;
    fc.assert(
      fc.property(placeArb, placeArb, fc.integer({ min: 8 * 60, max: 20 * 60 }), (from, to, min) => {
        const deadline = DAY + min * 60_000;
        const r = planArriveBy(engine, from, [to], deadline);
        if (r.reason !== 'ok') return;
        found++;
        for (const it of r.itineraries) {
          expect(it.arrive).toBeLessThanOrEqual(deadline);
          checkItinerary(it, deadline - 2 * H - 15 * 60_000);
        }
        const leaves = r.itineraries.map((i) => i.leaveAt);
        expect(leaves).toEqual([...leaves].sort((a, b) => b - a));
        // no hi ha cap opció d'una sortida posterior que també arribi a temps (dins del que veu el planificador)
        const later = planTrip(engine, from, [to], r.itineraries[0]!.leaveAt + 60_000, { limit: 12 }).itineraries.filter((i) => i.arrive <= deadline);
        for (const i of later) expect(i.leaveAt).toBeLessThanOrEqual(r.itineraries[0]!.leaveAt + 10 * 60_000);
      }),
      { numRuns: 25, seed: 20261011 },
    );
    expect(found).toBeGreaterThan(15);
  }, 60_000);

  it('rendiment: una consulta «arribar a les» triga poc (es fa al mòbil)', () => {
    const from: LonLat = [stops[10]!.lon, stops[10]!.lat];
    const to: LonLat = [stops[200]!.lon, stops[200]!.lat];
    const t0 = performance.now();
    const r = planArriveBy(engine, from, [to], DAY + 9 * H);
    const ms = performance.now() - t0;
    expect(r.reason).toBe('ok');
    expect(ms).toBeLessThan(1500);
  });
});
