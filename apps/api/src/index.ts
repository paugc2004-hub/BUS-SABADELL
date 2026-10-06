import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimEngine, SimulatedProvider, HybridProvider, type NetworkData } from '@bus/core';
import { buildServer } from './server.ts';
import { GtfsRtProvider } from './providers/gtfsRt.ts';

const here = dirname(fileURLToPath(import.meta.url));
const networkPath = process.env.NETWORK_PATH ?? resolve(here, '../../web/public/data/network.json');
const network = JSON.parse(readFileSync(networkPath, 'utf8')) as NetworkData;

// PROVIDER=sim (por defecto) | gtfsrt (necesita GTFS_RT_VEHICLES y opcionalmente GTFS_RT_TRIPS)
let provider;
if (process.env.PROVIDER === 'gtfsrt' && process.env.GTFS_RT_VEHICLES) {
  const rt = new GtfsRtProvider(network, {
    vehiclePositions: process.env.GTFS_RT_VEHICLES,
    ...(process.env.GTFS_RT_TRIPS ? { tripUpdates: process.env.GTFS_RT_TRIPS } : {}),
    pollMs: Number(process.env.GTFS_RT_POLL_MS ?? 10000),
  });
  provider = new HybridProvider(rt, new SimulatedProvider(new SimEngine(network)));
}

const { app, provider: p } = await buildServer({
  network,
  ...(provider ? { provider } : {}),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim()),
  logger: true,
});
await p.start();
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '0.0.0.0' });
