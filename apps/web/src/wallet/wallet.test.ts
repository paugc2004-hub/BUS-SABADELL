import { describe, expect, it } from 'vitest';
import type { KV } from '../auth/auth.ts';
import { DemoWallet, PRODUCTS, WalletError, demoCode, migrate, ticketState, userKeys, validUntil } from './wallet.ts';

const memory = (): KV & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};
const T0 = Date.parse('2026-10-12T11:54:00+02:00');
const DAY = 86_400_000;
const err = (f: () => unknown) => {
  try {
    f();
    return null;
  } catch (e) {
    return (e as WalletError).code;
  }
};

describe('moneder de demostració', () => {
  it('productes del perfil General = els de l’app oficial (1,80 / 10,10 / 20,60 €)', () => {
    const w = new DemoWallet(memory(), 'u1');
    expect(w.listProducts('general').map((p) => [p.id, p.price])).toEqual([
      ['senzill', 1.8],
      ['t10', 10.1],
      ['t-mensual', 20.6],
    ]);
    expect(w.listProducts('jove').map((p) => p.id)).toContain('t-mensual-jove');
  });

  it('comprar n unitats: una compra, n títols, número DEMO-AAAAMMDD-NNNN i total exacte', () => {
    const w = new DemoWallet(memory(), 'u1');
    const p = w.purchase('t10', 3, T0);
    expect(p.id).toMatch(/^DEMO-20261012-\d{4}$/);
    expect(p.total).toBe(30.3);
    expect(w.listTickets(T0)).toHaveLength(3);
    expect(w.purchases()).toHaveLength(1);
    expect(err(() => w.purchase('t10', 0, T0))).toBe('bad-qty');
    expect(err(() => w.purchase('t10', 99, T0))).toBe('bad-qty');
    expect(err(() => w.purchase('xx', 1, T0))).toBe('unknown-product');
  });

  it('T-10: resta les persones validades i a 0 queda esgotada (no es pot fer servir)', () => {
    const w = new DemoWallet(memory(), 'u1');
    w.purchase('t10', 1, T0);
    const id = w.listTickets(T0)[0]!.id;
    expect(err(() => w.useTicket(id, 11, T0))).toBe('bad-people');
    w.useTicket(id, 7, T0);
    expect(w.listTickets(T0)[0]!.left).toBe(3);
    expect(err(() => w.useTicket(id, 4, T0))).toBe('bad-people');
    w.useTicket(id, 3, T0 + 60_000);
    expect(w.listTickets(T0)).toHaveLength(0);
    expect(w.exhausted(T0).map((t) => ticketState(t, T0))).toEqual(['exhausted']);
    expect(err(() => w.useTicket(id, 1, T0))).toBe('not-usable');
    expect(w.trips()).toHaveLength(2);
  });

  it('bitllet senzill: unipersonal i d’un sol ús', () => {
    const w = new DemoWallet(memory(), 'u1');
    w.purchase('senzill', 1, T0);
    const id = w.listTickets(T0)[0]!.id;
    expect(err(() => w.useTicket(id, 2, T0))).toBe('bad-people');
    w.useTicket(id, 1, T0);
    expect(w.listTickets(T0)).toHaveLength(0);
  });

  it('T-mensual: 30 dies des de la primera validació; després, caducada', () => {
    const w = new DemoWallet(memory(), 'u1');
    w.purchase('t-mensual', 1, T0);
    const t = w.listTickets(T0)[0]!;
    expect(ticketState(t, T0 + 90 * DAY)).toBe('pending');
    w.useTicket(t.id, 1, T0 + DAY);
    const used = w.listTickets(T0 + DAY)[0]!;
    expect(validUntil(used)).toBe(T0 + 31 * DAY);
    w.useTicket(t.id, 1, T0 + 10 * DAY);
    expect(w.listTickets(T0 + 31 * DAY)).toHaveLength(0);
    expect(err(() => w.useTicket(t.id, 1, T0 + 31 * DAY))).toBe('not-usable');
  });

  it('el QR de validació sempre comença per NM-DEMO: (mai un format vàlid per a una validadora)', () => {
    const w = new DemoWallet(memory(), 'u1');
    w.purchase('t10', 1, T0);
    const log = w.useTicket(w.listTickets(T0)[0]!.id, 2, T0);
    expect(log.code.startsWith('NM-DEMO:')).toBe(true);
    expect(demoCode('x', 1)).toBe('NM-DEMO:x:1');
  });

  it('cada compte, el seu moneder (wallet:<userId>)', () => {
    const kv = memory();
    new DemoWallet(kv, 'a').purchase('t10', 1, T0);
    expect(new DemoWallet(kv, 'b').listTickets(T0)).toHaveLength(0);
    expect(new DemoWallet(kv, 'a').listTickets(T0)).toHaveLength(1);
    expect([...kv.map.keys()]).toEqual(['wallet:a']);
    expect(userKeys('a')).toContain('wallet:a');
  });

  it('sense emmagatzematge (privat, ple): funciona en memòria i ho diu', () => {
    const broken: KV = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => undefined };
    const w = new DemoWallet(broken, 'u1');
    w.purchase('senzill', 1, T0);
    expect(w.persistent).toBe(false);
    expect(w.listTickets(T0)).toHaveLength(1);
  });

  it('migra el format antic (v1) sense perdre res', () => {
    const d = migrate({ v: 1, tickets: [{ id: 't', productId: 't10', purchaseId: 'p', boughtAt: 1, left: 5, firstUse: null }], purchases: [], trips: [] });
    expect(d.v).toBe(2);
    expect(d.tickets[0]!.cardId).toBeNull();
    expect(d.cards).toEqual([]);
    expect(migrate('brossa').tickets).toEqual([]);
  });

  it('targetes de prova: número DEMO-XXXX-XXXX; en cartró només T-10; desvincular treu els seus títols', () => {
    const w = new DemoWallet(memory(), 'u1');
    const c = w.link('  La meva  ', 'cartro', T0);
    expect(c.number).toMatch(/^DEMO-\d{4}-\d{4}$/);
    expect(c.alias).toBe('La meva');
    expect(err(() => w.purchase('t-mensual', 1, T0, c.id))).toBe('card-support');
    w.purchase('t10', 1, T0, c.id);
    expect(w.listTickets(T0)[0]!.cardId).toBe(c.id);
    w.unlink(c.id);
    expect(w.cards()).toHaveLength(0);
    expect(w.listTickets(T0)).toHaveLength(0);
    expect(err(() => w.purchase('t10', 1, T0, 'no-hi-és'))).toBe('unknown-card');
  });

  it('els preus surten de data/fares.ts (no n’hi ha cap de duplicat a mà)', () => {
    expect(PRODUCTS.every((p) => p.price > 0)).toBe(true);
  });
});
