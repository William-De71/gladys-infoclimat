// -----------------------------------------------------------------------------
// Dashboard widgets of the Infoclimat integration.
//
//   - `current`  the latest reading of a station: up to six tiles
//                (temperature, humidity, wind and its direction, gusts,
//                pressure, rain of the day…), when it was taken, and the
//                credit of Infoclimat with the license of the station;
//   - `history`  a measure of a station over the last 24 hours (temperature
//                with the dew point, humidity, pressure, wind with the gusts,
//                rain), its lowest and highest values marked;
//   - `compare`  the followed stations side by side, one card each, a silent
//                station flagged.
// No refresh button: the integration reads Infoclimat on its own timer, and
// a volunteer platform is never asked more often than that. Every text exists
// in the four languages (the content is cached per language). Content budget
// of a card: 8 components, 1 main one, 6 tiles, 2 texts (1 body), 1 status,
// 4 buttons.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, ago, compassPoint, formatNumber } from './i18n.js';
import { measureOf, round } from './measures.js';
import { seriesOf, SILENT_AFTER_MS } from './history.js';
import { licenseByCode } from './stations.js';
import { formatTime } from './time.js';

const WIDGETS = { CURRENT: 'current', HISTORY: 'history', COMPARE: 'compare' };
const HISTORY_MEASURES = {
  temperature: { series: ['temperature', 'dew_point'], unit: '°C', chart: 'area' },
  humidity: { series: ['humidity'], unit: '%', chart: 'area' },
  pressure: { series: ['pressure'], unit: 'hPa', chart: 'line' },
  wind: { series: ['wind_speed', 'wind_gust'], unit: 'km/h', chart: 'line' },
  rain: { series: ['rain_1h'], unit: 'mm', chart: 'bar' },
};
const TTL_SECONDS = { content: 300, message: 120 };
// The tiles of the `current` widget, the first ones first; six at most.
const TILE_ORDER = [
  'temperature',
  'humidity',
  'wind_speed',
  'wind_gust',
  'pressure',
  'rain_today',
  'rain_1h',
  'dew_point',
  'snow_depth',
  'visibility',
  'radiation',
];
const TILE_ICONS = {
  temperature: 'thermometer',
  humidity: 'droplet',
  wind_speed: 'wind',
  wind_gust: 'wind',
  pressure: 'activity',
  rain_today: 'cloud-rain',
  rain_1h: 'cloud-drizzle',
  dew_point: 'thermometer',
  snow_depth: 'cloud-snow',
  visibility: 'eye',
  radiation: 'sun',
};
const MAX_TILES = 6;

/**
 * @description The value of a tile: whole hectopascals (a tile is narrow).
 * @param {string} key - The measure.
 * @param {number} value - The value.
 * @returns {number} The value.
 */
const tileValue = (key, value) => (key === 'pressure' ? Math.round(value) : round(key, value));

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {object} [options] - `{ heading, ttl }`.
 * @returns {object} The content.
 */
function messageContent(message, { heading, ttl = TTL_SECONDS.message } = {}) {
  const components = [];
  if (heading) {
    components.push({ type: 'text', variant: 'heading', text: clip(heading, 40) });
  }
  components.push({ type: 'text', variant: 'body', text: clip(message, 300) });
  return { ttl_seconds: ttl, components };
}

/**
 * @description The credit of a station: "Data: Infoclimat, CC BY-NC, non-commercial".
 * @param {object} station - `{ license, licenseText }`.
 * @param {string} language - The language.
 * @param {object} [options] - `{ short }`: the name of the license only ("CC BY-NC").
 * @returns {string} The credit.
 */
function attributionOf(station, language, { short = false } = {}) {
  const license = station.license
    ? short
      ? (licenseByCode(station.license)?.name ?? station.license)
      : t(`license_${station.license}`, language)
    : (station.licenseText ?? '');
  return [t('attribution', language), license].filter(Boolean).join(', ');
}

/**
 * @description "13:50 (7 min ago)".
 * @param {number} at - The instant.
 * @param {object} options - `{ language, timeZone, now }`.
 * @returns {string} The text.
 */
const readingTime = (at, { language, timeZone, now }) =>
  t('readingAt', language, {
    time: formatTime(at, { language, timeZone, now }),
    ago: ago(at, now, language),
  });

/**
 * @description The label of a tile.
 * @param {string} key - The measure.
 * @param {object} values - The values now.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const tileLabel = (key, values, language) =>
  clip(
    t(`tile_${key}`, language, {
      direction: compassPoint(values.wind_direction, language),
    }).trim(),
    24,
  );

/**
 * @description The "current" widget.
 * @param {object} options - Options.
 * @param {object} options.station - `{ id, name, license, licenseText }`.
 * @param {object|null} options.current - `{ at, values }` (history.currentOf).
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @param {number} options.now - Now (ms).
 * @param {number} options.interval - Minutes between two readings.
 * @returns {object} The content.
 */
function buildCurrentWidget({ station, current, language, timeZone, now, interval }) {
  if (!current) {
    return messageContent(t('widgetNoReading', language, { interval }), { heading: station.name });
  }
  const { values } = current;
  const silent = now - current.at > SILENT_AFTER_MS;
  const components = [
    {
      type: 'text',
      variant: 'caption',
      text: clip(`${station.name} · ${readingTime(current.at, { language, timeZone, now })}`, 80),
    },
  ];
  const tiled = TILE_ORDER.filter((key) => Number.isFinite(values[key]))
    // The rain of the last hour only when the rain of the day is not there.
    .filter((key) => key !== 'rain_1h' || !Number.isFinite(values.rain_today))
    .slice(0, MAX_TILES);
  for (const key of tiled) {
    const measure = measureOf(key);
    const tile = {
      type: 'value',
      value: tileValue(key, values[key]),
      unit: measure.unit,
      label: tileLabel(key, values, language),
      icon: TILE_ICONS[key],
    };
    if (key === 'temperature') {
      tile.color = values.temperature <= 0 ? WIDGET_COLORS.INFO : WIDGET_COLORS.PRIMARY;
    } else if (key.startsWith('rain_') && values.rain_1h > 0) {
      tile.color = WIDGET_COLORS.INFO;
    }
    components.push(tile);
  }
  const extras = TILE_ORDER.filter(
    (key) => Number.isFinite(values[key]) && !tiled.includes(key) && key !== 'rain_1h',
  ).map(
    (key) =>
      `${t(`tile_${key}`, language, { direction: '' }).trim()} ${formatNumber(round(key, values[key]), language)} ${measureOf(key).unit}`,
  );
  const lines = [];
  if (silent) {
    lines.push(
      t('widgetSilent', language, {
        time: formatTime(current.at, { language, timeZone, now }),
        ago: ago(current.at, now, language),
      }),
    );
  }
  if (extras.length) {
    lines.push(extras.join(' · '));
  }
  lines.push(`${attributionOf(station, language)}.`);
  components.push({ type: 'text', variant: 'body', text: clip(lines.join('\n'), 300) });
  return { ttl_seconds: TTL_SECONDS.content, components };
}

/**
 * @description The lowest and highest point of a series.
 * @param {Array<{ at: number, value: number }>} points - The points.
 * @returns {{ min: object, max: object }|null} The points.
 */
function extremes(points) {
  if (points.length === 0) {
    return null;
  }
  let min = points[0];
  let max = points[0];
  for (const point of points) {
    if (point.value < min.value) min = point;
    if (point.value >= max.value) max = point;
  }
  return { min, max };
}

/**
 * @description The "history" widget.
 * @param {object} options - Options.
 * @param {object} options.station - `{ id, name, params, license, licenseText }`.
 * @param {object[]} options.readings - The kept readings, sorted.
 * @param {object|null} options.current - `{ at, values }`.
 * @param {string} options.measure - temperature, humidity, pressure, wind, rain.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now (ms).
 * @param {number} options.interval - Minutes between two readings.
 * @returns {object} The content.
 */
function buildHistoryWidget({ station, readings, current, measure, language, now, interval }) {
  const kind = HISTORY_MEASURES[measure] ? measure : 'temperature';
  const shape = HISTORY_MEASURES[kind];
  const [main] = shape.series;
  if (!current && (readings ?? []).length === 0) {
    return messageContent(t('widgetNoReading', language, { interval }), { heading: station.name });
  }
  if (!(station.params ?? []).includes(main)) {
    return messageContent(t('widgetNoMeasure', language), { heading: station.name });
  }
  const series = shape.series
    .map((key) => ({ key, points: seriesOf(readings, key, now) }))
    .filter(({ points }) => points.length > 0);
  const mainPoints = series.find(({ key }) => key === main)?.points ?? [];
  if (mainPoints.length < 2) {
    return messageContent(t('widgetNotEnough', language), { heading: station.name });
  }
  const show = (key, value) =>
    `${formatNumber(round(key, value), language)} ${measureOf(key).unit}`;
  const tile = (key, value, label, color) => ({
    type: 'value',
    value: tileValue(key, value),
    unit: measureOf(key).unit,
    label: clip(label, 24),
    ...(color ? { color } : {}),
  });
  const span = extremes(mainPoints);
  const tiles = [];
  if (kind === 'wind') {
    tiles.push(tile(main, span.max.value, t('tileMax', language)));
    const gusts = series.find(({ key }) => key === 'wind_gust')?.points ?? [];
    if (gusts.length) {
      tiles.push(tile('wind_gust', extremes(gusts).max.value, t('tileMaxGust', language)));
    }
  } else if (kind === 'rain') {
    if (Number.isFinite(current?.values.rain_today)) {
      tiles.push(tile('rain_today', current.values.rain_today, t('tile_rain_today', language)));
    }
    tiles.push(
      tile(
        main,
        span.max.value,
        t('tileMaxRain', language),
        span.max.value > 0 ? WIDGET_COLORS.INFO : null,
      ),
    );
  } else {
    tiles.push(
      tile(
        main,
        span.min.value,
        t('tileMin', language),
        kind === 'temperature' ? WIDGET_COLORS.INFO : null,
      ),
    );
    tiles.push(
      tile(
        main,
        span.max.value,
        t('tileMax', language),
        kind === 'temperature' ? WIDGET_COLORS.DANGER : null,
      ),
    );
  }
  const annotations =
    kind === 'rain'
      ? span.max.value > 0
        ? [
            {
              t: new Date(span.max.at).toISOString(),
              value: round(main, span.max.value),
              label: clip(t('annotationMax', language, { value: show(main, span.max.value) }), 16),
              color: WIDGET_COLORS.INFO,
            },
          ]
        : []
      : [
          {
            t: new Date(span.min.at).toISOString(),
            value: round(main, span.min.value),
            label: clip(t('annotationMin', language, { value: show(main, span.min.value) }), 16),
            color: WIDGET_COLORS.INFO,
          },
          {
            t: new Date(span.max.at).toISOString(),
            value: round(main, span.max.value),
            label: clip(t('annotationMax', language, { value: show(main, span.max.value) }), 16),
            color: WIDGET_COLORS.DANGER,
          },
        ];
  return {
    ttl_seconds: TTL_SECONDS.content,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(`${station.name} · ${attributionOf(station, language, { short: true })}`, 80),
      },
      ...tiles,
      {
        type: 'chart',
        chart_type: shape.chart,
        title: clip(t(`chart_${kind}`, language), 40),
        unit: shape.unit,
        series: series.map(({ key, points }) => ({
          name: clip(t(`series_${key}`, language), 24),
          points: points.map((point) => ({
            t: new Date(point.at).toISOString(),
            v: round(key, point.value),
          })),
        })),
        ...(annotations.length ? { annotations } : {}),
      },
    ],
  };
}

/**
 * @description The "compare" widget.
 * @param {object} options - Options.
 * @param {object[]} options.stations - `[{ station, current }]`: `station` is
 * `{ id, name, license, licenseText, elevation, distanceKm, house }`.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @param {number} options.now - Now (ms).
 * @returns {object} The content.
 */
function buildCompareWidget({ stations, language, timeZone, now }) {
  if (!stations.length) {
    return messageContent(t('widgetNoStation', language));
  }
  const items = stations.map(({ station, current }) => {
    const values = current?.values ?? {};
    const show = (key) =>
      Number.isFinite(values[key])
        ? `${formatNumber(round(key, values[key]), language)} ${measureOf(key).unit}`
        : null;
    const wind = show('wind_speed')
      ? `${show('wind_speed')} ${compassPoint(values.wind_direction, language)}`.trim()
      : null;
    const silent = !current || now - current.at > SILENT_AFTER_MS;
    const details = [
      ...[
        'pressure',
        'dew_point',
        'wind_gust',
        'rain_today',
        'rain_1h',
        'snow_depth',
        'visibility',
        'radiation',
      ]
        .filter((key) => show(key))
        // French puts a space before the colon.
        .map(
          (key) =>
            `${t(`tile_${key}`, language, { direction: '' }).trim()}${language === 'fr' ? ' : ' : ': '}${show(key)}`,
        ),
      current ? readingTime(current.at, { language, timeZone, now }) : null,
      t('stationDetails', language, {
        id: station.id,
        elevation: Number.isFinite(station.elevation)
          ? formatNumber(station.elevation, language, 0)
          : '–',
        distance: Number.isFinite(station.distanceKm)
          ? t('distanceFrom', language, {
              km: formatNumber(station.distanceKm, language, 1),
              house: station.house ?? '',
            })
          : t('typedByHand', language),
      }),
      attributionOf(station, language),
    ].filter(Boolean);
    return {
      title: clip(station.name, 60),
      subtitle: clip(
        [show('temperature'), show('humidity'), wind].filter(Boolean).join(' · ') ||
          t('badgeNoReading', language),
        60,
      ),
      badge: current
        ? {
            text: clip(silent ? t('badgeSilent', language) : ago(current.at, now, language), 16),
            color: silent ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
          }
        : { text: clip(t('badgeNoReading', language), 16), color: WIDGET_COLORS.WARNING },
      description: clip(details.join('\n'), 2000),
    };
  });
  return {
    ttl_seconds: TTL_SECONDS.content,
    components: [
      { type: 'card-list', display: 'list', items },
      { type: 'text', variant: 'caption', text: clip(`${t('attribution', language)}.`, 80) },
    ],
  };
}

export {
  WIDGETS,
  HISTORY_MEASURES,
  TTL_SECONDS,
  TILE_ORDER,
  clip,
  messageContent,
  attributionOf,
  buildCurrentWidget,
  buildHistoryWidget,
  buildCompareWidget,
};
