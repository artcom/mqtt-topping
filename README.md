# mqtt-topping

A small wrapper around the MQTT.js client and an API to query retained topics via HTTP.

## MQTT Client Features

* Subscribe and unsubscribe handler callbacks to individual (wildcard) topics
* `JSON.stringify` all published payloads
* `JSON.parse` all incoming payloads
* Ignore non-JSON payloads
* Decide whether to retain a message or not depending on the topic name (retained unless topic is prefixed with `on` or `do`)
* Publishes and subscriptions are send with quality-of-service 2

### Usage

```javascript
var topping = require("mqtt-topping");

var client = topping.connect("tcp://broker.example.com", "http://broker.example.com");

client.subscribe("my/topic", function(payload, topic, packet) {
  console.log("Received Payload " + payload +
              " for Topic " + topic +
              " (retained = " + packet.retain + ")");
});
```

## HTTP Query Features

* `JSON.parse` all incoming payloads, unless `parseJson` is set to `false`

### Usage

```javascript
client.query({ topic: "my/topic" }).then(function(result) {
  console.log("Payload is " + result.payload);
});

client.query({ topic: "my/topic", depth: 2, flatten: true }).then(function(results) {
  results.forEach(function(result) {
    console.log("topic " + result.topic + " has payload " + result.payload);
  });
});
```
