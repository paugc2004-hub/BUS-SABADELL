# NextMobility Sabadell — Auditoria V2 (fase 1, abans de tocar codi)

Data: 2026-10-07 · Estat auditat: commit `2a800c8` (producció https://bus-sabadell.vercel.app).
Mètode: lectura del codi (rutes, store, vistes, estils, i18n, core, pipeline), recorregut a 390×844 i 1440×900,
Lighthouse mòbil de la landing en producció.

Prioritats: **P0** bloqueja la proposta de valor · **P1** la fa molt millor · **P2** polit · **P3** opcional.

## 1. Arquitectura (es manté)

| Peça | Estat | Decisió |
|---|---|---|
| Monorepo pnpm: `core` (SimEngine, `vehicle.ts`, proveïdors), `data-pipeline`, `web`, `api` | Sòlid, testat (78 unitàries, 51 e2e) | No es toca |
| `data/vehicles.ts` com a única porta a les dades en directe | Correcte | La landing **no** carrega la xarxa (ha de seguir així) |
| `SimulatedProvider → GtfsRtProvider/TusSaeProvider` | Preparat | Només canvia com s'explica |
| Routing propi (`parseView`/`viewPath`) a `store.ts` | Simple i suficient | Es reutilitza |
| Auth ficticia `AuthProvider` + `LocalAuthProvider` | Correcte | Es manté, però deixa de ser una barrera |

Sense deute que justifiqui reescriure res.

## 2. Landing (`/`)

| # | Problema | Prioritat |
|---|---|---|
| L1 | El hero ven **la xarxa**, no **el meu bus**: H1 «El teu bus, en directe» + captura d'un mapa ple de línies. En 5 s s'entén «mapa de busos», no «sé quan arriba». | P0 |
| L2 | La crida principal és **«Crea un compte»** (nav) / «Comença ara» → `/registre`. Ven un compte, no la utilitat. | P0 |
| L3 | Les xifres (23 · 105 · 408 · «0 comptes de pagament») són protagonistes just després del hero. Interessen a un tècnic, no al ciutadà. | P0 |
| L4 | «en directe» al titular, a l'OG i al `<title>` amb posicions simulades: no és fals (ho diu a sota) però és ambigu. | P0 |
| L5 | Les 4 seccions són «captura + text» alternades: correcte però genèric; no demostra el producte, l'il·lustra. | P1 |
| L6 | Estètica de «centre de control» fosc amb degradats ambre: més dashboard que producte de ciutat. | P1 |
| L7 | LCP **5,4 s** en mòbil (Lighthouse prod., rendiment 79): el hero són dues JPG grans (~700 KB). | P1 |
| L8 | «Per a TUS i l'Ajuntament» a la navegació principal i caixa d'instal·lació PWA: soroll per al ciutadà. | P1 |
| L9 | No hi ha via de contacte institucional. | P1 |
| L10 | Idioma: amb el navegador en castellà la landing surt en castellà; el producte és en català. | P2 |
| L11 | No hi ha secció «Com funciona» en 3 passos (l'enllaç «Com funciona» porta a les captures). | P1 |

## 3. App (`/app` i vistes)

| # | Problema | Prioritat |
|---|---|---|
| A1 | **Login obligatori**: qualsevol ruta de l'app sense sessió → `/entra`. Per a una demo comercial és una barrera abans de veure el valor. | P0 |
| A2 | Inici: «El teu proper bus» sí és la peça dominant (bé). Però el comptador `00:23` (mm:ss) al costat de «Ara» confon, i no es distingeix hora **programada** vs **prevista**. | P0 |
| A3 | Inici: els xips de parades suggerides desborden en horitzontal i es solapen amb el text d'ajuda (390 px). | P0 |
| A4 | «La meva parada» sense parades desades: només xips; no explica per què desar-ne una. | P1 |
| A5 | El compte no es justifica per utilitat: no hi ha cap «Desa la teva parada» → compte. | P1 |
| A6 | Línia: panell + mapa i línia temporal vertical amb buses (ja resolt a la iteració 2). Bé. | — |
| A7 | Presentació: escena 1 «Tota la xarxa TUS, en directe» i escena 10 «Amb el SAE de TUS» sonen oficials / a integració feta. | P0 (honestedat) |
| A8 | Banner d'honestedat fix, etiqueta d'origen a cada bus, «Què és real?»: correcte, es manté. | — |

## 4. Mapa i buses

- `BusVehicleMarker` / `map/icons.ts`: silueta vectorial de bus amb color de línia, codi i rumb (no és un punt). Bé.
- Línia destacada amb la resta atenuada, seguiment, panell de parada: bé.
- Densitat d'etiquetes a zoom baix: ja es redueix per zoom. Sense canvis (no rehacer per gust).
- Al panell del navegador intern sense WebGL el mapa no es pinta; amb Playwright/SwiftShader i en dispositius sí.

## 5. Dades i simulació

- `pnpm data:audit`: 105 variants, 0 errors, 9 avisos (estat de partida). No es toquen dades.
- Simulació determinista amb acceleració/frenada, parades, retards simulats acotats: es manté.

## 6. Responsive, accessibilitat, rendiment

- Landing a 390 px: hero correcte però la visual (navegador + mòbil) queda petita i sense lectura.
- Accessibilitat Lighthouse 100 a landing i app. Rendiment app en prod.: 59–60 fps (mesurat a la iteració 2).

## 7. Copy i marca

- Catalan correcte però amb to «de producte tècnic» («recorreguts validats», «Tota la xarxa, ben feta»).
- Marca NextMobility («N» de recorregut + punt ambre) és pròpia i neta: es manté. El que canvia és l'entorn
  de la landing (clar, urbà) i l'ambre passa a ser només el color del «bus», no un degradat decoratiu.
- Cap ús del logo de TUS. «TUS» apareix com a font de dades i en la secció institucional: correcte.

## 8. Pla derivat

P0 → hero nou centrat en «quan arriba el meu bus» amb demo animada pròpia, crida «Prova-ho ara» que entra
sense registre, xifres fora del protagonisme, honestedat del titular, inici de l'app (programat/previst,
desbordament), presentació sense to oficial.
P1 → seccions que demostren producte (UI real en HTML, no captures), «La meva parada», contacte institucional,
landing clara, compte justificat per «desar parada».
P2 → SEO/OG, idioma per defecte català. P3 → domini propi (decisió de l'usuari).
