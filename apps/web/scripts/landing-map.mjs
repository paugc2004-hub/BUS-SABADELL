// utilitat local: fragment de mapa (SVG) del voltant de la parada Rambla per a la landing,
// fet amb els recorreguts reals de network.json. Escriu src/views/landingMap.ts.
// node scripts/landing-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const n = JSON.parse(readFileSync(new URL('../public/data/network.json', import.meta.url), 'utf8'));
const center = n.stops.find((s) => s.id === '20'); // Rambla (L1, L2, L3, L11, L80)
const W = 600, H = 600, R = 1100; // metres de mitja amplada
const kx = 111320 * Math.cos((center.lat * Math.PI) / 180), ky = 110540;
const proj = ([lon, lat]) => [W / 2 + ((lon - center.lon) * kx * W) / (2 * R), H / 2 - ((lat - center.lat) * ky * W) / (2 * R)];
const inside = ([x, y]) => x > -60 && x < W + 60 && y > -60 && y < H + 60;
const seen = new Set();
const paths = [];
for (const p of n.patterns) {
  if (p.dayType !== 'feiner' || seen.has(p.routeId)) continue;
  const pts = p.coords.map(proj);
  if (!pts.some(inside)) continue;
  seen.add(p.routeId);
  const runs = [];
  let cur = [];
  for (const q of pts) {
    if (inside(q)) cur.push(q);
    else if (cur.length) (runs.push(cur), (cur = []));
  }
  if (cur.length) runs.push(cur);
  const d = runs.filter((r) => r.length > 1).map((r) => 'M' + r.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join('L')).join('');
  if (d) paths.push({ route: p.routeId, color: n.routes.find((r) => r.id === p.routeId).color, d });
}
// el tram de la L2 que arriba a Rambla: Massagué → Rambla
const l2 = n.patterns.find((p) => p.id === 'L2-20104771');
const toIdx = l2.stopIds.findIndex((x) => x === '20');
const fromIdx = toIdx - 4;
const d0 = l2.stopDist[fromIdx], d1 = l2.stopDist[toIdx];
const run = l2.coords.filter((_, i) => l2.cum[i] >= d0 - 1 && l2.cum[i] <= d1 + 1).map(proj);
const stops = l2.stopIds.slice(fromIdx, toIdx + 1).map((id, k) => {
  const s = n.stops.find((x) => x.id === id);
  const [x, y] = proj([s.lon, s.lat]);
  // fracció del tram (per distància al llarg del recorregut): on és la parada dins L2_RUN
  const f = (l2.stopDist[fromIdx + k] - d0) / (d1 - d0);
  return { id, name: s.name, x: +x.toFixed(0), y: +y.toFixed(0), f: +f.toFixed(3) };
});
const out = `// GENERAT per scripts/landing-map.mjs a partir de public/data/network.json. No editar a mà.
/** Recorreguts reals al voltant de la parada Rambla (fons de la landing). */
export const MAP_W = ${W};
export const MAP_H = ${H};
export const MAP_PATHS: { route: string; color: string; d: string }[] = ${JSON.stringify(paths)};
/** L2 → Creu de Barberà: les darreres parades fins a Rambla */
export const L2_RUN = ${JSON.stringify('M' + run.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join('L'))};
export const L2_STOPS: { id: string; name: string; x: number; y: number; f: number }[] = ${JSON.stringify(stops)};
`;
writeFileSync(new URL('../src/views/landingMap.ts', import.meta.url), out);
console.log(paths.map((p) => p.route).join(','), stops.map((s) => s.name).join(' → '), out.length, 'bytes');
