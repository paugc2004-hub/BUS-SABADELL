# PROMPT MAESTRO — "Bus Sabadell en directe"
### Mapa en tiempo real de la red de autobuses urbanos de Sabadell (TUS) — demo para presentar a TUS / Ajuntament

> Documento original del proyecto (copia literal). Las desviaciones decididas durante la construcción
> están en `docs/PLAN.md` § "Decisiones que cambian la especificación".

---

## 0. ROL Y PROTOCOLO DE TRABAJO (léelo antes que nada)

Actúa como un **ingeniero full-stack senior especializado en sistemas de transporte público (GTFS, GTFS-RT, AVL/SAE), cartografía web (MapLibre, OSM) y producto**. Vas a construir este proyecto de principio a fin con calidad de producción, aunque su primer uso sea una demo comercial.

Reglas de trabajo, en este orden:

1. **No escribas código todavía.** Primero lee este documento completo.
2. **Fase de descubrimiento (obligatoria):** antes de diseñar nada, comprueba la realidad de los datos (sección 3.4). Reporta lo que encuentres con números concretos: cuántas líneas TUS hay en OSM, cuáles faltan, cuáles tienen geometría rota, cuántas paradas. No supongas nada que puedas verificar.
3. **Fase de plan:** con lo descubierto, escribe `docs/PLAN.md` con: arquitectura final, decisiones tomadas (y alternativas descartadas con el porqué), riesgos, y el desglose en hitos (sección 13). Haz una lista corta de **preguntas que solo yo puedo responder** y espera mis respuestas. No hagas preguntas cuya respuesta puedas investigar tú.
4. **Fase de implementación por hitos:** implementa hito a hito. Al cerrar cada hito: tests en verde, lint en verde, `typecheck` en verde, commit con mensaje descriptivo, y un resumen de 5 líneas de lo hecho y lo pendiente.
5. **Crea y mantén `CLAUDE.md`** en la raíz con: comandos del proyecto, estructura, convenciones y decisiones clave, para que cualquier sesión futura arranque con contexto.
6. **Nunca declares algo "hecho" sin haberlo comprobado** (ejecutándolo, testeándolo o abriéndolo en el navegador). Si algo no se puede comprobar, dilo explícitamente.
7. **Si una instrucción de este documento choca con la realidad técnica** (p. ej. un dato no existe, una librería no lo permite), no la ignores en silencio: avísame, propón la alternativa y sigue con la más razonable.
8. **Honestidad sobre los datos:** este proyecto mezcla datos reales (red, paradas) y simulados (posiciones). Esa frontera tiene que estar siempre clara en el código, en la UI y en la documentación. Nunca presentes una posición simulada como real.

---

## 1. CONTEXTO DE NEGOCIO

- Soy Pau, de Sabadell. Vi una web que muestra el metro de Barcelona en tiempo real con un diseño oscuro precioso (mapa de red con trenes moviéndose, vista lineal por línea, ficha de cada tren con próxima parada, cuenta atrás, destino, avisos de "tren en maniobras/retirada"). Quiero lo mismo para los **buses urbanos de Sabadell**.
- **Objetivo inmediato:** una demo lo bastante buena como para presentársela a **TUS (Transports Urbans de Sabadell)** y/o al **Ajuntament de Sabadell**, y conseguir que me den acceso a sus datos reales en tiempo real (su sistema SAE / AVL).
- **Objetivo a medio plazo:** si me dan los datos, que pasar de simulación a tiempo real sea cambiar un "proveedor" de datos, no rehacer la app.
- **Público de la demo:** gente no técnica (dirección de TUS, concejalía de movilidad). Lo verán sobre todo **en el móvil** y quizá proyectado en una pantalla. Tiene que impresionar en los primeros 5 segundos y no fallar nunca en directo.

### 1.1 Lo que ya sé sobre los datos (investigado, no lo re-investigues salvo para verificar)
- **TUS no publica API pública ni GTFS abierto.** Tiene datos en tiempo real internos (sistema SAE, app oficial "TUS - Bus Sabadell" desarrollada por GeoActio, ~86 paneles electrónicos en paradas), pero no los ofrece a terceros.
- **No vamos a hacer ingeniería inversa de la app oficial ni de ninguna API privada.** Es arriesgado legalmente y destruiría la relación con TUS antes de empezar. Queda fuera del alcance.
- **Red y paradas:** OpenStreetMap tiene (o debería tener) las rutas TUS como relaciones `type=route` + `route=bus`, probablemente agrupadas en `route_master`. Hay que verificar etiquetas (`network`, `operator`, `ref`, `colour`, `from`, `to`) — ver 3.4.
- **Horarios/frecuencias TUS:** publicados en PDF en https://www.tus.es/index.php/ca/informacio-de-les-linies. Hay líneas de día laborable y líneas específicas de festivos (F1, F2, F3, F4…). Hay unas ~20 líneas en total (L1, L2, L3, L4, L44, L5, L55, L15, L7, L8, L10, L11, L14, L14ds, L23, L80, F1–F4…; verifica la lista real).
- **Avisos de servicio** (cortes de calle, desvíos): publicados como noticias/PDF en la home de tus.es.
- **Interurbanos que pasan por Sabadell:** GTFS oficial de la Generalitat (más de 900 líneas de toda Cataluña), descarga directa:
  `https://territori.gencat.cat/web/.content/home/serveis/visors-cartografia/bases-cartografiques/infraestructures-mobilitat/autobusos-interurbans/busos-interurbans-GTFS.zip`
  También indexado en MobilityDatabase (feed `mdb-2926`).
- **Referencia de cómo lo hace otra ciudad cercana:** Terrassa publica GTFS de su bus urbano en su portal de datos abiertos. Sirve como ejemplo de formato y como argumento ante TUS ("Terrassa ya lo hace").

---

## 2. ALCANCE

### 2.1 Dentro del alcance (MVP de la demo)
1. Mapa oscuro de Sabadell con **todas las líneas TUS** dibujadas con su color y sus paradas.
2. **Buses en movimiento** por su recorrido, con posiciones **simuladas** de forma realista a partir de frecuencias/horarios.
3. **Ficha de bus** al tocar un bus.
4. **Vista lineal por línea** (esquema tipo diagrama de metro con ida y vuelta).
5. **Panel de parada** con próximas llegadas.
6. **Selector/filtro de líneas.**
7. **Búsqueda** de parada o línea.
8. **Capa opcional de interurbanos** (desde el GTFS de la Generalitat), desactivada por defecto, solo con horario teórico.
9. **Banner permanente** "Demo · posiciones simuladas a partir de horarios publicados".
10. **Modo presentación** (sección 7.9).
11. Backend propio que sirve red, simulación y (en el futuro) tiempo real.
12. Bilingüe **catalán (por defecto) / castellano**.

### 2.2 Fuera del alcance (no lo hagas salvo que te lo pida)
- Ingeniería inversa o scraping de la app/API privada de TUS o GeoActio.
- Planificador de rutas origen→destino (sí dejar la arquitectura preparada).
- Venta de billetes, cuentas de usuario, login.
- Apps nativas (será una PWA).
- Datos de ocupación real de los buses.

---

## 3. DATOS

### 3.1 Fuentes y licencias (obligatorio documentarlas en `docs/DATA.md` y en la UI)
| Fuente | Qué aporta | Licencia / obligación |
|---|---|---|
| OpenStreetMap (vía Overpass API) | Recorridos, paradas, orden de paradas, nombres | ODbL → atribución "© OpenStreetMap contributors" visible en el mapa |
| PDFs de tus.es | Frecuencias y horarios | Se introducen a mano en un fichero de configuración, citando la fuente y la fecha |
| GTFS Generalitat (interurbanos) | Líneas, paradas y horarios interurbanos | Revisar y respetar la licencia del portal de origen; citar fuente |
| Mapa base (CARTO Dark Matter, Protomaps u OpenFreeMap) | Fondo oscuro | Respetar atribución y límites de uso del proveedor elegido |

### 3.2 Modelo de datos canónico (interno)
Todo se normaliza a un **GTFS estático propio** (generado por el pipeline) más JSON optimizados para el frontend. Ventaja: cuando TUS entregue su GTFS oficial, se sustituye la fuente y el resto del sistema no cambia.

Entidades mínimas (en `packages/core/src/types.ts`):
- `Agency` (TUS, interurbanos)
- `Route` — id, `ref` ("L1"), nombre largo, color, color de texto, tipo (diurna/festiva/nocturna/escolar si existe), agencia.
- `Pattern` (variante de recorrido) — id, routeId, sentido (0/1), cabecera origen, cabecera destino, lista ordenada de `stopId`, geometría (LineString), longitud total en metros, y para cada parada su **distancia acumulada a lo largo del recorrido** (`shape_dist_traveled`). Una ruta puede tener varios patterns (variantes, recorridos parciales, desvíos).
- `Stop` — id estable, nombre, coordenadas, código de parada TUS si existe en OSM (`ref`/`local_ref`), líneas que pasan, accesibilidad si está etiquetada.
- `ServiceCalendar` — laborable, sábado, domingo/festivo, agosto/verano si aplica, con excepciones por fecha.
- `FrequencyRule` — patternId, calendario, franja horaria [inicio, fin), intervalo en minutos (o lista explícita de salidas si el PDF da horas exactas).
- `Vehicle` (en runtime) — id, routeId, patternId, distancia recorrida en el pattern, posición, rumbo, velocidad, estado (`EN_RUTA`, `EN_PARADA`, `EN_CABECERA`, `RETIRADA`, `DESVIADO`), próxima parada, ETA a cada parada siguiente, origen del dato (`SIMULATED` | `SCHEDULED` | `REALTIME`), timestamp.
- `Alert` — afectación de servicio (líneas, paradas, periodo, texto ca/es, enlace a fuente).

### 3.3 Fichero de horarios editable a mano
`data/config/tus-horaris.yaml` (YAML porque lo editaré yo a mano mirando los PDFs):
```yaml
font: "PDFs tus.es, consultats el AAAA-MM-DD"
linies:
  L1:
    color: "#E30613"        # si OSM no trae colour; verificar con material oficial
    calendaris:
      feiners:
        - { de: "06:00", a: "09:30", cada_min: 8 }
        - { de: "09:30", a: "20:00", cada_min: 10 }
        - { de: "20:00", a: "22:30", cada_min: 15 }
      dissabtes: [...]
      festius: null          # la línia no circula; la cobreix F1/F2...
    temps_cabecera_min: 4    # descans a cada extrem
```
- El pipeline **valida** este fichero con un esquema (zod) y falla con mensajes claros (línea, campo, problema) si hay solapes de franjas, horas inválidas, franjas que cruzan medianoche mal expresadas, líneas inexistentes, etc.
- Genera valores por defecto razonables para todas las líneas encontradas y **márcalos como `estimat: true`** para que sepamos cuáles hay que revisar con los PDFs. La UI interna (modo debug) debe listar las líneas con datos estimados.

### 3.4 Descubrimiento en OSM (hazlo primero y repórtame)
1. Consulta Overpass por relaciones de bus dentro del área de Sabadell y alrededores (incluir Sant Quirze del Vallès, que TUS también opera). Prueba varias estrategias porque el etiquetado puede variar: por `network~"TUS"`, por `operator~"Transports Urbans de Sabadell|TUS"`, por `route_master`, y por área (`area["name"="Sabadell"]`) + `route=bus`. Compara resultados.
2. Para cada relación reporta: `ref`, `name`, `from`, `to`, `colour`, nº de ways, nº de paradas, si es `public_transport:version=2`, y si la geometría es continua.
3. Detecta y reporta: líneas que faltan respecto a la lista oficial, rutas sin paradas, paradas sin nombre, ways desconectados, rutas duplicadas, ida sin vuelta.
4. Guarda la respuesta cruda de Overpass en `data/raw/` con fecha (para reproducibilidad y para no machacar Overpass en cada build).

---

## 4. PIPELINE DE DATOS (`packages/data-pipeline`)

Comando: `pnpm data:build`. Es determinista: misma entrada → misma salida (byte a byte si es posible).

Pasos:
1. **Fetch** (opcional con `--refresh`): descarga Overpass y el ZIP de la Generalitat a `data/raw/`. Respeta la política de uso de Overpass (un solo request grande, `timeout` adecuado, `User-Agent` identificable, reintentos con backoff exponencial, nunca en bucle).
2. **Parseo OSM → patterns:**
   - Une los ways de cada relación en una LineString ordenada. **Esto es lo más delicado del proyecto** (ver bugs 12.1). Algoritmo: respetar el orden de miembros de la relación; orientar cada way según conecte con el anterior (invertir si hace falta); manejar `role=forward/backward`; manejar rotondas (ways cerrados) recorriendo solo el arco necesario; si hay un hueco, unir con segmento recto **solo si < 50 m** y registrar warning; si el hueco es mayor, marcar el pattern como roto y excluirlo de la simulación (pero informar).
   - Ordena las paradas por la relación (`role=stop`, `stop_entry_only`, `stop_exit_only`, `platform`). Si hay `platform` y `stop_position`, unifica en una única parada lógica (agrupar por `stop_area` o por proximidad < 30 m + mismo nombre).
   - **Proyecta cada parada sobre la geometría** y calcula su distancia acumulada. Verifica que las distancias son **estrictamente crecientes** en el orden de paradas; si no (parada proyectada en el tramo equivocado, típico en recorridos que pasan dos veces por la misma calle o en líneas circulares), resuelve proyectando con búsqueda acotada a partir de la distancia de la parada anterior.
   - Líneas circulares: un solo pattern con inicio = fin; tratarlas explícitamente.
3. **Simplificación** de geometría para el frontend (Douglas-Peucker, tolerancia ~3–5 m), conservando siempre los vértices donde se proyectan paradas. Guarda la geometría completa para el backend y la simplificada para el cliente.
4. **Generación GTFS estático** propio (`dist/gtfs/`): `agency`, `routes`, `stops`, `trips`, `stop_times` o `frequencies` (preferible `frequencies.txt` con `exact_times=0` para lo estimado), `shapes` con `shape_dist_traveled`, `calendar`, `calendar_dates`, `feed_info`.
5. **Validación** del GTFS generado con el validador oficial de MobilityData (`gtfs-validator`, CLI Java) — el build falla si hay errores; los warnings se listan.
6. **Calendario de festivos:** genera `calendar_dates` con festivos nacionales, de Cataluña y **locales de Sabadell** del año en curso y el siguiente. Mantén la lista en `data/config/festius.yaml` con la fuente citada (no la inventes: si no puedes verificarla, deja un TODO visible y avísame).
7. **Interurbanos:** del ZIP de la Generalitat, filtra solo paradas dentro de un buffer del término municipal de Sabadell (+ Sant Quirze) y las líneas que las usan. Reduce tamaño drásticamente; el ZIP completo es enorme. Ojo con codificación de caracteres (UTF-8 vs Latin-1) y BOM.
8. **Salidas para el frontend** (`apps/web/public/data/` o servidas por el backend): `network.json` (rutas, patterns simplificados, paradas) — objetivo < 400 KB gzip; `interurbans.json` separado y cargado bajo demanda.
9. **Informe de calidad** `dist/report.md`: líneas OK, líneas con warnings, líneas excluidas y por qué, paradas huérfanas, datos estimados pendientes de revisar.

---

## 5. ARQUITECTURA

### 5.1 Monorepo
```
/
├─ apps/
│  ├─ web/            # Frontend: Vite + React + TypeScript + MapLibre GL JS
│  └─ api/            # Backend: Node 20+ + Fastify + TypeScript
├─ packages/
│  ├─ core/           # Tipos compartidos, motor de simulación, utilidades geo y de tiempo
│  └─ data-pipeline/  # Scripts de construcción de datos
├─ data/
│  ├─ raw/            # Descargas originales fechadas (gitignored si pesan mucho)
│  └─ config/         # tus-horaris.yaml, festius.yaml, colors, overrides manuales
├─ docs/              # SPEC.md (este documento), PLAN.md, DATA.md, PITCH.md
└─ CLAUDE.md
```
pnpm workspaces. TypeScript estricto (`strict: true`, `noUncheckedIndexedAccess: true`). ESLint + Prettier. Vitest para unit tests. Playwright para e2e.

### 5.2 Principio clave: proveedor de vehículos intercambiable
```ts
interface VehicleProvider {
  readonly source: 'SIMULATED' | 'SCHEDULED' | 'REALTIME';
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(at: Date): VehicleState[];          // estado completo en un instante
  subscribe(cb: (diff: VehicleDiff) => void): Unsubscribe;
  health(): ProviderHealth;                     // última actualización, errores, latencia
}
```
Implementaciones:
- `SimulatedProvider` — usa el motor de simulación (sección 6). Es el que se usa ahora.
- `GtfsRtProvider` — esqueleto funcional que consume un feed GTFS-RT (`VehiclePositions`, `TripUpdates`, `ServiceAlerts`) con `gtfs-realtime-bindings`. Probado contra un feed de ejemplo público o un fichero `.pb` de fixture. Listo para cuando TUS dé acceso.
- `TusSaeProvider` — **solo interfaz y TODO documentado** de qué necesitaríamos de TUS (formato, frecuencia de refresco, autenticación). No implementar contra nada privado.
- `HybridProvider` — usa tiempo real cuando hay dato fresco y cae a simulación/horario cuando el dato está caducado, marcando cada vehículo con su origen.

### 5.3 Backend (`apps/api`)
- **Fastify** con TypeScript, validación de entrada/salida con zod (o TypeBox).
- Endpoints:
  - `GET /health` — estado del servidor y del proveedor.
  - `GET /v1/network` — red completa (con `ETag` y `Cache-Control` largo; cambia solo al reconstruir datos).
  - `GET /v1/vehicles` — snapshot actual.
  - `GET /v1/vehicles/stream` — **Server-Sent Events** con snapshot inicial + diffs cada 2–5 s. (SSE en vez de WebSocket: más simple, atraviesa proxies, reconexión nativa. Justifícalo o cámbialo en PLAN.md si ves motivo.)
  - `GET /v1/stops/:id/arrivals` — próximas llegadas a una parada (tiempo + origen del dato).
  - `GET /v1/routes/:id` — detalle de línea con patterns y vehículos actuales.
  - `GET /v1/alerts` — avisos de servicio (cargados de `data/config/avisos.yaml`, editado a mano por ahora).
  - `GET /v1/meta` — versión de datos, fecha de build, fuentes, qué es simulado.
- **El backend es la fuente de verdad del reloj y de la simulación:** todos los clientes ven los mismos buses en el mismo sitio. El cliente interpola entre actualizaciones.
- Respuestas con `serverTime` para que el cliente corrija el desfase de reloj.
- CORS restringido al dominio del frontend. Rate limiting básico (`@fastify/rate-limit`). Compresión (`@fastify/compress`). Logs estructurados (pino) sin datos personales.
- Sin base de datos en el MVP (todo en memoria a partir de los ficheros generados). Deja preparado dónde iría SQLite/Postgres si se guardan históricos de tiempo real.
- Si el backend se cae, el frontend debe poder **seguir funcionando en modo simulación local** (el motor está en `packages/core` y se puede ejecutar en el navegador). Esto es crítico para la demo en directo.

### 5.4 Frontend (`apps/web`)
- Vite + React + TypeScript. Estado con Zustand (o similar ligero). Router ligero (rutas: `/`, `/linia/:ref`, `/parada/:id`, `/presentacio`) con URLs compartibles.
- **MapLibre GL JS** con estilo oscuro. Los buses se dibujan como capa del propio mapa (GeoJSON source actualizado por frame o, si hay rendimiento justo, capa custom/WebGL), **no** como cientos de marcadores DOM.
- Animación con `requestAnimationFrame`; la posición de cada bus se interpola **a lo largo de la geometría de su pattern por distancia**, no en línea recta entre dos puntos GPS (si no, los buses "cortan" esquinas y atraviesan edificios).
- PWA instalable (manifest, iconos, service worker que cachea la app y `network.json`; nunca cachear el stream de vehículos).
- i18n con ficheros `ca.json` y `es.json`; catalán por defecto; detecta el idioma del navegador; selector visible.

---

## 6. MOTOR DE SIMULACIÓN (`packages/core/src/sim`)

Objetivo: que parezca real a ojos de un usuario habitual de TUS, de forma **determinista** (dos navegadores a la misma hora ven lo mismo; recargar la página no "teletransporta" los buses).

1. **Determinismo:** la posición de cada bus es una función pura de `(pattern, calendario del día, hora actual)`. Nada de estado acumulado aleatorio. Si se usa aleatoriedad (variación de velocidad, retrasos), que sea un PRNG con semilla = hash(fecha de servicio + id de expedición).
2. **Generación de expediciones:** a partir de las `FrequencyRule`, genera las salidas del día desde cabecera. Una expedición = (pattern, hora de salida). El número de buses en circulación sale solo de ahí; no lo fijes a mano.
3. **Encadenamiento de vehículos:** un mismo bus físico hace ida → descanso en cabecera → vuelta. Asigna IDs de vehículo estables encadenando expediciones (para que el "bus 1023" de la ficha sea coherente durante horas). Calcula la flota necesaria y compárala con la flota real aproximada de TUS (~60–70 buses) como prueba de cordura; si sale el doble, algo está mal (frecuencias o velocidades).
4. **Perfil de movimiento:** velocidad comercial base ~13–16 km/h en urbano (configurable por línea y franja: más lenta en hora punta y en el centro), aceleración/frenada suavizadas cerca de paradas, **tiempo de parada** (dwell) de 15–40 s según franja e importancia de la parada, tiempo en cabecera configurable.
5. **Día de servicio que cruza medianoche:** una expedición que sale a las 23:50 pertenece al día de servicio anterior. Las horas internas pueden ser > 24:00 (como en GTFS). Cuidado extremo con esto.
6. **Calendario:** elegir laborable/sábado/festivo según fecha en `Europe/Madrid` + festivos (sección 4.6). Líneas F solo en festivos/domingos según config.
7. **ETAs:** para cada bus, ETA a cada parada restante = tiempo restante simulado. Para el panel de parada, combinar buses en ruta + próximas salidas de cabecera que aún no han salido.
8. **Estados especiales** (para lucir la UI, como en la web del metro): `EN_CABECERA` (esperando salida), `RETIRADA` (última expedición volviendo a cochera, se puede mostrar al final del servicio), `DESVIADO` (si hay un aviso activo que afecta al tramo — en el MVP solo visual).
9. **Modo "acelerado"** para la demo: multiplicador de tiempo (x1, x10, x60) y selector de hora ("¿cómo es la red a las 8:00 de un lunes?") — útil si la presentación es a una hora con poco servicio.
10. **Rendimiento:** calcular el estado de ~80 buses debe costar < 2 ms por tick. Precalcular tablas de distancia→coordenada por pattern (lookup binario por distancia acumulada).

---

## 7. UX / UI

### 7.1 Dirección visual
- Estética "panel de control nocturno": fondo casi negro, mapa oscuro desaturado, líneas de bus como trazos de color vivo con ligero glow, tipografía limpia (Inter o similar) y **dígitos tabulares** monoespaciados para cuentas atrás y números de bus (estilo panel de parada LED, en ámbar/rojo suave).
- Colores de línea: los oficiales de TUS si se pueden verificar; si no, una paleta propia coherente y **distinguible para daltonismo** (comprobar contraste y que no haya dos líneas con colores indistinguibles en el mismo tramo). Siempre acompañar el color del código de línea (nunca solo color).
- Animaciones suaves pero contenidas (60 fps; respetar `prefers-reduced-motion`).
- Sin aspecto de plantilla genérica: nada de cards con sombras por todas partes ni gradientes morados.

### 7.2 Pantalla principal (mapa)
- Mapa centrado en Sabadell con todas las líneas y buses. Al hacer zoom aparecen paradas y nombres; al alejar, solo líneas y buses (evitar ruido visual).
- Barra superior: logo/título "Bus Sabadell en directe", reloj en vivo, selector de idioma, botón de modo presentación.
- Selector de líneas (chips con color + código), multi-selección, "totes" / "cap".
- Buscador de paradas y líneas (tolerante a acentos: "Creu Alta" = "creu alta" = "Créu Alta").
- Botón "on soc" (geolocalización, solo bajo petición del usuario, nunca automática) para centrar y mostrar paradas cercanas.
- **Banner de honestidad** fijo y discreto: "Demo · posicions simulades a partir dels horaris publicats per TUS". Al tocarlo, explica qué es real y qué simulado.
- Atribuciones de OSM y del mapa base visibles.

### 7.3 Ficha de bus (al tocar un bus)
- Código de línea con su color + número de vehículo.
- Próxima parada, cuenta atrás mm:ss (actualizada cada segundo, sin saltos raros), destino (cabecera final), sentido.
- Lista de las próximas 3–5 paradas con hora estimada.
- Estado especial con banda visual (p. ej. amarilla rayada para "En cabecera", azul para "Retirada", naranja para "Desviat").
- Etiqueta del origen del dato: "Simulat" / "Horari" / "Temps real".
- Botones: seguir al bus (la cámara lo acompaña), compartir (URL con el bus/línea), cerrar.
- En móvil: bottom sheet arrastrable; en escritorio: panel lateral.

### 7.4 Vista lineal de línea (`/linia/:ref`)
- Diagrama horizontal tipo metro: sentido de ida arriba, vuelta abajo, todas las paradas en orden con nombre en diagonal, buses posicionados proporcionalmente entre paradas y moviéndose en directo.
- Scroll horizontal en móvil con la parada más cercana al usuario o al bus seleccionado centrada.
- Marcar transbordos (otras líneas TUS, FGC, Rodalies) en cada parada si el dato existe.
- Mostrar frecuencia actual ("cada 10 min") y primera/última salida del día.

### 7.5 Panel de parada (`/parada/:id`)
- Nombre, código de parada, líneas que paran (chips).
- Próximas llegadas ordenadas por tiempo: línea, destino, "en 3 min" / "imminent" / hora si > 30 min, origen del dato.
- Avisos activos que afecten a la parada.
- Botón "afegir a preferides" (favoritos en el dispositivo, sin cuentas).

### 7.6 Avisos
- Icono con contador en la barra superior; lista de avisos activos (cortes de calle, desvíos) con líneas afectadas y enlace a la fuente oficial.

### 7.7 Capa interurbanos
- Toggle "Interurbans" en el selector de capas. Líneas en gris/tono neutro para no competir con TUS. Solo horario teórico, etiquetado como tal.

### 7.8 Estados vacíos y de error (diseñarlos, no olvidarlos)
- Fuera de horario de servicio: mapa con líneas pero sin buses + mensaje "Ara no hi ha servei. Primer bus: 05:45 (L1)".
- Sin conexión: seguir funcionando con simulación local + aviso discreto.
- Línea sin servicio hoy (p. ej. F-lines en laborable): mostrarla atenuada con "No circula avui".
- Error cargando la red: pantalla de error útil con reintento, no un spinner infinito.

### 7.9 Modo presentación (`/presentacio`)
- Pantalla completa, sin controles, cámara que hace un "tour" automático (vista general → zoom a una línea con mucho servicio → vista lineal → ficha de un bus → vuelta), en bucle.
- Contador grande de "buses circulant ara" y "parades" como titulares.
- Multiplicador de tiempo y hora forzada configurables por parámetro de URL (`?hora=08:00&dia=dilluns&x=10`) para preparar la demo a cualquier hora.
- Debe funcionar sin interacción durante 30+ minutos sin fugas de memoria ni bajadas de fps.

### 7.10 Accesibilidad
- Contraste AA mínimo en todo el texto.
- Toda la información del mapa accesible también en forma de lista (lector de pantalla: lista de líneas → paradas → llegadas).
- Navegación por teclado completa, foco visible, `aria-live` educado para cuentas atrás (no anunciar cada segundo).
- Tamaños táctiles ≥ 44 px.

---

## 8. RENDIMIENTO Y CALIDAD
- Lighthouse móvil: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- Primer render útil (mapa con líneas) < 2,5 s en 4G simulado.
- 60 fps con todas las líneas y buses en un móvil de gama media; si no, degradar (menos frecuencia de actualización, sin glow) automáticamente.
- Bundle JS inicial < 300 KB gzip (MapLibre aparte, cargado eficientemente).
- Sin fugas de memoria en 30 min de modo presentación (comprobarlo con el profiler).

---

## 9. SEGURIDAD Y PRIVACIDAD
- Sin cookies de seguimiento ni analítica invasiva. Si hay analítica, que sea sin cookies (p. ej. Plausible) y opcional.
- La geolocalización nunca se envía al servidor; se usa solo en el cliente.
- Cabeceras de seguridad (CSP estricta compatible con MapLibre y el proveedor de teselas, HSTS, `X-Content-Type-Options`, `Referrer-Policy`).
- Ningún secreto en el repo; `.env.example` documentado.
- Dependencias auditadas (`pnpm audit`) y fijadas con lockfile.

---

## 10. TESTING
- **Unit (Vitest):** unión de ways y orientación; proyección de paradas y monotonicidad de distancias; simplificación conserva paradas; generación de expediciones; día de servicio que cruza medianoche; cambio de hora de verano/invierno; selección de calendario con festivos; ETA; determinismo (misma entrada → misma salida); encadenamiento de vehículos.
- **Fixtures:** extractos reales de OSM guardados (una línea normal, una circular, una con rotonda, una con hueco) para que los tests no dependan de Overpass.
- **Property-based** (fast-check) para el motor: el bus nunca sale de su geometría, la distancia recorrida es monótona dentro de una expedición, ETAs no negativas.
- **Contrato API:** tests de cada endpoint con esquemas zod.
- **E2E (Playwright):** carga, tocar bus → ficha, abrir línea, abrir parada, buscador, cambio de idioma, modo presentación, modo offline, viewport móvil (iPhone 13 y Android de gama media) y escritorio.
- **Pruebas de tiempo:** ejecutar la simulación con reloj falso en fechas límite (última noche de octubre por el cambio de hora, 31 de diciembre, un festivo local, un domingo a las 00:30).
- **Validación GTFS** con el validador oficial en CI.
- CI con GitHub Actions: lint, typecheck, tests, build de datos con fixtures, build de web y api.

---

## 11. DESPLIEGUE
- Frontend estático (Cloudflare Pages, Vercel o Netlify). Backend en un servicio con soporte de conexiones largas para SSE (Fly.io, Railway, Render…). Justifica la elección en PLAN.md por coste (idealmente gratis o casi) y por fiabilidad de SSE.
- Dominio provisional y URL corta fácil de dictar en una reunión.
- `docker-compose.yml` para levantar todo en local con un comando.
- Variables de entorno documentadas. Health checks configurados.
- Plan B para la reunión: build estático que funcione **sin backend y sin internet** (simulación en el cliente, datos empaquetados), por si falla el wifi de la sala.

---

## 12. CATÁLOGO DE BUGS Y TRAMPAS PREVISIBLES (prevén cada uno y añade test donde aplique)

### 12.1 Datos OSM y geometría
1. Ways de la relación desordenados o con orientación invertida → recorrido en zig-zag. Ordenar por conectividad, no fiarse del orden.
2. Rotondas como ways cerrados → el bus da la vuelta entera a la rotonda. Recorrer solo el arco entre entrada y salida.
3. Huecos entre ways (relación incompleta) → teletransporte del bus. Detectar, unir si < 50 m, si no excluir y reportar.
4. Rutas que pasan dos veces por la misma calle (ida y vuelta por el mismo eje, bucles) → parada proyectada en el tramo equivocado → distancias no monótonas → bus que retrocede. Proyección acotada secuencial.
5. Líneas circulares (inicio = fin) → división por cero en "progreso", ETA rota en la última parada.
6. Paradas duplicadas (`platform` + `stop_position` + nodo suelto) → la misma parada aparece 2–3 veces.
7. Paradas sin nombre o con nombres inconsistentes ("Pl. Espanya" vs "Plaça d'Espanya") → normalizar y deduplicar para el buscador.
8. Variantes de línea (L14ds, recorridos parciales, refuerzos escolares) mezcladas con la línea principal → crear patterns separados.
9. Datos de OSM desactualizados respecto al recorrido real (desvíos por obras, como los cortes actuales de c. d'Adriana o Ronda Collsalarca) → permitir overrides manuales en `data/config/overrides.yaml` y mostrarlo en avisos.
10. Rutas que salen del término municipal (Sant Quirze, polígonos, Hospital Parc Taulí) → el bbox de la consulta debe cubrirlas.
11. Etiquetas `colour` ausentes o mal formateadas (`red`, `#f00`, `#FF0000 `) → normalizar y validar.
12. Cambios en OSM entre builds → IDs de parada inestables. Generar IDs propios estables (p. ej. por `ref` de parada o hash de nombre + coordenada redondeada) y mantener un mapa de equivalencias.

### 12.2 Tiempo y calendario
13. Zona horaria: el servidor puede estar en UTC → todo cálculo de servicio en `Europe/Madrid` explícitamente (usar `Temporal` polyfill o `date-fns-tz`/`luxon`; nunca `new Date()` "a pelo" para horas locales).
14. Cambio de hora (último domingo de marzo y de octubre): la hora 02:00–03:00 no existe o existe dos veces → expediciones duplicadas o perdidas.
15. Servicio que cruza medianoche (horas > 24:00) → buses que desaparecen a las 00:00 o aparecen en el día equivocado.
16. Festivos locales de Sabadell no contemplados → simulación de laborable en festivo.
17. Reloj del dispositivo del usuario desfasado → cuentas atrás negativas o buses adelantados. Corregir con `serverTime`.
18. Pestaña en segundo plano: `requestAnimationFrame` se pausa y `setInterval` se ralentiza → al volver, saltos bruscos. Recalcular desde el reloj al volver (`visibilitychange`), nunca acumular deltas.
19. Cuenta atrás que salta (59 → 57) o se congela → derivar siempre del timestamp absoluto, no decrementar un contador.

### 12.3 Simulación
20. Frecuencias mal introducidas → flota absurda (200 buses). Prueba de cordura con flota real aproximada y alerta.
21. Franjas horarias que se solapan o dejan huecos → validación del YAML.
22. Buses que "nacen" en mitad de la línea al cargar la página → la función pura ya lo evita; testear.
23. Vehículos que se superponen exactamente en la misma coordenada (cabecera compartida) → pequeño desplazamiento visual o agrupación con contador.
24. ETA incoherente entre ficha de bus y panel de parada → ambos deben salir de la misma función.
25. Fin de servicio: último bus debe completar su recorrido y luego desaparecer o pasar a "Retirada", no evaporarse a la hora de la última salida.

### 12.4 Frontend / mapa
26. Marcadores DOM para cada bus → jank en móvil. Usar capa del mapa.
27. Actualizar el source GeoJSON con objetos nuevos cada frame → presión de GC. Reutilizar buffers / actualizar solo lo que cambia, o throttling a 10–20 Hz con interpolación visual.
28. Interpolación en línea recta entre actualizaciones → buses que atraviesan manzanas. Interpolar por distancia sobre la geometría.
29. Rumbo del icono del bus saltando 180° en cada parada → suavizar rumbo y calcularlo con la geometría, no con dos puntos muy cercanos.
30. Clic en bus difícil en móvil (iconos pequeños en movimiento) → área táctil ampliada y selección del bus más cercano al toque.
31. Bottom sheet en iOS Safari: barra de direcciones que cambia la altura (`100vh` roto) → usar `100dvh` y safe areas.
32. Teselas del mapa base que fallan o superan límites de uso → fallback a otro proveedor o fondo sólido con calles de OSM propias.
33. Fuga de memoria por suscripciones SSE o listeners no limpiados al cambiar de ruta → cleanup en todos los efectos.
34. Glow/blur caro en GPU de gama baja → detección de rendimiento y degradación.
35. Textos largos de parada que se cortan mal en la vista lineal → rotación, truncado con tooltip.
36. Caracteres catalanes (l·l, à, è, ç) mal renderizados o mal ordenados → UTF-8 en todo el pipeline y `localeCompare` con `ca`.

### 12.5 Backend / red
37. SSE cortado por proxies o plataformas con timeout de conexión → heartbeats cada 15 s y reconexión con `Last-Event-ID`.
38. Muchos clientes a la vez (si la demo se comparte) → el cálculo de simulación se hace una vez por tick y se difunde, no por cliente.
39. Respuestas cacheadas por CDN donde no deben (stream, vehicles) → `Cache-Control: no-store` explícito.
40. CORS mal configurado en producción → probar con el dominio real antes de la reunión.
41. Cold start del hosting gratuito (30 s de arranque) → el frontend arranca en simulación local mientras el backend despierta; nunca pantalla en blanco.
42. Overpass caído o lento durante el build → usar siempre la copia en `data/raw/`; `--refresh` es opcional.

### 12.6 Producto / legal
43. Confundir simulación con tiempo real ante TUS → banner, etiquetas de origen y documentación claras. Esto es también un argumento de venta: "imagina esto con vuestros datos reales".
44. Usar logo o marca de TUS sin permiso → no usar su logo; nombre del proyecto propio y mención descriptiva ("dades de la xarxa TUS").
45. Falta de atribución OSM/mapa base → incumplimiento de licencia. Visible siempre.

---

## 13. HITOS (cada uno cerrado con tests + commit + resumen)

1. **H0 – Descubrimiento:** consultas Overpass, informe de calidad de OSM, lista real de líneas TUS. → Me reportas y me haces las preguntas abiertas.
2. **H1 – Esqueleto:** monorepo, tooling, CI, `CLAUDE.md`, `docs/PLAN.md`.
3. **H2 – Pipeline de red:** OSM → patterns limpios → `network.json` + informe. Visualizador mínimo de depuración (todas las líneas y paradas en el mapa, con warnings marcados).
4. **H3 – Horarios y calendario:** `tus-horaris.yaml` con estimaciones marcadas, festivos, validación, GTFS propio validado.
5. **H4 – Motor de simulación** en `packages/core` con todos sus tests (incluidos los de tiempo).
6. **H5 – Backend:** endpoints, SSE, provider simulado, `GtfsRtProvider` probado con fixture.
7. **H6 – Frontend núcleo:** mapa, buses animados, ficha de bus, selector de líneas, banner, i18n.
8. **H7 – Vistas secundarias:** vista lineal, panel de parada, buscador, avisos, capa interurbanos.
9. **H8 – Modo presentación + modo offline/sin backend.**
10. **H9 – Pulido:** accesibilidad, rendimiento, Lighthouse, estados vacíos/error, PWA.
11. **H10 – Despliegue + `docs/PITCH.md`:** URL pública, checklist pre-reunión, y un documento de 1 página para TUS: qué es, qué datos usa, qué ganaría TUS (visibilidad, imagen de modernidad, cero coste de desarrollo para ellos, ejemplo de Terrassa con datos abiertos), y qué necesitamos exactamente de ellos (feed GTFS-RT o acceso de lectura a su SAE, GTFS estático oficial, frecuencia de refresco deseada).

---

## 14. DEFINICIÓN DE "HECHO" DEL PROYECTO
- [ ] Todas las líneas TUS existentes en OSM se ven correctamente; las que no, están listadas con el motivo.
- [ ] Los buses se mueven de forma creíble, sin saltos, sin cortar esquinas, sin retroceder.
- [ ] Ficha de bus, vista lineal, panel de parada, buscador y avisos funcionan en móvil y escritorio.
- [ ] El banner de "posiciones simuladas" está siempre visible y las etiquetas de origen del dato son correctas.
- [ ] Funciona sin backend y sin conexión (modo demo offline).
- [ ] Modo presentación aguanta 30 min sin degradarse.
- [ ] Tests unitarios, de API y e2e en verde en CI; GTFS propio validado sin errores.
- [ ] Lighthouse móvil en los umbrales de la sección 8.
- [ ] `README.md`, `docs/DATA.md` y `docs/PITCH.md` completos; atribuciones y licencias correctas.
- [ ] Checklist pre-reunión: URL probada en 4G desde un móvil real, modo offline probado, hora forzada preparada.

---

## 15. PRIMER MENSAJE QUE ESPERO DE TI
1. Confirmación de que has leído todo.
2. Resultado del descubrimiento en OSM (H0) con números.
3. Lista de decisiones técnicas que propones cambiar respecto a este documento (si alguna), con el motivo.
4. Máximo 5 preguntas que solo yo pueda responder.

No empieces H1 hasta que te responda.
