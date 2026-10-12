/** Peces comunes de les pàgines: capçalera amb «enrere», files de llista i grups (un sol estil a tota l'app). */
import type { ReactNode } from 'react';
import { useApp, type View } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Ic } from './icons.tsx';

export function PageHead({ title, up, aside }: { title: string; up?: View; aside?: ReactNode }) {
  const t = useT();
  const back = () => (up ? useApp.getState().navigate(up) : history.length > 1 ? history.back() : useApp.getState().navigate({ name: 'home' }));
  return (
    <header className="page-head">
      <button type="button" className="page-back" aria-label={t.p.back} onClick={back}>
        {Ic.back}
      </button>
      <h1>{title}</h1>
      {aside}
    </header>
  );
}

/** Fila de llista: icona a l'esquerra, text, i a la dreta un indicador (› o ↗). Sempre la mateixa disposició. */
export function Row({
  icon,
  label,
  sub,
  onClick,
  href,
  disabled = false,
  danger = false,
  trailing,
}: {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  const t = useT();
  const body = (
    <>
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-text">
        <span className="row-label">{label}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {trailing ?? <span className="row-end">{href ? Ic.ext : Ic.chevron}</span>}
    </>
  );
  const cls = `row${danger ? ' danger' : ''}`;
  if (href)
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${typeof label === 'string' ? label : ''} (${t.p.external})`}>
        {body}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {body}
    </button>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group-title">{title}</h2>}
      <div className="group-rows">{children}</div>
    </section>
  );
}

/** Etiqueta «Demostració» de les pantalles de títols i targetes (mai no es poden confondre amb les reals). */
export function DemoBanner({ text }: { text: string }) {
  const t = useT();
  return (
    <p className="demo-banner" role="note">
      <strong>{t.p.demo}</strong> · {text}
    </p>
  );
}
