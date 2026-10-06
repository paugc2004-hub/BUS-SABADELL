/**
 * Entrada serverless (Vercel). Como el motor es determinista, cada instancia calcula
 * exactamente los mismos buses sin compartir estado: no hace falta un servidor único.
 * El SSE dura lo que permita la plataforma; el navegador reconecta solo (retry: 3000).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NetworkData } from '@bus/core';
import networkJson from '../../web/public/data/network.json';
import { buildServer } from './server.ts';

const network = networkJson as unknown as NetworkData;
const ready = buildServer({
  network,
  corsOrigins: (process.env.CORS_ORIGIN ?? 'https://bus-sabadell.vercel.app').split(',').map((s) => s.trim()).filter(Boolean),
  logger: true,
}).then(async ({ app, provider }) => {
  await provider.start();
  await app.ready();
  return app;
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await ready;
  app.server.emit('request', req, res);
}
