# Licitació 2024 — com es cobririen els mòduls corporatius i el back office

Proposta (INTERPRETACIÓ) per a la part del plec que no és informació al viatger. **No implementat**: són continguts i
processos de TUS que no es poden simular amb dades inventades.

## Arquitectura proposada
- **NextMobility** (Vite + React + MapLibre, codi obert) segueix sent la capa de viatger: inici, cerca, ruta, línies,
  parades, fitxa QR, horaris imprimibles i avisos.
- Un **CMS de codi obert** (el plec cita Liferay, Drupal, Joomla o WordPress; recomanació: Drupal o WordPress en mode
  *headless*, amb API JSON) per als continguts editorials. NextMobility els llegeix i els pinta amb el mateix disseny.
- Servidor 100 % codi obert (PPT §2.1.3): Linux, PostgreSQL/MariaDB, PHP. Allotjament a la UE.
- Les dades de xarxa entren per **GTFS** (i GTFS‑RT quan TUS doni accés al SAE), amb informe d'importació.

## Mòduls (PPT §2.2.1–2.2.3) → tipus de contingut al CMS
| Mòdul del plec | Tipus de contingut / funció | Notes |
|---|---|---|
| Campanyes (carrusel per dates) | `campanya`: imatge, enllaç, dates d'inici/fi | Imatges corporatives si no n'hi ha cap d'activa |
| Avisos (incidències) | `avis`: text, motiu, línies, parades, període, publicació, expiració, adjunts | **Ja suportat** a NextMobility (`core/alerts.ts`); el CMS n'és l'origen |
| Notícies + cercador per dates/text | `noticia` | |
| Atenció al client, FAQ, normativa | Pàgines + `faq` | Mapa de l'oficina amb MapLibre |
| Reclamacions (correu + històric + captcha) | Formulari del CMS, captcha respectuós amb la privadesa | Encarregat del tractament: PCAP 20 |
| Informació corporativa (8 apartats) | Pàgines | |
| Perfil del contractant (+ històric, exportació PDF) | `contracte` | |
| Ofertes d'ocupació (+ exportació PDF) | `oferta` | |
| Àrea privada d'empleats (~200) | Rols del CMS / SSO | Fora de l'app ciutadana |
| «Mou‑te en autobús» (reserves) | Formulari de reserves + correus | |
| Tarifes i títols; punts de venda | `tarifa`, `punt_venda` (o CSV, PPT §2.2.3) | Es mostrarien a NextMobility amb mapa |
| Estadístiques | Analítica amb **consentiment previ** o sense galetes | El plec proposa Google Analytics |

## Què caldria de TUS / Ajuntament
1. GTFS oficial (o permís per usar els horaris publicats) i, quan sigui possible, accés autoritzat al SAE (GTFS‑RT).
2. Autorització d'ús de la marca segons el manual (Annex PPT‑1) si el producte ha de dur-la.
3. Continguts editorials (avisos, tarifes, punts de venda, FAQ, normativa) i les persones que els mantindran.
