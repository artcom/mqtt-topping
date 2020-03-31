# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [1.0.0] - 2020-03-30

### Changed
- removed babel in favor of tslint

### Added
- onParseError callback option

## [0.7.0] - 2017-02-22

### Changed
- updated all dependencies
- use modern export syntax

## [0.6.5] - 2016-09-29

### Added
- The `queryJson()` method can be used to query retained topics as a JSON object tree.

## [0.6.4] - 2016-05-11

### Added
- The client can now be disconnected using the `disconnect()` method.

## [0.6.3] - 2016-03-09

### Added
- `publish()` now handles the `qos` option to set the quality of service (defaulting to 2).

### Changed
- The `axios` and `lodash` dependencies were updated.

## [0.6.2] - 2015-12-18

### Added
- Parsing of JSON payloads can be disabled for individual subscriptions using `subscribe(topic, { parseJson: false }, callback)`.

### Changed
- The `axios` dependency was updated.

### Fixed
- Subscribing to "#"
- Subscriptions with a leading "+" wildcard

## [0.6.1] - 2015-12-08

### Added
- `publish()` can now be called with a parameter to avoid stringification of the payload: `publish(topic, payload, { stringifyJson: false })`

## [0.6.0] - 2015-11-25

### Added
- Client objects now expose a parts of the [EventEmitter](https://nodejs.org/api/events.html#events_class_events_eventemitter) API, namely `addListener`, `removeListener`, `on` and `once`. They emits [MQTT.js client events](https://github.com/mqttjs/MQTT.js#event-connect).

### Removed
- `connect()` no longer accepts a `connectCallback` parameter. Use `client.on("connect", callback)` instead.

### Changed
- The `axios` dependency was updated.
- The library now depends only on the `lodash` functions that are actually used (modular build).
