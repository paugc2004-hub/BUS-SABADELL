/**
 * Tarifes i títols (/tarifes) i punts de venda (/punts-de-venda).
 * Primer l'essencial (preu, per a qui, avantatges); les condicions completes, a «Més informació».
 * Dades: data/fares.ts i data/salesPoints.ts (font inicial facilitada; pendents de verificar a la font oficial).
 */
import { useEffect, useMemo, useState } from 'react';
import { normalize } from '@bus/core';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { FARES, LINKS, euros, fareById, monthlyCost, type Fare, type FareCategory, type SalesTitle } from '../data/fares.ts';
import { NEIGHBOURHOODS, SALES_POINTS, hhmmMin, mapsSearchUrl, openState, type OpenState, type SalesPoint, type Weekday } from '../data/salesPoints.ts';
import { useNow } from '../ui/common.tsx';
import { Shell } from './Public.tsx';
import { loadHolidayDates } from '../data/load.ts';

type Cat = 'all' | FareCategory;
const CATS: Cat[] = ['all', 'single', 'multi', 'pass', 'social', 'integrated'];
const TITLES: SalesTitle[] = ['t-sabadell', 't10', 't-mensual', 't-mensual-jove'];

function go(e: React.MouseEvent, fn: () => void) {
  e.preventDefault();
  fn();
}

/* ------------------------------------------------------------------ tarifes */

function PriceTag({ f }: { f: Fare }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  if (f.priceKind === 'free') return <p className="fare-price">{t.fares.free}</p>;
  if (f.priceKind === 'none' || f.price === null) return <p className="fare-price fare-price-sm">{t.fares.noPrice}</p>;
  return (
    <p className="fare-price">
      {euros(f.price, lang)}
      {f.priceKind === 'issuance' && <span className="fare-price-note"> · {t.fares.issuance}</span>}
    </p>
  );
}

/** etiqueta curta de la il·lustració (noms propis dels títols: no es tradueixen) */
const ART_LABEL: Record<string, string | { ca: string; es: string }> = {
  senzill: { ca: '1 viatge', es: '1 viaje' },
  t10: 'T-10',
  't-mensual': 'T-mensual',
  't-mensual-jove': 'Jove',
  'tarificacio-social': 'Social',
  acompanyant: '+1',
  escolar: { ca: 'Escola', es: 'Escuela' },
  'tbus-sant-quirze': 'TBUS L12',
  t16: 'T-16',
};

/** il·lustració pròpia i orientativa (cap logotip ni disseny oficial) */
function FareArt({ f }: { f: Fare }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const label = ART_LABEL[f.id];
  const short = typeof label === 'string' ? label : (label?.[lang] ?? f.name[lang]);
  return (
    <div className={`fare-art cat-${f.category}`} role="img" aria-label={t.fares.illustrationAlt(f.name[lang])}>
      <span className="fare-art-name">{short}</span>
      <span className="fare-art-tag">{t.fares.illustration}</span>
    </div>
  );
}

function FareCard({ f }: { f: Fare }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();
  const short = f.name[lang].replace(/^(Targeta|Tarjeta)\s+/, '');
  return (
    <article className="fare-card" id={`f-${f.id}`} aria-labelledby={`fn-${f.id}`}>
      <div className="fare-top">
        <FareArt f={f} />
        <div className="fare-head">
          <h3 id={`fn-${f.id}`}>{f.name[lang]}</h3>
          {f.tags.length > 0 && (
            <ul className="fare-tags">
              {f.tags.map((x) => (
                <li key={x.ca}>{x[lang]}</li>
              ))}
            </ul>
          )}
          <PriceTag f={f} />
        </div>
      </div>
      <p className="fare-summary">{f.summary[lang]}</p>
      <ul className="fare-hl">
        {f.highlights.map((h) => (
          <li key={h.ca}>
            <span aria-hidden>✓</span> {h[lang]}
          </li>
        ))}
      </ul>
      <div className="fare-actions">
        {f.salesKey && (
          <a
            className="cta cta-primary"
            href={`/punts-de-venda?titol=${f.salesKey}`}
            onClick={(e) => go(e, () => st.navigate({ name: 'sales', title: f.salesKey }))}
          >
            {f.id === 't10' ? t.fares.findSale(short) : t.fares.findSales}
          </a>
        )}
      </div>
      <details className="fare-more">
        <summary>{t.fares.moreInfo}</summary>
        <ul>
          {f.details.map((d) => (
            <li key={d.ca}>{d[lang]}</li>
          ))}
        </ul>
        <dl>
          {f.eligibility && (
            <>
              <dt>{t.fares.whoFor}</dt>
              <dd>{f.eligibility[lang]}</dd>
            </>
          )}
          <dt>{t.fares.scope}</dt>
          <dd>{f.scope[lang]}</dd>
          {f.transfers && (
            <>
              <dt>{t.fares.transfers}</dt>
              <dd>{f.transfers[lang]}</dd>
            </>
          )}
          {f.where && (
            <>
              <dt>{t.fares.whereBuy}</dt>
              <dd>{f.where[lang]}</dd>
            </>
          )}
        </dl>
        <a className="fare-official" href={f.officialUrl === LINKS.tus.ca ? LINKS.tus[lang] : f.officialUrl} target="_blank" rel="noopener noreferrer">
          {t.fares.officialInfo} ↗
        </a>
      </details>
    </article>
  );
}

/** quin títol surt més a compte segons els viatges del mes (amb els preus de la llista) */
function Chooser() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const [trips, setTrips] = useState(20);
  const [young, setYoung] = useState(false);
  const costs = useMemo(() => monthlyCost(trips, young), [trips, young]);
  const best = costs[0]!;
  const name = (id: string) => fareById(id)!.name[lang];
  return (
    <section className="fare-chooser" aria-labelledby="fc-title">
      <h2 id="fc-title">{t.fares.chooserTitle}</h2>
      <div className="fc-row">
        <label htmlFor="fc-trips">{t.fares.tripsPerMonth}</label>
        <div className="fc-stepper">
          <button type="button" aria-label={t.fares.fewer} onClick={() => setTrips((n) => Math.max(1, n - 1))}>
            −
          </button>
          <output id="fc-out" htmlFor="fc-trips" aria-live="polite">
            {trips}
          </output>
          <button type="button" aria-label={t.fares.more} onClick={() => setTrips((n) => Math.min(80, n + 1))}>
            +
          </button>
        </div>
      </div>
      <input id="fc-trips" type="range" min={1} max={80} value={trips} onChange={(e) => setTrips(Number(e.target.value))} />
      <label className="fc-young">
        <input type="checkbox" checked={young} onChange={(e) => setYoung(e.target.checked)} /> {t.fares.under30}
      </label>
      <div className="fc-result" aria-live="polite">
        <span className="fc-best-label">{t.fares.best}</span>
        <strong className="fc-best">
          {name(best.id)} · {t.fares.perMonth(euros(best.cost, lang))}
        </strong>
        <span className="fc-others">
          {costs
            .slice(1)
            .map((c) => t.fares.vs(name(c.id), euros(c.cost, lang)))
            .join(' · ')}
        </span>
      </div>
      <p className="fc-hint">{t.fares.chooserHint}</p>
    </section>
  );
}

export function FaresPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const [cat, setCat] = useState<Cat>('all');
  const pick = (g: Fare['group']) => FARES.filter((f) => f.group === g && (cat === 'all' || f.category === cat));
  const tus = pick('tus');
  const atm = pick('atm');
  const showAtmInfo = cat === 'all' || cat === 'integrated';
  return (
    <Shell title={t.fares.title}>
      <header className="fares-hero">
        <p className="pub-eyebrow">{t.fares.eyebrow}</p>
        <h1 className="pub-h1">{t.fares.title}</h1>
        <p className="fares-valid">
          <span aria-hidden>●</span> {t.fares.validFrom}
        </p>
        <p className="dim small">
          {t.fares.trustNote}{' '}
          <a href={LINKS.tus[lang]} target="_blank" rel="noopener noreferrer">
            {t.fares.official} ↗
          </a>
        </p>
      </header>

      <Chooser />

      <div className="fare-cats" role="group" aria-label={t.fares.eyebrow}>
        {CATS.map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
            {t.fares.cats[c]}
          </button>
        ))}
      </div>

      {tus.length > 0 && (
        <section aria-labelledby="g-tus" className="fare-group">
          <h2 id="g-tus">{t.fares.groupTus}</h2>
          <p className="dim small">{t.fares.groupTusSub}</p>
          <div className="fare-grid">
            {tus.map((f) => (
              <FareCard key={f.id} f={f} />
            ))}
          </div>
        </section>
      )}

      {(atm.length > 0 || showAtmInfo) && (
        <section aria-labelledby="g-atm" className="fare-group fare-group-atm">
          <h2 id="g-atm">{t.fares.groupAtm}</h2>
          <p className="dim small">{t.fares.groupAtmSub}</p>
          <div className="fare-grid">
            {atm.map((f) => (
              <FareCard key={f.id} f={f} />
            ))}
            {showAtmInfo && (
              <article className="fare-card fare-card-info" aria-labelledby="fn-atm-others">
                <h3 id="fn-atm-others">{t.fares.atmOthers}</h3>
                <p className="fare-summary">{t.fares.atmOthersText}</p>
                <div className="fare-links">
                  <a href={LINKS.atm} target="_blank" rel="noopener noreferrer">
                    {t.fares.atmLink} ↗
                  </a>
                  <a href={LINKS.tmobFares} target="_blank" rel="noopener noreferrer">
                    {t.fares.tmobLink} ↗
                  </a>
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="faq" className="fare-faq">
        <h2 id="faq">{t.fares.faqTitle}</h2>
        {t.fares.faq.map((x) => (
          <details key={x.q}>
            <summary>{x.q}</summary>
            <p>{x.a}</p>
          </details>
        ))}
      </section>

      <footer className="fare-sources dim small">
        {t.fares.sources}:{' '}
        <a href={LINKS.tus[lang]} target="_blank" rel="noopener noreferrer">
          TUS
        </a>{' '}
        ·{' '}
        <a href={LINKS.atm} target="_blank" rel="noopener noreferrer">
          ATM
        </a>{' '}
        ·{' '}
        <a href={LINKS.tmobFares} target="_blank" rel="noopener noreferrer">
          T-mobilitat
        </a>{' '}
        ·{' '}
        <a href={LINKS.school} target="_blank" rel="noopener noreferrer">
          Ajuntament de Sabadell
        </a>
      </footer>
    </Shell>
  );
}

/* ------------------------------------------------------------------ punts de venda */

function stateText(s: OpenState, t: ReturnType<typeof useT>): string {
  if (s.state === 'open') return t.fares.open(hhmmMin(s.closesAt));
  if (s.state === 'closed') {
    if (!s.opens) return t.fares.closedNoNext;
    return s.opens.today ? t.fares.closedToday(hhmmMin(s.opens.min)) : t.fares.closedDay(t.fares.daysShort[s.opens.day]!, hhmmMin(s.opens.min));
  }
  return s.reason === 'holiday' ? t.fares.unknownHoliday : s.reason === 'condition' ? t.fares.unknownCondition : t.fares.unknownCalendar;
}

function PointCard({ p, state }: { p: SalesPoint; state: OpenState }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();
  const fmt = (rs: [number, number][]) => rs.map(([a, b]) => `${hhmmMin(a)}–${hhmmMin(b)}`).join(' · ');
  return (
    <article className="sp-card" aria-labelledby={`sp-${p.id}`}>
      <div className="sp-head">
        <h3 id={`sp-${p.id}`}>{p.name}</h3>
        <span className={`sp-state st-${state.state}`}>{stateText(state, t)}</span>
      </div>
      <p className="sp-addr">
        {p.address}
        <span className="dim"> · {p.neighbourhood ?? p.municipality}</span>
      </p>
      <p className="sp-titles">
        <span className="sr-only">{t.fares.sells}: </span>
        {p.titles.map((x) => (
          <span key={x} className={`sp-title${x === 't-sabadell' ? '' : ' strong'}`}>
            {t.fares.titles[x]}
          </span>
        ))}
      </p>
      <div className="sp-actions">
        <details className="sp-hours">
          <summary>{t.fares.hours}</summary>
          <dl>
            {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => {
              const h = p.hours[d];
              return (
                <div key={d} className="sp-day">
                  <dt>{t.fares.days[d]}</dt>
                  <dd>{h ? fmt(h.ranges) + (h.maybe ? ` (${fmt(h.maybe)}*)` : '') : t.fares.closed}</dd>
                </div>
              );
            })}
            {p.holidays && (
              <div className="sp-day">
                <dt>{t.fares.holidays}</dt>
                <dd>{fmt(p.holidays.ranges)}</dd>
              </div>
            )}
          </dl>
          {p.note && <p className="dim small">* {p.note[lang]}</p>}
        </details>
        <a className="cta" href={mapsSearchUrl(p)} target="_blank" rel="noopener noreferrer">
          {t.fares.openMap} ↗
        </a>
        <a className="text-link" href="/tarifes" onClick={(e) => go(e, () => st.navigate({ name: 'fares' }))}>
          {t.fares.seeFares}
        </a>
      </div>
    </article>
  );
}

const PAGE = 8;

export function SalesPage({ title }: { title?: string }) {
  const t = useT();
  const now = useNow(60000);
  // només el calendari de festius (sense el motor de simulació); sense calendari, l'estat és «a confirmar»
  const [holidays, setHolidays] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    let alive = true;
    loadHolidayDates()
      .then((d) => alive && setHolidays(new Set(d)))
      .catch((e: unknown) => console.error('holidays load failed', e));
    return () => {
      alive = false;
    };
  }, []);
  const [q, setQ] = useState('');
  const [tf, setTf] = useState<SalesTitle | 'all'>(TITLES.includes(title as SalesTitle) ? (title as SalesTitle) : 'all');
  const [area, setArea] = useState<string>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const states = useMemo(() => new Map(SALES_POINTS.map((p) => [p.id, openState(p, now, holidays)])), [now, holidays]);
  const nq = normalize(q.trim());
  const list = SALES_POINTS.filter(
    (p) =>
      (tf === 'all' || p.titles.includes(tf)) &&
      (area === 'all' || (area === 'sq' ? p.municipality !== 'Sabadell' : p.neighbourhood === area)) &&
      (!openOnly || states.get(p.id)?.state === 'open') &&
      (!nq || normalize(`${p.name} ${p.address} ${p.neighbourhood ?? ''} ${p.municipality}`).includes(nq)),
  );
  const inside = list.filter((p) => p.municipality === 'Sabadell');
  const outside = list.filter((p) => p.municipality !== 'Sabadell');
  const visibleInside = inside.slice(0, limit);
  const visibleOutside = outside.slice(0, Math.max(0, limit - inside.length));
  const hidden = list.length - visibleInside.length - visibleOutside.length;
  const reset = () => {
    setQ('');
    setTf('all');
    setArea('all');
    setOpenOnly(false);
    setLimit(PAGE);
  };

  return (
    <Shell title={t.fares.salesTitle}>
      <header className="fares-hero">
        <p className="pub-eyebrow">{t.fares.nav}</p>
        <h1 className="pub-h1">{t.fares.salesTitle}</h1>
        <p className="dim">{t.fares.salesSub}</p>
      </header>

      <div className="sp-filters">
        <label className="sp-search">
          <span className="sr-only">{t.fares.search}</span>
          <input
            type="search"
            value={q}
            placeholder={t.fares.search}
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <div className="fare-cats" role="group" aria-label={t.fares.titleFilter}>
          {(['all', ...TITLES] as const).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={tf === x}
              className={tf === x ? 'on' : ''}
              onClick={() => {
                setTf(x);
                setLimit(PAGE);
              }}
            >
              {x === 'all' ? t.fares.allTitles : t.fares.titles[x]}
            </button>
          ))}
        </div>
        <div className="sp-row">
          <label className="sp-select">
            <span>{t.fares.area}</span>
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setLimit(PAGE);
              }}
            >
              <option value="all">{t.fares.allAreas}</option>
              <optgroup label="Sabadell">
                {NEIGHBOURHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t.fares.outside}>
                <option value="sq">Sant Quirze del Vallès</option>
              </optgroup>
            </select>
          </label>
          <label className="sp-toggle">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} disabled={!holidays} /> {t.fares.openNow}
          </label>
        </div>
      </div>

      {tf === 't10' && <p className="sp-note">{t.fares.t10Note}</p>}

      <p className="sp-count" aria-live="polite">
        {t.fares.results(list.length)}
      </p>

      {list.length === 0 ? (
        <div className="sp-empty">
          <p>{t.fares.empty}</p>
          <button type="button" className="cta" onClick={reset}>
            {t.fares.clear}
          </button>
        </div>
      ) : (
        <>
          {visibleInside.length > 0 && <h2 className="sr-only">Sabadell</h2>}
          <div className="sp-list">
            {visibleInside.map((p) => (
              <PointCard key={p.id} p={p} state={states.get(p.id)!} />
            ))}
          </div>
          {visibleOutside.length > 0 && (
            <section aria-labelledby="sp-out" className="sp-out">
              <h2 id="sp-out" className="sec-title">
                {t.fares.outside} · Sant Quirze del Vallès
              </h2>
              <div className="sp-list">
                {visibleOutside.map((p) => (
                  <PointCard key={p.id} p={p} state={states.get(p.id)!} />
                ))}
              </div>
            </section>
          )}
          {hidden > 0 && (
            <button type="button" className="cta sp-more" onClick={() => setLimit((n) => n + PAGE)}>
              {t.fares.showMore(Math.min(PAGE, hidden))}
            </button>
          )}
        </>
      )}

      <p className="dim small sp-disclaimer">{t.fares.hoursDisclaimer}</p>
      <p className="dim small">
        {t.fares.sources}:{' '}
        <a href={LINKS.tusSales.ca} target="_blank" rel="noopener noreferrer">
          tus.es
        </a>
      </p>
    </Shell>
  );
}
