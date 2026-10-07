# NextMobility Sabadell — auditoria final de producte (V2)

Data: 2026-10-07. Detall de la landing a `LANDING_AUDIT.md`; estratègia a `NEXTMOBILITY_V2_STRATEGY.md`.

## UX
- Landing → **Prova-ho ara** → app, sense formulari. Qualsevol enllaç directe a l'app (p. ex. `/parada/176`) també
  entra amb la demostració en lloc de portar a `/entra`.
- El compte es justifica per utilitat: a «Els meus», «Estàs provant NextMobility… si en crees un, les parades que
  hagis desat passen al teu compte»; també al menú del compte. Les parades desades a la demo passen al compte nou (e2e).
- Inici: «El teu proper bus» és la peça dominant (línia, destinació, «Arriba en N min», parades que falten,
  puntualitat, «Vaig a agafar aquest bus», «Seguir bus»), després les meves parades, a prop meu i el mapa.

## UI
- Landing clara, sistema de tipus 32/24/18/16/14/12 + `--fs-xl` (48) per a xifres de minuts; el titular és l'única
  mida fluida. Sense degradats, sense glassmorphism, sense `backdrop-filter`.
- App fosca (per al mapa), igual que abans.

## Dades
- `pnpm data:audit`: **105 variants · 0 errors · 9 avisos** (igual que abans). No s'ha tocat cap dada de línia.
- Exemples de la landing amb dades reals: parada Rambla (L1, L2, L3, L11, L80), seqüència real de la L2 cap a Creu de
  Barberà, geometria de `network.json` (`scripts/landing-map.mjs`). Minuts il·lustratius i etiquetats «Demostració».
- Arreglat: `pnpm data:audit` executava `pnpm audit` (dependències) en lloc de l'auditoria de línies.

## Simulació
- Sense canvis al motor. Inici: ara es mostra **Programat hh:mm · Previst hh:mm** quan el retard (simulat) arrodonit
  no és zero, i «Previst hh:mm» quan va a l'hora; desapareix el comptador mm:ss que confonia.

## Mapa
- Marcadors de bus vectorials (silueta, color i codi de línia, rumb), línia destacada, seguiment: es mantenen.
- Mòbil: l'atribució del mapa quedava tapada pel panell d'inici/línies/els meus; ara va a dalt i sempre és visible.

## Mobile
- 390×844, 393×852, 768×1024, 1440×900: sense desbordament horitzontal a la landing; app verificada per e2e en
  iPhone 13 i Pixel (Android) i escriptori.

## Rendiment (local, build de producció, perf-probe 20 s, Chromium sense GPU)
| Vista | fps | tasques llargues | heap |
|---|---|---|---|
| Landing (escriptori / mòbil, amb la demo animada) | 60 / 60 | 0 ms | 4 MB |
| Inici (escriptori / mòbil) | 60 / 60 | 0 ms | 56 / 34 MB |
| Parada oberta | 59 | 146 ms | 40 MB |
| Xarxa | 59 | 187 ms | 60 MB |
Igual que la iteració 2 (59–60 fps). Lighthouse de l'app: el TBT el posa MapLibre amb WebGL per programari (conegut).

## SEO
- `<title>` «NextMobility Sabadell · Quan arriba el teu bus»; description de benefici; `lang="ca"`; canonical;
  OG + Twitter (`twitter:title/description/image`); `og.png` nou (hero amb l'etiqueta «Demostració»);
  manifest amb descripció honesta.

## Institucional
- Secció «El projecte»: prototip independent, informació pública + vehicles simulats, flux
  Informació pública → Prototip (avui) → Dades operatives → Temps real, i «no substitueix cap sistema del servei».
- «Projecte independent · no és una aplicació oficial de TUS ni de l'Ajuntament de Sabadell.»
- Presentació: escena 1 «Quan arriba el meu bus?» (abans «Tota la xarxa TUS, en directe»), escena 9 «Tota la xarxa
  … Avui, calculades sobre la simulació», escena 10 «Amb dades operatives» (abans «Amb el SAE de TUS») en condicional.
- Contacte: *Veure la presentació* sempre; *Parlem* (`mailto:`) quan es defineixi `VITE_CONTACT_EMAIL`.

## Test d'honestedat (`temps real`, `en directe`, `tiempo real`, `en directo`)
Queden només: l'etiqueta d'origen `REALTIME` (només per a un proveïdor real), «Simulació en directe» (diu que és
simulació), i el futur/condicional («Del prototip al temps real», «Si el servei facilités dades operatives…»).

## Test de marca
Cap logo ni marca de TUS. «TUS» només com a font de dades i en el text de no-oficialitat.

## Proves
`pnpm typecheck` ✔ · `pnpm lint` ✔ · `pnpm test` 78/78 ✔ · `pnpm data:audit` 0 errors ✔ · build ✔ ·
e2e local **54/54** ✔ (18 proves × escriptori, iPhone 13, Android). A prod (després del darrer desplegament): 18/18 a escriptori; abans, 53/54 a les tres plataformes (la que va fallar va rebre el «punt de control» de Vercel, no un error de l’app).
Lighthouse landing a prod: rendiment 90–92 (abans 79), LCP 3,3–3,5 s (abans 5,4 s), accessibilitat 100, bones pràctiques 100.

## Pendent / decisions de l'usuari
- Adreça de contacte institucional (`VITE_CONTACT_EMAIL`): no s'ha publicat cap correu sense permís.
- Domini propi i repositori públic o privat.
- Comptes reals (Supabase o similar) quan calgui: `AuthProvider` ja ho permet.

> **Actualització 2026-10-07:** a petició de l'usuari s'han tret de la landing el flux «Del prototip al temps real», la caixa «Prototip en desenvolupament», la crida final «Prova-ho amb la teva parada» i el bloc «Parlem del projecte» (i, per tant, `VITE_CONTACT_EMAIL`). La transparència queda al hero, a «El projecte» i al peu.
