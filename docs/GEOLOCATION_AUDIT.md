# Geolocalització — auditoria

Data: 2026-10-07. Estat **abans** d'aquesta fase (commit `f280c0a`). La correcció és a `GEOLOCATION_IMPLEMENTATION.md`.

## Què hi havia
La ubicació es demanava en **cinc llocs diferents**, cadascun pel seu compte, amb `navigator.geolocation.getCurrentPosition`:

| Lloc | Opcions | Què feia amb un error |
|---|---|---|
| `Welcome.tsx` (pas «On ets?») | alta precisió, 12 s, cache 60 s | continuava en silenci |
| `Home.tsx` · `HomePanel` (en obrir) | alta precisió, 10 s, cache 60 s | «denegada» |
| `Home.tsx` · `NearStops` | alta precisió, 10 s, **sense cache** | res |
| `Route.tsx` (origen de la ruta) | alta precisió, 10 s, cache 60 s | «denegada» → triar origen |
| `Chrome.tsx` · botó «On soc» del mapa | alta precisió, 10 s, sense cache | toast d'error |

## Per què «no funcionava»
1. **Tot error era «denegada».** El codi 3 (temps esgotat) i el 2 (posició no disponible) es mostraven igual que el 1 (permís denegat). Qui havia donat permís veia «Activa la ubicació», hi tocava i no passava res.
2. **Alta precisió + 10 s = temps esgotat sovint.** `enableHighAccuracy: true` espera el GPS. A dins d'un edifici o en fred, el GPS pot trigar més de 10 s, i no hi havia cap intent ràpid previ (per xarxa o amb la darrera posició coneguda).
3. **Curses.** Després del pas «On ets?», l'inici en tornava a demanar una altra en paral·lel. La que acabava última guanyava, i un error tardà podia tornar a deixar l'estat en «denegada».
4. **Sense seguiment.** Un cop presa, la posició no s'actualitzava mai (no hi havia `watchPosition`). Si caminaves, l'origen de la ruta i les «parades a prop» quedaven velles.
5. **Sense estat del permís.** No es feia servir la Permissions API. Amb el permís ja denegat, l'app el tornava a demanar a cada obertura, i el navegador fallava a l'instant sense que l'usuari veiés cap diàleg.
6. **Sense instruccions** per tornar a activar-la (iOS / Android).

## Plataformes (comprovat a la configuració, no a cada aparell)
- **HTTPS**: sí (Vercel; HSTS). `window.isSecureContext` és cert, condició necessària per a l'API.
- **`Permissions-Policy: geolocation=(self)`**: correcte (permet el mateix origen; no hi ha iframes).
- **CSP**: no afecta la geolocalització.
- **iOS / Safari**: no hi ha Permissions API per a la geolocalització en versions antigues. A les PWA instal·lades, WebKit pot tornar a demanar el permís a cada sessió. Cal suportar `unknown` i no bloquejar l'app.
- **Android / app de PWABuilder (TWA)**: la ubicació passa al Chrome del sistema. A PWABuilder → Android → *Options* s'ha d'activar **«Location delegation»**; si no, l'app empaquetada no rep la ubicació.
- **Escriptori**: la ubicació ve de la xarxa (Wi-Fi), amb poca precisió. Un intent ràpid sense alta precisió és el que funciona millor.

## Privacitat (comprovat)
- La posició era a la memòria (Zustand). No es desava a localStorage ni a IndexedDB, i no s'enviava enlloc. ✔
- No hi ha analítica ni logs al client. ✔
