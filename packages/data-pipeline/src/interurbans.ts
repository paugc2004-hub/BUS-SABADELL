/**
 * Capa de interurbanos a partir del GTFS de la Generalitat. Se queda solo con
 * paradas de Sabadell y Sant Quirze (más un margen) y las líneas que las usan.
 * Solo horario teórico.
 *
 * Trampas: el GTFS viene en Latin-1 (no UTF-8) y algunos ficheros con BOM.
 * El ZIP (26 MB) no se versiona; el extracto filtrado sí
 * (data/raw/gtfs/interurbans-sabadell.json), así el build funciona sin él.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const BBOX = { minLon: 2.045, minLat: 41.505, maxLon: 2.175, maxLat: 41.605 };
const CLIP_MARGIN = 0.012; // ~1 km fuera del área para que las líneas no acaben en seco

export interface InterurbanData {
  source: { name: string; url: string; fetched: string; license: string };
  routes: { id: string; ref: string; name: string; agency: string }[];
  stops: { id: string; name: string; lat: number; lon: number; routes: string[] }[];
  shapes: { routeId: string; dir: number; headsign: string; coords: [number, number][] }[];
  /** servicios: fechas activas (YYYYMMDD) en la ventana del extracto */
  services: Record<string, string[]>;
  /** por parada: [routeId, serviceId, segundos, headsign][] */
  times: Record<string, [string, string, number, string][]>;
  window: { from: string; to: string };
}

function decodeLatin1(u8: Uint8Array): string {
  let s = new TextDecoder('windows-1252').decode(u8);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  // si el fichero en realidad venía en UTF-8, se nota por secuencias "Ã"
  const mojibake = new RegExp(`${String.fromCharCode(0xc3)}[${String.fromCharCode(0x80)}-${String.fromCharCode(0xbf)}]`);
  if (mojibake.test(s.slice(0, 20000))) {
    s = new TextDecoder('utf-8').decode(u8);
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  }
  return s;
}

/** Parser CSV mínimo con comillas. */
function* rows(text: string): Generator<string[]> {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const row: string[] = [];
    let field = '';
    let q = false;
    for (; i < n; i++) {
      const c = text[i]!;
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++;
        break;
      } else field += c;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') yield row;
  }
}

function table(text: string) {
  const it = rows(text);
  const head = it.next().value as string[];
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  return { idx, it };
}

const inBox = (lon: number, lat: number, m = 0) =>
  lon >= BBOX.minLon - m && lon <= BBOX.maxLon + m && lat >= BBOX.minLat - m && lat <= BBOX.maxLat + m;

export async function buildInterurbans(raw: string, out: string): Promise<{ summary: string; warning?: string }> {
  const zipPath = join(raw, 'gtfs', 'busos-interurbans-GTFS.zip');
  const extract = join(raw, 'gtfs', 'interurbans-sabadell.json');
  if (!existsSync(zipPath)) {
    if (!existsSync(extract)) return { summary: 'No disponible (ni ZIP ni extracte).', warning: 'Capa interurbans sense dades' };
    const data = JSON.parse(readFileSync(extract, 'utf8')) as InterurbanData;
    writeFileSync(out, JSON.stringify(data));
    return { summary: summarize(data, 'extracte versionat') };
  }
  const files = unzipSync(readFileSync(zipPath), {
    filter: (f) => ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt', 'shapes.txt', 'agency.txt'].includes(f.name),
  });
  const get = (n: string) => decodeLatin1(files[n]!);

  // paradas del área
  const stops = new Map<string, { id: string; name: string; lat: number; lon: number; routes: Set<string> }>();
  {
    const { idx, it } = table(get('stops.txt'));
    for (const r of it) {
      const lat = Number(r[idx.stop_lat!]);
      const lon = Number(r[idx.stop_lon!]);
      if (inBox(lon, lat)) stops.set(r[idx.stop_id!]!, { id: r[idx.stop_id!]!, name: r[idx.stop_name!]!.trim(), lat, lon, routes: new Set() });
    }
  }
  // trips que tocan el área
  const tripStops = new Map<string, { stop: string; seq: number; time: number }[]>();
  {
    const { idx, it } = table(get('stop_times.txt'));
    for (const r of it) {
      const sid = r[idx.stop_id!]!;
      if (!stops.has(sid)) continue;
      const tid = r[idx.trip_id!]!;
      const t = (r[idx.departure_time!] || r[idx.arrival_time!] || '').trim();
      const m = /^(\d+):(\d+):(\d+)$/.exec(t);
      const arr = tripStops.get(tid) ?? [];
      arr.push({ stop: sid, seq: Number(r[idx.stop_sequence!]), time: m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : -1 });
      tripStops.set(tid, arr);
    }
  }
  const trips = new Map<string, { route: string; service: string; headsign: string; dir: number; shape: string }>();
  {
    const { idx, it } = table(get('trips.txt'));
    for (const r of it) {
      const tid = r[idx.trip_id!]!;
      if (!tripStops.has(tid)) continue;
      trips.set(tid, {
        route: r[idx.route_id!]!,
        service: r[idx.service_id!]!,
        headsign: (r[idx.trip_headsign!] ?? '').trim(),
        dir: Number(r[idx.direction_id!] || 0),
        shape: r[idx.shape_id!] ?? '',
      });
    }
  }
  const agencies = new Map<string, string>();
  {
    const { idx, it } = table(get('agency.txt'));
    for (const r of it) agencies.set(r[idx.agency_id!]!, r[idx.agency_name!]!.trim());
  }
  const routeIds = new Set([...trips.values()].map((t) => t.route));
  const routes: InterurbanData['routes'] = [];
  {
    const { idx, it } = table(get('routes.txt'));
    for (const r of it) {
      const id = r[idx.route_id!]!;
      if (!routeIds.has(id)) continue;
      const long = r[idx.route_long_name!]!.trim();
      const ref = /^\(([^)]+)\)/.exec(long)?.[1] ?? r[idx.route_short_name!]!.trim();
      routes.push({ id, ref, name: long.replace(/^\([^)]+\)\s*/, ''), agency: agencies.get(r[idx.agency_id!]!) ?? '' });
    }
  }
  routes.sort((a, b) => a.ref.localeCompare(b.ref, 'ca', { numeric: true }));

  // ventana de fechas: 120 días desde la fecha del ZIP (determinista)
  const fromD = new Date('2026-10-01T12:00:00Z');
  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const days: { ymd: string; wd: number }[] = [];
  for (let k = 0; k < 120; k++) {
    const d = new Date(fromD.getTime() + k * 86400000);
    days.push({ ymd: ymd(d), wd: (d.getUTCDay() + 6) % 7 });
  }
  const usedServices = new Set([...trips.values()].map((t) => t.service));
  const services: Record<string, Set<string>> = {};
  {
    const { idx, it } = table(get('calendar.txt'));
    const wdCols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const r of it) {
      const sid = r[idx.service_id!]!;
      if (!usedServices.has(sid)) continue;
      const set = (services[sid] = new Set());
      const s = r[idx.start_date!]!;
      const e = r[idx.end_date!]!;
      for (const d of days) if (d.ymd >= s && d.ymd <= e && r[idx[wdCols[d.wd]!]!] === '1') set.add(d.ymd);
    }
  }
  {
    const { idx, it } = table(get('calendar_dates.txt'));
    const inWin = new Set(days.map((d) => d.ymd));
    for (const r of it) {
      const sid = r[idx.service_id!]!;
      if (!usedServices.has(sid)) continue;
      const d = r[idx.date!]!;
      if (!inWin.has(d)) continue;
      const set = (services[sid] ??= new Set());
      if (r[idx.exception_type!] === '1') set.add(d);
      else set.delete(d);
    }
  }

  // tiempos por parada y líneas por parada
  const times: InterurbanData['times'] = {};
  const repr = new Map<string, { tid: string; n: number; dir: number; headsign: string; shape: string }>();
  for (const [tid, sts] of tripStops) {
    const tr = trips.get(tid);
    if (!tr || !services[tr.service]?.size) continue;
    sts.sort((a, b) => a.seq - b.seq);
    for (const s of sts) {
      stops.get(s.stop)!.routes.add(tr.route);
      if (s.time >= 0) (times[s.stop] ??= []).push([tr.route, tr.service, s.time, tr.headsign]);
    }
    const key = `${tr.route}|${tr.dir}`;
    const cur = repr.get(key);
    if (!cur || sts.length > cur.n) repr.set(key, { tid, n: sts.length, dir: tr.dir, headsign: tr.headsign, shape: tr.shape });
  }
  for (const arr of Object.values(times)) arr.sort((a, b) => a[2] - b[2]);

  // geometría de cada línea/sentido, recortada al área
  const wantShapes = new Set([...repr.values()].map((r) => r.shape).filter(Boolean));
  const shapePts = new Map<string, [number, number, number][]>();
  {
    const { idx, it } = table(get('shapes.txt'));
    for (const r of it) {
      const sid = r[idx.shape_id!]!;
      if (!wantShapes.has(sid)) continue;
      const arr = shapePts.get(sid) ?? [];
      arr.push([Number(r[idx.shape_pt_sequence!]), Number(r[idx.shape_pt_lon!]), Number(r[idx.shape_pt_lat!])]);
      shapePts.set(sid, arr);
    }
  }
  const shapes: InterurbanData['shapes'] = [];
  for (const [key, r] of repr) {
    const pts = (shapePts.get(r.shape) ?? []).sort((a, b) => a[0] - b[0]);
    const clipped = pts.filter((p) => inBox(p[1], p[2], CLIP_MARGIN)).map((p) => [Math.round(p[1] * 1e5) / 1e5, Math.round(p[2] * 1e5) / 1e5] as [number, number]);
    // reducir vértices: uno cada ~25 m
    const thin: [number, number][] = [];
    for (const c of clipped) {
      const l = thin[thin.length - 1];
      if (!l || Math.abs(l[0] - c[0]) + Math.abs(l[1] - c[1]) > 0.0003) thin.push(c);
    }
    if (thin.length >= 2) shapes.push({ routeId: key.split('|')[0]!, dir: r.dir, headsign: r.headsign, coords: thin });
  }

  const usedSvc = new Set(Object.values(times).flatMap((a) => a.map((x) => x[1])));
  const data: InterurbanData = {
    source: {
      name: 'Generalitat de Catalunya — GTFS autobusos interurbans',
      url: 'https://territori.gencat.cat/ca/01_departament/12_cartografia_i_toponimia/bases_cartografiques/infraestructures-mobilitat/autobusos-interurbans/',
      fetched: '2026-10-06',
      license: 'Dades obertes de la Generalitat de Catalunya. Cal citar la font.',
    },
    routes: routes.filter((r) => shapes.some((s) => s.routeId === r.id) || [...stops.values()].some((s) => s.routes.has(r.id))),
    stops: [...stops.values()].filter((s) => s.routes.size).map((s) => ({ ...s, routes: [...s.routes].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
    shapes,
    services: Object.fromEntries(Object.entries(services).filter(([k]) => usedSvc.has(k)).map(([k, v]) => [k, [...v].sort()])),
    times,
    window: { from: days[0]!.ymd, to: days[days.length - 1]!.ymd },
  };
  const json = JSON.stringify(data);
  writeFileSync(extract, json);
  writeFileSync(out, json);
  return { summary: summarize(data, 'GTFS complet') };
}

function summarize(d: InterurbanData, from: string): string {
  return `- Font: ${from}. ${d.routes.length} línies, ${d.stops.length} parades dins Sabadell + Sant Quirze, finestra ${d.window.from}–${d.window.to}.`;
}
