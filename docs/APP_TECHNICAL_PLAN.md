# App — pla tècnic

## Capes (per a qui entri al repositori, persona o agent)
```
Dades           apps/web/public/data/network.json (xarxa) · streets.json (carrers i llocs)
                  ← packages/data-pipeline (pnpm data:build / data:streets)
Proveïdor       packages/core/src/providers  (SimulatedProvider avui; GtfsRtProvider / SAE demà)
Motor           packages/core/src/sim/engine.ts  (vehicles, ETA, boardings) · vehicle.ts (model únic)
Planificador    packages/core/src/plan.ts  (planTrip: opcions + puntuació «millor opció»)
Serveis web     apps/web/src/data/vehicles.ts  (vehiclesAt, arrivalsAt, journeyFor, planFor) · data/streets.ts (cerca)
Estat           apps/web/src/state/store.ts  (Zustand: vista, sessió, bus triat, viatge, pla del mapa)
Rutes           store.parseView / viewPath (sense router extern)
Components      apps/web/src/ui/*  (RouteChip, Punctuality, BusVehicleMarker, Sheet…)
Pantalles       apps/web/src/views/*  (Home, Route, StopPanel, BusCard, Trip, Lines, Mine, Auth…)
Mapa            apps/web/src/map/MapView.tsx  (capes; mapa contextual quan hi ha pla o viatge)
```
Regla: **cap pantalla crida el motor directament**; tot passa per `data/vehicles.ts`.

## Dades reals (futur)
Un proveïdor nou (`TusRealtimeProvider` / `OfficialSAEProvider`) que ompli `realtimeVehicles` (ja previst a
`data/load.ts` + SSE de `apps/api`). `vehiclesAt`/`arrivalsAt`/`journeyFor` ja donen prioritat als vehicles
`REALTIME` frescos. El planificador avui fa servir `engine.boardings()` (horari + retard simulat); amb temps real
caldrà que `planFor` substitueixi les hores de les expedicions amb vehicle real per les seves ETA (punt únic: `planFor`).

## Notificacions (base)
`TripMonitor` (views/Trip.tsx) ja detecta els esdeveniments (a 2 parades, la propera és la teva, a la parada, baixa
a la següent) i els envia a `pushToast`. Per a notificacions del sistema: substituir/afegir un emissor
(`Notification` API o push natiu del contenidor d'app) al mateix punt.

## Configuració
`VITE_API_URL` (backend opcional; sense, la simulació corre al dispositiu). Sense altres secrets.
