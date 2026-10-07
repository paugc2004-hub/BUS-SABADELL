/**
 * Landing de NextMobility Sabadell (/). Objectiu: que en 5 segons s'entengui «aquí sé quan arriba el meu bus».
 * Pública i lleugera: no carrega la xarxa ni MapLibre. La demo del hero és una animació pròpia
 * (etiquetada «Demostració») sobre parades i recorreguts reals de la L2; no és una dada en directe.
 * «Prova-ho ara» entra a l'app sense registre (compte de demostració).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Route } from '@bus/core';
import { auth } from '../auth/auth.ts';
import { useApp, type View } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Logo } from '../ui/Logo.tsx';
import { BusVehicleMarker } from '../ui/BusVehicleMarker.tsx';
import { RouteChip } from '../ui/common.tsx';
import { L2_RUN, L2_STOPS, MAP_PATHS } from './landingMap.ts';

/** colors i noms publicats de les línies que passen per Rambla (com a network.json) */
const LINE = (id: string, color: string, longName: string): Route => ({ id, ref: id, longName, color, textColor: '#FFFFFF', kind: 'diurna', order: 0, agency: 'TUS' }) as Route;
const L2 = LINE('L2', '#004996', 'Can Deu - Creu de Barberà');
const L1 = LINE('L1', '#e63027', 'Can Deu - Estació Sud');
const L80 = LINE('L80', '#9b338a', 'Plaça de Picasso - La Plana del Pintor');

/** adreça de contacte institucional: només si s'ha configurat (no se n'inventa cap) */
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || null;

/** Entra a l'app: sense compte, amb el de demostració (no hi ha barrera de registre). */
async function enterApp(view: View = { name: 'home' }) {
  const st = useApp.getState();
  if (!st.user) st.setUser(await auth.signInDemo());
  st.navigate(view);
}

/**
 * Seqüència de la demo: el bus surt de Massagué, para a cada parada i arriba a Rambla.
 * Cada pas és [parada on és (o cap on va), minuts que falten, aturat?]. Al final continua i torna a començar.
 */
const STEPS: [number, number, boolean][] = [
  [0, 4, true],
  [1, 3, false],
  [1, 3, true],
  [2, 2, false],
  [2, 2, true],
  [3, 1, false],
  [3, 1, true],
  [4, 0, false],
  [4, 0, true],
  [4, 0, true],
];
const STEP_MS = 1700;

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m?.addEventListener('change', on);
    return () => m?.removeEventListener('change', on);
  }, []);
  return r;
}

/** Hero: «La meva parada · Rambla» amb el bus que s'acosta. */
function HeroDemo() {
  const t = useT();
  const C = t.landing.card;
  const reduced = useReducedMotion();
  const [i, setI] = useState(reduced ? 5 : 0);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // només s'anima quan es veu (i la pestanya és visible)
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)));
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (reduced || !visible) return;
    const id = setInterval(() => document.visibilityState === 'visible' && setI((k) => (k + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [reduced, visible]);
  const [at, mins, stopped] = STEPS[i]!;
  const last = L2_STOPS.length - 1;
  const away = last - at;
  const here = at === last;
  const f = L2_STOPS[at]!.f;
  // en reiniciar (pas 0) el bus torna sense transició
  const jump = i === 0;

  return (
    <div className="lnd-demo" ref={ref}>
      <svg className="lnd-map" viewBox="185 -40 420 420" aria-hidden preserveAspectRatio="xMinYMid slice">
        {MAP_PATHS.filter((p) => p.route !== 'L2').map((p) => (
          <path key={p.route} d={p.d} className="lnd-map-road" />
        ))}
        <path d={L2_RUN} className="lnd-map-l2" />
        {L2_STOPS.map((s, k) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={k === last ? 7 : 4.2} className={`lnd-map-stop${k === last ? ' mine' : ''}${k <= at ? ' done' : ''}`} />
        ))}
        <g className={`lnd-map-bus${jump ? ' jump' : ''}`} style={{ offsetPath: `path('${L2_RUN}')`, offsetDistance: `${(f * 100).toFixed(1)}%` }}>
          <circle r="11" />
        </g>
        <text x={L2_STOPS[last]!.x - 14} y={L2_STOPS[last]!.y + 5} textAnchor="end" className="lnd-map-label">
          {L2_STOPS[last]!.name}
        </text>
      </svg>

      <div className="demo-card" role="img" aria-label={`${C.demo}. ${C.myStop}: ${L2_STOPS[last]!.name}. L2 → Creu de Barberà. ${here ? C.now : `${C.arrives} ${mins} min`}.`}>
        <div className="demo-top">
          <span className="demo-eyebrow">{C.myStop}</span>
          <span className="demo-tag">{C.demo}</span>
        </div>
        <strong className="demo-stop">{L2_STOPS[last]!.name}</strong>
        <div className="demo-line">
          <RouteChip route={L2} />
          <span>→ Creu de Barberà</span>
        </div>
        <div className="demo-eta" aria-live="off">
          {here ? (
            <span className="demo-now">{C.now}</span>
          ) : (
            <>
              <span className="demo-in">{C.arrives}</span>
              <span key={mins} className="demo-min">
                {mins}
              </span>
              <span className="demo-unit">min</span>
            </>
          )}
        </div>
        <div className="demo-meta">
          <span className={away <= 2 ? 'near' : ''}>{C.stopsAway(away)}</span>
          <span className="demo-ok">● {C.onTime}</span>
        </div>
        <div className="demo-rail" aria-hidden>
          <span className="demo-rail-fill" style={{ width: `${(f * 100).toFixed(1)}%` }} data-jump={jump || undefined} />
          {L2_STOPS.map((s, k) => (
            <span key={s.id} className={`demo-dot${k <= at ? ' done' : ''}${k === last ? ' mine' : ''}`} style={{ left: `${s.f * 100}%` }} />
          ))}
          <span className={`demo-bus${stopped ? ' stopped' : ''}`} style={{ left: `${(f * 100).toFixed(1)}%` }} data-jump={jump || undefined}>
            <BusVehicleMarker route={L2} heading={90} size={20} showLabel={false} />
          </span>
        </div>
        <div className="demo-names" aria-hidden>
          <span>{L2_STOPS[0]!.name}</span>
          <span>{L2_STOPS[last]!.name}</span>
        </div>
        <button type="button" className="demo-btn" onClick={() => void enterApp({ name: 'stop', id: '20' })}>
          {C.view}
        </button>
      </div>
    </div>
  );
}

/** Apareix en entrar a la pantalla (una sola vegada). */
function Reveal({ children, className = '', as: Tag = 'section', id }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} id={id} className={`reveal${shown ? ' in' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

/** Mini UI de cada benefici: fragments de la interfície, no captures. */
function BenefitArt({ k }: { k: number }) {
  const t = useT();
  if (k === 0)
    return (
      <div className="art art-eta" aria-hidden>
        <RouteChip route={L2} size="lg" />
        <span className="art-big">
          3<small>min</small>
        </span>
      </div>
    );
  if (k === 1)
    return (
      <div className="art art-where" aria-hidden>
        <span className="art-track" />
        <span className="art-stop" style={{ left: '8%' }} />
        <span className="art-stop" style={{ left: '38%' }} />
        <span className="art-stop" style={{ left: '66%' }} />
        <span className="art-stop mine" style={{ left: '92%' }} />
        <span className="art-bus">
          <BusVehicleMarker route={L2} heading={90} size={22} showLabel={false} />
        </span>
        <span className="art-caption">{t.landing.card.stopsAway(2)}</span>
      </div>
    );
  return (
    <ol className="art art-next" aria-hidden>
      <li className="done">Dr. Robert</li>
      <li className="now">Casal Pere Quart</li>
      <li>
        Rambla <span>+2 min</span>
      </li>
      <li>
        Eixample <span>+4 min</span>
      </li>
    </ol>
  );
}

export function Landing() {
  const t = useT();
  const L = t.landing;
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();

  useEffect(() => {
    // barra del navegador clara a la landing; es restaura en entrar a l'app
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', '#f6f5f1');
    document.documentElement.classList.add('lnd');
    return () => {
      if (prev) meta?.setAttribute('content', prev);
      document.documentElement.classList.remove('lnd');
    };
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const mail = CONTACT ? `mailto:${CONTACT}?subject=${encodeURIComponent(L.mailSubject)}` : null;

  return (
    <div className="landing theme-light">
      <header className="lnd-nav">
        <button type="button" className="lnd-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t.brand}>
          <Logo size={32} />
        </button>
        <nav className="lnd-links" aria-label="Seccions">
          <a href="#com-funciona" onClick={(e) => (e.preventDefault(), go('com-funciona'))}>
            {L.navHow}
          </a>
          <a href="#projecte" onClick={(e) => (e.preventDefault(), go('projecte'))}>
            {L.navProject}
          </a>
        </nav>
        <div className="lnd-actions">
          <button type="button" className="lang-btn" aria-label={`${lang === 'ca' ? 'ES' : 'CA'} · ${t.lang}`} onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}>
            {lang === 'ca' ? 'ES' : 'CA'}
          </button>
          <button type="button" className="btn-primary" onClick={() => void enterApp()}>
            {L.cta}
          </button>
        </div>
      </header>

      <main>
        <section className="lnd-hero">
          <div className="lnd-hero-copy">
            <span className="lnd-eyebrow">{L.eyebrow}</span>
            <h1>{L.title}</h1>
            <p className="lnd-lead">{L.lead}</p>
            <div className="lnd-ctas">
              <button type="button" className="btn-primary btn-lg" onClick={() => void enterApp()}>
                {L.cta} <span aria-hidden>→</span>
              </button>
              <button type="button" className="btn-ghost btn-lg" onClick={() => go('com-funciona')}>
                {L.how}
              </button>
            </div>
            <p className="lnd-sub">{L.ctaSub}</p>
            <p className="lnd-honest">{L.honest}</p>
          </div>
          <HeroDemo />
        </section>

        <Reveal className="lnd-benefits">
          <h2 className="lnd-h2">{L.benefitTitle}</h2>
          <div className="lnd-benefit-grid">
            {L.benefits.map((b, k) => (
              <article key={b.title} className="lnd-benefit">
                <BenefitArt k={k} />
                <span className="lnd-num">0{k + 1}</span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </Reveal>

        <Reveal id="com-funciona" className="lnd-steps">
          <h2 className="lnd-h2">{L.stepsTitle}</h2>
          <ol>
            {L.steps.map((s, k) => (
              <li key={s.title}>
                <span className="lnd-step-n">{k + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="lnd-split">
          <div className="lnd-split-copy">
            <span className="lnd-kicker">{L.stopEyebrow}</span>
            <h2 className="lnd-h2">{L.stopTitle}</h2>
            <p>{L.stopText}</p>
          </div>
          <div className="ui-card ui-stop" aria-hidden>
            <div className="ui-head">
              <span className="ui-star">★</span>
              <strong>Rambla</strong>
              <span className="demo-tag">{L.card.demo}</span>
            </div>
            {(
              [
                [L2, 'Creu de Barberà', 3, true],
                [L1, 'Estació Sud', 7, false],
                [L80, 'Plaça de Picasso', 12, false],
              ] as const
            ).map(([r, to, m, first]) => (
              <div key={r.id} className={`ui-row${first ? ' first' : ''}`}>
                <RouteChip route={r} />
                <span className="ui-to">→ {to}</span>
                <span className="ui-min">
                  {m}
                  <small> min</small>
                </span>
              </div>
            ))}
            <span className="ui-btn">{L.stopCta}</span>
          </div>
        </Reveal>

        <Reveal className="lnd-split rev">
          <div className="lnd-split-copy">
            <span className="lnd-kicker">{L.followEyebrow}</span>
            <h2 className="lnd-h2">{L.followTitle}</h2>
            <p>{L.followText}</p>
          </div>
          <div className="ui-card ui-follow" aria-hidden>
            <div className="ui-toast">
              <span className="ui-toast-dot" /> {L.followToast}
            </div>
            <ol className="ui-timeline">
              <li className="done">Massagué</li>
              <li className="done">Manresa</li>
              <li className="now">
                <span className="ui-tl-bus">
                  <BusVehicleMarker route={L2} heading={180} size={18} showLabel={false} />
                </span>
                Dr. Robert
              </li>
              <li>
                Casal Pere Quart <span>+1 min</span>
              </li>
              <li className="mine">
                Rambla <em>{L.yourStop}</em> <span>+3 min</span>
              </li>
              <li>
                Eixample <span>+5 min</span>
              </li>
            </ol>
          </div>
        </Reveal>

        <Reveal className="lnd-map-sec">
          <span className="lnd-kicker">{L.mapEyebrow}</span>
          <h2 className="lnd-h2">{L.mapTitle}</h2>
          <p>{L.mapText}</p>
          <button type="button" className="btn-primary btn-lg" onClick={() => void enterApp({ name: 'map' })}>
            {L.mapCta} <span aria-hidden>→</span>
          </button>
          <figure className="lnd-shot">
            <img src="/landing/map-desktop.jpg" alt={L.mapAlt} width={1440} height={900} loading="lazy" decoding="async" />
          </figure>
        </Reveal>

        <Reveal id="projecte" className="lnd-project">
          <span className="lnd-kicker">{L.projectEyebrow}</span>
          <h2 className="lnd-h2">{L.projectTitle}</h2>
          <p className="lnd-project-text">{L.projectText}</p>
          <h3 className="lnd-flow-title">{L.flowTitle}</h3>
          <ol className="lnd-flow">
            {L.flow.map((s, k) => (
              <li key={s.title} className={k === 1 ? 'today' : ''}>
                {'today' in s && <span className="lnd-today">{s.today}</span>}
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="lnd-flow-note">{L.flowNote}</p>
          <div className="lnd-honest-box">
            <strong>{L.honestTitle}</strong>
            <p>{L.honestText}</p>
            <p className="lnd-official">{L.notOfficial}</p>
          </div>
        </Reveal>

        <Reveal className="lnd-final">
          <h2 className="lnd-h2">{L.finalTitle}</h2>
          <button type="button" className="btn-primary btn-lg" onClick={() => void enterApp()}>
            {L.cta} <span aria-hidden>→</span>
          </button>
          <p className="lnd-sub">{L.ctaSub}</p>
        </Reveal>

        <Reveal className="lnd-inst">
          <div>
            <h2>{L.instTitle}</h2>
            <p>{L.instText}</p>
          </div>
          <div className="lnd-inst-actions">
            <button type="button" className="btn-ghost" onClick={() => void enterApp({ name: 'present' })}>
              {L.instDeck}
            </button>
            {mail && (
              <a className="btn-primary" href={mail}>
                {L.instMail}
              </a>
            )}
          </div>
        </Reveal>
      </main>

      <footer className="lnd-footer">
        <Logo size={26} />
        <p>{L.footer}</p>
        <p className="dim">{L.footerData}</p>
        <button type="button" className="btn-text" onClick={() => st.navigate({ name: 'login' })}>
          {L.haveAccount}
        </button>
      </footer>
    </div>
  );
}
