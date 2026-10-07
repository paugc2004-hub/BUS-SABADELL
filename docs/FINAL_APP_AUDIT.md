# Auditoria final — ubicació automàtica + cerca universal + seguretat

Data: 2026-10-07. Producció: https://bus-sabadell.vercel.app/app (desplegat i verificat).

## El criteri, pas a pas
```
ABRO              → entres (o «Entra sense compte»); l'app no s'obre amb un mapa gegant, sinó amb «On vols anar?»
ME DETECTA        → «Detectant la teva ubicació…» → «Ets a prop de la parada X». Si falla, diu per què i deixa reintentar
BUSCO «INFO EXPRESS» → resultats locals a l'instant + cerca universal (1 petició després de deixar d'escriure)
ENCUENTRA EL NEGOCIO → «Info Express · Can Oriach · Sabadell · a 1,2 km» (si el proveïdor el té: vegeu sota)
ME DICE QUÉ BUS   → MILLOR OPCIÓ · L2 · Direcció …
DÓNDE SUBIR       → PUJA A <parada> · a 300 m de tu
CUÁNTO FALTA      → ARRIBA EN 5 min (+ on és el bus, puntualitat)
DÓNDE BAJAR       → BAIXA A <parada> · 6 parades · 08:45 · «Info Express és a 150 m de la parada»
PUEDO SEGUIR EL BUS → Segueix aquest bus → el bus és a / propera parada / arriba en / a N parades / avisos
```
Tot aquest recorregut és a l'e2e (`cerca universal i ubicació`), amb el proveïdor simulat, a escriptori, iPhone 13 i Android.

## Proves d'usuari (com a ciutadà)
| Cas | Resultat |
|---|---|
| 1. «Info Express» | Amb **Photon (per defecte) no el troba: no és a OpenStreetMap** (comprovat). L'app ho diu: «No hem trobat aquest lloc. Prova amb una adreça, un carrer o un altre nom.» **Amb `GOOGLE_PLACES_API_KEY` a Vercel** es fa servir Google Places, que sí que té comerços petits. El flux complet està provat amb un proveïdor simulat |
| 2. «Taulí» | Hospital Universitari Parc Taulí (lloc local) → línia, puja, arriba en, baixa ✔ |
| 3. Un carrer que no és una parada | Carrers del nomenclàtor i de Photon → ruta a la parada més adequada ✔ |
| 4. Una botiga petita | Si és a OSM (Decathlon Rambla, Bonpreu, Mercadona…) ✔. Si no, mira el cas 1 |
| 5. Diverses botigues amb el mateix nom | Totes, amb el barri i «a N km», la més propera primer ✔ |
| 6. Ambigu («Taulí») | Hospital, parades i altres llocs, agrupats ✔ |
| Destí sense TUS a prop (Decathlon de Terrassa) | «No trobem cap ruta en bus TUS fins a aquest destí» ✔ (sense inventar) |
| Ubicació denegada | Explica com activar-la (iOS/Android), «Torna-ho a provar» i, a la ruta, «Tria des d'on surts» ✔ |

## Proves automàtiques
| | Resultat |
|---|---|
| typecheck (4 paquets) | ✔ |
| lint | ✔ |
| unitàries | **100/100** (inclou `/api/places` ×7 i cerca/codis ×5) |
| build | ✔ (sense mapes de codi) |
| e2e | **87/87** (escriptori, iPhone 13, Android) |
| `pnpm audit --prod` | **0** vulnerabilitats |
| producció | `/api/places` 200; 400/405/403 als casos dolents; capçaleres comprovades |

## Rendiment
- Cerca local: 0,3 ms per consulta a l'escriptori (nomenclàtor de 3.000 entrades).
- Cerca remota: 1 petició per pausa (mínim 3 lletres, 350 ms), la petició anterior es cancel·la, memòria per a les repetides. Primera consulta a Photon: 0,3–5 s (servei públic). Repetida: 60 ms.
- Ubicació:
  - primer, una posició ràpida per xarxa;
  - després, el GPS la millora;
  - seguiment sense alta precisió, que s'atura quan l'app va a segon pla;
  - per sota de 20 m no es recalcula la ruta.

## Seguretat
Vegeu `SECURITY_AUDIT.md` (16 punts):
- 4 corregits: MapLibre crític, mapes de codi, redirecció `/\`, URL mal codificada;
- capçaleres reforçades;
- `/api/places` endurit;
- 0 secrets;
- riscos acceptats documentats (comptes ficticis, dependències de desenvolupament).

## Pendents i riscos
1. **Comerços que no són a OSM** (com «Info Express»): cal Google Places (clau a Vercel, amb pressupost limitat) o afegir-los a OpenStreetMap.
2. **Latència de Photon públic** (fins a 5 s la primera vegada): a mitjà termini, el nostre Photon o Pelias del Vallès.
3. **Números de portal**: OSM en té pocs a Sabadell. «Rambla 100» porta a la Rambla, no al número.
4. **App Android (PWABuilder)**: activar **Location delegation** a les opcions del paquet.
5. Límit de ritme al WAF de Vercel per a `/api/places`.
6. Autenticació real i notificacions del sistema (com abans).
7. Les posicions dels busos continuen sent **simulades** i així es diu a la UI.
