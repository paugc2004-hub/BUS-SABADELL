/**
 * Inici: «Quin bus puc agafar?». Cerca (on vas?), el teu proper bus amb UNA acció (agafar-lo),
 * les teves parades amb les properes llegades, a prop teu i, com a botó, el mapa. Al mòbil és una
 * pàgina sense mapa: el mapa és una eina, no l'inici (docs/APP_UX_STRATEGY.md).
 * Les parades suggerides són parades reals de la xarxa (no s'inventen).
 */
import { useEffect, useMemo, useState } from 'react';
import { haversine, normalize, type SimEngine } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { areaOf, liveArrivals, type LiveArrival } from '../data/derive.ts';
import { Icon, useNow } from '../ui/common.tsx';
import { locationService } from '../location/location.ts';
import { LocationStatus } from './LocationStatus.tsx';
import { SearchBox } from './SearchBox.tsx';
import { ArrivalRow } from './StopPanel.tsx';

/** Llocs habituals de Sabadell, comprovats contra la xarxa (es descarten si no hi són). */
const SUGGESTED = ['Estació Centre', 'Rambla', 'Francesc Macià', 'La Creu Alta', 'Catalunya', 'Can Deu', 'Can Rull', 'La Creu de Barberà'];

export function suggestedStops(engine: SimEngine): string[] {
  const all = [...engine.stops.values()];
  const out: string[] = [];
  for (const name of SUGGESTED) {
    // el pal amb més línies d'aquell nom
    const best = all.filter((s) => normalize(s.name) === normalize(name)).sort((a, b) => b.routes.length - a.routes.length)[0];
    if (best) out.push(best.id);
  }
  return out;
}

/** Parades més properes (una per zona) a una posició. */
export function nearestStops(engine: SimEngine, pos: [number, number], n = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...engine.stops.values()].sort((a, b) => haversine(pos, [a.lon, a.lat]) - haversine(pos, [b.lon, b.lat]))) {
    const key = areaOf(engine, s.id).slice().sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.id);
    if (out.length >= n) break;
  }
  return out;
}

function StopBlock({ engine, stopId, now }: { engine: SimEngine; stopId: string; now: number }) {
  const t = useT();
  const st = useApp.getState();
  const stop = engine.stops.get(stopId)!;
  const area = areaOf(engine, stopId);
  const tick = Math.floor(now / 5000);
  const list = useMemo(() => {
    const seen = new Set<string>();
    return liveArrivals(engine, area, now, 60, 30).filter((a) => {
      const k = `${a.routeId}|${a.headsign}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [engine, area, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (a: LiveArrival) => {
    if (!a.vehicleId) return;
    st.navigate({ name: 'stop', id: a.stopId });
    st.set({ boardHint: a.stopId });
    st.selectBus(a.vehicleId);
  };
  return (
    <div className="home-stop">
      <button type="button" className="home-stop-head" onClick={() => st.navigate({ name: 'stop', id: stopId })}>
        <span className="stop-dot" aria-hidden />
        <span className="home-stop-name">{stop.name}</span>
        <span className="dim">›</span>
      </button>
      {list.length === 0 ? (
        <div className="dim home-empty">{t.noArrivals}</div>
      ) : (
        <ul className="arrivals compact">
          {list.slice(0, 2).map((a) => (
            <li key={`${a.routeId}|${a.headsign}|${a.at}`} className="arrival">
              <ArrivalRow a={a} now={now} onOpen={open} engine={engine} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Les meves parades (o parades suggerides si encara no n'hi ha cap de desada). */
export function HomeStops({ skip = null }: { skip?: string | null }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const favorites = useApp((s) => s.favorites);
  const now = useNow(1000);
  const st = useApp.getState();
  const suggestions = useMemo(() => (engine ? suggestedStops(engine) : []), [engine]);
  if (!engine) return null;
  const favs = favorites.filter((id) => engine.stops.has(id));
  const shown = favs.filter((id) => id !== skip).slice(0, 6);
  return (
    <section className="home-sec">
      <h2 className="sec-title">
        {Icon.star(true)} {t.myStops}
      </h2>
      {shown.map((id) => (
        <StopBlock key={id} engine={engine} stopId={id} now={now} />
      ))}
      {favs.length === 0 && (
        <div className="home-sugg">
          {suggestions.map((id) => (
            <button key={id} type="button" className="sugg" onClick={() => st.navigate({ name: 'stop', id })}>
              {engine.stops.get(id)?.name}
            </button>
          ))}
        </div>
      )}
      {favs.length <= 1 && <p className="dim home-hint">{t.hero.choose}</p>}
    </section>
  );
}

/** A prop teu: les parades més properes (una per zona) amb les properes llegades. La ubicació no surt del dispositiu. */
export function NearStops({ skip = null }: { skip?: string | null }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const userPos = useApp((s) => s.userPos);
  const now = useNow(1000);
  const near = useMemo(() => (engine && userPos ? nearestStops(engine, userPos) : []), [engine, userPos]);
  if (!engine) return null;
  const locate = () => void locationService.locate();
  return (
    <section className="home-sec">
      <h2 className="sec-title">
        {Icon.locate} {t.nearMe}
      </h2>
      {near.length === 0 ? (
        <button type="button" className="cta cta-wide" onClick={locate}>
          {Icon.locate} {t.useLocation}
          <span className="dim cta-sub">{t.nearHint}</span>
        </button>
      ) : (
        near
          .filter((id) => id !== skip)
          .slice(0, 2)
          .map((id) => <StopBlock key={id} engine={engine} stopId={id} now={now} />)
      )}
    </section>
  );
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

/** Instal·lar l'app (PWA): Android/Chrome amb el diàleg del navegador; iPhone, amb la instrucció. */
function InstallButton() {
  const t = useT();
  const [evt, setEvt] = useState<InstallPrompt | null>(null);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (standalone) return null;
  if (evt)
    return (
      <button type="button" className="install-btn" onClick={() => void evt.prompt().then(() => setEvt(null))}>
        {Icon.board} {t.simple.install}
      </button>
    );
  if (ios) return <p className="install-hint">{t.simple.installIos}</p>;
  return null;
}

/**
 * Inici: «On vols anar?». Res més: la ubicació es detecta sola (al dispositiu) i, quan tries un lloc,
 * un carrer o una parada, la ruta et diu quin bus agafar, quan passa i per on va.
 */
export function HomePanel({ autoFocus = false }: { autoFocus?: boolean }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const userPos = useApp((s) => s.userPos);
  const user = useApp((s) => s.user);
  const now = useNow(5000);
  // on ets: ho porta LocationService (s'engega en obrir l'app; la ubicació no surt del dispositiu)
  const near = useMemo(() => {
    if (!engine || !userPos) return null;
    const id = nearestStops(engine, userPos, 1)[0];
    const s = id ? engine.stops.get(id) : null;
    return s ? { name: s.name, m: haversine(userPos, [s.lon, s.lat]) } : null;
  }, [engine, userPos]);
  if (!engine) return null;

  const first = user && !user.demo ? user.name.split(' ')[0] : null;
  const nearIds = engine && userPos ? nearestStops(engine, userPos, 2) : [];

  return (
    <aside className="home home-simple" aria-label={t.nav2.home}>
      <p className="simple-hello">{first ? t.simple.helloName(first) : t.simple.hello}</p>
      <LocationStatus okText={near ? (near.m < 1500 ? t.simple.youAreNear(near.name) : t.simple.outside) : undefined} />

      <h1 className="simple-title">{t.simple.title}</h1>
      <SearchBox autoFocus={autoFocus} toRoute placeholder={t.simple.placeholder} />

      {/* si ja ets a la parada: què hi passa (secundari, no competeix amb el cercador) */}
      {near && near.m < 1500 && nearIds.length > 0 && (
        <section className="home-sec simple-near">
          <h2 className="sec-title">{t.simple.nearStops}</h2>
          {nearIds.map((id) => (
            <StopBlock key={id} engine={engine} stopId={id} now={now} />
          ))}
        </section>
      )}

      <div className="simple-foot">
        {/* serveis secundaris: no competeixen amb «On vols anar?» */}
        <nav className="services-row" aria-label={t.fares.services}>
          <a href="/tarifes" onClick={(e) => (e.preventDefault(), useApp.getState().navigate({ name: 'fares' }))}>
            {t.fares.nav}
          </a>
          <a href="/punts-de-venda" onClick={(e) => (e.preventDefault(), useApp.getState().navigate({ name: 'sales' }))}>
            {t.fares.where}
          </a>
        </nav>
        <InstallButton />
      </div>
    </aside>
  );
}
