import { useState } from 'react';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById } from '../data/vehicles.ts';
import { Countdown, Icon, IconButton, RouteChip, SourceTag, hm, shareUrl, useNow } from '../ui/common.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export function BusCard() {
  const t = useT();
  const id = useApp((s) => s.selectedBus);
  const engine = useApp((s) => s.engine);
  const follow = useApp((s) => s.follow);
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);
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
  const next = v.nextStopId ? engine.stops.get(v.nextStopId) : null;
  const nextEta = v.etas[0];
  const upcoming = v.etas.slice(v.status === 'EN_CABECERA' ? 1 : 1, 6);
  const departIn = v.status === 'EN_CABECERA' ? v.departure : null;

  return (
    <Sheet label={`Bus ${v.label}`} onClose={() => st.selectBus(null)} className="bus-card">
      <header className="card-head">
        <div className="card-title">
          <RouteChip route={route} size="lg" />
          <span className="led" aria-label={`${t.run} ${v.label}`}>{v.label}</span>
        </div>
        <div className="card-actions">
          <IconButton label={follow ? t.following : t.follow} active={follow} onClick={() => st.setFollow(!follow)}>
            {Icon.follow}
          </IconButton>
          <IconButton
            label={copied ? t.copied : t.share}
            onClick={() => shareUrl(location.href, `${route?.ref} ${v.label}`, () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })}
          >
            {Icon.share}
          </IconButton>
          <IconButton label={t.close} onClick={() => st.selectBus(null)}>
            {Icon.close}
          </IconButton>
        </div>
      </header>

      {v.status !== 'EN_RUTA' && v.status !== 'EN_PARADA' && (
        <div className={`status-band status-${v.status.toLowerCase()}`}>
          {t.status[v.status]}
          {v.status === 'EN_CABECERA' && departIn && (
            <>
              {' · '}
              {t.departsIn} <Countdown at={departIn} now={now} />
            </>
          )}
        </div>
      )}
      {v.lastTrip && v.status !== 'RETIRADA' && <div className="status-band status-last">{t.lastTrip}</div>}

      <div className="card-grid">
        <div className="cell">
          <div className="cell-label">{t.nextStop}</div>
          <div className="cell-value">{v.status === 'RETIRADA' ? '—' : next?.name ?? '—'}</div>
          <div className="cell-label mt">{t.arrival}</div>
          <div className="cell-big">{nextEta && v.status !== 'RETIRADA' ? <Countdown at={nextEta.at} now={now} /> : '—'}</div>
        </div>
        <div className="cell">
          <div className="cell-label">{t.destination}</div>
          <div className="cell-value">{pattern.headsign}</div>
          <div className="cell-row mt">
            <div>
              <div className="cell-label">{t.speed}</div>
              <div className="cell-value mono">{v.speedKmh} km/h</div>
            </div>
            <div>
              <div className="cell-label">Origen</div>
              <SourceTag source={v.source} />
            </div>
          </div>
        </div>
      </div>

      {upcoming.length > 0 && v.status !== 'RETIRADA' && (
        <div className="upcoming">
          <div className="cell-label">{t.nextStops}</div>
          <ol>
            {upcoming.map((e) => {
              const s = engine.stops.get(e.stopId);
              return (
                <li key={e.stopId + e.at}>
                  <button type="button" className="linklike" onClick={() => st.navigate({ name: 'stop', id: e.stopId })}>
                    {s?.name ?? e.stopId}
                  </button>
                  <span className="mono dim">{hm(e.at)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <button type="button" className="text-btn" onClick={() => st.navigate({ name: 'line', ref: v.routeId })}>
        {Icon.line} {t.viewLine} {route?.ref}
      </button>
    </Sheet>
  );
}
