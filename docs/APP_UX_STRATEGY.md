# /app — estratègia UX

## Model mental
**Usuari → parada → bus → quan → viatge.** El mapa apareix quan respon una pregunta (on és el bus, per on va la
línia, com hi arribo, què passa a la ciutat). Cada pantalla respon UNA pregunta (vegeu l'arquitectura a
`APP_UX_AUDIT.md` §12).

## Ciutadà vs. operador
- **NextMobility** (ciutadà): clar, poques dades, una acció per pantalla.
- **NextMobility Control** (operador): `/xarxa` i `/presentacio`, fosc, dens (KPI, puntualitat, flota). S'hi entra
  des del menú «Informació» (no és a la navegació ciutadana). Mateix motor de dades.

## Clar vs. fosc (decisió)
- **Ciutadà: clar.** Ús de dia i al carrer (sol, pantalla amb poca brillantor): més contrast llegible, sensació de
  servei públic i de confiança; coherent amb la landing. Mapa base clar i apagat (OpenFreeMap *positron*) perquè
  els colors de línia siguin els protagonistes; les línies porten una vora fosca fina per als colors clars (L44 groc,
  L10, F4, F5…).
- **Control: fosc.** Pantalla de sala/presentació, molta densitat, mirada llarga.
El mapa és el mateix (un sol estil carregat; canviar d'estil en navegar reconstruiria totes les capes).

## Navegació
Mòbil, barra inferior: **Inici · Mapa · Línies · Parades**. Escriptori: les mateixes, a dalt. «Els meus» passa a
**Parades** (les meves parades, a prop, compte). Xarxa i Presentació, a Control.

## Inici (Quin bus puc agafar?)
1. Cercador «On vas?» (llocs, carrers, parades, línies).
2. **El teu proper bus**: línia + destinació, minuts grans, «a N parades», estat; **un** botó: «Agafaré aquest bus».
3. **Les meves parades**: cada una amb les 2 properes llegades; si no n'hi ha, «A prop teu» o parades suggerides.
4. «Veure el mapa en directe» (botó, no un mapa gegant).
Mòbil: pàgina sense mapa. Escriptori: panell esquerre + mapa (hi ha espai).

## Parada (Quan arriba el meu bus?)
Nom, ★, línies que hi passen avui (no les que no circulen). Llegades: xip + «→ destinació», «a N parades · estat»,
i a la dreta **un** temps («4 min» / «Ara» / «08:42» si falta més d'una hora) + el següent en petit. Tocar → bus.
«Com hi arribo», a sota. Codis de pal, al peu.

## Bus (On és?)
Capçalera: xip + «→ destinació»; estat humà; «Ara: entre X i Y»; propera parada «en 2 min»; **Agafaré aquest bus**
(i «Segueix al mapa» com a acció secundària petita). Línia temporal visual sense km/h ni %. Torn simulat, al peu.

## Viatge (Quant falta?)
Quan el bus és el del teu viatge, la fitxa es transforma: «El teu viatge», **la teva parada**, **arriba en N min**,
**a N parades**, estat, pista ●──🚌──○ fins a la teva parada, línia temporal amb «Puges» / «Baixes», «Deixa de
seguir». La càmera segueix el bus. Alertes com fins ara.

## Línia (Per on va?)
Xip + origen → destí (canvi de sentit), «7 busos ara · cada 20 min · 04:25–23:20» en una línia, propers busos com a
xips, i el recorregut amb els busos (ja existent).

## Mapa (Què passa ara?)
Xarxa en directe amb filtre de línies; és l'única vista on el mapa és el protagonista.

## Estats
| Estat | Text | Color + forma |
|---|---|---|
| A l'hora (−1…+1 min) | A l'hora | verd, punt |
| Lleu retard (+1…+4) | 2 min tard | taronja |
| Retard important (≥ +5) | Retard important · 6 min | vermell |
| Avançat (≤ −1) | 1 min abans | blau |
| Fora de servei | Fora de servei | gris |
Sempre text; el color només reforça. A la demo, l'etiqueta accessible diu «simulat».

## Transparència
Pastilla petita «Dades de demostració ⓘ» a la barra (obre l'explicació). Text: «Aquesta demo utilitza dades
simulades per mostrar com podria funcionar l'experiència amb dades operatives en temps real.» Mai «temps real» en
present per al que és simulat; mai cap afirmació d'accés al SAE/AVL.

## Sistema de disseny
Tipus: 32/24/18/16/14/12 (+48 per als minuts grans). Radis: 12/16/20. Superfícies: fons `#f6f5f1`, targeta blanca,
separació per espai i una ombra subtil; sense vores dobles. Botons: primari (tinta), secundari (contorn), text.
Xips de línia: 3 mides. Mono només per a hores en llistes.

## Accessibilitat
Objectius ≥ 44 px, focus visible, contrast AA en tema clar, `aria-live` a les llegades, estats amb text,
`prefers-reduced-motion`, l'avís de demo accessible.

## Responsive
Dissenyat per a 390–430 px; 768 i 1440 amb panell lateral + mapa.
