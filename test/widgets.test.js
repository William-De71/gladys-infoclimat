import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  buildCurrentWidget,
  buildHistoryWidget,
  buildCompareWidget,
  attributionOf,
} from '../src/widgets.js';
import { LANGUAGES } from '../src/i18n.js';

const NOW = Date.parse('2026-10-20T12:00:00Z');
const MINUTE = 60 * 1000;
const STATION = {
  id: '000C7',
  name: 'Chenecey-Buillon',
  params: [
    'temperature',
    'dew_point',
    'humidity',
    'pressure',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_1h',
    'rain_today',
  ],
  license: 'cc-by-nc',
  licenseText: null,
  elevation: 280,
  distanceKm: 12,
  house: 'Home',
};
const readings = Array.from({ length: 145 }, (_, i) => ({
  at: NOW - (144 - i) * 10 * MINUTE,
  values: {
    temperature: 8 + i / 20,
    dew_point: 6 + i / 30,
    humidity: 90 - i / 10,
    pressure: 1012 + i / 50,
    wind_speed: 10 + (i % 5),
    wind_gust: 20 + (i % 7),
    wind_direction: 225,
    rain_1h: i > 40 && i < 50 ? 0.4 : 0,
  },
}));
const current = {
  at: NOW - 7 * MINUTE,
  values: { ...readings.at(-1).values, rain_today: 1.6, radiation: 310, visibility: 20000 },
};
const options = (language) => ({ language, timeZone: 'Europe/Paris', now: NOW, interval: 10 });

test('every widget passes the checks of the core, in the four languages', () => {
  for (const language of LANGUAGES) {
    const contents = [
      buildCurrentWidget({ station: STATION, current, ...options(language) }),
      buildCurrentWidget({
        station: STATION,
        current: { ...current, at: NOW - 3 * 60 * MINUTE },
        ...options(language),
      }),
      buildCurrentWidget({ station: STATION, current: null, ...options(language) }),
      ...['temperature', 'humidity', 'pressure', 'wind', 'rain', 'nonsense'].map((measure) =>
        buildHistoryWidget({ station: STATION, readings, current, measure, ...options(language) }),
      ),
      buildHistoryWidget({
        station: { ...STATION, params: ['humidity'] },
        readings,
        current,
        measure: 'wind',
        ...options(language),
      }),
      buildHistoryWidget({
        station: STATION,
        readings: readings.slice(-1),
        current,
        measure: 'temperature',
        ...options(language),
      }),
      buildCompareWidget({
        stations: [
          { station: STATION, current },
          {
            station: { ...STATION, id: 'X', name: 'Silent', distanceKm: null },
            current: { ...current, at: NOW - 5 * 60 * MINUTE },
          },
          { station: { ...STATION, id: 'Y', name: 'Never' }, current: null },
        ],
        ...options(language),
      }),
      buildCompareWidget({ stations: [], ...options(language) }),
    ];
    for (const content of contents) {
      assert.deepEqual(
        validateWidgetContent(content),
        [],
        `${language}: ${JSON.stringify(content).slice(0, 200)}`,
      );
    }
  }
});

test('current: six tiles at most, the rest in the text, the credit of Infoclimat', () => {
  const content = buildCurrentWidget({ station: STATION, current, ...options('fr') });
  const tiles = content.components.filter((component) => component.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.label, tile.value, tile.unit]),
    [
      ['Température', 15.2, '°C'],
      ['Humidité', 76, '%'],
      ['Vent SO', 14, 'km/h'],
      ['Rafales', 24, 'km/h'],
      ['Pression', 1015, 'hPa'],
      ['Pluie du jour', 1.6, 'mm'],
    ],
  );
  const body = content.components.find((component) => component.variant === 'body').text;
  assert.match(body, /Point de rosée 10,8 °C · Visibilité 20\s000 m · Rayonnement 310 W\/m²/);
  assert.match(body, /Données : Infoclimat, CC BY-NC, non commercial\.$/);
  assert.match(content.components[0].text, /^Chenecey-Buillon · 13:53 \(il y a 7 min\)$/);
});

test('history: min and max marked, the gusts with the wind', () => {
  const content = buildHistoryWidget({
    station: STATION,
    readings,
    current,
    measure: 'wind',
    ...options('en'),
  });
  const chart = content.components.find((component) => component.type === 'chart');
  assert.deepEqual(
    chart.series.map((series) => series.name),
    ['Mean wind', 'Gusts'],
  );
  assert.equal(chart.series[0].points.length, 145);
  const tiles = content.components.filter((component) => component.type === 'value');
  assert.deepEqual(
    tiles.map((tile) => [tile.label, tile.value]),
    [
      ['Max (24 h)', 14],
      ['Max gust (24 h)', 26],
    ],
  );
  const rain = buildHistoryWidget({
    station: STATION,
    readings,
    current,
    measure: 'rain',
    ...options('en'),
  });
  assert.equal(rain.components.find((component) => component.type === 'chart').chart_type, 'bar');
});

test('the credit names the license of the station, or the text of Infoclimat', () => {
  assert.equal(
    attributionOf({ license: 'etalab' }, 'en'),
    'Data: Infoclimat, Open Licence (Etalab)',
  );
  assert.equal(
    attributionOf({ license: null, licenseText: 'CC BY' }, 'de'),
    'Daten: Infoclimat, CC BY',
  );
  assert.equal(attributionOf({}, 'es'), 'Datos: Infoclimat');
});
