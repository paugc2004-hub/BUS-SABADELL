# Landing — auditoria (abans / després)

## Problemes trobats → decisió
| Problema (V1) | Decisió (V2) |
|---|---|
| Hero venia la xarxa («El teu bus, en directe» + captura d'un mapa ple) | Titular de benefici «No esperis el bus a cegues» + una situació: la targeta de la parada Rambla amb la L2 que s'acosta |
| Crida principal «Crea un compte» / «Comença ara» → registre | **Prova-ho ara** → entra a l'app sense registre (compte de demostració) |
| Xifres (23 · 105 · 408 · 0) protagonistes | Fora. Només «23 línies» dins un text secundari (secció del mapa) |
| «en directe» al titular, `<title>` i OG amb dades simulades | Titular, title, OG i manifest sense «en directe»; avís de prototip sota la crida |
| Seccions «captura + text» genèriques | Fragments d'UI construïts (ETA, posició, properes parades, la meva parada, línia temporal), dades reals de parades i línies |
| Estètica de centre de control fosca amb degradats | Tema clar propi a la landing; color només on informa. L'app segueix fosca |
| LCP 5,4 s (dues JPG grans al hero) | Hero en HTML/SVG (5 KB de geometria real); la captura del mapa, *lazy* i més avall |
| «Per a TUS i l'Ajuntament» a la nav, caixa d'instal·lació PWA | Nav: Com funciona · El projecte. Institucional al final. Instal·lació PWA: segueix funcionant des del navegador |
| Cap via de contacte institucional | «Parlem del projecte»: *Veure la presentació* + *Parlem* (`mailto:` si `VITE_CONTACT_EMAIL`) |
| Amb el navegador en castellà sortia en castellà | Català per defecte; ES a un toc i es recorda |
| La landing descarregava tota l'app | `AppMain` en un tros a part (−72 KB de JS a la landing) |

## Test dels 5 segons (fet sobre les captures 390×844 i 1440×900, sense context)
- Què és? → «Una cosa que em diu quan arriba el bus» (titular + «Arriba en 4 min» a la targeta).
- On? → Sabadell (eyebrow, parada Rambla).
- Què puc fer? → Veure on és i quan arriba (subtítol, targeta).
- Puc provar-ho? → Sí: «Prova-ho ara · Sense registre».
Test «del pare»: «Et diu quan ve l'autobús.» ✔

## Responsive (sense desbordament horitzontal: `scrollWidth − innerWidth = 0`)
| Mida | Resultat |
|---|---|
| 390×844 | Titular, subtítol, crides i el començament de la targeta dins la primera pantalla; demo sencera amb un petit scroll |
| 393×852 | Igual que 390 |
| 768×1024 | Una columna; la demo limitada a 560 px i centrada |
| 1440×900 | Dues columnes: copy a l'esquerra, demo a la dreta, tot dins la primera pantalla |
Eina: `node apps/web/scripts/full-shots.mjs <url> <dir> 390x844 393x852 768x1024 1440x900`.

## Accessibilitat
- Lighthouse accessibilitat **100** (abans 100).
- La demo és `role="img"` amb un `aria-label` que diu «Demostració…»; els fragments d'UI decoratius són `aria-hidden`.
- `prefers-reduced-motion`: la demo queda quieta (2 min, a 2 parades) i les seccions apareixen sense moviment.
- Objectius tàctils ≥ 40–44 px; contrast de tinta sobre `#f6f5f1` > 15:1.

## Rendiment
| Mesura | V1 | V2 |
|---|---|---|
| Lighthouse mòbil landing (prod., gzip, 3 passades) | rendiment **79**, FCP 1,8 s, LCP **5,4 s**, TBT 0, accessibilitat 100, bones pràctiques 100 | rendiment **90–92**, FCP 1,1–1,3 s, LCP **3,3–3,5 s**, TBT 0–10 ms, CLS 0, accessibilitat 100, bones pràctiques 100 |
| Lighthouse mòbil landing (local, `vite preview` sense compressió) | — | rendiment **84**, FCP 3,3 s, LCP **3,5 s**, TBT 0, CLS 0 |
| fps landing amb l'animació (perf-probe 20 s, escriptori i mòbil) | — | **60 fps**, 0 tasques llargues, 4 MB de heap |
| JS que descarrega la landing | 440 KB (tota l'app) | 367 KB (115 KB gzip) |
Notes: l'script en línia de la carcassa (fons clar a `/`) està permès a la CSP pel seu hash (`vercel.json`); sense
això, bones pràctiques baixava a 93. Durant les proves el tallafoc de Vercel va respondre 403 («punt de control») una
estona a les peticions automàtiques seguides des d'aquesta IP. El que queda de pes a la landing és React + luxon
(el rellotge del store); separar-lo demana tocar el store i no s'ha fet.
