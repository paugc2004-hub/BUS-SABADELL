import { create } from 'zustand';
import { SimClock, forcedInstant, type NetworkData, type SimEngine } from '@bus/core';
import type { Lang } from '../i18n/index.ts';

export type View =
  | { name: 'map' }
  | { name: 'line'; ref: string | null }
  | { name: 'stop'; id: string }
  | { name: 'search' }
  | { name: 'present' };

export interface InterurbanData {
  source: { name: string; url: string; fetched: string; license: string };
  routes: { id: string; ref: string; name: string; agency: string }[];
  stops: { id: string; name: string; lat: number; lon: number; routes: string[] }[];
  shapes: { routeId: string; dir: number; headsign: string; coords: [number, number][] }[];
  services: Record<string, string[]>;
  times: Record<string, [string, string, number, string][]>;
  window: { from: string; to: string };
}

/** Reloj global: no es estado reactivo; los componentes leen `clock.now()`. */
export const clock = new SimClock();

function readClockParams(): void {
  const q = new URLSearchParams(location.search);
  const hora = q.get('hora');
  const dia = q.get('dia');
  const x = Number(q.get('x') ?? '1');
  const start = forcedInstant(Date.now(), hora, dia);
  const speed = Number.isFinite(x) && x > 0 && x <= 600 ? x : 1;
  if (start !== null || speed !== 1) clock.set(start, speed);
}
readClockParams();

export function parseView(path: string): View {
  const p = decodeURIComponent(path).replace(/\/+$/, '') || '/';
  let m = /^\/linia(?:\/([^/]+))?$/.exec(p);
  if (m) return { name: 'line', ref: m[1]?.toUpperCase() ?? null };
  m = /^\/parada\/([^/]+)$/.exec(p);
  if (m) return { name: 'stop', id: m[1]! };
  if (p === '/cercar') return { name: 'search' };
  if (p === '/presentacio') return { name: 'present' };
  return { name: 'map' };
}

export function viewPath(v: View): string {
  switch (v.name) {
    case 'line':
      return v.ref ? `/linia/${v.ref}` : '/linia';
    case 'stop':
      return `/parada/${encodeURIComponent(v.id)}`;
    case 'search':
      return '/cercar';
    case 'present':
      return '/presentacio';
    default:
      return '/';
  }
}

function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem('favs') ?? '[]') as string[];
  } catch {
    return [];
  }
}

interface AppState {
  lang: Lang;
  view: View;
  network: NetworkData | null;
  engine: SimEngine | null;
  loadState: 'loading' | 'ready' | 'error';
  selectedBus: string | null;
  follow: boolean;
  /** null = totes */
  visibleRoutes: string[] | null;
  interurbans: boolean;
  interData: InterurbanData | null;
  online: boolean;
  backend: 'off' | 'connecting' | 'live' | 'down';
  favorites: string[];
  clockVersion: number;
  aboutOpen: boolean;
  alertsOpen: boolean;
  userPos: [number, number] | null;
  flyTo: { center: [number, number]; zoom: number; id: number } | null;
  setLang(l: Lang): void;
  navigate(v: View, opts?: { replace?: boolean; keepQuery?: boolean }): void;
  selectBus(id: string | null): void;
  setFollow(f: boolean): void;
  setVisibleRoutes(r: string[] | null): void;
  toggleRoute(id: string): void;
  setInterurbans(on: boolean): void;
  toggleFavorite(stopId: string): void;
  setClock(start: number | null, speed: number): void;
  set(p: Partial<AppState>): void;
  requestFly(center: [number, number], zoom: number): void;
}

export const useApp = create<AppState>((set, get) => ({
  lang: 'ca',
  view: parseView(location.pathname),
  network: null,
  engine: null,
  loadState: 'loading',
  selectedBus: new URLSearchParams(location.search).get('bus'),
  follow: false,
  visibleRoutes: null,
  interurbans: false,
  interData: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  backend: 'off',
  favorites: readFavs(),
  clockVersion: 0,
  aboutOpen: false,
  alertsOpen: false,
  userPos: null,
  flyTo: null,
  setLang(l) {
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
    set({ lang: l });
  },
  navigate(v, opts = {}) {
    const q = new URLSearchParams(location.search);
    if (v.name !== 'map') q.delete('bus');
    const qs = opts.keepQuery === false ? '' : q.toString();
    const url = viewPath(v) + (qs ? `?${qs}` : '');
    if (opts.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    set({ view: v });
  },
  selectBus(id) {
    const q = new URLSearchParams(location.search);
    if (id) q.set('bus', id);
    else q.delete('bus');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
    set({ selectedBus: id, follow: id ? get().follow : false });
  },
  setFollow(f) {
    set({ follow: f });
  },
  setVisibleRoutes(r) {
    set({ visibleRoutes: r });
  },
  toggleRoute(id) {
    const all = get().network?.routes.map((r) => r.id) ?? [];
    const cur = get().visibleRoutes ?? all;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    set({ visibleRoutes: next.length === all.length ? null : next });
  },
  setInterurbans(on) {
    set({ interurbans: on });
    if (on && !get().interData) {
      fetch('/data/interurbans.json')
        .then((r) => r.json() as Promise<InterurbanData>)
        .then((d) => set({ interData: d }))
        .catch(() => set({ interurbans: false }));
    }
  },
  toggleFavorite(stopId) {
    const cur = get().favorites;
    const next = cur.includes(stopId) ? cur.filter((x) => x !== stopId) : [...cur, stopId];
    try {
      localStorage.setItem('favs', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    set({ favorites: next });
  },
  setClock(start, speed) {
    clock.set(start, speed);
    const q = new URLSearchParams(location.search);
    q.delete('hora');
    q.delete('dia');
    q.delete('x');
    if (start !== null) {
      const d = new Date(start);
      const hm = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
      const ymd = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Madrid' }).format(d);
      q.set('hora', hm);
      q.set('dia', ymd);
    }
    if (speed !== 1) q.set('x', String(speed));
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
    set({ clockVersion: get().clockVersion + 1 });
  },
  set(p) {
    set(p);
  },
  requestFly(center, zoom) {
    set({ flyTo: { center, zoom, id: Date.now() } });
  },
}));

if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp;

window.addEventListener('popstate', () => {
  useApp.setState({ view: parseView(location.pathname), selectedBus: new URLSearchParams(location.search).get('bus') });
});
window.addEventListener('online', () => useApp.setState({ online: true }));
window.addEventListener('offline', () => useApp.setState({ online: false }));
