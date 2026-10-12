# Reunió amb TUS i l'Ajuntament — guió de comparació (3 minuts)

Dues pantalles de mòbil, una al costat de l'altra: l'app oficial (TUS Sabadell 3.2.4) i NextMobility
(https://bus-sabadell.vercel.app/app). Si es fa un dia que no sigui el 12/10/2026, es pot fixar l'hora de les
captures amb `?hora=11:54&dia=2026-10-12` (surt «hora de demo» a la capçalera). Matriu completa: `docs/TUS_PARITY.md`.

Regla de la reunió: cada vegada que es diu «i a més», ensenyar-ho; i dir sempre que els busos són **simulats** a
partir dels horaris publicats (amb el SAE de TUS serien reals) i que títols i targetes són **de demostració**.

| Temps | A la vostra… | A la nostra… | I a més… |
|---|---|---|---|
| 0:00 | Portada: 5 targetes | Inici: les mateixes 5 targetes | A dalt, «On vols anar?» i les parades que tens a prop amb el proper bus: útil sense tocar res |
| 0:20 | Informació del servei → mapa ple d'icones | Mapa | Parades **agrupades**, **busos** circulant (simulats, etiquetats) i línies dibuixades |
| 0:40 | Lupa → «Buscar parada»: pantalla buida | Lupa → «Cerca una parada» | Abans d'escriure: a prop, preferides i recents. «43» → **43 - Casal Pere Quart** primer |
| 0:55 | QR | QR | Llegeix els QR de les nostres marquesines (`/qr` els genera); la imatge no surt del mòbil |
| 1:05 | Triangle amb punt vermell → 4 avisos en majúscules | Avisos amb el **número** dels que estan en vigor (3) | «Actius ara» / «Propers» (el tall del pg. del Comerç és demà), xips de les línies, l'avís a la fitxa de la línia i de la parada |
| 1:25 | Línies: fecha + llista de F | Línies: Avui · Demà · Tria un dia; avui «Festiu comercial» | La F6 només surt els festius comercials; a cada parada, **l'hora de pas** i els transbords |
| 1:50 | Cómo llegar → **obre Google Maps** | Com hi arribo → la ruta es calcula **aquí** | Mateix cas: F4 des de Mercat Central a les 12:00. Puja a / Baixa a / temps total, i «Agafaré aquest bus» et segueix |
| 2:20 | Viaja con el móvil / Tarjetas | Títols i targetes (**demostració**) | El mateix flux (comprar, fer servir, compres, viatges, targetes). No es cobra res: amb la vostra API seria real |
| 2:40 | Área personal | El meu compte | Configuració d'accessibilitat (text gran, alt contrast, menys moviment) i esborrat complet de dades |
| 2:50 | Más | Més | Català per defecte i castellà a un toc; funciona sense connexió |

**Tancament (10 s)**: «Tot el que fa la vostra app hi és, al mateix lloc. El que la fa millor és el que necessita les
vostres dades: amb el SAE, les posicions serien reals; amb l'API de venda, els títols també.»

## Què NO s'ha de dir
- Que les posicions o els retards són reals (són simulats i ho posa a cada bus).
- Que els títols, el pagament o les targetes funcionen (són una demostració; no es cobra ni es llegeix res).
- Que és l'app oficial o que hi ha cap acord amb TUS o GeoActio.

## Abans de la reunió
- Confirmar a tus.es: preus (`verified: false`), festius comercials 2026, URL de cada avís, horari de l'Oficina i xarxes.
- Captures de cada pantalla a 390×844: `node apps/web/scripts/parity-shots.mjs docs/img/paritat 390x844 "/app=inici" …`
  contra `vite preview` (amb `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` a Claude Code web).
