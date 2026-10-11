import { create } from 'zustand';
import { SimClock, forcedInstant, type Itinerary, type LonLat, type NetworkData, type SimEngine } from '@bus/core';
import type { Lang } from '../i18n/index.ts';
import { auth, type User } from '../auth/auth.ts';

export type View =
  | { name: 'landing' }
  | { name: 'login'; next?: string }
  | { name: 'register'; next?: string }
  | { name: 'home'; search?: boolean }
  | { name: 'map' }
  | { name: 'line'; ref: string | null }
  | { name: 'stop'; id: string }
  /** com hi arribo: `to` = c<id de carrer> | l<id de lloc> | p<id de parada>; `from` igual, o res = la meva ubicació */
  | { name: 'route'; to: string; from?: string }
  | { name: 'network' }
  | { name: 'mine' }
  | { name: 'present' }
  /** fitxa pública de parada (destí dels QR, PPT 2024 §2.1.5): sense sessió ni pas d'ubicació */
  | { name: 'stopCard'; id: string }
  /** generador de QR de parada */
  | { name: 'qr'; id: string | null }
  /** pàgines legals públiques */
  | { name: 'legal'; page: LegalPage };

export type LegalPage = 'privacitat' | 'avis-legal' | 'galetes';

/** vistes de base: tancar una parada o un bus torna a la darrera d'aquestes */
export type BaseView = 'home' | 'map' | 'line' | 'network' | 'mine';

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
  let p: string;
  try {
    p = decodeURIComponent(path).replace(/\/+$/, '') || '/';
  } catch {
    return { name: 'home' }; // URL mal codificada (%E0…): a l'inici, sense petar
  }
  let m = /^\/linia(?:\/([^/]+))?$/.exec(p);
  if (m) return { name: 'line', ref: m[1]?.toUpperCase() ?? null };
  m = /^\/parada\/([^/]+)$/.exec(p);
  if (m) return { name: 'stop', id: m[1]! };
  m = /^\/ruta\/([clpg][^/]+)$/.exec(p);
  if (m) return { name: 'route', to: m[1]!, from: new URLSearchParams(location.search).get('de') ?? undefined };
  m = /^\/p\/([^/]+)$/.exec(p);
  if (m) return { name: 'stopCard', id: m[1]! };
  m = /^\/qr(?:\/([^/]+))?$/.exec(p);
  if (m) return { name: 'qr', id: m[1] ?? null };
  if (p === '/privacitat' || p === '/avis-legal' || p === '/galetes') return { name: 'legal', page: p.slice(1) as LegalPage };
  if (p === '/') return { name: 'landing' };
  if (p === '/entra') return { name: 'login', next: new URLSearchParams(location.search).get('next') ?? undefined };
  if (p === '/registre') return { name: 'register', next: new URLSearchParams(location.search).get('next') ?? undefined };
  if (p === '/app') return { name: 'home' };
  if (p === '/cercar') return { name: 'home', search: true };
  if (p === '/mapa') return { name: 'map' };
  if (p === '/xarxa') return { name: 'network' };
  if (p === '/meus') return { name: 'mine' };
  if (p === '/presentacio') return { name: 'present' };
  return { name: 'home' };
}

export function viewPath(v: View): string {
  switch (v.name) {
    case 'line':
      return v.ref ? `/linia/${v.ref}` : '/linia';
    case 'stop':
      return `/parada/${encodeURIComponent(v.id)}`;
    case 'route':
      return `/ruta/${encodeURIComponent(v.to)}`;
    case 'landing':
      return '/';
    case 'login':
      return '/entra';
    case 'register':
      return '/registre';
    case 'home':
      return v.search ? '/cercar' : '/app';
    case 'map':
      return '/mapa';
    case 'network':
      return '/xarxa';
    case 'mine':
      return '/meus';
    case 'present':
      return '/presentacio';
    case 'stopCard':
      return `/p/${encodeURIComponent(v.id)}`;
    case 'qr':
      return v.id ? `/qr/${encodeURIComponent(v.id)}` : '/qr';
    case 'legal':
      return `/${v.page}`;
    default:
      return '/';
  }
}

/**
 * Viatge actiu ("Vaig a agafar aquest bus"). Es guarda al navegador (myBus) i mai
 * surt del dispositiu. Tota la informació que se'n mostra es deriva del VehicleState.
 */
export interface Trip {
  vehicleId: string;
  patternId: string;
  routeId: string;
  /** parada on el viatger puja (índex dins el pattern) */
  boardIndex: number;
  boardStopId: string;
  /** parada on baixa, si l'ha triada */
  alightIndex: number | null;
  createdAt: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'go' | 'warn';
}

/** les dades de cada compte es guarden separades (paradas, viatge) */
const keyFor = (base: string, uid: string | null | undefined) => (uid ? `${base}:${uid}` : base);

function readTrip(uid: string | null = auth.current()?.id ?? null): Trip | null {
  try {
    const t = JSON.parse(localStorage.getItem(keyFor('myBus', uid)) ?? 'null') as Trip | null;
    return t && typeof t.vehicleId === 'string' ? t : null;
  } catch {
    return null;
  }
}

function writeTrip(t: Trip | null) {
  const uid = auth.current()?.id ?? null;
  try {
    if (t) localStorage.setItem(keyFor('myBus', uid), JSON.stringify(t));
    else localStorage.removeItem(keyFor('myBus', uid));
  } catch {
    /* navegació privada */
  }
}

function readFavs(uid: string | null = auth.current()?.id ?? null): string[] {
  try {
    const own = localStorage.getItem(keyFor('favs', uid));
    // primera vegada amb compte: es queden les parades que ja tenia desades sense compte
    return JSON.parse(own ?? localStorage.getItem('favs') ?? '[]') as string[];
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
  /** compte amb la sessió iniciada (ficticis: veure auth/auth.ts) */
  user: User | null;
  /** després d'entrar o sortir del compte */
  setUser(u: User | null): void;
  clockVersion: number;
  aboutOpen: boolean;
  alertsOpen: boolean;
  userPos: [number, number] | null;
  flyTo: { center: [number, number]; zoom: number; id: number } | null;
  /** línia destacada al mapa (la resta s'atenuen, no s'amaguen) */
  focusRoute: string | null;
  trip: Trip | null;
  toasts: Toast[];
  /** panell d'inici (La meva parada) plegat */
  homeCollapsed: boolean;
  /** parada des d'on s'ha obert el bus: és on el viatger el vol agafar */
  boardHint: string | null;
  /** la ruta triada al planificador, per dibuixar-la al mapa */
  plan: { itinerary: Itinerary; from: LonLat; dest: LonLat; destName: string } | null;
  /** mode presentació actiu (es manté encara que la demo navegui a una parada) */
  presenting: boolean;
  base: BaseView;
  baseLine: string | null;
  /** tanca la parada o el bus i torna a la vista de base */
  back(): void;
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
  setFocusRoute(r: string | null): void;
  startTrip(t: Omit<Trip, 'createdAt'>): void;
  setAlight(index: number | null): void;
  endTrip(): void;
  pushToast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
}

let toastSeq = 0;

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
  user: auth.current(),
  setUser(u) {
    // en canviar de compte, cada usuari recupera les seves parades i el seu viatge
    set({ user: u, favorites: readFavs(u?.id ?? null), trip: u ? readTrip(u.id) : null, selectedBus: null, follow: false });
  },
  clockVersion: 0,
  aboutOpen: false,
  alertsOpen: false,
  userPos: null,
  flyTo: null,
  focusRoute: null,
  trip: readTrip(),
  toasts: [],
  homeCollapsed: false,
  boardHint: null,
  plan: null,
  presenting: parseView(location.pathname).name === 'present',
  base: 'home',
  baseLine: null,
  back() {
    const { base, baseLine } = get();
    get().navigate(base === 'line' ? { name: 'line', ref: baseLine } : { name: base });
  },
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
    if (v.name !== 'map' && v.name !== 'home' && v.name !== 'stop') q.delete('bus');
    if (v.name === 'route' && v.from) q.set('de', v.from);
    else q.delete('de');
    const qs = opts.keepQuery === false ? '' : q.toString();
    const url = viewPath(v) + (qs ? `?${qs}` : '');
    if (opts.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    const base: BaseView | null = v.name === 'home' || v.name === 'map' || v.name === 'network' || v.name === 'mine' ? v.name : v.name === 'line' ? 'line' : null;
    set({ view: v, ...(v.name !== 'route' ? { plan: null } : {}), ...(base ? { base, ...(base === 'line' && v.name === 'line' ? { baseLine: v.ref } : {}) } : {}), ...(v.name === 'present' ? { presenting: true } : {}) });
  },
  selectBus(id) {
    const q = new URLSearchParams(location.search);
    if (id) q.set('bus', id);
    else q.delete('bus');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
    set({ selectedBus: id, follow: id ? get().follow : false, ...(id ? {} : { boardHint: null }) });
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
      localStorage.setItem(keyFor('favs', get().user?.id), JSON.stringify(next));
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
  setFocusRoute(r) {
    set({ focusRoute: r });
  },
  startTrip(t) {
    const trip = { ...t, createdAt: Date.now() };
    writeTrip(trip);
    set({ trip, selectedBus: t.vehicleId });
  },
  setAlight(index) {
    const cur = get().trip;
    if (!cur) return;
    const trip = { ...cur, alightIndex: index };
    writeTrip(trip);
    set({ trip });
  },
  endTrip() {
    writeTrip(null);
    set({ trip: null });
  },
  pushToast(text, tone = 'info') {
    const id = ++toastSeq;
    // com a molt dues alertes a la vegada: no saturar
    set({ toasts: [...get().toasts.slice(-1), { id, text, tone }] });
    setTimeout(() => get().dismissToast(id), 6500);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));

if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp;

window.addEventListener('popstate', () => {
  const view = parseView(location.pathname);
  useApp.setState({ view, selectedBus: new URLSearchParams(location.search).get('bus'), ...(view.name !== 'route' ? { plan: null } : {}) });
});
window.addEventListener('online', () => useApp.setState({ online: true }));
window.addEventListener('offline', () => useApp.setState({ online: false }));
