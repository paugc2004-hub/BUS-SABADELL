# Guió de 5 minuts — NextMobility davant del plec de 2024

**Frases que no es diuen:** «en temps real», «oficial», «adjudicat», «integrat amb el SAE».

## 1. Què demanava l'Ajuntament (40 s)
Expedient OTU/2024/113: renovar la **web de TUS** (86.000 € sense IVA, fons NextGenerationEU). Objectius: millor
experiència, navegació, aspecte, funcionalitats actualitzades i tecnologia eficient. WCAG 2.1 AA, català i castellà,
responsive, QR a cada parada, horaris imprimibles, avisos, planificador.

## 2. Què ja fa NextMobility (2 min, en directe)
1. **QR d'una parada** → `/qr/278`: escanejar → `/p/278` al mòbil, sense registrar-se: codi, nom, línies, propers
   busos (*simulats, ho diu*) i horari teòric del dia.
2. **Horaris imprimibles** → `/horari/L2`: freqüències per tipus de dia, horari per parada, «Imprimeix».
3. **Línies amb avís** a la llista; els avisos tenen publicació i expiració.
4. **On vols anar?** → «Arribar a les 9:30»: quin bus, on pujar, on baixar. Opcional: obrir a Google Maps.
5. Mapa amb parades agrupades a zoom baix.

## 3. Garanties (40 s)
Accessibilitat comprovada automàticament (axe-core) a les pantalles noves; 3 dispositius als e2e; dades públiques citades;
la ubicació no surt del mòbil; sense galetes.

## 4. Què falta i què necessitem (1 min)
- Mòduls corporatius amb un CMS de codi obert (proposta escrita).
- **De TUS**: GTFS oficial, accés autoritzat al SAE per passar de *simulat* a *temps real*, continguts (tarifes,
  punts de venda, avisos) i, si escau, autorització de marca.

## 5. Tancament (20 s)
«El que demanava el plec per al viatger ja funciona i es pot provar avui; amb les vostres dades, deixa de ser una
simulació.»
