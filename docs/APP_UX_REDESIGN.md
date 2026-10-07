# App — redisseny UX (fases 2, 4 i 5)

## Producte
- **Usuari**: qualsevol persona que agafa el bus urbà de Sabadell; sovint no sap el nom del carrer, sí el del lloc.
- **Problema**: «Vull anar a un lloc. Quin bus agafo, on el pujo, on baixo i quan passa?»
- **Proposta de valor**: *Digues on vols anar i et diem quin bus agafar.*
- **Core loop**: obrir → (ubicació automàtica) → escriure destí → **millor opció** → veure el bus → agafar-lo (viatge) → avís en arribar.
- **Fora d'abast**: trens, Rodalies, FGC, metro, interurbans, multimodalitat, navegació a peu pas a pas, estadístiques.

## Pantalles (una pregunta cadascuna)
| Pantalla | Pregunta | Contingut |
|---|---|---|
| Entrar / Crear compte | — | correu + contrasenya; «Entra sense compte» (demo) |
| Ubicació (una vegada) | — | per què la demanem; «Permet» / «Ara no» |
| **Inici** | On vols anar? | «Hola, Pau», on ets, cercador, parades a prop (2–3, amb el proper bus) |
| **Resultat** | Quin bus agafo? | **Millor opció**: línia + direcció, **Puja a** (parada, a quants metres), **arriba en N min**, **Baixa a** (parada, quantes parades), trajecte i hora d'arribada; botons *Agafaré aquest bus* · *On és el bus* · *Recorregut*. Fins a 2 opcions més, compactes. |
| Bus | On és ara? | ara a…, propera, la teva parada, línia temporal, mapa només amb aquest bus |
| Viatge | Quant falta? | la teva parada / baixes a, minuts, a N parades, pista, «Deixa de seguir»; avisos |
| Parada | Quan arriba el meu bus? | propers busos (un temps per fila) |
| Línia | Per on va? | sentit, busos ara, recorregut amb els busos |
| Mapa | Què passa a la xarxa? | xarxa sencera (secundari) |
| Compte | — | nom, correu, tancar sessió; les meves parades (secundari) |

## Decisions
- **Res de pas a pas a peu.** Només la distància fins a la parada de pujada («a 300 m») com a context; el tram final
  no es descriu. Si el destí és a tocar, una línia discreta «És a prop: hi pots anar a peu».
- **«Millor opció»** = puntuació (no només l'hora d'arribada): arribada estimada + penalització per transbord
  (+5 min), per caminar (+0,5 min per minut a peu) i per un bus que encara no ha sortit de capçalera (+1 min).
  Es mostra només l'etiqueta; el càlcul no.
- **Mapa contextual**: al resultat i al viatge, només el recorregut de l'opció i el(s) seu(s) bus(os); la resta de la
  xarxa, amagada. El mapa sencer viu a la pestanya Mapa.
- **Entrada**: l'app instal·lada s'obre a l'app (mai a la landing). Sense sessió → Entrar. Després → ubicació (un cop) → Inici.
- **Navegació**: Inici · Mapa · Línies · Compte.
- **Interurbans fora** (no són TUS).

## UI
Tema clar (sistema existent: 32/24/18/16/14/12 + 48 per als minuts). Etiquetes de secció en majúscules petites
(«PUJA A», «BAIXA A»), xip de línia gran + «Direcció …» (mai només color). Estats: «Ara mateix», «Arriba en 3 min»,
«A l'hora», «2 min tard», «Retard important». Bus al mapa: silueta amb codi i rumb.
