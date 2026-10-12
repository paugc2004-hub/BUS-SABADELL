# Paritat amb l'app oficial de TUS (TUS Sabadell 3.2.4, GeoActio) — H0

Estat del 2026-10-12. Anàlisi sense codi: què fa cada element de l'app oficial, què hi ha avui a NextMobility, què
falta i on guanyem. Especificació: «MASTER PROMPT v2 — Paritat funcional amb l’app oficial de TUS» (prompt v2 del 2026-10-12, seccions 3–9; no versionat). Rutes de fitxers relatives
a `apps/web/src/` si no s'indica el contrari.

Estats: `✅ fet` · `🟡 parcial` · `⬜ pendent` · `🔒 requereix integració amb TUS` (amb què caldria).

## 1. Matriu de paritat

### 3.3 Portada (hub de 5 targetes)
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 1 | Portada | Menú de 5 targetes; cal un toc més per veure res útil | `views/Home.tsx` `HomePanel`: «On vols anar?», cercador, 2 parades a prop amb llegades, enllaços a Tarifes/Punts de venda | Bloc «Serveis» (títols, targetes, avisos, info títols) | La portada ja és útil: on ets, cap on vas, quan passa el bus | 🟡 |
| 2 | «Consulta o recarga la tarjeta» | → Tarjetas | — | Serveis › Les meves targetes (demo) | — | ⬜ / 🔒 lectura real |
| 3 | «Viaja con el móvil» | → Mis títulos | — | Serveis › Els meus títols (demo) | — | ⬜ / 🔒 venda real |
| 4 | «Información del servicio» | → Mapa | Pestanya Mapa | — | — | ✅ |
| 5 | «Área personal» | → Mi cuenta | Avatar (`views/Chrome.tsx` `AccountMenu`) i pestanya Meus (`views/Mine.tsx`) | Vegeu 3.19 | — | 🟡 |
| 6 | «Información T-Sabadell» | NO OBSERVAT | `/tarifes` (`views/Fares.tsx`) amb títols, preus «a confirmar» i FAQ | Suports (cartró/PVC/mòbil) i dates de les magnètiques, **sense verificar** | Font i data a cada bloc | 🟡 |

### 3.4 Mapa
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 7 | Cabecera QR | NO OBSERVAT (lector) | — (només generador `/qr`) | Botó QR → lector (5.6) | — | ⬜ |
| 8 | Cabecera lupa | → Buscar parada | Cercador a Inici (`views/SearchBox.tsx`) | Botó lupa a la capçalera → Cercar parada | — | 🟡 |
| 9 | Triangle d'avisos amb punt | → Incidencias | Campaneta amb **comptador** només si hi ha actius (`Chrome.tsx` `TopBar`, `AlertsPanel`) | Que es vegi sempre (també amb 0) i a la capçalera mòbil | Comptador i no un punt; compta només els actius | 🟡 |
| 10 | Carrusel de novetats (6) | Banner a sobre del mapa | — | `novetats.yaml` + carrusel plegable (5.5) | Plegable, sense tapar el mapa | ⬜ |
| 11 | Parades | Centenars d'icones sense agrupar | Agrupació (`map/MapView.tsx` `stops-cluster`) | — | **Agrupades** | ✅ |
| 12 | Punts de venda «PV» | Gotes al mapa | Llista `/punts-de-venda` sense coordenades | Capa al mapa → cal geocodificar (vegeu pregunta 4) | Obert ara / a confirmar | 🟡 |
| 13 | Busos al mapa | No n'hi ha | Capa de busos simulats etiquetats | — | **Busos** (simulats; reals amb SAE) | ✅ |
| 14 | Recorreguts al mapa | No n'hi ha | Línies dibuixades amb el color | — | **Recorreguts** | ✅ |
| 15 | Ubica'm | Botó | `MapControls` | — | — | ✅ |
| 16 | Capes | Selector (contingut NO OBSERVAT) | Filtre de línies (`LineFilter`), sense selector de capes; interurbans al store sense UI | Selector: parades, busos, línies, punts de venda, oficina, avisos; desat | — | ⬜ |
| 17 | Barra inferior de 5 | Mapa · Líneas · Favoritos · Cómo llegar · Más | 4: Inici · Mapa · Línies · Meus | Decisió 5.1 (pregunta 1) | — | 🟡 |

### 3.5–3.7 Línies
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 18 | «Fecha: Hoy» | Tria data; la llista es filtra pel servei | Només avui (`views/Lines.tsx` `LinesIndex`, `engine.runsOn`); les que no circulen, atenuades | Selector Avui/Demà/Tria un dia + tipus de dia | Tipus de dia visible; «Mostra totes» | 🟡 |
| 19 | «Buscar línea...» | Cerca | Cercador general d'Inici troba línies («2», «l2») | Camp propi a Línies | — | 🟡 |
| 20 | Fila de línia | Cercle de color + «Origen - Destí» + › | Xip, nom, busos ara, «cada N min», insígnia d'avís | — | Freqüència i avisos a la fila | ✅ |
| 21 | Noms F4/F6 | «La Roureda - El Poblenou»; «Pl. Catalunya - S.P. Riu-sec (Festius Comercials)» | `network.json`: «El Poblenou - La Roureda»; «Pl. Catalunya - Sant Pau de Riu-sec» | Nom oficial de la llista de tus.es; marca de festius comercials | — | ⬜ |
| 22 | F6 només festius comercials | Al 12/10/2026 surt (és festiu comercial a Sabadell, vegeu §2) | El motor la fa circular **tots** els festius | Calendari `festius comercials` a `festius.yaml` i regla per a la F6 | — | ⬜ (bug de dades) |
| 23 | Triar sentit | 2 files | Pestanyes de sentit (`LinePanel`) | — | — | ✅ |
| 24 | Recorregut al mapa | Cadena de cercles, sense línia | Recorregut dibuixat i enfocat (`setFocusRoute`) | — | **Línia dibuixada** | ✅ |
| 25 | Llista de parades «N - Nom» | Ordre, sense hores | `lp-stops` amb busos entre parades | **Hora de pas per parada**, xips de transbord, avisos dins la fitxa | Busos entre parades | 🟡 |
| 26 | Tocar una parada | NO OBSERVAT | Obre la fitxa | — | — | ✅ |

### Fitxa de parada (miniatura de 3.3)
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 27 | Capçalera «43 - Casal Pere Quart» | Codi - nom | «Parada» + nom; el codi és al peu (`views/StopPanel.tsx`) | Codi a la capçalera | — | 🟡 |
| 28 | Xips de línia | Sí | Sí, només les que circulen avui | — | — | ✅ |
| 29 | Estrella | Preferida | Sí | — | — | ✅ |
| 30 | Refrescar | Botó | S'actualitza sola cada 5 s | Res (o botó per coherència) | Sense tocar res | ✅ |
| 31 | Compartir | NO OBSERVAT | Comparteix `/parada/<id>` | Compartir `/p/<codi>` (pública) | Fitxa pública amb QR | 🟡 |
| 32 | Taula «Llegada / Sentido» | Línia · min · sentit | Línia → destí · parades que falten · puntualitat amb origen · min · «després HH:MM» | — | Origen de la dada a cada fila | ✅ |
| 33 | Avisos a la parada | — | Inline | — | **Connectats** | ✅ |

### 3.8–3.10 Com hi arribo
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 34 | Origen + diana | Camp + ubicació | «De: … Canviar» a `views/Route.tsx` (`PlaceSearch`, «La meva ubicació») | Formulari explícit amb els 2 camps a la vista | — | 🟡 |
| 35 | Destí | Camp amb autocompletat | Cercador universal (`data/places.ts`) | — | Carrers, llocs i parades | ✅ |
| 36 | Intercanviar | No n'hi ha | — | Botó ⇅ | Millora | ⬜ |
| 37 | Hora | No n'hi ha | Ara / Sortir a / Arribar a (`planArriveBy`) | — | **Arribar abans de** | ✅ |
| 38 | «Planificar viaje» | Obre Google Maps | Calcula a l'app (`planTrip`) amb Puja a / Baixa a, seguiment | — | **Ruta dins l'app** | ✅ |
| 39 | Google Maps | És l'únic resultat | Enllaç `openGoogleMaps` | Revisar que sigui discret i marcat extern | — | ✅ |
| 40 | Prova 3.10 | F4 des de Mercat Central a les 12:00 | **Ja surt**: F4 parada 180 a les 12:00 → 12:11 (= Google 11:58–12:11). Alternatives: F3 i F2, no F1 + a peu | Test e2e/unitari amb rellotge fix; entendre per què no surt F1 | — | 🟡 |

### 3.11 Cercar parada
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 41 | Pantalla «por código, nombre o QR» | Camp + botó QR; buida | Cercador universal (codi inclòs però **no primer**) | Pantalla pròpia, codi exacte primer, botó QR | — | 🟡 |
| 42 | Estat buit | Res | — | Parades a prop, preferides i recents (5) | **Recents i a prop** | ⬜ |

### 3.12 Incidències
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 43 | Llista | Targetes en majúscules, «Más información» | `AlertsPanel` (línies, parades, motiu, adjunts, enllaç) i `core/alerts.ts` | **Dades**: `avisos.yaml` és buit; cal URL de cada avís (pregunta 3) | Xips de línies, a la línia i a la parada | 🟡 |
| 44 | Actius / propers | Tot barrejat | `isPublished` / `isOngoing` | Agrupar «Actius ara» / «Propers» | Insígnia només amb actius | 🟡 |
| 45 | L14ds | Text | L14 té patrons de variant; no hi ha ruta L14ds | Mapejar L14ds → L14 a l’avís | — | ⬜ |

### 3.13 Més
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 46 | Punts de venda | Fila | `/punts-de-venda` | Entrar-hi des de Més | Filtres, obert ara | 🟡 |
| 47 | Web de TUS | Enllaç | Enllaços a tus.es a avisos i tarifes | Fila a Més | — | 🟡 |
| 48 | Idiomes | Fila | Botó CA/ES a la capçalera | Fila a Més | A un toc | 🟡 |
| 49 | Accessibilitat | Fila (NO OBSERVAT) | Només `prefers-reduced-motion` del sistema; axe AA a e2e | Mida de text, alt contrast, reduir moviment | AA verificat | ⬜ |
| 50 | Xarxes | X, Facebook, Instagram, YouTube | — | Enllaços **verificats** (pregunta 3) | — | ⬜ |
| 51 | Versió | «3.2.4 Build 1» | Versió de dades a `AboutModal` | Peu a Més: versió app + data de la xarxa | Data de les dades | 🟡 |
| 52 | Pàgina Més | Sí | No existeix (hi ha `AboutModal` i `ui/LegalLinks.tsx`) | Vista nova | — | ⬜ |

### 3.14–3.17 Títols (demo)
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 53 | Els meus títols | Llista, buit, esgotats | — | `wallet/` `TicketingProvider` + `DemoTicketingProvider` | — | ⬜ · 🔒 venda i validació reals: API de venda/emissió de TUS, format de QR de les validadores, consulta de saldo |
| 54 | Comprar títol | Perfil + 3 productes | Preus a `data/fares.ts` (`verified:false`) | Pantalla de compra demo | — | ⬜ · 🔒 passarel·la de pagament de TUS |
| 55 | Detall i pagament | Bizum, Pagar, Cancel·lar | — | «Simular pagament (demo · no es cobra res)», Bizum desactivat sense logo, quantitat | Quantitat i total | ⬜ · 🔒 |
| 56 | Les meves compres / viatges | NO OBSERVAT | — | Historial demo | — | ⬜ |
| 57 | Info T-Sabadell | NO OBSERVAT | `/tarifes` | Suports i dates, verificats | — | 🟡 |

### 3.18 Targetes (demo)
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 58 | Consultar (NFC) | Llegeix la targeta | — | Pantalla explicativa, sense llegir res | — | 🔒 especificació de la targeta i API de saldo de TUS (prohibit fer enginyeria inversa) |
| 59 | Vincular / recarregar | NO OBSERVAT | — | Demo amb número `DEMO-XXXX-XXXX` | — | ⬜ · 🔒 API de recàrrega |

### 3.19 Compte
| # | Element | Què fa a TUS | NextMobility avui | Què falta | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 60 | Email | Sí | Nom i email (`views/Mine.tsx`) | — | Entrar sense compte (demo) | ✅ |
| 61 | Informació personal / perfil | Files | — | Editar nom; perfil de passatger | — | ⬜ |
| 62 | Preguntes freqüents | Fila | FAQ només a `/tarifes` | `faq.yaml` | — | 🟡 |
| 63 | Canviar contrasenya / Eliminar compte | Files | `auth/auth.ts` sense aquestes accions | Ampliar `AuthProvider` | Esborrat complet al dispositiu | ⬜ |
| 64 | Configuració | Fila | — | Idioma, avisos, accessibilitat, esborrar dades | — | ⬜ |
| 65 | Tancar sessió | Botó | «Sortir» | — | — | ✅ |

### On guanyem (secció 4 del prompt) — ja visible avui
Busos al mapa (#13), ruta dins l'app (#38), parades agrupades (#11), recorreguts dibuixats (#14), avisos connectats
(#33, #43 — falten dades), funcionament sense connexió (PWA, `vite.config.ts` `VitePWA`), català per defecte, fitxes
públiques amb QR propi (`/p/<codi>`, `/qr`), AA verificat amb axe. Pendents: recents/a prop a la cerca (#42),
ajustos d'accessibilitat (#49), coherència en les pantalles noves.

## 2. Verificació a tus.es (2026-10-12)

**Des d'aquest entorn no es pot obrir tus.es** (el proxy respon 403 i l'eina de lectura web no resol el domini);
tampoc sabadell.cat, Photon, Nominatim ni Overpass. El cercador web gairebé no indexa tus.es. Per tant:

| Dada | Estat | Detall |
|---|---|---|
| Tarifes generals (1,80 / 10,10 / 20,60 €) | Coincideix amb el que ja tenim | `data/fares.ts`, `verified:false` (font: dades facilitades el 2026-10-11); les captures de l'app també diuen 1,80 / 10,10 / 20,60 € |
| Perfils de passatger | **No verificat** | Només s'ha vist «General». `TODO(DECISION: PERFILS)` |
| Suports T-Sabadell (cartró 1 €, PVC 4,50 €, fi de les magnètiques) | **No verificat** | Cap resultat de cerca ho confirma |
| Punts de venda | Llista de 33 ja a `data/salesPoints.ts` (facilitada 2026-10-11) | Sense coordenades; geocodificar requereix xarxa (pregunta 4) |
| Oficina de Mobilitat | Ja a `salesPoints.ts`: «C. de l'Estació, 67», dl–dv 8–13 i 16–19 | Horari **no verificat** a tus.es; el trasllat del 8/9 surt només a la captura del carrusel |
| 4 avisos de 3.12 i URL | **No verificats; cap URL** | La cerca no troba cap d'ells. `avisos.yaml` es queda buit fins tenir les URL |
| Xarxes de TUS | **No verificat** des d'aquí | Les adreces del prompt (`tussccl`) no s'han pogut obrir; YouTube desconegut |
| F6 «Festius Comercials» | Nom confirmat indirectament | El resultat de cerca de la pàgina de línia de tus.es mostra «Pl. Catalunya - S.P. Riu-sec (Festius Comercials)» |
| Festius comercials de Sabadell 2026 | Segons el resum del cercador (sabadell.cat, no llegit directament) | 4 i 11 de gener, 15 d'agost, **12 d'octubre**, 29 de novembre, 6, 8, 13, 20 i 27 de desembre. Explicaria que l'app oficial ensenyi la F6 el 12/10. Cal confirmar-ho |
| F4 | Les dues variants existeixen a `data/raw/tus/2026-10-06/F4.json` | El nom de la línia depèn de quin sentit agafa el pipeline |

## 3. Navegació (5.1)

**A · la del prompt:** Inici · Mapa · Línies · Com hi arribo · Més. Equivalència 1:1 amb les pestanyes de TUS.
Inconvenient: Inici ja és «On vols anar?»; dues portes al mateix planificador, i els títols (el gran bloc de TUS)
queden a dos tocs.

**B · recomanada:** Inici · Mapa · Línies · Títols · Més.
- Inici = «On vols anar?» (és el «Cómo llegar» de TUS, però a la primera pantalla) + Preferides/Recents + Serveis.
- Títols = «Viaja con el móvil» + «Consulta o recarga la tarjeta» (pestanyes Títols / Targetes), etiquetat Demostració.
- Més = Compte, punts de venda, oficina, avisos, info títols, idioma, accessibilitat, TUS i xarxes, legal, versió.
- Capçalera comuna: lupa, QR, avisos amb comptador; avatar.
- A la reunió: «el vostre Cómo llegar és la nostra pantalla d'inici».

**C · mínima:** Inici · Mapa · Línies · Més (Compte dins de Més), i Serveis només a Inici. Menys canvis, però els
títols no tenen pestanya.

Equivalències amb B: Portada → Inici + Serveis · Mapa → Mapa · Líneas → Línies · Favoritos → Inici (Preferides) i
Més › Preferides · Cómo llegar → Inici · Más → Més · Área personal → avatar / Més › Compte · Viaja con el móvil →
Títols · Tarjeta → Títols › Targetes · Información T-Sabadell → Més › Informació dels títols · lupa / QR / triangle →
capçalera.
