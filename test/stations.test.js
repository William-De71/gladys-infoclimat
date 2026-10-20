// The public list of the stations: an extract of the real one, read on
// 2026-10-20 at 11:57 UTC (test/fixtures/stations_xhr.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStationList,
  nearestStation,
  findStation,
  haversineKm,
  readUtc,
  licenseOf,
} from '../src/stations.js';
import { fixture, NOW, BESANCON } from './helpers/fake-api.js';

const list = parseStationList(fixture('stations_xhr.json'));

test('the real list is read: ids, names, positions, licenses, last activity in UTC', () => {
  assert.equal(list.length, 13);
  assert.deepEqual(findStation(list, '000c7'), {
    id: '000C7',
    name: 'Chenecey-Buillon',
    department: '25',
    country: 'FR',
    latitude: 47.14,
    longitude: 5.96,
    altitude: 280,
    license: 'cc-by-nc',
    genre: 'static',
    lastActivity: Date.parse('2026-10-20T11:50:00Z'),
  });
  assert.equal(findStation(list, 'VENTOUX').lastActivity, null, '0000-00-00 is never');
  assert.equal(findStation(list, 'VENTOUX').license, 'etalab');
  assert.equal(findStation(list, 'STATIC0095').name, "Ile-d'Arz");
  assert.deepEqual(parseStationList({}), []);
  assert.deepEqual(parseStationList([{ id: 'x y', latitude: 1, longitude: 2 }, { id: 'A1' }]), []);
});

test('the nearest station that reported in the last 24 hours', () => {
  // Besançon (000P2) is at 1 km but silent since 2026-10-19 07:10 UTC.
  const nearest = nearestStation(list, BESANCON, NOW);
  assert.equal(nearest.station.id, '000C7');
  assert.equal(Math.round(nearest.distanceKm), 12);
  // The evening before, the station of Besançon still counted.
  assert.equal(
    nearestStation(list, BESANCON, Date.parse('2026-10-19T20:00:00Z')).station.id,
    '000P2',
  );
  assert.equal(
    nearestStation(list, BESANCON, NOW, { exclude: ['000C7'] }).station.id,
    'STATIC0495',
  );
  assert.equal(nearestStation([], BESANCON, NOW), null);
});

test('helpers: haversine, UTC dates, licenses', () => {
  assert.equal(Math.round(haversineKm(48.8566, 2.3522, 45.764, 4.8357)), 391);
  assert.equal(readUtc('2026-10-20 11:50:00'), Date.parse('2026-10-20T11:50:00Z'));
  assert.equal(readUtc('0000-00-00 00:00:00'), null);
  assert.equal(readUtc(null), null);
  assert.deepEqual(licenseOf(2), { code: 'cc-by-nc', name: 'CC BY-NC' });
  assert.equal(licenseOf(7), null);
});
