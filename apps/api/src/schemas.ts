/** Contrato de la API (validado en tests y en las entradas). */
import { z } from 'zod';

export const DataSource = z.enum(['SIMULATED', 'SCHEDULED', 'REALTIME']);

export const VehicleSchema = z.object({
  id: z.string(),
  label: z.string(),
  routeId: z.string(),
  patternId: z.string(),
  tripKey: z.string(),
  status: z.enum(['EN_RUTA', 'EN_PARADA', 'EN_CABECERA', 'RETRASADO', 'DESVIADO', 'RETIRADA']),
  source: DataSource,
  dist: z.number().nonnegative(),
  lon: z.number(),
  lat: z.number(),
  bearing: z.number(),
  speedKmh: z.number().nonnegative(),
  nextStopIndex: z.number().int().nonnegative(),
  nextStopId: z.string().nullable(),
  etas: z.array(z.object({ stopId: z.string(), at: z.number(), scheduledAt: z.number().optional() })),
  departure: z.number(),
  lastTrip: z.boolean(),
  timestamp: z.number(),
  dir: z.union([z.literal(0), z.literal(1)]),
  origin: z.string(),
  headsign: z.string(),
  progress: z.number().min(0).max(1),
  prevStopIndex: z.number().int().min(-1),
  atStopIndex: z.number().int().nonnegative().nullable(),
  distToNextM: z.number().nonnegative().nullable(),
  stopsRemaining: z.number().int().nonnegative(),
  delaySec: z.number().nullable(),
});

export const VehiclesResponse = z.object({
  serverTime: z.number(),
  source: DataSource,
  count: z.number().int(),
  vehicles: z.array(VehicleSchema),
});

export const ArrivalsResponse = z.object({
  serverTime: z.number(),
  stop: z.object({ id: z.string(), name: z.string(), lat: z.number(), lon: z.number(), routes: z.array(z.string()) }),
  arrivals: z.array(
    z.object({
      routeId: z.string(),
      patternId: z.string(),
      headsign: z.string(),
      at: z.number(),
      scheduledAt: z.number(),
      delaySec: z.number().nullable(),
      vehicleId: z.string().nullable(),
      status: z.enum(['EN_RUTA', 'PENDENT_SORTIDA']),
      source: DataSource,
    }),
  ),
});

export const RouteResponse = z.object({
  serverTime: z.number(),
  route: z.object({ id: z.string(), ref: z.string(), longName: z.string(), color: z.string(), textColor: z.string(), kind: z.string() }),
  runsToday: z.boolean(),
  patterns: z.array(z.object({ id: z.string(), dir: z.number(), name: z.string(), headsign: z.string(), dayType: z.string(), stopIds: z.array(z.string()) })),
  vehicles: z.array(VehicleSchema),
});

export const MetaResponse = z.object({
  serverTime: z.number(),
  dataVersion: z.string(),
  builtAt: z.string(),
  provider: DataSource,
  simulated: z.boolean(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), url: z.string(), license: z.string(), fetched: z.string() }).passthrough()),
  disclaimer: z.string(),
});

export const HealthResponse = z.object({
  ok: z.boolean(),
  uptimeS: z.number(),
  provider: z.object({ source: DataSource, ok: z.boolean(), lastUpdate: z.number().nullable(), errors: z.number(), lastError: z.string().nullable(), latencyMs: z.number().nullable() }),
});

export const StopParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/) });
export const RouteParams = z.object({ id: z.string().regex(/^[A-Za-z0-9]{1,8}$/) });
export const ArrivalsQuery = z.object({
  horizon: z.coerce.number().int().min(1).max(180).default(90),
  limit: z.coerce.number().int().min(1).max(40).default(12),
});
