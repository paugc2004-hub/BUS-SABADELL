/** Lectura de los extractos de tus.es (data/raw/tus/<fecha>/<línea>.json). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TusStop {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  orden: string;
  lineas: string;
  fechaincidencia: string;
  msgincidencia: string;
  tiempos: string[];
}

export interface TusTrayecto {
  id: string;
  name: string;
  id_linea: string;
  coords: { Latitude: string; Longitude: string }[];
  stops: TusStop[];
}

export interface TusLineFile {
  line: string; // "1", "44", "F3"
  colour: string | undefined;
  source: string;
  fetched: string;
  trayectos: TusTrayecto[];
}

/** Orden oficial de la portada de tus.es. */
export const OFFICIAL_ORDER = [
  '1', '2', '3', '4', '44', '5', '55', '7', '8', '10', '11', '12', '14', '15', '23', '80',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F15',
];

export function latestSnapshotDir(root: string): string {
  const dirs = readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const last = dirs[dirs.length - 1];
  if (!last) throw new Error(`No hi ha cap extracte de tus.es a ${root}. Executa "pnpm data:refresh".`);
  return join(root, last);
}

export function readTusLines(dir: string): TusLineFile[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  const lines = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as TusLineFile);
  return lines.sort((a, b) => OFFICIAL_ORDER.indexOf(a.line) - OFFICIAL_ORDER.indexOf(b.line));
}

/** Extrae `var trayectos = [...]` del HTML público de una línea. */
export function extractTrayectos(html: string): TusTrayecto[] | null {
  const start = html.indexOf('var trayectos = ');
  if (start < 0) return null;
  const j = start + 'var trayectos = '.length;
  let depth = 0;
  let inStr = false;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (c === '\\') k++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(j, k + 1)) as TusTrayecto[];
    }
  }
  return null;
}

export function extractColour(html: string): string | undefined {
  return /\.paradas li:before \{ background: (#[0-9a-fA-F]{6})/.exec(html)?.[1];
}

export function routeIdOf(line: string): string {
  return /^F/.test(line) ? line : `L${line}`;
}

/** Tipo de día a partir del nombre del trayecto. */
export function dayTypeOf(line: string, name: string): 'feiner' | 'dissabte' | 'festiu' | null {
  if (/^F/.test(line)) return 'festiu';
  if (/\(fn\)\s*$/i.test(name)) return 'feiner';
  if (/\(ds\)\s*$/i.test(name)) return 'dissabte';
  return null;
}

export function cleanName(name: string): string {
  return name.replace(/\((fn|ds)\)\s*$/i, '').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
}

/** "Can Deu - Estació Sud" → { origin, headsign } */
export function endpoints(name: string): { origin: string; headsign: string } {
  const parts = cleanName(name).split(/\s+-\s*|\s*-\s+/).map((p) => p.trim()).filter(Boolean);
  return { origin: parts[0] ?? name, headsign: parts[parts.length - 1] ?? name };
}
