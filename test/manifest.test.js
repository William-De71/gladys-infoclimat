import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS, SCENE_ACTIONS, WEATHER_OUTPUTS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, HISTORY_MEASURES } from '../src/widgets.js';
import { INTERVALS, DEFAULT_INTERVAL, MAX_STATIONS, AUTO_LANGUAGE } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const REPO = 'William-De71/gladys-infoclimat';

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Infoclimat');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-infoclimat:${pkg.version}`);
  assert.equal(manifest.cover_image, `https://raw.githubusercontent.com/${REPO}/main/cover.jpg`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-infoclimat');
});

test('declares the cloud transport: Infoclimat only, never a local device', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.match(source('../src/infoclimat-api.js'), /https:\/\/www\.infoclimat\.fr/);
  for (const file of [
    'app',
    'parse',
    'stations',
    'events',
    'widgets',
    'device',
    'history',
    'store',
  ]) {
    assert.doesNotMatch(
      source(`../src/${file}.js`),
      /fetch\(|node:https?|node:net|node:dgram/,
      file,
    );
  }
  // A single channel: no transport to publish per device.
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
});

test('Gladys 5.3.0 (catalog keywords and countries), past the house picker; `location`, nothing else', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.match(JSON.stringify(manifest.config_schema), /"source":"houses"/);
  assert.deepEqual(manifest.categories, ['environment']);
  assert.equal(manifest.location, true);
  assert.match(source('../src/app.js'), /gladys\.getHouses\(\)/);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks', 'messaging']) {
    assert.equal(manifest[key], undefined, key);
  }
  const key = byKey(manifest.config_schema).get('api_key');
  assert.deepEqual([key.type, key.required], ['secret', true]);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  const app = source('../src/app.js');
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key),
    Object.values(TRIGGERS),
  );
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    Object.values(WIDGETS),
  );
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  assert.doesNotMatch(
    app,
    /onWidgetAction/,
    'no widget button: never more requests than the timer',
  );
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.scene_actions[0].outputs.map((output) => output.key),
    WEATHER_OUTPUTS,
  );
  // The trigger fields are keys of the event data (the core compares them).
  for (const trigger of manifest.scene_triggers) {
    for (const field of trigger.fields ?? []) {
      assert.equal(field.key, 'station');
      assert.equal(field.source, 'devices');
    }
  }
});

test('mirrors the values of the code', () => {
  const config = byKey(manifest.config_schema);
  assert.deepEqual(values(config.get('interval')).map(Number), INTERVALS);
  assert.equal(Number(config.get('interval').default), DEFAULT_INTERVAL);
  for (let slot = 1; slot <= MAX_STATIONS; slot += 1) {
    assert.equal(config.get(`house_${slot}`).source, 'houses');
    assert.equal(config.get(`station_${slot}`).type, 'string');
  }
  assert.equal(config.get(`house_${MAX_STATIONS + 1}`), undefined);
  const measure = byKey(byKey(manifest.widgets).get('history').settings).get('measure');
  assert.deepEqual(values(measure), Object.keys(HISTORY_MEASURES));
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.actions.length <= 10);
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.outputs.length <= 20, action.key);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog of Gladys 5.3.0: search keywords within the store bounds, countries', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'never the name itself');
  assert.deepEqual(manifest.countries, ['FR'], 'usable there only');
});
