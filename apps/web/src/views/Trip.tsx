/**
 * Mode viatge ("Vaig a agafar aquest bus") i alertes contextuals.
 *
 * TripPanel: targeta del viatge actiu. TripMonitor: observa el VehicleState del bus
 * (1 Hz) i llança una alerta només quan l'estat canvia de manera rellevant: a 2 parades,
 * acaba de sortir d'una parada propera, la propera és la teva, és a la teva parada,
 * baixes a la següent. Mai més d'una alerta per esdeveniment.
 */
import { useEffect, useRef, useState } from 'react';
import { stopsUntil } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById } from '../data/vehicles.ts';
import { Countdown, Icon, IconButton, Punctuality, RouteChip, SourceTag, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { whereText } from './BusCard.tsx';

type Phase = 'waiting' | 'boarding' | 'onboard' | 'arrived' | 'missed' | 'gone';

export function TripPanel() {
  const t = useT();
  const trip = useApp((s) => s.trip);
  const engine = useApp((s) => s.engine);
  const selectedBus = useApp((s) => s.selectedBus);
  const [userOpen, setOpen] = useState(true);
  const now = useNow(1000);
  if (!trip || !engine) return null;
  // al mòbil, si la fitxa del mateix bus és oberta, no es repeteix: la fitxa ja mostra el viatge
  if (window.innerWidth <= 760 && selectedBus === trip.vehicleId) return null;
  const open = userOpen;
  const st = useApp.getState();
  const v = vehicleById(engine, trip.vehicleId, now);
  const route = engine.routes.get(trip.routeId);
  const board = engine.stops.get(trip.boardStopId);
  const p = engine.patternById(trip.patternId);
  const alight = trip.alightIndex !== null && p ? engine.stops.get(p.stopIds[trip.alightIndex]!) : null;
  const phase = phaseOf(v, trip);
  const sameTrip = v && v.patternId === trip.patternId;
  const toBoard = v && sameTrip ? stopsUntil(v, trip.boardIndex) : null;
  const boardEta = v && sameTrip ? v.etas.find((e, k) => v.nextStopIndex + k === trip.boardIndex)?.at ?? null : null;
  const alightEta = v && sameTrip && trip.alightIndex !== null ? v.etas.find((e, k) => v.nextStopIndex + k === trip.alightIndex)?.at ?? null : null;
  const toAlight = v && sameTrip && trip.alightIndex !== null ? stopsUntil(v, trip.alightIndex) : null;

  return (
    <section className={`trip-card phase-${phase}${open ? '' : ' folded'}`} aria-label={t.trip.title} style={{ ['--c' as string]: route?.color ?? '#888' }}>
      <header className="trip-head">
        <button type="button" className="trip-toggle" onClick={() => setOpen(!userOpen)} aria-expanded={open}>
          <BusVehicleMarker route={route} status={v?.status ?? 'RETIRADA'} size={22} showLabel={false} />
          <RouteChip route={route} size="sm" />
          <span className="trip-title">{t.trip.title}</span>
          <span className="trip-headline mono">
            {phase === 'waiting' && boardEta ? <Countdown at={boardEta} now={now} /> : phase === 'onboard' && alightEta ? <Countdown at={alightEta} now={now} /> : null}
          </span>
          {Icon.chevron(open)}
        </button>
        <IconButton label={t.trip.end} onClick={() => st.endTrip()}>
          {Icon.close}
        </IconButton>
      </header>
      {open && (
        <div className="trip-body">
          <div className="trip-dest">
            <span className="dim">{v?.origin ?? ''}</span> <span aria-hidden>→</span> <strong>{v?.headsign ?? p?.headsign}</strong>
          </div>
          {phase === 'waiting' || phase === 'boarding' ? (
            <div className="trip-grid">
              <div>
                <div className="cell-label">{t.trip.yourStop}</div>
                <div className="cell-value">{board?.name}</div>
              </div>
              <div>
                <div className="cell-label">{t.trip.arrivesIn}</div>
                <div className="trip-big mono">{phase === 'boarding' ? t.nowLabel : boardEta ? <Countdown at={boardEta} now={now} /> : '—'}</div>
              </div>
              <div className="span2">
                <div className={`trip-away${toBoard !== null && toBoard <= 2 ? ' near' : ''}`}>
                  {toBoard !== null ? t.stopsAway(toBoard) : t.finishingTrip} {v && sameTrip && <Punctuality delaySec={v.delaySec} source={v.source} compact />}
                </div>
              </div>
            </div>
          ) : phase === 'onboard' ? (
            <div className="trip-grid">
              <div>
                <div className="cell-label">{t.trip.onBoard}</div>
                <div className="cell-value">{v ? whereText(engine, v, t) : '—'}</div>
              </div>
              {alight ? (
                <div>
                  <div className="cell-label">{t.trip.getOff}</div>
                  <div className="cell-value">{alight.name}</div>
                  <div className="trip-away">{toAlight !== null ? t.stopsAway(toAlight) : ''}</div>
                </div>
              ) : (
                <div className="dim small">{t.trip.chooseAlight}</div>
              )}
            </div>
          ) : (
            <p className="trip-msg">{phase === 'arrived' ? t.trip.done : phase === 'missed' ? t.trip.missed : t.trip.gone}</p>
          )}
          {v && sameTrip && (
            <div className="tl-bar trip-bar" aria-hidden>
              <span style={{ width: `${(v.progress * 100).toFixed(1)}%` }} />
            </div>
          )}
          <div className="trip-foot">
            {v && selectedBus !== v.id && (
              <button type="button" className="text-btn" onClick={() => st.selectBus(v.id)}>
                {Icon.follow} {t.trip.view}
              </button>
            )}
            <SourceTag source={v?.source ?? 'SIMULATED'} />
          </div>
        </div>
      )}
    </section>
  );
}

function phaseOf(v: ReturnType<typeof vehicleById>, trip: NonNullable<ReturnType<typeof useApp.getState>['trip']>): Phase {
  if (!v) return 'gone';
  if (v.patternId !== trip.patternId) {
    // encara fa l'expedició anterior (o ja l'ha acabada)
    return v.status === 'RETIRADA' || Date.now() - trip.createdAt > 6 * 3600_000 ? 'gone' : 'waiting';
  }
  const toBoard = stopsUntil(v, trip.boardIndex);
  if (toBoard > 0) return 'waiting';
  if (toBoard === 0) return 'boarding';
  if (trip.alightIndex !== null) {
    const toAlight = stopsUntil(v, trip.alightIndex);
    if (toAlight < 0 || (toAlight === 0 && v.atStopIndex === trip.alightIndex)) return 'arrived';
  }
  if (v.status === 'RETIRADA') return 'arrived';
  return 'onboard';
}

/** Alertes contextuals del viatge actiu (i del bus seguit). */
export function TripMonitor() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const trip = useApp((s) => s.trip);
  const prev = useRef<{ key: string; toBoard: number | null; toAlight: number | null; at: number | null; phase: Phase } | null>(null);

  useEffect(() => {
    if (!engine || !trip) {
      prev.current = null;
      return;
    }
    const tick = () => {
      const st = useApp.getState();
      const v = vehicleById(engine, trip.vehicleId, clock.now());
      const key = `${trip.vehicleId}|${trip.boardIndex}|${trip.alightIndex}`;
      const phase = phaseOf(v, trip);
      const same = v && v.patternId === trip.patternId;
      const toBoard = v && same ? stopsUntil(v, trip.boardIndex) : null;
      const toAlight = v && same && trip.alightIndex !== null ? stopsUntil(v, trip.alightIndex) : null;
      const at = v?.atStopIndex ?? null;
      const p = prev.current;
      prev.current = { key, toBoard, toAlight, at, phase };
      if (!p || p.key !== key || !v) return;
      const name = (i: number) => engine.stops.get(engine.patternById(v.patternId)?.stopIds[i] ?? '')?.name ?? '';
      if (phase === 'waiting' && toBoard !== null) {
        if (toBoard === 2 && p.toBoard !== 2) st.pushToast(t.alert.twoStops, 'warn');
        else if (toBoard === 1 && p.toBoard !== 1) st.pushToast(t.alert.nextIsBoard(name(trip.boardIndex)), 'warn');
        else if (p.at !== null && at === null && toBoard <= 3) st.pushToast(t.alert.left(name(p.at)));
      }
      if (phase === 'boarding' && p.phase !== 'boarding') st.pushToast(t.alert.atBoard, 'go');
      if (phase === 'onboard' && toAlight !== null) {
        if (toAlight === 1 && p.toAlight !== 1) st.pushToast(t.alert.alightNext, 'warn');
        else if (toAlight > 1 && p.at !== null && at === null) st.pushToast(t.alert.nextStop(name(v.nextStopIndex)));
      }
      if (phase === 'arrived' && p.phase !== 'arrived' && trip.alightIndex !== null) st.pushToast(t.alert.arrived(name(trip.alightIndex)), 'go');
    };
    tick();
    const ms = () => Math.max(150, 1000 / Math.min(10, clock.getSpeed()));
    let id = setInterval(tick, ms());
    const unsub = useApp.subscribe((s, ps) => {
      if (s.clockVersion !== ps.clockVersion) {
        clearInterval(id);
        id = setInterval(tick, ms());
      }
    });
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [engine, trip, t]);
  return null;
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <button key={x.id} type="button" className={`toast-msg tone-${x.tone}`} onClick={() => useApp.getState().dismissToast(x.id)}>
          {Icon.bell} <span>{x.text}</span>
        </button>
      ))}
    </div>
  );
}
