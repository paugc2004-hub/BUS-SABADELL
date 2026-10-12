/**
 * Títols i targetes de DEMOSTRACIÓ (paritat amb «Viaja con el móvil» i «Tarjetas» de l'app oficial de TUS).
 *
 * Res d'això té valor per viatjar: no es cobra res, no hi ha cap camp de pagament, els QR comencen per `NM-DEMO:`
 * (mai un format que pugui passar per vàlid en una validadora) i tot es guarda només en aquest dispositiu, per compte
 * (`wallet:<userId>`). No es llegeix ni s'escriu cap targeta real (cap NFC): seria enginyeria inversa d'un sistema privat.
 *
 * La UI només parla amb `TicketingProvider` i `CardProvider`. Amb una integració real amb TUS (API de venda i emissió,
 * passarel·la de pagament, format de QR de les validadores, consulta de saldo), s'escriuen uns altres proveïdors amb
 * la mateixa interfície: docs/TUS_PARITY.md.
 */
import { fareById } from '../data/fares.ts';
import type { KV } from '../auth/auth.ts';

export type Profile = 'general' | 'jove';
export type ProductId = 'senzill' | 't10' | 't-mensual' | 't-mensual-jove';

export interface Product {
  id: ProductId;
  /** viatges (null = il·limitat durant `days`) */
  trips: number | null;
  /** dies de validesa des de la primera validació (null = sense) */
  days: number | null;
  /** la pot fer servir més d'una persona alhora */
  multi: boolean;
  /** euros, de data/fares.ts (a confirmar) */
  price: number;
  profiles: Profile[];
}

const price = (id: ProductId) => fareById(id)?.price ?? 0;

/** Productes per perfil (els preus surten de data/fares.ts: els mateixos que l'app oficial el 2026-10-12). */
export const PRODUCTS: Product[] = [
  { id: 'senzill', trips: 1, days: null, multi: false, price: price('senzill'), profiles: ['general', 'jove'] },
  { id: 't10', trips: 10, days: null, multi: true, price: price('t10'), profiles: ['general', 'jove'] },
  { id: 't-mensual', trips: null, days: 30, multi: false, price: price('t-mensual'), profiles: ['general', 'jove'] },
  { id: 't-mensual-jove', trips: null, days: 30, multi: false, price: price('t-mensual-jove'), profiles: ['jove'] },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const MAX_QTY = 5;
export const MAX_PEOPLE = 10;
const DAY = 86_400_000;

export interface Ticket {
  id: string;
  productId: ProductId;
  purchaseId: string;
  boughtAt: number;
  /** viatges que queden (null = il·limitat) */
  left: number | null;
  firstUse: number | null;
  /** targeta de demostració on s'ha recarregat (si no, al mòbil) */
  cardId: string | null;
}

export interface Purchase {
  id: string;
  at: number;
  productId: ProductId;
  qty: number;
  /** euros */
  total: number;
  cardId: string | null;
}

export interface TripLog {
  id: string;
  at: number;
  ticketId: string;
  productId: ProductId;
  people: number;
  /** codi que es mostra a la pantalla de validació (sempre `NM-DEMO:`) */
  code: string;
  stopName: string | null;
}

export interface DemoCard {
  id: string;
  /** número de prova generat (`DEMO-XXXX-XXXX`), mai un número real */
  number: string;
  alias: string;
  support: 'cartro' | 'pvc';
  linkedAt: number;
}

interface WalletData {
  v: 2;
  profile: Profile;
  tickets: Ticket[];
  purchases: Purchase[];
  trips: TripLog[];
  cards: DemoCard[];
}

export type TicketState = 'active' | 'pending' | 'exhausted' | 'expired';

export class WalletError extends Error {
  constructor(readonly code: 'unknown-product' | 'bad-qty' | 'not-usable' | 'bad-people' | 'unknown-card' | 'card-support') {
    super(code);
  }
}

/** Estat d'un títol en un instant (amb l'hora de l'app, no la del dispositiu). */
export function ticketState(t: Ticket, now: number): TicketState {
  const p = productById(t.productId);
  if (t.left !== null && t.left <= 0) return 'exhausted';
  if (p?.days && t.firstUse !== null && now >= t.firstUse + p.days * DAY) return 'expired';
  if (p?.days && t.firstUse === null) return 'pending';
  return 'active';
}

/** fins quan és vàlid un títol per dies (null si encara no s'ha validat o no en té) */
export function validUntil(t: Ticket): number | null {
  const p = productById(t.productId);
  return p?.days && t.firstUse !== null ? t.firstUse + p.days * DAY : null;
}

/** El QR de la pantalla de validació: sempre `NM-DEMO:` (cap validadora l'acceptaria). */
export const demoCode = (ticketId: string, at: number) => `NM-DEMO:${ticketId}:${at}`;

const rand4 = () => String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
const ymd = (t: number) => new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Madrid' }).format(t).replaceAll('-', '');
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

const empty = (): WalletData => ({ v: 2, profile: 'general', tickets: [], purchases: [], trips: [], cards: [] });

/** v1 (sense targetes ni perfil) → v2 */
export function migrate(raw: unknown): WalletData {
  const d = (raw ?? {}) as Partial<WalletData> & { v?: number };
  if (d.v === 2) return { ...empty(), ...d, v: 2 };
  if (d.v === 1) return { ...empty(), tickets: (d.tickets ?? []).map((t) => ({ ...t, cardId: t.cardId ?? null })), purchases: (d.purchases ?? []).map((p) => ({ ...p, cardId: p.cardId ?? null })), trips: d.trips ?? [] };
  return empty();
}

export interface TicketingProvider {
  readonly kind: 'demo' | 'tus';
  profile(): Profile;
  setProfile(p: Profile): void;
  listProducts(profile: Profile): Product[];
  purchase(productId: string, qty: number, now: number, cardId?: string | null): Purchase;
  listTickets(now: number): Ticket[];
  exhausted(now: number): Ticket[];
  useTicket(id: string, people: number, now: number, stopName?: string | null): TripLog;
  purchases(): Purchase[];
  trips(): TripLog[];
}

export interface CardProvider {
  readonly kind: 'demo' | 'tus';
  /** la consulta real necessita la integració amb el sistema de validació de TUS: aquí no es llegeix res */
  readonly canReadPhysical: false;
  cards(): DemoCard[];
  link(alias: string, support: DemoCard['support'], now: number): DemoCard;
  unlink(id: string): void;
}

export class DemoWallet implements TicketingProvider, CardProvider {
  readonly kind = 'demo' as const;
  readonly canReadPhysical = false as const;
  /** si l'emmagatzematge falla, les dades viuen en memòria (i la UI ho diu) */
  persistent = true;
  private mem: WalletData | null = null;

  constructor(
    private readonly kv: KV | null,
    private readonly userId: string,
  ) {}

  private get key() {
    return `wallet:${this.userId}`;
  }

  private read(): WalletData {
    if (this.mem) return this.mem;
    try {
      const raw = this.kv?.getItem(this.key);
      return migrate(raw ? JSON.parse(raw) : null);
    } catch {
      return empty();
    }
  }

  private write(d: WalletData) {
    try {
      if (!this.kv) throw new Error('no storage');
      this.kv.setItem(this.key, JSON.stringify(d));
      this.mem = null;
    } catch {
      this.persistent = false;
      this.mem = d;
    }
  }

  profile(): Profile {
    return this.read().profile;
  }

  setProfile(p: Profile) {
    this.write({ ...this.read(), profile: p });
  }

  listProducts(profile: Profile): Product[] {
    return PRODUCTS.filter((p) => p.profiles.includes(profile));
  }

  purchase(productId: string, qty: number, now: number, cardId: string | null = null): Purchase {
    const p = productById(productId);
    if (!p) throw new WalletError('unknown-product');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new WalletError('bad-qty');
    const d = this.read();
    if (cardId) {
      const card = d.cards.find((c) => c.id === cardId);
      if (!card) throw new WalletError('unknown-card');
      // en suport de cartró només s'hi carrega la T-10 (dades facilitades; a confirmar a tus.es)
      if (card.support === 'cartro' && p.id !== 't10') throw new WalletError('card-support');
    }
    const purchase: Purchase = { id: `DEMO-${ymd(now)}-${rand4()}`, at: now, productId: p.id, qty, total: Math.round(p.price * qty * 100) / 100, cardId };
    const tickets: Ticket[] = Array.from({ length: qty }, () => ({ id: uid(), productId: p.id, purchaseId: purchase.id, boughtAt: now, left: p.trips, firstUse: null, cardId }));
    this.write({ ...d, purchases: [purchase, ...d.purchases], tickets: [...tickets, ...d.tickets] });
    return purchase;
  }

  listTickets(now: number): Ticket[] {
    return this.read().tickets.filter((t) => ['active', 'pending'].includes(ticketState(t, now)));
  }

  exhausted(now: number): Ticket[] {
    return this.read().tickets.filter((t) => ['exhausted', 'expired'].includes(ticketState(t, now)));
  }

  useTicket(id: string, people: number, now: number, stopName: string | null = null): TripLog {
    const d = this.read();
    const t = d.tickets.find((x) => x.id === id);
    if (!t || !['active', 'pending'].includes(ticketState(t, now))) throw new WalletError('not-usable');
    const p = productById(t.productId)!;
    const max = p.multi ? Math.min(MAX_PEOPLE, t.left ?? MAX_PEOPLE) : 1;
    if (!Number.isInteger(people) || people < 1 || people > max) throw new WalletError('bad-people');
    const next: Ticket = { ...t, left: t.left === null ? null : t.left - people, firstUse: t.firstUse ?? now };
    const log: TripLog = { id: uid(), at: now, ticketId: t.id, productId: t.productId, people, code: demoCode(t.id, now), stopName };
    this.write({ ...d, tickets: d.tickets.map((x) => (x.id === id ? next : x)), trips: [log, ...d.trips] });
    return log;
  }

  purchases(): Purchase[] {
    return this.read().purchases;
  }

  trips(): TripLog[] {
    return this.read().trips;
  }

  cards(): DemoCard[] {
    return this.read().cards;
  }

  link(alias: string, support: DemoCard['support'], now: number): DemoCard {
    const d = this.read();
    const card: DemoCard = { id: uid(), number: `DEMO-${rand4()}-${rand4()}`, alias: alias.trim().slice(0, 40) || 'Targeta', support, linkedAt: now };
    this.write({ ...d, cards: [...d.cards, card] });
    return card;
  }

  unlink(id: string) {
    const d = this.read();
    this.write({ ...d, cards: d.cards.filter((c) => c.id !== id), tickets: d.tickets.filter((t) => t.cardId !== id) });
  }
}

/** Claus del dispositiu que pertanyen a un compte (per esborrar-lo sense deixar-ne res). */
export const userKeys = (userId: string) => [`wallet:${userId}`, `favs:${userId}`, `myBus:${userId}`, `recents:${userId}`];
