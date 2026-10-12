# Tarifes i punts de venda — fonts, decisions i límits

Pàgines públiques (sense sessió): `/tarifes` i `/punts-de-venda` (`apps/web/src/views/Fares.tsx`).
Dades: `apps/web/src/data/fares.ts` i `apps/web/src/data/salesPoints.ts`. Tests: `src/data/fares.test.ts`, `e2e/fares.spec.ts`.

## Fonts
- **Preus i condicions**: dades facilitades pel responsable del projecte el 2026-10-11 a partir de tus.es, ATM i
  T-mobilitat (vigència publicada: des de l'1 de maig de 2026, `FARES_VALID_FROM`). Una cerca web del 2026-10-11 hi
  coincideix, però **no s'ha pogut llegir la pàgina original** (tus.es bloquejat des de l'entorn de desenvolupament).
  Per això cada tarifa porta `verified: false` i la interfície diu «publicades per TUS · consultat el … · a confirmar».
- **Punts de venda (33)**: llista facilitada el 2026-10-11, procedent de la pàgina de punts de venda de tus.es.

## Decisions
- **Cap coordenada inventada.** «Com hi vaig» obre una cerca de l'adreça al mapa (`mapsSearchUrl`).
- **Venda per establiment**: només l'Oficina de Mobilitat consta que ven la T-10 i les mensuals; a la resta no
  s'atribueix cap títol que les dades no confirmin.
- **«Obert ara»** es calcula en hora local de Sabadell (Europe/Madrid, `localNow`) i té tres estats: obert, tancat i
  *a confirmar*. «A confirmar» surt en un festiu sense horari de festius publicat, en franges condicionals (p. ex.
  dies lectius) o quan no hi ha calendari.
- **TUS vs ATM**: la T-16 i els títols integrats es mostren com a ATM/T-mobilitat, separats dels títols propis de TUS.
- **Divulgació progressiva**: no es mostra la llista sencera; hi ha cerca, filtres per barri, per «obert ara» i per títol.
- **Noms**: «T-mensual bonificada» i «T-mensual Jove bonificada», com a la llista oficial facilitada (2026-10-12).
- **«Obert ara» sense motor**: la pàgina només baixa les dates festives (`loadHolidayDates` a `data/load.ts`); si no
  arriben, l'estat és «a confirmar». Test camp a camp dels 33 punts contra la llista: `src/data/fares.test.ts`.

## Límits coneguts
- Els preus s'han de revisar contra tus.es abans de presentar-ho com a servei real (posar `verified: true` i la data).
- No es coneixen tancaments puntuals ni vacances dels establiments.
- Les festes locals de 2027 no hi són (`TODO(DECISION: FESTIUS-LOCALS-2027)`).
