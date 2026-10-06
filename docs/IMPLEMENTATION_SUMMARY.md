# Resumen de implementación — NextMobility Sabadell (antes «Bus Sabadell en directe»)

> **2026-10-07 · Marca, landing y cuentas.** Nuevo nombre **NextMobility Sabadell** con logo propio (una «N» dibujada
> como recorrido). Landing pública en `/` con capturas reales de la app (no carga el mapa). Login **obligatorio**
> para usar la app (`/app` y el resto de vistas): registro, entrar, salir, compte de demostración sin contraseña.
> **Las cuentas son ficticias por ahora**: se guardan solo en el navegador (contraseñas con PBKDF2-SHA-256 y sal,
> nunca en claro) y la pantalla lo dice. Para pasar a cuentas reales basta otra implementación de `AuthProvider`
> (`apps/web/src/auth/auth.ts`) con Supabase/Firebase. Paradas y viaje se guardan por usuario. PWA instalable
> (`start_url: /app`, botón «Instal·la l'app» en la landing). Tests: 5 unitarios de cuentas + 3 e2e
> (landing, ruta protegida → /entra → vuelta, registro/salir/entrar/contraseña incorrecta); 51 e2e en total.

Actualizado: 2026-10-06 (segunda iteración) · Producción: **https://bus-sabadell.vercel.app** ·
Presentación: **/presentacio** · API: https://bus-sabadell-api.vercel.app
Auditoría previa: [EVOLUTION_AUDIT.md](EVOLUTION_AUDIT.md) · Validación de la red: [LINE_AUDIT.md](LINE_AUDIT.md)

Todo lo marcado como hecho está probado: **73 tests unitarios/API** (incluida la auditoría de la red) y
**42 e2e** (14 escenarios × escritorio, iPhone 13, Android) en local **y contra producción**, más revisión
visual con capturas de escritorio y móvil de cada vista y de las 10 escenas de la demo.

---

## 1. Qué se ha cambiado

| Área | Antes | Ahora |
|---|---|---|
| Primera pantalla | Mapa con 80 buses | **Inicio**: "El teu proper bus" (minutos, a N paradas, puntualidad, tramo que le falta, Seguir / Vaig a agafar aquest bus), mis paradas, cerca de mí, acceso al mapa en directo. El mapa sigue detrás |
| Navegación | Cercar · Mapa · Línia | **Inici · Mapa · Línies · Xarxa** (escritorio) · barra inferior **Inici · Mapa · Línies · Els meus** (móvil) |
| Búsqueda | Pestaña aparte: paradas y líneas | **Buscador global** en el inicio: líneas, paradas (una por zona), **destinos**; teclado y combobox accesible |
| Línea | Esquema horizontal a pantalla completa | **Panel sobre el mapa**: sentido (pestañas), buses activos, frecuencia, duración, horario, próximos buses, recorrido vertical con cada bus entre sus paradas y su puntualidad; la línea se enfoca en el mapa |
| Puntualidad | Todo a su hora | "A l'hora" / "+2 min" / "−1 min" en ficha, parada, viaje, línea, línea temporal (hora programada tachada) |
| Vista para TUS | — | **Xarxa en directe** (/xarxa): buses en servicio, % puntuales (−1/+3 min), con retraso ≥ 3 min, incidencias publicadas, distribución de puntualidad, flota y retraso medio por línea |
| Estado de red | — | "● Simulació en directe · Sense incidències publicades" en la cabecera |
| Presentación | 8 escenas | **10 escenas** (+ red para TUS + "Amb el SAE de TUS" con la arquitectura); hora, fecha, línea y reinicio |
| Diseño | 17 tamaños de letra, bordes en todo | Escala **32/24/18/16/14/12**, radios 12/16/20/24, superficies con fondo y sombra (sin bordes) |
| Mapa | Etiquetas de todos los buses | Etiquetas **sin superposición, por prioridad** (seleccionado > destacado > resto); el contenido se centra en la parte visible según el panel abierto |
| Metadatos | title + description | **Open Graph** con imagen real de la app (1200×630), canonical, Twitter card |

Iteración 1 (se mantiene): marcador vectorial `BusVehicleMarker`, línea enfocada con flechas de sentido,
ficha de bus, panel de parada con zonas de postes, `StopTimeline`, seguir bus por fotograma, "Vaig a agafar
aquest bus" con alertas, PWA sin conexión.

## 2. Qué se ha eliminado

- `views/LineView.tsx` (esquema horizontal SVG con su propio cálculo de posición `trackPosition` → duplicado).
- `views/SearchPanel.tsx` (sustituido por `SearchBox` + índice de líneas).
- **L4 "El Poblenou – Can Roqueta IES – La Roureda"** (1 expedición de laborables): el recorrido publicado va
  100 m a contrasentido por el c. de Can Fadó y ninguna otra línea pasa por ahí. Mejor no mostrarla
  (`data/config/overrides.yaml`, con el motivo).
- `backdrop-filter` en los paneles y animaciones de `box-shadow` (causa medida de la caída de fps, §8).

## 3. Qué se ha refactorizado

- **Capa de datos agnóstica del proveedor** (`apps/web/src/data/vehicles.ts`): `vehiclesAt`, `vehicleById`,
  `arrivalsAt`, `journeyFor`. Ninguna vista llama al motor para datos en directo; con un feed real, las
  llegadas y la línea temporal se construyen de las ETA del vehículo sin tocar componentes.
- **ETA con hora programada y estimada**: `StopEta.scheduledAt`, `Arrival.scheduledAt/delaySec`,
  `JourneyStop.scheduledAt`.
- Navegación con **vista de base** (`base`, `back()`): cerrar una parada o un bus vuelve a donde estabas.
- Pipeline: `oneway.ts` (sentidos únicos), reparación con donante también para contrasentidos.

## 4. Datos validados y líneas verificadas

**23 líneas, 105 variantes, 0 errores, 9 avisos documentados** (`pnpm data:audit`, dentro de `pnpm test`):

| Comprobación | Fuente independiente | Resultado |
|---|---|---|
| Recorrido por calles | Ejes de calle de OSM (6.976 vías) | 100 % de variantes; error si > 60 m seguidos fuera |
| **Sentidos únicos** | `oneway`, `oneway:bus`, `busway=opposite_lane`… de OSM | 0 contrasentidos > 40 m (F4 corregida; L4 IES eliminada); 4 avisos de 20 m en cruces |
| Paradas sobre el recorrido y en orden | Coordenadas de tus.es | ≤ 40 m (cabecera L8 Zona Industrial a 63 m: punto de regulación, aviso) |
| Desviación respecto a la ruta OSM | 13 líneas con relación OSM | 1–2 m de media |
| Ambos sentidos y cabeceras | — | Todas las líneas no circulares, cada día que circulan |
| Picos | — | 1.694 eliminados; 4 residuales con aviso |

Correcciones deducidas de los propios datos (nunca inventadas): sentido por geometría (11 variantes),
L15/F15 circulares, F6 y L12 (tramo de otra variante entre las mismas paradas), **F4 c. de Calderón**
(tramo de la L4 entre Vallès y Mercat Central, mismo sentido que otras 17 variantes).

Ejemplos del encargo que no corresponden a la red real y **no se usan**: "L2 Can Deu → Les Termes" (la L2 es
Can Deu ↔ La Creu de Barberà), "Plaça Catalunya" (es *Catalunya*, L5/L55/F5/F6), "Eix Macià" (*Francesc Macià*),
"Vehicle 214"/"bus 1023" (sería un número de flota real; se usa el torn simulado `L2·01`).

## 5. Qué queda simulado

| Simulado | Cómo |
|---|---|
| Posición | Interpolación por distancia sobre la geometría real, perfil trapezoidal (1,0 m/s² / crucero / 1,2 m/s²) con pequeñas variaciones de ritmo |
| Dwell | 8–22 s deterministas |
| **Retrasos** | Por expedición y fecha (semilla), deriva por parada, más en hora punta, regulación al pasar de +2 min, propagación en cabecera; acotados a [−90 s, +9 min]. Distribución (laborable): 62 % ±1 min, 30 % +1–3 min, 6 % ≥ +3 min, 2 % adelantados |
| Torns | Qué bus hace cada expedición (IDA → cabecera → VUELTA, identidad conservada) |
| Métricas de /xarxa | Derivadas de la flota simulada, etiquetadas como tales |

Siempre visible: banner "Demo · posicions simulades…", "Simulació en directe", etiqueta "Simulat" en cada
bus/parada/viaje, y en la puntualidad ("Retard simulat" en la etiqueta accesible). Sin incidencias inventadas:
`/xarxa` muestra solo las publicadas por TUS (hoy, ninguna).

## 6. Cómo conectar el SAE/AVL de TUS

```
SAE/AVL TUS ──► TusSaeProvider (o GtfsRtProvider si TUS publica GTFS-RT)
                 └─ por vehículo: posición, trip/pattern, ETAs y retraso
                     └─ enrich(pattern, base)  ← packages/core/src/vehicle.ts (misma función que la simulación)
                         └─ VehicleState ──► API (/v1/vehicles, SSE) ──► web: data/vehicles.ts ──► toda la UI
```

1. Implementar `TusSaeProvider` (interfaz ya en `apps/api/src/providers/tusSae.ts`) o apuntar
   `GtfsRtProvider` al feed: `PROVIDER=gtfsrt GTFS_RT_VEHICLES=<url> GTFS_RT_TRIPS=<url> GTFS_RT_POLL_MS=10000`
   en el servidor Node (`apps/api/src/index.ts`; la función de Vercel hoy solo sirve la simulación). Ya probado
   con fixtures `.pb`.
2. `HybridProvider` mezcla por línea: tiempo real donde llega fresco (< 90 s), simulación en el resto → piloto
   con 2–3 líneas sin tocar nada más.
3. La web abre el SSE cuando `/v1/meta` anuncia `provider: REALTIME`; `data/vehicles.ts` sustituye los
   vehículos y llegadas de esas líneas. `RETRASADO` sale del `delay` real del TripUpdate (≥ 3 min).
4. Lo que hay que pedir a TUS: [PITCH.md](PITCH.md).

**Correspondencia con el `VehicleState` del encargo** (se mantienen los nombres existentes para no reescribir):
`vehicleId`→`id` · `lineId`→`routeId` · `directionId`→`dir` · `tripId`→`tripKey` · `currentStopId`→`stopIds[atStopIndex]` ·
`nextStopId` · `progress` (por distancia) · `scheduledArrival`/`estimatedArrival`→`etas[0].scheduledAt`/`etas[0].at` ·
`delaySeconds`→`delaySec` · `status` (6 estados) · `source` `SIMULATED | SCHEDULED | REALTIME` · `timestamp`.

## 7. Arquitectura (sin cambios de fondo)

`packages/core` (motor puro + `vehicle.ts`, única fuente de verdad) · `apps/web` (React + Zustand + MapLibre,
simula en el navegador) · `apps/api` (Fastify, SSE, proveedores) · `packages/data-pipeline` (tus.es + OSM →
red validada). Posición = función pura de (red, instante): recargar no cambia nada.

## 8. Rendimiento (medido, no supuesto)

Herramienta: `scripts/perf-probe.mjs` (20 s por vista, Chromium **sin GPU**: valores pesimistas) y Lighthouse
móvil (`scripts/lighthouse.mjs`).

| Vista (escritorio, producción) | Antes (iter. 1) | Tras rediseño (con blur + animaciones) | Final |
|---|---|---|---|
| Inicio | 60 fps · 0 ms tareas largas · 26 MB | 36 fps · 126 ms | **60 fps · 0 ms · 28 MB** |
| Parada abierta | 60 fps · 0 ms · 30 MB | 31 fps · 714 ms · 91 MB | **59 fps · 57 ms · 57 MB** |
| Xarxa | — | 32 fps · 435 ms | **60 fps · 0 ms · 36 MB** |
| Inicio (móvil, Pixel 7) | 60 fps · 0 ms · 42 MB | 60 fps · 56 ms | **60 fps · 0 ms · 35 MB** |

- La caída intermedia era del `backdrop-filter: blur` de los paneles combinado con animaciones infinitas de
  `box-shadow`: cada fotograma obligaba a recomponer el mapa desenfocado. Se quitó el blur (los paneles ya eran
  opacos al 97 %) y los "puntos en directo" animan solo `transform/opacity`.
- **Lighthouse móvil (producción):** rendimiento **68–69**, accesibilidad **100**, buenas prácticas **100**,
  FCP/LCP 1,2–1,8 s — igual que antes del rediseño (70). El TBT (2,9–4,6 s, muy variable) viene de MapLibre
  con WebGL por software en el laboratorio.
- Comparación A/B en las mismas condiciones (builds locales de la iteración 1 y la actual): 46–47 frente a
  46–56. Sin regresión atribuible al código; la puntuación absoluta varía mucho con la carga de la máquina.
- `snapshot()` de ~85 buses con retrasos: 0,46 ms. JS de la app: 124 KB gzip (+ MapLibre en trozo aparte).

## 9. Tests

| Tipo | Qué cubre |
|---|---|
| Datos (pipeline) | auditoría completa sin errores, parada pertenece a su línea, dos sentidos, sentidos por geometría, circulares, picos, **sentidos únicos** (incluidas calzadas separadas), OSM |
| Simulación (core) | el bus no sale de la geometría, progreso 0–1, ETA nunca en el pasado y ordenadas, propera parada por delante, rumbo hacia delante, dwell, frenada, perfil trapezoidal, **retrasos deterministas y acotados con red viva**, ETA = estimada y `at − scheduledAt = delaySec`, modo sin retrasos |
| Integración | misma ETA en vehículo, llegadas de parada y línea temporal |
| API | contratos zod (con los campos nuevos), SSE, GTFS-RT |
| e2e (×3 dispositivos) | inicio (proper bus, puntualidad, navegación), buscador (destinos, líneas, paradas), línea (sentido, próximos, buses → ficha), parada → bus → seguir → viaje (persiste), enfocar línea, red, puntualidad en parada, presentación, idioma, fuera de horario, "què és real", sin conexión |

## 10. Limitaciones conocidas

1. Vehículos y retrasos **simulados**; horas de paso publicadas al minuto.
2. Flota simulada 87 en punta frente a ~70 reales (los torns no comparten buses entre líneas).
3. Las correcciones F4/F6/L12 y la exclusión de la L4 IES conviene que TUS las confirme.
4. 10 líneas sin relación OSM: validadas contra calles y sentidos, no contra un trazado de ruta independiente.
5. Rendimiento medido sin GPU; **falta probar en un móvil real con 4G**.
6. Alertas solo con la app abierta (sin push); viaje y paradas guardados solo en ese navegador.
7. `/xarxa` no está en la barra inferior del móvil (es la vista para TUS; accesible por URL y en escritorio).
8. Festivos locales de Sabadell de 2027 pendientes (`TODO(DECISION: FESTIUS-LOCALS-2027)`).

## 11. Próximos pasos recomendados

1. Mirar qué ofrece hoy la app oficial de TUS (como usuario) y centrar el pitch en lo que no tiene: mapa de
   red en directo, GTFS-RT abierto para Google Maps/Moovit, pantallas en parada, vista para el centro de control.
2. Probar en un Android de gama media y un iPhone con 4G; enseñarlo a 3–4 personas sin explicación.
3. Repositorio en GitHub (privado) para que corra el CI.
4. Con datos de TUS: piloto con `HybridProvider` en 2–3 líneas.

## 12. Cómo ejecutar y presentar

```bash
pnpm install
pnpm dev          # http://localhost:5173  (hora forzada: ?hora=08:15&dia=dimarts&x=10)
pnpm test         # unitarios + API + auditoría de la red
pnpm test:e2e     # Playwright
pnpm data:audit   # regenera docs/LINE_AUDIT.md
```

**Presentation Mode:** https://bus-sabadell.vercel.app/presentacio (o ▶ en la cabecera). 10 escenas:
red → L2 → un bus → seguir → línea temporal (×5) → mi parada → "Vaig a agafar aquest bus" → aviso real "a 2
parades" (×10) → red para TUS → arquitectura con el SAE. `←/→` escenas, espacio pausa, `Esc` salir;
velocidad 1×/5×/10×/30×; ⚙ hora, fecha, línea y reinicio. Si la hora tiene poco servicio, se pone a dimarts 08:15.
