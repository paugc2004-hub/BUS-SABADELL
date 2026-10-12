import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimEngine, type NetworkData } from '@bus/core';
import { findStops } from './stopSearch.ts';

const net = JSON.parse(readFileSync(join(__dirname, '../../public/data/network.json'), 'utf8')) as NetworkData;
const engine = new SimEngine(net);

describe('cercar parada pel codi o el nom', () => {
  it('el codi exacte va primer («43» → Casal Pere Quart)', () => {
    const r = findStops(engine, '43', null);
    expect(r[0]!.stop.id).toBe('43');
    expect(r[0]!.stop.name).toBe('Casal Pere Quart');
  });
  it('per nom, sense accents i amb tots dos pals', () => {
    const r = findStops(engine, 'casal pere', null).map((h) => h.stop.id);
    expect(r).toEqual(expect.arrayContaining(['19', '43']));
    expect(findStops(engine, 'mercat central', null).map((h) => h.stop.id)).toEqual(expect.arrayContaining(['131', '180']));
  });
  it('res per a un text que no hi és', () => {
    expect(findStops(engine, 'zzzzz', null)).toEqual([]);
  });
});
