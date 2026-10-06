# Auditoría para la evolución — Bus Sabadell en directe

Fecha: 2026-10-06 · Base auditada: commit `f574f76` (https://bus-sabadell.vercel.app)

Este documento se escribió **antes** de tocar la experiencia, tras leer el código y
validar los datos. La validación línea por línea completa (106 variantes) está en
[LINE_AUDIT.md](LINE_AUDIT.md) y se regenera con `pnpm data:audit`.

---

## 1. Arquitectura actual

| Pieza | Qué es | Estado |
|---|---|---|
| `packages/data-pipeline` | Lee los extractos guardados de tus.es (JSON `trayectos` de cada página pública de línea), OSM y GTFS de la Generalitat → `apps/web/public/data/network.json` + GTFS propio + informe | Sólido, determinista |
| `packages/core` | Tipos, geodesia, tiempo Europe/Madrid (día de servicio "mediodía − 12 h"), `SimEngine` determinista, interfaz `VehicleProvider` | Sólido; la posición es función pura de (red, instante) |
| `apps/web` | Vite + React 18 + MapLibre GL + Zustand. Router propio (`/`, `/linia/:id`, `/parada/:id`, `/cercar`, `/presentacio`). PWA offline | Funciona; UX de "mapa con puntos" |
| `apps/api` | Fastify: `/v1/meta`, vehículos, SSE (snapshot + diff + heartbeat), llegadas, `GtfsRtProvider` probado con fixture | Desplegado en Vercel |

**Flujo de datos de vehículos.** El navegador crea `SimEngine(network)` y cada tick del
bucle `requestAnimationFrame` de `MapView` llama a `vehiclesAt(engine, clock.now())`.
La ficha de bus, el panel de parada y la vista de línea llaman al mismo motor con
`useNow()` (1 Hz). Como el motor es puro, mapa y paneles coinciden — pero cada vista
**deriva por su cuenta** cosas como "a cuántas paradas está" o el progreso, y algunas
no existen (progreso, paradas pasadas, línea temporal).

**Rendimiento medido (antes de evolucionar).** `snapshot` 0,3–0,9 ms con ~87 buses; el
mapa actualiza la fuente GeoJSON a 2 Hz en vista de ciudad y hasta 15 Hz con zoom; React
no se re-renderiza por posición. Soak de 8 min a ×10: heap estable 38–43 MB.

## 2. Datos actuales

| Elemento | Fuente | Calidad |
|---|---|---|
| Líneas (23) y colores | tus.es, página pública de cada línea | Oficiales |
| Recorridos (106 variantes) | Polilínea publicada por tus.es | Coinciden con OSM a 1–2 m de media en las 12 líneas comparables |
| Paradas (408) y orden | tus.es (`orden`) | Oficiales |
| Horarios | Horas de paso por parada (al minuto) de tus.es, reconstruidas en expediciones | Oficiales; segundos simulados |
| Vehículos | **Simulados** por `SimEngine`: torns encadenados, interpolación sobre la geometría | Siempre `source: 'SIMULATED'` |
| Calles para validar | OSM `highway=*` del bbox de Sabadell (nuevo: `data/raw/osm/roads-2026-10-06.json`) | Independiente de tus.es |

## 3. Problemas encontrados

### 3.1 Datos (corregidos en la fase 2 — ver `repair.ts` y LINE_AUDIT.md)

| # | Problema | Causa | Corrección |
|---|---|---|---|
| D1 | **Sentidos incorrectos** en 11 variantes (p. ej. L14 sábado: "Els Merinals → Can Roqueta" y "Can Roqueta → Els Merinals" salían las dos como sentido 1; L8 "Zona Industrial → La Roureda" como sentido 1 aunque va igual que "Estació Sud → La Roureda") | `dir` se decidía comparando el *nombre* de la cabecera de origen con el de la primera variante | El sentido se decide por **geometría**: proyección de las paradas sobre el recorrido principal (adelante = 0, atrás = 1). Afectaba a la vista de línea (buses en la vía equivocada) |
| D2 | **F6 pasa por una calle que ya no existe** (190 m + 180 m por la antigua carretera de Bellaterra, retirada de OSM en 2024) | Polilínea antigua en tus.es | El tramo Aeroport → Zona Industrial → Turó de Sant Pau se toma de la L11, que hace **el mismo tramo entre las mismas paradas** por la Gran Via actual |
| D3 | L12: la cabecera Estació Centre quedaba a 43 m del recorrido en 3 variantes | Polilínea que empieza en otro punto | Tramo Estació Centre → Tres Creus tomado de la variante L12 "per BMC", que sí pasa por la parada |
| D4 | L15/F15 parecían líneas de un solo sentido | La geometría es un bucle cerrado pero la primera y la última parada son distintas | Se marcan **circulares** cuando la geometría publicada es un bucle |
| D5 | L8 "La Roureda → Zona Industrial" acaba a 63 m del poste de la parada | Es el punto de regulación (las dos variantes de Zona Industrial empiezan/acaban en el mismo punto) | Aviso documentado, no error |
| D6 | No existía validación independiente de las 10 líneas que OSM no tiene (L44, L55, L80, F1–F6, F15) | — | `pnpm data:audit`: todo recorrido debe ir por el eje de una calle de OSM (≤ 20 m, sin tramos > 60 m fuera) y cada parada a ≤ 40 m. **106/106 variantes pasan**, se ejecuta en los tests |

**Comprobaciones sobre el brief.** Algunos ejemplos del encargo no corresponden a la red real
y **no se usan**: la L2 es *Can Deu ↔ La Creu de Barberà* (no "Les Termes", que es L5/L55);
"Plaça Catalunya" es la parada *Catalunya* (L5, L55, F5, F6); "Eix Macià" es *Francesc Macià*.
"Estació Centre" son seis postes distintos: la experiencia "Mi parada" los agrupa por nombre y
proximidad.

### 3.2 Representación y animación

| # | Problema |
|---|---|
| V1 | El bus es una **gota** de color con el código encima: se lee como un pin, no como un vehículo |
| V2 | Seleccionar un bus no destaca su línea; filtrar líneas **oculta** las demás en vez de atenuarlas; no hay sentido de circulación visible en el mapa |
| V3 | Colores muy parecidos entre líneas (L2 `#004996`, L55 `#00679a`, L7 `#0099cc`; L11 y F6 comparten `#b0d2f0`) → el color no basta, hace falta el código siempre visible y jerarquía al seleccionar |
| V4 | Entre paradas la velocidad sigue una curva seno: el bus nunca "va a velocidad de crucero", acelera y frena durante todo el tramo (pico = 2× la media) |
| V5 | Seguir bus usa `easeTo` cada 400 ms → pequeños tirones |
| V6 | No se ve la parte recorrida / pendiente del viaje ni la siguiente parada en el mapa |

### 3.3 ETA y estado

| # | Problema |
|---|---|
| E1 | `VehicleState` no tiene **progreso**, destino, sentido, parada anterior ni paradas restantes: cada vista los recalcularía |
| E2 | No hay paradas **pasadas** con hora (necesarias para la línea temporal) |
| E3 | "A N paradas" no existe en el panel de parada |
| E4 | Estados `RETRASADO`/`DESVIADO` del brief: el tipo tenía `DESVIAT` pero no `RETRASADO` |

### 3.4 Experiencia

| # | Problema |
|---|---|
| U1 | No hay "Mi parada": hay favoritas, pero ningún panel de inicio con próximos buses |
| U2 | Pulsar una llegada lleva al bus, pero no hay "Voy a coger este bus" ni modo viaje |
| U3 | No hay alertas contextuales |
| U4 | La presentación es un bucle automático sin narrativa (no enseña parada → bus → viaje) |
| U5 | El panel de parada no muestra en el mapa por dónde vienen los buses |

## 4. Plan de evolución

Regla: **no reescribir lo que funciona** (pipeline, motor puro, reloj, PWA, API, SSE).

1. **Corrección de datos** — `repair.ts` (sentidos por geometría, circulares, tramos con donante) + `audit.ts` en los tests. ✅ antes de la UI.
2. **Experiencia de mapa** — líneas: la seleccionada gruesa y por encima, el resto atenuadas (no ocultas); flechas de sentido sobre la línea enfocada; código de línea siempre junto al bus; parte recorrida/pendiente del viaje; siguiente parada y "mi parada" destacadas.
3. **Experiencia de bus** — `BusVehicleMarker`: silueta vectorial de bus vista desde arriba (canvas para el mapa, SVG para la UI), rota con el rumbo, código de línea en una etiqueta que no rota, estados (en ruta, en parada, cabecera, retrasado, desviado, retirada, seleccionado, seguido).
4. **Experiencia de parada** — "Mi parada": agrupación de postes por zona; próximas llegadas con minutos, "a N paradas", hacia dónde va; en el mapa, los buses que vienen y el tramo que les falta.
5. **Seguimiento de viaje** — `StopTimeline` (pasadas / actual / futuras), progreso por distancia, "Seguir bus" con cámara suave por fotograma, "Voy a coger este bus" → modo viaje persistente (`myBus`) con alertas contextuales.
6. **Simulación** — perfil trapezoidal (aceleración ~1 m/s², crucero, frenada ~1,2 m/s² hasta la parada), dwell; `journey()` en el core como **única fuente** de ETA, progreso, paradas restantes y línea temporal.
7. **UI/UX** — panel de inicio en el mapa (no 5 pestañas): Mapa · Línies · Cercar; tarjetas de 20–24 px de radio con jerarquía; mismo lenguaje visual en móvil (bottom sheets) y escritorio (panel lateral).
8. **Performance** — mantener: posiciones fuera de React, GeoJSON a frecuencia adaptativa; el seguimiento usa `jumpTo` por fotograma solo mientras se sigue.
9. **Preparación SAE/AVL** — el `VehicleState` ampliado sale del motor y lo puede rellenar igual un `GtfsRtProvider`/`TusSaeProvider`; `RETRASADO`/`DESVIADO` y `delaySec` existen en el tipo, pero la simulación **no inventa retrasos**: solo los mostrará un proveedor real.

### Honestidad (se mantiene en todas las fases)
Banner fijo "Demo · posiciones simuladas…", etiqueta "Simulat" en ficha, parada y viaje; nunca
"GPS en directo" ni "datos oficiales TUS"; sin logotipo de TUS; atribución OSM visible.
