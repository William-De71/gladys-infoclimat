// -----------------------------------------------------------------------------
// Configuration of the Infoclimat integration.
//
// Fields of the config_schema:
//   - `api_key`      the Infoclimat open data key of the user (a `secret`:
//                    never sent back to the UI, never logged);
//   - `house_<n>`    a house of Gladys (`source: "houses"`, its selector):
//                    the nearest StatIC station that reported in the last
//                    24 hours is followed;
//   - `station_<n>`  or the identifier of a station, typed by hand ("000P2",
//                    "STATIC0095", or an official station missing from the
//                    public list): it wins over the house;
//   - `interval`     minutes between two readings: 10, 15, 30 or 60 (fair
//                    use of a volunteer platform: never less than 10);
//   - `language`     language of the texts Gladys does not ask for in a
//                    language (device names, scene texts): `auto` follows
//                    the language of the last widget, or the timezone.
// Up to three stations (`<n>` from 1 to 3).
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const MAX_STATIONS = 3;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const INTERVALS = [10, 15, 30, 60];
const DEFAULT_INTERVAL = 10;

const readString = (raw) =>
  typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';

/**
 * @description Read a station identifier typed by hand.
 * @param {unknown} raw - "000p2", " STATIC0095 ", 7149 (a number).
 * @returns {string|null} The identifier in upper case, null when it is not one.
 * @example
 * readStationId(' static0095 '); // -> 'STATIC0095'
 */
function readStationId(raw) {
  const value = readString(raw).toUpperCase();
  return /^[A-Z0-9_-]{2,20}$/.test(value) ? value : null;
}

/**
 * @description Read the interval between two readings.
 * @param {unknown} raw - "15", 30.
 * @returns {number} Minutes, one of INTERVALS (10 by default).
 */
function readInterval(raw) {
  const value = Number.parseInt(readString(raw), 10);
  return INTERVALS.includes(value) ? value : DEFAULT_INTERVAL;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ apiKey, slots: [{ slot, station, house, invalidStation }],
 * interval, language }`; a slot without a station nor a house is left out.
 * @example
 * normalizeConfig({ api_key: 'k', station_1: '000P2' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const slots = [];
  for (let slot = 1; slot <= MAX_STATIONS; slot += 1) {
    const typed = readString(config[`station_${slot}`]);
    const station = typed ? readStationId(typed) : null;
    const house = readString(config[`house_${slot}`]) || null;
    if (typed || house) {
      slots.push({
        slot,
        station,
        house: station ? null : house,
        invalidStation: typed && !station ? typed.slice(0, 20) : null,
      });
    }
  }
  return {
    apiKey: readString(config.api_key),
    slots,
    interval: readInterval(config.interval),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

// The timezones of the countries that speak the languages of the integration:
// the automatic language before any widget was shown.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Costa_Rica',
    'America/Panama',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) {
    return 'es';
  }
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  MAX_STATIONS,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  INTERVALS,
  DEFAULT_INTERVAL,
  readStationId,
  readInterval,
  normalizeConfig,
  guessLanguage,
  readLanguage,
};
