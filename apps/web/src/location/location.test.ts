/**
 * LocationService amb un navigator.geolocation fals: estats (denegat ≠ temps esgotat ≠ no disponible),
 * posició ràpida → precisa, una sola petició alhora i que un error no esborra la posició que ja tenim.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Ok = (p: GeolocationPosition) => void;
type Fail = (e: GeolocationPositionError) => void;
interface Call {
  ok: Ok;
  fail: Fail;
  opts?: PositionOptions;
}

const pos = (lon: number, lat: number, accuracy = 30) =>
  ({ coords: { longitude: lon, latitude: lat, accuracy }, timestamp: Date.now() }) as unknown as GeolocationPosition;
const err = (code: 1 | 2 | 3) => ({ code, message: '' }) as GeolocationPositionError;

/** cada crida queda pendent fins que el test decideix què respon el «GPS» */
let calls: Call[] = [];
const fakeGeo = {
  getCurrentPosition: vi.fn((ok: Ok, fail: Fail, opts?: PositionOptions) => void calls.push({ ok, fail, opts })),
  watchPosition: vi.fn(() => 1),
  clearWatch: vi.fn(),
};
const flush = () => new Promise((r) => setTimeout(r, 0));

let svc: typeof import('./location.ts');
let store: typeof import('../state/store.ts');

beforeAll(async () => {
  // el store llegeix l'URL i el localStorage en carregar-se
  const mem = new Map<string, string>();
  vi.stubGlobal('location', { search: '', pathname: '/app' });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
  vi.stubGlobal('navigator', { geolocation: fakeGeo, onLine: true });
  vi.stubGlobal('window', { addEventListener: () => undefined, isSecureContext: true });
  store = await import('../state/store.ts');
  svc = await import('./location.ts');
});

beforeEach(() => {
  calls = [];
  vi.clearAllMocks();
  svc.locationService.forget();
});
afterEach(() => svc.locationService.forget());

const userPos = () => store.useApp.getState().userPos;
const status = () => svc.useLocation.getState().status;

describe('LocationService (ubicació al mòbil)', () => {
  it('primer una posició ràpida (sense GPS) i després la precisa la millora', async () => {
    const p = svc.locationService.locate();
    expect(status()).toBe('locating');
    expect(calls[0]!.opts).toMatchObject({ enableHighAccuracy: false });
    calls[0]!.ok(pos(2.1, 41.55, 900));
    expect(await p).toEqual([2.1, 41.55]);
    expect(status()).toBe('ok');
    // la precisa (GPS) arriba després i substitueix la ràpida (molt més precisa)
    expect(calls[1]!.opts).toMatchObject({ enableHighAccuracy: true });
    calls[1]!.ok(pos(2.1001, 41.5501, 12));
    await flush();
    expect(userPos()).toEqual([2.1001, 41.5501]);
    expect(svc.useLocation.getState().accuracy).toBe(12);
  });

  it('permís denegat → «denied», sense insistir amb el GPS', async () => {
    const p = svc.locationService.locate();
    calls[0]!.fail(err(1));
    expect(await p).toBeNull();
    expect(status()).toBe('denied');
    expect(calls).toHaveLength(1);
  });

  it('temps esgotat ≠ denegat: prova el GPS i, si tampoc, «timeout»', async () => {
    const p = svc.locationService.locate();
    calls[0]!.fail(err(3));
    await flush();
    expect(calls).toHaveLength(2);
    calls[1]!.fail(err(3));
    expect(await p).toBeNull();
    expect(status()).toBe('timeout');
  });

  it('posició no disponible → «unavailable»', async () => {
    const p = svc.locationService.locate();
    calls[0]!.fail(err(2));
    await flush();
    calls[1]!.fail(err(2));
    expect(await p).toBeNull();
    expect(status()).toBe('unavailable');
  });

  it('la ràpida falla però el GPS la troba', async () => {
    const p = svc.locationService.locate();
    calls[0]!.fail(err(3));
    await flush();
    calls[1]!.ok(pos(2.11, 41.56));
    expect(await p).toEqual([2.11, 41.56]);
    expect(status()).toBe('ok');
  });

  it('un error en tornar a localitzar no esborra la posició que ja teníem', async () => {
    const p1 = svc.locationService.locate();
    calls[0]!.ok(pos(2.1, 41.55));
    await p1;
    calls = [];
    const p2 = svc.locationService.retry();
    calls[0]!.fail(err(3));
    await flush();
    calls[1]!.fail(err(3));
    expect(await p2).toEqual([2.1, 41.55]);
    expect(status()).toBe('ok');
  });

  it('crides simultànies comparteixen una sola petició', async () => {
    const a = svc.locationService.locate();
    const b = svc.locationService.locate();
    expect(a).toBe(b);
    expect(fakeGeo.getCurrentPosition).toHaveBeenCalledTimes(1);
    calls[0]!.ok(pos(2.1, 41.55));
    expect(await a).toEqual(await b);
  });

  it('soroll del GPS (< 20 m) no mou l’origen (no es recalcula la ruta per res)', async () => {
    const p = svc.locationService.locate();
    calls[0]!.ok(pos(2.1, 41.55, 30));
    await p;
    calls[1]!.ok(pos(2.10005, 41.55005, 29)); // ~7 m, precisió gairebé igual
    await flush();
    expect(userPos()).toEqual([2.1, 41.55]);
  });

  it('navegador sense geolocalització → «unsupported», sense excepcions', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    try {
      expect(await svc.locationService.locate()).toBeNull();
      expect(status()).toBe('unsupported');
    } finally {
      vi.stubGlobal('navigator', { geolocation: fakeGeo, onLine: true });
    }
  });

  it('seguiment: s’atura quan ja no el vol ningú; denegat a mig camí → «denied»', () => {
    const stopA = svc.locationService.watch();
    const stopB = svc.locationService.watch();
    expect(fakeGeo.watchPosition).toHaveBeenCalledTimes(1);
    stopA();
    expect(fakeGeo.clearWatch).not.toHaveBeenCalled();
    stopB();
    stopB(); // dues vegades no descompta dos subscriptors
    expect(fakeGeo.clearWatch).toHaveBeenCalledTimes(1);

    const stop = svc.locationService.watch();
    const onError = (fakeGeo.watchPosition.mock.calls.at(-1) as unknown as [Ok, Fail])[1];
    onError(err(1));
    expect(status()).toBe('denied');
    stop();
  });

  it('privacitat: la posició no es desa mai al localStorage', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem');
    const p = svc.locationService.locate();
    calls[0]!.ok(pos(2.123456, 41.554321));
    await p;
    for (const [, v] of setItem.mock.calls) expect(String(v)).not.toMatch(/2\.1234|41\.5543/);
  });
});
