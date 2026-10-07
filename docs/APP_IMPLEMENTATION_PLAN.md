# /app — pla d'implementació

| Prioritat | Canvi | Fitxer / component | Motiu | Impacte | Risc |
|---|---|---|---|---|---|
| P0 | Tema clar ciutadà (tokens a `.app:not(.control)`), panells opacs | `styles.css` | F1, F7 | Alt | Mitjà: colors fixos repartits pel CSS |
| P0 | Mapa base clar i apagat + vora fosca a les línies + parades/etiquetes per a fons clar | `map/style.ts`, `MapView.tsx` | F1 | Alt | Mitjà: contrast de línies clares |
| P0 | Barra superior ciutadana: logo, «Dades de demostració ⓘ», idioma, menú Informació (Control, presentació, què és real, compte); fora rellotge (només en hora de demo), xip d'incidències i franja | `Chrome.tsx` | F1, F8 | Alt | Baix |
| P0 | Inici com a pàgina al mòbil (sense mapa), cerca, proper bus amb una sola acció, les meves parades amb llegades, «Veure el mapa» | `Home.tsx`, `AppMain.tsx`, CSS | F2, F3 | Alt | Mitjà: e2e |
| P0 | Llegades: un sol temps («Ara» / «4 min» / hh:mm) + el següent; sense mm:ss | `StopPanel.tsx` (`ArrivalRow`) | F4 | Alt | Baix |
| P0 | Fitxa del bus neta (sense LED, %, km, km/h; estat humà) i **mode viatge** dins la fitxa | `BusCard.tsx`, `StopTimeline.tsx`, `Trip.tsx` | F5, F6 | Alt | Mitjà |
| P1 | Navegació Inici · Mapa · Línies · Parades; Xarxa fora de la navegació ciutadana | `Chrome.tsx`, `Mine.tsx` | F8, F11 | Mitjà | Baix |
| P1 | NextMobility Control: `/xarxa` i presentació en fosc, amb capçalera pròpia | `Network.tsx`, `AppMain.tsx`, CSS | F8 | Mitjà | Baix |
| P1 | Parada: línies d'avui, codis al peu | `StopPanel.tsx` | F9 | Mitjà | Baix |
| P1 | Línia: resum en una línia, propers busos en xips | `Lines.tsx` | F10 | Mitjà | Baix |
| P1 | Estats humans (A l'hora / N min tard / Retard important / Fora de servei) | `common.tsx` (`Punctuality`), i18n | F12 | Mitjà | Baix |
| P2 | Mapa contextual petit dins la parada al mòbil | — | — | Baix | — |
| P2 | Historial i preferències del compte | — | requereix backend de comptes | — | — |

Proves: `pnpm typecheck`, `pnpm lint`, `pnpm test`, build, e2e (escriptori, iPhone 13, Android), recorregut
visual 390/393/430/768/1440 (`scripts/ux-tour.mjs`), perf-probe d'inici i parada.
