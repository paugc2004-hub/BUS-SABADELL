/**
 * GTFS estático propio (dist/gtfs/ y dist/gtfs.zip). Cuando TUS entregue su GTFS
 * oficial, se sustituye esta fuente y el resto del sistema no cambia.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { secondsToHM, type DayType, type NetworkData, type SimEngine } from '@bus/core';

function csv(rows: (string | number)[][]): string {
  return (
    rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n') + '\n'
  );
}

const hms = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.round(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const SERVICE: Record<DayType, string> = { feiner: 'FEINERS', dissabte: 'DISSABTES', festiu: 'FESTIUS' };

export function writeGtfs(n: NetworkData, engine: SimEngine, dir: string): void {
  mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = {};
  files['agency.txt'] = csv([
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang'],
    ['TUS', 'Transports Urbans de Sabadell', 'https://www.tus.es', 'Europe/Madrid', 'ca'],
  ]);
  files['feed_info.txt'] = csv([
    ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date', 'feed_version'],
    ['Bus Sabadell en directe (no oficial)', 'https://www.tus.es', 'ca', '20260101', '20271231', n.version],
  ]);
  files['routes.txt'] = csv([
    ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color', 'route_sort_order'],
    ...n.routes.map((r) => [r.id, 'TUS', r.ref, r.longName, 3, r.color.slice(1).toUpperCase(), r.textColor.slice(1), r.order]),
  ]);
  files['stops.txt'] = csv([
    ['stop_id', 'stop_code', 'stop_name', 'stop_lat', 'stop_lon'],
    ...n.stops.map((s) => [s.id, s.id, s.name, s.lat.toFixed(6), s.lon.toFixed(6)]),
  ]);
  // calendario: feiners L–V, dissabtes S, festius D + excepciones por festivo
  files['calendar.txt'] = csv([
    ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
    ['FEINERS', 1, 1, 1, 1, 1, 0, 0, '20260101', '20271231'],
    ['DISSABTES', 0, 0, 0, 0, 0, 1, 0, '20260101', '20271231'],
    ['FESTIUS', 0, 0, 0, 0, 0, 0, 1, '20260101', '20271231'],
  ]);
  const cd: (string | number)[][] = [['service_id', 'date', 'exception_type']];
  for (const h of n.holidays) {
    const d = new Date(`${h.date}T12:00:00Z`).getUTCDay();
    if (d === 0) continue;
    const ymd = h.date.replace(/-/g, '');
    cd.push([d === 6 ? 'DISSABTES' : 'FEINERS', ymd, 2], ['FESTIUS', ymd, 1]);
  }
  files['calendar_dates.txt'] = csv(cd);

  const shapes: (string | number)[][] = [['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled']];
  for (const p of n.patterns)
    p.coords.forEach((c, i) => shapes.push([p.id, c[1].toFixed(6), c[0].toFixed(6), i + 1, p.cum[i]!.toFixed(1)]));
  files['shapes.txt'] = csv(shapes);

  const trips: (string | number)[][] = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id', 'block_id']];
  const st: (string | number)[][] = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'shape_dist_traveled', 'timepoint']];
  for (const dt of ['feiner', 'dissabte', 'festiu'] as DayType[]) {
    for (const t of engine.tripsOf(dt)) {
      const p = t.pattern.p;
      const tripId = `${p.id}_${SERVICE[dt]}_${secondsToHM(t.dep).replace(':', '')}`;
      trips.push([p.routeId, SERVICE[dt], tripId, p.headsign, p.dir, p.id, t.vehicle.replace(/[^A-Za-z0-9_-]/g, '_')]);
      p.stopIds.forEach((sid, i) => {
        const arr = t.dep + t.offsets[i]!;
        const dep = arr + (t.dwell[i] ?? 0);
        st.push([tripId, hms(arr), hms(Math.max(arr, dep)), sid, i + 1, p.stopDist[i]!.toFixed(1), 0]);
      });
    }
  }
  files['trips.txt'] = csv(trips);
  files['stop_times.txt'] = csv(st);

  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const zip = zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [strToU8(v), { mtime: new Date('2026-01-01T00:00:00Z') }]])),
    { level: 9 },
  );
  writeFileSync(join(dir, '..', 'gtfs.zip'), zip);
}
