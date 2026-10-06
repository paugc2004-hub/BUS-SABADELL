/**
 * Xarxa en directe (/xarxa): la vista per a TUS / Ajuntament. Totes les xifres es calculen
 * del mateix VehicleState que veu el mapa; no hi ha cap mètrica escrita a mà.
 * Puntualitat: "a l'hora" = entre −1 i +3 min (criteri habitual en bus urbà).
 */
import { useMemo } from 'react';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehiclesAt } from '../data/vehicles.ts';
import { RouteChip, SourceTag, useNow } from '../ui/common.tsx';

export function NetworkPanel() {
  const t = useT();
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const lang = useApp((s) => s.lang);
  const now = useNow(2000);
  const st = useApp.getState();
  const tick = Math.floor(now / 2000);
  const m = useMemo(() => {
    if (!engine) return null;
    const vs = vehiclesAt(engine, now).filter((v) => v.status !== 'RETIRADA');
    const moving = vs.filter((v) => v.status !== 'EN_CABECERA' && v.delaySec !== null);
    const b = [0, 0, 0, 0];
    for (const v of moving) {
      const d = v.delaySec!;
      b[d <= -60 ? 0 : d < 60 ? 1 : d < 180 ? 2 : 3]!++;
    }
    const onTime = moving.filter((v) => v.delaySec! > -60 && v.delaySec! < 180).length;
    const byRoute = new Map<string, { n: number; delays: number[] }>();
    for (const v of vs) {
      const r = byRoute.get(v.routeId) ?? { n: 0, delays: [] };
      r.n++;
      if (v.delaySec !== null && v.status !== 'EN_CABECERA') r.delays.push(v.delaySec);
      byRoute.set(v.routeId, r);
    }
    return {
      inService: vs.length,
      onTimePct: moving.length ? Math.round((100 * onTime) / moving.length) : null,
      delayed: moving.filter((v) => v.delaySec! >= 180).length,
      buckets: b,
      total: moving.length,
      byRoute: [...byRoute.entries()].sort((a, c) => (engine.routes.get(a[0])?.order ?? 0) - (engine.routes.get(c[0])?.order ?? 0)),
    };
  }, [engine, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!engine || !network || !m) return null;
  const alerts = network.alerts;
  const maxN = Math.max(1, ...m.byRoute.map(([, r]) => r.n));

  return (
    <aside className="home network" aria-label={t.networkPage.title}>
      <h1 className="page-title">
        <span className="map-entry-dot" aria-hidden /> {t.networkPage.title}
      </h1>
      <p className="dim net-note">
        <SourceTag source="SIMULATED" /> {t.networkPage.simNote}
      </p>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-n mono">{m.inService}</span>
          <span className="kpi-l">{t.networkPage.inService}</span>
        </div>
        <div className="kpi">
          <span className="kpi-n mono">{m.onTimePct ?? '—'}%</span>
          <span className="kpi-l">{t.networkPage.onTime}</span>
        </div>
        <div className="kpi">
          <span className="kpi-n mono">{m.delayed}</span>
          <span className="kpi-l">{t.networkPage.delayed}</span>
        </div>
        <div className="kpi">
          <span className="kpi-n mono">{alerts.length}</span>
          <span className="kpi-l">{t.networkPage.incidents}</span>
        </div>
      </div>

      <section className="home-sec">
        <h2 className="sec-title">{t.networkPage.punctuality}</h2>
        <div className="punct-bar" role="img" aria-label={t.networkPage.buckets.map((l, i) => `${l}: ${m.buckets[i]}`).join(', ')}>
          {m.buckets.map((n, i) => (
            <span key={i} className={`pb pb-${i}`} style={{ flexGrow: n || 0.0001 }} />
          ))}
        </div>
        <div className="punct-legend">
          {t.networkPage.buckets.map((l, i) => (
            <span key={l}>
              <i className={`pb pb-${i}`} aria-hidden /> {l} <strong className="mono">{m.total ? Math.round((100 * m.buckets[i]!) / m.total) : 0}%</strong>
            </span>
          ))}
        </div>
      </section>

      <section className="home-sec">
        <h2 className="sec-title">{t.alerts}</h2>
        {alerts.length === 0 ? (
          <p className="dim">{t.networkPage.noIncidentsLong}</p>
        ) : (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <span className="chips">
                  {a.routes.map((r) => (
                    <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
                  ))}
                </span>{' '}
                {a.text[lang]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="home-sec">
        <h2 className="sec-title">{t.networkPage.fleet}</h2>
        <ul className="fleet">
          {m.byRoute.map(([id, r]) => {
            const avg = r.delays.length ? r.delays.reduce((s, x) => s + x, 0) / r.delays.length : null;
            const route = engine.routes.get(id);
            return (
              <li key={id}>
                <button type="button" className="fleet-row" onClick={() => st.navigate({ name: 'line', ref: id })}>
                  <RouteChip route={route} size="sm" />
                  <span className="fleet-bar" aria-hidden>
                    <span style={{ width: `${(100 * r.n) / maxN}%`, background: route?.color }} />
                  </span>
                  <span className="mono fleet-n">{r.n}</span>
                  <span className="mono dim fleet-d" title={t.networkPage.avgDelay}>
                    {avg === null ? '—' : `${avg >= 0 ? '+' : '−'}${Math.abs(avg / 60).toFixed(1).replace('.', ',')}′`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
