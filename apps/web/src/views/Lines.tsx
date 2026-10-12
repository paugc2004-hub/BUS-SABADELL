/**
 * Línies: índex (/linia) i panell d'una línia (/linia/:id) sobre el mapa.
 * El panell substitueix l'antic esquema horitzontal: sentit, propers busos, freqüència,
 * durada, i el recorregut vertical amb els busos col·locats entre parades.
 * Les posicions surten del VehicleState (prevStopIndex/nextStopIndex), no es recalculen aquí.
 */
import { useEffect, useMemo, useState } from 'react';
import { activeAlerts, addDays, alertsFor, dayTypeFor, localDate, normalize, serviceDayOrigin, type NetworkData, type Pattern, type Route, type SimEngine, type VehicleState } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { arrivalsAt, vehiclesAt } from '../data/vehicles.ts';
import { Icon, IconButton, Punctuality, RouteChip, SourceTag, hm, useNow } from '../ui/common.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Ic } from '../ui/icons.tsx';

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

/** tipus de dia per mostrar (amb el festiu comercial, que fa circular la F6) */
export function dayKindOf(engine: SimEngine, network: NetworkData, date: string): 'feiner' | 'dissabte' | 'festiu' | 'comercial' {
  if (network.routes.some((r) => r.onlyDates?.includes(date))) return 'comercial';
  return dayTypeFor(date, network.holidays);
}

const fmtDay = (date: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(`${date}T12:00:00Z`));

/** Triar el dia: Avui · Demà · Tria un dia… (calendari natiu, accessible) */
function DatePicker({ date, today, onChange }: { date: string; today: string; onChange: (d: string | null) => void }) {
  const t = useT();
  const tomorrow = addDays(today, 1);
  const custom = date !== today && date !== tomorrow;
  return (
    <div className="lines-date" role="group" aria-label={t.p.lines.date}>
      <button type="button" aria-pressed={date === today} className={date === today ? 'on' : ''} onClick={() => onChange(null)}>
        {t.p.lines.today}
      </button>
      <button type="button" aria-pressed={date === tomorrow} className={date === tomorrow ? 'on' : ''} onClick={() => onChange(tomorrow)}>
        {t.p.lines.tomorrow}
      </button>
      <label className={`lines-date-pick${custom ? ' on' : ''}`}>
        <span className="sr-only">{t.p.lines.pick}</span>
        <input type="date" value={date} min={today} onChange={(e) => e.target.value && onChange(e.target.value === today ? null : e.target.value)} />
      </label>
    </div>
  );
}

export function LinesIndex() {
  const t = useT();
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const lang = useApp((s) => s.lang);
  const picked = useApp((s) => s.lineDate);
  const now = useNow(10000);
  const st = useApp.getState();
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const today = localDate(now);
  const date = picked && picked >= today ? picked : today;
  const isToday = date === today;
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
  const kind = dayKindOf(engine, network, date);
  const nq = normalize(q.trim());
  const match = (r: Route) => !nq || normalize(`${r.ref} ${r.longName}`).includes(nq) || normalize(r.ref.replace(/^L/, '')) === nq;
  const all = network.routes.filter(match);
  const running = all.filter((r) => engine.runsOnDate(r.id, date));
  const off = all.filter((r) => !engine.runsOnDate(r.id, date));
  const pending = network.holidaysPending.some((p) => p.startsWith(date.slice(0, 4)));
  const row = (r: Route, runs: boolean) => {
    const n = counts.get(r.id) ?? 0;
    const sum = isToday ? engine.routeSummary(r.id, now) : null;
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
            {!runs
              ? t.p.lines.off
              : isToday
                ? `${n > 0 ? t.linesPage.busesNow(n) : t.linesPage.notNow}${sum?.runsToday && sum.headwayMin ? ` · ${t.linesPage.every(sum.headwayMin)}` : ''}`
                : t.p.lines.kind[kind]}
          </span>
          <span className="line-row-go" aria-hidden>
            {Ic.chevron}
          </span>
        </button>
      </li>
    );
  };
  return (
    <aside className="home lines-index" aria-label={t.linesPage.title}>
      <h1 className="page-title">{t.linesPage.title}</h1>
      <DatePicker date={date} today={today} onChange={(d) => st.set({ lineDate: d })} />
      <p className="lines-daykind">
        <strong>{isToday ? t.p.lines.today : fmtDay(date, lang)}</strong> · {t.p.lines.kind[kind]}
      </p>
      {pending && <p className="form-msg err">{t.p.lines.pending2027}</p>}
      <label className="lines-search">
        <span className="sr-only">{t.p.lines.search}</span>
        <input type="search" value={q} placeholder={t.p.lines.search} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {Ic.search}
      </label>
      {all.length === 0 && <p className="empty">{t.p.lines.none}</p>}
      <ul className="line-list">{running.map((r) => row(r, true))}</ul>
      {off.length > 0 && (
        <>
          <label className="switch-row">
            <input type="checkbox" checked={showAll || Boolean(nq)} onChange={(e) => setShowAll(e.target.checked)} disabled={Boolean(nq)} />
            <span>
              {t.p.lines.showAll} <span className="dim">({off.length})</span>
            </span>
          </label>
          {(showAll || nq) && <ul className="line-list">{off.map((r) => row(r, false))}</ul>}
        </>
      )}
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

/** Hora d'horari a cada parada: la propera a partir de `fromS` (avui) o la primera del dia (null). */
export function passTimes(p: Pattern, fromS: number | null): (number | null)[] {
  return p.stopIds.map((_, i) => {
    let best: number | null = null;
    for (const [dep, k] of p.trips) {
      const v = dep + (p.profiles[k]?.[i] ?? 0);
      if ((fromS === null || v >= fromS) && (best === null || v < best)) best = v;
    }
    return best;
  });
}

export function LinePanel({ routeRef }: { routeRef: string }) {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const lang = useApp((s) => s.lang);
  const picked = useApp((s) => s.lineDate);
  const selectedBus = useApp((s) => s.selectedBus);
  const now = useNow(1000);
  const st = useApp.getState();
  const route = engine?.routes.get(routeRef);
  const today = localDate(now);
  const date = picked && picked >= today ? picked : today;
  const isToday = date === today;
  const dayType = network ? dayTypeFor(date, network.holidays) : 'feiner';
  const { dirs } = useMemo(() => (engine && route ? mainPatterns(engine, route.id, dayType) : { dirs: [] }), [engine, route, dayType]);
  const runsToday = Boolean(engine && route && engine.runsOnDate(route.id, date));
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

  const origin = serviceDayOrigin(date);
  const times = useMemo(() => (main && runsToday ? passTimes(main, isToday ? (now - origin) / 1000 : null) : []), [main, runsToday, isToday, origin, Math.floor(now / 30000)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!engine || !route || !main || !network) return null;
  // amb un bus triat, la seva fitxa ocupa el panell (amb tornada a la línia)
  if (selectedBus) return null;
  const lineAlerts = alertsFor(network.alerts, now, { routes: [route.id] });
  const vs = vehiclesAt(engine, now).filter((v) => v.routeId === route.id);
  const placed = isToday ? placeBuses(engine, main, vs) : [];
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
            {route.onlyLabel ?? t.routeKind[route.kind]}
            {!isToday && ` · ${fmtDay(date, lang)}`}
            {!runsToday && <strong className="warn"> · {isToday ? t.notToday : t.p.lines.off}</strong>}
          </div>
        </div>
        <IconButton label={t.close} onClick={() => st.navigate({ name: 'line', ref: null })}>
          {Icon.close}
        </IconButton>
      </header>

      {lineAlerts.map((a) => (
        <button key={a.id} type="button" className="alert-inline lp-alert" onClick={() => st.navigate({ name: 'alerts' })}>
          {Ic.alert}
          <span>
            <strong>{a.title?.[lang] ?? t.alerts}</strong> {a.text[lang]}
          </span>
        </button>
      ))}

      {dirs.length > 1 && (
        <div className="seg-ctl" role="tablist" aria-label={t.linePanel.direction}>
          {dirs.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={p === main} className={p === main ? 'on' : ''} onClick={() => setDirIdx(i)}>
              → {p.headsign}
            </button>
          ))}
        </div>
      )}

      {/* la línia en una frase: quants busos hi ha ara, cada quant passen i quan funciona (només avui: un altre
          dia no hi ha «ara», només l'horari) */}
      {isToday ? (
        <p className="lp-summary">
          <strong>{t.linesPage.busesNow(active)}</strong>
          {sum.runsToday && sum.headwayMin ? ` · ${t.linesPage.every(sum.headwayMin)}` : ''}
          {dur ? ` · ${t.linePanel.min(dur)} ${t.linePanel.endToEnd}` : ''}
          {sum.runsToday ? ` · ${hm(sum.first)}–${hm(sum.last)}` : ''}
        </p>
      ) : (
        <p className="lp-summary">
          <strong>{runsToday ? fmtDay(date, lang) : t.p.lines.off}</strong>
          {dur ? ` · ${t.linePanel.min(dur)} ${t.linePanel.endToEnd}` : ''}
        </p>
      )}

      {isToday && next.length > 0 && (
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
        <div className="sec-title lp-stops-head">
          <span>{t.linePanel.stopsList}</span>
          {runsToday && <span className="dim">{isToday ? t.p.lines.nextCol : t.p.lines.firstCol}</span>}
        </div>
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
                  <span className="lp-stop-label">
                    {engine.stops.get(id)?.name ?? id}
                    {/* transbords: altres línies que hi passen aquell dia */}
                    <span className="lp-transfers">
                      {(engine.stops.get(id)?.routes ?? [])
                        .filter((r) => r !== route.id && engine.runsOnDate(r, date))
                        .slice(0, 5)
                        .map((r) => (
                          <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
                        ))}
                    </span>
                  </span>
                  {times[i] != null && <span className="lp-time mono">{hm(origin + times[i]! * 1000)}</span>}
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
