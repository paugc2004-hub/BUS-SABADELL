# Bus Sabadell en directe

Mapa de la xarxa de bus urbà de Sabadell (TUS) amb tots els autobusos en moviment, "la meva parada",
seguiment d'un bus i mode viatge. **Demo independent**: les posicions dels vehicles són **simulades** a partir
dels horaris publicats; la xarxa, les parades i els horaris són dades públiques de tus.es i OpenStreetMap.

- Web: **https://bus-sabadell.vercel.app**
- Presentació guiada (8 escenes, 2–3 min): **https://bus-sabadell.vercel.app/presentacio**
- API: https://bus-sabadell-api.vercel.app (`/v1/meta`, `/v1/vehicles`, `/v1/vehicles/stream`, `/v1/stops/:id/arrivals`…)

## Què fa
- 23 línies, 106 variants, 408 parades, validades una per una contra els carrers d'OSM ([docs/LINE_AUDIT.md](docs/LINE_AUDIT.md)).
- Autobús vectorial que gira amb el rumb i circula pel recorregut real, amb arrencada, crucero i frenada a cada parada.
- Línia enfocada amb el seu sentit de circulació; la resta s'atenua.
- Fitxa de bus (ara / propera / després), línia temporal parada a parada i progrés per distància.
- Panell de parada amb "a N parades"; "Vaig a agafar aquest bus" amb avisos quan el bus és a prop.
- Funciona sense connexió (PWA) i sense servidor (la simulació corre al navegador).

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
- 69 tests unitaris/API + 33 e2e, en local i contra producció.
- Lighthouse mòbil (producció, laboratori sense GPU): rendiment 70, accessibilitat 100, bones pràctiques 100,
  FCP/LCP 1,3 s. El TBT ve del WebGL per programari del laboratori.

## Documentació
[Auditoria i pla](docs/EVOLUTION_AUDIT.md) · [Resum d'implementació](docs/IMPLEMENTATION_SUMMARY.md) ·
[Proposta per a TUS](docs/PITCH.md) · [Dades i llicències](docs/DATA.md) · [Decisions](docs/PLAN.md)

## Llicències i atribucions
- Xarxa, parades i horaris: informació pública de [tus.es](https://www.tus.es). No és una aplicació oficial de TUS
  ni de l'Ajuntament; no s'usa cap API privada ni la marca de TUS.
- Mapa i carrers: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL);
  mapa base [OpenFreeMap](https://openfreemap.org) / © OpenMapTiles, alternativa © CARTO.
- Interurbans: GTFS de dades obertes de la Generalitat de Catalunya.
