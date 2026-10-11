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

/**
 * Estat d'un vehicle. RETRASADO i DESVIADO només els pot donar un proveïdor real
 * (SAE/GTFS-RT): la simulació no s'inventa retards ni desviaments.
 */
export type VehicleStatus = 'EN_RUTA' | 'EN_PARADA' | 'EN_CABECERA' | 'RETRASADO' | 'DESVIADO' | 'RETIRADA';

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
  /** motiu de l'avís (PPT 2024 §2.2.1: «descripció i motiu») */
  reason?: { ca: string; es: string };
  /** data de publicació (ISO); per defecte, `from`. Pot ser anterior a la incidència (avís anticipat) */
  published?: string;
  /** data d'expiració de la publicació (ISO); per defecte, `to` */
  expires?: string | null;
  /** documents o imatges adjunts (enllaços públics) */
  attachments?: { title: string; url: string }[];
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
  /** hora estimada (epoch ms): la que es mostra i la que fa servir el compte enrere */
  at: number;
  /** hora programada a l'horari (epoch ms); at - scheduledAt = retard */
  scheduledAt?: number;
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
  // ---- derivats (vehicle.ts: mateixa lògica per a simulació i temps real)
  /** sentit del pattern (0 anada, 1 tornada) */
  dir: 0 | 1;
  /** capçalera d'origen i destinació del trajecte actual */
  origin: string;
  headsign: string;
  /** fracció del trajecte recorreguda (0–1), per DISTÀNCIA sobre la geometria */
  progress: number;
  /** índex de l'última parada on ha arribat o que ha passat (-1 abans de sortir) */
  prevStopIndex: number;
  /** índex de la parada on està aturat ara mateix, si n'hi ha */
  atStopIndex: number | null;
  /** metres fins a la propera parada (null si s'ha retirat) */
  distToNextM: number | null;
  /** parades que li queden per fer, inclosa la propera */
  stopsRemaining: number;
  /** retard en segons respecte de l'horari; null = sense dada real (sempre a la simulació) */
  delaySec: number | null;
}

/** Una parada del trajecte d'un bus, per a la línia temporal. */
export interface JourneyStop {
  stopId: string;
  index: number;
  /** distància sobre la geometria (m) */
  dist: number;
  /** hora de pas (epoch ms): prevista per a les futures, simulada/real per a les passades */
  at: number | null;
  /** hora programada (epoch ms) */
  scheduledAt: number | null;
  state: 'passed' | 'current' | 'next' | 'upcoming';
}

export interface Journey {
  vehicleId: string;
  patternId: string;
  stops: JourneyStop[];
  progress: number;
  /** distància total del trajecte entre la primera i l'última parada (m) */
  lengthM: number;
  /** distància recorreguda des de la primera parada (m) */
  doneM: number;
}

export interface Arrival {
  routeId: string;
  patternId: string;
  headsign: string;
  at: number; // epoch ms, estimada
  scheduledAt: number; // epoch ms, horari
  /** retard estimat en aquesta parada (s); null si no se sap */
  delaySec: number | null;
  vehicleId: string | null; // null si encara no ha sortit de capçalera
  status: 'EN_RUTA' | 'PENDENT_SORTIDA';
  source: DataSource;
}
