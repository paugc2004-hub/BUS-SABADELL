import { describe, expect, it } from 'vitest';
import { FARES, LINKS, fareById, monthlyCost } from './fares.ts';
import { NEIGHBOURHOODS, SALES_POINTS, localNow, mapsSearchUrl, openState, parseRanges } from './salesPoints.ts';

/** instant a l'hora local de Sabadell (octubre 2026: UTC+2) */
const at = (iso: string) => Date.parse(`${iso}:00+02:00`);
const NO_HOLIDAYS = new Set<string>();

describe('tarifes (dades facilitades, pendents de verificar a la font)', () => {
  it('les quatre tarifes principals de TUS, amb el preu exacte i el tipus de preu', () => {
    const p = (id: string) => [fareById(id)?.price, fareById(id)?.priceKind];
    expect(p('senzill')).toEqual([1.8, 'ordinary']);
    expect(p('t10')).toEqual([10.1, 'ordinary']);
    expect(p('t-mensual')).toEqual([20.6, 'reduced']);
    expect(p('t-mensual-jove')).toEqual([14.35, 'reduced']);
  });

  it('T-16: els 4,50 € són cost d’emissió, no preu per viatge; i és del sistema integrat (ATM)', () => {
    const t16 = fareById('t16')!;
    expect(t16.priceKind).toBe('issuance');
    expect(t16.group).toBe('atm');
    expect(t16.officialUrl).toBe(LINKS.t16);
  });

  it('TBUS de Sant Quirze: només L12, ben indicat', () => {
    const f = fareById('tbus-sant-quirze')!;
    expect(f.tags.map((x) => x.ca)).toContain('Només L12');
    expect(f.scope.ca).toMatch(/Només línia L12/);
  });

  it('identificadors únics; cap tarifa es presenta com a verificada; tots els textos en català i castellà', () => {
    expect(new Set(FARES.map((f) => f.id)).size).toBe(FARES.length);
    for (const f of FARES) {
      expect(f.verified).toBe(false);
      for (const l of [f.name, f.summary, f.scope, ...f.tags, ...f.highlights, ...f.details]) {
        expect(l.ca.trim()).not.toBe('');
        expect(l.es.trim()).not.toBe('');
      }
      expect(f.officialUrl).toMatch(/^https:\/\//);
    }
  });

  it('comparador mensual: surt de les mateixes dades (sense preus duplicats)', () => {
    expect(monthlyCost(1, false)[0]).toEqual({ id: 'senzill', cost: 1.8 });
    expect(monthlyCost(10, false)[0]).toEqual({ id: 't10', cost: 10.1 });
    expect(monthlyCost(40, false)[0]).toEqual({ id: 't-mensual', cost: 20.6 });
    expect(monthlyCost(40, true)[0]).toEqual({ id: 't-mensual-jove', cost: 14.35 });
  });
});

describe('punts de venda', () => {
  it('els 33 de la llista, sense duplicats, amb adreça, horari i títols', () => {
    expect(SALES_POINTS).toHaveLength(33);
    expect(new Set(SALES_POINTS.map((p) => p.id)).size).toBe(33);
    expect(new Set(SALES_POINTS.map((p) => `${p.name}|${p.address}`)).size).toBe(33);
    for (const p of SALES_POINTS) {
      expect(p.address).not.toBe('');
      expect(p.titles.length).toBeGreaterThan(0);
      expect(Object.keys(p.hours).length).toBeGreaterThan(0);
      for (const d of Object.values(p.hours)) for (const [a, b] of d!.ranges) expect(a).toBeLessThan(b);
    }
  });

  it('només l’Oficina de Mobilitat consta que ven T-10 i T-mensual; la resta, T-Sabadell', () => {
    const t10 = SALES_POINTS.filter((p) => p.titles.includes('t10')).map((p) => p.id);
    expect(t10).toEqual(['oficina-mobilitat']);
    expect(SALES_POINTS.filter((p) => p.id !== 'oficina-mobilitat').every((p) => p.titles.join() === 't-sabadell')).toBe(true);
  });

  it('Sant Quirze apart; barris de Sabadell per filtrar', () => {
    const sq = SALES_POINTS.filter((p) => p.municipality === 'Sant Quirze del Vallès');
    expect(sq.map((p) => p.id)).toEqual(['estanc-pau-casals']);
    expect(NEIGHBOURHOODS).toContain('Centre');
    expect(NEIGHBOURHOODS).toContain('La Creu de Barberà');
    expect(NEIGHBOURHOODS).not.toContain(null);
  });

  it('enllaç de mapes per adreça (no hi ha coordenades inventades)', () => {
    const p = SALES_POINTS.find((x) => x.id === 'estanc-16')!;
    expect(mapsSearchUrl(p)).toBe('https://www.google.com/maps/search/?api=1&query=C.%20de%20Lacy%2C%204%2C%20Sabadell');
    expect(Object.keys(p)).not.toContain('lat');
  });

  it('format d’horari', () => {
    expect(parseRanges('9:00-13:45,17:00-20:30')).toEqual([
      [540, 825],
      [1020, 1230],
    ]);
    expect(() => parseRanges('9-13')).toThrow();
  });
});

describe('obert ara? (hora local de Sabadell)', () => {
  const oficina = SALES_POINTS.find((p) => p.id === 'oficina-mobilitat')!;
  const yoli = SALES_POINTS.find((p) => p.id === 'llibreria-yoli')!;
  const tony = SALES_POINTS.find((p) => p.id === 'estanc-4')!;

  it('hora local, també des d’un instant UTC', () => {
    expect(localNow(Date.parse('2026-10-13T06:30:00Z'))).toEqual({ date: '2026-10-13', day: 1, min: 8 * 60 + 30 });
    // hivern (UTC+1): 23:30 UTC del dissabte = 00:30 de diumenge a Sabadell
    expect(localNow(Date.parse('2026-12-12T23:30:00Z'))).toEqual({ date: '2026-12-13', day: 6, min: 30 });
  });

  it('horari partit: obert al matí, tancat al migdia (obre a la tarda), obert a la tarda', () => {
    expect(openState(oficina, at('2026-10-13T09:00'), NO_HOLIDAYS)).toEqual({ state: 'open', closesAt: 13 * 60 });
    expect(openState(oficina, at('2026-10-13T14:00'), NO_HOLIDAYS)).toEqual({ state: 'closed', opens: { day: 1, min: 16 * 60, today: true } });
    expect(openState(oficina, at('2026-10-13T18:59'), NO_HOLIDAYS).state).toBe('open');
    expect(openState(oficina, at('2026-10-13T19:00'), NO_HOLIDAYS).state).toBe('closed');
  });

  it('dia sense horari publicat: tancat i diu quan torna a obrir', () => {
    // dissabte 17-10-2026 → l'Oficina obre dilluns a les 8:00
    expect(openState(oficina, at('2026-10-17T10:00'), NO_HOLIDAYS)).toEqual({ state: 'closed', opens: { day: 0, min: 8 * 60, today: false } });
  });

  it('festiu: sense horari de festius publicat → «a confirmar»; amb horari de festius → el fa servir', () => {
    const fest = new Set(['2026-10-12']); // dilluns, festiu
    expect(openState(oficina, at('2026-10-12T10:00'), fest)).toEqual({ state: 'unknown', reason: 'holiday' });
    expect(openState(tony, at('2026-10-12T10:00'), fest)).toEqual({ state: 'open', closesAt: 14 * 60 });
    expect(openState(tony, at('2026-10-12T17:30'), fest).state).toBe('closed');
  });

  it('sense calendari de festius carregat: no s’afirma res', () => {
    expect(openState(oficina, at('2026-10-13T09:00'), null)).toEqual({ state: 'unknown', reason: 'noCalendar' });
  });

  it('franja que depèn dels dies lectius (Llibreria Yoli 14–15 h): «a confirmar», no «obert»', () => {
    expect(openState(yoli, at('2026-10-13T13:00'), NO_HOLIDAYS).state).toBe('open');
    expect(openState(yoli, at('2026-10-13T14:30'), NO_HOLIDAYS)).toEqual({ state: 'unknown', reason: 'condition' });
    expect(openState(yoli, at('2026-10-13T15:30'), NO_HOLIDAYS).state).toBe('closed');
  });
});
