import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_DELAY_S, MAX_EARLY_S, SimEngine, bearing, pointAlong, projectOnLine, stopsUntil, trapezoid, type NetworkData } from '../src/index.ts';

const net = JSON.parse(readFileSync(join(__dirname, '../../../apps/web/public/data/network.json'), 'utf8')) as NetworkData;
const engine = new SimEngine(net);
// dimarts feiner, de 6:00 a 23:00 cada 7 min 13 s (no múltiple d'un minut: cau a tots els segons)
const T0 = Date.parse('2026-10-06T04:00:00Z');
const instants = Array.from({ length: 140 }, (_, i) => T0 + i * 433_000);

const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('perfil de velocitat trapezoidal', () => {
  it('surt i arriba aturat, recorre el tram exacte i és monòton', () => {
    for (const [len, dur] of [
      [300, 60],
      [120, 15],
      [900, 110],
      [40, 30],
    ] as const) {
      expect(trapezoid(len, dur, 0)).toEqual([0, 0]);
      const [endPos, endV] = trapezoid(len, dur, dur);
      expect(endPos).toBeCloseTo(len, 6);
      expect(endV).toBeCloseTo(0, 6);
      let prev = 0;
      for (let t = 0; t <= dur; t += dur / 200) {
        const [pos, v] = trapezoid(len, dur, t);
        expect(pos).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(v).toBeGreaterThanOrEqual(0);
        prev = pos;
      }
    }
  });

  it('té velocitat de crucero: a mig tram la velocitat és la màxima i constant', () => {
    const [, v1] = trapezoid(300, 60, 25);
    const [, v2] = trapezoid(300, 60, 35);
    expect(v1).toBeCloseTo(v2, 6);
    expect(v1 * 3.6).toBeGreaterThan(18);
    expect(v1 * 3.6).toBeLessThan(25);
  });
});

describe('estat del vehicle (xarxa real)', () => {
  it('el bus mai abandona la geometria i progrés, ETA, propera parada i rumb són coherents', () => {
    let checked = 0;
    for (const t of instants) {
      for (const v of engine.snapshot(t)) {
        const p = engine.patternById(v.patternId)!;
        // sobre la línia
        const pr = projectOnLine(p.coords, p.cum, [v.lon, v.lat]);
        expect(pr.offset, v.id).toBeLessThan(0.5);
        // progrés en [0,1]
        expect(v.progress).toBeGreaterThanOrEqual(0);
        expect(v.progress).toBeLessThanOrEqual(1);
        // ETA mai negativa: totes futures i ordenades
        for (let i = 0; i < v.etas.length; i++) {
          if (v.status !== 'EN_PARADA' || i > 0) expect(v.etas[i]!.at, v.id).toBeGreaterThanOrEqual(t - 1000);
          if (i > 0) expect(v.etas[i]!.at).toBeGreaterThan(v.etas[i - 1]!.at);
        }
        if (v.status === 'RETIRADA') continue;
        // propera parada: per davant del bus
        expect(p.stopDist[v.nextStopIndex]!, v.id).toBeGreaterThanOrEqual(v.dist - 0.01);
        expect(v.etas[0]?.stopId).toBe(v.nextStopId);
        expect(v.stopsRemaining).toBe(v.atStopIndex === p.stopIds.length - 1 ? 0 : p.stopIds.length - v.nextStopIndex);
        // rumb: mira cap endavant del recorregut (mai al revés), suavitzat a ±25 m a les cantonades
        if (v.status === 'EN_RUTA' && v.speedKmh > 5) {
          const here = pointAlong(p.coords, p.cum, v.dist);
          const ahead = pointAlong(p.coords, p.cum, Math.min(p.length, v.dist + 30));
          expect(angDiff(v.bearing, bearing(here, ahead)), v.id).toBeLessThan(90);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });

  it('dwell: el bus s’atura uns segons a la parada (EN_PARADA) i després torna a arrencar', () => {
    const t = Date.parse('2026-10-06T07:00:00Z');
    const v0 = engine.snapshot(t).find((v) => v.status === 'EN_RUTA' && v.stopsRemaining > 4)!;
    const next = v0.nextStopIndex;
    let arrived: number | null = null;
    let left: number | null = null;
    for (let s = 0; s < 900 && left === null; s++) {
      const v = engine.vehicle(v0.id, t + s * 1000)!;
      if (arrived === null && v.atStopIndex === next) {
        arrived = s;
        expect(v.status).toBe('EN_PARADA');
        expect(v.speedKmh).toBe(0);
        expect(stopsUntil(v, next)).toBe(0);
      }
      if (arrived !== null && v.atStopIndex !== next) left = s;
    }
    expect(arrived).not.toBeNull();
    expect(left! - arrived!).toBeGreaterThanOrEqual(1);
    expect(left! - arrived!).toBeLessThanOrEqual(23);
  });

  it('frena abans de la parada: la velocitat baixa a l’últim tram', () => {
    const t = Date.parse('2026-10-06T07:30:00Z');
    const v0 = engine.snapshot(t).find((v) => v.status === 'EN_RUTA' && v.speedKmh > 12 && (v.distToNextM ?? 0) > 150)!;
    let prevV = Infinity;
    let decel = 0;
    for (let s = 0; s < 300; s++) {
      const v = engine.vehicle(v0.id, t + s * 1000)!;
      if (v.nextStopIndex !== v0.nextStopIndex) break;
      if ((v.distToNextM ?? 0) < 40 && v.speedKmh < prevV) decel++;
      prevV = v.speedKmh;
    }
    expect(decel).toBeGreaterThan(2);
  });
});

describe('una sola font de veritat: mapa → fitxa → parada → línia temporal', () => {
  it('l’ETA d’un bus a una parada és la mateixa al vehicle, a les llegades de la parada i a la línia temporal', () => {
    let compared = 0;
    for (const t of instants.slice(10, 120)) {
      for (const v of engine.snapshot(t).filter((x) => x.status === 'EN_RUTA').slice(0, 6)) {
        const j = engine.journey(v.id, t)!;
        expect(j.progress).toBe(v.progress);
        const n = engine.patternById(v.patternId)!.stopIds.length;
        for (const [k, eta] of v.etas.slice(0, 4).entries()) {
          const js = j.stops[v.nextStopIndex + k]!;
          expect(js.stopId).toBe(eta.stopId);
          expect(js.at).toBe(eta.at);
          // l'última parada del trajecte no surt a les llegades: el bus hi acaba, no hi passa
          if (v.nextStopIndex + k === n - 1) continue;
          const arr = engine.arrivals(eta.stopId, t, 120, 60).find((a) => a.vehicleId === v.id && a.patternId === v.patternId && a.at === eta.at);
          expect(arr, `${v.id} → ${eta.stopId}`).toBeDefined();
          compared++;
        }
        // estats de la línia temporal coherents amb el vehicle
        expect(j.stops.filter((s) => s.state === 'next').map((s) => s.index)).toEqual(v.atStopIndex === v.nextStopIndex ? [] : [v.nextStopIndex]);
        expect(j.stops.filter((s) => s.state === 'passed').length).toBe(v.prevStopIndex + 1);
      }
    }
    expect(compared).toBeGreaterThan(500);
  });

  it('el progrés és per distància, no per parades', () => {
    const t = Date.parse('2026-10-06T08:10:00Z');
    const v = engine.snapshot(t).find((x) => x.status === 'EN_RUTA')!;
    const p = engine.patternById(v.patternId)!;
    const a = p.stopDist[0]!;
    const b = p.stopDist[p.stopDist.length - 1]!;
    expect(v.progress).toBeCloseTo((v.dist - a) / (b - a), 9);
  });

  it('retards simulats: deterministes, acotats, etiquetats com a simulats i amb una red viva', () => {
    const other = new SimEngine(net);
    const delays: number[] = [];
    for (const t of instants) {
      const a = engine.snapshot(t);
      const b = other.snapshot(t);
      expect(b.map((v) => [v.id, v.delaySec, v.lon])).toEqual(a.map((v) => [v.id, v.delaySec, v.lon]));
      for (const v of a) {
        expect(v.source).toBe('SIMULATED');
        expect(v.status).not.toBe('DESVIADO');
        if (v.delaySec === null) continue;
        expect(v.delaySec).toBeGreaterThanOrEqual(-MAX_EARLY_S);
        expect(v.delaySec).toBeLessThanOrEqual(MAX_DELAY_S + 60);
        if (v.status === 'RETRASADO') expect(v.delaySec).toBeGreaterThanOrEqual(180);
        if (v.status === 'EN_RUTA' || v.status === 'RETRASADO') delays.push(v.delaySec);
      }
    }
    const onTime = delays.filter((d) => d > -60 && d < 180).length / delays.length;
    // la majoria a l'hora, però no tots: n'hi ha de retardats i d'avançats
    expect(onTime).toBeGreaterThan(0.6);
    expect(onTime).toBeLessThan(0.97);
    expect(delays.some((d) => d >= 180)).toBe(true);
    expect(delays.some((d) => d <= -30)).toBe(true);
  });

  it('la ETA és l’hora estimada i guarda l’hora programada: la diferència és el retard', () => {
    const t = Date.parse('2026-10-06T07:40:00Z');
    for (const v of engine.snapshot(t).filter((x) => x.status === 'EN_RUTA' || x.status === 'RETRASADO')) {
      const e = v.etas[0]!;
      expect(e.scheduledAt).toBeDefined();
      expect(Math.round((e.at - e.scheduledAt!) / 1000)).toBe(v.delaySec);
    }
  });

  it('sense retards (delays: false) tot va exactament a l’horari', () => {
    const exact = new SimEngine(net, { delays: false });
    for (const v of exact.snapshot(Date.parse('2026-10-06T07:40:00Z'))) {
      expect(v.delaySec).toBeNull();
      for (const e of v.etas) expect(e.at).toBe(e.scheduledAt);
    }
  });
});
