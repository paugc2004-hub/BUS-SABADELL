/**
 * Avisos (incidències) visibles en un instant: dins del període de publicació
 * (`published` → `expires`, que per defecte són l'inici i la fi de la incidència).
 * Licitació 2024, PPT §2.2.1: «data per a la publicació i l'expiració de la publicació».
 */
import type { Alert } from './types.ts';

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const v = Date.parse(iso);
  return Number.isFinite(v) ? v : null;
};

/** es publica ara? (sense dates vàlides, no es mostra: millor callar que avisar d'una cosa equivocada) */
export function isPublished(a: Alert, t: number): boolean {
  const start = ms(a.published) ?? ms(a.from);
  if (start === null || t < start) return false;
  const end = a.expires !== undefined ? ms(a.expires) : ms(a.to);
  return end === null || t < end;
}

/** la incidència ja ha començat (si no, és un avís anticipat) */
export const isOngoing = (a: Alert, t: number): boolean => {
  const from = ms(a.from);
  return from !== null && t >= from;
};

export function activeAlerts(alerts: readonly Alert[], t: number): Alert[] {
  return alerts.filter((a) => isPublished(a, t));
}

/** avisos publicats que afecten una línia o alguna de les parades indicades */
export function alertsFor(alerts: readonly Alert[], t: number, q: { routes?: readonly string[]; stops?: readonly string[] }): Alert[] {
  return activeAlerts(alerts, t).filter(
    (a) => (q.routes ?? []).some((r) => a.routes.includes(r)) || (q.stops ?? []).some((s) => a.stops.includes(s)),
  );
}
