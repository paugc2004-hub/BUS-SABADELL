# Enduriment (hardening) aplicat

## Web (Vercel · `apps/web/vercel.json`)
| Capçalera | Valor |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'sha256-…'` (sense `unsafe-inline` ni `eval`); `connect-src 'self'` + tessel·les + `https://bus-sabadell-api.vercel.app` (cap comodí `*.vercel.app` des del 2026-10-12; test `securityConfig.test.ts`); `frame-ancestors 'none'; base-uri 'self'; form-action 'none'` |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` (web) · `no-referrer` (`/api/places`) |
| Permissions-Policy | `geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()` |
| Cross-Origin-Opener-Policy | `same-origin` |

- Si canvia l'script en línia d'`index.html`, cal actualitzar-ne el hash a la CSP.
- La reescriptura SPA exclou `/api/` (`/((?!api/).*)`). El service worker no desa `/api/` a la memòria cau ni hi fa *fallback* de navegació.
- Producció sense mapes de codi.

## `/api/places` (`apps/web/api/places.mjs`)
- Només `GET`/`HEAD`. `Sec-Fetch-Site: cross-site` → 403.
- `q`: sense caràcters de control ni `<>`, espais normalitzats, de 2 a 80 caràcters.
- Límit per IP: 40/min per instància (`x-real-ip` de Vercel). Només frena un client; qui reparteix peticions entre
  IP o crida sense navegador (sense `Sec-Fetch-Site`) no queda limitat aquí.
- Pressupost de Google per instància: `GOOGLE_PLACES_MAX_PER_MIN` (per defecte 60); passat, respon Photon fins al
  minut següent. Limita el cost per instància, no el global: el límit global s'ha de posar a la quota de la clau
  (Google Cloud) i a una regla de *rate limit* del Firewall de Vercel per a `/api/places` (configuració fora del repositori).
- Proveïdors amb host fix (sense SSRF), temps màxim de 7 s, resposta normalitzada:
  - textos truncats;
  - coordenades numèriques i dins la zona;
  - id prefixat.
- Errors genèrics (`upstream`) sense detalls interns.
- Memòria cau només per a OSM (ODbL); `no-store` per a Google.
- Clau de Google només a l'entorn del servidor. Si falla, Photon.

## Client
- Res d'`innerHTML`, `eval` ni `new Function` (revisat amb grep). Un sol `dangerouslySetInnerHTML`: el QR de
  validació dels títols de demo (`views/Tickets.tsx`), SVG generat al dispositiu amb `qrcode-generator` a partir
  d'un text propi (`NM-DEMO:`…), sense entrada de l'usuari en brut.
- Entrades de l'URL validades:
  - `parseView` (try/catch);
  - `parseGeoCode` (format, zona, tipus, longitud);
  - `goNext` (només camins interns);
  - `?text=` (≤ 80 caràcters, es mostra com a valor d'un input).
- Ubicació: només a la memòria; mai a l'emmagatzematge, al servidor ni als logs.
- Peticions al cercador: `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, només `q` i `lang`.

## Dependències i cadena de subministrament
- `pnpm audit --prod`: 0 vulnerabilitats (MapLibre 6.11.2).
- Política d'antiguitat mínima de pnpm respectada: no s'ha afegit cap excepció. El lockfile s'ha regenerat des de la versió bona.
- `allowBuilds` limitat (`esbuild` sí, `protobufjs` no).

## API de vehicles (`apps/api`, sense canvis en aquesta fase)
helmet (CSP `default-src 'none'`), CORS només per a l'origen de la web, només GET, rate limit de 300/min, Zod als paràmetres i logs sense capçaleres sensibles.
