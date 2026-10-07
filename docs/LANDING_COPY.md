# Landing — copy final (català; el castellà és a `apps/web/src/i18n/es.ts`)

Font de veritat: `apps/web/src/i18n/ca.ts` → `landing`. Aquest document en recull la versió final i el perquè.

## Com s'ha triat
S'han generat internament ~20 titulars, 20 subtítols, 20 crides, 10 microcopies, 5 avisos i 5 textos institucionals,
i s'han puntuat (1–5) per claredat, benefici, naturalitat en català, memorabilitat, credibilitat, utilitat i
diferenciació. Finalistes del titular:

| Titular | Clar | Benefici | Natural | Memorable | Creïble | Total /35 |
|---|---|---|---|---|---|---|
| **No esperis el bus a cegues.** | 5 | 5 | 5 | 5 | 5 | **34** |
| Saps quan arriba el teu bus. | 5 | 5 | 5 | 3 | 5 | 31 |
| No esperis a cegues. | 3 | 4 | 5 | 5 | 5 | 30 |
| Mira on és. Mira quan arriba. | 4 | 4 | 4 | 4 | 5 | 29 |
| El teu bus, en directe. (actual) | 4 | 3 | 5 | 4 | 2 | 26 — «en directe» amb dades simulades |

«No esperis a cegues» sol no diu *què* espero; afegir «el bus» ho resol sense perdre força.
Crida: «Prova-ho ara» guanya a «Prova l'experiència» (més curta i natural, menys de màrqueting) i a «Comença ara»
(que suggeria registre).

## Text final

**Nav:** Com funciona · El projecte · **Prova-ho ara**

**Hero**
- Eyebrow: AUTOBUSOS URBANS DE SABADELL
- H1: **No esperis el bus a cegues.**
- Subtítol: Mira on és el teu autobús i quant li falta per arribar a la teva parada. I, si vols, segueix-lo fins que hi pugis.
- Crides: **Prova-ho ara →** · Com funciona
- Microcopy: Sense registre · al mòbil o a l'ordinador
- Avís: Prototip independent · les posicions dels autobusos són simulades a partir dels horaris publicats.
- Targeta: LA MEVA PARADA · *Demostració* · **Rambla** · L2 → Creu de Barberà · Arriba en **3** min · A 3 parades · ● A l'hora · [Veure el bus]

**Quan saps on és, esperar canvia.**
- 01 **Saps quan arriba** — Els minuts que falten perquè el proper bus passi per la teva parada.
- 02 **Saps on és** — On és ara, cap on va i quantes parades li queden fins a tu.
- 03 **Saps què passarà** — Les properes parades i a quina hora hi serà, una per una.

**Tres passos i ja ho saps.**
1. **Tria la teva parada** — Busca-la pel nom o deixa que el mòbil trobi les que tens a prop.
2. **Mira quan arriba el proper bus** — Minuts, parades que li falten i si va a l'hora.
3. **Segueix-lo pel mapa** — Toca'l i el mapa el segueix fins a la teva parada.

**LA MEVA PARADA — La teva parada, sempre a mà.**
Desa la parada de cada dia i, quan obris l'app, ja veuràs quins busos hi arriben i en quants minuts.
Targeta: ★ Rambla · L2 → Creu de Barberà 3 min · L1 → Estació Sud 7 min · L80 → Plaça de Picasso 12 min · [Veure arribades]

**VAIG A AGAFAR AQUEST BUS — Segueix el bus que vols agafar.**
Tria el bus i la parada on puges. T'avisem quan és a dues parades, quan és el següent i quan has de baixar.
Avís: «El teu bus és a 2 parades.» · Línia temporal: ✓ Massagué · ✓ Manresa · 🚌 Dr. Robert · Casal Pere Quart +1 min · **Rambla** (la teva) +3 min · Eixample +5 min

**TOTA LA XARXA — De la teva parada a tota la ciutat.**
Explora les 23 línies de Sabadell, segueix els autobusos i mira com es mou la xarxa. [Explora el mapa →]

**EL PROJECTE — Un projecte pensat per evolucionar.**
NextMobility Sabadell és un prototip independent que explora una nova experiència digital per al bus urbà de la ciutat.
La xarxa, les parades i els horaris surten d'informació pública; els vehicles, de moment, són simulats.

**Del prototip al temps real.** Informació pública (Línies, parades i horaris publicats) → **Prototip** *Avui*
(Vehicles simulats sobre els horaris) → Dades operatives (La posició dels autobusos (SAE/AVL), si el servei les facilita)
→ Experiència en temps real (La mateixa app, amb dades reals).
Nota: No substitueix cap sistema del servei: és una capa de visualització que podria consumir-ne les dades oficials.

**Prototip en desenvolupament** — Les posicions dels autobusos que veus són simulades a partir dels horaris i
recorreguts públics. La xarxa i les parades parteixen d'informació publicada per TUS.
**Projecte independent · no és una aplicació oficial de TUS ni de l'Ajuntament de Sabadell.**

**Prova-ho amb la teva parada.** [Prova-ho ara →] Sense registre · al mòbil o a l'ordinador

**Parlem del projecte** — Treballes a l'Ajuntament o al servei de transport i t'interessa veure com podria
evolucionar amb dades operatives reals? [Veure la presentació] [Parlem]*

\* «Parlem» només apareix si `VITE_CONTACT_EMAIL` està definit al desplegament.

**Peu:** NextMobility Sabadell és un projecte independent. No és una app oficial de TUS ni de l'Ajuntament de Sabadell.
Dades de la xarxa: tus.es · Mapa: © OpenStreetMap contributors · Ja tens compte? Entra

## SEO
- `<title>`: NextMobility Sabadell · Quan arriba el teu bus
- description: Mira on és el teu autobús a Sabadell i quant li falta per arribar a la teva parada. Prototip independent: vehicles simulats a partir dels horaris publicats.
- OG/Twitter: «NextMobility Sabadell · No esperis el bus a cegues» + `og.png` (captura del hero nou, amb l'etiqueta Demostració).

## Exemples: per què són creïbles
Rambla és una parada real per on passen L1, L2, L3, L11 i L80; Massagué → Manresa → Dr. Robert → Casal Pere Quart →
Rambla és l'ordre real de la L2 cap a Creu de Barberà; el fragment de mapa es genera de `network.json`
(`scripts/landing-map.mjs`). Els minuts són il·lustratius i la targeta ho diu («Demostració»).
