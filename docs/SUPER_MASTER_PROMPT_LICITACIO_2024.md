# SUPER MASTER PROMPT — Alinear NextMobility Sabadell con la licitación municipal de 2024 (expediente OTU/2024/113)

> Copia todo lo que hay debajo de la línea en una sesión nueva de Claude Code abierta sobre el repositorio
> `paugc2004-hub/BUS-SABADELL`. Adjunta (o deja accesibles por Google Drive) los documentos originales de la carpeta
> «NEXTMOBILIY SABADELL». Preparado el 2026-10-11 a partir de la lectura de los 20 archivos de esa carpeta.

---

## 0. Rol, objetivo y límites

Eres el ingeniero principal de **NextMobility Sabadell** (repo `paugc2004-hub/BUS-SABADELL`, demo
https://bus-sabadell.vercel.app, app https://bus-sabadell.vercel.app/app). Dentro de una semana se presenta la
propuesta al Ayuntamiento de Sabadell / TUS. Tu misión: **contrastar el software existente con la documentación
municipal de 2024 y aplicar los cambios necesarios para que el producto responda lo máximo posible a lo que allí se
pidió**, sin romper nada que ya funcione y sin faltar a la verdad sobre el origen de los datos.

Antes de tocar nada lee, en este orden: `CLAUDE.md` (reglas del repo, **obligatorias**), `docs/HANDOFF.md`,
`docs/FINAL_APP_AUDIT.md`, `docs/SPEC.md`, `docs/TRANSIT_ROUTING.md`, `docs/SECURITY_AUDIT.md`, `README.md`.

### 0.1 Hecho fundamental que condiciona todo (léelo dos veces)
La documentación de 2024 **no licita una app móvil**. Licita el **«Disseny, implantació i manteniment de la nova web del
servei de transport urbà de Sabadell»** (la web corporativa `www.tus.es`, con gestor de contenidos/CMS y back office).
La propia documentación dice que TUS ya tiene dos canales: la web `www.tus.es` y la «App TUS», y prevé analizar la app
actual como insumo de consultoría. Por tanto:
- Lo que pide el pliego es una **web responsive** con módulos de información al viajero **más** módulos corporativos
  (perfil del contratante, ofertas de empleo, área privada de empleados, «Mou-te en autobús»), todo gestionable desde
  un CMS de código abierto.
- NextMobility es una **PWA de experiencia ciudadana** (landing + app). El encaje honesto es: *NextMobility cubre y
  supera el bloque de información al viajero del pliego, y propone cómo cubrir el resto*. **No** presentes
  NextMobility como «la web licitada», ni como adjudicataria, ni como producto oficial.
- No sabemos (no consta en los documentos) a quién se adjudicó ni si la web se llegó a desplegar. **No lo inventes.**

### 0.2 Reglas no negociables (además de las de `CLAUDE.md`)
1. **Nunca presentar una posición simulada como real.** Mantén el banner, la etiqueta de origen
   (`SIMULATED` | `SCHEDULED` | `REALTIME`) y los textos. El pliego habla de «temps real» vía SAE: aquí **no lo hay**.
   Donde el pliego pida tiempo real, muestra la estimación simulada **etiquetada** y deja preparada la integración.
2. **Nada de ingeniería inversa** de la app TUS/GeoActio ni de APIs privadas, aunque el pliego mencione un
   «webservice» del SAE con credenciales que facilitaría TUS: eso es para el adjudicatario. No hay credenciales.
3. **Marca:** el pliego exige respetar el manual de marca de TUS (Annex PPT‑1). `CLAUDE.md` prohíbe usar el logo y la
   marca de TUS. **Prevalece `CLAUDE.md`.** Puedes preparar un *tema opcional* basado en los valores cromáticos y
   tipográficos documentados (ver §3.2), **sin logotipo ni nombre «TUS» como marca**, desactivado por defecto y
   documentado como «preparado para cuando haya autorización».
4. **No añadir logos institucionales** (Ajuntament de Sabadell, NextGenerationEU, Plan de Recuperación, Ministerio):
   el pliego los exige *al adjudicatario de un contrato financiado*; ponerlos en NextMobility daría a entender una
   financiación o un encargo que no existe.
5. **No crear formularios que recojan datos personales reales** (reclamaciones, reservas Mou‑te, login de
   empleados, candidaturas). Si se prototipan, que sean maquetas navegables **claramente marcadas como demostración**,
   sin enviar ni guardar nada.
6. La ubicación del usuario **nunca** sale del dispositivo (incluido: no enviarla a Google Maps sin una acción explícita
   del usuario; ver §4.9).
7. Ningún secreto en el repo. Respeta la política de antigüedad mínima de pnpm (no `minimumReleaseAgeExclude`).
8. No desplegar, no hacer push ni abrir PR sin autorización expresa del usuario. Commits locales sí.

### 0.3 Clasificación obligatoria de toda información (aplícala en código, datos, textos y documentos)
Etiqueta cada dato, requisito o afirmación con una de estas categorías y no las mezcles:

| Etiqueta | Significado | Ejemplos |
|---|---|---|
| **DOC-2024** | Requisito o dato expreso en la documentación municipal de 2024 (cita archivo y apartado) | «WCAG 2.1 AA» (PPT §2.1.1) |
| **HIST-2019** | Dato histórico del manual de marca (mayo 2019) incluido como anexo en 2024 | Plano de red «a partir del 18 de març de 2019», colores de líneas del plano |
| **PUBLIC-ACTUAL** | Dato público vigente obtenido de fuentes abiertas, con fecha de extracción | `network.json` (tus.es, extracto 2026‑10‑06), OSM |
| **SIMULADO** | Generado por el motor de simulación a partir de horarios publicados | Posiciones, ETA, retrasos |
| **NO-CONFIRMADO** | Dato cuya vigencia no se ha podido verificar | Tarifas, puntos de venta, teléfonos, horarios de oficina, colores 2019 vs. actuales |
| **INTERPRETACIÓN** | Deducción propia, no escrita en los documentos | «El planificador propio supera el requisito de derivar a Google Maps» |

Crea `docs/LICITACIO_2024_TRAZABILIDAD.md` con una **matriz de trazabilidad**: una fila por requisito (ID, cita literal
en catalán, archivo y apartado, etiqueta, estado en el repo antes/después, archivos que lo implementan, prueba que lo
verifica, decisión si no se implementa y por qué).

---

## 1. Fuentes (documentación original, carpeta «NEXTMOBILIY SABADELL»)

Lee los originales; este prompt resume pero **no sustituye** su lectura. Si no tienes acceso, dilo y pide al usuario
que los suba (sugerencia: copia local en `docs/fonts-2024/`, **añadida a `.gitignore`**: no se publican en el repo).

| Archivo | Qué es | Relevancia para el producto |
|---|---|---|
| `Plec prescripcions tècniques.pdf` (PPT, 30 pág., 03‑06‑2024) | Requisitos técnicos y funcionales | **Fuente principal** |
| `Annex 1 PPT.pdf` (17 pág.) | «Manual de marca i línia gràfica» de TUS, **mayo 2019** | Colores, tipografía, plano de red y líneas (en imágenes) |
| `Informe tècnic aprovació inici expedient WEB.pdf` (03‑06‑2024) | Justificación + cuadro resumen | Objetivos, criterios de adjudicación, «eines del nou SAE» |
| `ANNEX 1 (Quadre Resum) POS_AE.pdf` (17‑06‑2024) | Cuadro resumen definitivo | Plazos, pagos, mesa, criterios |
| `Decret AE Disseny Web .pdf` (Decret 11061/2024, 05‑07‑2024) | Aprobación del expediente | Importes, financiación NextGenerationEU |
| `Annex 2 Desglossament pressupost base licitació.pdf` | Desglose del presupuesto | Contexto económico |
| `PCAP+Annexos.pdf` y Annexos 3–9 (.doc/.docx) | Cláusulas administrativas y modelos de declaración | Protección de datos, PI, obligaciones (ver §1.1) |

### 1.1 Datos clave del expediente (DOC-2024)
- Expediente **OTU/2024/113**; procedimiento abierto simplificado (art. 159 LCSP). CPV 72413000, 72422000, 72415000.
- Presupuesto base 86.000 € sin IVA (104.060 € con IVA): Fase 1 conceptualización y diseño 29.999,99 €; Fase 2
  desarrollo e implantación 45.000,01 €; mantenimiento 2 años 11.000 €.
- Plazos: Fase 1 = 2 meses (conceptualización, maquetas navegables, análisis funcional); Fase 2 = 3 meses; mantenimiento
  24 meses ampliable a 43; hosting 5 años adicionales. Duración total 2 a. 5 m. (entre 2 a. 3 m. y 4 a.).
- Criterios de adjudicación (todos por fórmula): oferta económica **70**; reducción del plazo de diseño+desarrollo
  **15**; ampliación del mantenimiento **8**; experiencia del equipo **5**; horas de formación **2**.
- Financiación: parte de diseño/desarrollo con fondos **NextGenerationEU / PRTR** (actuación P17‑L2‑20210927‑1,
  proyecto 2024/3/NGEU/3 «Digitalització activitat transport públic urbà i millora servei i informació a l'usuari»).
- Responsable del contrato: Cap del Servei de Mobilitat; interlocución técnica: Cap d'Equip de Transports.
  *(No pongas nombres ni correos personales en el producto.)*
- Objetivos declarados (PPT §1.2 e Informe): 1) mejorar la experiencia de usuario; 2) navegabilidad y arquitectura de
  menús; 3) *look and feel* e interfaz; 4) funcionalidades y *gadgets* actualizados por sistema operativo;
  5) tecnología más eficiente en velocidad, seguridad y compatibilidad. Cuadro resumen, apartado D: «Incorporar eines
  del nou Sistema d'Ajuda a l'Explotació per poder informar en temps real als usuaris», «Foment d'una mobilitat
  sostenible», «Incorporar eines per a la millora de l'accessibilitat al transport públic».

### 1.2 Lo que añaden el PCAP y los anexos 3–9 (DOC-2024)
Son el pliego administrativo tipo del Ayuntamiento (Decret 1071/2022) y formularios en blanco. **No contienen
requisitos de producto** sobre accesibilidad, idiomas de la web, cookies, ENS, propiedad intelectual, marca, app,
GTFS, SAE, mapas ni QR. Lo único relevante:
- Protección de datos: el adjudicatario sería **encargado del tratamiento** y el Ayuntamiento el **responsable**
  (PCAP 20.3–20.4); medidas técnicas y organizativas (20.5); declaración de **dónde estarán los servidores** antes de
  formalizar, como obligación esencial (17.3 c–e); Annex 8: derechos ARSOPL, deber de información en el momento de la
  recogida, notificación de brechas < 48 h, registro de actividades, seudonimización y cifrado «si escau».
  → Para NextMobility: mantener el principio actual (sin datos personales en servidor, ubicación solo en el
  dispositivo) y documentarlo en `/privacitat`; en la propuesta, describir dónde se alojaría (Vercel, región) y el
  papel de encargado del tratamiento.
- Servicio a la ciudadanía (PCAP 16.17): continuidad del servicio y derecho de uso en las condiciones establecidas.
- Recepción y garantía (PCAP 42–43): recepción formal «a satisfacció de l'Ajuntament»; calidad técnica garantizada.
- Los logos NextGenerationEU/PRTR aparecen en las páginas del propio PDF; **ninguna cláusula exige ponerlos en la
  web** (y en NextMobility no deben aparecer, §0.2.4).
- Incoherencias internas a no reproducir: el Annex 2 da 36 €/h y 25 €/h en el texto pero 35 €/h y 26 €/h en la tabla
  (los totales cuadran con la tabla); el Annex 2 dice «contracte de subministrament» cuando es de servicios; la
  garantía definitiva figura como «Exigida» en el informe técnico y «No exigida» en el cuadro resumen definitivo.
- Nota de fuente: la copia de `PCAP+Annexos.pdf` en Drive está **truncada** (6.029.312 bytes, sin tabla xref); su texto
  se recuperó reconstruyendo el PDF (71 páginas). Si necesitas citarlo, pide al usuario el original del perfil del
  contratante.

---

## 2. Fase A — Inspección (no cambies nada todavía)

1. Instala y comprueba la línea base: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm --filter @bus/web build`, e2e (`cd apps/web && npx playwright test`; en Claude Code web usa
   `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`). Anota los números reales (hoy: 116 unitarias, 99 e2e).
2. Recorre la app real: `node apps/web/scripts/ux-tour.mjs <dir> 390x844 antes` y capturas de escritorio.
3. Rellena la columna «estado antes» de la matriz de trazabilidad para **cada** requisito de §4 y §5, citando
   `archivo:línea`. Estado conocido a 2026‑10‑11 (verifícalo, no lo des por bueno):
   - Ya existe: cerca universal (paradas, líneas, calles, lugares), panel de parada con próximas llegadas por línea,
     índice y panel de línea con sentido/recorrido/frecuencias, mapa MapLibre con trazados, planificador propio
     (`packages/core/src/plan.ts`, ≤1 transbordo), catalán/castellano, PWA instalable, avisos por parada
     (`msgincidencia` de tus.es) y `data/config/avisos.yaml` (hoy vacío), accesibilidad axe AA en pantallas clave.
   - No existe: QR por parada, agrupación (*cluster*) de paradas en el mapa, descarga/impresión de horarios y plano,
     horario teórico completo por parada imprimible, indicador de aviso en la lista de líneas, tarifas y títulos,
     puntos de venta, atención al cliente/FAQ/normativa, noticias y campañas, página de privacidad/aviso legal/cookies,
     SEO por idioma (meta por ruta, `hreflang`, sitemap), planificador con fecha/hora de salida o llegada, enlace
     opcional a Google Maps, importación de GTFS como **entrada** con informe de cambios, módulo de descarga de app con
     detección de sistema operativo.
4. Entrega un informe breve de la Fase A (qué cumple, qué falta, qué no procede) **antes** de implementar.

---

## 3. Diseño visual

### 3.1 Requisitos de diseño (DOC-2024, PPT §2.1.2 y §2.1.1)
- Diseño **responsive** (ordenador, tableta, móvil). Navegadores: **Chrome, Firefox, Edge, Safari y Opera**, sin plugins.
- Diseño coherente en todas las secciones con **elementos comunes** (header, footer, navbar) definidos una sola vez.
- **Header** en todas las páginas: logo, menú de navegación, **barra de búsqueda** y elementos esenciales.
- **Footer** en todas las páginas: política de privacidad, política de cookies, aviso legal y enlaces de interés.
- Proporción aproximada **60 % grafismos / 40 % texto**.
- **WCAG 2.1 nivel AA**; catalán y castellano en todos los contenidos; buena indexabilidad SEO por idioma.

### 3.2 Valores del manual de marca (HIST-2019, Annex PPT‑1, «Manual corporatiu. Maig 2019»)
- Color corporativo: **Pantone 347 C** — CMYK 82/11/73/0 — RGB 28/130/81 — **#1c8251** — RAL 6024. Más blanco y negro;
  escalas al 5/10/15/25/50 %. En la aplicación al autobús aparecen «NEGRE», «PANTONE 347» (C100 M0 Y79 K8) y
  «PANTONE 401» (C0 M6 Y15 K23,5; gris cálido).
- Tipografía corporativa **Interstate** (Light, Regular, Black en las piezas); alternativa **Arial**.
- Piezas del manual: plano de marquesina, plano de bus urbano, horarios de mano, «termòmetres» de parada (diagrama
  lineal de paradas de cada línea), chincheta «Vostè està aquí», cartel/díptico PunTUS (puntos de venta), anuncios.
- Cómo usarlo aquí: crea `apps/web/src/themes/manual-2019.css` con *tokens* (`--brand`, `--brand-ink`, escalas) y una
  variable para la familia tipográfica con *fallback* Arial; **sin** logotipo TUS, **sin** cargar Interstate (licencia
  comercial: no la incluyas ni la descargues). Desactivado por defecto; activable con `?tema=manual-2019` solo en
  entorno de demo. Comprueba contraste AA de cada combinación (el verde #1c8251 da 4,82:1 sobre blanco y 3,86:1 sobre el gris #e8e6df; verifícalo con
  axe y documenta los usos válidos: texto normal sí, texto pequeño sobre gris claro no).
- La identidad por defecto sigue siendo **NextMobility** (`ui/Logo.tsx`), clara para el ciudadano.

### 3.3 Colores de línea (cruza fuentes, no sustituyas a ciegas)
El repo usa los colores de tus.es (PUBLIC-ACTUAL, `apps/web/public/data/network.json`). La leyenda del plano de red 2019
(HIST-2019, Annex PPT‑1, pág. 8) da estos colores **aproximados** (muestreados de una imagen rasterizada a 400 ppp;
precisión ±10 por canal):

| Línea (2019) | Recorrido según leyenda 2019 | Color aprox. 2019 | Color actual repo |
|---|---|---|---|
| L1 | Can Deu – Estació Sud | #e43c3c | #e63027 |
| L2 | Can Deu – La Creu de Barberà | #003c84 | #004996 |
| L3 | Can Deu – La Romànica | #966612 | #b05f00 |
| L4 | El Poblenou – Can Roqueta – La Roureda | #06962a | #009a42 |
| L44 | El Poblenou – Parc Taulí (lun–vie) | #fcea00 | #ffed00 |
| L14 / L14ds | Can Roqueta – Parc Taulí (lun–vie) / – Els Merinals (sábados) | #c00630 | #c3002f |
| L5 | Les Termes – Can Rull | #c60060 | #dd007e |
| L55 | Les Termes – Can Llong | #006696 | #00679a |
| L15 | La Bassa – Centre | #c69012 | #c7921e |
| L7 | Castellarnau – Can Puiggener | #0096c6 | #0099cc |
| L11 | Castellarnau – Sant Pau de Riu‑sec | #9cc6e4 | #b0d2f0 |
| L10 | Plaça de Picasso – Sant Julià | #96c060 | #c4d984 |
| L80 | Plaça de Picasso – La Plana del Pintor | #8a368a | #9b338a |
| L8 | La Roureda – Estació Sud | #f09636 | #f28d2c |
| L12 | Estació Centre – Sant Quirze Parc | #606030 | #7b7223 |
| L23 | Can Roqueta – Torre‑romeu (lun–vie lectivos) | #969696 | #acaa9f |
| F1–F6, F15 | Festivos (en 2019: círculo blanco con aro de color) | aros pastel | colores pastel |

Reglas: **mantén los colores de tus.es** (más recientes) como fuente de verdad; documenta la tabla en la matriz;
señala diferencias de recorrido entre 2019 y hoy (p. ej., L4/L23, L14ds) como HIST‑2019 y **no** alteres la red
por el plano de 2019. Si una línea no alcanza contraste AA con texto blanco (L44 amarillo, L10, L11, F*), usa texto
oscuro en el chip (ya lo hace `ui/common.tsx`; verifícalo).

### 3.4 Elementos gráficos del manual que sí aportan valor al ciudadano (INTERPRETACIÓN)
- **«Termòmetre» de línea**: diagrama lineal de paradas con transbordos — encaja con la línea temporal de parada/línea.
- **«Vostè està aquí»**: marcador de posición del usuario en la ficha de parada (QR, §4.1).
- **Plano esquemático** de red (descargable/imprimible).

---

## 4. Requisitos funcionales a implementar (prioridad para la presentación)

Para cada uno: implementa, añade pruebas, actualiza la matriz. Orden de prioridad: P0 (antes de la presentación),
P1 (si da tiempo), P2 (solo documentar como propuesta).

### 4.1 [P0] QR por parada y ficha de parada (DOC-2024, PPT §2.1.5)
Requisito literal: servicio web para generar un QR por cada parada (y futuras), que guarde una URL a una **ficha de
parada** adaptativa con, como mínimo, **código y nombre de la parada, líneas que pasan y horarios de paso en tiempo
real**, entre otros datos.
- Ruta pública estable `/parada/<codi>` (ya existe `/parada/:id`; confirma que el id es el **código público** de TUS y
  que funciona sin sesión ni pantalla de bienvenida al entrar desde un QR).
- Ficha: código + nombre bien visibles, chips de líneas, próximas llegadas **etiquetadas como estimación simulada**
  (no «tiempo real»), horario teórico, mapa pequeño con «Vostè està aquí» = la parada, avisos que afectan a la parada.
- Generador: página `/qr` (y `/qr/<codi>`) que genere QR **en el cliente** (SVG y PNG descargables, imprimibles en A6
  con código y nombre de la parada). Usa una librería de QR de código abierto, mantenida y verificada (comprueba
  repositorio, licencia y antigüedad mínima de pnpm) o un codificador propio probado; nada de servicios externos.
- Pruebas: unitaria (el QR decodifica a la URL correcta para varias paradas; usa un decodificador en test), e2e (abrir
  `/parada/<codi>` en móvil sin sesión → muestra código, nombre, líneas, llegadas etiquetadas), accesibilidad axe.

### 4.2 [P0] Líneas y horarios (DOC-2024, PPT §2.2.1 «Mòdul de planificació de viatges»)
- **Lista de líneas**: solo número, nombre e **indicador de aviso activo** que afecte a la línea.
- **Detalle de línea**: itinerarios (sentidos/variantes) y paradas de forma simple y gráfica (termómetro), **trazado
  exacto sobre el mapa**, **frecuencias por tipo de día** (laborable/sábado/festivo), **horario teórico de paso por
  cada parada**, todo **consultable e imprimible** (hoja de estilos `@media print` + botón «Imprimir»; opcional PDF
  generado en cliente). Enlaces de descarga del horario y del plano.
- Al pulsar una parada: tiempos de paso de **todas** las líneas que pasan; poder usarla como **origen o destino** de una
  ruta, verla en el mapa o consultar su tiempo de paso.
- Datos: horarios de `network.json` (PUBLIC-ACTUAL). Muestra «Horari publicat per TUS · extret el <fecha>».

### 4.3 [P0] Paradas: búsqueda geoposicionada y *cluster* (DOC-2024, PPT §2.2.1 «Parades» y «Mòdul de pas per parada»)
- Buscador ágil por **número de parada o texto** que liste las coincidentes; al elegir una: líneas y tiempos de paso,
  y la parada en el mapa con **otras paradas cercanas agrupadas en cluster**.
- Implementa el *clustering* con la opción nativa de MapLibre (`cluster: true` en la fuente GeoJSON) — **no** cambies de
  librería de mapas. Mide el rendimiento antes/después con `apps/web/scripts/perf-probe.mjs` (regla del repo: nada de
  `backdrop-filter` ni animaciones de sombra sobre el mapa).
- Pruebas: e2e de búsqueda por código («278») y por nombre con/sin acentos; cluster visible a zoom bajo y paradas
  individuales al ampliar.

### 4.4 [P0] Avisos / incidencias (DOC-2024, PPT §2.2.1 «Mòdul d'avisos i notícies»)
Cada aviso: descripción, motivo, **líneas y paradas afectadas**, periodo de la incidencia, **fecha de publicación y de
expiración**, adjuntos (documentos/imágenes). Destacados en portada, en la lista de líneas (indicador) y en la parada.
- Extiende el esquema zod de `data/config/avisos.yaml` (motivo, publicació, expiració, adjunts) sin romper los avisos
  `msgincidencia`. **No inventes incidencias reales**: para la demo, crea avisos de ejemplo marcados `demo: true` y
  visibles como «Exemple», o importa solo avisos publicados en tus.es citando URL y fecha.
- Pruebas: un aviso caducado no se muestra; uno futuro no se muestra antes de su publicación; indicador en la lista.

### 4.5 [P1] Planificador de rutas (DOC-2024, PPT §2.2.1 «Planificador de rutes»)
El pliego pide un formulario origen/destino/**fecha y hora de salida o llegada** que **derive a Google Maps**.
- Mantén el planificador propio (INTERPRETACIÓN: supera el requisito y usa las mismas horas que el resto de la app).
- Añade selector **«Sortir ara / Sortir a les… / Arribar a les…»** con fecha. «Arribar a les» requiere búsqueda hacia
  atrás en `planTrip` (o iterar salidas): implementa y prueba con propiedades (fast-check) igual que
  `packages/core/test/plan-network.test.ts`.
- Añade un botón opcional **«Obrir a Google Maps»** (modo transporte público) que solo se construye al pulsarlo y avisa
  de que se comparten origen y destino con Google. Nunca automático.
- Las paradas de cualquier vista deben poder fijarse como origen o destino (ya hay `?de=`; verifícalo).

### 4.6 [P1] Tarifas y títulos; puntos de venta (DOC-2024, PPT §2.2.1 y §2.2.3)
- Tarifas: lista y detalle (precio, destinatarios, condiciones, imagen de la tarjeta), **títulos propios y ATM**.
- Puntos de venta: lista + mapa (dirección, horario, títulos vendidos). El pliego prevé **CSV** como formato de
  importación (punts de venda: nom, adreça, coordenades; tarifes: nom, descripció, viatges, transbords, import).
- Datos: solo de fuentes públicas (páginas de tus.es / ATM), descargadas una vez, guardadas en `data/raw/` con fecha y
  URL, y marcadas **NO-CONFIRMADO** en la interfaz («Preu publicat a … el …; confirma-ho abans de viatjar»). Si no hay
  fuente pública fiable, **no lo implementes con datos**: deja la estructura y un estado vacío honesto.
- Implementa el importador CSV con validación zod y **informe de importación** (ver §5.2).

### 4.7 [P1] Información, atención al cliente y páginas legales
- **Atención al cliente** (PPT): contacto, horario y ubicación de la oficina con mapa; **FAQ**; **normativa** (derechos y
  deberes, perros en el bus, etc.). Contenidos solo de fuentes públicas citadas o marcados como texto de ejemplo.
- **Formulario de reclamaciones**: el pliego exige envío a correo corporativo, registro histórico y **captcha**. Aquí
  **no** hay servicio real: implementa solo una maqueta marcada «Demostració — no s'envia res» o un enlace al canal
  oficial de TUS. Nada de recoger datos.
- **Páginas legales** (pendiente desde `docs/HANDOFF.md`): `/privacitat`, `/avis-legal`, `/galetes` en ca/es.
  Hoy la app no usa cookies de terceros: la política de galetes debe decirlo con exactitud (localStorage propio:
  sesión ficticia, paradas guardadas, idioma). Mecanismo para ejercer derechos RGPD: explicar que los datos viven en
  el dispositivo y botón «Esborra les meves dades».
- Footer común con esos enlaces + atribución OSM/mapa base (regla del repo).

### 4.8 [P1] SEO y compatibilidad (DOC-2024, PPT §2.1.1)
- Títulos y `meta description` por ruta e idioma, `hreflang` ca/es, `sitemap.xml` con líneas y paradas, datos
  estructurados razonables. Como es una SPA en Vercel, valora **prerenderizar** las páginas públicas (landing, líneas,
  paradas, páginas legales) en el build sin cambiar de framework; mide el impacto.
- Playwright: añade proyectos **firefox** y **webkit** activables por variable (en Claude Code web no se pueden
  instalar navegadores: documenta que se ejecutan en local/CI; no ejecutes `playwright install` aquí).

### 4.9 [P1] Módulo de descarga de la app (DOC-2024, PPT §2.2.1)
El pliego pide acceso desde la portada a descargar la app según el sistema operativo (Google Play / App Store).
Para NextMobility: botón de **instalar la PWA** con instrucciones según el sistema (Android: aviso de instalación;
iOS Safari: «Afegeix a la pantalla d'inici»), y enlace a Google Play solo si el paquete `app.nextmobility.sabadell` está
publicado (pregunta al usuario; **no** enlaces a la App TUS como si fuera nuestra).

### 4.10 [P2] Solo documentar como propuesta (no implementar funcionalidad real)
Campañas informativas (carrusel con fechas), noticias con buscador por fechas/texto, información corporativa,
**perfil del contratante**, **ofertas de empleo**, **área privada de empleados (~200 usuarios)**, **«Mou‑te en autobús»**
con reservas, exportaciones (reclamaciones CSV, contratos/ofertas en PDF con fecha de publicación, reservas Mou‑te),
estadísticas de acceso (el pliego propone Google Analytics). Redacta en `docs/LICITACIO_2024_PROPOSTA_CMS.md` cómo se
cubrirían con un **CMS de código abierto** (el pliego cita Liferay, Drupal, Joomla o WordPress; servidor 100 % código
abierto) conectado como *headless* a NextMobility, con usuarios y roles, marca activo/inactivo por contenido y
analítica respetuosa con la privacidad (consentimiento previo; alternativa sin cookies). Son módulos corporativos de
TUS: **no** los simules con datos inventados.

---

## 5. Datos

### 5.1 Validación de la red (obligatoria tras cualquier cambio de datos)
`pnpm data:build` (determinista: CI comprueba `git diff` de `network.json`), `pnpm data:audit` (falla si hay errores),
`pnpm test` (incluye la auditoría de la red). Comprueba: 23 líneas, variantes, 408 paradas validadas, trazados sobre
calle, paradas en orden. **No descargues** de nuevo de tus.es/Overpass/GTFS salvo necesidad y con fecha (`data:refresh`
es «rarament!»).

### 5.2 Importación GTFS / GTFS‑RT (DOC-2024, PPT §2.2.3)
El pliego exige importar, a demanda y programado, **GTFS** (línea: número, nombre, color; itinerario: número, nombre,
origen, destino, línea; paradas: número, nombre, coordenadas, tipo; trazados; calendario de activación; horarios
teóricos: itinerario, orden, parada, hora y minuto) y **GTFS Realtime** si procede, con **informe detallado de cambios y
errores** consultable después.
- Hoy el pipeline **genera** GTFS (`dist/gtfs.zip`, validado en CI con el validador de MobilityData). Añade la vía
  inversa: `pnpm data:import-gtfs <zip>` que lea un GTFS estático (por ejemplo, el propio `dist/gtfs.zip` como prueba de
  ida y vuelta), lo convierta al modelo de `network.json` y escriba `dist/import-report.md` (altas, bajas, cambios por
  línea/parada/horario y errores). Prueba de ida y vuelta: exportar → importar → misma red.
- GTFS‑RT: ya existe `GtfsRtProvider` en `apps/api`. Documenta y prueba con un *feed* sintético; **no** conectes a
  ningún SAE. La UI solo mostrará `REALTIME` cuando el proveedor sea real.
- Si en algún momento aparece un GTFS oficial de TUS público, úsalo como PUBLIC‑ACTUAL citado; no consta que exista.

### 5.3 Coherencia con la documentación
- La red de 2019 del manual es **HIST‑2019**: úsala solo para contrastar (colores, nombres de líneas). Lista las
  diferencias en la matriz; no reescribas recorridos con ella.
- Toda pantalla con horarios o ETA muestra su origen y fecha de extracción.

---

## 6. Requisitos no funcionales que debes verificar y reflejar

- Accesibilidad WCAG 2.1 AA (y RD 1112/2018): amplía `apps/web/e2e/quality.spec.ts` (axe‑core) a **todas** las
  pantallas nuevas (ficha QR, generador QR, línea imprimible, tarifas, páginas legales). Teclado completo, foco visible,
  lectores de pantalla (nombres accesibles en chips de línea y marcadores).
- Rendimiento: Lighthouse móvil y `perf-probe.mjs` antes/después; no empeorar.
- Seguridad (PPT §2.1.4): HTTPS, consentimiento previo antes de cualquier cookie o analítica, derechos RGPD, CSP del
  repo intacta (si añades scripts inline, actualiza los *hashes*). Ejecuta `bash apps/web/scripts/zap-baseline.sh`
  contra `vite preview` si hay Docker; si no, dilo.
- Disponibilidad >95 %/semana, monitorización 24/7, copias semanales, servidor de respaldo (PPT §3): **no** los
  prometas; descríbelos en la propuesta como compromisos del futuro servicio.
- Idiomas: todo texto nuevo en `i18n/ca.ts` y `i18n/es.ts`.

---

## 7. Proceso de trabajo y validación

1. Fase A (inspección) → informe → espera confirmación del usuario solo si una decisión cambia el alcance (p. ej.,
   tema de marca, datos de tarifas sin fuente). Lo demás, avanza.
2. Implementa por prioridad (P0 → P1). Un commit local por bloque, mensaje en catalán como el resto del repo.
3. Tras **cada** bloque: `pnpm lint && pnpm typecheck && pnpm test`, `pnpm --filter @bus/web build`, e2e completo,
   `pnpm data:audit` si tocaste datos. No sigas con fallos.
4. Pruebas nuevas mínimas: QR (unitaria + e2e), cluster (e2e), línea imprimible (e2e con `page.emulateMedia({media:
   'print'})`), avisos con fechas (unitaria), «Arribar a les» (propiedades), importador GTFS (ida y vuelta), CSV de
   puntos de venta/tarifas (validación y errores), páginas legales (axe), footer/header comunes en todas las rutas.
5. Revisión visual: `node apps/web/scripts/ux-tour.mjs <dir> 390x844 despres` y escritorio 1440×900; compara con
   «antes»; revisa que el banner de simulación sigue visible en cada pantalla con buses.
6. Revisión final con las skills instaladas en el repo: `web-design-guidelines` (UI/a11y),
   `vercel-react-best-practices` (rendimiento React) y `ui-ux-pro-max` (consultas de UX puntuales).

---

## 8. Entregables

1. Código y pruebas (commits locales; **sin push** hasta que el usuario lo autorice).
2. `docs/LICITACIO_2024_TRAZABILIDAD.md` — matriz completa (requisito → cita → etiqueta → estado → archivos → prueba).
3. `docs/LICITACIO_2024_PROPOSTA_CMS.md` — cómo se cubrirían los módulos corporativos y de back office.
4. `docs/LICITACIO_2024_PRESENTACIO.md` — guion de 5 minutos para la reunión: qué pedía el pliego, qué cubre ya
   NextMobility (con capturas), qué falta y qué haría falta de TUS (datos GTFS oficiales, acceso al SAE, autorización de
   marca). Frases prohibidas: «en temps real», «oficial», «adjudicat», «integrat amb el SAE».
5. Resumen final en el chat: archivos cambiados, pruebas creadas y ejecutadas con resultados reales, requisitos
   cumplidos / parciales / no aplicables, riesgos y siguientes pasos. Distingue **implementado**, **probado**,
   **documentado como propuesta** y **pendiente**. No afirmes nada que no hayas ejecutado.
