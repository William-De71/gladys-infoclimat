// A fake Infoclimat for the tests, served through the `fetch` option of the
// integration. Tests never touch the network.
//
//   - the public list of the stations is an extract of the real one, read on
//     2026-10-20 at 11:57 UTC (test/fixtures/stations_xhr.json): around
//     Besançon, the station of the town itself (000P2) has been silent since
//     the day before, the nearest one that reports is Chenecey-Buillon (000C7);
//   - the refusals are the real ones of that day: no token -> HTTP 200 and an
//     HTML "Could not authenticate request"; an unknown token -> HTTP 400 and
//     {"errors":["No account found for this token: '…'"]};
//   - the observations follow the shape of a real answer
//     (test/fixtures/observations_example.json), generated for the stations
//     and the UTC days asked for, one reading every 10 minutes up to NOW:
//     values as strings, a gust sometimes null, a rain shower between 06:00
//     and 07:30 UTC on 2026-10-20. 000C7 gives the rain of the day
//     (`pluie_cumul_0h`), STATIC0495 does not. Unknown stations are absent.
// No answer was ever obtained with a real key: the shape is the one of the
// example and of the contract of Infoclimat, never verified live.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const TZ = 'Europe/Paris';
const KEY = 'good-key';
const BESANCON = { latitude: 47.24, longitude: 6.02 };
const MINUTE = 60 * 1000;

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary folder standing for /data.
 * @returns {string} The path.
 */
const dataDir = () => mkdtempSync(join(tmpdir(), 'infoclimat-'));

const pad = (n) => String(n).padStart(2, '0');
const utc = (instant) => {
  const d = new Date(instant);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};
const RAIN_START = Date.parse('2026-10-20T06:00:00Z');
const RAIN_END = Date.parse('2026-10-20T07:30:00Z');

/**
 * @description The rain of the hour before an instant (0.2 mm every 10 minutes of the shower).
 * @param {number} at - The instant.
 * @returns {number} Millimetres.
 */
function rainOfHour(at) {
  let total = 0;
  for (let step = at - 50 * MINUTE; step <= at; step += 10 * MINUTE) {
    if (step > RAIN_START && step <= RAIN_END) {
      total += 0.2;
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * @description The rain since 00:00 UTC.
 * @param {number} at - The instant.
 * @returns {number} Millimetres.
 */
function rainOfDay(at) {
  const midnight = Math.floor(at / (24 * 60 * MINUTE)) * 24 * 60 * MINUTE;
  let total = 0;
  for (let step = midnight + 10 * MINUTE; step <= at; step += 10 * MINUTE) {
    if (step > RAIN_START && step <= RAIN_END) {
      total += 0.2;
    }
  }
  return Math.round(total * 10) / 10;
}

/**
 * @description A generated reading, the way Infoclimat writes it.
 * @param {string} id - The station.
 * @param {number} at - The instant.
 * @param {number} offset - A per-station offset of the temperature.
 * @param {boolean} cumul - Whether the station gives `pluie_cumul_0h`.
 * @returns {object} The row.
 */
function row(id, at, offset, cumul) {
  const hours = (at % (24 * 60 * MINUTE)) / (60 * MINUTE);
  const temperature = 9 + offset + 5 * Math.sin(((hours - 9) / 24) * 2 * Math.PI);
  const index = Math.round(at / (10 * MINUTE));
  return {
    id_station: id,
    dh_utc: utc(at),
    temperature: temperature.toFixed(1),
    pression: (1016.4 - (at - NOW) / (60 * MINUTE) / 20).toFixed(1),
    humidite: String(Math.round(88 - 3 * (temperature - 9))),
    point_de_rosee: (temperature - 2.4).toFixed(1),
    vent_moyen: (11 + (index % 5)).toFixed(1),
    vent_rafales: index % 4 === 0 ? null : (24 + (index % 7)).toFixed(1),
    vent_direction: String(200 + (index % 6) * 5),
    pluie_3h: null,
    pluie_1h: rainOfHour(at).toFixed(1),
    ...(cumul ? { pluie_cumul_0h: rainOfDay(at).toFixed(1) } : {}),
  };
}

// The stations the fake knows, with their part of the answer.
const STATIONS = {
  '000C7': {
    offset: 0,
    cumul: true,
    entry: {
      id: '000C7',
      name: 'Chenecey-Buillon',
      latitude: 47.14,
      longitude: 5.96,
      elevation: 280,
    },
    license: 'NON-COMMERCIAL ONLY: CC BY NC',
  },
  STATIC0495: {
    offset: -2,
    cumul: false,
    entry: {
      id: 'STATIC0495',
      name: 'Évillers',
      latitude: 46.99,
      longitude: 6.228,
      elevation: 706,
    },
    license: 'CC BY',
  },
  '000P2': {
    offset: 1,
    cumul: false,
    // Silent since 2026-10-19 07:10 UTC, like in the public list.
    until: Date.parse('2026-10-19T07:10:00Z'),
    entry: { id: '000P2', name: 'Besançon', latitude: 47.249, longitude: 6.018, elevation: 355 },
    license: 'CC BY',
  },
};

/**
 * @description The fake Infoclimat: the list, the observations, the refusals.
 * @param {object} [options] - `{ now }`: `() => number`, the clock of the readings.
 * @returns {Function & { calls: object[], offline: boolean, status: number|null, now: Function }} A `fetch`.
 */
function fakeInfoclimat({ now = () => NOW } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const target = new URL(url);
    const params = target.searchParams;
    const kind = target.pathname.endsWith('stations_xhr.php') ? 'stations' : 'observations';
    calls.push({
      kind,
      stations: params.getAll('stations[]'),
      start: params.get('start'),
      end: params.get('end'),
      token: params.get('token'),
      userAgent: init.headers?.['user-agent'],
    });
    if (fetch.offline) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (fetch.status) {
      return new Response('Too Many Requests', { status: fetch.status });
    }
    if (kind === 'stations') {
      return Response.json(fixture('stations_xhr.json'));
    }
    const token = fetch.dropToken ? null : params.get('token');
    if (!token) {
      return new Response('Could not authenticate request', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=iso-8859-15' },
      });
    }
    if (token !== KEY) {
      return Response.json(
        { errors: [`No account found for this token: '${token}'`] },
        { status: 400 },
      );
    }
    const start = Date.parse(`${params.get('start')}T00:00:00Z`);
    const end = Math.min(Date.parse(`${params.get('end')}T23:50:00Z`), fetch.now());
    const hourly = {};
    const entries = [];
    for (const id of params.getAll('stations[]')) {
      const station = STATIONS[id];
      if (!station) {
        continue;
      }
      const rows = [];
      for (let at = start; at <= Math.min(end, station.until ?? end); at += 10 * MINUTE) {
        rows.push(row(id, at, station.offset, station.cumul));
      }
      if (rows.length) {
        hourly[id] = rows;
        entries.push({
          ...station.entry,
          type: 'static',
          license: {
            license: station.license,
            url: 'https://creativecommons.org/licenses/by-nc/2.0/fr/',
          },
        });
      }
    }
    // The columns of the answer: the rain of the day when a station gives it.
    hourly._params = [
      ...clone(fixture('observations_example.json').hourly._params),
      ...(Object.keys(hourly).some((id) => STATIONS[id].cumul) ? ['pluie_cumul_0h'] : []),
    ];
    const body = {
      status: 'OK',
      errors: [],
      data: [],
      stations: entries,
      metadata: fixture('observations_example.json').metadata,
      hourly,
    };
    return Response.json(fetch.transform ? fetch.transform(body) : body);
  };
  fetch.calls = calls;
  fetch.offline = false;
  fetch.status = null;
  fetch.now = now;
  // Hooks of the tests: answer as if no token was sent; rewrite an answer.
  fetch.dropToken = false;
  fetch.transform = null;
  return fetch;
}

export { NOW, TZ, KEY, BESANCON, MINUTE, silent, dataDir, fixture, clone, fakeInfoclimat };
