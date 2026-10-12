# NextMobility Sabadell (abans «Bus Sabadell en directe») — context per a sessions futures

Demo d'un mapa de la xarxa de bus urbà de Sabadell (TUS) amb autobusos moguts per
**simulació a partir dels horaris publicats**. Objectiu: presentar-ho a TUS/Ajuntament
per aconseguir dades reals (SAE/AVL). Especificació completa: `docs/SPEC.md`. Pla: `docs/PLAN.md`.

Marca: **NextMobility Sabadell** (logo «N» de recorregut, `ui/Logo.tsx`, `public/icons/icon.svg`). Rutes: `/` landing
(pública, tema clar, no carrega ni la xarxa ni l'app: `AppMain.tsx` va en un tros a part), `/entra`, `/registre`,
`/app` inici. **Sense barrera**: qui entra a l'app sense sessió ho fa amb el compte de demostració; el compte propi és
opcional (les parades desades a la demo hi passen). **Comptes ficticis**: `auth/auth.ts` (`LocalAuthProvider`,
localStorage, PBKDF2). Per a un servei real, una altra implementació d'`AuthProvider`. Parades i viatge per usuari
(`favs:<id>`, `myBus:<id>`). Català per defecte (ES a un toc).
Landing V2 (`views/Landing.tsx`): demo animada pròpia sobre la parada Rambla i la L2 reals, etiquetada «Demostració»;
el fragment de mapa es genera amb `node apps/web/scripts/landing-map.mjs` (→ `views/landingMap.ts`). Captures: `landing-shots.mjs` (mapa), `og-image.mjs`,
`full-shots.mjs` (pàgina sencera a diverses mides), `app-shot.mjs`. Documents: `docs/LANDING_*.md`,
`docs/NEXTMOBILITY_V2_*.md`, `docs/FINAL_PRODUCT_AUDIT.md`.

**App V3** (docs/APP_UX_*.md, FINAL_APP_UX_AUDIT.md): ciutadà **clar** (`.app.citizen`, tokens al final de
`styles.css`; mapa base clar OpenFreeMap *positron*) i **NextMobility Control fosc** (`.app.control`: `/xarxa` i la
presentació; s'hi entra des del menú de l'avatar). Flux de l'app: **entrar** (o «Entra sense compte») → **ubicació** un cop
(`views/Welcome.tsx`, `nextmobility.locAsked`) → **Inici «On vols anar?»** (on ets, cerca, parades a prop) →
**resultat** (`views/Route.tsx`: *Millor opció* amb Puja a / Arriba en / Baixa a, màx. 2 alternatives, sense pas a
pas a peu; puntuació `scoreOf` a `core/plan.ts`) → bus / viatge. Mapa contextual amb pla o viatge (només aquelles
línies i busos). Navegació: Inici · Mapa · Línies · Compte. Només TUS (fora interurbans). Docs: `docs/APP_*.md`. Una acció per bus: «Agafaré aquest bus» → la fitxa es converteix en «El teu viatge»
(`TripFocus` a `views/Trip.tsx`). Estats: A l'hora · N min tard · Retard important (≥ 5 min) · Fora de servei.
Recorregut visual: `node apps/web/scripts/ux-tour.mjs <dir> 390x844 <prefix>`.

**Com hi arribo** (`/ruta/<c id carrer | p id parada>?de=…`, `views/Route.tsx`): escrius el carrer al cercador
(«On vas?»), l'origen és la teva ubicació (només al dispositiu) o el lloc que triïs; `packages/core/src/plan.ts`
(`planTrip`: a peu ≤ 1,1 km → bus → com a molt 1 transbord → a peu) sobre `engine.boardings()`, les mateixes hores
estimades que la resta de l'app; s'accedeix via `planFor` de `data/vehicles.ts`. Carrers i llocs: `public/data/streets.json`
(OSM: 1.680 carrers i ~1.350 llocs —estadis, piscines, escoles, hospitals, estacions, comerços, barris…— de Sabadell i
voltants a l'abast de la xarxa, amb municipi i barri; noms populars a `data/config/llocs-alias.yaml`, amb font) generat per `pnpm data:streets`
(`data-pipeline/src/streets.ts`, també al final de `data:build`). Es baixa la primera vegada que es cerca.

## Regles que no es negocien
- **Mai presentar una posició simulada com a real.** Ni «en directe»/«temps real» en present per a dades simulades. Banner fix, etiqueta d'origen a cada bus
  (`SIMULATED` | `SCHEDULED` | `REALTIME`) i textos que ho diuen.
- **Cap enginyeria inversa** de l'app de TUS/GeoActio ni de cap API privada. Només dades públiques
  (pàgines de línia de tus.es, OSM, GTFS de la Generalitat), descarregades rarament i citades.
- **No fer servir el logo ni la marca de TUS.** Nom propi: "NextMobility Sabadell".
- Atribució OSM i del mapa base sempre visible.

## Comandes (pnpm; a PowerShell, `pnpm.cmd` si cal)
```
pnpm install
pnpm data:build     # data/raw → apps/web/public/data/network.json + dist/gtfs + dist/report.md
pnpm data:refresh   # torna a descarregar tus.es, Overpass i GTFS (rarament!)
pnpm data:streets   # carrers d'OSM → apps/web/public/data/streets.json (planificador)
pnpm data:audit     # validació línia per línia → docs/LINE_AUDIT.md (falla si hi ha errors)
# mesures: node apps/web/scripts/perf-probe.mjs <url> 20 [desktop|mobile] · node apps/web/scripts/lighthouse.mjs <url>
pnpm dev            # web a http://localhost:5173
pnpm dev:api        # API a http://localhost:8787
pnpm test           # vitest (core, pipeline, api)
pnpm typecheck && pnpm lint
pnpm test:e2e       # Playwright (apps/web)
# Claude Code web: Chromium preinstal·lat d'una altra versió → PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e
bash apps/web/scripts/zap-baseline.sh   # OWASP ZAP passiu contra `vite preview` (cal Docker amb dimoni)
```
Qualitat: `e2e/quality.spec.ts` (axe-core WCAG 2.1 AA, 320 px sense desbordar, errors i càrrega de la cerca, GPS esgotat),
`location/location.test.ts` (LocationService amb GPS fals), `core/test/plan-network.test.ts` (propietats del planificador
sobre la xarxa real, fast-check amb llavor fixa).
Skills de Claude Code al repo (`.claude/skills/`): `ui-ux-pro-max` (CLI oficial `uipro init --ai claude`, només aquesta),
`vercel-react-best-practices` i `web-design-guidelines` (`npx skills add vercel-labs/agent-skills --copy`, `skills-lock.json`);
plugin `frontend-design@claude-code-plugins` declarat a `.claude/settings.json`.

## Estructura
- `packages/core` — tipus, geo, temps (Europe/Madrid), **motor de simulació determinista** (`sim/engine.ts`),
  proveïdors intercanviables (`providers/provider.ts`). S'executa igual al navegador i al servidor.
- `packages/data-pipeline` — `src/build.ts` orquestra; `trips.ts` reconstrueix expedicions de les hores per parada;
  `geometry.ts` treu les punxes de tus.es i projecta parades; `repair.ts` (sentits per geometria, circulars,
  trams fora de carrer amb donant); `audit.ts` (validació contra carrers i rutes d'OSM); `osm.ts`; `gtfs.ts`; `interurbans.ts`.
- `packages/core/src/vehicle.ts` — **única font de veritat** del que es deriva d'un bus (progrés, "a N parades",
  línia temporal). No calcular ETA ni progrés a la UI: sortir d'aquí o d'`engine.journey()`.
- `apps/web` — Vite + React + MapLibre. Simula al client per defecte (funciona sense backend).
  Vistes: Inici (`views/Home.tsx`), Mapa, Línies (`views/Lines.tsx`), Xarxa (`views/Network.tsx`), Els meus;
  a sobre: StopPanel, BusCard, StopTimeline, Trip, Presentation. `map/MapView.tsx` (capes, enfocament, seguiment),
  `ui/BusVehicleMarker.tsx`, `ui/common.tsx` (Punctuality, chips).
  **Dades en directe només via `data/vehicles.ts`** (vehiclesAt, vehicleById, arrivalsAt, journeyFor): cap vista
  crida el motor directament. `data/derive.ts` (zones de parada, llegades amb vehicle), `data/search.ts`.
  Estils: escala tipogràfica `--fs-*` (32/24/18/16/14/12), radis `--r-*`; res de `backdrop-filter` ni animacions
  de box-shadow (costen fps sobre el mapa; mesurat).
- `apps/web/scripts/` — utilitats locals: `shot.mjs` (captures), `demo-run.mjs` (recorre la presentació),
  `lighthouse.mjs`, `soak.mjs`, `offline-check.mjs`, `icons.mjs`, **`deploy.sh`**.
- `apps/api` — Fastify: red, snapshot, SSE, llegades, `GtfsRtProvider`.
- `data/raw` — extractes fetxats (l'HTML de tus.es i el ZIP GTFS no es versionen; els JSON extrets sí).
- `data/config` — `festius.yaml`, `avisos.yaml`, `overrides.yaml` (editats a mà, validats amb zod).

## Licitació 2024 (OTU/2024/113, web de TUS) — 2026-10-11
Pàgines **públiques sense sessió** (`views/Public.tsx`, tros a part, sense mapa): `/p/<codi>` fitxa de parada (destí
dels QR), `/qr[/<codi>]` generador de QR (`data/qr.ts`, al dispositiu), `/horari/<línia>` freqüències i horari per
parada imprimibles, `/privacitat` `/avis-legal` `/galetes`. Core: `timetable.ts` (horari teòric = hora d'horari del
motor), `alerts.ts` (avisos per publicació/expiració; mai mostrar `network.alerts` sense filtrar), `planArriveBy`.
Traçabilitat i decisions: `docs/LICITACIO_2024_*.md`, `docs/SUPER_MASTER_PROMPT_LICITACIO_2024.md`.
`/tarifes` i `/punts-de-venda` (`views/Fares.tsx`, `data/fares.ts`, `data/salesPoints.ts`): preus amb `verified: false`
(«a confirmar»), 33 punts sense coordenades, «obert ara» en hora de Sabadell amb estat *a confirmar*. `docs/TARIFES_PUNTS_DE_VENDA.md`.
Revisió de producte: el planificador no proposa cap bus que faci caminar més que anar-hi a peu («A peu» com a millor
opció); al mòbil el viatge actiu és una barra plegada a baix (`.has-trip`); la navegació tanca la fitxa del bus.
Regressions: `e2e/product.spec.ts`.

## Paritat amb l'app oficial de TUS (2026-10-12)
Mateixa arquitectura d'informació que «TUS Sabadell» 3.2.4 (GeoActio), disseny propi i cap marca aliena
(`data/brand.test.ts`). Matriu: `docs/TUS_PARITY.md`; guió de la reunió: `docs/REUNIO_TUS_GUIA.md`.
- **Navegació**: barra Inici · Mapa · Línies · Com hi arribo · Més (`views/Chrome.tsx`); capçalera amb QR (`/qr-lector`),
  lupa (`/cerca`) i avisos amb el número dels **en vigor** (`/avisos`). Inici = «On vols anar?» + les 5 targetes de
  la portada de TUS (`ServicesHub` a `views/Home.tsx`). Pàgines a sobre del mapa: `PAGE_VIEWS` a `state/store.ts`.
- **Títols i targetes de DEMOSTRACIÓ** (`wallet/wallet.ts`, `views/Tickets.tsx`, tros a part): cap camp de pagament,
  «Simular pagament (demo · no es cobra res)», Bizum desactivat i sense logo, QR `NM-DEMO:`, marca d'aigua, dades a
  `wallet:<userId>`. Cap lectura NFC. Per a un servei real, un altre `TicketingProvider`/`CardProvider`.
- **Avisos** (`data/config/avisos.yaml`): títol, text, `des_de`/`fins_a` en hora local («AAAA-MM-DD HH:MM», `localIso`).
- **F6**: només festius comercials (`festius.yaml › comercials`, `overrides.yaml › nomes_festius_comercials`,
  `Route.onlyDates`; al motor, `tablesFor(date)`, `runsOnDate`, `runsAt`). A la UI, «circula avui» = `engine.runsAt`.
- Compte (`views/Mine.tsx`): informació, perfil, FAQ, contrasenya, configuració (accessibilitat `ui/a11y.ts`), elimina.
- Captures: `node apps/web/scripts/parity-shots.mjs <dir> 390x844 "/app=inici" …` (contra `vite preview`).
- Pendents: URL exacta de cada avís (`TODO(DECISION: URL-AVISOS)`), festius comercials 2027, capa de punts de venda.
- Auditoria del 2026-10-12: `docs/AUDIT_2026-10-12.md`. Responsive: `node apps/web/scripts/responsive-audit.mjs` (7 amples,
  21 rutes). `SimClock`/`forcedInstant` són a `core/src/clock.ts` sense luxon (la landing no el baixa); `sideEffects: false`.

## Ubicació i cerca de destins (2026-10-07)
- **Ubicació**: només `apps/web/src/location/location.ts` (LocationService) crida `navigator.geolocation`. Estats:
  `locating/ok/denied/timeout/unavailable/unsupported`. UI: `views/LocationStatus.tsx`. Mai es desa ni s'envia.
- **Cerca universal**: `data/places.ts` (client: debounce 350 ms, mínim 3 lletres, cancel·lació, ordre per proximitat
  al mòbil) + `apps/web/api/places.mjs` (funció serverless del mateix origen: Photon per defecte; Google Places si hi
  ha `GOOGLE_PLACES_API_KEY` a l'entorn del **servidor** de Vercel). El servidor només rep el text, mai la ubicació.
  Destí a la ruta: `/ruta/g<lon>,<lat>,<base64url([nom,zona])>` (validat per `parseGeoCode`).
- `deploy.sh` copia `api/places.mjs` a `dist-deploy/api/` (sense els tests). En local, `vite` i `vite preview` la serveixen.
- e2e: `/api/places` es simula amb `page.route` i `serviceWorkers: 'block'` (si no, el SW se la salta).
- Seguretat: `docs/SECURITY_AUDIT.md`, `SECURITY_THREAT_MODEL.md`, `SECURITY_HARDENING.md`. Sense mapes de codi en producció.
- Dependències: respectar la política d'antiguitat mínima de pnpm (no afegir `minimumReleaseAgeExclude`).

## Decisions clau
- Font principal de la xarxa i horaris: **pàgines públiques de línia de tus.es** (JSON `trayectos` incrustat:
  recorregut, parades i hores de pas). Cobreix les 23 línies; OSM només en té 13. OSM s'usa com a contrast.
- Hores al minut → corba suau dins la finestra de cada minut (si no, tots els buses paren alhora al segon :00).
- Dia de servei amb origen "migdia − 12 h" (GTFS) → canvis d'hora i hores > 24:00 correctes.
- Torns: encadenament FIFO d'expedicions de la mateixa línia a la mateixa capçalera. Etiqueta `L1·03` (no és un número de flota).
- `TODO(DECISION: FESTIUS-LOCALS-2027)`: falten les festes locals de Sabadell de 2027.
- Les polilínies de tus.es van i tornen fins al pal de cada parada (~1.700 punxes): `despike` les treu. Si una
  parada queda lluny o un tram surt del carrer, `repairSegments` agafa el tram d'una altra variant que fa el
  mateix parell de parades; si no n'hi ha, no s'inventa res i l'auditoria falla.
- Retards **simulats**, deterministes (data + expedició), acotats [−90 s, +9 min] i propagats en capçalera;
  sempre etiquetats com a simulats. `new SimEngine(net, { delays: false })` per a horari exacte (tests).
  `DESVIADO` només d'un proveïdor real.
- Sentits únics: `oneway.ts`; una variant a contrasentit > 40 m sense donant s'exclou (`overrides.yaml`).

## Desplegament (Vercel, equip paugc2004-4556s-projects)
- Web: **https://bus-sabadell.vercel.app** → `bash apps/web/scripts/deploy.sh` (fixa el projecte `bus-sabadell`;
  no fer `vercel deploy` a pèl dins `dist-deploy`, que crea un projecte nou).
- API: **https://bus-sabadell-api.vercel.app** → `node apps/api/scripts/bundle-vercel.mjs` i
  `vercel deploy --prod --yes` dins `apps/api/.vercel-deploy` (projecte `bus-sabadell-api`).
- Després de desplegar: `BASE_URL=https://bus-sabadell.vercel.app npx playwright test` (apps/web). Ves amb compte:
  massa peticions automàtiques seguides fan que el tallafoc de Vercel respongui 403 («punt de control») durant una estona.
- Els e2e locals fan servir `vite preview` de `dist/`: fes `npm run build` abans.
- Lighthouse (mòbil, laboratori sense GPU): rendiment ~70 pel WebGL per programari (TBT), accessibilitat 100,
  bones pràctiques 100. Amb GPU real va millor; no és representatiu d'un mòbil.

## Documents
`docs/EVOLUTION_AUDIT.md` (auditoria i pla), `docs/LINE_AUDIT.md` (generat), `docs/IMPLEMENTATION_SUMMARY.md`,
`docs/PITCH.md` (per a TUS), `docs/DATA.md`, `docs/PLAN.md`, `docs/SPEC.md`. Fase ubicació + cerca universal:
`docs/FINAL_APP_AUDIT.md`, `GEOLOCATION_*`, `PLACES_*`, `TRANSIT_ROUTING.md`, `SECURITY_*`.
