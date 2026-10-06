/**
 * Descarga de fuentes (solo con --refresh). Respeta a los servidores: una
 * petición por fuente, User-Agent identificable, reintentos con backoff
 * exponencial y nunca en bucle (bug 12.5-42).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractColour, extractTrayectos, OFFICIAL_ORDER } from './tus.ts';

const UA = 'BusSabadellDemo/0.1 (demo no oficial; contacte via el repositori)';

async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  let wait = 2000;
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status} a ${url}`);
      if (i >= tries) throw new Error(`HTTP ${res.status} a ${url} després de ${tries} intents`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((r) => setTimeout(r, wait));
    wait *= 2;
  }
}

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const OVERPASS_QUERY = `[out:json][timeout:180];
(
  relation["network"="Transports Urbans de Sabadell"];
);
out body;
>;
out body qt;`;

export async function refreshAll(raw: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  // tus.es: una página por línea, en serie y con pausa
  const dir = join(raw, 'tus', today);
  mkdirSync(dir, { recursive: true });
  for (const line of OFFICIAL_ORDER) {
    const url = `https://www.tus.es/index.php/ca/informacio-de-les-linies/linea/${line}`;
    const html = await (await fetchWithRetry(url)).text();
    const trayectos = extractTrayectos(html);
    if (!trayectos) throw new Error(`tus.es ha canviat de format: no hi ha "trayectos" a ${url}`);
    writeFileSync(
      join(dir, `${line}.json`),
      JSON.stringify({ line, colour: extractColour(html), source: url, fetched: today, trayectos }),
    );
    console.log(`  tus.es ${line}: ${trayectos.length} trajectes`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  // Overpass: una sola consulta, con servidores alternativos
  mkdirSync(join(raw, 'osm'), { recursive: true });
  for (const url of OVERPASS) {
    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
      }, 2);
      const body = await res.text();
      if (!body.trimStart().startsWith('{')) throw new Error('resposta no JSON');
      writeFileSync(join(raw, 'osm', `tus-full-${today}.json`), body);
      console.log(`  overpass: ${(body.length / 1e6).toFixed(1)} MB de ${url}`);
      break;
    } catch (e) {
      console.warn(`  overpass ${url}: ${(e as Error).message}`);
    }
  }
  // GTFS interurbans
  mkdirSync(join(raw, 'gtfs'), { recursive: true });
  const zip = await fetchWithRetry(
    'https://territori.gencat.cat/web/.content/home/serveis/visors-cartografia/bases-cartografiques/infraestructures-mobilitat/autobusos-interurbans/busos-interurbans-GTFS.zip',
  );
  writeFileSync(join(raw, 'gtfs', 'busos-interurbans-GTFS.zip'), Buffer.from(await zip.arrayBuffer()));
  console.log('  GTFS interurbans descarregat');
}
