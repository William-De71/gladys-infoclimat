// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a fake
// Infoclimat (test/helpers/fake-api.js). No test touches the network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp, ACTIONS, USER_AGENT } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS, SCENE_ACTIONS, WEATHER_OUTPUTS } from '../src/events.js';
import {
  fakeInfoclimat,
  dataDir,
  silent,
  NOW,
  TZ,
  KEY,
  BESANCON,
  MINUTE,
} from './helpers/fake-api.js';

const CONFIG = { api_key: KEY, house_1: 'home', station_2: 'static0495', language: 'en' };
const HOUSES = [
  { selector: 'home', name: 'Home', ...BESANCON },
  { selector: 'nowhere', name: 'No location' },
];
const PREFIX = 'ext:test-integration';
const C7 = `${PREFIX}:station:000c7`;
const EV = `${PREFIX}:station:static0495`;
const HOUR = 60 * MINUTE;

/**
 * @description The integration, connected to a fake Gladys and a fake Infoclimat.
 * @param {object} [options] - `{ config, api, dir, now, clock }`: a clock may be
 * shared with a fake Infoclimat made outside.
 * @returns {Promise<object>} `{ gladys, app, api, clock, dir }`.
 */
async function startApp({ config = CONFIG, api, dir = dataDir(), now = NOW, clock } = {}) {
  clock ??= { now };
  const fake = api ?? fakeInfoclimat({ now: () => clock.now });
  const gladys = createFakeGladys({ config, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: fake,
    dataDir: dir,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api: fake, clock, dir };
}

const observationCalls = (api) => api.calls.filter((call) => call.kind === 'observations');

/**
 * @description Create every offered device, like the user would.
 * @param {object} gladys - The fake Gladys.
 */
async function createAll(gladys) {
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(device);
  }
}

test('startup: the nearest StatIC station that reports, no observation request before the timer', async (t) => {
  const { gladys, app, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  // Besançon (000P2) is 1 km away but silent since the day before: 000C7 (12 km).
  assert.deepEqual(
    app.getStations().map((station) => [station.id, station.typed, station.distanceKm]),
    [
      ['000C7', false, 12],
      ['STATIC0495', true, null],
    ],
  );
  assert.equal(api.calls.filter((call) => call.kind === 'stations').length, 1);
  assert.equal(observationCalls(api).length, 0, 'no burst at startup');
  assert.deepEqual(gladys.fake.discoveredDevices, [], 'devices come with their measures');
  assert.match(gladys.fake.connectionStatus.message.en, /Waiting for the first reading/);
});

test('one request for every station, a User-Agent, the day before when nothing is kept', async (t) => {
  const { gladys, app, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  const [call] = observationCalls(api);
  assert.deepEqual(call.stations, ['000C7', 'STATIC0495']);
  assert.deepEqual([call.start, call.end], ['2026-10-19', '2026-10-20']);
  assert.equal(call.userAgent, USER_AGENT);
  assert.match(USER_AGENT, /^gladys-infoclimat\/0\.\d+\.\d+ \(\+https:\/\/github\.com\//);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [C7, 'Infoclimat Chenecey-Buillon'],
      [EV, 'Infoclimat Évillers'],
    ],
  );
  const features = (id) =>
    gladys.fake.discoveredDevices
      .find((device) => device.external_id === id)
      .features.map((f) => f.external_id.split(':').pop());
  const all = [
    'temperature',
    'humidity',
    'pressure',
    'dew_point',
    'wind_speed',
    'wind_gust',
    'wind_direction',
    'rain_1h',
    'rain_today',
  ];
  assert.deepEqual(features(C7), all);
  // Évillers gives no `pluie_cumul_0h`: the rain of the day is summed from the hours.
  assert.deepEqual(features(EV), all);
  assert.match(gladys.fake.connectionStatus.message.en, /^2 station\(s\), read just now: /);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('the next request waits for the interval, then asks for today only', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  clock.now += 9 * MINUTE;
  await app.readStations();
  assert.equal(observationCalls(api).length, 1);
  clock.now += MINUTE;
  await app.readStations();
  assert.equal(observationCalls(api).length, 2);
  assert.equal(observationCalls(api)[1].start, '2026-10-20');
});

test('states once the devices exist, republished at creation, a 0 never invented', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  await createAll(gladys);
  // 12:00 UTC: 9 + 5·sin(3/24·2π) = 12.5 °C; the shower ended at 07:30.
  assert.equal(gladys.fake.lastState(`${C7}:temperature`), 12.5);
  assert.equal(gladys.fake.lastState(`${EV}:temperature`), 10.5);
  assert.equal(gladys.fake.lastState(`${C7}:rain_1h`), 0);
  assert.equal(gladys.fake.lastState(`${C7}:rain_today`), 1.8);
  assert.equal(gladys.fake.lastState(`${EV}:rain_today`), 1.8, 'summed from the full hours');
  assert.equal(gladys.fake.lastState(`${C7}:pressure`), 1016.4);
  assert.equal(
    gladys.fake.lastState(`${C7}:wind_direction`),
    200 + (Math.round(NOW / 600000) % 6) * 5,
  );
  // The gust of 12:00 is null: the one of 11:50.
  assert.equal(typeof gladys.fake.lastState(`${C7}:wind_gust`), 'number');
});

test('rain started and stopped: one event per transition, never at the first reading', async (t) => {
  const start = Date.parse('2026-10-20T05:00:00Z');
  // At 05:00 the station of Besançon (000P2) still counts as reporting (its
  // last report is less than 24 hours old): name 000C7 by its identifier.
  const { gladys, app, clock } = await startApp({
    now: start,
    config: { ...CONFIG, house_1: undefined, station_1: '000C7' },
  });
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  assert.deepEqual(gladys.fake.sceneEvents, [], 'baseline');
  for (let at = start + 10 * MINUTE; at <= start + 4 * HOUR; at += 10 * MINUTE) {
    clock.now = at;
    await app.readStations();
  }
  const events = gladys.fake.sceneEvents.map((event) => [event.key, event.data.station_name]);
  assert.deepEqual(events, [
    [TRIGGERS.RAIN_STARTED, 'Chenecey-Buillon'],
    [TRIGGERS.RAIN_STARTED, 'Évillers'],
    [TRIGGERS.RAIN_STOPPED, 'Chenecey-Buillon'],
    [TRIGGERS.RAIN_STOPPED, 'Évillers'],
  ]);
  const started = gladys.fake.sceneEvents[0].data;
  assert.equal(started.station, C7);
  assert.equal(started.rain_1h, 0.2);
  assert.equal(started.observed_at, '2026-10-20T06:10:00.000Z');
  for (const { data } of gladys.fake.sceneEvents) {
    assert.ok(Object.keys(data).length <= 30);
    for (const value of Object.values(data)) {
      assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    }
  }
});

test('a silent station, then back; a restart fires nothing twice', async (t) => {
  const dir = dataDir();
  const clock = { now: NOW };
  // The readings of the fake stop at 12:00 until `live` is set again.
  const live = { on: true };
  const api = fakeInfoclimat({ now: () => (live.on ? clock.now : NOW) });
  const first = await startApp({ dir, api, clock });
  await first.app.readStations();
  live.on = false;
  clock.now = NOW + 100 * MINUTE;
  await first.app.readStations({ force: true });
  assert.deepEqual(
    first.gladys.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.STATION_SILENT, TRIGGERS.STATION_SILENT],
  );
  assert.equal(first.gladys.fake.sceneEvents[0].data.minutes_ago, 100);
  await first.gladys.fake.shutdown();

  clock.now = NOW + 101 * MINUTE;
  const second = await startApp({ dir, api, clock });
  t.after(() => second.gladys.fake.shutdown());
  await second.app.readStations({ force: true });
  assert.deepEqual(second.gladys.fake.sceneEvents, [], 'already known as silent');
  live.on = true;
  clock.now = NOW + 112 * MINUTE;
  await second.app.readStations({ force: true });
  assert.deepEqual(
    second.gladys.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.STATION_BACK, TRIGGERS.STATION_BACK],
  );
});

test('a restart waits for the time left: no request at once', async (t) => {
  const dir = dataDir();
  const first = await startApp({ dir });
  await first.app.readStations();
  await first.gladys.fake.shutdown();
  const second = await startApp({ dir, now: NOW + 4 * MINUTE });
  t.after(() => second.gladys.fake.shutdown());
  await second.app.readStations();
  assert.equal(observationCalls(second.api).length, 0);
  assert.equal(second.api.calls.filter((call) => call.kind === 'stations').length, 0, 'list kept');
  assert.equal(second.app.nextDue(), NOW + 10 * MINUTE);
});

test('a refused key: a clear status, one event, retried every 6 hours only', async (t) => {
  const { gladys, app, api, clock } = await startApp({ config: { ...CONFIG, api_key: 'abc' } });
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /refuse la clé.*adresse IP/);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.KEY_REFUSED],
  );
  assert.doesNotMatch(
    JSON.stringify(gladys.fake.sceneEvents),
    /'abc'/,
    'the key is never repeated',
  );
  clock.now += 5 * HOUR;
  await app.readStations();
  assert.equal(observationCalls(api).length, 1);
  clock.now += HOUR;
  await app.readStations();
  assert.equal(observationCalls(api).length, 2);
  assert.equal(gladys.fake.sceneEvents.length, 1, 'once until it works');
  const content = await gladys.fake.widgetGet(WIDGETS.CURRENT, { language: 'de' });
  assert.match(content.data.content.components[0].text, /lehnt den Schlüssel ab/);
  // A new key is tried at the next tick.
  await gladys.fake.configUpdated({ ...CONFIG });
  await app.readStations();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('no token at all is a refusal too (HTML with a 200)', async (t) => {
  const { gladys, app, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.dropToken = true;
  await app.readStations();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /refuses the key/);
});

test('failures wait longer each time, up to an hour; a 429 waits an hour', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  api.offline = true;
  await app.readStations();
  assert.equal(app.nextDue() - clock.now, 10 * MINUTE);
  clock.now = app.nextDue();
  await app.readStations();
  assert.equal(app.nextDue() - clock.now, 20 * MINUTE);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /cannot be reached \(ENOTFOUND\)\. Next try in 20 min/,
  );
  api.offline = false;
  api.status = 429;
  clock.now = app.nextDue();
  await app.readStations();
  assert.equal(app.nextDue() - clock.now, HOUR);
  api.status = null;
  clock.now = app.nextDue();
  await app.readStations();
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(app.nextDue() - clock.now, 10 * MINUTE);
});

test('"Read now" reads at once, never twice within 2 minutes', async (t) => {
  const { gladys, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const done = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(
    done.data.message.en,
    /^Read: Chenecey-Buillon 12\.5 °C \(14:00\) · Évillers 10\.5 °C \(14:00\)$/,
  );
  clock.now += MINUTE;
  const again = await gladys.fake.action(ACTIONS.READ_NOW);
  assert.match(again.data.message.fr, /a été lu il y a 1 min.*dans 9 min/);
  assert.equal(observationCalls(api).length, 1);
});

test('the diagnostic never writes the key', async (t) => {
  const lines = [];
  const logger = { ...silent, info: (line) => lines.push(line) };
  const gladys = createFakeGladys({ config: CONFIG, houses: HOUSES });
  const app = createApp(gladys, {
    fetch: fakeInfoclimat(),
    dataDir: dataDir(),
    now: () => NOW,
    timeZone: TZ,
    timers: false,
    logger,
  });
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  await app.whenReady();
  await app.readStations();
  const ack = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.equal(ack.success, true);
  const report = lines.filter((line) => line.startsWith('Infoclimat diagnostic')).join('');
  assert.match(report, /"key":"set"/);
  assert.doesNotMatch(report, new RegExp(KEY));
});

test('scene action: the values of the last reading, only the declared outputs', async (t) => {
  const { gladys, app, api } = await startApp({ config: { ...CONFIG, language: 'fr' } });
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  const ack = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_WEATHER, { station: EV });
  assert.equal(ack.success, true);
  const outputs = ack.data.outputs ?? ack.data;
  assert.deepEqual(Object.keys(outputs).sort(), [...WEATHER_OUTPUTS].sort());
  assert.equal(outputs.station_name, 'Évillers');
  assert.equal(outputs.temperature, 10.5);
  assert.equal(outputs.minutes_ago, 0);
  assert.equal(outputs.radiation, null);
  assert.match(
    outputs.summary,
    /^Évillers, 14:00 : 10,5 °C, humidité \d+ %, vent \d+ km\/h (S|SSO|SO)/,
  );
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_WEATHER, {});
  assert.equal((first.data.outputs ?? first.data).station_name, 'Chenecey-Buillon');
  assert.equal(observationCalls(api).length, 1, 'an action never sends a request');
});

test('widgets: every content passes the checks of the core, in the four languages', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const before = await gladys.fake.widgetGet(WIDGETS.CURRENT, { language: 'en' });
  assert.match(before.data.content.components.at(-1).text, /No reading of this station yet/);
  await app.readStations();
  for (const language of ['en', 'fr', 'de', 'es']) {
    for (const [key, settings] of [
      [WIDGETS.CURRENT, { station: EV }],
      [WIDGETS.HISTORY, { station: C7, measure: 'temperature' }],
      [WIDGETS.HISTORY, { station: C7, measure: 'wind' }],
      [WIDGETS.HISTORY, { station: C7, measure: 'rain' }],
      [WIDGETS.HISTORY, { station: C7, measure: 'pressure' }],
      [WIDGETS.HISTORY, { station: C7, measure: 'humidity' }],
      [WIDGETS.COMPARE, {}],
    ]) {
      const ack = await gladys.fake.widgetGet(key, { settings, language });
      assert.equal(ack.success, true, `${key} ${language}`);
      assert.deepEqual(validateWidgetContent(ack.data.content), [], `${key} ${language}`);
    }
  }
  const history = await gladys.fake.widgetGet(WIDGETS.HISTORY, {
    settings: { station: C7, measure: 'temperature' },
    language: 'fr',
  });
  const chart = history.data.content.components.find((component) => component.type === 'chart');
  assert.deepEqual(
    chart.series.map((series) => series.name),
    ['Température', 'Point de rosée'],
  );
  assert.ok(chart.series[0].points.length >= 140 && chart.series[0].points.length <= 145);
});

test('a feature once given never disappears, even when its values are null', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await app.readStations();
  const before = gladys.fake.discoveredDevices.map((device) => device.features.length);
  api.transform = (body) => {
    for (const rows of Object.values(body.hourly)) {
      if (Array.isArray(rows)) rows.forEach((row) => (row.vent_rafales = null));
    }
    return body;
  };
  app.store.data.stations['000C7'].readings = [];
  clock.now += 10 * MINUTE;
  await app.readStations();
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.features.length),
    before,
  );
  assert.ok(
    gladys.fake.discoveredDevices[0].features.some((feature) =>
      feature.external_id.endsWith(':wind_gust'),
    ),
  );
});
