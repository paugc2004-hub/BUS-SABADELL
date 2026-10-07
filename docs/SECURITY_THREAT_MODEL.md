# Model d'amenaces

Data: 2026-10-07. Abast: el repositori, la web `bus-sabadell.vercel.app` (amb la funció `/api/places`) i l'API `bus-sabadell-api.vercel.app`.
Fora de l'abast: serveis de tercers (Photon, Google, Vercel, tessel·les), que no s'han atacat.

## Actius
| Actiu | On és | Sensibilitat |
|---|---|---|
| Ubicació de l'usuari | Memòria del mòbil (Zustand) | **Alta** (dada personal) |
| Text que cerca l'usuari | Mòbil; `/api/places` → proveïdor | Mitjana (pot revelar on va) |
| Comptes ficticis (nom, correu, hash PBKDF2) | localStorage del navegador | Mitjana |
| Parades desades, preferències | localStorage | Baixa |
| Clau de Google Places (si s'activa) | Variables d'entorn del servidor (Vercel) | **Alta** (cost) |
| Credencials de desplegament de Vercel | Equip del desenvolupador (CLI) | **Alta** |
| Codi font | GitHub privat | Mitjana |
| Dades de la xarxa (`network.json`, `streets.json`) | Públiques | Baixa |

## Superfícies d'atac
1. **URL de l'app**:
   - `/ruta/<codi>` (inclou `g…` amb text en base64);
   - `/parada/<id>`, `/linia/<id>`;
   - `?next=`, `?text=` (compartir), `?hora=&dia=`;
   - `web+nextmobility:`.
2. **Camps de text**: cercador, «des d'on surts», formularis d'entrar i de registre.
3. **`GET /api/places?q=`**: funció serverless pública.
4. **API de vehicles** (`/v1/*`, SSE): pública i només de lectura.
5. **Dependències** (npm) i cadena de subministrament.
6. **Capçaleres i allotjament** (Vercel): CSP, marcs, HSTS.
7. **Dispositiu de l'usuari**: localStorage llegible per qui tingui el mòbil.

## Atacants
| Qui | Objectiu |
|---|---|
| Web maliciosa | XSS a través d'un enllaç fet a mida, *clickjacking*, redirecció oberta, fer servir `/api/places` com a intermediari gratuït |
| Bot | Abusar de `/api/places` (cost i quota del proveïdor), raspar dades |
| Persona amb el mòbil a la mà | Llegir el compte i les parades del localStorage |
| Paquet npm compromès | Executar codi al build o al navegador |
| Curiós | Llegir el codi font (mapes de codi), trobar claus |

## Amenaces → mitigació
| Amenaça | Impacte | Mitigació |
|---|---|---|
| XSS amb un nom de lloc o un text a la URL | Alt | React pinta text (sense `innerHTML`/`dangerouslySetInnerHTML`). CSP `script-src 'self'` + hash. `parseGeoCode` estricte. Prova e2e amb `<img onerror>`. |
| XSS al mapa (MapLibre) | Alt | MapLibre ≥ 6.4.1 (CVE GHSA-jrc7-96c5-q579 corregida). No es fan servir popups HTML. |
| Redirecció oberta (`?next=//evil`, `/\evil`, `https://…`) | Mitjà | Només camins interns: res de `//`, `\` ni caràcters de control. Prova e2e. |
| URL mal codificada (`%E0`) que trenca l'app | Baix (DoS al client) | `parseView` amb try/catch → inici. Prova e2e. |
| Abús de `/api/places` | Mitjà (cost, bloqueig del proveïdor) | Límit per IP (40/min per instància); `Sec-Fetch-Site: cross-site` → 403; text de 2 a 80 caràcters; memòria cau; debounce al client. Recomanat: una regla de límit de ritme al WAF de Vercel. |
| SSRF a través de `/api/places` | Alt | Els hosts de sortida són fixos (Photon, Google); el text va codificat com a paràmetre o al cos JSON. |
| Filtració de la ubicació | Alt | No surt del mòbil. `/api/places` no rep coordenades (prova e2e). No es desa. |
| Exposició de la clau de Google | Alt | Només `process.env` del servidor; mai `VITE_*`; no és al repo; el fallback no la retorna. |
| Mapes de codi públics | Baix | `sourcemap: false` en producció. |
| *Clickjacking* | Mitjà | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| Comptes ficticis al localStorage | Mitjà | PBKDF2-SHA-256 amb sal; comparació en temps constant; a la UI es diu que són de demostració. **Risc acceptat** fins que hi hagi un backend real. |
| Força bruta de contrasenyes | Baix (només local) | PBKDF2 alentit; no hi ha servidor on provar-ho. |
| Dependència vulnerable | Variable | `pnpm audit` (producció: 0), política d'antiguitat mínima de pnpm, lockfile. |
| Secrets al git | Alt | S'ha revisat l'historial: cap secret (només `.env.example` buit). |
