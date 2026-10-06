# H0 — Descobriment de dades (2026-10-06)

Dades crues: `data/raw/osm/tus-full-2026-10-06.json` (relacions TUS completes, Overpass mirror private.coffee)
i `data/raw/osm/bbox-bus-tags-2026-10-06.json` (etiquetes de totes les rutes de bus de la zona).

## Llista oficial (tus.es, consultat 2026-10-06): 23 línies
- Feiners (16): L1, L2, L3, L4, L44, L5, L55, L7, L8, L10, L11, L12, L14, L15, L23, L80
- Festius (7): F1, F2, F3, F4, F5, F6, F15
- Horaris vigents en PDF "SET26" (setembre 2026) + plànol per línia.
- Cada pàgina de línia inclou la llista ordenada de parades i el color oficial.

## Etiquetatge a OSM
`network="Transports Urbans de Sabadell"` + `operator="TUS, SCCL"`, PTv2 a totes.
49 relacions `route` + 12 `route_master`. Les variants feiners/dissabtes i parcials són relacions separades.
La cerca per regex "TUS" retorna soroll (Santander, Ohio, Sevilla…): cal filtrar pel `network` exacte.

## Cobertura
| Estat | Línies |
|---|---|
| A OSM i continues | L1 (12 variants), L2 (8), L3 (4), L4 (4 útils), L5, L7, L8, L10, L11, L12, L14, L15 (circular, 1 relació), L23 |
| **Falten a OSM** | **L44, L55, L80, F1, F2, F3, F4, F5, F6, F15** (10 de 23) |
| Relacions buides | 4 variants de L4 (20295620–20295623): 1 way + 1 parada, inservibles |

- 45/49 relacions amb geometria contínua (unió estricta per extrems): 0 forats, 0 unions a mig way. Les rotondes estan partides en ways oberts.
- L23 molt curta (1,3–1,6 km, 4–6 parades): cal comparar-ho amb la llista de tus.es.
- Parades: 375 nodes (362 `platform`, 13 `stop_position`), 0 sense nom, 369 amb `ref`/`local_ref`, 237 noms diferents.

## Colors: OSM ≠ oficial en 9 línies → fem servir els de tus.es
| Línia | tus.es | OSM |
|---|---|---|
| L1 #e63027 · L2 #004996 · L3 #b05f00 · L4 #009a42 | = | = |
| L44 | #ffed00 | — |
| L5 | #dd007e | #fe00ff |
| L55 | #00679a | — |
| L7 | #0099cc | #0080fe |
| L8 | #f28d2c | #ffbe7d |
| L10 | #c4d984 | #b9feb9 |
| L11 | #b0d2f0 | #00ffff |
| L12 | #7b7223 | #808040 |
| L14 | #c3002f | #970000 |
| L15 | #c7921e | #c4731a |
| L23 | #acaa9f | #808080 |
| L80 | #9b338a | — |
| F1 #E06178 · F2 #9794D2 · F3 #DCC555 · F4 #7CDFA8 · F5 #F8A7D7 · F6 #B0D2F0 · F15 #C7921E | — | — |

Risc de daltonisme: L1 (#e63027) i L14 (#c3002f) són dos vermells gairebé iguals; L44 groc sobre fons fosc OK.
F6 = L11 i F15 = L15 (mateix color, no circulen el mateix dia).

## Interurbans
GTFS Generalitat disponible: 200 OK, 26,1 MB, actualitzat 2026-09-23.
A OSM hi ha uns 90 recorreguts interurbans a la zona (Moventis Sarbus, Sagalés, Avanza, exprés.cat…).
