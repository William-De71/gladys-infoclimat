// -----------------------------------------------------------------------------
// The readings of a station kept in /data: the last 26 hours, 200 readings at
// most (a station reports every 10 or 15 minutes). Enough for the 24-hour
// chart and for the rain of the day, never more.
//
// "Now" at a station is its latest reading; a value missing from it (a gust
// is often null) is taken from a reading of the previous hour, never older.
// The rain of the day is the column `pluie_cumul_0h` when the station gives
// it, otherwise the sum of `pluie_1h` at the full hours since 00:00 UTC, when
// none of them is missing (the hour 00:00 itself belongs to the day before).
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const KEEP_MS = 26 * HOUR_MS;
const MAX_READINGS = 200;
const CURRENT_WINDOW_MS = HOUR_MS;
const CHART_MS = 24 * HOUR_MS;
// No reading for this long: the station is silent.
const SILENT_AFTER_MS = 90 * MINUTE_MS;

/**
 * @description Merge new readings into the kept ones.
 * @param {object[]} kept - `[{ at, values }]`, sorted.
 * @param {object[]} readings - The new ones, sorted.
 * @param {number} now - Now (ms).
 * @returns {object[]} The readings to keep, sorted, a newer copy of a time winning.
 */
function mergeReadings(kept, readings, now) {
  const byTime = new Map();
  for (const reading of [...(Array.isArray(kept) ? kept : []), ...readings]) {
    if (Number.isFinite(reading?.at) && reading.values && typeof reading.values === 'object') {
      byTime.set(reading.at, { at: reading.at, values: { ...reading.values } });
    }
  }
  return [...byTime.values()]
    .filter((reading) => reading.at > now - KEEP_MS && reading.at <= now + 15 * MINUTE_MS)
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_READINGS);
}

/**
 * @description The rain since 00:00 UTC summed from the full hours.
 * @param {object[]} readings - The kept readings, sorted.
 * @param {number} lastAt - The time of the latest reading.
 * @returns {number|null} Millimetres, null when an hour is missing.
 */
function rainOfTheHours(readings, lastAt) {
  const midnight = Math.floor(lastAt / DAY_MS) * DAY_MS;
  const hours = Math.floor((lastAt - midnight) / HOUR_MS);
  let total = 0;
  for (let hour = 1; hour <= hours; hour += 1) {
    const reading = readings.find((candidate) => candidate.at === midnight + hour * HOUR_MS);
    const value = reading?.values.rain_1h;
    if (!Number.isFinite(value)) {
      return null;
    }
    total += value;
  }
  return Math.round(total * 10) / 10;
}

/**
 * @description The values of a station now.
 * @param {object[]} readings - The kept readings, sorted.
 * @returns {{ at: number, values: object }|null} The time of the latest reading and the values.
 */
function currentOf(readings) {
  if (!Array.isArray(readings) || readings.length === 0) {
    return null;
  }
  const last = readings[readings.length - 1];
  const values = {};
  for (let index = readings.length - 1; index >= 0; index -= 1) {
    const reading = readings[index];
    if (last.at - reading.at > CURRENT_WINDOW_MS) {
      break;
    }
    const sameDay = Math.floor(reading.at / DAY_MS) === Math.floor(last.at / DAY_MS);
    for (const [key, value] of Object.entries(reading.values)) {
      // The rain of the day restarts at 00:00 UTC: never yesterday's.
      if (key !== 'rain_today' || sameDay) {
        values[key] ??= value;
      }
    }
  }
  if (!Number.isFinite(values.rain_today) && Number.isFinite(values.rain_1h)) {
    const summed = rainOfTheHours(readings, last.at);
    if (summed !== null) {
      values.rain_today = summed;
    }
  }
  return { at: last.at, values };
}

/**
 * @description Whether it rains at a station.
 * @param {object|null} current - `currentOf()`.
 * @returns {boolean|null} Null when the station gives no rain of the last hour.
 */
function isRaining(current) {
  const value = current?.values.rain_1h;
  return Number.isFinite(value) ? value > 0 : null;
}

/**
 * @description The points of a measure over the last 24 hours.
 * @param {object[]} readings - The kept readings, sorted.
 * @param {string} key - The measure.
 * @param {number} now - Now (ms).
 * @returns {Array<{ at: number, value: number }>} The points.
 */
function seriesOf(readings, key, now) {
  return (readings ?? [])
    .filter((reading) => reading.at >= now - CHART_MS && Number.isFinite(reading.values[key]))
    .map((reading) => ({ at: reading.at, value: reading.values[key] }));
}

export {
  MINUTE_MS,
  HOUR_MS,
  KEEP_MS,
  MAX_READINGS,
  CHART_MS,
  SILENT_AFTER_MS,
  mergeReadings,
  rainOfTheHours,
  currentOf,
  isRaining,
  seriesOf,
};
