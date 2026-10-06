# Dades: fonts, llicències i què és real

## Fonts

| Font | Què aporta | Fitxers | Llicència / obligació | Consulta |
|---|---|---|---|---|
| **tus.es** — pàgines públiques de cada línia (`/index.php/ca/informacio-de-les-linies/linea/<línia>`) | Recorreguts, parades (id, nom, coordenades, ordre), hores de pas per parada (feiners, dissabtes, festius), color oficial | `data/raw/tus/2026-10-06/*.json` (extracte; l'HTML no es versiona) | Informació pública de l'operador. Es cita la font a la UI. No s'usa cap API privada ni l'app de GeoActio. | 2026-10-06 |
| **OpenStreetMap** (Overpass) | Contrast de recorreguts; mapa base | `data/raw/osm/tus-full-2026-10-06.json` | ODbL — "© OpenStreetMap contributors" visible al mapa | 2026-10-06 |
| **GTFS autobusos interurbans** (Generalitat de Catalunya) | Línies, parades i horaris interurbans a Sabadell i Sant Quirze | ZIP a `data/raw/gtfs/` (no versionat); extracte `data/raw/gtfs/interurbans-sabadell.json` | Dades obertes de la Generalitat; cal citar la font | ZIP del 2026-09-23 |
| **Calendari de festes** | Festius estatals, de Catalunya i locals de Sabadell | `data/config/festius.yaml` | Dades oficials (DOGC, Ajuntament) | 2026-10-06 |
| **OpenFreeMap / OpenMapTiles** (mapa base fosc) | Fons del mapa | — | Atribució "OpenFreeMap © OpenMapTiles · © OpenStreetMap contributors" | — |
| **CARTO Dark Matter** (alternativa) | Fons del mapa si falla OpenFreeMap | — | Atribució "© CARTO · © OpenStreetMap contributors" | — |

## Real vs. simulat

**Real (publicat):** recorreguts, parades, ordre de parades, hores de pas per parada al minut, colors de línia,
festius, horaris interurbans teòrics.

**Simulat (ho calcula el motor):**
- La posició de cada bus entre parades (interpolació per distància al llarg del recorregut).
- Els segons dins de cada minut publicat (corba suau dins la finestra `[mm:00, mm:59]`).
- La darrera parada de cada trajecte, que tus.es publica sense hora (s'extrapola amb la velocitat mitjana).
- Els temps de parada (8–22 s) i quin bus fa cada expedició (torns encadenats).
- No hi ha retards, desviaments ni ocupació reals.

Cada vehicle porta `source: 'SIMULATED'`; la UI ho mostra al banner fix, a la fitxa de bus i al panell de parada.

## Pipeline

`pnpm data:build` (determinista, sense xarxa) → `apps/web/public/data/network.json`, `interurbans.json`,
`dist/gtfs/`, `dist/gtfs.zip`, `dist/report.md`.

`pnpm data:refresh` torna a descarregar (23 pàgines de tus.es en sèrie amb 1 s de pausa, una consulta Overpass
amb servidors alternatius i el ZIP de la Generalitat). Fer-ho rarament.

### Reconstrucció d'expedicions
Les llistes d'hores de cada parada barregen passos d'altres variants de la mateixa línia. Per a cada sortida de
capçalera se segueix l'expedició parada a parada triant l'hora més coherent amb el perfil mitjà (dues passades).
Si dues variants comparteixen capçalera i hora de sortida, l'expedició es queda a la variant les parades pròpies
de la qual tenen hora. Es descarten sortides amb menys del 50 % de parades casades o velocitat comercial fora de
5–40 km/h (vegeu l'informe).

### Correccions deduïdes de les dades (`geometry.ts`, `repair.ts`)
- **Punxes**: tus.es dibuixa una anada i tornada fins al pal de cada parada. Es treu el vèrtex si és a ≤ 12 m
  d'una parada, el camí torna gairebé pel mateix traç (< 40°) i mesura ≤ 35 m (o si és una tornada exacta).
- **Sentit** per geometria (proximitat de les parades sobre el recorregut principal), no pel nom de la capçalera.
- **Circulars**: també quan la geometria publicada és un bucle tancat.
- **Trams defectuosos** (fora de carrer o parada lluny): es substitueixen pel tram d'una variant que fa el mateix
  parell de parades consecutives i que valida. Avui: F6 (antiga carretera de Bellaterra) i L12 (Estació Centre).

### Sentits únics (`oneway.ts`)
Els carrers d'OSM es descarreguen amb etiquetes (`oneway`, `oneway:bus`, `oneway:psv`, `busway=opposite_lane`,
rotondes). Un tram a contrasentit es repara amb una variant que fa les mateixes parades pel sentit permès (F4,
c. de Calderón → tram de la L4) o, si no n'hi ha, la variant s'exclou (L4 «Can Roqueta IES», c. de Can Fadó).

### Auditoria (`pnpm data:audit`)
Cada variant es contrasta amb els carrers d'OSM (`data/raw/osm/roads-2026-10-06.json`) i, si n'hi ha, amb la
relació de ruta d'OSM. Resultat a `docs/LINE_AUDIT.md`; els tests fallen si alguna variant té errors.

### Correccions manuals
`data/config/overrides.yaml`: excloure trajectes, forçar colors. `data/config/avisos.yaml`: avisos de servei
(talls de carrer, desviaments) amb el text en català i castellà i l'enllaç a la notícia de tus.es.
Els avisos que TUS publica a cada parada (`msgincidencia`) s'afegeixen sols.

## Pendents
- `TODO(DECISION: FESTIUS-LOCALS-2027)`: festes locals de Sabadell de 2027 (encara no publicades).
- Validació del GTFS propi amb `gtfs-validator` de MobilityData: al CI (cal Java).
- Horaris d'agost/estiu: tus.es publica variants d'estiu (p. ej. F15/L15) en PDF; l'extracte actual és el de setembre de 2026.
