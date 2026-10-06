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

/**
 * Reloj de la aplicación: tiempo real corregido con el reloj del servidor (bug 12.2-17)
 * y, en modo demo, con hora forzada y multiplicador.
 * Siempre se deriva del reloj absoluto: nunca acumula deltas (bugs 12.2-18 y 12.2-19).
 */
export class SimClock {
  private realBase: number;
  private simBase: number;
  private speed: number;
  private skewMs = 0;

  constructor(opts: { start?: number; speed?: number; nowFn?: () => number } = {}) {
    this.nowFn = opts.nowFn ?? (() => Date.now());
    this.realBase = this.nowFn();
    this.simBase = opts.start ?? this.realBase;
    this.speed = opts.speed ?? 1;
  }

  private nowFn: () => number;

  /** Diferencia servidor − dispositivo. */
  setServerSkew(serverTimeMs: number, receivedAtMs: number = this.nowFn()): void {
    const skew = serverTimeMs - receivedAtMs;
    // si no hay hora forzada, corregimos el desfase del dispositivo
    this.skewMs = skew;
  }

  now(): number {
    const elapsed = this.nowFn() - this.realBase;
    return this.simBase + elapsed * this.speed + (this.isLive() ? this.skewMs : 0);
  }

  isLive(): boolean {
    return this.speed === 1 && Math.abs(this.simBase - this.realBase) < 1000;
  }

  getSpeed(): number {
    return this.speed;
  }

  /** Fija una hora simulada (epoch ms) y un multiplicador. */
  set(start: number | null, speed = 1): void {
    const cur = this.nowFn();
    this.realBase = cur;
    this.simBase = start ?? cur;
    this.speed = speed;
  }
}

/**
 * Construye un instante "dia de la setmana + hora" para el modo demo
 * (?hora=08:00&dia=dilluns). Elige el próximo día de ese tipo desde `from`.
 */
const WEEKDAYS: Record<string, number> = {
  dilluns: 1, lunes: 1, dimarts: 2, martes: 2, dimecres: 3, miercoles: 3, 'miércoles': 3,
  dijous: 4, jueves: 4, divendres: 5, viernes: 5, dissabte: 6, sabado: 6, 'sábado': 6,
  diumenge: 7, domingo: 7,
};

export function forcedInstant(from: number, hora: string | null, dia: string | null): number | null {
  if (!hora && !dia) return null;
  let dt = DateTime.fromMillis(from, { zone: TZ });
  if (dia) {
    const wd = WEEKDAYS[dia.toLowerCase()];
    if (wd) {
      const delta = (wd - dt.weekday + 7) % 7;
      dt = dt.plus({ days: delta });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      dt = DateTime.fromISO(dia, { zone: TZ }).set({ hour: dt.hour, minute: dt.minute });
    }
  }
  if (hora) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (m) dt = dt.set({ hour: Number(m[1]), minute: Number(m[2]), second: 0, millisecond: 0 });
  }
  return dt.toMillis();
}
