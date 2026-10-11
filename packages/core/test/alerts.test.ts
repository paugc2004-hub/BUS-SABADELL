import { describe, expect, it } from 'vitest';
import { activeAlerts, alertsFor, isOngoing, isPublished, type Alert } from '../src/index.ts';

const A = (over: Partial<Alert>): Alert => ({ id: 'a', routes: [], stops: [], from: '2026-10-10', to: '2026-10-20', text: { ca: 'x', es: 'x' }, ...over });
const T = (iso: string) => Date.parse(iso);

describe('avisos: publicació i expiració (PPT 2024 §2.2.1)', () => {
  it('per defecte es publica durant la incidència i caduca quan s’acaba', () => {
    const a = A({});
    expect(isPublished(a, T('2026-10-09T12:00'))).toBe(false);
    expect(isPublished(a, T('2026-10-15T12:00'))).toBe(true);
    expect(isPublished(a, T('2026-10-21T12:00'))).toBe(false);
  });

  it('avís anticipat: es publica abans que comenci la incidència', () => {
    const a = A({ published: '2026-10-05' });
    expect(isPublished(a, T('2026-10-07T12:00'))).toBe(true);
    expect(isOngoing(a, T('2026-10-07T12:00'))).toBe(false);
    expect(isOngoing(a, T('2026-10-12T12:00'))).toBe(true);
  });

  it('expiració pròpia: un avís caducat no es mostra encara que la incidència continuï', () => {
    const a = A({ to: null, expires: '2026-10-12' });
    expect(isPublished(a, T('2026-10-11T12:00'))).toBe(true);
    expect(isPublished(a, T('2026-10-13T12:00'))).toBe(false);
  });

  it('sense data de fi ni expiració: es manté publicat', () => {
    expect(isPublished(A({ to: null }), T('2030-01-01T00:00'))).toBe(true);
  });

  it('dates invàlides: no es mostra (millor callar que avisar malament)', () => {
    expect(isPublished(A({ from: 'demà', published: undefined }), T('2026-10-15T12:00'))).toBe(false);
  });

  it('per línia o per parada, només els publicats', () => {
    const list = [A({ id: 'l2', routes: ['L2'] }), A({ id: 'p278', stops: ['278'] }), A({ id: 'vell', routes: ['L2'], to: '2026-10-11' })];
    const t = T('2026-10-15T12:00');
    expect(activeAlerts(list, t).map((a) => a.id)).toEqual(['l2', 'p278']);
    expect(alertsFor(list, t, { routes: ['L2'] }).map((a) => a.id)).toEqual(['l2']);
    expect(alertsFor(list, t, { stops: ['278'] }).map((a) => a.id)).toEqual(['p278']);
    expect(alertsFor(list, t, { routes: ['L1'], stops: ['1'] })).toEqual([]);
  });
});
