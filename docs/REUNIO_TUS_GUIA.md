# Reunió amb TUS — guia per al presentador

Presentació: «NextMobility × TUS» (14 diapositives, amb notes a cadascuna).
Missatge de fons: **«He demostrat que l'experiència pot funcionar. Ara necessito la vostra experiència per
entendre com fer-la funcionar amb la realitat tecnològica de TUS.»**

## La meva posició (no cal dir-la literalment, però ha de ser present)
- Soc el creador i responsable de producte, **no enginyer**. No vinc a explicar-los com fer la seva part tècnica.
- He convertit una necessitat de mobilitat en un producte funcional. Ara vull entendre què cal per connectar-lo
  amb la infraestructura real de TUS i fer-ne un pilot.
- **Si em pregunten com s'ha construït:** «He treballat sobretot la part de producte, l'experiència i el
  funcionament. Per al prototip hem fet servir diferents eines, també IA per accelerar el desenvolupament. Però no
  vinc a dir-vos com heu de construir la vostra infraestructura. M'interessa entendre què es pot aprofitar, què
  caldria adaptar i què necessitem de la vostra infraestructura per portar-ho a producció.»
- **Si diuen «això ho podem fer nosaltres»:** «Perfecte. Precisament per això soc aquí. Vull entendre quina part té
  sentit que fem nosaltres, quina part podeu fer vosaltres i com convertim el prototip en una solució real.»
  Mai: «no ho podeu fer».

## Agenda (45 min; s'estira a 60 amb més conversa)
| Min | Què | Diapositives |
|---|---|---|
| 0–3 | Presentació personal i la meva posició | 1 |
| 3–8 | La idea i el canvi de punt de partida | 2–3 |
| 8–18 | El producte i **demo en directe** | 4–7 |
| 18–23 | Què hi ha darrere i què és real / simulat | 8–9 |
| 23–28 | Del prototip al pilot | 10 |
| 28–43 | **Conversa**: què volem explorar, què aporta cadascú | 11–13 |
| 43–45 | Pregunta final i pas següent concret | 14 |

La meitat de la reunió ha de ser conversa. Si van ràpid amb les preguntes, salta directament a la 11.

## Demo en directe (5 minuts, al mòbil connectat al projector, o passant el mòbil)
Prepara-ho abans:
- L'app instal·lada al mòbil i oberta un cop el mateix dia, amb la sessió iniciada («Entra sense compte»).
- La ubicació activada. Si a la sala no hi ha bona senyal, toca «Canvia» i tria «Mercat Central» com a origen.
- Per veure-ho en hora punta: **https://bus-sabadell.vercel.app/app?hora=08:15&dia=dimarts** (si la reunió és
  fora de l'horari de servei, sense això no hi hauria busos).

Recorregut:
1. Inici: «Ets a prop de la parada…» i les parades properes. *«No he hagut de fer res: ja sap on soc.»*
2. Escriu **«hospital parc tauli»** i tria l'hospital. Resultat: línia, on pujar, arriba en N min, on baixar,
   a quants metres és l'hospital. *«No he hagut de saber quina línia hi va.»*
3. **On és el bus**: el mapa va fins al bus.
4. **Segueix aquest bus**: el viatge, la teva parada, a quantes parades és.
5. (Si hi ha temps) Escriu **«Mercadona»**: diverses botigues, la més propera primer.
6. Al final, assenyala la píndola **«Dades de demostració»**: tot és simulat.

**No** busquis «Info Express» en directe: amb el cercador actual (dades obertes d'OpenStreetMap) no hi surt (vegeu a sota).

## Què NO s'ha d'ensenyar ni dir
- El repositori, el codi, l'estructura de fitxers, adreces internes de l'API, variables d'entorn o claus.
- La vista «NextMobility Control» (/xarxa) amb mètriques: són simulades i desvien la conversa cap a un panell, no cap a l'experiència.
- Que tenim accés a dades internes de TUS (no en tenim), o que l'app és oficial (no ho és).
- «Troba absolutament tots els negocis»: troba el que hi ha a OpenStreetMap. Els comerços petits que no hi són
  necessitarien un proveïdor comercial de llocs, que el prototip té preparat però no activat (decisió de cost i condicions).
- Xifres d'usuaris, d'estalvi o d'impacte: no en tenim. Cap estadística inventada.
- Dates i costos d'un pilot: «Ho hauríem de definir junts segons el que ens digueu de la integració.»

## Preguntes que em poden fer (i respostes honestes)
| Pregunta | Resposta |
|---|---|
| D'on surten les dades? | Dels horaris i recorreguts que TUS publica al web: 23 línies, 105 recorreguts, 408 parades, revisats contra els carrers d'OpenStreetMap. La posició dels busos és **simulada** a partir de l'horari. |
| Els minuts són reals? | No: són una simulació a partir de l'horari, per ensenyar l'experiència. Amb les dades reals de TUS serien reals. |
| Us heu connectat al nostre SAE o a la vostra app? | No. No s'ha fet servir cap sistema privat ni l'app oficial, ni el logotip de TUS. |
| Què necessitaríeu de nosaltres? | Saber quina dada de posició dels vehicles existeix i en quin format; si hi ha horaris oficials en un format estàndard (GTFS); cada quant s'actualitza; com s'hi pot accedir de manera segura; i les condicions d'ús. El prototip ja té una entrada per al format estàndard de temps real (GTFS-Realtime). |
| I si el nostre format és un altre? | Caldria un adaptador. Precisament per això vull entendre el vostre sistema abans de proposar res. |
| La ubicació dels usuaris on va? | Enlloc: es fa servir només al mòbil. El cercador de llocs només rep el text cercat. |
| Funciona a iPhone i Android? | Sí, al navegador i instal·lada com a app, també sense connexió després d'obrir-la un cop. |
| Seguretat? | S'ha fet una revisió de seguretat del prototip. Per a un pilot, s'adaptaria als vostres requisits. |
| Ho podem fer nosaltres? | «Perfecte, per això soc aquí…» (vegeu a dalt). |
| Per què no millorar la nostra app? | És una opció oberta: app pròpia, funció integrada a la vostra o una altra fórmula. És part del que hem de parlar. |

## Preguntes per fer-los (sense llegir-les com una llista)
- **Dades:** teniu la posició dels vehicles en temps real? En quin format i cada quant s'actualitza? Hi ha un GTFS oficial dels horaris?
- **Integració:** el SAE és propi o d'un proveïdor? Es pot obtenir una exportació o un accés de només lectura? Hi ha un entorn de proves?
- **Viabilitat:** quines condicions de seguretat i d'ús demaneu? Qui ho hauria d'aprovar (TUS, Ajuntament)?
- **Pilot:** quines 2 o 3 línies tindrien sentit? Amb quins usuaris? Què hauria de demostrar el pilot perquè fos un èxit per a vosaltres?

## Objectiu de sortida
Marxar amb **un pas concret**: una persona de contacte tècnic, una segona reunió tècnica o dades de prova.
Després, enviar en 24 h un correu breu amb l'enllaç de la demo i el resum del que s'ha acordat.

## Checklist del dia
- [ ] Mòbil carregat, app instal·lada i oberta avui, ubicació activada.
- [ ] Enllaç d'hora punta preparat: `https://bus-sabadell.vercel.app/app?hora=08:15&dia=dimarts`.
- [ ] Presentació oberta en mode presentació (pantalla completa).
- [ ] Llibreta per apuntar el que diguin. La conversa és el més important.
- [ ] Recordar: **no és una app oficial**; les posicions són simulades.
