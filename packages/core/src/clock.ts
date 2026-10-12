/**
 * Rellotge de l'app i hora forçada de demostració, SENSE luxon: és l'únic codi del nucli que necessita la portada
 * (landing) i així no descarrega la llibreria de dates (~70 KB). El càlcul en Europe/Madrid es fa amb Intl.
 * El resultat és idèntic al de la implementació amb luxon (test/clock.test.ts ho comprova).
 */
const TZ = 'Europe/Madrid';
const FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** parts del rellotge de paret de Madrid d'un instant */
function wall(t: number) {
  const p = Object.fromEntries(FMT.formatToParts(t).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, s: +p.second!, wd: WD.indexOf(p.weekday!) + 1 };
}

/** desplaçament (minuts) de Madrid en un instant */
function offsetAt(t: number): number {
  const w = wall(t);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - (t - (((t % 1000) + 1000) % 1000))) / 60000);
}

/**
 * Hora de paret → instant, amb el mateix algorisme que luxon (objToTS): parteix del desplaçament `o` que ja tenia
 * la data i el corregeix; en una hora que no existeix (canvi d'hora) avança, i en una de repetida es queda amb `o`.
 */
function toTs(y: number, m: number, d: number, h: number, mi: number, s: number, ms: number, o: number): [number, number] {
  const local = Date.UTC(y, m - 1, d, h, mi, s, ms);
  let guess = local - o * 60000;
  const o2 = offsetAt(guess);
  if (o === o2) return [guess, o];
  guess -= (o2 - o) * 60000;
  const o3 = offsetAt(guess);
  if (o2 === o3) return [guess, o2];
  return [local - Math.min(o2, o3) * 60000, Math.max(o2, o3)];
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
  let ts = from;
  let o = offsetAt(from);
  if (dia) {
    const wd = WEEKDAYS[dia.toLowerCase()];
    const w = wall(ts);
    if (wd) {
      const n = new Date(Date.UTC(w.y, w.m - 1, w.d + ((wd - w.wd + 7) % 7)));
      [ts, o] = toTs(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), w.h, w.mi, w.s, ((ts % 1000) + 1000) % 1000, o);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      const [y, mo, d] = dia.split('-').map(Number) as [number, number, number];
      // la mitjanit d'una data mai és ambigua: el desplaçament és el d'aquella mitjanit
      const [mid] = toTs(y, mo, d, 0, 0, 0, 0, offsetAt(Date.UTC(y, mo - 1, d, 12)));
      [ts, o] = toTs(y, mo, d, w.h, w.mi, 0, 0, offsetAt(mid));
    }
  }
  if (hora) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
    if (m) {
      const w = wall(ts);
      [ts, o] = toTs(w.y, w.m, w.d, Number(m[1]), Number(m[2]), 0, 0, o);
    }
  }
  return ts;
}
