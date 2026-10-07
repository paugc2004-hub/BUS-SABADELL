/* global AbortController, setTimeout, clearTimeout, URL, fetch, process */
/**
 * GET /api/places?q=… — cerca universal de destins (comerços, adreces, equipaments, carrers…).
 * Funció serverless de Vercel (mateix origen que la web: sense CORS ni CSP extra).
 *
 * Proveïdors (docs/PLACES_PROVIDER_EVALUATION.md):
 *  - Google Places (New) Text Search, si hi ha GOOGLE_PLACES_API_KEY a l'entorn del SERVIDOR
 *    (mai al frontend ni al repositori). Millor cobertura de comerços petits.
 *  - Photon (komoot, dades d'OpenStreetMap, ODbL), sense clau: per defecte.
 *
 * Privacitat: el client NOMÉS envia el text cercat. Ni la ubicació, ni el compte, ni cookies.
 * El biaix geogràfic és el centre de la xarxa TUS; l'ordenació per proximitat es fa al mòbil.
 * L'adreça IP de l'usuari no arriba al proveïdor (la petició la fa el servidor).
 */

/** zona on busquem: la xarxa TUS (parades 2.066–2.137 E, 41.512–41.576 N) + ~5 km de marge */
export const AREA = Object.freeze({ w: 2.0, s: 41.47, e: 2.2, n: 41.62 });
const CENTER = Object.freeze({ lon: 2.1035, lat: 41.5463 });
const MAX_Q = 80;
const UPSTREAM_TIMEOUT_MS = 7000;
const UA = 'NextMobility-Sabadell/1.0 (+https://bus-sabadell.vercel.app)';

/** Text de cerca net: sense caràcters de control, espais normalitzats, 2–80 caràcters. */
export function cleanQuery(raw) {
  if (typeof raw !== 'string') return null;
  const q = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_Q);
  return q.length >= 2 ? q : null;
}

const inArea = (lon, lat) =>
  Number.isFinite(lon) &&
  Number.isFinite(lat) &&
  lon >= AREA.w &&
  lon <= AREA.e &&
  lat >= AREA.s &&
  lat <= AREA.n;
const str = (v, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Photon (OSM) → resultats normalitzats */
export function fromPhoton(json) {
  const out = [];
  for (const f of Array.isArray(json?.features) ? json.features : []) {
    const p = f?.properties ?? {};
    const [lon, lat] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
    if (!inArea(lon, lat)) continue;
    const street = str(p.street);
    const num = str(p.housenumber, 12);
    const name = str(p.name) ?? (street ? `${street}${num ? ` ${num}` : ''}` : null);
    if (!name) continue;
    const area = str(p.district) ?? str(p.locality);
    const city = str(p.city) ?? str(p.county);
    const addr =
      street && name !== street && !name.startsWith(street)
        ? `${street}${num ? ` ${num}` : ''}`
        : null;
    out.push({
      id: `osm:${String(p.osm_type ?? '').slice(0, 1)}${Number(p.osm_id) || 0}`,
      name,
      label: [addr, area, city].filter(Boolean).join(' · ') || null,
      kind: str(p.osm_value, 30) ?? str(p.type, 30),
      lon: Math.round(lon * 1e6) / 1e6,
      lat: Math.round(lat * 1e6) / 1e6,
    });
  }
  return out;
}

/** Google Places (New) → resultats normalitzats */
export function fromGoogle(json) {
  const out = [];
  for (const p of Array.isArray(json?.places) ? json.places : []) {
    const lon = p?.location?.longitude;
    const lat = p?.location?.latitude;
    if (!inArea(lon, lat)) continue;
    const name = str(p?.displayName?.text);
    if (!name) continue;
    out.push({
      id: `g:${String(p.id ?? '').slice(0, 200)}`,
      name,
      label: str(p.shortFormattedAddress, 120) ?? str(p.formattedAddress, 120),
      kind: str(p.primaryType, 30),
      lon: Math.round(lon * 1e6) / 1e6,
      lat: Math.round(lat * 1e6) / 1e6,
    });
  }
  return out;
}

async function timed(fetchImpl, url, init) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(id);
  }
}

export const providers = {
  photon: {
    attribution: '© OpenStreetMap contributors · Photon',
    cacheable: true,
    async search(q, { fetchImpl, lang }) {
      const u = new URL('https://photon.komoot.io/api/');
      u.searchParams.set('q', q);
      u.searchParams.set('limit', '15');
      u.searchParams.set('lat', String(CENTER.lat));
      u.searchParams.set('lon', String(CENTER.lon));
      u.searchParams.set('bbox', `${AREA.w},${AREA.s},${AREA.e},${AREA.n}`);
      if (lang === 'de' || lang === 'en' || lang === 'fr') u.searchParams.set('lang', lang);
      const r = await timed(fetchImpl, u, {
        headers: { 'user-agent': UA, accept: 'application/json' },
      });
      if (!r.ok) throw new Error(`photon ${r.status}`);
      return fromPhoton(await r.json());
    },
  },
  google: {
    attribution: 'Google Maps',
    // condicions de Google: no es guarda el contingut dels llocs (només es poden desar els place_id)
    cacheable: false,
    async search(q, { fetchImpl, key, lang }) {
      const r = await timed(fetchImpl, 'https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key,
          'x-goog-fieldmask':
            'places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location,places.primaryType',
        },
        body: JSON.stringify({
          textQuery: q,
          languageCode: lang === 'es' ? 'es' : 'ca',
          regionCode: 'ES',
          pageSize: 10,
          locationRestriction: {
            rectangle: {
              low: { latitude: AREA.s, longitude: AREA.w },
              high: { latitude: AREA.n, longitude: AREA.e },
            },
          },
        }),
      });
      if (!r.ok) throw new Error(`google ${r.status}`);
      return fromGoogle(await r.json());
    },
  },
};

/** memòria cau per instància (només resultats d'OSM; ODbL ho permet) */
const cache = new Map();
const CACHE_MAX = 500;
const CACHE_MS = 24 * 3600 * 1000;
/** límit de ritme per IP i instància (anti-abús; Vercel ja limita a la vora) */
const hits = new Map();
const RATE_MAX = 40;
const RATE_WINDOW_MS = 60 * 1000;

export function rateLimited(ip, now = Date.now()) {
  const k = String(ip || 'anon').slice(0, 64);
  const h = hits.get(k);
  if (!h || now - h.start > RATE_WINDOW_MS) {
    if (hits.size > 5000) hits.clear();
    hits.set(k, { start: now, n: 1 });
    return false;
  }
  h.n++;
  return h.n > RATE_MAX;
}

/** Lògica pura (testable): retorna { status, body, cacheSeconds }. */
export async function placesSearch({
  q: rawQ,
  lang,
  env = {},
  fetchImpl = fetch,
  now = Date.now(),
}) {
  const q = cleanQuery(rawQ);
  if (!q) return { status: 400, body: { error: 'q' } };
  const key =
    typeof env.GOOGLE_PLACES_API_KEY === 'string' && env.GOOGLE_PLACES_API_KEY.length > 10
      ? env.GOOGLE_PLACES_API_KEY
      : null;
  const name = key ? 'google' : 'photon';
  const prov = providers[name];
  const ck = `${name}|${lang}|${q.toLowerCase()}`;
  const hit = prov.cacheable ? cache.get(ck) : null;
  if (hit && now - hit.at < CACHE_MS) return { status: 200, body: hit.body, cacheSeconds: 86400 };
  try {
    const results = await prov.search(q, { fetchImpl, key, lang });
    const body = { source: name, attribution: prov.attribution, results };
    if (prov.cacheable) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(ck, { at: now, body });
    }
    return { status: 200, body, cacheSeconds: prov.cacheable ? 86400 : 0 };
  } catch (e) {
    // si Google falla (quota, clau), Photon com a reserva
    if (name === 'google') {
      try {
        const results = await providers.photon.search(q, { fetchImpl, lang });
        return {
          status: 200,
          body: { source: 'photon', attribution: providers.photon.attribution, results },
          cacheSeconds: 3600,
        };
      } catch {
        /* cau a l'error de sota */
      }
    }
    return {
      status: 502,
      body: {
        error: 'upstream',
        detail: e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'unavailable',
      },
    };
  }
}

export default async function handler(req, res) {
  const send = (status, body, headers = {}) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return send(405, { error: 'method' }, { allow: 'GET, HEAD' });
  // només per a la mateixa app: un altre web no la pot fer servir des del navegador dels seus usuaris
  if (req.headers['sec-fetch-site'] === 'cross-site')
    return send(403, { error: 'origin' }, { 'cache-control': 'no-store' });
  const url = new URL(req.url ?? '/', 'http://x');
  const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  if (rateLimited(ip))
    return send(429, { error: 'rate' }, { 'retry-after': '60', 'cache-control': 'no-store' });
  const lang = url.searchParams.get('lang') === 'es' ? 'es' : 'ca';
  const r = await placesSearch({ q: url.searchParams.get('q'), lang, env: process.env });
  send(r.status, r.body, {
    'cache-control':
      r.status === 200 && r.cacheSeconds
        ? `public, max-age=300, s-maxage=${r.cacheSeconds}, stale-while-revalidate=86400`
        : 'no-store',
  });
}
