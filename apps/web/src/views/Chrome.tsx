/** Barra superior, banner de honestidad, avisos, "qué es real", filtro de líneas y controles del mapa. */
import { useEffect, useRef, useState } from 'react';
import { activeAlerts, forcedInstant, isOngoing } from '@bus/core';
import { clock, useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { vehicleById } from '../data/vehicles.ts';
import { Icon, IconButton, RouteChip, hm, useNow } from '../ui/common.tsx';
import { Logo } from '../ui/Logo.tsx';
import { Ic } from '../ui/icons.tsx';
import { auth } from '../auth/auth.ts';
import { locationService } from '../location/location.ts';

type NavKey = 'home' | 'map' | 'line' | 'plan' | 'more';

/** a quina pestanya pertany cada vista (com a l'app de TUS: cerca, QR i avisos són del Mapa) */
const TAB_OF: Record<string, NavKey> = {
  home: 'home',
  tickets: 'home',
  cards: 'home',
  map: 'map',
  present: 'map',
  findStop: 'map',
  scan: 'map',
  alerts: 'map',
  line: 'line',
  plan: 'plan',
  route: 'plan',
  more: 'more',
  mine: 'more',
  account: 'more',
  office: 'more',
  favs: 'more',
  network: 'home',
};

/** Pestanya activa: les vistes de detall (parada, bus) mantenen la vista d'on venien. */
function activeTab(view: ReturnType<typeof useApp.getState>['view'], base: string): NavKey {
  return TAB_OF[view.name] ?? TAB_OF[base] ?? 'home';
}

function useNavItems() {
  const t = useT();
  const st = useApp.getState();
  // una pestanya porta a la seva pantalla: la fitxa d'un bus oberta a sobre es tanca (al mapa, es manté)
  const to = (v: Parameters<typeof st.navigate>[0]) => () => {
    if (v.name !== 'map' && useApp.getState().selectedBus) st.selectBus(null);
    st.navigate(v);
  };
  return [
    { key: 'home' as const, label: t.p.nav.home, icon: Ic.home, go: to({ name: 'home' }) },
    { key: 'map' as const, label: t.p.nav.map, icon: Ic.map, go: to({ name: 'map' }) },
    { key: 'line' as const, label: t.p.nav.lines, icon: Ic.lines, go: to({ name: 'line', ref: null }) },
    { key: 'plan' as const, label: t.p.nav.plan, icon: Ic.plan, go: to({ name: 'plan' }) },
    { key: 'more' as const, label: t.p.nav.more, icon: Ic.more, go: to({ name: 'more' }) },
  ];
}

export function TopBar() {
  const t = useT();
  const view = useApp((s) => s.view);
  const base = useApp((s) => s.base);
  const lang = useApp((s) => s.lang);
  const network = useApp((s) => s.network);
  const online = useApp((s) => s.online);
  const backend = useApp((s) => s.backend);
  const now = useNow(1000);
  const st = useApp.getState();
  const items = useNavItems();
  const tab = activeTab(view, base);
  // el número: només els avisos en vigor ara (els anunciats per a més endavant surten a «Propers», sense comptar)
  const alerts = network ? activeAlerts(network.alerts, now).filter((a) => isOngoing(a, now)).length : 0;
  const live = clock.isLive();
  const control = view.name === 'network';
  const clockText = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);

  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => st.navigate({ name: 'home' })} aria-label={t.appName}>
        <Logo size={32} compact />
      </button>

      {control ? (
        <span className="control-tag">Control</span>
      ) : (
        // la transparència: sempre a la vista, en petit; obre l'explicació
        <button type="button" className="demo-pill" onClick={() => st.set({ aboutOpen: true })} aria-label={`${t.demoPill}. ${t.whatData}`}>
          <span className="demo-pill-dot" aria-hidden />
          <span className="demo-long">{t.demoPill}</span>
          <span className="demo-short" aria-hidden>
            {t.p.demoShort}
          </span>
          {Icon.info}
        </button>
      )}

      <nav className="topnav" aria-label="Navegació">
        {items.map((i) => (
          <button key={i.key} type="button" aria-current={tab === i.key ? 'page' : undefined} className={tab === i.key ? 'on' : ''} onClick={i.go}>
            {i.label}
          </button>
        ))}
      </nav>

      <div className="top-right">
        {!live && (
          // hora de demo (presentacions): només quan no és l'hora real
          <span className="demo-clock" title={t.demoTime}>
            <span className="mono">{clockText}</span>
            <span className="demo-clock-tag">
              {t.demoTime}
              {clock.getSpeed() !== 1 ? ` ×${clock.getSpeed()}` : ''}
            </span>
          </span>
        )}
        {!online && <span className="pill warn" title={t.offline}>offline</span>}
        {backend === 'live' && <span className="pill ok" title={t.backendLive}>API</span>}
        {!control && (
          <>
            <IconButton label={t.p.head.scan} onClick={() => st.navigate({ name: 'scan' })} className="head-btn">
              {Ic.qr}
            </IconButton>
            <IconButton label={t.p.head.find} onClick={() => st.navigate({ name: 'findStop' })} className="head-btn">
              {Ic.search}
            </IconButton>
          </>
        )}
        {/* avisos: sempre a la vista; el número compta només els publicats ara */}
        <IconButton label={t.p.head.alerts(alerts)} onClick={() => st.navigate({ name: 'alerts' })} className="alerts-btn head-btn">
          {Ic.alert}
          {alerts > 0 && <span className="badge">{alerts}</span>}
        </IconButton>
        <button type="button" className="lang-btn" aria-label={`${lang === 'ca' ? 'ES' : 'CA'} · ${t.lang}`} onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}>
          {lang === 'ca' ? 'ES' : 'CA'}
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}

/** Navegació inferior al mòbil: Inici · Mapa · Línies · Com hi arribo · Més (com l'app de TUS, amb Inici). */
export function BottomNav() {
  const view = useApp((s) => s.view);
  const base = useApp((s) => s.base);
  const trip = useApp((s) => s.trip);
  const items = useNavItems();
  const tab = activeTab(view, base);
  return (
    <nav className="bottomnav" aria-label="Navegació">
      {items.map((i) => (
        <button key={i.key} type="button" aria-current={tab === i.key ? 'page' : undefined} className={tab === i.key ? 'on' : ''} onClick={i.go}>
          <span className="bn-icon" aria-hidden>
            {i.icon}
            {i.key === 'map' && trip && <span className="bn-badge" />}
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
  // Escape tanca (teclat)
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && useApp.getState().set({ aboutOpen: false });
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
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
        <p className="about-lead">{t.demoExplain}</p>
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

export function LineFilter() {
  const t = useT();
  const network = useApp((s) => s.network);
  const engine = useApp((s) => s.engine);
  const focus = useApp((s) => s.focusRoute);
  const [open, setOpen] = useState(false);
  const now = useNow(30000);
  const st = useApp.getState();
  if (!network || !engine) return null;
  const routes = [...network.routes].sort((a, b) => Number(engine.runsAt(b.id, now)) - Number(engine.runsAt(a.id, now)) || a.order - b.order);
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
          const runs = engine.runsAt(r.id, now);
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
  const [msg, setMsg] = useState<string | null>(null);
  const st = useApp.getState();
  const locate = () => {
    setMsg(t.locating);
    void locationService.locate().then((pos) => {
      if (pos) {
        st.requestFly(pos, 16);
        setMsg(null);
      } else setMsg(t.locateError);
    });
  };
  return (
    <div className="map-controls">
      <IconButton label={t.locate} onClick={locate}>
        {Icon.locate}
      </IconButton>
      {/* només busos TUS: sense capes d'altres operadors. L'hora de demo es canvia per URL (?hora=08:15&dia=dimarts) */}
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
  st.navigate({ name: 'login' });
}

/** Menú: el compte, què són les dades, NextMobility Control i la presentació. També al mòbil. */
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
  const st = useApp.getState();
  const go = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar" aria-label={`${t.menu} · ${t.authUi.account}: ${user.name}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        {initial(user.name)}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <strong>{user.name}</strong>
            {!user.demo && <span className="dim">{user.email}</span>}
            {user.demo && <span className="dim">{t.authUi.demoBadge}</span>}
          </div>
          {user.demo && (
            <button type="button" role="menuitem" className="account-item" onClick={go(() => st.navigate({ name: 'register' }))}>
              {t.authUi.createAccount}
            </button>
          )}
          <button type="button" role="menuitem" className="account-item" onClick={go(() => st.set({ aboutOpen: true }))}>
            {Icon.info} {t.whatData}
          </button>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="account-item control" onClick={go(() => st.navigate({ name: 'network' }))}>
            <span>
              <strong>{t.control}</strong>
              <span className="dim small">{t.controlSub}</span>
            </span>
          </button>
          <button type="button" role="menuitem" className="account-item" onClick={go(() => st.navigate({ name: 'present' }))}>
            {Icon.play} {t.present}
          </button>
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="account-item" onClick={go(() => void signOut())}>
            {t.authUi.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
