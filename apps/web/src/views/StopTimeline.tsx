/**
 * Línia temporal del trajecte d'un bus: parades fetes, on és ara i les que vénen.
 * Tot surt d'engine.journey(): les mateixes hores que la fitxa, el panell de parada i el mapa.
 */
import { useState } from 'react';
import type { Journey, Route, SimEngine, VehicleState } from '@bus/core';
import { useT } from '../i18n/index.ts';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { Countdown, hm } from '../ui/common.tsx';

export interface StopTimelineProps {
  engine: SimEngine;
  vehicle: VehicleState;
  journey: Journey;
  now: number;
  route: Route | undefined;
  /** parades on el viatger puja / baixa (viatge actiu) */
  boardIndex?: number | null;
  alightIndex?: number | null;
  /** mode de triar parada: mostra un botó a cada parada futura */
  pick?: { label: string; onPick: (index: number, stopId: string) => void; from?: number } | null;
  /** quantes parades futures mostrar en mode compacte */
  ahead?: number;
  onStop?: (stopId: string) => void;
}

export function StopTimeline({ engine, vehicle: v, journey: j, now, route, boardIndex = null, alightIndex = null, pick = null, ahead = 4, onStop }: StopTimelineProps) {
  const t = useT();
  const [all, setAll] = useState(false);
  const color = route?.color ?? '#888';
  const firstAhead = j.stops.findIndex((s) => s.state === 'current' || s.state === 'next' || s.state === 'upcoming');
  const cur = firstAhead < 0 ? j.stops.length - 1 : firstAhead;
  // compacte: l'última feta, on és el bus i les properes; en mode triar, totes
  const from = all ? 0 : Math.max(0, cur - 1);
  const to = all || pick ? j.stops.length : Math.min(j.stops.length, cur + ahead + 1);
  const shown = j.stops.slice(from, to);
  const moving = v.atStopIndex === null && v.status !== 'EN_CABECERA' && v.status !== 'RETIRADA';
  const n = j.stops.length;

  return (
    <div className="timeline" style={{ ['--c' as string]: color }}>
      <div className="tl-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(j.progress * 100)} aria-label={t.progress(Math.round(j.progress * 100))}>
        <div className="tl-bar">
          <span style={{ width: `${(j.progress * 100).toFixed(1)}%` }} />
        </div>
        <div className="tl-progress-text">
          <strong className="mono">{Math.round(j.progress * 100)}%</strong>
          <span className="dim">
            {t.progress(Math.round(j.progress * 100)).replace(/^\d+%\s*/, '')} · {t.kmLeft(((j.lengthM - j.doneM) / 1000).toFixed(1).replace('.', ','))}
          </span>
        </div>
      </div>
      <ol className="tl-list">
        {from > 0 && <li className="tl-more dim small">⋯ {from} {t.stops}</li>}
        {shown.map((s) => {
          const stop = engine.stops.get(s.stopId);
          const isBoard = s.index === boardIndex;
          const isAlight = s.index === alightIndex;
          const canPick = pick && s.index >= (pick.from ?? v.nextStopIndex) && s.index > 0 && (s.state === 'next' || s.state === 'upcoming' || s.state === 'current');
          const showBusBefore = moving && s.state === 'next';
          return (
            <li key={s.index} className={`tl-item tl-${s.state}${isBoard ? ' tl-board' : ''}${isAlight ? ' tl-alight' : ''}${s.index === n - 1 ? ' tl-last' : ''}`}>
              {showBusBefore && (
                <div className="tl-bus" aria-hidden>
                  <BusVehicleMarker route={route} status={v.status} size={22} showLabel={false} heading={180} />
                  <span className="tl-bus-text">{v.speedKmh} km/h</span>
                </div>
              )}
              <span className="tl-dot" aria-hidden>
                {s.state === 'passed' ? '✓' : ''}
              </span>
              <button type="button" className="tl-name linklike" onClick={() => onStop?.(s.stopId)}>
                {stop?.name ?? s.stopId}
                {isBoard && <span className="tl-tag board">{t.trip.yourStop}</span>}
                {isAlight && <span className="tl-tag alight">{t.trip.getOff}</span>}
              </button>
              <span className="tl-time">
                {s.state === 'current' ? (
                  <strong className="tl-now">{t.nowLabel.toUpperCase()}</strong>
                ) : s.at === null ? (
                  '—'
                ) : s.state === 'passed' ? (
                  <span className="mono dim">{hm(s.at)}</span>
                ) : s.at - now < 30 * 60_000 ? (
                  <>
                    <Countdown at={s.at} now={now} className="tl-cd" />
                    <span className="mono dim small">{hm(s.at)}</span>
                  </>
                ) : (
                  <span className="mono">{hm(s.at)}</span>
                )}
              </span>
              {canPick && (
                <button type="button" className="tl-pick" onClick={() => pick.onPick(s.index, s.stopId)}>
                  {pick.label}
                </button>
              )}
            </li>
          );
        })}
        {to < j.stops.length && <li className="tl-more dim small">⋯ {j.stops.length - to} {t.stops}</li>}
      </ol>
      {!pick && j.stops.length > ahead + 2 && (
        <button type="button" className="text-btn" onClick={() => setAll(!all)}>
          {all ? t.showLess : t.showAllStops}
        </button>
      )}
    </div>
  );
}
