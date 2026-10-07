# Geolocalització — implementació

Codi: `apps/web/src/location/location.ts` (LocationService) · `apps/web/src/views/LocationStatus.tsx` (UI).
**Cap altre fitxer crida `navigator.geolocation`.**

## LocationService
| Mètode | Què fa |
|---|---|
| `supported()` | Hi ha API i context segur (HTTPS) |
| `getPermissionState()` | `granted / prompt / denied / unknown` (Permissions API; `unknown` a Safari antic) |
| `locate()` = `requestPermission()` + `getCurrentPosition()` | 1) **ràpida**: sense alta precisió, 8 s, accepta una posició de ≤ 5 min; 2) **precisa** en segon pla (GPS, 15 s) que la millora. Si la ràpida falla per temps o per falta de senyal, prova la precisa abans de donar error. Les crides simultànies **comparteixen** la mateixa petició. |
| `watch()` | `watchPosition` (sense alta precisió, cache 15 s), amb comptador de subscriptors; retorna la funció per aturar-lo |
| `stopWatching()` | La retornada per `watch()`; també `forget()` |
| `retry()` | Torna a `locate()` |
| denegada / temps / no disponible | Estats diferents: `denied`, `timeout`, `unavailable`, `unsupported` |

- **Moviment mínim de 20 m**: sota aquest llindar no es canvia la posició (evita recalcular la ruta pel soroll del GPS). Una precisió molt millor sí que la canvia.
- **Segon pla**: amb `visibilitychange → hidden`, el seguiment s'atura (estalvi de bateria). En tornar, demana una posició fresca i reprèn el seguiment.
- **Canvi de permís en calent**: amb `PermissionStatus.change`, si l'usuari l'activa als ajustos, l'app es localitza sense recarregar.
- **Si ja hi havia una posició** i una petició posterior falla, es manté l'anterior: l'app continua funcionant.

## On s'engega
`AppMain` (un sol cop, en entrar a l'app). Si el permís ja està denegat, no es torna a demanar i es mostra l'estat. Si no, es localitza i es comença el seguiment mentre l'app és oberta. El pas «On ets?» (`Welcome.tsx`) crida `locate()` i continua passi el que passi.

## Estats a la UI (`LocationStatus`)
| Estat | Text (ca) | Acció |
|---|---|---|
| Detectant | «Detectant la teva ubicació…» (punt que batega) | — |
| Ok | «Ets a prop de la parada X» / «Ets aquí» | — |
| Permís pendent | «Et direm quin bus agafar des d'on ets.» | **Activa la ubicació** |
| Denegada | «No podem accedir a la teva ubicació. Activa-la als ajustos.» + com fer-ho a iOS o a Android | **Torna-ho a provar** · *Tria des d'on surts* (a la ruta) |
| Temps esgotat | «No t'hem pogut localitzar.» | **Torna-ho a provar** |
| No disponible | «No s'ha pogut obtenir la teva ubicació.» | **Torna-ho a provar** |
| Sense suport | «Aquest navegador no pot donar la ubicació.» | *Tria des d'on surts* |

**Mai bloqueja l'app**: sense ubicació, el cercador funciona igual i la ruta obre «Tria des d'on surts».
En cap cas hi ha un formulari Origen + Destí: l'origen és la ubicació, i «Canvia» és secundari.

## Privacitat
- La posició només és a la memòria. **No** es desa (ni localStorage ni IndexedDB), **no** s'envia al servidor i **no** va al cercador de llocs (vegeu `PLACES_SEARCH_ARCHITECTURE.md`). No hi ha historial.
- Les proves e2e comproven que les peticions a `/api/places` no porten coordenades.

## Proves
- e2e `cerca universal i ubicació`: amb el permís concedit, l'estat és `ok` i l'origen és la ubicació.
- e2e `ubicació denegada`: estat `denied`, text i instruccions. La ruta ofereix triar l'origen.
- e2e `el flux de l'app`: entrar → «Permet la ubicació» → «Ets a prop de…».

## Per a l'app Android (PWABuilder)
A *Package for stores → Android → Options*, cal activar **Location delegation**. Si no, la TWA no passa la ubicació a la web.
