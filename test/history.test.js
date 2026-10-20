import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeReadings,
  currentOf,
  isRaining,
  rainOfTheHours,
  seriesOf,
  MAX_READINGS,
} from '../src/history.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-10-20T12:00:00Z');
const reading = (at, values) => ({ at, values });

test('the readings kept: 26 hours, 200 at most, a newer copy of a time wins', () => {
  const old = [
    reading(NOW - 27 * HOUR, { temperature: 1 }),
    reading(NOW - HOUR, { temperature: 2 }),
  ];
  const merged = mergeReadings(
    old,
    [reading(NOW - HOUR, { temperature: 3 }), reading(NOW, { temperature: 4 })],
    NOW,
  );
  assert.deepEqual(
    merged.map((r) => r.values.temperature),
    [3, 4],
  );
  const many = Array.from({ length: 300 }, (_, i) =>
    reading(NOW - i * 5 * MINUTE, { temperature: i }),
  );
  assert.equal(mergeReadings([], many.reverse(), NOW).length, MAX_READINGS);
  assert.deepEqual(mergeReadings(null, [{ at: 'x' }], NOW), []);
});

test('now: the latest reading, a missing value from the previous hour only', () => {
  const readings = [
    reading(NOW - 90 * MINUTE, { wind_gust: 50, temperature: 9 }),
    reading(NOW - 30 * MINUTE, { wind_gust: 30, temperature: 10 }),
    reading(NOW, { temperature: 11 }),
  ];
  assert.deepEqual(currentOf(readings), { at: NOW, values: { temperature: 11, wind_gust: 30 } });
  assert.equal(currentOf([]), null);
});

test('the rain of the day: the column, else the full hours since 00:00 UTC', () => {
  const day = Date.parse('2026-10-20T00:00:00Z');
  const hours = Array.from({ length: 13 }, (_, h) =>
    reading(day + h * HOUR, { rain_1h: h === 7 ? 1.2 : 0 }),
  );
  assert.equal(rainOfTheHours(hours, NOW), 1.2);
  assert.equal(currentOf(hours).values.rain_today, 1.2);
  const gap = hours.filter((r) => r.at !== day + 3 * HOUR);
  assert.equal(rainOfTheHours(gap, NOW), null);
  assert.equal(currentOf(gap).values.rain_today, undefined, 'unknown, never a guess');
  // The column wins; yesterday's value never counts for today.
  const column = [
    reading(day - 10 * MINUTE, { rain_today: 8 }),
    reading(day + 10 * MINUTE, { rain_1h: 0 }),
  ];
  assert.equal(currentOf(column).values.rain_today, 0);
  assert.equal(currentOf([reading(NOW, { rain_today: 3.4, rain_1h: 0 })]).values.rain_today, 3.4);
});

test('raining: the rain of the last hour above 0; unknown without it', () => {
  assert.equal(isRaining({ values: { rain_1h: 0.2 } }), true);
  assert.equal(isRaining({ values: { rain_1h: 0 } }), false);
  assert.equal(isRaining({ values: {} }), null);
  assert.equal(isRaining(null), null);
});

test('the series of a measure over the last 24 hours', () => {
  const readings = [
    reading(NOW - 25 * HOUR, { temperature: 1 }),
    reading(NOW - HOUR, { temperature: 2 }),
    reading(NOW, {}),
  ];
  assert.deepEqual(seriesOf(readings, 'temperature', NOW), [{ at: NOW - HOUR, value: 2 }]);
});
