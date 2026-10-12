# Paritat amb l'app oficial de TUS (TUS Sabadell 3.2.4, GeoActio)

Estat del 2026-10-12. Cada element de l'app oficial (captures del responsable del projecte del 12/10/2026, 11:52–11:55),
el seu equivalent a NextMobility i on guanyem. Especificació: «MASTER PROMPT v2 — Paritat funcional amb l’app oficial
de TUS» (no versionat). Rutes relatives a `apps/web/src/`. Guió de la reunió: `docs/REUNIO_TUS_GUIA.md`.

Estats: `✅ fet` · `🟡 parcial` · `🔒 requereix integració amb TUS` (i què caldria).

No es copia la marca: cap logo de TUS ni de l'Ajuntament, ni el segell de la UE, ni el lettering «T-Sabadell», ni
l'art de les seves targetes, ni el logo de Bizum (test `data/brand.test.ts`). Es copien el contingut funcional i
l'arquitectura d'informació.

## Navegació (decisió presa: com l'app oficial, més Inici)

| App TUS | NextMobility | On |
|---|---|---|
| Portada de 5 targetes | **Inici**: «On vols anar?» + les 5 targetes (Serveis) + avisos | `views/Home.tsx` `ServicesHub` |
| Consulta o recarga la tarjeta | Inici › Consulta o recarrega la targeta → `/targetes` (demo) | `views/Tickets.tsx` `CardsPage` |
| Viaja con el móvil | Inici › Viatja amb el mòbil → `/titols` (demo) | `views/Tickets.tsx` `TicketsPage` |
| Información del servicio, líneas y horarios | Inici › Informació del servei → Mapa | `map/MapView.tsx` |
| Área personal | Inici › Àrea personal → `/meus`; també Més › Compte | `views/Mine.tsx` |
| Información T-Sabadell | Inici › Informació dels títols → `/tarifes` | `views/Fares.tsx` |
| Barra: Mapa · Líneas · Favoritos · Cómo llegar · Más | Barra: **Inici · Mapa · Línies · Com hi arribo · Més** | `views/Chrome.tsx` |
| Favoritos | Inici (preferides) i Més › Preferides `/preferides` | `views/Pages.tsx` `FavsPage` |
| Capçalera: QR · lupa · triangle d'avisos amb punt | Capçalera: QR · lupa · avisos **amb el número** dels que estan en vigor | `views/Chrome.tsx` `TopBar` |

Com a l'app de TUS, cerca, QR i avisos pertanyen a la pestanya Mapa; títols i targetes, a Inici; compte i oficina, a Més.

## Matriu

| # | Pantalla TUS | Element | Què fa a TUS | NextMobility | Millora nostra | Estat |
|---|---|---|---|---|---|---|
| 1 | Portada | 5 targetes | Menú; cal un toc més per veure res | `Home.tsx` `ServicesHub`: les 5, amb disseny propi | A sobre, «On vols anar?» i les parades a prop amb llegades | ✅ |
| 2 | Portada | Peu UE | Segell NextGenerationEU | No es reprodueix (marca aliena) | — | ✅ (decisió) |
| 3 | Mapa | QR (capçalera) | Lector de QR de parada | `/qr-lector` `FindStop.tsx` `ScanPage`: BarcodeDetector o jsQR (tros a part), alternativa de teclat | Imatge al dispositiu; la càmera es para en sortir; cap URL externa | ✅ |
| 4 | Mapa | Lupa | Buscar parada | `/cerca` `FindStopPage` | Codi exacte primer; a prop, preferides, recents | ✅ |
| 5 | Mapa | Triangle amb punt | Incidencias | `/avisos` `AlertsPage`; número = avisos en vigor | Número (no un punt); «Actius ara» / «Propers» | ✅ |
| 6 | Mapa | Carrusel (6) | Novetats | `Pages.tsx` `NewsCarousel`: 1 novetat (l'única coneguda: trasllat de l'Oficina, 8/9/2026) | Plegable, «No ho tornis a mostrar», no tapa els botons | 🟡 (les altres 5 diapositives no es van veure) |
| 7 | Mapa | Parades | Centenars d'icones sense agrupar | Agrupades (`stops-cluster`) | **Llegible** | ✅ |
| 8 | Mapa | Punts de venda «PV» | Gotes al mapa | `/punts-de-venda` (llista, filtres, obert ara) i Oficina amb «Com hi arribo» | Obert/tancat/a confirmar | 🟡 (capa al mapa: cal geocodificar els 33 punts) |
| 9 | Mapa | Busos | No n'hi ha | Busos simulats etiquetats | **Busos al mapa** (reals amb el SAE) | ✅ · 🔒 posicions reals: SAE/AVL de TUS |
| 10 | Mapa | Ubica'm · capes | Botons | Ubica'm; filtre de línies | — | 🟡 (selector de capes: no se'n va veure el contingut) |
| 11 | Líneas | Fecha: Hoy | Tria data, filtra pel servei | `Lines.tsx`: Avui · Demà · Tria un dia; tipus de dia («Festiu comercial») | «Mostra totes» amb «No circula aquest dia» | ✅ |
| 12 | Líneas | Buscar línea | Cerca | Camp propi, sense accents | — | ✅ |
| 13 | Líneas | Fila de línia | Cercle + Origen - Destí + › | Xip + nom + busos ara · «cada N min» + avís + › | Freqüència i avisos | ✅ |
| 14 | Líneas | Noms F4 i F6 | «La Roureda - El Poblenou», «… (Festius Comercials)» | `data/config/overrides.yaml` › `noms` | — | ✅ |
| 15 | Líneas | F6 només festius comercials | El 12/10 surt | `festius.yaml` › `comercials` + `Route.onlyDates`; el motor la treu els altres dies | — | ✅ (dates de 2026 a confirmar; 2027 pendent) |
| 16 | Línea | Elegir sentido | 2 files | Pestanyes de sentit (`LinePanel`) | — | ✅ |
| 17 | Recorrido | Mapa | Cadena de cercles | Línia dibuixada amb el color | **Recorregut dibuixat** | ✅ |
| 18 | Recorrido | Llista «N - Nom» | Sense hores | Parades amb **hora de pas** (propera, o primera d'un altre dia), transbords i busos entre parades | **Hores i transbords** | ✅ |
| 19 | Parada | «43 - Casal Pere Quart» | Codi - nom | `StopPanel.tsx`: «43 - Casal Pere Quart» | — | ✅ |
| 20 | Parada | Estrella · refrescar | Preferida; refrescar | Estrella; s'actualitza sola cada 5 s | Sense tocar res | ✅ |
| 21 | Parada | Compartir | — | Comparteix `/p/<codi>` (fitxa pública) | S'obre sense app | ✅ |
| 22 | Parada | Llegada · Sentido | Taula | Línia → destí · parades que falten · puntualitat amb origen · min · «després HH:MM» | Origen de la dada a cada fila | ✅ |
| 23 | Cómo llegar | Origen + diana | Camp | `/com-hi-arribo` `PlanForm.tsx` | — | ✅ |
| 24 | Cómo llegar | Destino | Autocompletat | Cercador universal (carrers, llocs, parades) | — | ✅ |
| 25 | Cómo llegar | Intercanviar · hora | No n'hi ha | ⇅ i Surt ara / Surt a les / Arriba abans de | **Millora** | ✅ |
| 26 | Cómo llegar | Planificar viaje | **Obre Google Maps** | Ruta dins l'app (`planTrip`) amb Puja a / Baixa a i seguiment; Google Maps com a enllaç | **Ruta dins l'app** | ✅ |
| 27 | Cómo llegar | Cas de prova | F4 des de Mercat Central 12:00 | Mateix resultat (test `core/test/parity.test.ts`) | — | ✅ |
| 28 | Buscar parada | Buit | Res | A prop, preferides, recents (esborrables) | **Millora** | ✅ |
| 29 | Incidencias | 4 avisos | Majúscules, sense línies | `data/config/avisos.yaml`: títol en frase, text corregit, xips de línies, període, «Més informació» | Avisos a la línia i a la parada | ✅ (URL exacta de cada avís pendent: `TODO(DECISION: URL-AVISOS)`) |
| 30 | Más | Puntos de venta · Web · Idiomas · Accesibilidad | Files | `/mes` `MorePage` | — | ✅ |
| 31 | Más | Xarxes | X, Facebook, Instagram, YouTube | Enllaços externs (X, Facebook, Instagram `tussccl`; YouTube = cerca) | — | 🟡 (adreces del prompt, no verificades des d'aquí) |
| 32 | Más | Versió | «3.2.4 Build 1» | «Versió de l'app 0.1.0 · Dades de la xarxa del …» | Data de les dades | ✅ |
| 33 | Mis títulos | Buit, agotados, comprar, compras, viajes | — | `/titols` (demo) | — | ✅ demo · 🔒 venda real |
| 34 | Comprar título | Perfil + 3 productes | General: 1,80 / 10,10 / 20,60 € | Mateixos productes i preus (`data/fares.ts`), perfil General / Jove | Condicions de cada títol | ✅ demo |
| 35 | Detalle y pago | Bizum · Pagar · Cancelar | Pagament real | «Simular pagament (demo · no es cobra res)», Bizum desactivat sense logo, quantitat | Quantitat i total | ✅ demo · 🔒 passarel·la de pagament |
| 36 | (no vist) | Usar un título | — | Validació a pantalla sencera, QR `NM-DEMO:…`, persones (multipersonal), historial | — | ✅ demo · 🔒 format de QR de les validadores |
| 37 | Tarjetas | Consultar (NFC) | Llegeix la targeta | Pantalla explicativa; detecta si hi ha Web NFC, no llegeix res | — | 🔒 especificació de la targeta i API de saldo (enginyeria inversa prohibida) |
| 38 | Tarjetas | Vincular · Recargar | — | Targeta de prova `DEMO-XXXX-XXXX` (cartró/PVC), recàrrega demo (cartró: només T-10) | — | ✅ demo · 🔒 API de recàrrega |
| 39 | Mi cuenta | Email · Información personal · Perfil · FAQ · Contraseña · Configuración · Eliminar · Cerrar sesión | — | `/meus` i `/compte/*` | Esborrat complet del dispositiu | ✅ |
| 40 | Accesibilidad | (no vist) | — | Mida del text (3), alt contrast, reduir moviment (`ui/a11y.ts`) | AA verificat amb axe | ✅ |

## Què caldria de TUS per passar de demo a real (🔒)

- **Posicions reals**: accés al SAE/AVL (GTFS-Realtime o similar). La UI ja té `REALTIME` i `GtfsRtProvider` (`apps/api`).
- **Venda de títols**: API de catàleg, compra i emissió de títols al mòbil, amb la passarel·la de pagament de TUS
  (targeta i Bizum). Substituiria `DemoWallet` per un `TicketingProvider` real (`wallet/wallet.ts`).
- **Validació amb el mòbil**: el format del QR que accepten les validadores (signat), i la confirmació de validació.
- **Targetes**: API de consulta de saldo i recàrrega per número de targeta; la lectura NFC només amb l'especificació
  oficial de la targeta.
- **Avisos i novetats**: un feed (RSS, JSON o GTFS-RT Alerts) amb la URL de cada avís.

## Fonts i dates

- App oficial TUS Sabadell 3.2.4: captures del 2026-10-12 (pantalles, noms de línia, avisos, productes i preus).
- Festius comercials 2026: Ajuntament de Sabadell, segons el resum del cercador (no s'ha pogut obrir la pàgina; a confirmar).
- Preus i punts de venda: `docs/TARIFES_PUNTS_DE_VENDA.md` (`verified: false`).
- Estació d'Autobusos (destí de «Com hi arribo» de l'Oficina): OpenStreetMap, lloc 502 de `public/data/streets.json`.
- Des de l'entorn de desenvolupament no s'ha pogut obrir tus.es (bloquejat): cap dada s'ha llegit directament d'allà.
