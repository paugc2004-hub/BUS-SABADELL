/**
 * Línies: índex (/linia) i panell d'una línia (/linia/:id) sobre el mapa.
 * El panell substitueix l'antic esquema horitzontal: sentit, propers busos, freqüència,
 * durada, i el recorregut vertical amb els busos col·locats entre parades.
 * Les posicions surten del VehicleState (prevStopIndex/nextStopIndex), no es recalculen aquí.
 */
import { useEffect, useMemo, useState } from 'react';
import { activeAlerts, type Pattern, type SimEngine, type VehicleState } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { arrivalsAt, vehiclesAt } from '../data/vehicles.ts';
import { Icon, IconButton, Punctuality, RouteChip, SourceTag, hm, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { Sheet } from '../ui/Sheet.tsx';

/** Variant principal de cada sentit per al tipus de dia (la de més expedicions). */
export function mainPatterns(engine: SimEngine, routeId: string, dayType: string): { dirs: Pattern[]; runsToday: boolean } {
  const pats = [...engine.patterns.values()].map((p) => p.p).filter((p) => p.routeId === routeId);
  const today = pats.filter((p) => p.dayType === dayType && p.trips.length);
  const pool = today.length ? today : pats.filter((p) => p.dayType === pats[0]?.dayType);
  const pick = (dir: number) => pool.filter((p) => p.dir === dir).sort((a, b) => b.trips.length - a.trips.length || b.stopIds.length - a.stopIds.length)[0];
  const dirs = [pick(0), pick(1)].filter((p): p is Pattern => Boolean(p));
  return { dirs, runsToday: today.length > 0 };
}

/** Durada típica d'un trajecte (min): mediana del perfil de temps de la variant. */
function durationMin(p: Pattern): number | null {
  const totals = p.trips.map(([, k]) => p.profiles[k]?.[p.profiles[k]!.length - 1] ?? 0).sort((a, b) => a - b);
  const m = totals[Math.floor(totals.length / 2)];
  return m ? Math.round(m / 60) : null;
}

export function LinesIndex() {
  const t = useT();
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const now = useNow(10000);
  const st = useApp.getState();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (engine) for (const v of vehiclesAt(engine, now)) if (v.status !== 'RETIRADA') m.set(v.routeId, (m.get(v.routeId) ?? 0) + 1);
    return m;
  }, [engine, Math.floor(now / 10000)]); // eslint-disable-line react-hooks/exhaustive-deps
  // línies amb algun avís publicat ara (directe o en alguna de les seves parades): PPT 2024 §2.2.1
  const alerted = useMemo(() => {
    const set = new Set<string>();
    if (!network || !engine) return set;
    for (const a of activeAlerts(network.alerts, now)) {
      a.routes.forEach((r) => set.add(r));
      for (const sid of a.stops) engine.stops.get(sid)?.routes.forEach((r) => set.add(r));
    }
    return set;
  }, [network, engine, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!network || !engine) return null;
  const dayType = engine.dayTypeAt(now);
  const group = (kind: 'diurna' | 'festiva') => network.routes.filter((r) => r.kind === kind);
  return (
    <aside className="home lines-index" aria-label={t.linesPage.title}>
      <h1 className="page-title">{t.linesPage.title}</h1>
      {(['diurna', 'festiva'] as const).map((kind) => (
        <section key={kind} className="home-sec">
          <h2 className="sec-title">{kind === 'diurna' ? t.linesPage.day : t.linesPage.holiday}</h2>
          <ul className="line-list">
            {group(kind).map((r) => {
              const runs = engine.runsOn(r.id, dayType);
              const n = counts.get(r.id) ?? 0;
              const sum = engine.routeSummary(r.id, now);
              return (
                <li key={r.id}>
                  <button type="button" className={`line-row${runs ? '' : ' off'}`} onClick={() => st.navigate({ name: 'line', ref: r.id })}>
                    <RouteChip route={r} size="md" />
                    <span className="line-row-name">
                      {r.longName}
                      {alerted.has(r.id) && (
                        <span className="line-alert">
                          {Icon.bell} {t.alerts}
                        </span>
                      )}
                    </span>
                    <span className="line-row-meta">
                      {n > 0 ? t.linesPage.busesNow(n) : t.linesPage.notNow}
                      {sum.runsToday && sum.headwayMin ? ` · ${t.linesPage.every(sum.headwayMin)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}

interface Placed {
  v: VehicleState;
  /** índex de la parada del pattern principal davant de la qual va el bus */
  before: number;
}

/** Col·loca cada bus del sentit davant de la seva propera parada dins el pattern principal. */
function placeBuses(engine: SimEngine, main: Pattern, vs: VehicleState[]): Placed[] {
  const out: Placed[] = [];
  for (const v of vs) {
    const own = engine.patternById(v.patternId);
    if (!own || own.dir !== main.dir) continue;
    if (v.status === 'RETIRADA') continue;
    let before: number;
    if (v.status === 'EN_CABECERA') before = 0;
    else if (v.atStopIndex !== null) {
      const id = own.stopIds[v.atStopIndex]!;
      before = main.stopIds.indexOf(id);
    } else {
      // propera parada del bus que també sigui al pattern principal
      before = -1;
      for (let i = v.nextStopIndex; i < own.stopIds.length && before < 0; i++) before = main.stopIds.indexOf(own.stopIds[i]!);
    }
    if (before >= 0) out.push({ v, before });
  }
  return out;
}

export function LinePanel({ routeRef }: { routeRef: string }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const selectedBus = useApp((s) => s.selectedBus);
  const now = useNow(1000);
  const st = useApp.getState();
  const route = engine?.routes.get(routeRef);
  const dayType = engine ? engine.dayTypeAt(now) : 'feiner';
  const { dirs, runsToday } = useMemo(() => (engine && route ? mainPatterns(engine, route.id, dayType) : { dirs: [], runsToday: false }), [engine, route, dayType]);
  const [dirIdx, setDirIdx] = useState(0);
  const main = dirs[Math.min(dirIdx, dirs.length - 1)];

  // la línia queda enfocada al mapa mentre el panell és obert
  useEffect(() => {
    if (!route) return;
    useApp.getState().setFocusRoute(route.id);
    return () => useApp.getState().setFocusRoute(null);
  }, [route]);

  const tick = Math.floor(now / 5000);
  const next = useMemo(() => {
    if (!engine || !main) return [];
    return arrivalsAt(engine, main.stopIds[0]!, now, 120, 40)
      .filter((a) => a.routeId === main.routeId && a.headsign === main.headsign)
      .slice(0, 4);
  }, [engine, main, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!engine || !route || !main) return null;
  // amb un bus triat, la seva fitxa ocupa el panell (amb tornada a la línia)
  if (selectedBus) return null;
  const vs = vehiclesAt(engine, now).filter((v) => v.routeId === route.id);
  const placed = placeBuses(engine, main, vs);
  const sum = engine.routeSummary(route.id, now);
  const dur = durationMin(main);
  const active = vs.filter((v) => v.status !== 'RETIRADA').length;

  return (
    <Sheet label={`${t.viewLine} ${route.ref}`} onClose={() => st.navigate({ name: 'line', ref: null })} className="line-panel">
      <header className="lp-head">
        <RouteChip route={route} size="lg" />
        <div className="lp-title">
          <h2>{route.longName}</h2>
          <div className="dim">
            {t.routeKind[route.kind]}
            {!runsToday && <strong className="warn"> · {t.notToday}</strong>}
          </div>
        </div>
        <IconButton label={t.close} onClick={() => st.navigate({ name: 'line', ref: null })}>
          {Icon.close}
        </IconButton>
      </header>

      {dirs.length > 1 && (
        <div className="seg-ctl" role="tablist" aria-label={t.linePanel.direction}>
          {dirs.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={p === main} className={p === main ? 'on' : ''} onClick={() => setDirIdx(i)}>
              → {p.headsign}
            </button>
          ))}
        </div>
      )}

      {/* la línia en una frase: quants busos hi ha ara, cada quant passen i quan funciona */}
      <p className="lp-summary">
        <strong>{t.linesPage.busesNow(active)}</strong>
        {sum.runsToday && sum.headwayMin ? ` · ${t.linesPage.every(sum.headwayMin)}` : ''}
        {dur ? ` · ${t.linePanel.min(dur)} ${t.linePanel.endToEnd}` : ''}
        {sum.runsToday ? ` · ${hm(sum.first)}–${hm(sum.last)}` : ''}
      </p>

      {next.length > 0 && (
        <section className="lp-next">
          <div className="sec-title">
            {t.linePanel.nextBuses} <span className="dim">{t.linePanel.from(engine.stops.get(main.stopIds[0]!)?.name ?? '')}</span>
          </div>
          <div className="lp-next-row">
            {next.map((a) => (
              <button key={a.at} type="button" className="lp-next-item" disabled={!a.vehicleId} onClick={() => a.vehicleId && st.selectBus(a.vehicleId)}>
                <strong>{Math.max(0, Math.round((a.at - now) / 60000)) <= 0 ? t.nowLabel : `${Math.max(0, Math.round((a.at - now) / 60000))} min`}</strong>
                <span className="dim small">{hm(a.at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <a
        className="cta lp-timetable-link"
        href={`/horari/${route.ref}`}
        onClick={(e) => (e.preventDefault(), st.navigate({ name: 'timetable', ref: route.ref, stop: main.stopIds[0] }))}
      >
        {t.pub.tt.printable}
      </a>

      <section>
        <div className="sec-title">{t.linePanel.stopsList}</div>
        <ol className="lp-stops" style={{ ['--c' as string]: route.color }}>
          {main.stopIds.map((id, i) => {
            const here = placed.filter((p) => p.before === i);
            const edge = i === 0 || i === main.stopIds.length - 1;
            return (
              <li key={`${id}-${i}`} className={`lp-stop${edge ? ' edge' : ''}`}>
                {here.map(({ v }) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`lp-bus${v.id === selectedBus ? ' sel' : ''}${v.atStopIndex !== null || v.status === 'EN_CABECERA' ? ' at' : ''}`}
                    onClick={() => st.selectBus(v.id)}
                    aria-label={`Bus ${v.label} → ${v.headsign}`}
                  >
                    <BusVehicleMarker route={route} status={v.status} heading={180} size={22} showLabel={false} />
                    <Punctuality delaySec={v.delaySec} source={v.source} compact />
                  </button>
                ))}
                <button type="button" className="lp-stop-name linklike" onClick={() => st.navigate({ name: 'stop', id })}>
                  <span className="lp-dot" aria-hidden />
                  {engine.stops.get(id)?.name ?? id}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="foot-note">
        <SourceTag source="SIMULATED" /> <span className="dim">{t.sourceHint.SIMULATED}</span>
      </div>
    </Sheet>
  );
}
