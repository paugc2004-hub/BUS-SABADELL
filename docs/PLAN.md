# Pla i decisions — Bus Sabadell en directe

Estat: H0–H10 implementats (vegeu "Estat per hites"). Aquest document recull l'arquitectura final,
les decisions (i les alternatives descartades) i els riscos.

## 1. Descobriment (H0) — què vam trobar

Informe complet: [H0-DESCOBRIMENT.md](H0-DESCOBRIMENT.md).

- **Llista oficial (tus.es, 2026-10-06): 23 línies.** Feiners/dissabtes: L1, L2, L3, L4, L44, L5, L55, L7, L8,
  L10, L11, L12, L14, L15, L23, L80. Festius: F1–F6, F15. (L14ds no existeix; L12, F5, F6 i F15 no eren a la llista inicial.)
- **OSM:** 49 relacions `route` + 12 `route_master` amb `network="Transports Urbans de Sabadell"`. Només cobreixen
  **13 de 23 línies** (falten L44, L55, L80 i totes les F); 4 relacions de la L4 són buides.
- **tus.es publica a cada pàgina de línia** (HTML públic, sense API) un JSON `trayectos` amb: recorregut (polilínia),
  parades amb coordenades i ordre, i **hores de pas per parada**, separades per feiners `(fn)`, dissabtes `(ds)`
  i, per a les F, festius. Cobreix les 23 línies.
- La geometria de tus.es coincideix amb OSM a **1–2 m de mitjana** (p95 ≤ 11 m) a les 12 línies comparables;
  la L23 d'OSM és antiga.

## 2. Decisions que canvien l'especificació

| Especificació | Decisió | Per què |
|---|---|---|
| OSM com a font de la xarxa | **tus.es com a font principal**, OSM com a contrast | OSM només té 13/23 línies; tus.es té les 23, és la font de l'operador i coincideix amb OSM a 1–2 m. |
| `tus-horaris.yaml` amb freqüències transcrites a mà dels PDF | **Hores de pas per parada de tus.es**, reconstruïdes en expedicions | Són els horaris publicats reals (no estimacions), parada a parada. Elimina l'error humà de transcripció. L'override manual continua a `overrides.yaml`. |
| Posicions a partir de freqüències | Posicions interpolades entre les hores de pas publicades | Més fidel; l'origen continua sent `SIMULATED` (el que fa el motor és interpolar). |
| Backend com a font de veritat obligatòria | **El motor corre també al navegador** i la web funciona sense backend | Motor determinista ⇒ client i servidor veuen el mateix. Elimina el risc de cold start i de wifi a la reunió. El backend continua existint i és on entrarà el temps real. |
| Fly/Railway/Render per al backend | **Vercel** (web estàtica + funció serverless per a l'API) | L'usuari ja té compte. Com que el motor és una funció pura del rellotge, cada instància calcula el mateix sense estat compartit. L'SSE dura fins a 300 s i el navegador reconnecta sol. |
| `frequencies.txt` al GTFS propi | `stop_times.txt` explícit | Tenim hores reals per expedició; no cal aproximar per freqüències. |
| Validació amb `gtfs-validator` (Java) al build | Validació al **CI** (GitHub Actions amb Java); en local és opcional | Aquest equip no té Java instal·lat. El build local no s'ha de trencar per això. |
| Mapa base CARTO / Protomaps / OpenFreeMap | **OpenFreeMap "dark"** → CARTO → fons sòlid sense connexió | OpenFreeMap no té límits d'ús ni clau; CARTO té condicions per a ús comercial. |
| Número de vehicle tipus "bus 1023" | Etiqueta de **torn simulat** `L1·03` | Un número de 4 xifres semblaria un número de flota real de TUS. |

## 3. Arquitectura

```
data/raw (tus.es JSON, OSM, GTFS Generalitat) ──► packages/data-pipeline ──► apps/web/public/data/network.json (116 KB gzip)
                                                     │                        apps/web/public/data/interurbans.json
                                                     ├─► dist/gtfs/*.txt + dist/gtfs.zip
                                                     └─► dist/report.md
packages/core  (tipus, geo, temps Europe/Madrid, SimEngine, VehicleProvider)
   ├─ apps/web  (React + MapLibre)  — simula al navegador; opcionalment s'enganxa a l'API (VITE_API_URL)
   └─ apps/api  (Fastify)           — mateix motor; SSE; GtfsRtProvider/HybridProvider per al temps real
```

### Motor (packages/core/src/sim/engine.ts)
- Expedicions = sortides de capçalera publicades × perfil de temps per parada.
- Hores al minut → corba temps-distància suau dins la finestra de cada minut publicat (si no, tots els buses
  arribarien a les parades al segon :00 alhora).
- Torns: encadenament FIFO d'expedicions de la mateixa línia a la mateixa capçalera (≤ 350 m, descans ≥ 60 s).
- Posició = funció pura de (xarxa, instant). Interpolació per distància sobre la geometria amb corba de velocitat
  sinusoïdal (arrencada i frenada suaus) i temps de parada de 8–22 s amb PRNG llavorat per expedició.
- Dia de servei amb origen "migdia − 12 h": hores > 24:00 i canvis d'hora correctes.
- Rendiment: 0,3 ms per tick amb ~85 buses (objectiu < 2 ms).

### Proveïdors
`SimulatedProvider` (ara) · `GtfsRtProvider` (provat amb fixture .pb) · `HybridProvider` (temps real si és fresc,
simulació a la resta) · `TusSaeProvider` (només interfície + llista del que cal demanar a TUS).

### Per què SSE i no WebSocket
Unidireccional (servidor → client), passa per proxies i CDN, reconnexió nativa amb `retry` i `Last-Event-ID`,
i funciona en plataformes serverless amb streaming. Heartbeat cada 15 s.

## 4. Riscos

| Risc | Mitigació |
|---|---|
| tus.es canvia el format de la pàgina | El build usa l'extracte versionat a `data/raw/tus/<data>/`; `--refresh` falla amb un missatge clar si no troba `trayectos`. |
| Ús de dades de tus.es | Són dades públiques del web de l'operador, descarregades rarament (23 peticions en sèrie), citades a la UI i als documents. Cap API privada. A la reunió es demana permís explícit i un GTFS oficial. |
| Flota simulada > flota real (87 vs ~70–90) | Els torns no comparteixen buses entre línies (TUS sí ho fa). Documentat a l'informe; no afecta l'aspecte. |
| Mapa base caigut o sense límits | Tres nivells de fallback; amb el mode sense connexió les línies i buses continuen visibles. |
| Wifi de la sala | PWA amb service worker: app, xarxa i fonts en memòria cau; funciona sense xarxa. |
| Festius locals de 2027 | `TODO(DECISION: FESTIUS-LOCALS-2027)` visible a la UI ("Què és real?") i a l'informe. |

## 5. Estat per hites

| Hita | Estat | Notes |
|---|---|---|
| H0 Descobriment | ✅ | Overpass + tus.es + GTFS; informe amb xifres |
| H1 Esquelet | ✅ | pnpm workspaces, TS estricte, ESLint, Prettier, Vitest, Playwright, CI, CLAUDE.md |
| H2 Pipeline de xarxa | ✅ | 23 línies, 106 variants, 408 parades; informe `dist/report.md` |
| H3 Horaris i calendari | ✅ | Hores de tus.es; festius verificats 2026–2027; GTFS propi |
| H4 Motor | ✅ | Tests de mitjanit, canvi d'hora, festius, determinisme, propietats (fast-check) |
| H5 Backend | ✅ | Fastify, SSE, contractes zod, GtfsRtProvider amb fixture |
| H6 Frontend nucli | ✅ | Mapa, buses, fitxa, filtre, banner, i18n |
| H7 Vistes secundàries | ✅ | Vista de línia, parada, cercador, avisos, interurbans |
| H8 Presentació + offline | ✅ | Tour automàtic, hora forçada per URL, PWA |
| H9 Poliment | ✅ (parcial) | Accessibilitat i rendiment revisats; Lighthouse: vegeu README |
| H10 Desplegament + pitch | ✅ | URL pública a README; `docs/PITCH.md` |

## 6. Preguntes obertes (només les pot respondre el Pau)
1. Data de la reunió amb TUS/Ajuntament (per triar l'hora forçada de la demo).
2. Domini propi curt (ara: subdomini de vercel.app).
3. Repositori a GitHub públic o privat (el CLI de GitHub no està autenticat en aquest equip).
