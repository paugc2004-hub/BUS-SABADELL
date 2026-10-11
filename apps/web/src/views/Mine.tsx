/** Compte (/meus): el compte i, en segon terme, les parades desades. Amb la demostració, la invitació a crear un compte. */
import { LegalLinks } from '../ui/LegalLinks.tsx';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { HomeStops } from './Home.tsx';
import { initial, signOut } from './Chrome.tsx';

export function MinePanel() {
  const t = useT();
  const user = useApp((s) => s.user);
  const favorites = useApp((s) => s.favorites);
  const st = useApp.getState();
  return (
    <aside className="home mine" aria-label={t.minePage.title}>
      <h1 className="page-title">{t.minePage.title}</h1>
      {user?.demo && (
        <section className="account-card demo">
          <div className="account-who">
            <strong>{t.authUi.demoTitle}</strong>
            <span className="dim">{t.authUi.demoText}</span>
          </div>
          <div className="account-actions">
            <button type="button" className="cta cta-primary" onClick={() => st.navigate({ name: 'register' })}>
              {t.authUi.createAccount}
            </button>
            <button type="button" className="cta" onClick={() => st.navigate({ name: 'login' })}>
              {t.authUi.signInLink}
            </button>
          </div>
        </section>
      )}
      {user && !user.demo && (
        <section className="account-card">
          <span className="avatar lg" aria-hidden>
            {initial(user.name)}
          </span>
          <div className="account-who">
            <strong>{user.name}</strong>
            <span className="dim">{user.email}</span>
          </div>
          <button type="button" className="cta" onClick={() => void signOut()}>
            {t.authUi.signOut}
          </button>
        </section>
      )}
      {favorites.length > 0 && <HomeStops />}
      <LegalLinks />
    </aside>
  );
}
