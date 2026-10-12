import { useEffect, useMemo, useState } from 'react';
import { activeAlerts, localDate, serviceDayOrigin, type SimEngine } from '@bus/core';
import { areaOf, liveArrivals, type LiveArrival } from '../data/derive.ts';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Icon, IconButton, Punctuality, RouteChip, SourceTag, hm, relativeLabel, shareUrl, useNow } from '../ui/common.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { stopCardUrl } from '../data/stopCode.ts';

export function StopPanel({ id }: { id: string }) {
  if (id.startsWith('gi:')) return <InterurbanStop id={id.slice(3)} />;
  return <TusStop id={id} />;
}

function TusStop({ id }: { id: string }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const favorites = useApp((s) => s.favorites);
  const selectedBus = useApp((s) => s.selectedBus);
  const lang = useApp((s) => s.lang);
  const now = useNow(1000);
  const [copied, setCopied] = useState(false);
  const stop = engine?.stops.get(id);
  const st = useApp.getState();
  const area = useMemo(() => (engine && stop ? areaOf(engine, stop.id) : []), [engine, stop]);

  useEffect(() => {
    if (stop) st.requestFly([stop.lon, stop.lat], 15.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // llegades de tots els pals de la zona, agrupades per línia + destinació
  const tick = Math.floor(now / 5000);
  const arrivals = useMemo(() => (engine ? liveArrivals(engine, area, now, 90, 40) : []), [engine, area, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const m = new Map<string, LiveArrival[]>();
    for (const a of arrivals) {
      const k = `${a.routeId}|${a.headsign}`;
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return [...m.values()].sort((a, b) => a[0]!.at - b[0]!.at);
  }, [arrivals]);

  if (!engine || !stop) return null;
  // amb un bus triat, la fitxa del bus ocupa el panell (amb tornada a la parada)
  if (selectedBus) return null;
  const close = () => st.back();
  const fav = favorites.includes(stop.id);
  const routes = [...new Set(area.flatMap((sid) => engine.stops.get(sid)?.routes ?? []))].sort(
    (a, b) => (engine.routes.get(a)?.order ?? 0) - (engine.routes.get(b)?.order ?? 0),
  );
  const alerts = activeAlerts(network?.alerts ?? [], now).filter((a) => a.stops.some((s) => area.includes(s)) || a.routes.some((r) => routes.includes(r)));
  const first = groups[0]?.[0];
  const live = first ? `${first.routeId} ${first.headsign} ${relativeLabel(first.at, now, t)}` : t.noArrivals;
  const open = (a: LiveArrival) => {
    if (!a.vehicleId) return;
    st.set({ boardHint: a.stopId });
    st.selectBus(a.vehicleId);
  };

  return (
    <Sheet label={`${t.stop} ${stop.name}`} onClose={close} className="stop-panel">
      <header className="card-head">
        <div>
          <div className="eyebrow">{t.stop}</div>
          {/* com a la marquesina i a l'app de TUS: «codi - nom» (el codi és el de TUS, no l'ordre dins una línia) */}
          <h2 className="stop-name">
            <span className="stop-code">{stop.id}</span> - {stop.name}
          </h2>
          <div className="chips mt-s">
            {routes.filter((r) => engine.runsAt(r, now)).map((r) => (
              <button key={r} type="button" className="chip-btn" onClick={() => st.navigate({ name: 'line', ref: r })}>
                <RouteChip route={engine.routes.get(r)} size="sm" dim={!engine.runsAt(r, now)} />
              </button>
            ))}
          </div>
        </div>
        <div className="card-actions">
          <IconButton label={fav ? t.unfavorite : t.favorite} active={fav} onClick={() => st.toggleFavorite(stop.id)}>
            {Icon.star(fav)}
          </IconButton>
          <IconButton
            label={copied ? t.copied : t.share}
            onClick={() =>
              // la fitxa pública (/p/<codi>): s'obre sense compte ni app, com els QR
              shareUrl(stopCardUrl(stop.id, location.origin), `${stop.id} - ${stop.name}`, () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              })
            }
          >
            {Icon.share}
          </IconButton>
          <IconButton label={t.close} onClick={close}>
            {Icon.close}
          </IconButton>
        </div>
      </header>

      {alerts.map((a) => (
        <button key={a.id} type="button" className="alert-inline" onClick={() => st.navigate({ name: 'alerts' })}>
          {Icon.bell}
          <span>
            {a.title && <strong>{a.title[lang]} </strong>}
            {a.text[lang]}
          </span>
        </button>
      ))}

      <div className="sr-only" aria-live="polite">
        {live}
      </div>

      <div className="section-title">{t.home.coming}</div>
      {groups.length === 0 && <div className="card-empty">{t.noArrivals}</div>}
      <ul className="arrivals">
        {groups.map((g) => {
          const a = g[0]!;
          const b = g[1];
          return (
            <li key={`${a.routeId}|${a.headsign}`} className="arrival">
              <ArrivalRow a={a} b={b} now={now} onOpen={open} engine={engine} />
            </li>
          );
        })}
      </ul>
      <button type="button" className="cta plan-to-stop" onClick={() => st.navigate({ name: 'route', to: `p${stop.id}` })}>
        {Icon.walk} {t.plan.title}
      </button>
      <div className="foot-note">
        <span className="dim small">
          {t.code} {area.join(' · ')}
          {area.length > 1 && ` (${t.home.poles(area.length)})`} · {t.sourceHint.SIMULATED}
        </span>
      </div>
    </Sheet>
  );
}

/** Una línia del panell de parada: quan arriba, a quantes parades és i cap on va. */
export function ArrivalRow({ a, b, now, onOpen, engine, compact = false }: { a: LiveArrival; b?: LiveArrival; now: number; onOpen: (a: LiveArrival) => void; engine: SimEngine; compact?: boolean }) {
  const t = useT();
  const route = engine.routes.get(a.routeId);
  const mins = Math.max(0, Math.floor((a.at - now) / 60000));
  const sub =
    a.stopsAway !== null
      ? t.stopsAway(a.stopsAway)
      : a.status === 'PENDENT_SORTIDA'
        ? t.pendingAtTerminal(hm(a.vehicle?.patternId === a.patternId ? a.vehicle.departure : a.at))
        : t.finishingTrip;
  return (
    <>
      <div className="arrival-head">
        <RouteChip route={route} size={compact ? 'sm' : 'md'} />
        <div className="arrival-dest-wrap">
          <div className="arrival-dest">
            <span aria-hidden>→ </span>
            {a.headsign}
          </div>
          <div className={`arrival-sub${a.stopsAway !== null && a.stopsAway <= 2 ? ' near' : ''}`}>
            {sub}
            <Punctuality delaySec={a.delaySec} source={a.source} compact />
          </div>
        </div>
      </div>
      <div className="arrival-times">
        <button type="button" className="arrival-main" disabled={!a.vehicleId} onClick={() => onOpen(a)} aria-label={`${mins <= 0 ? t.nowLabel : mins >= 60 ? hm(a.at) : `${mins} min`} · ${route?.ref} → ${a.headsign}${b ? ` · ${t.thenAt(hm(b.at))}` : ''}`}>
          <span className={`big${mins <= 0 ? ' now' : ''}`}>
            {mins <= 0 ? (
              t.nowLabel
            ) : mins >= 60 ? (
              hm(a.at)
            ) : (
              <>
                {mins}
                <small> min</small>
              </>
            )}
          </span>
          {b && !compact && <span className="arrival-then">{t.thenAt(hm(b.at))}</span>}
        </button>
      </div>
    </>
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
    <Sheet label={stop.name} onClose={() => st.back()} className="stop-panel">
      <header className="card-head">
        <div>
          {/* com a la marquesina i a l'app de TUS: «codi - nom» (el codi és el de TUS, no l'ordre dins una línia) */}
          <h2 className="stop-name">
            <span className="stop-code">{stop.id}</span> - {stop.name}
          </h2>
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
          <IconButton label={t.close} onClick={() => st.back()}>
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
