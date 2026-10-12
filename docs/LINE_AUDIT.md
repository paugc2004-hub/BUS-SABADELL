# Auditoria línia per línia

Generat per `pnpm data:audit` sobre la versió de dades `2026-10-06-a0102b1d2935`. No editar a mà.

Per a cada variant (recorregut publicat per tus.es) es comprova, amb fonts independents:

- **Carrer**: el recorregut, mostrejat cada 10 m, ha d'anar per l'eix d'un carrer d'OpenStreetMap (≤ 20 m). Error si hi ha més de 60 m seguits fora de carrer.
- **Parades**: cada parada ha de quedar a ≤ 40 m del punt del recorregut on la situem, i en ordre estrictament creixent.
- **OSM**: desviació respecte de la relació de ruta d'OSM de la mateixa línia, quan n'hi ha (OSM només en té 13 de 23).
- **Sentits únics**: el bus no pot anar en contra d'un carrer de sentit únic d'OSM (llevat d'excepcions per a bus: oneway:bus=no, busway=opposite_lane…). Error si són més de 40 m seguits.
- **Punxes**: el recorregut no pot tornar enrere sobre si mateix en menys de 40 m (tus.es dibuixa una anada i tornada fins al pal de cada parada; el pipeline les elimina).
- **Sentits i capçaleres**: les línies no circulars tenen els dos sentits i les capçaleres coincideixen (± 400 m).

Resultat: **105 variants**: 96 ok, 9 amb avís, 0 amb error.

## Observacions de línia

- Cap: totes les línies no circulars tenen els dos sentits i capçaleres coherents.

## Variants

| Línia | Dia | Sentit | Capçalera origen (1a parada) | Destí (última parada) | Parades | km | Exp. | Al carrer | Parada més lluny | OSM mitjana / p95 | Estat | Problemes |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|
| L1 | feiner | anada | Can Deu (Can Deu) | Estació Sud (Estació Sud) | 30 | 8.6 | 50 | 100% | 18 m | 1 / 4 m | ok | — |
| L1 | feiner | tornada | Estació Sud (Estació Sud) | Can Deu (Can Deu) | 27 | 8.8 | 43 | 100% | 20 m | 1 / 5 m | ok | — |
| L1 | feiner | anada | Vall d'Aran (Vall d'Aran) | Estació Sud (Estació Sud) | 33 | 9.6 | 1 | 100% | 18 m | 1 / 4 m | ok | — |
| L1 | feiner | tornada | Estació Sud (Estació Sud) | Can Deu (Can Deu) | 28 | 9 | 1 | 100% | 20 m | 1 / 7 m | ok | — |
| L1 | feiner | anada | La Concòrdia (La Concòrdia) | Picasso (Picasso) | 19 | 5.2 | 12 | 100% | 18 m | 2 / 9 m | ok | — |
| L1 | feiner | tornada | Picasso (Picasso) | Sant Bernat (Alcalde Ribé) | 18 | 5.9 | 10 | 100% | 12 m | 1 / 7 m | ok | — |
| L1 | feiner | anada | La Concòrdia (La Concòrdia) | Estació Sud (Estació Sud) | 21 | 5.7 | 7 | 100% | 18 m | 1 / 8 m | ok | — |
| L1 | feiner | tornada | Picasso (Picasso) | Can Deu (Can Deu) | 26 | 8.1 | 3 | 100% | 12 m | 1 / 5 m | ok | — |
| L1 | feiner | tornada | Creu de Barberà (Leonardo da Vinci) | Can Deu (Francesc Trabal) | 28 | 8.4 | 2 | 100% | 10 m | 1 / 6 m | ok | — |
| L1 | feiner | tornada | Estació Sud (Estació Sud) | Can Deu (Can Deu) | 28 | 8.7 | 30 | 100% | 20 m | 12 / 131 m | ok | — |
| L1 | dissabte | anada | Can Deu (Can Deu) | Estació Sud (Estació Sud) | 30 | 9.6 | 30 | 100% | 18 m | 1 / 7 m | ok | — |
| L1 | dissabte | tornada | Estació Sud (Estació Sud) | Can Deu (Can Deu) | 28 | 9.3 | 31 | 100% | 20 m | 1 / 5 m | ok | — |
| L1 | dissabte | anada | Vall d'Aran (Vall d'Aran) | Estació Sud (Estació Sud) | 33 | 10.5 | 1 | 100% | 18 m | 1 / 6 m | ok | — |
| L2 | feiner | anada | Can Deu (Can Deu) | Creu de Barberà (Leonardo da Vinci) | 30 | 8.7 | 53 | 100% | 18 m | 1 / 6 m | ok | — |
| L2 | feiner | tornada | Creu de Barberà (Leonardo da Vinci) | Can Deu (Can Deu) | 31 | 8.5 | 48 | 100% | 14 m | 0 / 4 m | ok | — |
| L2 | feiner | tornada | Creu de Barberà (Leonardo da Vinci) | Pl. Espanya (Espanya) | 21 | 6.1 | 4 | 100% | 10 m | 1 / 6 m | ok | — |
| L2 | feiner | tornada | Creu de Barberà (Leonardo da Vinci) | Can Deu (Can Deu) | 33 | 8.9 | 6 | 100% | 14 m | 1 / 4 m | ok | — |
| L2 | dissabte | anada | Can Deu (Can Deu) | Creu de Barberà (Leonardo da Vinci) | 30 | 9.6 | 30 | 100% | 18 m | 1 / 6 m | ok | — |
| L2 | dissabte | tornada | Creu de Barberà (Leonardo da Vinci) | Can Deu (Can Deu) | 31 | 9.2 | 26 | 100% | 14 m | 0 / 4 m | ok | — |
| L2 | dissabte | anada | Vall d'Aran (Vall d'Aran) | Creu de Barberà (Leonardo da Vinci) | 33 | 10.5 | 1 | 100% | 18 m | 1 / 6 m | ok | — |
| L2 | dissabte | tornada | Creu de Barberà (Leonardo da Vinci) | Can Deu (Can Deu) | 33 | 9.5 | 7 | 100% | 14 m | 0 / 4 m | ok | — |
| L3 | feiner | anada | Can Deu (Can Deu) | La Romànica (La Romànica) | 29 | 7.9 | 46 | 100% | 18 m | 1 / 5 m | ok | — |
| L3 | feiner | tornada | La Romànica (La Romànica) | Can Deu (Can Deu) | 29 | 8.1 | 49 | 100% | 11 m | 1 / 4 m | ok | — |
| L3 | feiner | anada | Can Deu (Can Deu) | La Romànica (La Romànica) | 28 | 8 | 27 | 100% | 18 m | 31 / 374 m | ok | — |
| L3 | feiner | tornada | La Romànica (La Romànica) | Can Deu (Can Deu) | 28 | 8.3 | 26 | 100% | 11 m | 18 / 99 m | ok | — |
| L3 | dissabte | anada | Can Deu (Can Deu) | La Romànica (La Romànica) | 28 | 9.1 | 27 | 100% | 18 m | 1 / 7 m | ok | — |
| L3 | dissabte | tornada | La Romànica (La Romànica) | Can Deu (Can Deu) | 28 | 9 | 28 | 100% | 14 m | 0 / 4 m | ok | — |
| L4 | feiner | anada | El Poblenou (El Poblenou) | La Roureda (La Roureda) | 45 | 14.5 | 32 | 100% | 20 m | 0 / 2 m | ok | — |
| L4 | feiner | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 45 | 13.8 | 32 | 100% | 16 m | 1 / 2 m | ok | — |
| L4 | feiner | anada | El Poblenou (El Poblenou) | La Roureda (La Roureda) | 53 | 17 | 2 | 100% | 20 m | 0 / 1 m | ok | — |
| L4 | feiner | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 52 | 16.5 | 4 | 100% | 16 m | 0 / 2 m | ok | — |
| L4 | dissabte | anada | El Poblenou (El Poblenou) | La Roureda (La Roureda) | 45 | 14.5 | 31 | 100% | 20 m | 0 / 2 m | ok | — |
| L4 | dissabte | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 43 | 14.8 | 29 | 100% | 16 m | 26 / 187 m | ok | — |
| L4 | dissabte | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 51 | 17.2 | 1 | 100% | 20 m | 25 / 123 m | ok | — |
| L44 | feiner | anada | El Poblenou (El Poblenou) | Parc Taulí (Parc Taulí) | 41 | 13.6 | 29 | 100% | 20 m | — | ok | — |
| L44 | feiner | tornada | Parc Taulí (Parc Taulí) | El Poblenou (El Poblenou) | 41 | 13 | 29 | 100% | 16 m | — | ok | — |
| L5 | feiner | anada | Can Rull (Can Rull) | Les Termes (Les Termes) | 26 | 7.4 | 56 | 100% | 14 m | 2 / 5 m | ok | — |
| L5 | feiner | tornada | Les Termes (Les Termes) | Can Rull (Can Rull) | 23 | 7.3 | 53 | 100% | 14 m | 1 / 5 m | ok | — |
| L5 | dissabte | anada | Can Rull (Can Rull) | Les Termes (Les Termes) | 25 | 8.4 | 34 | 100% | 14 m | 59 / 556 m | ok | — |
| L5 | dissabte | tornada | Les Termes (Les Termes) | Can Rull (Can Rull) | 23 | 7.3 | 33 | 100% | 14 m | 1 / 5 m | ok | — |
| L55 | feiner | anada | Can Llong (La Roureda) | Les Termes (Les Termes) | 28 | 8.2 | 55 | 100% | 14 m | — | ok | — |
| L55 | feiner | tornada | Les Termes (Les Termes) | Can Llong (La Roureda) | 24 | 8.1 | 51 | 100% | 14 m | — | ok | — |
| L55 | dissabte | anada | Can Llong (La Roureda) | Les Termes (Les Termes) | 27 | 9.2 | 33 | 100% | 14 m | — | ok | — |
| L55 | dissabte | tornada | Les Termes (Les Termes) | Can Llong (La Roureda) | 24 | 8.1 | 31 | 100% | 14 m | — | ok | — |
| L7 | feiner | anada | Can Puiggener (Can Puiggener) | Castellarnau (Castellarnau) | 28 | 8.7 | 28 | 100% | 24 m | 0 / 4 m | ok | — |
| L7 | feiner | tornada | Castellarnau (Castellarnau) | Can Puiggener (Can Puiggener) | 29 | 8.8 | 32 | 100% | 17 m | 0 / 3 m | ok | — |
| L7 | feiner | anada | Can Puiggener (Can Puiggener) | Castellarnau per T. del Capellà (Castellarnau) | 29 | 9.2 | 3 | 100% | 24 m | 18 / 162 m | avís | 20 m a contrasentit (Carrer dels Clavells, prop de 2.09645,41.56785) |
| L7 | dissabte | anada | Can Puiggener (Can Puiggener) | Castellarnau (Castellarnau) | 27 | 8.8 | 32 | 100% | 24 m | 6 / 5 m | ok | — |
| L7 | dissabte | tornada | Castellarnau (Castellarnau) | Can Puiggener (Can Puiggener) | 27 | 8.8 | 31 | 100% | 17 m | 4 / 6 m | ok | — |
| L8 | feiner | anada | Estació Sud (Estació Sud) | La Roureda (La Roureda) | 20 | 6.2 | 29 | 100% | 18 m | 1 / 8 m | ok | — |
| L8 | feiner | tornada | La Roureda (La Roureda) | Estació Sud (Estació Sud) | 20 | 6.3 | 30 | 100% | 18 m | 1 / 5 m | ok | — |
| L8 | feiner | anada | Zona Industrial (Zona Industrial) | La Roureda (La Roureda) | 24 | 7.8 | 2 | 100% | 20 m | 98 / 638 m | ok | — |
| L8 | feiner | tornada | La Roureda (La Roureda) | Zona Industrial (Zona Industrial) | 24 | 7.7 | 2 | 100% | 63 m | 132 / 638 m | avís | capçalera Zona Industrial a 63 m de l'extrem del recorregut publicat (punt de regulació) |
| L8 | feiner | anada | Estació Sud (Comerç) | Pl. Catalunya (Valentí Almirall) | 10 | 3.1 | 1 | 100% | 10 m | 2 / 10 m | ok | — |
| L8 | dissabte | anada | Estació Sud (Estació Sud) | La Roureda (La Roureda) | 20 | 6.2 | 29 | 100% | 18 m | 1 / 8 m | ok | — |
| L8 | dissabte | tornada | La Roureda (La Roureda) | Estació Sud (Estació Sud) | 20 | 6.3 | 30 | 100% | 18 m | 1 / 5 m | ok | — |
| L10 | feiner | anada | Plaça de Picasso (Picasso) | Sant Julià (Sant Julià) | 29 | 8.5 | 31 | 100% | 14 m | 1 / 3 m | ok | — |
| L10 | feiner | tornada | Sant Julià (Sant Julià) | Plaça de Picasso (Picasso) | 23 | 8.4 | 31 | 100% | 18 m | 1 / 4 m | ok | — |
| L10 | dissabte | anada | Plaça de Picasso (Picasso) | Sant Julià (Sant Julià) | 27 | 8.6 | 26 | 100% | 14 m | 8 / 65 m | ok | — |
| L10 | dissabte | tornada | Sant Julià (Sant Julià) | Plaça de Picasso (Picasso) | 22 | 8.5 | 28 | 100% | 18 m | 8 / 15 m | ok | — |
| L11 | feiner | anada | Sant Pau de Riu-sec (Sabadell-Badia) | Castellarnau (Castellarnau) | 31 | 11.5 | 30 | 100% | 12 m | 1 / 4 m | ok | — |
| L11 | feiner | tornada | Castellarnau (Castellarnau) | Sant Pau de Riu-sec (Sabadell-Badia) | 31 | 12.4 | 31 | 100% | 26 m | 2 / 8 m | ok | — |
| L11 | feiner | anada | Espanya (Espanya) | Mancomunitat (Av. La Pau) | 13 | 4 | 8 | 100% | 13 m | 304 / 947 m | ok | — |
| L11 | feiner | tornada | Mancomunitat (Av. La Pau) | Espanya (Espanya) | 13 | 4.3 | 10 | 100% | 10 m | 153 / 773 m | ok | — |
| L11 | dissabte | anada | Sant Pau de Riu-sec (Sabadell-Badia) | Castellarnau (Castellarnau) | 27 | 11.3 | 31 | 100% | 12 m | 23 / 223 m | ok | — |
| L11 | dissabte | tornada | Castellarnau (Castellarnau) | Sant Pau de Riu-sec (Sabadell-Badia) | 29 | 12 | 32 | 100% | 26 m | 16 / 11 m | ok | — |
| L12 | feiner | anada | Estació Centre (Estació Centre) | Sant Quirze Parc (Sant Quirze Parc) | 24 | 8.8 | 10 | 100% | 19 m | 5 / 55 m | ok | — |
| L12 | feiner | tornada | Sant Quirze Parc (Sant Quirze Parc) | Estació Centre (Estació Centre) | 27 | 9.6 | 22 | 100% | 12 m | 2 / 6 m | ok | — |
| L12 | feiner | anada | Estació Centre (Estació Centre) | Sant Quirze Parc (Sant Quirze Parc) | 28 | 9.5 | 13 | 100% | 19 m | 167 / 737 m | ok | — |
| L12 | feiner | anada | Estació Centre (Estació Centre) | Sant Quirze Parc per BMC (Sant Quirze Parc) | 30 | 11.8 | 1 | 100% | 19 m | 230 / 719 m | ok | — |
| L12 | feiner | tornada | Sant Quirze Parc (Sant Quirze Parc) | Estació Centre per BMC (Estació Centre) | 28 | 10.4 | 1 | 100% | 18 m | 104 / 618 m | ok | — |
| L12 | dissabte | tornada | Sant Quirze Parc (Sant Quirze Parc) | Estació Centre (Estació Centre) | 25 | 9.6 | 13 | 100% | 12 m | 4 / 19 m | ok | — |
| L12 | dissabte | anada | Estació Centre (Estació Centre) | Sant Quirze Parc (Sant Quirze Parc) | 28 | 9.5 | 13 | 100% | 19 m | 167 / 737 m | ok | — |
| L14 | feiner | anada | Parc Taulí (Parc Taulí) | Can Roqueta (Polígon Can Roqueta) | 16 | 5.5 | 27 | 100% | 15 m | 1 / 5 m | avís | 1 punxes (el recorregut torna enrere sobre si mateix en < 40 m) |
| L14 | feiner | tornada | Can Roqueta (Polígon Can Roqueta) | Parc Taulí (Parc Taulí) | 20 | 6.8 | 28 | 100% | 11 m | 0 / 0 m | ok | — |
| L14 | feiner | anada | Els Merinals (Mèxic) | Can Roqueta (Polígon Can Roqueta) | 35 | 10.8 | 20 | 100% | 20 m | 789 / 2325 m | avís | 1 punxes (el recorregut torna enrere sobre si mateix en < 40 m) |
| L14 | feiner | tornada | Can Roqueta (Polígon Can Roqueta) | Els Merinals (Mèxic) | 38 | 12.1 | 20 | 100% | 17 m | 619 / 2265 m | ok | — |
| L14 | feiner | tornada | Estació Centre (Estació Centre) | Parc Taulí (Parc Taulí) | 5 | 1.3 | 1 | 100% | 7 m | 2 / 9 m | ok | — |
| L14 | dissabte | anada | Els Merinals (Mèxic) | Can Roqueta (Polígon Can Roqueta) | 35 | 10.8 | 18 | 100% | 20 m | 789 / 2325 m | avís | 1 punxes (el recorregut torna enrere sobre si mateix en < 40 m) |
| L14 | dissabte | tornada | Can Roqueta (Polígon Can Roqueta) | Els Merinals (Mèxic) | 38 | 12.1 | 18 | 100% | 17 m | 619 / 2265 m | ok | — |
| L15 | feiner | circular | Anella Esportiva (La Bassa) | Centre (Bellesguard) | 14 | 5 | 10 | 100% | 14 m | 0 / 1 m | ok | — |
| L15 | dissabte | circular | Anella Esportiva (La Bassa) | Centre (Bellesguard) | 15 | 6.4 | 24 | 100% | 14 m | 64 / 449 m | ok | — |
| L23 | feiner | anada | Torre-Romeu (Torre-romeu) | Can Roqueta (Can Llobateras) | 6 | 1.7 | 4 | 100% | 10 m | 41 / 162 m | ok | — |
| L23 | feiner | tornada | Can Roqueta (Can Llobateras) | Torre Romeu (Torre-romeu) | 7 | 2.4 | 4 | 100% | 9 m | 100 / 327 m | ok | — |
| L80 | feiner | anada | Plaça de Picasso (Picasso) | La Plana del Pintor (La Plana del Pintor) | 34 | 9.4 | 46 | 100% | 18 m | — | ok | — |
| L80 | feiner | tornada | La Plana del Pintor (La Plana del Pintor) | Plaça de Picasso (Picasso) | 32 | 9.1 | 44 | 100% | 17 m | — | ok | — |
| L80 | dissabte | anada | Plaça de Picasso (Picasso) | La Plana del Pintor (La Plana del Pintor) | 31 | 9.1 | 27 | 100% | 18 m | — | avís | 20 m a contrasentit (Carrer dels Clavells, prop de 2.09641,41.56780) |
| L80 | dissabte | tornada | La Plana del Pintor (La Plana del Pintor) | Plaça de Picasso (Picasso) | 30 | 8.9 | 29 | 100% | 17 m | — | ok | — |
| F1 | festiu | anada | Can Deu (Can Deu) | Estació Sud (Estació Sud) | 32 | 10.1 | 31 | 100% | 18 m | — | ok | — |
| F1 | festiu | tornada | Estació Sud (Estació Sud) | Can Deu (Can Deu) | 30 | 9.8 | 30 | 100% | 20 m | — | ok | — |
| F2 | festiu | anada | Can Deu (Can Deu) | La Creu de Barberà (Leonardo da Vinci) | 33 | 11.1 | 30 | 100% | 14 m | — | ok | — |
| F2 | festiu | tornada | La Creu de Barberà (Leonardo da Vinci) | Can Deu (Can Deu) | 37 | 10.8 | 30 | 100% | 14 m | — | ok | — |
| F3 | festiu | anada | La Plana del Pintor (La Plana del Pintor) | La Romànica (La Romànica) | 34 | 10.6 | 28 | 100% | 20 m | — | ok | — |
| F3 | festiu | tornada | La Romànica (La Romànica) | La Plana del Pintor (La Plana del Pintor) | 38 | 11.2 | 28 | 100% | 18 m | — | avís | 20 m a contrasentit (Carrer dels Clavells, prop de 2.09643,41.56783) |
| F4 | festiu | anada | El Poblenou (El Poblenou) | La Roureda (La Roureda) | 40 | 14.1 | 14 | 100% | 19 m | — | ok | — |
| F4 | festiu | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 42 | 13.6 | 14 | 100% | 16 m | — | ok | — |
| F4 | festiu | anada | El Poblenou (El Poblenou) | La Roureda (La Roureda) | 46 | 17.1 | 14 | 100% | 19 m | — | avís | 20 m a contrasentit (Ronda de la Roureda, prop de 2.08512,41.56925) |
| F4 | festiu | tornada | La Roureda (La Roureda) | El Poblenou (El Poblenou) | 48 | 16.5 | 15 | 100% | 19 m | — | ok | — |
| F4 | festiu | anada | El Poblenou (El Poblenou) | Calderón (Dr. Almera) | 21 | 7.6 | 28 | 100% | 14 m | — | ok | — |
| F4 | festiu | tornada | Vallès (Dr. Almera) | El Poblenou (El Poblenou) | 23 | 7.6 | 28 | 100% | 15 m | — | ok | — |
| F5 | festiu | anada | Castellarnau (Castellarnau) | Les Termes (Les Termes) | 30 | 8.9 | 28 | 100% | 14 m | — | ok | — |
| F5 | festiu | tornada | Les Termes (Les Termes) | Castellarnau (Castellarnau) | 28 | 9.2 | 28 | 100% | 14 m | — | ok | — |
| F6 | festiu | anada | Pl. Catalunya (Catalunya) | Sant Pau de Riu-sec (Sabadell-Badia) | 21 | 8.9 | 12 | 100% | 26 m | — | ok | — |
| F6 | festiu | tornada | Sant Pau de Riu-sec (Sabadell-Badia) | Pl. Catalunya (Catalunya) | 17 | 7.9 | 12 | 100% | 14 m | — | ok | — |
| F15 | festiu | circular | Anella Esportiva (La Bassa) | Centre (Bellesguard) | 17 | 7.1 | 24 | 100% | 14 m | — | avís | 1 punxes (el recorregut torna enrere sobre si mateix en < 40 m) |

## Trams compartits (feiners, ≥ 0,5 km)

Km del recorregut principal de la primera línia que coincideixen (± 8 m) amb qualsevol variant de la segona. Al mapa, la línia seleccionada es dibuixa per sobre de les altres.

| Línia | Comparteix amb | km |
|---|---|---:|
| L4 | L44 | 11.9 |
| L44 | L4 | 11.9 |
| L4 | L14 | 7.9 |
| L44 | L14 | 7.9 |
| L2 | L1 | 7.4 |
| L2 | L3 | 7.1 |
| L3 | L1 | 6.7 |
| L3 | L2 | 6.7 |
| L5 | L55 | 6.4 |
| L55 | L5 | 6.4 |
| L1 | L3 | 5.5 |
| L14 | L4 | 5.4 |
| L1 | L2 | 5.3 |
| L15 | L5 | 3.8 |
| L15 | L55 | 3.8 |
| L7 | L10 | 3.2 |
| L10 | L7 | 3.2 |
| L80 | L11 | 3.2 |
| L4 | L12 | 3.1 |
| L44 | L12 | 3.1 |
| L8 | L1 | 3.1 |
| L7 | L11 | 3 |
| L1 | L80 | 2.9 |
| L7 | L14 | 2.9 |
| L11 | L14 | 2.9 |
| L11 | L80 | 2.9 |
| L14 | L44 | 2.7 |
| L80 | L1 | 2.6 |
| L2 | L10 | 2.5 |
| L44 | L7 | 2.5 |
| L7 | L44 | 2.5 |
| L1 | L8 | 2.4 |
| L3 | L10 | 2.4 |
| L10 | L1 | 2.4 |
| L10 | L8 | 2.4 |
| L10 | L3 | 2.3 |
| L4 | L23 | 2.2 |
| L11 | L44 | 2.2 |
| L4 | L55 | 2.1 |
| L10 | L2 | 2.1 |
