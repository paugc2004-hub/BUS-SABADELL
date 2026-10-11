import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from './state/store.ts';
import { detectLang, useT } from './i18n/index.ts';
import { Landing } from './views/Landing.tsx';
import { AuthScreen } from './views/Auth.tsx';
import { LocationStep, locationAsked } from './views/Welcome.tsx';

/** vistes públiques: no cal sessió ni carregar la xarxa */
const PUBLIC = new Set(['landing', 'login', 'register', 'stopCard', 'qr', 'legal', 'timetable', 'fares', 'sales']);

// l'app sencera (mapa, panells, motor) en un tros a part: la landing es pinta sense descarregar-la
const AppMain = lazy(() => import('./AppMain.tsx').then((m) => ({ default: m.AppMain })));
// fitxa de parada (QR), generador de QR i pàgines legals: públiques, lleugeres i sense mapa
const StopCard = lazy(() => import('./views/Public.tsx').then((m) => ({ default: m.StopCard })));
const QrPage = lazy(() => import('./views/Public.tsx').then((m) => ({ default: m.QrPage })));
const Legal = lazy(() => import('./views/Public.tsx').then((m) => ({ default: m.Legal })));
const Timetable = lazy(() => import('./views/Public.tsx').then((m) => ({ default: m.Timetable })));
const FaresPage = lazy(() => import('./views/Fares.tsx').then((m) => ({ default: m.FaresPage })));
const SalesPage = lazy(() => import('./views/Fares.tsx').then((m) => ({ default: m.SalesPage })));

export function App() {
  const view = useApp((s) => s.view);
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const isPublic = PUBLIC.has(view.name);
  const t = useT();

  useEffect(() => {
    useApp.getState().setLang(detectLang());
    // la pestaña vuelve: re-render inmediato (todo sale del reloj)
    const onVis = () => document.visibilityState === 'visible' && useApp.setState((s) => ({ clockVersion: s.clockVersion + 1 }));
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // l'app demana entrar (correu i contrasenya, o «Entra sense compte»); després, la ubicació (un cop) i l'inici.
  // Amb un compte propi ja obert, /entra i /registre porten a l'inici.
  useEffect(() => {
    const st = useApp.getState();
    if (!isPublic && !user) st.navigate({ name: 'login', next: location.pathname + location.search }, { replace: true });
    else if (user && !user.demo && (view.name === 'login' || view.name === 'register')) st.navigate({ name: 'home' }, { replace: true });
  }, [isPublic, user, view.name]);
  const [locDone, setLocDone] = useState(locationAsked);

  const presenting = useApp((s) => s.presenting);
  useEffect(() => {
    if (['stopCard', 'qr', 'legal', 'timetable', 'fares', 'sales'].includes(view.name)) return; // ho posa cada pàgina pública
    document.title = presenting ? 'NextMobility Sabadell · Presentació' : view.name === 'landing' ? t.landingTitle : 'NextMobility Sabadell';
  }, [presenting, lang, view.name, t]);
  // l'app instal·lada (o dins d'un contenidor d'app) s'obre directament a l'app, no a la landing
  const installed = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  if (view.name === 'landing' && installed) {
    queueMicrotask(() => useApp.getState().navigate({ name: 'home' }, { replace: true }));
    return null;
  }
  if (view.name === 'landing') return <Landing />;
  if (view.name === 'fares' || view.name === 'sales')
    return <Suspense fallback={<div className="loader" aria-hidden />}>{view.name === 'fares' ? <FaresPage /> : <SalesPage title={view.title} />}</Suspense>;
  if (view.name === 'stopCard' || view.name === 'qr' || view.name === 'legal' || view.name === 'timetable')
    return (
      <Suspense fallback={<div className="loader" aria-hidden />}>
        {view.name === 'stopCard' ? (
          <StopCard id={view.id} />
        ) : view.name === 'qr' ? (
          <QrPage id={view.id} />
        ) : view.name === 'timetable' ? (
          <Timetable routeRef={view.ref} stopId={view.stop} />
        ) : (
          <Legal page={view.page} />
        )}
      </Suspense>
    );
  if (view.name === 'login' || view.name === 'register') return <AuthScreen mode={view.name} next={view.next} />;
  if (!user) return null;
  if (!locDone) return <LocationStep onDone={() => setLocDone(true)} />;

  return (
    <Suspense
      fallback={
        <div className="fullscreen-msg">
          <div className="loader" aria-hidden />
        </div>
      }
    >
      <AppMain />
    </Suspense>
  );
}
