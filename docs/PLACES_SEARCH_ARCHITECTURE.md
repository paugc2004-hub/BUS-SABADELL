# Cerca universal de destins — arquitectura

```
«On vols anar?»  ──►  PlacesProvider (ON és el lloc)  ──►  coordenades  ──►  TransitProvider (QUIN bus)
                       ├─ nomenclàtor local (al mòbil)                         SimEngine + planTrip (core)
                       └─ /api/places (servidor) → Photon | Google             parades, línies, ETA
```
**Les dues capes no es barregen.** El cercador només retorna *un punt amb nom*. El motor TUS no sap d'on ve.

## Peces
| Fitxer | Paper |
|---|---|
| `apps/web/src/data/streets.ts` | Nomenclàtor local (carrers + llocs OSM), cerca per paraules i àlies |
| `apps/web/src/data/places.ts` | `PlacesProvider` (interfície), `apiPlaces`, `useRemotePlaces` (debounce, cancel·lació, memòria), `rankPlaces`, `rankLocal`, `dedupe`, codi de ruta `g…` |
| `apps/web/api/places.mjs` | Funció serverless de Vercel `GET /api/places?q=&lang=`: valida, limita el ritme, crida Photon o Google, normalitza, desa a la memòria cau (només OSM) |
| `apps/web/vite.config.ts` | La mateixa funció en local (`vite` i `vite preview`) |
| `apps/web/src/views/SearchBox.tsx` | UI: Llocs (locals + remots), Carrers, Línies, Parades, Destinacions |
| `apps/web/src/views/Route.tsx` | `usePlace` resol `c…` carrer, `l…` lloc local, `p…` parada, **`g…` lloc del cercador universal** |

## Flux d'una cerca («Info Exp…»)
1. Cada tecla: cerca **local** instantània (sense xarxa).
2. Amb ≥ 3 lletres i **350 ms** sense teclejar: una petició a `/api/places`. L'anterior es cancel·la (`AbortController`).
   Si la mateixa cerca ja s'havia fet, surt de la memòria (80 entrades). Sense connexió, no es fa la petició.
   *«Info Express» escrit lletra a lletra = 1 petició* (prova e2e).
3. El servidor respon `{ source, attribution, results: [{ id, name, label, kind, lon, lat }] }`, només amb resultats dins la zona (lon 2,00–2,20, lat 41,47–41,62: la xarxa TUS més uns 5 km).
4. Al mòbil:
   - S'ordena: nom exacte → comença igual → conté les paraules → la resta. Dins de cada grup, el més proper a l'usuari («Mercadona» a prop teu primer).
   - Es treuen els duplicats del nomenclàtor local (mateix nom a menys de 150 m) i les parades d'OSM, perquè les del TUS ja hi són.
5. Es mostra «Info Express · Can Oriach · Sabadell · a 1,2 km». Si un lloc té diverses botigues, surten totes, cadascuna amb el seu barri i la seva distància.

## Codi de ruta `g`
`/ruta/g<lon>,<lat>,<base64url(["nom","zona"])>`: un enllaç que es pot compartir, sense estat al servidor.
`parseGeoCode` ho valida tot:
- el format;
- que les coordenades siguin a la zona;
- que el JSON sigui una llista de textos;
- la longitud (nom ≤ 80, zona ≤ 120).

Si alguna cosa falla, el resultat és `null` i la pantalla mostra «—». El nom es pinta com a text (React), mai com a HTML (prova e2e amb `<img onerror>`).

## Privacitat
- Al servidor de llocs **només li arriba el text** (`q`) i l'idioma: ni coordenades, ni compte, ni cookies (`credentials: 'omit'`, `referrerPolicy: 'no-referrer'`).
- La petició al proveïdor la fa el servidor: Photon o Google no veuen l'adreça IP de l'usuari.
- La proximitat es calcula al mòbil.

## Rendiment
- Local: < 5 ms per tecla.
- Remot:
  - primera cerca 0,3–5 s (Photon públic);
  - repetida 60 ms (memòria de la instància);
  - a la vora de Vercel `s-maxage=86400` (només OSM).
- Mentre arriba, es veu «Buscant més llocs…» i els resultats locals ja són a la pantalla.

## Canviar de proveïdor
Afegir una entrada a `providers` d'`api/places.mjs` (`search(q) → resultats normalitzats`, `attribution`, `cacheable`)
i triar-la per variable d'entorn. El client no canvia.
