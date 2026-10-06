import { lazy, Suspense, useEffect } from 'react';
import { clock, useApp } from './state/store.ts';
import { detectLang, useT } from './i18n/index.ts';
import { loadNetwork } from './data/load.ts';
import { vehiclesAt } from './data/vehicles.ts';
import { AboutModal, AlertsPanel, BottomNav, HonestyBanner, LineFilter, MapControls, TopBar } from './views/Chrome.tsx';
import { BusCard } from './views/BusCard.tsx';
import { StopPanel } from './views/StopPanel.tsx';
import { HomePanel } from './views/Home.tsx';
import { LinePanel, LinesIndex } from './views/Lines.tsx';
import { NetworkPanel } from './views/Network.tsx';
import { MinePanel } from './views/Mine.tsx';
import { Toasts, TripMonitor, TripPanel } from './views/Trip.tsx';
import { RouteChip, hm, useNow } from './ui/common.tsx';
import { Landing } from './views/Landing.tsx';
import { AuthScreen } from './views/Auth.tsx';

/** vistes públiques: no cal sessió ni carregar la xarxa */
const PUBLIC = new Set(['landing', 'login', 'register']);

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

export function App() {
  const view = useApp((s) => s.view);
  const ready = useApp((s) => s.loadState === 'ready');
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const isPublic = PUBLIC.has(view.name);

  useEffect(() => {
    useApp.getState().setLang(detectLang());
    // la pestaña vuelve: re-render inmediato (todo sale del reloj)
    const onVis = () => document.visibilityState === 'visible' && useApp.setState((s) => ({ clockVersion: s.clockVersion + 1 }));
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // l'app necessita sessió: sense compte, a /entra i després de tornada on anava
  useEffect(() => {
    const st = useApp.getState();
    if (!isPublic && !user) {
      st.navigate({ name: 'login', next: location.pathname + location.search }, { replace: true });
    } else if (user && (view.name === 'login' || view.name === 'register')) {
      st.navigate({ name: 'home' }, { replace: true });
    }
  }, [isPublic, user, view.name]);

  // la xarxa (116 KB) només es carrega quan s'entra a l'app, no a la landing
  useEffect(() => {
    if (!isPublic && user && useApp.getState().loadState !== 'ready' && !useApp.getState().network) void loadNetwork();
  }, [isPublic, user]);

  const presenting = useApp((s) => s.presenting);
  useEffect(() => {
    document.title = presenting ? 'NextMobility Sabadell · Presentació' : view.name === 'landing' ? 'NextMobility Sabadell · El teu bus, en directe' : 'NextMobility Sabadell';
  }, [presenting, lang, view.name]);
  const base = useApp((s) => s.base);
  const baseLine = useApp((s) => s.baseLine);
  // /presentacio és el mapa amb el director de la demo a sobre
  const name = view.name === 'present' ? 'map' : view.name;
  // panell esquerre (escriptori) / pàgina (mòbil): la vista de base; una parada o un bus s'obren a sobre
  const left = presenting ? (name === 'network' ? 'network' : null) : name === 'stop' ? base : name;
  const lineRef = view.name === 'line' ? view.ref : base === 'line' ? baseLine : null;

  if (view.name === 'landing') return <Landing />;
  if (view.name === 'login' || view.name === 'register') return <AuthScreen mode={view.name} next={view.next} />;
  if (!user) return null;

  return (
    <div className={`app view-${name} base-${left ?? 'none'}${presenting ? ' presenting' : ''}${view.name === 'line' && lineRef ? ' has-line' : ''}`}>
      <TopBar />
      <HonestyBanner />
      <main className="stage">
        {ready && (
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
