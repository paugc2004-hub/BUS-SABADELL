/**
 * LocationService: l'únic lloc de l'app que parla amb navigator.geolocation (docs/GEOLOCATION_IMPLEMENTATION.md).
 *
 *  - Primer una posició ràpida (xarxa / darrera coneguda, ≤ 5 min), després una de precisa (GPS) que la millora.
 *  - Estats diferenciats: permís denegat ≠ temps esgotat ≠ no disponible (abans tot era «denegat»).
 *  - Una sola petició alhora (les vistes que la demanen a la vegada comparteixen la mateixa).
 *  - Seguiment (watchPosition) amb comptador de subscriptors; s'atura quan l'app va a segon pla.
 *  - Escolta els canvis de permís (Permissions API, si existeix) per refer-se sense recarregar.
 *
 * Privacitat: la posició només viu en memòria (mai a localStorage, mai al servidor, mai als logs).
 */
import { create } from 'zustand';
import { haversine, type LonLat } from '@bus/core';
import { useApp } from '../state/store.ts';

export type LocStatus =
  'idle' | 'locating' | 'ok' | 'prompt' | 'denied' | 'timeout' | 'unavailable' | 'unsupported';
export type Permission = 'granted' | 'prompt' | 'denied' | 'unknown';

interface LocState {
  status: LocStatus;
  /** precisió de la darrera posició (m) */
  accuracy: number | null;
}

export const useLocation = create<LocState>(() => ({ status: 'idle', accuracy: null }));

/** no es mou l'origen per menys d'això (evita recalcular la ruta per soroll del GPS) */
const MIN_MOVE_M = 20;
const QUICK: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 5 * 60 * 1000,
};
const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
const WATCH: PositionOptions = { enableHighAccuracy: false, timeout: 30000, maximumAge: 15000 };

const geo = (): Geolocation | null =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null;

function setStatus(status: LocStatus) {
  if (useLocation.getState().status !== status) useLocation.setState({ status });
}

/** desa la posició si és nova (moviment real o millor precisió) */
function apply(p: GeolocationPosition) {
  const pt: LonLat = [p.coords.longitude, p.coords.latitude];
  const acc = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
  const prev = useApp.getState().userPos;
  const prevAcc = useLocation.getState().accuracy;
  const moved = !prev || haversine(prev, pt) >= MIN_MOVE_M;
  const better = acc !== null && (prevAcc === null || acc < prevAcc * 0.6);
  if (moved || better) useApp.getState().set({ userPos: pt });
  useLocation.setState({ status: 'ok', accuracy: acc });
}

function statusOf(err: GeolocationPositionError | null): LocStatus {
  if (!err) return 'unavailable';
  if (err.code === 1) return 'denied';
  if (err.code === 3) return 'timeout';
  return 'unavailable';
}

const once = (opts: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    const g = geo();
    if (!g) return reject(null);
    g.getCurrentPosition(resolve, reject, opts);
  });

let inflight: Promise<LonLat | null> | null = null;

export const locationService = {
  supported(): boolean {
    return Boolean(geo()) && (typeof window === 'undefined' || window.isSecureContext !== false);
  },

  /** estat del permís sense demanar-lo (Safari antic i alguns WebView no tenen Permissions API) */
  async getPermissionState(): Promise<Permission> {
    try {
      const r = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      return (r?.state as Permission | undefined) ?? 'unknown';
    } catch {
      return 'unknown';
    }
  },

  /**
   * On sóc ara. Demana el permís si cal. Resol amb la posició o null (l'estat diu per què).
   * Les crides simultànies comparteixen la mateixa petició.
   */
  locate(): Promise<LonLat | null> {
    if (!this.supported()) {
      setStatus('unsupported');
      return Promise.resolve(null);
    }
    if (inflight) return inflight;
    if (!useApp.getState().userPos) setStatus('locating');
    inflight = (async () => {
      try {
        // 1) ràpida: xarxa o posició recent; 2) precisa en segon pla
        const p = await once(QUICK);
        apply(p);
        void once(PRECISE).then(apply, () => undefined);
        return useApp.getState().userPos;
      } catch (e1) {
        const s1 = statusOf(e1 as GeolocationPositionError | null);
        if (s1 === 'denied') {
          setStatus('denied');
          return null;
        }
        // sense posició ràpida (p. ex. sense xarxa o primer cop): intent amb GPS, més temps
        try {
          const p = await once(PRECISE);
          apply(p);
          return useApp.getState().userPos;
        } catch (e2) {
          // si ja en teníem una, la mantenim: l'app continua funcionant
          if (useApp.getState().userPos) setStatus('ok');
          else setStatus(statusOf(e2 as GeolocationPositionError | null));
          return useApp.getState().userPos;
        }
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  retry(): Promise<LonLat | null> {
    return this.locate();
  },

  /** Seguir la posició mentre l'app és visible. Retorna la funció per deixar de seguir-la. */
  watch(): () => void {
    subscribers++;
    startWatch();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0) stopWatch();
    };
  },

  /** per als tests i per «tancar sessió»: oblida la posició */
  forget() {
    stopWatch();
    useApp.getState().set({ userPos: null });
    useLocation.setState({ status: 'idle', accuracy: null });
  },
};

let subscribers = 0;
let watchId: number | null = null;

function startWatch() {
  const g = geo();
  if (!g || watchId !== null || subscribers === 0) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const st = useLocation.getState().status;
  if (st === 'denied' || st === 'unsupported') return;
  watchId = g.watchPosition(
    apply,
    (e) => {
      // un error puntual del seguiment no esborra la posició que ja tenim
      if (e.code === 1) {
        setStatus('denied');
        stopWatch();
      }
    },
    WATCH,
  );
}

function stopWatch() {
  if (watchId !== null) geo()?.clearWatch(watchId);
  watchId = null;
}

if (typeof document !== 'undefined') {
  // a segon pla no gastem bateria; en tornar, posició fresca i seguiment
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopWatch();
    else if (subscribers > 0) {
      void locationService.locate();
      startWatch();
    }
  });
  // si l'usuari canvia el permís als ajustos mentre l'app és oberta
  void (async () => {
    try {
      const r = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (!r) return;
      r.addEventListener('change', () => {
        if (r.state === 'denied') {
          stopWatch();
          setStatus('denied');
        } else if (r.state === 'granted') {
          void locationService.locate();
          startWatch();
        } else setStatus(useApp.getState().userPos ? 'ok' : 'prompt');
      });
    } catch {
      /* sense Permissions API */
    }
  })();
}
