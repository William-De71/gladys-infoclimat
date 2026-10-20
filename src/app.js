// -----------------------------------------------------------------------------
// The Infoclimat integration: every handler, registered on a Gladys client.
//
// Brings the weather stations of Infoclimat (the StatIC network of its
// members, and the official stations typed by their identifier) into Gladys,
// for up to three stations — the nearest one of a house of Gladys, or one
// chosen by its identifier — with the open data key of the user:
//   - devices (device.js): one per station, a feature per measure it gives;
//   - scene triggers (events.js): rain started / stopped, station silent /
//     back, key refused;
//   - scene action: read the weather of a station (values and a sentence);
//   - dashboard widgets (widgets.js): the latest reading, 24 hours of a
//     measure, the stations side by side.
//
// Fair use of a volunteer platform: ONE request for all the stations every
// 10 minutes by default (15, 30 or 60 in the configuration, never less than
// 10), on the integration's own timer — never on a Gladys poll, never on a
// widget, never twice in a row on a button. A restart waits for the time
// left (kept in /data), a failure waits longer each time (up to an hour), a
// refused key is tried again every 6 hours only (it may be bound to an IP
// address that changes). The public list of the stations is read once a day
// at most, and only to find the station nearest to a house or to name one.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake Infoclimat (test/helpers/fake-api.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createInfoclimatClient, utcDate } from './infoclimat-api.js';
import { parseStationList, nearestStation, findStation, MAX_AGE_MS } from './stations.js';
import { parseObservations } from './parse.js';
import { mergeReadings, currentOf, MINUTE_MS, HOUR_MS } from './history.js';
import { createStore, DEFAULT_DIR } from './store.js';
import {
  idsOf,
  stationKey,
  keyOfExternalId,
  buildStationDevice,
  buildStationStates,
} from './device.js';
import {
  TRIGGERS,
  SCENE_ACTIONS,
  detectTransitions,
  stationData,
  weatherOutputs,
} from './events.js';
import {
  WIDGETS,
  TTL_SECONDS,
  messageContent,
  buildCurrentWidget,
  buildHistoryWidget,
  buildCompareWidget,
} from './widgets.js';
import { defaultTimeZone, formatTime } from './time.js';
import { t, all, ago, formatNumber, LANGUAGES } from './i18n.js';
import { round } from './measures.js';

const ACTIONS = { READ_NOW: 'read_now', DIAGNOSTIC: 'diagnostic' };
const TICK_MS = MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// No burst at startup: the first reading waits a little, even when due.
const STARTUP_DELAY_MS = 20 * 1000;
const MAX_BACKOFF_MS = HOUR_MS;
const RATE_LIMIT_MS = HOUR_MS;
const AUTH_RETRY_MS = 6 * HOUR_MS;
// The "Read now" button never sends two requests within this time.
const READ_NOW_MIN_MS = 2 * MINUTE_MS;
const LIST_RETRY_MS = HOUR_MS;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const USER_AGENT = `gladys-infoclimat/${VERSION} (+https://github.com/William-De71/gladys-infoclimat)`;

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport of Infoclimat (tests).
 * @param {string} [options.baseUrl] - The site root (tests).
 * @param {string} [options.dataDir] - The writable folder (/data).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of the texts (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    baseUrl,
    dataDir = DEFAULT_DIR,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = guessLanguage(timeZone);
  let createdDevices = new Set();
  // The followed stations: `{ slot, id, typed, house, houseName, distanceKm,
  // deviceId }`; and the slots that could not be resolved.
  let stations = [];
  let slotErrors = [];
  let lastStatus = null;
  let lastDiscovery = null;
  let timer = null;
  let startTimer = null;
  let reading = null;
  let stopped = false;

  const store = createStore({ dir: dataDir, logger });
  const api = createInfoclimatClient({
    getToken: () => config.apiKey,
    userAgent: USER_AGENT,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  });

  /**
   * @description Remember the language of a widget request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!LANGUAGES.includes(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description What is kept of a station.
   * @param {string} id - The station identifier.
   * @returns {object} `{ name, meta, params, readings, seen, lastAt }`.
   */
  function stateOf(id) {
    store.data.stations[id] ??= { params: [], readings: [], seen: {} };
    const state = store.data.stations[id];
    state.params ??= [];
    state.readings ??= [];
    state.seen ??= {};
    return state;
  }

  /**
   * @description The view of a station the widgets and scenes use.
   * @param {object} station - A followed station.
   * @returns {object} `{ id, deviceId, name, params, license, licenseText,
   * elevation, distanceKm, house }`.
   */
  function viewOf(station) {
    const state = stateOf(station.id);
    const listed = findStation(store.list.stations, station.id);
    return {
      id: station.id,
      deviceId: station.deviceId,
      name: listed?.name || state.meta?.name || station.id,
      params: state.params,
      license: listed?.license ?? null,
      licenseText: state.meta?.licenseText ?? null,
      elevation: listed?.altitude ?? state.meta?.elevation ?? null,
      distanceKm: station.distanceKm ?? null,
      house: station.houseName ?? null,
    };
  }

  /**
   * @description The values of a station now.
   * @param {string} id - The station identifier.
   * @returns {object|null} `{ at, values }`.
   */
  const currentOfStation = (id) => currentOf(stateOf(id).readings);

  /**
   * @description "13:50" in the timezone of Gladys.
   * @param {number} instant - The instant.
   * @param {string} [lang] - The language.
   * @returns {string} The time.
   */
  const timeText = (instant, lang = textLanguage()) =>
    formatTime(instant, { language: lang, timeZone, now: now() });

  // --- Errors and status -------------------------------------------------------------

  /**
   * @description The message of an error, for a user.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function errorText(err, lang) {
    const key = {
      auth: 'errAuth',
      no_key: 'errNoKey',
      rate_limit: 'errRateLimit',
      unreachable: 'errUnreachable',
      invalid_station: 'errInvalidStation',
      unknown_house: 'errUnknownHouse',
      house_no_location: 'errHouseNoLocation',
      no_nearby: 'errNoNearby',
      no_list: 'errNoList',
      no_reading: 'errNoReading',
    }[err?.kind];
    return t(key ?? 'errFailed', lang, {
      slot: err?.slot ?? '',
      station: err?.station ?? '',
      name: err?.name ?? '',
      detail: String(err?.message ?? '').slice(0, 120),
    });
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const clipped = Object.fromEntries(
      Object.entries(message).map(([lang, text]) => [lang, text.slice(0, 200)]),
    );
    const signature = JSON.stringify([connected, clipped]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, clipped);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description When the next reading is due.
   * @returns {number} The instant (ms).
   */
  function nextDue() {
    const { lastAttempt, failures, error } = store.data.fetch;
    if (!lastAttempt) {
      return 0;
    }
    const interval = config.interval * MINUTE_MS;
    if (!failures) {
      // A station added since the last request is read soon, not in 10 minutes.
      const asked = store.data.fetch.ids ?? [];
      const added = stations.some((station) => !asked.includes(station.id));
      return lastAttempt + (added ? READ_NOW_MIN_MS : interval);
    }
    if (error?.kind === 'auth') {
      return lastAttempt + AUTH_RETRY_MS;
    }
    const backoff = Math.min(MAX_BACKOFF_MS, interval * 2 ** (failures - 1));
    return (
      lastAttempt + (error?.kind === 'rate_limit' ? Math.max(RATE_LIMIT_MS, backoff) : backoff)
    );
  }

  /**
   * @description Work out the connection status.
   * @returns {Promise<void>}
   */
  async function refreshStatus() {
    if (!config.apiKey) {
      await reportStatus(false, all('statusNoKey'));
      return;
    }
    const { error, lastSuccess } = store.data.fetch;
    if (error?.kind === 'auth') {
      await reportStatus(false, all('errAuth'));
      return;
    }
    if (stations.length === 0) {
      await reportStatus(
        true,
        slotErrors.length
          ? all((lang) => errorText(slotErrors[0].err, lang))
          : all('statusNoStation'),
      );
      return;
    }
    if (error) {
      const minutes = Math.max(1, Math.ceil((nextDue() - now()) / MINUTE_MS));
      await reportStatus(
        false,
        all((lang) =>
          t('statusFailing', lang, {
            detail: errorText(error, lang),
            when: t('inMinutes', lang, { n: minutes }),
          }),
        ),
      );
      return;
    }
    if (!lastSuccess) {
      await reportStatus(true, all('statusWaiting'));
      return;
    }
    const line = (station, lang) => {
      const current = currentOfStation(station.id);
      const value = Number.isFinite(current?.values.temperature)
        ? `${formatNumber(round('temperature', current.values.temperature), lang)} °C`
        : '–';
      return t('stationLine', lang, { name: viewOf(station).name, value });
    };
    const failing = [
      ...slotErrors.map(({ err }) => err),
      ...stations
        .filter((station) => !currentOfStation(station.id))
        .map((station) => ({ kind: 'no_reading', name: viewOf(station).name })),
    ];
    const ok = (lang) =>
      t('statusOk', lang, {
        count: stations.length,
        ago: ago(lastSuccess, now(), lang),
        stations: stations.map((station) => line(station, lang)).join(', '),
      });
    if (failing.length) {
      const total = stations.length + slotErrors.length;
      await reportStatus(
        true,
        all((lang) =>
          t('statusSomeFailing', lang, {
            ok: total - failing.length,
            total,
            detail: errorText(failing[0], lang),
          }),
        ),
      );
      return;
    }
    await reportStatus(true, all(ok));
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  /**
   * @description Ask the open widgets to pull their content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  /**
   * @description Publish scene events, one by one.
   * @param {Array<{ key: string, data: object }>} events - The events.
   * @returns {Promise<void>}
   */
  async function publishEvents(events) {
    for (const { key, data } of events) {
      logger.info(`Infoclimat: ${key}${data.station_name ? ` (${data.station_name})` : ''}`);
      try {
        await gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Unable to fire ${key}: ${err.message}`);
      }
    }
  }

  // --- Stations ----------------------------------------------------------------------

  /**
   * @description Make sure the public list of the stations is there (read once a day at most).
   * @returns {Promise<void>}
   */
  async function ensureList() {
    const fresh = now() - store.list.at < DAY_MS;
    const triedLately = now() - store.list.tried < LIST_RETRY_MS;
    if (fresh || triedLately) {
      return;
    }
    store.list.tried = now();
    try {
      const parsed = parseStationList(await api.stations());
      if (parsed.length) {
        store.list.stations = parsed;
        store.list.at = now();
        await store.saveList();
        logger.info(`Infoclimat: ${parsed.length} stations in the public list`);
      }
    } catch (err) {
      logger.warn(
        `Unable to read the list of the stations (${err.kind ?? 'error'}): ${err.message}`,
      );
    }
  }

  /**
   * @description Whether a station reported within 24 hours, by the list or by our readings.
   * @param {string} id - The station identifier.
   * @returns {boolean} True when it reports.
   */
  function reports(id) {
    const listed = findStation(store.list.stations, id);
    const last = Math.max(listed?.lastActivity ?? 0, currentOfStation(id)?.at ?? 0);
    return now() - last < MAX_AGE_MS;
  }

  /**
   * @description Resolve the configured slots: a station typed by hand, or the
   * nearest station of a house (kept while it reports).
   * @returns {Promise<void>}
   */
  async function resolveStations() {
    const resolved = [];
    const errors = [];
    const needsList =
      config.slots.some((slot) => slot.house) ||
      config.slots.some((slot) => slot.station && !stateOf(slot.station).meta?.name);
    if (needsList) {
      await ensureList();
    }
    let houses = null;
    const fail = (slot, kind, extra = {}) => {
      errors.push({
        slot: slot.slot,
        err: Object.assign(new Error(kind), { kind, slot: slot.slot, ...extra }),
      });
    };
    for (const slot of config.slots) {
      if (slot.invalidStation) {
        fail(slot, 'invalid_station', { station: slot.invalidStation });
        continue;
      }
      let station;
      if (slot.station) {
        station = { slot: slot.slot, id: slot.station, typed: true, distanceKm: null };
      } else {
        houses ??= await gladys.getHouses().catch((err) => {
          logger.warn(`Unable to read the houses: ${err.message}`);
          return null;
        });
        const house = houses?.find((candidate) => candidate.selector === slot.house);
        if (!houses || !house) {
          // Houses unreadable: keep the station chosen before, if any.
          const kept = store.data.nearest[slot.house];
          if (!houses && kept?.id) {
            station = { slot: slot.slot, id: kept.id, typed: false, house: slot.house };
          } else {
            fail(slot, 'unknown_house');
            continue;
          }
        } else if (!Number.isFinite(house.latitude) || !Number.isFinite(house.longitude)) {
          fail(slot, 'house_no_location');
          continue;
        } else {
          const point = { latitude: house.latitude, longitude: house.longitude };
          const kept = store.data.nearest[slot.house];
          const same =
            kept?.id && kept.latitude === point.latitude && kept.longitude === point.longitude;
          // The station chosen before stays while it reports: no flapping
          // between two stations at the same distance.
          let chosen =
            same && reports(kept.id) ? { id: kept.id, distanceKm: kept.distanceKm } : null;
          if (!chosen) {
            const nearest = nearestStation(store.list.stations, point, now());
            if (nearest) {
              chosen = {
                id: nearest.station.id,
                distanceKm: Math.round(nearest.distanceKm * 10) / 10,
              };
            } else if (same) {
              // No list, or nothing reports around: keep the one we had.
              chosen = { id: kept.id, distanceKm: kept.distanceKm };
            } else {
              fail(slot, store.list.stations.length ? 'no_nearby' : 'no_list');
              continue;
            }
          }
          if (kept?.id !== chosen.id) {
            logger.info(
              `Infoclimat: house ${slot.slot} -> station ${chosen.id} (${chosen.distanceKm} km)`,
            );
          }
          store.data.nearest[slot.house] = { ...chosen, ...point };
          station = {
            slot: slot.slot,
            id: chosen.id,
            typed: false,
            house: slot.house,
            houseName: house.name || slot.house,
            distanceKm: chosen.distanceKm ?? null,
          };
        }
      }
      if (resolved.some((other) => other.id === station.id)) {
        continue;
      }
      station.deviceId = idsOf(gladys, station.id).device;
      if (!station.houseName && station.house) {
        station.houseName = station.house;
      }
      resolved.push(station);
    }
    stations = resolved;
    slotErrors = errors;
    // /data keeps the followed stations only.
    for (const id of Object.keys(store.data.stations)) {
      if (!resolved.some((station) => station.id === id)) {
        delete store.data.stations[id];
      }
    }
    await store.save();
  }

  /**
   * @description Offer a device per station on the Discovery screen, when they changed.
   * A station is offered once it gave a measure.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = stations
      .map((station) => viewOf(station))
      .filter((view) => view.params.length > 0)
      .map((view) => buildStationDevice(gladys, view, lang))
      .filter((device) => device.features.length > 0);
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of a station, when its device exists.
   * @param {object} station - A followed station.
   * @returns {Promise<void>}
   */
  async function publishStates(station) {
    if (!createdDevices.has(station.deviceId)) {
      return;
    }
    const states = buildStationStates(gladys, viewOf(station), currentOfStation(station.id));
    if (states.length) {
      await gladys
        .publishChangedStates(states)
        .catch((err) =>
          logger.warn(`Unable to publish the states of ${station.id}: ${err.message}`),
        );
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description The UTC dates to ask for: from the oldest last reading
   * (24 hours at most), to today.
   * @returns {{ start: string, end: string }} The range.
   */
  function rangeOf() {
    const floor = now() - DAY_MS;
    const oldest = Math.min(
      ...stations.map((station) => (currentOfStation(station.id)?.at ?? floor) - HOUR_MS),
    );
    return { start: utcDate(Math.max(floor, oldest)), end: utcDate(now()) };
  }

  /**
   * @description Read all the stations in one request, and digest the answer.
   * @returns {Promise<void>}
   */
  async function fetchStations() {
    const fetchState = store.data.fetch;
    fetchState.lastAttempt = now();
    fetchState.ids = stations.map((station) => station.id);
    const requests = stations.map((station) => {
      const listed = findStation(store.list.stations, station.id);
      return { id: station.id, latitude: listed?.latitude, longitude: listed?.longitude };
    });
    let parsed;
    try {
      parsed = parseObservations(
        await api.observations(
          requests.map((r) => r.id),
          rangeOf(),
        ),
        requests,
      );
    } catch (err) {
      fetchState.failures += 1;
      fetchState.error = { kind: err.kind ?? 'failed', message: String(err.message).slice(0, 200) };
      logger.warn(`Infoclimat (${fetchState.error.kind}): ${fetchState.error.message}`);
      const events = [];
      if (err.kind === 'auth' && !store.data.keyRefused) {
        store.data.keyRefused = true;
        events.push({
          key: TRIGGERS.KEY_REFUSED,
          data: { message: fetchState.error.message.slice(0, 1000) },
        });
      }
      await store.save();
      await publishEvents(events);
      return;
    }
    fetchState.failures = 0;
    fetchState.error = null;
    fetchState.lastSuccess = now();
    store.data.keyRefused = false;
    const events = [];
    for (const station of stations) {
      const state = stateOf(station.id);
      const answer = parsed.get(station.id);
      if (answer) {
        state.readings = mergeReadings(state.readings, answer.readings, now());
        state.params = [...new Set([...state.params, ...answer.params])];
        if (answer.meta.name || answer.meta.licenseText) {
          state.meta = answer.meta;
        }
      } else {
        state.readings = mergeReadings(state.readings, [], now());
      }
      const current = currentOf(state.readings);
      // The rain of the day may be summed from the hours: it is a measure too.
      if (Number.isFinite(current?.values.rain_today) && !state.params.includes('rain_today')) {
        state.params.push('rain_today');
      }
      // A station never read yet (a wrong identifier?) is not "silent": its
      // first readings are the baseline of the triggers.
      if (current || state.seen.initialized) {
        const { events: fired, next } = detectTransitions(
          state.seen.initialized ? state.seen : {},
          current,
          now(),
        );
        state.seen = { ...next, initialized: true };
        const view = viewOf(station);
        events.push(...fired.map((key) => ({ key, data: stationData(view, current, now()) })));
      }
    }
    await store.save();
    await publishEvents(events);
    for (const station of stations) {
      await publishStates(station);
    }
  }

  /**
   * @description Read Infoclimat when it is due (one round at a time).
   * @param {object} [options] - `{ force }`: read now, whatever the timer says.
   * @returns {Promise<void>}
   */
  function readStations({ force = false } = {}) {
    if (!reading) {
      reading = (async () => {
        if (!config.apiKey || stations.length === 0) {
          await refreshStatus();
          return;
        }
        if (!force && now() < nextDue()) {
          await refreshStatus();
          return;
        }
        await fetchStations();
        await publishDiscoveredDevices().catch((err) =>
          logger.warn(`Unable to offer the devices: ${err.message}`),
        );
        refreshWidgets();
        await refreshStatus();
      })().finally(() => {
        reading = null;
      });
    }
    return reading;
  }

  /**
   * @description (Re)arm the reading timer.
   */
  function schedule() {
    clearInterval(timer);
    clearTimeout(startTimer);
    if (!timers || stopped) {
      return;
    }
    const tick = () => readStations().catch((err) => logger.error('Readings', err));
    startTimer = setTimeout(tick, STARTUP_DELAY_MS);
    startTimer.unref?.();
    timer = setInterval(tick, TICK_MS);
    timer.unref?.();
  }

  /**
   * @description Resolve the stations, offer the devices, arm the timer.
   * @returns {Promise<void>}
   */
  async function applyConfig() {
    await resolveStations();
    logger.info(
      `${stations.length} station(s): ${stations.map((station) => station.id).join(', ') || 'none'}` +
        (slotErrors.length ? `; ${slotErrors.length} not resolved` : ''),
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    for (const station of stations) {
      await publishStates(station);
    }
    await refreshStatus();
    schedule();
  }

  /**
   * @description The station a widget or a scene action targets.
   * @param {unknown} externalId - The `source: "devices"` value.
   * @returns {object|null} The station, the first one by default.
   */
  function target(externalId) {
    const key = keyOfExternalId(externalId);
    return stations.find((station) => stationKey(station.id) === key) ?? stations[0] ?? null;
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The common start of a widget: a key, a station.
   * @param {object} settings - The widget settings.
   * @param {string} lang - The language.
   * @returns {{ station?: object, content?: object }} The station, or the content to show.
   */
  function widgetStation(settings, lang) {
    if (!config.apiKey) {
      return { content: messageContent(t('statusNoKey', lang)) };
    }
    if (store.data.fetch.error?.kind === 'auth') {
      return { content: messageContent(t('errAuth', lang)) };
    }
    const station = target(settings.station);
    if (!station) {
      return { content: messageContent(t('widgetNoStation', lang)) };
    }
    return { station };
  }

  gladys.onWidgetGet(WIDGETS.CURRENT, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const { station, content } = widgetStation(settings, lang);
    if (content) {
      return content;
    }
    return buildCurrentWidget({
      station: viewOf(station),
      current: currentOfStation(station.id),
      language: lang,
      timeZone,
      now: now(),
      interval: config.interval,
    });
  });

  gladys.onWidgetGet(WIDGETS.HISTORY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const { station, content } = widgetStation(settings, lang);
    if (content) {
      return content;
    }
    return buildHistoryWidget({
      station: viewOf(station),
      readings: stateOf(station.id).readings,
      current: currentOfStation(station.id),
      measure: settings.measure,
      language: lang,
      now: now(),
      interval: config.interval,
    });
  });

  gladys.onWidgetGet(WIDGETS.COMPARE, async ({ language: lang }) => {
    rememberLanguage(lang);
    if (!config.apiKey) {
      return messageContent(t('statusNoKey', lang));
    }
    if (store.data.fetch.error?.kind === 'auth') {
      return messageContent(t('errAuth', lang), { ttl: TTL_SECONDS.message });
    }
    return buildCompareWidget({
      stations: stations.map((station) => ({
        station: viewOf(station),
        current: currentOfStation(station.id),
      })),
      language: lang,
      timeZone,
      now: now(),
    });
  });

  // --- Scene action ------------------------------------------------------------------
  // Answers from the last reading (at most `interval` minutes old): an action
  // never sends a request of its own.
  gladys.onSceneAction(SCENE_ACTIONS.GET_WEATHER, async (fields = {}) => {
    if (!config.apiKey) {
      throw new Error('The Infoclimat key is not configured');
    }
    const station = target(fields.station);
    if (!station) {
      throw new Error('No Infoclimat station is configured');
    }
    const lang = textLanguage();
    return weatherOutputs(viewOf(station), currentOfStation(station.id), {
      language: lang,
      now: now(),
      formatTime: (instant) => timeText(instant, lang),
    });
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.READ_NOW, async () => {
    if (!config.apiKey) {
      return all('statusNoKey');
    }
    await resolveStations();
    if (stations.length === 0) {
      return slotErrors.length
        ? all((lang) => errorText(slotErrors[0].err, lang))
        : all('statusNoStation');
    }
    const last = store.data.fetch.lastAttempt;
    if (last && now() - last < READ_NOW_MIN_MS) {
      const minutes = Math.max(1, Math.ceil((nextDue() - now()) / MINUTE_MS));
      return all((lang) =>
        t('readTooSoon', lang, {
          ago: ago(last, now(), lang),
          when: t('inMinutes', lang, { n: minutes }),
        }),
      );
    }
    await readStations({ force: true });
    const error = store.data.fetch.error;
    if (error) {
      return all((lang) => errorText(error, lang).slice(0, 200));
    }
    return all((lang) => {
      const lines = [
        ...stations.map((station) => {
          const current = currentOfStation(station.id);
          const view = viewOf(station);
          if (!current) {
            return errorText({ kind: 'no_reading', name: view.name }, lang);
          }
          const value = Number.isFinite(current.values.temperature)
            ? ` ${formatNumber(round('temperature', current.values.temperature), lang)} °C`
            : '';
          return `${view.name}${value} (${timeText(current.at, lang)})`;
        }),
        ...slotErrors.map(({ err }) => errorText(err, lang)),
      ];
      return t('readDone', lang, { stations: lines.join(' · ') }).slice(0, 1000);
    });
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const { fetch: fetchState } = store.data;
    const iso = (value) => (value ? new Date(value).toISOString() : null);
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      key: config.apiKey ? 'set' : 'missing',
      interval: config.interval,
      language: config.language,
      lastAttempt: iso(fetchState.lastAttempt),
      lastSuccess: iso(fetchState.lastSuccess),
      failures: fetchState.failures,
      error: fetchState.error,
      nextDue: iso(nextDue()),
      list: { at: iso(store.list.at), stations: store.list.stations.length },
      stations: stations.map((station) => {
        const state = stateOf(station.id);
        const current = currentOfStation(station.id);
        return {
          slot: station.slot,
          id: station.id,
          typed: station.typed,
          distanceKm: station.distanceKm ?? null,
          created: createdDevices.has(station.deviceId),
          params: state.params,
          readings: state.readings.length,
          lastReading: iso(current?.at),
          values: current?.values ?? null,
          seen: state.seen,
        };
      }),
      slotErrors: slotErrors.map(({ slot, err }) => `${slot}: ${err.kind}`),
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Infoclimat diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolveStations();
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} device(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    for (const station of stations) {
      await publishStates(station);
    }
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const previousKey = config.apiKey;
    await loadConfig(rawConfig);
    logger.info('Configuration updated');
    lastStatus = null;
    lastDiscovery = null;
    if (config.apiKey !== previousKey && store.data.fetch.error) {
      // A new key: what the old one could not read is tried again at the next tick.
      store.data.fetch.failures = 0;
      store.data.fetch.error = null;
      store.data.fetch.lastAttempt = 0;
    }
    await applyConfig();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await store.load();
      await loadConfig();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await applyConfig();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearInterval(timer);
    clearTimeout(startTimer);
    await store.save();
  });

  return {
    store,
    readStations,
    applyConfig,
    nextDue,
    getStations: () => stations,
    getSlotErrors: () => slotErrors,
    whenReady: () => startup,
  };
}

export { createApp, ACTIONS, USER_AGENT, AUTH_RETRY_MS, READ_NOW_MIN_MS };
