import { lazy, Suspense, useEffect } from 'react';
import { useApp } from './state/store.ts';
import { detectLang, useT } from './i18n/index.ts';
import { Landing } from './views/Landing.tsx';
import { AuthScreen } from './views/Auth.tsx';

/** Vistes públiques: no cal sessió ni carregar la xarxa. */
const PUBLIC = new Set(['landing', 'login', 'register']);

const AppMain = lazy(() => import('./AppMain.tsx').then((m) => ({ default: m.AppMain })));

export function App() {
  const view = useApp((s) => s.view);
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const isPublic = PUBLIC.has(view.name);
  const t = useT();

  useEffect(() => {
    useApp.getState().setLang(detectLang());
    const onVis = () => document.visibilityState === 'visible' && useApp.setState((s) => ({ clockVersion: s.clockVersion + 1 }));
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Després d'autenticar-se, l'usuari entra directament a l'app.
  // La ubicació es demana dins de la pantalla principal, sense un pas bloquejant.
  useEffect(() => {
    const st = useApp.getState();
    if (!isPublic && !user) st.navigate({ name: 'login', next: location.pathname + location.search }, { replace: true });
    else if (user && !user.demo && (view.name === 'login' || view.name === 'register')) st.navigate({ name: 'home' }, { replace: true });
  }, [isPublic, user, view.name]);

  const presenting = useApp((s) => s.presenting);
  useEffect(() => {
    document.title = presenting ? 'NextMobility Sabadell · Presentació' : view.name === 'landing' ? t.landingTitle : 'NextMobility Sabadell';
  }, [presenting, lang, view.name, t]);

  const installed =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  if (view.name === 'landing' && installed) {
    queueMicrotask(() => useApp.getState().navigate({ name: 'home' }, { replace: true }));
    return null;
  }
  if (view.name === 'landing') return <Landing />;
  if (view.name === 'login' || view.name === 'register') return <AuthScreen mode={view.name} next={view.next} />;
  if (!user) return null;

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
