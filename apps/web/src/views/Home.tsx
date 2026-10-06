/**
 * Inici: "La meva parada". Respon en un cop d'ull quins busos vénen, quan i a quantes
 * parades són. Les parades suggerides són parades reals de la xarxa (no s'inventen).
 */
import { useMemo } from 'react';
import { normalize, type SimEngine } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { areaOf, liveArrivals, type LiveArrival } from '../data/derive.ts';
import { Icon, RouteChip, useNow } from '../ui/common.tsx';
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

function StopBlock({ engine, stopId, now, primary }: { engine: SimEngine; stopId: string; now: number; primary: boolean }) {
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
    <div className={`home-stop${primary ? ' primary' : ''}`}>
      <button type="button" className="home-stop-head" onClick={() => st.navigate({ name: 'stop', id: stopId })}>
        <span className="stop-dot" aria-hidden />
        <span className="home-stop-name">{stop.name}</span>
        <span className="chips">
          {[...new Set(area.flatMap((s) => engine.stops.get(s)?.routes ?? []))].slice(0, 6).map((r) => (
            <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
          ))}
        </span>
      </button>
      {list.length === 0 ? (
        <div className="dim small home-empty">{t.noArrivals}</div>
      ) : (
        <ul className="arrivals compact">
          {list.slice(0, primary ? 4 : 2).map((a) => (
            <li key={`${a.routeId}|${a.headsign}|${a.at}`} className="arrival">
              <ArrivalRow a={a} now={now} onOpen={open} engine={engine} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HomePanel() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const favorites = useApp((s) => s.favorites);
  const collapsed = useApp((s) => s.homeCollapsed);
  const now = useNow(1000);
  const st = useApp.getState();
  const suggestions = useMemo(() => (engine ? suggestedStops(engine) : []), [engine]);
  if (!engine) return null;
  const favs = favorites.filter((id) => engine.stops.has(id));
  if (collapsed)
    return (
      <button type="button" className="home-pill" onClick={() => st.set({ homeCollapsed: false })} aria-label={t.home.expand}>
        {Icon.home} <span>{t.home.title}</span>
      </button>
    );
  return (
    <aside className="home" aria-label={t.home.title}>
      <header className="home-head">
        <h2>
          {Icon.home} {favs.length ? t.home.title : t.home.choose}
        </h2>
        <button type="button" className="icon-btn sm" onClick={() => st.set({ homeCollapsed: true })} aria-label={t.home.collapse}>
          {Icon.chevron(true)}
        </button>
      </header>
      {favs.length > 0 ? (
        favs.slice(0, 3).map((id, i) => <StopBlock key={id} engine={engine} stopId={id} now={now} primary={i === 0} />)
      ) : (
        <>
          <p className="dim small home-hint">{t.home.empty}</p>
          <div className="section-title">{t.home.suggestions}</div>
          <div className="home-sugg">
            {suggestions.map((id) => (
              <button key={id} type="button" className="sugg" onClick={() => st.navigate({ name: 'stop', id })}>
                {engine.stops.get(id)?.name}
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
