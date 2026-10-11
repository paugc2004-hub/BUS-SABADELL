# Traspàs a una sessió nova (2026-10-11)

Llegeix primer `CLAUDE.md` (regles del repo) i `docs/FINAL_APP_AUDIT.md` (estat de l'app).

## On som
- App en producció: https://bus-sabadell.vercel.app/app. Totes les proves passen: 100 unitàries i 87 e2e.
- Fet recentment:
  - ubicació automàtica (LocationService);
  - cerca universal de destins (`/api/places`: Photon/OSM; Google Places si hi ha `GOOGLE_PLACES_API_KEY` a Vercel);
  - enduriment de seguretat;
  - correcció del mapa en blanc (worker de MapLibre 6);
  - mòbil més lleuger.
- Android: paquet de PWABuilder `app.nextmobility.sabadell`. `apps/web/public/.well-known/assetlinks.json` porta aquest paquet i el de prova `app.vercel.bus_sabadell.twa`.
- iPhone: s'instal·la des de Safari («Afegeix a la pantalla d'inici»).
- Presentació per a la reunió amb TUS (en català) com a Artifact de claude.ai, i la guia a `docs/REUNIO_TUS_GUIA.md`.

## Regles que no es poden trencar
- Les posicions dels busos són **simulades** a partir dels horaris publicats; s'ha de dir sempre.
- Res d'enginyeria inversa de l'app de TUS/GeoActio ni d'APIs privades. No es fa servir el logotip de TUS.
- L'atribució d'OSM, sempre visible. La ubicació de l'usuari no s'envia mai al servidor.
- Cap secret al repo. El correu de l'usuari no es publica ni s'envia a tercers.
- No afegir `minimumReleaseAgeExclude` a `pnpm-workspace.yaml`.

## Desplegament (important al núvol)
- Avui el web es desplega **des del PC** amb `bash apps/web/scripts/deploy.sh` (Vercel CLI amb la sessió de l'usuari). Una sessió al núvol pot fer *push* a GitHub, però **no pot desplegar** si no té credencials de Vercel.
- Opció: connectar el projecte `bus-sabadell` de Vercel a aquest repo de GitHub. Root `apps/web`, build: el mateix que `deploy.sh`, és a dir `vite build` amb `VITE_API_URL=https://bus-sabadell-api.vercel.app` i copiar `api/places.mjs` (sense els tests). Així cada *push* a `main` es desplegaria sol. Ho ha d'activar l'usuari al tauler de Vercel.

## Pendents (per ordre)
1. Pàgina de **política de privacitat** (`/privacitat`), necessària per a Google Play i App Store.
2. Google Play: fitxa i prova tancada. Les accions de compte són de l'usuari.
3. Opcional: regla de límit de ritme per a `/api/places` al Vercel Firewall, i clau de Google Places amb pressupost limitat.
4. Comptes reals (backend d'autenticació) i notificacions del sistema.
5. Dependències de desenvolupament: vitest 4 i treure `lighthouse` si no s'usa.

## Comandes
`pnpm install` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm --filter @bus/web build` ·
`cd apps/web && npx playwright test` (fa servir `vite preview` de `dist/`; cal fer el build abans).
