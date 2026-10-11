/**
 * Com hi arribo (/ruta/<destí>): de la meva ubicació (o d'on triï) a un carrer o una parada, en bus.
 * Proposa les opcions per hora d'arribada; la triada es dibuixa al mapa i es pot seguir amb
 * «Vaig a agafar aquest bus». La ubicació només es fa servir al dispositiu.
 */
import { useEffect, useMemo, useState } from 'react';
import { localDate, normalize, serviceDayOrigin, type BusLeg, type Itinerary, type LonLat, type PlanResult, type SimEngine } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { loadStreets, placeById, searchPlaces, streetById, type Gazetteer, type Place as Poi, type Street } from '../data/streets.ts';
import { planFor, vehicleById } from '../data/vehicles.ts';
import { Icon, IconButton, Punctuality, RouteChip, hm, useNow } from '../ui/common.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { dedupe, geoCode, parseGeoCode, rankPlaces, useRemotePlaces } from '../data/places.ts';
import { useLocation } from '../location/location.ts';
import { LocationStatus } from './LocationStatus.tsx';

export interface Place {
  code: string;
  name: string;
  where: string | null;
  pts: LonLat[];
}

/** «Sabadell · prop de La Creu Alta»: distingeix carrers amb el mateix nom */
export const placeWhere = (s: Street, t: ReturnType<typeof useT>) => [s.muni, s.barri ?? t.plan.near(s.near)].filter(Boolean).join(' · ');
/** «Piscina · Sabadell · Can Llong» */
export const poiWhere = (p: Poi, t: ReturnType<typeof useT>) => [t.plan.kinds[p.kind] ?? null, p.muni, p.barri ?? t.plan.near(p.near)].filter(Boolean).join(' · ');

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60000));

/** Un lloc a partir del seu codi: c<id> = carrer, l<id> = lloc (OSM), p<id> = parada, g<lon>,<lat>,<nom> = lloc del cercador universal. */
function usePlace(code: string | undefined): Place | null | undefined {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const [gz, setGz] = useState<Gazetteer | null | undefined>(undefined);
  const needs = Boolean(code && (code.startsWith('c') || code.startsWith('l')));
  useEffect(() => {
    if (!needs) return;
    let live = true;
    loadStreets()
      .then((g) => live && setGz(g))
      .catch(() => live && setGz(null));
    return () => {
      live = false;
    };
  }, [needs]);
  if (!code) return null;
  if (code.startsWith('g')) {
    const g = parseGeoCode(code);
    return g ? { code, name: g.name, where: g.label, pts: [g.pt] } : null;
  }
  if (code.startsWith('p')) {
    const s = engine?.stops.get(code.slice(1));
    return s ? { code, name: s.name, where: t.stop, pts: [[s.lon, s.lat]] } : null;
  }
  if (gz === undefined) return undefined;
  if (code.startsWith('l')) {
    const p = gz ? placeById(gz, code.slice(1)) : undefined;
    return p ? { code, name: p.name, where: poiWhere(p, t), pts: [p.pt] } : null;
  }
  const street = gz ? streetById(gz, code.slice(1)) : undefined;
  return street ? { code, name: street.name, where: placeWhere(street, t), pts: street.pts } : null;
}

/** Buscador de lloc (carrers i parades) per triar d'on surto. */
export function PlaceSearch({ placeholder, onPick, autoFocus = false }: { placeholder: string; onPick: (code: string) => void; autoFocus?: boolean }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const [q, setQ] = useState('');
  const [gz, setGz] = useState<Gazetteer | null>(null);
  useEffect(() => {
    void loadStreets().then(setGz).catch(() => undefined);
  }, []);
  const lang = useApp((s) => s.lang);
  const userPos = useApp((s) => s.userPos);
  const remote = useRemotePlaces(q, lang);
  const res = useMemo(() => {
    if (!q.trim() || !engine) return { streets: [] as Street[], places: [] as Poi[], stops: [] as { id: string; name: string }[] };
    const nq = normalize(q);
    const seen = new Set<string>();
    const stops = [...engine.stops.values()].filter((s) => normalize(s.name).includes(nq) && !seen.has(s.name) && seen.add(s.name)).slice(0, 3);
    const found = gz ? searchPlaces(gz, q, 4) : { streets: [], places: [] };
    return { ...found, stops };
  }, [q, gz, engine]);
  return (
    <div className="place-search">
      <label className="search-field">
        {Icon.search}
        <input type="search" value={q} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setQ(e.target.value)} />
      </label>
      {q.trim() && (
        <ul className="place-results">
          {res.places.map((p) => (
            <li key={`l${p.id}`}>
              <button type="button" onClick={() => onPick(`l${p.id}`)}>
                {Icon.home}
                <span className="sr-main">{p.name}</span>
                <span className="dim small">{poiWhere(p, t)}</span>
              </button>
            </li>
          ))}
          {rankPlaces(dedupe(remote.data?.results ?? [], res.places), q, userPos)
            .slice(0, 4)
            .map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPick(geoCode(p))}>
                  {Icon.home}
                  <span className="sr-main">{p.name}</span>
                  <span className="dim small">{p.label}</span>
                </button>
              </li>
            ))}
          {res.streets.map((s) => (
            <li key={`c${s.id}`}>
              <button type="button" onClick={() => onPick(`c${s.id}`)}>
                {Icon.home}
                <span className="sr-main">{s.name}</span>
                <span className="dim small">{placeWhere(s, t)}</span>
              </button>
            </li>
          ))}
          {res.stops.map((s) => (
            <li key={`p${s.id}`}>
              <button type="button" onClick={() => onPick(`p${s.id}`)}>
                <span className="stop-dot" aria-hidden />
                <span className="sr-main">{s.name}</span>
                <span className="dim small">{t.stop}</span>
              </button>
            </li>
          ))}
          {remote.status === 'loading' && <li className="dim sr-empty">{t.find.searching}</li>}
          {res.streets.length === 0 && res.places.length === 0 && res.stops.length === 0 && remote.status !== 'loading' && !remote.data?.results.length && <li className="dim sr-empty">{t.find.notFound}</li>}
        </ul>
      )}
    </div>
  );
}

/** On és ara el bus d'un tram, respecte de la parada on hi pujo. */
function busStatus(engine: SimEngine, leg: BusLeg, now: number, t: ReturnType<typeof useT>): string {
  if (!leg.vehicleId) return t.plan.busPending;
  const v = vehicleById(engine, leg.vehicleId, now);
  if (!v || v.patternId !== leg.patternId) return t.plan.busPending;
  if (v.atStopIndex === leg.boardIndex) return t.plan.busNow(0);
  return t.plan.busNow(leg.boardIndex - v.nextStopIndex + 1);
}

/** «PUJA A / BAIXA A»: una pujada i una baixada per tram de bus (amb transbord, dos). */
function BusSegment({ leg, engine, now, first, walkToBoard, destAway }: { leg: BusLeg; engine: SimEngine; now: number; first: boolean; walkToBoard: number; destAway?: { name: string; m: number } | null }) {
  const t = useT();
  const route = engine.routes.get(leg.routeId);
  const name = (id: string) => engine.stops.get(id)?.name ?? id;
  const mins = minutes(leg.depart - now);
  return (
    <div className="rseg" style={{ ['--c' as string]: route?.color ?? '#888' }}>
      <div className="seg-line">
        <RouteChip route={route} size="lg" />
        <span className="seg-dir">
          {t.res.direction} <strong>{leg.headsign}</strong>
        </span>
      </div>
      <div className="seg-row">
        <div className="seg-stop">
          <span className="seg-label">{first ? t.res.boardAt : t.res.changeAt}</span>
          <strong>{name(leg.boardStopId)}</strong>
          {first && walkToBoard >= 30 && <span className="dim small">{t.res.metersAway(walkToBoard)}</span>}
        </div>
        <div className="seg-eta">
          <span className="seg-label">{t.res.arrivesIn}</span>
          <span className="seg-min">
            {mins <= 0 ? t.res.now : mins}
            {mins > 0 && <small> min</small>}
          </span>
        </div>
      </div>
      <div className="seg-status">
        {busStatus(engine, leg, now, t)}
        <Punctuality delaySec={Math.round((leg.depart - leg.scheduledDepart) / 1000)} source={leg.source} compact />
      </div>
      <div className="seg-row seg-off">
        <div className="seg-stop">
          <span className="seg-label">{t.res.alightAt}</span>
          <strong>{name(leg.alightStopId)}</strong>
          <span className="dim small">{t.res.stopsCount(leg.stops)}</span>
        </div>
        <span className="seg-time mono">{hm(leg.arrive)}</span>
      </div>
      {destAway && (
        <p className="seg-dest">
          {Icon.locate} {t.res.destAway(destAway.name, destAway.m)}
        </p>
      )}
    </div>
  );
}

/** Recorregut del bus des d'on puges fins on baixes (parades en ordre). */
function RideStops({ leg, engine }: { leg: BusLeg; engine: SimEngine }) {
  const p = engine.patternById(leg.patternId);
  const route = engine.routes.get(leg.routeId);
  if (!p) return null;
  const ids = p.stopIds.slice(leg.boardIndex, leg.alightIndex + 1);
  return (
    <ol className="ride-stops" style={{ ['--c' as string]: route?.color ?? '#888' }}>
      {ids.map((id, k) => (
        <li key={`${id}-${k}`} className={k === 0 ? 'board' : k === ids.length - 1 ? 'alight' : ''}>
          {engine.stops.get(id)?.name ?? id}
        </li>
      ))}
    </ol>
  );
}

/** La millor opció: què agafar, on pujar, quan passa, on baixar; i les accions. */
/** Anar-hi a peu, quan és la millor opció: primer, gran i sense ambigüitat */
function WalkBest({ walk, now }: { walk: { meters: number; start: number; end: number }; now: number }) {
  const t = useT();
  const m = Math.max(1, minutes(walk.end - walk.start));
  return (
    <section className="best best-walk" aria-label={`${t.res.best}: ${t.res.onFoot}`}>
      <div className="best-tag">{t.res.best}</div>
      <p className="best-walk-title">
        {Icon.walk} {t.res.onFoot}
      </p>
      <p className="best-walk-main">{m} min</p>
      <p className="best-walk-sub">{t.res.walkBest(walk.meters)}</p>
      <p className="best-summary">{t.res.arriveAt(hm(now + (walk.end - walk.start)))}</p>
    </section>
  );
}

function BestOption({ it, engine, now, destName, tag }: { it: Itinerary; engine: SimEngine; now: number; destName: string; tag?: string }) {
  const t = useT();
  const st = useApp.getState();
  const [showRoute, setShowRoute] = useState(false);
  const buses = it.legs.filter((l): l is BusLeg => l.kind === 'bus');
  const first = buses[0]!;
  const walkToBoard = it.legs[0]?.kind === 'walk' ? it.legs[0].meters : 0;
  const lastLeg = it.legs[it.legs.length - 1];
  const destAway = destName ? { name: destName, m: lastLeg?.kind === 'walk' ? lastLeg.meters : 0 } : null;
  // «On és el bus» només si el bus ja fa el trajecte que agafaràs (si no, encara fa l'anterior, en sentit contrari)
  const live = Boolean(first.vehicleId && vehicleById(engine, first.vehicleId, now)?.patternId === first.patternId);
  return (
    <section className={`best${tag ? ' best-alt' : ''}`} aria-label={tag ?? t.res.best}>
      <div className="best-tag">{tag ?? t.res.best}</div>
      {buses.map((leg, i) => (
        <BusSegment key={leg.tripKey} leg={leg} engine={engine} now={now} first={i === 0} walkToBoard={walkToBoard} destAway={i === buses.length - 1 ? destAway : null} />
      ))}
      <p className="best-summary">
        {/* el que compta amb pressa: quant falta per arribar, des d'ara */}
        {t.res.total(Math.max(1, minutes(it.arrive - now)))} · {t.res.arriveAt(hm(it.arrive))}
        {it.transfers > 0 && ` · ${t.plan.transfers(it.transfers)}`}
      </p>
      <div className="best-ctas">
        {first.vehicleId && (
          <button
            type="button"
            className="cta cta-primary"
            onClick={() => {
              st.startTrip({ vehicleId: first.vehicleId!, patternId: first.patternId, routeId: first.routeId, boardIndex: first.boardIndex, boardStopId: first.boardStopId, alightIndex: first.alightIndex });
              st.setFollow(true);
              st.navigate({ name: 'map' });
            }}
          >
            {Icon.board} {t.res.followBus}
          </button>
        )}
        {live && (
          <button
            type="button"
            className="cta"
            onClick={() => {
              // la parada on puges: «Agafaré aquest bus» a la fitxa ja la sap; i el mapa va fins al bus
              st.set({ boardHint: first.boardStopId });
              st.selectBus(first.vehicleId);
              st.setFollow(true);
            }}
          >
            {Icon.follow} {t.res.whereIsBus}
          </button>
        )}
        <button type="button" className="text-btn" aria-expanded={showRoute} onClick={() => setShowRoute(!showRoute)}>
          {Icon.line} {showRoute ? t.res.hideRoute : t.res.showRoute}
        </button>
      </div>
      {showRoute && buses.map((leg) => <RideStops key={leg.tripKey} leg={leg} engine={engine} />)}
    </section>
  );
}

/** Una altra opció, compacta: línia, direcció, quan passa i quant dura. */
function AltOption({ it, engine, now, onPick }: { it: Itinerary; engine: SimEngine; now: number; onPick: () => void }) {
  const t = useT();
  const buses = it.legs.filter((l): l is BusLeg => l.kind === 'bus');
  const first = buses[0]!;
  const last = buses[buses.length - 1]!;
  const mins = minutes(first.depart - now);
  return (
    <button type="button" className="alt" onClick={onPick}>
      <span className="alt-lines">
        {buses.map((l) => (
          <RouteChip key={l.tripKey} route={engine.routes.get(l.routeId)} size="md" />
        ))}
      </span>
      <span className="alt-main">
        <strong>
          {t.res.direction} {first.headsign}
        </strong>
        <span className="dim small">
          {t.res.boardShort(engine.stops.get(first.boardStopId)?.name ?? '')} · {t.res.ride(Math.max(1, minutes(last.arrive - first.depart)))}
        </span>
      </span>
      <span className="alt-min">{mins <= 0 ? t.res.now : `${mins} min`}</span>
    </button>
  );
}

type Origin = { status: 'ok'; pt: LonLat; label: string } | { status: 'locating' | 'denied' | 'loading' };

export function RoutePanel({ to, from }: { to: string; from?: string }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const userPos = useApp((s) => s.userPos);
  const selectedBus = useApp((s) => s.selectedBus);
  const now = useNow(1000);
  const st = useApp.getState();
  const dest = usePlace(to);
  const fromPlace = usePlace(from);
  const locStatus = useLocation((s) => s.status);
  const denied = locStatus === 'denied' || locStatus === 'timeout' || locStatus === 'unavailable' || locStatus === 'unsupported' || locStatus === 'prompt';
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState(0);
  const [result, setResult] = useState<PlanResult | null>(null);
  // quan: ara, sortir a una hora o arribar abans d'una hora (PPT 2024 §2.2.1)
  const [when, setWhen] = useState<'now' | 'depart' | 'arrive'>('now');
  const [hhmmIn, setHhmmIn] = useState(() => hm(clock.now() + 30 * 60_000));

  // la meva ubicació: la porta LocationService (s'engega en obrir l'app; només al dispositiu)

  const origin: Origin = from
    ? fromPlace
      ? { status: 'ok', pt: fromPlace.pts[Math.floor(fromPlace.pts.length / 2)]!, label: fromPlace.name }
      : { status: 'loading' }
    : userPos
      ? { status: 'ok', pt: userPos, label: t.plan.myLocation }
      : { status: denied ? 'denied' : 'locating' };

  // es recalcula cada 30 s (els busos avancen) i quan canvia l'origen o el destí
  const tick = Math.floor(now / 30000);
  const originKey = origin.status === 'ok' ? origin.pt.join(',') : origin.status;
  useEffect(() => {
    if (!engine || !dest || origin.status !== 'ok') return;
    const at = (() => {
      if (when === 'now') return clock.now();
      const m = /^(\d{1,2}):(\d{2})$/.exec(hhmmIn);
      if (!m) return clock.now();
      return serviceDayOrigin(localDate(clock.now())) + (Number(m[1]) * 60 + Number(m[2])) * 60_000;
    })();
    const id = setTimeout(() => setResult(planFor(engine, origin.pt, dest.pts, at, when === 'arrive' ? 'arrive' : 'depart')), 0);
    return () => clearTimeout(id);
  }, [engine, dest?.code, originKey, when === 'now' ? tick : 0, when, hhmmIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const openGoogleMaps = () => {
    if (origin.status !== 'ok' || !dest) return;
    const d = dest.pts[Math.floor(dest.pts.length / 2)]!;
    // només en prémer: Google rep l'origen i el destí (l'usuari ho ha triat)
    const u = new URL('https://www.google.com/maps/dir/');
    u.searchParams.set('api', '1');
    u.searchParams.set('origin', `${origin.pt[1].toFixed(5)},${origin.pt[0].toFixed(5)}`);
    u.searchParams.set('destination', `${d[1].toFixed(5)},${d[0].toFixed(5)}`);
    u.searchParams.set('travelmode', 'transit');
    window.open(u.toString(), '_blank', 'noopener,noreferrer');
  };

  const options = result?.itineraries ?? [];
  const chosen = options[Math.min(sel, options.length - 1)] ?? null;
  useEffect(() => {
    if (chosen && dest && origin.status === 'ok') st.set({ plan: { itinerary: chosen, from: origin.pt, dest: (chosen.legs[chosen.legs.length - 1] as { to: LonLat }).to, destName: dest.name } });
    else st.set({ plan: null });
  }, [chosen, dest?.code, originKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => useApp.getState().set({ plan: null }), []);

  if (!engine) return null;
  // amb un bus triat, la fitxa del bus ocupa el panell (en tancar-la es torna aquí)
  if (selectedBus) return null;
  const close = () => st.back();
  const setFrom = (code: string | undefined) => {
    setPicking(false);
    setSel(0);
    setResult(null);
    st.navigate({ name: 'route', to, from: code }, { replace: true });
  };

  return (
    <Sheet label={t.plan.title} onClose={close} className="route-panel">
      <header className="card-head">
        <div>
          <div className="eyebrow">{t.plan.title}</div>
          <h2 className="stop-name">{dest ? dest.name : dest === null ? '—' : '…'}</h2>
          {dest?.where && <div className="dim small">{dest.where}</div>}
        </div>
        <div className="card-actions">
          <IconButton label={t.close} onClick={close}>
            {Icon.close}
          </IconButton>
        </div>
      </header>

      <div className="plan-from">
        <span className="plan-from-label">{t.plan.from}</span>
        <span className="plan-from-name">
          {origin.status === 'ok' ? (!from ? <>{Icon.locate} {origin.label}</> : origin.label) : origin.status === 'locating' ? t.plan.locating : origin.status === 'denied' ? '—' : '…'}
        </span>
        <button type="button" className="text-btn" onClick={() => setPicking(!picking)} aria-expanded={picking}>
          {t.plan.change}
        </button>
      </div>
      {(picking || origin.status === 'denied' || result?.reason === 'origin-far') && (
        <div className="plan-pick">
          {origin.status === 'denied' && <LocationStatus />}
          {result?.reason === 'origin-far' && <p className="dim">{t.plan.originFar}</p>}
          <PlaceSearch placeholder={t.plan.chooseFrom} onPick={(c) => setFrom(c)} autoFocus={picking} />
          {from && (
            <button type="button" className="text-btn" onClick={() => setFrom(undefined)}>
              {Icon.locate} {t.plan.myLocation}
            </button>
          )}
        </div>
      )}

      <div className="plan-when" role="group" aria-label={t.plan.whenLabel}>
        {(['now', 'depart', 'arrive'] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} className={when === w ? 'on' : ''} onClick={() => (setWhen(w), setSel(0), setResult(null))}>
            {w === 'now' ? t.plan.whenNow : w === 'depart' ? t.plan.departAt : t.plan.arriveBy}
          </button>
        ))}
        {when !== 'now' && (
          <label className="plan-time">
            <span className="sr-only">{t.plan.timeLabel}</span>
            <input type="time" value={hhmmIn} onChange={(e) => (setHhmmIn(e.target.value), setResult(null))} required />
          </label>
        )}
      </div>

      {origin.status === 'ok' && dest && !result && <p className="dim plan-msg">{t.plan.calculating}</p>}
      {result?.reason === 'destination-far' && <p className="plan-msg">{t.plan.destFar}</p>}
      {result?.reason === 'no-service' && <p className="plan-msg">{t.plan.none}</p>}

      {/* si a peu és millor, és la primera opció; el bus queda com a alternativa */}
      {result?.walk && result.walkIsBetter && <WalkBest walk={result.walk} now={now} />}
      {chosen && dest && (
        <BestOption
          key={chosen.legs.map((l) => (l.kind === 'bus' ? l.tripKey : '')).join('>')}
          it={chosen}
          engine={engine}
          now={now}
          destName={dest.code.startsWith('p') ? '' : dest.name}
          tag={result?.walkIsBetter ? t.res.byBus : undefined}
        />
      )}
      {options.length > 1 && (
        <section className="alts" aria-label={t.res.others}>
          <h3 className="sec-title">{t.res.others}</h3>
          {options.map((it, i) =>
            it === chosen ? null : <AltOption key={it.legs.map((l) => (l.kind === 'bus' ? l.tripKey : '')).join('>')} it={it} engine={engine} now={now} onPick={() => setSel(i)} />,
          )}
        </section>
      )}
      {origin.status === 'ok' && dest && (
        <p className="plan-gmaps">
          <button type="button" className="text-btn" onClick={openGoogleMaps}>
            {t.plan.gmaps} ↗
          </button>
          <span className="dim small"> {t.plan.gmapsHint}</span>
        </p>
      )}
      <p className="dim small plan-note">{t.plan.note}</p>
    </Sheet>
  );
}
