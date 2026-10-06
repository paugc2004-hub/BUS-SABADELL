/**
 * Mapa base oscuro con alternativas (bug 12.4-32):
 *  1. OpenFreeMap "dark" (sin límites de uso, datos OSM)
 *  2. CARTO Dark Matter
 *  3. Fondo sólido: solo nuestras líneas y paradas (funciona sin conexión)
 */
import type { StyleSpecification } from 'maplibre-gl';

export const BASEMAPS = [
  { id: 'openfreemap', url: 'https://tiles.openfreemap.org/styles/dark', attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
  { id: 'carto', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', attribution: '© <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' },
] as const;

export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b0c0f' } }],
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

/** Oscurece y desatura el estilo para que las líneas de bus sean las protagonistas. */
function tone(style: StyleSpecification): StyleSpecification {
  for (const l of style.layers) {
    if (l.type === 'background') l.paint = { ...(l.paint ?? {}), 'background-color': '#0b0c0f' };
    if (l.type === 'symbol' && l.paint) {
      const p = l.paint as Record<string, unknown>;
      if ('text-color' in p) p['text-color'] = '#6b7079';
      if ('text-halo-color' in p) p['text-halo-color'] = '#0b0c0f';
    }
    // calles algo más visibles que en el estilo original, sin competir con las líneas
    if (l.type === 'line' && /road|street|highway|transportation|bridge|tunnel/i.test(l.id) && !/casing|rail/i.test(l.id)) {
      const p = (l.paint ?? {}) as Record<string, unknown>;
      p['line-color'] = /motorway|trunk|primary/i.test(l.id) ? '#2e323a' : '#24272e';
      l.paint = p as typeof l.paint;
    }
    if (l.type === 'fill' && /building/i.test(l.id)) l.paint = { ...(l.paint ?? {}), 'fill-color': '#14161a' } as typeof l.paint;
    // menos ruido: sin iconos de POI ni números de portal
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
