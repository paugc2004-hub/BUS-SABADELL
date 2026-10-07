/**
 * Com hi arribo (/ruta/<destí>): de la meva ubicació (o d'on triï) a un carrer o una parada, en bus.
 * Proposa les opcions per hora d'arribada; la triada es dibuixa al mapa i es pot seguir amb
 * «Vaig a agafar aquest bus». La ubicació només es fa servir al dispositiu.
 */
import { useEffect, useMemo, useState } from 'react';
import { normalize, type BusLeg, type Itinerary, type LonLat, type PlanResult, type SimEngine } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { loadStreets, placeById, searchPlaces, streetById, type Gazetteer, type Place as Poi, type Street } from '../data/streets.ts';
import { planFor, vehicleById } from '../data/vehicles.ts';
import { Icon, IconButton, Punctuality, RouteChip, hm, useNow } from '../ui/common.tsx';
import { Sheet } from '../ui/Sheet.tsx';

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

/** Un lloc a partir del seu codi: c<id> = carrer, l<id> = lloc (OSM), p<id> = parada. */
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
          {res.streets.length === 0 && res.places.length === 0 && res.stops.length === 0 && <li className="dim sr-empty">{t.searchEmpty}</li>}
        </ul>
      )}
    </div>
  );
}

/** Resum d'una opció: 🚶 3 › L2 › 🚶 2 */
function LegsSummary({ it, engine }: { it: Itinerary; engine: SimEngine }) {
  const items = it.legs.flatMap((l, i) => {
    if (l.kind === 'walk') {
      const m = minutes(l.end - l.start);
      return m < 1
        ? []
        : [
            <span key={i} className="legs-walk">
              {Icon.walk}
              {m}
            </span>,
          ];
    }
    return [<RouteChip key={i} route={engine.routes.get(l.routeId)} size="sm" />];
  });
  return (
    <span className="legs">
      {items.map((el, i) => (
        <span key={i} className="legs-item">
          {i > 0 && (
            <span className="legs-sep" aria-hidden>
              ›
            </span>
          )}
          {el}
        </span>
      ))}
    </span>
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

function Steps({ it, engine, dest, now }: { it: Itinerary; engine: SimEngine; dest: Place; now: number }) {
  const t = useT();
  const st = useApp.getState();
  const name = (id: string) => engine.stops.get(id)?.name ?? id;
  const firstBus = it.legs.find((l): l is BusLeg => l.kind === 'bus')!;
  return (
    <div className="plan-steps">
      <ol>
        {it.legs.map((l, i) => {
          if (l.kind === 'walk') {
            if (l.meters < 30) return null;
            const next = it.legs[i + 1];
            const prev = it.legs[i - 1];
            const text =
              i === 0 && next?.kind === 'bus'
                ? t.plan.walkTo(name(next.boardStopId), l.meters, minutes(l.end - l.start))
                : i === it.legs.length - 1
                  ? t.plan.walkEnd(dest.name, l.meters, minutes(l.end - l.start))
                  : t.plan.walkTransfer(next?.kind === 'bus' ? name(next.boardStopId) : prev?.kind === 'bus' ? name(prev.alightStopId) : '', l.meters);
            return (
              <li key={i} className="step walk">
                <span className="step-ico">{Icon.walk}</span>
                <span>{text}</span>
              </li>
            );
          }
          const route = engine.routes.get(l.routeId);
          const delay = Math.round((l.depart - l.scheduledDepart) / 1000);
          return (
            <li key={i} className="step bus" style={{ ['--c' as string]: route?.color ?? '#888' }}>
              <span className="step-ico">
                <RouteChip route={route} size="sm" />
              </span>
              <div>
                <strong>{t.plan.take(route?.ref ?? l.routeId, l.headsign)}</strong>
                <div className="dim">
                  {t.plan.at(name(l.boardStopId), hm(l.depart))} <Punctuality delaySec={delay} source={l.source} compact />
                </div>
                {hm(l.depart) !== hm(l.scheduledDepart) && <div className="dim small">{t.schedVsEst(hm(l.scheduledDepart), hm(l.depart))}</div>}
                {l === firstBus && <div className="step-live">{busStatus(engine, l, now, t)}</div>}
                <div className="step-off">
                  {t.plan.getOff(name(l.alightStopId), l.stops)} · {hm(l.arrive)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="plan-ctas">
        {firstBus.vehicleId && (
          <button
            type="button"
            className="cta cta-primary"
            onClick={() => {
              st.startTrip({
                vehicleId: firstBus.vehicleId!,
                patternId: firstBus.patternId,
                routeId: firstBus.routeId,
                boardIndex: firstBus.boardIndex,
                boardStopId: firstBus.boardStopId,
                alightIndex: firstBus.alightIndex,
              });
              st.navigate({ name: 'map' });
            }}
          >
            {Icon.board} {t.plan.take1}
          </button>
        )}
        {firstBus.vehicleId && (
          <button type="button" className="cta" onClick={() => st.selectBus(firstBus.vehicleId)}>
            {Icon.follow} {t.plan.seeBus}
          </button>
        )}
      </div>
    </div>
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
  const [denied, setDenied] = useState(false);
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState(0);
  const [result, setResult] = useState<PlanResult | null>(null);

  // la meva ubicació (només al dispositiu)
  useEffect(() => {
    if (from || userPos) return;
    if (!navigator.geolocation) return setDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => st.set({ userPos: [p.coords.longitude, p.coords.latitude] }),
      () => setDenied(true),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [from, userPos]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const id = setTimeout(() => setResult(planFor(engine, origin.pt, dest.pts, clock.now())), 0);
    return () => clearTimeout(id);
  }, [engine, dest?.code, originKey, tick]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {origin.status === 'denied' && <p className="dim">{t.plan.denied}</p>}
          {result?.reason === 'origin-far' && <p className="dim">{t.plan.originFar}</p>}
          <PlaceSearch placeholder={t.plan.chooseFrom} onPick={(c) => setFrom(c)} autoFocus={picking} />
          {from && (
            <button type="button" className="text-btn" onClick={() => setFrom(undefined)}>
              {Icon.locate} {t.plan.myLocation}
            </button>
          )}
        </div>
      )}

      {origin.status === 'ok' && dest && !result && <p className="dim plan-msg">{t.plan.calculating}</p>}
      {result?.reason === 'destination-far' && <p className="plan-msg">{t.plan.destFar}</p>}
      {result?.reason === 'no-service' && <p className="plan-msg">{t.plan.none}</p>}

      {result?.walk && result.walkIsBetter && (
        <div className="plan-walk">
          <span className="step-ico">{Icon.walk}</span>
          <div>
            <strong>
              {t.plan.walkOnly} · {t.plan.walkMin(minutes(result.walk.end - result.walk.start))}
            </strong>
            <div className="dim small">{t.plan.walkBetter}</div>
          </div>
        </div>
      )}

      {options.length > 0 && (
        <ul className="plan-options" aria-label={t.plan.options}>
          {options.map((it, i) => {
            const on = it === chosen;
            const leave = minutes(it.leaveAt - now);
            return (
              <li key={it.legs.map((l) => (l.kind === 'bus' ? l.tripKey : '')).join('>')} className={`plan-option${on ? ' on' : ''}`}>
                <button type="button" className="plan-option-head" aria-expanded={on} onClick={() => setSel(i)}>
                  <span className="plan-leave">
                    <strong>{it.leaveAt - now < 60 * 60000 ? t.plan.leaveIn(leave) : t.plan.leaveAt(hm(it.leaveAt))}</strong>
                    <LegsSummary it={it} engine={engine} />
                  </span>
                  <span className="plan-arrive">
                    <strong className="mono">{hm(it.arrive)}</strong>
                    <span className="dim small">
                      {t.plan.total(minutes(it.arrive - Math.max(now, it.leaveAt)))} · {t.plan.transfers(it.transfers)}
                    </span>
                  </span>
                </button>
                {on && dest && <Steps it={it} engine={engine} dest={dest} now={now} />}
              </li>
            );
          })}
        </ul>
      )}
      <p className="dim small plan-note">{t.plan.note}</p>
    </Sheet>
  );
}
