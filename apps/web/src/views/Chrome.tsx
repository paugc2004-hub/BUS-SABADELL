/** Barra superior, banner de honestidad, avisos, "qué es real", filtro de líneas y controles del mapa. */
import { useState } from 'react';
import { forcedInstant, holidayName, localDate } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Icon, IconButton, RouteChip, hm, useNow } from '../ui/common.tsx';

export function TopBar() {
  const t = useT();
  const view = useApp((s) => s.view);
  const lang = useApp((s) => s.lang);
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const online = useApp((s) => s.online);
  const backend = useApp((s) => s.backend);
  const now = useNow(1000);
  const st = useApp.getState();
  const alerts = network?.alerts.length ?? 0;
  const live = clock.isLive();
  const date = localDate(now);
  const hol = network ? holidayName(date, network.holidays) : null;
  const dayType = engine?.dayTypeAt(now);
  const clockText = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  const dayText = new Intl.DateTimeFormat(lang === 'ca' ? 'ca' : 'es', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' }).format(now);

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => st.navigate({ name: 'map' })} aria-label={t.appName}>
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22">
            <rect x="3" y="4" width="18" height="14" rx="4" fill="currentColor" />
            <rect x="6" y="7" width="5" height="4" rx="1" fill="#08090b" />
            <rect x="13" y="7" width="5" height="4" rx="1" fill="#08090b" />
            <circle cx="8" cy="20" r="1.8" fill="currentColor" />
            <circle cx="16" cy="20" r="1.8" fill="currentColor" />
          </svg>
        </span>
        <span className="brand-text">
          Bus Sabadell <span className="brand-sub">en directe</span>
        </span>
      </button>

      <div className="clock" aria-live="off">
        <span className={`clock-time mono${live ? '' : ' forced'}`}>{clockText}</span>
        <span className="clock-day">
          {dayText} · {hol ? `${t.holiday}: ${hol}` : dayType ? t.dayType[dayType] : ''}
          {!live && <strong className="forced-tag"> · {t.demoTime}{clock.getSpeed() !== 1 ? ` ×${clock.getSpeed()}` : ''}</strong>}
        </span>
      </div>

      <nav className="seg" aria-label="Vistes">
        <button type="button" className={view.name === 'search' ? 'on' : ''} onClick={() => st.navigate({ name: 'search' })}>
          {Icon.search} <span>{t.nav.search}</span>
        </button>
        <button type="button" className={view.name === 'map' || view.name === 'stop' ? 'on' : ''} onClick={() => st.navigate({ name: 'map' })}>
          {Icon.map} <span>{t.nav.map}</span>
        </button>
        <button
          type="button"
          className={view.name === 'line' ? 'on' : ''}
          onClick={() => {
            const sel = st.selectedBus && engine ? engine.vehicle(st.selectedBus, clock.now())?.routeId : null;
            st.navigate({ name: 'line', ref: sel ?? (view.name === 'line' ? view.ref : null) ?? 'L1' });
          }}
        >
          {Icon.line} <span>{t.nav.line}</span>
        </button>
      </nav>

      <div className="top-actions">
        {!online && <span className="pill warn" title={t.offline}>offline</span>}
        {backend === 'live' && <span className="pill ok" title={t.backendLive}>API</span>}
        <IconButton label={`${t.alerts} (${alerts})`} onClick={() => st.set({ alertsOpen: true })} className="badge-host">
          {Icon.bell}
          {alerts > 0 && <span className="badge">{alerts}</span>}
        </IconButton>
        <button type="button" className="lang-btn" aria-label={t.lang} onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}>
          {lang === 'ca' ? 'ES' : 'CA'}
        </button>
        <IconButton label={t.present} onClick={() => st.navigate({ name: 'present' })}>
          {Icon.play}
        </IconButton>
      </div>
    </header>
  );
}

export function HonestyBanner() {
  const t = useT();
  return (
    <button type="button" className="honesty" onClick={() => useApp.getState().set({ aboutOpen: true })}>
      <span className="honesty-dot" aria-hidden />
      <span className="long">{t.banner}</span>
      <span className="short">{t.bannerShort}</span>
      <span className="honesty-more">{Icon.info} {t.bannerMore}</span>
    </button>
  );
}

export function AboutModal() {
  const t = useT();
  const open = useApp((s) => s.aboutOpen);
  const network = useApp((s) => s.network);
  if (!open) return null;
  const close = () => useApp.getState().set({ aboutOpen: false });
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.about.title} onClick={(e) => e.stopPropagation()}>
        <header className="card-head">
          <h2>{t.about.title}</h2>
          <IconButton label={t.close} onClick={close}>
            {Icon.close}
          </IconButton>
        </header>
        <div className="about-cols">
          <div>
            <h3 className="about-real">{t.about.real}</h3>
            <ul>{t.about.realItems.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="about-sim">{t.about.sim}</h3>
            <ul>{t.about.simItems.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
        <p className="about-why">{t.about.why}</p>
        <h3>{t.about.sources}</h3>
        <ul className="small">
          {network?.sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> — {s.license} ({s.fetched})
            </li>
          ))}
          <li>Mapa base: OpenFreeMap / CARTO · © OpenStreetMap contributors</li>
        </ul>
        {network && network.holidaysPending.length > 0 && <p className="small dim">⚠ {network.holidaysPending.join(' · ')}</p>}
        <p className="small dim">
          {t.about.version}: <span className="mono">{network?.version}</span>
        </p>
        <p className="small dim">{t.about.notOfficial}</p>
      </div>
    </div>
  );
}

export function AlertsPanel() {
  const t = useT();
  const open = useApp((s) => s.alertsOpen);
  const network = useApp((s) => s.network);
  const lang = useApp((s) => s.lang);
  const engine = useApp((s) => s.engine);
  if (!open || !network) return null;
  const close = () => useApp.getState().set({ alertsOpen: false });
  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t.alerts} onClick={(e) => e.stopPropagation()}>
        <header className="card-head">
          <h2>{t.alerts}</h2>
          <IconButton label={t.close} onClick={close}>
            {Icon.close}
          </IconButton>
        </header>
        {network.alerts.length === 0 && <p className="dim">{t.noAlerts}</p>}
        <ul className="alert-list">
          {network.alerts.map((a) => (
            <li key={a.id}>
              <div className="chips">
                {a.routes.map((r) => <RouteChip key={r} route={engine?.routes.get(r)} size="sm" />)}
                {a.stops.map((s) => (
                  <span key={s} className="small dim">{engine?.stops.get(s)?.name ?? s}</span>
                ))}
              </div>
              <p>{a.text[lang]}</p>
              {a.url && (
                <a className="small" href={a.url} target="_blank" rel="noopener noreferrer">
                  tus.es ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LineFilter() {
  const t = useT();
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const visible = useApp((s) => s.visibleRoutes);
  const [open, setOpen] = useState(false);
  const now = useNow(30000);
  const st = useApp.getState();
  if (!network || !engine) return null;
  const dayType = engine.dayTypeAt(now);
  const routes = [...network.routes].sort((a, b) => Number(engine.runsOn(b.id, dayType)) - Number(engine.runsOn(a.id, dayType)) || a.order - b.order);
  return (
    <div className={`line-filter${open ? ' open' : ''}`}>
      <button type="button" className="lf-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t.lines}
        <span className="dim small">{visible ? `${visible.length}/${network.routes.length}` : t.all}</span>
      </button>
      <div className="lf-chips" role="group" aria-label={t.lines}>
        {routes.map((r) => {
          const on = !visible || visible.includes(r.id);
          const runs = engine.runsOn(r.id, dayType);
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              title={runs ? r.longName : `${r.longName} · ${t.notToday}`}
              className={`lf-chip${on ? ' on' : ''}${runs ? '' : ' off-today'}`}
              style={{ ['--c' as string]: r.color, ['--tc' as string]: r.textColor }}
              onClick={() => st.toggleRoute(r.id)}
            >
              {r.ref}
            </button>
          );
        })}
        <button type="button" className="lf-all" onClick={() => st.setVisibleRoutes(null)}>{t.all}</button>
        <button type="button" className="lf-all" onClick={() => st.setVisibleRoutes([])}>{t.none}</button>
      </div>
    </div>
  );
}

export function MapControls() {
  const t = useT();
  const interurbans = useApp((s) => s.interurbans);
  const [layersOpen, setLayersOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const st = useApp.getState();
  const locate = () => {
    if (!navigator.geolocation) return setMsg(t.locateError);
    setMsg(t.locating);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.longitude, p.coords.latitude];
        st.set({ userPos: pos });
        st.requestFly(pos, 16);
        setMsg(null);
      },
      () => setMsg(t.locateError),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div className="map-controls">
      <IconButton label={t.locate} onClick={locate}>
        {Icon.locate}
      </IconButton>
      <IconButton label={t.layers} active={layersOpen} onClick={() => setLayersOpen(!layersOpen)}>
        {Icon.layers}
      </IconButton>
      <IconButton label={t.timeControl} active={timeOpen} onClick={() => setTimeOpen(!timeOpen)}>
        {Icon.clock}
      </IconButton>
      {layersOpen && (
        <div className="popover">
          <label className="toggle">
            <input type="checkbox" checked={interurbans} onChange={(e) => st.setInterurbans(e.target.checked)} />
            <span>{t.interurbans}</span>
          </label>
          <div className="dim small">{t.interurbansNote}</div>
        </div>
      )}
      {timeOpen && <TimeControl onDone={() => setTimeOpen(false)} />}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}

const DAYS = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'];

export function TimeControl({ onDone }: { onDone: () => void }) {
  const t = useT();
  const now = clock.now();
  const [h, setH] = useState(hm(now));
  const [day, setDay] = useState<string>('');
  const [x, setX] = useState(clock.getSpeed());
  const st = useApp.getState();
  return (
    <div className="popover time-pop">
      <div className="cell-label">{t.timeControl}</div>
      <div className="row">
        <input type="time" value={h} onChange={(e) => setH(e.target.value)} aria-label="Hora" />
        <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Dia">
          <option value="">—</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="row speed">
        {[1, 10, 60].map((s) => (
          <button key={s} type="button" className={x === s ? 'on' : ''} onClick={() => setX(s)}>
            ×{s}
          </button>
        ))}
      </div>
      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={() => {
            st.setClock(forcedInstant(Date.now(), h, day || null), x);
            onDone();
          }}
        >
          {t.apply}
        </button>
        <button
          type="button"
          onClick={() => {
            st.setClock(null, 1);
            onDone();
          }}
        >
          {t.now}
        </button>
      </div>
    </div>
  );
}

