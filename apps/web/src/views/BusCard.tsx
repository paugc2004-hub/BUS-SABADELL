/**
 * Fitxa del bus seleccionat. Tot el que mostra surt del VehicleState i del journey
 * del motor: res es calcula aquí pel seu compte.
 */
import { useState } from 'react';
import type { SimEngine, VehicleState } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT, type Dict } from '../i18n/index.ts';
import { journeyFor, vehicleById } from '../data/vehicles.ts';
import { whereNow } from '../data/derive.ts';
import { Countdown, Icon, IconButton, Punctuality, RouteChip, SourceTag, hm, shareUrl, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { StopTimeline } from './StopTimeline.tsx';

/** "Ara": on és el bus, en paraules. */
export function whereText(engine: SimEngine, v: VehicleState, t: Dict): string {
  const w = whereNow(engine, v);
  const name = (id: string | null) => (id ? engine.stops.get(id)?.name ?? id : '—');
  switch (w.kind) {
    case 'at':
      return t.atStop(name(w.stopId));
    case 'terminal':
      return t.atTerminal(name(w.stopId));
    case 'retired':
      return t.retiredAt(name(w.stopId));
    default:
      if (w.fraction < 0.2) return t.leaving(name(w.from));
      if (w.fraction > 0.8) return t.arriving(name(w.to));
      return t.between(name(w.from), name(w.to));
  }
}

export function StatusPill({ v }: { v: VehicleState }) {
  const t = useT();
  return <span className={`status-pill st-${v.status.toLowerCase()}`}>{t.status[v.status]}</span>;
}

export function BusCard() {
  const t = useT();
  const id = useApp((s) => s.selectedBus);
  const engine = useApp((s) => s.engine);
  const follow = useApp((s) => s.follow);
  const trip = useApp((s) => s.trip);
  const boardHint = useApp((s) => s.boardHint);
  const view = useApp((s) => s.view);
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  if (!id || !engine) return null;
  const v = vehicleById(engine, id, now);
  const st = useApp.getState();
  if (!v) {
    return (
      <Sheet label="Bus" onClose={() => st.selectBus(null)}>
        <div className="card-empty">{t.noService}</div>
      </Sheet>
    );
  }
  const route = engine.routes.get(v.routeId);
  const pattern = engine.patternById(v.patternId)!;
  const journey = journeyFor(engine, v.id, now);
  // a l'última parada del trajecte no hi ha "propera": el bus ha acabat aquesta expedició
  const retired = v.status === 'RETIRADA' || v.atStopIndex === pattern.stopIds.length - 1;
  const nextEta = v.etas[0];
  const after = v.etas[1];
  const next = v.nextStopId ? engine.stops.get(v.nextStopId) : null;
  const afterStop = after ? engine.stops.get(after.stopId) : null;
  const myTrip = trip?.vehicleId === v.id ? trip : null;

  // "Vaig a agafar aquest bus": si venim d'una parada per davant del bus, és aquesta; si no, es tria al recorregut
  const hintIndex = boardHint ? pattern.stopIds.findIndex((sid, i) => sid === boardHint && i >= v.nextStopIndex - (v.atStopIndex === i ? 1 : 0)) : -1;
  const start = (index: number, stopId: string) => {
    st.startTrip({ vehicleId: v.id, patternId: v.patternId, routeId: v.routeId, boardIndex: index, boardStopId: stopId, alightIndex: null });
    setPicking(false);
  };

  return (
    <Sheet label={`Bus ${route?.ref} ${v.label}`} onClose={() => st.selectBus(null)} className="bus-card">
      {view.name === 'stop' && engine.stops.get(view.id) && (
        <button type="button" className="back-link" onClick={() => st.selectBus(null)}>
          ← {engine.stops.get(view.id)!.name}
        </button>
      )}
      {view.name === 'line' && view.ref && (
        <button type="button" className="back-link" onClick={() => st.selectBus(null)}>
          ← {t.viewLine} {engine.routes.get(view.ref)?.ref}
        </button>
      )}
      <header className="bc-head">
        <BusVehicleMarker route={route} status={v.status} heading={null} size={30} showLabel={false} selected followed={follow} />
        <div className="bc-title">
          <div className="bc-line">
            <RouteChip route={route} size="lg" />
            <span className="led" aria-label={`${t.run} ${v.label}`}>{v.label}</span>
          </div>
          <div className="bc-od">
            <span className="dim">{v.origin}</span> <span aria-hidden>→</span> <strong>{v.headsign}</strong>
          </div>
        </div>
        <div className="card-actions">
          <IconButton
            label={copied ? t.copied : t.share}
            onClick={() =>
              shareUrl(location.href, `${route?.ref} ${v.label}`, () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
            }
          >
            {Icon.share}
          </IconButton>
          <IconButton label={t.close} onClick={() => st.selectBus(null)}>
            {Icon.close}
          </IconButton>
        </div>
      </header>

      <div className="bc-pills">
        <StatusPill v={v} />
        {v.delaySec === null ? <span className="status-pill st-sched">{t.onSchedule}</span> : <Punctuality delaySec={v.delaySec} source={v.source} />}
        <SourceTag source={v.source} />
        {v.lastTrip && !retired && <span className="status-pill st-last">{t.lastTrip}</span>}
      </div>

      <dl className="bc-now">
        <div className="bc-row">
          <dt>{t.nowLabel}</dt>
          <dd className="bc-where">
            {whereText(engine, v, t)}
            {v.status === 'EN_CABECERA' && (
              <span className="dim small">
                {' '}
                · {t.departsIn} <Countdown at={v.departure} now={now} />
              </span>
            )}
          </dd>
        </div>
        {!retired && next && nextEta && (
          <div className="bc-row bc-next">
            <dt>{t.nextLabel}</dt>
            <dd>
              <span className="bc-stop">{next.name}</span>
              <span className="cell-big">
                <Countdown at={nextEta.at} now={now} />
              </span>
            </dd>
          </div>
        )}
        {!retired && afterStop && after && (
          <div className="bc-row">
            <dt>{t.afterLabel}</dt>
            <dd>
              <span className="bc-stop">{afterStop.name}</span>
              <span className="mono">{hm(after.at)}</span>
            </dd>
          </div>
        )}
      </dl>

      {!retired && (
        <div className="bc-ctas">
          {myTrip ? (
            <button type="button" className="cta cta-on" onClick={() => st.endTrip()}>
              {t.trip.end}
            </button>
          ) : (
            <button
              type="button"
              className="cta cta-primary"
              aria-pressed={picking}
              onClick={() => {
                if (hintIndex >= 0) start(hintIndex, pattern.stopIds[hintIndex]!);
                else setPicking(!picking);
              }}
            >
              {Icon.board} {t.takeBus}
            </button>
          )}
          <button type="button" className={`cta${follow ? ' cta-on' : ''}`} aria-pressed={follow} onClick={() => st.setFollow(!follow)}>
            {Icon.follow} {follow ? t.stopFollow : t.followBus}
          </button>
        </div>
      )}
      {picking && <p className="pick-hint">{t.takeBusHint}</p>}

      {journey && (
        <StopTimeline
          engine={engine}
          vehicle={v}
          journey={journey}
          now={now}
          route={route}
          boardIndex={myTrip?.boardIndex ?? null}
          alightIndex={myTrip?.alightIndex ?? null}
          pick={
            picking
              ? { label: t.boardHere, onPick: start }
              : myTrip && myTrip.alightIndex === null
                ? { label: t.alightHere, onPick: (i) => st.setAlight(i), from: myTrip.boardIndex + 1 }
                : null
          }
          onStop={(sid) => st.navigate({ name: 'stop', id: sid })}
        />
      )}

      <div className="bc-foot">
        <button type="button" className="text-btn" onClick={() => st.navigate({ name: 'line', ref: v.routeId })}>
          {Icon.line} {t.viewLine} {route?.ref}
        </button>
        <span className="dim small">{t.sourceHint[v.source]}</span>
      </div>
    </Sheet>
  );
}
