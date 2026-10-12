import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimEngine, cumulative, normalize, normalizeColour, type LonLat, type NetworkData } from '@bus/core';
import { buildGeometry, countSpikes, despike } from '../src/geometry.ts';
import { reconstructTrips, parseTimes, smoothOffsets, quantize } from '../src/trips.ts';
import { stitchRelation, type OsmNode, type OsmRel, type OsmWay } from '../src/osm.ts';
import { checkFestius, FestiusSchema, loadYaml } from '../src/config.ts';
import { endpoints, dayTypeOf, extractTrayectos } from '../src/tus.ts';
import { audit } from '../src/audit.ts';
import { assignDirections, isCircular } from '../src/repair.ts';
import { busDirections, contraflow, directedGridFrom } from '../src/oneway.ts';

const ROOT = join(__dirname, '../../..');

describe('horaris de tus.es', () => {
  it('parseTimes ordena, deduplica i passa la matinada a > 24 h', () => {
    expect(parseTimes(['8:05', '7:55', '8:05', '0:15'])).toEqual([7 * 3600 + 55 * 60, 8 * 3600 + 300, 24 * 3600 + 900]);
  });

  it('reconstrueix expedicions encara que la parada barregi passos d’una altra variant', () => {
    const dist = [0, 500, 1000, 1500];
    const m = (h: number, mi: number) => h * 3600 + mi * 60;
    const stops = [
      { times: [m(8, 0), m(8, 30)] },
      // passos propis (+2 min) barrejats amb passos d'una altra variant (+20 min)
      { times: [m(8, 2), m(8, 20), m(8, 32), m(8, 50)] },
      { times: [m(8, 4), m(8, 34)] },
      { times: [] },
    ];
    const trips = reconstructTrips(stops, dist);
    expect(trips.map((t) => t.raw.slice(0, 3))).toEqual([
      [0, 120, 240],
      [0, 120, 240],
    ]);
  });

  it('suavitza dins la finestra del minut i és estrictament creixent', () => {
    const raw = [0, 60, 60, 120, 180, null];
    const dist = [0, 250, 400, 700, 1000, 1300];
    const o = quantize(smoothOffsets(raw, dist));
    for (let i = 1; i < o.length; i++) expect(o[i]!).toBeGreaterThan(o[i - 1]!);
    raw.forEach((r, i) => {
      if (r != null && i > 0) {
        expect(o[i]!).toBeGreaterThanOrEqual(r - 5);
        expect(o[i]!).toBeLessThanOrEqual(r + 60);
      }
    });
    // no totes les parades a :00
    expect(new Set(o.map((x) => x % 60)).size).toBeGreaterThan(1);
  });

  it('dia de servei i capçaleres a partir del nom del trajecte', () => {
    expect(dayTypeOf('1', 'Can Deu - Estació Sud (fn)')).toBe('feiner');
    expect(dayTypeOf('1', 'Can Deu - Estació Sud (ds)')).toBe('dissabte');
    expect(dayTypeOf('F3', 'La Romànica - La Plana del Pintor')).toBe('festiu');
    expect(endpoints('Can Roqueta - Parc Taulí - Els Merinals - (fn)')).toEqual({ origin: 'Can Roqueta', headsign: 'Els Merinals' });
  });

  it('extreu els trajectes del HTML públic', () => {
    const html = '<script>var trayectos = [{"id":"1","name":"A - B (fn)","id_linea":"1","coords":[],"stops":[{"id":"9","name":"x ] y"}]}];</script>';
    expect(extractTrayectos(html)?.[0]?.stops[0]?.name).toBe('x ] y');
  });
});

describe('geometria', () => {
  it('les distàncies de parada són estrictament creixents en un recorregut d’anada i tornada pel mateix carrer', () => {
    const line: LonLat[] = Array.from({ length: 11 }, (_, i) => [2.1 + i * 0.001, 41.55]);
    const coords: LonLat[] = [...line, ...[...line].reverse().slice(1)];
    const stops = [
      { id: 'a', lon: 2.1005, lat: 41.5501 },
      { id: 'b', lon: 2.105, lat: 41.5501 },
      { id: 'c', lon: 2.109, lat: 41.5501 },
      { id: 'd', lon: 2.105, lat: 41.5499 }, // mateixa cantonada que "b", a la tornada
      { id: 'e', lon: 2.1001, lat: 41.5499 },
    ];
    const g = buildGeometry(coords, stops);
    for (let i = 1; i < g.stopDist.length; i++) expect(g.stopDist[i]!).toBeGreaterThan(g.stopDist[i - 1]!);
    expect(g.stopDist[3]!).toBeGreaterThan(g.length / 2);
    // les parades són vèrtexs de la geometria simplificada
    for (const d of g.stopDist) expect(g.cum.some((c) => Math.abs(c - d) < 0.2)).toBe(true);
  });
});

describe('OSM', () => {
  const nodes = new Map<number, OsmNode>();
  const add = (id: number, lon: number) => nodes.set(id, { type: 'node', id, lon, lat: 41.55 });
  for (let i = 1; i <= 9; i++) add(i, 2.1 + i * 0.001);

  it('orienta ways invertits', () => {
    const ways = new Map<number, OsmWay>([
      [10, { type: 'way', id: 10, nodes: [1, 2, 3] }],
      [11, { type: 'way', id: 11, nodes: [5, 4, 3] }],
      [12, { type: 'way', id: 12, nodes: [5, 6] }],
    ]);
    const rel: OsmRel = { type: 'relation', id: 1, tags: {}, members: [10, 11, 12].map((ref) => ({ type: 'way', ref, role: '' })) };
    const r = stitchRelation(rel, ways, nodes);
    expect(r.coords.map((c) => Math.round((c[0] - 2.1) * 1000))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.broken).toBe(false);
  });

  it('a una rotonda només recorre l’arc necessari', () => {
    nodes.set(20, { type: 'node', id: 20, lon: 2.1035, lat: 41.5505 });
    nodes.set(21, { type: 'node', id: 21, lon: 2.104, lat: 41.551 });
    const ways = new Map<number, OsmWay>([
      [10, { type: 'way', id: 10, nodes: [1, 2, 3] }],
      [30, { type: 'way', id: 30, nodes: [3, 20, 21, 4, 3] }], // anell
      [12, { type: 'way', id: 12, nodes: [21, 5] }],
    ]);
    const rel: OsmRel = { type: 'relation', id: 2, tags: {}, members: [10, 30, 12].map((ref) => ({ type: 'way', ref, role: '' })) };
    const r = stitchRelation(rel, ways, nodes);
    expect(r.coords).toHaveLength(6); // 1,2,3,20,21,5 — sense donar la volta sencera
  });

  it('detecta forats i marca la relació com a trencada si superen 50 m', () => {
    const ways = new Map<number, OsmWay>([
      [10, { type: 'way', id: 10, nodes: [1, 2] }],
      [11, { type: 'way', id: 11, nodes: [5, 6] }],
    ]);
    const rel: OsmRel = { type: 'relation', id: 3, tags: {}, members: [10, 11].map((ref) => ({ type: 'way', ref, role: '' })) };
    const r = stitchRelation(rel, ways, nodes);
    expect(r.broken).toBe(true);
    expect(r.gaps[0]!).toBeGreaterThan(200);
  });
});

describe('configuració', () => {
  it('festius.yaml és vàlid i sense dates duplicades', () => {
    const f = loadYaml(join(ROOT, 'data/config/festius.yaml'), FestiusSchema);
    expect(checkFestius(f)).toEqual([]);
    expect(f.festius.some((x) => x.ambit === 'local')).toBe(true);
  });

  it('dona errors llegibles', () => {
    const r = FestiusSchema.safeParse({ font: 'x', festius: [{ data: '2026-13-40', nom: '', ambit: 'mars' }] });
    expect(r.success).toBe(false);
    expect(checkFestius({ font: 'x', pendents: [], festius: [{ data: '2026-02-30', nom: 'x', ambit: 'local' }] })).toEqual(['data inexistent: 2026-02-30']);
  });
});

describe('text', () => {
  it('cerca tolerant a accents i abreviatures', () => {
    expect(normalize('Créu Alta')).toBe(normalize('creu alta'));
    expect(normalize('Pl. Espanya')).toBe(normalize("Plaça Espanya"));
    expect(normalize('Col·legi')).toBe('collegi');
  });
  it('normalitza colors', () => {
    expect(normalizeColour('#F00 ')).toBe('#ff0000');
    expect(normalizeColour('red')).toBe('#ff0000');
    expect(normalizeColour('#E63027')).toBe('#e63027');
    expect(normalizeColour('vermell')).toBeNull();
  });
});

describe('xarxa real generada (network.json)', () => {
  const net = JSON.parse(readFileSync(join(ROOT, 'apps/web/public/data/network.json'), 'utf8')) as NetworkData;
  const engine = new SimEngine(net);

  it('té les 23 línies oficials amb el color de tus.es', () => {
    expect(net.routes.map((r) => r.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L44', 'L5', 'L55', 'L7', 'L8', 'L10', 'L11', 'L12', 'L14', 'L15', 'L23', 'L80', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F15']);
    expect(net.routes.find((r) => r.id === 'L1')?.color).toBe('#e63027');
  });

  it('cada pattern té distàncies estrictament creixents i cum coherent', () => {
    for (const p of net.patterns) {
      for (let i = 1; i < p.stopDist.length; i++) expect(p.stopDist[i]!).toBeGreaterThan(p.stopDist[i - 1]!);
      expect(p.cum.length).toBe(p.coords.length);
      const real = cumulative(p.coords);
      expect(Math.abs(real[real.length - 1]! - p.length)).toBeLessThan(5);
      for (const prof of p.profiles) for (let i = 1; i < prof.length; i++) expect(prof[i]!).toBeGreaterThan(prof[i - 1]!);
    }
  });

  it('la flota calculada és raonable (TUS ~60–90 buses)', () => {
    const f = engine.fleet('feiner');
    expect(f.peak).toBeGreaterThan(40);
    expect(f.peak).toBeLessThan(110);
  });

  it('un tick de ~90 buses costa menys de 2 ms', () => {
    const t = Date.parse('2026-10-06T06:00:00Z');
    // escalfament: a l'app el tick corre cada segon durant hores; sense escalfar, el que es mesura és el JIT
    // (en fred ~1,5 ms; escalfat ~1 ms, 72 buses). Després, mediana de 9 tandes de 20 ticks: una tanda que coincideix
    // amb un altre fil de vitest ocupant la CPU no el fa fallar. El pressupost és el mateix: 2 ms.
    for (let i = 0; i < 300; i++) engine.snapshot(t - 3_600_000 + i * 1000);
    const batches: number[] = [];
    for (let b = 0; b < 9; b++) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) engine.snapshot(t + (b * 20 + i) * 1000);
      batches.push((performance.now() - t0) / 20);
    }
    batches.sort((a, b) => a - b);
    expect(batches[4]!).toBeLessThan(2);
  });
  it('auditoria: cap variant amb error (recorregut al carrer, parades sobre el recorregut i en ordre)', () => {
    const res = audit(net);
    expect(res.rows.filter((r) => r.status === 'error').map((r) => `${r.pattern}: ${r.problems.join('; ')}`)).toEqual([]);
    expect(res.lineNotes).toEqual([]);
    for (const r of res.rows) expect(r.onRoadPct).toBeGreaterThan(97);
  });

  it('cada parada d’un pattern declara la seva línia', () => {
    const stops = new Map(net.stops.map((s) => [s.id, s]));
    for (const p of net.patterns) for (const id of p.stopIds) expect(stops.get(id)?.routes, `${p.id} ${id}`).toContain(p.routeId);
  });

  it('les línies no circulars tenen els dos sentits cada dia que circulen', () => {
    for (const r of net.routes)
      for (const dt of ['feiner', 'dissabte', 'festiu'] as const) {
        const ps = net.patterns.filter((p) => p.routeId === r.id && p.dayType === dt && p.trips.length);
        if (!ps.length || ps.every((p) => p.circular)) continue;
        expect(new Set(ps.map((p) => p.dir)), `${r.id} ${dt}`).toEqual(new Set([0, 1]));
      }
  });

  it('sentits corregits per geometria (L14 dissabte, L8 Zona Industrial) i L15 circular', () => {
    const dir = (id: string) => net.patterns.find((p) => p.id === id)?.dir;
    expect(dir('L14-14091104838')).toBe(0); // Els Merinals → Can Roqueta
    expect(dir('L14-14091204839')).toBe(1); // Can Roqueta → Els Merinals
    expect(dir('L8-80304800')).toBe(0); // Zona Industrial → La Roureda, com Estació Sud → La Roureda
    expect(net.patterns.filter((p) => p.routeId === 'L15').every((p) => p.circular)).toBe(true);
  });
});

describe('correccions de xarxa', () => {
  const stops = new Map([
    ['a', { id: 'a', name: 'A', lat: 41.5, lon: 2.1, routes: [] }],
    ['b', { id: 'b', name: 'B', lat: 41.5, lon: 2.11, routes: [] }],
    ['c', { id: 'c', name: 'C', lat: 41.5, lon: 2.12, routes: [] }],
  ]);
  const pat = (id: string, stopIds: string[], coords: LonLat[], trips = 1) => {
    const cum = cumulative(coords);
    return { id, routeId: 'X', dir: 0 as 0 | 1, name: id, origin: stopIds[0]!, headsign: '', dayType: 'feiner' as const, circular: false, stopIds, stopDist: [], coords, cum, length: cum[cum.length - 1]!, profiles: [], trips: Array.from({ length: trips }, () => [0, 0] as [number, number]) };
  };
  it('el sentit surt del recorregut, no del nom de la capçalera', () => {
    const main = pat('m', ['a', 'b', 'c'], [[2.1, 41.5], [2.12, 41.5]], 10);
    const fwdOther = { ...pat('f', ['b', 'c'], [[2.11, 41.5], [2.12, 41.5]]), origin: 'Un altre nom' };
    const back = { ...pat('r', ['c', 'b', 'a'], [[2.12, 41.5], [2.1, 41.5]]), origin: 'C' };
    const d = assignDirections([main, fwdOther, back], stops, 'a');
    expect([d.get('m'), d.get('f'), d.get('r')]).toEqual([0, 0, 1]);
  });
  it('un bucle tancat és circular encara que la primera i l’última parada siguin diferents', () => {
    expect(isCircular(['a', 'c'], [[2.1, 41.5], [2.12, 41.5], [2.11, 41.51], [2.1, 41.5]], stops)).toBe(true);
    expect(isCircular(['a', 'c'], [[2.1, 41.5], [2.12, 41.5]], stops)).toBe(false);
  });
});

describe('punxes de tus.es', () => {
  it('treu l’anada i tornada fins al pal de la parada però no les voltes reals', () => {
    const stop = { id: 's', lon: 2.10012, lat: 41.50008 };
    // carrer recte cap a l'est amb una punxa de ~10 m fins al pal
    const withSpike: LonLat[] = [[2.1, 41.5], [2.1001, 41.5], [2.10012, 41.50009], [2.1001, 41.5], [2.1003, 41.5]];
    const out = despike(withSpike, [stop]);
    expect(out.removed).toBe(1);
    expect(countSpikes(out.coords)).toBe(0);
    // volta a una rotonda (~80 m) que torna al mateix punt: no és una punxa
    const loop: LonLat[] = [[2.1, 41.5], [2.1003, 41.5], [2.1004, 41.5001], [2.1003, 41.5002], [2.1002, 41.5001], [2.1003, 41.5], [2.1, 41.5]];
    expect(despike(loop, [stop]).removed).toBe(0);
  });
});

describe('sentits únics', () => {
  it('interpreta oneway i les excepcions per a bus', () => {
    expect(busDirections({ oneway: 'yes' })).toEqual({ fwd: true, back: false });
    expect(busDirections({ oneway: '-1' })).toEqual({ fwd: false, back: true });
    expect(busDirections({ oneway: 'yes', 'oneway:bus': 'no' })).toEqual({ fwd: true, back: true });
    expect(busDirections({ oneway: 'yes', busway: 'opposite_lane' })).toEqual({ fwd: true, back: true });
    expect(busDirections({ junction: 'roundabout' })).toEqual({ fwd: true, back: false });
    expect(busDirections({})).toEqual({ fwd: true, back: true });
  });
  it('detecta un tram a contrasentit però no les calçades separades', () => {
    const one = (coords: [number, number][], tags: Record<string, string>) => ({ tags, geometry: coords.map(([lon, lat]) => ({ lon, lat })) });
    // carrer de sentit únic cap a l'est i, 12 m al nord, un altre cap a l'oest (calçada separada)
    const g = directedGridFrom([one([[2.1, 41.5], [2.104, 41.5]], { oneway: 'yes' })]);
    const pat = (coords: [number, number][]) => {
      const cum = cumulative(coords);
      return { id: 'x', routeId: 'X', dir: 0 as const, name: '', origin: '', headsign: '', dayType: 'feiner' as const, circular: false, stopIds: ['a', 'b'], stopDist: [0, cum[cum.length - 1]!], coords, cum, length: cum[cum.length - 1]!, profiles: [], trips: [] };
    };
    expect(contraflow(pat([[2.1, 41.5], [2.104, 41.5]]), g)).toEqual([]);
    expect(contraflow(pat([[2.104, 41.5], [2.1, 41.5]]), g)[0]!.lengthM).toBeGreaterThan(250);
    const dual = directedGridFrom([one([[2.1, 41.5], [2.104, 41.5]], { oneway: 'yes' }), one([[2.104, 41.50008], [2.1, 41.50008]], { oneway: 'yes' })]);
    expect(contraflow(pat([[2.104, 41.50004], [2.1, 41.50004]]), dual)).toEqual([]);
  });
});
