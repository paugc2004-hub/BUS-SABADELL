# Licitació 2024 (OTU/2024/113) — matriu de traçabilitat

Contrast entre la documentació municipal de 2024 (*Disseny, implantació i manteniment de la nova web del servei de
transport urbà de Sabadell*) i NextMobility Sabadell. Actualitzat: 2026-10-11.

**Important.** El plec licita la **web corporativa de TUS amb gestor de continguts**, no una app. NextMobility cobreix
el bloc d'informació al viatger i proposa com cobrir la resta (`LICITACIO_2024_PROPOSTA_CMS.md`). No és un producte
oficial ni adjudicat.

Etiquetes: **DOC‑2024** requisit literal · **HIST‑2019** manual de marca de maig 2019 · **PUBLIC** dada pública vigent
(tus.es, OSM) · **SIMULAT** · **NO‑CONFIRMAT** · **INTERPRETACIÓ**.
Estat: ✅ fet i provat · 🟡 parcial · 📄 només proposta · ⛔ no aplica a una demo / fora d'abast.

## Requisits tècnics (PPT §2.1)

| ID | Requisit (cita) | Font | Abans | Ara | Implementació | Prova |
|---|---|---|---|---|---|---|
| T1 | «tecnologies i formats interoperables… Chrome, Firefox, Edge, Safari i Opera» | PPT §2.1.1 | 🟡 només Chromium provat | 🟡 | Web estàndard, sense connectors | e2e Chromium (escriptori, iPhone, Android). Firefox/WebKit: pendent en local/CI |
| T2 | «visualitzar en català i castellà» | PPT §2.1.1 | ✅ | ✅ | `i18n/ca.ts`, `i18n/es.ts` (tots els textos nous en tots dos) | e2e canvi d'idioma |
| T3 | «indexabilitat… SEO per a cada idioma» | PPT §2.1.1 | 🟡 | 🟡 | Títol per pàgina a les pàgines públiques | Pendent: meta per ruta, `hreflang`, sitemap, prerenderitzat |
| T4 | «WCAG 2.1, en el seu nivell AA» | PPT §2.1.1 | 🟡 Lighthouse 100, 2 errors reals no detectats | ✅ pantalles clau | axe-core a `e2e/quality.spec.ts` i `e2e/licitacio.spec.ts`; contrast de xips | axe sense violacions a 10 pantalles |
| T5 | «disseny… responsive» | PPT §2.1.2 | ✅ | ✅ | | e2e 320 px sense desbordament |
| T6 | «header… logo, menú de navegació, barra de cerques» i «footer… privacitat, galetes, avís legal» | PPT §2.1.2 | 🟡 sense pàgines legals | ✅ | `views/Public.tsx` (capçalera i peu comuns), `ui/LegalLinks.tsx` a la landing i a Compte | e2e pàgines legals |
| T7 | «es respectarà el manual de marca… (Annex PPT‑1)» | PPT §2.1.2 + HIST‑2019 | ⛔ | ⛔ (decisió) | `CLAUDE.md` prohibeix el logo i la marca de TUS. Colors de línia: es mantenen els de tus.es (PUBLIC), que coincideixen a grans trets amb el plànol 2019 | — |
| T8 | 60 % grafismes / 40 % text | PPT §2.1.2 | INTERPRETACIÓ | — | Mapa, xips de línia i diagrames | No mesurable automàticament |
| T9 | Programari de servidor i CMS de codi obert | PPT §2.1.3 | ✅ codi obert (Vite, React, Fastify, MapLibre) / 📄 sense CMS | 📄 | `LICITACIO_2024_PROPOSTA_CMS.md` | — |
| T10 | Domini `www.tus.es` | PPT §2.1.3 | ⛔ | ⛔ | Demo a `bus-sabadell.vercel.app`; el QR es configura amb `VITE_PUBLIC_ORIGIN` | test unitari d'origen |
| T11 | SSL, consentiment previ, drets RGPD, galetes | PPT §2.1.4 | 🟡 sense pàgines | ✅ | HTTPS (Vercel); `/privacitat`, `/avis-legal`, `/galetes` descriuen el que fa l'app (sense galetes; ubicació només al dispositiu) | e2e pàgines legals + `location.test.ts` (la posició no es desa) |
| T12 | **QR per parada** → fitxa amb «codi i nom… línies… horaris de pas… en temps real» | PPT §2.1.5 | ❌ | ✅ (hores **simulades**, etiquetades) | `/p/<codi>` sense sessió; `/qr` i `/qr/<codi>` generen el QR al dispositiu (SVG/PNG, impressió) | `data/qr.test.ts` (descodificador independent), e2e fitxa i generador, axe |

## Requisits funcionals — front office (PPT §2.2.1)

| ID | Requisit | Abans | Ara | Implementació | Prova |
|---|---|---|---|---|---|
| F1 | Llista de línies: «número, nom i un indicador de si hi ha algun avís actiu» | 🟡 sense indicador | ✅ | `Lines.tsx` (avís directe o en alguna parada de la línia) | e2e avisos |
| F2 | Detall de línia: itineraris i parades «de manera senzilla i gràfica», traçat sobre mapa | ✅ | ✅ | Panell de línia + mapa | e2e existents |
| F3 | «consultar – i imprimir – … freqüències segons el tipus de dia… horaris de pas teòrics per les diferents parades» | ❌ | ✅ | `/horari/<línia>`; `core/timetable.ts` | `timetable.test.ts` (= hora d'horari del motor), e2e impressió |
| F4 | Parada: temps de pas de **totes** les línies; usar-la com a origen/destí | ✅ | ✅ | Panell de parada, `/ruta/p<id>` | e2e existents |
| F5 | Cerca de parades per número o text; **clúster** al mapa | 🟡 sense clúster | ✅ | Cerca per codi exacte (ja hi era); clúster MapLibre | Revisió visual (números del clúster: verificar amb mapa base real) |
| F6 | Planificador: origen, destí, «hora i data de sortida o arribada», derivat a Google Maps | 🟡 només «ara» | ✅ (data: avui) | Ara / Sortir a les / Arribar a les (`planArriveBy`); botó opcional a Google Maps | Propietats a `plan-network.test.ts`, e2e |
| F7 | Avisos: descripció, motiu, línies i parades, període, publicació i expiració, adjunts | 🟡 sense dates de publicació (es mostraven sempre) | ✅ | `core/alerts.ts`, esquema `avisos.yaml` | `alerts.test.ts`, e2e (caducat no surt) |
| F8 | Tarifes i títols (propis i ATM); xarxa de punts de venda | ❌ | ❌ | Pendent: cal font pública fiable i datada (NO‑CONFIRMAT) | — |
| F9 | Atenció al client, FAQ, normativa, formulari amb captcha | ❌ | 📄 | No es recullen dades en una demo | — |
| F10 | Notícies, campanyes, informació corporativa, perfil del contractant, ofertes de feina, àrea d'empleats, Mou‑te | ❌ | 📄 | `LICITACIO_2024_PROPOSTA_CMS.md` | — |
| F11 | Descàrrega de l'app segons sistema operatiu | 🟡 PWA instal·lable | 🟡 | Sense enllaç a botigues fins que el paquet sigui publicat | — |
| F12 | Mapes «en constant actualització» | ✅ | ✅ | OpenFreeMap/CARTO (OSM) | — |

## Back office i dades (PPT §2.2.2–2.2.3)

| ID | Requisit | Estat | Notes |
|---|---|---|---|
| B1 | CMS amb usuaris i rols, actiu/inactiu per contingut | 📄 | Proposta CMS |
| B2 | Estadístiques (es proposa Google Analytics) | 📄 | Sense analítica avui; si se n'afegeix, consentiment previ |
| D1 | Importació GTFS (línies, itineraris, parades, traçats, calendari, horaris) i informe | 🟡 | El pipeline **genera** GTFS validat (MobilityData). La importació d'un GTFS d'entrada queda pendent: cal un feed oficial de TUS |
| D2 | GTFS‑RT / SAE via API | ⛔ | Sense credencials ni accés autoritzat. `GtfsRtProvider` a `apps/api` preparat; la UI només diria `REALTIME` amb un proveïdor real |
| D3 | CSV de punts de venda i tarifes | ❌ | Pendent (vegeu F8) |
| D4 | Exportacions (reclamacions, contractes, ofertes, reserves) | 📄 | Mòduls corporatius |

## No funcionals (PPT §3–5, PCAP)

Disponibilitat > 95 %/setmana, monitoratge 24/7, còpies setmanals, servidor de suport, allotjament 5 anys, formació
≥ 10 h, garantia 12 mesos, declaració d'ubicació dels servidors (PCAP 17.3), encarregat del tractament (PCAP 20):
**compromisos d'un futur contracte**, no de la demo. Es descriuen a la proposta; no es prometen aquí.

## Dades: origen i vigència

| Dada | Etiqueta | Font i data |
|---|---|---|
| Xarxa, parades, horaris | PUBLIC | tus.es, extret 2026‑10‑06 (`network.json`) |
| Posicions, ETA, retards | SIMULAT | Motor determinista sobre l'horari |
| Horari teòric (fitxa, `/horari`) | PUBLIC | Mateix horari, sense retards |
| Colors de línia | PUBLIC (tus.es); HIST‑2019 com a contrast | Annex PPT‑1, pàg. 8 (aprox.) |
| Tarifes, punts de venda, oficina | NO‑CONFIRMAT | No incorporats |
