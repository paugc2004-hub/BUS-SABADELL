import { describe, expect, it } from 'vitest';
import { ca } from '../i18n/ca.ts';
import { es } from '../i18n/es.ts';

/** totes les claus (camins) d'un diccionari */
function keys(o: unknown, prefix = ''): string[] {
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
function strings(o: unknown): string[] {
  if (typeof o === 'string') return [o];
  if (typeof o === 'function') return [];
  if (Array.isArray(o)) return o.flatMap(strings);
  if (o && typeof o === 'object') return Object.values(o).flatMap(strings);
  return [];
}

describe('textos', () => {
  it('català i castellà tenen exactament les mateixes claus', () => {
    expect(keys(es).sort()).toEqual(keys(ca).sort());
  });
  it('cap text diu «temps real» / «en directe» en present per a dades simulades', () => {
    // les úniques mencions permeses són les que expliquen que NO ho és o el que caldria per tenir-ho
    const bad = [...strings(ca), ...strings(es)].filter((s) => /\b(en directe|en directo)\b/i.test(s) && !/(no |sense|sin |simulad|simulaci|caldria|haría falta|amb dades|con datos)/i.test(s));
    expect(bad).toEqual([]);
  });
  it('les pantalles de títols i targetes diuen «Demostració» i el pagament és simulat', () => {
    expect(ca.p.buy.pay).toMatch(/Simular pagament \(demo · no es cobra res\)/);
    expect(es.p.buy.pay).toMatch(/Simular pago \(demo · no se cobra nada\)/);
    expect(ca.p.watermark).toBe('DEMOSTRACIÓ · NO VÀLID PER VIATJAR');
    expect(ca.p.buy.bizum).toMatch(/integració real/);
  });
});
