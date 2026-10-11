import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimEngine, hhmm, routeFrequencies, serviceDayOrigin, stopTimetable, type NetworkData } from '../src/index.ts';

const net = JSON.parse(readFileSync(join(__dirname, '../../../apps/web/public/data/network.json'), 'utf8')) as NetworkData;

describe('horari teòric per parada i freqüències (PPT 2024 §2.2.1)', () => {
  it('coincideix amb l’hora d’horari que fa servir la resta de l’app (motor sense retards)', () => {
    const engine = new SimEngine(net, { delays: false });
    const origin = serviceDayOrigin('2026-10-06'); // dimarts
    let compared = 0;
    for (const stopId of ['278', '1', '20']) {
      const tt = stopTimetable(net.patterns, stopId, 'feiner');
      expect(tt.length).toBeGreaterThan(0);
      const t0 = origin + 9 * 3600_000;
      for (const a of engine.arrivals(stopId, t0, 60, 40)) {
        const g = tt.find((x) => x.routeId === a.routeId && x.headsign === a.headsign);
        expect(g, `${stopId} ${a.routeId} → ${a.headsign}`).toBeTruthy();
        expect(g!.times).toContain(Math.round((a.scheduledAt - origin) / 1000));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(20);
  });

  it('hores ordenades i sense repetir; la darrera parada d’una variant no compta com a sortida', () => {
    for (const g of stopTimetable(net.patterns, '278', 'feiner')) {
      expect(g.times).toEqual([...new Set(g.times)].sort((a, b) => a - b));
    }
    const p = net.patterns.find((x) => !x.circular && x.dayType === 'feiner' && x.trips.length)!;
    const lastStop = p.stopIds.at(-1)!;
    const tt = stopTimetable([p], lastStop, 'feiner');
    expect(tt).toEqual([]);
  });

  it('tipus de dia: dissabte i festiu tenen el seu propi horari; una línia festiva no surt en feiner', () => {
    const f = stopTimetable(net.patterns, '278', 'feiner').map((g) => g.routeId);
    const fe = stopTimetable(net.patterns, '278', 'festiu').map((g) => g.routeId);
    expect(f.some((r) => r.startsWith('F'))).toBe(false);
    expect(fe.every((r) => r.startsWith('F'))).toBe(true);
  });

  it('freqüències: per tipus de dia i sentit, primera ≤ darrera i interval raonable', () => {
    const fr = routeFrequencies(net.patterns, 'L2');
    expect(fr.map((f) => f.dayType)).toContain('feiner');
    for (const f of fr) {
      expect(f.first).toBeLessThanOrEqual(f.last);
      expect(f.trips).toBeGreaterThan(0);
      if (f.headwayMin !== null) expect(f.headwayMin).toBeGreaterThan(0);
      if (f.headwayMin !== null) expect(f.headwayMin).toBeLessThan(120);
    }
  });

  it('hh:mm també per a hores de després de mitjanit del dia de servei', () => {
    expect(hhmm(7 * 3600 + 5 * 60)).toBe('07:05');
    expect(hhmm(24 * 3600 + 15 * 60 + 59)).toBe('24:15');
  });
});
