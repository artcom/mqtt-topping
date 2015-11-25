# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [0.6.0] - 2015-11-25

### Added
- Client objects now expose a parts of the [EventEmitter](https://nodejs.org/api/events.html#events_class_events_eventemitter) API, namely `addListener`, `removeListener`, `on` and `once`. They emits [MQTT.js client events](https://github.com/mqttjs/MQTT.js#event-connect).

### Removed
- `connect()` no longer accepts a `connectCallback` parameter. Use `client.on("connect", callback)` instead.

### Changed
- The `axios` dependency was updated.
- The library now depends only on the `lodash` functions that are actually used (modular build).
