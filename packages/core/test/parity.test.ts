/**
 * Paritat amb l'app oficial de TUS: calendari de la F6 (festius comercials), avisos en hora de Sabadell i la ruta
 * de prova de l'app oficial (festiu 12/10/2026, 11:54, Mercat Central → C. de Fra Angelico: F4 de les 12:00).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimEngine, activeAlerts, isOngoing, localIso, planTrip, type LonLat, type NetworkData } from '../src/index.ts';

const net = JSON.parse(readFileSync(join(__dirname, '../../../apps/web/public/data/network.json'), 'utf8')) as NetworkData;
const engine = new SimEngine(net);
const at = (local: string) => Date.parse(localIso(local));

describe('F6: només els festius comercials', () => {
  it('circula el 12/10/2026 (festiu comercial) i no l’1/11 (diumenge) ni un feiner', () => {
    expect(engine.runsOnDate('F6', '2026-10-12')).toBe(true);
    expect(engine.runsOnDate('F6', '2026-11-01')).toBe(false);
    expect(engine.runsOnDate('F6', '2026-10-13')).toBe(false);
    // la resta de línies F no canvien
    expect(engine.runsOnDate('F1', '2026-11-01')).toBe(true);
  });
  it('sense F6 als busos ni a les llegades d’un diumenge no comercial', () => {
    const sun = at('2026-11-01 12:00');
    expect(engine.snapshot(sun).some((v) => v.routeId === 'F6')).toBe(false);
    expect(engine.snapshot(at('2026-10-12 12:00')).some((v) => v.routeId === 'F6')).toBe(true);
  });
  it('noms com a la llista de línies de TUS', () => {
    expect(engine.routes.get('F4')?.longName).toBe('La Roureda - El Poblenou');
    expect(engine.routes.get('F6')?.longName).toBe('Pl. Catalunya - S.P. Riu-sec (Festius Comercials)');
  });
});

describe('avisos en hora de Sabadell (encara que el servidor sigui en UTC)', () => {
  it('localIso: 9.30 h de Madrid, a l’estiu i a l’hivern', () => {
    expect(localIso('2026-10-13 09:30')).toBe('2026-10-13T09:30:00.000+02:00');
    expect(localIso('2026-03-09 09:30')).toBe('2026-03-09T09:30:00.000+01:00');
  });
  it('el 12/10 a les 11:54: 3 en vigor; el del pg. del Comerç és «proper» i comença el 13 a les 9.30', () => {
    const t = at('2026-10-12 11:54');
    const list = activeAlerts(net.alerts, t);
    expect(list.filter((a) => isOngoing(a, t)).map((a) => a.id).sort()).toEqual(['tus-2026-03-09-collsalarca-sud', 'tus-2026-09-21-c-adriana', 'tus-2026-09-28-collsalarca-nord']);
    const comerc = list.find((a) => a.id === 'tus-2026-10-13-pg-comerc')!;
    expect(isOngoing(comerc, t)).toBe(false);
    expect(isOngoing(comerc, at('2026-10-13 09:29'))).toBe(false);
    expect(isOngoing(comerc, at('2026-10-13 09:30'))).toBe(true);
    expect(activeAlerts(net.alerts, at('2026-10-13 19:00')).some((a) => a.id === comerc.id)).toBe(false);
  });
  it('L14ds és la L14 (no una línia nova)', () => {
    expect(net.alerts.find((a) => a.id === 'tus-2026-09-21-c-adriana')!.routes).toEqual(['L4', 'L44', 'L14', 'F4']);
  });
});

describe('ruta de prova de l’app oficial (Google Maps hi proposa la F4 de les 12:00)', () => {
  it('festiu 12/10/2026, 11:54, Mercat Central → C. de Fra Angelico: F4 des de Mercat Central a les 12:00', () => {
    const from: LonLat = [2.10499, 41.5476];
    const to: LonLat[] = [
      [2.09443, 41.5428],
      [2.09482, 41.54244],
    ];
    const r = planTrip(new SimEngine(net, { delays: false }), from, to, at('2026-10-12 11:54'));
    expect(r.reason).toBe('ok');
    const bus = r.itineraries[0]!.legs.find((l) => l.kind === 'bus')!;
    expect(bus.kind === 'bus' && bus.routeId).toBe('F4');
    expect(bus.kind === 'bus' && net.stops.find((s) => s.id === bus.boardStopId)?.name).toBe('Mercat Central');
    // les hores són al minut (amb una corba dins el minut): 12:00 hora de Sabadell
    expect(bus.kind === 'bus' && new Date(bus.depart).toISOString().slice(0, 16)).toBe('2026-10-12T10:00');
  });
});
