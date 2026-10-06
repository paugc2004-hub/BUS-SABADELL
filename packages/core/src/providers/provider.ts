/**
 * Proveedor de vehículos intercambiable (sección 5.2). Pasar de simulación a
 * tiempo real es cambiar de proveedor, no rehacer la app.
 */
import type { DataSource, VehicleState } from '../types.ts';
import type { SimEngine } from '../sim/engine.ts';

export interface VehicleDiff {
  serverTime: number;
  upserts: VehicleState[];
  removed: string[];
}

export interface ProviderHealth {
  source: DataSource;
  ok: boolean;
  lastUpdate: number | null;
  errors: number;
  lastError: string | null;
  latencyMs: number | null;
}

export type Unsubscribe = () => void;

export interface VehicleProvider {
  readonly source: DataSource;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** estado completo en un instante */
  snapshot(at: Date): VehicleState[];
  subscribe(cb: (diff: VehicleDiff) => void): Unsubscribe;
  health(): ProviderHealth;
}

/** Calcula el diff entre dos snapshots (solo cambios relevantes). */
export function diffSnapshots(prev: Map<string, VehicleState>, next: VehicleState[], serverTime: number): VehicleDiff {
  const upserts: VehicleState[] = [];
  const seen = new Set<string>();
  for (const v of next) {
    seen.add(v.id);
    const p = prev.get(v.id);
    if (!p || p.dist !== v.dist || p.status !== v.status || p.tripKey !== v.tripKey) upserts.push(v);
  }
  const removed: string[] = [];
  for (const id of prev.keys()) if (!seen.has(id)) removed.push(id);
  return { serverTime, upserts, removed };
}

/**
 * Proveedor simulado: el motor calcula el estado UNA vez por tick y se difunde
 * a todos los suscriptores (bug 12.5-38).
 */
export class SimulatedProvider implements VehicleProvider {
  readonly source = 'SIMULATED' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private subs = new Set<(d: VehicleDiff) => void>();
  private last = new Map<string, VehicleState>();
  private lastUpdate: number | null = null;

  constructor(
    private readonly engine: SimEngine,
    private readonly opts: { tickMs?: number; now?: () => number } = {},
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.opts.tickMs ?? 3000);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const t = this.now();
    const snap = this.engine.snapshot(t);
    const diff = diffSnapshots(this.last, snap, t);
    this.last = new Map(snap.map((v) => [v.id, v]));
    this.lastUpdate = t;
    if (diff.upserts.length || diff.removed.length) for (const cb of this.subs) cb(diff);
  }

  snapshot(at: Date): VehicleState[] {
    return this.engine.snapshot(at.getTime());
  }

  subscribe(cb: (diff: VehicleDiff) => void): Unsubscribe {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  health(): ProviderHealth {
    return { source: this.source, ok: true, lastUpdate: this.lastUpdate, errors: 0, lastError: null, latencyMs: 0 };
  }
}

/**
 * Híbrido: usa tiempo real cuando el dato del vehículo es fresco y cae a la
 * simulación cuando está caducado, marcando cada vehículo con su origen.
 */
export class HybridProvider implements VehicleProvider {
  readonly source = 'REALTIME' as const;

  constructor(
    private readonly realtime: VehicleProvider,
    private readonly fallback: VehicleProvider,
    private readonly maxAgeMs = 90_000,
  ) {}

  start(): Promise<void> {
    return Promise.all([this.realtime.start(), this.fallback.start()]).then(() => undefined);
  }

  stop(): Promise<void> {
    return Promise.all([this.realtime.stop(), this.fallback.stop()]).then(() => undefined);
  }

  snapshot(at: Date): VehicleState[] {
    const t = at.getTime();
    const rt = this.realtime.snapshot(at).filter((v) => t - v.timestamp <= this.maxAgeMs);
    const rtTrips = new Set(rt.map((v) => v.tripKey));
    const rtRoutesFresh = new Set(rt.map((v) => v.routeId));
    // por línea: si hay tiempo real fresco para esa línea, no mezclamos simulados de la misma
    const sim = this.fallback
      .snapshot(at)
      .filter((v) => !rtTrips.has(v.tripKey) && !rtRoutesFresh.has(v.routeId));
    return [...rt, ...sim];
  }

  subscribe(cb: (diff: VehicleDiff) => void): Unsubscribe {
    const a = this.realtime.subscribe(cb);
    const b = this.fallback.subscribe(cb);
    return () => {
      a();
      b();
    };
  }

  health(): ProviderHealth {
    const h = this.realtime.health();
    return { ...h, source: 'REALTIME' };
  }
}
