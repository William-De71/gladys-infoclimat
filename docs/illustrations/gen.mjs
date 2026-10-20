// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Three stations around a made-up house near Besançon, on a fixed day (Tuesday
// 20 October 2026, 14:00 in Paris): made-up readings every 10 minutes written
// the way Infoclimat writes them (strings, UTC times, a gust sometimes null,
// a shower in the morning), read by the real parser, kept by the real
// history, drawn by the real widget builders. Never real data.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildCurrentWidget, buildHistoryWidget, buildCompareWidget } = await load('src/widgets.js');
const { parseObservations } = await load('src/parse.js');
const { mergeReadings, currentOf } = await load('src/history.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const NOW = Date.parse('2026-10-20T12:00:00Z');
const MINUTE = 60 * 1000;
// Mulberry32: the same "random" curves on every run.
let seed = 20261020;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pad = (n) => String(n).padStart(2, '0');
const utc = (at) => {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};
const showerAt = (at) =>
  at > Date.parse('2026-10-20T05:40:00Z') && at <= Date.parse('2026-10-20T07:20:00Z');

/**
 * @description 24 hours of made-up rows of a station, the way Infoclimat writes them.
 * @param {string} id - The station.
 * @param {number} offset - Its temperature offset.
 * @param {number} last - Its last reading.
 * @returns {object[]} The rows.
 */
function rows(id, offset, last) {
  const list = [];
  let wind = 12;
  for (let at = NOW - 24 * 60 * MINUTE; at <= last; at += 10 * MINUTE) {
    const hours = (at % (24 * 60 * MINUTE)) / (60 * MINUTE);
    const temperature =
      8.6 + offset + 5.2 * Math.sin(((hours - 8.5) / 24) * 2 * Math.PI) + (random() - 0.5) * 0.4;
    wind = Math.max(2, Math.min(28, wind + (random() - 0.5) * 4));
    let rain = 0;
    for (let step = at - 50 * MINUTE; step <= at; step += 10 * MINUTE)
      rain += showerAt(step) ? 0.2 : 0;
    let today = 0;
    const midnight = Math.floor(at / (24 * 60 * MINUTE)) * 24 * 60 * MINUTE;
    for (let step = midnight + 10 * MINUTE; step <= at; step += 10 * MINUTE)
      today += showerAt(step) ? 0.2 : 0;
    list.push({
      id_station: id,
      dh_utc: utc(at),
      temperature: temperature.toFixed(1),
      pression: (1012.2 + (at - NOW + 24 * 60 * MINUTE) / (60 * MINUTE) / 6).toFixed(1),
      humidite: String(Math.round(Math.min(98, 92 - 3.2 * (temperature - 7)))),
      point_de_rosee: (temperature - 2.2 - (hours > 10 && hours < 17 ? 1.5 : 0)).toFixed(1),
      vent_moyen: wind.toFixed(1),
      vent_rafales: random() < 0.2 ? null : (wind * 1.9 + random() * 4).toFixed(1),
      vent_direction: String(Math.round(215 + (random() - 0.5) * 30)),
      pluie_1h: rain.toFixed(1),
      pluie_cumul_0h: today.toFixed(1),
    });
  }
  return list;
}

const STATIONS = [
  {
    id: '000C7',
    name: 'Chenecey-Buillon',
    offset: 0,
    last: NOW,
    elevation: 280,
    distanceKm: 12,
    license: 'cc-by-nc',
  },
  {
    id: 'STATIC0495',
    name: 'Évillers',
    offset: -2.1,
    last: NOW - 10 * MINUTE,
    elevation: 706,
    distanceKm: null,
    license: 'cc-by',
  },
  {
    id: 'STATIC0268',
    name: 'Arc-sous-Cicon - Village',
    offset: -3,
    last: NOW - 3 * 60 * MINUTE,
    elevation: 810,
    distanceKm: null,
    license: 'cc-by-nc',
  },
];
const answer = {
  status: 'OK',
  errors: [],
  hourly: Object.fromEntries(STATIONS.map((s) => [s.id, rows(s.id, s.offset, s.last)])),
};
answer.hourly._params = [
  'temperature',
  'pression',
  'humidite',
  'point_de_rosee',
  'vent_moyen',
  'vent_rafales',
  'vent_direction',
  'pluie_1h',
  'pluie_cumul_0h',
];
const parsed = parseObservations(
  answer,
  STATIONS.map(({ id }) => ({ id })),
);
const kept = STATIONS.map((station) => {
  const readings = mergeReadings([], parsed.get(station.id).readings, NOW);
  return {
    station: {
      ...station,
      params: parsed.get(station.id).params,
      licenseText: null,
      house: 'Maison',
    },
    readings,
    current: currentOf(readings),
  };
});
const HOUSES = { en: 'Home', fr: 'Maison', de: 'Zuhause', es: 'Casa' };

const contents = {};
for (const language of LANGUAGES) {
  const options = { language, timeZone: 'Europe/Paris', now: NOW, interval: 10 };
  const local = kept.map((entry) => ({
    ...entry,
    station: { ...entry.station, house: HOUSES[language] },
  }));
  contents[language] = {
    current: buildCurrentWidget({
      station: local[0].station,
      current: local[0].current,
      ...options,
    }),
    history: buildHistoryWidget({ ...local[0], measure: 'temperature', ...options }),
    compare: buildCompareWidget({ stations: local, ...options }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
