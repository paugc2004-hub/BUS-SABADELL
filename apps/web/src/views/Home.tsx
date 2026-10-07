/**
 * Inici. Respon primer la pregunta "vull agafar el bus: quin ve, quant falta?" i
 * després dona accés a tot el demés (les meves parades, a prop meu, mapa en directe).
 * Les parades suggerides són parades reals de la xarxa (no s'inventen).
 */
import { useMemo } from 'react';
import { haversine, normalize, type SimEngine } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { areaOf, liveArrivals, type LiveArrival } from '../data/derive.ts';
import { journeyFor, vehiclesAt } from '../data/vehicles.ts';
import { Icon, Punctuality, RouteChip, SourceTag, hm, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
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

/** Primera llegada amb bus identificat (si n'hi ha) a la zona d'una parada. */
function firstArrival(engine: SimEngine, stopId: string, now: number): LiveArrival | null {
  const list = liveArrivals(engine, areaOf(engine, stopId), now, 60, 20);
  return list.find((a) => a.vehicleId && a.stopsAway !== null && a.stopsAway >= 0) ?? list[0] ?? null;
}

/** "El teu proper bus": la peça principal de l'inici. */
function NextBusHero({ engine, stopId, example, now }: { engine: SimEngine; stopId: string; example: boolean; now: number }) {
  const t = useT();
  const st = useApp.getState();
  const tick = Math.floor(now / 5000);
  const a = useMemo(() => firstArrival(engine, stopId, now), [engine, stopId, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = engine.stops.get(stopId)!;
  const route = a ? engine.routes.get(a.routeId) : undefined;
  const v = a?.vehicle && a.vehicle.patternId === a.patternId ? a.vehicle : null;
  const j = v ? journeyFor(engine, v.id, now) : null;
  // tram que li falta al bus fins a la parada: de l'última parada feta a la nostra
  const from = v ? Math.max(0, v.prevStopIndex) : 0;
  const to = a?.stopIndex ?? 0;
  const seg = j && v && to > from ? j.stops.slice(from, to + 1) : [];
  const p = v ? engine.patternById(v.patternId) : null;
  const span = p && seg.length > 1 ? p.stopDist[to]! - p.stopDist[from]! : 0;
  const busPct = p && span > 0 ? Math.min(100, Math.max(0, ((v!.dist - p.stopDist[from]!) / span) * 100)) : 0;
  const mins = a ? Math.max(0, Math.floor((a.at - now) / 60000)) : 0;

  return (
    <section className="hero" aria-label={t.hero.title} style={{ ['--c' as string]: route?.color ?? 'var(--text)' }}>
      <div className="hero-top">
        <span className="hero-eyebrow">{t.hero.title}</span>
        <button type="button" className="hero-stop" onClick={() => st.navigate({ name: 'stop', id: stopId })}>
          {example && <span className="hero-example">{t.hero.example} · </span>}
          {t.hero.atStop(stop.name)} ›
        </button>
      </div>
      {!a ? (
        <p className="hero-none">{t.hero.none}</p>
      ) : (
        <>
          <button type="button" className="hero-main" onClick={() => a.vehicleId && (st.set({ boardHint: a.stopId }), st.navigate({ name: 'stop', id: a.stopId }), st.selectBus(a.vehicleId))} disabled={!a.vehicleId}>
            <div className="hero-line">
              <RouteChip route={route} size="lg" />
              <span className="hero-dest">
                <span aria-hidden>→ </span>
                {a.headsign}
              </span>
            </div>
            <div className="hero-eta">
              {mins > 0 && mins < 60 && <span className="hero-in">{t.trip.arrivesIn}</span>}
              <span className={`hero-min mono${mins <= 0 ? ' now' : ''}`}>{mins <= 0 ? t.nowLabel : mins >= 60 ? hm(a.at) : mins}</span>
              {mins > 0 && mins < 60 && <span className="hero-unit">min</span>}
            </div>
          </button>
          <div className="hero-meta">
            <span className={a.stopsAway !== null && a.stopsAway <= 2 ? 'near' : ''}>
              {a.stopsAway !== null ? t.stopsAway(a.stopsAway) : a.status === 'PENDENT_SORTIDA' ? t.pendingAtTerminal(hm(a.at)) : t.finishingTrip}
            </span>
            <Punctuality delaySec={a.delaySec} source={a.source} />
            {/* hora programada vs prevista: la diferència és el retard (avui simulat) */}
            <span className="dim">{Math.round((a.at - a.scheduledAt) / 60000) !== 0 ? t.schedVsEst(hm(a.scheduledAt), hm(a.at)) : t.estAt(hm(a.at))}</span>
          </div>
          {seg.length > 1 && (
            <div className="hero-track" aria-hidden>
              <div className="hero-rail">
                <span style={{ width: `${busPct.toFixed(1)}%` }} />
              </div>
              {seg.map((s, k) => (
                <span key={s.index} className={`hero-dot${k === seg.length - 1 ? ' mine' : ''}`} style={{ left: `${p ? ((p.stopDist[s.index]! - p.stopDist[from]!) / span) * 100 : 0}%` }} />
              ))}
              <span className="hero-bus" style={{ left: `${busPct.toFixed(1)}%` }}>
                <BusVehicleMarker route={route} status={v!.status} heading={90} size={22} showLabel={false} />
              </span>
            </div>
          )}
          {v && (
            <div className="hero-ctas">
              <button
                type="button"
                className="cta cta-primary"
                onClick={() => {
                  st.startTrip({ vehicleId: v.id, patternId: v.patternId, routeId: v.routeId, boardIndex: a.stopIndex, boardStopId: a.stopId, alightIndex: null });
                  st.navigate({ name: 'map' });
                }}
              >
                {Icon.board} {t.takeBus}
              </button>
              <button
                type="button"
                className="cta"
                onClick={() => {
                  st.navigate({ name: 'map' });
                  st.selectBus(v.id);
                  st.setFollow(true);
                }}
              >
                {Icon.follow} {t.followBus}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
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

export function HomePanel({ autoFocus = false }: { autoFocus?: boolean }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const favorites = useApp((s) => s.favorites);
  const userPos = useApp((s) => s.userPos);
  const now = useNow(1000);
  const st = useApp.getState();
  const suggestions = useMemo(() => (engine ? suggestedStops(engine) : []), [engine]);
  const near = useMemo(() => (engine && userPos ? nearestStops(engine, userPos) : []), [engine, userPos]);
  const fleet = useMemo(() => {
    if (!engine) return { n: 0, l: 0 };
    const vs = vehiclesAt(engine, now).filter((v) => v.status !== 'RETIRADA');
    return { n: vs.length, l: new Set(vs.map((v) => v.routeId)).size };
  }, [engine, Math.floor(now / 10000)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!engine || !network) return null;
  const favs = favorites.filter((id) => engine.stops.has(id));
  // el proper bus: de la primera parada desada; si no n'hi ha, de la més propera; si no, un exemple real
  const heroStop = favs[0] ?? near[0] ?? suggestions[0]!;
  const example = !favs[0] && !near[0];

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => st.set({ userPos: [p.coords.longitude, p.coords.latitude] }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <aside className="home" aria-label={t.nav2.home}>
      <SearchBox autoFocus={autoFocus} />
      {heroStop && <NextBusHero engine={engine} stopId={heroStop} example={example} now={now} />}

      <HomeStops skip={heroStop} />

      <section className="home-sec">
        <h2 className="sec-title">
          {Icon.locate} {t.nearMe}
        </h2>
        {near.length === 0 ? (
          <button type="button" className="cta cta-wide" onClick={locate}>
            {Icon.locate} {t.nearMe}
            <span className="dim cta-sub">{t.nearHint}</span>
          </button>
        ) : (
          near.filter((id) => id !== heroStop).slice(0, 2).map((id) => <StopBlock key={id} engine={engine} stopId={id} now={now} />)
        )}
      </section>

      <button type="button" className="map-entry" onClick={() => st.navigate({ name: 'map' })}>
        <span className="map-entry-dot" aria-hidden />
        <span>
          <strong>{t.mapEntry}</strong>
          <span className="dim">{t.mapEntrySub(fleet.n, fleet.l)}</span>
        </span>
        <span aria-hidden>→</span>
      </button>
      <div className="home-foot">
        <SourceTag source="SIMULATED" />
        <span className="dim">{t.bannerShort}</span>
      </div>
    </aside>
  );
}
