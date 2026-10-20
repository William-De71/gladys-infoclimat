import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInfoclimatClient, kindOf, utcDate } from '../src/infoclimat-api.js';
import { fakeInfoclimat, KEY } from './helpers/fake-api.js';

const client = (api, token = KEY) =>
  createInfoclimatClient({ getToken: () => token, userAgent: 'test/1', fetch: api });

test('the request: version 2, every station, both dates, the User-Agent', async () => {
  const api = fakeInfoclimat();
  const data = await client(api).observations(['000C7', 'STATIC0495'], {
    start: '2026-10-20',
    end: '2026-10-20',
  });
  assert.equal(data.status, 'OK');
  assert.deepEqual(api.calls[0].stations, ['000C7', 'STATIC0495']);
  assert.equal(api.calls[0].userAgent, 'test/1');
  assert.deepEqual(Object.keys(data.hourly), ['000C7', 'STATIC0495', '_params']);
});

test('the refusals of Infoclimat, the token never repeated', async () => {
  const api = fakeInfoclimat();
  await assert.rejects(
    client(api, 'abcdefghijklmnop').observations(['000C7'], {
      start: '2026-10-20',
      end: '2026-10-20',
    }),
    (err) => {
      assert.equal(err.kind, 'auth');
      assert.doesNotMatch(err.message, /abcdefghijklmnop/);
      assert.match(err.message, /No account found/);
      return true;
    },
  );
  api.dropToken = true;
  await assert.rejects(
    client(api).observations(['000C7'], { start: '2026-10-20', end: '2026-10-20' }),
    {
      kind: 'auth',
      message: /Could not authenticate request/,
    },
  );
  await assert.rejects(
    client(api, '').observations(['000C7'], { start: '2026-10-20', end: '2026-10-20' }),
    {
      kind: 'auth',
    },
  );
});

test('network errors, 429, 5xx; never more than 7 days nor zero stations', async () => {
  const api = fakeInfoclimat();
  api.offline = true;
  await assert.rejects(client(api).stations(), { kind: 'unreachable', message: 'ENOTFOUND' });
  api.offline = false;
  api.status = 429;
  await assert.rejects(
    client(api).observations(['A'], { start: '2026-10-20', end: '2026-10-20' }),
    { kind: 'rate_limit' },
  );
  api.status = 503;
  await assert.rejects(client(api).stations(), { kind: 'failed' });
  await assert.rejects(
    client(api).observations(['A'], { start: '2026-10-01', end: '2026-10-20' }),
    { kind: 'invalid' },
  );
  await assert.rejects(client(api).observations([], { start: '2026-10-20', end: '2026-10-20' }), {
    kind: 'invalid',
  });
  assert.equal(api.calls.length, 3, 'the invalid requests are never sent');
});

test('one request at a time', async () => {
  let running = 0;
  let most = 0;
  const api = fakeInfoclimat();
  const slow = async (url, init) => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return api(url, init);
  };
  const infoclimat = client(slow);
  await Promise.all([infoclimat.stations(), infoclimat.stations(), infoclimat.stations()]);
  assert.equal(most, 1);
});

test('helpers', () => {
  assert.equal(kindOf('Could not authenticate request', 200), 'auth');
  assert.equal(kindOf('', 500), 'failed');
  assert.equal(kindOf('', 404), 'invalid');
  assert.equal(utcDate(Date.parse('2026-10-20T23:59:00Z')), '2026-10-20');
});
