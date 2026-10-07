import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as GeoJSON from 'geojson';
import { sliceLine, type DayType, type NetworkData, type SimEngine, type VehicleState } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { vehicleById, vehiclesAt } from '../data/vehicles.ts';
import { areaOf, liveArrivals } from '../data/derive.ts';
import { addBusImages } from './icons.ts';
import { loadBaseStyle } from './style.ts';

const SABADELL: [number, number] = [2.1065, 41.5475];
/** WebGL sin GPU real (SwiftShader, llvmpipe, Microsoft Basic Render): móvil muy modesto o VM. */
export function softwareGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|basic render/i.test(r);
  } catch {
    return false;
  }
}
const LOW_GPU = typeof document !== 'undefined' && softwareGL();

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type FC = GeoJSON.FeatureCollection;
const emptyFC = (): FC => ({ type: 'FeatureCollection', features: [] });
const lineFC = (features: { coords: [number, number][]; props?: Record<string, unknown> }[]): FC => ({
  type: 'FeatureCollection',
  features: features.map((f) => ({ type: 'Feature', properties: f.props ?? {}, geometry: { type: 'LineString', coordinates: f.coords } })),
});
const pointFC = (pts: { at: [number, number]; props?: Record<string, unknown> }[]): FC => ({
  type: 'FeatureCollection',
  features: pts.map((p) => ({ type: 'Feature', properties: p.props ?? {}, geometry: { type: 'Point', coordinates: p.at } })),
});

/** Espai que ocupen els panells: la càmera centra el bus a la part visible del mapa. */
export function mapPadding() {
  const wide = window.innerWidth > 760;
  const st = useApp.getState();
  // hi ha un panell obert (fitxa de bus o parada) que tapa part del mapa?
  const sheet = st.selectedBus !== null || st.view.name === 'stop' || st.view.name === 'route' || (st.view.name === 'line' && st.view.ref !== null);
  // panell esquerre de la vista de base (inici, línies, xarxa, els meus)
  const base = st.view.name === 'stop' || st.view.name === 'route' ? st.base : st.view.name;
  const leftPanel = !st.presenting && (base === 'home' || base === 'line' || base === 'network' || base === 'mine');
  if (wide) return { top: 40, bottom: 40, left: st.presenting ? 480 : leftPanel ? 450 : 40, right: sheet ? 470 : 40 };
  // mòbil: el full de baix tapa una part del mapa; el contingut es centra a la part visible
  const h = window.innerHeight;
  const bottom = sheet ? 0.6 * h : leftPanel ? (base === 'home' ? 0.62 : 0.74) * h : 40;
  return { top: st.presenting ? 170 : 24, bottom: Math.round(bottom), left: 24, right: 24 };
}

/** Líneas del día: patrones del tipo de día actual; las que no circulan, atenuadas. */
function routeFeatures(net: NetworkData, engine: SimEngine, dayType: DayType): FC {
  const features: GeoJSON.Feature[] = [];
  for (const r of net.routes) {
    const runs = engine.runsOn(r.id, dayType);
    let pats = net.patterns.filter((p) => p.routeId === r.id && p.dayType === dayType);
    if (!pats.length) {
      for (const dt of ['feiner', 'dissabte', 'festiu'] as DayType[]) {
        pats = net.patterns.filter((p) => p.routeId === r.id && p.dayType === dt);
        if (pats.length) break;
      }
    }
    // patrón principal de cada sentido = el que más expediciones tiene
    const main = new Set<string>();
    for (const dir of [0, 1]) {
      const best = pats.filter((p) => p.dir === dir).sort((a, b) => b.trips.length - a.trips.length)[0];
      if (best) main.add(best.id);
    }
    for (const p of pats)
      features.push({
        type: 'Feature',
        properties: { route: r.id, ref: r.ref, color: r.color, active: runs ? 1 : 0, main: main.has(p.id) ? 1 : 0, order: r.order },
        geometry: { type: 'LineString', coordinates: p.coords },
      });
  }
  return { type: 'FeatureCollection', features };
}

function stopFeatures(net: NetworkData): FC {
  return {
    type: 'FeatureCollection',
    features: net.stops.map((s) => ({
      type: 'Feature',
      id: Number(s.id) || undefined,
      properties: { id: s.id, name: s.name, routes: s.routes.join(','), n: s.routes.length },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    })),
  };
}

interface BusCtx {
  selected: string | null;
  focus: string | null;
  follow: boolean;
  /** buses que vénen a la parada oberta: es destaquen */
  incoming: Set<string>;
  trip: string | null;
}

/** Separa buses que coinciden en el mismo punto (cabeceras compartidas, bug 12.3-23). */
function busFeatures(vs: VehicleState[], c: BusCtx): FC {
  const buckets = new Map<string, number>();
  const features: GeoJSON.Feature[] = [];
  for (const v of vs) {
    const key = `${v.lon.toFixed(4)},${v.lat.toFixed(4)}`;
    const k = buckets.get(key) ?? 0;
    buckets.set(key, k + 1);
    let lon = v.lon;
    let lat = v.lat;
    if (k > 0 && v.speedKmh === 0) {
      const ang = (k * 2 * Math.PI) / 6;
      lon += Math.cos(ang) * 0.00012 * Math.ceil(k / 6);
      lat += Math.sin(ang) * 0.00009 * Math.ceil(k / 6);
    }
    const sel = v.id === c.selected || v.id === c.trip;
    const highlighted = sel || c.incoming.has(v.id);
    const dim =
      !highlighted &&
      ((c.focus !== null && v.routeId !== c.focus) || (c.follow && c.selected !== null) || (c.incoming.size > 0 && !c.focus));
    features.push({
      type: 'Feature',
      properties: {
        id: v.id,
        route: v.routeId,
        bearing: v.bearing,
        status: v.status,
        img: v.status === 'RETIRADA' ? 'bus-off' : `bus-${v.routeId}`,
        badge: v.status === 'RETRASADO' ? 'badge-delay' : v.status === 'DESVIADO' ? 'badge-detour' : '',
        sel: sel ? 1 : 0,
        hi: highlighted ? 1 : 0,
        dim: dim ? 1 : 0,
        idle: v.status === 'EN_CABECERA' || v.status === 'RETIRADA' ? 1 : 0,
        stop: v.status === 'EN_PARADA' || v.status === 'EN_CABECERA' ? 1 : 0,
        order: sel ? 3 : highlighted ? 2 : dim ? 0 : 1,
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function interFeatures(d: NonNullable<ReturnType<typeof useApp.getState>['interData']>): { lines: FC; stops: FC } {
  return {
    lines: lineFC(d.shapes.map((s) => ({ coords: s.coords, props: { route: s.routeId } }))),
    stops: pointFC(d.stops.map((s) => ({ at: [s.lon, s.lat], props: { id: `gi:${s.id}`, name: s.name } }))),
  };
}

export function MapView({ interactive = true, onReady }: { interactive?: boolean; onReady?: (m: MLMap) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [glyphs, setGlyphs] = useState(false);
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const visibleRoutes = useApp((s) => s.visibleRoutes);
  const interurbans = useApp((s) => s.interurbans);
  const interData = useApp((s) => s.interData);
  const userPos = useApp((s) => s.userPos);
  const flyTo = useApp((s) => s.flyTo);
  const focusRoute = useApp((s) => s.focusRoute);
  const selectedBus = useApp((s) => s.selectedBus);
  const follow = useApp((s) => s.follow);
  const view = useApp((s) => s.view);
  const plan = useApp((s) => s.plan);
  const trip = useApp((s) => s.trip);

  // ---- creación del mapa
  useEffect(() => {
    if (!ref.current || !network || !engine) return;
    let disposed = false;
    let map: MLMap | null = null;
    (async () => {
      const base = await loadBaseStyle();
      if (disposed || !ref.current) return;
      map = new maplibregl.Map({
        container: ref.current,
        style: base.style,
        center: SABADELL,
        zoom: window.innerWidth < 700 ? 12.1 : 12.9,
        minZoom: 10.5,
        maxZoom: 18.5,
        attributionControl: false,
        interactive,
        fadeDuration: 0,
        ...(LOW_GPU ? { pixelRatio: 1, antialias: false } : {}),
        maxBounds: [
          [1.9, 41.44],
          [2.32, 41.66],
        ],
      });
      mapRef.current = map;
      if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map;
      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: base.id === 'fallback' ? `${base.attribution} · Dades: tus.es` : 'Dades de la xarxa: tus.es' }),
        'bottom-right',
      );
      // imágenes del estilo base que no existen (p. ej. "wood-pattern"): transparente, sin ruido en consola
      map.on('styleimagemissing', (e) => {
        if (!map || map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });
      map.on('error', (e) => {
        // las teselas del mapa base pueden fallar sin romper nada: seguimos con nuestras capas
        console.warn('map error', e.error?.message);
      });
      map.on('load', () => {
        if (!map) return;
        addBusImages(map, network.routes);
        const dayType = engine.dayTypeAt(clock.now());
        for (const id of ['routes', 'stops', 'buses', 'inter-lines', 'inter-stops', 'user', 'trip-done', 'trip-todo', 'approach', 'next-stop', 'my-stop', 'plan-walk', 'plan-bus', 'plan-pts'])
          map.addSource(id, { type: 'geojson', data: emptyFC() });
        (map.getSource('routes') as GeoJSONSource).setData(routeFeatures(network, engine, dayType));
        (map.getSource('stops') as GeoJSONSource).setData(stopFeatures(network));

        const zw = (a: number, b: number, c: number) => ['interpolate', ['linear'], ['zoom'], 11, a, 14, b, 17, c] as unknown as number;
        map.addLayer({
          id: 'inter-line',
          type: 'line',
          source: 'inter-lines',
          layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
          paint: { 'line-color': '#5c6370', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 16, 3], 'line-opacity': 0.55, 'line-dasharray': [2, 1.5] },
        });
        map.addLayer({
          id: 'routes-glow',
          type: 'line',
          source: 'routes',
          filter: ['all', ['==', ['get', 'main'], 1], ['==', ['get', 'active'], 1]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 14],
            'line-blur': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 10],
            'line-opacity': 0.1,
          },
        });
        // vora fosca fina sota cada línia: els colors clars (L44 groc, L10, F4…) es veuen sobre el mapa clar
        map.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] },
          paint: { 'line-color': '#0e1116', 'line-width': zw(2.6, 4.4, 7.5), 'line-opacity': ['case', ['==', ['get', 'active'], 1], 0.28, 0.05] },
        });
        map.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] },
          paint: { 'line-color': ['get', 'color'], 'line-width': zw(1.6, 3, 5.5), 'line-opacity': ['case', ['==', ['get', 'active'], 1], 0.92, 0.18] },
        });
        // línea enfocada: encima de todas, más gruesa y con contorno oscuro para el contraste
        map.addLayer({
          id: 'routes-focus-casing',
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'route'], ''],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#08090b', 'line-width': zw(5, 8, 13), 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'routes-focus',
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'route'], ''],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': zw(3, 5, 8.5) },
        });
        map.addLayer({
          id: 'routes-arrows',
          type: 'symbol',
          source: 'routes',
          minzoom: 12.5,
          filter: ['==', ['get', 'route'], ''],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12.5, 70, 16, 110] as unknown as number,
            'icon-image': 'arrow',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12.5, 0.7, 16, 1] as unknown as number,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        });
        // viaje del bus seleccionado: recorrido hecho (gris) y pendiente (color de la línea)
        map.addLayer({
          id: 'trip-done',
          type: 'line',
          source: 'trip-done',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#8a9099', 'line-width': zw(2, 3.5, 5.5), 'line-opacity': 0.7, 'line-dasharray': [1.2, 1.4] },
        });
        map.addLayer({
          id: 'trip-todo-casing',
          type: 'line',
          source: 'trip-todo',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#08090b', 'line-width': zw(6, 9, 14) },
        });
        map.addLayer({
          id: 'trip-todo',
          type: 'line',
          source: 'trip-todo',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': zw(3.5, 6, 9.5) },
        });
        // com hi arribo: trams a peu (puntejats) i en bus (color de la línia), parades i destí
        map.addLayer({
          id: 'plan-walk',
          type: 'line',
          source: 'plan-walk',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3d434c', 'line-width': zw(2.5, 3.5, 5), 'line-dasharray': [0.2, 1.8] },
        });
        map.addLayer({
          id: 'plan-bus-casing',
          type: 'line',
          source: 'plan-bus',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#08090b', 'line-width': zw(7, 10, 15) },
        });
        map.addLayer({
          id: 'plan-bus',
          type: 'line',
          source: 'plan-bus',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': zw(4, 6.5, 10) },
        });
        map.addLayer({
          id: 'plan-pts',
          type: 'circle',
          source: 'plan-pts',
          paint: {
            'circle-radius': ['match', ['get', 'kind'], 'dest', 9, 'from', 7, 5.5],
            'circle-color': ['match', ['get', 'kind'], 'dest', '#ffb224', 'from', '#2563eb', '#ffffff'],
            'circle-stroke-color': '#08090b',
            'circle-stroke-width': ['match', ['get', 'kind'], 'dest', 3, 2.5],
          },
        });
        // buses que vienen a la parada abierta: el tramo que les falta
        map.addLayer({
          id: 'approach',
          type: 'line',
          source: 'approach',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': zw(2.5, 4.5, 7), 'line-opacity': ['case', ['==', ['get', 'first'], 1], 1, 0.7] },
        });
        if (base.hasGlyphs) {
          map.addLayer({
            id: 'routes-label',
            type: 'symbol',
            source: 'routes',
            minzoom: 14.6,
            filter: ['==', ['get', 'main'], 1],
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 420,
              'text-field': ['get', 'ref'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 11,
              'text-keep-upright': true,
            },
            paint: { 'text-color': '#ffffff', 'text-halo-color': ['get', 'color'], 'text-halo-width': 2.6 },
          });
        }
        map.addLayer({
          id: 'inter-stop',
          type: 'circle',
          source: 'inter-stops',
          minzoom: 13.5,
          layout: { visibility: 'none' },
          paint: { 'circle-radius': 3, 'circle-color': '#0b0c0f', 'circle-stroke-color': '#7d8590', 'circle-stroke-width': 1.5 },
        });
        map.addLayer({
          id: 'stops-circle',
          type: 'circle',
          source: 'stops',
          minzoom: 13.2,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.2, 2, 16, 4.5, 18, 6],
            'circle-color': '#f4f4f5',
            'circle-stroke-color': '#0b0c0f',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 2],
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0, 13.8, 1],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0, 13.8, 1],
          },
        });
        if (base.hasGlyphs) {
          map.addLayer({
            id: 'stops-label',
            type: 'symbol',
            source: 'stops',
            minzoom: 15.3,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-offset': [0, 1.1],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: { 'text-color': '#40464f', 'text-halo-color': '#f6f5f1', 'text-halo-width': 1.6 },
          });
        }
        map.addLayer({
          id: 'stop-sel',
          type: 'circle',
          source: 'stops',
          filter: ['==', ['get', 'id'], ''],
          paint: { 'circle-radius': 10, 'circle-color': 'rgba(14,17,22,0.08)', 'circle-stroke-color': '#0e1116', 'circle-stroke-width': 2.5 },
        });
        map.addLayer({
          id: 'next-stop',
          type: 'circle',
          source: 'next-stop',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 9],
            'circle-color': '#08090b',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 4],
          },
        });
        map.addLayer({
          id: 'my-stop',
          type: 'circle',
          source: 'my-stop',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 7, 16, 13],
            'circle-color': 'rgba(255,178,36,0.18)',
            'circle-stroke-color': '#ffb224',
            'circle-stroke-width': 3,
          },
        });
        if (base.hasGlyphs) {
          map.addLayer({
            id: 'my-stop-label',
            type: 'symbol',
            source: 'my-stop',
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Bold'],
              'text-size': 12,
              'text-offset': [0, -1.6],
              'text-anchor': 'bottom',
              'text-allow-overlap': true,
            },
            paint: { 'text-color': '#92400e', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
          });
        }
        // anillo de "aturat a la parada"
        map.addLayer({
          id: 'bus-stopring',
          type: 'circle',
          source: 'buses',
          minzoom: 13.8,
          filter: ['all', ['==', ['get', 'stop'], 1], ['==', ['get', 'dim'], 0]],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 9, 17, 18],
            'circle-color': 'rgba(14,17,22,0.05)',
            'circle-stroke-color': '#0e1116',
            'circle-stroke-opacity': 0.45,
            'circle-stroke-width': 1.5,
          },
        });
        map.addLayer({
          id: 'bus-halo',
          type: 'symbol',
          source: 'buses',
          filter: ['==', ['get', 'sel'], 1],
          layout: { 'icon-image': 'halo', 'icon-size': 1.2, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        });
        map.addLayer({
          id: 'bus-icon',
          type: 'symbol',
          source: 'buses',
          layout: {
            'icon-image': ['get', 'img'],
            'icon-rotate': ['get', 'bearing'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11,
              ['case', ['==', ['get', 'sel'], 1], 0.6, 0.42],
              13,
              ['case', ['==', ['get', 'sel'], 1], 0.75, 0.55],
              15.5,
              ['case', ['==', ['get', 'sel'], 1], 1, 0.78],
              17.5,
              ['case', ['==', ['get', 'sel'], 1], 1.25, 1.05],
            ] as unknown as number,
            'symbol-sort-key': ['get', 'order'],
          },
          paint: { 'icon-opacity': ['case', ['==', ['get', 'dim'], 1], 0.26, ['==', ['get', 'idle'], 1], 0.62, 1] },
        });
        map.addLayer({
          id: 'bus-badge',
          type: 'symbol',
          source: 'buses',
          filter: ['!=', ['get', 'badge'], ''],
          layout: { 'icon-image': ['get', 'badge'], 'icon-offset': [10, -10], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        });
        map.addLayer({
          id: 'bus-label',
          type: 'symbol',
          source: 'buses',
          filter: ['any', ['==', ['get', 'dim'], 0], ['==', ['get', 'hi'], 1]],
          layout: {
            'icon-image': ['concat', 'lbl-', ['get', 'route']],
            'icon-anchor': 'bottom',
            'icon-offset': [0, -15],
            // les etiquetes no se superposen: es col·loquen per prioritat (seleccionat > destacat > resta)
            'icon-allow-overlap': false,
            'icon-ignore-placement': false,
            'icon-padding': 2,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12.4, 0.78, 16, 1] as unknown as number,
            // menor clau = es col·loca abans i guanya la col·lisió
            'symbol-sort-key': ['-', 3, ['get', 'order']],
          },
          paint: {
            // a vista de ciutat, només l'etiqueta dels buses destacats
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, ['case', ['==', ['get', 'hi'], 1], 1, 0], 13, 1] as unknown as number,
          },
        });
        map.addLayer({ id: 'user', type: 'symbol', source: 'user', layout: { 'icon-image': 'user', 'icon-allow-overlap': true } });

        if (interactive) bindInteractions(map);
        setGlyphs(base.hasGlyphs);
        setReady(true);
        onReady?.(map);
      });
    })();
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, engine]);

  // ---- bucle de animación: posiciones desde el reloj absoluto (bugs 12.2-18, 12.4-27)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine || !network) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource;
    let raf = 0;
    let last = 0;
    let dayType = engine.dayTypeAt(clock.now());
    // vuelo de cámara en curso (al empezar a seguir): no se fija el centro hasta que acaba
    let flying = false;
    map.on('movestart', (e) => {
      if ((e as { originalEvent?: unknown }).originalEvent === undefined) flying = true;
    });
    map.on('moveend', () => (flying = false));
    // llegadas de la parada abierta: se recalculan cada 5 s; la geometría, cada tick
    let incomingAt = 0;
    let incoming: { vehicleId: string; patternId: string; stopIndex: number; first: boolean }[] = [];
    let incomingKey = '';
    // frecuencia de actualización según el zoom: a vista de ciudad un bus se mueve
    // menos de 1 px en medio segundo, así que 2 Hz es visualmente idéntico a 60 Hz
    let degraded = LOW_GPU;
    if (LOW_GPU && map.getLayer('routes-glow')) map.setLayoutProperty('routes-glow', 'visibility', 'none');
    const intervalFor = () => {
      if (prefersReducedMotion()) return 1000;
      const st = useApp.getState();
      // siguiendo un bus: cada fotograma, la cámara va pegada al vehículo
      if (st.follow && st.selectedBus && !LOW_GPU) return 0;
      const z = map.getZoom();
      const base = z < 13 ? 500 : z < 14.5 ? 250 : z < 16 ? 110 : 66;
      const speed = Math.max(1, clock.getSpeed());
      return Math.max(LOW_GPU ? 1000 : degraded ? 200 : 40, base / Math.sqrt(speed));
    };
    let interval = intervalFor();
    map.on('zoomend', () => (interval = intervalFor()));
    const unsub = useApp.subscribe((s, p) => {
      if (s.follow !== p.follow || s.selectedBus !== p.selectedBus) {
        interval = intervalFor();
        last = 0;
      }
    });
    // degradación automática si el dispositivo va justo (bug 12.4-34)
    let slowFrames = 0;
    let prevFrame = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - prevFrame;
      prevFrame = now;
      if (dt > 40 && dt < 500) slowFrames++;
      else if (slowFrames > 0) slowFrames -= 0.25;
      if (slowFrames > 90 && !degraded) {
        degraded = true;
        interval = intervalFor();
        if (map.getLayer('routes-glow')) map.setLayoutProperty('routes-glow', 'visibility', 'none');
      }
      if (now - last < interval || document.hidden) return;
      last = now;
      const t = clock.now();
      const st = useApp.getState();
      const vs = vehiclesAt(engine, t);
      const byId = new Map(vs.map((v) => [v.id, v]));
      const sel = st.selectedBus ? byId.get(st.selectedBus) ?? null : null;
      const tripBus = st.trip ? byId.get(st.trip.vehicleId) ?? null : null;
      const focus = st.focusRoute ?? sel?.routeId ?? null;

      // parada abierta: buses que vienen y tramo que les falta
      const stopId = st.view.name === 'stop' && !st.view.id.startsWith('gi:') ? st.view.id : null;
      const key = stopId ?? '';
      if (stopId && (now - incomingAt > 5000 || key !== incomingKey)) {
        incomingAt = now;
        incomingKey = key;
        const seen = new Set<string>();
        incoming = liveArrivals(engine, areaOf(engine, stopId), t, 45, 30)
          .filter((a) => a.vehicle && a.vehicle.patternId === a.patternId && a.stopsAway !== null && a.stopsAway >= 0)
          .filter((a) => (seen.has(a.vehicleId!) ? false : (seen.add(a.vehicleId!), true)))
          .slice(0, 6)
          .map((a, i) => ({ vehicleId: a.vehicleId!, patternId: a.patternId, stopIndex: a.stopIndex, first: i === 0 }));
      } else if (!stopId) incoming = [];
      const incomingIds = new Set(incoming.map((x) => x.vehicleId));

      src('buses').setData(busFeatures(vs, { selected: st.selectedBus, focus, follow: st.follow, incoming: incomingIds, trip: st.trip?.vehicleId ?? null }));

      src('approach').setData(
        lineFC(
          incoming.flatMap((x) => {
            const v = byId.get(x.vehicleId);
            const p = engine.patternById(x.patternId);
            if (!v || !p || !(st.selectedBus === null || st.selectedBus === v.id)) return [];
            const end = p.stopDist[x.stopIndex] ?? v.dist;
            if (end <= v.dist) return [];
            return [{ coords: sliceLine(p.coords, p.cum, v.dist, end), props: { color: engine.routes.get(v.routeId)?.color ?? '#fff', first: x.first ? 1 : 0 } }];
          }),
        ),
      );

      // viaje del bus seleccionado (o del viaje activo)
      const tv = sel ?? tripBus;
      if (tv) {
        const p = engine.patternById(tv.patternId)!;
        const color = engine.routes.get(tv.routeId)?.color ?? '#fff';
        const a = p.stopDist[0] ?? 0;
        const b = p.stopDist[p.stopDist.length - 1] ?? p.length;
        src('trip-done').setData(tv.dist > a + 1 ? lineFC([{ coords: sliceLine(p.coords, p.cum, a, tv.dist) }]) : emptyFC());
        src('trip-todo').setData(tv.status !== 'RETIRADA' ? lineFC([{ coords: sliceLine(p.coords, p.cum, tv.dist, b), props: { color } }]) : emptyFC());
        const ns = tv.nextStopId ? engine.stops.get(tv.nextStopId) : null;
        src('next-stop').setData(ns && tv.status !== 'RETIRADA' ? pointFC([{ at: [ns.lon, ns.lat], props: { color } }]) : emptyFC());
      } else {
        src('trip-done').setData(emptyFC());
        src('trip-todo').setData(emptyFC());
        src('next-stop').setData(emptyFC());
      }
      const ms = st.trip ? engine.stops.get(st.trip.boardStopId) : null;
      const alight = st.trip && st.trip.alightIndex !== null ? engine.patternById(st.trip.patternId)?.stopIds[st.trip.alightIndex] : null;
      const as = alight ? engine.stops.get(alight) : null;
      const lang = st.lang;
      src('my-stop').setData(
        pointFC([
          ...(ms ? [{ at: [ms.lon, ms.lat] as [number, number], props: { label: lang === 'ca' ? 'Puges aquí' : 'Subes aquí' } }] : []),
          ...(as ? [{ at: [as.lon, as.lat] as [number, number], props: { label: lang === 'ca' ? 'Baixes aquí' : 'Bajas aquí' } }] : []),
        ]),
      );

      const dtNow = engine.dayTypeAt(t);
      if (dtNow !== dayType) {
        dayType = dtNow;
        src('routes').setData(routeFeatures(network, engine, dayType));
      }
      // seguimiento: la cámara va pegada al bus en cada fotograma (sin tirones)
      if (st.follow && sel && !flying) {
        if (LOW_GPU) map.easeTo({ center: [sel.lon, sel.lat], duration: 900, easing: (x) => x, padding: mapPadding() });
        else map.jumpTo({ center: [sel.lon, sel.lat], padding: mapPadding() });
      }
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => {
      // al volver de segundo plano se recalcula todo desde el reloj; nada acumulado
      last = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, engine, network]);

  // ---- al empezar a seguir: vuelo hasta el bus y luego la cámara queda pegada
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine || !follow || !selectedBus) return;
    const v = vehiclesAt(engine, clock.now()).find((x) => x.id === selectedBus);
    if (!v) return;
    const zoom = Math.max(map.getZoom(), 15.6);
    if (prefersReducedMotion()) map.jumpTo({ center: [v.lon, v.lat], zoom, padding: mapPadding() });
    else map.flyTo({ center: [v.lon, v.lat], zoom, duration: 1100, essential: true, padding: mapPadding() });
  }, [ready, engine, follow, selectedBus]);

  // ---- línea enfocada (selección de línea o línea del bus seleccionado)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine) return;
    const focus = focusRoute ?? (selectedBus ? vehicleById(engine, selectedBus, clock.now())?.routeId ?? null : null);
    const f = (id: string) => ['==', ['get', 'route'], id] as maplibregl.FilterSpecification;
    if (plan && !selectedBus) {
      // amb una ruta de «com hi arribo» a la vista: tota la xarxa atenuada perquè la ruta destaqui
      for (const id of ['routes-focus', 'routes-focus-casing', 'routes-arrows']) map.setFilter(id, f(''));
      map.setPaintProperty('routes-line', 'line-opacity', 0.12);
      map.setPaintProperty('routes-casing', 'line-opacity', 0.03);
      map.setPaintProperty('routes-glow', 'line-opacity', 0);
      if (glyphs && map.getLayer('routes-label')) map.setFilter('routes-label', f(''));
      return;
    }
    map.setFilter('routes-focus', f(focus ?? ''));
    map.setFilter('routes-focus-casing', f(focus ?? ''));
    map.setFilter('routes-arrows', f(focus ?? ''));
    map.setPaintProperty(
      'routes-line',
      'line-opacity',
      focus ? ['case', ['==', ['get', 'route'], focus], 0, 0.14] : ['case', ['==', ['get', 'active'], 1], 0.92, 0.18],
    );
    map.setPaintProperty('routes-casing', 'line-opacity', focus ? 0.03 : ['case', ['==', ['get', 'active'], 1], 0.28, 0.05]);
    map.setPaintProperty('routes-glow', 'line-opacity', focus ? ['case', ['==', ['get', 'route'], focus], 0.22, 0] : 0.1);
    if (glyphs && map.getLayer('routes-label'))
      map.setFilter('routes-label', focus ? (['all', ['==', ['get', 'main'], 1], ['==', ['get', 'route'], focus]] as maplibregl.FilterSpecification) : ['==', ['get', 'main'], 1]);
  }, [ready, engine, focusRoute, selectedBus, glyphs, plan]);

  // ---- al enfocar una línea desde el filtro: encuadrarla entera
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine || !network || !focusRoute) return;
    const dt = engine.dayTypeAt(clock.now());
    let pats = network.patterns.filter((p) => p.routeId === focusRoute && p.dayType === dt);
    if (!pats.length) pats = network.patterns.filter((p) => p.routeId === focusRoute);
    const cs = pats.flatMap((p) => p.coords);
    if (!cs.length) return;
    const lons = cs.map((c) => c[0]);
    const lats = cs.map((c) => c[1]);
    // el padding de flyTo/jumpTo queda guardat al mapa i fitBounds el sumaria al seu
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: { ...mapPadding(), top: 60 }, duration: prefersReducedMotion() ? 0 : 900, maxZoom: 15 },
    );
  }, [ready, engine, network, focusRoute]);

  // ---- com hi arribo: la ruta triada
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource;
    if (!plan) {
      for (const id of ['plan-walk', 'plan-bus', 'plan-pts']) src(id).setData(emptyFC());
      return;
    }
    const walks: { coords: [number, number][] }[] = [];
    const buses: { coords: [number, number][]; props: Record<string, unknown> }[] = [];
    const pts: { at: [number, number]; props: Record<string, unknown> }[] = [
      { at: plan.from, props: { kind: 'from' } },
      { at: plan.dest, props: { kind: 'dest' } },
    ];
    for (const l of plan.itinerary.legs) {
      if (l.kind === 'walk') {
        if (l.meters >= 15) walks.push({ coords: [l.from, l.to] });
        continue;
      }
      const p = engine.patternById(l.patternId);
      if (!p) continue;
      buses.push({ coords: sliceLine(p.coords, p.cum, p.stopDist[l.boardIndex]!, p.stopDist[l.alightIndex]!), props: { color: engine.routes.get(l.routeId)?.color ?? '#fff' } });
      for (const id of [l.boardStopId, l.alightStopId]) {
        const s = engine.stops.get(id);
        if (s) pts.push({ at: [s.lon, s.lat], props: { kind: 'stop' } });
      }
    }
    src('plan-walk').setData(lineFC(walks));
    src('plan-bus').setData(lineFC(buses));
    src('plan-pts').setData(pointFC(pts));
    const all = [...walks, ...buses].flatMap((f) => f.coords);
    if (!all.length) return;
    const lons = all.map((c) => c[0]);
    const lats = all.map((c) => c[1]);
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: { ...mapPadding(), top: 70 }, duration: prefersReducedMotion() ? 0 : 800, maxZoom: 16 },
    );
  }, [ready, engine, plan]);

  // ---- filtre de línies i mapa contextual: amb una ruta («com hi arribo») o un viatge, només les línies i els
  // busos implicats; la resta de la xarxa no es dibuixa (el mapa sencer és a la pestanya Mapa)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const planBuses = plan ? plan.itinerary.legs.flatMap((l) => (l.kind === 'bus' ? [l] : [])) : [];
    const ctxRoutes = planBuses.length ? [...new Set(planBuses.map((l) => l.routeId))] : trip ? [trip.routeId] : null;
    const ctxVehicles = planBuses.length ? planBuses.flatMap((l) => (l.vehicleId ? [l.vehicleId] : [])) : trip ? [trip.vehicleId] : null;
    const routes = ctxRoutes ?? visibleRoutes;
    const inRoutes = routes ? (['in', ['get', 'route'], ['literal', routes]] as const) : null;
    const f = inRoutes as maplibregl.FilterSpecification | null;
    map.setFilter('routes-line', f);
    map.setFilter('routes-casing', f);
    const glow = ['all', ['==', ['get', 'main'], 1], ['==', ['get', 'active'], 1], ...(inRoutes ? [inRoutes] : [])];
    map.setFilter('routes-glow', glow as unknown as maplibregl.FilterSpecification);
    // busos: els del viatge o de l'opció triada (si encara no han sortit, els de la seva línia)
    const busF = ctxVehicles && ctxVehicles.length ? (['in', ['get', 'id'], ['literal', ctxVehicles]] as unknown as maplibregl.FilterSpecification) : f;
    map.setFilter('bus-icon', busF);
    // les capes amb filtre propi el conserven, combinat amb el context
    const own: Record<string, unknown[]> = {
      'bus-halo': ['==', ['get', 'sel'], 1],
      'bus-stopring': ['all', ['==', ['get', 'stop'], 1], ['==', ['get', 'dim'], 0]],
      'bus-badge': ['!=', ['get', 'badge'], ''],
    };
    for (const [id, base] of Object.entries(own))
      if (map.getLayer(id)) map.setFilter(id, (busF ? ['all', base, busF] : base) as unknown as maplibregl.FilterSpecification);
    const labelVis = ['any', ['==', ['get', 'dim'], 0], ['==', ['get', 'hi'], 1]];
    map.setFilter('bus-label', (busF ? ['all', busF, labelVis] : labelVis) as unknown as maplibregl.FilterSpecification);
    const sf = routes
      ? (['any', ...routes.map((r) => ['in', `,${r},`, ['concat', ',', ['get', 'routes'], ',']])] as maplibregl.FilterSpecification)
      : null;
    map.setFilter('stops-circle', sf);
    if (map.getLayer('stops-label')) map.setFilter('stops-label', sf);
  }, [ready, visibleRoutes, plan, trip]);

  // ---- parada seleccionada (todos los postes de la zona)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !engine) return;
    const ids = view.name === 'stop' && !view.id.startsWith('gi:') ? areaOf(engine, view.id) : [];
    map.setFilter('stop-sel', ['in', ['get', 'id'], ['literal', ids]]);
  }, [ready, engine, view]);

  // ---- capa de interurbanos
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = interurbans && interData ? 'visible' : 'none';
    if (interData) {
      const f = interFeatures(interData);
      (map.getSource('inter-lines') as GeoJSONSource).setData(f.lines);
      (map.getSource('inter-stops') as GeoJSONSource).setData(f.stops);
    }
    map.setLayoutProperty('inter-line', 'visibility', vis);
    map.setLayoutProperty('inter-stop', 'visibility', vis);
  }, [ready, interurbans, interData]);

  // ---- posición del usuario (solo en el cliente, nunca se envía)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('user') as GeoJSONSource).setData(userPos ? pointFC([{ at: userPos }]) : emptyFC());
  }, [ready, userPos]);

  // ---- en canviar de vista, el mapa es recentra a la part que queda visible
  const base = useApp((s) => s.base);
  const presenting = useApp((s) => s.presenting);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || useApp.getState().follow) return;
    map.easeTo({ padding: mapPadding(), duration: prefersReducedMotion() ? 0 : 500 });
  }, [ready, view.name, base, presenting, selectedBus]);

  // ---- peticiones de cámara
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flyTo) return;
    if (prefersReducedMotion()) map.jumpTo({ center: flyTo.center, zoom: flyTo.zoom, padding: mapPadding() });
    else map.flyTo({ center: flyTo.center, zoom: flyTo.zoom, duration: 1200, essential: true, padding: mapPadding() });
  }, [ready, flyTo]);

  return <div ref={ref} className="map" role="application" aria-label="Mapa de la xarxa de bus de Sabadell" />;
}

/** Toque en móvil: área ampliada y bus más cercano al dedo (bug 12.4-30). */
function bindInteractions(map: MLMap) {
  const pick = (pt: maplibregl.Point, layers: string[], radius: number) => {
    const feats = map.queryRenderedFeatures(
      [
        [pt.x - radius, pt.y - radius],
        [pt.x + radius, pt.y + radius],
      ],
      { layers: layers.filter((l) => map.getLayer(l)) },
    );
    let best: maplibregl.MapGeoJSONFeature | null = null;
    let bestD = Infinity;
    for (const f of feats) {
      if (f.geometry.type !== 'Point') continue;
      const p = map.project(f.geometry.coordinates as [number, number]);
      // los buses atenuados cuentan menos: se elige antes el destacado
      const d = Math.hypot(p.x - pt.x, p.y - pt.y) + (f.properties?.dim === 1 ? 12 : 0);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  };
  map.on('click', (e) => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const bus = pick(e.point, ['bus-icon'], coarse ? 26 : 16);
    const st = useApp.getState();
    if (bus) {
      st.selectBus(String(bus.properties.id));
      return;
    }
    const stop = pick(e.point, ['stops-circle', 'inter-stop'], coarse ? 18 : 10);
    if (stop) {
      st.navigate({ name: 'stop', id: String(stop.properties.id) });
      return;
    }
    if (st.selectedBus) st.selectBus(null);
  });
  map.on('dragstart', () => {
    if (useApp.getState().follow) useApp.getState().setFollow(false);
  });
  const setCursor = (e: maplibregl.MapMouseEvent) => {
    const hit = pick(e.point, ['bus-icon', 'stops-circle', 'inter-stop'], 10);
    map.getCanvas().style.cursor = hit ? 'pointer' : '';
  };
  map.on('mousemove', setCursor);
}
