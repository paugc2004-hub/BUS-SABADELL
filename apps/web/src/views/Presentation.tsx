/**
 * Modo presentación (/presentacio): pantalla completa, sin controles, tour en bucle:
 * vista general → zoom a la línea con más servicio → ficha de un bus → vista de línea → vuelta.
 * Pensado para aguantar 30+ min: un único temporizador, todo se limpia al salir.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehiclesAt } from '../data/vehicles.ts';
import { MapView } from '../map/MapView.tsx';
import { LineView } from './LineView.tsx';
import { BusCard } from './BusCard.tsx';
import { RouteChip, hm, useNow } from '../ui/common.tsx';

type Step = { kind: 'overview' } | { kind: 'line-map'; route: string } | { kind: 'bus'; route: string; bus: string } | { kind: 'diagram'; route: string };

const DUR: Record<Step['kind'], number> = { overview: 13000, 'line-map': 11000, bus: 13000, diagram: 15000 };

export function Presentation() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const now = useNow(1000);
  const mapRef = useRef<MLMap | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'overview' });
  const [chrome, setChrome] = useState(false);
  const cycle = useRef(0);
  const st = useApp.getState();

  // máquina de estados del tour
  useEffect(() => {
    if (!engine || !network) return;
    const map = mapRef.current;
    const pickRoute = () => {
      const vs = vehiclesAt(engine, clock.now()).filter((v) => v.status === 'EN_RUTA');
      const count = new Map<string, number>();
      for (const v of vs) count.set(v.routeId, (count.get(v.routeId) ?? 0) + 1);
      const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
      return ranked[cycle.current % Math.max(1, Math.min(4, ranked.length))] ?? null;
    };
    let next: Step;
    if (step.kind === 'overview') {
      st.selectBus(null);
      st.setFollow(false);
      st.setVisibleRoutes(null);
      map?.flyTo({ center: [2.1065, 41.5475], zoom: window.innerWidth < 700 ? 12 : 12.7, bearing: 0, pitch: 0, duration: 2600 });
      const r = pickRoute();
      next = r ? { kind: 'line-map', route: r } : { kind: 'overview' };
    } else if (step.kind === 'line-map') {
      const pats = network.patterns.filter((p) => p.routeId === step.route && p.dayType === engine.dayTypeAt(clock.now()));
      const coords = pats.flatMap((p) => p.coords);
      if (map && coords.length) {
        const lons = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: 90, duration: 2600, bearing: -12, pitch: 35 },
        );
      }
      st.setVisibleRoutes([step.route]);
      const v = vehiclesAt(engine, clock.now()).find((x) => x.routeId === step.route && x.status === 'EN_RUTA');
      next = v ? { kind: 'bus', route: step.route, bus: v.id } : { kind: 'diagram', route: step.route };
    } else if (step.kind === 'bus') {
      const v = engine.vehicle(step.bus, clock.now());
      if (v && map) map.flyTo({ center: [v.lon, v.lat], zoom: 16, pitch: 45, duration: 2200 });
      st.selectBus(step.bus);
      setTimeout(() => useApp.getState().setFollow(true), 2300);
      next = { kind: 'diagram', route: step.route };
    } else {
      st.setFollow(false);
      next = { kind: 'overview' };
      cycle.current++;
    }
    const id = setTimeout(() => setStep(next), DUR[step.kind]);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, engine, network]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && exit();
    let hide: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setChrome(true);
      clearTimeout(hide);
      hide = setTimeout(() => setChrome(false), 2500);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      clearTimeout(hide);
      const s = useApp.getState();
      s.setVisibleRoutes(null);
      s.setFollow(false);
    };
     
  }, []);

  const exit = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    useApp.getState().navigate({ name: 'map' });
  };

  if (!engine || !network) return null;
  const vs = vehiclesAt(engine, now);
  const moving = vs.filter((v) => v.status !== 'RETIRADA').length;
  const linesNow = new Set(vs.map((v) => v.routeId)).size;
  const route = 'route' in step ? engine.routes.get(step.route) : undefined;

  return (
    <div className="present" onClick={() => !document.fullscreenElement && document.documentElement.requestFullscreen?.().catch(() => undefined)}>
      <div className={`present-map${step.kind === 'diagram' ? ' hidden' : ''}`}>
        <MapView interactive={false} onReady={(m) => (mapRef.current = m)} />
      </div>
      {step.kind === 'diagram' && (
        <div className="present-diagram">
          <LineView routeRef={step.route} />
        </div>
      )}
      {step.kind === 'bus' && <BusCard />}
      <div className="present-hud">
        <div className="hud-title">
          <span className="brand-text">Bus Sabadell <span className="brand-sub">en directe</span></span>
          <span className="mono hud-clock">{hm(now)}</span>
        </div>
        <div className="hud-stats">
          <div>
            <div className="hud-num mono">{moving}</div>
            <div className="hud-lbl">{t.presentation.inService}</div>
          </div>
          <div>
            <div className="hud-num mono">{linesNow}</div>
            <div className="hud-lbl">{t.linesCount}</div>
          </div>
          <div>
            <div className="hud-num mono">{network.stops.length}</div>
            <div className="hud-lbl">{t.stopsCount}</div>
          </div>
        </div>
        {route && (
          <div className="hud-route">
            <RouteChip route={route} size="lg" /> <span>{route.longName}</span>
          </div>
        )}
      </div>
      <div className="present-banner">{t.banner}</div>
      <button type="button" className={`present-exit${chrome ? ' show' : ''}`} onClick={(e) => { e.stopPropagation(); exit(); }}>
        {t.presentation.exit}
      </button>
    </div>
  );
}
