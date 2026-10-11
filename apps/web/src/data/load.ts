/**
 * Càrrega de la xarxa i connexió (opcional) amb el backend.
 *
 * La web funciona sola: la xarxa ve empaquetada (/data/network.json) i el motor de
 * simulació corre al navegador. Si hi ha backend (VITE_API_URL), només s'usa per
 * corregir el rellotge i, el dia que hi hagi temps real, per rebre posicions reals.
 */
import { SimEngine, type NetworkData, type VehicleState } from '@bus/core';
import { clock, useApp } from '../state/store.ts';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

let inflight: Promise<void> | null = null;

/** Carrega la xarxa (una sola petició alhora: l'app i les pàgines públiques poden demanar-la a la vegada). */
export function loadNetwork(): Promise<void> {
  inflight ??= fetchNetwork().finally(() => (inflight = null));
  return inflight;
}

async function fetchNetwork(): Promise<void> {
  useApp.setState({ loadState: 'loading' });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch('/data/network.json', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const network = (await res.json()) as NetworkData;
    const engine = new SimEngine(network);
    useApp.setState({ network, engine, loadState: 'ready' });
    if (API) connectBackend();
  } catch (e) {
    console.error('network load failed', e);
    useApp.setState({ loadState: 'error' });
  }
}

/** Vehicles de temps real rebuts del backend (buit mentre el proveïdor sigui simulat). */
export const realtimeVehicles = new Map<string, VehicleState>();

let es: EventSource | null = null;

/**
 * SSE amb reconnexió nativa. Si el servidor tarda a despertar (cold start), la web
 * ja està funcionant amb la simulació local: mai pantalla en blanc (bug 12.5-41).
 */
export function connectBackend(): void {
  if (!API || es) return;
  useApp.setState({ backend: 'connecting' });
  const sent = Date.now();
  fetch(`${API}/v1/meta`, { cache: 'no-store' })
    .then((r) => r.json() as Promise<{ serverTime: number; provider: string }>)
    .then((m) => {
      // hora del servidor corregida a mitja latència
      clock.setServerSkew(m.serverTime + (Date.now() - sent) / 2);
      useApp.setState({ backend: 'live' });
      // l'stream només fa falta quan el servidor té posicions reals; la simulació ja corre aquí
      if (m.provider === 'REALTIME') openStream();
    })
    .catch(() => useApp.setState({ backend: 'down' }));
}

function openStream(): void {
  if (es) return;
  es = new EventSource(`${API}/v1/vehicles/stream`);
  es.addEventListener('snapshot', (ev) => {
    const d = JSON.parse((ev as MessageEvent).data) as { serverTime: number; source: string; vehicles: VehicleState[] };
    clock.setServerSkew(d.serverTime);
    realtimeVehicles.clear();
    if (d.source === 'REALTIME') for (const v of d.vehicles) realtimeVehicles.set(v.id, v);
    useApp.setState({ backend: 'live' });
  });
  es.addEventListener('diff', (ev) => {
    const d = JSON.parse((ev as MessageEvent).data) as { serverTime: number; upserts: VehicleState[]; removed: string[] };
    clock.setServerSkew(d.serverTime);
    for (const v of d.upserts) if (v.source === 'REALTIME') realtimeVehicles.set(v.id, v);
    for (const id of d.removed) realtimeVehicles.delete(id);
  });
  es.onerror = () => useApp.setState({ backend: 'down' });
  es.onopen = () => useApp.setState({ backend: 'live' });
}

export function disconnectBackend(): void {
  es?.close();
  es = null;
}
