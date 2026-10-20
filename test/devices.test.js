// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): should_poll with poll_frequency, min /
// max / read_only / has_feedback on every feature, category / type pairs
// known to the front, and a single invalid field rejecting the whole
// discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';

import {
  idsOf,
  keyOfExternalId,
  stationKey,
  buildStationDevice,
  buildStationStates,
} from '../src/device.js';
import { MEASURES, FEATURE_KEYS } from '../src/measures.js';
import { LANGUAGES } from '../src/i18n.js';

const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:infoclimat:${type}:${id}`,
    feature: (key) => `ext:infoclimat:${type}:${id}:${key}`,
  }),
};
const FULL = {
  id: '000C7',
  name: 'Chenecey-Buillon',
  params: [...FEATURE_KEYS, 'radiation'],
  license: 'cc-by-nc',
};
const SMALL = {
  id: 'STATIC0495',
  name: 'Évillers',
  params: ['temperature', 'humidity'],
  license: null,
};

// The pairs the Gladys front knows (front/src/config/i18n deviceFeatureCategory,
// server DEVICE_FEATURE_UNITS_BY_CATEGORY).
const PAIRS = {
  temperature: [C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS],
  humidity: [C.HUMIDITY_SENSOR, T.SENSOR.DECIMAL, U.PERCENT],
  pressure: [C.PRESSURE_SENSOR, T.SENSOR.DECIMAL, U.HECTO_PASCAL],
  dew_point: [C.TEMPERATURE_SENSOR, T.TEMPERATURE_SENSOR.PROBE, U.CELSIUS],
  wind_speed: [C.SPEED_SENSOR, T.SPEED_SENSOR.DECIMAL, U.KILOMETER_PER_HOUR],
  wind_gust: [C.SPEED_SENSOR, T.SPEED_SENSOR.DECIMAL, U.KILOMETER_PER_HOUR],
  wind_direction: [C.ANGLE_SENSOR, T.SENSOR.INTEGER, U.DEGREE],
  rain_1h: [C.PRECIPITATION_SENSOR, T.PRECIPITATION_SENSOR.DECIMAL, U.MILLIMETER_PER_HOUR],
  rain_today: [C.PRECIPITATION_SENSOR, T.PRECIPITATION_SENSOR.DECIMAL, U.MILLIMETER_PER_DAY],
  snow_depth: [C.DISTANCE_SENSOR, T.SENSOR.DECIMAL, U.CM],
  visibility: [C.DISTANCE_SENSOR, T.SENSOR.DECIMAL, U.M],
};

test('devices are never polled by Gladys: the integration has its own timer', () => {
  const device = buildStationDevice(fakeGladys, FULL);
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const station of [FULL, SMALL]) {
      const device = buildStationDevice(fakeGladys, station, language);
      for (const feature of device.features) {
        assert.equal(typeof feature.min, 'number', feature.external_id);
        assert.equal(typeof feature.max, 'number', feature.external_id);
        assert.ok(feature.min < feature.max);
        assert.equal(feature.read_only, true);
        assert.equal(feature.has_feedback, false);
      }
      assert.equal(
        new Set(device.features.map((f) => f.name)).size,
        device.features.length,
        'distinct names',
      );
    }
  }
});

test('category / type / unit pairs known to the Gladys front; radiation is never a feature', () => {
  const device = buildStationDevice(fakeGladys, FULL);
  assert.deepEqual(
    device.features.map((feature) => feature.external_id.split(':').pop()),
    Object.keys(PAIRS),
  );
  for (const feature of device.features) {
    const key = feature.external_id.split(':').pop();
    assert.deepEqual([feature.category, feature.type, feature.unit], PAIRS[key], key);
  }
  assert.equal(MEASURES.find((measure) => measure.key === 'radiation').feature, null);
});

test('only the measures the station gives, in a stable order', () => {
  const device = buildStationDevice(
    fakeGladys,
    { ...SMALL, params: ['humidity', 'temperature', 'radiation'] },
    'fr',
  );
  assert.deepEqual(
    device.features.map((feature) => [feature.external_id, feature.name]),
    [
      ['ext:infoclimat:station:static0495:temperature', 'Température'],
      ['ext:infoclimat:station:static0495:humidity', 'Humidité'],
    ],
  );
  assert.equal(device.name, 'Infoclimat Évillers');
  assert.deepEqual(device.params, [{ name: 'INFOCLIMAT_STATION_ID', value: 'STATIC0495' }]);
});

test('ids from the station identifier', () => {
  assert.equal(stationKey('000P2'), '000p2');
  assert.equal(keyOfExternalId('ext:infoclimat:station:000c7:rain_today'), '000c7');
  assert.equal(keyOfExternalId('ext:infoclimat:station:static0495'), 'static0495');
  assert.equal(keyOfExternalId('nothing'), null);
});

test('states: rounded, a missing value left untouched', () => {
  const states = buildStationStates(fakeGladys, SMALL, {
    at: 0,
    values: { temperature: 12.54, wind_speed: 3 },
  });
  assert.deepEqual(states, [
    { device_feature_external_id: 'ext:infoclimat:station:static0495:temperature', state: 12.5 },
  ]);
  assert.deepEqual(buildStationStates(fakeGladys, SMALL, null), []);
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildStationDevice(gladys, FULL, language),
      buildStationDevice(gladys, SMALL, language),
    ]);
  }
  await gladys.fake.deviceCreated(gladys.fake.discoveredDevices[0]);
  const values = Object.fromEntries(FEATURE_KEYS.map((key, index) => [key, index + 1]));
  await gladys.publishStates(buildStationStates(gladys, FULL, { at: 0, values }));
  assert.equal(gladys.fake.lastState(idsOf(gladys, '000C7').feature('pressure')), 3);
});
