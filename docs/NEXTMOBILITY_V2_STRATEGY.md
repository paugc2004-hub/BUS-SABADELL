# NextMobility Sabadell — Estratègia V2 (fase 2)

## Posicionament
Una capa d'experiència digital per al bus urbà de Sabadell: **saber quan arriba el teu bus i on és**.
No substitueix el sistema de TUS ni la seva app; explora com es podria veure la informació operacional
que el servei ja genera. Prototip independent, avui amb vehicles simulats.

Frase per a cada públic:
- **Ciutadà** — «Et diu quan arriba el bus i on és.»
- **Ajuntament** — «Una capa digital moderna que aprofita informació que el servei ja té.»
- **TUS** — «Pot consumir un feed oficial (GTFS-RT / SAE) i convertir-lo en experiència ciutadana. No toca la vostra operació.»

## Proposta de valor
Primer *quan* (minuts), després *on* (posició, parades que falten), després *què passarà* (línia temporal).
El mapa demostra les respostes; no és el producte.

## Arquitectura
- `/` landing: **convèncer**. Pública, lleugera: no carrega la xarxa ni MapLibre. Tema clar.
- `/app` i vistes: **fer servir**. Tema fosc (millor per al mapa). Sense barrera d'entrada:
  sense sessió s'entra amb el compte de demostració automàticament.
- Compte: per utilitat («Desa la teva parada…»), no com a peatge. `/entra` i `/registre` es mantenen.

## Landing (ordre)
1. Nav: logo · Com funciona · El projecte · **Prova-ho ara**
2. Hero: titular de benefici + targeta viva «La meva parada · Rambla · L2» (demostració etiquetada) sobre un fragment de mapa real
3. «Quan saps on és, esperar canvia» — 3 situacions amb UI en miniatura (quan, on, què passarà)
4. Com funciona — 3 passos
5. La meva parada — la parada de cada dia, amb diverses línies
6. Segueix-lo — «Vaig a agafar aquest bus» i línia temporal
7. Tota la xarxa — captura del mapa (lazy) + «Explora el mapa»
8. El projecte — visió + flux «Informació pública → Prototip → Dades operatives → Temps real»
9. Transparència — «Prototip en desenvolupament» (to calmat, no alarmista)
10. Crida ciutadana · crida institucional (presentació + contacte)
11. Peu: no oficial, fonts, entrar al compte

## CTA
- Principal (ciutadà): **Prova-ho ara** → entra a `/app` amb demostració, sense registre.
- Secundària: **Com funciona** (ancoratge).
- Institucional: **Veure la presentació** (`/presentacio`) i **Parlem** (`mailto:` només si hi ha adreça configurada a `VITE_CONTACT_EMAIL`; no s'inventa cap backend de contacte).

## Identitat
Es manté NextMobility Sabadell i la «N». Landing clara: fons blanc trencat, tinta gairebé negra, color només
on hi ha informació (color de línia, verd «a l'hora», ambre «el bus»). Sense degradats decoratius, sense
glassmorphism, sense cel·les amb vora+ombra a tot arreu: jerarquia per espai i tipografia (escala 32/24/18/16/14/12;
el titular del hero és l'única excepció, fluid).

## Missatges i honestedat
- Mai «temps real» en present per al que és simulat. Titular sense «en directe».
- A prop de la crida: «Prototip · vehicles simulats a partir dels horaris publicats».
- Secció institucional: «Projecte independent · no és una aplicació oficial de TUS ni de l'Ajuntament de Sabadell.»
- Presentació: «Amb dades operatives» (futur, condicional), mai «connectat al SAE».

## Mesura d'èxit
Test de 5 segons i «test del pare» sobre el hero; Lighthouse de la landing (LCP < 2,5 s objectiu);
fps de l'app iguals o millors; e2e verds; `data:audit` sense errors.
