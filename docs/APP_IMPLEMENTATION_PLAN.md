# App — pla d'implementació (bus-first)

| # | Canvi | Fitxers | Risc |
|---|---|---|---|
| 1 | Entrada: sense sessió → `/entra` (ja no s'entra sol amb la demo); «Entra sense compte» es manté | `App.tsx`, `Auth.tsx`, i18n | Baix (e2e d'enllaç directe) |
| 2 | Pas d'ubicació un cop (Permet / Ara no) després d'entrar | `views/Welcome.tsx` (nou), `App.tsx` | Baix |
| 3 | Inici: «Hola, Nom», on ets, cercador, parades a prop amb el proper bus | `Home.tsx` | Baix |
| 4 | Resultat: **Millor opció** (Puja a / Arriba en / Baixa a / trajecte), fins a 2 alternatives compactes, sense pas a pas a peu; *Agafaré aquest bus*, *On és el bus*, *Recorregut* | `Route.tsx`, i18n, CSS | Mitjà |
| 5 | Puntuació «millor opció» al planificador, màxim 3 opcions variades | `core/plan.ts` + tests | Mitjà |
| 6 | Mapa contextual: amb pla o viatge, només les línies i els busos implicats | `MapView.tsx` | Mitjà |
| 7 | Navegació Inici · Mapa · Línies · Compte; Compte = compte + les meves parades (secundari) | `Chrome.tsx`, `Mine.tsx` | Baix |
| 8 | Fora interurbans (altres operadors) del mapa | `Chrome.tsx` (capes) | Baix |
| 9 | Proves: unitàries del planificador, e2e del flux complet (entrar → ubicació → destí → millor opció → bus → viatge) | `plan.test.ts`, `e2e/app.spec.ts` | — |
