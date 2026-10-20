// -----------------------------------------------------------------------------
// The public list of the Infoclimat stations (stations_xhr.php, no key).
//
// An entry, as read on 2026-10-20 (1,236 of them, mostly in France):
//   { "id": "000P2", "libelle": "Besançon", "departement": "25",
//     "latitude": 47.24878, "longitude": 6.01815, "altitude": 355,
//     "licence": 1, "pays": "FR", "genre": "static",
//     "last_report": "2026-10-19 07:10:00",
//     "derniere_activite": "2026-10-19 07:10:00" }
// The dates are UTC; "0000-00-00 00:00:00" means never. `licence`: 0 the
// French open licence (Etalab), 1 CC BY, 2 CC BY-NC (non commercial). `genre`:
// "static" (the StatIC network of the members) or "synop" (one entry). The
// official synoptic stations (Orly…) are not listed but can be read by their
// identifier: the configuration takes one typed by hand.
//
// The nearest station of a house is the closest one (haversine distance) whose
// last report is less than 24 hours old: a silent station is never chosen.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = DAY_MS;
const EARTH_RADIUS_KM = 6371;
const LICENSES = {
  0: { code: 'etalab', name: 'Licence Ouverte (Etalab)' },
  1: { code: 'cc-by', name: 'CC BY' },
  2: { code: 'cc-by-nc', name: 'CC BY-NC' },
};

/**
 * @description Read a UTC date of Infoclimat.
 * @param {unknown} value - "2026-10-20 11:50:00" (UTC, no zone).
 * @returns {number|null} The instant (ms), null for "0000-00-00 00:00:00" or garbage.
 */
function readUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    String(value ?? ''),
  );
  if (!match || match[1] === '0000') {
    return null;
  }
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const instant = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  return Number.isFinite(instant) ? instant : null;
}

/**
 * @description A license of a station, from the number of the list.
 * @param {unknown} licence - 0, 1 or 2.
 * @returns {{ code: string, name: string }|null} The license.
 */
const licenseOf = (licence) => LICENSES[Number(licence)] ?? null;

/**
 * @description A license by its code.
 * @param {string|null} code - "cc-by-nc".
 * @returns {{ code: string, name: string }|null} The license.
 */
const licenseByCode = (code) =>
  Object.values(LICENSES).find((license) => license.code === code) ?? null;

/**
 * @description Clean the public list.
 * @param {unknown} raw - The JSON array.
 * @returns {object[]} `{ id, name, department, country, latitude, longitude,
 * altitude, license, genre, lastActivity }`, entries without an id or a
 * position left out.
 */
function parseStationList(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const stations = [];
  for (const entry of raw) {
    const id = String(entry?.id ?? '')
      .trim()
      .toUpperCase();
    const latitude = Number(entry?.latitude);
    const longitude = Number(entry?.longitude);
    if (
      !/^[A-Z0-9_-]{2,20}$/.test(id) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    const altitude = Number(entry?.altitude);
    stations.push({
      id,
      name:
        String(entry?.libelle ?? id)
          .trim()
          .slice(0, 80) || id,
      department: String(entry?.departement ?? '').slice(0, 10),
      country: String(entry?.pays ?? '').slice(0, 3),
      latitude,
      longitude,
      altitude: Number.isFinite(altitude) ? altitude : null,
      license: licenseOf(entry?.licence)?.code ?? null,
      genre: String(entry?.genre ?? '').slice(0, 10),
      lastActivity: readUtc(entry?.derniere_activite) ?? readUtc(entry?.last_report),
    });
  }
  return stations;
}

/**
 * @description The distance between two points.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lon1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lon2 - Longitude of the second point.
 * @returns {number} Kilometres.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * @description The nearest station of a point that reported recently.
 * @param {object[]} stations - The parsed list.
 * @param {{ latitude: number, longitude: number }} point - The house.
 * @param {number} now - Now (ms).
 * @param {object} [options] - `{ maxAgeMs, exclude }`: the ids to skip.
 * @returns {{ station: object, distanceKm: number }|null} The station.
 */
function nearestStation(stations, point, now, { maxAgeMs = MAX_AGE_MS, exclude = [] } = {}) {
  let best = null;
  for (const station of stations) {
    if (
      !station.lastActivity ||
      now - station.lastActivity > maxAgeMs ||
      exclude.includes(station.id)
    ) {
      continue;
    }
    const distanceKm = haversineKm(
      point.latitude,
      point.longitude,
      station.latitude,
      station.longitude,
    );
    if (!best || distanceKm < best.distanceKm) {
      best = { station, distanceKm };
    }
  }
  return best;
}

/**
 * @description A station of the list by its identifier.
 * @param {object[]} stations - The parsed list.
 * @param {string} id - The identifier.
 * @returns {object|null} The station.
 */
const findStation = (stations, id) =>
  stations.find((station) => station.id === String(id ?? '').toUpperCase()) ?? null;

export {
  MAX_AGE_MS,
  LICENSES,
  readUtc,
  licenseOf,
  licenseByCode,
  parseStationList,
  haversineKm,
  nearestStation,
  findStation,
};
