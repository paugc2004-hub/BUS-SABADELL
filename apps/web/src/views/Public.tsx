/**
 * Pàgines públiques sense sessió (licitació 2024, PPT §2.1.5, §2.1.2 i §2.1.4):
 *  - /p/<codi>  fitxa de parada, destí dels QR: codi i nom, línies, propers busos (simulats, etiquetats) i horari teòric
 *  - /qr[/<codi>] generador de QR de parada (al dispositiu; descàrrega SVG/PNG i impressió)
 *  - /privacitat, /avis-legal, /galetes
 * Capçalera i peu comuns (logo, cercador de parades, enllaços legals). Sense mapa: es carrega ràpid amb dades mòbils.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { alertsFor, hhmm, isOngoing, localDate, normalize, serviceDayOrigin, stopTimetable, type DayType } from '@bus/core';
import { useApp, type LegalPage } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { loadNetwork } from '../data/load.ts';
import { liveArrivals } from '../data/derive.ts';
import { PUBLIC_ORIGIN, qrPath, qrSvg, stopCardUrl, validStopCode } from '../data/qr.ts';
import { RouteChip, SourceTag, hm, useNow } from '../ui/common.tsx';
import { Logo } from '../ui/Logo.tsx';

function useNetwork() {
  const engine = useApp((s) => s.engine);
  const network = useApp((s) => s.network);
  const state = useApp((s) => s.loadState);
  useEffect(() => {
    if (!useApp.getState().network) void loadNetwork();
  }, []);
  return { engine, network, state };
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();
  useEffect(() => {
    document.title = `${title} · NextMobility Sabadell`;
  }, [title]);
  return (
    <div className="pub" lang={lang}>
      <header className="pub-head">
        <a href="/" className="pub-logo" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'landing' }))} aria-label="NextMobility Sabadell">
          <Logo size={26} />
        </a>
        <nav className="pub-nav" aria-label={t.pub.qrTitle}>
          <a href="/qr" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'qr', id: null }))}>
            QR
          </a>
          <a href="/app" onClick={(e) => (e.preventDefault(), st.navigate({ name: 'home' }))}>
            App
          </a>
          <button type="button" className="pub-lang" onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')} aria-label={t.lang}>
            {lang === 'ca' ? 'ES' : 'CA'}
          </button>
        </nav>
      </header>
      <main className="pub-main">{children}</main>
      <footer className="pub-foot">
        <p className="dim small">{t.pub.unofficial}</p>
        <nav aria-label="Legal" className="pub-legal">
          {(['privacitat', 'avis-legal', 'galetes'] as const).map((p) => (
            <a key={p} href={`/${p}`} onClick={(e) => (e.preventDefault(), st.navigate({ name: 'legal', page: p }))}>
              {t.pub.legal[p]}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

/** dia de servei i tipus de dia d'ara (el mateix criteri que el motor) */
function useServiceDay(now: number) {
  const engine = useApp((s) => s.engine);
  return useMemo(() => {
    // origen del dia de servei d'avui («migdia − 12 h», com al GTFS i al motor)
    return { origin: serviceDayOrigin(localDate(now)), dayType: (engine?.dayTypeAt(now) ?? 'feiner') as DayType };
  }, [engine, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function StopCard({ id }: { id: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { engine, network, state } = useNetwork();
  const now = useNow(5000);
  const { origin, dayType } = useServiceDay(now);
  const stop = engine && validStopCode(id) ? engine.stops.get(id) : undefined;
  const tick = Math.floor(now / 15000);
  const arrivals = useMemo(() => (engine && stop ? liveArrivals(engine, [stop.id], now, 60, 30) : []), [engine, stop, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const m = new Map<string, typeof arrivals>();
    for (const a of arrivals) m.set(`${a.routeId}|${a.headsign}`, [...(m.get(`${a.routeId}|${a.headsign}`) ?? []), a]);
    return [...m.values()].slice(0, 8);
  }, [arrivals]);
  const tt = useMemo(() => (network && stop ? stopTimetable(network.patterns, stop.id, dayType) : []), [network, stop, dayType]);

  if (state !== 'ready' || !engine || !network)
    return (
      <Shell title={t.pub.stopCard}>
        <div className="loader" aria-hidden />
        <p className="sr-only" role="status">
          {t.loading}
        </p>
      </Shell>
    );
  if (!stop)
    return (
      <Shell title={t.pub.stopCard}>
        <h1 className="pub-h1">{t.pub.stopCard}</h1>
        <p role="alert">{t.pub.notFound}</p>
        <a className="cta" href="/qr" onClick={(e) => (e.preventDefault(), useApp.getState().navigate({ name: 'qr', id: null }))}>
          {t.pub.qrSearch}
        </a>
      </Shell>
    );

  const routes = [...stop.routes].sort((a, b) => (engine.routes.get(a)?.order ?? 0) - (engine.routes.get(b)?.order ?? 0));
  const alerts = alertsFor(network.alerts, now, { stops: [stop.id], routes });
  const secNow = Math.floor((now - origin) / 1000);
  return (
    <Shell title={`${stop.name} (${stop.id})`}>
      <article className="stop-card" aria-labelledby="sc-name">
        <div className="pub-eyebrow">
          {t.pub.stopCard} <span className="demo-tag">{t.pub.demo}</span>
        </div>
        <h1 id="sc-name" className="pub-h1">
          {stop.name}
        </h1>
        <p className="sc-code">
          {t.pub.code} <strong className="mono">{stop.id}</strong>
        </p>

        <section aria-labelledby="sc-lines">
          <h2 id="sc-lines" className="sec-title">
            {t.pub.lines}
          </h2>
          <ul className="chips sc-lines">
            {routes.map((r) => {
              const runs = engine.runsOn(r, dayType);
              return (
                <li key={r} title={runs ? engine.routes.get(r)?.longName : `${engine.routes.get(r)?.longName} · ${t.pub.notToday}`}>
                  <RouteChip route={engine.routes.get(r)} size="md" dim={!runs} />
                  {!runs && <span className="sr-only"> ({t.pub.notToday})</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {alerts.length > 0 && (
          <section aria-labelledby="sc-alerts" className="sc-alerts">
            <h2 id="sc-alerts" className="sec-title">
              {t.pub.alerts}
            </h2>
            {alerts.map((a) => (
              <div key={a.id} className="alert-inline" role="note">
                {!isOngoing(a, now) && <strong>{t.pub.upcoming}: </strong>}
                {a.text[lang]}
                {a.reason && (
                  <span className="dim">
                    {' '}
                    · {t.pub.reason}: {a.reason[lang]}
                  </span>
                )}
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="sc-next">
          <h2 id="sc-next" className="sec-title">
            {t.pub.next} <SourceTag source="SIMULATED" />
          </h2>
          {groups.length === 0 ? (
            <p className="card-empty">{t.pub.none}</p>
          ) : (
            <ul className="sc-next">
              {groups.map((g) => {
                const a = g[0]!;
                const mins = Math.max(0, Math.floor((a.at - now) / 60000));
                return (
                  <li key={`${a.routeId}|${a.headsign}`}>
                    <RouteChip route={engine.routes.get(a.routeId)} size="sm" />
                    <span className="sc-dest">→ {a.headsign}</span>
                    <span className="sc-when">
                      <strong>{mins <= 0 ? t.nowLabel : `${mins} min`}</strong>
                      <span className="dim small"> {hm(a.at)}</span>
                      {g[1] && <span className="dim small"> · {hm(g[1].at)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="dim small">{t.pub.estimate}</p>
        </section>

        <section aria-labelledby="sc-tt">
          <h2 id="sc-tt" className="sec-title">
            {t.pub.timetable} · {t.pub.dayType[dayType]}
          </h2>
          <p className="dim small">{t.pub.timetableHint}</p>
          <ul className="sc-tt">
            {tt.map((g) => {
              const upcoming = g.times.filter((s) => s >= secNow).slice(0, 6);
              return (
                <li key={`${g.routeId}|${g.dir}|${g.headsign}`}>
                  <div className="sc-tt-head">
                    <RouteChip route={engine.routes.get(g.routeId)} size="sm" /> <span>→ {g.headsign}</span>
                  </div>
                  <div className="mono sc-tt-next">{upcoming.length ? upcoming.map(hhmm).join(' · ') : '—'}</div>
                  <details className="sc-tt-all">
                    <summary>{t.pub.fullDay(g.times.length)}</summary>
                    <p className="mono">{g.times.map(hhmm).join(' ')}</p>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="sc-actions no-print">
          <a className="cta cta-primary" href={`/parada/${encodeURIComponent(stop.id)}`} onClick={(e) => (e.preventDefault(), useApp.getState().navigate({ name: 'stop', id: stop.id }))}>
            {t.pub.openApp}
          </a>
          <button
            type="button"
            className="cta"
            onClick={() => {
              document.querySelectorAll<HTMLDetailsElement>('.sc-tt-all').forEach((d) => (d.open = true));
              window.print();
            }}
          >
            {t.pub.print}
          </button>
        </div>
        <p className="dim small">{t.pub.source(network.builtAt)}</p>
      </article>
    </Shell>
  );
}

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function QrPage({ id }: { id: string | null }) {
  const t = useT();
  const { engine, state } = useNetwork();
  const [q, setQ] = useState('');
  const st = useApp.getState();
  const stop = engine && id && validStopCode(id) ? engine.stops.get(id) : undefined;
  const matches = useMemo(() => {
    if (!engine) return [];
    const nq = normalize(q.trim());
    if (!nq) return [];
    const all = [...engine.stops.values()];
    return all
      .filter((s) => s.id === q.trim() || s.id.startsWith(q.trim()) || normalize(s.name).includes(nq))
      .sort((a, b) => Number(b.id === q.trim()) - Number(a.id === q.trim()) || a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [engine, q]);
  const url = stop ? stopCardUrl(stop.id) : '';
  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);

  const png = () => {
    if (!stop) return;
    const svg = qrSvg(url, { title: t.pub.qrFor(stop.id, stop.name) });
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 1024, 1024);
      download(`parada-${stop.id}.png`, c.toDataURL('image/png'));
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  return (
    <Shell title={t.pub.qrTitle}>
      <h1 className="pub-h1">{t.pub.qrTitle}</h1>
      <p className="no-print">{t.pub.qrIntro}</p>
      <label className="qr-search no-print">
        <span>{t.pub.qrSearch}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" inputMode="search" placeholder="278, Rambla…" />
      </label>
      {state !== 'ready' && <div className="loader" aria-hidden />}
      {q.trim() && (
        <ul className="qr-matches no-print" aria-live="polite">
          {matches.length === 0 && <li className="dim">{t.pub.noMatch}</li>}
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setQ('');
                  st.navigate({ name: 'qr', id: s.id });
                }}
              >
                <span className="mono">{s.id}</span> · {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {stop && qr && engine && (
        <figure className="qr-card" aria-label={t.pub.qrFor(stop.id, stop.name)}>
          <div className="qr-card-head">
            <span className="mono qr-card-code">{stop.id}</span>
            <strong>{stop.name}</strong>
          </div>
          <div className="chips">
            {stop.routes.map((r) => (
              <RouteChip key={r} route={engine.routes.get(r)} size="sm" />
            ))}
          </div>
          <svg className="qr-svg" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label={t.pub.qrFor(stop.id, stop.name)}>
            <rect width={qr.size} height={qr.size} fill="#fff" />
            <path fill="#000" d={qr.d} />
          </svg>
          <figcaption>
            <strong>{t.pub.qrScan}</strong>
            <span className="mono small qr-url">{url.replace(/^https?:\/\//, '')}</span>
          </figcaption>
        </figure>
      )}
      {stop && (
        <div className="sc-actions no-print">
          <button type="button" className="cta" onClick={() => download(`parada-${stop.id}.svg`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(url, { title: t.pub.qrFor(stop.id, stop.name) }))}`)}>
            {t.pub.downloadSvg}
          </button>
          <button type="button" className="cta" onClick={png}>
            {t.pub.downloadPng}
          </button>
          <button type="button" className="cta cta-primary" onClick={() => window.print()}>
            {t.pub.print}
          </button>
          <a href={`/p/${stop.id}`} onClick={(e) => (e.preventDefault(), st.navigate({ name: 'stopCard', id: stop.id }))}>
            {t.pub.stopCard} →
          </a>
        </div>
      )}
      <p className="dim small no-print">
        {t.pub.qrPoints(`${PUBLIC_ORIGIN}/p/<codi>`)} · {t.pub.qrProto}
      </p>
    </Shell>
  );
}

/* ---------- pàgines legals: descriuen el que fa l'app de veritat (vegeu docs/SECURITY_AUDIT.md) ---------- */

const LEGAL: Record<'ca' | 'es', Record<LegalPage, { h: string; p: string[] }[]>> = {
  ca: {
    privacitat: [
      { h: 'Qui som', p: ['NextMobility Sabadell és una demostració independent per a la proposta a TUS i a l’Ajuntament de Sabadell. No és un servei oficial de TUS ni de l’Ajuntament.'] },
      {
        h: 'Quines dades fem servir',
        p: [
          'La teva ubicació només s’usa al teu dispositiu per trobar parades i calcular rutes. No es desa ni s’envia a cap servidor.',
          'Quan busques un lloc, al nostre servidor de cerca només li arriba el text que escrius (no la ubicació). El servidor el consulta a Photon (dades d’OpenStreetMap) o, si està configurat, a Google Places.',
          'Els comptes són ficticis i viuen al teu navegador: nom, correu i una empremta de la contrasenya (PBKDF2), mai la contrasenya en clar. No hi ha cap base de dades de persones usuàries.',
          'Les teselles del mapa es demanen a OpenFreeMap o CARTO; com qualsevol web, aquests servidors reben l’adreça IP de la petició.',
        ],
      },
      { h: 'Els teus drets', p: ['Com que les dades són al teu dispositiu, les pots consultar i esborrar tu mateix: tanca la sessió o esborra les dades del lloc al navegador. Per a qualsevol consulta, escriu a través del repositori públic del projecte.'] },
    ],
    'avis-legal': [
      { h: 'Naturalesa del servei', p: ['Demostració sense ànim de lucre. Les posicions dels autobusos són simulades a partir dels horaris publicats; no són temps real.'] },
      { h: 'Fonts', p: ['Xarxa, parades i horaris: informació pública de tus.es. Mapa i carrers: © OpenStreetMap contributors (ODbL). No s’usa cap API privada ni la marca de TUS.'] },
      { h: 'Responsabilitat', p: ['Comprova sempre l’horari oficial abans de viatjar. Aquesta demostració no substitueix la informació de TUS.'] },
    ],
    galetes: [
      { h: 'No fem servir galetes', p: ['Aquesta web no instal·la galetes pròpies ni de tercers, ni eines d’analítica.'] },
      {
        h: 'Emmagatzematge local',
        p: [
          'Per funcionar, desa al teu navegador (localStorage): la sessió i els comptes ficticis (nextmobility.session, nextmobility.users), les parades guardades (favs), el viatge que segueixes (myBus), l’idioma (lang) i si ja t’hem preguntat per la ubicació (nextmobility.locAsked). No surt del dispositiu.',
          'Si algun dia s’hi afegeix analítica, es demanarà el consentiment abans.',
        ],
      },
    ],
  },
  es: {
    privacitat: [
      { h: 'Quiénes somos', p: ['NextMobility Sabadell es una demostración independiente para la propuesta a TUS y al Ayuntamiento de Sabadell. No es un servicio oficial de TUS ni del Ayuntamiento.'] },
      {
        h: 'Qué datos usamos',
        p: [
          'Tu ubicación solo se usa en tu dispositivo para encontrar paradas y calcular rutas. No se guarda ni se envía a ningún servidor.',
          'Cuando buscas un lugar, a nuestro servidor de búsqueda solo le llega el texto que escribes (no la ubicación). El servidor lo consulta a Photon (datos de OpenStreetMap) o, si está configurado, a Google Places.',
          'Las cuentas son ficticias y viven en tu navegador: nombre, correo y una huella de la contraseña (PBKDF2), nunca la contraseña en claro. No hay ninguna base de datos de personas usuarias.',
          'Las teselas del mapa se piden a OpenFreeMap o CARTO; como cualquier web, esos servidores reciben la dirección IP de la petición.',
        ],
      },
      { h: 'Tus derechos', p: ['Como los datos están en tu dispositivo, puedes consultarlos y borrarlos tú: cierra la sesión o borra los datos del sitio en el navegador. Para cualquier consulta, escribe a través del repositorio público del proyecto.'] },
    ],
    'avis-legal': [
      { h: 'Naturaleza del servicio', p: ['Demostración sin ánimo de lucro. Las posiciones de los autobuses son simuladas a partir de los horarios publicados; no son tiempo real.'] },
      { h: 'Fuentes', p: ['Red, paradas y horarios: información pública de tus.es. Mapa y calles: © OpenStreetMap contributors (ODbL). No se usa ninguna API privada ni la marca de TUS.'] },
      { h: 'Responsabilidad', p: ['Comprueba siempre el horario oficial antes de viajar. Esta demostración no sustituye la información de TUS.'] },
    ],
    galetes: [
      { h: 'No usamos cookies', p: ['Esta web no instala cookies propias ni de terceros, ni herramientas de analítica.'] },
      {
        h: 'Almacenamiento local',
        p: [
          'Para funcionar, guarda en tu navegador (localStorage): la sesión y las cuentas ficticias (nextmobility.session, nextmobility.users), las paradas guardadas (favs), el viaje que sigues (myBus), el idioma (lang) y si ya te hemos preguntado por la ubicación (nextmobility.locAsked). No sale del dispositivo.',
          'Si algún día se añade analítica, se pedirá el consentimiento antes.',
        ],
      },
    ],
  },
};

export function Legal({ page }: { page: LegalPage }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  return (
    <Shell title={t.pub.legal[page]}>
      <article className="legal">
        <h1 className="pub-h1">{t.pub.legal[page]}</h1>
        {LEGAL[lang][page].map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </section>
        ))}
      </article>
    </Shell>
  );
}
