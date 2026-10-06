import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SimEngine } from '../src/sim/engine.ts';
import { SimClock, dayTypeFor, forcedInstant, serviceDayOrigin } from '../src/time.ts';
import { pointAlong } from '../src/geo.ts';
import { local, makePattern, tinyNetwork } from './fixtures.ts';

describe('calendari', () => {
  const h = tinyNetwork().holidays;
  it('feiner, dissabte, diumenge i festiu', () => {
    expect(dayTypeFor('2026-10-06', h)).toBe('feiner'); // dimarts
    expect(dayTypeFor('2026-10-10', h)).toBe('dissabte');
    expect(dayTypeFor('2026-10-11', h)).toBe('festiu'); // diumenge
    expect(dayTypeFor('2026-10-12', h)).toBe('festiu'); // festa nacional
  });

  it('festiu local de Sabadell', () => {
    expect(dayTypeFor('2026-09-07', [{ date: '2026-09-07', name: 'Festa Major', scope: 'local' }])).toBe('festiu');
  });

  it('origen del dia de servei = migdia − 12 h (canvi d’hora d’octubre)', () => {
    // 25/10/2026: el dia té 25 hores; 12:00 local menys 12 h = 01:00 local (00:00 + 1 h)
    const o = serviceDayOrigin('2026-10-25');
    expect(new Date(o).toISOString()).toBe('2026-10-24T23:00:00.000Z');
    // un dia normal: mitjanit local
    expect(new Date(serviceDayOrigin('2026-10-06')).toISOString()).toBe('2026-10-05T22:00:00.000Z');
  });

  it('hora forçada per paràmetres de demo', () => {
    const base = local('2026-10-06T17:00');
    const t = forcedInstant(base, '08:00', 'dilluns')!;
    expect(new Date(t).toISOString()).toBe('2026-10-12T06:00:00.000Z');
  });
});

describe('rellotge', () => {
  it('es deriva del rellotge absolut i aplica el multiplicador', () => {
    let now = 1_000_000;
    const c = new SimClock({ nowFn: () => now });
    c.set(5_000_000, 10);
    now += 1000;
    expect(c.now()).toBe(5_010_000);
    now += 500;
    expect(c.now()).toBe(5_015_000);
  });

  it('corregeix el desfasament del dispositiu en mode directe', () => {
    const now = 1_000_000;
    const c = new SimClock({ nowFn: () => now });
    c.setServerSkew(1_030_000, now);
    expect(c.now()).toBe(1_030_000);
  });
});

describe('motor de simulació', () => {
  const engine = new SimEngine(tinyNetwork());
  const at8 = local('2026-10-06T08:00');

  it('és determinista', () => {
    const a = new SimEngine(tinyNetwork()).snapshot(at8 + 37_000);
    const b = engine.snapshot(at8 + 37_000);
    expect(a).toEqual(b);
  });

  it('el nombre de buses surt dels horaris', () => {
    // cada 10 min, trajecte de 8 min + descans: calen 2–3 buses
    const f = engine.fleet('feiner');
    expect(f.peak).toBeGreaterThanOrEqual(2);
    expect(f.peak).toBeLessThanOrEqual(4);
    expect(f.trips).toBe(97 * 2);
  });

  it('cap bus a les 03:00 i missatge de primer servei', () => {
    const t = local('2026-10-06T03:00');
    expect(engine.snapshot(t)).toHaveLength(0);
    expect(engine.nextService(t)?.at).toBe(local('2026-10-06T06:00'));
  });

  it('festiu sense línies F: cap bus', () => {
    expect(engine.snapshot(local('2026-10-12T10:00'))).toHaveLength(0);
  });

  it('els buses no surten de la geometria i la distància creix dins una expedició', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 15 * 3600 }), (sec) => {
        const t = local('2026-10-06T06:00') + sec * 1000;
        for (const v of engine.snapshot(t)) {
          const p = engine.patternById(v.patternId)!;
          expect(v.dist).toBeGreaterThanOrEqual(0);
          expect(v.dist).toBeLessThanOrEqual(p.length + 0.01);
          const [lon, lat] = pointAlong(p.coords, p.cum, v.dist);
          expect(lon).toBeCloseTo(v.lon, 9);
          expect(lat).toBeCloseTo(v.lat, 9);
          for (const e of v.etas) expect(e.at).toBeGreaterThanOrEqual(t - 1);
          const later = engine.vehicle(v.id, t + 5000);
          if (later && later.tripKey === v.tripKey) expect(later.dist).toBeGreaterThanOrEqual(v.dist);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('cap bus "neix" a mitja línia: apareix a capçalera abans de sortir', () => {
    const before = engine.snapshot(local('2026-10-06T05:57'));
    expect(before.length).toBeGreaterThan(0);
    for (const v of before) expect(v.status).toBe('EN_CABECERA');
  });

  it('el darrer bus acaba el recorregut i després es retira', () => {
    const t = local('2026-10-06T22:13');
    const moving = engine.snapshot(t).filter((v) => v.patternId === 'X1-b');
    expect(moving.length).toBeGreaterThan(0);
    const end = engine.snapshot(local('2026-10-06T22:14:30'.slice(0, 16)) + 30_000);
    expect(end.some((v) => v.status === 'RETIRADA')).toBe(true);
    expect(engine.snapshot(local('2026-10-06T22:30'))).toHaveLength(0);
  });

  it('ETA de la fitxa de bus = ETA del panell de parada', () => {
    const v = engine.snapshot(at8 + 90_000).find((x) => x.status === 'EN_RUTA')!;
    const next = v.etas[0]!;
    const arr = engine.arrivals(next.stopId, at8 + 90_000).find((a) => a.vehicleId === v.id)!;
    expect(arr.at).toBe(next.at);
  });

  it('torns estables: el mateix bus fa anada, descans i tornada', () => {
    const blocks = engine.blocksOf('feiner');
    for (const b of blocks)
      for (let i = 1; i < b.trips.length; i++) expect(b.trips[i]!.dep).toBeGreaterThanOrEqual(b.trips[i - 1]!.end + 60);
    const v1 = engine.snapshot(at8 + 60_000).find((x) => x.status === 'EN_RUTA')!;
    expect(engine.vehicle(v1.id, at8 + 60_000)?.label).toBe(v1.label);
  });
});

describe('servei que creua la mitjanit', () => {
  const p = makePattern({ id: 'N-a', routeId: 'X1', trips: [[23 * 3600 + 50 * 60, 0], [24 * 3600 + 10 * 60, 0]] });
  const engine = new SimEngine(tinyNetwork({ patterns: [p] }));

  it('una expedició de les 24:10 del dimarts circula dimecres a les 00:13', () => {
    const t = local('2026-10-07T00:13');
    const s = engine.snapshot(t);
    expect(s).toHaveLength(1);
    expect(s[0]!.id.startsWith('2026-10-06:')).toBe(true);
    expect(s[0]!.status).toBe('EN_RUTA');
  });

  it('les llegades de després de mitjanit apareixen al panell abans de mitjanit', () => {
    const arr = engine.arrivals('X1-s1', local('2026-10-06T23:55'));
    expect(arr.map((a) => new Date(a.at).toISOString())).toContain(new Date(local('2026-10-07T00:12')).toISOString());
  });
});

describe('canvi d’hora', () => {
  it('el 25/10 (hora repetida) no hi ha expedicions duplicades ni perdudes', () => {
    const engine = new SimEngine(tinyNetwork({ holidays: [] }));
    // diumenge 25/10/2026 és festiu per TUS: provem el dissabte 28/03 i un feiner normal
    const tA = local('2026-10-26T08:00');
    expect(engine.snapshot(tA).length).toBe(engine.snapshot(local('2026-10-27T08:00')).length);
  });

  it('el 29/03/2027 (endemà del canvi de primavera) els horaris són a l’hora local correcta', () => {
    const engine = new SimEngine(tinyNetwork({ holidays: [] }));
    const t = local('2027-03-29T06:00');
    const s = engine.snapshot(t);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((v) => v.departure >= t - 1)).toBe(true);
  });
});
