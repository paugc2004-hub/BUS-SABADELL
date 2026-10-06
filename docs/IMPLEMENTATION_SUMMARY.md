# Resumen de implementación — evolución de Bus Sabadell en directe

Fecha: 2026-10-06 · Producción: **https://bus-sabadell.vercel.app** · API: https://bus-sabadell-api.vercel.app
Auditoría previa: [EVOLUTION_AUDIT.md](EVOLUTION_AUDIT.md) · Validación línea a línea: [LINE_AUDIT.md](LINE_AUDIT.md)

Todo lo que aparece aquí como hecho está **probado**: 69 tests unitarios/API, 33 e2e (escritorio, iPhone 13,
Android) en local **y contra producción**, y revisión visual con capturas de cada escena de la demo.

---

## 1. Qué datos se corrigieron

| Problema | Antes | Ahora |
|---|---|---|
| Sentidos | `dir` por el *nombre* de la cabecera: 11 variantes mal (p. ej. L14 sábado con las dos direcciones como "tornada"; L8 Zona Industrial → La Roureda como vuelta) | Por **geometría**: proyección de las paradas sobre el recorrido principal (`repair.ts`) |
| Picos en paradas | tus.es dibuja una ida y vuelta hasta el poste de cada parada: **1.694 picos**. El bus zigzagueaba 5–20 m en cada parada | Eliminados (`despike`): solo si el pico está junto a una parada, vuelve casi por el mismo trazo y mide ≤ 35 m. Las vueltas reales (rotondas) se conservan. Quedan 4 avisos documentados |
| F6 | 190 m + 180 m por la antigua carretera de Bellaterra (retirada de OSM en 2024) | Tramo Aeroport → Zona Industrial → Turó de Sant Pau tomado de la **L11, que hace el mismo tramo entre las mismas paradas** por la Gran Via actual |
| L12 | Cabecera Estació Centre a 43 m del recorrido | Tramo tomado de la variante L12 "per BMC" que sí pasa por la parada |
| L15 / F15 | Parecían de un solo sentido | Son **circulares** (la geometría publicada es un bucle) |
| L14 Ebre → Sau → Ebre | Dependía de la casualidad para proyectar la parada en la pasada correcta | Proyección en la **primera pasada** suficientemente cercana |

Nada se ha inventado: cada corrección sale de los propios datos (geometría de otra línea en el mismo par de
paradas, o la geometría publicada) y queda anotada en `dist/report.md`. Si no hay donante, no se toca y la
auditoría lo marca como error.

**Ejemplos del encargo que no corresponden a la red real (no se usan):** la L2 es *Can Deu ↔ La Creu de
Barberà* (no "Les Termes", que es L5/L55); "Plaça Catalunya" es la parada *Catalunya* (L5, L55, F5, F6);
"Eix Macià" es *Francesc Macià*; "bus 1023" sería un número de flota real: se usa el torn simulado `L2·01`.

## 2. Qué líneas se validaron

**23 líneas, 106 variantes, 106 sin error** (`pnpm data:audit`, también dentro de `pnpm test`):

- **Todas**: el recorrido, muestreado cada 10 m, va por el eje de una calle de OSM (≤ 20 m; error si > 60 m
  seguidos fuera); cada parada a ≤ 40 m de su punto en el recorrido y en orden; las líneas no circulares tienen
  los dos sentidos cada día que circulan y las cabeceras coinciden (± 400 m); sin picos.
- **13 líneas con relación de ruta en OSM** (L1–L5, L7, L8, L10–L12, L14, L15, L23): desviación media 1–2 m.
- **10 líneas sin relación en OSM** (L44, L55, L80, F1–F6, F15): validadas contra las calles de OSM.
- Avisos (no errores): L8 "La Roureda → Zona Industrial" acaba a 63 m del poste (punto de regulación, igual en
  las dos variantes de Zona Industrial); 4 picos residuales en L14 y F15.

La tabla completa (línea, sentido, cabecera origen/destino, nº paradas, km, expediciones, % en calle,
desviación OSM, problemas) y los tramos compartidos están en [LINE_AUDIT.md](LINE_AUDIT.md).

## 3. Lógica de simulación

| Antes | Ahora |
|---|---|
| Curva seno entre paradas: acelera y frena todo el tramo (pico = 2× la media) | **Perfil trapezoidal**: arranque a 1,0 m/s², velocidad de crucero, frenada a 1,2 m/s² hasta detenerse en la parada (triangular si el tramo es muy corto) |
| Rumbo simétrico ±25 m | Rumbo mirando 20 m adelante y 8 m atrás: gira con suavidad y no se retrasa en curvas cerradas |
| Cada vista derivaba lo suyo | **`core/src/vehicle.ts`, única fuente de verdad**: `progress` (por distancia), `prevStopIndex`, `atStopIndex`, `distToNextM`, `stopsRemaining`, `dir`, `origin`, `headsign`, `delaySec`; `stopsUntil()` ("a N paradas"); `journeyOf()` (línea temporal). La usan el motor y el `GtfsRtProvider` |
| — | `SimEngine.journey(id, t)`: horas de paso de todo el trayecto con los mismos offsets que las ETA |

Se mantiene: determinismo (posición = función pura de red + instante; semilla por expedición), dwell 8–22 s,
estados `EN_RUTA / EN_PARADA / EN_CABECERA / RETIRADA`. `RETRASADO` y `DESVIADO` existen en el tipo y en la UI,
pero **la simulación no inventa retrasos ni desvíos** (test).

Tests nuevos (`packages/core/test/vehicle.test.ts`, sobre la red real, 140 instantes de un día): el bus nunca sale
de la geometría (< 0,5 m), progreso en [0, 1], ETA nunca en el pasado y ordenadas, propera parada por delante,
rumbo hacia delante, dwell entre 1 y 23 s, frenada antes de la parada, y **la misma ETA** en el vehículo, en las
llegadas de la parada y en la línea temporal.

## 4. Componentes creados o rehechos

| Componente | Qué hace |
|---|---|
| `ui/BusVehicleMarker.tsx` + `map/icons.ts` + `ui/busGeometry.ts` | Autobús vectorial visto desde arriba (no gota, no emoji). Misma geometría en canvas (mapa) y SVG (UI). Rota con el rumbo, flecha de morro, doble contorno para contraste. Estados: en ruta, en parada (anillo), cabecera/retirada (atenuado/gris), retrasado/desviado (insignia), seleccionado (halo), seguido (pulso). Código de línea en etiqueta que no rota |
| `map/MapView.tsx` | Línea enfocada encima de todas, más gruesa, con contorno y **flechas de sentido**; el resto atenuado (no oculto). Recorrido hecho (gris discontinuo) / pendiente (color). Propera parada, "Puges aquí / Baixes aquí". En una parada: el tramo que le falta a cada bus que viene. **Seguir bus** con la cámara pegada al vehículo en cada fotograma (sin `easeTo` a saltos) |
| `views/BusCard.tsx` | Ficha: origen → destino, torn, estado, "Segons horari", fuente SIMULAT; AHORA (en parada / entre X e Y / saliendo / llegando), PRÓXIMA con cuenta atrás, DESPUÉS; CTA "Vaig a agafar aquest bus" y "Seguir bus"; línea temporal |
| `views/StopTimeline.tsx` | Paradas hechas (✓ + hora), actual (AHORA), propera, futuras (cuenta atrás + hora), el bus entre paradas con su velocidad, progreso % y km restantes; selección de parada de subida/bajada |
| `views/StopPanel.tsx` | "Mi parada": agrupa los postes del mismo nombre a < 250 m (Estació Centre = 6 postes); llegadas por línea + destino con minutos, **"a N paradas"** o "sale de cabecera a las hh:mm" |
| `views/Home.tsx` | Inicio: paradas guardadas con próximos buses; si no hay, paradas habituales **comprobadas contra la red** |
| `views/Trip.tsx` | **Modo viaje** persistente (`myBus` en el navegador): cuenta atrás, "a N paradas", a bordo, "baixes a". **Alertas contextuales** solo en cambios de estado: a 2 paradas, acaba de salir de X, la propera és la teva, és a la teva parada, baixes a la següent |
| `views/Presentation.tsx` | Demo narrada de 8 escenas sobre la app real |
| `data/derive.ts` | Zonas de parada, llegadas con vehículo y "a N paradas", "dónde está ahora" — sin calcular ETA propia |
| `pipeline/src/audit.ts`, `repair.ts` | Validación línea a línea y correcciones deducidas de los datos |

Navegación: no se han forzado cinco pestañas. **Mapa** (con el inicio "Mi parada" encima) · **Línia** · **Cercar**;
el viaje activo aparece como tarjeta sobre el mapa; "Què és real?" en el banner.

## 5. Preparado para SAE/AVL

- `VehicleState` ampliado = contrato único (zod en `apps/api/src/schemas.ts`). Un proveedor real solo tiene que
  dar posición + pattern + ETAs; `enrich()` calcula el resto igual que para la simulación.
- `GtfsRtProvider` ya usa `enrich()` y lee el retraso del `TripUpdate`: con ≥ 3 min marca `RETRASADO`.
- `HybridProvider`: temps real donde llega fresco, simulación en el resto (por línea).
- `TusSaeProvider`: interfaz + lista de lo que hay que pedir a TUS (ver [PITCH.md](PITCH.md)).
- La web ya abre el stream SSE solo cuando el servidor anuncia `provider: REALTIME`; hoy la simulación corre en el navegador.
- Todos los textos de origen salen de `v.source` ("Simulat" → "Temps real" sin tocar la UI).

## 6. Limitaciones que siguen existiendo

1. **Vehículos simulados**: posiciones interpoladas sobre horarios publicados al minuto; los segundos y los
   tiempos de parada son simulados. Sin retrasos, desvíos ni ocupación reales.
2. Flota simulada 87 buses en punta frente a ~70 reales: los torns no comparten buses entre líneas.
3. Las 10 líneas sin relación en OSM se validan contra las calles, no contra un trazado de ruta independiente.
4. Correcciones F6/L12 tomadas de otra variante en el mismo par de paradas: razonables, pero conviene que TUS lo confirme.
5. Agrupación de postes por nombre + 250 m: heurística.
6. Alertas solo dentro de la app (sin notificaciones push); `myBus` solo en ese navegador.
7. La vista esquemática de línia (`/linia/:id`) mantiene su diseño anterior (con los sentidos ya corregidos).
8. Rendimiento medido en laboratorio sin GPU (WebGL por software); en un móvil real va mejor.
9. Festivos locales de Sabadell de 2027: pendientes (`TODO(DECISION: FESTIUS-LOCALS-2027)`).

## 7. Cómo ejecutar la demo

```bash
pnpm install
pnpm dev                # http://localhost:5173
pnpm test               # unitarios + API + auditoría de la red
pnpm data:audit         # regenera docs/LINE_AUDIT.md
pnpm test:e2e           # Playwright (escritorio, iPhone 13, Android)
```

Hora forzada para enseñar en hora punta: `?hora=08:15&dia=dimarts` (añadir `&x=10` para ×10).

## 8. Presentation Mode

**https://bus-sabadell.vercel.app/presentacio** (o el botón ▶ de la barra). Si la hora actual tiene poco
servicio, se pone sola a dimarts 08:15. Recorre 8 escenas (~2–3 min) y vuelve a empezar:

1. Toda la red · 2. Línea L2 enfocada con su sentido · 3. Un bus concreto (ficha) · 4. Seguir bus ·
5. Línea temporal (×5) · 6. "Mi parada" (3 paradas por delante del bus) · 7. "Vaig a agafar aquest bus" ·
8. El reloj corre a ×10 hasta que salta el aviso real **"El teu bus és a 2 parades"**.

Controles: `←` / `→` escena, `espacio` pausa, `Esc` salir; velocidad 1× · 5× · 10× · 30×. Con la misma hora
forzada elige siempre el mismo bus (determinista). El banner "posicions simulades" está siempre visible.
