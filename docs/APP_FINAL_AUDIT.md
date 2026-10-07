# App — auditoria final (bus-first)

Data: 2026-10-07. Documents d'aquesta fase: `APP_PRODUCT_AUDIT.md`, `APP_UX_REDESIGN.md`,
`APP_INFORMATION_ARCHITECTURE.md`, `APP_TECHNICAL_PLAN.md`, `APP_IMPLEMENTATION_PLAN.md`.

## El flux, com un ciutadà
1. **Obre l'app** → *Entra a NextMobility* (correu i contrasenya, o **Entra sense compte**). L'app instal·lada mai passa per la landing.
2. **On ets?** (una sola vegada) → *Permet la ubicació* / *Ara no*. La ubicació no surt del mòbil.
3. **Inici**: «Hola, Pau» · «Ets a prop de la parada …» · **On vols anar?** [cercador] · *Parades a prop teu* (2, amb el proper bus).
4. Escriu «hospital parc tauli» (o un carrer, o una parada) → **Resultat**:
   - **MILLOR OPCIÓ** · `L80` Direcció **La Plana del Pintor**
   - **PUJA A** República · *a 760 m de tu* — **ARRIBA EN 23 min** · estat del bus · puntualitat
   - **BAIXA A** Parc Taulí · *6 parades* · 08:45
   - *8 min de trajecte · arribes a les 08:47*
   - *Agafaré aquest bus* · *On és el bus* · *Recorregut* (parades de la pujada a la baixada)
   - **Altres opcions** (màxim 2, compactes): línia, direcció, on puges, quan passa.
5. *On és el bus* → la fitxa del bus i el mapa hi va (només aquest bus i la seva línia).
6. *Agafaré aquest bus* → **El teu viatge**: la teva parada, arriba en N min, a N parades, pista fins a la parada; avisos
   «a 2 parades», «la propera és la teva», «baixa a la següent». *Deixa de seguir*.

Test dels 30 segons (e2e `el flux de l'app`): entrar → ubicació → destí → millor opció → recorregut → on és el bus. ✔
Test dels 5 segons: la pantalla d'inici només pregunta **On vols anar?** ✔
Test d'una pregunta: «Per saber quin bus he d'agafar i quan passa.» ✔

## Què ha canviat
| Abans | Ara |
|---|---|
| S'entrava sol amb la demo | Entrar / crear compte / «Entra sense compte»; després, ubicació (un cop) |
| Resultat = pas a pas a peu («Camina 712 m fins a…») i «A peu · 23 min» | **Puja a / Arriba en / Baixa a**; només «a 760 m de tu»; a peu només si és curt (≤ ~15 min), en una línia discreta |
| Fins a 4 opcions per hora d'arribada | **Millor opció** (puntuació: arribada + transbords + caminar + bus encara a capçalera) i fins a 2 alternatives variades |
| Mapa de la ruta/viatge amb tota la xarxa | **Mapa contextual**: només les línies i els busos de l'opció o del viatge |
| «On és el bus» obria el bus encara que fes el trajecte anterior (sentit contrari) | Només es mostra si el bus ja fa el trajecte que agafaràs |
| Interurbans (altres operadors) al mapa; control d'hora al mapa | Fora: només TUS. L'hora de demo, per URL (`?hora=08:15&dia=dimarts`) |
| Navegació Inici · Mapa · Línies | **Inici · Mapa · Línies · Compte** (Compte: compte i, si n'hi ha, parades desades) |
| Tancar sessió → landing | → Entrar |

## Dades
- 23 línies · 105 variants · 408 parades · `data:audit` 0 errors. La direcció del resultat surt de la variant concreta
  (`pattern.headsign`): les variants parcials (p. ex. L14 Estació Centre → Parc Taulí) es diuen pel seu destí real.
- Incoherències de nom de la font documentades a `APP_PRODUCT_AUDIT.md` (no corregides a les dades).

## Proves
typecheck ✔ · lint ✔ · unitàries 88/88 ✔ (planificador: millor opció per puntuació, màxim 3) · build ✔ ·
e2e **66/66** (escriptori, iPhone 13, Android), inclòs el flux sencer · mòbil revisat a 375×812, 390×844, 430×932 ·
rendiment (perf-probe, mòbil): inici, resultat i mapa a 60 fps, 0 tasques llargues.

## Pendents i riscos
- **Notificacions del sistema**: els esdeveniments ja es detecten (`TripMonitor`); falta l'emissor (Notification API o push natiu del contenidor d'app).
- **Dades reals**: `planFor` és el punt únic on caldrà fer servir ETA reals per a les expedicions amb vehicle real.
- Una «millor opció» pot ser un bus que passa d'aquí a 20+ min si no n'hi ha cap altre; es diu clarament («Arriba en 23 min»).
- Comptes ficticis (al navegador): per sincronitzar entre dispositius cal un servei real (`AuthProvider`).
- Lovable: l'app és a `apps/web` dins un monorepo pnpm (vegeu README «Estructura»).
