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

var client = topping.connect("tcp://broker.example.com");

client.subscribe("my/topic", function(payload, topic, packet) {
  console.log("Received Payload " + payload +
              " for Topic " + topic +
              " (retained = " + packet.retain + ")");
});
```

## HTTP Query Features

* Get single topic payload
* Get list of subtopics with payload

### Usage

```javascript
var topping = require("mqtt-topping");

var query = topping.query("http://broker.example.com");

query.topic("my/topic").then(function(payload) {
  console.log("Payload is " + payload);
});

query.subtopics("my/topic").then(function(subtopics) {
  for (var subtopic in subtopics) {
    console.log("subtopic " + subtopic + " has payload " + subtopics[subtopic]);
  }
});
```
