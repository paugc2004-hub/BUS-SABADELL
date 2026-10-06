# Bus Sabadell en directe — context per a sessions futures

Demo d'un mapa de la xarxa de bus urbà de Sabadell (TUS) amb autobusos moguts per
**simulació a partir dels horaris publicats**. Objectiu: presentar-ho a TUS/Ajuntament
per aconseguir dades reals (SAE/AVL). Especificació completa: `docs/SPEC.md`. Pla: `docs/PLAN.md`.

## Regles que no es negocien
- **Mai presentar una posició simulada com a real.** Banner fix, etiqueta d'origen a cada bus
  (`SIMULATED` | `SCHEDULED` | `REALTIME`) i textos que ho diuen.
- **Cap enginyeria inversa** de l'app de TUS/GeoActio ni de cap API privada. Només dades públiques
  (pàgines de línia de tus.es, OSM, GTFS de la Generalitat), descarregades rarament i citades.
- **No fer servir el logo ni la marca de TUS.** Nom propi: "Bus Sabadell en directe".
- Atribució OSM i del mapa base sempre visible.

## Comandes (pnpm; a PowerShell, `pnpm.cmd` si cal)
```
pnpm install
pnpm data:build     # data/raw → apps/web/public/data/network.json + dist/gtfs + dist/report.md
pnpm data:refresh   # torna a descarregar tus.es, Overpass i GTFS (rarament!)
pnpm data:audit     # validació línia per línia → docs/LINE_AUDIT.md (falla si hi ha errors)
# mesures: node apps/web/scripts/perf-probe.mjs <url> 20 [desktop|mobile] · node apps/web/scripts/lighthouse.mjs <url>
pnpm dev            # web a http://localhost:5173
pnpm dev:api        # API a http://localhost:8787
pnpm test           # vitest (core, pipeline, api)
pnpm typecheck && pnpm lint
pnpm test:e2e       # Playwright (apps/web)
```

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
- Després de desplegar: `BASE_URL=https://bus-sabadell.vercel.app npx playwright test` (apps/web).
- Lighthouse (mòbil, laboratori sense GPU): rendiment ~70 pel WebGL per programari (TBT), accessibilitat 100,
  bones pràctiques 100. Amb GPU real va millor; no és representatiu d'un mòbil.

## Documents
`docs/EVOLUTION_AUDIT.md` (auditoria i pla), `docs/LINE_AUDIT.md` (generat), `docs/IMPLEMENTATION_SUMMARY.md`,
`docs/PITCH.md` (per a TUS), `docs/DATA.md`, `docs/PLAN.md`, `docs/SPEC.md`.
