// -----------------------------------------------------------------------------
// HTTP client of the Infoclimat open data (https://www.infoclimat.fr/opendata/).
//
//   GET /opendata/stations_xhr.php
//       the public list of the stations (no key): a JSON array;
//   GET /opendata/?version=2&method=get&format=json&stations[]=<id>…
//       &start=YYYY-MM-DD&end=YYYY-MM-DD&token=<key>
//       the observations of one or more stations, the dates in UTC and both
//       inclusive, 7 days at most per request.
//
// Answers seen on 2026-10-20:
//   - no token:          HTTP 200, text/html, "Could not authenticate request";
//   - an unknown token:  HTTP 400, JSON {"errors":["No account found for this token: '…'"]};
//   - a valid one:       HTTP 200, JSON {"status":"OK","errors":[],"hourly":{…},"stations":[…]}.
// A key may also be bound to the public IP address that asked for it: with a
// dynamic address it can stop working overnight — the same refusal.
//
// Infoclimat is a volunteer association that asks for a fair use: every
// request carries an identifiable User-Agent, the stations are read in ONE
// request, and the client never sends two requests at once. The key travels
// in the query string (the API takes nothing else): it is never logged, and
// the errors never carry the URL.
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.infoclimat.fr';
const PATHS = { stations: '/opendata/stations_xhr.php', observations: '/opendata/' };
const TIMEOUT_MS = 20000;
const MAX_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @description An error of the Infoclimat API, with a kind the messages can tell apart.
 */
class InfoclimatError extends Error {
  /**
   * @param {string} kind - `auth`, `rate_limit`, `unreachable`, `invalid`, `failed`.
   * @param {string} message - The message (never the URL: it holds the key).
   */
  constructor(kind, message) {
    super(message);
    this.name = 'InfoclimatError';
    this.kind = kind;
  }
}

/**
 * @description The kind of an error answer.
 * @param {string} message - The message of the API (or its body).
 * @param {number} status - The HTTP status.
 * @returns {string} The kind.
 */
function kindOf(message, status) {
  if (
    status === 401 ||
    status === 403 ||
    /could not authenticate|no account found|token|unauthori|forbidden/i.test(message)
  ) {
    return 'auth';
  }
  if (status === 429 || /too many|rate limit|quota|exceed/i.test(message)) {
    return 'rate_limit';
  }
  if (status >= 500) {
    return 'failed';
  }
  if (status >= 400) {
    return 'invalid';
  }
  return 'failed';
}

/**
 * @description "YYYY-MM-DD" of an instant, in UTC (the dates of the API).
 * @param {number} instant - The instant (ms).
 * @returns {string} The date.
 */
const utcDate = (instant) => new Date(instant).toISOString().slice(0, 10);

/**
 * @description The Infoclimat client.
 * @param {object} options - Options.
 * @param {Function} options.getToken - `() => string`.
 * @param {string} options.userAgent - The User-Agent of every request.
 * @param {Function} [options.fetch] - The fetch implementation (tests).
 * @param {string} [options.baseUrl] - The site root.
 * @returns {object} The client.
 */
function createInfoclimatClient({
  getToken,
  userAgent,
  fetch: fetchFn = globalThis.fetch,
  baseUrl = BASE_URL,
}) {
  let busy = Promise.resolve();

  /**
   * @description One request at a time: a request waits for the previous one.
   * @param {Function} task - `() => Promise`.
   * @returns {Promise<unknown>} Its result.
   */
  function serial(task) {
    const run = busy.then(task, task);
    busy = run.catch(() => {});
    return run;
  }

  /**
   * @description GET a URL and read its body.
   * @param {URL} url - The URL.
   * @returns {Promise<{ status: number, type: string, body: string }>} The answer.
   */
  async function get(url) {
    let response;
    try {
      response = await fetchFn(url, {
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new InfoclimatError('unreachable', String(err?.cause?.code ?? err?.name ?? 'error'));
    }
    const body = await response.text();
    return { status: response.status, type: response.headers.get('content-type') ?? '', body };
  }

  /**
   * @description The public list of the stations.
   * @returns {Promise<object[]>} The raw entries.
   */
  function stations() {
    return serial(async () => {
      const { status, body } = await get(new URL(PATHS.stations, baseUrl));
      if (status !== 200) {
        throw new InfoclimatError(kindOf('', status), `HTTP ${status}`);
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw new InfoclimatError('failed', 'The list of the stations is not JSON');
      }
      if (!Array.isArray(data)) {
        throw new InfoclimatError('failed', 'Unexpected list of the stations');
      }
      return data;
    });
  }

  /**
   * @description The observations of some stations between two UTC dates.
   * @param {string[]} ids - The station identifiers.
   * @param {object} range - `{ start, end }`, "YYYY-MM-DD", both inclusive.
   * @returns {Promise<object>} The JSON answer (`hourly`, `stations`, `metadata`).
   */
  function observations(ids, { start, end }) {
    return serial(async () => {
      const token = getToken();
      if (!token) {
        throw new InfoclimatError('auth', 'No key');
      }
      const span = (Date.parse(end) - Date.parse(start)) / DAY_MS;
      if (!(span >= 0 && span < MAX_DAYS) || ids.length === 0) {
        throw new InfoclimatError(
          'invalid',
          `Invalid request: ${ids.length} station(s), ${span} day(s)`,
        );
      }
      const url = new URL(PATHS.observations, baseUrl);
      url.searchParams.set('version', '2');
      url.searchParams.set('method', 'get');
      url.searchParams.set('format', 'json');
      for (const id of ids) {
        url.searchParams.append('stations[]', id);
      }
      url.searchParams.set('start', start);
      url.searchParams.set('end', end);
      url.searchParams.set('token', token);
      const { status, body } = await get(url);
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        // "Could not authenticate request" comes as HTML with a 200.
        const text = body
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        throw new InfoclimatError(kindOf(text, status), `HTTP ${status}: ${text.slice(0, 120)}`);
      }
      const errors = Array.isArray(data?.errors) ? data.errors.map(String) : [];
      if (status !== 200 || errors.length > 0 || (data?.status && data.status !== 'OK')) {
        // The refused token is quoted in the message: never repeat it.
        const message = (errors.join(' · ') || `HTTP ${status}`)
          .replace(token, '…')
          .replace(/'[^']{12,}'/g, "'…'")
          .slice(0, 200);
        throw new InfoclimatError(kindOf(message, status), message);
      }
      if (!data || typeof data !== 'object') {
        throw new InfoclimatError('failed', 'Unexpected answer');
      }
      return data;
    });
  }

  return { stations, observations };
}

export { BASE_URL, PATHS, MAX_DAYS, InfoclimatError, kindOf, utcDate, createInfoclimatClient };
