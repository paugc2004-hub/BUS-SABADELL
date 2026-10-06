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
  `geometry.ts` projecta parades; `osm.ts` contrast amb OSM; `gtfs.ts`; `interurbans.ts`.
- `apps/web` — Vite + React + MapLibre. Simula al client per defecte (funciona sense backend).
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
