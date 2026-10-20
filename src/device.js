// -----------------------------------------------------------------------------
// The devices of the integration, offered on the Discovery screen.
//
// "Infoclimat <station name>": one per followed station, offered once its
// first readings arrived (they tell which measures it gives). Read-only
// features, only for the measures the station gives (measures.js):
// temperature, humidity, pressure, dew point, mean wind, gust, wind direction,
// rain over the last hour, rain of the day, snow depth, visibility. A measure
// once given stays a feature for good (the list is kept in /data): an empty
// reading never makes a feature disappear and come back.
//
// External ids: the station identifier, in lower case —
// `ext:infoclimat:station:000p2`. `should_poll` stays false: the integration
// reads Infoclimat on its own timer (every 10 minutes by default).
// -----------------------------------------------------------------------------

import { FEATURE_KEYS, measureOf, round } from './measures.js';
import { t } from './i18n.js';

const DEVICE_TYPE = 'station';

/**
 * @description The key of a station: its identifier, in lower case.
 * @param {string} id - "000P2", "STATIC0095".
 * @returns {string} "000p2".
 */
const stationKey = (id) =>
  String(id ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');

/**
 * @description The external ids of a station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The station identifier.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, id) => gladys.externalIds(DEVICE_TYPE, stationKey(id));

/**
 * @description The station key of a device (or feature) external id.
 * @param {unknown} externalId - The id.
 * @returns {string|null} The key.
 * @example
 * keyOfExternalId('ext:infoclimat:station:000p2:temperature'); // -> '000p2'
 */
function keyOfExternalId(externalId) {
  const match = /:station:([a-z0-9_-]+?)(?::[a-z_0-9]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The feature keys of the measures a station gives, in a stable order.
 * @param {string[]} params - The measures it ever gave.
 * @returns {string[]} The feature keys.
 */
const featureKeysOf = (params) => FEATURE_KEYS.filter((key) => (params ?? []).includes(key));

/**
 * @description Build the device of a station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} station - `{ id, name, params, license }`.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildStationDevice(gladys, station, language = 'en') {
  const ids = idsOf(gladys, station.id);
  const params = [{ name: 'INFOCLIMAT_STATION_ID', value: station.id }];
  if (station.license) {
    params.push({ name: 'INFOCLIMAT_LICENSE', value: station.license });
  }
  return {
    name: t('deviceName', language, { name: station.name || station.id }).slice(0, 100),
    external_id: ids.device,
    model: 'Infoclimat',
    should_poll: false,
    params,
    features: featureKeysOf(station.params).map((key) => {
      const measure = measureOf(key);
      return {
        name: t(`measure_${key}`, language),
        external_id: ids.feature(key),
        ...measure.feature,
        min: measure.min,
        max: measure.max,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      };
    }),
  };
}

/**
 * @description The states of a station now. A measure missing from the
 * latest readings is left untouched: a 0 would be a lie.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} station - `{ id, params }`.
 * @param {object|null} current - `{ at, values }` (history.currentOf).
 * @returns {object[]} `{ device_feature_external_id, state }`.
 */
function buildStationStates(gladys, station, current) {
  if (!current) {
    return [];
  }
  const ids = idsOf(gladys, station.id);
  return featureKeysOf(station.params)
    .filter((key) => Number.isFinite(current.values[key]))
    .map((key) => ({
      device_feature_external_id: ids.feature(key),
      state: round(key, current.values[key]),
    }));
}

export {
  DEVICE_TYPE,
  stationKey,
  idsOf,
  keyOfExternalId,
  featureKeysOf,
  buildStationDevice,
  buildStationStates,
};
