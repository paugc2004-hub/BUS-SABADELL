/**
 * «Com hi arribo» (paritat amb «Cómo llegar» de l'app de TUS): origen i destí a la vista, intercanviar, quan, i el
 * resultat es calcula DINS de l'app (planTrip) — l'app oficial obre Google Maps. Google Maps queda com a enllaç a la ruta.
 * La ubicació no surt mai a l'URL: «la meva ubicació» és l'absència d'origen o el destí 'me'.
 */
import { useState } from 'react';
import { useApp, clock } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { useLocation } from '../location/location.ts';
import { hm } from '../ui/common.tsx';
import { Ic } from '../ui/icons.tsx';
import { PageHead } from '../ui/Page.tsx';
import { PlaceSearch, usePlace } from './Route.tsx';

/** 'me' = la meva ubicació */
type Code = string;

function Field({ label, code, placeholder, onPick, onMe, meLabel }: { label: string; code: Code | null; placeholder: string; onPick: (c: Code | null) => void; onMe: () => void; meLabel: string }) {
  const t = useT();
  const place = usePlace(code ?? undefined);
  const [editing, setEditing] = useState(false);
  const id = label.replace(/\W+/g, '-');
  const shown = code && !editing;
  return (
    <div className="pf-field">
      <span className="pf-label" id={id}>
        {label}
      </span>
      {shown ? (
        <div className="pf-value" aria-labelledby={id}>
          {code === 'me' ? <span className="pf-me">{Ic.locate}</span> : null}
          <span className="pf-name">{code === 'me' ? meLabel : place ? place.name : place === null ? '—' : '…'}</span>
          <button type="button" className="text-btn" onClick={() => setEditing(true)}>
            {t.p.plan.change}
          </button>
        </div>
      ) : (
        <>
          <PlaceSearch
            placeholder={placeholder}
            autoFocus={editing}
            onPick={(c) => {
              onPick(c);
              setEditing(false);
            }}
          />
          <button
            type="button"
            className="text-btn pf-me-btn"
            onClick={() => {
              onMe();
              setEditing(false);
            }}
          >
            {Ic.locate} {meLabel}
          </button>
        </>
      )}
    </div>
  );
}

export function PlanForm() {
  const t = useT();
  const userPos = useApp((s) => s.userPos);
  const locStatus = useLocation((s) => s.status);
  const st = useApp.getState();
  const [from, setFrom] = useState<Code | null>('me');
  const [to, setTo] = useState<Code | null>(null);
  const [when, setWhen] = useState<'now' | 'depart' | 'arrive'>('now');
  const [hhmm, setHhmm] = useState(() => hm(clock.now() + 30 * 60_000));
  const noLoc = (from === 'me' || to === 'me') && !userPos && locStatus !== 'locating';
  const ready = Boolean(from && to && from !== to && !noLoc);

  const go = () => {
    if (!ready || !from || !to) return;
    st.set({ planWhen: { when, hhmm } });
    st.navigate({ name: 'route', to, from: from === 'me' ? undefined : from });
  };

  return (
    <aside className="home plan-form" aria-label={t.p.plan.title}>
      <PageHead title={t.p.plan.title} up={{ name: 'home' }} />
      <div className="pf-box">
        <Field label={t.p.plan.from} code={from} placeholder={t.p.plan.fromPh} onPick={setFrom} onMe={() => setFrom('me')} meLabel={t.p.plan.myLoc} />
        <button
          type="button"
          className="pf-swap"
          aria-label={t.p.plan.swap}
          title={t.p.plan.swap}
          disabled={!from && !to}
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          {Ic.swap}
        </button>
        <Field label={t.p.plan.to} code={to} placeholder={t.p.plan.toPh} onPick={setTo} onMe={() => setTo('me')} meLabel={t.p.plan.myLoc} />
      </div>

      <div className="plan-when pf-when" role="group" aria-label={t.p.plan.when}>
        {(['now', 'depart', 'arrive'] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} className={when === w ? 'on' : ''} onClick={() => setWhen(w)}>
            {w === 'now' ? t.p.plan.now : w === 'depart' ? t.p.plan.depart : t.p.plan.arrive}
          </button>
        ))}
        {when !== 'now' && (
          <label className="plan-time">
            <span className="sr-only">{t.plan.timeLabel}</span>
            <input type="time" value={hhmm} onChange={(e) => setHhmm(e.target.value)} required />
          </label>
        )}
      </div>

      {noLoc && <p className="form-msg err">{t.p.plan.noLoc}</p>}
      <button type="button" className="btn primary wide pf-go" disabled={!ready} onClick={go}>
        {t.p.plan.go}
      </button>
      {!ready && !noLoc && <p className="dim small pf-need">{t.p.plan.need}</p>}
      <p className="dim small pf-note">{t.p.plan.note}</p>
    </aside>
  );
}
