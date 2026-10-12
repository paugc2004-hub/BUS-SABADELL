/**
 * Backend: fuente de verdad del reloj y de la simulación. Todos los clientes ven
 * los mismos buses; el cálculo se hace una vez por tick y se difunde (bug 12.5-38).
 * Sin base de datos en el MVP: todo en memoria a partir de network.json.
 * (Si se guardan históricos de tiempo real, iría aquí un repositorio SQLite/Postgres.)
 */
import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { SimEngine, SimulatedProvider, type NetworkData, type VehicleDiff, type VehicleProvider, type VehicleState } from '@bus/core';
import { ArrivalsQuery, RouteParams, StopParams } from './schemas.ts';

export interface ServerOptions {
  network: NetworkData;
  provider?: VehicleProvider;
  corsOrigins?: string[];
  now?: () => number;
  logger?: boolean;
  heartbeatMs?: number;
  rateLimitMax?: number;
}

const DISCLAIMER =
  'Demo independent. Les posicions dels autobusos són SIMULADES a partir dels horaris publicats per TUS; no són posicions reals.';

export async function buildServer(opts: ServerOptions): Promise<{ app: FastifyInstance; engine: SimEngine; provider: VehicleProvider }> {
  const now = opts.now ?? (() => Date.now());
  const engine = new SimEngine(opts.network);
  const provider = opts.provider ?? new SimulatedProvider(engine, { tickMs: 3000, now });
  const started = Date.now();
  const app = Fastify({
    logger: opts.logger
      ? { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie'], serializers: { req: (r) => ({ method: r.method, url: r.url }) } }
      : false,
    trustProxy: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: opts.corsOrigins && opts.corsOrigins.length ? opts.corsOrigins : false,
    methods: ['GET'],
  });
  await app.register(compress, { global: true, encodings: ['br', 'gzip'] });
  await app.register(rateLimit, { max: opts.rateLimitMax ?? 300, timeWindow: '1 minute' });

  const networkBody = JSON.stringify(opts.network);
  const etag = `"${createHash('sha1').update(networkBody).digest('hex').slice(0, 16)}"`;
  const noStore = { 'cache-control': 'no-store' };

  app.get('/health', async (_req, reply) => {
    reply.headers(noStore);
    return { ok: true, uptimeS: Math.round((Date.now() - started) / 1000), provider: provider.health() };
  });

  app.get('/v1/meta', async (_req, reply) => {
    reply.headers(noStore);
    return {
      serverTime: now(),
      dataVersion: opts.network.version,
      builtAt: opts.network.builtAt,
      provider: provider.source,
      simulated: provider.source !== 'REALTIME',
      sources: opts.network.sources,
      disclaimer: DISCLAIMER,
    };
  });

  app.get('/v1/network', async (req, reply) => {
    reply.header('etag', etag).header('cache-control', 'public, max-age=3600, stale-while-revalidate=86400');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type('application/json').send(networkBody);
  });

  const vehiclesNow = (): VehicleState[] => provider.snapshot(new Date(now()));

  app.get('/v1/vehicles', async (_req, reply) => {
    reply.headers(noStore);
    const vehicles = vehiclesNow();
    return { serverTime: now(), source: provider.source, count: vehicles.length, vehicles };
  });

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>('/v1/stops/:id/arrivals', async (req, reply) => {
    const p = StopParams.safeParse(req.params);
    const q = ArrivalsQuery.safeParse(req.query);
    if (!p.success || !q.success) return reply.code(400).send({ error: 'paràmetres no vàlids' });
    const stop = engine.stops.get(p.data.id);
    if (!stop) return reply.code(404).send({ error: 'parada desconeguda' });
    reply.headers(noStore);
    return { serverTime: now(), stop, arrivals: engine.arrivals(stop.id, now(), q.data.horizon, q.data.limit) };
  });

  app.get<{ Params: { id: string } }>('/v1/routes/:id', async (req, reply) => {
    const p = RouteParams.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'paràmetres no vàlids' });
    const route = engine.routes.get(p.data.id.toUpperCase());
    if (!route) return reply.code(404).send({ error: 'línia desconeguda' });
    reply.headers(noStore);
    const t = now();
    return {
      serverTime: t,
      route,
      runsToday: engine.runsAt(route.id, t),
      patterns: opts.network.patterns
        .filter((x) => x.routeId === route.id)
        .map((x) => ({ id: x.id, dir: x.dir, name: x.name, headsign: x.headsign, dayType: x.dayType, stopIds: x.stopIds })),
      vehicles: vehiclesNow().filter((v) => v.routeId === route.id),
    };
  });

  app.get('/v1/alerts', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return { serverTime: now(), alerts: opts.network.alerts };
  });

  /**
   * SSE: snapshot inicial + diffs. Heartbeat cada 15 s para que los proxies no
   * corten la conexión (bug 12.5-37). Con Last-Event-ID el cliente que reconecta
   * recibe un snapshot nuevo (el estado es función del reloj: no hay que reenviar historia).
   */
  let eventId = 0;
  const clients = new Set<(event: string, data: unknown) => void>();
  provider.subscribe((diff: VehicleDiff) => {
    for (const send of clients) send('diff', diff);
  });

  app.get('/v1/vehicles/stream', (req, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...(reply.getHeader('access-control-allow-origin') ? { 'access-control-allow-origin': String(reply.getHeader('access-control-allow-origin')) } : {}),
    });
    const send = (event: string, data: unknown) => {
      eventId++;
      reply.raw.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    reply.raw.write('retry: 3000\n\n');
    send('snapshot', { serverTime: now(), source: provider.source, vehicles: vehiclesNow() });
    clients.add(send);
    const hb = setInterval(() => reply.raw.write(`: heartbeat ${now()}\n\n`), opts.heartbeatMs ?? 15000);
    req.raw.on('close', () => {
      clearInterval(hb);
      clients.delete(send);
    });
  });

  app.addHook('onClose', async () => {
    await provider.stop();
  });

  return { app, engine, provider };
}
