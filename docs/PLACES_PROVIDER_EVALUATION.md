# Proveïdor de llocs — avaluació

Data: 2026-10-07. Objectiu: trobar **qualsevol destí real** (comerços petits, adreces, equipaments, barris)
a Sabadell i rodalia, sense una llista manual.

## Prova real (2026-10-07, des d'aquest equip)
| Cerca | Photon (OSM) | Nominatim (OSM) |
|---|---|---|
| «Info Express» (botiga d'informàtica, Can Oriach) | ✖ no hi és | ✖ no hi és |
| «Mercadona» | ✔ 4 a Sabadell + Castellar, amb carrer | — |
| «Hospital Parc Taulí» | ✔ hospital i parada | — |
| «Decathlon» | ✔ Rambla 91 (Sabadell), Terrassa, Sant Cugat… | — |
| «Carrer de Fiveller 50» | ✔ portal amb número | — |
| «Rambla 100» | ~ el carrer, no el número (a OSM, a Sabadell hi ha pocs números de portal) | — |
| Latència (Photon públic, primera vegada) | 4–5 s | — |

**Conclusió de la prova:** «Info Express» **no és a OpenStreetMap**. Cap proveïdor basat en OSM (Photon, Nominatim,
Pelias amb OSM) el trobarà mentre algú no l'hi afegeixi. Per als comerços petits cal un proveïdor comercial.

## Comparació
| Criteri | Photon (komoot) | Nominatim públic | Pelias (allotjat per nosaltres) | Google Places (New) | Mapbox Search | HERE |
|---|---|---|---|---|---|---|
| Comerços petits | Mitjana (el que hi ha a OSM) | Mitjana | Mitjana (OSM + OA) | **Molt alta** | Alta | Alta |
| Cobertura de Sabadell | Bona en equipaments i carrers | Igual | Igual | Molt bona | Bona | Bona |
| Cerca mentre s'escriu | ✔ hi està pensat | ✖ **prohibit** per la política d'ús | ✔ | ✔ (Autocomplete) | ✔ | ✔ |
| Clau d'API | No | No | No (el servidor és nostre) | **Sí (servidor)** | Sí | Sí |
| Cost | Gratuït, ús raonable | Gratuït, màx. 1 petició/s | Servidors propis (Elasticsearch) | Per petició, amb un volum gratuït mensual | Per sessió | Freemium |
| Llicència de les dades | ODbL (cal atribució) | ODbL | ODbL / variades | Condicions de Google: atribució «Google Maps» | Condicions de Mapbox | Condicions de HERE |
| Memòria cau permesa | Sí (ODbL) | Sí, amb condicions | Sí | **Només el `place_id`** | Restringida | Restringida |
| Privacitat | Sense clau ni compte; la petició la fa el servidor | Igual | Total | Google rep el text cercat | Mapbox rep el text | HERE rep el text |
| Latència | 0,3–5 s (servei públic, sense SLA) | ~1 s | Baixa | Baixa | Baixa | Baixa |
| Integració | Molt fàcil | Fàcil | Feixuga | Fàcil (servidor) | Fàcil | Fàcil |
| Escalabilitat | Limitada (servei públic) → es pot allotjar | No per a producció | ✔ | ✔ | ✔ | ✔ |

## Decisió
**Arquitectura amb proveïdor intercanviable** (`PlacesProvider`), en tres capes:

1. **Nomenclàtor local** (ja existia): 1.680 carrers i ~1.355 llocs d'OSM, amb barri i municipi, que viatgen dins l'app. És instantani, funciona sense connexió i no envia res a ningú.
2. **Proveïdor remot per defecte: Photon**. Sense clau, ODbL i pensat per cercar mentre s'escriu. Cobreix supermercats, cadenes, equipaments, adreces amb número quan OSM les té, i carrers de tots els municipis.
3. **Google Places (New), opcional**: s'activa sol si es posa `GOOGLE_PLACES_API_KEY` a les variables d'entorn **del servidor** a Vercel. Si Google falla (quota, clau), es torna a Photon. És el que farà trobar «Info Express» i els comerços que no són a OSM.

Per què no Google per defecte: cal un compte de facturació i una clau, té cost per petició i les seves condicions no deixen guardar els resultats. Ho ha de decidir el propietari del projecte.
Per què no Nominatim: la seva política d'ús prohibeix l'autocompletat.

## Condicions que respectem
- **OSM/ODbL**: atribució «© OpenStreetMap contributors · Photon» sota els resultats remots (i al mapa, com sempre).
- **Photon**: s'identifica l'app amb un User-Agent amb la URL. Sense rànquings massius: hi ha espera després de teclejar (*debounce*), un mínim de 3 lletres, memòria cau i límit de ritme.
- **Google** (si s'activa):
  - Atribució «Google Maps» sota els resultats.
  - Cap memòria cau del contingut: la resposta va amb `no-store` i no es desa al servidor.
  - La clau és només al servidor; mai `VITE_*`.
- **Cobertura honesta**: l'app no diu «tots els negocis». Si no el troba: «No hem trobat aquest lloc. Prova amb una adreça, un carrer o un altre nom.»

## Següents passos possibles
- Posar la clau de Google a Vercel per cobrir els comerços petits (amb un límit de despesa a Google Cloud).
- Allotjar el nostre Photon (o Pelias) només amb el Vallès Occidental, per tenir latència baixa i no dependre d'un servei públic.
- Ampliar el nomenclàtor local amb tots els comerços d'OSM de la zona (instantani i sense connexió).
- Sumar dades obertes municipals (equipaments de Sabadell), si la llicència ho permet.
