# Bus Sabadell en directe — proposta per a TUS i l'Ajuntament de Sabadell

**Demo:** https://bus-sabadell.vercel.app · **Presentació guiada (2–3 min):** https://bus-sabadell.vercel.app/presentacio

## Què és

Una web (també instal·lable al mòbil) que mostra **tota la xarxa TUS en directe**: les 23 línies amb els
seus recorreguts, les 408 parades i cada autobús movent-se pel seu carrer. Respon en menys de 10 segons el
que es pregunta qualsevol usuari:

- On és el meu bus i cap on va?
- Quan arriba a la meva parada i **a quantes parades** és?
- Quins busos vénen ara a la meva parada?
- "Vaig a agafar aquest bus": avisa quan és **a 2 parades**, quan és la propera i quan has de baixar.

## Què és real i què és simulat (avui)

| Real (dada pública) | Simulat (fins que hi hagi dada de TUS) |
|---|---|
| Línies, colors, recorreguts, parades i horaris de pas de **tus.es** | La **posició** de cada bus: es calcula a partir de l'horari publicat |
| Carrers i mapa: © OpenStreetMap | Segons dins de cada minut i temps de parada |
| Festius oficials (Generalitat i Ajuntament) | Quin vehicle fa cada expedició |

La demo **ho diu sempre** (banner fix i etiqueta "Simulat" a cada bus). No fem servir l'app de TUS ni cap
API privada, ni el logotip de TUS. Hem validat les 106 variants de recorregut contra els carrers d'OSM i n'hem
detectat i corregit errors (p. ej. la F6 passava per una carretera que ja no existeix).

## Què hi guanya TUS

- **Visibilitat i imatge moderna**: un producte com els de les grans xarxes (TMB, Metro de Barcelona), per a una
  ciutat de 220.000 habitants.
- **Cap cost de desenvolupament per a TUS**: la interfície ja està feta i provada; només cal connectar-hi la dada.
- **Menys trucades i menys espera a la parada**: l'usuari sap quan surt de casa.
- **Dades obertes**: Terrassa, Barcelona i la Generalitat ja publiquen GTFS; Sabadell s'hi posaria al dia.
- **Arquitectura preparada**: el dia que arriba la dada real, el mapa, les fitxes i les alertes funcionen igual;
  només canvia l'etiqueta "Simulat" per "Temps real".

## Què necessitem de TUS

1. **Posició dels vehicles en temps real**, idealment en **GTFS-Realtime** (VehiclePositions + TripUpdates).
   Alternativa: accés de lectura al **SAE/AVL** (API o exportació periòdica).
2. **GTFS estàtic oficial** (línies, parades, horaris, calendaris), per no dependre de llegir la web.
3. Condicions tècniques: **freqüència d'actualització** (ideal ≤ 15–30 s), **autenticació** (clau d'API) i
   **llicència** d'ús (dades obertes o conveni).
4. Opcional: retards i desviaments (incidències), ocupació.

Proposta de passos: (1) conveni o permís d'ús, (2) feed de prova en un entorn de test, (3) pilot amb 2–3 línies
(el sistema ja barreja temps real i simulació per línia), (4) tota la xarxa.

## Abans de la reunió (checklist)

- [ ] Provar al **mòbil real amb 4G** (no wifi): https://bus-sabadell.vercel.app
- [ ] Provar **sense connexió** (mode avió després d'obrir-la una vegada): ha de continuar funcionant.
- [ ] Tenir oberta la **presentació** amb hora de punta: https://bus-sabadell.vercel.app/presentacio?hora=08:15&dia=dimarts
- [ ] Enllaç de reserva amb hora forçada i ×10: https://bus-sabadell.vercel.app/?hora=08:00&dia=dilluns&x=10
- [ ] Portar aquesta pàgina impresa i la llista de "què necessitem".
- [ ] Recordar: **no és una app oficial**; les posicions són simulades.
