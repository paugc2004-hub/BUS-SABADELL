/**
 * L'app (mapa, inici, línies, xarxa, parada, bus, viatge, presentació). Va en un tros a part:
 * la landing (/) no la descarrega.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { clock, useApp } from './state/store.ts';
import { useT } from './i18n/index.ts';
import { loadNetwork } from './data/load.ts';
import { vehiclesAt } from './data/vehicles.ts';
import { AboutModal, AlertsPanel, BottomNav, HonestyBanner, LineFilter, MapControls, TopBar } from './views/Chrome.tsx';
import { BusCard } from './views/BusCard.tsx';
import { StopPanel } from './views/StopPanel.tsx';
import { RoutePanel } from './views/Route.tsx';
import { HomePanel } from './views/Home.tsx';
import { LinePanel, LinesIndex } from './views/Lines.tsx';
import { NetworkPanel } from './views/Network.tsx';
import { MinePanel } from './views/Mine.tsx';
import { Toasts, TripMonitor, TripPanel } from './views/Trip.tsx';
import { RouteChip, hm, useNow } from './ui/common.tsx';
import { locationService, useLocation } from './location/location.ts';

// el mapa (MapLibre + CSS) i la presentació van en trossos a part: la carcassa es pinta abans
const MapView = lazy(() => import('./map/MapView.tsx').then((m) => ({ default: m.MapView })));
const Presentation = lazy(() => import('./views/Presentation.tsx').then((m) => ({ default: m.Presentation })));

function NoService() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const now = useNow(5000);
  if (!engine) return null;
  if (vehiclesAt(engine, now).length > 0) return null;
  const next = engine.nextService(now);
  return (
    <div className="no-service" role="status">
      <strong>{t.noService}</strong>
      {next && (
        <span>
          {t.firstBus(hm(next.at), next.routeId)} <RouteChip route={engine.routes.get(next.routeId)} size="sm" />
        </span>
      )}
    </div>
  );
}

function Offline() {
  const t = useT();
  const online = useApp((s) => s.online);
  if (online) return null;
  return <div className="offline-note" role="status">{t.offline}</div>;
}

function Loading() {
  const t = useT();
  const state = useApp((s) => s.loadState);
  if (state === 'ready') return null;
  if (state === 'error')
    return (
      <div className="fullscreen-msg" role="alert">
        <p>{t.loadError}</p>
        <button type="button" className="primary" onClick={() => void loadNetwork()}>
          {t.retry}
        </button>
      </div>
    );
  return (
    <div className="fullscreen-msg">
      <div className="loader" aria-hidden />
      <p>{t.loading}</p>
    </div>
  );
}

export function AppMain() {
  const view = useApp((s) => s.view);
  const ready = useApp((s) => s.loadState === 'ready');
  const presenting = useApp((s) => s.presenting);
  const busOpen = useApp((s) => s.selectedBus !== null);
  const hasTrip = useApp((s) => s.trip !== null);

  // al mòbil, l'inici tapa el mapa: primer es pinta l'inici i el mapa (WebGL, ~1,5 MB) arrenca quan el mòbil està lliure
  const [mapOn, setMapOn] = useState(() => !(window.matchMedia('(max-width: 760px)').matches && ['home', 'mine', 'line'].includes(view.name)));
  useEffect(() => {
    if (mapOn) return;
    if (!['home', 'mine', 'line'].includes(view.name)) return setMapOn(true);
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(() => setMapOn(true), { timeout: 2500 }) : window.setTimeout(() => setMapOn(true), 1200);
    return () => (ric ? (window as unknown as { cancelIdleCallback: (n: number) => void }).cancelIdleCallback(id) : clearTimeout(id));
  }, [mapOn, view.name]);

  // la xarxa (116 KB) només es carrega quan s'entra a l'app, no a la landing
  useEffect(() => {
    if (useApp.getState().loadState !== 'ready' && !useApp.getState().network) void loadNetwork();
  }, []);

  // on ets: en obrir l'app (si el permís ja està denegat, no es torna a demanar) i, mentre és oberta, seguint-te
  useEffect(() => {
    let stop = () => {};
    let live = true;
    void locationService.getPermissionState().then((p) => {
      if (!live) return;
      if (p === 'denied') useLocation.setState({ status: 'denied' });
      else void locationService.locate().then(() => live && (stop = locationService.watch()));
    });
    return () => {
      live = false;
      stop();
    };
  }, []);

  const base = useApp((s) => s.base);
  const baseLine = useApp((s) => s.baseLine);
  // /presentacio és el mapa amb el director de la demo a sobre
  const name = view.name === 'present' ? 'map' : view.name;
  // panell esquerre (escriptori) / pàgina (mòbil): la vista de base; una parada o un bus s'obren a sobre
  const left = presenting ? (name === 'network' ? 'network' : null) : name === 'stop' || name === 'route' ? base : name;
  const lineRef = view.name === 'line' ? view.ref : base === 'line' ? baseLine : null;
  // ciutadà (clar) vs. NextMobility Control i presentació (fosc): docs/APP_UX_STRATEGY.md
  const control = presenting || name === 'network';

  return (
    <div className={`app view-${name} base-${left ?? 'none'}${presenting ? ' presenting' : ''}${view.name === 'line' && lineRef ? ' has-line' : ''}${control ? ' control' : ' citizen'}${busOpen ? ' bus-open' : ''}${hasTrip ? ' has-trip' : ''}`}>
      <TopBar />
      {control && <HonestyBanner />}
      <main className="stage">
        {ready && mapOn && (
          <Suspense fallback={null}>
            <MapView />
          </Suspense>
        )}
        {ready && name === 'map' && !presenting && (
          <>
            <LineFilter />
            <MapControls />
          </>
        )}
        {ready && (name === 'map' || name === 'home') && <NoService />}
        {ready && left === 'home' && <HomePanel autoFocus={view.name === 'home' && Boolean(view.search)} />}
        {ready && left === 'line' && <LinesIndex />}
        {ready && left === 'network' && <NetworkPanel />}
        {ready && left === 'mine' && <MinePanel />}
        {ready && view.name === 'line' && lineRef && <LinePanel routeRef={lineRef} />}
        {ready && view.name === 'stop' && <StopPanel id={view.id} />}
        {ready && view.name === 'route' && <RoutePanel to={view.to} from={view.from} />}
        {ready && <BusCard />}
        {ready && <TripPanel />}
        {ready && presenting && (
          <Suspense fallback={null}>
            <Presentation />
          </Suspense>
        )}
        {ready && <TripMonitor />}
        <Toasts />
        <Offline />
        <Loading />
      </main>
      {!presenting && <BottomNav />}
      <AboutModal />
      <AlertsPanel />
      <span className="sr-only" aria-live="off">{clock.isLive() ? '' : 'demo'}</span>
    </div>
  );
}
