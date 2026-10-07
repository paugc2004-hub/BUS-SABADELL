/**
 * Mapa base CLAR i apagat (l'app ciutadana és clara; vegeu docs/APP_UX_STRATEGY.md), amb alternatives (bug 12.4-32):
 *  1. OpenFreeMap "positron" (sense límits d'ús, dades OSM)
 *  2. CARTO Positron
 *  3. Fons sòlid: només les nostres línies i parades (funciona sense connexió)
 */
import type { StyleSpecification } from 'maplibre-gl';

export const BASEMAPS = [
  { id: 'openfreemap', url: 'https://tiles.openfreemap.org/styles/positron', attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
  { id: 'carto', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', attribution: '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
] as const;

/** fons del mapa (també el del contenidor mentre carrega) */
export const MAP_BG = '#eceae4';

export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': MAP_BG } }],
};

async function fetchStyle(url: string, timeoutMs: number): Promise<StyleSpecification> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as StyleSpecification;
  } finally {
    clearTimeout(t);
  }
}

/** Apaga el mapa base perquè les línies de bus siguin les protagonistes: fons càlid, carrers blancs, textos grisos. */
function tone(style: StyleSpecification): StyleSpecification {
  for (const l of style.layers) {
    if (l.type === 'background') l.paint = { ...(l.paint ?? {}), 'background-color': MAP_BG };
    if (l.type === 'symbol' && l.paint) {
      const p = l.paint as Record<string, unknown>;
      if ('text-color' in p) p['text-color'] = '#7b8089';
      if ('text-halo-color' in p) p['text-halo-color'] = '#f6f5f1';
    }
    if (l.type === 'fill' && /building/i.test(l.id)) l.paint = { ...(l.paint ?? {}), 'fill-color': '#e2e0d9' } as typeof l.paint;
    if (l.type === 'fill' && /water/i.test(l.id)) l.paint = { ...(l.paint ?? {}), 'fill-color': '#d5dde3' } as typeof l.paint;
    if (l.type === 'fill' && /park|landcover|landuse|wood|grass/i.test(l.id)) l.paint = { ...(l.paint ?? {}), 'fill-color': '#e3e6dc' } as typeof l.paint;
    // menys soroll: sense icones de POI ni números de portal
    if (l.type === 'symbol' && /poi|housenum|shield/i.test(l.id)) l.layout = { ...(l.layout ?? {}), visibility: 'none' };
  }
  return style;
}

export async function loadBaseStyle(): Promise<{ style: StyleSpecification; id: string; attribution: string; hasGlyphs: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine)
    return { style: FALLBACK_STYLE, id: 'fallback', attribution: '© OpenStreetMap contributors', hasGlyphs: false };
  for (const b of BASEMAPS) {
    try {
      const style = tone(await fetchStyle(b.url, 6000));
      return { style, id: b.id, attribution: b.attribution, hasGlyphs: Boolean(style.glyphs) };
    } catch {
      /* siguiente */
    }
  }
  return { style: FALLBACK_STYLE, id: 'fallback', attribution: '© OpenStreetMap contributors', hasGlyphs: false };
}
