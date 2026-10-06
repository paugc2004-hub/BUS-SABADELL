/**
 * pnpm data:audit — validación línea por línea de la red construida.
 *
 * Contrasta cada variante (pattern) de network.json con fuentes independientes:
 *  - Calles de OSM (data/raw/osm/roads-*.json): todo el recorrido debe ir por una calle.
 *  - Relaciones de ruta de OSM (cuando existen): desviación media / p95.
 *  - Coherencia interna: parada sobre el recorrido, orden, sentidos, cabeceras.
 *
 * Escribe docs/LINE_AUDIT.md y dist/line-audit.json. Falla (exit 1) si alguna
 * variante con expediciones queda en estado "error": preferimos menos líneas
 * pero correctas.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversine, pointAlong, type LonLat, type NetworkData, type Pattern } from '@bus/core';
import { lineDeviation, stitchRelation, type OsmElement, type OsmNode, type OsmRel, type OsmWay } from './osm.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = join(ROOT, 'data/raw');

/** distancia máxima de un punto del recorrido al eje de una calle OSM */
export const ROAD_TOL_M = 20;
/** tramo seguido fuera de calle a partir del cual la variante es sospechosa */
export const OFFROAD_RUN_ERR_M = 60;
/** una parada a más de esto del recorrido está mal situada */
export const STOP_TOL_M = 40;
/** capçaleres: el recorregut publicat pot acabar al punt de regulació */
export const TERMINAL_TOL_M = 100;

type XY = [number, number];

/** Índice espacial en rejilla de segmentos (coordenadas métricas locales). */
export class SegmentGrid {
  private cells = new Map<string, number[]>();
  private segs: [number, number, number, number][] = [];
  constructor(
    private readonly kx: number,
    private readonly ky: number,
    private readonly cell = 60,
  ) {}
  xy(p: LonLat): XY {
    return [p[0] * this.kx, p[1] * this.ky];
  }
  add(a: LonLat, b: LonLat) {
    const [ax, ay] = this.xy(a);
    const [bx, by] = this.xy(b);
    const i = this.segs.push([ax, ay, bx, by]) - 1;
    const c = this.cell;
    const x0 = Math.floor(Math.min(ax, bx) / c);
    const x1 = Math.floor(Math.max(ax, bx) / c);
    const y0 = Math.floor(Math.min(ay, by) / c);
    const y1 = Math.floor(Math.max(ay, by) / c);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = `${x},${y}`;
        const arr = this.cells.get(k);
        if (arr) arr.push(i);
        else this.cells.set(k, [i]);
      }
  }
  /** distancia (m) al segmento más cercano, buscando en un radio de una celda */
  dist(p: LonLat): number {
    const [px, py] = this.xy(p);
    const cx = Math.floor(px / this.cell);
    const cy = Math.floor(py / this.cell);
    let best = Infinity;
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (const i of this.cells.get(`${x},${y}`) ?? []) {
          const [ax, ay, bx, by] = this.segs[i]!;
          const dx = bx - ax;
          const dy = by - ay;
          const l2 = dx * dx + dy * dy;
          const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
          best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
        }
      }
    return best;
  }
}

export function gridFor(lat0: number, cell = 60) {
  return new SegmentGrid(Math.cos((lat0 * Math.PI) / 180) * 111320, 110540, cell);
}

/** Muestras cada `step` m a lo largo del recorrido entre la primera y la última parada. */
export function samples(p: Pattern, step = 10): { d: number; at: LonLat }[] {
  const out: { d: number; at: LonLat }[] = [];
  const a = p.stopDist[0] ?? 0;
  const b = p.stopDist[p.stopDist.length - 1] ?? p.length;
  for (let d = a; d <= b; d += step) out.push({ d, at: pointAlong(p.coords, p.cum, d) });
  return out;
}

export interface OffroadResult {
  onRoadPct: number;
  longestOffM: number;
  offAt: LonLat | null;
}

export function offroad(p: Pattern, roads: SegmentGrid, tol = ROAD_TOL_M, step = 10): OffroadResult {
  const ss = samples(p, step);
  let on = 0;
  let run = 0;
  let longest = 0;
  let offAt: LonLat | null = null;
  let runStart: LonLat | null = null;
  for (const s of ss) {
    if (roads.dist(s.at) <= tol) {
      on++;
      run = 0;
      runStart = null;
    } else {
      run += step;
      runStart ??= s.at;
      if (run > longest) {
        longest = run;
        offAt = runStart;
      }
    }
  }
  return { onRoadPct: ss.length ? (100 * on) / ss.length : 0, longestOffM: longest, offAt };
}

/** Distancia (m) de cada parada al punto del recorrido donde la sitúa stopDist. */
export function stopOffsets(p: Pattern, net: NetworkData): number[] {
  const stops = new Map(net.stops.map((s) => [s.id, s]));
  return p.stopIds.map((id, i) => {
    const s = stops.get(id);
    if (!s) return Infinity;
    return haversine([s.lon, s.lat], pointAlong(p.coords, p.cum, p.stopDist[i]!));
  });
}

export interface AuditRow {
  route: string;
  pattern: string;
  dayType: string;
  dir: 0 | 1;
  circular: boolean;
  name: string;
  origin: string;
  headsign: string;
  firstStop: string;
  lastStop: string;
  stops: number;
  lengthKm: number;
  trips: number;
  onRoadPct: number;
  longestOffM: number;
  stopMaxOffM: number;
  stopsOrdered: boolean;
  osmRel: number | null;
  osmMeanM: number | null;
  osmP95M: number | null;
  status: 'ok' | 'avís' | 'error';
  problems: string[];
}

export function loadRoads(lat0: number): SegmentGrid | null {
  const dir = join(RAW, 'osm');
  const f = readdirSync(dir)
    .filter((x) => /^roads-.*\.json$/.test(x))
    .sort()
    .pop();
  if (!f) return null;
  const els = (JSON.parse(readFileSync(join(dir, f), 'utf8')) as { elements: { geometry?: { lat: number; lon: number }[] }[] }).elements;
  const g = gridFor(lat0);
  for (const e of els) {
    const geo = e.geometry ?? [];
    for (let i = 0; i < geo.length - 1; i++) g.add([geo[i]!.lon, geo[i]!.lat], [geo[i + 1]!.lon, geo[i + 1]!.lat]);
  }
  return g;
}

function loadOsmRoutes(): Map<string, { rel: number; coords: LonLat[] }[]> {
  const out = new Map<string, { rel: number; coords: LonLat[] }[]>();
  const f = join(RAW, 'osm/tus-full-2026-10-06.json');
  if (!existsSync(f)) return out;
  const els = (JSON.parse(readFileSync(f, 'utf8')) as { elements: OsmElement[] }).elements;
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  const rels: OsmRel[] = [];
  for (const e of els) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
    else if (e.tags?.type === 'route') rels.push(e);
  }
  for (const r of rels) {
    const st = stitchRelation(r, ways, nodes);
    if (st.coords.length < 2 || st.broken) continue;
    const ref = r.tags.ref ?? '';
    out.set(ref, [...(out.get(ref) ?? []), { rel: r.id, coords: st.coords }]);
  }
  return out;
}

export function audit(net: NetworkData) {
  const lat0 = net.stops[0]?.lat ?? 41.55;
  const roads = loadRoads(lat0);
  const osm = loadOsmRoutes();
  const stops = new Map(net.stops.map((s) => [s.id, s]));
  const rows: AuditRow[] = [];
  for (const p of net.patterns) {
    const problems: string[] = [];
    let status: AuditRow['status'] = 'ok';
    const warn = (m: string) => {
      problems.push(m);
      if (status === 'ok') status = 'avís';
    };
    const fail = (m: string) => {
      problems.push(m);
      status = 'error';
    };
    const or = roads ? offroad(p, roads) : { onRoadPct: NaN, longestOffM: 0, offAt: null };
    if (or.longestOffM > OFFROAD_RUN_ERR_M)
      fail(`${or.longestOffM} m seguits fora de carrer prop de ${or.offAt?.map((x) => x.toFixed(5)).join(',')}`);
    else if (or.longestOffM > 30) warn(`${or.longestOffM} m fora de l'eix del carrer`);
    const so = stopOffsets(p, net);
    const maxOff = Math.max(...so);
    so.forEach((d, i) => {
      const name = stops.get(p.stopIds[i]!)?.name ?? p.stopIds[i];
      // a una capçalera el recorregut publicat pot acabar al punt de regulació, a pocs metres del pal
      const terminal = i === 0 || i === so.length - 1;
      if (terminal && d > STOP_TOL_M && d <= TERMINAL_TOL_M) warn(`capçalera ${name} a ${Math.round(d)} m de l'extrem del recorregut publicat (punt de regulació)`);
      else if (d > STOP_TOL_M) fail(`parada ${name} a ${Math.round(d)} m del recorregut`);
    });
    const ordered = p.stopDist.every((d, i) => i === 0 || d > p.stopDist[i - 1]!);
    if (!ordered) fail('parades no ordenades sobre el recorregut');
    if (new Set(p.stopIds).size !== p.stopIds.length && !p.circular) warn('parada repetida en una variant no circular');
    let best: { rel: number; mean: number; p95: number } | null = null;
    for (const c of osm.get(p.routeId) ?? []) {
      const dev = lineDeviation(p.coords, c.coords);
      if (!best || dev.mean < best.mean) best = { rel: c.rel, ...dev };
    }
    rows.push({
      route: p.routeId,
      pattern: p.id,
      dayType: p.dayType,
      dir: p.dir,
      circular: p.circular,
      name: p.name,
      origin: p.origin,
      headsign: p.headsign,
      firstStop: stops.get(p.stopIds[0]!)?.name ?? '?',
      lastStop: stops.get(p.stopIds[p.stopIds.length - 1]!)?.name ?? '?',
      stops: p.stopIds.length,
      lengthKm: Math.round(p.length / 100) / 10,
      trips: p.trips.length,
      onRoadPct: Math.round(or.onRoadPct * 10) / 10,
      longestOffM: or.longestOffM,
      stopMaxOffM: Math.round(maxOff),
      stopsOrdered: ordered,
      osmRel: best?.rel ?? null,
      osmMeanM: best ? Math.round(best.mean) : null,
      osmP95M: best ? Math.round(best.p95) : null,
      status,
      problems,
    });
  }
  // sentidos: cada línea no circular que circula un tipo de día debe tener los dos
  const lineNotes: string[] = [];
  for (const r of net.routes) {
    for (const dt of ['feiner', 'dissabte', 'festiu'] as const) {
      const ps = rows.filter((x) => x.route === r.id && x.dayType === dt && x.trips > 0);
      if (!ps.length) continue;
      const circ = ps.every((x) => x.circular);
      const dirs = new Set(ps.map((x) => x.dir));
      if (!circ && dirs.size < 2) lineNotes.push(`${r.id} (${dt}): només hi ha el sentit ${[...dirs].join('')}`);
      // las cabeceras de los dos sentidos principales deben coincidir (± 400 m)
      const main = (d: 0 | 1) => ps.filter((x) => x.dir === d).sort((a, b) => b.trips - a.trips)[0];
      const a = main(0);
      const b = main(1);
      if (a && b) {
        const pa = net.patterns.find((x) => x.id === a.pattern)!;
        const pb = net.patterns.find((x) => x.id === b.pattern)!;
        const ll = (id: string): LonLat => [stops.get(id)!.lon, stops.get(id)!.lat];
        const d1 = haversine(ll(pa.stopIds[pa.stopIds.length - 1]!), ll(pb.stopIds[0]!));
        const d2 = haversine(ll(pb.stopIds[pb.stopIds.length - 1]!), ll(pa.stopIds[0]!));
        if (d1 > 400 || d2 > 400)
          lineNotes.push(`${r.id} (${dt}): les capçaleres dels dos sentits no coincideixen (${Math.round(d1)} m / ${Math.round(d2)} m)`);
      }
    }
  }
  return { rows, lineNotes };
}

/** Tramos compartidos: km del recorrido principal de cada línea que coinciden con otra (± 8 m). */
export function sharedTrunks(net: NetworkData, dayType = 'feiner') {
  const lat0 = net.stops[0]?.lat ?? 41.55;
  const byRoute = new Map<string, Pattern[]>();
  for (const p of net.patterns)
    if (p.dayType === dayType && p.trips.length) byRoute.set(p.routeId, [...(byRoute.get(p.routeId) ?? []), p]);
  const grids = new Map<string, SegmentGrid>();
  for (const [r, ps] of byRoute) {
    const g = gridFor(lat0, 40);
    for (const p of ps) for (let i = 0; i < p.coords.length - 1; i++) g.add(p.coords[i]!, p.coords[i + 1]!);
    grids.set(r, g);
  }
  const out: { a: string; b: string; km: number }[] = [];
  const routes = [...byRoute.keys()];
  for (const a of routes) {
    const main = [...byRoute.get(a)!].sort((x, y) => y.trips.length - x.trips.length)[0]!;
    const ss = samples(main, 20);
    for (const b of routes) {
      if (a === b) continue;
      const g = grids.get(b)!;
      const n = ss.filter((s) => g.dist(s.at) <= 8).length;
      if (n * 20 >= 500) out.push({ a, b, km: Math.round((n * 20) / 100) / 10 });
    }
  }
  return out.sort((x, y) => y.km - x.km);
}

const DIR_LABEL = (r: AuditRow) => (r.circular ? 'circular' : r.dir === 0 ? 'anada' : 'tornada');

function render(net: NetworkData, res: ReturnType<typeof audit>, shared: ReturnType<typeof sharedTrunks>): string {
  const L: string[] = [];
  const rows = res.rows;
  const err = rows.filter((r) => r.status === 'error');
  const warnN = rows.filter((r) => r.status === 'avís');
  L.push('# Auditoria línia per línia', '');
  L.push(`Generat per \`pnpm data:audit\` sobre la versió de dades \`${net.version}\`. No editar a mà.`, '');
  L.push('Per a cada variant (recorregut publicat per tus.es) es comprova, amb fonts independents:', '');
  L.push(
    `- **Carrer**: el recorregut, mostrejat cada 10 m, ha d'anar per l'eix d'un carrer d'OpenStreetMap (≤ ${ROAD_TOL_M} m). Error si hi ha més de ${OFFROAD_RUN_ERR_M} m seguits fora de carrer.`,
  );
  L.push(`- **Parades**: cada parada ha de quedar a ≤ ${STOP_TOL_M} m del punt del recorregut on la situem, i en ordre estrictament creixent.`);
  L.push("- **OSM**: desviació respecte de la relació de ruta d'OSM de la mateixa línia, quan n'hi ha (OSM només en té 13 de 23).");
  L.push('- **Sentits i capçaleres**: les línies no circulars tenen els dos sentits i les capçaleres coincideixen (± 400 m).', '');
  L.push(`Resultat: **${rows.length} variants**: ${rows.length - err.length - warnN.length} ok, ${warnN.length} amb avís, ${err.length} amb error.`, '');
  L.push('## Observacions de línia', '');
  if (!res.lineNotes.length) L.push('- Cap: totes les línies no circulars tenen els dos sentits i capçaleres coherents.');
  for (const n of res.lineNotes) L.push(`- ${n}`);
  L.push('', '## Variants', '');
  L.push('| Línia | Dia | Sentit | Capçalera origen (1a parada) | Destí (última parada) | Parades | km | Exp. | Al carrer | Parada més lluny | OSM mitjana / p95 | Estat | Problemes |');
  L.push('|---|---|---|---|---|---:|---:|---:|---:|---:|---|---|---|');
  for (const r of rows) {
    const osm = r.osmMeanM === null ? '—' : `${r.osmMeanM} / ${r.osmP95M} m`;
    L.push(
      `| ${r.route} | ${r.dayType} | ${DIR_LABEL(r)} | ${r.origin} (${r.firstStop}) | ${r.headsign} (${r.lastStop}) | ${r.stops} | ${r.lengthKm} | ${r.trips} | ${r.onRoadPct}% | ${r.stopMaxOffM} m | ${osm} | ${r.status} | ${r.problems.join('; ') || '—'} |`,
    );
  }
  L.push('', '## Trams compartits (feiners, ≥ 0,5 km)', '');
  L.push('Km del recorregut principal de la primera línia que coincideixen (± 8 m) amb qualsevol variant de la segona. Al mapa, la línia seleccionada es dibuixa per sobre de les altres.', '');
  L.push('| Línia | Comparteix amb | km |', '|---|---|---:|');
  for (const s of shared.slice(0, 40)) L.push(`| ${s.a} | ${s.b} | ${s.km} |`);
  L.push('');
  return L.join('\n');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const net = JSON.parse(readFileSync(join(ROOT, 'apps/web/public/data/network.json'), 'utf8')) as NetworkData;
  const res = audit(net);
  const shared = sharedTrunks(net);
  writeFileSync(join(ROOT, 'docs/LINE_AUDIT.md'), render(net, res, shared));
  writeFileSync(join(ROOT, 'dist/line-audit.json'), JSON.stringify(res, null, 1));
  const err = res.rows.filter((r) => r.status === 'error');
  const bad = err.filter((r) => r.trips > 0);
  console.log(`auditoria: ${res.rows.length} variants · ${err.length} error · ${res.rows.filter((r) => r.status === 'avís').length} avís`);
  for (const r of err) console.log(`  ✗ ${r.route} ${r.pattern} (${r.dayType}, ${r.trips} exp.): ${r.problems.join('; ')}`);
  for (const r of res.rows.filter((x) => x.status === 'avís')) console.log(`  ! ${r.route} ${r.pattern} (${r.dayType}): ${r.problems.join('; ')}`);
  for (const n of res.lineNotes) console.log(`  · ${n}`);
  if (bad.length) process.exit(1);
}
