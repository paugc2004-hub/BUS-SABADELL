/**
 * Entrar i crear compte. Els comptes són ficticis (auth/auth.ts): es guarden només en
 * aquest navegador, i la pantalla ho diu. El botó de demostració entra sense contrasenya.
 */
import { useState, type FormEvent } from 'react';
import { auth, AuthError, MIN_PASSWORD } from '../auth/auth.ts';
import { useApp, parseView } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Logo } from '../ui/Logo.tsx';

/** Després d'entrar: on volia anar l'usuari (només camins interns de l'app). */
function goNext(next: string | undefined) {
  const st = useApp.getState();
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !/^\/(entra|registre)?$/.test(next.split('?')[0]!) ? next : '/app';
  const [path, qs] = safe.split('?');
  history.replaceState(null, '', path + (qs ? `?${qs}` : location.search));
  st.navigate(parseView(path!), { replace: true });
}

export function AuthScreen({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const t = useT();
  const a = t.authUi;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = useApp.getState();
  const isLogin = mode === 'login';

  const done = (u: Awaited<ReturnType<typeof auth.signIn>>) => {
    // de la demostració a un compte propi: les parades desades durant la prova passen al compte
    const prev = useApp.getState();
    const carry = prev.user?.demo && !u.demo ? prev.favorites : [];
    st.setUser(u);
    for (const id of carry) if (!useApp.getState().favorites.includes(id)) useApp.getState().toggleFavorite(id);
    goNext(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      done(isLogin ? await auth.signIn(email, password) : await auth.signUp(name, email, password));
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unavailable';
      setError(a.errors[code]);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m: 'login' | 'register') => st.navigate({ name: m, next }, { replace: true });

  return (
    <main className="auth theme-light">
      <div className="auth-glow" aria-hidden />
      <section className="auth-card" aria-labelledby="auth-title">
        <button type="button" className="auth-logo" onClick={() => st.navigate({ name: 'landing' })} aria-label={a.back}>
          <Logo size={36} />
        </button>
        <h1 id="auth-title">{isLogin ? a.loginTitle : a.registerTitle}</h1>
        <p className="auth-lead">{isLogin ? a.loginLead : a.registerLead}</p>

        <form onSubmit={submit} noValidate>
          {!isLogin && (
            <label className="field">
              <span>{a.name}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} />
            </label>
          )}
          <label className="field">
            <span>{a.email}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
          </label>
          <label className="field">
            <span>{a.password}</span>
            <span className="field-pass">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                minLength={MIN_PASSWORD}
                required
                aria-describedby={isLogin ? undefined : 'pass-hint'}
              />
              <button type="button" className="field-eye" onClick={() => setShow(!show)} aria-pressed={show}>
                {show ? a.hide : a.show}
              </button>
            </span>
            {!isLogin && (
              <small id="pass-hint" className="field-hint">
                {a.passwordHint(MIN_PASSWORD)}
              </small>
            )}
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary btn-block" disabled={busy}>
            {busy ? a.working : isLogin ? a.submitLogin : a.submitRegister}
          </button>
        </form>

        <div className="auth-or">
          <span>{a.or}</span>
        </div>
        <button
          type="button"
          className="btn-ghost btn-block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            done(await auth.signInDemo());
            setBusy(false);
          }}
        >
          {a.demo}
        </button>

        <button type="button" className="auth-switch" onClick={() => switchTo(isLogin ? 'register' : 'login')}>
          {isLogin ? a.toRegister : a.toLogin}
        </button>
        <p className="auth-note">{a.localNote}</p>
      </section>
    </main>
  );
}
