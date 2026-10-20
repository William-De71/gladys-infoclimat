// -----------------------------------------------------------------------------
// What the integration keeps across restarts, under /data (the only writable
// place of the container):
//
//   /data/infoclimat.json
//     - `fetch`     when the observations were last asked for and obtained,
//                   the failures in a row and the last error: a restart never
//                   sends a request before its time (no burst at startup);
//     - `stations`  per station: its name and metadata, the measures it ever
//                   gave (`params`: a feature never disappears because of one
//                   empty reading), the readings of the last 26 hours at most
//                   (the 24-hour chart), and what the scene triggers already
//                   know (`raining`, `silent`);
//     - `nearest`   the station chosen for each house, kept while it reports;
//     - `keyRefused` whether the key was refused (the trigger fires once).
//   /data/stations.json
//     the public list of the stations and when it was read (once a day at
//     most, only when a house is configured or a name is unknown).
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DEFAULT_DIR = '/data';
const EMPTY = () => ({
  fetch: { lastAttempt: 0, lastSuccess: 0, failures: 0, error: null, ids: [] },
  stations: {},
  nearest: {},
  keyRefused: false,
});
const EMPTY_LIST = () => ({ at: 0, tried: 0, stations: [] });

/**
 * @description Read a JSON file; an absent or broken file is null.
 * @param {string} path - The file.
 * @param {object} [logger] - Logger.
 * @returns {Promise<object|null>} The value.
 */
async function readJson(path, logger) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger?.warn(`Unable to read ${path}: ${err.message}`);
    }
    return null;
  }
}

/**
 * @description Write a JSON file atomically (a temporary file, then a rename).
 * @param {string} path - The file.
 * @param {object} value - The value.
 * @param {object} [logger] - Logger.
 * @returns {Promise<void>}
 */
async function writeJson(path, value, logger) {
  try {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, JSON.stringify(value));
    await rename(temporary, path);
  } catch (err) {
    logger?.warn(`Unable to write ${path}: ${err.message}`);
  }
}

/**
 * @description The store.
 * @param {object} [options] - `{ dir, logger }`.
 * @returns {object} `{ data, list, load, save, saveList }`.
 */
function createStore({ dir = DEFAULT_DIR, logger } = {}) {
  const paths = { state: join(dir, 'infoclimat.json'), list: join(dir, 'stations.json') };
  const store = {
    data: EMPTY(),
    list: EMPTY_LIST(),
    /**
     * @description Read both files.
     * @returns {Promise<void>}
     */
    async load() {
      const raw = (await readJson(paths.state, logger)) ?? {};
      const base = EMPTY();
      const part = (name) => (raw[name] && typeof raw[name] === 'object' ? raw[name] : {});
      store.data = {
        fetch: { ...base.fetch, ...part('fetch') },
        stations: { ...part('stations') },
        nearest: { ...part('nearest') },
        keyRefused: raw.keyRefused === true,
      };
      const list = (await readJson(paths.list, logger)) ?? {};
      store.list = {
        at: Number.isFinite(list.at) ? list.at : 0,
        tried: 0,
        stations: Array.isArray(list.stations) ? list.stations : [],
      };
    },
    /**
     * @description Write the state.
     * @returns {Promise<void>}
     */
    save() {
      return writeJson(paths.state, store.data, logger);
    },
    /**
     * @description Write the list of the stations.
     * @returns {Promise<void>}
     */
    saveList() {
      return writeJson(paths.list, { at: store.list.at, stations: store.list.stations }, logger);
    },
  };
  return store;
}

export { DEFAULT_DIR, createStore };
