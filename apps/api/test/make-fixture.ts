/**
 * Genera test/fixtures/vehicle-positions.pb y trip-updates.pb: un feed GTFS-RT
 * sintético con 2 buses de la L1 (un trip_id del nostre GTFS i un només amb route_id)
 * i un vehicle fora de recorregut (s'ha d'ignorar). Executar: npx tsx test/make-fixture.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { pointAlong, type NetworkData } from '@bus/core';

const { transit_realtime: rt } = GtfsRealtimeBindings;
const net = JSON.parse(readFileSync(new URL('../../web/public/data/network.json', import.meta.url), 'utf8')) as NetworkData;
const p = net.patterns.filter((x) => x.routeId === 'L1' && x.dayType === 'feiner').sort((a, b) => b.trips.length - a.trips.length)[0]!;
const at = (d: number) => pointAlong(p.coords, p.cum, d);
const T = 1791350000; // 2026-10-07T07:13:20Z
const [lon1, lat1] = at(p.stopDist[5]! + 40);
const [lon2, lat2] = at(p.stopDist[12]!);
const vp = rt.FeedMessage.fromObject({
  header: { gtfsRealtimeVersion: '2.0', incrementality: 0, timestamp: T },
  entity: [
    { id: 'e1', vehicle: { trip: { tripId: `${p.id}_FEINERS_0815`, routeId: 'L1' }, vehicle: { id: '1023', label: '1023' }, position: { latitude: lat1, longitude: lon1, bearing: 120, speed: 6 }, timestamp: T, currentStatus: 2 } },
    { id: 'e2', vehicle: { trip: { routeId: 'L1' }, vehicle: { id: '1044', label: '1044' }, position: { latitude: lat2, longitude: lon2 }, timestamp: T, currentStatus: 1 } },
    { id: 'e3', vehicle: { trip: { routeId: 'L1' }, vehicle: { id: '9999' }, position: { latitude: 41.7, longitude: 2.3 }, timestamp: T } },
  ],
});
const tu = rt.FeedMessage.fromObject({
  header: { gtfsRealtimeVersion: '2.0', incrementality: 0, timestamp: T },
  entity: [{ id: 't1', tripUpdate: { trip: { tripId: `${p.id}_FEINERS_0815` }, stopTimeUpdate: [{ stopId: p.stopIds[6], arrival: { time: T + 60 } }, { stopId: p.stopIds[7], arrival: { time: T + 150 } }] } }],
});
writeFileSync(new URL('./fixtures/vehicle-positions.pb', import.meta.url), rt.FeedMessage.encode(vp).finish());
writeFileSync(new URL('./fixtures/trip-updates.pb', import.meta.url), rt.FeedMessage.encode(tu).finish());
console.log('fixtures ok', p.id);
