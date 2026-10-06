/**
 * TusSaeProvider — SOLO INTERFAZ. No se implementa contra nada privado.
 *
 * TODO(DECISION: TUS-SAE): cuando TUS dé acceso, necesitamos saber:
 *  - Formato: idealmente GTFS-Realtime (VehiclePositions + TripUpdates + ServiceAlerts).
 *    Si es un formato propio del SAE (p. ej. el que usa la app de GeoActio), un adaptador
 *    que lo traduzca a VehicleState es todo lo que hace falta: el resto de la app no cambia.
 *  - Frecuencia de refresco: 10–15 s es suficiente para un mapa (los paneles de parada suelen ir a 20–30 s).
 *  - Autenticación: clave de API o token en cabecera; IP fija del servidor si lo piden.
 *  - Identificadores: id de vehículo, línea (L1…F15), id de expedición o servicio y,
 *    si existe, el GTFS estático oficial para casar paradas y expediciones.
 *  - Licencia de uso y si se puede mostrar públicamente.
 *
 * Mientras tanto, el servidor usa SimulatedProvider y la web lo indica en todo momento.
 */
import type { VehicleProvider } from '@bus/core';

export interface TusSaeConfig {
  endpoint: string;
  apiKey: string;
  refreshMs: number;
}

export type TusSaeProviderFactory = (config: TusSaeConfig) => VehicleProvider;

export const tusSaeProvider: TusSaeProviderFactory = () => {
  throw new Error('TusSaeProvider no està implementat: cal l’acord i l’accés de TUS (vegeu docs/PITCH.md).');
};
