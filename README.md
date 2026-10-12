# NextMobility Sabadell

**On vols anar? Quin bus agafar, quan passa i per on va.** App (web instal·lable) del bus urbà de Sabadell. **Demo independent**: les posicions dels vehicles són **simulades** a partir
dels horaris publicats; la xarxa, les parades i els horaris són dades públiques de tus.es i OpenStreetMap.

- Landing: **https://bus-sabadell.vercel.app** · App: **https://bus-sabadell.vercel.app/app** (entra o «Entra sense compte»)
- Presentació guiada (10 escenes, 2–3 min): **https://bus-sabadell.vercel.app/presentacio**
- API: https://bus-sabadell-api.vercel.app (`/v1/meta`, `/v1/vehicles`, `/v1/vehicles/stream`, `/v1/stops/:id/arrivals`…)

## Què fa (app)
Obres l'app, entres (o «Entra sense compte»), et detecta la ubicació (no surt del mòbil) i escrius **on vols anar**
—un lloc, un carrer o una parada—. Et diu la **millor opció**: **quina línia i en quina direcció, on pujar, quan
arriba el bus, on baixar** i quant dura; el mapa mostra només aquest bus i per on va. Pots seguir-lo fins que
arriba («Agafaré aquest bus»), amb avisos. Només autobusos urbans de Sabadell (TUS); res de trens ni altres operadors.

- Navegació: Inici («On vols anar?» i serveis) · Mapa · Línies · Com hi arribo · Més; a la capçalera, lector de QR,
  cerca de parades i avisos en vigor. Tarifes i punts de venda (`/tarifes`, `/punts-de-venda`); títols i targetes **de
  demostració** (no es cobra res).
- 23 línies, 105 variants, 408 parades validades ([docs/LINE_AUDIT.md](docs/LINE_AUDIT.md)); 1.680 carrers i
  ~1.350 llocs (OpenStreetMap) per buscar on vas.
- Comptes ficticis (al navegador) i «Entra sense compte». Preparat per a un servei real (`AuthProvider`).
- Funciona sense connexió i sense servidor (la simulació corre al dispositiu). PWA instal·lable.

## Estructura (per connectar-hi eines com Lovable)
- Monorepo **pnpm**. **L'app és a `apps/web`** (Vite + React + TypeScript + MapLibre + Zustand).
- `apps/web` depèn de `packages/core` (`@bus/core`, motor de simulació i planificador) via `workspace:*`:
  cal instal·lar des de l'arrel (`pnpm install`), no només dins `apps/web`.
- Build de l'app: `pnpm --filter @bus/web build` → `apps/web/dist` (estàtic). Dades: `apps/web/public/data/`.
- `apps/api` (Fastify) i `packages/data-pipeline` són opcionals per a l'app.

## Comandes
```bash
pnpm install
pnpm dev            # http://localhost:5173  (hora forçada: ?hora=08:15&dia=dimarts&x=10)
pnpm test           # core, pipeline (inclosa l'auditoria de la xarxa) i API
pnpm test:e2e       # Playwright: escriptori, iPhone 13, Android
pnpm data:build     # reconstrueix la xarxa des de data/raw
pnpm data:audit     # validació línia per línia
```
Desplegament: vegeu [CLAUDE.md](CLAUDE.md#desplegament-vercel-equip-paugc2004-4556s-projects).

## Qualitat
- 189 tests unitaris/API (`pnpm test`: auditoria de la xarxa, `/api/places`, ubicació, propietats del planificador,
  tarifes i els 33 punts de venda) + 303 e2e (`pnpm test:e2e`, escriptori, iPhone i Android; axe-core i mòbil de 320 px).
- Lighthouse mòbil (`vite preview` local, laboratori sense GPU, 2026-10-12): landing 98, `/tarifes` 93,
  `/punts-de-venda` 87–88, `/p/<codi>` 79–80; accessibilitat i bones pràctiques 100. Detall i límits de la mesura:
  [docs/AUDIT_2026-10-12.md](docs/AUDIT_2026-10-12.md).

## Documentació
[Auditoria i pla](docs/EVOLUTION_AUDIT.md) · [Resum d'implementació](docs/IMPLEMENTATION_SUMMARY.md) ·
[Proposta per a TUS](docs/PITCH.md) · [Dades i llicències](docs/DATA.md) · [Decisions](docs/PLAN.md) ·
[Auditoria final](docs/FINAL_APP_AUDIT.md) · [Cerca de llocs](docs/PLACES_SEARCH_ARCHITECTURE.md) · [Seguretat](docs/SECURITY_AUDIT.md)

## Llicències i atribucions
- Xarxa, parades i horaris: informació pública de [tus.es](https://www.tus.es). No és una aplicació oficial de TUS
  ni de l'Ajuntament; no s'usa cap API privada ni la marca de TUS.
- Mapa i carrers: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL);
  mapa base [OpenFreeMap](https://openfreemap.org) / © OpenMapTiles, alternativa © CARTO.
- Interurbans: GTFS de dades obertes de la Generalitat de Catalunya.
