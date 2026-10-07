import { lazy, Suspense, useEffect } from 'react';
import { useApp } from './state/store.ts';
import { detectLang, useT } from './i18n/index.ts';
import { Landing } from './views/Landing.tsx';
import { AuthScreen } from './views/Auth.tsx';
import { auth } from './auth/auth.ts';

/** vistes públiques: no cal sessió ni carregar la xarxa */
const PUBLIC = new Set(['landing', 'login', 'register']);

// l'app sencera (mapa, panells, motor) en un tros a part: la landing es pinta sense descarregar-la
const AppMain = lazy(() => import('./AppMain.tsx').then((m) => ({ default: m.AppMain })));

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

  // sense barrera: qui entra a l'app sense compte la prova amb el de demostració; el compte propi és opcional
  // (per desar les teves parades). Amb un compte propi ja obert, /entra i /registre porten a l'inici.
  useEffect(() => {
    const st = useApp.getState();
    if (!isPublic && !user) void auth.signInDemo().then((u) => st.setUser(u));
    else if (user && !user.demo && (view.name === 'login' || view.name === 'register')) st.navigate({ name: 'home' }, { replace: true });
  }, [isPublic, user, view.name]);

  const presenting = useApp((s) => s.presenting);
  useEffect(() => {
    document.title = presenting ? 'NextMobility Sabadell · Presentació' : view.name === 'landing' ? t.landingTitle : 'NextMobility Sabadell';
  }, [presenting, lang, view.name, t]);
  // l'app instal·lada (o dins d'un contenidor d'app) s'obre directament a l'app, no a la landing
  const installed = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
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
