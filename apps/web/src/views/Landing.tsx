/**
 * Landing de NextMobility Sabadell (/). Pública, lleugera (no carrega el mapa) i honesta:
 * les captures són de l'app real i diu clarament que les posicions són simulades.
 */
import { useEffect, useState } from 'react';
import { auth } from '../auth/auth.ts';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Logo } from '../ui/Logo.tsx';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Instal·lar la PWA: el navegador avisa amb beforeinstallprompt (Chrome/Edge/Android). */
function useInstall() {
  const [evt, setEvt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { canPrompt: Boolean(evt), installed, ios, prompt: async () => evt && (await evt.prompt(), setEvt(null)) };
}

const Shot = ({ src, alt, w, h, className = '' }: { src: string; alt: string; w: number; h: number; className?: string }) => (
  <img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" className={className} />
);

export function Landing() {
  const t = useT();
  const L = t.landing;
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const st = useApp.getState();
  const install = useInstall();

  const openApp = () => st.navigate(user ? { name: 'home' } : { name: 'register' });
  const demo = async () => {
    st.setUser(await auth.signInDemo());
    st.navigate({ name: 'home' });
  };

  const shots = [
    { src: '/landing/home-mobile.jpg', w: 390, h: 844, alt: L.features[0]!.title },
    { src: '/landing/map-desktop.jpg', w: 1440, h: 900, alt: L.features[1]!.title },
    { src: '/landing/bus-mobile.jpg', w: 390, h: 844, alt: L.features[2]!.title },
    { src: '/landing/network-desktop.jpg', w: 1440, h: 900, alt: L.features[3]!.title },
  ];

  return (
    <div className="landing">
      <header className="lnd-nav">
        <button type="button" className="lnd-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t.brand}>
          <Logo size={34} />
        </button>
        <nav className="lnd-links" aria-label="Seccions">
          <a href="#com-funciona">{L.navHow}</a>
          <a href="#dades-reals">{L.navTus}</a>
        </nav>
        <div className="lnd-actions">
          <button type="button" className="lang-btn" aria-label={`${lang === 'ca' ? 'ES' : 'CA'} · ${t.lang}`} onClick={() => st.setLang(lang === 'ca' ? 'es' : 'ca')}>
            {lang === 'ca' ? 'ES' : 'CA'}
          </button>
          {user ? (
            <button type="button" className="btn-primary" onClick={() => st.navigate({ name: 'home' })}>
              {L.start}
            </button>
          ) : (
            <>
              <button type="button" className="btn-text" onClick={() => st.navigate({ name: 'login' })}>
                {L.signIn}
              </button>
              <button type="button" className="btn-primary" onClick={() => st.navigate({ name: 'register' })}>
                {L.signUp}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="lnd-hero">
        <div className="lnd-hero-copy">
          <span className="lnd-eyebrow">
            <span className="live-dot" aria-hidden /> {L.eyebrow}
          </span>
          <h1>
            {L.title1}
            <br />
            <span className="lnd-grad">{L.title2}</span>
          </h1>
          <p className="lnd-lead">{L.lead}</p>
          <div className="lnd-ctas">
            <button type="button" className="btn-primary btn-lg" onClick={openApp}>
              {L.start} →
            </button>
            <button type="button" className="btn-ghost btn-lg" onClick={demo}>
              {L.tryDemo}
            </button>
          </div>
          <p className="lnd-honest">{L.honest}</p>
        </div>
        <div className="lnd-hero-visual" aria-hidden>
          <div className="lnd-browser">
            <span className="lnd-browser-bar">
              <i />
              <i />
              <i />
            </span>
            <img src="/landing/map-desktop.jpg" alt="" width={1440} height={900} fetchPriority="high" decoding="async" />
          </div>
          <div className="lnd-phone">
            <img src="/landing/home-mobile.jpg" alt="" width={390} height={844} fetchPriority="high" decoding="async" />
          </div>
        </div>
      </section>

      <section className="lnd-stats" aria-label="Xifres">
        {L.stats.map(([n, l]) => (
          <div key={l}>
            <strong>{n}</strong>
            <span>{l}</span>
          </div>
        ))}
      </section>

      <section id="com-funciona" className="lnd-features">
        {L.features.map((f, i) => {
          const s = shots[i]!;
          const phone = s.w < 800;
          return (
            <article key={f.title} className={`lnd-feature${i % 2 ? ' rev' : ''}`}>
              <div className="lnd-feature-copy">
                <span className="lnd-num">0{i + 1}</span>
                <h2>{f.title}</h2>
                <p>{f.text}</p>
              </div>
              <div className={`lnd-feature-shot${phone ? ' is-phone' : ' is-desktop'}`}>
                <Shot src={s.src} alt={s.alt} w={s.w} h={s.h} />
              </div>
            </article>
          );
        })}
      </section>

      <section id="dades-reals" className="lnd-real">
        <h2>{L.realTitle}</h2>
        <p>{L.realText}</p>
        <ol className="lnd-flow">
          {L.realSteps.map((s, i) => (
            <li key={s} className={i === 2 ? 'me' : ''}>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="lnd-install">
        <div>
          <h2>{L.installTitle}</h2>
          <p>{L.installText}</p>
        </div>
        {install.installed ? (
          <span className="lnd-installed">✓ {L.installed}</span>
        ) : install.canPrompt ? (
          <button type="button" className="btn-primary btn-lg" onClick={() => void install.prompt()}>
            {L.install}
          </button>
        ) : (
          <p className="lnd-ios">{install.ios ? L.installIos : L.installText}</p>
        )}
      </section>

      <section className="lnd-final">
        <h2>{L.ctaTitle}</h2>
        <div className="lnd-ctas center">
          <button type="button" className="btn-primary btn-lg" onClick={openApp}>
            {L.start} →
          </button>
          <button type="button" className="btn-ghost btn-lg" onClick={demo}>
            {L.tryDemo}
          </button>
        </div>
      </section>

      <footer className="lnd-footer">
        <Logo size={26} />
        <p>{L.footer}</p>
        <p className="dim">{L.footerData}</p>
      </footer>
    </div>
  );
}
