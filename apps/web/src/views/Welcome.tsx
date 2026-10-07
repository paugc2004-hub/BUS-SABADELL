/**
 * Pas d'ubicació (una sola vegada, després d'entrar): per què la demanem i un botó.
 * La posició només es fa servir al dispositiu (origen de la ruta i parades a prop).
 */
import { useState } from 'react';
import { useApp } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Logo } from '../ui/Logo.tsx';
import { Icon } from '../ui/common.tsx';
import { locationService } from '../location/location.ts';

const KEY = 'nextmobility.locAsked';

export function locationAsked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // sense emmagatzematge: no bloquejar l'app
  }
}

function markAsked() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* navegació privada */
  }
}

export function LocationStep({ onDone }: { onDone: () => void }) {
  const t = useT();
  const user = useApp((s) => s.user);
  const [busy, setBusy] = useState(false);
  const done = () => {
    markAsked();
    onDone();
  };
  const allow = () => {
    setBusy(true);
    // si falla (denegada, sense senyal), l'inici ho explica i deixa tornar-ho a provar
    void locationService.locate().finally(done);
  };
  const first = user && !user.demo ? user.name.split(' ')[0] : null;
  return (
    <main className="auth welcome theme-light">
      <section className="auth-card" aria-labelledby="welcome-title">
        <Logo size={36} />
        <div className="welcome-ico" aria-hidden>
          {Icon.locate}
        </div>
        <h1 id="welcome-title">{first ? t.welcome.titleName(first) : t.welcome.title}</h1>
        <p className="auth-lead">{t.welcome.text}</p>
        <button type="button" className="btn-primary btn-block" onClick={allow} disabled={busy}>
          {busy ? t.welcome.asking : t.welcome.allow}
        </button>
        <button type="button" className="auth-switch" onClick={done}>
          {t.welcome.skip}
        </button>
        <p className="auth-note">{t.welcome.privacy}</p>
      </section>
    </main>
  );
}
