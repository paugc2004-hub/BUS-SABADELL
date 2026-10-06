import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { SimEngine, SimulatedProvider, HybridProvider, type NetworkData } from '@bus/core';
import { buildServer } from '../src/server.ts';
import { GtfsRtProvider } from '../src/providers/gtfsRt.ts';
import { ArrivalsResponse, HealthResponse, MetaResponse, RouteResponse, VehiclesResponse } from '../src/schemas.ts';

const network = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../web/public/data/network.json', import.meta.url)), 'utf8'),
) as NetworkData;
// dimarts 6/10/2026 a les 08:15 (hora de Madrid)
const NOW = Date.parse('2026-10-06T06:15:00Z');

describe('API', async () => {
  const { app, provider } = await buildServer({ network, now: () => NOW, corsOrigins: ['https://bus-sabadell.example'], heartbeatMs: 200 });
  beforeAll(async () => {
    await provider.start();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    const r = await app.inject('/health');
    expect(r.statusCode).toBe(200);
    expect(HealthResponse.parse(r.json()).ok).toBe(true);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('GET /v1/meta declara que les posicions són simulades', async () => {
    const m = MetaResponse.parse((await app.inject('/v1/meta')).json());
    expect(m.simulated).toBe(true);
    expect(m.provider).toBe('SIMULATED');
    expect(m.serverTime).toBe(NOW);
    expect(m.disclaimer).toMatch(/SIMULADES/);
  });

  it('GET /v1/network amb ETag i 304', async () => {
    const r = await app.inject('/v1/network');
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toMatch(/max-age=3600/);
    const etag = r.headers.etag as string;
    const r2 = await app.inject({ url: '/v1/network', headers: { 'if-none-match': etag } });
    expect(r2.statusCode).toBe(304);
  });

  it('GET /v1/vehicles: snapshot sense memòria cau', async () => {
    const r = await app.inject('/v1/vehicles');
    const body = VehiclesResponse.parse(r.json());
    expect(r.headers['cache-control']).toBe('no-store');
    expect(body.count).toBeGreaterThan(40);
    expect(body.vehicles.every((v) => v.source === 'SIMULATED')).toBe(true);
  });

  it('GET /v1/stops/:id/arrivals', async () => {
    const r = await app.inject('/v1/stops/17/arrivals?limit=5');
    const body = ArrivalsResponse.parse(r.json());
    expect(body.stop.name).toBe('Manresa');
    expect(body.arrivals.length).toBe(5);
    for (let i = 1; i < body.arrivals.length; i++) expect(body.arrivals[i]!.at).toBeGreaterThanOrEqual(body.arrivals[i - 1]!.at);
    expect((await app.inject('/v1/stops/no-existeix/arrivals')).statusCode).toBe(404);
    expect((await app.inject('/v1/stops/%3Cscript%3E/arrivals')).statusCode).toBe(400);
  });

  it('GET /v1/routes/:id', async () => {
    const body = RouteResponse.parse((await app.inject('/v1/routes/l1')).json());
    expect(body.route.id).toBe('L1');
    expect(body.runsToday).toBe(true);
    expect(body.vehicles.length).toBeGreaterThan(0);
    expect((await app.inject('/v1/routes/L99')).statusCode).toBe(404);
  });

  it('GET /v1/alerts', async () => {
    const r = await app.inject('/v1/alerts');
    expect(Array.isArray(r.json().alerts)).toBe(true);
  });

  it('CORS restringit al domini del frontend', async () => {
    const ok = await app.inject({ url: '/v1/meta', headers: { origin: 'https://bus-sabadell.example' } });
    expect(ok.headers['access-control-allow-origin']).toBe('https://bus-sabadell.example');
    const bad = await app.inject({ url: '/v1/meta', headers: { origin: 'https://altres.example' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('capçaleres de seguretat', async () => {
    const r = await app.inject('/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(r.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('SSE: snapshot inicial, heartbeat i Cache-Control no-store', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/v1/vehicles/stream`, { signal: ctrl.signal });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    const reader = res.body!.getReader();
    let text = '';
    const dec = new TextDecoder();
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !(text.includes('event: snapshot') && text.includes(': heartbeat'))) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
    ctrl.abort();
    expect(text).toContain('retry: 3000');
    expect(text).toContain('event: snapshot');
    expect(text).toContain(': heartbeat');
    const data = JSON.parse(/event: snapshot\ndata: (.*)\n/.exec(text)![1]!);
    expect(data.source).toBe('SIMULATED');
    expect(data.vehicles.length).toBeGreaterThan(40);
  });
});

describe('GtfsRtProvider amb fixture .pb', () => {
  const fx = (f: string) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));

  it('descodifica posicions, les casa amb el recorregut i ignora vehicles fora de ruta', async () => {
    const p = new GtfsRtProvider(network, { vehiclePositions: fx('vehicle-positions.pb'), tripUpdates: fx('trip-updates.pb') });
    await p.poll();
    const vs = p.snapshot();
    expect(p.health().ok).toBe(true);
    expect(vs.map((v) => v.label).sort()).toEqual(['1023', '1044']);
    const a = vs.find((v) => v.label === '1023')!;
    expect(a.source).toBe('REALTIME');
    expect(a.routeId).toBe('L1');
    expect(a.patternId).toBe('L1-10104764');
    expect(a.etas).toHaveLength(2);
    expect(a.speedKmh).toBe(22);
    expect(vs.find((v) => v.label === '1044')!.status).toBe('EN_PARADA');
  });

  it('un feed que no es pot llegir es reflecteix a health() sense trencar res', async () => {
    const p = new GtfsRtProvider(network, { vehiclePositions: fx('no-existeix.pb') });
    await p.poll();
    expect(p.health().ok).toBe(false);
    expect(p.health().errors).toBe(1);
    expect(p.snapshot()).toEqual([]);
  });

  it('HybridProvider: temps real on n’hi ha i simulació a la resta de línies', async () => {
    const rt = new GtfsRtProvider(network, { vehiclePositions: fx('vehicle-positions.pb') });
    await rt.poll();
    const sim = new SimulatedProvider(new SimEngine(network));
    const h = new HybridProvider(rt, sim, 10 * 365 * 86400_000);
    const vs = h.snapshot(new Date(NOW));
    expect(vs.filter((v) => v.routeId === 'L1').every((v) => v.source === 'REALTIME')).toBe(true);
    expect(vs.some((v) => v.routeId === 'L2' && v.source === 'SIMULATED')).toBe(true);
  });
});
