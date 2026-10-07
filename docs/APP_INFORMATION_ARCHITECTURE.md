# App — arquitectura d'informació (fase 3)

## Rutes
| URL | Vista (`store.View`) | Sessió |
|---|---|---|
| `/entra`, `/registre` | `login`, `register` | pública |
| `/app` | `home` | cal |
| `/ruta/<c|l|p><id>?de=…` | `route` (resultat) | cal |
| `/parada/<id>` | `stop` | cal |
| `/linia[/<id>]` | `line` | cal |
| `/mapa` | `map` | cal |
| `/meus` | `mine` (Compte) | cal |
| `/xarxa`, `/presentacio` | Control (operador, fora de la navegació) | cal |
| `/` | landing (només web; l'app instal·lada no hi entra) | pública |

## Journeys
1. **Primer ús**: obrir → Entrar (o «Entra sense compte») → Ubicació (Permet / Ara no) → Inici.
2. **Cada dia**: obrir → Inici (ubicació automàtica) → escriure destí → Resultat → *Agafaré aquest bus* → Viatge → avís «la propera és la teva».
3. **Ja sóc a la parada**: Inici → parada a prop → propers busos → bus.
4. **Explorar**: Mapa / Línies.

## Estats
- Ubicació: demanant · concedida (on ets) · denegada (triar origen a la ruta) · fora de Sabadell (triar origen).
- Resultat: calculant · opcions · cap bus a la propera hora · destí sense parades a prop · origen lluny.
- Bus: a capçalera · de camí · a la parada · fora de servei. Puntualitat: a l'hora · N min tard · retard important.
- Viatge: esperant · el bus és a la parada · a bord · has arribat · el bus ja ha passat.

## Navegació
Barra inferior (mòbil) / superior (escriptori): **Inici · Mapa · Línies · Compte**.

---
## 2026-10-07 — rutes i codis de destí
| Codi a `/ruta/<codi>` | Què és | D'on surt |
|---|---|---|
| `p<id>` | Parada TUS | Xarxa (`network.json`) |
| `c<id>` | Carrer | Nomenclàtor local (`streets.json`, OSM) |
| `l<id>` | Lloc conegut (equipament, club, estació…) | Nomenclàtor local |
| `g<lon>,<lat>,<b64>` | **Qualsevol lloc** del cercador universal | `/api/places` (Photon / Google) |

Capes: **PlacesProvider** (on és el destí) ≠ **TransitProvider** (quin bus). Vegeu `PLACES_SEARCH_ARCHITECTURE.md` i `TRANSIT_ROUTING.md`.
