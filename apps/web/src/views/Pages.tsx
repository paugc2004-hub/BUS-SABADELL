/**
 * Pàgines de paritat amb l'app oficial de TUS: Avisos (triangle de la capçalera), Més, Oficina de Mobilitat,
 * Preferides i el carrusel de Novetats del mapa. Disseny de NextMobility; continguts de TUS citats i datats.
 */
import { useMemo, useState } from 'react';
import { activeAlerts, isOngoing, type Alert } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { RouteChip, useNow } from '../ui/common.tsx';
import { Ic } from '../ui/icons.tsx';
import { Group, PageHead, Row } from '../ui/Page.tsx';
import { SALES_POINTS, hhmmMin, openState } from '../data/salesPoints.ts';
import { LINKS } from '../data/fares.ts';
import { HomeStops } from './Home.tsx';

const fmtWhen = (iso: string, lang: string) => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(lang, { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return time === '00:00' ? date : `${date}, ${time.replace(':', '.')} h`;
};

function AlertCard({ a }: { a: Alert }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const engine = useApp((s) => s.engine);
  const st = useApp.getState();
  return (
    <article className="al-card" aria-labelledby={`al-${a.id}`}>
      <span className="al-icon">{Ic.alert}</span>
      <div className="al-body">
        <h3 id={`al-${a.id}`}>{a.title?.[lang] ?? t.alerts}</h3>
        <p className="al-when">{t.p.alerts.period(fmtWhen(a.from, lang), a.to ? fmtWhen(a.to, lang) : null)}</p>
        {a.routes.length > 0 && (
          <div className="al-lines" aria-label={t.p.alerts.lines}>
            {a.routes.map((r) => (
              <button key={r} type="button" className="chip-btn" onClick={() => st.navigate({ name: 'line', ref: r })}>
                <RouteChip route={engine?.routes.get(r)} size="md" />
              </button>
            ))}
          </div>
        )}
        <p className="al-text">{a.text[lang]}</p>
        {a.reason && (
          <p className="dim small">
            {t.pub.reason}: {a.reason[lang]}
          </p>
        )}
        {a.attachments?.map((f) => (
          <a key={f.url} className="al-more" href={f.url} target="_blank" rel="noopener noreferrer">
            {f.title} {Ic.ext}
          </a>
        ))}
        {a.url && (
          <a className="al-more" href={a.url} target="_blank" rel="noopener noreferrer">
            {t.p.alerts.more} {Ic.ext}
          </a>
        )}
      </div>
    </article>
  );
}

export function AlertsPage() {
  const t = useT();
  const network = useApp((s) => s.network);
  const now = useNow(30000);
  if (!network) return null;
  // només els publicats ara; els que encara no han començat són «Propers» (p. ex. un tall de demà)
  const list = activeAlerts(network.alerts, now);
  const live = list.filter((a) => isOngoing(a, now));
  const soon = list.filter((a) => !isOngoing(a, now));
  return (
    <aside className="home alerts-page" aria-label={t.p.alerts.title}>
      <PageHead title={t.p.alerts.title} up={{ name: 'map' }} />
      <section className="al-sec">
        <h2 className="group-title">{t.p.alerts.now}</h2>
        {live.length ? live.map((a) => <AlertCard key={a.id} a={a} />) : <p className="empty">{t.p.alerts.none}</p>}
      </section>
      <section className="al-sec">
        <h2 className="group-title">{t.p.alerts.upcoming}</h2>
        {soon.length ? soon.map((a) => <AlertCard key={a.id} a={a} />) : <p className="empty">{t.p.alerts.noneUpcoming}</p>}
      </section>
      <p className="dim small">{t.p.alerts.source}</p>
    </aside>
  );
}

/* ------------------------------------------------------------------ Més */

const SOCIAL = [
  { name: 'X (Twitter)', url: 'https://x.com/tussccl' },
  { name: 'Facebook', url: 'https://www.facebook.com/tussccl' },
  { name: 'Instagram', url: 'https://www.instagram.com/tussccl' },
];

export function MorePage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const network = useApp((s) => s.network);
  const st = useApp.getState();
  const go = (v: Parameters<typeof st.navigate>[0]) => () => st.navigate(v);
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const built = network ? new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(network.builtAt)) : '—';
  return (
    <aside className="home more-page" aria-label={t.p.more.title}>
      <h1 className="page-title">{t.p.more.title}</h1>
      <Group>
        <Row icon={Ic.store} label={t.p.more.sales} onClick={go({ name: 'sales' })} />
        <Row icon={Ic.office} label={t.p.more.office} onClick={go({ name: 'office' })} />
        <Row icon={Ic.alert} label={t.p.more.alerts} onClick={go({ name: 'alerts' })} />
        <Row icon={Ic.info} label={t.p.more.titles} onClick={go({ name: 'fares' })} />
        <Row icon={Ic.star} label={t.p.more.favs} onClick={go({ name: 'favs' })} />
      </Group>
      <Group>
        <Row icon={Ic.user} label={t.p.more.account} onClick={go({ name: 'mine' })} />
        <Row
          icon={Ic.globe}
          label={t.p.more.lang}
          sub={lang === 'ca' ? 'Català' : 'Castellano'}
          trailing={<span className="row-end lang-pill">{lang === 'ca' ? 'ES' : 'CA'}</span>}
          onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}
        />
        <Row icon={Ic.access} label={t.p.more.access} onClick={go({ name: 'account', page: 'settings' })} />
        <Row icon={Ic.qr} label={t.p.more.qr} onClick={go({ name: 'qr', id: null })} />
      </Group>
      <Group title={t.p.more.social}>
        <Row icon={Ic.globe} label={t.p.more.web} href="https://www.tus.es/" />
        {SOCIAL.map((s) => (
          <Row key={s.name} icon={Ic.link} label={s.name} href={s.url} />
        ))}
        <Row icon={Ic.link} label={t.p.more.youtube} href="https://www.youtube.com/results?search_query=Transports+Urbans+de+Sabadell" />
      </Group>
      <Group>
        <Row icon={Ic.info} label={t.p.more.about} onClick={() => st.set({ aboutOpen: true })} />
        {/* també al menú del compte (escriptori); al mòbil petit, el menú no hi és */}
        <Row icon={Ic.map} label={t.control} sub={t.controlSub} onClick={go({ name: 'network' })} />
        <Row icon={Ic.lines} label={t.present} onClick={go({ name: 'present' })} />
        <Row icon={Ic.doc} label={t.p.more.legal} onClick={go({ name: 'legal', page: 'privacitat' })} />
      </Group>
      <p className="more-foot">
        {t.p.more.version(version, built)}
        <br />
        <span className="dim">{t.p.more.notOfficial}</span>
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ Oficina de Mobilitat */

/** l'Estació d'Autobusos de Sabadell a OpenStreetMap (data/raw/osm/llocs-2026-10-07.json, lloc 502) */
const OFFICE_PLACE = 'l502';

export function OfficePage() {
  const t = useT();
  const network = useApp((s) => s.network);
  const now = useNow(30000);
  const st = useApp.getState();
  const p = SALES_POINTS.find((x) => x.id === 'oficina-mobilitat');
  const holidays = useMemo(() => (network ? new Set(network.holidays.map((h) => h.date)) : null), [network]);
  if (!p) return null;
  const s = openState(p, now, holidays);
  const days = [0, 1, 2, 3, 4, 5, 6] as const;
  const fmt = (rs: [number, number][]) => rs.map(([a, b]) => `${hhmmMin(a)}–${hhmmMin(b)}`).join(' · ');
  return (
    <aside className="home office-page" aria-label={t.p.office.title}>
      <PageHead title={t.p.office.title} up={{ name: 'more' }} />
      <p className="office-what">{t.p.office.what}</p>
      <div className="office-card">
        <span className="row-icon">{Ic.office}</span>
        <div>
          <strong>{t.p.office.where}</strong>
          <p className="dim small">{t.p.office.moved}</p>
        </div>
      </div>
      <p className={`sp-state st-${s.state}`}>{s.state === 'open' ? t.p.office.open : s.state === 'closed' ? t.p.office.closed : t.p.office.unknown}</p>
      <Group title={t.p.office.hours}>
        <dl className="office-hours">
          {days.map((d) => (
            <div key={d}>
              <dt>{t.fares.daysShort[d]}</dt>
              <dd>{p.hours[d]?.ranges.length ? fmt(p.hours[d]!.ranges) : '—'}</dd>
            </div>
          ))}
        </dl>
      </Group>
      <p className="dim small">{t.p.office.hoursNote}</p>
      <p className="office-sells">
        <strong>{t.p.office.sells}:</strong> {p.titles.map((x) => t.fares.titles[x]).join(' · ')}
      </p>
      <div className="btn-stack">
        <button type="button" className="btn primary wide" onClick={() => st.navigate({ name: 'route', to: OFFICE_PLACE })}>
          {t.p.office.go}
        </button>
        <button type="button" className="btn ghost wide" onClick={() => st.navigate({ name: 'sales' })}>
          {t.p.office.sales}
        </button>
        <a className="btn ghost wide" href={LINKS.tusSales.ca} target="_blank" rel="noopener noreferrer">
          tus.es {Ic.ext}
        </a>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ Preferides */

export function FavsPage() {
  const t = useT();
  const favorites = useApp((s) => s.favorites);
  return (
    <aside className="home favs-page" aria-label={t.p.favs.title}>
      <PageHead title={t.p.favs.title} up={{ name: 'more' }} />
      {favorites.length ? <HomeStops /> : <p className="empty">{t.p.favs.empty}</p>}
    </aside>
  );
}

/* ------------------------------------------------------------------ Novetats (carrusel del mapa) */

interface News {
  id: string;
  from: string;
  to: string | null;
}

/** Novetats publicades per TUS (data/NOVETATS: font i data a docs/TUS_PARITY.md). Sense imatges de TUS. */
const NEWS: News[] = [{ id: 'oficina-2026-09-08', from: '2026-09-08', to: '2026-12-31' }];
const HIDDEN_KEY = 'nextmobility.news.hidden';

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function NewsCarousel() {
  const t = useT();
  const now = useNow(60000);
  const st = useApp.getState();
  const [hidden, setHidden] = useState<string[]>(readHidden);
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);
  const today = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Madrid' }).format(now);
  const list = NEWS.filter((n) => n.from <= today && (!n.to || today <= n.to) && !hidden.includes(n.id));
  if (!list.length) return null;
  const n = list[Math.min(i, list.length - 1)]!;
  const dismiss = () => {
    const next = [...hidden, n.id];
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setHidden(next);
    setI(0);
  };
  if (!open)
    return (
      <button type="button" className="news-pill" onClick={() => setOpen(true)} aria-expanded={false}>
        {Ic.info} {t.p.news.show} ({list.length})
      </button>
    );
  return (
    <section className="news" aria-roledescription="carousel" aria-label={t.p.news.title}>
      <div className="news-slide" role="group" aria-roledescription="slide" aria-label={t.p.news.slide(i + 1, list.length)}>
        <span className="news-icon">{Ic.office}</span>
        <div className="news-body">
          <p className="news-kicker">{t.p.news.officeKicker}</p>
          <h2 className="news-title">{t.p.news.officeTitle}</h2>
          <p className="news-text">{t.p.news.officeText}</p>
          <div className="news-actions">
            <button type="button" className="text-btn" onClick={() => st.navigate({ name: 'office' })}>
              {t.p.news.officeCta} ›
            </button>
            <button type="button" className="text-btn dim" onClick={dismiss}>
              {t.p.news.dismiss}
            </button>
          </div>
        </div>
        <button type="button" className="news-close" aria-label={t.p.news.hide} aria-expanded onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      {list.length > 1 && (
        <div className="news-dots">
          {list.map((x, k) => (
            <button key={x.id} type="button" aria-label={t.p.news.slide(k + 1, list.length)} aria-current={k === i} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
          ))}
        </div>
      )}
    </section>
  );
}

