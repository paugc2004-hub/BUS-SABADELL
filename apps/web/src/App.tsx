import { useEffect } from 'react';
import { clock, useApp } from './state/store.ts';
import { detectLang, useT } from './i18n/index.ts';
import { loadNetwork } from './data/load.ts';
import { vehiclesAt } from './data/vehicles.ts';
import { MapView } from './map/MapView.tsx';
import { AboutModal, AlertsPanel, HonestyBanner, LineFilter, MapControls, TopBar } from './views/Chrome.tsx';
import { BusCard } from './views/BusCard.tsx';
import { StopPanel } from './views/StopPanel.tsx';
import { SearchPanel } from './views/SearchPanel.tsx';
import { LineView } from './views/LineView.tsx';
import { Presentation } from './views/Presentation.tsx';
import { RouteChip, hm, useNow } from './ui/common.tsx';

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

  useEffect(() => {
    useApp.getState().setLang(detectLang());
    void loadNetwork();
    // la pestaña vuelve: re-render inmediato (todo sale del reloj)
    const onVis = () => document.visibilityState === 'visible' && useApp.setState((s) => ({ clockVersion: s.clockVersion + 1 }));
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    document.title = view.name === 'present' ? 'Bus Sabadell en directe · Presentació' : 'Bus Sabadell en directe';
  }, [view, lang]);

  if (view.name === 'present')
    return (
      <>
        <Loading />
        {ready && <Presentation />}
      </>
    );

  return (
    <div className={`app view-${view.name}`}>
      <TopBar />
      <HonestyBanner />
      <main className="stage">
        {ready && <MapView />}
        {ready && view.name !== 'line' && (
          <>
            <LineFilter />
            <MapControls />
            <NoService />
          </>
        )}
        {ready && view.name === 'line' && <LineView routeRef={view.ref} />}
        {ready && view.name === 'stop' && <StopPanel id={view.id} />}
        {ready && view.name === 'search' && <SearchPanel />}
        {ready && view.name !== 'search' && <BusCard />}
        <Offline />
        <Loading />
      </main>
      <AboutModal />
      <AlertsPanel />
      <span className="sr-only" aria-live="off">{clock.isLive() ? '' : 'demo'}</span>
    </div>
  );
}
