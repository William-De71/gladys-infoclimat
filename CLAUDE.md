# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the weather stations of
[Infoclimat](https://www.infoclimat.fr), a French non-profit association whose
members share their stations (the StatIC network): a Node.js service (Node
22+, ESM, no build step) that runs in its own sandboxed Docker container and
talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the open data of Infoclimat with the
user's own key: the public list of the stations
(`/opendata/stations_xhr.php`, no key) and the observations
(`/opendata/?version=2&method=get&format=json&stations[]=…&start=…&end=…&token=…`),
for up to three stations — the nearest StatIC station of a house of Gladys, or
a station typed by its identifier. Transport: cloud. The forecasts of
Infoclimat (another key, another API) are out of scope. **Never tested with a
real key**: the shape of the answers comes from a real example and from the
contract `contracts/opendata-export.odcs.yaml` of
github.com/AssociationInfoclimat/data-platform.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer (due,
                        backoff, refused key), the stations (nearest of a house), status
src/infoclimat-api.js   HTTP client: User-Agent, one request at a time, the refusals of
                        Infoclimat (HTML 200, JSON 400), the token never in a message
src/stations.js         the public list: parse, haversine, nearest station reporting
src/parse.js            an answer of the observations -> readings per station (ids
                        matched exactly, by the rows, by the position, or alone)
src/measures.js         the measures: columns of Infoclimat, bounds, feature shapes
src/history.js          readings kept (26 h, 200 max), values now, rain of the day
src/device.js           one device per station, its features and states
src/events.js           scene trigger transitions and payloads, scene action outputs
src/widgets.js          current, history and compare dashboard widgets
src/store.js            /data/infoclimat.json (state) and /data/stations.json (list)
src/config.js           configuration (key, three slots: house or identifier, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
src/time.js             times in the timezone of Gladys (TZ)
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          a real extract of the public list (2026-10-20), the example answer
test/helpers/fake-api.js            the fake Infoclimat behind the `fetch` option
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: the device
  and feature external ids (`station:<identifier in lower case>:<measure>`),
  the measure keys (`temperature`, `humidity`, `pressure`, `dew_point`,
  `wind_speed`, `wind_gust`, `wind_direction`, `rain_1h`, `rain_today`,
  `snow_depth`, `visibility`), feature `category` / `type` / `unit` / `min` /
  `max`, the keys of `config_schema` and `actions`, the internal config key
  `last_language`, the widgets and their settings and options, scene triggers
  (fields, variables) and the scene action (fields, outputs).
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Features never flap.** A station only gets the features of the measures
  it gave (`_params` and a non-null value); the list is kept in /data and only
  grows. A value missing from the latest readings is not published (a 0 would
  be a lie). The dew point is `temperature-sensor` / `probe` (out of the room
  average); the radiation has no Gladys unit and is never a feature.
- **Fair use of a volunteer platform.** One request for all the stations,
  every `interval` minutes (10 at least), never from a widget, a scene action
  or twice within 2 minutes from "Read now"; no request at startup before its
  time (kept in /data); a failure doubles the wait up to an hour, a 429 waits
  an hour, a refused key is tried again every 6 hours (or at once with a new
  key). The public list is read once a day at most, only when needed.
  Identifiable User-Agent, one request at a time.
- **`should_poll` stays false**: the integration has its own timer.
- **The key** is a `secret`: never logged, never in /data, never in a scene
  variable; the API takes it in the query string, so errors never carry the
  URL and the refusals of Infoclimat are cleaned of it. The location of the
  houses never leaves the container.
- **Attribution.** Every widget credits Infoclimat and the license of the
  station; README, docs and NOTICE say the data are for a personal,
  non-commercial use.
- **Scene events** once per transition, never at the first reading of a
  station, never as the consequence of an action; what they know (`seen`)
  lives in /data.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. German says "du", Spanish "usted",
  like the Gladys interface. Station names are never translated.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. The house picker (`source: "houses"`) needs `gladys_version`
  `>=5.2.0` and `location: true`. Transport: `["cloud"]`.
- **Gladys does not pass DEBUG to the container of a store user**: the
  "Diagnostic" button writes the state to the logs instead.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake Infoclimat of
  `test/helpers/fake-api.js`).
