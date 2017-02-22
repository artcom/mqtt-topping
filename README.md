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
var topping = require("mqtt-topping").default;

var client = topping.connect("tcp://broker.example.com", "http://broker.example.com");

client.subscribe("my/topic", function(payload, topic, packet) {
  console.log("Received Payload " + payload +
              " for Topic " + topic +
              " (retained = " + packet.retain + ")");
});
```

## HTTP Query Features

### Query

#### Example

```javascript
client.query({ topic: "example", depth: 0, parseJson: true, flatten: false }).then((result) => {
  // process result
});
```

The query API allows single and batch queries including wildcard topics via HTTP. It specifically supports JSON payloads and parses them if possible. Multiple results of a batch, wildcard or flattened query are structured as `Array` of results. A single result has the format:

```javascript
{
  topic: String,
  payload: PAYLOAD,
  children?: CHILDREN
}
// PAYLOAD = The JSON parsed payload
// CHILDREN = An array of subtopic results
```

#### Options

##### Boolean `parseJson`

If `false` `result.payload` contains the raw payload as String. Default is `true`.

##### Number `depth`

Specifies the recursive depth of the query. A `depth > 0` returns subtopic results in `result.children`. Default is `0`.

##### Boolean `flatten`

Flattens all results into a flat array of results. Default is `false`.

### QueryJson

#### Example

```javascript
client.queryJson({ topic: "example" }).then((result) => {
  // process result
});
```

The queryJson API allows single and batch queries via HTTP. Multiple results of a batch query are structured as `Array` of results. A single result is an object containing subtopics as properties. The subtopics may be objects with subtopics or the json parsed payload.
