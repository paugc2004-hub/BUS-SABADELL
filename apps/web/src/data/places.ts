/**
 * Cerca universal de destins (docs/PLACES_SEARCH_ARCHITECTURE.md).
 *
 *   PlacesProvider (on és el lloc)  ≠  TransitProvider (quin bus: SimEngine / vehicles.ts)
 *
 * Fonts, per ordre: 1) el nomenclàtor local (carrers i llocs d'OSM, al dispositiu, streets.ts);
 * 2) el proveïdor remot (/api/places → Photon o Google Places, al servidor). Al servidor només li arriba
 * el text cercat; la proximitat a l'usuari s'ordena aquí, al mòbil.
 */
import { useEffect, useState } from 'react';
import { haversine, normalize, type LonLat } from '@bus/core';

export interface RemotePlace {
  id: string;
  name: string;
  label: string | null;
  kind: string | null;
  lon: number;
  lat: number;
}

export interface PlacesResponse {
  source: string;
  attribution: string;
  results: RemotePlace[];
}

export interface PlacesProvider {
  search(q: string, opts: { signal?: AbortSignal; lang: string }): Promise<PlacesResponse>;
}

/** proveïdor per defecte: la funció del mateix origen (sense claus al navegador) */
export const apiPlaces: PlacesProvider = {
  async search(q, { signal, lang }) {
    const r = await fetch(`/api/places?q=${encodeURIComponent(q)}&lang=${lang === 'es' ? 'es' : 'ca'}`, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as Partial<PlacesResponse>;
    return { source: String(j.source ?? ''), attribution: String(j.attribution ?? ''), results: Array.isArray(j.results) ? j.results.filter(valid) : [] };
  },
};

const valid = (p: RemotePlace) => typeof p?.name === 'string' && Number.isFinite(p.lon) && Number.isFinite(p.lat);

/** mínim de lletres abans de preguntar al proveïdor, i espera des de la darrera tecla */
export const MIN_REMOTE = 3;
export const DEBOUNCE_MS = 350;

const memo = new Map<string, PlacesResponse>();
const MEMO_MAX = 80;
const keyOf = (q: string, lang: string) => `${lang}|${normalize(q)}`;

/** tipus d'OSM que no són destins (les parades ja les tenim, millor, del TUS) */
const SKIP_KINDS = new Set(['bus_stop', 'platform', 'stop_position', 'stop', 'yes']);

/** Ordre: nom exacte > comença igual > conté totes les paraules > la resta; i dins de cada grup, més a prop. */
export function rankPlaces(list: RemotePlace[], q: string, from: LonLat | null): RemotePlace[] {
  const nq = normalize(q);
  const words = nq.split(' ').filter(Boolean);
  const tier = (p: RemotePlace) => {
    const n = normalize(p.name);
    if (n === nq) return 0;
    if (n.startsWith(nq)) return 1;
    if (words.every((w) => n.includes(w))) return 2;
    return 3;
  };
  const center: LonLat = from ?? [2.1035, 41.5463];
  return list
    .filter((p) => !(p.kind && SKIP_KINDS.has(p.kind)))
    .map((p) => ({ p, t: tier(p), d: haversine(center, [p.lon, p.lat]) }))
    .sort((a, b) => a.t - b.t || a.d - b.d)
    .map((x) => x.p);
}

/** el mateix ordre per als llocs del nomenclàtor local (amb el mateix nom, el més proper primer) */
export function rankLocal<T extends { name: string; pt: LonLat }>(list: T[], q: string, from: LonLat | null): T[] {
  const order = rankPlaces(
    list.map((x, i) => ({ id: String(i), name: x.name, label: null, kind: null, lon: x.pt[0], lat: x.pt[1] })),
    q,
    from,
  );
  return order.map((o) => list[Number(o.id)]!);
}

/** treu els remots que ja surten del nomenclàtor local (mateix nom a < 150 m) */
export function dedupe(remote: RemotePlace[], local: { name: string; pt: LonLat }[]): RemotePlace[] {
  const seen: { n: string; pt: LonLat }[] = local.map((l) => ({ n: normalize(l.name), pt: l.pt }));
  const out: RemotePlace[] = [];
  for (const p of remote) {
    const n = normalize(p.name);
    const pt: LonLat = [p.lon, p.lat];
    if (seen.some((s) => (s.n === n || s.n.includes(n) || n.includes(s.n)) && haversine(s.pt, pt) < 150)) continue;
    seen.push({ n, pt });
    out.push(p);
  }
  return out;
}

export type RemoteState = { status: 'idle' | 'loading' | 'done' | 'error'; data: PlacesResponse | null };

/**
 * Cerca remota amb control: mínim 3 lletres, 350 ms d'espera, cancel·la la petició anterior,
 * memòria de les darreres cerques i cap petició si no hi ha connexió. «Info Express» lletra a lletra = 1 petició.
 */
export function useRemotePlaces(q: string, lang: string, provider: PlacesProvider = apiPlaces): RemoteState {
  const clean = q.trim().slice(0, 80);
  const enough = normalize(clean).replace(/\s/g, '').length >= MIN_REMOTE;
  const k = keyOf(clean, lang);
  const [state, setState] = useState<RemoteState & { k: string }>({ status: 'idle', data: null, k: '' });
  useEffect(() => {
    if (!enough) return;
    const hit = memo.get(k);
    if (hit) {
      setState({ status: 'done', data: hit, k });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState({ status: 'error', data: null, k });
      return;
    }
    setState((s) => ({ status: 'loading', data: s.data, k }));
    const ctl = new AbortController();
    const id = setTimeout(() => {
      provider
        .search(clean, { signal: ctl.signal, lang })
        .then((data) => {
          if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
          memo.set(k, data);
          setState({ status: 'done', data, k });
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name !== 'AbortError') setState({ status: 'error', data: null, k });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [k, enough]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!enough) return { status: 'idle', data: null };
  // mentre carrega la nova cerca, no es mostren resultats d'una altra
  return state.k === k ? state : { status: 'loading', data: null };
}

/* ---------- codi de ruta per a un lloc trobat pel proveïdor: g<lon>,<lat>,<nom i zona en base64url> */

const b64u = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function geoCode(p: { name: string; label?: string | null; lon: number; lat: number }): string {
  return `g${p.lon.toFixed(6)},${p.lat.toFixed(6)},${b64u(JSON.stringify([p.name.slice(0, 80), (p.label ?? '').slice(0, 120)]))}`;
}

/** el codi ve de l'URL: es valida tot (format, coordenades a la zona, textos curts) */
export function parseGeoCode(code: string): { name: string; label: string | null; pt: LonLat } | null {
  const m = /^g(-?\d{1,3}\.\d{1,7}),(-?\d{1,3}\.\d{1,7}),([A-Za-z0-9_-]{1,400})$/.exec(code);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!(lon >= 1.9 && lon <= 2.3 && lat >= 41.4 && lat <= 41.7)) return null;
  try {
    const v: unknown = JSON.parse(unb64u(m[3]!));
    if (!Array.isArray(v) || typeof v[0] !== 'string' || !v[0].trim()) return null;
    const label = typeof v[1] === 'string' && v[1].trim() ? v[1].slice(0, 120) : null;
    return { name: v[0].slice(0, 80), label, pt: [lon, lat] };
  } catch {
    return null;
  }
}
