/**
 * Mode viatge ("Vaig a agafar aquest bus") i alertes contextuals.
 *
 * TripPanel: targeta del viatge actiu. TripMonitor: observa el VehicleState del bus
 * (1 Hz) i llança una alerta només quan l'estat canvia de manera rellevant: a 2 parades,
 * acaba de sortir d'una parada propera, la propera és la teva, és a la teva parada,
 * baixes a la següent. Mai més d'una alerta per esdeveniment.
 */
import { useEffect, useRef, useState } from 'react';
import { stopsUntil, type SimEngine, type VehicleState } from '@bus/core';
import { clock, useApp, type Trip } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById } from '../data/vehicles.ts';
import { Icon, IconButton, Punctuality, RouteChip, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';

type Phase = 'waiting' | 'boarding' | 'onboard' | 'arrived' | 'missed' | 'gone';

export function TripPanel() {
  const t = useT();
  const trip = useApp((s) => s.trip);
  const engine = useApp((s) => s.engine);
  const selectedBus = useApp((s) => s.selectedBus);
  const [open, setOpen] = useState(true);
  const now = useNow(1000);
  if (!trip || !engine) return null;
  // si la fitxa del mateix bus és oberta, el viatge ja hi és (no es repeteix)
  if (selectedBus === trip.vehicleId) return null;
  const st = useApp.getState();
  const v = vehicleById(engine, trip.vehicleId, now);
  const route = engine.routes.get(trip.routeId);
  const phase = phaseOf(v, trip);
  const same = v && v.patternId === trip.patternId;
  const target = phase === 'onboard' ? trip.alightIndex : trip.boardIndex;
  const eta = v && same && target !== null ? v.etas.find((_, k) => v.nextStopIndex + k === target)?.at ?? null : null;
  const mins = eta !== null ? Math.max(0, Math.round((eta - now) / 60000)) : null;

  return (
    <section className={`trip-card phase-${phase}${open ? '' : ' folded'}`} aria-label={t.trip.title} style={{ ['--c' as string]: route?.color ?? '#888' }}>
      <header className="trip-head">
        <button type="button" className="trip-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <RouteChip route={route} size="sm" />
          <span className="trip-title">{t.trip.title}</span>
          <span className="trip-headline">{phase === 'boarding' ? t.nowLabel : mins !== null ? `${mins} min` : ''}</span>
          {Icon.chevron(open)}
        </button>
        <IconButton label={t.tripV3.stop} onClick={() => st.endTrip()}>
          {Icon.close}
        </IconButton>
      </header>
      {open && (
        <div className="trip-body">
          {v ? <TripFocus engine={engine} v={v} trip={trip} now={now} /> : <p className="trip-msg">{t.trip.gone}</p>}
          {v && (
            <button type="button" className="text-btn" onClick={() => st.selectBus(v.id)}>
              {Icon.follow} {t.trip.view}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * ●──────🚌────○────◉ del bus fins a una parada (la teva): parades i posició per distància real.
 * Surt del VehicleState i del pattern; res es calcula pel seu compte.
 */
export function ApproachTrack({ engine, v, toIndex }: { engine: SimEngine; v: VehicleState; toIndex: number }) {
  const p = engine.patternById(v.patternId);
  const route = engine.routes.get(v.routeId);
  const from = Math.max(0, v.prevStopIndex);
  if (!p || toIndex <= from) return null;
  const span = p.stopDist[toIndex]! - p.stopDist[from]!;
  if (span <= 0) return null;
  const pct = Math.min(100, Math.max(0, ((v.dist - p.stopDist[from]!) / span) * 100));
  const dots = [];
  for (let i = from; i <= toIndex; i++) dots.push(i);
  return (
    <div className="approach" aria-hidden style={{ ['--c' as string]: route?.color ?? '#888' }}>
      <div className="approach-rail">
        <span style={{ width: `${pct.toFixed(1)}%` }} />
      </div>
      {dots.map((i) => (
        <span key={i} className={`approach-dot${i === toIndex ? ' mine' : ''}${i < v.nextStopIndex ? ' done' : ''}`} style={{ left: `${((p.stopDist[i]! - p.stopDist[from]!) / span) * 100}%` }} />
      ))}
      <span className="approach-bus" style={{ left: `${pct.toFixed(1)}%` }}>
        <BusVehicleMarker route={route} status={v.status} heading={90} size={22} showLabel={false} />
      </span>
    </div>
  );
}

/** El teu viatge, dins la fitxa del bus: la teva parada, quant falta, a quantes parades, i la pista fins a tu. */
export function TripFocus({ engine, v, trip, now }: { engine: SimEngine; v: VehicleState; trip: Trip; now: number }) {
  const t = useT();
  const phase = phaseOf(v, trip);
  const p = engine.patternById(trip.patternId);
  const same = v.patternId === trip.patternId;
  const board = engine.stops.get(trip.boardStopId);
  const alight = trip.alightIndex !== null && p ? engine.stops.get(p.stopIds[trip.alightIndex]!) : null;
  const etaAt = (i: number) => (same ? v.etas.find((_, k) => v.nextStopIndex + k === i)?.at ?? null : null);
  const onboard = phase === 'onboard' || phase === 'arrived';
  const target = onboard ? trip.alightIndex : trip.boardIndex;
  const eta = target !== null ? etaAt(target) : null;
  const away = same && target !== null ? stopsUntil(v, target) : null;
  const mins = eta !== null ? Math.max(0, Math.round((eta - now) / 60000)) : null;
  return (
    <section className={`trip-focus phase-${phase}`} aria-label={t.trip.title}>
      <div className="tf-eyebrow">{t.trip.title}</div>
      <div className="tf-row">
        <div className="tf-stop">
          <span className="tf-label">{onboard ? (alight ? t.trip.getOff : t.tripV3.onBoard) : t.tripV3.yourStop}</span>
          <strong>{onboard ? alight?.name ?? '—' : board?.name}</strong>
        </div>
        <div className="tf-eta" aria-live="polite">
          {phase === 'boarding' ? (
            <strong className="tf-now">{t.tripV3.atStop}</strong>
          ) : phase === 'arrived' ? (
            <strong className="tf-now">{t.trip.done}</strong>
          ) : mins !== null ? (
            <>
              <span className="tf-label">{t.tripV3.arrivesIn}</span>
              <span className="tf-min">
                {mins <= 0 ? t.nowLabel : mins}
                {mins > 0 && <small> min</small>}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className={`tf-away${away !== null && away <= 2 ? ' near' : ''}`}>
        {phase === 'missed' ? t.trip.missed : phase === 'gone' ? t.trip.gone : away !== null ? t.stopsAway(away) : t.finishingTrip}
        {same && <Punctuality delaySec={v.delaySec} source={v.source} />}
      </div>
      {same && target !== null && phase !== 'arrived' && <ApproachTrack engine={engine} v={v} toIndex={target} />}
      {onboard && !alight && <p className="tf-hint">{t.tripV3.chooseAlight}</p>}
    </section>
  );
}

function phaseOf(v: ReturnType<typeof vehicleById>, trip: Trip): Phase {
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
