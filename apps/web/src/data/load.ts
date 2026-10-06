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

export async function loadNetwork(): Promise<void> {
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
  fetch(`${API}/v1/meta`)
    .then((r) => r.json() as Promise<{ serverTime: number }>)
    .then((m) => clock.setServerSkew(m.serverTime))
    .catch(() => undefined);
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
