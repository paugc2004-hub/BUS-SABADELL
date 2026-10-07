# Landing — estratègia

## Públics i què han d'emportar-se'n
| Públic | Pregunta | Resposta que dona la landing | On |
|---|---|---|---|
| Ciutadà | «Em serveix?» | «Sí: sé quan arriba el meu bus i on és.» | Hero, beneficis, com funciona, la meva parada |
| Ajuntament | «Té sentit com a projecte de mobilitat?» | «És una capa digital moderna que aprofita informació que el servei ja genera.» | El projecte, flux prototip → temps real, contacte |
| TUS / operador | «Ens volen substituir?» | «No: podria consumir un feed oficial i convertir-lo en experiència ciutadana.» | Nota del flux, «no oficial», presentació |

## Proposta de valor
**No esperis el bus a cegues.** Primer *quan* (minuts), després *on* (posició, parades que falten), després
*què passarà* (properes parades). El mapa apareix tard i com a prova, no com a producte.

## Arquitectura (ordre i per què)
1. **Nav** mínima: logo, «Com funciona», «El projecte», **Prova-ho ara**. Sense «Crea un compte».
2. **Hero**: titular de benefici + subtítol concret + crida. A la dreta (a sota al mòbil), una **situació
   humana**: la targeta «La meva parada · Rambla · L2 → Creu de Barberà» amb el bus que s'hi acosta
   (4 → 3 → 2 → 1 min → «Ja hi és»), sobre un fragment de mapa fet amb els recorreguts reals. Etiquetada
   **Demostració**. Pura animació CSS/SVG: no carrega la xarxa ni MapLibre.
3. **Beneficis** («Quan saps on és, esperar canvia»): tres situacions, cadascuna amb un fragment d'UI.
4. **Com funciona**: tres passos (parada → quan arriba → segueix-lo).
5. **La meva parada**: la funció de retenció (parada de cada dia amb diverses línies reals: L2, L1, L80 a Rambla).
6. **Segueix el bus que vols agafar**: avís «a 2 parades» + línia temporal passat/present/futur.
7. **Tota la xarxa**: captura real del mapa (lazy) + «Explora el mapa».
8. **El projecte**: prototip independent, informació pública i vehicles simulats, i «Projecte independent · no és
   una aplicació oficial de TUS ni de l'Ajuntament de Sabadell».
9. **Peu**: no oficial, fonts, «Ja tens compte? Entra».

Fora del flux principal (deliberadament): arquitectura, API, SSE, GTFS, MapLibre, proveïdors, «105 variants».
Viuen a la presentació i als documents.

## CTA
- **Prova-ho ara** (principal, 3 vegades: nav, hero, final) → entra a `/app` amb el compte de demostració, sense
  formulari. Microcopy: «Sense registre · al mòbil o a l'ordinador».
- **Com funciona** (secundària) → ancoratge.
- **Veure el bus** a la targeta del hero → la parada Rambla real dins l'app.
- **Explora el mapa** → `/mapa`.
- Compte: només per utilitat (a «Els meus»: «Si en crees un, les parades que hagis desat passen al teu compte»).

## Posicionament i to
Capa d'experiència complementària, no substitució. No es diu «TUS no té app» (en té). Mai «temps real» en present
per a dades simulades. Català natural, frases de producte («Saps quan arriba»), sense adjectius de màrqueting.

## Identitat
Mateixa marca (NextMobility Sabadell, «N» de recorregut). Landing en tema clar (fons `#f6f5f1`, tinta `#0e1116`);
el color només on informa: color de línia, verd «a l'hora», ambre «el bus». L'app es queda fosca (millor per al mapa).

## Canvi 2026-10-07 (petició de l'usuari)
Fora de la landing: el flux «Del prototip al temps real», la caixa «Prototip en desenvolupament», la crida final i el
bloc «Parlem del projecte». La transparència es manté al hero («Prototip independent · posicions simulades…»), a la
secció del projecte i al peu. El flux de dades i l'arquitectura queden a la presentació (`/presentacio`).
Al mapa del hero, el cercle groc és ara el bus de l'app (mateixa silueta, orientat pel carrer).

> **Actualització 2026-10-07 (2):** a petició de l'usuari també s'ha tret la secció «El projecte» (i l'enllaç de la navegació). La transparència queda a l'avís del hero («Prototip independent · posicions simulades…») i al peu («no és una app oficial de TUS ni de l'Ajuntament»).
