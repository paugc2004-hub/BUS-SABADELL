/**
 * Àrea personal (/meus) i les seves pàgines (/compte/…): paritat amb «Mi cuenta» de l'app de TUS.
 * Comptes ficticis al dispositiu (auth/auth.ts). Amb el compte de demostració, les opcions del compte surten
 * desactivades amb «Crea un compte per desar-ho», però la resta de l'app funciona igual.
 */
import { useState } from 'react';
import { LegalLinks } from '../ui/LegalLinks.tsx';
import { useApp, type AccountPage } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { auth, AuthError, MIN_PASSWORD } from '../auth/auth.ts';
import { Ic } from '../ui/icons.tsx';
import { Group, PageHead, Row } from '../ui/Page.tsx';
import { useA11y, systemReducedMotion, type TextSize } from '../ui/a11y.ts';
import { userKeys } from '../wallet/wallet.ts';
import { walletFor } from '../wallet/useWallet.ts';
import { LINKS } from '../data/fares.ts';
import { initial, signOut } from './Chrome.tsx';

export function MinePanel() {
  const t = useT();
  const user = useApp((s) => s.user);
  useApp((s) => s.walletVersion);
  const st = useApp.getState();
  const demo = !user || user.demo;
  const profile = walletFor(user?.id ?? 'demo').profile();
  const go = (page: AccountPage) => () => st.navigate({ name: 'account', page });
  return (
    <aside className="home mine" aria-label={t.p.account.title}>
      <PageHead title={t.p.account.title} up={{ name: 'more' }} />
      {demo ? (
        <section className="account-card demo">
          <div className="account-who">
            <strong>{t.p.account.demoTitle}</strong>
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
      ) : (
        <div className="acc-email">
          <span className="avatar" aria-hidden>
            {initial(user.name)}
          </span>
          <span>
            <strong>{user.name}</strong>
            <span className="dim small">{user.email}</span>
          </span>
        </div>
      )}
      <Group>
        <Row icon={Ic.user} label={t.p.account.info} sub={demo ? t.p.account.demoNeeds : undefined} disabled={demo} onClick={go('info')} />
        <Row icon={Ic.badge} label={t.p.account.profile(t.p.buy.profiles[profile])} onClick={go('profile')} />
      </Group>
      <Group>
        <Row icon={Ic.info} label={t.p.account.faq} onClick={go('faq')} />
      </Group>
      <Group>
        <Row icon={Ic.key} label={t.p.account.password} sub={demo ? t.p.account.demoNeeds : undefined} disabled={demo} onClick={go('password')} />
        <Row icon={Ic.gear} label={t.p.account.settings} onClick={go('settings')} />
        <Row icon={Ic.trash} label={t.p.account.delete} sub={demo ? t.p.account.demoNeeds : undefined} disabled={demo} danger={!demo} onClick={go('delete')} />
      </Group>
      {!demo && (
        <button type="button" className="btn signout" onClick={() => void signOut()}>
          {t.p.account.signOut}
        </button>
      )}
      <LegalLinks />
    </aside>
  );
}

function Msg({ ok, err }: { ok?: string | null; err?: string | null }) {
  return (
    <div role="status" aria-live="polite">
      {ok && <p className="form-msg ok">{ok}</p>}
      {err && <p className="form-msg err">{err}</p>}
    </div>
  );
}

function errText(e: unknown, t: ReturnType<typeof useT>): string {
  const code = e instanceof AuthError ? e.code : 'unavailable';
  return t.authUi.errors[code as keyof typeof t.authUi.errors] ?? String(code);
}

function InfoPage() {
  const t = useT();
  const user = useApp((s) => s.user);
  const [name, setName] = useState(user?.name ?? '');
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  if (!user || user.demo) return <p className="empty">{t.p.account.demoNeeds}</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        auth
          .updateName(name)
          .then((u) => {
            useApp.getState().set({ user: u });
            setMsg({ ok: t.p.account.saved });
          })
          .catch((er: unknown) => setMsg({ err: errText(er, t) }));
      }}
    >
      <label className="field">
        <span>{t.p.account.name}</span>
        <input value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t.p.account.email}</span>
        <input value={user.email} readOnly />
      </label>
      <Msg {...msg} />
      <button type="submit" className="btn primary wide">
        {t.p.account.save}
      </button>
    </form>
  );
}

function ProfilePage() {
  const t = useT();
  const user = useApp((s) => s.user);
  useApp((s) => s.walletVersion);
  const w = walletFor(user?.id ?? 'demo');
  return (
    <>
      <p className="page-lead">{t.p.account.profileText}</p>
      <fieldset className="field">
        <legend>{t.p.account.profileTitle}</legend>
        {(['general', 'jove'] as const).map((p) => (
          <label key={p} className="radio">
            <input
              type="radio"
              name="profile"
              checked={w.profile() === p}
              onChange={() => {
                w.setProfile(p);
                useApp.getState().bumpWallet();
              }}
            />{' '}
            {t.p.buy.profiles[p]}
          </label>
        ))}
      </fieldset>
      <p className="dim small">{t.p.buy.profileNote}</p>
    </>
  );
}

function FaqPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();
  return (
    <>
      <h2 className="group-title">{t.p.faq.nm}</h2>
      <div className="faq">
        {t.p.faq.items.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <h2 className="group-title">{t.p.faq.tus}</h2>
      <div className="faq">
        {t.p.faq.tusItems.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <Group>
        <Row icon={Ic.info} label={t.p.more.titles} onClick={() => st.navigate({ name: 'fares' })} />
        <Row icon={Ic.office} label={t.p.more.office} onClick={() => st.navigate({ name: 'office' })} />
        <Row icon={Ic.globe} label={t.p.faq.tusLinks.fares} href={LINKS.tus[lang]} />
        <Row icon={Ic.globe} label={t.p.faq.tusLinks.sales} href={LINKS.tusSales[lang]} />
      </Group>
    </>
  );
}

function PasswordPage() {
  const t = useT();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [rep, setRep] = useState('');
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (next !== rep) return setMsg({ err: t.p.account.mismatch });
        auth
          .changePassword(cur, next)
          .then(() => {
            setCur('');
            setNext('');
            setRep('');
            setMsg({ ok: t.p.account.changed });
          })
          .catch((er: unknown) => setMsg({ err: errText(er, t) }));
      }}
    >
      <label className="field">
        <span>{t.p.account.current}</span>
        <input type="password" value={cur} autoComplete="current-password" onChange={(e) => setCur(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t.p.account.next}</span>
        <input type="password" value={next} minLength={MIN_PASSWORD} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} required />
      </label>
      <label className="field">
        <span>{t.p.account.repeat}</span>
        <input type="password" value={rep} minLength={MIN_PASSWORD} autoComplete="new-password" onChange={(e) => setRep(e.target.value)} required />
      </label>
      <Msg {...msg} />
      <button type="submit" className="btn primary wide">
        {t.p.account.password}
      </button>
    </form>
  );
}

export function SettingsPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const a = useA11y();
  const [cleared, setCleared] = useState(false);
  const st = useApp.getState();
  const sys = systemReducedMotion();
  return (
    <>
      <Group title={t.p.settings.lang}>
        <div className="seg-ctl settings-seg" role="radiogroup" aria-label={t.p.settings.lang}>
          {(['ca', 'es'] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => st.setLang(l)}>
              {l === 'ca' ? 'Català' : 'Castellano'}
            </button>
          ))}
        </div>
      </Group>
      <Group title={t.p.settings.access}>
        <div className="settings-block">
          <span className="settings-label">{t.p.settings.textSize}</span>
          <div className="seg-ctl settings-seg" role="radiogroup" aria-label={t.p.settings.textSize}>
            {(['normal', 'lg', 'xl'] as TextSize[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={a.text === s} className={a.text === s ? 'on' : ''} onClick={() => a.set({ text: s })}>
                {t.p.settings.sizes[s]}
              </button>
            ))}
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={a.contrast} onChange={(e) => a.set({ contrast: e.target.checked })} />
            <span>{t.p.settings.contrast}</span>
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={a.motion || sys} disabled={sys} onChange={(e) => a.set({ motion: e.target.checked })} />
            <span>
              {t.p.settings.motion}
              {sys && <span className="dim small"> · {t.p.settings.motionSystem}</span>}
            </span>
          </label>
          <p className="dim small">{t.p.settings.applied}</p>
        </div>
      </Group>
      <Group title={t.p.settings.clear}>
        <div className="settings-block">
          <p className="small">{t.p.settings.clearText}</p>
          <button
            type="button"
            className="btn ghost wide"
            onClick={() => {
              for (const k of userKeys(user?.id ?? 'demo')) {
                try {
                  localStorage.removeItem(k);
                } catch {
                  /* ignore */
                }
              }
              st.clearRecents();
              st.setUser(user);
              st.endTrip();
              setCleared(true);
            }}
          >
            {Ic.trash} {t.p.settings.clear}
          </button>
          <Msg ok={cleared ? t.p.settings.cleared : null} />
        </div>
      </Group>
    </>
  );
}

function DeletePage() {
  const t = useT();
  const user = useApp((s) => s.user);
  const [word, setWord] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!user || user.demo) return <p className="empty">{t.p.account.demoNeeds}</p>;
  const ok = word.trim().toUpperCase() === t.p.account.confirmWord;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        auth
          .deleteAccount(pw, userKeys(user.id))
          .then(() => {
            const st = useApp.getState();
            st.setUser(null);
            st.pushToast(t.p.account.deleted, 'info');
            st.navigate({ name: 'landing' });
          })
          .catch((er: unknown) => setErr(errText(er, t)));
      }}
    >
      <p className="demo-banner">{t.p.account.deleteText}</p>
      <label className="field">
        <span>{t.p.account.typeToConfirm(t.p.account.confirmWord)}</span>
        <input value={word} autoComplete="off" onChange={(e) => setWord(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.p.account.current}</span>
        <input type="password" value={pw} autoComplete="current-password" onChange={(e) => setPw(e.target.value)} required />
      </label>
      <Msg err={err} />
      <button type="submit" className="btn wide danger-btn" disabled={!ok || !pw}>
        {t.p.account.deleteBtn}
      </button>
    </form>
  );
}

export function AccountSubPage({ page }: { page: AccountPage }) {
  const t = useT();
  const titles: Record<AccountPage, string> = {
    info: t.p.account.info,
    profile: t.p.account.profileTitle,
    faq: t.p.account.faq,
    password: t.p.account.password,
    settings: t.p.settings.title,
    delete: t.p.account.deleteTitle,
  };
  return (
    <aside className={`home account-page acc-${page}`} aria-label={titles[page]}>
      <PageHead title={titles[page]} up={{ name: 'mine' }} />
      {page === 'info' && <InfoPage />}
      {page === 'profile' && <ProfilePage />}
      {page === 'faq' && <FaqPage />}
      {page === 'password' && <PasswordPage />}
      {page === 'settings' && <SettingsPage />}
      {page === 'delete' && <DeletePage />}
    </aside>
  );
}
