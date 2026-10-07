import { describe, expect, it } from 'vitest';
import { dedupe, geoCode, parseGeoCode, rankPlaces, type RemotePlace } from './places.ts';

const P = (name: string, lon: number, lat: number, kind: string | null = 'shop'): RemotePlace => ({ id: name + lon, name, label: null, kind, lon, lat });

describe('cerca universal de llocs (client)', () => {
  it('el mateix nom: primer el més proper a l’usuari («Mercadona» a prop teu, no a 30 km)', () => {
    const far = P('Mercadona', 2.0869, 41.6033);
    const near = P('Mercadona', 2.1168, 41.5322);
    const r = rankPlaces([far, near], 'mercadona', [2.115, 41.533]);
    expect(r[0]).toBe(near);
  });

  it('coincidència exacta abans que parcial; les parades d’OSM fora (ja tenim les del TUS)', () => {
    const r = rankPlaces([P('Mercadona Express', 2.1, 41.54), P('Mercadona', 2.12, 41.56), P('Mercadona', 2.1, 41.54, 'bus_stop')], 'Mercadona', [2.1, 41.54]);
    expect(r.map((x) => x.name)).toEqual(['Mercadona', 'Mercadona Express']);
  });

  it('treu duplicats del nomenclàtor local', () => {
    const r = dedupe([P('Piscina Can Llong', 2.1201, 41.5501), P('Decathlon', 2.11, 41.54)], [{ name: 'Piscina Can Llong', pt: [2.12, 41.55] }]);
    expect(r.map((x) => x.name)).toEqual(['Decathlon']);
  });

  it('codi de ruta: anada i tornada amb accents i barres', () => {
    const code = geoCode({ name: 'Info Express · C/ Gràcia', label: 'Can Oriach, Sabadell', lon: 2.1201, lat: 41.5502 });
    expect(parseGeoCode(code)).toEqual({ name: 'Info Express · C/ Gràcia', label: 'Can Oriach, Sabadell', pt: [2.1201, 41.5502] });
    expect(code).not.toMatch(/[/?#%]/);
  });

  it('codi de ruta manipulat a l’URL → rebutjat, sense excepcions', () => {
    expect(parseGeoCode('g2.1,41.5,!!!')).toBeNull();
    expect(parseGeoCode('g-73.9,40.7,WyJ4IiwiIl0')).toBeNull(); // fora de la zona
    expect(parseGeoCode('g2.1,41.5,' + btoa('{"__proto__":{"x":1}}'))).toBeNull();
    expect(parseGeoCode('g2.1,41.5,' + 'A'.repeat(500))).toBeNull();
    expect(parseGeoCode('g2.1,41.5,WyIiXQ')).toBeNull(); // nom buit
  });
});
