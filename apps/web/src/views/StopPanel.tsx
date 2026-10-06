import { useEffect, useMemo, useState } from 'react';
import { localDate, serviceDayOrigin, type Arrival } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Countdown, Icon, IconButton, RouteChip, SourceTag, hm, relativeLabel, shareUrl, useNow } from '../ui/common.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export function StopPanel({ id }: { id: string }) {
  if (id.startsWith('gi:')) return <InterurbanStop id={id.slice(3)} />;
  return <TusStop id={id} />;
}

function TusStop({ id }: { id: string }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const favorites = useApp((s) => s.favorites);
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);
  const stop = engine?.stops.get(id);
  const st = useApp.getState();

  useEffect(() => {
    if (stop) st.requestFly([stop.lon, stop.lat], Math.max(15.5, 15.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // agrupar por línea + destino, como un panel de parada
  const minuteKey = Math.floor(now / 15000);
  const arrivals = useMemo(() => (engine && stop ? engine.arrivals(stop.id, now, 90, 40) : []), [engine, stop, minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const m = new Map<string, Arrival[]>();
    for (const a of arrivals) {
      const k = `${a.routeId}|${a.headsign}`;
      const arr = m.get(k) ?? [];
      arr.push(a);
      m.set(k, arr);
    }
    return [...m.values()].sort((a, b) => a[0]!.at - b[0]!.at);
  }, [arrivals]);

  if (!engine || !stop) return null;
  const close = () => st.navigate({ name: 'map' });
  const fav = favorites.includes(stop.id);
  const alerts = (network?.alerts ?? []).filter((a) => a.stops.includes(stop.id) || a.routes.some((r) => stop.routes.includes(r)));
  const first = groups[0]?.[0];
  const live = first ? `${first.routeId} ${first.headsign} ${relativeLabel(first.at, now, t)}` : t.noArrivals;

  return (
    <Sheet label={`${t.stop} ${stop.name}`} onClose={close} className="stop-panel">
      <header className="card-head">
        <div>
          <h2 className="stop-name">{stop.name}</h2>
          <div className="stop-meta">
            <span className="dim">
              {t.code} {stop.id}
            </span>
            <span className="chips">
              {stop.routes.map((r) => (
                <button key={r} type="button" className="chip-btn" onClick={() => st.navigate({ name: 'line', ref: r })}>
                  <RouteChip route={engine.routes.get(r)} size="sm" dim={!engine.runsOn(r, engine.dayTypeAt(now))} />
                </button>
              ))}
            </span>
          </div>
        </div>
        <div className="card-actions">
          <IconButton label={fav ? t.unfavorite : t.favorite} active={fav} onClick={() => st.toggleFavorite(stop.id)}>
            {Icon.star(fav)}
          </IconButton>
          <IconButton
            label={copied ? t.copied : t.share}
            onClick={() => shareUrl(location.href, stop.name, () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })}
          >
            {Icon.share}
          </IconButton>
          <IconButton label={t.close} onClick={close}>
            {Icon.close}
          </IconButton>
        </div>
      </header>

      {alerts.map((a) => (
        <div key={a.id} className="alert-inline">
          {Icon.bell} {a.text[useApp.getState().lang]}
        </div>
      ))}

      <div className="sr-only" aria-live="polite">
        {live}
      </div>

      {groups.length === 0 && <div className="card-empty">{t.noArrivals}</div>}
      <ul className="arrivals">
        {groups.map((g) => {
          const a = g[0]!;
          const b = g[1];
          const route = engine.routes.get(a.routeId);
          return (
            <li key={`${a.routeId}|${a.headsign}`} className="arrival">
              <div className="arrival-head">
                <RouteChip route={route} size="sm" />
                <div>
                  <div className="cell-label">{t.direction}</div>
                  <div className="arrival-dest">{a.headsign}</div>
                </div>
              </div>
              <div className="arrival-times">
                <button
                  type="button"
                  className="arrival-main"
                  disabled={!a.vehicleId}
                  onClick={() => {
                    if (!a.vehicleId) return;
                    st.navigate({ name: 'map' });
                    st.selectBus(a.vehicleId);
                  }}
                >
                  <Countdown at={a.at} now={now} className="big" />
                  <span className="dim small">
                    {a.status === 'PENDENT_SORTIDA' ? t.pendingDeparture : relativeLabel(a.at, now, t)}
                  </span>
                </button>
                {b && (
                  <div className="arrival-next">
                    <span className="mono">{hm(b.at)}</span>
                    <span className="dim small">{relativeLabel(b.at, now, t)}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="foot-note">
        <SourceTag source="SIMULATED" /> <span className="dim small">{t.sourceHint.SIMULATED}</span>
      </div>
    </Sheet>
  );
}

function InterurbanStop({ id }: { id: string }) {
  const t = useT();
  const data = useApp((s) => s.interData);
  const now = useNow(5000);
  const st = useApp.getState();
  const stop = data?.stops.find((s) => s.id === id);
  useEffect(() => {
    if (stop) st.requestFly([stop.lon, stop.lat], 15.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!data || !stop) return null;
  const date = localDate(now);
  const ymd = date.replace(/-/g, '');
  const origin = serviceDayOrigin(date);
  const s = (now - origin) / 1000;
  const times = (data.times[id] ?? [])
    .filter(([, svc, sec]) => data.services[svc]?.includes(ymd) && sec >= s - 60)
    .slice(0, 12);
  const routes = new Map(data.routes.map((r) => [r.id, r]));
  return (
    <Sheet label={stop.name} onClose={() => st.navigate({ name: 'map' })} className="stop-panel">
      <header className="card-head">
        <div>
          <h2 className="stop-name">{stop.name}</h2>
          <div className="stop-meta">
            <span className="dim">{t.interurbans}</span>
            <span className="chips">
              {stop.routes.map((r) => (
                <span key={r} className="chip chip-sm chip-inter">
                  {routes.get(r)?.ref ?? r}
                </span>
              ))}
            </span>
          </div>
        </div>
        <div className="card-actions">
          <IconButton label={t.close} onClick={() => st.navigate({ name: 'map' })}>
            {Icon.close}
          </IconButton>
        </div>
      </header>
      {times.length === 0 && <div className="card-empty">{t.noArrivals}</div>}
      <ul className="arrivals">
        {times.map(([r, , sec, head], i) => (
          <li key={i} className="arrival">
            <div className="arrival-head">
              <span className="chip chip-sm chip-inter">{routes.get(r)?.ref ?? r}</span>
              <div>
                <div className="arrival-dest">{head || routes.get(r)?.name}</div>
                <div className="dim small">{routes.get(r)?.agency}</div>
              </div>
            </div>
            <div className="arrival-next">
              <span className="mono">{hm(origin + sec * 1000)}</span>
              <span className="dim small">{relativeLabel(origin + sec * 1000, now, t)}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="foot-note">
        <SourceTag source="SCHEDULED" /> <span className="dim small">{t.interurbansNote}</span>
      </div>
    </Sheet>
  );
}
