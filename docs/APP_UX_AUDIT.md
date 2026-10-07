# /app — auditoria UX/UI (abans del redisseny)

Data: 2026-10-07. Mètode: lectura del codi (`AppMain`, vistes, `store`, `MapView`, estils) i recorregut a
390×844 de totes les pantalles (`apps/web/scripts/ux-tour.mjs`: inici, parada, bus, línies, línia, mapa, els meus,
xarxa, viatge). Crític a propòsit.

## 1. Què funciona (no es toca)
- **El motor**: simulació determinista sobre la geometria real, acceleració/frenada, parades, retards simulats,
  ETA coherents entre fitxa, parada, línia temporal i mapa (`vehicle.ts`, `engine.journey`). Bona base per a SAE/GTFS-RT.
- `data/vehicles.ts` com a única porta a les dades en directe; `planFor` (com hi arribo) igual.
- Bus vectorial amb rumb al mapa; línia destacada amb la resta atenuada; seguiment de càmera.
- «Vaig a agafar aquest bus» amb alertes contextuals (a 2 parades, la propera és la teva, baixa a la següent).
- Com hi arribo amb carrers i llocs; cercador únic.
- Accessibilitat de base (Lighthouse 100, combobox, `aria-live`, puntualitat amb text, no només color).

## 2. Què no funciona
| # | Problema | On | Gravetat |
|---|---|---|---|
| F1 | **Sembla un centre de control**: fons negre, rellotge amb segons en ambre, «Simulació en directe · Sense incidències», franja ratllada ambre a tota l'amplada. És l'estètica de l'operador, no la del ciutadà. | `TopBar`, `HonestyBanner` | P0 |
| F2 | **Inici al mòbil = mapa ple de 80 busos a dalt + panell**. El mapa no respon «quin bus agafo?» i tapa el que sí ho respon; l'atribució hi queda a sobre. | `Home`, `AppMain` | P0 |
| F3 | **Dos botons per a la mateixa intenció** («Vaig a agafar aquest bus» / «Seguir bus») a l'inici i a la fitxa. La gent no sap la diferència (un és un viatge amb avisos, l'altre la càmera). | `Home`, `BusCard` | P0 |
| F4 | **Massa números per llegada**: «imminent» + `00:32` + `08:33` + «en 18 min» a la mateixa fila; comptadors mm:ss arreu. | `ArrivalRow`, `BusCard`, `StopTimeline` | P0 |
| F5 | **Fitxa del bus tècnica**: `L55·04` en LED vermell, «71% del trajecte · queden 2,4 km», «14 km/h», «En ruta / +1 min / Simulat» com a tres pastilles. | `BusCard`, `StopTimeline` | P0 |
| F6 | **El mode viatge no canvia de context**: en començar el viatge s'obre la mateixa fitxa del bus amb «Acaba el viatge»; la targeta de viatge s'amaga al mòbil. No hi ha «la teva parada · arriba en · a N parades» com a protagonista. | `Trip`, `BusCard` | P0 |
| F7 | **Panells translúcids** (`rgba(…,0.94)`) sobre l'inici: es llegeix el text de sota («Ara», «Seguir bus») darrere la parada i el bus. | `.sheet`, `.panel` | P0 |
| F8 | **«Xarxa» (KPI, puntualitat, flota) a la navegació ciutadana** (escriptori) i el botó de presentació a la barra: barreja ciutadà i operador. | `TopBar` | P1 |
| F9 | **Parada**: codis de pal («Codi 135 · 176 · 212 · 345 · 356 · 700 (6 pals)») i 20 xips de línia (incloses les que avui no circulen) abans de les llegades. | `StopPanel` | P1 |
| F10 | **Línia**: graella de 4 dades (Busos/Freqüència/Durada/Servei) i propers busos en tipus mono: sembla un panell de dades. | `LinePanel` | P1 |
| F11 | **«Els meus»** és un calaix (compte + viatge + parades + suggeriments). | `Mine` | P1 |
| F12 | Estats del bus: «Amb retard» a partir de 3 min però sense «retard important»; «Retirada» (terme intern). | `Punctuality`, `status` | P1 |

## 3. Què sobra (a la vista ciutadana)
Rellotge amb segons, «Simulació en directe · incidències» (un xip a dalt), franja d'honestedat a tota l'amplada
(l'honestedat es manté, en petit), LED del torn, %/km/velocitat, codis de pal, xips de línies que avui no circulen,
segon comptador mm:ss, «Xarxa» i «Presentació» a la navegació.

## 4. Què falta
Un inici que sigui una pàgina (no un mapa), una sola acció principal per bus, un mode viatge de veritat,
estats humans coherents («A l'hora», «2 min tard», «Retard important», «Fora de servei»), separació
ciutadà/operador («NextMobility Control»), tema clar per a l'ús diari.

## 5. Jerarquia
Inici: el «proper bus» competeix amb el mapa (a dalt) i amb dos botons grans; «Les meves parades» queda sota
el plec i sense llegades si no n'hi ha cap de desada. Parada: les llegades comencen a mitja pantalla.

## 6. Mòbil (390×844)
El full de la parada/bus ocupa el 70 % i el mapa de dalt queda tapat per l'atribució; els panells translúcids
deixen veure l'inici; la barra superior gasta 90 px (barra + franja) en informació d'operador.

## 7. Visual
Fosc arreu (cansa de dia i al sol), ambre com a color d'alerta i de marca alhora, molts tipus mono, vores + fons
+ ombra a cada targeta, quatre mides de xip.

## 8. Producte
El core loop real és **parada → proper bus → on és → l'agafo → avisos**. Avui el loop es pot fer, però el camí no
està senyalitzat: hi ha massa entrades (mapa, xarxa, línies, fitxa, viatge) amb el mateix pes.

## 9. Quick wins
Panells opacs; un sol botó «Agafaré aquest bus»; «Ara» en lloc d'«imminent»; fora mm:ss, LED, km/h, %; xips només
de línies actives; «Dades de demostració» com a pastilla.

## 10. Canvis estructurals
Tema clar ciutadà + mapa base clar; inici com a pàgina al mòbil (mapa = botó); mode viatge propi dins la fitxa;
navegació Inici · Mapa · Línies · Parades; «NextMobility Control» (fosc) per a Xarxa i Presentació.

## 11. Què NO tocaria
Motor, proveïdors, `data/vehicles.ts`, planificador, rutes/URL, dades de línies (auditoria 105 variants · 0 errors),
icona del bus, alertes del viatge, landing.

## 12. Nova arquitectura UX
```
Inici (Quin bus puc agafar?) ── cerca «On vas?» · proper bus · les meves parades · a prop · [Veure el mapa]
Parada (Quan arriba el meu bus?) ── llegades → bus
Bus (On és?) ── on és · propera · línia temporal · [Agafaré aquest bus]
Viatge (Quant falta?) ── la teva parada · arriba en · a N parades · línia temporal · [Deixa de seguir]
Línia (Per on va?) ── sentit · busos ara · recorregut amb busos
Mapa (Què passa ara?) ── xarxa en directe, filtres
Parades ── les meves parades · a prop · compte
Control (operador, fosc) ── xarxa: KPI, puntualitat, flota · presentació
```
