/**
 * pnpm data:build — construye la red a partir de los extractos guardados en data/raw.
 * Determinista: misma entrada → misma salida (sin fechas de "ahora").
 *
 *   --refresh   descarga de nuevo tus.es, Overpass y el GTFS de la Generalitat
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SimEngine,
  addDays,
  haversine,
  localIso,
  normalizeColour,
  secondsToHM,
  textColorFor,
  type Alert,
  type DayType,
  type LonLat,
  type NetworkData,
  type Pattern,
  type Route,
  type Stop,
} from '@bus/core';
import { AvisosSchema, FestiusSchema, OverridesSchema, checkFestius, loadYaml } from './config.ts';
import { buildGeometry } from './geometry.ts';
import { lineDeviation, stitchRelation, type OsmElement, type OsmNode, type OsmRel, type OsmWay } from './osm.ts';
import { reconstructTrips, parseTimes, quantize, smoothOffsets } from './trips.ts';
import {
  OFFICIAL_ORDER,
  cleanName,
  dayTypeOf,
  endpoints,
  latestSnapshotDir,
  readTusLines,
  routeIdOf,
  type TusTrayecto,
} from './tus.ts';
import { writeGtfs } from './gtfs.ts';
import { refreshAll } from './fetch.ts';
import { loadDirected, loadRoads } from './audit.ts';
import { assignDirections, isCircular, repairSegments } from './repair.ts';
import { buildInterurbans } from './interurbans.ts';
import { writeStreets } from './streets.ts';

/** «fins a» una data sola inclou tot aquell dia (fins a les 00:00 de l'endemà, hora de Sabadell) */
const untilIso = (v: string | null): string | null => (v === null ? null : v.length === 10 ? localIso(addDays(v, 1)) : localIso(v));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = join(ROOT, 'data/raw');
const CONFIG = join(ROOT, 'data/config');
const DIST = join(ROOT, 'dist');
const WEB_DATA = join(ROOT, 'apps/web/public/data');

interface Report {
  lines: { id: string; status: string; patterns: number; trips: Record<DayType, number>; notes: string[] }[];
  warnings: string[];
  excluded: string[];
  fleet: Record<DayType, { blocks: number; peak: number; peakAt: string; trips: number }>;
  osm: { route: string; tusPattern: string; osmRel: number; meanM: number; p95M: number }[];
  osmMissing: string[];
}

function sha(s: string) {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

/** Algunas cabeceras circulares vienen con la parada inicial al final de la lista. */
function fixRotation(tr: TusTrayecto, notes: string[]): TusTrayecto {
  const first = tr.stops[0];
  const last = tr.stops[tr.stops.length - 1];
  if (!first || !last || tr.stops.length < 3) return tr;
  const a = parseTimes(first.tiempos);
  const b = parseTimes(last.tiempos);
  if (a.length && a.length === b.length) {
    const diffs = a.map((x, i) => x - b[i]!).sort((x, y) => x - y);
    const med = diffs[diffs.length >> 1]!;
    if (med >= 60 && med <= 900) {
      notes.push(`${tr.id}: la parada "${last.name}" va primer (llista rotada a tus.es)`);
      return { ...tr, stops: [last, ...tr.stops.slice(0, -1)] };
    }
  }
  return tr;
}

export async function build(opts: { refresh?: boolean } = {}) {
  if (opts.refresh) await refreshAll(RAW);

  const festius = loadYaml(join(CONFIG, 'festius.yaml'), FestiusSchema);
  const festErr = checkFestius(festius);
  if (festErr.length) throw new Error(`festius.yaml:\n  ${festErr.join('\n  ')}`);
  const avisos = loadYaml(join(CONFIG, 'avisos.yaml'), AvisosSchema);
  const overrides = loadYaml(join(CONFIG, 'overrides.yaml'), OverridesSchema);

  const tusDir = latestSnapshotDir(join(RAW, 'tus'));
  const lines = readTusLines(tusDir);
  const fetched = lines[0]?.fetched ?? 'desconegut';

  const report: Report = {
    lines: [],
    warnings: [],
    excluded: [],
    fleet: {} as Report['fleet'],
    osm: [],
    osmMissing: [],
  };
  const missingLines = OFFICIAL_ORDER.filter((l) => !lines.some((x) => x.line === l));
  for (const l of missingLines) report.warnings.push(`Línia ${routeIdOf(l)} oficial però sense extracte de tus.es`);

  const stops = new Map<string, Stop & { names: Map<string, number> }>();
  const routes: Route[] = [];
  const patterns: Pattern[] = [];
  const stopAlerts: Alert[] = [];

  const mainOrigins = new Map<string, string>();
  lines.forEach((lf, li) => {
    const routeId = routeIdOf(lf.line);
    const notes: string[] = [];
    const colour = overrides.colors[routeId] ?? normalizeColour(lf.colour) ?? '#888888';
    const main = lf.trayectos[0];
    const route: Route = {
      id: routeId,
      ref: routeId,
      longName: overrides.noms[routeId] ?? (main ? cleanName(main.name) : routeId),
      color: colour,
      textColor: textColorFor(colour),
      kind: /^F/.test(lf.line) ? 'festiva' : 'diurna',
      order: li + 1,
      ...(overrides.nomes_festius_comercials.includes(routeId) ? { onlyDates: festius.comercials?.dates ?? [], onlyLabel: 'Festius comercials' } : {}),
      agency: 'TUS',
    };
    routes.push(route);

    // patrones candidatos con sus expediciones reconstruidas
    interface Cand {
      tr: TusTrayecto;
      dayType: DayType;
      geom: ReturnType<typeof buildGeometry>;
      trips: ReturnType<typeof reconstructTrips>;
      stopIds: string[];
    }
    const cands: Cand[] = [];
    for (const tr0 of lf.trayectos) {
      if (overrides.excloure.includes(tr0.id)) {
        report.excluded.push(`${routeId} ${tr0.id} (${tr0.name}): exclòs a overrides.yaml`);
        continue;
      }
      let dayType = dayTypeOf(lf.line, tr0.name);
      if (!dayType) {
        dayType = 'feiner';
        notes.push(`${tr0.id} "${tr0.name}" sense (fn)/(ds): s'assumeix feiners`);
      }
      const tr = fixRotation(tr0, notes);
      if (tr.stops.length < 2) {
        report.excluded.push(`${routeId} ${tr.id}: menys de 2 parades`);
        continue;
      }
      for (const s of tr.stops) {
        const id = s.id.trim();
        const name = s.name.trim();
        const cur = stops.get(id);
        if (cur) {
          cur.names.set(name, (cur.names.get(name) ?? 0) + 1);
          if (!cur.routes.includes(routeId)) cur.routes.push(routeId);
        } else {
          stops.set(id, {
            id,
            name,
            lat: Number(s.latitude),
            lon: Number(s.longitude),
            routes: [routeId],
            names: new Map([[name, 1]]),
          });
        }
        if (s.msgincidencia && s.msgincidencia.trim()) {
          const aid = `tus-${id}-${sha(s.msgincidencia)}`;
          if (!stopAlerts.some((a) => a.id === aid))
            stopAlerts.push({
              id: aid,
              routes: [],
              stops: [id],
              from: s.fechaincidencia && !s.fechaincidencia.startsWith('0000') ? s.fechaincidencia.replace(' ', 'T') : fetched,
              to: null,
              text: { ca: s.msgincidencia.trim(), es: s.msgincidencia.trim() },
              url: lf.source,
            });
        }
      }
      const coords: LonLat[] = tr.coords.map((c) => [Number(c.Longitude), Number(c.Latitude)]);
      const geom = buildGeometry(
        coords,
        tr.stops.map((s) => ({ id: s.id, lon: Number(s.longitude), lat: Number(s.latitude) })),
      );
      for (const w of geom.warnings) notes.push(`${tr.id}: ${w}`);
      if (geom.maxGap > 400) notes.push(`${tr.id}: tram de ${Math.round(geom.maxGap)} m sense vèrtexs`);
      const trips = reconstructTrips(
        tr.stops.map((s) => ({ times: parseTimes(s.tiempos) })),
        geom.stopDist,
      );
      cands.push({ tr, dayType, geom, trips, stopIds: tr.stops.map((s) => s.id.trim()) });
    }

    // deduplicar salidas compartidas entre variantes (mismo día, misma cabecera, misma hora)
    const owner = new Map<string, { cand: Cand; score: number; total: number }>();
    for (const c of cands) {
      for (const t of c.trips) {
        const key = `${c.dayType}|${c.stopIds[0]}|${t.dep}`;
        const others = cands.filter((o) => o !== c && o.dayType === c.dayType && o.stopIds[0] === c.stopIds[0]);
        const otherStops = new Set(others.flatMap((o) => o.stopIds));
        let score = 0;
        c.stopIds.forEach((sid, i) => {
          if (i > 0 && !otherStops.has(sid) && t.raw[i] != null) score++;
        });
        // penalizar si la variante tiene paradas propias sin hora casada
        c.stopIds.forEach((sid, i) => {
          if (i > 0 && !otherStops.has(sid) && t.raw[i] == null) score -= 1;
        });
        const quality = t.timed ? t.matched / t.timed : 0;
        const rank = score * 10 + quality;
        const cur = owner.get(key);
        if (!cur || rank > cur.score || (rank === cur.score && c.trips.length > cur.total))
          owner.set(key, { cand: c, score: rank, total: c.trips.length });
      }
    }

    const tripsPer: Record<DayType, number> = { feiner: 0, dissabte: 0, festiu: 0 };
    const mainOrigin = cands[0] ? endpoints(cands[0].tr.name).origin : '';
    mainOrigins.set(routeId, mainOrigin);
    for (const c of cands) {
      const { origin, headsign } = endpoints(c.tr.name);
      const profiles: number[][] = [];
      const profKey = new Map<string, number>();
      const trips: [number, number][] = [];
      let dropped = 0;
      for (const t of c.trips) {
        const key = `${c.dayType}|${c.stopIds[0]}|${t.dep}`;
        if (owner.get(key)?.cand !== c) continue;
        if (t.timed > 2 && t.matched / t.timed < 0.5) {
          dropped++;
          continue;
        }
        const offs = quantize(smoothOffsets(t.raw, c.geom.stopDist));
        const total = offs[offs.length - 1]!;
        const kmh = c.geom.length / Math.max(1, total) * 3.6;
        if (kmh < 5 || kmh > 40) {
          dropped++;
          report.warnings.push(`${routeId} ${c.tr.id} ${secondsToHM(t.dep)}: velocitat comercial ${kmh.toFixed(1)} km/h, descartada`);
          continue;
        }
        const k = offs.join(',');
        let idx = profKey.get(k);
        if (idx === undefined) {
          idx = profiles.length;
          profiles.push(offs);
          profKey.set(k, idx);
        }
        trips.push([t.dep, idx]);
      }
      if (dropped) notes.push(`${c.tr.id}: ${dropped} sortides descartades per horaris incoherents`);
      if (!trips.length) {
        report.excluded.push(`${routeId} ${c.tr.id} (${cleanName(c.tr.name)}, ${c.dayType}): cap expedició pròpia`);
        continue;
      }
      trips.sort((a, b) => a[0] - b[0]);
      tripsPer[c.dayType] += trips.length;
      const first = c.stopIds[0]!;
      const last = c.stopIds[c.stopIds.length - 1]!;
      const fs = stops.get(first)!;
      const ls = stops.get(last)!;
      patterns.push({
        id: `${routeId}-${c.tr.id}`,
        routeId,
        dir: origin === mainOrigin ? 0 : 1,
        name: cleanName(c.tr.name),
        origin,
        headsign,
        dayType: c.dayType,
        circular: first === last || haversine([fs.lon, fs.lat], [ls.lon, ls.lat]) < 200,
        stopIds: c.stopIds,
        stopDist: c.geom.stopDist,
        coords: c.geom.coords,
        cum: c.geom.cum,
        length: c.geom.length,
        profiles,
        trips,
      });
    }
    const st = cands.length ? (notes.some((n) => /forat|sense geometria|m del recorregut/.test(n)) ? 'avisos' : 'ok') : 'sense dades';
    report.lines.push({ id: routeId, status: st, patterns: patterns.filter((p) => p.routeId === routeId).length, trips: tripsPer, notes });
  });

  // correcciones deducidas de los datos: tramos fuera de calle, circulares y sentidos (repair.ts)
  const roads = loadRoads(41.55);
  if (roads)
    for (const n of repairSegments(patterns, stops, roads, loadDirected(41.55))) {
      const routeId = patterns.find((p) => p.id === n.pattern)!.routeId;
      report.lines
        .find((l) => l.id === routeId)
        ?.notes.push(`${n.pattern}: tram ${n.from} → ${n.to} (${n.reason}) substituït pel de ${n.donor}, que fa el mateix tram entre les mateixes parades`);
    }
  for (const p of patterns) p.circular = isCircular(p.stopIds, p.coords, stops);
  for (const r of routes) {
    const ps = patterns.filter((p) => p.routeId === r.id);
    const dirs = assignDirections(ps, stops, mainOrigins.get(r.id) ?? '');
    for (const p of ps) {
      const d = dirs.get(p.id) ?? p.dir;
      if (d !== p.dir) report.lines.find((l) => l.id === r.id)?.notes.push(`${p.id} "${p.name}": sentit ${p.dir} → ${d} (segons el recorregut)`);
      p.dir = d;
    }
  }

  // nombre canónico de cada parada: el más frecuente
  const stopList: Stop[] = [...stops.values()]
    .map(({ names, ...s }) => ({ ...s, name: [...names.entries()].sort((a, b) => b[1] - a[1])[0]![0] }))
    .sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
  // solo paradas usadas por algún patrón
  const used = new Set(patterns.flatMap((p) => p.stopIds));
  const orphan = stopList.filter((s) => !used.has(s.id));
  for (const s of orphan) report.warnings.push(`Parada òrfena ${s.id} ${s.name}`);

  const alerts: Alert[] = [
    ...avisos.avisos.map((a) => ({
      id: a.id,
      routes: a.linies,
      stops: a.parades,
      // hora local de Sabadell; una data sola «fins a» inclou tot aquell dia
      from: localIso(a.des_de),
      to: untilIso(a.fins_a),
      ...(a.titol ? { title: a.titol } : {}),
      text: a.text,
      ...(a.url ? { url: a.url } : {}),
      ...(a.motiu ? { reason: a.motiu } : {}),
      ...(a.publicacio ? { published: localIso(a.publicacio) } : {}),
      ...(a.expiracio !== undefined ? { expires: untilIso(a.expiracio) } : {}),
      ...(a.adjunts.length ? { attachments: a.adjunts.map((x) => ({ title: x.titol, url: x.url })) } : {}),
    })),
    ...stopAlerts,
  ];

  const network: NetworkData = {
    version: '',
    builtAt: fetched,
    timezone: 'Europe/Madrid',
    sources: [
      {
        id: 'tus',
        name: 'Transports Urbans de Sabadell — informació de les línies',
        url: 'https://www.tus.es/index.php/ca/informacio-de-les-linies',
        license: 'Informació pública del web de TUS. Es cita la font; no s’utilitza cap API privada.',
        fetched,
        note: 'Recorreguts, parades i horaris de pas per parada publicats a tus.es',
      },
      {
        id: 'osm',
        name: 'OpenStreetMap',
        url: 'https://www.openstreetmap.org/copyright',
        license: 'ODbL — © OpenStreetMap contributors',
        fetched: '2026-10-06',
        note: 'Contrast de recorreguts i mapa base',
      },
      {
        id: 'festius',
        name: 'Calendari de festes',
        url: 'https://cido.diba.cat/calendaris-oficials',
        license: 'Dades oficials',
        fetched: '2026-10-06',
        note: festius.font,
      },
    ],
    routes,
    stops: stopList.filter((s) => used.has(s.id)),
    patterns,
    holidays: festius.festius.map((f) => ({ date: f.data, name: f.nom, scope: f.ambit })),
    alerts,
    holidaysPending: festius.pendents.map((p) => `${p.any}: ${p.motiu}`),
  };
  const body = JSON.stringify({ ...network, version: '' });
  network.version = `${fetched}-${sha(body)}`;

  // prueba de cordura: flota (sección 6.3)
  const engine = new SimEngine(network);
  for (const dt of ['feiner', 'dissabte', 'festiu'] as DayType[]) {
    const f = engine.fleet(dt);
    report.fleet[dt] = { blocks: f.blocks, peak: f.peak, peakAt: secondsToHM(f.peakAt), trips: f.trips };
  }
  if (report.fleet.feiner.peak > 110)
    report.warnings.push(`Flota punta de feiners ${report.fleet.feiner.peak} buses: massa alta (TUS en té ~70)`);

  // contraste con OSM
  const osmFile = join(RAW, 'osm/tus-full-2026-10-06.json');
  if (existsSync(osmFile)) contrastOsm(osmFile, network, report);

  // salidas
  mkdirSync(WEB_DATA, { recursive: true });
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(WEB_DATA, 'network.json'), JSON.stringify(network));
  writeStreets(network);
  writeGtfs(network, engine, join(DIST, 'gtfs'));
  const inter = await buildInterurbans(RAW, join(WEB_DATA, 'interurbans.json'));
  if (inter.warning) report.warnings.push(inter.warning);
  writeFileSync(join(DIST, 'report.md'), renderReport(network, report, inter.summary));
  return { network, report };
}

function contrastOsm(file: string, network: NetworkData, report: Report) {
  const els = (JSON.parse(readFileSync(file, 'utf8')) as { elements: OsmElement[] }).elements;
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  const rels: OsmRel[] = [];
  for (const e of els) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
    else if (e.tags?.type === 'route') rels.push(e);
  }
  const inOsm = new Set(rels.map((r) => r.tags.ref));
  for (const r of network.routes) if (!inOsm.has(r.id)) report.osmMissing.push(r.id);
  for (const r of network.routes) {
    const rr = rels.filter((x) => x.tags.ref === r.id);
    if (!rr.length) continue;
    const pats = network.patterns.filter((p) => p.routeId === r.id && p.dayType === 'feiner');
    const main = pats.sort((a, b) => b.trips.length - a.trips.length)[0];
    if (!main) continue;
    let best: { rel: OsmRel; mean: number; p95: number } | null = null;
    for (const rel of rr) {
      const st = stitchRelation(rel, ways, nodes);
      if (st.coords.length < 2) continue;
      const dev = lineDeviation(main.coords, st.coords);
      if (!best || dev.mean < best.mean) best = { rel, ...dev };
    }
    if (best)
      report.osm.push({
        route: r.id,
        tusPattern: main.id,
        osmRel: best.rel.id,
        meanM: Math.round(best.mean),
        p95M: Math.round(best.p95),
      });
  }
}

function renderReport(n: NetworkData, r: Report, inter: string): string {
  const L: string[] = [];
  L.push(`# Informe de qualitat de dades`, '', `Versió de dades: \`${n.version}\` · extracte tus.es del ${n.builtAt}`, '');
  L.push(`- Línies: **${n.routes.length}** · variants (patterns): **${n.patterns.length}** · parades: **${n.stops.length}**`);
  const trips = (dt: DayType) => n.patterns.filter((p) => p.dayType === dt).reduce((s, p) => s + p.trips.length, 0);
  L.push(`- Expedicions: feiners ${trips('feiner')}, dissabtes ${trips('dissabte')}, festius ${trips('festiu')}`, '');
  L.push(`## Flota calculada (prova de cordura)`, '', '| Dia | Torns | Punta simultània | Hora punta | Expedicions |', '|---|---|---|---|---|');
  for (const [dt, f] of Object.entries(r.fleet)) L.push(`| ${dt} | ${f.blocks} | ${f.peak} | ${f.peakAt} | ${f.trips} |`);
  L.push('', 'Referència: TUS té una flota d’uns 60–70 autobusos.', '');
  L.push(`## Línies`, '', '| Línia | Estat | Variants | Exp. feiners | Exp. dissabtes | Exp. festius |', '|---|---|---|---|---|---|');
  for (const l of r.lines) L.push(`| ${l.id} | ${l.status} | ${l.patterns} | ${l.trips.feiner} | ${l.trips.dissabte} | ${l.trips.festiu} |`);
  L.push('');
  for (const l of r.lines) if (l.notes.length) L.push(`### ${l.id}`, ...l.notes.map((x) => `- ${x}`), '');
  L.push(`## Contrast amb OpenStreetMap`, '', 'Desviació de la geometria de tus.es respecte de la relació OSM més semblant (variant principal de feiners).', '');
  L.push('| Línia | Relació OSM | Mitjana (m) | p95 (m) |', '|---|---|---|---|');
  for (const o of r.osm) L.push(`| ${o.route} | [${o.osmRel}](https://www.openstreetmap.org/relation/${o.osmRel}) | ${o.meanM} | ${o.p95M} |`);
  L.push('', `Línies sense relació a OSM: ${r.osmMissing.join(', ') || 'cap'}`, '');
  L.push(`## Exclosos`, '', ...(r.excluded.length ? r.excluded.map((x) => `- ${x}`) : ['- cap']), '');
  L.push(`## Avisos`, '', ...(r.warnings.length ? r.warnings.map((x) => `- ${x}`) : ['- cap']), '');
  L.push(`## Festius`, '', `- ${n.holidays.length} festius carregats`, ...n.holidaysPending.map((p) => `- PENDENT: ${p}`), '');
  L.push(`## Interurbans`, '', inter, '');
  L.push(`## Què és estimat`, '', '- Les posicions dels autobusos: s’interpolen entre les hores de pas publicades (al minut).', '- Els temps de parada (8–22 s) i l’encadenament d’expedicions en torns.', '- La darrera parada de cada trajecte, que tus.es publica sense hora: s’extrapola amb la velocitat mitjana.', '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('build.ts')) {
  build({ refresh: process.argv.includes('--refresh') })
    .then(({ network, report }) => {
      console.log(`✔ network.json: ${network.routes.length} línies, ${network.patterns.length} variants, ${network.stops.length} parades`);
      console.log(`  flota feiners: ${report.fleet.feiner.peak} buses a la punta (${report.fleet.feiner.peakAt})`);
      console.log(`  avisos: ${report.warnings.length} · exclosos: ${report.excluded.length} · informe: dist/report.md`);
    })
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
