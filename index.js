// -----------------------------------------------------------------------------
// Entry point of the Infoclimat external integration.
//
// The weather stations of Infoclimat (the StatIC network of its members, and
// official stations by their identifier), through its open data API and the
// user's own key:
//   - devices: one per station (temperature, humidity, pressure, dew point,
//     wind, gusts, wind direction, rain of the hour and of the day, snow,
//     visibility, as the station gives them), offered on the Discovery
//     screen (see src/device.js);
//   - scene triggers: rain started / stopped, station silent / back, key refused;
//   - scene action: read the weather of a station;
//   - dashboard widgets: the latest reading, 24 hours of a measure, the
//     stations side by side.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the times are shown in it)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Infoclimat integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
