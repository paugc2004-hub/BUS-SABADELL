/** Barra superior, banner de honestidad, avisos, "qué es real", filtro de líneas y controles del mapa. */
import { useEffect, useRef, useState } from 'react';
import { forcedInstant, holidayName, localDate } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById } from '../data/vehicles.ts';
import { Icon, IconButton, RouteChip, hm, useNow } from '../ui/common.tsx';
import { Logo } from '../ui/Logo.tsx';
import { auth } from '../auth/auth.ts';

type NavKey = 'home' | 'map' | 'line' | 'network' | 'mine';

/** Pestanya activa: les vistes de detall (parada, bus) mantenen la vista d'on venien. */
function activeTab(view: ReturnType<typeof useApp.getState>['view'], base: string): NavKey {
  if (view.name === 'home' || view.name === 'map' || view.name === 'line' || view.name === 'network' || view.name === 'mine') return view.name;
  if (view.name === 'present') return 'map';
  return base as NavKey;
}

function useNavItems() {
  const t = useT();
  const st = useApp.getState();
  return [
    { key: 'home' as const, label: t.nav2.home, icon: Icon.home, go: () => st.navigate({ name: 'home' }) },
    { key: 'map' as const, label: t.nav2.map, icon: Icon.map, go: () => st.navigate({ name: 'map' }) },
    { key: 'line' as const, label: t.nav2.lines, icon: Icon.line, go: () => st.navigate({ name: 'line', ref: null }) },
    { key: 'network' as const, label: t.nav2.network, icon: Icon.layers, go: () => st.navigate({ name: 'network' }) },
    { key: 'mine' as const, label: t.nav2.mine, icon: Icon.star(false), go: () => st.navigate({ name: 'mine' }) },
  ];
}

export function TopBar() {
  const t = useT();
  const view = useApp((s) => s.view);
  const base = useApp((s) => s.base);
  const lang = useApp((s) => s.lang);
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const online = useApp((s) => s.online);
  const backend = useApp((s) => s.backend);
  const now = useNow(1000);
  const st = useApp.getState();
  const items = useNavItems().filter((i) => i.key !== 'mine');
  const tab = activeTab(view, base);
  const alerts = network?.alerts.length ?? 0;
  const live = clock.isLive();
  const date = localDate(now);
  const hol = network ? holidayName(date, network.holidays) : null;
  const dayType = engine?.dayTypeAt(now);
  const clockText = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  const dayText = new Intl.DateTimeFormat(lang === 'ca' ? 'ca' : 'es', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' }).format(now);

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => st.navigate({ name: 'home' })} aria-label={t.appName}>
        <Logo size={34} compact />
      </button>

      <button type="button" className="live-chip" onClick={() => st.set({ alertsOpen: true })} aria-label={`${t.liveSim} · ${alerts ? t.incidentsN(alerts) : t.noIncidents}`}>
        <span className={`live-dot${alerts ? ' warn' : ''}`} aria-hidden />
        <span className="live-text">{t.liveSim}</span>
        <span className="live-sub">{alerts ? t.incidentsN(alerts) : t.noIncidents}</span>
      </button>

      <nav className="topnav" aria-label="Navegació">
        {items.map((i) => (
          <button key={i.key} type="button" aria-current={tab === i.key ? 'page' : undefined} className={tab === i.key ? 'on' : ''} onClick={i.go}>
            {i.label}
          </button>
        ))}
      </nav>

      <div className="top-right">
        <div className="clock" aria-live="off">
          <span className={`clock-time mono${live ? '' : ' forced'}`}>{clockText}</span>
          <span className="clock-day">
            {dayText} · {hol ? `${t.holiday}: ${hol}` : dayType ? t.dayType[dayType] : ''}
            {!live && <strong className="forced-tag"> · {t.demoTime}{clock.getSpeed() !== 1 ? ` ×${clock.getSpeed()}` : ''}</strong>}
          </span>
        </div>
        {!online && <span className="pill warn" title={t.offline}>offline</span>}
        {backend === 'live' && <span className="pill ok" title={t.backendLive}>API</span>}
        <button type="button" className="lang-btn" aria-label={`${lang === 'ca' ? 'ES' : 'CA'} · ${t.lang}`} onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}>
          {lang === 'ca' ? 'ES' : 'CA'}
        </button>
        <IconButton label={t.present} onClick={() => st.navigate({ name: 'present' })} className="present-btn">
          {Icon.play}
        </IconButton>
        <AccountMenu />
      </div>
    </header>
  );
}

/** Navegació inferior al mòbil: Inici · Mapa · Línies · Els meus. */
export function BottomNav() {
  const view = useApp((s) => s.view);
  const base = useApp((s) => s.base);
  const trip = useApp((s) => s.trip);
  const items = useNavItems().filter((i) => i.key !== 'network');
  const tab = activeTab(view, base);
  return (
    <nav className="bottomnav" aria-label="Navegació">
      {items.map((i) => (
        <button key={i.key} type="button" aria-current={tab === i.key ? 'page' : undefined} className={tab === i.key ? 'on' : ''} onClick={i.go}>
          <span className="bn-icon" aria-hidden>
            {i.icon}
            {i.key === 'mine' && trip && <span className="bn-badge" />}
          </span>
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
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
  const focus = useApp((s) => s.focusRoute);
  const [open, setOpen] = useState(false);
  const now = useNow(30000);
  const st = useApp.getState();
  if (!network || !engine) return null;
  const dayType = engine.dayTypeAt(now);
  const routes = [...network.routes].sort((a, b) => Number(engine.runsOn(b.id, dayType)) - Number(engine.runsOn(a.id, dayType)) || a.order - b.order);
  const focused = focus ? engine.routes.get(focus) : null;
  return (
    <div className={`line-filter${open ? ' open' : ''}`}>
      <button type="button" className="lf-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t.lines}
        {focused ? <RouteChip route={focused} size="sm" /> : <span className="dim small">{t.all}</span>}
      </button>
      {focused && (
        <div className="lf-focus">
          <RouteChip route={focused} size="md" />
          <span className="lf-focus-name">{focused.longName}</span>
          <button type="button" className="lf-all" onClick={() => st.navigate({ name: 'line', ref: focused.id })}>
            {t.viewLine}
          </button>
        </div>
      )}
      <div className="lf-chips" role="group" aria-label={t.lines}>
        {routes.map((r) => {
          const on = focus === r.id;
          const runs = engine.runsOn(r.id, dayType);
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              title={runs ? r.longName : `${r.longName} · ${t.notToday}`}
              className={`lf-chip${on || !focus ? ' on' : ''}${on ? ' focused' : ''}${runs ? '' : ' off-today'}`}
              style={{ ['--c' as string]: r.color, ['--tc' as string]: r.textColor }}
              onClick={() => {
                st.setFocusRoute(on ? null : r.id);
                if (!on && st.selectedBus && vehicleById(engine, st.selectedBus, clock.now())?.routeId !== r.id) st.selectBus(null);
              }}
            >
              {r.ref}
            </button>
          );
        })}
        <button type="button" className="lf-all" onClick={() => st.setFocusRoute(null)}>
          {t.all}
        </button>
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


/** Inicial del compte per a l'avatar. */
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/** Sortir del compte: es torna a la landing (l'app demana sessió). */
export async function signOut() {
  await auth.signOut();
  const st = useApp.getState();
  st.setUser(null);
  st.navigate({ name: 'landing' });
}

/** Avatar del compte amb el menú (nom, correu, tancar la sessió). */
export function AccountMenu() {
  const t = useT();
  const user = useApp((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!user) return null;
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar" aria-label={`${t.authUi.account}: ${user.name}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        {initial(user.name)}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{user.name}</strong>
            <span className="dim">{user.email}</span>
            {user.demo && <span className="status-pill st-en_cabecera">{t.authUi.demoBadge}</span>}
          </div>
          <button type="button" role="menuitem" className="account-item" onClick={() => void signOut()}>
            {t.authUi.signOut}
          </button>
          <p className="account-note dim">{t.authUi.localNote}</p>
        </div>
      )}
    </div>
  );
}
