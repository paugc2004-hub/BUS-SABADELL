import { describe, expect, it } from 'vitest';
import { bearingAlong, cumulative, haversine, pointAlong, projectOnLine, simplify, type LonLat } from '../src/geo.ts';

describe('geo', () => {
  const line: LonLat[] = Array.from({ length: 11 }, (_, i) => [2.1 + i * 0.001, 41.55]);
  const cum = cumulative(line);

  it('haversine ~83 m per 0.001° de longitud a Sabadell', () => {
    expect(haversine([2.1, 41.55], [2.101, 41.55])).toBeCloseTo(83.4, 0);
  });

  it('pointAlong recorre la línia per distància', () => {
    const p = pointAlong(line, cum, cum[5]!);
    expect(p[0]).toBeCloseTo(2.105, 6);
    expect(pointAlong(line, cum, -10)).toEqual(line[0]);
    expect(pointAlong(line, cum, 1e9)[0]).toBeCloseTo(2.11, 6);
  });

  it('projecció acotada: un recorregut que passa dues vegades pel mateix carrer', () => {
    // anada i tornada pel mateix eix
    const outBack: LonLat[] = [...line, ...[...line].reverse().slice(1)];
    const c2 = cumulative(outBack);
    const stop: LonLat = [2.103, 41.5501];
    const first = projectOnLine(outBack, c2, stop, 0);
    const second = projectOnLine(outBack, c2, stop, c2[10]! + 1);
    expect(first.dist).toBeLessThan(c2[10]!);
    expect(second.dist).toBeGreaterThan(c2[10]!);
    expect(second.offset).toBeLessThan(15);
  });

  it('simplify conserva els vèrtexs obligatoris', () => {
    const idx = simplify(line, 5, new Set([3, 7]));
    expect(idx).toEqual([0, 3, 7, 10]);
  });

  it('el rumb no salta 180° prop d’un vèrtex', () => {
    const b = bearingAlong(line, cum, cum[4]!);
    expect(b).toBeGreaterThan(80);
    expect(b).toBeLessThan(100);
  });
});
