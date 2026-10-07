import { describe, expect, it } from 'vitest';
import { SimEngine } from '../src/sim/engine.ts';
import { planTrip, walkMs } from '../src/plan.ts';
import { local, makePattern, tinyNetwork } from './fixtures.ts';

const EXACT = { delays: false } as const;
const T = local('2026-10-06T08:01'); // dimarts

describe('planificador de rutes', () => {
  const net = tinyNetwork();
  const e = new SimEngine(net, EXACT);
  const s = (i: number) => net.stops[i]!;
  const at = (i: number): [number, number] => [s(i).lon, s(i).lat + 0.0015]; // ~170 m al nord de la parada

  it('proposa el bus directe, amb el tram a peu fins a la parada i des de la parada', () => {
    const r = planTrip(e, at(0), [at(4)], T);
    expect(r.reason).toBe('ok');
    const it0 = r.itineraries[0]!;
    expect(it0.transfers).toBe(0);
    const bus = it0.legs.find((l) => l.kind === 'bus')!;
    expect(bus.kind === 'bus' && bus.routeId).toBe('X1');
    expect(bus.kind === 'bus' && [bus.boardStopId, bus.alightStopId]).toEqual([s(0).id, s(4).id]);
    // surt de casa a temps per arribar a la parada abans que el bus
    const access = it0.legs[0]!;
    if (access.kind !== 'walk' || bus.kind !== 'bus') throw new Error('primer tram a peu, després el bus');
    expect(it0.leaveAt + (access.end - access.start)).toBeLessThanOrEqual(bus.depart);
    expect(it0.leaveAt).toBeGreaterThanOrEqual(T);
    // les opcions van per ordre d'arribada
    const arr = r.itineraries.map((i) => i.arrive);
    expect([...arr].sort((a, b) => a - b)).toEqual(arr);
  });

  it('el bus que proposa és el mateix de les llegades de la parada (mateixa hora estimada)', () => {
    const r = planTrip(e, [s(0).lon, s(0).lat], [at(3)], T);
    const bus = r.itineraries[0]!.legs.find((l) => l.kind === 'bus')!;
    const arr = e.arrivals(s(0).id, T, 60).find((a) => a.patternId === (bus.kind === 'bus' && bus.patternId));
    expect(bus.kind === 'bus' && bus.depart).toBe(arr!.at);
  });

  it('origen lluny de qualsevol parada: ho diu (no s’inventa res)', () => {
    const r = planTrip(e, [2.3, 41.7], [at(3)], T);
    expect(r.itineraries).toHaveLength(0);
    expect(r.reason).toBe('origin-far');
  });

  it('destí a tocar: millor a peu', () => {
    const r = planTrip(e, at(1), [[s(1).lon + 0.002, s(1).lat + 0.0015]], T);
    expect(r.walk).not.toBeNull();
    expect(r.walkIsBetter).toBe(true);
  });

  it('fa un transbord quan cal (i no repeteix la mateixa línia)', () => {
    // una segona línia nord-sud que comença a la parada 4 de la X1
    const base = tinyNetwork();
    const x = base.stops[4]!;
    const coords: [number, number][] = Array.from({ length: 11 }, (_, i) => [x.lon, x.lat + i * 0.0024]);
    const deps: [number, number][] = [];
    for (let t = 6 * 3600; t <= 22 * 3600; t += 600) deps.push([t + 60, 0]);
    const y = makePattern({ id: 'Y1-a', routeId: 'Y1', coords, trips: deps, stopIds: [x.id, 'Y1-s1', 'Y1-s2', 'Y1-s3', 'Y1-s4'] });
    const ystops = y.stopIds.slice(1).map((id, i) => ({ id, name: `Y ${i + 1}`, lon: x.lon, lat: coords[(i + 1) * 2 + 1]![1], routes: ['Y1'] }));
    const net2 = { ...base, routes: [...base.routes, { ...base.routes[0]!, id: 'Y1', ref: 'Y1' }], stops: [...base.stops, ...ystops], patterns: [...base.patterns, y] };
    const e2 = new SimEngine(net2, EXACT);
    const dest = ystops[3]!;
    const r = planTrip(e2, [base.stops[0]!.lon, base.stops[0]!.lat], [[dest.lon, dest.lat]], T);
    const withTransfer = r.itineraries.find((i) => i.transfers === 1)!;
    expect(withTransfer).toBeTruthy();
    const buses = withTransfer.legs.filter((l) => l.kind === 'bus');
    expect(buses.map((b) => b.kind === 'bus' && b.routeId)).toEqual(['X1', 'Y1']);
    const [b1, b2] = buses as Extract<(typeof buses)[number], { kind: 'bus' }>[];
    // dona temps de fer el canvi
    expect(b2!.depart).toBeGreaterThanOrEqual(b1!.arrive + 60_000);
  });

  it('caminar: 75 m/min', () => {
    expect(walkMs(750)).toBe(10 * 60_000);
  });
});
