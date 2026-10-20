// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `rain_started`    the rain of the last hour at a station goes above 0;
//   - `rain_stopped`    it falls back to 0 (so up to an hour after the last
//                       drop: the column is the rain of the past 60 minutes);
//   - `station_silent`  a station gave no reading for 90 minutes;
//   - `station_back`    a silent station reports again;
//   - `key_refused`     Infoclimat refuses the key (once, until it works again).
// The rain needs a station that gives `pluie_1h`. The first reading of a
// station is a baseline: nothing fires for what was already true. What the
// triggers know lives in /data: a restart never fires twice. A scene action
// or a widget never fires an event.
// -----------------------------------------------------------------------------

import { isRaining, SILENT_AFTER_MS } from './history.js';
import { compassPoint, formatNumber, t } from './i18n.js';
import { round } from './measures.js';

const TRIGGERS = {
  RAIN_STARTED: 'rain_started',
  RAIN_STOPPED: 'rain_stopped',
  STATION_SILENT: 'station_silent',
  STATION_BACK: 'station_back',
  KEY_REFUSED: 'key_refused',
};
const SCENE_ACTIONS = { GET_WEATHER: 'get_weather' };
const WEATHER_OUTPUTS = [
  'temperature',
  'humidity',
  'pressure',
  'dew_point',
  'wind_speed',
  'wind_gust',
  'wind_direction',
  'wind_direction_name',
  'rain_1h',
  'rain_today',
  'radiation',
  'station_name',
  'observed_at',
  'minutes_ago',
  'summary',
];

/**
 * @description The transitions of a station after a reading.
 * @param {object} seen - `{ raining, silent }` of the station (undefined at first).
 * @param {object|null} current - `{ at, values }` (history.currentOf).
 * @param {number} now - Now (ms).
 * @returns {{ events: string[], next: { raining: boolean|null, silent: boolean } }}
 * The triggers to fire, and what to remember.
 */
function detectTransitions(seen = {}, current, now) {
  const events = [];
  const silent = !current || now - current.at > SILENT_AFTER_MS;
  const raining = silent ? (seen.raining ?? null) : isRaining(current);
  if (seen.silent === false && silent) {
    events.push(TRIGGERS.STATION_SILENT);
  }
  if (seen.silent === true && !silent) {
    events.push(TRIGGERS.STATION_BACK);
  }
  if (!silent && typeof seen.raining === 'boolean' && typeof raining === 'boolean') {
    if (!seen.raining && raining) {
      events.push(TRIGGERS.RAIN_STARTED);
    }
    if (seen.raining && !raining) {
      events.push(TRIGGERS.RAIN_STOPPED);
    }
  }
  return { events, next: { raining, silent } };
}

/**
 * @description A value as scenes get it: rounded, or null.
 * @param {object|null} current - `{ values }`.
 * @param {string} key - The measure.
 * @returns {number|null} The value.
 */
const valueOf = (current, key) =>
  Number.isFinite(current?.values[key]) ? round(key, current.values[key]) : null;

/**
 * @description The data of an event of a station.
 * @param {object} station - `{ deviceId, name }`.
 * @param {object|null} current - `{ at, values }`.
 * @param {number} now - Now (ms).
 * @returns {object} The flat payload.
 */
function stationData(station, current, now) {
  return {
    station: station.deviceId,
    station_name: station.name,
    temperature: valueOf(current, 'temperature'),
    rain_1h: valueOf(current, 'rain_1h'),
    rain_today: valueOf(current, 'rain_today'),
    observed_at: current ? new Date(current.at).toISOString() : null,
    minutes_ago: current ? Math.max(0, Math.round((now - current.at) / 60000)) : null,
  };
}

/**
 * @description The sentence of a reading, ready for a message.
 * @param {object} station - `{ name }`.
 * @param {object|null} current - `{ at, values }`.
 * @param {string} language - The language.
 * @param {Function} formatTime - `(instant) => "13:50"`.
 * @returns {string} "Besançon, 13:50: 12.5 °C, humidity 81 %, wind 14 km/h SW…".
 */
function summaryOf(station, current, language, formatTime) {
  if (!current) {
    return t('summaryNoReading', language, { name: station.name });
  }
  const value = (key) => {
    const raw = valueOf(current, key);
    return raw === null ? null : formatNumber(raw, language);
  };
  const parts = [];
  if (value('temperature') !== null) {
    parts.push(t('summaryTemperature', language, { value: value('temperature') }));
  }
  if (value('humidity') !== null) {
    parts.push(t('summaryHumidity', language, { value: value('humidity') }));
  }
  if (value('wind_speed') !== null) {
    parts.push(
      t('summaryWind', language, {
        value: value('wind_speed'),
        direction: compassPoint(current.values.wind_direction, language),
      }).trim(),
    );
  }
  if (value('wind_gust') !== null) {
    parts.push(t('summaryGust', language, { value: value('wind_gust') }));
  }
  if (value('pressure') !== null) {
    parts.push(t('summaryPressure', language, { value: value('pressure') }));
  }
  if (value('rain_today') !== null) {
    parts.push(t('summaryRain', language, { value: value('rain_today') }));
  }
  return `${t('summaryHead', language, { name: station.name, time: formatTime(current.at) })} ${parts.join(', ')}.`;
}

/**
 * @description The outputs of the "read the weather of a station" action.
 * @param {object} station - `{ name }`.
 * @param {object|null} current - `{ at, values }`.
 * @param {object} options - `{ language, now, formatTime }`.
 * @returns {object} Exactly WEATHER_OUTPUTS, scalars or null.
 */
function weatherOutputs(station, current, { language, now, formatTime }) {
  const outputs = {
    station_name: station.name,
    observed_at: current ? new Date(current.at).toISOString() : null,
    minutes_ago: current ? Math.max(0, Math.round((now - current.at) / 60000)) : null,
    wind_direction_name: compassPoint(current?.values.wind_direction, language) || null,
    summary: summaryOf(station, current, language, formatTime).slice(0, 1000),
  };
  for (const key of WEATHER_OUTPUTS) {
    if (!(key in outputs)) {
      outputs[key] = valueOf(current, key);
    }
  }
  return pick(outputs, WEATHER_OUTPUTS);
}

/**
 * @description Keep only the declared keys of a scene action result.
 * @param {object} outputs - The values.
 * @param {string[]} keys - The declared outputs.
 * @returns {object} The result.
 */
const pick = (outputs, keys) => Object.fromEntries(keys.map((key) => [key, outputs[key] ?? null]));

export {
  TRIGGERS,
  SCENE_ACTIONS,
  WEATHER_OUTPUTS,
  detectTransitions,
  stationData,
  summaryOf,
  weatherOutputs,
  pick,
};
