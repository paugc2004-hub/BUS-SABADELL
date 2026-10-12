/**
 * Tiempo de servicio. Todo cálculo se hace en Europe/Madrid explícitamente
 * (bug 12.2-13): el servidor puede estar en UTC y el móvil en cualquier zona.
 *
 * Convención GTFS: las horas de una expedición se cuentan desde "mediodía − 12 h"
 * del día de servicio. Así, los días de cambio de hora siguen siendo coherentes
 * (bug 12.2-14) y las horas > 24:00 pertenecen al día de servicio anterior (12.2-15).
 */
import { DateTime } from 'luxon';
import type { DayType, NetworkData } from './types.ts';

export const TZ = 'Europe/Madrid';

/** Epoch ms del origen de horas del día de servicio `date` (YYYY-MM-DD). */
export function serviceDayOrigin(date: string): number {
  return DateTime.fromISO(date, { zone: TZ }).set({ hour: 12 }).minus({ hours: 12 }).toMillis();
}

/** Fecha local (YYYY-MM-DD) del instante dado. */
export function localDate(epochMs: number): string {
  return DateTime.fromMillis(epochMs, { zone: TZ }).toISODate()!;
}

/**
 * Instant (ISO amb el desplaçament de Madrid) d'una data local, amb hora opcional: «2026-10-13» o «2026-10-13 09:30».
 * Els avisos s'escriuen en hora local i s'han de llegir igual en un servidor en UTC (bug 12.2-13).
 */
export function localIso(local: string): string {
  return DateTime.fromISO(local.trim().replace(' ', 'T'), { zone: TZ }).toISO()!;
}

export function addDays(date: string, n: number): string {
  return DateTime.fromISO(date, { zone: TZ }).plus({ days: n }).toISODate()!;
}

/** Día de la semana ISO (1 = lunes … 7 = domingo). */
export function isoWeekday(date: string): number {
  return DateTime.fromISO(date, { zone: TZ }).weekday;
}

export type HolidayList = NetworkData['holidays'];

/** Tipo de día para TUS: domingos y festivos → festiu (líneas F); sábados → dissabte. */
export function dayTypeFor(date: string, holidays: HolidayList): DayType {
  if (holidays.some((h) => h.date === date)) return 'festiu';
  const wd = isoWeekday(date);
  if (wd === 7) return 'festiu';
  if (wd === 6) return 'dissabte';
  return 'feiner';
}

export function holidayName(date: string, holidays: HolidayList): string | null {
  return holidays.find((h) => h.date === date)?.name ?? null;
}

/** "HH:MM" local de un epoch ms. */
export function formatHM(epochMs: number): string {
  return DateTime.fromMillis(epochMs, { zone: TZ }).toFormat('HH:mm');
}

export function formatHMS(epochMs: number): string {
  return DateTime.fromMillis(epochMs, { zone: TZ }).toFormat('HH:mm:ss');
}

/** Segundos desde el origen GTFS → "HH:MM" (admite > 24:00). */
export function secondsToHM(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseHM(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) throw new Error(`Hora no vàlida: "${hm}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 47) throw new Error(`Hora fora de rang: "${hm}"`);
  return h * 3600 + min * 60;
}

export { SimClock, forcedInstant } from './clock.ts';
