// -----------------------------------------------------------------------------
// Times. Infoclimat writes UTC times without a zone ("2026-10-20 11:50:00");
// the texts are written in the timezone of the Gladys instance (TZ, given by
// the supervisor).
// -----------------------------------------------------------------------------

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description "13:50" in the language and timezone of the user; the day too
 * when it is not today.
 * @param {number|null} instant - The instant (ms).
 * @param {object} [options] - `{ language, timeZone, now }`.
 * @returns {string} The time, '' when none.
 */
function formatTime(instant, { language = 'en', timeZone = defaultTimeZone(), now } = {}) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  const locale = language === 'en' ? 'en-GB' : language;
  const day = (value) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value));
  const sameDay = !Number.isFinite(now) || day(instant) === day(now);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(sameDay ? {} : { weekday: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant));
}

export { defaultTimeZone, formatTime };
