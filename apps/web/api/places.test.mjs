import { describe, expect, it } from 'vitest';
import { cleanQuery, fromGoogle, fromPhoton, placesSearch, rateLimited } from './places.mjs';

const photonJson = {
  features: [
    {
      properties: {
        osm_type: 'N',
        osm_id: 1,
        name: 'Mercadona',
        street: 'Avinguda de Francesc Macià',
        city: 'Sabadell',
        osm_value: 'supermarket',
      },
      geometry: { coordinates: [2.098563, 41.5513351] },
    },
    {
      properties: { osm_type: 'N', osm_id: 2, name: 'Lluny', city: 'Barcelona' },
      geometry: { coordinates: [2.17, 41.39] },
    },
    {
      properties: {
        osm_type: 'N',
        osm_id: 3,
        street: 'Carrer de Fiveller',
        housenumber: '50',
        city: 'Sabadell',
      },
      geometry: { coordinates: [2.1039, 41.539] },
    },
  ],
};
const ok = (json) => async () => ({ ok: true, status: 200, json: async () => json });

describe('/api/places', () => {
  it('neteja el text: control, < >, longitud', () => {
    expect(cleanQuery(' a ')).toBeNull();
    expect(cleanQuery(42)).toBeNull();
    expect(cleanQuery('<script>alert(1)</script>')).toBe('script alert(1) /script');
    expect(cleanQuery('x'.repeat(200))).toHaveLength(80);
    expect(cleanQuery('Info\u0000 Express')).toBe('Info Express');
  });

  it('Photon: només dins la zona; adreces sense nom amb carrer i número', () => {
    const r = fromPhoton(photonJson);
    expect(r.map((x) => x.name)).toEqual(['Mercadona', 'Carrer de Fiveller 50']);
    expect(r[0].label).toContain('Sabadell');
    expect(fromPhoton(null)).toEqual([]);
    expect(
      fromPhoton({
        features: [{ properties: { name: 'x' }, geometry: { coordinates: ['a', 'b'] } }],
      }),
    ).toEqual([]);
  });

  it('Google: format normalitzat i fora de la zona descartat', () => {
    const r = fromGoogle({
      places: [
        {
          id: 'abc',
          displayName: { text: 'Info Express' },
          shortFormattedAddress: 'Carrer X, Sabadell',
          location: { latitude: 41.55, longitude: 2.12 },
        },
        { id: 'z', displayName: { text: 'Madrid' }, location: { latitude: 40.4, longitude: -3.7 } },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'g:abc', name: 'Info Express', label: 'Carrer X, Sabadell' });
  });

  it('sense clau → Photon; amb clau → Google i, si falla, Photon', async () => {
    const a = await placesSearch({ q: 'mercadona', lang: 'ca', fetchImpl: ok(photonJson) });
    expect(a.status).toBe(200);
    expect(a.body.source).toBe('photon');
    const calls = [];
    const flaky = async (url) => {
      calls.push(String(url));
      if (String(url).includes('googleapis'))
        return { ok: false, status: 403, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => photonJson };
    };
    const b = await placesSearch({
      q: 'mercadona 2',
      lang: 'ca',
      env: { GOOGLE_PLACES_API_KEY: 'k'.repeat(39) },
      fetchImpl: flaky,
    });
    expect(calls[0]).toContain('googleapis');
    expect(b.body.source).toBe('photon');
  });

  it('mai envia res més que el text: ni ubicació ni identitat', async () => {
    let seen = '';
    await placesSearch({
      q: 'taulí',
      lang: 'ca',
      fetchImpl: async (url, init) => (
        (seen = `${url} ${JSON.stringify(init)}`),
        { ok: true, status: 200, json: async () => ({ features: [] }) }
      ),
    });
    expect(seen).not.toMatch(/cookie|authorization|@/i);
  });

  it('error del proveïdor → 502 sense detalls interns; text invàlid → 400', async () => {
    const r = await placesSearch({
      q: 'xyz error',
      lang: 'ca',
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toMatch(/photon 500|stack/);
    expect((await placesSearch({ q: '', lang: 'ca' })).status).toBe(400);
  });

  it('límit de ritme per IP', () => {
    const t = 1_000_000;
    let blocked = false;
    for (let i = 0; i < 45; i++) blocked = rateLimited('1.2.3.4', t);
    expect(blocked).toBe(true);
    expect(rateLimited('5.6.7.8', t)).toBe(false);
    expect(rateLimited('1.2.3.4', t + 61_000)).toBe(false);
  });
});
