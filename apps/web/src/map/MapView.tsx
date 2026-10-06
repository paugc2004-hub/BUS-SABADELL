import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as GeoJSON from 'geojson';
import type { DayType, NetworkData, SimEngine, VehicleState } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { vehiclesAt } from '../data/vehicles.ts';
import { addBusImages } from './icons.ts';
import { loadBaseStyle } from './style.ts';

const SABADELL: [number, number] = [2.1065, 41.5475];
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

type FC = GeoJSON.FeatureCollection;
const emptyFC = (): FC => ({ type: 'FeatureCollection', features: [] });

/** Líneas del día: patrones del tipo de día actual; las que no circulan, atenuadas. */
function routeFeatures(net: NetworkData, engine: SimEngine, dayType: DayType): FC {
  const features: GeoJSON.Feature[] = [];
  for (const r of net.routes) {
    const runs = engine.runsOn(r.id, dayType);
    let pats = net.patterns.filter((p) => p.routeId === r.id && p.dayType === dayType);
    if (!pats.length) {
      const pref: DayType[] = ['feiner', 'dissabte', 'festiu'];
      for (const dt of pref) {
        pats = net.patterns.filter((p) => p.routeId === r.id && p.dayType === dt);
        if (pats.length) break;
      }
    }
    // patrón principal de cada sentido = el que más expediciones tiene (para el halo)
    const main = new Set<string>();
    for (const dir of [0, 1]) {
      const best = pats.filter((p) => p.dir === dir).sort((a, b) => b.trips.length - a.trips.length)[0];
      if (best) main.add(best.id);
    }
    for (const p of pats)
      features.push({
        type: 'Feature',
        properties: { route: r.id, color: r.color, active: runs ? 1 : 0, main: main.has(p.id) ? 1 : 0, order: r.order },
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

/** Separa buses que coinciden en el mismo punto (cabeceras compartidas, bug 12.3-23). */
function busFeatures(vs: VehicleState[], selected: string | null): FC {
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
    features.push({
      type: 'Feature',
      properties: {
        id: v.id,
        route: v.routeId,
        bearing: v.bearing,
        status: v.status,
        sel: v.id === selected ? 1 : 0,
        idle: v.status === 'EN_CABECERA' || v.status === 'RETIRADA' ? 1 : 0,
      },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function interFeatures(d: NonNullable<ReturnType<typeof useApp.getState>['interData']>): { lines: FC; stops: FC } {
  return {
    lines: {
      type: 'FeatureCollection',
      features: d.shapes.map((s) => ({
        type: 'Feature',
        properties: { route: s.routeId },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
    },
    stops: {
      type: 'FeatureCollection',
      features: d.stops.map((s) => ({
        type: 'Feature',
        properties: { id: `gi:${s.id}`, name: s.name },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    },
  };
}

export function MapView({ interactive = true, onReady }: { interactive?: boolean; onReady?: (m: MLMap) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const visibleRoutes = useApp((s) => s.visibleRoutes);
  const interurbans = useApp((s) => s.interurbans);
  const interData = useApp((s) => s.interData);
  const userPos = useApp((s) => s.userPos);
  const flyTo = useApp((s) => s.flyTo);

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
      map.on('error', (e) => {
        // las teselas del mapa base pueden fallar sin romper nada: seguimos con nuestras capas
        console.warn('map error', e.error?.message);
      });
      map.on('load', () => {
        if (!map) return;
        addBusImages(map, network.routes);
        const dayType = engine.dayTypeAt(clock.now());
        map.addSource('routes', { type: 'geojson', data: routeFeatures(network, engine, dayType) });
        map.addSource('stops', { type: 'geojson', data: stopFeatures(network) });
        map.addSource('buses', { type: 'geojson', data: emptyFC() });
        map.addSource('inter-lines', { type: 'geojson', data: emptyFC() });
        map.addSource('inter-stops', { type: 'geojson', data: emptyFC() });
        map.addSource('user', { type: 'geojson', data: emptyFC() });

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
            'line-opacity': 0.28,
          },
        });
        map.addLayer({
          id: 'routes-line',
          type: 'line',
          source: 'routes',
          layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'order'] },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.6, 14, 3, 17, 5.5],
            'line-opacity': ['case', ['==', ['get', 'active'], 1], 0.95, 0.18],
          },
        });
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
            paint: { 'text-color': '#c9cdd3', 'text-halo-color': '#0b0c0f', 'text-halo-width': 1.4 },
          });
        }
        map.addLayer({
          id: 'stop-sel',
          type: 'circle',
          source: 'stops',
          filter: ['==', ['get', 'id'], ''],
          paint: { 'circle-radius': 10, 'circle-color': 'rgba(255,255,255,0.12)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
        });
        map.addLayer({
          id: 'bus-halo',
          type: 'symbol',
          source: 'buses',
          filter: ['==', ['get', 'sel'], 1],
          layout: { 'icon-image': 'halo', 'icon-size': 1.2, 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        });
        map.addLayer({
          id: 'bus-drop',
          type: 'symbol',
          source: 'buses',
          layout: {
            'icon-image': ['concat', 'drop-', ['get', 'route']],
            'icon-rotate': ['get', 'bearing'],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.42, 13, 0.66, 16, 1],
            'symbol-sort-key': ['get', 'sel'],
          },
          paint: { 'icon-opacity': ['case', ['==', ['get', 'idle'], 1], 0.6, 1] },
        });
        map.addLayer({
          id: 'bus-label',
          type: 'symbol',
          source: 'buses',
          minzoom: 12.6,
          layout: {
            'icon-image': ['concat', 'lbl-', ['get', 'route']],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 12.6, 0.72, 16, 1],
            'symbol-sort-key': ['get', 'sel'],
          },
          paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 12.6, 0, 13, 1] },
        });
        map.addLayer({
          id: 'user',
          type: 'symbol',
          source: 'user',
          layout: { 'icon-image': 'user', 'icon-allow-overlap': true },
        });

        if (interactive) bindInteractions(map);
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
    const src = map.getSource('buses') as GeoJSONSource;
    const routesSrc = map.getSource('routes') as GeoJSONSource;
    let raf = 0;
    let last = 0;
    let lastFollow = 0;
    let dayType = engine.dayTypeAt(clock.now());
    let interval = prefersReducedMotion() ? 1000 : 50; // 20 Hz
    // degradación automática si el dispositivo va justo (bug 12.4-34)
    let slowFrames = 0;
    let prevFrame = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - prevFrame;
      prevFrame = now;
      if (dt > 40 && dt < 500) slowFrames++;
      else if (slowFrames > 0) slowFrames -= 0.25;
      if (slowFrames > 90 && interval < 200) {
        interval = 200;
        if (map.getLayer('routes-glow')) map.setLayoutProperty('routes-glow', 'visibility', 'none');
      }
      if (now - last < interval) return;
      last = now;
      const t = clock.now();
      const st = useApp.getState();
      const vs = vehiclesAt(engine, t);
      src.setData(busFeatures(vs, st.selectedBus));
      const dtNow = engine.dayTypeAt(t);
      if (dtNow !== dayType) {
        dayType = dtNow;
        routesSrc.setData(routeFeatures(network, engine, dayType));
      }
      if (st.follow && st.selectedBus && now - lastFollow > 400) {
        lastFollow = now;
        const v = vs.find((x) => x.id === st.selectedBus);
        if (v) map.easeTo({ center: [v.lon, v.lat], duration: 450, easing: (x) => x });
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
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ready, engine, network]);

  // ---- filtro de líneas
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const inRoutes = visibleRoutes ? (['in', ['get', 'route'], ['literal', visibleRoutes]] as const) : null;
    const f = inRoutes as maplibregl.FilterSpecification | null;
    map.setFilter('routes-line', f);
    const glow = ['all', ['==', ['get', 'main'], 1], ['==', ['get', 'active'], 1], ...(inRoutes ? [inRoutes] : [])];
    map.setFilter('routes-glow', glow as unknown as maplibregl.FilterSpecification);
    map.setFilter('bus-drop', f);
    map.setFilter('bus-label', f);
    const sf = visibleRoutes
      ? (['any', ...visibleRoutes.map((r) => ['in', `,${r},`, ['concat', ',', ['get', 'routes'], ',']])] as maplibregl.FilterSpecification)
      : null;
    map.setFilter('stops-circle', sf);
    if (map.getLayer('stops-label')) map.setFilter('stops-label', sf);
  }, [ready, visibleRoutes]);

  // ---- parada seleccionada
  const view = useApp((s) => s.view);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter('stop-sel', ['==', ['get', 'id'], view.name === 'stop' ? view.id : '']);
  }, [ready, view]);

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
    (map.getSource('user') as GeoJSONSource).setData(
      userPos
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: userPos } }] }
        : emptyFC(),
    );
  }, [ready, userPos]);

  // ---- peticiones de cámara
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flyTo) return;
    const wide = window.innerWidth > 760;
    const padding = wide ? { top: 40, bottom: 40, left: 40, right: 460 } : { top: 30, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 };
    if (prefersReducedMotion()) map.jumpTo({ center: flyTo.center, zoom: flyTo.zoom, padding });
    else map.flyTo({ center: flyTo.center, zoom: flyTo.zoom, duration: 1200, essential: true, padding });
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
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  };
  map.on('click', (e) => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const bus = pick(e.point, ['bus-drop'], coarse ? 26 : 16);
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
    const hit = pick(e.point, ['bus-drop', 'stops-circle', 'inter-stop'], 10);
    map.getCanvas().style.cursor = hit ? 'pointer' : '';
  };
  map.on('mousemove', setCursor);
}
