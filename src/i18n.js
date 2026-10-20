// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, statuses, scene texts,
// results of the configuration buttons. Vocabulary of the Gladys interface
// (appareil / Gerät / dispositivo); German says "du", Spanish "usted", like
// Gladys. Station names are never translated.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices and measures (feature names, scene texts)
  deviceName: {
    en: 'Infoclimat {name}',
    fr: 'Infoclimat {name}',
    de: 'Infoclimat {name}',
    es: 'Infoclimat {name}',
  },
  measure_temperature: {
    en: 'Temperature',
    fr: 'Température',
    de: 'Temperatur',
    es: 'Temperatura',
  },
  measure_humidity: { en: 'Humidity', fr: 'Humidité', de: 'Luftfeuchtigkeit', es: 'Humedad' },
  measure_pressure: {
    en: 'Pressure (sea level)',
    fr: 'Pression (niveau de la mer)',
    de: 'Luftdruck (Meereshöhe)',
    es: 'Presión (nivel del mar)',
  },
  measure_dew_point: {
    en: 'Dew point',
    fr: 'Point de rosée',
    de: 'Taupunkt',
    es: 'Punto de rocío',
  },
  measure_wind_speed: {
    en: 'Mean wind speed',
    fr: 'Vent moyen',
    de: 'Mittlere Windgeschwindigkeit',
    es: 'Viento medio',
  },
  measure_wind_gust: { en: 'Wind gust', fr: 'Rafale', de: 'Windböe', es: 'Ráfaga' },
  measure_wind_direction: {
    en: 'Wind direction',
    fr: 'Direction du vent',
    de: 'Windrichtung',
    es: 'Dirección del viento',
  },
  measure_rain_1h: {
    en: 'Rain over the last hour',
    fr: 'Pluie de la dernière heure',
    de: 'Regen der letzten Stunde',
    es: 'Lluvia de la última hora',
  },
  measure_rain_today: {
    en: 'Rain today (since 00:00 UTC)',
    fr: 'Pluie du jour (depuis 0 h UTC)',
    de: 'Regen heute (seit 0 Uhr UTC)',
    es: 'Lluvia del día (desde las 0 h UTC)',
  },
  measure_snow_depth: {
    en: 'Snow depth',
    fr: 'Neige au sol',
    de: 'Schneehöhe',
    es: 'Espesor de nieve',
  },
  measure_visibility: { en: 'Visibility', fr: 'Visibilité', de: 'Sichtweite', es: 'Visibilidad' },
  measure_radiation: {
    en: 'Solar radiation',
    fr: 'Rayonnement solaire',
    de: 'Sonneneinstrahlung',
    es: 'Radiación solar',
  },

  // tiles (24 characters at most)
  tile_temperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
  tile_humidity: { en: 'Humidity', fr: 'Humidité', de: 'Feuchtigkeit', es: 'Humedad' },
  tile_pressure: { en: 'Pressure', fr: 'Pression', de: 'Luftdruck', es: 'Presión' },
  tile_dew_point: { en: 'Dew point', fr: 'Point de rosée', de: 'Taupunkt', es: 'Punto de rocío' },
  tile_wind_speed: {
    en: 'Wind {direction}',
    fr: 'Vent {direction}',
    de: 'Wind {direction}',
    es: 'Viento {direction}',
  },
  tile_wind_gust: { en: 'Gusts', fr: 'Rafales', de: 'Böen', es: 'Ráfagas' },
  tile_wind_direction: { en: 'Direction', fr: 'Direction', de: 'Richtung', es: 'Dirección' },
  tile_rain_1h: { en: 'Rain (1 h)', fr: 'Pluie (1 h)', de: 'Regen (1 Std.)', es: 'Lluvia (1 h)' },
  tile_rain_today: {
    en: 'Rain today',
    fr: 'Pluie du jour',
    de: 'Regen heute',
    es: 'Lluvia del día',
  },
  tile_snow_depth: { en: 'Snow', fr: 'Neige', de: 'Schnee', es: 'Nieve' },
  tile_visibility: { en: 'Visibility', fr: 'Visibilité', de: 'Sicht', es: 'Visibilidad' },
  tile_radiation: { en: 'Sunshine', fr: 'Rayonnement', de: 'Einstrahlung', es: 'Radiación' },
  tileMin: { en: 'Min (24 h)', fr: 'Min (24 h)', de: 'Min. (24 Std.)', es: 'Mín. (24 h)' },
  tileMax: { en: 'Max (24 h)', fr: 'Max (24 h)', de: 'Max. (24 Std.)', es: 'Máx. (24 h)' },
  tileMaxGust: {
    en: 'Max gust (24 h)',
    fr: 'Rafale max (24 h)',
    de: 'Max. Böe (24 Std.)',
    es: 'Ráfaga máx. (24 h)',
  },
  tileMaxRain: { en: 'Max in 1 h', fr: 'Max en 1 h', de: 'Max. in 1 Std.', es: 'Máx. en 1 h' },

  // the 16 points of the compass, comma-separated
  compass: {
    en: 'N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSW,SW,WSW,W,WNW,NW,NNW',
    fr: 'N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSO,SO,OSO,O,ONO,NO,NNO',
    de: 'N,NNO,NO,ONO,O,OSO,SO,SSO,S,SSW,SW,WSW,W,WNW,NW,NNW',
    es: 'N,NNE,NE,ENE,E,ESE,SE,SSE,S,SSO,SO,OSO,O,ONO,NO,NNO',
  },

  // times
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },
  inMinutes: { en: 'in {n} min', fr: 'dans {n} min', de: 'in {n} Min.', es: 'en {n} min' },

  // licenses of the stations (attribution)
  license_etalab: {
    en: 'Open Licence (Etalab)',
    fr: 'Licence Ouverte (Etalab)',
    de: 'Licence Ouverte (Etalab)',
    es: 'Licencia Abierta (Etalab)',
  },
  'license_cc-by': { en: 'CC BY', fr: 'CC BY', de: 'CC BY', es: 'CC BY' },
  'license_cc-by-nc': {
    en: 'CC BY-NC, non-commercial',
    fr: 'CC BY-NC, non commercial',
    de: 'CC BY-NC, nicht kommerziell',
    es: 'CC BY-NC, no comercial',
  },
  attribution: {
    en: 'Data: Infoclimat',
    fr: 'Données : Infoclimat',
    de: 'Daten: Infoclimat',
    es: 'Datos: Infoclimat',
  },

  // connection status (200 characters at most)
  statusNoKey: {
    en: 'Type your Infoclimat open data key in the configuration.',
    fr: 'Saisissez votre clé open data Infoclimat dans la configuration.',
    de: 'Gib deinen Infoclimat-Open-Data-Schlüssel in der Konfiguration ein.',
    es: 'Escriba su clave open data de Infoclimat en la configuración.',
  },
  statusNoStation: {
    en: 'Key set. Choose a house or type a station identifier in the configuration.',
    fr: 'Clé enregistrée. Choisissez une maison ou saisissez l’identifiant d’une station dans la configuration.',
    de: 'Schlüssel gespeichert. Wähle ein Haus oder gib die Kennung einer Station in der Konfiguration ein.',
    es: 'Clave guardada. Elija una casa o escriba el identificador de una estación en la configuración.',
  },
  statusOk: {
    en: '{count} station(s), read {ago}: {stations}',
    fr: '{count} station(s), lue(s) {ago} : {stations}',
    de: '{count} Station(en), gelesen {ago}: {stations}',
    es: '{count} estación(es), leída(s) {ago}: {stations}',
  },
  statusWaiting: {
    en: 'Waiting for the first reading of Infoclimat.',
    fr: 'En attente de la première lecture d’Infoclimat.',
    de: 'Warte auf die erste Abfrage von Infoclimat.',
    es: 'Esperando la primera lectura de Infoclimat.',
  },
  statusFailing: {
    en: '{detail} Next try {when}.',
    fr: '{detail} Prochain essai {when}.',
    de: '{detail} Nächster Versuch {when}.',
    es: '{detail} Próximo intento {when}.',
  },
  statusSomeFailing: {
    en: '{ok}/{total} station(s) OK. {detail}',
    fr: '{ok}/{total} station(s) OK. {detail}',
    de: '{ok}/{total} Station(en) OK. {detail}',
    es: '{ok}/{total} estación(es) OK. {detail}',
  },
  stationLine: {
    en: '{name} {value}',
    fr: '{name} {value}',
    de: '{name} {value}',
    es: '{name} {value}',
  },

  // errors
  errNoKey: {
    en: 'No Infoclimat key: type it in the configuration.',
    fr: 'Pas de clé Infoclimat : saisissez-la dans la configuration.',
    de: 'Kein Infoclimat-Schlüssel: gib ihn in der Konfiguration ein.',
    es: 'Sin clave de Infoclimat: escríbala en la configuración.',
  },
  errAuth: {
    en: 'Infoclimat refuses the key. Check it; it may be bound to the IP address it was requested from.',
    fr: 'Infoclimat refuse la clé. Vérifiez-la ; elle peut être liée à l’adresse IP qui l’a demandée.',
    de: 'Infoclimat lehnt den Schlüssel ab. Prüfe ihn; er kann an die IP-Adresse gebunden sein, die ihn beantragt hat.',
    es: 'Infoclimat rechaza la clave. Compruébela; puede estar ligada a la dirección IP que la solicitó.',
  },
  errRateLimit: {
    en: 'Infoclimat asks to slow down.',
    fr: 'Infoclimat demande de ralentir.',
    de: 'Infoclimat bittet darum, langsamer abzufragen.',
    es: 'Infoclimat pide ir más despacio.',
  },
  errUnreachable: {
    en: 'Infoclimat cannot be reached ({detail}).',
    fr: 'Infoclimat est injoignable ({detail}).',
    de: 'Infoclimat ist nicht erreichbar ({detail}).',
    es: 'No se puede contactar con Infoclimat ({detail}).',
  },
  errFailed: {
    en: 'Infoclimat answered with an error ({detail}).',
    fr: 'Infoclimat a répondu par une erreur ({detail}).',
    de: 'Infoclimat hat mit einem Fehler geantwortet ({detail}).',
    es: 'Infoclimat respondió con un error ({detail}).',
  },
  errInvalidStation: {
    en: 'Station {slot}: “{station}” is not a station identifier.',
    fr: 'Station {slot} : « {station} » n’est pas un identifiant de station.',
    de: 'Station {slot}: „{station}“ ist keine Stationskennung.',
    es: 'Estación {slot}: «{station}» no es un identificador de estación.',
  },
  errUnknownHouse: {
    en: 'Station {slot}: the chosen house no longer exists.',
    fr: 'Station {slot} : la maison choisie n’existe plus.',
    de: 'Station {slot}: Das gewählte Haus existiert nicht mehr.',
    es: 'Estación {slot}: la casa elegida ya no existe.',
  },
  errHouseNoLocation: {
    en: 'Station {slot}: the house has no location in Gladys.',
    fr: 'Station {slot} : la maison n’a pas de position dans Gladys.',
    de: 'Station {slot}: Das Haus hat keinen Standort in Gladys.',
    es: 'Estación {slot}: la casa no tiene ubicación en Gladys.',
  },
  errNoNearby: {
    en: 'Station {slot}: no StatIC station reported in the last 24 hours.',
    fr: 'Station {slot} : aucune station StatIC n’a émis dans les dernières 24 heures.',
    de: 'Station {slot}: Keine StatIC-Station hat in den letzten 24 Stunden gemeldet.',
    es: 'Estación {slot}: ninguna estación StatIC ha emitido en las últimas 24 horas.',
  },
  errNoList: {
    en: 'Station {slot}: the list of the stations cannot be read yet.',
    fr: 'Station {slot} : la liste des stations ne peut pas encore être lue.',
    de: 'Station {slot}: Die Stationsliste kann noch nicht gelesen werden.',
    es: 'Estación {slot}: la lista de estaciones aún no se puede leer.',
  },
  errNoReading: {
    en: '{name}: no reading in the last 24 hours (unknown identifier or silent station).',
    fr: '{name} : aucun relevé dans les dernières 24 heures (identifiant inconnu ou station muette).',
    de: '{name}: keine Messung in den letzten 24 Stunden (unbekannte Kennung oder stumme Station).',
    es: '{name}: ninguna lectura en las últimas 24 horas (identificador desconocido o estación sin datos).',
  },

  // widgets
  widgetNoStation: {
    en: 'No station yet: choose a house or type a station identifier in the configuration of the integration.',
    fr: 'Aucune station pour l’instant : choisissez une maison ou saisissez l’identifiant d’une station dans la configuration de l’intégration.',
    de: 'Noch keine Station: Wähle ein Haus oder gib die Kennung einer Station in der Konfiguration der Integration ein.',
    es: 'Aún no hay estación: elija una casa o escriba el identificador de una estación en la configuración de la integración.',
  },
  widgetNoReading: {
    en: 'No reading of this station yet. The integration reads Infoclimat every {interval} minutes.',
    fr: 'Pas encore de relevé pour cette station. L’intégration lit Infoclimat toutes les {interval} minutes.',
    de: 'Noch keine Messung dieser Station. Die Integration liest Infoclimat alle {interval} Minuten.',
    es: 'Aún no hay lecturas de esta estación. La integración lee Infoclimat cada {interval} minutos.',
  },
  widgetSilent: {
    en: 'Silent station: no reading since {time} ({ago}).',
    fr: 'Station muette : aucun relevé depuis {time} ({ago}).',
    de: 'Stumme Station: keine Messung seit {time} ({ago}).',
    es: 'Estación sin datos: ninguna lectura desde las {time} ({ago}).',
  },
  widgetNotEnough: {
    en: 'Not enough readings of this measure in the last 24 hours yet.',
    fr: 'Pas encore assez de relevés de cette mesure sur les dernières 24 heures.',
    de: 'Noch nicht genug Messungen dieses Werts in den letzten 24 Stunden.',
    es: 'Aún no hay suficientes lecturas de esta medida en las últimas 24 horas.',
  },
  widgetNoMeasure: {
    en: 'This station does not give this measure: choose another one in the settings of the widget.',
    fr: 'Cette station ne fournit pas cette mesure : choisissez-en une autre dans les réglages du widget.',
    de: 'Diese Station liefert diesen Wert nicht: Wähle einen anderen in den Einstellungen des Widgets.',
    es: 'Esta estación no proporciona esta medida: elija otra en los ajustes del widget.',
  },
  readingAt: {
    en: '{time} ({ago})',
    fr: '{time} ({ago})',
    de: '{time} ({ago})',
    es: '{time} ({ago})',
  },
  chart_temperature: {
    en: 'Temperature, last 24 h',
    fr: 'Température, dernières 24 h',
    de: 'Temperatur, letzte 24 Std.',
    es: 'Temperatura, últimas 24 h',
  },
  chart_humidity: {
    en: 'Humidity, last 24 h',
    fr: 'Humidité, dernières 24 h',
    de: 'Luftfeuchtigkeit, letzte 24 Std.',
    es: 'Humedad, últimas 24 h',
  },
  chart_pressure: {
    en: 'Pressure, last 24 h',
    fr: 'Pression, dernières 24 h',
    de: 'Luftdruck, letzte 24 Std.',
    es: 'Presión, últimas 24 h',
  },
  chart_wind: {
    en: 'Wind, last 24 h',
    fr: 'Vent, dernières 24 h',
    de: 'Wind, letzte 24 Std.',
    es: 'Viento, últimas 24 h',
  },
  chart_rain: {
    en: 'Rain over 1 h, last 24 h',
    fr: 'Pluie sur 1 h, dernières 24 h',
    de: 'Regen in 1 Std., letzte 24 Std.',
    es: 'Lluvia en 1 h, últimas 24 h',
  },
  series_temperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
  series_dew_point: { en: 'Dew point', fr: 'Point de rosée', de: 'Taupunkt', es: 'Punto de rocío' },
  series_humidity: { en: 'Humidity', fr: 'Humidité', de: 'Feuchtigkeit', es: 'Humedad' },
  series_pressure: { en: 'Pressure', fr: 'Pression', de: 'Luftdruck', es: 'Presión' },
  series_wind_speed: { en: 'Mean wind', fr: 'Vent moyen', de: 'Mittelwind', es: 'Viento medio' },
  series_wind_gust: { en: 'Gusts', fr: 'Rafales', de: 'Böen', es: 'Ráfagas' },
  series_rain_1h: { en: 'Rain (1 h)', fr: 'Pluie (1 h)', de: 'Regen (1 Std.)', es: 'Lluvia (1 h)' },
  annotationMin: { en: 'min {value}', fr: 'min {value}', de: 'min. {value}', es: 'mín. {value}' },
  annotationMax: { en: 'max {value}', fr: 'max {value}', de: 'max. {value}', es: 'máx. {value}' },
  badgeSilent: { en: 'Silent', fr: 'Muette', de: 'Stumm', es: 'Sin datos' },
  badgeNoReading: { en: 'No reading', fr: 'Aucun relevé', de: 'Keine Messung', es: 'Sin lectura' },
  compareHeading: {
    en: 'Infoclimat stations',
    fr: 'Stations Infoclimat',
    de: 'Infoclimat-Stationen',
    es: 'Estaciones Infoclimat',
  },
  stationDetails: {
    en: 'Station {id}, {elevation} m, {distance}',
    fr: 'Station {id}, {elevation} m, {distance}',
    de: 'Station {id}, {elevation} m, {distance}',
    es: 'Estación {id}, {elevation} m, {distance}',
  },
  distanceFrom: {
    en: '{km} km from {house}',
    fr: 'à {km} km de {house}',
    de: '{km} km von {house}',
    es: 'a {km} km de {house}',
  },
  typedByHand: {
    en: 'chosen by its identifier',
    fr: 'choisie par son identifiant',
    de: 'über ihre Kennung gewählt',
    es: 'elegida por su identificador',
  },

  // scene texts
  summaryHead: {
    en: '{name}, {time}:',
    fr: '{name}, {time} :',
    de: '{name}, {time}:',
    es: '{name}, {time}:',
  },
  summaryTemperature: { en: '{value} °C', fr: '{value} °C', de: '{value} °C', es: '{value} °C' },
  summaryHumidity: {
    en: 'humidity {value} %',
    fr: 'humidité {value} %',
    de: 'Luftfeuchtigkeit {value} %',
    es: 'humedad {value} %',
  },
  summaryWind: {
    en: 'wind {value} km/h {direction}',
    fr: 'vent {value} km/h {direction}',
    de: 'Wind {value} km/h {direction}',
    es: 'viento {value} km/h {direction}',
  },
  summaryGust: {
    en: 'gusts {value} km/h',
    fr: 'rafales {value} km/h',
    de: 'Böen {value} km/h',
    es: 'ráfagas {value} km/h',
  },
  summaryRain: {
    en: 'rain today {value} mm',
    fr: 'pluie du jour {value} mm',
    de: 'Regen heute {value} mm',
    es: 'lluvia del día {value} mm',
  },
  summaryPressure: { en: '{value} hPa', fr: '{value} hPa', de: '{value} hPa', es: '{value} hPa' },
  summaryNoReading: {
    en: '{name}: no recent reading.',
    fr: '{name} : pas de relevé récent.',
    de: '{name}: keine aktuelle Messung.',
    es: '{name}: ninguna lectura reciente.',
  },

  // configuration buttons
  readDone: {
    en: 'Read: {stations}',
    fr: 'Lu : {stations}',
    de: 'Gelesen: {stations}',
    es: 'Leído: {stations}',
  },
  readTooSoon: {
    en: 'Infoclimat was read {ago}: to spare it, the next reading is {when}.',
    fr: 'Infoclimat a été lu {ago} : pour le ménager, la prochaine lecture a lieu {when}.',
    de: 'Infoclimat wurde {ago} gelesen: um es zu schonen, erfolgt die nächste Abfrage {when}.',
    es: 'Infoclimat se leyó {ago}: para no sobrecargarlo, la próxima lectura será {when}.',
  },
  diagnosticDone: {
    en: 'The state of the integration was written to its logs ({count} line(s)), without the key.',
    fr: 'L’état de l’intégration a été écrit dans ses journaux ({count} ligne(s)), sans la clé.',
    de: 'Der Zustand der Integration wurde in ihre Logs geschrieben ({count} Zeile(n)), ohne den Schlüssel.',
    es: 'El estado de la integración se escribió en sus registros ({count} línea(s)), sin la clave.',
  },
};

/**
 * @description Whether a value is a language of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('minutesAgo', 'fr', { n: 7 }); // 'il y a 7 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string|Function} key - A TEXTS key, or `(language) => text`.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function'
        ? key(language)
        : t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) {
    return t('never', language);
  }
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) {
    return t('justNow', language);
  }
  if (minutes < 60) {
    return t('minutesAgo', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('hoursAgo', language, { n: hours });
  }
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description The point of the compass of a wind direction.
 * @param {number|null} degrees - 0 to 360.
 * @param {string} language - The language.
 * @returns {string} "SW", "SO"…, '' without a direction.
 */
function compassPoint(degrees, language) {
  if (!Number.isFinite(degrees)) {
    return '';
  }
  const points = t('compass', language).split(',');
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * @description A number in the format of a language.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} "12,5" in French.
 */
function formatNumber(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
  }).format(value);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago, compassPoint, formatNumber };
