# App — auditoria de producte (fase 1)

Data: 2026-10-07. Estat de partida: commit `5674d4b` (inici «On vols anar?», planificador, mode viatge, tema clar).

## Què es reaprofita (funciona i està ben separat)
| Peça | On | Per què es manté |
|---|---|---|
| Motor de simulació (geometria real, acceleració/frenada, parades, retards acotats) | `packages/core/src/sim/engine.ts` | Els busos no es teletransporten; ETA coherents |
| Model únic del vehicle (posició, rumb, propera parada, ETA, retard) | `packages/core/src/vehicle.ts` | La UI no calcula res pel seu compte |
| Proveïdors intercanviables (`SimulatedProvider` → `GtfsRtProvider` / futur SAE) | `packages/core/src/providers/` | Canviar simulació per dades reals sense tocar pantalles |
| Porta única de dades a la web | `apps/web/src/data/vehicles.ts` (`vehiclesAt`, `arrivalsAt`, `journeyFor`, `planFor`) | Separació dades/UI |
| Planificador (a peu → bus → ≤1 transbord → a peu) sobre `engine.boardings()` | `packages/core/src/plan.ts` | Ja respon «quin bus agafo» |
| Índex de carrers i ~1.350 llocs (OSM) amb municipi i barri | `apps/web/public/data/streets.json`, `data/streets.ts` | Cerca «Hospital Taulí», «camp del Mercantil»… |
| Bus vectorial al mapa amb codi i rumb | `map/icons.ts`, `ui/BusVehicleMarker.tsx` | És un bus, no un punt |
| Mode viatge i avisos («a 2 parades», «la propera és la teva») | `views/Trip.tsx` (`TripMonitor`, `TripFocus`) | Base per a notificacions |
| Comptes (ficticis) amb `AuthProvider` intercanviable | `auth/auth.ts` | Registre/entrada mínims |
| PWA (manifest, icones, offline, standalone) | `vite.config.ts`, `public/icons` | App instal·lable |

## Problemes de producte (abans d'aquesta fase)
1. **L'app no demana entrar**: s'hi entra amb el compte de demostració automàticament → no és el flux d'una app descarregada (obrir → entrar → ubicació → inici).
2. **No hi ha pas de permís d'ubicació**: es demana sense context des de l'inici.
3. **El resultat de ruta és un pas a pas a peu** («Camina 712 m fins a…») i hi apareix «A peu · 23 min»: l'app fa de Google Maps en lloc de dir **on pujo, on baixo i quan passa**.
4. **«Millor opció» no existeix**: les opcions s'ordenen per hora d'arribada i se'n mostren fins a 4.
5. **El mapa de la ruta i del viatge mostra tota la xarxa** (80 busos, 23 línies) encara que només interessi un bus.
6. **Interurbans** (altres operadors, GTFS Generalitat) es poden activar al mapa: fora de l'abast «només TUS».
7. **Navegació**: Inici · Mapa · Línies; el compte només és al menú de l'avatar.

## Dades de línies (verificació)
- 23 línies (16 de feiners/dissabtes + 7 festives F), 105 variants, 408 parades; `pnpm data:audit`: 0 errors, 9 avisos
  (punxes < 40 m i 20 m a contrasentit en 3 variants festives).
- **Variants i sentits**: cada línia té sentit d'anada i tornada (`dir` 0/1) excepte les circulars L15 i F15 (un sol
  sentit, destinació «Centre»). Hi ha variants parcials reals: L1 La Concòrdia → Picasso (19 parades), L2 → Pl. Espanya,
  L8 → Pl. Catalunya, L11 Espanya ↔ Mancomunitat, L14 Estació Centre → Parc Taulí (5 parades), L7 «per T. del Capellà»,
  L12 «per BMC». **Per això la direcció que es mostra al resultat surt de la variant concreta** (`pattern.headsign`), no
  del nom de la línia.
- L44 i L23 només circulen feiners; les F, només festius (el planificador ja ho respecta: fa servir les expedicions del dia).
- Incoherències de la font (tus.es), **no corregides a les dades** (es documenten): «Torre-Romeu» / «Torre Romeu»
  (L23), «Can Llong -Les Termes» (sense espai, L55), «Picasso» / «Plaça de Picasso».
