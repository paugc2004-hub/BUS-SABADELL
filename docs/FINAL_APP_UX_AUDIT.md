# /app — auditoria final (després del redisseny V3)

Data: 2026-10-07. Abans: `APP_UX_AUDIT.md`. Estratègia: `APP_UX_STRATEGY.md`. Pla: `APP_IMPLEMENTATION_PLAN.md`.

## Abans → després
| Problema (abans) | Què s'ha fet |
|---|---|
| Estètica de centre de control (negre, rellotge amb segons, «Simulació en directe · incidències», franja ratllada ambre) | App ciutadana **clara** (tokens a `.app.citizen`) i **mapa base clar i apagat** (OpenFreeMap *positron*); barra amb logo, pastilla **«Dades de demostració ⓘ»**, navegació, idioma i menú. Rellotge només en hora de demo. Avisos: una campana només si n'hi ha. |
| Inici al mòbil = mapa amb 80 busos + panell | **Inici és una pàgina** al mòbil: cerca «On vas?», **el teu proper bus**, les meves parades, a prop teu i **«Veure el mapa»** (botó). A l'escriptori, panell + mapa. |
| Dos botons per a la mateixa intenció | **Una acció principal: «Agafaré aquest bus»** (viatge + avisos + el mapa segueix el bus). «Veure on és» / «Segueix-lo», secundaris. |
| Quatre números per llegada (imminent + mm:ss + hh:mm + «en N min») | **Un temps** gran («Ara» / «4 min» / hh:mm si falta > 1 h) i el següent en petit («després 08:50»). Sense mm:ss enlloc. |
| Fitxa del bus tècnica (LED `L55·04`, %, km, km/h, tres pastilles) | Xip + destinació, origen → destí, **un estat en paraules**, on és, propera parada «en 2 min»; línia temporal sense % ni km/h; el torn simulat, al peu. |
| Mode viatge sense context propi | **La fitxa es transforma en «El teu viatge»**: la teva parada, **arriba en N min**, a N parades, estat, pista ●──🚌──◉ fins a la teva parada, «Puges a» / «Baixes» a la línia temporal i **un sol botó: «Deixa de seguir»**. La targeta flotant del viatge fa servir el mateix component i no es duplica. |
| Panells translúcids (es llegia l'inici a través de la parada) | Superfícies opaques; al mòbil, amb parada/bus/ruta oberts, la pàgina d'inici s'amaga i es veu el mapa. |
| Xarxa i Presentació barrejades amb el ciutadà | **NextMobility Control** (fosc): `/xarxa` amb capçalera pròpia, «Torna a l'app» i accés a la presentació. S'hi entra des del menú. Navegació ciutadana: **Inici · Mapa · Línies · Parades**. |
| Parada: codis de pal i xips de línies que avui no circulen | Només les línies que circulen avui; codis de pal, al peu; «Com hi arribo», després de les llegades. |
| Línia: graella de 4 dades en mono | Una frase: «7 busos ara · cada 20 min · 44 min de punta a punta · 04:25–23:20»; propers busos com a xips. |
| Estats incoherents («Amb retard» ≥ 3 min, «Retirada») | **A l'hora · N min tard · Retard important · N min (≥ 5) · N min abans · Fora de servei**; sempre text, i el punt canvia de forma en el retard important. |
| «Els meus» com a calaix | **Parades**: les meves parades, a prop teu i, al final, el compte (amb la invitació a crear-ne un si ets a la demo). |

## Decisions importants
- **Clar per al ciutadà, fosc per a Control.** Ús diari al carrer (llum de dia), confiança i to institucional; Control
  és una pantalla de sala, densa. Mateix motor i mateix mapa (canviar d'estil de mapa en navegar reconstruiria
  totes les capes). Les línies porten una vora fosca fina perquè els colors clars (L44, L10, F4…) es vegin.
- **El mapa no és l'inici** al mòbil. Hi és quan respon una pregunta: on és el bus, per on va la línia, com hi
  arribo, què passa a la ciutat (pestanya Mapa).
- **Una acció per bus.** «Agafaré aquest bus» engloba seguir-lo; seguir la càmera sense viatge queda com a secundari.
- No s'ha tocat el motor, els proveïdors, `data/vehicles.ts`, el planificador, les rutes ni les dades.

## Funcionalitats mogudes o tretes (i per què)
- Xarxa (KPI, puntualitat, flota) i Presentació → **NextMobility Control** (menú). Són de l'operador.
- Franja d'honestedat → pastilla «Dades de demostració» (ciutadà); la franja continua a Control i a la presentació.
- LED del torn, %, km restants, km/h, mm:ss → fora (el torn, al peu de la fitxa com a «Bus simulat · torn …»).
- Xip «Simulació en directe · incidències» → fora; campana d'avisos només si n'hi ha.
- Rellotge amb segons i tipus de dia → només en hora de demo.
- Codis de pal → al peu de la parada.

## Proves
`pnpm typecheck` ✔ · `pnpm lint` ✔ · `pnpm test` 88/88 ✔ · `pnpm data:audit` 105 variants · 0 errors ✔ · build ✔ ·
e2e **66/66** (escriptori, iPhone 13, Android), amb proves noves de la navegació ciutadana (4 entrades, sense Xarxa),
de Control (fosc, des del menú) i del mode viatge («El teu viatge», «Deixa de seguir»).
Recorregut visual a 390×844, 430×932, 768×1024 i 1440×900 (`scripts/ux-tour.mjs`).
Rendiment (build, perf-probe 20 s, sense GPU): inici 60 fps (escriptori i mòbil), parada 58 fps, mapa 60 fps.
Lighthouse (local): accessibilitat **100**, bones pràctiques **100**.

## Test dels 5 i dels 30 segons
- 5 s: «El teu proper bus · L55 Les Termes · Ara · Agafaré aquest bus» és el primer bloc sota la cerca → «sé quan
  arriba el bus».
- 30 s: Inici → cerca «estació centre» → parada → toca la primera llegada → fitxa del bus (on és, propera parada)
  → «Agafaré aquest bus» → «El teu viatge» amb el mapa seguint el bus. 4 tocs.

## Pendents
- Mapa contextual petit dins la parada al mòbil (avui el mapa queda a dalt, darrere el full).
- Historial i preferències de compte: requereixen comptes reals (avui, ficticis al navegador).
- Les línies festives (F1–F15) amb colors pàl·lids es veuen menys al mapa clar, tot i la vora.
- La pastilla «Dades de demostració» es retalla a pantalles < 360 px.

## Riscos amb dades reals
- Amb SAE/GTFS-RT, els busos sense posició recent s'han de mostrar com a «sense dades» (no inventar-ne): el
  proveïdor ja ho permet (`REALTIME` fresc 90 s), però la UI no té encara un estat visual propi per a «sense senyal».
- Retards reals poden ser molt més grans que els simulats (acotats a +9 min): els estats ja escalen («Retard important»).
- Desviaments reals (`DESVIADO`) només es poden mostrar si el feed els envia.

## Propers passos
1. Mapa contextual a la parada (mòbil).
2. Estat «sense senyal» per a vehicles reals.
3. Comptes reals (Supabase o similar) amb parades sincronitzades entre dispositius.
4. Prova d'usuaris reals a una parada de Sabadell (5 persones, tasca dels 30 segons).
