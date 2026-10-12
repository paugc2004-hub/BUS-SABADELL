/**
 * «Viatja amb el mòbil» i «Consulta o recarrega la targeta» (paritat amb l'app oficial de TUS), 100 % DEMOSTRACIÓ:
 * no hi ha cap camp de pagament, el botó diu «Simular pagament (demo · no es cobra res)», Bizum surt desactivat i sense
 * logo, tots els títols porten la marca d'aigua i el QR comença per `NM-DEMO:`. Cap lectura de targetes reals (NFC).
 * Tros a part (lazy): no pesa a l'inici.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { haversine } from '@bus/core';
import { clock, useApp, type CardPage, type TicketPage } from '../state/store.ts';
import { useT } from '../i18n/index.ts';
import { Ic } from '../ui/icons.tsx';
import { LogoMark } from '../ui/Logo.tsx';
import { DemoBanner, Group, PageHead, Row } from '../ui/Page.tsx';
import { useWallet } from '../wallet/useWallet.ts';
import { MAX_PEOPLE, MAX_QTY, productById, ticketState, validUntil, type DemoCard, type Product, type ProductId, type Profile, type Ticket, type TripLog } from '../wallet/wallet.ts';
import { euros, fareById } from '../data/fares.ts';
import { qrSvg } from '../data/qr.ts';

const COLORS: Record<ProductId, string> = { senzill: '#4b5568', t10: '#0f766e', 't-mensual': '#1d4ed8', 't-mensual-jove': '#6d28d9' };
const fmtDate = (t: number, lang: string) => new Intl.DateTimeFormat(lang, { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(t);
const fmtDateTime = (t: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);

function useName() {
  const lang = useApp((s) => s.lang);
  return (id: ProductId) => fareById(id)?.name[lang] ?? id;
}

/** La targeta d'un títol: disseny propi (logo N), sempre amb la marca d'aigua de demostració. */
function TicketArt({ id, big = false }: { id: ProductId; big?: boolean }) {
  const t = useT();
  const name = useName();
  return (
    <div className={`tk-art${big ? ' big' : ''}`} style={{ ['--tk' as string]: COLORS[id] }} aria-hidden>
      <span className="tk-art-name">{name(id)}</span>
      <span className="tk-art-brand">
        <LogoMark size={big ? 26 : 18} /> NextMobility
      </span>
      <span className="tk-art-mark">{t.p.demo}</span>
    </div>
  );
}

function ticketMeta(tk: Ticket, now: number, t: ReturnType<typeof useT>, lang: string): string {
  const p = productById(tk.productId)!;
  if (p.trips && p.trips > 1) return t.p.tickets.left(tk.left ?? 0, p.trips);
  if (p.trips === 1) return t.p.tickets.single;
  const until = validUntil(tk);
  return until ? t.p.tickets.until(fmtDate(until - 1, lang)) : t.p.tickets.pending;
}

/* ------------------------------------------------------------------ Els meus títols */

function TicketList() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const st = useApp.getState();
  const { wallet, version } = useWallet();
  const now = clock.now();
  const name = useName();
  const tickets = useMemo(() => wallet.listTickets(now), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = useMemo(() => wallet.cards(), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <PageHead title={t.p.tickets.title} up={{ name: 'home' }} />
      <DemoBanner text={t.p.tickets.note} />
      {!wallet.persistent && <p className="form-msg err">{t.p.tickets.noStorage}</p>}
      {tickets.length === 0 ? (
        <div className="tk-empty">
          <span className="tk-empty-art">{Ic.ticket}</span>
          <p>{t.p.tickets.empty}</p>
        </div>
      ) : (
        <ul className="tk-list">
          {tickets.map((tk) => (
            <li key={tk.id} className="tk-item">
              <TicketArt id={tk.productId} />
              <div className="tk-info">
                <strong>{name(tk.productId)}</strong>
                <span className="dim small">{ticketMeta(tk, now, t, lang)}</span>
                <span className="dim small">{tk.cardId ? t.p.tickets.onCard(cards.find((c) => c.id === tk.cardId)?.alias ?? '—') : t.p.tickets.onPhone}</span>
                <button type="button" className="btn primary tk-use" onClick={() => st.navigate({ name: 'tickets', page: 'use', id: tk.id })}>
                  {t.p.tickets.use}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="tk-exhausted-link">
        <button type="button" className="text-btn" onClick={() => st.navigate({ name: 'tickets', page: 'exhausted' })}>
          {t.p.tickets.exhaustedLink}
        </button>
      </p>
      <Group>
        <Row icon={Ic.cart} label={t.p.tickets.buy} onClick={() => (st.set({ rechargeCard: null }), st.navigate({ name: 'tickets', page: 'buy' }))} />
        <Row icon={Ic.euro} label={t.p.tickets.purchases} onClick={() => st.navigate({ name: 'tickets', page: 'purchases' })} />
        <Row icon={Ic.history} label={t.p.tickets.trips} onClick={() => st.navigate({ name: 'tickets', page: 'trips' })} />
      </Group>
    </>
  );
}

/* ------------------------------------------------------------------ Compra un títol */

function BuyList() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const cardId = useApp((s) => s.rechargeCard);
  const st = useApp.getState();
  const { wallet, version, changed } = useWallet();
  const name = useName();
  const profile = useMemo(() => wallet.profile(), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = cardId ? wallet.cards().find((c) => c.id === cardId) : undefined;
  const products = wallet.listProducts(profile).filter((p) => !card || card.support === 'pvc' || p.id === 't10');
  return (
    <>
      <PageHead title={card ? t.p.cards.rechargeTitle : t.p.buy.title} up={card ? { name: 'cards', page: 'recharge' } : { name: 'tickets', page: 'list' }} />
      <DemoBanner text={t.p.tickets.note} />
      <label className="field tk-profile">
        <span>
          {Ic.user} {t.p.buy.profile}
        </span>
        <select
          value={profile}
          onChange={(e) => {
            wallet.setProfile(e.target.value as Profile);
            changed();
          }}
        >
          {(['general', 'jove'] as const).map((p) => (
            <option key={p} value={p}>
              {t.p.buy.profiles[p]}
            </option>
          ))}
        </select>
      </label>
      <p className="dim small">{t.p.buy.profileNote}</p>
      {card && <p className="form-msg ok">{t.p.buy.toCard(card.alias)}</p>}
      {card?.support === 'cartro' && <p className="dim small">{t.p.buy.cartroOnly}</p>}
      <p className="page-lead">{t.p.buy.intro}</p>
      <ul className="tk-products">
        {products.map((p) => (
          <li key={p.id}>
            <button type="button" className="tk-product" onClick={() => st.navigate({ name: 'tickets', page: 'product', id: p.id })}>
              <TicketArt id={p.id} />
              <span className="tk-product-text">
                <strong>{name(p.id)}</strong>
                <span className="dim small">{t.p.buy.desc[p.id]}</span>
                {p.multi && <span className="tk-tag">{t.p.buy.multi}</span>}
                <span className="tk-price">{euros(p.price, lang)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="dim small">{t.p.buy.priceNote}</p>
    </>
  );
}

function ProductPage({ id }: { id: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const cardId = useApp((s) => s.rechargeCard);
  const st = useApp.getState();
  const { wallet, changed } = useWallet();
  const name = useName();
  const p: Product | undefined = productById(id);
  const card = cardId ? wallet.cards().find((c) => c.id === cardId) : undefined;
  const [qty, setQty] = useState(1);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ id: string; ticket: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!p) return <PageHead title={t.p.buy.title} up={{ name: 'tickets', page: 'buy' }} />;
  const fare = fareById(p.id);
  const total = Math.round(p.price * qty * 100) / 100;

  const pay = () => {
    // un sol toc compta una vegada (el botó queda bloquejat mentre «paga» i després es tanca la pantalla)
    if (paying || done) return;
    setPaying(true);
    window.setTimeout(() => {
      try {
        const purchase = wallet.purchase(p.id, qty, clock.now(), card?.id ?? null);
        const first = wallet.listTickets(clock.now()).find((x) => x.purchaseId === purchase.id);
        setDone({ id: purchase.id, ticket: first?.id ?? null });
        changed();
      } catch {
        setErr(t.p.buy.cartroOnly);
      } finally {
        setPaying(false);
      }
    }, 700);
  };

  if (done)
    return (
      <>
        <PageHead title={t.p.buy.title} up={{ name: 'tickets', page: 'list' }} />
        <div className="tk-done" role="status">
          <span className="tk-done-check" aria-hidden>
            ✓
          </span>
          <h2>{t.p.buy.done}</h2>
          <p>
            {t.p.buy.op}: <span className="mono">{done.id}</span>
          </p>
          <DemoBanner text={t.p.tickets.note} />
        </div>
        <div className="btn-stack">
          <button type="button" className="btn primary wide" onClick={() => st.navigate({ name: 'tickets', page: 'list' })}>
            {t.p.buy.see}
          </button>
          {done.ticket && !card && (
            <button type="button" className="btn ghost wide" onClick={() => st.navigate({ name: 'tickets', page: 'use', id: done.ticket! })}>
              {t.p.buy.useNow}
            </button>
          )}
        </div>
      </>
    );

  return (
    <>
      <PageHead title={name(p.id)} up={{ name: 'tickets', page: 'buy' }} />
      <TicketArt id={p.id} big />
      <p className="tk-detail-price">
        {t.p.buy.price}: <strong>{euros(p.price, lang)}</strong>
      </p>
      <p>{t.p.buy.desc[p.id]}</p>
      {card && <p className="form-msg ok">{t.p.buy.toCard(card.alias)}</p>}
      {fare && (
        <details className="tk-conditions">
          <summary>{t.p.buy.conditions}</summary>
          <ul>
            {fare.details.map((d) => (
              <li key={d.ca}>{d[lang]}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="tk-qty" role="group" aria-label={t.p.buy.qty}>
        <span>{t.p.buy.qty}</span>
        <button type="button" aria-label={t.p.buy.less} disabled={qty <= 1} onClick={() => setQty(qty - 1)}>
          −
        </button>
        <output aria-live="polite">{qty}</output>
        <button type="button" aria-label={t.p.buy.more} disabled={qty >= MAX_QTY} onClick={() => setQty(qty + 1)}>
          +
        </button>
      </div>
      <p className="tk-total">
        {t.p.buy.total}: <strong>{euros(total, lang)}</strong>
      </p>
      {err && <p className="form-msg err">{err}</p>}
      <div className="btn-stack">
        <button type="button" className="btn wide tk-bizum" disabled aria-disabled>
          {t.p.buy.bizum}
        </button>
        <button type="button" className="btn primary wide" onClick={pay} disabled={paying}>
          {paying ? t.p.buy.paying : t.p.buy.pay}
        </button>
        <button type="button" className="btn ghost wide" onClick={() => st.navigate({ name: 'tickets', page: 'buy' })}>
          {t.p.buy.cancel}
        </button>
      </div>
      <p className="dim small">{t.p.buy.priceNote}</p>
    </>
  );
}

/* ------------------------------------------------------------------ Fes-lo servir (validació de demo) */

/** porta el focus al botó «Fet» del diàleg (teclat i lector de pantalla) */
function FocusFirst() {
  useEffect(() => {
    const done = document.querySelector<HTMLButtonElement>('.tk-v-done');
    done?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && done?.click();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);
  return null;
}

function UsePage({ id }: { id: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const engine = useApp((s) => s.engine);
  const userPos = useApp((s) => s.userPos);
  const st = useApp.getState();
  const { wallet, version, changed } = useWallet();
  const name = useName();
  const now = clock.now();
  const tk = useMemo(() => wallet.listTickets(now).find((x) => x.id === id) ?? null, [wallet, version, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [people, setPeople] = useState(1);
  const [log, setLog] = useState<TripLog | null>(null);
  if (log) {
    const svg = qrSvg(log.code, { margin: 2, title: t.p.watermark });
    const left = wallet.listTickets(clock.now()).find((x) => x.id === id)?.left ?? null;
    // a pantalla sencera, fora del panell (que té el seu propi scroll)
    return createPortal(
      <div className="tk-validate" role="dialog" aria-modal="true" aria-label={t.p.use.title}>
        <p className="tk-v-mark" aria-hidden>
          {t.p.watermark}
        </p>
        <h2>{name(log.productId)}</h2>
        <p className="tk-v-people">{t.p.use.validated(log.people)}</p>
        <div className="tk-v-qr" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mono tk-v-time">{fmtDateTime(log.at, lang)}</p>
        {log.stopName && <p className="dim small">{t.p.use.stop(log.stopName)}</p>}
        {left !== null && <p className="small">{t.p.use.left(left)}</p>}
        <p className="tk-v-warn">{t.p.watermark}</p>
        <FocusFirst />
        <button type="button" className="btn primary wide tk-v-done" onClick={() => st.navigate({ name: 'tickets', page: 'list' })}>
          {t.p.use.done}
        </button>
      </div>,
      document.body,
    );
  }
  if (!tk)
    return (
      <>
        <PageHead title={t.p.use.title} up={{ name: 'tickets', page: 'list' }} />
        <p className="form-msg err">{t.p.use.notUsable}</p>
      </>
    );
  const p = productById(tk.productId)!;
  const max = p.multi ? Math.min(MAX_PEOPLE, tk.left ?? MAX_PEOPLE) : 1;
  const validate = () => {
    // la parada més propera, si se sap (només al dispositiu)
    let stopName: string | null = null;
    if (engine && userPos) {
      let best = Infinity;
      for (const s of engine.stops.values()) {
        const d = haversine(userPos, [s.lon, s.lat]);
        if (d < best && d < 300) {
          best = d;
          stopName = `${s.id} - ${s.name}`;
        }
      }
    }
    try {
      setLog(wallet.useTicket(tk.id, people, clock.now(), stopName));
      changed();
    } catch {
      /* ja no és vàlid: la pantalla ho dirà en tornar */
    }
  };
  return (
    <>
      <PageHead title={t.p.use.title} up={{ name: 'tickets', page: 'list' }} />
      <DemoBanner text={t.p.tickets.note} />
      <TicketArt id={tk.productId} big />
      <p className="tk-detail-price">{ticketMeta(tk, now, t, lang)}</p>
      {p.multi && (
        <div className="tk-qty" role="group" aria-label={t.p.use.people}>
          <span>{t.p.use.people}</span>
          <button type="button" aria-label="−1" disabled={people <= 1} onClick={() => setPeople(people - 1)}>
            −
          </button>
          <output aria-live="polite">{people}</output>
          <button type="button" aria-label="+1" disabled={people >= max} onClick={() => setPeople(people + 1)}>
            +
          </button>
        </div>
      )}
      <div className="btn-stack">
        <button type="button" className="btn primary wide" onClick={validate}>
          {t.p.use.validate}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ historials */

function History({ page }: { page: 'purchases' | 'trips' | 'exhausted' }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { wallet, version } = useWallet();
  const name = useName();
  const now = clock.now();
  const purchases = useMemo(() => wallet.purchases(), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const trips = useMemo(() => wallet.trips(), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const exhausted = useMemo(() => wallet.exhausted(now), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = page === 'purchases' ? t.p.tickets.purchases : page === 'trips' ? t.p.tickets.trips : t.p.tickets.exhaustedLink;
  return (
    <>
      <PageHead title={title} up={{ name: 'tickets', page: 'list' }} />
      <DemoBanner text={t.p.tickets.note} />
      {page === 'purchases' &&
        (purchases.length ? (
          <ul className="tk-history">
            {purchases.map((x) => (
              <li key={x.id}>
                <strong>
                  {name(x.productId)} {t.p.history.qty(x.qty)}
                </strong>
                <span>{euros(x.total, lang)}</span>
                <span className="dim small">
                  {fmtDateTime(x.at, lang)} · <span className="mono">{x.id}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t.p.history.purchasesEmpty}</p>
        ))}
      {page === 'trips' &&
        (trips.length ? (
          <ul className="tk-history">
            {trips.map((x) => (
              <li key={x.id}>
                <strong>{name(x.productId)}</strong>
                <span>{t.p.history.people(x.people)}</span>
                <span className="dim small">
                  {fmtDateTime(x.at, lang)}
                  {x.stopName ? ` · ${x.stopName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t.p.history.tripsEmpty}</p>
        ))}
      {page === 'exhausted' &&
        (exhausted.length ? (
          <ul className="tk-history">
            {exhausted.map((x) => (
              <li key={x.id}>
                <strong>{name(x.productId)}</strong>
                <span>{ticketState(x, now) === 'expired' ? t.p.history.expired : t.p.history.exhausted}</span>
                <span className="dim small">{fmtDateTime(x.boughtAt, lang)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{t.p.history.exhaustedEmpty}</p>
        ))}
    </>
  );
}

export function TicketsPage({ page, id }: { page: TicketPage; id?: string }) {
  const t = useT();
  return (
    <aside className="home tickets-page" aria-label={t.p.tickets.title}>
      {page === 'list' && <TicketList />}
      {page === 'buy' && <BuyList />}
      {page === 'product' && <ProductPage id={id ?? ''} />}
      {page === 'use' && <UsePage id={id ?? ''} />}
      {(page === 'purchases' || page === 'trips' || page === 'exhausted') && <History page={page} />}
    </aside>
  );
}

/* ------------------------------------------------------------------ Les meves targetes */

function CardItem({ c, onUnlink }: { c: DemoCard; onUnlink?: () => void }) {
  const t = useT();
  const { wallet, version } = useWallet();
  const n = useMemo(() => wallet.listTickets(clock.now()).filter((x) => x.cardId === c.id).length, [wallet, version, c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li className="cd-item">
      <span className="cd-art" aria-hidden>
        <LogoMark size={18} />
        <span className="cd-mark">{t.p.demoShort}</span>
      </span>
      <span className="cd-info">
        <strong>{c.alias}</strong>
        <span className="mono small">{c.number}</span>
        <span className="dim small">
          {t.p.cards.support[c.support]} · {t.p.cards.titles(n)}
        </span>
      </span>
      {onUnlink && (
        <button type="button" className="text-btn" onClick={onUnlink}>
          {t.p.cards.unlink}
        </button>
      )}
    </li>
  );
}

export function CardsPage({ page }: { page: CardPage }) {
  const t = useT();
  const st = useApp.getState();
  const { wallet, version, changed } = useWallet();
  const cards = useMemo(() => wallet.cards(), [wallet, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [alias, setAlias] = useState('');
  const [support, setSupport] = useState<DemoCard['support']>('pvc');
  const nfc = typeof window !== 'undefined' && 'NDEFReader' in window;
  return (
    <aside className="home cards-page" aria-label={t.p.cards.title}>
      {page === 'list' && (
        <>
          <PageHead title={t.p.cards.title} up={{ name: 'home' }} />
          <DemoBanner text={t.p.cards.checkNeeds} />
          <h2 className="group-title">{t.p.cards.linked}</h2>
          {cards.length ? (
            <ul className="cd-list">
              {cards.map((c) => (
                <CardItem
                  key={c.id}
                  c={c}
                  onUnlink={() => {
                    wallet.unlink(c.id);
                    changed();
                  }}
                />
              ))}
            </ul>
          ) : (
            <div className="tk-empty">
              <span className="tk-empty-art">{Ic.nfc}</span>
              <p>{t.p.cards.empty}</p>
            </div>
          )}
          <Group title={t.p.cards.actions}>
            <Row icon={Ic.nfc} label={t.p.cards.check} onClick={() => st.navigate({ name: 'cards', page: 'check' })} />
            <Row icon={Ic.ticket} label={t.p.cards.recharge} onClick={() => st.navigate({ name: 'cards', page: 'recharge' })} />
            <Row icon={Ic.link} label={t.p.cards.link} onClick={() => st.navigate({ name: 'cards', page: 'link' })} />
          </Group>
        </>
      )}
      {page === 'check' && (
        <>
          <PageHead title={t.p.cards.checkTitle} up={{ name: 'cards', page: 'list' }} />
          <div className="cd-check" aria-hidden>
            <span className="cd-check-phone" />
            <span className="cd-check-card" />
          </div>
          <p className="cd-check-hold">{t.p.cards.checkHold}</p>
          <DemoBanner text={t.p.cards.checkNeeds} />
          <p className="dim small">{nfc ? t.p.cards.nfcYes : t.p.cards.nfcNo}</p>
          <div className="btn-stack">
            <button type="button" className="btn primary wide" onClick={() => st.navigate({ name: 'cards', page: 'link' })}>
              {t.p.cards.link}
            </button>
          </div>
        </>
      )}
      {page === 'link' && (
        <>
          <PageHead title={t.p.cards.linkTitle} up={{ name: 'cards', page: 'list' }} />
          <DemoBanner text={t.p.cards.numberNote} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              wallet.link(alias, support, clock.now());
              changed();
              st.pushToast(t.p.cards.linkedOk, 'go');
              st.navigate({ name: 'cards', page: 'list' });
            }}
          >
            <label className="field">
              <span>{t.p.cards.alias}</span>
              <input value={alias} maxLength={40} placeholder={t.p.cards.aliasPh} onChange={(e) => setAlias(e.target.value)} />
            </label>
            <fieldset className="field cd-support">
              <legend>{t.p.cards.supportLabel}</legend>
              {(['pvc', 'cartro'] as const).map((s) => (
                <label key={s} className="radio">
                  <input type="radio" name="support" value={s} checked={support === s} onChange={() => setSupport(s)} /> {t.p.cards.support[s]}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn primary wide">
              {t.p.cards.save}
            </button>
          </form>
        </>
      )}
      {page === 'recharge' && (
        <>
          <PageHead title={t.p.cards.rechargeTitle} up={{ name: 'cards', page: 'list' }} />
          <DemoBanner text={t.p.tickets.note} />
          {cards.length === 0 ? (
            <>
              <p className="empty">{t.p.cards.needCard}</p>
              <button type="button" className="btn primary wide" onClick={() => st.navigate({ name: 'cards', page: 'link' })}>
                {t.p.cards.link}
              </button>
            </>
          ) : (
            <>
              <h2 className="group-title">{t.p.cards.pick}</h2>
              <ul className="cd-list pick">
                {cards.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="cd-pick"
                      onClick={() => {
                        st.set({ rechargeCard: c.id });
                        st.navigate({ name: 'tickets', page: 'buy' });
                      }}
                    >
                      <strong>{c.alias}</strong>
                      <span className="mono small">{c.number}</span>
                      <span className="dim small">{t.p.cards.support[c.support]}</span>
                      {Ic.chevron}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </aside>
  );
}
