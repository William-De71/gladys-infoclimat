import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTransitions,
  stationData,
  summaryOf,
  weatherOutputs,
  WEATHER_OUTPUTS,
  TRIGGERS,
} from '../src/events.js';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const MINUTE = 60 * 1000;
const at = (minutes, values = {}) => ({ at: NOW - minutes * MINUTE, values });

test('transitions: a baseline first, then one event per change', () => {
  const first = detectTransitions({}, at(0, { rain_1h: 0.4 }), NOW);
  assert.deepEqual(first, { events: [], next: { raining: true, silent: false } });
  assert.deepEqual(detectTransitions(first.next, at(0, { rain_1h: 0 }), NOW).events, [
    TRIGGERS.RAIN_STOPPED,
  ]);
  assert.deepEqual(
    detectTransitions({ raining: false, silent: false }, at(0, { rain_1h: 0.2 }), NOW).events,
    [TRIGGERS.RAIN_STARTED],
  );
  const silent = detectTransitions({ raining: true, silent: false }, at(91, { rain_1h: 0 }), NOW);
  assert.deepEqual(silent, {
    events: [TRIGGERS.STATION_SILENT],
    next: { raining: true, silent: true },
  });
  assert.deepEqual(detectTransitions(silent.next, null, NOW).events, []);
  assert.deepEqual(detectTransitions(silent.next, at(5, { rain_1h: 0.2 }), NOW).events, [
    TRIGGERS.STATION_BACK,
  ]);
  assert.deepEqual(
    detectTransitions({ raining: true, silent: true }, at(5, { rain_1h: 0 }), NOW).events,
    [TRIGGERS.STATION_BACK, TRIGGERS.RAIN_STOPPED],
  );
  assert.deepEqual(
    detectTransitions({ raining: false, silent: false }, at(0, {}), NOW).events,
    [],
    'no rain column',
  );
});

test('event data: flat, scalar, bounded', () => {
  const data = stationData(
    { deviceId: 'ext:x:station:a', name: 'A' },
    at(12, { temperature: 12.54, rain_1h: 0.2 }),
    NOW,
  );
  assert.deepEqual(data, {
    station: 'ext:x:station:a',
    station_name: 'A',
    temperature: 12.5,
    rain_1h: 0.2,
    rain_today: null,
    observed_at: '2026-10-20T11:48:00.000Z',
    minutes_ago: 12,
  });
});

test('the sentence and the outputs of the scene action', () => {
  const current = at(5, {
    temperature: 12.54,
    humidity: 81,
    wind_speed: 14,
    wind_direction: 225,
    wind_gust: 31,
    rain_today: 1.8,
  });
  const time = () => '13:55';
  assert.equal(
    summaryOf({ name: 'Besançon' }, current, 'fr', time),
    'Besançon, 13:55 : 12,5 °C, humidité 81 %, vent 14 km/h SO, rafales 31 km/h, pluie du jour 1,8 mm.',
  );
  assert.equal(summaryOf({ name: 'X' }, null, 'en', time), 'X: no recent reading.');
  const outputs = weatherOutputs({ name: 'Besançon' }, current, {
    language: 'de',
    now: NOW,
    formatTime: time,
  });
  assert.deepEqual(Object.keys(outputs), WEATHER_OUTPUTS);
  assert.equal(outputs.wind_direction_name, 'SW');
  assert.equal(outputs.minutes_ago, 5);
  assert.equal(outputs.pressure, null);
  const none = weatherOutputs({ name: 'X' }, null, { language: 'en', now: NOW, formatTime: time });
  assert.equal(none.temperature, null);
  assert.equal(none.wind_direction_name, null);
});
