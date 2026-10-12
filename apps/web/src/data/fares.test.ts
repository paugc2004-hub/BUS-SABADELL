import { describe, expect, it } from 'vitest';
import { FARES, LINKS, fareById, monthlyCost } from './fares.ts';
import { NEIGHBOURHOODS, SALES_POINTS, localNow, mapsSearchUrl, openState, parseRanges, hhmmMin } from './salesPoints.ts';

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

  // llista de la especificació (2026-10-12), en el mateix ordre; adreces amb les abreviatures normalitzades
  // (Crta. → Ctra., «C. Lope de Vega» → «C. de Lope de Vega», «Pl. Madrid» → «Pl. de Madrid», apòstrof tipogràfic)
  const SPEC: [string, string, string | null, Record<string, string>][] = [
    ['Oficina de Mobilitat', 'C. de l’Estació, 67', 'Centre', { 'dl-dv': '8:00-13:00,16:00-19:00' }],
    ['ESTANC-1, Aragay', 'C. d’en Font, 26', 'Centre', { 'dl-dv': '9:00-13:45,17:00-20:30', ds: '9:30-13:45' }],
    ['ESTANC-7, Costa', 'Passeig de la Plaça Major, 25', 'Centre', { 'dl-ds': '8:00-13:30,16:00-20:30' }],
    ['ESTANC-30, Fontanella', 'C. de Fontanella, 79', 'La Creu de Barberà', { 'dl-dv': '8:30-14:00,16:30-20:30', ds: '9:00-13:30' }],
    ['ESTANC-42, Matadepera', 'Av. de Matadepera, 147', 'Ca n’Oriac', { 'dl-dv': '8:30-20:30', dg: '8:30-13:30' }],
    ['ESTANC-16, l’Estanquet de la Rambla', 'C. de Lacy, 4', 'Centre', { 'dl-dv': '9:00-14:00,17:00-20:30', ds: '10:00-13:30,17:00-20:30' }],
    ['Llibreria Yoli', 'C. de Pizarro, 6', 'La Creu de Barberà', { 'dl-dv': '8:00-14:00', 'ds-dg': '8:00-14:00' }],
    ['ESTANC-39, Tabacs', 'Plaça Espanya, 21', 'La Concòrdia', { 'dl-dv': '8:00-14:00,16:30-20:30', 'ds-dg': '8:00-14:00' }],
    ['Papereria Can Deu', 'C. de la Ginesta, 14', 'Can Deu', { 'dl-dv': '8:30-13:30,16:30-20:00', ds: '8:00-13:30' }],
    ['ESTANC-33', 'C. de Sol i Padrís, 22', 'Sol i Padrís', { 'dl-dv': '8:30-20:30', ds: '9:00-13:30' }],
    ['ESTANC-8', 'Av. de Matadepera, 243', 'La Roureda', { 'dl-ds': '8:30-13:30,17:00-20:30' }],
    ['ESTANC-4, Tony', 'Ronda Zamenhof, 66', 'Centre', { 'dl-dv': '7:30-14:00,17:00-20:30', ds: '9:30-14:00,17:00-21:30', dg: '9:00-14:00' }],
    ['ESTANC-45', 'Via Aurelia, 1', 'La Concòrdia', { 'dl-dv': '8:30-13:30,16:30-20:00', ds: '16:30-20:00' }],
    ['ESTANC Concòrdia', 'Av. Concòrdia, 56', 'La Concòrdia', { 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:30-13:30' }],
    ['ESTANC-9', 'Ctra. de Barcelona, 307', 'Avinguda–Eixample', { 'dl-dv': '8:00-14:00,16:30-20:30', ds: '9:00-13:30,17:00-20:00' }],
    ['ESTANC-27', 'Av. de Matadepera, 91', 'Ca n’Oriac', { 'dl-ds': '8:30-13:30,16:30-20:30' }],
    ['ESTANC-5', 'C. de Lope de Vega, 64', 'La Creu de Barberà', { 'dl-ds': '9:00-14:00,16:30-20:30' }],
    ['ESTANC-29', 'Ctra. de Terrassa, 339', 'Els Merinals', { 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:00-14:00,17:00-20:00' }],
    ['ESTANC-36', 'C. de Plaute, 51', 'Can Rull', { 'dl-dg': '9:00-14:00' }],
    ['ESTANC-35', 'Ronda Zamenhof, 110', 'Centre', { 'dl-dv': '7:30-21:00', 'ds-dg': '8:00-21:00' }],
    ['ESTANC-23', 'C. de Sol i Padrís, 105', 'Sol i Padrís', { 'dl-ds': '8:00-21:00', dg: '8:00-14:30' }],
    ['ESTANC-44', 'Pl. de Madrid, 19', 'Can Llong', { 'dl-ds': '8:00-21:00', dg: '8:00-14:30' }],
    ['ESTANC-18', 'C. de Campoamor, 65', 'Campoamor', { 'dl-dv': '8:30-13:30,17:00-20:00', ds: '9:00-13:30' }],
    ['TABACS-21', 'C. de Pi i Margall, 6', 'La Creu Alta', { 'dl-ds': '9:00-21:00' }],
    ['ESTANC-24', 'Av. de Barberà, 318', 'Avinguda–Eixample', { 'dl-ds': '9:00-14:00,17:00-21:00' }],
    ['ESTANC-14', 'Ctra. de Barcelona, 13', 'Centre', { 'dl-ds': '9:00-14:00,17:00-21:00' }],
    ['ESTANC-12', 'C. de les Tres Creus, 166', 'Centre', { 'dl-ds': '8:30-20:30', dg: '8:30-13:30' }],
    ['ESTANC-3', 'C. de Pau Rigalt, 10', 'La Creu Alta', { 'dl-dv': '9:00-13:30,17:00-20:30', ds: '9:00-14:00' }],
    ['ESTANC Pau Casals', 'Av. de Pau Casals, 29', null, { 'dl-dv': '9:00-14:00,17:00-20:00', ds: '9:00-14:00' }],
    ['ESTANC-32', 'Ctra. de Terrassa, 440', 'Cifuentes', { 'dl-dv': '9:00-14:00,17:00-21:00', ds: '9:00-14:00' }],
    ['ESTANC-11', 'Av. de Barberà, 20', 'Avinguda–Eixample', { 'dl-dv': '9:00-13:30,17:00-20:00', ds: '10:00-13:30,18:00-20:30' }],
    ['ESTANC-6', 'Rambla de Sabadell, 211', 'Centre', { 'dl-dv': '9:00-14:00,16:00-20:30', ds: '10:00-20:30' }],
    ['ESTANC-20', 'Ctra. de Terrassa, 108', 'Hostafrancs', { 'dl-dv': '8:30-13:30,16:30-20:30', ds: '9:30-13:30,17:00-20:30' }],
  ];
  it('cada punt coincideix amb la llista de l’especificació: nom, adreça, barri i horari de cada dia', () => {
    const DAYS: Record<string, number[]> = { 'dl-dv': [0, 1, 2, 3, 4], ds: [5], dg: [6], 'dl-ds': [0, 1, 2, 3, 4, 5], 'dl-dg': [0, 1, 2, 3, 4, 5, 6], 'ds-dg': [5, 6] };
    expect(SALES_POINTS.length).toBe(SPEC.length);
    SPEC.forEach(([name, address, area, spec], i) => {
      const p = SALES_POINTS[i]!;
      expect([p.name, p.address, p.neighbourhood], name).toEqual([name, address, area]);
      const want: (string | null)[] = Array(7).fill(null);
      for (const [k, v] of Object.entries(spec)) for (const d of DAYS[k]!) want[d] = v;
      const got = ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => p.hours[d]?.ranges.map(([a, b]) => `${hhmmMin(a)}-${hhmmMin(b)}`).join(',') ?? null);
      expect(got, name).toEqual(want);
    });
    expect(SALES_POINTS.find((p) => p.name === 'ESTANC Pau Casals')!.municipality).toBe('Sant Quirze del Vallès');
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
