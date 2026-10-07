import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexGazetteer, searchPlaces } from './streets.ts';

const g = indexGazetteer(JSON.parse(readFileSync(new URL('../../public/data/streets.json', import.meta.url), 'utf8')));

describe('on vas? (llocs i carrers)', () => {
  it('pel nom popular d’un lloc, encara que a OSM es digui d’una altra manera', () => {
    expect(searchPlaces(g, 'estadi del sabadell').places[0]?.name).toBe('Estadi Municipal de la Nova Creu Alta');
    expect(searchPlaces(g, 'camp del mercantil').places[0]?.name).toBe('Camp de Futbol Municipal Arraona-Merinals');
  });

  it('pel nom i el barri: «natació can llong» és el centre del CN Sabadell de Can Llong', () => {
    const p = searchPlaces(g, 'club natacio can llong').places[0];
    expect(p?.name).toMatch(/Club Natació Sabadell/);
    expect(p?.barri).toBe('Can Llong');
  });

  it('carrers en català o en castellà, amb o sense el tipus de via', () => {
    for (const q of ['sant pere', 'c/ sant pere', 'calle san pere', 'carrer de sant pere']) expect(searchPlaces(g, q).streets.map((s) => s.name)).toContain('Carrer de Sant Pere');
  });

  it('el barri sol no treu resultats que no hi tenen res a veure', () => {
    expect(searchPlaces(g, 'xyzzy').places).toHaveLength(0);
  });
});
