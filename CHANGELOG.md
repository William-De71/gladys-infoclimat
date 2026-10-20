# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- **stations:** follow up to three Infoclimat weather stations, each the nearest StatIC station of a house of Gladys that reported in the last 24 hours, or a station chosen by its identifier (official stations included)
- **devices:** one device per station, with a feature for each measure it gives: temperature, humidity, sea-level pressure, dew point, mean wind, gusts, wind direction, rain over the last hour, rain of the day, snow depth, visibility; a feature once given never disappears
- **reading:** one request for all the stations every 10 minutes (15, 30 or 60 in the configuration), an identifiable User-Agent, no request at startup before its time, longer waits after a failure, a refused key tried again every 6 hours
- **scenes:** triggers when rain starts or stops at a station, when a station goes silent or reports again, and when Infoclimat refuses the key; an action that reads the weather of a station with a sentence ready for a message
- **widgets:** the latest reading of a station, a measure over the last 24 hours with its lowest and highest values, and the followed stations side by side, each crediting Infoclimat and the license of the station
- **i18n:** English, French, German and Spanish for the manifest, the runtime texts, the documentation and the README
