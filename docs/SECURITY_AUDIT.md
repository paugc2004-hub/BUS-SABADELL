# Auditoria de seguretat

Data: 2026-10-07. Mètode: auditar → atacar → corregir → provar → tornar a atacar (el projecte propi, el desplegament propi i res de serveis de tercers).
Model d'amenaces: `SECURITY_THREAT_MODEL.md`. Mesures aplicades: `SECURITY_HARDENING.md`.

## Troballes
| # | Vulnerabilitat | Severitat | Estat | Solució |
|---|---|---|---|---|
| 1 | `maplibre-gl` 5.24 · XSS: es pot saltar el sanejador `DOM.sanitize()` (GHSA-jrc7-96c5-q579). Al codi no s'usen popups HTML, però el paquet vulnerable s'executava al navegador | Critical (dependència) | **Fixed** | MapLibre 6.11.2 (també compleix la política d'antiguitat mínima de pnpm). Import adaptat a la v6. `pnpm audit --prod`: 0 vulnerabilitats |
| 2 | Mapes de codi (`.map`) publicats en producció: el codi font d'un repo privat es podia llegir sencer | Medium | **Fixed** | `build.sourcemap: false`. Comprovat que `dist-deploy` no té cap `.map` |
| 3 | `?next=/\evil.example` després d'entrar: el navegador ho llegeix com a `//evil.example` i `history.replaceState` llançava una excepció; el login es quedava penjat. Cap redirecció real, però sí un DoS del flux | Low | **Fixed** | Només camins interns: rebutja `//`, `\`, caràcters de control i textos de més de 300 caràcters. e2e: `/\…`, `//…` i `https://…` (×3 aparells) |
| 4 | URL mal codificada (`/ruta/%E0%A4%A`): `decodeURIComponent` llançava `URIError` i l'app es trencava | Low | **Fixed** | `parseView` amb try/catch → l'inici. e2e |
| 5 | Nova superfície `/api/places`: abús com a intermediari gratuït (cost/quota del proveïdor) | Medium | **Mitigated** | Límit per IP (40/min per instància), 403 si `Sec-Fetch-Site: cross-site`, només GET/HEAD, text de 2 a 80 caràcters i net, memòria cau, debounce i mínim de 3 lletres al client. **Residual**: el límit és per instància. Recomanat: una regla de límit de ritme al WAF de Vercel |
| 6 | SSRF a través de `/api/places` | High (si existís) | **Not vulnerable** | Hosts de sortida fixos. `q` va com a paràmetre codificat (`URLSearchParams`) o dins el JSON. Temps màxim 7 s |
| 7 | Injecció o XSS amb el nom d'un lloc (`/ruta/g…` en base64 fet a mida, o la resposta del proveïdor) | High (si existís) | **Not vulnerable** | React pinta text. `parseGeoCode` valida el format, la zona, el tipus i la longitud. Els resultats del proveïdor es normalitzen al servidor (text truncat, coordenades numèriques, dins la zona). e2e amb `<img src=x onerror=…>`: es mostra com a text, 0 `<img>` |
| 8 | Filtració de la ubicació al servidor de llocs | High (si existís) | **Not vulnerable** | El client només envia `q` i `lang`, amb `credentials: 'omit'` i `no-referrer`. L'e2e comprova que les peticions no porten `lat`/`lon`. El proveïdor no veu la IP de l'usuari |
| 9 | Exposició d'una clau d'API | High (si existís) | **Not vulnerable** | La clau de Google (opcional) és només a `process.env` del servidor; no és al repo ni en cap `VITE_*`. Historial de git revisat: cap secret |
| 10 | Errors interns retornats al client | Low | **Not vulnerable** | `/api/places` respon `{error:'upstream', detail:'timeout'\|'unavailable'}`, sense traça ni estat del proveïdor. Test unitari |
| 11 | Comptes ficticis al localStorage (nom, correu, hash PBKDF2-SHA-256 amb sal) | Medium | **Accepted (demo)** | Ho diu la UI. Comparació en temps constant, PBKDF2 alentit, sense enumeració per temps (hash de mostra). Per a producció cal un backend d'autenticació real (`AuthProvider`) |
| 12 | Capçaleres: faltaven COOP, HSTS preload, i Permissions-Policy més estricta | Low | **Fixed** | `Cross-Origin-Opener-Policy: same-origin`, `HSTS max-age=63072000; includeSubDomains; preload`, `payment=() usb=() browsing-topics=()` |
| 13 | CSP `style-src 'unsafe-inline'` | Low | **Accepted** | Fan falta els estils en línia de React (colors de línia) i de MapLibre. `script-src` es manté sense `unsafe-inline` (hash per a l'únic script en línia) |
| 14 | Dependències de desenvolupament vulnerables (vitest/tinypool; lighthouse → puppeteer → extract-zip, basic-ftp, opentelemetry) | Critical/High (dev) | **Accepted** | No van a producció ni s'exposen a la xarxa (no es fa servir el *Vitest UI*). vite 6.4.4 i vitest 3.2.7 ja actualitzats. Pendent: vitest 4 i treure lighthouse si no s'usa |
| 15 | Rànquings massius o raspat de la xarxa (`/v1/*`, `network.json`) | Low | **Accepted** | Dades públiques de TUS. L'API té rate limit (300/min), CORS restringit, helmet i Zod |
| 16 | Logs de Vercel: guarden l'URL de `/api/places` (amb el text cercat, no la ubicació) | Low | **Accepted** | Documentat. La funció no escriu logs propis |

## Atacs provats (i resultat després de les correccions)
- `GET /api/places` en producció:
  - `q=x` → 400;
  - `POST` → 405;
  - `Sec-Fetch-Site: cross-site` → 403;
  - `q` amb `<script>` i caràcters de control → netejat (test unitari);
  - proveïdor que falla → 502 genèric;
  - Google amb una clau dolenta → torna a Photon (test).
- `/ruta/g2.1,41.5,%3Cscript%3E` → «—». Un nom fals amb HTML es mostra com a text. `/ruta/%E0%A4%A` → l'inici.
- `?next=` amb `/\host`, `//host` i `https://host` → `/app` del mateix origen.
- Capçaleres en producció: CSP, HSTS, XFO, COOP, Permissions-Policy i nosniff presents (comprovat amb `curl -I`).
- `.map` en producció: no n'hi ha.
- Secrets: cerca amb expressions regulars a `git log -p --all` (claus d'API, `AIza…`, `sk-…`, `ghp_…`, claus privades) → res. Fitxers `.env`, `.pem` o `keystore` versionats → només `.env.example` (buit).

## Pendent (recomanat)
1. Regla de límit de ritme per a `/api/places` al **Vercel Firewall** (per exemple, 60/min per IP).
2. Si s'activa Google Places: **límit de pressupost** i alertes a Google Cloud, i clau restringida a l'API Places.
3. Autenticació real al servidor abans de tenir usuaris reals.
4. Treure `lighthouse` de les dependències de desenvolupament si ja no es fa servir; passar a vitest 4.
