# Routing TUS: destí → bus

Codi: `packages/core/src/plan.ts` (`planTrip`), cridat només des de `apps/web/src/data/vehicles.ts` (`planFor`).
Dades: `network.json`, amb 23 línies, 105 variants (sentits i parcials) i 408 parades. `data:audit` dona 0 errors.

## Entrada
- **Origen**: la ubicació (LocationService) o un lloc triat amb «Canvia».
- **Destí**: un o més punts. Un lloc del cercador (`g…`, `l…`) és 1 punt; un carrer (`c…`) són tots els seus punts, i compta el més proper a cada parada; una parada (`p…`) és el seu punt.

## Algorisme
1. **Parades d'origen**: les que són a ≤ 1.100 m a peu (distància en línia recta × factor de desviament).
2. **Parades de destí**: les que són a ≤ 1.100 m del destí. Si no n'hi ha cap → `destination-far` → «No trobem cap ruta en bus TUS fins a aquest destí: no hi ha cap parada a prop.» **No s'inventa res.**
3. **Busos**: per a cada parada d'origen, les sortides (`engine.boardings`) dels propers 75 min. El sentit és el de la variant concreta, així que només val un bus que passi per la parada de destí **després** de la d'origen.
4. **Transbord**: com a màxim 1, amb temps mínim de canvi.
5. **Puntuació** = hora d'arribada + 5 min per transbord + 0,5 × minuts a peu + 1 min si el bus encara és a capçalera (sense vehicle assignat). La millor puntuació és la **«Millor opció»**. Se n'ofereixen fins a 2 més, de línies o parades diferents.
6. **A peu**: si el destí és a menys de 450 m, o a peu (≤ 15 min) s'hi arriba abans, es diu en una línia discreta. No hi ha navegació a peu.

## Sortida a la UI («Millor opció»)
```
L1 · Direcció Can Deu
PUJA A  Rambla · a 300 m de tu        ARRIBA EN  4 min      (estat del bus · puntualitat)
BAIXA A Hospital Taulí · 6 parades    08:45
📍 Hospital Universitari Parc Taulí és a 120 m de la parada
14 min de trajecte · arribes a les 08:47
[Segueix aquest bus]  [On és el bus]  Recorregut
```
- «a N m de la parada» surt del darrer tram a peu del planificador (no és una navegació). Per a una parada com a destí no es mostra.
- **Segueix aquest bus** → el viatge:
  - la teva parada i «Arriba en N min»;
  - **El bus és a** X · **Propera parada** Y;
  - a N parades, i la pista del bus fins a tu;
  - avisos: a 2 parades, és la propera, baixa a la següent.

## Temps i honestedat
- Les hores surten dels horaris publicats per TUS i de la simulació del vehicle (segueix la geometria, s'atura, accelera i té retards simulats).
- **Tot és simulat** i ho diuen la píndola «Dades de demostració» i la nota de la ruta.
- `planFor` és l'únic punt on, amb dades reals (GTFS-RT), es posarien les ETA reals.

## Proves
- Unitàries (`packages/core/test/plan.test.ts`): la millor opció és la de menor puntuació, com a màxim 3 opcions, sentit correcte, transbord.
- e2e:
  - «Info Express» (lloc del cercador) → línia, puja, arriba en, baixa, a N m;
  - Parc Taulí;
  - destí sense parada a prop → missatge honest (provat a mà amb el Decathlon de Terrassa).
