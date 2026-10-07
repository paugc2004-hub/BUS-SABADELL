/** Els meus (/meus): compte, viatge actiu i parades desades. Amb la demostració, la invitació a crear un compte. */
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { HomeStops } from './Home.tsx';
import { initial, signOut } from './Chrome.tsx';

export function MinePanel() {
  const t = useT();
  const trip = useApp((s) => s.trip);
  const user = useApp((s) => s.user);
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
      <section className="home-sec">
        <h2 className="sec-title">{t.minePage.trip}</h2>
        {/* la targeta del viatge es mostra sempre a sobre del mapa; aquí, si no n'hi ha, com començar-ne un */}
        {!trip && <p className="dim">{t.minePage.noTrip}</p>}
      </section>
      <HomeStops />
    </aside>
  );
}
