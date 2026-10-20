// The observations, on the shape of a real answer (test/fixtures/observations_example.json).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseObservations, readValue, matchKeys, measuresOfParams } from '../src/parse.js';
import { fixture, clone } from './helpers/fake-api.js';

const example = fixture('observations_example.json');

test('strings to numbers, null left out, readings sorted, metadata of the station', () => {
  const result = parseObservations(example, [{ id: 'STATIC0095' }]);
  const station = result.get('STATIC0095');
  assert.equal(station.key, 'STATIC0095');
  assert.equal(station.readings.length, 3);
  assert.deepEqual(station.readings[0], {
    at: Date.parse('2024-10-13T00:00:00Z'),
    values: {
      temperature: 14.3,
      humidity: 89,
      pressure: 1013.8,
      dew_point: 12.8,
      wind_speed: 3.2,
      wind_direction: 34,
    },
  });
  assert.equal(station.readings[2].values.rain_1h, 0.2);
  assert.equal(station.readings[1].values.wind_gust, 11.3);
  assert.deepEqual(station.params, [
    'temperature',
    'humidity',
    'pressure',
    'dew_point',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_1h',
  ]);
  assert.deepEqual(station.meta, {
    name: "Ile-d'Arz",
    latitude: 47.589,
    longitude: -2.804,
    elevation: 15,
    licenseText: 'NON-COMMERCIAL ONLY: CC BY NC',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc/2.0/fr/',
  });
});

test('a measure absent from _params or always null is not a measure of the station', () => {
  const answer = clone(example);
  answer.hourly._params = answer.hourly._params.filter((name) => name !== 'pluie_1h');
  assert.ok(
    !parseObservations(answer, [{ id: 'STATIC0095' }])
      .get('STATIC0095')
      .params.includes('rain_1h'),
  );
  delete answer.hourly._params;
  answer.hourly.STATIC0095.forEach((row) => (row.vent_rafales = null));
  const params = parseObservations(answer, [{ id: 'STATIC0095' }]).get('STATIC0095').params;
  assert.ok(!params.includes('wind_gust'));
  assert.ok(params.includes('rain_1h'), 'without _params, the values decide');
});

test('values out of their bounds are sensor faults, never published', () => {
  assert.equal(readValue('14.3', 'temperature'), 14.3);
  assert.equal(readValue('14,3', 'temperature'), 14.3);
  assert.equal(readValue('-999', 'temperature'), null);
  assert.equal(readValue('101', 'humidity'), null);
  assert.equal(readValue('', 'pressure'), null);
  assert.equal(readValue('abc', 'pressure'), null);
  assert.equal(readValue(null, 'pressure'), null);
});

test('a requested id written differently: by the rows, by the position, alone', () => {
  const hourly = { STATIC0095: example.hourly.STATIC0095, _params: [] };
  const entries = example.stations;
  // The list says "00095"? The rows say STATIC0095.
  assert.deepEqual(
    [...matchKeys([{ id: 'static0095' }], hourly, entries)],
    [['static0095', 'STATIC0095']],
  );
  const renamed = { X1: example.hourly.STATIC0095.map((row) => ({ ...row, id_station: 'X1' })) };
  assert.deepEqual(
    [
      ...matchKeys([{ id: '00095', latitude: 47.59, longitude: -2.8 }], renamed, [
        { ...entries[0], id: 'X1' },
      ]),
    ],
    [['00095', 'X1']],
  );
  assert.deepEqual(
    [...matchKeys([{ id: '00095' }], renamed, [])],
    [['00095', 'X1']],
    'one asked, one answered',
  );
  assert.deepEqual(
    [...matchKeys([{ id: 'A' }, { id: 'B' }], renamed, [])],
    [],
    'two asked: no guess',
  );
  assert.equal(parseObservations({ hourly: {} }, [{ id: 'A' }]).size, 0);
  assert.equal(parseObservations(null, [{ id: 'A' }]).size, 0);
});

test('the columns of _params map to the measures', () => {
  assert.deepEqual(
    [...measuresOfParams(['temperature', 'vent_rafales_10min', 'pluie_cumul_0h', 'nebulosite'])],
    ['temperature', 'wind_gust', 'rain_today'],
  );
  assert.equal(measuresOfParams(undefined), null);
});
