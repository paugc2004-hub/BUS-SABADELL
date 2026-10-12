/**
 * forcedInstant sense luxon (src/clock.ts) = la implementació original amb luxon, per a dates i hores a l'atzar,
 * incloent-hi els canvis d'hora (fast-check, llavor fixa).
 */
import fc from 'fast-check';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { forcedInstant } from '../src/clock.ts';

const TZ = 'Europe/Madrid';
const WEEKDAYS: Record<string, number> = { dilluns: 1, dimarts: 2, dimecres: 3, dijous: 4, divendres: 5, dissabte: 6, diumenge: 7 };
function reference(from: number, hora: string | null, dia: string | null): number | null {
  if (!hora && !dia) return null;
  let dt = DateTime.fromMillis(from, { zone: TZ });
  if (dia) {
    const wd = WEEKDAYS[dia.toLowerCase()];
    if (wd) dt = dt.plus({ days: (wd - dt.weekday + 7) % 7 });
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) dt = DateTime.fromISO(dia, { zone: TZ }).set({ hour: dt.hour, minute: dt.minute });
  }
  if (hora) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (m) dt = dt.set({ hour: Number(m[1]), minute: Number(m[2]), second: 0, millisecond: 0 });
  }
  return dt.toMillis();
}

const hhmm = fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
const day = fc.oneof(
  fc.constantFrom(...Object.keys(WEEKDAYS), 'dimarts'),
  fc.date({ min: new Date('2025-01-01'), max: new Date('2028-12-31'), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10)),
);

describe('hora forçada de demostració sense luxon', () => {
  it('coincideix amb luxon (hora, dia de la setmana, data, i tots dos)', () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.parse('2025-01-01'), max: Date.parse('2028-12-31') }), fc.option(hhmm, { nil: null }), fc.option(day, { nil: null }), (from, hora, dia) => {
        expect(forcedInstant(from, hora, dia)).toBe(reference(from, hora, dia));
      }),
      { numRuns: 3000, seed: 20261012 },
    );
  });
  it('canvis d’hora (29/3 i 25/10/2026)', () => {
    for (const dia of ['2026-03-29', '2026-10-25', '2026-03-28', '2026-10-24'])
      for (const hora of ['00:30', '01:59', '02:00', '02:30', '03:00', '03:30', '12:00'])
        expect(forcedInstant(Date.parse('2026-06-01T10:00:00Z'), hora, dia)).toBe(reference(Date.parse('2026-06-01T10:00:00Z'), hora, dia));
  });
});
