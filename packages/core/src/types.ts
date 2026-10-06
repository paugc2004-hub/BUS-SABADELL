/**
 * Modelo canónico. Lo genera el pipeline (packages/data-pipeline) y lo consumen
 * el motor de simulación, el backend y el frontend.
 *
 * Frontera de honestidad: todo lo que viene de `network.json` es dato publicado
 * (tus.es / OSM). Las posiciones de los vehículos NO: las calcula el motor.
 */

/** Tipo de día de servicio de TUS. */
export type DayType = 'feiner' | 'dissabte' | 'festiu';

/** De dónde sale la posición de un vehículo. */
export type DataSource = 'SIMULATED' | 'SCHEDULED' | 'REALTIME';

export type VehicleStatus = 'EN_RUTA' | 'EN_PARADA' | 'EN_CABECERA' | 'RETIRADA' | 'DESVIAT';

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  license: string;
  fetched: string;
  note?: string;
}

export interface Route {
  id: string; // "L1", "F3"
  ref: string;
  longName: string;
  color: string; // #rrggbb
  textColor: string;
  /** feiner = línia diürna de feiners i dissabtes; festiu = línies F */
  kind: 'diurna' | 'festiva';
  order: number;
  agency: 'TUS';
}

export interface Stop {
  id: string; // id de parada de TUS (estable)
  name: string;
  lat: number;
  lon: number;
  routes: string[];
}

export interface Pattern {
  id: string;
  routeId: string;
  /** 0 = sentit "anada" segons TUS, 1 = tornada */
  dir: 0 | 1;
  name: string;
  origin: string;
  headsign: string;
  dayType: DayType;
  circular: boolean;
  stopIds: string[];
  /** distància acumulada (m) de cada parada sobre la geometria; estrictament creixent */
  stopDist: number[];
  /** geometria simplificada [lon, lat] */
  coords: [number, number][];
  /** distància acumulada (m) de cada vèrtex de coords */
  cum: number[];
  length: number;
  /** perfils de temps: offsets (s) d'arribada a cada parada des de la sortida */
  profiles: number[][];
  /** expedicions: [sortida (s des de l'inici del dia de servei), índex de perfil] */
  trips: [number, number][];
}

export interface Alert {
  id: string;
  routes: string[];
  stops: string[];
  from: string; // ISO
  to: string | null;
  text: { ca: string; es: string };
  url?: string;
}

export interface NetworkData {
  version: string;
  builtAt: string;
  timezone: 'Europe/Madrid';
  sources: SourceInfo[];
  routes: Route[];
  stops: Stop[];
  patterns: Pattern[];
  /** festius oficials (YYYY-MM-DD) en què circulen les línies F */
  holidays: { date: string; name: string; scope: 'estatal' | 'catalunya' | 'local' }[];
  /** avisos coneguts (data/config/avisos.yaml) */
  alerts: Alert[];
  /** anys per als quals encara falten els festius locals verificats */
  holidaysPending: string[];
}

export interface StopEta {
  stopId: string;
  /** epoch ms */
  at: number;
}

export interface VehicleState {
  id: string; // "L1-03"
  label: string; // número de torn visible, p. ex. "103"
  routeId: string;
  patternId: string;
  tripKey: string;
  status: VehicleStatus;
  source: DataSource;
  /** distància recorreguda sobre el pattern (m) */
  dist: number;
  lon: number;
  lat: number;
  bearing: number;
  speedKmh: number;
  /** índex dins pattern.stopIds de la propera parada */
  nextStopIndex: number;
  nextStopId: string | null;
  /** ETAs a les parades que queden (inclosa la propera) */
  etas: StopEta[];
  /** epoch ms de sortida de l'expedició actual */
  departure: number;
  /** és l'última expedició del torn: després es retira */
  lastTrip: boolean;
  timestamp: number;
}

export interface Arrival {
  routeId: string;
  patternId: string;
  headsign: string;
  at: number; // epoch ms
  vehicleId: string | null; // null si encara no ha sortit de capçalera
  status: 'EN_RUTA' | 'PENDENT_SORTIDA';
  source: DataSource;
}
