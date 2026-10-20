import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConfig,
  readStationId,
  readInterval,
  guessLanguage,
  readLanguage,
} from '../src/config.js';

test('station identifiers: trimmed, upper case, garbage refused', () => {
  assert.equal(readStationId(' static0095 '), 'STATIC0095');
  assert.equal(readStationId('000p2'), '000P2');
  assert.equal(readStationId(7149), '7149');
  assert.equal(readStationId('Besançon'), null);
  assert.equal(readStationId('https://www.infoclimat.fr/x/000P2.html'), null);
  assert.equal(readStationId(''), null);
});

test('the interval is one of 10, 15, 30, 60 minutes, never less than 10', () => {
  assert.deepEqual(
    ['15', 30, '60', '5', 1, '', null, 'abc'].map(readInterval),
    [15, 30, 60, 10, 10, 10, 10, 10],
  );
});

test('slots: the typed station wins over the house; empty slots left out', () => {
  const config = normalizeConfig({
    api_key: ' key ',
    house_1: 'home',
    station_1: '000c7',
    house_2: 'cabin',
    station_3: 'not a station!',
    interval: '30',
    language: 'de',
  });
  assert.equal(config.apiKey, 'key');
  assert.deepEqual(config.slots, [
    { slot: 1, station: '000C7', house: null, invalidStation: null },
    { slot: 2, station: null, house: 'cabin', invalidStation: null },
    { slot: 3, station: null, house: null, invalidStation: 'not a station!' },
  ]);
  assert.equal(config.interval, 30);
  assert.equal(config.language, 'de');
  assert.deepEqual(normalizeConfig(null), {
    apiKey: '',
    slots: [],
    interval: 10,
    language: 'auto',
  });
});

test('the automatic language: the last widget, else the timezone', () => {
  assert.deepEqual(
    [
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'America/Argentina/Cordoba',
      'Asia/Tokyo',
      '',
    ].map(guessLanguage),
    ['fr', 'de', 'es', 'es', 'en', 'en'],
  );
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'it' }, 'fr'), 'fr');
});
