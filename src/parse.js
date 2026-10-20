// -----------------------------------------------------------------------------
// Reading an answer of the observations (version 2 of the open data API).
//
//   { "status": "OK", "errors": [], "data": [],
//     "stations": [{ "id": "STATIC0095", "name": "Ile-d'Arz", "latitude": 47.589,
//                    "longitude": -2.804, "elevation": 15, "type": "static",
//                    "license": { "license": "NON-COMMERCIAL ONLY: CC BY NC",
//                                 "url": "https://creativecommons.org/…", … } }],
//     "metadata": { "temperature": "temperature,degC", … },
//     "hourly": { "STATIC0095": [{ "id_station": "STATIC0095",
//                                  "dh_utc": "2024-10-13 00:00:00",
//                                  "temperature": "14.3", "vent_rafales": null, … }],
//                 "_params": ["temperature", "pression", …] } }
//
// Despite its name, `hourly` holds every reading (every 10 or 15 minutes,
// depending on the station). Values are strings, or null; `dh_utc` is UTC
// without a zone. A station without any reading in the period is simply absent
// from `hourly`.
//
// The key of a station in `hourly` is expected to be the identifier asked for,
// but the identifiers of the rows (`id_station`) and of `stations` may be
// written differently ("00003" in the public list, "STATIC0095" in an
// answer): a requested station is matched to its key exactly, then by the
// `id_station` of its rows, then by the position of its `stations` entry
// (within about 2 km of the public list), and, when only one station was
// asked for and one came back, to that one.
// -----------------------------------------------------------------------------

import { MEASURES, measureOf } from './measures.js';
import { readUtc } from './stations.js';

const PARAMS_KEY = '_params';
const NEAR_DEGREES = 0.02;

/**
 * @description Read a value of the API.
 * @param {unknown} raw - "14.3", 14.3, null, "".
 * @param {string} key - The measure.
 * @returns {number|null} The value, null when absent or out of its bounds.
 */
function readValue(raw, key) {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return null;
  }
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  const measure = measureOf(key);
  if (!Number.isFinite(value) || !measure || value < measure.min || value > measure.max) {
    return null;
  }
  return value;
}

/**
 * @description The values of a row, by measure key.
 * @param {object} row - A reading of the API.
 * @returns {object} `{ temperature: 14.3, … }`, only the values given.
 */
function readRow(row) {
  const values = {};
  for (const measure of MEASURES) {
    for (const source of measure.sources) {
      const value = readValue(row?.[source], measure.key);
      if (value !== null) {
        values[measure.key] = value;
        break;
      }
    }
  }
  return values;
}

/**
 * @description The measures a list of columns names.
 * @param {unknown} params - `_params`: ["temperature", "pression", …].
 * @returns {Set<string>|null} The measure keys, null without the list.
 */
function measuresOfParams(params) {
  if (!Array.isArray(params)) {
    return null;
  }
  const columns = new Set(params.map(String));
  return new Set(
    MEASURES.filter((measure) => measure.sources.some((source) => columns.has(source))).map(
      (measure) => measure.key,
    ),
  );
}

/**
 * @description The metadata of a station entry of an answer.
 * @param {object|undefined} entry - An item of `stations`.
 * @returns {object} `{ name, latitude, longitude, elevation, licenseText, licenseUrl }`.
 */
function readMeta(entry) {
  const number = (value) =>
    Number.isFinite(Number(value)) && value !== null ? Number(value) : null;
  return {
    name: entry?.name ? String(entry.name).slice(0, 80) : null,
    latitude: number(entry?.latitude),
    longitude: number(entry?.longitude),
    elevation: number(entry?.elevation),
    licenseText: entry?.license?.license ? String(entry.license.license).slice(0, 80) : null,
    licenseUrl: /^https:\/\//.test(String(entry?.license?.url ?? ''))
      ? String(entry.license.url).slice(0, 200)
      : null,
  };
}

/**
 * @description Match the requested stations to the keys of `hourly`.
 * @param {object[]} requests - `{ id, latitude?, longitude? }` (positions of the public list).
 * @param {object} hourly - The `hourly` object of the answer.
 * @param {object[]} entries - The `stations` of the answer.
 * @returns {Map<string, string>} requested id -> key of `hourly`.
 */
function matchKeys(requests, hourly, entries) {
  const keys = Object.keys(hourly).filter(
    (key) => key !== PARAMS_KEY && Array.isArray(hourly[key]),
  );
  const used = new Set();
  const found = new Map();
  const take = (id, key) => {
    if (key && !used.has(key)) {
      used.add(key);
      found.set(id, key);
      return true;
    }
    return false;
  };
  const same = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();
  const rules = [
    (request) => keys.find((key) => same(key, request.id)),
    (request) => keys.find((key) => hourly[key].some((row) => same(row?.id_station, request.id))),
    (request) => {
      if (!Number.isFinite(request.latitude) || !Number.isFinite(request.longitude)) {
        return undefined;
      }
      const entry = entries.find(
        (candidate) =>
          Math.abs(Number(candidate?.latitude) - request.latitude) < NEAR_DEGREES &&
          Math.abs(Number(candidate?.longitude) - request.longitude) < NEAR_DEGREES &&
          keys.some((key) => same(key, candidate?.id)),
      );
      return entry ? keys.find((key) => same(key, entry.id)) : undefined;
    },
  ];
  for (const rule of rules) {
    for (const request of requests) {
      if (!found.has(request.id)) {
        take(request.id, rule(request));
      }
    }
  }
  if (requests.length === 1 && keys.length === 1 && !found.has(requests[0].id)) {
    take(requests[0].id, keys[0]);
  }
  return found;
}

/**
 * @description Read an answer of the observations.
 * @param {object} data - The JSON answer.
 * @param {object[]} requests - The stations asked for: `{ id, latitude?, longitude? }`.
 * @returns {Map<string, object>} requested id -> `{ key, meta, params, readings }`:
 * `params` the measures the station gives (in `_params` and not always null),
 * `readings` `[{ at, values }]` sorted by time. A station without readings is absent.
 */
function parseObservations(data, requests) {
  const hourly = data?.hourly && typeof data.hourly === 'object' ? data.hourly : {};
  const entries = Array.isArray(data?.stations) ? data.stations : [];
  const declared = measuresOfParams(hourly[PARAMS_KEY]);
  const result = new Map();
  for (const [id, key] of matchKeys(requests, hourly, entries)) {
    const byTime = new Map();
    for (const row of hourly[key]) {
      const at = readUtc(row?.dh_utc);
      if (at !== null) {
        byTime.set(at, { at, values: { ...byTime.get(at)?.values, ...readRow(row) } });
      }
    }
    const readings = [...byTime.values()].sort((a, b) => a.at - b.at);
    if (readings.length === 0) {
      continue;
    }
    const given = new Set(readings.flatMap((reading) => Object.keys(reading.values)));
    const params = MEASURES.map((measure) => measure.key).filter(
      (measureKey) => given.has(measureKey) && (!declared || declared.has(measureKey)),
    );
    const entry = entries.find(
      (candidate) => String(candidate?.id ?? '').toUpperCase() === key.toUpperCase(),
    );
    result.set(id, { key, meta: readMeta(entry), params, readings });
  }
  return result;
}

export { PARAMS_KEY, readValue, readRow, measuresOfParams, matchKeys, parseObservations };
