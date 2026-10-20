// -----------------------------------------------------------------------------
// The measures of a station, from the columns of the Infoclimat open data
// export (contract `contracts/opendata-export.odcs.yaml` of
// github.com/AssociationInfoclimat/data-platform). Infoclimat already converts
// the units: degrees Celsius, hPa (mean sea level), %, km/h, degrees, mm, cm,
// m, W/m². Nothing is converted here.
//
// Each measure has an eternal `key` (the feature external id and the key in
// /data), the columns that carry it (an alias first seen in the wild second),
// its bounds (a value outside is a sensor fault, never published) and, when
// Gladys has a category for it, the shape of its feature. The global
// radiation (W/m²) has no unit in Gladys: it is shown in the widgets and
// given to the scenes, never a feature. The cloud cover (octas) and the
// present weather code (WMO) are not read: only a few official stations
// give them.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

const C = DEVICE_FEATURE_CATEGORIES;
const T = DEVICE_FEATURE_TYPES;
const U = DEVICE_FEATURE_UNITS;

const MEASURES = [
  {
    key: 'temperature',
    sources: ['temperature'],
    min: -60,
    max: 60,
    unit: '°C',
    decimals: 1,
    feature: { category: C.TEMPERATURE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.CELSIUS },
  },
  {
    key: 'humidity',
    sources: ['humidite'],
    min: 0,
    max: 100,
    unit: '%',
    decimals: 0,
    feature: { category: C.HUMIDITY_SENSOR, type: T.SENSOR.DECIMAL, unit: U.PERCENT },
  },
  {
    key: 'pressure',
    sources: ['pression'],
    min: 850,
    max: 1100,
    unit: 'hPa',
    decimals: 1,
    feature: { category: C.PRESSURE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.HECTO_PASCAL },
  },
  {
    // A temperature that is not the air's: `probe` keeps it out of the
    // temperature of the room the device may be placed in.
    key: 'dew_point',
    sources: ['point_de_rosee'],
    min: -60,
    max: 60,
    unit: '°C',
    decimals: 1,
    feature: {
      category: C.TEMPERATURE_SENSOR,
      type: T.TEMPERATURE_SENSOR.PROBE,
      unit: U.CELSIUS,
    },
  },
  {
    key: 'wind_speed',
    sources: ['vent_moyen'],
    min: 0,
    max: 400,
    unit: 'km/h',
    decimals: 1,
    feature: { category: C.SPEED_SENSOR, type: T.SPEED_SENSOR.DECIMAL, unit: U.KILOMETER_PER_HOUR },
  },
  {
    key: 'wind_gust',
    sources: ['vent_rafales', 'vent_rafales_10min'],
    min: 0,
    max: 400,
    unit: 'km/h',
    decimals: 1,
    feature: { category: C.SPEED_SENSOR, type: T.SPEED_SENSOR.DECIMAL, unit: U.KILOMETER_PER_HOUR },
  },
  {
    // The angle category has no type of its own: the generic `integer`.
    key: 'wind_direction',
    sources: ['vent_direction'],
    min: 0,
    max: 360,
    unit: '°',
    decimals: 0,
    feature: { category: C.ANGLE_SENSOR, type: T.SENSOR.INTEGER, unit: U.DEGREE },
  },
  {
    key: 'rain_1h',
    sources: ['pluie_1h'],
    min: 0,
    max: 300,
    unit: 'mm',
    decimals: 1,
    feature: {
      category: C.PRECIPITATION_SENSOR,
      type: T.PRECIPITATION_SENSOR.DECIMAL,
      unit: U.MILLIMETER_PER_HOUR,
    },
  },
  {
    // Since 00:00 UTC (the column of Infoclimat), or summed from the hours.
    key: 'rain_today',
    sources: ['pluie_cumul_0h'],
    min: 0,
    max: 1000,
    unit: 'mm',
    decimals: 1,
    feature: {
      category: C.PRECIPITATION_SENSOR,
      type: T.PRECIPITATION_SENSOR.DECIMAL,
      unit: U.MILLIMETER_PER_DAY,
    },
  },
  {
    key: 'snow_depth',
    sources: ['neige_au_sol'],
    min: 0,
    max: 1000,
    unit: 'cm',
    decimals: 0,
    feature: { category: C.DISTANCE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.CM },
  },
  {
    key: 'visibility',
    sources: ['visibilite'],
    min: 0,
    max: 100000,
    unit: 'm',
    decimals: 0,
    feature: { category: C.DISTANCE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.M },
  },
  {
    key: 'radiation',
    sources: ['radiations'],
    min: 0,
    max: 2000,
    unit: 'W/m²',
    decimals: 0,
    feature: null,
  },
];

const BY_KEY = new Map(MEASURES.map((measure) => [measure.key, measure]));
const FEATURE_KEYS = MEASURES.filter((measure) => measure.feature).map((measure) => measure.key);

/**
 * @description A measure by its key.
 * @param {string} key - The key.
 * @returns {object|undefined} The measure.
 */
const measureOf = (key) => BY_KEY.get(key);

/**
 * @description Round a value as its measure is shown.
 * @param {string} key - The measure.
 * @param {number} value - The value.
 * @returns {number} The value.
 */
function round(key, value) {
  const factor = 10 ** (BY_KEY.get(key)?.decimals ?? 1);
  return Math.round(value * factor) / factor;
}

export { MEASURES, FEATURE_KEYS, measureOf, round };
