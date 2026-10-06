# Auditoría de evolución — Bus Sabadell en directe

Segunda iteración · 2026-10-06 · base auditada: commit `4f56d5e`, producción https://bus-sabadell.vercel.app
(La primera iteración —datos, motor, marcador de bus, ficha, parada, viaje, demo— está resumida al final.)

Método: lectura del código completo, ejecución local y en producción, capturas de escritorio y móvil,
`pnpm data:audit`, tests (69 unitarios/API, 33 e2e) y medición de rendimiento con `scripts/perf-probe.mjs`
(Chromium sin GPU: valores pesimistas, útiles para comparar antes/después).

---

## 1. Arquitectura actual

```
data/raw (tus.es, OSM rutas + calles, GTFS Generalitat)
  └─ packages/data-pipeline: build → geometry (despike) → repair (sentidos, circulares, tramos con donante)
                             → audit (calles, paradas, sentidos únicos, OSM) → network.json + GTFS + informes
packages/core: tipos · geo · tiempo · SimEngine (puro) · vehicle.ts (derivados únicos) · providers
apps/web: React 18 + Zustand + MapLibre; simula en el navegador; SSE opcional
apps/api: Fastify + SSE; GtfsRtProvider / HybridProvider / TusSaeProvider (interfaz)
```

| Pieza | Funciona | Problemas | Decisión |
|---|---|---|---|
| Pipeline + auditoría | Sí; 105 variantes sin error | — | **Mantener** |
| `SimEngine` determinista | Sí; posición = f(red, instante) | Todos los buses van exactamente a su hora; crucero constante | **Ampliar**: retrasos y variaciones deterministas |
| `vehicle.ts` (fuente única) | Sí | Falta hora programada vs. estimada en las ETA | **Ampliar** |
| Acceso a datos en la web | Funciona | Las vistas llaman a `engine.arrivals()` / `engine.journey()` directamente: con un proveedor real habría que tocar la UI | **Refactorizar**: capa `data/` agnóstica del proveedor |
| `MapView` | Fluido; capas por función | Etiquetas de todos los buses a z ≥ 13 (≈ 50 a la vez) | **Ajustar**: colisión de etiquetas por prioridad |
| Navegación | Cercar · Mapa · Línia | No responde a "¿qué bus cojo?"; el inicio es un panel sobre el mapa | **Rediseñar** |
| `LineView` (esquema horizontal SVG) | Sí | Vista aislada a pantalla completa, sin mapa, scroll horizontal, diseño anterior | **Eliminar y reconstruir** como panel de línea sobre el mapa |
| `SearchPanel` | Líneas y paradas | No busca destinos; vive en una pestaña aparte | **Integrar** en el inicio y ampliar |
| `BusCard`, `StopTimeline`, `StopPanel`, `Trip`, `Presentation` | Sí (iteración 1) | Sin puntualidad (+2 min); presentación sin escena SAE/arquitectura ni hora/fecha/reset | **Mantener y ampliar** |
| Estilos | Coherentes en color | 17 tamaños de letra distintos (9–30 px, con 12,5 / 14,5 / 10,5); bordes en casi todo | **Sistema de diseño**: escala 32/24/18/16/14/12, menos bordes |
| Metadatos | title, description, manifest, PWA | Sin Open Graph ni imagen para compartir | **Completar** |

**Duplicado detectado:** la vista de línea calculaba su propia posición de los buses en el esquema
(`trackPosition`) a partir de `dist`; se sustituye por la línea temporal del core. Los chips de línea existían
en tres formatos (filtro, vista de línea, ficha).

## 2. Datos

- **Reales (públicos):** 23 líneas oficiales, colores, recorridos, 408 paradas, orden, horas de paso al minuto
  (tus.es); calles y rutas (OSM); festivos (Generalitat/Ajuntament); interurbanos (GTFS Generalitat).
- **Corregidos a partir de los propios datos:** sentidos (11 variantes), 1.694 picos de las polilíneas,
  F6 y L12 (tramo de otra línea en el mismo par de paradas), **F4 a contrasentido 100 m por el c. de Calderón**
  (tramo de la L4, mismas paradas), L15/F15 circulares.
- **Eliminado:** L4 "Can Roqueta IES" (1 expedición): 100 m a contrasentido por el c. de Can Fadó sin ninguna
  otra línea que lo confirme. Mejor no mostrarla.
- **Simulado:** posición, segundos dentro del minuto, tiempos de parada, qué bus hace cada expedición.
- **Aproximaciones:** la última parada de cada trayecto (tus.es no publica su hora; se extrapola); agrupación
  de postes por nombre + 250 m.
- Validación completa: [LINE_AUDIT.md](LINE_AUDIT.md) (105 variantes · 0 errores · 9 avisos documentados).

## 3. Simulación

| Aspecto | Estado | Problema |
|---|---|---|
| Movimiento | Sobre la geometría por distancia (`pointAlong`), rumbo de la geometría | — |
| Velocidad | Trapezoidal: 1,0 m/s² arranque, crucero, 1,2 m/s² frenada | Crucero idéntico en todos los tramos |
| Dwell | 8–22 s deterministas por expedición | — |
| Horarios / frecuencia | Expediciones reales de tus.es | — |
| Puntualidad | **Siempre a su hora** | Red "de maqueta": nadie va +2 o −1 min (P1) |
| Cabeceras / torns | IDA → cabecera → VUELTA encadenado FIFO (≥ 60 s de descanso, ≤ 350 m) | Un retraso no se propaga al siguiente viaje (no hay retrasos) |
| ETA | Horas programadas de la expedición | No distingue programado de estimado |
| Flota | 87 en punta (TUS ≈ 70) | Torns no compartidos entre líneas (P2, documentado) |

## 4. UX/UI

- **Jerarquía (P0 del brief):** la primera pantalla es el mapa con 80+ buses; la pregunta "¿qué bus cojo y
  cuánto falta?" exige buscar una parada. Falta "Tu próximo bus" arriba del todo.
- **Navegación:** "Cercar · Mapa · Línia" no son tareas del usuario. Propuesta: **Inici · Mapa · Línies · Xarxa**
  (escritorio, arriba) y barra inferior en móvil.
- **Densidad:** filtro de líneas de 23 chips siempre visible en escritorio; bordes en todas las tarjetas.
- **Tipografía:** 17 tamaños; falta escala.
- **Línea:** la vista esquemática obliga a scroll horizontal y separa la línea del mapa.
- **Accesibilidad:** Lighthouse 100; navegación por teclado y etiquetas presentes; falta revisar foco al abrir
  paneles.

## 5. Rendimiento (antes)

| Medida | Valor |
|---|---|
| Lighthouse móvil (producción) | Rendimiento 70 · Accesibilidad 100 · Buenas prácticas 100 · FCP/LCP 1,3 s · TBT 2,8 s |
| JS de la app (gzip) | 119 KB (+ MapLibre 280 KB gzip en trozo aparte) |
| Mapa en reposo, 20 s (escritorio) | 0 tareas largas · 60 fps · heap 26 MB · 144 nodos DOM |
| Panel de parada abierto | 0 tareas largas · 60 fps · 30 MB · 408 nodos |
| Bus seleccionado | 0 tareas largas · 57 fps · 47 MB |
| Móvil (Pixel 7 emulado) | 0 tareas largas · 60 fps · 42 MB |

Conclusión honesta: en régimen estable **no hay un problema de rendimiento** (React no se re-renderiza por
posición; el mapa actualiza GeoJSON a 2–15 Hz según zoom). El coste está en la **carga** (TBT de MapLibre con
WebGL por software). Optimizar a ciegas no tiene sentido: se medirá de nuevo tras los cambios.

## 6. Problemas clasificados

| Prio | Problema | Acción |
|---|---|---|
| **P0** | Rutas incorrectas (sentidos, picos, calle desaparecida, contrasentidos) | ✅ Corregido o eliminado, con auditoría en los tests |
| **P0** | La primera pantalla no responde "¿qué bus viene y cuánto falta?" | Nuevo inicio con "Tu próximo bus" |
| **P1** | Simulación sin puntualidad: todo a su hora | Retrasos deterministas y acotados, propagados en cabecera, etiquetados como simulados |
| **P1** | ETA sin programado vs. estimado | `scheduledAt` + `at` en cada ETA; "+2 min" / "A su hora" en toda la UI |
| **P1** | UI acoplada al motor (`engine.arrivals` en vistas) | Capa de datos agnóstica del proveedor |
| **P1** | Vista de línea aislada y anticuada | Panel de línea con mapa, sentido, paradas, buses, próximos pasos, frecuencia, duración |
| **P2** | Sin vista de red para TUS | Dashboard "Xarxa en directe" con métricas derivadas de la simulación |
| **P2** | Etiquetas saturadas en zoom medio | Colisión por prioridad |
| **P2** | Sistema de diseño: tamaños arbitrarios, exceso de bordes | Escala tipográfica y tokens |
| **P2** | Presentación sin escena SAE/arquitectura, hora/fecha y reset | Ampliar |
| **P3** | Open Graph, imagen social | Añadir |
| **P3** | Flota simulada > real | Documentado (interlineado = trabajo con datos de TUS) |

## 7. Plan (por fases, sin reescritura innecesaria)

1. ✅ Auditoría (este documento).
2. ✅ Datos: sentidos únicos + correcciones (hecho antes de tocar la UI).
3. Modelo: ETA con hora programada y estimada; `delaySec` real en la simulación.
4. Simulación: retrasos deterministas por expedición y propagación en cabecera; pequeñas variaciones de velocidad.
5. Capa de datos agnóstica del proveedor en la web.
6. Sistema de diseño (escala tipográfica, tokens, menos bordes).
7. Navegación + nuevo inicio + buscador global (líneas, paradas, destinos).
8. Panel de línea (sustituye a `LineView`).
9. Puntualidad en ficha, parada, viaje y línea temporal.
10. Mapa: etiquetas por prioridad.
11. Dashboard de red e incidencias (solo las publicadas; si no hay, "sin incidencias publicadas").
12. Presentación: hora/fecha, reset, escena "con el SAE real" y arquitectura.
13. Metadatos/OG.
14. Medir de nuevo, tests, e2e, despliegue, `IMPLEMENTATION_SUMMARY.md`.

---

## Anexo: primera iteración (resumen)

Encontrado y corregido: sentidos por nombre de cabecera, F6 por una calle retirada en 2024, L12 lejos de la
parada, L15/F15 no circulares, 1.694 picos, proyección en la pasada equivocada (L14 Ebre → Sau → Ebre), bus en
forma de gota, curva de velocidad seno, cada vista derivando lo suyo, sin parada/timeline/viaje/seguimiento.
